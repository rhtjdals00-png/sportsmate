import { useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import Button from "../../common/Button.jsx";
import { notificationApi } from "../../../api/notificationApi";
import { useAsync } from "../../../hooks/useAsync";
import { enablePushNotifications, getPushSupportState } from "../../../utils/pushNotifications";

function MobileNotifications() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [pushMessage, setPushMessage] = useState("");
  const [pushLoading, setPushLoading] = useState(false);
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
      setPushMessage("푸시 알림이 켜졌습니다.");
    } catch (error) {
      setPushMessage(error.message || "푸시 알림을 켜지 못했습니다.");
    } finally {
      setPushLoading(false);
    }
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
          <Button type="button" onClick={enablePush} disabled={pushLoading}>
            {pushLoading ? "설정 중" : "알림 켜기"}
          </Button>
        )}
      </section>
      <div className="notification-list">
        {(notifications.data?.items || []).map((item) => (
          <article key={item.id} className={item.is_read ? "read" : ""}>
            <strong>{item.title}</strong>
            <p>{item.message}</p>
            {!item.is_read && <button type="button" onClick={() => markRead(item.id)}>읽음 처리</button>}
          </article>
        ))}
      </div>
      {!notifications.loading && !notifications.data?.items?.length && (
        <EmptyState title="새 알림이 없습니다." description="참여 승인, 채팅, 공지 알림이 여기에 표시됩니다." />
      )}
    </>
  );
}

export default MobileNotifications;
