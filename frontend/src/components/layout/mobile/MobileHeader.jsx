import { Bell, Search, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const titles = {
  "/": "SportsMate",
  "/meetings": "모임 찾기",
  "/chats": "채팅",
  "/notifications": "알림",
  "/mypage": "마이페이지",
  "/host": "방장 관리"
};

function MobileHeader({ title, showLogo = false }) {
  const location = useLocation();
  const resolvedTitle = title || titles[location.pathname] || "SportsMate";

  return (
    <header className="mobile-header">
      <Link to="/" className="mobile-header__brand">
        {showLogo && <img src="/images/logo.png" alt="SportsMate" />}
        <span>{resolvedTitle}</span>
      </Link>
      <div className="mobile-header__actions">
        <Link to="/meetings" aria-label="검색">
          <Search size={20} />
        </Link>
        <Link to="/notifications" aria-label="알림">
          <Bell size={20} />
        </Link>
        <Link to="/mypage/profile" aria-label="설정">
          <Settings size={20} />
        </Link>
      </div>
    </header>
  );
}

export default MobileHeader;

