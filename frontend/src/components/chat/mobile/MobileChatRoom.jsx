import { Camera, MapPin, Plus, Send, UsersRound, Vote } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";

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
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [profilePreviewUser, setProfilePreviewUser] = useState(null);
  const messages = useAsync(() => chatApi.messages(chatRoomId), [chatRoomId, refreshKey]);
  const room = messages.data?.room;
  const meeting = room?.meeting;
  const myRole = meeting?.my_participant?.role || (meeting?.host?.id === user?.id ? "host" : "member");
  const canCreateVote = ["host", "cohost", "subhost", "assistant"].includes(String(myRole).toLowerCase());
  const demoNotice = {
    title: "오늘 모임 공지",
    body: "오늘 7시까지 여의도 한강공원 2번 출구 앞에서 모입니다. 개인 물과 러닝화를 준비해주세요.",
    meta: "방장 · 방금 전"
  };
  const demoVote = {
    title: "오늘 참석 여부",
    body: "오늘 모임에 참여 가능한지 선택해주세요. 방장이 선택 변경 가능 여부를 설정할 수 있습니다.",
    allowChange: true
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
            <button className="mobile-chat-vote-link" type="button" onClick={() => setVoteOpen(true)}>
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
                          <button type="button" onClick={() => setProfilePreviewUser(message.sender)} aria-label="사용자 정보 보기">
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
        {actionMenuOpen ? (
          <div className="chat-action-menu" role="menu">
            <button type="button" role="menuitem"><Camera size={17} />사진 전송</button>
            {canCreateVote ? <button type="button" role="menuitem"><Vote size={17} />투표 생성</button> : null}
            <button type="button" role="menuitem"><MapPin size={17} />위치 공유</button>
          </div>
        ) : null}
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
              <span>모임 투표</span>
              <button type="button" onClick={() => setVoteOpen(false)}>닫기</button>
            </div>
            <strong>{demoVote.title}</strong>
            <p>{demoVote.body}</p>
            <div className="chat-vote-modal__actions">
              <button type="button">참여</button>
              <button type="button">불참</button>
            </div>
            <small>{demoVote.allowChange ? "선택 후에도 변경할 수 있습니다." : "방장 설정에 따라 선택 변경이 제한됩니다."}</small>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default MobileChatRoom;
