import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { 
  Home, 
  Users, 
  Trophy, 
  AlertTriangle, 
  Settings, 
  ChevronDown,
  BarChart3,
  Bell,
  ClipboardList,
  Headphones
} from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";
import { useAuth } from "../contexts/AuthContext.jsx";
import { adminApi } from "../api/adminApi";
import MobileBottomNavigation from "../components/layout/mobile/MobileBottomNavigation.jsx";

function AdminLayout() {
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { user } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingReportsCount, setPendingReportsCount] = useState(0);
  const [pendingInquiriesCount, setPendingInquiriesCount] = useState(0);

  useEffect(() => {
    async function fetchCounts() {
      try {
        const reportsData = await adminApi.reports();
        if (reportsData && reportsData.items) {
          const count = reportsData.items.filter(item => item.status === "pending" || item.status === "대기 중").length;
          setPendingReportsCount(count);
        }
      } catch (err) {
        console.error("Failed to fetch reports count:", err);
      }

      try {
        const inquiriesData = await adminApi.supportInquiries({ status: "pending" });
        if (inquiriesData && inquiriesData.items) {
          setPendingInquiriesCount(inquiriesData.items.length);
        }
      } catch (err) {
        console.error("Failed to fetch inquiries count:", err);
      }
    }
    fetchCounts();

    const handleUpdate = () => fetchCounts();
    window.addEventListener("inquiries_updated", handleUpdate);
    window.addEventListener("reports_updated", handleUpdate);

    const interval = setInterval(fetchCounts, 10000);

    return () => {
      window.removeEventListener("inquiries_updated", handleUpdate);
      window.removeEventListener("reports_updated", handleUpdate);
      clearInterval(interval);
    };
  }, []);

  const handleNavItemClick = (e, path) => {
    if (location.pathname === path) {
      e.preventDefault();
      window.location.reload();
    }
  };

  // 현재 관리자 라우트에 맞춰 헤더 제목을 결정합니다.
  const getHeaderTitle = () => {
    if (location.pathname.startsWith("/admin/users/")) {
      return "회원 상세 정보";
    }
    if (location.pathname.startsWith("/admin/meetings/")) {
      return "모임 상세 정보";
    }
    if (location.pathname.startsWith("/admin/reports/")) {
      return "신고 상세 처리";
    }
    switch (location.pathname) {
      case "/admin/users":
        return "회원 관리";
      case "/admin/meetings":
        return "모임 관리";
      case "/admin/reports":
        return "신고 관리";
      case "/admin/broadcast":
        return "전체 공지 및 알림 발송";
      case "/admin/analytics":
        return "전체 통계 대시보드";
      case "/admin/audit-logs":
        return "관리자 작업 이력 로그";
      case "/admin/support":
        return "고객 문의 관리";
      case "/admin/settings":
        return "시스템 설정";
      case "/admin":
      default:
        return "관리자 운영 관리";
    }
  };

  if (isMobile) {
    return (
      <div className="mobile-shell">
        <main className="mobile-main">
          <Outlet />
        </main>
        <MobileBottomNavigation />
      </div>
    );
  }

  return (
    <div className="admin-layout-container">
      {/* 왼쪽 관리자 사이드바 내비게이션입니다. */}
      <aside className="admin-sidebar">
        <div className="admin-sidebar__brand">
          <img src="/images/logo.png" alt="SportsMate" className="admin-sidebar__logo-img" />
          <div className="admin-sidebar__logo-text">
            <span className="admin-sidebar__logo-title">SPORTSMATE</span>
            <span className="admin-sidebar__logo-subtitle">Admin Dashboard</span>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          <NavLink 
            to="/admin" 
            end 
            onClick={(e) => handleNavItemClick(e, "/admin")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Home size={18} />
            <span>홈</span>
          </NavLink>
          
          <NavLink 
            to="/admin/users" 
            onClick={(e) => handleNavItemClick(e, "/admin/users")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Users size={18} />
            <span>회원 관리</span>
          </NavLink>
          
          <NavLink 
            to="/admin/meetings" 
            onClick={(e) => handleNavItemClick(e, "/admin/meetings")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Trophy size={18} />
            <span>모임 관리</span>
          </NavLink>

          <NavLink 
            to="/admin/reports" 
            onClick={(e) => handleNavItemClick(e, "/admin/reports")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <AlertTriangle size={18} />
            <span>신고 관리</span>
            {pendingReportsCount > 0 && (
              <span className="admin-sidebar__badge">{pendingReportsCount}</span>
            )}
          </NavLink>

          <NavLink 
            to="/admin/support" 
            onClick={(e) => handleNavItemClick(e, "/admin/support")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Headphones size={18} />
            <span>고객 문의 관리</span>
            {pendingInquiriesCount > 0 && (
              <span className="admin-sidebar__badge">{pendingInquiriesCount}</span>
            )}
          </NavLink>

          <NavLink 
            to="/admin/broadcast" 
            onClick={(e) => handleNavItemClick(e, "/admin/broadcast")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Bell size={18} />
            <span>전체 알림 및 공지</span>
          </NavLink>

          <NavLink 
            to="/admin/analytics" 
            onClick={(e) => handleNavItemClick(e, "/admin/analytics")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <BarChart3 size={18} />
            <span>보고서 및 분석</span>
          </NavLink>

          <NavLink 
            to="/admin/audit-logs" 
            onClick={(e) => handleNavItemClick(e, "/admin/audit-logs")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <ClipboardList size={18} />
            <span>작업 이력 로그</span>
          </NavLink>

          <NavLink 
            to="/admin/settings" 
            onClick={(e) => handleNavItemClick(e, "/admin/settings")}
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Settings size={18} />
            <span>시스템 설정</span>
          </NavLink>
        </nav>



        <div className="admin-sidebar__footer">
          {showDropdown && (
            <div className="admin-profile-dropdown codex-style">
              <div className="admin-profile-dropdown__header">
                <span className="admin-profile-dropdown__email">{user?.email || "admin@system.com"}</span>
                <span className="admin-profile-dropdown__badge">
                  {user?.role === "superadmin" ? "최고관리자" : "관리자 계정"}
                </span>
              </div>
              <div className="admin-profile-dropdown__divider"></div>
              <Link to="/" className="admin-profile-dropdown__item codex-item" onClick={() => setShowDropdown(false)}>
                <Home size={15} />
                <span>메인으로 돌아가기</span>
              </Link>
            </div>
          )}
          <div 
            className="admin-profile-card" 
            onClick={() => setShowDropdown(prev => !prev)}
            style={{ cursor: "pointer", userSelect: "none" }}
          >
            <img 
              src={user?.profile_image_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80"} 
              alt="Admin Avatar" 
              className="admin-profile-card__avatar"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <div className="admin-profile-card__info">
              <span className="admin-profile-card__name">{user?.nickname || user?.name || "Admin"}</span>
              <span className="admin-profile-card__email">{user?.email || "admin@system.com"}</span>
            </div>
            <ChevronDown 
              size={16} 
              className="admin-profile-card__toggle" 
              style={{ 
                transform: showDropdown ? "rotate(180deg)" : "rotate(0)",
                transition: "transform 0.2s ease" 
              }} 
            />
          </div>
        </div>
      </aside>

      {/* 오른쪽 관리자 콘텐츠 영역입니다. */}
      <main className="admin-main">
        {/* 상단 관리자 헤더입니다. */}
        <header className="admin-header">
          <h1 className="admin-header__title">{getHeaderTitle()}</h1>
        </header>

        {/* 하위 관리자 페이지가 렌더링되는 영역입니다. */}
        <div className="admin-scroll-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
