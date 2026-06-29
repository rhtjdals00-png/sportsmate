import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileMeetingCreate from "../components/meeting/mobile/MobileMeetingCreate.jsx";
import DesktopMeetingCreate from "../components/meeting/desktop/DesktopMeetingCreate.jsx";

function MeetingCreatePage() {
  return <ResponsivePage mobile={MobileMeetingCreate} desktop={DesktopMeetingCreate} />;
}

export default MeetingCreatePage;

