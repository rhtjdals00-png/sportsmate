import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileMeetingList from "../components/meeting/mobile/MobileMeetingList.jsx";
import DesktopMeetingList from "../components/meeting/desktop/DesktopMeetingList.jsx";

function MeetingListPage() {
  return <ResponsivePage mobile={MobileMeetingList} desktop={DesktopMeetingList} />;
}

export default MeetingListPage;

