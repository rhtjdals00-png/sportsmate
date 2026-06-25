import { useResponsive } from "../hooks/useResponsive";
import MobileMeetingDetail from "../components/meeting/mobile/MobileMeetingDetail.jsx";
import DesktopMeetingDetail from "../components/meeting/desktop/DesktopMeetingDetail.jsx";

function MeetingDetailPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileMeetingDetail /> : <DesktopMeetingDetail />;
}

export default MeetingDetailPage;

