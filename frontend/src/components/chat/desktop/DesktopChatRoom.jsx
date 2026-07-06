import { BarChart3, CalendarDays, Camera, ClipboardList, MapPin, Megaphone, MessageCircle, Plus, Search, Send, UsersRound, Vote, X } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { chatApi } from "../../../api/chatApi";
import { meetingApi } from "../../../api/meetingApi";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { voteApi } from "../../../api/voteApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { useAsync } from "../../../hooks/useAsync";

function formatMessageTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatMessageDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function messageDateKey(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
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

function DesktopChatRoom() {
  const { chatRoomId } = useParams();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [talkSearchOpen, setTalkSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [talkInfoOpen, setTalkInfoOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const [profilePreviewUser, setProfilePreviewUser] = useState(null);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteMode, setVoteMode] = useState("list");
  const [voteKind, setVoteKind] = useState("general");
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);
  const [voteForm, setVoteForm] = useState({ title: "", options: ["참여", "불참"] });
  const [voteDateTime, setVoteDateTime] = useState({ date: "", time: "" });
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const messageListRef = useRef(null);
  const fileInputRef = useRef(null);
  const messages = useAsync(() => chatApi.messages(chatRoomId), [chatRoomId, refreshKey]);
  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const room = messages.data?.room;
  const meeting = room?.meeting;
  const renderedMessages = messages.data?.items || [];
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleMessages = normalizedSearchQuery
    ? renderedMessages.filter((message) => {
        const senderName = message.sender?.nickname || message.sender?.name || "";
        return `${senderName} ${message.content || ""}`.toLowerCase().includes(normalizedSearchQuery);
      })
    : renderedMessages;
  const roomItems = rooms.data?.items || [];
  const myRole = meeting?.my_participant?.role || (meeting?.host?.id === user?.id ? "host" : "member");
  const canCreateVote = ["host", "cohost", "subhost", "assistant"].includes(String(myRole).toLowerCase());
  const votes = useAsync(() => meeting?.id ? meetingApi.votes(meeting.id) : Promise.resolve({ items: [] }), [meeting?.id, voteRefreshKey]);

  useLayoutEffect(() => {
    if (!messageListRef.current || !messages.data?.items) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
  }, [messages.data?.items?.length]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || sending || realtimeConnected) return;
      setRefreshKey((value) => value + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [realtimeConnected, sending]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !chatRoomId) {
      setRealtimeConnected(false);
      return undefined;
    }

    const channel = supabase
      .channel(`desktop-chat-room-${chatRoomId}`)
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
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  const send = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setError("");
    setActionNotice("");
    setSending(true);
    try {
      await chatApi.send(chatRoomId, { content: content.trim() });
      setContent("");
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
    setActionMenuOpen(false);
    setActionNotice("사진 전송 기능은 준비 중입니다. 선택한 사진은 아직 전송되지 않습니다.");
    event.target.value = "";
  };

  const shareLocation = () => {
    setActionNotice("");
    setError("");
    if (!("geolocation" in navigator)) {
      setActionNotice("이 브라우저에서는 위치 공유를 사용할 수 없습니다.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      () => {
        setActionMenuOpen(false);
        setActionNotice("위치 권한이 확인되었습니다. 위치 공유 전송 기능은 준비 중입니다.");
      },
      () => {
        setActionNotice("위치 권한이 허용되지 않았습니다. 브라우저 설정에서 위치 권한을 확인해주세요.");
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const openVoteList = () => {
    setVoteMode("list");
    setVoteError("");
    setVoteOpen(true);
  };

  const openVoteCreate = () => {
    setActionMenuOpen(false);
    setVoteMode("create");
    setVoteError("");
    setVoteOpen(true);
  };

  const updateVoteOption = (index, value) => {
    setVoteForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  const selectVoteKind = (kind) => {
    setVoteKind(kind);
    setVoteError("");
    if (kind === "datetime") {
      setVoteForm((current) => {
        const isDefaultOptions = current.options.length === 2 && current.options[0] === "참여" && current.options[1] === "불참";
        return {
          title: current.title || "모임 날짜/시간 투표",
          options: isDefaultOptions ? ["", ""] : current.options
        };
      });
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
      return { ...current, options: [...current.options, normalized] };
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
    try {
      await meetingApi.createVote(meeting.id, { title: voteForm.title.trim(), options });
      setVoteForm({ title: "", options: ["참여", "불참"] });
      setVoteKind("general");
      setVoteDateTime({ date: "", time: "" });
      setVoteMode("list");
      setVoteRefreshKey((value) => value + 1);
    } catch (createError) {
      setVoteError(createError.response?.data?.message || "투표를 생성하지 못했습니다.");
    } finally {
      setVoteSubmitting(false);
    }
  };

  const participateVote = async (voteId, optionId) => {
    setVoteError("");
    try {
      await voteApi.participate(voteId, { option_id: optionId });
      setVoteRefreshKey((value) => value + 1);
    } catch (participateError) {
      setVoteError(participateError.response?.data?.message || "투표 참여에 실패했습니다.");
    }
  };

  return (
    <section className="desktop-page desktop-prototype legacy-pc legacy-chat-page">
      <div className="screen-title">
        <div>
          <h1>내 채팅</h1>
          <span>참여중인 모임 채팅방을 한곳에서 확인합니다.</span>
        </div>
      </div>
      <div className="talk-layout">
        <aside className="page-card talk-list">
          <div className="talk-list-head">
            <h2>참여중인 채팅방</h2>
            <span>{roomItems.length}</span>
          </div>
          {rooms.loading && !rooms.data ? (
            <LoadingCards count={4} />
          ) : roomItems.length ? (
            <div className="talk-list-items">
              {roomItems.map((item) => {
                const itemMeeting = item.meeting || {};
                return (
                  <Link key={item.id} to={`/chats/${item.id}`} className={`proto-talk-room-item ${String(item.id) === String(chatRoomId) ? "selected" : ""}`}>
                    {itemMeeting.cover_image_url ? <img src={itemMeeting.cover_image_url} alt="" /> : <div className="talk-room-fallback"><MessageCircle size={20} /></div>}
                    <span>
                      <b>{itemMeeting.title || "모임 채팅방"}</b>
                      <small>{itemMeeting.location_name || "장소 미정"} · {itemMeeting.current_participants || 0}/{itemMeeting.max_participants || 0}명</small>
                    </span>
                    <em>{formatMessageTime(item.last_message?.created_at) || "방금"}</em>
                  </Link>
                );
              })}
            </div>
          ) : (
            <EmptyState title="참여 중인 채팅방이 없습니다." actionLabel="모임 찾기" actionTo="/meetings" />
          )}
        </aside>

        {messages.loading && !messages.data ? (
          <section className="page-card talk-room talk-room-open">
            <LoadingCards count={3} />
          </section>
        ) : messages.error ? (
          <section className="page-card talk-room talk-room-empty">
            <EmptyState title="채팅방을 불러오지 못했습니다." description="참여 승인 상태를 확인하거나 잠시 후 다시 시도해주세요." actionLabel="채팅 목록" actionTo="/chats" />
          </section>
        ) : (
          <section className="page-card talk-room talk-room-open">
            <div className="talk-room-top">
              <div>
                <strong>{meeting?.title || "채팅방"}</strong>
                <small>{meeting?.location_name || "장소 미정"} · {meeting?.current_participants || 0}/{meeting?.max_participants || 0}명</small>
              </div>
              <span>
                <button className="talk-tool-btn" type="button" onClick={() => setTalkInfoOpen((value) => !value)}>
                  <ClipboardList size={15} />
                  <b>공지/일정</b>
                </button>
                <button className="talk-tool-btn" type="button" onClick={openVoteList}>
                  <Vote size={15} />
                  <b>투표</b>
                </button>
                <button className="talk-icon-btn" type="button" onClick={() => setTalkSearchOpen((value) => !value)} aria-label="대화 검색">
                  <Search size={15} />
                </button>
                <Link className="talk-close-btn" to="/chats" aria-label="채팅 닫기">
                  <X size={15} />
                </Link>
              </span>
            </div>
            <div className={`talk-search-panel ${talkSearchOpen ? "is-open" : ""}`}>
              <Search size={15} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="대화 내용 검색" />
            </div>
            <div className={`talk-info-panel ${talkInfoOpen ? "is-open" : ""}`}>
              {meeting?.id ? (
                <Link to={`/meetings/${meeting.id}`}>
                  <Megaphone size={15} />
                  <span>공지 및 모임 상세 확인</span>
                </Link>
              ) : null}
              <Link to={`/mypage?panel=schedule&calendar=1${meeting?.id ? `&meeting=${meeting.id}` : ""}${chatRoomId ? `&chat=${chatRoomId}` : ""}`}>
                <CalendarDays size={15} />
                <span>내 모임 일정 보기</span>
              </Link>
              {meeting?.id ? (
                <button type="button" onClick={openVoteList}>
                  <BarChart3 size={15} />
                  <span>투표 확인</span>
                </button>
              ) : null}
            </div>
            <div className="talk-messages" ref={messageListRef}>
              {visibleMessages.length ? (
                visibleMessages.map((message, index) => {
                  const mine = message.user_id === user?.id;
                  const previous = visibleMessages[index - 1];
                  const showDivider = !previous || messageDateKey(previous.created_at) !== messageDateKey(message.created_at);
                  return (
                    <div key={message.id}>
                      {showDivider ? <div className="talk-date">{formatMessageDate(message.created_at)}</div> : null}
                      <div className={`talk-bubble ${mine ? "right" : "left"}`}>
                        {!mine ? (
                          <button className="talk-sender-button" type="button" onClick={() => setProfilePreviewUser(message.sender)}>
                            {message.sender?.nickname || message.sender?.name || "참여자"}
                          </button>
                        ) : null}
                        <p>{message.content}</p>
                        <time>{formatMessageTime(message.created_at)}</time>
                      </div>
                    </div>
                  );
                })
              ) : normalizedSearchQuery ? (
                <div className="talk-message-empty">
                  <Search size={24} />
                  <strong>검색 결과가 없습니다.</strong>
                  <p>다른 이름이나 메시지 내용으로 검색해보세요.</p>
                </div>
              ) : (
                <div className="talk-message-empty">
                  <UsersRound size={24} />
                  <strong>아직 대화가 없습니다.</strong>
                  <p>모임 준비 이야기를 먼저 시작해보세요.</p>
                </div>
              )}
            </div>
            <form className="talk-input" onSubmit={send}>
              {error ? <p className="talk-input-error">{error}</p> : null}
              {actionNotice ? <p className="talk-input-notice">{actionNotice}</p> : null}
              {actionMenuOpen ? (
                <div className="chat-action-menu" role="menu">
                  <button type="button" role="menuitem" onClick={openPhotoPicker}><Camera size={17} />사진 전송</button>
                  {canCreateVote ? <button type="button" role="menuitem" onClick={openVoteCreate}><Vote size={17} />투표 생성</button> : null}
                  <button type="button" role="menuitem" onClick={shareLocation}><MapPin size={17} />위치 공유</button>
                </div>
              ) : null}
              <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/*" onChange={handlePhotoSelected} />
              <button className="talk-input-more" type="button" onClick={() => setActionMenuOpen((value) => !value)} aria-label="채팅 기능 더보기" aria-expanded={actionMenuOpen}>
                <Plus size={20} />
              </button>
              <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="메시지를 입력하세요.." aria-label="메시지 입력" />
              <button type="submit" disabled={sending || !content.trim()} aria-label="메시지 전송">
                <Send size={18} />
              </button>
            </form>
          </section>
        )}
      </div>

      {profilePreviewUser ? (
        <div className="chat-profile-sheet" role="dialog" aria-modal="true" aria-label="사용자 간략 정보">
          <button className="chat-profile-sheet__backdrop" type="button" onClick={() => setProfilePreviewUser(null)} aria-label="닫기" />
          <section>
            <div className="chat-profile-sheet__avatar">
              {profilePreviewUser.profile_image_url ? <img src={profilePreviewUser.profile_image_url} alt="" /> : <UsersRound size={24} />}
            </div>
            <strong>{profilePreviewUser.nickname || profilePreviewUser.name || "참여자"}</strong>
            <p>{profilePreviewUser.profile?.region || "활동 지역 미설정"}</p>
            <div className="chat-profile-sheet__actions">
              <button type="button">1:1 쪽지</button>
              <button type="button">차단</button>
            </div>
          </section>
        </div>
      ) : null}

      {voteOpen ? (
        <div className="chat-vote-modal" role="dialog" aria-modal="true" aria-label="투표">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setVoteOpen(false)} aria-label="닫기" />
          <section>
            <div className="chat-vote-modal__header">
              <div>
                <span>모임 투표</span>
                <p>모임 운영진은 투표를 만들고, 참여자는 선택지에 투표할 수 있습니다.</p>
              </div>
              <button className="chat-vote-modal__close" type="button" onClick={() => setVoteOpen(false)} aria-label="닫기">
                <X size={18} />
              </button>
            </div>
            {canCreateVote ? (
              <div className="chat-vote-modal__tabs">
                <button type="button" className={voteMode === "list" ? "active" : ""} onClick={() => setVoteMode("list")}>진행 투표</button>
                <button type="button" className={voteMode === "create" ? "active" : ""} onClick={() => setVoteMode("create")}>투표 만들기</button>
              </div>
            ) : null}
            {voteError ? <p className="chat-vote-modal__error">{voteError}</p> : null}
            {voteMode === "create" ? (
              <form className="chat-vote-create" onSubmit={createVote}>
                <div className="chat-vote-create__type" role="tablist" aria-label="투표 유형">
                  <button type="button" className={voteKind === "general" ? "active" : ""} onClick={() => selectVoteKind("general")}>일반 투표</button>
                  <button type="button" className={voteKind === "datetime" ? "active" : ""} onClick={() => selectVoteKind("datetime")}>날짜/시간 투표</button>
                </div>
                <label>투표 제목<input value={voteForm.title} onChange={(event) => setVoteForm({ ...voteForm, title: event.target.value })} placeholder="예: 오늘 참석 여부" /></label>
                {voteKind === "datetime" ? (
                  <div className="chat-vote-datetime">
                    <div className="chat-vote-datetime__fields">
                      <label>날짜<input type="date" value={voteDateTime.date} onChange={(event) => setVoteDateTime((current) => ({ ...current, date: event.target.value }))} /></label>
                      <label>시간<input type="time" value={voteDateTime.time} onChange={(event) => setVoteDateTime((current) => ({ ...current, time: event.target.value }))} /></label>
                      <button type="button" onClick={addDateTimeVoteOption} disabled={!voteDateTime.date}>선택지로 추가</button>
                    </div>
                    <p>날짜를 고르면 브라우저 달력으로 선택할 수 있고, 추가한 일정은 아래 선택지에 바로 들어갑니다.</p>
                  </div>
                ) : null}
                <div>
                  {voteForm.options.map((option, index) => (
                    <label key={index}>선택지 {index + 1}<input value={option} onChange={(event) => updateVoteOption(index, event.target.value)} /></label>
                  ))}
                </div>
                <div className="chat-vote-create__actions">
                  <button type="button" onClick={() => setVoteForm((current) => ({ ...current, options: [...current.options, ""] }))}>선택지 추가</button>
                  <button type="submit" disabled={voteSubmitting}>{voteSubmitting ? "등록 중" : "투표 등록"}</button>
                </div>
              </form>
            ) : votes.loading ? (
              <p>투표를 불러오는 중입니다.</p>
            ) : votes.data?.items?.length ? (
              <div className="chat-vote-list">
                {votes.data.items.map((vote) => {
                  const totalResponses = vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0);
                  return (
                    <article key={vote.id}>
                      <header>
                        <strong>{vote.title}</strong>
                        <small>총 {totalResponses}명 참여</small>
                      </header>
                      <div>
                        {vote.options.map((option) => {
                          const count = Number(option.response_count || 0);
                          const percent = totalResponses ? Math.round((count / totalResponses) * 100) : 0;
                          return (
                            <button type="button" key={option.id} onClick={() => participateVote(vote.id, option.id)}>
                              <span>{option.text}</span>
                              <i><b style={{ width: `${percent}%` }} /></i>
                              <em>{count}명 · {percent}%</em>
                            </button>
                          );
                        })}
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p>진행 중인 투표가 없습니다.</p>
            )}
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default DesktopChatRoom;
