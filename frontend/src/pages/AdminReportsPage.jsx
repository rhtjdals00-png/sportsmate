import DesktopAdminPanel from "../components/admin/desktop/DesktopAdminPanel.jsx";
import MobileAdminPanel from "../components/admin/mobile/MobileAdminPanel.jsx";
import ResponsivePage from "../components/common/ResponsivePage.jsx";

function AdminReportsPage() {
  return <ResponsivePage mobile={() => <MobileAdminPanel title="신고 관리" />} desktop={() => <DesktopAdminPanel title="신고 관리" />} />;
}

export default AdminReportsPage;
