import { Link } from "react-router-dom";
import { MapPin, UsersRound, MessageCircle, Users, Pin, ChevronUp, ChevronDown, LogOut, Bell, BellOff } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import Badge from "../../common/Badge.jsx";
import { chatApi } from "../../../api/chatApi";
import { useAsync } from "../../../hooks/useAsync";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { getMeetingCoverImage, isUsingSportThumbnail, getSportIconUrl, getMeetingCustomCoverImage, getSportNameFromMeeting } from "../../../utils/sportThumbnails";
import { isMeetingLifecycleEnded } from "../../../utils/meetingLifecycle.js";

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
  const { user } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [chatTab, setChatTab] = useState("meeting");
  const [meetingFilter, setMeetingFilter] = useState("all");
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [pinnedRooms, setPinnedRooms] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("sportsmate_pinned_rooms")) || [];
    } catch {
      return [];
    }
  });

  const [hideClosedChats, setHideClosedChats] = useState(false);
  const [isClosedChatsExpanded, setIsClosedChatsExpanded] = useState(false);
  const [mutedRooms, setMutedRooms] = useState([]);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveTargetRoom, setLeaveTargetRoom] = useState(null);
  const [leavingRoom, setLeavingRoom] = useState(false);

  useEffect(() => {
    chatApi.mutedRooms()
      .then((res) => setMutedRooms(res.muted_rooms || []))
      .catch((err) => console.error("Failed to load muted rooms", err));
  }, []);

  const handleImgError = (id) =>
    setImgErrors((prev) => ({ ...prev, [id]: true }));

  const togglePin = (e, roomId) => {
    e.preventDefault();
    e.stopPropagation();
    const pinKey = `${chatTab}-${roomId}`;
    setPinnedRooms((prev) => {
      const next = prev.includes(pinKey)
        ? prev.filter((k) => k !== pinKey)
        : [...prev, pinKey];
      localStorage.setItem("sportsmate_pinned_rooms", JSON.stringify(next));
      return next;
    });
  };

  const toggleMute = async (e, roomId, roomType) => {
    e.preventDefault();
    e.stopPropagation();
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

  const rooms = useAsync(() => chatApi.rooms(), [refreshKey]);
  const directRooms = useAsync(() => chatApi.directRooms(), [directRefreshKey]);

  const rawMeetingItems = rooms.data?.items || [];
  const rawDirectItems = directRooms.data?.items || [];

  // Pinned & 최신 메시지 순 정렬 적용
  const sortedMeetingItems = useMemo(() => {
    return [...rawMeetingItems].sort((a, b) => {
      const pinA = pinnedRooms.includes(`meeting-${a.id}`) ? 1 : 0;
      const pinB = pinnedRooms.includes(`meeting-${b.id}`) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;

      const timeA = new Date(a.last_message?.created_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.last_message?.created_at || b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  }, [rawMeetingItems, pinnedRooms]);

  const sortedDirectItems = useMemo(() => {
    return [...rawDirectItems].sort((a, b) => {
      const pinA = pinnedRooms.includes(`direct-${a.id}`) ? 1 : 0;
      const pinB = pinnedRooms.includes(`direct-${b.id}`) ? 1 : 0;
      if (pinA !== pinB) return pinB - pinA;

      const timeA = new Date(a.last_message?.created_at || a.updated_at || a.created_at).getTime();
      const timeB = new Date(b.last_message?.created_at || b.updated_at || b.created_at).getTime();
      return timeB - timeA;
    });
  }, [rawDirectItems, pinnedRooms]);

  const totalMeetingUnread = sortedMeetingItems.reduce((acc, room) => acc + (room.unread_count || 0), 0);
  const totalDirectUnread = sortedDirectItems.reduce((acc, room) => acc + (room.unread_count || 0), 0);

  const filteredMeetingItems = useMemo(() => {
    return sortedMeetingItems.filter((room) => {
      const isHost = String(room.meeting?.host?.id || room.meeting?.host_id) === String(user?.id);
      if (meetingFilter === "host") return isHost;
      if (meetingFilter === "guest") return !isHost;
      return true;
    });
  }, [sortedMeetingItems, meetingFilter, user]);

  const isMeetingClosed = (room) => {
    if (!room?.meeting) return true;
    if (typeof room.is_read_only === "boolean") return room.is_read_only;
    if (typeof room.meeting.is_chat_read_only === "boolean") return room.meeting.is_chat_read_only;
    return isMeetingLifecycleEnded(room.meeting);
  };

  const activeMeetingItems = filteredMeetingItems.filter((room) => !isMeetingClosed(room));
  const closedMeetingItems = filteredMeetingItems.filter((room) => isMeetingClosed(room));

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
          {totalMeetingUnread > 0 && (
            <em className="mobile-chat-tab__badge">{totalMeetingUnread}</em>
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
          {totalDirectUnread > 0 && (
            <em className="mobile-chat-tab__badge">{totalDirectUnread}</em>
          )}
        </button>
      </div>

      {/* 모임 채팅 탭일 때의 서브 필터 */}
      {chatTab === "meeting" && sortedMeetingItems.length > 0 && (
        <div className="mobile-chat-subfilters" style={{ display: 'flex', gap: '8px', padding: '8px 16px 12px', background: 'transparent', overflowX: 'auto' }}>
          {[
            { id: "all", label: `전체 (${sortedMeetingItems.length})` },
            { id: "host", label: `내가 방장 (${sortedMeetingItems.filter(r => String(r.meeting?.host?.id || r.meeting?.host_id) === String(user?.id)).length})` },
            { id: "guest", label: `참여중 (${sortedMeetingItems.filter(r => String(r.meeting?.host?.id || r.meeting?.host_id) !== String(user?.id)).length})` }
          ].map((filter) => {
            const isActive = meetingFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setMeetingFilter(filter.id)}
                style={{
                  padding: '5px 12px',
                  borderRadius: '20px',
                  border: '1px solid',
                  borderColor: isActive ? 'var(--mobile-primary)' : '#e2e8f0',
                  background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'rgba(255, 255, 255, 0.5)',
                  color: isActive ? 'var(--mobile-primary)' : '#64748b',
                  fontSize: '11px',
                  fontWeight: '800',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {filter.label}
              </button>
            );
          })}
          <label style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={hideClosedChats} onChange={(e) => setHideClosedChats(e.target.checked)} />
            마감 숨기기
          </label>
        </div>
      )}

      {/* 콘텐츠 영역 */}
      {currentLoading ? (
        <LoadingCards />
      ) : chatTab === "meeting" ? (
        (activeMeetingItems.length || (!hideClosedChats && closedMeetingItems.length)) ? (
          <div className="chat-list chat-list--rooms">
            {activeMeetingItems.map((room) => {
              const meeting = room.meeting || {};
              const isHost = String(meeting.host?.id || meeting.host_id) === String(user?.id);
              const coverImage = getMeetingCoverImage(meeting);
              const isSportThumb = isUsingSportThumbnail(meeting);
              const sportIconUrl = getSportIconUrl(getSportNameFromMeeting(meeting));
              const isPinned = pinnedRooms.includes(`meeting-${room.id}`);
              const isMuted = mutedRooms.some(r => String(r.room_id) === String(room.id) && r.room_type === "meeting");
              return (
                <Link
                  key={room.id}
                  to={`/chats/${room.id}`}
                  className="chat-room-card"
                  style={isPinned ? { backgroundColor: 'rgba(79, 70, 229, 0.04)' } : undefined}
                >
                  <div
                    className={`chat-room-card__thumb ${isSportThumb ? "is-sport-thumbnail" : ""}`}
                    style={
                      coverImage
                        ? { backgroundImage: `url(${coverImage})`, backgroundPosition: 'center', backgroundSize: 'cover' }
                        : { background: 'rgba(79, 70, 229, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                    }
                  >
                    {!coverImage && (
                      <span>{meeting.sport?.name || "운동"}</span>
                    )}
                  </div>
                  <div className="chat-room-card__content">
                    <div className="chat-room-card__topline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden' }}>
                        <Badge tone={isHost ? "warning" : "sky"} style={{ flexShrink: 0, fontSize: '10px', padding: '2px 5px' }}>
                          {isHost ? "방장" : "참여"}
                        </Badge>
                        {sportIconUrl && (
                          <img
                            src={sportIconUrl}
                            alt=""
                            style={{ width: '16px', height: '16px', flexShrink: 0, objectFit: 'contain' }}
                          />
                        )}
                        <strong style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{meeting.title}</strong>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                        <button
                          type="button"
                          onClick={(e) => togglePin(e, room.id)}
                          style={{
                            background: 'none',
                            border: 0,
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isPinned ? 'var(--mobile-primary, #4f46e5)' : '#cbd5e1',
                            transition: 'all 0.2s',
                            zIndex: 2
                          }}
                          aria-label={isPinned ? "고정 해제" : "상단 고정"}
                        >
                          <Pin size={13} fill={isPinned ? "var(--mobile-primary, #4f46e5)" : "none"} style={{ transform: 'rotate(45deg)' }} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => toggleMute(e, room.id, "meeting")}
                          style={{
                            background: 'none',
                            border: 0,
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: isMuted ? '#94a3b8' : '#cbd5e1',
                            transition: 'all 0.2s',
                            zIndex: 2
                          }}
                          aria-label={isMuted ? "알림 켜기" : "알림 끄기"}
                        >
                          {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setLeaveTargetRoom(room);
                            setLeaveConfirmOpen(true);
                          }}
                          style={{
                            background: 'none',
                            border: 0,
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#cbd5e1',
                            transition: 'all 0.2s',
                            zIndex: 2
                          }}
                          aria-label="채팅방 나가기"
                        >
                          <LogOut size={13} />
                        </button>
                        <time style={{ flexShrink: 0 }}>{formatChatTime(room.last_message?.created_at)}</time>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', paddingLeft: '6px' }}>
                      {room.last_message ? (
                        <>
                          <span style={{ fontSize: '11px', fontWeight: '800', color: 'var(--mobile-primary, #4f46e5)' }}>
                            {room.last_message.sender?.nickname || room.last_message.sender_nickname || "알 수 없음"}
                          </span>
                          <p style={{ margin: 0, fontSize: '13px', color: '#334155', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                            {room.last_message.content}
                          </p>
                        </>
                      ) : (
                        <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                          아직 메시지가 없습니다.
                        </p>
                      )}
                    </div>
                    <div className="chat-room-card__meta" style={{ paddingLeft: '6px' }}>
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
            
            {!hideClosedChats && closedMeetingItems.length > 0 && (
              <section className={`mobile-my-calendar ${isClosedChatsExpanded ? "is-expanded" : ""}`} style={{ marginTop: '16px', borderTop: '8px solid #f1f5f9' }}>
                <header 
                  className="mobile-my-calendar__head"
                  onClick={() => setIsClosedChatsExpanded(!isClosedChatsExpanded)} 
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                >
                  <div>
                    <h2>활동 종료된 모임 채팅방</h2>
                  </div>
                  <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
                    <ChevronDown size={20} style={{ transform: isClosedChatsExpanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.3s ease-in-out' }} />
                  </div>
                </header>
                <div 
                  style={{
                    display: 'grid',
                    gridTemplateRows: isClosedChatsExpanded ? '1fr' : '0fr',
                    transition: 'grid-template-rows 0.3s ease-in-out'
                  }}
                >
                  <div style={{ overflow: 'hidden' }}>
                    <div className="mobile-my-calendar__body is-expanded" style={{ paddingBottom: '16px' }}>
                    {closedMeetingItems.map((room) => {
                  const meeting = room.meeting || {};
                  const isHost = String(meeting.host?.id || meeting.host_id) === String(user?.id);
                  const coverImage = getMeetingCoverImage(meeting);
                  const isSportThumb = isUsingSportThumbnail(meeting);
                  const sportIconUrl = getSportIconUrl(getSportNameFromMeeting(meeting));
                  const isPinned = pinnedRooms.includes(`meeting-${room.id}`);
                  const isMuted = mutedRooms.some(r => String(r.room_id) === String(room.id) && r.room_type === "meeting");
                  return (
                    <Link
                      key={room.id}
                      to={`/chats/${room.id}`}
                      className="chat-room-card"
                      style={isPinned ? { backgroundColor: 'rgba(79, 70, 229, 0.04)', opacity: 0.7 } : { opacity: 0.7, position: 'relative' }}
                    >
                      {/* 가림막 (Overlay) */}
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(255, 255, 255, 0.5)',
                        zIndex: 1,
                        pointerEvents: 'none'
                      }}></div>
                      
                      <div
                        className={`chat-room-card__thumb ${isSportThumb ? "is-sport-thumbnail" : ""}`}
                        style={
                          coverImage
                            ? { backgroundImage: `url(${coverImage})`, backgroundPosition: 'center', backgroundSize: 'cover', filter: 'grayscale(80%)' }
                            : { background: 'rgba(148, 163, 184, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                        }
                      >
                        {/* 썸네일 내부 마감 뱃지 */}
                        <div style={{
                          position: 'absolute',
                          top: 0, left: 0, width: '100%', height: '100%',
                          backgroundColor: 'rgba(0,0,0,0.4)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#fff',
                          fontSize: '12px',
                          fontWeight: '800',
                          letterSpacing: '1px'
                        }}>
                          마감
                        </div>
                        {!coverImage && (
                          <span>{meeting.sport?.name || "운동"}</span>
                        )}
                      </div>
                      <div className="chat-room-card__content">
                        <div className="chat-room-card__topline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '2px', overflow: 'hidden' }}>
                            <Badge tone="gray" style={{ flexShrink: 0, fontSize: '10px', padding: '2px 5px' }}>
                              종료
                            </Badge>
                            {sportIconUrl && (
                              <img
                                src={sportIconUrl}
                                alt=""
                                style={{ width: '16px', height: '16px', flexShrink: 0, objectFit: 'contain', filter: 'grayscale(100%) opacity(0.7)' }}
                              />
                            )}
                            <strong style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', color: '#64748b' }}>{meeting.title}</strong>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={(e) => togglePin(e, room.id)}
                              style={{
                                background: 'none',
                                border: 0,
                                padding: '2px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isPinned ? '#94a3b8' : '#cbd5e1',
                                transition: 'all 0.2s',
                                zIndex: 2
                              }}
                              aria-label={isPinned ? "고정 해제" : "상단 고정"}
                            >
                              <Pin size={13} fill={isPinned ? "#94a3b8" : "none"} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => toggleMute(e, room.id, "meeting")}
                              style={{
                                background: 'none',
                                border: 0,
                                padding: '2px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: isMuted ? '#94a3b8' : '#cbd5e1',
                                transition: 'all 0.2s',
                                zIndex: 2
                              }}
                              aria-label={isMuted ? "알림 켜기" : "알림 끄기"}
                            >
                              {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLeaveTargetRoom(room);
                                setLeaveConfirmOpen(true);
                              }}
                              style={{
                                background: 'none',
                                border: 0,
                                padding: '2px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#cbd5e1',
                                transition: 'all 0.2s',
                                zIndex: 2
                              }}
                              aria-label="채팅방 나가기"
                            >
                              <LogOut size={13} />
                            </button>
                            <time style={{ flexShrink: 0, color: '#94a3b8' }}>{formatChatTime(room.last_message?.created_at)}</time>
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px', paddingLeft: '6px' }}>
                          {room.last_message ? (
                            <>
                              <span style={{ fontSize: '11px', fontWeight: '800', color: '#64748b' }}>
                                {room.last_message.sender?.nickname || room.last_message.sender_nickname || "알 수 없음"}
                              </span>
                              <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {room.last_message.content}
                              </p>
                            </>
                          ) : (
                            <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                              아직 메시지가 없습니다.
                            </p>
                          )}
                        </div>
                      </div>
                      {room.unread_count > 0 && <em style={{ background: '#94a3b8' }}>{room.unread_count}</em>}
                    </Link>
                  );
                })}
                    </div>
                  </div>
                </div>
              </section>
            )}
          </div>
        ) : (
          <EmptyState
            title={
              meetingFilter === "host"
                ? "내가 방장인 채팅방이 없습니다."
                : meetingFilter === "guest"
                ? "내가 일반 참여자인 채팅방이 없습니다."
                : "참여 중인 채팅방이 없습니다."
            }
            description={
              meetingFilter === "host"
                ? "내가 개설한 모임의 채팅방이 여기에 표시됩니다."
                : meetingFilter === "guest"
                ? "참여 승인되어 들어간 모임의 채팅방이 여기에 표시됩니다."
                : "승인된 모임의 채팅방이 여기에 표시됩니다."
            }
            actionLabel="모임 찾기"
            actionTo="/meetings"
          />
        )
      ) : sortedDirectItems.length ? (
        <div className="chat-list chat-list--direct">
          {sortedDirectItems.map((room) => {
            const other = room.other_user || {};
            const isPinned = pinnedRooms.includes(`direct-${room.id}`);
            const isMuted = mutedRooms.some(r => String(r.room_id) === String(room.id) && r.room_type === "direct");
            return (
              <Link
                key={room.id}
                to={`/chats/direct/${room.id}`}
                className="chat-room-card chat-room-card--direct"
                style={isPinned ? { backgroundColor: 'rgba(79, 70, 229, 0.04)' } : undefined}
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
                  <div className="chat-room-card__topline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <strong>{other.nickname || other.name || "참여자"}</strong>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                      <button
                        type="button"
                        onClick={(e) => togglePin(e, room.id)}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isPinned ? 'var(--mobile-primary, #4f46e5)' : '#cbd5e1',
                          transition: 'all 0.2s',
                          zIndex: 2
                        }}
                        aria-label={isPinned ? "고정 해제" : "상단 고정"}
                      >
                        <Pin size={13} fill={isPinned ? "var(--mobile-primary, #4f46e5)" : "none"} style={{ transform: 'rotate(45deg)' }} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => toggleMute(e, room.id, "direct")}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isMuted ? '#94a3b8' : '#cbd5e1',
                          transition: 'all 0.2s',
                          zIndex: 2
                        }}
                        aria-label={isMuted ? "알림 켜기" : "알림 끄기"}
                      >
                        {isMuted ? <BellOff size={13} /> : <Bell size={13} />}
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setLeaveTargetRoom(room);
                          setLeaveConfirmOpen(true);
                        }}
                        style={{
                          background: 'none',
                          border: 0,
                          padding: '2px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#cbd5e1',
                          transition: 'all 0.2s',
                          zIndex: 2
                        }}
                        aria-label="채팅방 나가기"
                      >
                        <LogOut size={13} />
                      </button>
                      <time>
                        {formatChatTime(
                          room.last_message?.created_at || room.updated_at || room.created_at
                        )}
                      </time>
                    </div>
                  </div>
                  <p>{room.last_message?.content || "아직 대화가 없습니다."}</p>
                </div>
                {room.unread_count > 0 && <em>{room.unread_count}</em>}
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

      {leaveConfirmOpen && (
        <div role="dialog" aria-modal="true" aria-label="채팅방 나가기" style={{
          position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <button type="button" onClick={() => setLeaveConfirmOpen(false)} aria-label="닫기" style={{
            position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', border: 'none', cursor: 'pointer', width: '100%', height: '100%'
          }} />
          <section style={{
            position: 'relative', background: '#fff', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '320px', zIndex: 10
          }}>
            <strong style={{ display: 'block', fontSize: '18px', fontWeight: 'bold', marginBottom: '8px', color: '#0f172a' }}>채팅방을 나갈까요?</strong>
            <p style={{ fontSize: '14px', color: '#64748b', lineHeight: 1.5, marginBottom: '24px' }}>
              <strong style={{ color: '#0f172a' }}>{leaveTargetRoom?.meeting?.title || "이 채팅방"}</strong>에서 나가면 모임 참여도 함께 취소됩니다.
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setLeaveConfirmOpen(false)} style={{
                flex: 1, padding: '12px', background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
              }}>취소</button>
              <button type="button" onClick={leaveRoom} disabled={leavingRoom} style={{
                flex: 1, padding: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', opacity: leavingRoom ? 0.7 : 1
              }}>
                {leavingRoom ? "나가는 중" : "나가기"}
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

export default MobileChatList;
