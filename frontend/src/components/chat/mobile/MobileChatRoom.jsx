import { Camera, MapPin, Plus, Send, UsersRound, Vote, Reply, MoreVertical, X, Pin, Menu, Bell, BellOff, LogOut, Trash2 } from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
let naverMapClientIdPromise = null;
const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";

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

function formatVoteDateTimeOption(date, time) {
  if (!date) return "";
  const value = `${date}T${time || "00:00"}:00+09:00`;
  const options = {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul"
  };
  if (time) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("ko-KR", options).format(new Date(value));
}

function formatVoteDeadline(value) {
  if (!value) return "종료일 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
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
  const label = encodeURIComponent(message.location_label || "공유한 위치");
  return `https://map.naver.com/p/search/${label}?c=${lng},${lat},16,0,0,0,dh`;
}

function naverDirectionsUrl(origin, destination) {
  const originPart = `s:${origin.longitude},${origin.latitude},${encodeURIComponent(origin.label || "현재 위치")}`;
  const destinationPart = `e:${destination.longitude},${destination.latitude},${encodeURIComponent(destination.label || "공유한 위치")}`;
  return `https://map.naver.com/p/directions/${originPart}/${destinationPart}/-/transit`;
}

function getNaverMapClientId() {
  if (!naverMapClientIdPromise) {
    naverMapClientIdPromise = locationApi.mapConfig()
      .then((data) => data.naver_dynamic_map_client_id || "")
      .catch(() => "");
  }
  return naverMapClientIdPromise;
}

