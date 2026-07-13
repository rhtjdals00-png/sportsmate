export const ADMIN_NOTIFICATION_TYPES = new Set([
  "admin_broadcast",
  "admin_message",
  "account_suspension",
  "account_unsuspension",
  "broadcast",
  "admin",
  "system",
  "support_inquiry",
  "support_reply"
]);

export const DISMISSED_NOTIFICATION_KEY = "sportsmate.dismissedNotifications";

export function isSupportNotification(item) {
  return ADMIN_NOTIFICATION_TYPES.has(item?.type);
}

export function notificationLinkUrl(item) {
  if (isSupportNotification(item) && (!item.link_url || item.link_url === "/notifications")) return "/support";
  return item.link_url || "";
}

export function notificationKey(item) {
  return `${item.source || item.type || "notification"}:${item.id}`;
}

export function readDismissedNotifications() {
  try {
    return new Set(JSON.parse(localStorage.getItem(DISMISSED_NOTIFICATION_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export function dismissNotificationKey(key) {
  const dismissed = readDismissedNotifications();
  dismissed.add(key);
  localStorage.setItem(DISMISSED_NOTIFICATION_KEY, JSON.stringify([...dismissed]));
}

export function visibleNotifications(items = []) {
  return items;
}

export function notificationTitle(item) {
  if (item.type === "chat") return "새로운 채팅이 있습니다";
  if (item.type === "notice") return "공지사항이 있습니다";
  if (item.type === "vote") return "마감 임박 투표가 있습니다";
  return item.title || "알림";
}

export function notificationMessage(item) {
  if (item.type === "chat") return item.message || "참여 중인 채팅방에 새 메시지가 있습니다.";
  if (item.type === "notice") return item.message || "참여 중인 모임에 새 공지가 등록되었습니다.";
  if (item.type === "vote") return item.message || "마감까지 얼마 남지 않은 투표가 있습니다.";
  return item.message || "";
}
