import { ArrowLeft, Bell, Search, Settings } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

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
  const location = useLocation();
  const navigate = useNavigate();
  const resolvedTitle = title || titles[location.pathname] || "SportsMate";
  const canGoBack = showBack && location.pathname !== "/";

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/");
  };

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
          <Link to="/meetings" aria-label="검색">
            <Search size={20} />
          </Link>
          <Link to="/notifications" aria-label="알림">
            <Bell size={20} />
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
