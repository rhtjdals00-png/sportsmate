import { Link } from "react-router-dom";
import { MapPin, UsersRound } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";

function formatChatTime(value) {
  if (!value) return "방금";
  return new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function MobileChatList() {
  const rooms = useAsync(() => chatApi.rooms(), []);

  return (
    <>
      <MobileHeader title="채팅" />
      <section className="mobile-chat-heading">
        <span>SPORTSMATE FLOW</span>
        <h1>내 채팅</h1>
        <p>참여 중인 모임의 대화를 한곳에서 확인합니다.</p>
      </section>
      {rooms.loading ? (
        <LoadingCards />
      ) : rooms.data?.items?.length ? (
        <div className="chat-list chat-list--rooms">
          {rooms.data.items.map((room) => {
            const meeting = room.meeting || {};
            return (
              <Link key={room.id} to={`/chats/${room.id}`} className="chat-room-card">
                <div className="chat-room-card__thumb" style={meeting.cover_image_url ? { backgroundImage: `url(${meeting.cover_image_url})` } : undefined}>
                  {!meeting.cover_image_url && <span>{meeting.sport?.name || "운동"}</span>}
                </div>
                <div className="chat-room-card__content">
                  <div className="chat-room-card__topline">
                    <strong>{meeting.title}</strong>
                    <time>{formatChatTime(room.last_message?.created_at)}</time>
                  </div>
                  <p>{room.last_message?.content || "아직 메시지가 없습니다."}</p>
                  <div className="chat-room-card__meta">
                    <span><MapPin size={13} />{meeting.location_name || "장소 미정"}</span>
                    <span><UsersRound size={13} />{meeting.current_participants || 0}/{meeting.max_participants || 0}명</span>
                  </div>
                </div>
                {room.unread_count > 0 && <em>{room.unread_count}</em>}
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState title="참여 중인 채팅방이 없습니다." description="승인된 모임의 채팅방이 여기에 표시됩니다." actionLabel="모임 찾기" actionTo="/meetings" />
      )}
    </>
  );
}

export default MobileChatList;
