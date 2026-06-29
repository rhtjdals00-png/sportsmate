import { Send, UsersRound } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";

function formatMessageTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function MobileChatRoom() {
  const { chatRoomId } = useParams();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const messages = useAsync(() => chatApi.messages(chatRoomId), [chatRoomId, refreshKey]);
  const room = messages.data?.room;
  const meeting = room?.meeting;

  const send = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    await chatApi.send(chatRoomId, { content: content.trim() });
    setContent("");
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <MobileHeader title={meeting?.title || "채팅방"} />
      {messages.loading ? (
        <LoadingCards count={3} />
      ) : (
        <>
          <section className="chat-room-summary">
            <div className="chat-room-summary__thumb" style={meeting?.cover_image_url ? { backgroundImage: `url(${meeting.cover_image_url})` } : undefined}>
              {!meeting?.cover_image_url && <span>{meeting?.sport?.name || "운동"}</span>}
            </div>
            <div>
              <strong>{meeting?.title}</strong>
              <p>{meeting?.location_name} · {meeting?.current_participants}/{meeting?.max_participants}명</p>
            </div>
            {meeting?.id && <Link to={`/meetings/${meeting.id}`}>상세</Link>}
          </section>
          <div className="message-list">
            <div className="message-day-divider">오늘</div>
            {(messages.data?.items || []).map((message) => {
              const mine = message.user_id === user?.id;
              return (
                <div key={message.id} className={`message-row ${mine ? "mine" : ""}`}>
                  {!mine && (
                    <div className="message-avatar">
                      {message.sender?.profile_image_url ? <img src={message.sender.profile_image_url} alt="" /> : <UsersRound size={16} />}
                    </div>
                  )}
                  <div className={`message-bubble ${mine ? "mine" : ""}`}>
                    {!mine && <span>{message.sender?.nickname}</span>}
                    <p>{message.content}</p>
                    <time>{formatMessageTime(message.created_at)}</time>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
      <form className="chat-input" onSubmit={send}>
        <input value={content} onChange={(event) => setContent(event.target.value)} placeholder="메시지를 입력하세요" />
        <button type="submit" aria-label="메시지 전송">
          <Send size={20} />
        </button>
      </form>
    </>
  );
}

export default MobileChatRoom;
