import { Bell, Home, MessageCircle, User, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "모임", icon: UsersRound },
  { to: "/chats", label: "채팅", icon: MessageCircle },
  { to: "/notifications", label: "알림", icon: Bell },
  { to: "/mypage", label: "마이", icon: User }
];

function MobileBottomNavigation() {
  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink key={item.to} to={item.to} className={({ isActive }) => (isActive ? "active" : "")}>
            <Icon size={21} />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileBottomNavigation;

