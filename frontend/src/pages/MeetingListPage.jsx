import { useResponsive } from "../hooks/useResponsive";
import MobileMeetingList from "../components/meeting/mobile/MobileMeetingList.jsx";
import DesktopMeetingList from "../components/meeting/desktop/DesktopMeetingList.jsx";

function MeetingListPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileMeetingList /> : <DesktopMeetingList />;
}

export default MeetingListPage;

