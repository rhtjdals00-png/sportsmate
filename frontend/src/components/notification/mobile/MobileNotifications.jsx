import { useState } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { notificationApi } from "../../../api/notificationApi";
import { useAsync } from "../../../hooks/useAsync";

function MobileNotifications() {
  const [refreshKey, setRefreshKey] = useState(0);
  const notifications = useAsync(() => notificationApi.list(), [refreshKey]);

  const markRead = async (id) => {
    await notificationApi.read(id);
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <MobileHeader title="알림" />
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
