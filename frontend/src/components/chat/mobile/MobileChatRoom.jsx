import { Camera, MapPin, Plus, Send, UsersRound, Vote, Reply, MoreVertical, X, Pin } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { meetingApi } from "../../../api/meetingApi";
import { voteApi } from "../../../api/voteApi";
import { userApi } from "../../../api/userApi";
import { locationApi } from "../../../api/locationApi";

function formatMessageTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function formatMessageDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function messageDateKey(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" }).format(new Date(value));
}

function isTodayKst(value) {
  return messageDateKey(value) === messageDateKey(new Date().toISOString());
}

function splitCommaText(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function senderLabel(sender) {
  return sender?.nickname || sender?.name || "참여자";
}

function messagePreview(message) {
  if (!message) return "";
  if (message.message_type === "image") return message.attachment_name || "사진";
  if (message.message_type === "location") return message.location_label || "공유한 위치";
  return message.content || "";
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function mapUrl(message) {
  const lat = message.location_latitude;
  const lng = message.location_longitude;
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function replySenderLabel(message) {
  return message?.reply_to_sender_name || senderLabel(message?.reply_to?.sender);
}

function replyContent(message) {
  if (!message) return "";
  return message.reply_to_content || messagePreview(message.reply_to);
}

function MobileChatRoom() {
  const { chatRoomId } = useParams();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteMode, setVoteMode] = useState("list");
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);
  const [voteForm, setVoteForm] = useState({ title: "", options: ["참여", "불참"] });
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const [voteNotice, setVoteNotice] = useState("");
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("");

  /* Photo Lightbox & Place Search */
  const [activePhotoUrl, setActivePhotoUrl] = useState(null);
  const [locationSelectOpen, setLocationSelectOpen] = useState(false);
  const [placeSearchOpen, setPlaceSearchOpen] = useState(false);
  const [placeSearchKeyword, setPlaceSearchKeyword] = useState("");
  const [placeSearchResults, setPlaceSearchResults] = useState([]);
  const [placeSearchLoading, setPlaceSearchLoading] = useState(false);
  const [placeSearchError, setPlaceSearchError] = useState("");
  const [profilePreviewUser, setProfilePreviewUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  /* Reply & Options Menu */
  const [replyTarget, setReplyTarget] = useState(null);
  const [optionsMenuMessageId, setOptionsMenuMessageId] = useState(null);
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  /* Notice form */
  const [noticeFormOpen, setNoticeFormOpen] = useState(false);
  const [noticeForm, setNoticeForm] = useState({ title: "", content: "", is_pinned: true });
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [noticeRefreshKey, setNoticeRefreshKey] = useState(0);

  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const messageRefs = useRef({});
  const messages = useAsync(() => chatApi.messages(chatRoomId), [chatRoomId, refreshKey]);
  const room = messages.data?.room;
  const meeting = room?.meeting;
  const isRoomHost = String(meeting?.host?.id ?? "") === String(user?.id ?? "");
  const myRole = isRoomHost ? "host" : (meeting?.my_participant?.role || "member");
  const canCreateVote = ["host", "cohost", "subhost", "assistant"].includes(String(myRole).toLowerCase());
  const canManageRoom = Boolean(room?.can_manage || meeting?.can_manage || ["host", "cohost", "subhost", "assistant"].includes(String(myRole).toLowerCase()));
  const votes = useAsync(() => meeting?.id ? meetingApi.votes(meeting.id) : Promise.resolve({ items: [] }), [meeting?.id, voteRefreshKey]);
  const notices = useAsync(() => meeting?.id ? meetingApi.notices(meeting.id) : Promise.resolve({ items: [] }), [meeting?.id, noticeRefreshKey]);
  const pinnedNotice = (() => {
    const items = notices.data?.items || [];
    return items.find((item) => item.is_pinned) || items[0] || null;
  })();
  const renderedMessages = messages.data?.items || [];

  useLayoutEffect(() => {
    if (!messages.data?.items) return undefined;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "auto"
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [messages.data?.items?.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || sending || realtimeConnected) return;
      setRefreshKey((value) => value + 1);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [realtimeConnected, sending]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !chatRoomId) {
      setRealtimeConnected(false);
      return undefined;
    }

    const channel = supabase
      .channel(`mobile-chat-room-${chatRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `chat_room_id=eq.${chatRoomId}`
        },
        () => setRefreshKey((value) => value + 1)
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message_reads"
        },
        () => setRefreshKey((value) => value + 1)
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !meeting?.id) return undefined;
    const channel = supabase
      .channel(`mobile-chat-votes-${meeting.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => setVoteRefreshKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_options" }, () => setVoteRefreshKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, () => setVoteRefreshKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, () => setNoticeRefreshKey((value) => value + 1))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [meeting?.id]);

  /* Close options menu on outside click */
  useEffect(() => {
    if (optionsMenuMessageId == null) return undefined;
    const close = (event) => {
      if (event.target.closest(".mobile-msg-options-menu") || event.target.closest(".mobile-msg-more-btn")) return;
      setOptionsMenuMessageId(null);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [optionsMenuMessageId]);

  const send = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setError("");
    setSending(true);
    try {
      await chatApi.send(chatRoomId, {
        content: content.trim(),
        reply_to_message_id: replyTarget?.id || null
      });
      setContent("");
      setReplyTarget(null);
      setRefreshKey((value) => value + 1);
    } catch (sendError) {
      setError(sendError.response?.data?.message || "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const openPhotoPicker = () => {
    setActionNotice("");
    setError("");
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const resetInput = () => {
      event.target.value = "";
    };
    if (!file.type.startsWith("image/")) {
      setActionNotice("이미지 파일만 전송할 수 있습니다.");
      resetInput();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionNotice("사진은 5MB 이하만 전송할 수 있습니다.");
      resetInput();
      return;
    }
    setActionMenuOpen(false);
    setSending(true);
    setActionNotice("");
    setError("");
    readImageAsDataUrl(file)
      .then((dataUrl) => chatApi.send(chatRoomId, {
        content: file.name || "사진",
        message_type: "image",
        attachment_url: dataUrl,
        attachment_name: file.name,
        reply_to_message_id: replyTarget?.id || null
      }))
      .then(() => {
        setReplyTarget(null);
        setRefreshKey((value) => value + 1);
      })
      .catch((photoError) => {
        setError(photoError.response?.data?.message || "사진 전송에 실패했습니다.");
      })
      .finally(() => {
        setSending(false);
        resetInput();
      });
  };

  const shareLocation = () => {
    setActionNotice("");
    setError("");
    if (!("geolocation" in navigator)) {
      const msg = "이 브라우저에서는 위치 공유를 사용할 수 없습니다.";
      setError(msg);
      alert(msg);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        setActionMenuOpen(false);
        setSending(true);
        try {
          const { latitude, longitude } = position.coords;
          await chatApi.send(chatRoomId, {
            content: "현재 위치를 공유했습니다.",
            message_type: "location",
            location: {
              latitude,
              longitude,
              label: "현재 위치"
            },
            reply_to_message_id: replyTarget?.id || null
          });
          setReplyTarget(null);
          setRefreshKey((value) => value + 1);
        } catch (locationError) {
          const errMsg = locationError.response?.data?.message || "위치 공유에 실패했습니다.";
          setError(errMsg);
          alert(errMsg);
        } finally {
          setSending(false);
        }
      },
      (geoErr) => {
        console.error("Geolocation error:", geoErr);
        let errorMsg = "위치 정보를 가져오지 못했습니다.";
        if (geoErr.code === geoErr.PERMISSION_DENIED) {
          errorMsg = "위치 권한이 거부되었습니다. 브라우저 설정에서 위치 권한을 확인해주세요.";
        } else if (geoErr.code === geoErr.POSITION_UNAVAILABLE) {
          errorMsg = "위치 정보를 사용할 수 없습니다. GPS 신호를 확인해주세요.";
        } else if (geoErr.code === geoErr.TIMEOUT) {
          errorMsg = "위치 정보를 가져오는데 시간이 초과되었습니다.";
        }
        setError(errorMsg);
        alert(errorMsg);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const handlePlaceSearch = async (e) => {
    e.preventDefault();
    if (!placeSearchKeyword.trim()) return;
    setPlaceSearchLoading(true);
    setPlaceSearchError("");
    setPlaceSearchResults([]);
    try {
      let items = [];
      try {
        const res = await locationApi.searchPlaces({ keyword: placeSearchKeyword.trim() });
        items = res.items || [];
      } catch (backendErr) {
        console.warn("Backend search failed, using OSM fallback:", backendErr);
      }

      if (items.length === 0) {
        const osmRes = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
            placeSearchKeyword.trim()
          )}&limit=15`,
          {
            headers: {
              "Accept-Language": "ko,en-US;q=0.9,en;q=0.8"
            }
          }
        );
        if (osmRes.ok) {
          const data = await osmRes.json();
          items = data.map((item) => {
            const parts = item.display_name.split(",");
            const title = parts[0]?.trim() || "장소";
            const address = parts.slice(1).map(p => p.trim()).join(", ") || item.display_name;
            return {
              title,
              address,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon)
            };
          });
        }
      }

      setPlaceSearchResults(items);
      if (items.length === 0) {
        setPlaceSearchError("검색 결과가 없습니다.");
      }
    } catch (err) {
      console.error("Place search failed:", err);
      setPlaceSearchError("장소 검색에 실패했습니다.");
    } finally {
      setPlaceSearchLoading(false);
    }
  };

  const sendPlaceLocation = async (item) => {
    setSending(true);
    setError("");
    try {
      await chatApi.send(chatRoomId, {
        content: item.title || "위치를 공유했습니다.",
        message_type: "location",
        location: {
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          label: item.title || "공유한 위치"
        },
        reply_to_message_id: replyTarget?.id || null
      });
      setReplyTarget(null);
      setPlaceSearchOpen(false);
      setPlaceSearchKeyword("");
      setPlaceSearchResults([]);
      setRefreshKey((value) => value + 1);
    } catch (err) {
      setError(err.response?.data?.message || "위치 공유에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const openVoteList = () => {
    setVoteMode("list");
    setVoteError("");
    setVoteNotice("");
    setVoteOpen(true);
  };

  const openVoteCreate = () => {
    setActionMenuOpen(false);
    setVoteMode("create");
    setVoteError("");
    setVoteNotice("");
    setVoteOpen(true);
  };

  const updateVoteOption = (index, value) => {
    setVoteForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  const createVote = async (event) => {
    event.preventDefault();
    if (!meeting?.id) return;
    const options = voteForm.options.map((option) => option.trim()).filter(Boolean);
    if (!voteForm.title.trim() || options.length < 2) {
      setVoteError("투표 제목과 선택지 2개 이상을 입력해주세요.");
      return;
    }
    setVoteSubmitting(true);
    setVoteError("");
    setVoteNotice("");
    try {
      await meetingApi.createVote(meeting.id, { title: voteForm.title.trim(), options });
      setVoteForm({ title: "", options: ["참여", "불참"] });
      setVoteMode("list");
      setVoteNotice("투표가 등록되었습니다.");
      setVoteRefreshKey((value) => value + 1);
    } catch (createError) {
      setVoteError(createError.response?.data?.message || "투표를 생성하지 못했습니다.");
    } finally {
      setVoteSubmitting(false);
    }
  };

  const participateVote = async (voteId, optionId) => {
    setVoteError("");
    setVoteNotice("");
    try {
      await voteApi.participate(voteId, { option_id: optionId });
      setVoteNotice("투표 선택이 반영되었습니다.");
      setVoteRefreshKey((value) => value + 1);
    } catch (participateError) {
      setVoteError(participateError.response?.data?.message || "투표 참여에 실패했습니다.");
    }
  };

  const openUserProfile = async (sender) => {
    if (!sender) return;
    setProfilePreviewUser(sender);
    setProfileNotice("");
    if (!sender.id) return;
    setProfileLoading(true);
    try {
      const data = await userApi.get(sender.id);
      setProfilePreviewUser(data.user || sender);
    } catch (profileError) {
      setProfileNotice("사용자 정보를 불러오지 못했습니다.");
    } finally {
      setProfileLoading(false);
    }
  };

  /* Toggle options menu for a message */
  const toggleOptionsMenu = (messageId) => {
    setOptionsMenuMessageId((current) => current === messageId ? null : messageId);
  };

  /* Reply to a message */
  const startReply = (message) => {
    console.log("startReply triggered with message:", message);
    setOptionsMenuMessageId(null);
    setReplyTarget(message);
    window.setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  /* Register message as notice */
  const openNoticeDraft = (message) => {
    console.log("openNoticeDraft triggered with message:", message);
    setOptionsMenuMessageId(null);
    setNoticeError("");
    setNoticeForm({
      title: "채팅 공지",
      content: message.content || "",
      is_pinned: true
    });
    setNoticeFormOpen(true);
  };

  const createNotice = async (event) => {
    event.preventDefault();
    if (!meeting?.id) return;
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      setNoticeError("공지 제목과 내용을 입력해주세요.");
      return;
    }
    setNoticeSubmitting(true);
    setNoticeError("");
    console.log("Registering notice. meetingId:", meeting.id, "payload:", {
      title: noticeForm.title.trim(),
      content: noticeForm.content.trim(),
      is_pinned: noticeForm.is_pinned
    });
    try {
      const response = await meetingApi.createNotice(meeting.id, {
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        is_pinned: noticeForm.is_pinned
      });
      console.log("Notice registered successfully. Response:", response);
      setNoticeFormOpen(false);
      setNoticeRefreshKey((value) => value + 1);
      setRefreshKey((value) => value + 1);
      setActionNotice("공지사항이 등록되었습니다.");
    } catch (noticeCreateError) {
      console.error("Error creating notice:", noticeCreateError);
      setNoticeError(noticeCreateError.response?.data?.message || "공지 등록에 실패했습니다.");
    } finally {
      setNoticeSubmitting(false);
    }
  };

  /* Focus reply source message (scroll to it) */
  const focusReplySource = (messageId) => {
    if (!messageId) return;
    window.requestAnimationFrame(() => {
      const node = messageRefs.current[messageId];
      if (!node) return;
      node.scrollIntoView({ block: "center", behavior: "smooth" });
      setFocusedMessageId(messageId);
      window.setTimeout(() => setFocusedMessageId((current) => current === messageId ? null : current), 1400);
    });
  };

  return (
    <>
      <MobileHeader
        title={meeting?.title || "채팅방"}
        actions={
          <div className="mobile-header__actions mobile-chat-header-actions">
            {meeting?.id ? (
              <Link className="mobile-chat-detail-link" to={`/meetings/${meeting.id}`}>
                <span>상세</span>
              </Link>
            ) : null}
            <button className="mobile-chat-vote-link" type="button" onClick={openVoteList}>
              투표
            </button>
          </div>
        }
      />
      {messages.loading && !messages.data ? (
        <LoadingCards count={3} />
      ) : messages.error ? (
        <EmptyState title="채팅방을 불러오지 못했습니다." description="참여 승인 상태를 확인하거나 잠시 후 다시 시도해주세요." actionLabel="채팅 목록" actionTo="/chats" />
      ) : (
        <>
          {/* Pinned notice bar */}
          {pinnedNotice ? (
            <div className="chat-fixed-notice">
              <section className={`chat-notice ${noticeOpen ? "is-open" : ""}`}>
                <button type="button" onClick={() => setNoticeOpen((value) => !value)} aria-expanded={noticeOpen}>
                  <strong>{pinnedNotice.title}</strong>
                  <span>{pinnedNotice.content}</span>
                  <em>{noticeOpen ? "접기" : "펼치기"}</em>
                </button>
                {noticeOpen ? (
                  <div className="chat-notice__body">
                    <p>{pinnedNotice.content}</p>
                    <small>{pinnedNotice.meta || ""}</small>
                  </div>
                ) : null}
              </section>
            </div>
          ) : null}

          <div className="message-list">
            {renderedMessages.length ? (
              renderedMessages.map((message, index) => {
                const mine = message.user_id === user?.id;
                const prevMessage = renderedMessages[index - 1];
                const showDivider = !prevMessage || messageDateKey(prevMessage.created_at) !== messageDateKey(message.created_at);
                const hasReply = Boolean(message.reply_to_message_id || message.reply_to_content);
                return (
                  <div key={message.id} className="message-group">
                    {showDivider ? <div className="message-day-divider">{isTodayKst(message.created_at) ? "오늘" : formatMessageDate(message.created_at)}</div> : null}
                    <div
                      className={`message-row ${mine ? "mine" : ""} ${focusedMessageId === message.id ? "is-focused" : ""}`}
                      ref={(node) => {
                        if (node) messageRefs.current[message.id] = node;
                        else delete messageRefs.current[message.id];
                      }}
                    >
                      {!mine && (
                        <div className="message-avatar">
                          <button type="button" onClick={() => openUserProfile(message.sender)} aria-label="사용자 정보 보기">
                            {message.sender?.profile_image_url ? <img src={message.sender.profile_image_url} alt="" /> : <UsersRound size={16} />}
                          </button>
                        </div>
                      )}

                      {/* Options button for own messages (left of bubble) */}
                      {mine && (
                        <div className="mobile-msg-more-wrap">
                          <button
                            type="button"
                            className="mobile-msg-more-btn"
                            onClick={() => toggleOptionsMenu(message.id)}
                            aria-label="메시지 옵션"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {optionsMenuMessageId === message.id && (
                            <div className="mobile-msg-options-menu" role="menu" onPointerDown={(e) => e.stopPropagation()}>
                              <button type="button" role="menuitem" onClick={() => startReply(message)}>
                                <Reply size={14} />
                                답장하기
                              </button>
                              {canManageRoom && (
                                <button type="button" role="menuitem" onClick={() => openNoticeDraft(message)}>
                                  <Pin size={14} />
                                  공지로 등록
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="message-content-wrap">
                        {/* Reply reference (Rendered outside/above the main bubble) */}
                        {hasReply && (
                          <button
                            className="mobile-reply-ref"
                            type="button"
                            onClick={() => focusReplySource(message.reply_to_message_id)}
                          >
                            <strong>{replySenderLabel(message)}</strong>
                            <span>{replyContent(message)}</span>
                          </button>
                        )}

                        <div className={`message-bubble ${mine ? "mine" : ""} ${message.message_type === "image" ? "photo-bubble" : ""} ${message.message_type === "location" ? "location-bubble" : ""}`}>
                          {!mine && <span className="message-sender-name">{senderLabel(message.sender)}</span>}
                          {message.message_type === "image" ? (
                            <figure className="mobile-photo-message" onClick={() => setActivePhotoUrl(message.attachment_url)} style={{ cursor: 'pointer' }}>
                              <img src={message.attachment_url} alt={message.attachment_name || "사진"} />
                            </figure>
                          ) : message.message_type === "location" ? (
                            <div className="mobile-location-message-wrap">
                              <a className="mobile-location-message" href={mapUrl(message)} target="_blank" rel="noreferrer">
                                <MapPin size={18} />
                                <span>
                                  <strong>{message.location_label || "공유한 위치"}</strong>
                                  <small>{message.content}</small>
                                </span>
                              </a>
                              <div className="mobile-location-iframe-wrap">
                                <iframe
                                  src={`https://maps.google.com/maps?q=${message.location_latitude},${message.location_longitude}&z=15&output=embed`}
                                  width="100%"
                                  height="140"
                                  style={{ border: 0, borderRadius: '10px', marginTop: '6px', display: 'block' }}
                                  allowFullScreen=""
                                  loading="lazy"
                                  title="Shared Location Map"
                                ></iframe>
                              </div>
                            </div>
                          ) : (
                            <p>{message.content}</p>
                          )}
                        </div>
                        <div className="message-meta">
                          {message.message_type !== "notice" && (
                            <span className="read-count">{Number(message.read_count || 0)} 읽음</span>
                          )}
                          <time>{formatMessageTime(message.created_at)}</time>
                        </div>
                      </div>

                      {/* Options button for others' messages (right of bubble) */}
                      {!mine && (
                        <div className="mobile-msg-more-wrap">
                          <button
                            type="button"
                            className="mobile-msg-more-btn"
                            onClick={() => toggleOptionsMenu(message.id)}
                            aria-label="메시지 옵션"
                          >
                            <MoreVertical size={16} />
                          </button>
                          {optionsMenuMessageId === message.id && (
                            <div className="mobile-msg-options-menu" role="menu" onPointerDown={(e) => e.stopPropagation()}>
                              <button type="button" role="menuitem" onClick={() => startReply(message)}>
                                <Reply size={14} />
                                답장하기
                              </button>
                              {canManageRoom && (
                                <button type="button" role="menuitem" onClick={() => openNoticeDraft(message)}>
                                  <Pin size={14} />
                                  공지로 등록
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="message-empty">
                <strong>아직 대화가 없습니다.</strong>
                <p>오늘 모임 준비 이야기를 먼저 시작해보세요.</p>
              </div>
            )}
          </div>
        </>
      )}
      <form className="chat-input" onSubmit={send}>
        {error ? <p className="chat-input__error">{error}</p> : null}
        {actionNotice ? <p className="chat-input__notice">{actionNotice}</p> : null}
        {/* Reply preview bar */}
        {replyTarget ? (
          <div className="mobile-reply-preview">
            <Reply size={15} />
            <span>
              <b>{messagePreview(replyTarget)}</b>
              <small>{senderLabel(replyTarget.sender)}에게 답장</small>
            </span>
            <button type="button" onClick={() => setReplyTarget(null)} aria-label="답장 취소">
              <X size={14} />
            </button>
          </div>
        ) : null}
        {actionMenuOpen ? (
          <div className="chat-action-menu" role="menu">
            <button type="button" role="menuitem" onClick={openPhotoPicker}><Camera size={17} />사진 전송</button>
            {canCreateVote ? <button type="button" role="menuitem" onClick={openVoteCreate}><Vote size={17} />투표 생성</button> : null}
            <button type="button" role="menuitem" onClick={() => { setActionMenuOpen(false); setLocationSelectOpen(true); }}><MapPin size={17} />위치 공유</button>
          </div>
        ) : null}
        <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/*" onChange={handlePhotoSelected} />
        <button className="chat-input__more" type="button" onClick={() => setActionMenuOpen((value) => !value)} aria-label="채팅 기능 더보기" aria-expanded={actionMenuOpen}>
          <Plus size={22} />
        </button>
        <input ref={messageInputRef} value={content} onChange={(event) => setContent(event.target.value)} placeholder="메시지를 입력하세요" />
        <button type="submit" aria-label="메시지 전송" disabled={sending || !content.trim()}>
          <Send size={20} />
        </button>
      </form>
      {/* Notice form modal */}
      {noticeFormOpen ? (
        <div className="mobile-notice-modal" role="dialog" aria-modal="true" aria-label="공지 등록">
          <button className="mobile-notice-modal__backdrop" type="button" onClick={() => setNoticeFormOpen(false)} aria-label="닫기" />
          <section>
            <div className="mobile-notice-modal__header">
              <span>공지 등록</span>
              <button type="button" onClick={() => setNoticeFormOpen(false)}>닫기</button>
            </div>
            {noticeError ? <p className="mobile-notice-modal__error">{noticeError}</p> : null}
            <form onSubmit={createNotice}>
              <label>공지 제목<input value={noticeForm.title} onChange={(e) => setNoticeForm({ ...noticeForm, title: e.target.value })} placeholder="공지 제목" /></label>
              <label>공지 내용<textarea value={noticeForm.content} onChange={(e) => setNoticeForm({ ...noticeForm, content: e.target.value })} placeholder="공지 내용을 입력하세요" rows={4} /></label>
              <button type="submit" disabled={noticeSubmitting}>{noticeSubmitting ? "등록 중..." : "공지 등록"}</button>
            </form>
          </section>
        </div>
      ) : null}
      {profilePreviewUser ? (
        <div className="chat-profile-sheet" role="dialog" aria-modal="true" aria-label="사용자 간략 정보">
          <button className="chat-profile-sheet__backdrop" type="button" onClick={() => setProfilePreviewUser(null)} aria-label="닫기" />
          <section>
            <div className="chat-profile-sheet__avatar">
              {profilePreviewUser.profile_image_url ? <img src={profilePreviewUser.profile_image_url} alt="" /> : <UsersRound size={24} />}
            </div>
            <strong>{profilePreviewUser.nickname || profilePreviewUser.name || "참여자"}</strong>
            <p>{profilePreviewUser.nickname_with_tag || profilePreviewUser.user_tag_display || "SportsMate 참여자"}</p>
            {profileLoading ? <p className="chat-profile-sheet__notice">프로필을 불러오는 중입니다.</p> : null}
            {profileNotice ? <p className="chat-profile-sheet__notice">{profileNotice}</p> : null}
            <div className="chat-profile-sheet__facts">
              <span><b>활동 지역</b>{profilePreviewUser.profile?.region || "미설정"}</span>
              <span><b>운동 수준</b>{profilePreviewUser.profile?.exercise_level || "미설정"}</span>
              <span><b>평점</b>{Number(profilePreviewUser.profile?.rating_average || 0).toFixed(1)}</span>
              <span><b>참여율</b>{Math.round(profilePreviewUser.profile?.attendance_rate || 0)}%</span>
            </div>
            <div className="chat-profile-sheet__sports">
              {(splitCommaText(profilePreviewUser.profile?.preferred_sports).slice(0, 5)).map((sport) => (
                <span key={sport}>{sport}</span>
              ))}
              {!splitCommaText(profilePreviewUser.profile?.preferred_sports).length ? <span>선호 종목 미설정</span> : null}
            </div>
            <button className="chat-profile-sheet__close" type="button" onClick={() => setProfilePreviewUser(null)}>닫기</button>
          </section>
        </div>
      ) : null}
      {voteOpen ? (
        <div className="chat-vote-modal" role="dialog" aria-modal="true" aria-label="투표">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setVoteOpen(false)} aria-label="닫기" />
          <section>
            <div className="chat-vote-modal__header">
              <span>모임 투표</span>
              <button type="button" onClick={() => setVoteOpen(false)}>닫기</button>
            </div>
            {canCreateVote ? (
              <div className="chat-vote-modal__tabs">
                <button type="button" className={voteMode === "list" ? "active" : ""} onClick={() => setVoteMode("list")}>진행 투표</button>
                <button type="button" className={voteMode === "create" ? "active" : ""} onClick={() => setVoteMode("create")}>투표 만들기</button>
              </div>
            ) : null}
            {voteError ? <p className="chat-vote-modal__error">{voteError}</p> : null}
            {voteNotice ? <p className="chat-vote-modal__notice">{voteNotice}</p> : null}
            {voteMode === "create" ? (
              <form className="chat-vote-create" onSubmit={createVote}>
                <label>투표 제목<input value={voteForm.title} onChange={(event) => setVoteForm({ ...voteForm, title: event.target.value })} placeholder="예: 오늘 참석 여부" /></label>
                <div>
                  {voteForm.options.map((option, index) => (
                    <label key={index}>선택지 {index + 1}<input value={option} onChange={(event) => updateVoteOption(index, event.target.value)} /></label>
                  ))}
                </div>
                <button type="button" onClick={() => setVoteForm((current) => ({ ...current, options: [...current.options, ""] }))}>선택지 추가</button>
                <button type="submit" disabled={voteSubmitting}>{voteSubmitting ? "등록 중" : "투표 등록"}</button>
              </form>
            ) : votes.loading ? (
              <p>투표를 불러오는 중입니다.</p>
            ) : votes.data?.items?.length ? (
              <div className="chat-vote-list">
                {votes.data.items.map((vote) => (
                  <article key={vote.id}>
                    <strong>{vote.title}</strong>
                    <p>총 {vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0)}명 참여</p>
                    <div>
                      {vote.options.map((option) => (
                        <button type="button" key={option.id} className={Number(vote.selected_option_id) === Number(option.id) ? "selected" : ""} onClick={() => participateVote(vote.id, option.id)}>
                          <span>{option.text}</span>
                          <em>{Number(vote.selected_option_id) === Number(option.id) ? "내 선택 · " : ""}{option.response_count}명</em>
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p>진행 중인 투표가 없습니다.</p>
            )}
          </section>
        </div>
      ) : null}

      {/* Location options menu modal/sheet */}
      {locationSelectOpen ? (
        <div className="mobile-location-select-modal" role="dialog" aria-modal="true" aria-label="위치 공유 선택">
          <button className="mobile-location-select-modal__backdrop" type="button" onClick={() => setLocationSelectOpen(false)} aria-label="닫기" />
          <section>
            <div className="mobile-location-select-modal__header">
              <span>위치 공유</span>
              <button type="button" onClick={() => setLocationSelectOpen(false)}>닫기</button>
            </div>
            <div className="mobile-location-select-modal__buttons">
              <button type="button" onClick={() => { setLocationSelectOpen(false); shareLocation(); }}>
                <MapPin size={20} />
                <span>현위치 공유</span>
              </button>
              <button type="button" onClick={() => { setLocationSelectOpen(false); setPlaceSearchOpen(true); }}>
                <Plus size={20} />
                <span>공유하고 싶은 장소 공유</span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* Place search and share modal */}
      {placeSearchOpen ? (
        <div className="mobile-notice-modal" role="dialog" aria-modal="true" aria-label="장소 검색 및 공유">
          <button className="mobile-notice-modal__backdrop" type="button" onClick={() => setPlaceSearchOpen(false)} aria-label="닫기" />
          <section>
            <div className="mobile-notice-modal__header">
              <span>장소 공유</span>
              <button type="button" onClick={() => setPlaceSearchOpen(false)}>닫기</button>
            </div>
            {placeSearchError ? <p className="mobile-notice-modal__error">{placeSearchError}</p> : null}
            <form onSubmit={handlePlaceSearch} style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <input 
                value={placeSearchKeyword} 
                onChange={(e) => setPlaceSearchKeyword(e.target.value)} 
                placeholder="장소나 주소를 입력하세요" 
                style={{ flex: 1, padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '14px' }}
              />
              <button 
                type="submit" 
                disabled={placeSearchLoading}
                style={{ padding: '8px 16px', background: 'var(--mobile-primary)', color: '#fff', border: 0, borderRadius: '8px', fontWeight: '800' }}
              >
                {placeSearchLoading ? "검색 중" : "검색"}
              </button>
            </form>
            
            <div className="mobile-place-search-results" style={{ maxHeight: '250px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {placeSearchResults.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendPlaceLocation(item)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    width: '100%',
                    padding: '10px 12px',
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    background: '#fff',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  <strong style={{ fontSize: '14px', color: '#1e293b', fontWeight: '800', marginBottom: '2px' }}>{item.title}</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>{item.address}</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {/* Photo lightbox modal */}
      {activePhotoUrl ? (
        <div className="mobile-photo-lightbox" onClick={() => setActivePhotoUrl(null)}>
          <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
            <img src={activePhotoUrl} alt="사진 크게 보기" />
            <button className="lightbox-close-btn" onClick={() => setActivePhotoUrl(null)} aria-label="닫기">
              <X size={24} />
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default MobileChatRoom;
