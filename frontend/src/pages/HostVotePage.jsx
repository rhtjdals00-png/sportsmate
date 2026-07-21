import DesktopHostVote from "../components/host/desktop/DesktopHostVote.jsx";
import MobileHostVote from "../components/host/mobile/MobileHostVote.jsx";
import { useResponsive } from "../hooks/useResponsive";

function HostVotePage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileHostVote /> : <DesktopHostVote />;
}

export default HostVotePage;
