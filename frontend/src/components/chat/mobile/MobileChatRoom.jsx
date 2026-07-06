import { Camera, MapPin, Plus, Send, UsersRound, Vote } from "lucide-react";
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
  const [profilePreviewUser, setProfilePreviewUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileNotice, setProfileNotice] = useState("");
  const fileInputRef = useRef(null);
  const messages = useAsync(() => chatApi.messages(chatRoomId), [chatRoomId, refreshKey]);
  const room = messages.data?.room;
  const meeting = room?.meeting;
  const myRole = meeting?.my_participant?.role || (meeting?.host?.id === user?.id ? "host" : "member");
  const canCreateVote = ["host", "cohost", "subhost", "assistant"].includes(String(myRole).toLowerCase());
  const votes = useAsync(() => meeting?.id ? meetingApi.votes(meeting.id) : Promise.resolve({ items: [] }), [meeting?.id, voteRefreshKey]);
  const demoNotice = {
    title: "오늘 모임 공지",
    body: "오늘 7시까지 여의도 한강공원 2번 출구 앞에서 모입니다. 개인 물과 러닝화를 준비해주세요.",
    meta: "방장 · 방금 전"
  };
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
          <div className="chat-fixed-notice">
            <section className={`chat-notice ${noticeOpen ? "is-open" : ""}`}>
              <button type="button" onClick={() => setNoticeOpen((value) => !value)} aria-expanded={noticeOpen}>
                <strong>{demoNotice.title}</strong>
                <span>{demoNotice.body}</span>
                <em>{noticeOpen ? "접기" : "펼치기"}</em>
              </button>
              {noticeOpen ? (
                <div className="chat-notice__body">
                  <p>{demoNotice.body}</p>
                  <small>{demoNotice.meta}</small>
                </div>
              ) : null}
            </section>
          </div>
          <div className="message-list">
            {renderedMessages.length ? (
              renderedMessages.map((message, index) => {
                const mine = message.user_id === user?.id;
                const prevMessage = renderedMessages[index - 1];
                const showDivider = !prevMessage || messageDateKey(prevMessage.created_at) !== messageDateKey(message.created_at);
                return (
                  <div key={message.id} className="message-group">
                    {showDivider ? <div className="message-day-divider">{isTodayKst(message.created_at) ? "오늘" : formatMessageDate(message.created_at)}</div> : null}
                    <div className={`message-row ${mine ? "mine" : ""}`}>
                      {!mine && (
                        <div className="message-avatar">
                          <button type="button" onClick={() => openUserProfile(message.sender)} aria-label="사용자 정보 보기">
                            {message.sender?.profile_image_url ? <img src={message.sender.profile_image_url} alt="" /> : <UsersRound size={16} />}
                          </button>
                        </div>
                      )}
                      <div className={`message-bubble ${mine ? "mine" : ""}`}>
                        {!mine && <span>{message.sender?.nickname || "참여자"}</span>}
                        <p>{message.content}</p>
                        <time>{formatMessageTime(message.created_at)}</time>
                      </div>
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
        {actionMenuOpen ? (
          <div className="chat-action-menu" role="menu">
            <button type="button" role="menuitem" onClick={openPhotoPicker}><Camera size={17} />사진 전송</button>
            {canCreateVote ? <button type="button" role="menuitem" onClick={openVoteCreate}><Vote size={17} />투표 생성</button> : null}
            <button type="button" role="menuitem" onClick={shareLocation}><MapPin size={17} />위치 공유</button>
          </div>
        ) : null}
        <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/*" onChange={handlePhotoSelected} />
        <button className="chat-input__more" type="button" onClick={() => setActionMenuOpen((value) => !value)} aria-label="채팅 기능 더보기" aria-expanded={actionMenuOpen}>
          <Plus size={22} />
        </button>
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="메시지를 입력하세요" />
        <button type="submit" aria-label="메시지 전송" disabled={sending || !content.trim()}>
          <Send size={20} />
        </button>
      </form>
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
    </>
  );
}

export default MobileChatRoom;
