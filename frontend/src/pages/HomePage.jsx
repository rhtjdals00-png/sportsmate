import { useResponsive } from "../hooks/useResponsive";
import MobileHome from "../components/home/mobile/MobileHome.jsx";
import DesktopHome from "../components/home/desktop/DesktopHome.jsx";

function HomePage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileHome /> : <DesktopHome />;
}

export default HomePage;

