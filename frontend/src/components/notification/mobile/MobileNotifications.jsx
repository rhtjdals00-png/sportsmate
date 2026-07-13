import { useMemo, useState, useEffect } from "react";
import { BellRing, MessageCircle, UserPlus, Megaphone, HelpCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import Button from "../../common/Button.jsx";
import { notificationApi } from "../../../api/notificationApi";
import { apiClient } from "../../../api/client";
import { useAsync } from "../../../hooks/useAsync";
import { enablePushNotifications, getPushSupportState } from "../../../utils/pushNotifications";
import { visibleNotifications } from "../../../utils/notificationDisplay";

function formatNotificationTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function notificationMeta(item) {
  if (!item) {
    return { icon: BellRing, label: "알림", action: "자세히 보기" };
  }
  if (item.type === "chat") {
    return { icon: MessageCircle, label: "채팅", action: "채팅방 보기" };
  }
  if (item.type === "notice") {
    return { icon: Megaphone, label: "공지사항", action: "공지 보기" };
  }
  if (item.type === "join_request") {
    return { icon: UserPlus, label: "가입 신청", action: "신청 내역 보기" };
  }
  return { icon: BellRing, label: "알림", action: "자세히 보기" };
}

function MobileNotifications() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [pushLoading, setPushLoading] = useState(false);
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "default"));
  const [filterTab, setFilterTab] = useState("all");
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [visibleCount, setVisibleCount] = useState(7);
  const [localReadIds, setLocalReadIds] = useState(new Set());
  
  const notifications = useAsync(() => apiClient.get("/notifications?limit=50").then(res => res.data), [refreshKey]);
  const pushSupport = useMemo(() => getPushSupportState(), []);

  const markRead = async (id) => {
    setLocalReadIds((prev) => new Set(prev).add(id));
    if (Number.isInteger(Number(id))) {
      try {
        await notificationApi.read(Number(id));
      } catch (e) {
        console.error("Failed to mark notification as read", e);
      }
    }
    setRefreshKey((value) => value + 1);
    window.dispatchEvent(new Event("notifications_updated"));
  };

  const handleAction = async (item) => {
    if (!item.is_read) {
      await markRead(item.id);
    }
    if (item.link_url) {
      navigate(item.link_url);
    } else {
      alert(`${item.title}\n\n${item.message}`);
    }
  };

  const enablePush = async () => {
    setPushLoading(true);
    try {
      await enablePushNotifications();
      setPermission("granted");
    } catch (error) {
      alert(error.message || "푸시 알림 권한을 켜지 못했습니다. 브라우저 설정을 확인해주세요.");
    } finally {
      setPushLoading(false);
    }
  };

  const filteredNotifications = useMemo(() => {
    const rawItems = notifications.data?.items || [];
    const items = visibleNotifications(rawItems);
    return items.filter((item) => {
      if (!item) return false;
      const isRead = item.is_read || localReadIds.has(item.id);
      if (onlyUnread && isRead) return false;

      const isNotice = [
        "notice",
        "admin_broadcast",
        "admin_message",
        "account_suspension",
        "account_unsuspension",
        "broadcast",
        "admin"
      ].includes(item.type);
      const isChat = item.type === "chat";

      if (filterTab === "all") return true;
      if (filterTab === "chat") return isChat;
      if (filterTab === "notice") return isNotice;
      if (filterTab === "meeting") return !isNotice && !isChat;
      return true;
    });
  }, [notifications.data?.items, filterTab, onlyUnread]);

  useEffect(() => {
    setVisibleCount(7);
  }, [filterTab, onlyUnread]);

  const displayedNotifications = useMemo(() => {
    return filteredNotifications.slice(0, visibleCount);
  }, [filteredNotifications, visibleCount]);

  return (
    <>
      <MobileHeader title="알림" />

      {/* 권한 미허용 경고 영역 */}
      {permission !== "granted" && pushSupport.supported && (
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fee2e2',
          padding: '12px 16px',
          margin: '12px 16px 8px',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.02)'
        }}>
          <span style={{ fontSize: '12px', color: '#ef4444', fontWeight: '800' }}>
            ⚠️ 알림 권한이 허용되지 않은 상태입니다.
          </span>
          <button
            type="button"
            onClick={enablePush}
            disabled={pushLoading}
            style={{
              background: '#ef4444',
              color: '#fff',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '11px',
              fontWeight: '900',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'background 0.2s'
            }}
          >
            {pushLoading ? "허용 중..." : "권한 허용하기"}
          </button>
        </div>
      )}

      {/* 알림 필터 탭 */}
      {notifications.data?.items && notifications.data.items.length > 0 && (
        <>
          <div className="mobile-chat-subfilters" style={{ display: 'flex', gap: '8px', padding: '12px 16px 8px', background: 'transparent', overflowX: 'auto' }}>
            {[
              { id: "all", label: "전체" },
              { id: "notice", label: "공지" },
              { id: "meeting", label: "모임" },
              { id: "chat", label: "채팅" }
            ].map((tab) => {
              const isActive = filterTab === tab.id;
              const rawItems = notifications.data?.items || [];
              const visible = visibleNotifications(rawItems);
              const count = visible.filter(item => {
                 if (!item) return false;
                 const isNotice = [
                   "notice",
                   "admin_broadcast",
                   "admin_message",
                   "account_suspension",
                   "account_unsuspension",
                   "broadcast",
                   "admin"
                 ].includes(item.type);
                 const isChat = item.type === "chat";

                 if (tab.id === "all") return true;
                 if (tab.id === "chat") return isChat;
                 if (tab.id === "notice") return isNotice;
                 return !isNotice && !isChat;
               }).length;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterTab(tab.id)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isActive ? 'var(--mobile-primary, #4f46e5)' : '#e2e8f0',
                    background: isActive ? 'rgba(79, 70, 229, 0.08)' : 'rgba(255, 255, 255, 0.6)',
                    color: isActive ? 'var(--mobile-primary, #4f46e5)' : '#64748b',
                    fontSize: '12px',
                    fontWeight: '800',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label} ({count})
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', padding: '4px 16px 12px', gap: '6px' }}>
            <input
              type="checkbox"
              id="onlyUnread"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              style={{
                width: '16px',
                height: '16px',
                accentColor: 'var(--mobile-primary, #4f46e5)',
                cursor: 'pointer'
              }}
            />
            <label htmlFor="onlyUnread" style={{ fontSize: '13px', color: '#475569', fontWeight: '800', cursor: 'pointer', userSelect: 'none' }}>
              안 읽은 알림만 보기
            </label>
          </div>
        </>
      )}

      {/* 알림 리스트 영역 */}
      <div className="notification-list">
        {displayedNotifications.map((item) => {
          const meta = notificationMeta(item);
          const Icon = meta.icon;
          const isUnread = !item.is_read && !localReadIds.has(item.id);
          return (
            <article
              key={item.id}
              className={`${!isUnread ? "read" : ""} ${isUnread ? "unread" : ""}`}
              style={
                isUnread
                  ? {
                      background: 'rgba(79, 70, 229, 0.04)',
                      borderLeft: '4px solid var(--mobile-primary, #4f46e5)',
                      paddingLeft: '12px'
                    }
                  : undefined
              }
            >
              <div className="notification-card__icon">
                <Icon size={18} />
              </div>
              <div className="notification-card__body">
                <div className="notification-card__meta">
                  <span>{meta.label}</span>
                  <time>{formatNotificationTime(item.created_at)}</time>
                </div>
                <strong>{item.title}</strong>
                <p>{item.message}</p>
                <div className="notification-card__actions">
                  <button type="button" onClick={() => handleAction(item)}>
                    {meta.action}
                  </button>
                  {!item.is_read && !localReadIds.has(item.id) && (
                    <button
                      type="button"
                      className="is-muted"
                      onClick={() => markRead(item.id)}
                      style={{ background: 'none', border: 'none', color: '#94a3b8', marginLeft: '8px' }}
                    >
                      읽음 처리
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {visibleCount < filteredNotifications.length && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={() => setVisibleCount(prev => prev + 7)}
            style={{ padding: '10px 24px', borderRadius: '24px', border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: '13px', fontWeight: '800', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
          >
            더 보기
          </button>
        </div>
      )}

      {!notifications.loading && !filteredNotifications.length && (
        <EmptyState
          title={
            filterTab === "notice"
              ? "공지 알림이 없습니다."
              : filterTab === "meeting"
              ? "모임 관련 알림이 없습니다."
              : filterTab === "chat"
              ? "채팅 알림이 없습니다."
              : "새 알림이 없습니다."
          }
          description="중요한 소식을 놓치지 않도록 여기에 표시됩니다."
        />
      )}
    </>
  );
}

export default MobileNotifications;
