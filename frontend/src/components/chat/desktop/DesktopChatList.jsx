import { Link } from "react-router-dom";
import { LogOut, MessageCircle, UsersRound, Bell, BellOff } from "lucide-react";
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

function isReadOnlyRoom(room) {
  if (room?.is_read_only || room?.meeting?.is_chat_read_only) return true;
  const meeting = room?.meeting || {};
  if (["closed", "cancelled", "suspended"].includes(String(meeting.status || ""))) return true;
  const labelText = `${room?.chat_status_label || ""} ${meeting.chat_status_label || ""} ${meeting.status_label || ""}`;
  if (/마감|종료|취소|폐쇄/.test(labelText)) return true;
  const endValue = meeting.end_at || meeting.start_at;
  if (!endValue) return false;
  const endTime = new Date(endValue).getTime();
  return Number.isFinite(endTime) && endTime <= Date.now();
}

function DesktopChatList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [chatListMode, setChatListMode] = useState("meeting");
  const [mutedRooms, setMutedRooms] = useState([]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveTargetRoom, setLeaveTargetRoom] = useState(null);
  const [leavingRoom, setLeavingRoom] = useState(false);

  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const directRooms = useAsync(() => chatApi.directRooms(), [directRefreshKey]);
  const items = rooms.data?.items || [];
  const directItems = directRooms.data?.items || [];

  useEffect(() => {
    chatApi.mutedRooms()
      .then((res) => setMutedRooms(res.muted_rooms || []))
      .catch((err) => console.error("Failed to load muted rooms", err));
  }, []);

  const toggleMute = async (roomId, roomType) => {
    const isCurrentlyMuted = mutedRooms.some(r => String(r.room_id) === String(roomId) && r.room_type === roomType);
    try {
      if (isCurrentlyMuted) {
        await chatApi.unmute(roomId, roomType);
      } else {
        await chatApi.mute(roomId, roomType);
      }
      const res = await chatApi.mutedRooms();
      setMutedRooms(res.muted_rooms || []);
    } catch (err) {
      console.error("Failed to toggle mute", err);
    }
  };

  const leaveRoom = async () => {
    const targetRoomId = leaveTargetRoom?.id;
    if (!targetRoomId || leavingRoom) return;
    setLeavingRoom(true);
    try {
      await chatApi.leave(targetRoomId);
      setLeaveConfirmOpen(false);
      setLeaveTargetRoom(null);
      setRefreshKey((value) => value + 1);
    } catch (leaveError) {
      window.alert(leaveError.response?.data?.message || "채팅방 나가기에 실패했습니다.");
      setLeaveConfirmOpen(false);
    } finally {
      setLeavingRoom(false);
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
              모임 채팅
            </button>
            <button className={chatListMode === "direct" ? "is-active" : ""} type="button" onClick={() => setChatListMode("direct")}>
              1:1 채팅
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
                const isMuted = mutedRooms.some(r => String(r.room_id) === String(room.id) && r.room_type === "meeting");
                const readOnly = isReadOnlyRoom(room);
                return (
                  <div key={room.id} className={`proto-talk-room-item ${readOnly ? "is-read-only" : ""}`}>
                    <Link to={`/chats/${room.id}`}>
                      {meeting.cover_image_url ? <img src={meeting.cover_image_url} alt="" /> : <div className="talk-room-fallback"><MessageCircle size={20} /></div>}
                      <span>
                        <b>{meeting.title || "모임 채팅방"}</b>
                        <small>{meeting.location_name || "장소 미정"} · {meeting.current_participants || 0}/{meeting.max_participants || 0}명</small>
                        {readOnly ? <small className="talk-room-ended-label">마감된 모임</small> : null}
                      </span>
                      <em>
                        {isMuted ? <BellOff size={11} style={{ marginRight: '3px', color: '#94a3b8', verticalAlign: 'middle' }} /> : null}
                        {formatChatTime(room.last_message?.created_at)}
                      </em>
                      {Number(room.unread_count || 0) > 0 ? <i>{room.unread_count}</i> : null}
                    </Link>
                    <div className="talk-room-item-hover-actions">
                      <button
                        className={`talk-room-mute-btn ${isMuted ? "muted" : ""}`}
                        type="button"
                        onClick={() => toggleMute(room.id, "meeting")}
                        title={isMuted ? "알림 켜기" : "알림 끄기"}
                      >
                        {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                      </button>
                      <button
                        className="talk-room-leave-btn-new"
                        type="button"
                        onClick={() => {
                          setLeaveTargetRoom(room);
                          setLeaveConfirmOpen(true);
                        }}
                        aria-label="채팅방 나가기"
                        title="채팅방 나가기"
                      >
                        <LogOut size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : chatListMode === "direct" && directItems.length ? (
            <div className="talk-list-items">
              {directItems.map((room) => {
                const otherUser = room.other_user || {};
                const isMuted = mutedRooms.some(r => String(r.room_id) === String(room.id) && r.room_type === "direct");
                return (
                  <div key={room.id} className="proto-talk-room-item">
                    <Link to={`/chats/direct/${room.id}`}>
                      {otherUser.profile_image_url ? <img src={otherUser.profile_image_url} alt="" /> : <div className="talk-room-fallback"><UsersRound size={20} /></div>}
                      <span>
                        <b>{otherUser.nickname || otherUser.name || "참여자"}</b>
                        <small>{room.last_message?.content || "아직 대화가 없습니다."}</small>
                      </span>
                      <em>
                        {isMuted ? <BellOff size={11} style={{ marginRight: '3px', color: '#94a3b8', verticalAlign: 'middle' }} /> : null}
                        {formatChatTime(room.last_message?.created_at || room.updated_at || room.created_at)}
                      </em>
                    </Link>
                    <div className="talk-room-item-hover-actions">
                      <button
                        className={`talk-room-mute-btn ${isMuted ? "muted" : ""}`}
                        type="button"
                        onClick={() => toggleMute(room.id, "direct")}
                        title={isMuted ? "알림 켜기" : "알림 끄기"}
                      >
                        {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                      </button>
                    </div>
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

      {leaveConfirmOpen ? (
        <div className="chat-vote-confirm" role="dialog" aria-modal="true" aria-label="채팅방 나가기">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setLeaveConfirmOpen(false)} aria-label="닫기" />
          <section>
            <strong>채팅방을 나갈까요?</strong>
            <p>{leaveTargetRoom?.meeting?.title || "이 채팅방"}에서 나가면 모임 참여도 함께 취소됩니다.</p>
            <div className="chat-vote-confirm__actions">
              <button type="button" onClick={() => setLeaveConfirmOpen(false)}>취소</button>
              <button type="button" className="is-danger" onClick={leaveRoom} disabled={leavingRoom}>
                {leavingRoom ? "나가는 중" : "나가기"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default DesktopChatList;
