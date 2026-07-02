import { Home, List, LogOut, MessageCircle, Search, User } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext.jsx";

const navItems = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "모임게시판", icon: List },
  { to: "/chats", label: "채팅", icon: MessageCircle },
  { to: "/mypage", label: "내 정보", icon: User }
];

const copy = {
  brandAlt: "SportsMate 로고",
  searchPlaceholder: "종목, 장소, 모임명을 검색해주세요",
  searchLabel: "모임 검색",
  search: "검색",
  logout: "로그아웃",
  loginRegister: "로그인/회원가입",
  modalTitle: "로그아웃하시겠습니까?",
  modalBody: "현재 계정의 로그인 상태가 종료됩니다.",
  cancel: "취소",
  confirm: "확인"
};

function DesktopHeader() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const runSearch = (value = keyword) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    navigate(`/meetings?q=${encodeURIComponent(trimmed)}`);
  };

  const submitSearch = (event) => {
    event.preventDefault();
    runSearch();
  };

  const confirmLogout = async () => {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
    setShowLogoutConfirm(false);
    navigate("/");
  };

  return (
    <>
      <header className="desktop-header">
        <div className="desktop-header__top">
          <Link className="desktop-header__brand" to="/">
            <span className="brand-logo-box">
              <img src="/img/test3.png" alt={copy.brandAlt} />
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
              placeholder={copy.searchPlaceholder}
              aria-label={copy.searchLabel}
            />
            <button type="submit" aria-label={copy.search}>
              <Search size={18} />
            </button>
          </form>
          <div className="desktop-header__actions">
            {(user?.role === "admin" || user?.role === "superadmin") && (
              <Link to="/admin" className="desktop-header__admin-btn">
                관리자 페이지
              </Link>
            )}
            {isAuthenticated ? (
              <button type="button" className="desktop-header__login" onClick={() => setShowLogoutConfirm(true)} title={user?.email || copy.logout}>
                <LogOut size={16} />
                {copy.logout}
              </button>
            ) : (
              <Link to="/login" className="desktop-header__login">{copy.loginRegister}</Link>
            )}
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

      {showLogoutConfirm ? (
        <div className="desktop-logout-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-logout-title" onMouseDown={(event) => event.target === event.currentTarget && setShowLogoutConfirm(false)}>
          <section className="desktop-logout-modal__panel">
            <h2 id="desktop-logout-title">{copy.modalTitle}</h2>
            <p>{copy.modalBody}</p>
            <div className="desktop-logout-modal__actions">
              <button type="button" onClick={() => setShowLogoutConfirm(false)} disabled={loggingOut}>{copy.cancel}</button>
              <button type="button" className="is-primary" onClick={confirmLogout} disabled={loggingOut}>{loggingOut ? copy.logout : copy.confirm}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default DesktopHeader;
