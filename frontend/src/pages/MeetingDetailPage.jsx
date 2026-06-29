import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileMeetingDetail from "../components/meeting/mobile/MobileMeetingDetail.jsx";
import DesktopMeetingDetail from "../components/meeting/desktop/DesktopMeetingDetail.jsx";

function MeetingDetailPage() {
  return <ResponsivePage mobile={MobileMeetingDetail} desktop={DesktopMeetingDetail} />;
}

export default MeetingDetailPage;

