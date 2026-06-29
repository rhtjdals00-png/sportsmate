import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileHome from "../components/home/mobile/MobileHome.jsx";
import DesktopHome from "../components/home/desktop/DesktopHome.jsx";

function HomePage() {
  return <ResponsivePage mobile={MobileHome} desktop={DesktopHome} />;
}

export default HomePage;

