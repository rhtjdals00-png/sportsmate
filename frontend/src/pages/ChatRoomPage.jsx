import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileChatRoom from "../components/chat/mobile/MobileChatRoom.jsx";
import DesktopChatRoom from "../components/chat/desktop/DesktopChatRoom.jsx";

function ChatRoomPage() {
  return <ResponsivePage mobile={MobileChatRoom} desktop={DesktopChatRoom} />;
}

export default ChatRoomPage;

