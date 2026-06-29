import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileHostDashboard from "../components/host/mobile/MobileHostDashboard.jsx";
import DesktopHostDashboard from "../components/host/desktop/DesktopHostDashboard.jsx";

function HostDashboardPage() {
  return <ResponsivePage mobile={MobileHostDashboard} desktop={DesktopHostDashboard} />;
}

export default HostDashboardPage;

