import ResponsivePage from "../components/common/ResponsivePage.jsx";
import DesktopChatbotPage from "../components/chatbot/desktop/DesktopChatbotPage.jsx";
import MobileChatbotPage from "../components/chatbot/mobile/MobileChatbotPage.jsx";

function ChatbotPage() {
  return <ResponsivePage mobile={MobileChatbotPage} desktop={DesktopChatbotPage} />;
}

export default ChatbotPage;