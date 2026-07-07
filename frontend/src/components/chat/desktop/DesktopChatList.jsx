import { Link } from "react-router-dom";
import { LogOut, MessageCircle, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { chatApi } from "../../../api/chatApi";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { useAsync } from "../../../hooks/useAsync";

function formatChatTime(value) {
  if (!value) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function DesktopChatList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [chatListMode, setChatListMode] = useState("meeting");
  const [leavingRoomId, setLeavingRoomId] = useState(null);
  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const directRooms = useAsync(() => chatApi.directRooms(), [directRefreshKey]);
  const items = rooms.data?.items || [];
  const directItems = directRooms.data?.items || [];

  const handleLeaveRoom = async (room) => {
    const title = room.meeting?.title || "채팅방";
    if (!window.confirm(`${title}에서 나가시겠어요? 채팅방을 나가면 해당 모임에서도 나가게 됩니다.`)) return;

    try {
      setLeavingRoomId(room.id);
      await chatApi.leave(room.id);
      setRefreshKey((value) => value + 1);
    } catch (error) {
      window.alert(error.response?.data?.message || "채팅방 나가기에 실패했습니다.");
    } finally {
      setLeavingRoomId(null);
    }
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      setRefreshKey((value) => value + 1);
      setDirectRefreshKey((value) => value + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return undefined;
    }

    const refreshRooms = () => setRefreshKey((value) => value + 1);
    const channel = supabase
      .channel("desktop-chat-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_messages"
        },
        refreshRooms
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_message_reads"
        },
        refreshRooms
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "direct_chat_messages"
        },
        () => setDirectRefreshKey((value) => value + 1)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

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
            <h2>채팅방</h2>
            <span>{chatListMode === "direct" ? directItems.length : items.length}</span>
          </div>
          <div className="talk-list-tabs" role="tablist" aria-label="채팅방 종류">
            <button className={chatListMode === "meeting" ? "is-active" : ""} type="button" onClick={() => setChatListMode("meeting")}>
              참여중인 모임
            </button>
            <button className={chatListMode === "direct" ? "is-active" : ""} type="button" onClick={() => setChatListMode("direct")}>
              1대1톡
            </button>
          </div>
          {chatListMode === "meeting" && rooms.loading && !rooms.data ? (
            <LoadingCards count={4} />
          ) : chatListMode === "direct" && directRooms.loading && !directRooms.data ? (
            <LoadingCards count={4} />
          ) : chatListMode === "meeting" && rooms.error ? (
            <EmptyState title="채팅 목록을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
          ) : chatListMode === "direct" && directRooms.error ? (
            <EmptyState title="1대1 톡 목록을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
          ) : chatListMode === "meeting" && items.length ? (
            <div className="talk-list-items">
              {items.map((room) => {
                const meeting = room.meeting || {};
                return (
                  <div key={room.id} className="proto-talk-room-item">
                    <Link to={`/chats/${room.id}`}>
                      {meeting.cover_image_url ? <img src={meeting.cover_image_url} alt="" /> : <div className="talk-room-fallback"><MessageCircle size={20} /></div>}
                      <span>
                        <b>{meeting.title || "모임 채팅방"}</b>
                        <small>{meeting.location_name || "장소 미정"} · {meeting.current_participants || 0}/{meeting.max_participants || 0}명</small>
                      </span>
                      <em>{formatChatTime(room.last_message?.created_at)}</em>
                      {Number(room.unread_count || 0) > 0 ? <i>{room.unread_count}</i> : null}
                    </Link>
                    <button
                      className="talk-room-leave-btn"
                      type="button"
                      onClick={() => handleLeaveRoom(room)}
                      disabled={String(leavingRoomId) === String(room.id)}
                      aria-label="채팅방 나가기"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : chatListMode === "direct" && directItems.length ? (
            <div className="talk-list-items">
              {directItems.map((room) => {
                const otherUser = room.other_user || {};
                return (
                  <div key={room.id} className="proto-talk-room-item">
                    <Link to={`/chats/direct/${room.id}`}>
                      {otherUser.profile_image_url ? <img src={otherUser.profile_image_url} alt="" /> : <div className="talk-room-fallback"><UsersRound size={20} /></div>}
                      <span>
                        <b>{otherUser.nickname || otherUser.name || "참여자"}</b>
                        <small>{room.last_message?.content || "아직 대화가 없습니다."}</small>
                      </span>
                      <em>{formatChatTime(room.last_message?.created_at || room.updated_at || room.created_at)}</em>
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : chatListMode === "direct" ? (
            <EmptyState title="1대1 톡방이 없습니다." description="채팅방 멤버 프로필에서 1:1 톡을 시작해보세요." />
          ) : (
            <EmptyState title="참여 중인 채팅방이 없습니다." description="승인된 모임이나 직접 만든 모임의 채팅방이 여기에 표시됩니다." actionLabel="모임 찾기" actionTo="/meetings" />
          )}
        </aside>
        <section className="page-card talk-room talk-room-empty">
          <div className="talk-empty-apple">
            <img src="/img/test3.png" alt="Sportsmate 로고" />
            <p>채팅방을 선택하면 대화가 열립니다.</p>
          </div>
        </section>
      </div>
    </section>
  );
}

export default DesktopChatList;
