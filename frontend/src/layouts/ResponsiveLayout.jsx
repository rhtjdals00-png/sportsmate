import { Outlet } from "react-router-dom";
import { useResponsive } from "../hooks/useResponsive";
import MobileLayout from "./MobileLayout.jsx";
import DesktopLayout from "./DesktopLayout.jsx";

function ResponsiveLayout() {
  const { isMobile } = useResponsive();
  return isMobile ? (
    <MobileLayout>
      <Outlet />
    </MobileLayout>
  ) : (
    <DesktopLayout>
      <Outlet />
    </DesktopLayout>
  );
}

export default ResponsiveLayout;

