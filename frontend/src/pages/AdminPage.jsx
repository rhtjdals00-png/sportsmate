import DesktopAdminPanel from "../components/admin/desktop/DesktopAdminPanel.jsx";
import MobileAdminPanel from "../components/admin/mobile/MobileAdminPanel.jsx";
import ResponsivePage from "../components/common/ResponsivePage.jsx";

function AdminPage() {
  return <ResponsivePage mobile={() => <MobileAdminPanel title="관리자 관리" />} desktop={() => <DesktopAdminPanel title="관리자" />} />;
}

export default AdminPage;
