import DesktopAdminPanel from "../components/admin/desktop/DesktopAdminPanel.jsx";
import MobileAdminPanel from "../components/admin/mobile/MobileAdminPanel.jsx";
import ResponsivePage from "../components/common/ResponsivePage.jsx";

function AdminMeetingsPage() {
  return <ResponsivePage mobile={() => <MobileAdminPanel title="모임 관리" />} desktop={() => <DesktopAdminPanel title="모임 관리" />} />;
}

export default AdminMeetingsPage;
