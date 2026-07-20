import DesktopHostApplicants from "../components/host/desktop/DesktopHostApplicants.jsx";
import MobileHostApplicants from "../components/host/mobile/MobileHostApplicants.jsx";
import { useResponsive } from "../hooks/useResponsive";

function HostApplicantsPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileHostApplicants /> : <DesktopHostApplicants />;
}

export default HostApplicantsPage;
