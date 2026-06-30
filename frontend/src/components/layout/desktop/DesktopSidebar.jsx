import { Bell, Home, MessageCircle, Shield, User, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const items = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "모임 찾기", icon: UsersRound },
  { to: "/chats", label: "채팅", icon: MessageCircle },
  { to: "/notifications", label: "알림", icon: Bell },
  { to: "/mypage", label: "마이페이지", icon: User },
  { to: "/admin", label: "관리자", icon: Shield }
];

function DesktopSidebar() {
  return (
    <aside className="desktop-sidebar">
      <div className="desktop-sidebar__brand">
        <img src="/images/logo.png" alt="SportsMate" />
        <strong>SportsMate</strong>
      </div>
      <nav>
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.to} to={item.to}>
              <Icon size={19} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}

export default DesktopSidebar;

