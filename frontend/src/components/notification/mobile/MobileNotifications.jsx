import { useMemo, useState } from "react";
import { BellRing, MessageCircle, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import Button from "../../common/Button.jsx";
import { notificationApi } from "../../../api/notificationApi";
import { useAsync } from "../../../hooks/useAsync";
import { enablePushNotifications, getPushSupportState } from "../../../utils/pushNotifications";

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
  if (item.type === "chat") {
    return { icon: MessageCircle, label: "채팅", action: "채팅방 보기" };
  }
  if (item.type === "join_request") {
    return { icon: UserPlus, label: "가입 신청", action: "신청 내역 보기" };
  }
  return { icon: BellRing, label: "알림", action: "자세히 보기" };
}

function MobileNotifications() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pushMessage, setPushMessage] = useState("");
  const [pushLoading, setPushLoading] = useState(false);
  const [locationMessage, setLocationMessage] = useState("");
  const [locationLoading, setLocationLoading] = useState(false);
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "default"));
  const notifications = useAsync(() => notificationApi.list(), [refreshKey]);
  const pushSupport = useMemo(() => getPushSupportState(), []);

  const markRead = async (id) => {
    await notificationApi.read(id);
    setRefreshKey((value) => value + 1);
  };

  const enablePush = async () => {
    setPushLoading(true);
    setPushMessage("");
    try {
      await enablePushNotifications();
      setPermission("granted");
      setPushMessage("푸시 알림이 켜졌습니다.");
    } catch (error) {
      setPushMessage(error.message || "푸시 알림을 켜지 못했습니다.");
    } finally {
      setPushLoading(false);
    }
  };

  const enableLocation = () => {
    setLocationMessage("");
    if (!("geolocation" in navigator)) {
      setLocationMessage("현재 브라우저에서는 위치 권한을 사용할 수 없습니다.");
      return;
    }
    setLocationLoading(true);
    navigator.geolocation.getCurrentPosition(
      () => {
        setLocationMessage("위치 권한이 허용되었습니다.");
        setLocationLoading(false);
      },
      (error) => {
        const denied = error.code === error.PERMISSION_DENIED;
        setLocationMessage(denied ? "위치 권한이 차단되었습니다. 브라우저 사이트 설정에서 위치 권한을 허용해주세요." : "위치 정보를 확인하지 못했습니다.");
        setLocationLoading(false);
      },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  };

  return (
    <>
      <MobileHeader title="알림" />
      <section className="mobile-push-card">
        <BellRing size={22} />
        <div>
          <strong>백그라운드 알림</strong>
          <p>{pushSupport.supported ? "참여 승인, 채팅 메시지를 앱을 닫아도 받을 수 있습니다." : pushSupport.reason}</p>
          {pushMessage ? <span>{pushMessage}</span> : null}
        </div>
        {pushSupport.supported && (
          permission === "granted" ? (
            <Button type="button" disabled variant="secondary">
              알림 켜짐
            </Button>
          ) : (
            <Button type="button" onClick={enablePush} disabled={pushLoading}>
              {pushLoading ? "설정 중" : "알림 켜기"}
            </Button>
          )
        )}
        <Button type="button" variant="secondary" onClick={enableLocation} disabled={locationLoading}>
          {locationLoading ? "확인 중" : "위치 권한 확인"}
        </Button>
        {locationMessage ? <span>{locationMessage}</span> : null}
      </section>
      <div className="notification-list">
        {(notifications.data?.items || []).map((item) => {
          const meta = notificationMeta(item);
          const Icon = meta.icon;
          return (
            <article key={item.id} className={item.is_read ? "read" : ""}>
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
                  {item.link_url ? <Link to={item.link_url}>{meta.action}</Link> : null}
                  {!item.is_read && <button type="button" onClick={() => markRead(item.id)}>읽음 처리</button>}
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!notifications.loading && !notifications.data?.items?.length && (
        <EmptyState title="새 알림이 없습니다." description="참여 승인, 채팅, 공지 알림이 여기에 표시됩니다." />
      )}
    </>
  );
}

export default MobileNotifications;
