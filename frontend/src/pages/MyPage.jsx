import { useResponsive } from "../hooks/useResponsive";
import MobileMyPage from "../components/profile/mobile/MobileMyPage.jsx";
import DesktopMyPage from "../components/profile/desktop/DesktopMyPage.jsx";

function MyPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileMyPage /> : <DesktopMyPage />;
}

export default MyPage;

