import { useResponsive } from "../hooks/useResponsive";
import MobileChatRoom from "../components/chat/mobile/MobileChatRoom.jsx";
import DesktopChatRoom from "../components/chat/desktop/DesktopChatRoom.jsx";

function ChatRoomPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileChatRoom /> : <DesktopChatRoom />;
}

export default ChatRoomPage;

