import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useResponsive } from "../hooks/useResponsive";
import MobileLayout from "./MobileLayout.jsx";
import DesktopLayout from "./DesktopLayout.jsx";

function ResponsiveLayout() {
  const { isMobile } = useResponsive();
  const location = useLocation();
  const [toast, setToast] = useState("");

  useEffect(() => {
    const message = sessionStorage.getItem("sportsmate_flash");
    if (!message) return;
    sessionStorage.removeItem("sportsmate_flash");
    setToast(message);
    const timer = window.setTimeout(() => setToast(""), 2600);
    return () => window.clearTimeout(timer);
  }, [location.key]);

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
    </>
  );
}

export default ResponsiveLayout;
