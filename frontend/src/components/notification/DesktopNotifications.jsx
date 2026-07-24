import { BellRing, CheckCheck, Megaphone, MessageCircle, SlidersHorizontal, Vote } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../common/EmptyState.jsx";
import LoadingCards from "../common/LoadingCards.jsx";
import { notificationApi } from "../../api/notificationApi";
import { useAsync } from "../../hooks/useAsync";
import {
  notificationKey,
  notificationLinkUrl,
  notificationMessage,
  notificationTitle
} from "../../utils/notificationDisplay";

const READ_FILTERS = [
  { id: "all", label: "전체" },
  { id: "unread", label: "안 읽음" },
  { id: "read", label: "읽음" }
];

const TYPE_FILTERS = [
  { id: "all", label: "모든 유형" },
  { id: "chat", label: "채팅" },
  { id: "notice", label: "공지/운영" },
  { id: "meeting", label: "모임" }
];

function formatNotificationTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function NotificationIcon({ type }) {
  if (type === "chat") return <MessageCircle size={19} />;
  if (type === "notice") return <Megaphone size={19} />;
  if (type === "vote") return <Vote size={19} />;
  return <BellRing size={19} />;
}

function isNoticeType(type) {
  return [
    "notice",
    "admin_broadcast",
    "admin_message",
    "account_suspension",
    "account_unsuspension",
    "broadcast",
    "admin",
    "system",
    "support_inquiry",
    "support_reply",
    "report_result"
  ].includes(type);
}

function notificationAction(item) {
  if (isNoticeType(item.type)) return "메시지 확인";
  if (item.type === "chat") return "채팅방 보기";
  if (item.type === "vote") return "투표 확인";
  return "자세히 보기";
}

function notificationTypeLabel(type) {
  if (type === "chat") return "채팅";
  if (type === "notice") return "공지";
  if (type === "vote") return "투표";
  if (type === "support_reply") return "문의 답변";
  if (type === "support_inquiry") return "고객 문의";
  if (type === "report_result") return "신고 처리";
  if (isNoticeType(type)) return "운영 안내";
  return "알림";
}

function typeMatches(item, filter) {
  if (filter === "all") return true;
  if (filter === "chat") return item.type === "chat";
  if (filter === "notice") return isNoticeType(item.type);
  if (filter === "meeting") return item.type !== "chat" && !isNoticeType(item.type);
  return true;
}

function chatRoomIdFromNotification(item) {
  if (item?.type !== "chat") return "";
  const match = String(item.link_url || "").match(/\/chats\/(\d+)/);
  return match?.[1] || "";
}

function compactChatNotifications(items) {
  const chatByRoom = new Map();
  const others = [];
  items.forEach((item) => {
    const roomId = chatRoomIdFromNotification(item);
    if (!roomId) {
      others.push(item);
      return;
    }
    const previous = chatByRoom.get(roomId);
    const previousTime = new Date(previous?.created_at || 0).getTime();
    const nextTime = new Date(item.created_at || 0).getTime();
    if (!previous || nextTime >= previousTime) {
      chatByRoom.set(roomId, {
        ...item,
        link_url: `/chats/${roomId}?unread=1`,
        chat_room_id: Number(roomId),
        is_read: previous ? (Boolean(previous.is_read) && Boolean(item.is_read)) : Boolean(item.is_read)
      });
    } else if (previous) {
      chatByRoom.set(roomId, {
        ...previous,
        is_read: Boolean(previous.is_read) && Boolean(item.is_read)
      });
    }
  });
  return [...others, ...chatByRoom.values()];
}

