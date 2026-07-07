import { useState } from "react";
import { BellRing, MapPin, RefreshCcw, Settings, ShieldCheck } from "lucide-react";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { enablePushNotifications, getPushSupportState, isIosLike, isStandalonePwa } from "../utils/pushNotifications";
import { useAuth } from "../contexts/AuthContext.jsx";

function permissionLabel() {
  if (!("Notification" in window)) return "지원 안 함";
  if (Notification.permission === "granted") return "허용됨";
  if (Notification.permission === "denied") return "차단됨";
  return "요청 전";
}

function AppSettingsPage() {
  const { user } = useAuth();
  const [pushMessage, setPushMessage] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "default"));
  const pushState = getPushSupportState();
  const iosPwaMessage = isIosLike() && !isStandalonePwa()
    ? "iPhone은 Safari 공유 버튼으로 홈 화면에 추가한 뒤 앱에서 알림을 켤 수 있습니다."
    : "";

  const enablePush = async () => {
    setPushMessage("");
    try {
      await enablePushNotifications();
      setPermission("granted");
      setPushMessage("알림 권한이 설정되었습니다.");
    } catch (error) {
      setPushMessage(error?.message || "알림 권한을 설정하지 못했습니다.");
    }
  };

  const checkLocation = () => {
    setLocationMessage("");
    if (!("geolocation" in navigator)) {
      setLocationMessage("이 브라우저에서는 위치 권한을 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => setLocationMessage("위치 권한이 확인되었습니다."),
      () => setLocationMessage("위치 권한이 허용되지 않았습니다. 브라우저 사이트 설정에서 위치 권한을 허용해주세요."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const resetPermissionGuide = () => {
    if (user?.id) {
      localStorage.removeItem(`sportsmate_permission_onboarding_${user.id}`);
    }
    setResetMessage("첫 권한 안내를 다시 볼 수 있도록 초기화했습니다. 홈으로 이동하거나 새로고침하면 안내가 다시 표시됩니다.");
  };

  return (
    <>
      <MobileHeader title="앱 설정" />
      <section className="mobile-settings-page">
        <article className="mobile-settings-hero">
          <div>
            <Settings size={22} />
          </div>
          <span>SPORTSMATE SETTINGS</span>
          <h1>앱 권한과 사용 환경을 관리해요.</h1>
          <p>알림, 위치 권한은 브라우저 보안 정책 때문에 사용자가 직접 허용해야 합니다.</p>
        </article>

        <article className="mobile-settings-card">
          <div className="mobile-settings-card__head">
            <BellRing size={20} />
            <div>
              <strong>백그라운드 알림</strong>
              <p>채팅 메시지와 참여 승인 알림을 받을 수 있습니다.</p>
            </div>
            <em>{permissionLabel()}</em>
          </div>
          {iosPwaMessage ? <p className="mobile-settings-card__notice">{iosPwaMessage}</p> : null}
          {!pushState.supported && !iosPwaMessage ? <p className="mobile-settings-card__notice">{pushState.reason}</p> : null}
          {pushMessage ? <p className="mobile-settings-card__message">{pushMessage}</p> : null}
          {permission === "granted" ? (
            <button type="button" disabled style={{ background: '#e2e8f0', color: '#94a3b8', cursor: 'default' }}>알림 활성화됨</button>
          ) : (
            <button type="button" onClick={enablePush}>알림 켜기</button>
          )}
        </article>

        <article className="mobile-settings-card">
          <div className="mobile-settings-card__head">
            <MapPin size={20} />
            <div>
              <strong>위치 권한</strong>
              <p>주변 모임 추천과 채팅방 위치 공유에 사용합니다.</p>
            </div>
          </div>
          {locationMessage ? <p className="mobile-settings-card__message">{locationMessage}</p> : null}
          <button type="button" onClick={checkLocation}>위치 권한 확인</button>
        </article>

        <article className="mobile-settings-card">
          <div className="mobile-settings-card__head">
            <ShieldCheck size={20} />
            <div>
              <strong>권한 안내 다시 보기</strong>
              <p>처음 접속할 때 보이는 권한 안내 모달을 다시 표시합니다.</p>
            </div>
          </div>
          {resetMessage ? <p className="mobile-settings-card__message">{resetMessage}</p> : null}
          <button type="button" onClick={resetPermissionGuide}><RefreshCcw size={16} />안내 다시 보기</button>
        </article>
      </section>
    </>
  );
}

export default AppSettingsPage;
