import { useEffect, useState } from "react";
import { BellRing, MapPin, ShieldCheck, X } from "lucide-react";
import { Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useResponsive } from "../hooks/useResponsive";
import { enablePushNotifications } from "../utils/pushNotifications";
import MobileLayout from "./MobileLayout.jsx";
import DesktopLayout from "./DesktopLayout.jsx";

const AUTH_ROUTES = ["/login", "/register", "/auth/callback", "/profile/intro", "/profile/setup"];

function ResponsiveLayout() {
  const { isMobile } = useResponsive();
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [toast, setToast] = useState("");
  const [permissionGuideOpen, setPermissionGuideOpen] = useState(false);
  const [permissionMessage, setPermissionMessage] = useState("");
  const [pushPermissionGranted, setPushPermissionGranted] = useState(false);
  const [locationPermissionGranted, setLocationPermissionGranted] = useState(false);
  const permissionStorageKey = user?.id ? `sportsmate_permission_onboarding_${user.id}` : "";

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
