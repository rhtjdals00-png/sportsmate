import { useResponsive } from "../hooks/useResponsive";
import MobileMeetingCreate from "../components/meeting/mobile/MobileMeetingCreate.jsx";
import DesktopMeetingCreate from "../components/meeting/desktop/DesktopMeetingCreate.jsx";

function MeetingCreatePage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileMeetingCreate /> : <DesktopMeetingCreate />;
}

export default MeetingCreatePage;

