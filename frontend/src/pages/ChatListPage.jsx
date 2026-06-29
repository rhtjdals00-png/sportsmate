import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileChatList from "../components/chat/mobile/MobileChatList.jsx";
import DesktopChatList from "../components/chat/desktop/DesktopChatList.jsx";

function ChatListPage() {
  return <ResponsivePage mobile={MobileChatList} desktop={DesktopChatList} />;
}

export default ChatListPage;

