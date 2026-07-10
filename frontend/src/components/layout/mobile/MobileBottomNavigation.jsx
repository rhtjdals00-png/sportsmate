import { CalendarCheck, Home, MessageCircle, Search, User } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { chatApi } from "../../../api/chatApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";

const items = [
  { to: "/", label: "홈", icon: Home },
  { to: "/meetings", label: "검색", icon: Search },
  { to: "/mypage/meetings", label: "내 모임", icon: CalendarCheck },
  { to: "/chats", label: "채팅", icon: MessageCircle },
  { to: "/mypage", label: "내 정보", icon: User }
];

function MobileBottomNavigation() {
  const { user } = useAuth();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const isItemActive = (to) => {
    if (to === "/") return location.pathname === "/";
    if (to === "/mypage") return location.pathname.startsWith("/mypage") && !location.pathname.startsWith("/mypage/meetings");
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const fetchUnreadCount = async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const [roomsRes, directRes] = await Promise.all([
        chatApi.rooms().catch(() => ({ items: [] })),
        chatApi.directRooms().catch(() => ({ items: [] }))
      ]);
      const meetingUnread = (roomsRes.items || []).reduce((acc, r) => acc + (r.unread_count || 0), 0);
      const directUnread = (directRes.items || []).reduce((acc, r) => acc + (r.unread_count || 0), 0);
      setUnreadCount(meetingUnread + directUnread);
    } catch (e) {
      console.error("Failed to fetch unread chat count", e);
    }
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return undefined;
    }
    fetchUnreadCount();

    const interval = setInterval(() => {
      if (document.hidden) return;
      fetchUnreadCount();
    }, 3000);

    return () => clearInterval(interval);
  }, [user]);

  useEffect(() => {
    if (!user || !isSupabaseConfigured || !supabase) return undefined;

    const channel = supabase
      .channel("mobile-nav-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages" },
        () => fetchUnreadCount()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_chat_messages" },
        () => fetchUnreadCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => {
        const Icon = item.icon;
        const isChat = item.to === "/chats";
        return (
          <NavLink key={item.to} to={item.to} className={() => (isItemActive(item.to) ? "active" : "")}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={21} />
              {isChat && unreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-8px',
                  backgroundColor: '#ef4444',
                  color: 'white',
                  borderRadius: '50%',
                  padding: '2px 5px',
                  fontSize: '9px',
                  fontWeight: '900',
                  lineHeight: '1',
                  minWidth: '13px',
                  textAlign: 'center',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.15)'
                }}>
                  {unreadCount}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}

export default MobileBottomNavigation;
