import { Link } from "react-router-dom";
import { MapPin, UsersRound, MessageCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";

function formatChatTime(value) {
  if (!value) return "방금";
  const date = new Date(value);
  const now = new Date();
  const diffMs = now - date;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return new Intl.DateTimeFormat("ko-KR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Asia/Seoul"
    }).format(date);
  } else if (diffDays === 1) {
    return "어제";
  } else if (diffDays < 7) {
    return `${diffDays}일 전`;
  } else {
    return new Intl.DateTimeFormat("ko-KR", {
      month: "short",
      day: "numeric",
      timeZone: "Asia/Seoul"
    }).format(date);
  }
}

function MobileChatList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [chatTab, setChatTab] = useState("meeting");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [imgErrors, setImgErrors] = useState({});

  const handleImgError = (id) =>
    setImgErrors((prev) => ({ ...prev, [id]: true }));

  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const directRooms = useAsync(() => chatApi.directRooms(), [directRefreshKey]);

  const meetingItems = rooms.data?.items || [];
  const directItems = directRooms.data?.items || [];

  // 폴링 (리얼타임 미연결 시)
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || realtimeConnected) return;
      setRefreshKey((v) => v + 1);
      setDirectRefreshKey((v) => v + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [realtimeConnected]);

  // Supabase 리얼타임
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setRealtimeConnected(false);
      return undefined;
    }

    const channel = supabase
      .channel("mobile-chat-list-v2")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => setRefreshKey((v) => v + 1)
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_chat_messages" },
        () => setDirectRefreshKey((v) => v + 1)
      )
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, []);

  const currentLoading =
    chatTab === "meeting"
      ? rooms.loading && !rooms.data
      : directRooms.loading && !directRooms.data;

  return (
    <>
      <MobileHeader title="채팅" />

      {/* 헤딩 */}
      <section className="mobile-chat-heading">
        <span>SPORTSMATE FLOW</span>
        <h1>내 채팅</h1>
        <p>
          {chatTab === "meeting"
            ? "참여 중인 모임의 대화를 한곳에서 확인합니다."
            : "나눈 1:1 대화를 한곳에서 확인합니다."}
        </p>
      </section>

      {/* 탭 메뉴 */}
      <div className="mobile-chat-tabs">
        <button
          type="button"
          className={`mobile-chat-tab${chatTab === "meeting" ? " is-active" : ""}`}
          onClick={() => setChatTab("meeting")}
          aria-selected={chatTab === "meeting"}
          role="tab"
        >
          <MessageCircle size={15} />
          <span>모임 채팅</span>
          {meetingItems.length > 0 && (
            <em className="mobile-chat-tab__badge">{meetingItems.length}</em>
          )}
        </button>
        <button
          type="button"
          className={`mobile-chat-tab${chatTab === "direct" ? " is-active" : ""}`}
          onClick={() => setChatTab("direct")}
          aria-selected={chatTab === "direct"}
          role="tab"
        >
          <Users size={15} />
          <span>1:1 채팅</span>
          {directItems.length > 0 && (
            <em className="mobile-chat-tab__badge">{directItems.length}</em>
          )}
        </button>
      </div>

      {/* 콘텐츠 영역 */}
      {currentLoading ? (
        <LoadingCards />
      ) : chatTab === "meeting" ? (
        meetingItems.length ? (
          <div className="chat-list chat-list--rooms">
            {meetingItems.map((room) => {
              const meeting = room.meeting || {};
              return (
                <Link key={room.id} to={`/chats/${room.id}`} className="chat-room-card">
                  <div
                    className="chat-room-card__thumb"
                    style={
                      meeting.cover_image_url
                        ? { backgroundImage: `url(${meeting.cover_image_url})` }
                        : undefined
                    }
                  >
                    {!meeting.cover_image_url && (
                      <span>{meeting.sport?.name || "운동"}</span>
                    )}
                  </div>
                  <div className="chat-room-card__content">
                    <div className="chat-room-card__topline">
                      <strong>{meeting.title}</strong>
                      <time>{formatChatTime(room.last_message?.created_at)}</time>
                    </div>
                    <p>{room.last_message?.content || "아직 메시지가 없습니다."}</p>
                    <div className="chat-room-card__meta">
                      <span>
                        <MapPin size={13} />
                        {meeting.location_name || "장소 미정"}
                      </span>
                      <span>
                        <UsersRound size={13} />
                        {meeting.current_participants || 0}/{meeting.max_participants || 0}명
                      </span>
                    </div>
                  </div>
                  {room.unread_count > 0 && <em>{room.unread_count}</em>}
                </Link>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="참여 중인 채팅방이 없습니다."
            description="승인된 모임의 채팅방이 여기에 표시됩니다."
            actionLabel="모임 찾기"
            actionTo="/meetings"
          />
        )
      ) : directItems.length ? (
        <div className="chat-list chat-list--direct">
          {directItems.map((room) => {
            const other = room.other_user || {};
            return (
              <Link
                key={room.id}
                to={`/chats/direct/${room.id}`}
                className="chat-room-card chat-room-card--direct"
              >
                <div className="chat-room-card__thumb chat-room-card__thumb--avatar">
                  {other.profile_image_url && !imgErrors[room.id] ? (
                    <img
                      src={other.profile_image_url}
                      alt={other.nickname || "상대방"}
                      onError={() => handleImgError(room.id)}
                    />
                  ) : (
                    <span className="chat-room-card__thumb--initials">
                      {(other.nickname || other.name || "?").charAt(0)}
                    </span>
                  )}
                </div>
                <div className="chat-room-card__content">
                  <div className="chat-room-card__topline">
                    <strong>{other.nickname || other.name || "참여자"}</strong>
                    <time>
                      {formatChatTime(
                        room.last_message?.created_at || room.updated_at || room.created_at
                      )}
                    </time>
                  </div>
                  <p>{room.last_message?.content || "아직 대화가 없습니다."}</p>
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="1:1 채팅방이 없습니다."
          description="채팅방 멤버 프로필에서 1:1 채팅을 시작해보세요."
        />
      )}
    </>
  );
}

export default MobileChatList;
