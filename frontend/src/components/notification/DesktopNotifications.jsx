import { BellRing, Megaphone, MessageCircle, Vote } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../common/EmptyState.jsx";
import LoadingCards from "../common/LoadingCards.jsx";
import { notificationApi } from "../../api/notificationApi";
import { useAsync } from "../../hooks/useAsync";
import {
  dismissNotificationKey,
  notificationKey,
  notificationMessage,
  notificationTitle,
  visibleNotifications
} from "../../utils/notificationDisplay";

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

function NotificationIcon({ type }) {
  if (type === "chat") return <MessageCircle size={19} />;
  if (type === "notice") return <Megaphone size={19} />;
  if (type === "vote") return <Vote size={19} />;
  return <BellRing size={19} />;
}

function notificationAction(item) {
  if (item.type === "chat") return "채팅방 보기";
  if (item.type === "notice") return "공지 확인";
  if (item.type === "vote") return "투표 확인";
  return "자세히 보기";
}

function DesktopNotifications() {
  const navigate = useNavigate();
  const [dismissVersion, setDismissVersion] = useState(0);
  const notifications = useAsync(() => notificationApi.summary(), []);
  void dismissVersion;
  const items = visibleNotifications(notifications.data?.items || []);

  const dismiss = async (item, shouldNavigate = false) => {
    const key = notificationKey(item);
    dismissNotificationKey(key);
    if (item.source === "admin" && Number.isInteger(Number(item.id))) {
      try {
        await notificationApi.read(item.id);
      } catch {
        // 목록 갱신을 막지 않습니다.
      }
    }
    setDismissVersion((value) => value + 1);
    if (shouldNavigate && item.link_url) navigate(item.link_url);
  };

  return (
    <div className="desktop-notifications">
      <header className="desktop-notifications__head">
        <div>
          <span><BellRing size={18} /> 알림센터</span>
          <h1>내 알림</h1>
          <p>새 채팅, 공지사항, 투표 마감, 관리자 알림을 한곳에서 확인합니다.</p>
        </div>
      </header>

      {notifications.loading && !notifications.data ? (
        <LoadingCards count={4} />
      ) : items.length ? (
        <section className="desktop-notifications__list">
          {items.map((item) => (
            <article key={notificationKey(item)} className={`desktop-notification-card is-${item.type}`}>
              <div className="desktop-notification-card__icon">
                <NotificationIcon type={item.type} />
              </div>
              <div className="desktop-notification-card__body">
                <div className="desktop-notification-card__meta">
                  <span>{item.type === "chat" ? "채팅" : item.type === "notice" ? "공지" : item.type === "vote" ? "투표" : "알림"}</span>
                  <time>{formatNotificationTime(item.created_at)}</time>
                </div>
                <strong>{notificationTitle(item)}</strong>
                <p>{notificationMessage(item)}</p>
                <div className="desktop-notification-card__actions">
                  {item.link_url ? (
                    <button type="button" onClick={() => dismiss(item, true)}>
                      {notificationAction(item)}
                    </button>
                  ) : null}
                  <button type="button" className="is-muted" onClick={() => dismiss(item)}>
                    읽음 처리
                  </button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <EmptyState title="새 알림이 없습니다." description="새 채팅, 공지사항, 투표 마감 알림이 여기에 표시됩니다." actionLabel="채팅방 보기" actionTo="/chats" />
      )}

      {notifications.error ? <p className="desktop-notifications__error">알림을 불러오지 못했습니다.</p> : null}
    </div>
  );
}

export default DesktopNotifications;
