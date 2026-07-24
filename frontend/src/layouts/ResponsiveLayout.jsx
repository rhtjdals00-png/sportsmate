import { useEffect, useState } from "react";
import { BellRing, MapPin, ShieldCheck, X } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { authApi } from "../api/authApi";
import { useResponsive } from "../hooks/useResponsive";
import { enablePushNotifications } from "../utils/pushNotifications";
import MobileLayout from "./MobileLayout.jsx";
import DesktopLayout from "./DesktopLayout.jsx";

const AUTH_ROUTES = ["/login", "/register", "/auth/callback", "/profile/intro", "/profile/setup"];

function ResponsiveLayout() {
  const { isMobile } = useResponsive();
  const { user, session, loading: authLoading, logout } = useAuth();
  const location = useLocation();
  const [toast, setToast] = useState("");
  const [canceling, setCanceling] = useState(false);
  const [permissionGuideOpen, setPermissionGuideOpen] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [pushPermissionGranted, setPushPermissionGranted] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const permissionStorageKey = user?.id ? `sportsmate_permission_onboarding_${user.id}` : "";
  const hideChatbotFloating = isMobile
    || authLoading
    || !user?.id
    || AUTH_ROUTES.some((route) => location.pathname.startsWith(route))
    || location.pathname.startsWith("/admin")
    || location.pathname.startsWith("/chatbot");

  useEffect(() => {
    const message = sessionStorage.getItem("sportsmate_flash");
    if (!message) return;
    sessionStorage.removeItem("sportsmate_flash");
    setToast(message);
  }, [location.key]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!authLoading && user?.id) {
      if ("Notification" in window && Notification.permission === "granted") {
        enablePushNotifications()
          .then(() => console.log("Push subscription verified & synced successfully."))
          .catch((err) => console.warn("Failed to sync push subscription:", err));
      }
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!isMobile || authLoading || !user?.id || !permissionStorageKey) return;
    if (AUTH_ROUTES.some((route) => location.pathname.startsWith(route))) return;
    if (localStorage.getItem(permissionStorageKey)) return;
    setPermissionGuideOpen(true);
  }, [authLoading, isMobile, location.pathname, permissionStorageKey, user?.id]);

  const closePermissionGuide = () => {
    if (permissionStorageKey) {
      localStorage.setItem(permissionStorageKey, "done");
    }
    setPermissionGuideOpen(false);
    setPermissionMessage("");
  };

  const requestPushPermission = async () => {
    setPermissionMessage("");
    try {
      await enablePushNotifications();
      setPushPermissionGranted(true);
      setPermissionMessage("알림 권한이 설정되었습니다.");
    } catch (error) {
      setPermissionMessage(error?.message || "알림 권한을 설정하지 못했습니다.");
    }
  };

  const requestLocationPermission = () => {
    setPermissionMessage("");
    if (!("geolocation" in navigator)) {
      setPermissionMessage("이 브라우저에서는 위치 권한을 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => { setPermissionMessage("위치 권한이 확인되었습니다."); setLocationPermissionGranted(true); },
      () => setPermissionMessage("위치 권한이 허용되지 않았습니다. 브라우저 설정에서 위치 권한을 확인해주세요."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const handleCancelDeletion = async () => {
    if (canceling) return;
    setCanceling(true);
    try {
      await authApi.restore(session?.access_token);
      alert("탈퇴 처리가 성공적으로 철회되었습니다.");
      window.location.replace("/"); // 강제 새로고침하여 홈으로 이동
    } catch (err) {
      alert("탈퇴 철회 중 오류가 발생했습니다.");
    } finally {
      setCanceling(false);
    }
  };

  if (user?.role === "pending_withdrawal") {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', textAlign: 'center' }}>
        <ShieldCheck size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>탈퇴 처리 중인 계정입니다</h1>
        <p style={{ color: '#64748b', marginBottom: '24px', lineHeight: '1.5' }}>
          현재 30일 간의 계정 탈퇴 유예 기간이 진행 중이며<br />모든 기능 이용이 제한됩니다.<br/><br/>
          탈퇴를 취소하고 다시 스포츠메이트를 이용하시려면<br />아래 버튼을 눌러주세요.
        </p>
        <button 
          onClick={handleCancelDeletion}
          disabled={canceling}
          style={{ padding: '12px 24px', background: '#3b82f6', color: '#fff', borderRadius: '8px', fontWeight: 'bold', border: 'none', cursor: 'pointer', fontSize: '16px' }}
        >
          {canceling ? "처리 중..." : "탈퇴 철회하기"}
        </button>
        
        <button 
          onClick={logout}
          style={{ marginTop: '24px', padding: '8px', background: 'transparent', color: '#64748b', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
        >
          로그아웃
        </button>
      </div>
    );
  }

  const content = isMobile ? (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  ) : (
    <DesktopLayout>
      <Outlet />
    </DesktopLayout>
  );

  return (
    <>
      {content}
      {toast ? <div className="app-toast" role="status" aria-live="polite">{toast}</div> : null}
      {!hideChatbotFloating ? (
        <Link className="desktop-chatbot-floating" to="/chatbot" aria-label="AI 챗봇 열기">
          <span className="desktop-chatbot-floating__logo"><img src="/img/sportsmate_bot.png" alt="" /></span>
          <span className="desktop-chatbot-floating__text">
            <strong>AI 챗봇</strong>
          </span>
        </Link>
      ) : null}
      {permissionGuideOpen ? (
        <div className="mobile-permission-guide" role="dialog" aria-modal="true" aria-label="앱 권한 안내">
          <button className="mobile-permission-guide__backdrop" type="button" onClick={closePermissionGuide} aria-label="닫기" />
        <button className="mobile-permission-guide__close" type="button" onClick={closePermissionGuide} aria-label="닫기"><X size={20} /></button>
          <section>
            <div className="mobile-permission-guide__icon">
              <ShieldCheck size={26} />
            </div>
            <span>앱 권한 안내</span>
            <h2>모임 소식과 주변 매칭을 더 빠르게 받아보세요.</h2>
            <p>알림은 신청 승인과 채팅 메시지 안내에 사용하고, 위치는 주변 모임 추천과 위치 공유에 사용합니다.</p>
            <div className="mobile-permission-guide__actions">
              <button className="is-push" type="button" onClick={requestPushPermission}><BellRing size={17} />알림 권한 설정하기</button>
              <button className="is-location" type="button" onClick={requestLocationPermission}><MapPin size={17} />위치 권한 설정하기</button>
            </div>
            {permissionMessage ? <p className="mobile-permission-guide__message">{permissionMessage}</p> : null}
            <button className="mobile-permission-guide__skip" type="button" onClick={closePermissionGuide}>{(pushPermissionGranted && locationPermissionGranted) ? "닫기" : "나중에 하기"}</button>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default ResponsiveLayout;
