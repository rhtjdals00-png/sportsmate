import { Link } from "react-router-dom";
import { MapPin, UsersRound, MessageCircle, Users, Pin } from "lucide-react";
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
        </div>
      )}

      {/* 콘텐츠 영역 */}
      {currentLoading ? (
        <LoadingCards />
      ) : chatTab === "meeting" ? (
        filteredMeetingItems.length ? (
          <div className="chat-list chat-list--rooms">
            {filteredMeetingItems.map((room) => {
              const meeting = room.meeting || {};
              const isHost = String(meeting.host?.id || meeting.host_id) === String(user?.id);
              const customCover = getMeetingCustomCoverImage(meeting);
              const sportIconUrl = getSportIconUrl(getSportNameFromMeeting(meeting));
              const isPinned = pinnedRooms.includes(`meeting-${room.id}`);
              return (
                <Link
                  key={room.id}
                  to={`/chats/${room.id}`}
                  className="chat-room-card"
                  style={isPinned ? { backgroundColor: 'rgba(79, 70, 229, 0.04)' } : undefined}
                >
                  <div
                    className="chat-room-card__thumb"
                    style={
                      customCover
                        ? { backgroundImage: `url(${customCover})`, backgroundPosition: 'center', backgroundSize: 'cover' }
                        : { background: 'rgba(79, 70, 229, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }
                    }
                  >
                    {!customCover && sportIconUrl ? (
                      <img
                        src={sportIconUrl}
                        alt={meeting.sport?.name || "운동"}
                        style={{ width: '28px', height: '28px', objectFit: 'contain' }}
                      />
                    ) : !customCover ? (
                      <span>{meeting.sport?.name || "운동"}</span>
                    ) : null}
                  </div>
                  <div className="chat-room-card__content">
                    <div className="chat-room-card__topline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
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
                            transition: 'all 0.2s'
                          }}
                          aria-label={isPinned ? "고정 해제" : "상단 고정"}
                        >
                          <Pin size={13} fill={isPinned ? "var(--mobile-primary, #4f46e5)" : "none"} style={{ transform: 'rotate(45deg)' }} />
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
                          transition: 'all 0.2s'
                        }}
                        aria-label={isPinned ? "고정 해제" : "상단 고정"}
                      >
                        <Pin size={13} fill={isPinned ? "var(--mobile-primary, #4f46e5)" : "none"} style={{ transform: 'rotate(45deg)' }} />
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
    </>
  );
}

export default MobileChatList;
