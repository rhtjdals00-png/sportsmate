import { ArrowLeft, Bell, Bot, Search, Settings } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { notificationApi } from "../../../api/notificationApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { visibleNotifications } from "../../../utils/notificationDisplay";

const titles = {
  "/": "SportsMate",
  "/meetings": "모임 찾기",
  "/chats": "채팅",
  "/notifications": "알림",
  "/mypage": "마이페이지",
  "/settings": "앱 설정",
  "/host": "방장 관리"
};

function MobileHeader({ title, showLogo = false, actions = null, showBack = true }) {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedTitle = title || titles[location.pathname] || "SportsMate";
  const canGoBack = showBack && location.pathname !== "/";
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

  const fetchUnreadNotifications = async () => {
    if (!user) return;
    try {
      const data = await notificationApi.list();
      const visible = visibleNotifications(data.items || []);
      const unreadCount = visible.filter(item => !item.is_read).length;
      setUnreadNotifCount(unreadCount);
    } catch {
      setUnreadNotifCount(0);
    }
  };

  useEffect(() => {
    if (!user) return undefined;
    fetchUnreadNotifications();
    
    const handleUpdate = () => {
      fetchUnreadNotifications();
    };
    window.addEventListener("notifications_updated", handleUpdate);
    
    const timer = setInterval(fetchUnreadNotifications, 15000);
    return () => {
      clearInterval(timer);
      window.removeEventListener("notifications_updated", handleUpdate);
    };
  }, [user]);

  return (
    <header className="mobile-header">
      {canGoBack ? (
        <button className="mobile-header__back" type="button" onClick={goBack} aria-label="뒤로가기">
          <ArrowLeft size={20} />
        </button>
      ) : null}
      <Link to="/" className="mobile-header__brand">
        {showLogo && <img src="/images/logo.png" alt="SportsMate" />}
        <span>{resolvedTitle}</span>
      </Link>
      {actions || (
        <div className="mobile-header__actions">
          <button
            type="button"
            className="mobile-header__chatbot-btn"
            onClick={() => navigate("/chatbot")}
            aria-label="AI 챗봇"
          >
            <Bot size={17} />
            <span>AI</span>
          </button>
          <Link to="/meetings" aria-label="검색">
            <Search size={20} />
          </Link>
          <Link to="/notifications" aria-label="알림" style={{ position: 'relative' }}>
            <Bell size={20} />
            {unreadNotifCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                backgroundColor: '#ef4444',
                color: 'white',
                borderRadius: '50%',
                padding: '2px 4px',
                fontSize: '8px',
                fontWeight: '900',
                lineHeight: '1',
                minWidth: '11px',
                textAlign: 'center',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.15)'
              }}>
                {unreadNotifCount}
              </span>
            )}
          </Link>
          <Link to="/settings" aria-label="앱 설정">
            <Settings size={20} />
          </Link>
        </div>
      )}

    </header>
  );
}

export default MobileHeader;
