import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
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
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const items = rooms.data?.items || [];

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || realtimeConnected) return;
      setRefreshKey((value) => value + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [realtimeConnected]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setRealtimeConnected(false);
      return undefined;
    }

    const channel = supabase
      .channel("desktop-chat-list")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages"
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
            <h2>참여중인 채팅방</h2>
            <span>{items.length}</span>
          </div>
          {rooms.loading && !rooms.data ? (
            <LoadingCards count={4} />
          ) : rooms.error ? (
            <EmptyState title="채팅 목록을 불러오지 못했습니다." description="잠시 후 다시 시도해주세요." />
          ) : items.length ? (
            <div className="talk-list-items">
              {items.map((room) => {
                const meeting = room.meeting || {};
                return (
                  <Link key={room.id} to={`/chats/${room.id}`} className="proto-talk-room-item">
                    {meeting.cover_image_url ? <img src={meeting.cover_image_url} alt="" /> : <div className="talk-room-fallback"><MessageCircle size={20} /></div>}
                    <span>
                      <b>{meeting.title || "모임 채팅방"}</b>
                      <small>{meeting.location_name || "장소 미정"} · {meeting.current_participants || 0}/{meeting.max_participants || 0}명</small>
                    </span>
                    <em>{formatChatTime(room.last_message?.created_at)}</em>
                  </Link>
                );
              })}
            </div>
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
