import { CalendarCheck, Home, MessageCircle, Search, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const items = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "검색", icon: Search },
  { to: "/mypage/meetings", label: "내 모임", icon: CalendarCheck },
  { to: "/chats", label: "채팅", icon: MessageCircle },
  { to: "/mypage", label: "내 정보", icon: User }
];

function MobileBottomNavigation() {
  const location = useLocation();
  const isItemActive = (to) => {
    if (to === "/") return location.pathname === "/";
    if (to === "/mypage") return location.pathname.startsWith("/mypage") && !location.pathname.startsWith("/mypage/meetings");
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} className={() => (isItemActive(item.to) ? "active" : "")}>
            <Icon size={21} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileBottomNavigation;
