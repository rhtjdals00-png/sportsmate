import { Home, List, MessageCircle, Search, User } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";

const navItems = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "모임게시판", icon: List },
  { to: "/chats", label: "내 채팅", icon: MessageCircle },
  { to: "/mypage", label: "내 정보", icon: User }
];

function DesktopHeader() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState("");

  const runSearch = (value = keyword) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    navigate(`/meetings?q=${encodeURIComponent(trimmed)}`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    runSearch();
  };

  return (
    <header className="desktop-header">
      <div className="desktop-header__top">
        <Link className="desktop-header__brand" to="/">
          <span className="brand-logo-box">
            <img src="/img/test3.png" alt="Sportsmate 로고" />
          </span>
          SPORTSMATE
        </Link>
        <form className="desktop-header__search" onSubmit={submitSearch}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                runSearch(event.currentTarget.value);
              }
            }}
            placeholder="종목, 장소, 모임명을 검색해주세요"
            aria-label="모임 검색"
          />
          <button type="submit" aria-label="검색">
            <Search size={18} />
          </button>
        </form>
        <div className="desktop-header__actions">
          <Link to="/login" className="desktop-header__login">로그인/회원가입</Link>
        </div>
      </div>
      <div className="desktop-header__nav-row">
        <nav className="desktop-header__nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.to} to={item.to} end={item.to === "/"}>
                <Icon size={16} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

export default DesktopHeader;
