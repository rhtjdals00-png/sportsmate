import { Send } from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";

function MobileChatRoom() {
  const { chatRoomId } = useParams();
  const { user } = useAuth();
  const [content, setContent] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const messages = useAsync(() => chatApi.messages(chatRoomId), [chatRoomId, refreshKey]);

  const send = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    await chatApi.send(chatRoomId, { content });
    setContent("");
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <MobileHeader title={messages.data?.room?.meeting?.title || "채팅방"} />
      <div className="message-list">
        {(messages.data?.items || []).map((message) => (
          <div key={message.id} className={`message-bubble ${message.user_id === user?.id ? "mine" : ""}`}>
            <span>{message.sender?.nickname}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
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

