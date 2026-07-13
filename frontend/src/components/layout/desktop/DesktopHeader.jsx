import { Bell, BellRing, Headphones, Home, List, LogOut, Megaphone, MessageCircle, Search, User, Vote } from "lucide-react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { notificationApi } from "../../../api/notificationApi";
import {
  dismissNotificationKey,
  notificationKey,
  notificationLinkUrl,
  notificationMessage,
  notificationTitle,
  visibleNotifications
} from "../../../utils/notificationDisplay";

const navItems = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "모임게시판", icon: List },
  { to: "/chats", label: "채팅", icon: MessageCircle },
  { to: "/mypage", label: "내 정보", icon: User },
  { to: "/support", label: "고객센터", icon: Headphones }
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

function formatNotificationTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function NotificationIcon({ type }) {
  if (type === "chat") return <MessageCircle size={16} />;
  if (type === "notice") return <Megaphone size={16} />;
  if (type === "vote") return <Vote size={16} />;
  return <BellRing size={16} />;
}

function DesktopHeader() {
  const navigate = useNavigate();
  const { isAuthenticated, logout, user } = useAuth();
  const [keyword, setKeyword] = useState("");
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationSummary, setNotificationSummary] = useState({ unread_count: 0, items: [] });
  const [notificationLoading, setNotificationLoading] = useState(false);
  const notificationRef = useRef(null);
  const notificationItems = visibleNotifications(notificationSummary.items || []);

  const loadNotifications = async () => {
    if (!isAuthenticated) return;
    setNotificationLoading(true);
    try {
      const data = await notificationApi.summary();
      const visibleItems = visibleNotifications(data.items || []);
      setNotificationSummary({ ...data, unread_count: visibleItems.length, items: data.items || [] });
    } catch {
      setNotificationSummary({ unread_count: 0, items: [] });
    } finally {
      setNotificationLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setNotificationSummary({ unread_count: 0, items: [] });
      setNotificationOpen(false);
      return undefined;
    }
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated]);

  useEffect(() => {
    if (!notificationOpen) return undefined;
    const closeOnOutside = (event) => {
      if (notificationRef.current?.contains(event.target)) return;
      setNotificationOpen(false);
    };
    window.addEventListener("pointerdown", closeOnOutside);
    return () => window.removeEventListener("pointerdown", closeOnOutside);
  }, [notificationOpen]);

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

  const openNotificationItem = async (item) => {
    setNotificationOpen(false);
    const key = notificationKey(item);
    dismissNotificationKey(key);
    setNotificationSummary((current) => {
      const nextItems = (current.items || []).filter((candidate) => notificationKey(candidate) !== key);
      return { ...current, unread_count: nextItems.length, items: nextItems };
    });
    if (item.source === "admin" && Number.isInteger(Number(item.id))) {
      try {
        await notificationApi.read(item.id);
      } catch {
        // 이동을 막지 않습니다.
      }
    }
    const targetUrl = notificationLinkUrl(item);
    if (targetUrl) navigate(targetUrl);
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
              <div className="desktop-header__notification" ref={notificationRef}>
                <button
                  type="button"
                  className="desktop-header__notification-trigger"
                  onClick={() => {
                    setNotificationOpen((current) => !current);
                    loadNotifications();
                  }}
                  aria-label="알림"
                  aria-expanded={notificationOpen}
                >
                  <Bell size={17} />
                  {notificationItems.length > 0 ? <span>{notificationItems.length > 99 ? "99+" : notificationItems.length}</span> : null}
                </button>
                {notificationOpen ? (
                  <section className="desktop-header__notification-panel" aria-label="알림 목록">
                    <header>
                      <strong>알림</strong>
                      <Link to="/notifications" onClick={() => setNotificationOpen(false)}>전체 보기</Link>
                    </header>
                    <div>
                      {notificationItems.length ? notificationItems.map((item) => (
                        <button key={`${item.source || item.type}-${item.id}`} type="button" onClick={() => openNotificationItem(item)}>
                          <span className={`desktop-header__notification-icon is-${item.type}`}>
                            <NotificationIcon type={item.type} />
                          </span>
                          <span>
                            <b>{notificationTitle(item)}</b>
                            <small>{notificationMessage(item)}</small>
                            <time>{formatNotificationTime(item.created_at)}</time>
                          </span>
                        </button>
                      )) : (
                        <p>{notificationLoading ? "알림을 확인 중입니다." : "새 알림이 없습니다."}</p>
                      )}
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}
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
              <button type="button" className="is-primary" onClick={confirmLogout} disabled={loggingOut}>{copy.logout}</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}

export default DesktopHeader;
