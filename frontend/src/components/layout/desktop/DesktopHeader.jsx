import { Home, List, LogOut, MessageCircle, Search, User } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../../../contexts/AuthContext.jsx";

const navItems = [
  { to: "/", label: "\ud648", icon: Home },
  { to: "/meetings", label: "\ubaa8\uc784\uac8c\uc2dc\ud310", icon: List },
  { to: "/chats", label: "\ucc44\ud305", icon: MessageCircle },
  { to: "/mypage", label: "\ub0b4 \uc815\ubcf4", icon: User }
];

const copy = {
  brandAlt: "SportsMate \ub85c\uace0",
  searchPlaceholder: "\uc885\ubaa9, \uc7a5\uc18c, \ubaa8\uc784\uba85\uc744 \uac80\uc0c9\ud574\uc8fc\uc138\uc694",
  searchLabel: "\ubaa8\uc784 \uac80\uc0c9",
  search: "\uac80\uc0c9",
  logout: "\ub85c\uadf8\uc544\uc6c3",
  loginRegister: "\ub85c\uadf8\uc778/\ud68c\uc6d0\uac00\uc785",
  modalTitle: "\ub85c\uadf8\uc544\uc6c3\ud558\uc2dc\uaca0\uc2b5\ub2c8\uae4c?",
  modalBody: "\ud604\uc7ac \uacc4\uc815\uc758 \ub85c\uadf8\uc778 \uc0c1\ud0dc\uac00 \uc885\ub8cc\ub429\ub2c8\ub2e4.",
  cancel: "\ucde8\uc18c",
  confirm: "\ud655\uc778"
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
