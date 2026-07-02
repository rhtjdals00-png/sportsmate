import { notificationApi } from "../api/notificationApi";

function urlBase64ToUint8Array(value) {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function isStandalonePwa() {
  return window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;
}

export function isIosLike() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function getPushSupportState() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { supported: false, reason: "이 브라우저는 푸시 알림을 지원하지 않습니다." };
  }
  if (isIosLike() && !isStandalonePwa()) {
    return { supported: false, reason: "iPhone에서는 Safari 공유 버튼으로 홈 화면에 추가한 뒤 앱에서 알림을 켤 수 있습니다." };
  }
  return { supported: true, reason: "" };
}

export async function enablePushNotifications() {
  const support = getPushSupportState();
  if (!support.supported) throw new Error(support.reason);

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("알림 권한이 허용되지 않았습니다.");

  const registration = await navigator.serviceWorker.ready;
  const { publicKey } = await notificationApi.pushPublicKey();
  if (!publicKey) throw new Error("푸시 알림 키가 아직 서버에 설정되지 않았습니다.");

  const existing = await registration.pushManager.getSubscription();
  const subscription = existing || await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey)
  });

  const saved = await notificationApi.savePushSubscription(subscription.toJSON());
  localStorage.setItem("sportsmate_push_subscription_id", String(saved.subscription_id));
  return saved;
}
