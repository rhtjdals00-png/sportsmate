import { useResponsive } from "../hooks/useResponsive";
import MobileChatList from "../components/chat/mobile/MobileChatList.jsx";
import DesktopChatList from "../components/chat/desktop/DesktopChatList.jsx";

function ChatListPage() {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileChatList /> : <DesktopChatList />;
}

export default ChatListPage;