function DesktopNotifications() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [readFilter, setReadFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [savingAll, setSavingAll] = useState(false);
  
  const notifications = useAsync(
    () => notificationApi.list({ page, limit: 10, read_filter: readFilter, type_filter: typeFilter }),
    [page, readFilter, typeFilter, refreshKey]
  );
  
  const items = notifications.data?.items || [];
  const displayItems = useMemo(() => compactChatNotifications(items), [items]);

  const unreadCount = notifications.data?.global_unread || 0;
  const readCount = notifications.data?.global_read || 0;
  const totalCount = notifications.data?.global_total || 0;
  const totalPages = notifications.data?.pages || 1;

  const handleReadFilterChange = (filterId) => {
    setReadFilter(filterId);
    setPage(1);
  };

  const handleTypeFilterChange = (filterValue) => {
    setTypeFilter(filterValue);
    setPage(1);
  };

  const markRead = async (item) => {
    if (!item?.is_read) {
      if (item.type === "chat" && item.chat_room_id) {
        try {
          await notificationApi.readChatRoom(item.chat_room_id);
        } catch {
          // ignore
        }
      } else if (Number.isInteger(Number(item.id))) {
        try {
          await notificationApi.read(item.id);
        } catch {
          // 목록 확인 흐름은 막지 않습니다.
        }
      }
    }
    setRefreshKey((value) => value + 1);
    window.dispatchEvent(new Event("notifications_updated"));
  };

  const markAllRead = async () => {
    if (!unreadCount || savingAll) return;
    setSavingAll(true);
    try {
      await notificationApi.readAll();
      setRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("notifications_updated"));
    } finally {
      setSavingAll(false);
    }
  };

  const openNotification = async (item) => {
    if (!item.is_read) {
      if (item.type === "chat" && item.chat_room_id) {
        try {
          await notificationApi.readChatRoom(item.chat_room_id);
          setRefreshKey((value) => value + 1);
          window.dispatchEvent(new Event("notifications_updated"));
        } catch {
          await markRead(item);
        }
      } else {
        await markRead(item);
      }
    }
    const targetUrl = notificationLinkUrl(item);
    if (targetUrl) navigate(targetUrl);
  };

  const pageBlockSize = 10;
  const currentBlock = Math.ceil(page / pageBlockSize);
  const startPage = (currentBlock - 1) * pageBlockSize + 1;
  const endPage = Math.min(currentBlock * pageBlockSize, totalPages);
  
  const pageNumbers = [];
  for (let i = startPage; i <= endPage; i++) {
    pageNumbers.push(i);
  }

  return (
    <div className="desktop-notifications">
      <header className="desktop-notifications__head">
        <div>
          <span><BellRing size={18} /> 알림센터</span>
          <h1>내 알림</h1>
          <p>안 읽은 알림을 먼저 보여주고, 읽은 알림도 기록으로 남겨둡니다.</p>
        </div>
        <button className="desktop-notifications__read-all" type="button" onClick={markAllRead} disabled={!unreadCount || savingAll}>
          <CheckCheck size={16} />
          {savingAll ? "처리 중" : "모두 읽음 처리"}
        </button>
      </header>

      <section className="desktop-notifications__summary" aria-label="알림 요약">
        <span><b>{totalCount}</b><em>전체</em></span>
        <span><b>{unreadCount}</b><em>안 읽음</em></span>
        <span><b>{readCount}</b><em>읽음</em></span>
      </section>

      <section className="desktop-notifications__toolbar" aria-label="알림 필터">
        <div className="desktop-notifications__segmented">
          {READ_FILTERS.map((filter) => (
            <button key={filter.id} type="button" className={readFilter === filter.id ? "is-active" : ""} onClick={() => handleReadFilterChange(filter.id)}>
              {filter.label}
            </button>
          ))}
        </div>
        <label className="desktop-notifications__type-filter">
          <SlidersHorizontal size={16} />
          <select value={typeFilter} onChange={(event) => handleTypeFilterChange(event.target.value)}>
            {TYPE_FILTERS.map((filter) => <option key={filter.id} value={filter.id}>{filter.label}</option>)}
          </select>
        </label>
      </section>

      {notifications.loading && !notifications.data ? (
        <LoadingCards count={4} />
      ) : displayItems.length ? (
        <section className="desktop-notifications__list">
          {displayItems.map((item) => (
            <article key={notificationKey(item)} className={`desktop-notification-card is-${item.type} ${item.is_read ? "is-read" : "is-unread"}`}>
              <div className="desktop-notification-card__icon">
                <NotificationIcon type={item.type} />
              </div>
              <div className="desktop-notification-card__body">
                <div className="desktop-notification-card__meta">
                  <span>{notificationTypeLabel(item.type)}</span>
                  <b className="desktop-notification-card__read-state">{item.is_read ? "읽음" : "안 읽음"}</b>
                  <time>{formatNotificationTime(item.created_at)}</time>
                </div>
                <strong>{notificationTitle(item)}</strong>
                <p>{notificationMessage(item)}</p>
                <div className="desktop-notification-card__actions">
                  {notificationLinkUrl(item) ? (
                    <button type="button" onClick={() => openNotification(item)}>
                      {notificationAction(item)}
                    </button>
                  ) : null}
                  {!item.is_read ? (
                    <button type="button" className="is-muted" onClick={() => markRead(item)}>
                      읽음 처리
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="조건에 맞는 알림이 없습니다." description="필터를 바꾸면 다른 알림을 확인할 수 있습니다." />
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "32px", paddingBottom: "24px" }}>
          {/* 이전 페이지 */}
          <button
            disabled={page === 1}
            onClick={() => setPage(p => Math.max(p - 1, 1))}
            style={{
              border: "1px solid #cbd5e1",
              backgroundColor: page === 1 ? "#f1f5f9" : "#ffffff",
              color: page === 1 ? "#94a3b8" : "#334155",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: page === 1 ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              transition: "all 0.2s"
            }}
          >
            이전
          </button>
          
          {/* 이전 10페이지 블록 (<<) */}
          {startPage > 1 && (
            <button
              onClick={() => setPage(startPage - 1)}
              style={{
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s"
              }}
              title="이전 10페이지"
            >
              &lt;&lt;
            </button>
          )}

          {/* 페이지 번호들 */}
          {pageNumbers.map(num => (
            <button
              key={num}
              onClick={() => setPage(num)}
              style={{
                border: num === page ? "1px solid var(--primary-color, #4f46e5)" : "1px solid #cbd5e1",
                backgroundColor: num === page ? "var(--primary-color, #4f46e5)" : "#ffffff",
                color: num === page ? "#ffffff" : "#334155",
                padding: "6px 12px",
                minWidth: "32px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s"
              }}
            >
              {num}
            </button>
          ))}

          {/* 다음 10페이지 블록 (>>) */}
          {endPage < totalPages && (
            <button
              onClick={() => setPage(endPage + 1)}
              style={{
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                padding: "6px 12px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
                transition: "all 0.2s"
              }}
              title="다음 10페이지"
            >
              &gt;&gt;
            </button>
          )}

          {/* 다음 페이지 */}
          <button
            disabled={page === totalPages}
            onClick={() => setPage(p => Math.min(p + 1, totalPages))}
            style={{
              border: "1px solid #cbd5e1",
              backgroundColor: page === totalPages ? "#f1f5f9" : "#ffffff",
              color: page === totalPages ? "#94a3b8" : "#334155",
              padding: "6px 12px",
              borderRadius: "6px",
              cursor: page === totalPages ? "not-allowed" : "pointer",
              fontSize: "13px",
              fontWeight: 600,
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)",
              transition: "all 0.2s"
            }}
          >
            다음
          </button>
        </div>
      )}

      {notifications.error ? <p className="desktop-notifications__error">알림을 불러오지 못했습니다.</p> : null}
    </div>
  );
}

export default DesktopNotifications;
