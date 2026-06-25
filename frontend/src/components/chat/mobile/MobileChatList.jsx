import { Link } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";

function MobileChatList() {
  const rooms = useAsync(() => chatApi.rooms(), []);

  return (
    <>
      <MobileHeader title="채팅" />
      {rooms.loading ? (
        <LoadingCards />
      ) : rooms.data?.items?.length ? (
        <div className="chat-list">
          {rooms.data.items.map((room) => (
            <Link key={room.id} to={`/chats/${room.id}`} className="chat-room-card">
              <strong>{room.meeting?.title}</strong>
              <p>{room.last_message?.content || "아직 메시지가 없습니다."}</p>
              {room.unread_count > 0 && <span>{room.unread_count}</span>}
            </Link>
          ))}
        </div>
      ) : (
        <EmptyState title="참여 중인 채팅방이 없습니다." description="승인된 모임의 채팅방이 여기에 표시됩니다." actionLabel="모임 찾기" actionTo="/meetings" />
      )}
    </>
  );
}

export default MobileChatList;

