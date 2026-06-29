import DesktopAdminPanel from "../components/admin/desktop/DesktopAdminPanel.jsx";
import MobileAdminPanel from "../components/admin/mobile/MobileAdminPanel.jsx";
import ResponsivePage from "../components/common/ResponsivePage.jsx";

function AdminUsersPage() {
  return <ResponsivePage mobile={() => <MobileAdminPanel title="회원 관리" />} desktop={() => <DesktopAdminPanel title="회원 관리" />} />;
}

export default AdminUsersPage;
