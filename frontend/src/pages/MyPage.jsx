import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileMyPage from "../components/profile/mobile/MobileMyPage.jsx";
import DesktopMyPage from "../components/profile/desktop/DesktopMyPage.jsx";

function MyPage() {
  return <ResponsivePage mobile={MobileMyPage} desktop={DesktopMyPage} />;
}

export default MyPage;

