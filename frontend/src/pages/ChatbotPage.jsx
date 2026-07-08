import ResponsivePage from "../components/common/ResponsivePage.jsx";
import MobileChatbotPage from "../components/chatbot/mobile/MobileChatbotPage.jsx";

function DesktopChatbotFallback() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '16px', color: '#40506a' }}>
      <h2 style={{ fontWeight: 800 }}>AI 챗봇 서비스</h2>
      <p>AI 챗봇 기능은 모바일 앱 버전에서 최적화되어 제공됩니다.</p>
      <p style={{ fontSize: '14px', color: '#94a3b8' }}>모바일 화면으로 접속하시거나 브라우저 크기를 줄여서 확인해주세요.</p>
    </div>
  );
}

function ChatbotPage() {
  return <ResponsivePage mobile={MobileChatbotPage} desktop={DesktopChatbotFallback} />;
}

export default ChatbotPage;
