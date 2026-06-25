import { useResponsive } from "../hooks/useResponsive";
import MobileHostDashboard from "../components/host/mobile/MobileHostDashboard.jsx";
import DesktopHostDashboard from "../components/host/desktop/DesktopHostDashboard.jsx";

function HostDashboardPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileHostDashboard /> : <DesktopHostDashboard />;
}

export default HostDashboardPage;

