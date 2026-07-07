import ResponsivePage from "../components/common/ResponsivePage.jsx";
import DesktopNotifications from "../components/notification/DesktopNotifications.jsx";
import MobileNotifications from "../components/notification/mobile/MobileNotifications.jsx";

function NotificationsPage() {
  return <ResponsivePage mobile={MobileNotifications} desktop={DesktopNotifications} />;
}

export default NotificationsPage;