function loadNaverMapScript(clientId) {
  if (!clientId) return Promise.reject(new Error("missing naver map client id"));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (window.__sportsmateNaverMapPromise) return window.__sportsmateNaverMapPromise;

  window.__sportsmateNaverMapPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(NAVER_MAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.naver.maps), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve(window.naver.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.__sportsmateNaverMapPromise;
}

function ChatLocationMessage({ message }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapStatus, setMapStatus] = useState("idle");
  const [directionStatus, setDirectionStatus] = useState("");

  const latitude = Number(message.location_latitude);
  const longitude = Number(message.location_longitude);
  const hasCoordinates = Number.isFinite(latitude) && Number.isFinite(longitude);
  const label = message.location_label || "공유한 위치";
  const naverUrl = mapUrl(message);

  useEffect(() => {
    if (!hasCoordinates) return;
    let disposed = false;
    setMapStatus("loading");

    getNaverMapClientId()
      .then((clientId) => loadNaverMapScript(clientId))
      .then((maps) => {
        if (disposed || !mapElementRef.current) return;
        const position = new maps.LatLng(latitude, longitude);
        mapRef.current = new maps.Map(mapElementRef.current, {
          center: position,
          zoom: 16,
          draggable: false,
          scrollWheel: false,
          disableDoubleClickZoom: true,
          mapDataControl: false,
          scaleControl: false,
          zoomControl: false
        });
        markerRef.current = new maps.Marker({ map: mapRef.current, position });
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("fallback"));

    return () => {
      disposed = true;
      if (markerRef.current) markerRef.current.setMap(null);
      markerRef.current = null;
      mapRef.current = null;
    };
  }, [hasCoordinates, latitude, longitude]);

  const openDirections = (e) => {
    e.preventDefault();
    if (!hasCoordinates) return;
    if (!navigator.geolocation) {
      window.open(naverUrl, "_blank", "noopener,noreferrer");
      return;
    }

    setDirectionStatus("확인 중..");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDirectionStatus("");
        window.open(
          naverDirectionsUrl(
            {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              label: "현재 위치"
            },
            { latitude, longitude, label }
          ),
          "_blank",
          "noopener,noreferrer"
        );
      },
      () => {
        setDirectionStatus("권한 필요");
        window.open(naverUrl, "_blank", "noopener,noreferrer");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  };

  return (
    <div className="mobile-location-message-wrap">
      <a className="mobile-location-message" href={naverUrl} target="_blank" rel="noreferrer">
        <MapPin size={18} />
        <span>
          <strong>{label}</strong>
          <small>{message.content}</small>
        </span>
      </a>
      <a className="mobile-location-message__map-btn" href={naverUrl} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
        <div className="talk-location-message__canvas" ref={mapElementRef} style={{ height: '140px', borderRadius: '10px', marginTop: '6px', backgroundColor: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', fontSize: '13px', overflow: 'hidden' }}>
          {mapStatus !== "ready" ? (
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <MapPin size={24} />
              {mapStatus === "loading" ? "네이버 지도 불러오는 중" : "네이버 지도에서 보기"}
            </span>
          ) : null}
        </div>
      </a>
      <button 
        type="button" 
        onClick={openDirections} 
        style={{ 
          width: '100%', 
          marginTop: '6px', 
          padding: '8px', 
          backgroundColor: 'var(--mobile-primary)', 
          color: 'white', 
          border: 'none', 
          borderRadius: '8px', 
          fontSize: '13px', 
          fontWeight: '600', 
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }}
      >
        <MapPin size={14} />
        {directionStatus || "길찾기"}
      </button>
    </div>
  );
}

function replySenderLabel(message) {
  return message?.reply_to_sender_name || senderLabel(message?.reply_to?.sender);
}

function replyContent(message) {
  if (!message) return "";
  return message.reply_to_content || messagePreview(message.reply_to);
}

function MobileChatRoom() {
  const navigate = useNavigate();
  const { chatRoomId, directRoomId } = useParams();
  const isDirectChat = Boolean(directRoomId);
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteMode, setVoteMode] = useState("list");
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);
  const [voteForm, setVoteForm] = useState({
    title: "",
    options: ["참여", "불참"],
    ends_at: "",
    allow_multiple: false,
    is_anonymous: true
  });
  const [voteKind, setVoteKind] = useState("general");
  const [voteDateTime, setVoteDateTime] = useState({ date: "", time: "" });
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

  /* PC Feature Parity State */
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mutedRooms, setMutedRooms] = useState([]);
  const [roomRefreshKey, setRoomRefreshKey] = useState(0);
  const [directRoomRefreshKey, setDirectRoomRefreshKey] = useState(0);
  const [voteSelections, setVoteSelections] = useState({});
  const [voteConfirm, setVoteConfirm] = useState(null);
  const [privateChatNotice, setPrivateChatNotice] = useState("");
  const [leavingRoom, setLeavingRoom] = useState(false);

  const fileInputRef = useRef(null);
  const messageInputRef = useRef(null);
  const messageRefs = useRef({});

  // 모임 채팅 메시지
  const messages = useAsync(
    () => chatRoomId ? chatApi.messages(chatRoomId) : Promise.resolve(null),
    [chatRoomId, refreshKey, roomRefreshKey]
  );
  // 1:1 채팅 메시지
  const directMessages = useAsync(
    () => directRoomId ? chatApi.directMessages(directRoomId) : Promise.resolve(null),
    [directRoomId, directRefreshKey, directRoomRefreshKey]
  );

  const activeMessages = isDirectChat ? directMessages : messages;
  const room = activeMessages.data?.room;
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
  const renderedMessages = activeMessages.data?.items || [];

  const isSystemMessage = (msg) => {
    return ["notice", "system"].includes(msg?.message_type);
  };

  const systemMessageText = (msg) => {
    if (msg.message_type === "system") return msg.content;
    if (msg.message_type !== "notice") return msg.content;
    const pinnedNoticeText = pinnedNotice?.content || pinnedNotice?.title || "";
    if (msg.content && !msg.content.endsWith(": 채팅 공지")) return msg.content;
    return pinnedNoticeText ? `공지가 등록되었습니다: ${pinnedNoticeText}` : msg.content;
  };

  useLayoutEffect(() => {
    if (!activeMessages.data?.items) return undefined;
    const frame = window.requestAnimationFrame(() => {
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior: "auto"
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeMessages.data?.items?.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || sending || realtimeConnected) return;
      if (isDirectChat) {
        setDirectRefreshKey((value) => value + 1);
      } else {
        setRefreshKey((value) => value + 1);
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [realtimeConnected, sending, isDirectChat]);

  // Supabase realtime - 모임 채팅
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !chatRoomId) {
      if (!isDirectChat) setRealtimeConnected(false);
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
        if (!isDirectChat) setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (!isDirectChat) setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [chatRoomId, isDirectChat]);

  // Supabase realtime - 1:1 채팅
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !directRoomId) {
      if (isDirectChat) setRealtimeConnected(false);
      return undefined;
    }

    const channel = supabase
      .channel(`mobile-direct-chat-${directRoomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "direct_chat_messages",
          filter: `direct_chat_room_id=eq.${directRoomId}`
        },
        () => setDirectRefreshKey((value) => value + 1)
      )
      .subscribe((status) => {
        if (isDirectChat) setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      if (isDirectChat) setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [directRoomId, isDirectChat]);

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

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    chatApi.mutedRooms()
      .then((res) => setMutedRooms(res.muted_rooms || []))
      .catch((err) => console.error("Failed to load muted rooms", err));
  }, []);

  const toggleMute = async (roomId, roomType) => {
    const isCurrentlyMuted = mutedRooms.some(r => String(r.room_id) === String(roomId) && r.room_type === roomType);
    try {
      if (isCurrentlyMuted) {
        await chatApi.unmute(roomId, roomType);
        setMutedRooms((prev) => prev.filter(r => !(String(r.room_id) === String(roomId) && r.room_type === roomType)));
      } else {
        await chatApi.mute(roomId, roomType);
        setMutedRooms((prev) => [...prev, { room_id: roomId, room_type: roomType }]);
      }
    } catch (err) {
      console.error("Mute toggle failed", err);
    }
  };

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
      if (isDirectChat) {
        // 1:1 채팅 전송
        await chatApi.sendDirect(directRoomId, { content: content.trim() });
        setContent("");
        setDirectRefreshKey((value) => value + 1);
      } else {
        // 모임 채팅 전송
        await chatApi.send(chatRoomId, {
          content: content.trim(),
          reply_to_message_id: replyTarget?.id || null
        });
        setContent("");
        setReplyTarget(null);
        setRefreshKey((value) => value + 1);
      }
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
      .then((dataUrl) => {
        const payload = {
          content: file.name || "사진",
          message_type: "image",
          attachment_url: dataUrl,
          attachment_name: file.name,
          reply_to_message_id: replyTarget?.id || null
        };
        if (isDirectChat) {
          return chatApi.sendDirect(directRoomId, payload);
        } else {
          return chatApi.send(chatRoomId, payload);
        }
      })
      .then(() => {
        setReplyTarget(null);
        if (isDirectChat) {
          setDirectRefreshKey((value) => value + 1);
        } else {
          setRefreshKey((value) => value + 1);
        }
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
          const payload = {
            content: "현재 위치를 공유했습니다.",
            message_type: "location",
            location: {
              latitude,
              longitude,
              label: "현재 위치"
            },
            reply_to_message_id: replyTarget?.id || null
          };
          if (isDirectChat) {
            await chatApi.sendDirect(directRoomId, payload);
            setDirectRefreshKey((value) => value + 1);
          } else {
            await chatApi.send(chatRoomId, payload);
            setRefreshKey((value) => value + 1);
          }
          setReplyTarget(null);
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
      const payload = {
        content: item.title || "위치를 공유했습니다.",
        message_type: "location",
        location: {
          latitude: Number(item.latitude),
          longitude: Number(item.longitude),
          label: item.title || "공유한 위치"
        },
        reply_to_message_id: replyTarget?.id || null
      };
      if (isDirectChat) {
        await chatApi.sendDirect(directRoomId, payload);
        setDirectRefreshKey((value) => value + 1);
      } else {
        await chatApi.send(chatRoomId, payload);
        setRefreshKey((value) => value + 1);
      }
      setReplyTarget(null);
      setPlaceSearchOpen(false);
      setPlaceSearchKeyword("");
      setPlaceSearchResults([]);
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

  const selectVoteKind = (kind) => {
    setVoteKind(kind);
    setVoteError("");
    if (kind === "datetime") {
      setVoteForm((current) => ({
        ...current,
        title: current.title || "모임 날짜/시간 투표",
        options: current.options.length === 2 && current.options[0] === "참여" && current.options[1] === "불참" ? ["", ""] : current.options
      }));
    }
  };

  const appendVoteOption = (value) => {
    const normalized = value.trim();
    if (!normalized) return;
    setVoteForm((current) => {
      if (current.options.some((option) => option.trim() === normalized)) return current;
      const emptyIndex = current.options.findIndex((option) => !option.trim());
      if (emptyIndex >= 0) {
        return {
          ...current,
          options: current.options.map((option, index) => index === emptyIndex ? normalized : option)
        };
      }
      return {
        ...current,
        options: [...current.options, normalized]
      };
    });
  };

  const addDateTimeVoteOption = () => {
    const option = formatVoteDateTimeOption(voteDateTime.date, voteDateTime.time);
    if (!option) {
      setVoteError("날짜를 먼저 선택해주세요.");
      return;
    }
    appendVoteOption(option);
    setVoteDateTime({ date: "", time: "" });
    setVoteError("");
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
      await meetingApi.createVote(meeting.id, {
        title: voteForm.title.trim(),
        options,
        ends_at: voteForm.ends_at || null,
        allow_multiple: voteForm.allow_multiple,
        is_anonymous: voteForm.is_anonymous
      });
      setVoteForm({
        title: "",
        options: ["참여", "불참"],
        ends_at: "",
        allow_multiple: false,
        is_anonymous: true
      });
      setVoteKind("general");
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

  const requestPrivateChat = async (targetUser) => {
    if (!targetUser?.id || String(targetUser.id) === String(user?.id)) {
      setProfileNotice("자기 자신에게는 개인톡을 보낼 수 없습니다.");
      return;
    }
    try {
      const data = await chatApi.createDirectRoom(targetUser.id);
      const roomId = data.room?.id;
      if (roomId) {
        setProfilePreviewUser(null);
        setProfileNotice("");
        setDirectRoomRefreshKey((value) => value + 1);
        navigate(`/chats/direct/${roomId}`);
        return;
      }
      setProfileNotice("1:1 톡방을 만들었지만 방 정보를 확인하지 못했습니다.");
    } catch (directError) {
      setProfileNotice(directError.response?.data?.message || "1:1 톡방을 만들지 못했습니다.");
    }
  };

  const kickMember = async (targetUser) => {
    if (!meeting?.id) return;
    if (!window.confirm(`${targetUser.nickname || '이 유저'}님을 강퇴하시겠습니까?`)) return;
    try {
      await meetingApi.kickMember(meeting.id, targetUser.id);
      alert("강퇴 처리되었습니다.");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      alert(err.response?.data?.message || "강퇴 처리에 실패했습니다.");
    }
  };

  const leaveRoom = async () => {
    const targetRoomId = chatRoomId || directRoomId;
    if (!targetRoomId || leavingRoom) return;
    if (!window.confirm("이 채팅방에서 나가시겠습니까?")) return;
    setLeavingRoom(true);
    setError("");
    try {
      await chatApi.leave(targetRoomId);
      setDrawerOpen(false);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      navigate("/chats", { replace: true });
    } catch (leaveError) {
      setError(leaveError.response?.data?.message || "채팅방 나가기에 실패했습니다.");
    } finally {
      setLeavingRoom(false);
    }
  };

  const blockAndLeave = async (targetUser) => {
    const targetRoomId = chatRoomId || directRoomId;
    if (!targetRoomId || leavingRoom) return;
    if (!window.confirm(`${targetUser?.nickname || "상대방"}님을 차단하고 이 대화방을 나갈까요?`)) return;
    setLeavingRoom(true);
    setError("");
    try {
      await chatApi.leave(targetRoomId);
      setProfilePreviewUser(null);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      navigate("/chats", { replace: true });
    } catch (blockError) {
      setError(blockError.response?.data?.message || "사용자 차단에 실패했습니다.");
    } finally {
      setLeavingRoom(false);
    }
  };

  const closeMeetingRoom = async () => {
    if (!meeting?.id) return;
    if (!window.confirm("이 모임 채팅방을 종료할까요? 모임도 취소 상태로 변경됩니다.")) return;
    setError("");
    try {
      await meetingApi.cancel(meeting.id);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      navigate("/chats", { replace: true });
    } catch (closeError) {
      setError(closeError.response?.data?.message || "채팅방 종료에 실패했습니다.");
    }
  };

  const kickParticipant = async (targetUserId, nickname) => {
    if (!meeting?.id || !targetUserId) return;
    if (!window.confirm(`${nickname || "참여자"}님을 이 채팅방에서 내보낼까요? 모임 참여도 함께 취소됩니다.`)) return;
    setError("");
    try {
      await meetingApi.kickMember(meeting.id, targetUserId);
      setProfilePreviewUser(null);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
    } catch (kickError) {
      setError(kickError.response?.data?.message || "멤버 추방에 실패했습니다.");
    }
  };

  const selectedIdsOf = (vote) => {
    if (Array.isArray(vote.selected_option_ids)) return vote.selected_option_ids.map(Number);
    return vote.selected_option_id ? [Number(vote.selected_option_id)] : [];
  };

  const toggleVoteSelection = (vote, optionId) => {
    if (!vote.allow_multiple) {
      participateVote(vote.id, optionId);
      return;
    }
    setVoteSelections((current) => {
      const base = current[vote.id] || selectedIdsOf(vote);
      const exists = base.some((id) => Number(id) === Number(optionId));
      return {
        ...current,
        [vote.id]: exists ? base.filter((id) => Number(id) !== Number(optionId)) : [...base, optionId]
      };
    });
  };

  const confirmMultipleVote = async (vote) => {
    const optionIds = voteSelections[vote.id] || selectedIdsOf(vote);
    if (!optionIds.length) {
      setVoteError("투표 선택지를 선택해주세요.");
      return;
    }
    setVoteSubmitting(true);
    setVoteError("");
    setVoteNotice("");
    try {
      await voteApi.participate(vote.id, { option_ids: optionIds });
      setVoteSelections((current) => {
        const next = { ...current };
        delete next[vote.id];
        return next;
      });
      setVoteNotice("투표 선택이 반영되었습니다.");
      setVoteRefreshKey((value) => value + 1);
    } catch (participateError) {
      setVoteError(participateError.response?.data?.message || "투표 참여에 실패했습니다.");
    } finally {
      setVoteSubmitting(false);
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
        title={isDirectChat ? (room?.other_user?.nickname || "1:1 대화") : (meeting?.title || "채팅방")}
        actions={
          <div className="mobile-header__actions mobile-chat-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {!isDirectChat && meeting?.id && (
              <Link className="mobile-chat-detail-link" to={`/meetings/${meeting.id}`} style={{ fontSize: '13px', fontWeight: '800', color: '#475569' }}>
                상세
              </Link>
            )}
            <button 
              className="mobile-chat-drawer-trigger" 
              type="button" 
              onClick={() => setDrawerOpen(true)}
              aria-label="채팅방 메뉴 열기"
              style={{ background: 'none', border: 0, padding: '4px', color: '#1e293b', display: 'flex', alignItems: 'center' }}
            >
              <Menu size={22} />
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
                const mine = (message.user_id ?? message.sender_id) === user?.id;
                const prevMessage = renderedMessages[index - 1];
                const showDivider = !prevMessage || messageDateKey(prevMessage.created_at) !== messageDateKey(message.created_at);
                const hasReply = Boolean(message.reply_to_message_id || message.reply_to_content);
                return (
                  <div key={message.id} className="message-group">
                    {showDivider ? <div className="message-day-divider">{isTodayKst(message.created_at) ? "오늘" : formatMessageDate(message.created_at)}</div> : null}
                    {isSystemMessage(message) ? (
                      <div 
                        className="message-system-row" 
                        ref={(node) => {
                          if (node) messageRefs.current[message.id] = node;
                          else delete messageRefs.current[message.id];
                        }}
                        style={{ display: 'flex', justifyContent: 'center', margin: '10px 0' }}
                      >
                        <span style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '12px',
                          fontWeight: '800',
                          padding: '6px 14px',
                          borderRadius: '999px',
                          textAlign: 'center',
                          maxWidth: '85%',
                          wordBreak: 'break-all',
                          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                          lineHeight: 1.4
                        }}>
                          {systemMessageText(message)}
                        </span>
                      </div>
                    ) : (
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
                              <ChatLocationMessage message={message} />
                            ) : (
                              <p>{message.content}</p>
                            )}
                          </div>
                          <div className="message-meta">
                            {message.message_type !== "notice" && Number(message.read_count || 0) > 0 && (
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
                    )}
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
            {profileNotice ? <p className="chat-profile-sheet__notice" style={{ color: '#ef4444' }}>{profileNotice}</p> : null}
            <div className="chat-profile-sheet__facts">
              <span><b>활동 지역</b>{profilePreviewUser.profile?.region || "미설정"}</span>
              <span><b>운동 수준</b>{profilePreviewUser.profile?.exercise_level || "미설정"}</span>
              <span><b>평점</b>{Number(profilePreviewUser.profile?.rating_average || 0).toFixed(1)}</span>
              <span><b>참여율</b>{Math.round(profilePreviewUser.profile?.attendance_rate || 0)}%</span>
            </div>
            <div className="chat-profile-sheet__sports">
              {(splitCommaText(profilePreviewUser.profile?.preferred_sports).slice(0, 6)).map((sport) => (
                <span key={sport}>{sport}</span>
              ))}
              {!splitCommaText(profilePreviewUser.profile?.preferred_sports).length ? <span>선호 종목 미설정</span> : null}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '14px', width: '100%', boxSizing: 'border-box', padding: '0 16px' }}>
              {String(profilePreviewUser.id) !== String(user?.id) && !isDirectChat && (
                <button
                  type="button"
                  onClick={() => requestPrivateChat(profilePreviewUser)}
                  style={{
                    flex: 1,
                    maxWidth: '140px',
                    minHeight: '38px',
                    borderRadius: '10px',
                    background: 'var(--mobile-primary)',
                    color: '#fff',
                    border: 0,
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  1:1 톡
                </button>
              )}
              {isDirectChat && String(profilePreviewUser.id) !== String(user?.id) && (
                <button
                  type="button"
                  onClick={() => blockAndLeave(profilePreviewUser)}
                  style={{
                    flex: 1,
                    maxWidth: '140px',
                    minHeight: '38px',
                    borderRadius: '10px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 0,
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  차단
                </button>
              )}
              {isRoomHost && String(profilePreviewUser.id) !== String(user?.id) && (
                <button
                  type="button"
                  onClick={() => kickParticipant(profilePreviewUser.id, profilePreviewUser.nickname)}
                  style={{
                    flex: 1,
                    maxWidth: '140px',
                    minHeight: '38px',
                    borderRadius: '10px',
                    background: '#ef4444',
                    color: '#fff',
                    border: 0,
                    fontWeight: '800',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  강퇴
                </button>
              )}
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
                <div className="chat-vote-create__type" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '4px' }}>
                  <button 
                    type="button" 
                    className={voteKind === "general" ? "active" : ""} 
                    onClick={() => selectVoteKind("general")}
                    style={{
                      height: '40px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: voteKind === "general" ? 'var(--mobile-primary)' : '#e2e8f0',
                      background: voteKind === "general" ? 'rgba(79, 70, 229, 0.08)' : '#fff',
                      color: voteKind === "general" ? 'var(--mobile-primary)' : '#64748b',
                      fontSize: '13px',
                      fontWeight: '800'
                    }}
                  >
                    일반 투표
                  </button>
                  <button 
                    type="button" 
                    className={voteKind === "datetime" ? "active" : ""} 
                    onClick={() => selectVoteKind("datetime")}
                    style={{
                      height: '40px',
                      borderRadius: '12px',
                      border: '1px solid',
                      borderColor: voteKind === "datetime" ? 'var(--mobile-primary)' : '#e2e8f0',
                      background: voteKind === "datetime" ? 'rgba(79, 70, 229, 0.08)' : '#fff',
                      color: voteKind === "datetime" ? 'var(--mobile-primary)' : '#64748b',
                      fontSize: '13px',
                      fontWeight: '800'
                    }}
                  >
                    날짜/시간 투표
                  </button>
                </div>
                <label>투표 제목<input value={voteForm.title} onChange={(event) => setVoteForm({ ...voteForm, title: event.target.value })} placeholder="예: 오늘 참석 여부" /></label>
                {voteKind === "datetime" ? (
                  <div style={{
                    background: '#f8fafc',
                    borderRadius: '14px',
                    padding: '12px',
                    border: '1px solid #f1f5f9',
                    display: 'grid',
                    gap: '10px'
                  }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <label>
                        날짜
                        <input 
                          type="date" 
                          value={voteDateTime.date} 
                          onChange={(event) => setVoteDateTime((current) => ({ ...current, date: event.target.value }))} 
                          style={{ boxSizing: 'border-box', width: '100%', minHeight: '40px', fontSize: '14px' }}
                        />
                      </label>
                      <label>
                        시간
                        <input 
                          type="time" 
                          value={voteDateTime.time} 
                          onChange={(event) => setVoteDateTime((current) => ({ ...current, time: event.target.value }))} 
                          style={{ boxSizing: 'border-box', width: '100%', minHeight: '40px', fontSize: '14px' }}
                        />
                      </label>
                    </div>
                    <button 
                      type="button" 
                      onClick={addDateTimeVoteOption} 
                      disabled={!voteDateTime.date}
                      style={{
                        minHeight: '38px',
                        borderRadius: '10px',
                        border: '1px solid var(--mobile-primary)',
                        background: '#fff',
                        color: 'var(--mobile-primary)',
                        fontSize: '12px',
                        fontWeight: '800',
                        cursor: voteDateTime.date ? 'pointer' : 'not-allowed',
                        opacity: voteDateTime.date ? 1 : 0.6
                      }}
                    >
                      선택지 추가
                    </button>
                    <p style={{ margin: 0, fontSize: '11px', color: '#64748b', lineHeight: 1.4 }}>
                      날짜와 시간을 고른 뒤 선택지로 추가해주세요. 여러 후보 시간을 빠르게 등록할 수 있습니다.
                    </p>
                  </div>
                ) : null}
                <div>
                  {voteForm.options.map((option, index) => (
                    <label key={index}>선택지 {index + 1}<input value={option} onChange={(event) => updateVoteOption(index, event.target.value)} /></label>
                  ))}
                </div>
                <button type="button" onClick={() => setVoteForm((current) => ({ ...current, options: [...current.options, ""] }))}>선택지 추가</button>
                
                <div style={{ display: 'grid', gap: '10px', margin: '8px 0', borderTop: '1px solid #f1f5f9', paddingTop: '10px' }}>
                  <label>
                    투표 종료일자
                    <input 
                      type="datetime-local" 
                      value={voteForm.ends_at} 
                      onChange={(event) => setVoteForm({ ...voteForm, ends_at: event.target.value })} 
                      style={{ boxSizing: 'border-box', width: '100%', minHeight: '42px' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={voteForm.allow_multiple} 
                      onChange={(event) => setVoteForm({ ...voteForm, allow_multiple: event.target.checked })} 
                      style={{ width: '18px', height: '18px', margin: 0 }}
                    /> 
                    복수 선택 허용
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>
                    <input 
                      type="checkbox" 
                      checked={!voteForm.is_anonymous} 
                      onChange={(event) => setVoteForm({ ...voteForm, is_anonymous: !event.target.checked })} 
                      style={{ width: '18px', height: '18px', margin: 0 }}
                    /> 
                    공개 투표
                  </label>
                </div>

                <button type="submit" disabled={voteSubmitting}>{voteSubmitting ? "등록 중..." : "투표 등록"}</button>
              </form>
            ) : votes.loading ? (
              <p>투표를 불러오는 중입니다.</p>
            ) : votes.data?.items?.length ? (
              <div className="chat-vote-list">
                {votes.data.items.map((vote) => (
                  <article key={vote.id}>
                    <strong>{vote.title}</strong>
                    <small style={{ display: 'block', fontSize: '11px', color: '#64748b', marginTop: '3px', marginBottom: '8px' }}>
                      총 {vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0)}표 · {vote.allow_multiple ? "복수 선택" : "단일 선택"} · {vote.is_anonymous ? "비공개" : "공개"} · {formatVoteDeadline(vote.ends_at)}
                    </small>
                    <div style={{ display: 'grid', gap: '6px' }}>
                      {vote.options.map((option) => {
                        const isSelected = vote.allow_multiple
                          ? (voteSelections[vote.id] || selectedIdsOf(vote)).map(Number).includes(Number(option.id))
                          : Number(vote.selected_option_id) === Number(option.id);
                        return (
                          <button 
                            type="button" 
                            key={option.id} 
                            className={isSelected ? "selected" : ""} 
                            onClick={() => toggleVoteSelection(vote, option.id)}
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              padding: '10px 14px',
                              borderRadius: '10px',
                              border: '1px solid',
                              borderColor: isSelected ? 'var(--mobile-primary)' : '#e2e8f0',
                              background: isSelected ? 'rgba(79, 70, 229, 0.05)' : '#fff',
                              color: isSelected ? 'var(--mobile-primary)' : '#1e293b',
                              fontSize: '13px',
                              fontWeight: isSelected ? '800' : '500',
                              textAlign: 'left'
                            }}
                          >
                            <span>{option.text}</span>
                            <em>{isSelected ? "선택됨 · " : ""}{option.response_count}명</em>
                          </button>
                        );
                      })}
                      {vote.allow_multiple ? (
                        <button
                          className="chat-vote-submit-selection"
                          type="button"
                          onClick={() => confirmMultipleVote(vote)}
                          style={{
                            marginTop: '8px',
                            minHeight: '38px',
                            borderRadius: '10px',
                            background: 'var(--mobile-primary)',
                            color: '#fff',
                            border: 0,
                            fontWeight: '800',
                            fontSize: '12px',
                            cursor: 'pointer'
                          }}
                        >
                          선택 반영
                        </button>
                      ) : null}
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

      {/* Mobile Chat Drawer */}
      {drawerOpen ? (
        <div className="mobile-chat-drawer-container" style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            className="mobile-chat-drawer-backdrop" 
            type="button" 
            onClick={() => setDrawerOpen(false)} 
            aria-label="메뉴 닫기" 
            style={{ position: 'absolute', inset: 0, background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(3px)', border: 0, width: '100%', height: '100%' }}
          />
          <section 
            className="mobile-chat-drawer-content" 
            style={{ 
              position: 'relative', 
              width: '80%', 
              maxWidth: '320px', 
              height: '100%', 
              background: '#fff', 
              boxShadow: '-4px 0 24px rgba(0,0,0,0.15)', 
              display: 'flex', 
              flexDirection: 'column',
              boxSizing: 'border-box'
            }}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b' }}>채팅방 메뉴</span>
              <button 
                type="button" 
                onClick={() => setDrawerOpen(false)} 
                style={{ background: 'none', border: 0, color: '#64748b', display: 'flex', alignItems: 'center', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Drawer Scrollable Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Notification / Mute Settings */}
              <div>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>알림 설정</span>
                {(() => {
                  const rId = isDirectChat ? directRoomId : chatRoomId;
                  const rType = isDirectChat ? "direct" : "meeting";
                  const isMuted = mutedRooms.some(r => String(r.room_id) === String(rId) && r.room_type === rType);
                  return (
                    <button 
                      type="button" 
                      onClick={() => toggleMute(rId, rType)}
                      style={{
                        width: '100%',
                        minHeight: '44px',
                        borderRadius: '12px',
                        border: '1px solid #e2e8f0',
                        background: isMuted ? '#f8fafc' : '#fff',
                        color: isMuted ? '#64748b' : 'var(--mobile-primary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        fontWeight: '800',
                        cursor: 'pointer'
                      }}
                    >
                      {isMuted ? (
                        <>
                          <BellOff size={16} />
                          <span>채팅방 알림 켜기</span>
                        </>
                      ) : (
                        <>
                          <Bell size={16} />
                          <span>채팅방 알림 끄기 (음소거)</span>
                        </>
                      )}
                    </button>
                  );
                })()}
              </div>

              {/* Quick Actions (only for meeting chats) */}
              {!isDirectChat && (
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', display: 'block', marginBottom: '8px' }}>모임 도구</span>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button 
                      type="button" 
                      onClick={() => { setDrawerOpen(false); openVoteList(); }}
                      style={{
                        minHeight: '40px',
                        borderRadius: '10px',
                        border: '1px solid #e2e8f0',
                        background: '#fff',
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#334155',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                    >
                      <Vote size={15} />
                      투표함
                    </button>
                    {canManageRoom && (
                      <button 
                        type="button" 
                        onClick={() => { setDrawerOpen(false); setNoticeFormOpen(true); }}
                        style={{
                          minHeight: '40px',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          background: '#fff',
                          fontSize: '12px',
                          fontWeight: '700',
                          color: '#334155',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                      >
                        <Pin size={15} />
                        공지 등록
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Participant List */}
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8' }}>
                    {isDirectChat ? "대화 상대" : `대화 멤버 (${room?.participants?.length || 0}명)`}
                  </span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', overflowY: 'auto', flex: 1, maxHeight: '280px' }}>
                  {isDirectChat ? (
                    room?.other_user && (
                      <button
                        type="button"
                        onClick={() => { setDrawerOpen(false); openUserProfile(room.other_user); }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          width: '100%',
                          padding: '8px 10px',
                          border: 0,
                          background: 'none',
                          borderRadius: '10px',
                          textAlign: 'left',
                          cursor: 'pointer'
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {room.other_user.profile_image_url ? (
                            <img src={room.other_user.profile_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          ) : (
                            <UsersRound size={16} style={{ color: '#94a3b8' }} />
                          )}
                        </div>
                        <b style={{ fontSize: '13px', color: '#1e293b', fontWeight: '700' }}>{room.other_user.nickname || "상대방"}</b>
                      </button>
                    )
                  ) : (
                    (room?.participants || []).map((participant) => {
                      const pUser = participant.user || {};
                      const isMe = String(pUser.id || participant.user_id) === String(user?.id);
                      return (
                        <div
                          key={participant.id || participant.user_id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            padding: '8px 10px',
                            background: 'none',
                            borderRadius: '10px',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => { setDrawerOpen(false); openUserProfile(pUser); }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '10px',
                              border: 0,
                              background: 'none',
                              textAlign: 'left',
                              cursor: 'pointer',
                              flex: 1
                            }}
                          >
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', overflow: 'hidden', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {pUser.profile_image_url ? (
                                <img src={pUser.profile_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <UsersRound size={16} style={{ color: '#94a3b8' }} />
                              )}
                            </div>
                            <span style={{ fontSize: '13px', color: '#1e293b', fontWeight: isMe ? '800' : '600' }}>
                              {pUser.nickname || "참여자"}{isMe ? " (나)" : ""}
                            </span>
                            <small style={{ fontSize: '11px', fontWeight: '800', color: participant.role === "host" ? '#f59e0b' : '#94a3b8', background: participant.role === "host" ? '#fef3c7' : '#f1f5f9', padding: '2px 6px', borderRadius: '6px' }}>
                              {participant.role === "host" ? "방장" : participant.role || "멤버"}
                            </small>
                          </button>
                          
                          {isRoomHost && !isMe && participant.role !== "host" && (
                            <button
                              type="button"
                              onClick={() => kickMember(pUser)}
                              style={{
                                border: '1px solid #ef4444',
                                background: '#fff',
                                color: '#ef4444',
                                fontSize: '11px',
                                fontWeight: '700',
                                padding: '4px 8px',
                                borderRadius: '6px',
                                cursor: 'pointer'
                              }}
                            >
                              강퇴
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            {/* Drawer Footer Actions */}
            <div style={{ padding: '16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'grid', gap: '8px' }}>
              {isDirectChat ? (
                <button
                  type="button"
                  onClick={leaveRoom}
                  style={{
                    width: '100%',
                    minHeight: '42px',
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    background: '#fff',
                    color: '#ef4444',
                    fontSize: '13px',
                    fontWeight: '800',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    cursor: 'pointer'
                  }}
                >
                  <LogOut size={16} />
                  <span>대화방 나가기</span>
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={leaveRoom}
                    style={{
                      width: '100%',
                      minHeight: '42px',
                      borderRadius: '10px',
                      border: '1px solid #e2e8f0',
                      background: '#fff',
                      color: '#ef4444',
                      fontSize: '13px',
                      fontWeight: '800',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    <LogOut size={16} />
                    <span>채팅방 나가기</span>
                  </button>
                  {isRoomHost && (
                    <button
                      type="button"
                      onClick={closeMeetingRoom}
                      style={{
                        width: '100%',
                        minHeight: '42px',
                        borderRadius: '10px',
                        border: 0,
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '13px',
                        fontWeight: '800',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        cursor: 'pointer'
                      }}
                    >
                      <Trash2 size={16} />
                      <span>모임 채팅방 종료</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default MobileChatRoom;
