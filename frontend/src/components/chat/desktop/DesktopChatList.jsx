import { Link } from "react-router-dom";
import { Bell, BellOff, ChevronDown, ChevronUp, LogOut, MessageCircle, Pin, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { chatApi } from "../../../api/chatApi";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { useAsync } from "../../../hooks/useAsync";
import { isMeetingLifecycleEnded } from "../../../utils/meetingLifecycle.js";

function formatChatTime(value) {
  if (!value) return "방금";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function meetingOperationEndTime(meeting) {
  const explicitEnd = new Date(meeting?.end_at || "");
  if (Number.isFinite(explicitEnd.getTime())) return explicitEnd.getTime();
  if (meeting?.meeting_type !== "one_time" || !meeting?.start_at) return null;
  const fallbackEnd = new Date(meeting.start_at);
  if (!Number.isFinite(fallbackEnd.getTime())) return null;
  fallbackEnd.setHours(23, 59, 59, 999);
  return fallbackEnd.getTime();
}

function isReadOnlyRoom(room) {
  if (typeof room?.is_read_only === "boolean") return room.is_read_only;
  if (typeof room?.meeting?.is_chat_read_only === "boolean") return room.meeting.is_chat_read_only;
  const meeting = room?.meeting || {};
  return isMeetingLifecycleEnded(meeting);
}

function roomActivityTime(room) {
  return new Date(room.last_message?.created_at || room.updated_at || room.created_at || 0).getTime();
}

function DesktopChatList() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [chatListMode, setChatListMode] = useState("meeting");
  const [closedRoomsExpanded, setClosedRoomsExpanded] = useState(false);
  const [pinnedRooms, setPinnedRooms] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sportsmate_pinned_rooms")) || [];
    } catch {
      return [];
    }
  });
  const [mutedRooms, setMutedRooms] = useState([]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveTargetRoom, setLeaveTargetRoom] = useState(null);
  const [leavingRoom, setLeavingRoom] = useState(false);

  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const directRooms = useAsync(() => chatApi.directRooms(), [directRefreshKey]);
  const rawMeetingItems = rooms.data?.items || [];
  const rawDirectItems = directRooms.data?.items || [];
  const items = useMemo(() => [...rawMeetingItems].sort((a, b) => {
    const pinDifference =
      Number(pinnedRooms.includes(`meeting-${b.id}`))
      - Number(pinnedRooms.includes(`meeting-${a.id}`));
    return pinDifference || roomActivityTime(b) - roomActivityTime(a);
  }), [rawMeetingItems, pinnedRooms]);
  const directItems = useMemo(() => [...rawDirectItems].sort((a, b) => {
    const pinDifference =
      Number(pinnedRooms.includes(`direct-${b.id}`))
      - Number(pinnedRooms.includes(`direct-${a.id}`));
    return pinDifference || roomActivityTime(b) - roomActivityTime(a);
  }), [rawDirectItems, pinnedRooms]);
  const activeMeetingItems = items.filter((room) => !isReadOnlyRoom(room));
  const closedMeetingItems = items.filter((room) => isReadOnlyRoom(room));

  useEffect(() => {
    chatApi.mutedRooms()
      .then((res) => setMutedRooms(res.muted_rooms || []))
      .catch((err) => console.error("Failed to load muted rooms", err));
  }, []);

  const togglePin = (roomId, roomType) => {
    const pinKey = `${roomType}-${roomId}`;
    setPinnedRooms((current) => {
      const next = current.includes(pinKey)
        ? current.filter((key) => key !== pinKey)
        : [...current, pinKey];
      localStorage.setItem("sportsmate_pinned_rooms", JSON.stringify(next));
      return next;
    });
  };

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
    const refreshVisibleRooms = () => {
      if (document.hidden) return;
      setRefreshKey((value) => value + 1);
      setDirectRefreshKey((value) => value + 1);
    };
    const timer = window.setInterval(() => {
      refreshVisibleRooms();
    }, realtimeConnected ? 30000 : 5000);
    const handleVisibilityChange = () => {
      if (!document.hidden) refreshVisibleRooms();
    };
    window.addEventListener("focus", refreshVisibleRooms);
    window.addEventListener("online", refreshVisibleRooms);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisibleRooms);
      window.removeEventListener("online", refreshVisibleRooms);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [realtimeConnected]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setRealtimeConnected(false);
      return undefined;
    }

    setRealtimeConnected(false);
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
      .subscribe((status) => {
        setRealtimeConnected(status === "SUBSCRIBED");
      });

    return () => {
      setRealtimeConnected(false);
      supabase.removeChannel(channel);
    };
  }, []);

  const renderMeetingRoom = (room) => {
    const meeting = room.meeting || {};
    const isMuted = mutedRooms.some((item) => String(item.room_id) === String(room.id) && item.room_type === "meeting");
    const readOnly = isReadOnlyRoom(room);
    const isPinned = pinnedRooms.includes(`meeting-${room.id}`);
    return (
      <div key={room.id} className={`proto-talk-room-item ${readOnly ? "is-read-only" : ""} ${isPinned ? "is-pinned" : ""}`}>
        <Link to={`/chats/${room.id}`}>
          {meeting.cover_image_url ? <img src={meeting.cover_image_url} alt="" /> : <div className="talk-room-fallback"><MessageCircle size={20} /></div>}
          <span>
            <b>{meeting.title || "모임 채팅방"}</b>
            <small>{meeting.location_name || "장소 미정"} · {meeting.current_participants || 0}/{meeting.max_participants || 0}명</small>
            {readOnly ? <small className="talk-room-ended-label">활동 종료</small> : null}
          </span>
          <em>
            {isPinned ? <Pin className="talk-room-pin-indicator" size={11} fill="currentColor" /> : null}
            {isMuted ? <BellOff size={11} /> : null}
            {formatChatTime(room.last_message?.created_at)}
          </em>
          {Number(room.unread_count || 0) > 0 ? <i>{room.unread_count}</i> : null}
        </Link>
        <div className="talk-room-item-hover-actions">
          <button
            className={`talk-room-pin-btn ${isPinned ? "is-pinned" : ""}`}
            type="button"
            onClick={() => togglePin(room.id, "meeting")}
            aria-label={isPinned ? "고정 해제" : "상단 고정"}
            title={isPinned ? "고정 해제" : "상단 고정"}
          >
            <Pin size={13} fill={isPinned ? "currentColor" : "none"} />
          </button>
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
  };

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
            <div className="talk-list-items desktop-chat-room-groups">
              <section className="desktop-chat-room-group" aria-labelledby="active-meeting-chats">
                <div className="desktop-chat-room-group__head">
                  <strong id="active-meeting-chats">활동 중인 모임 채팅방</strong>
                  <span>{activeMeetingItems.length}</span>
                </div>
                {activeMeetingItems.length
                  ? activeMeetingItems.map(renderMeetingRoom)
                  : <p className="desktop-chat-room-group__empty">활동 중인 모임 채팅방이 없습니다.</p>}
              </section>
              {closedMeetingItems.length ? (
                <section className="desktop-chat-room-group desktop-chat-room-group--closed" aria-labelledby="closed-meeting-chats">
                  <button
                    className="desktop-chat-room-group__toggle"
                    type="button"
                    onClick={() => setClosedRoomsExpanded((expanded) => !expanded)}
                    aria-expanded={closedRoomsExpanded}
                  >
                    <span>
                      <strong id="closed-meeting-chats">활동 종료된 모임 채팅방</strong>
                      <em>{closedMeetingItems.length}</em>
                    </span>
                    {closedRoomsExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                  {closedRoomsExpanded ? (
                    <div className="desktop-chat-room-group__closed-items">
                      {closedMeetingItems.map(renderMeetingRoom)}
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : chatListMode === "direct" && directItems.length ? (
            <div className="talk-list-items">
              {directItems.map((room) => {
                const otherUser = room.other_user || {};
                const isMuted = mutedRooms.some(r => String(r.room_id) === String(room.id) && r.room_type === "direct");
                const isPinned = pinnedRooms.includes(`direct-${room.id}`);
                return (
                  <div key={room.id} className={`proto-talk-room-item ${isPinned ? "is-pinned" : ""}`}>
                    <Link to={`/chats/direct/${room.id}`}>
                      {otherUser.profile_image_url ? <img src={otherUser.profile_image_url} alt="" /> : <div className="talk-room-fallback"><UsersRound size={20} /></div>}
                      <span>
                        <b>{otherUser.nickname || otherUser.name || "참여자"}</b>
                        <small>{room.last_message?.content || "아직 대화가 없습니다."}</small>
                      </span>
                      <em>
                        {isPinned ? <Pin className="talk-room-pin-indicator" size={11} fill="currentColor" /> : null}
                        {isMuted ? <BellOff size={11} /> : null}
                        {formatChatTime(room.last_message?.created_at || room.updated_at || room.created_at)}
                      </em>
                    </Link>
                    <div className="talk-room-item-hover-actions">
                      <button
                        className={`talk-room-pin-btn ${isPinned ? "is-pinned" : ""}`}
                        type="button"
                        onClick={() => togglePin(room.id, "direct")}
                        aria-label={isPinned ? "고정 해제" : "상단 고정"}
                        title={isPinned ? "고정 해제" : "상단 고정"}
                      >
                        <Pin size={13} fill={isPinned ? "currentColor" : "none"} />
                      </button>
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
