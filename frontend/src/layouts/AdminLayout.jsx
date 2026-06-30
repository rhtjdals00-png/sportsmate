import { useState } from "react";
import { Outlet, NavLink, useLocation, Link } from "react-router-dom";
import { 
  Home, 
  Users, 
  Trophy, 
  AlertTriangle, 
  Settings, 
  Search, 
  Bell, 
  ChevronDown,
  BarChart3,
  Plus
} from "lucide-react";

function AdminLayout() {
  const location = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);

  // Determine header title based on current route
  const getHeaderTitle = () => {
    if (location.pathname.startsWith("/admin/users/")) {
      return "회원 상세 정보";
    }
    if (location.pathname.startsWith("/admin/meetings/")) {
      return "모임 상세 정보";
    }
    switch (location.pathname) {
      case "/admin/users":
        return "회원 관리";
      case "/admin/meetings":
        return "모임 관리";
      case "/admin/reports":
        return "신고 및 제재 리포트 관리";
      case "/admin/analytics":
        return "전체 통계 대시보드";
      case "/admin":
      default:
        return "관리자 운영 관리";
    }
  };

  return (
    <div className="admin-layout-container">
      {/* 1. Left Sidebar Navigation */}
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
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Home size={18} />
            <span>홈</span>
          </NavLink>
          
          <NavLink 
            to="/admin/users" 
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Users size={18} />
            <span>회원 관리</span>
          </NavLink>
          
          <NavLink 
            to="/admin/meetings" 
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <Trophy size={18} />
            <span>모임 관리</span>
          </NavLink>

          <NavLink 
            to="/admin/analytics" 
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <BarChart3 size={18} />
            <span>보고서 및 분석</span>
          </NavLink>

          <NavLink 
            to="/admin/reports" 
            className={({ isActive }) => 
              `admin-sidebar__nav-item${isActive ? " active" : ""}`
            }
          >
            <AlertTriangle size={18} />
            <span>리포트 관리</span>
          </NavLink>

          <a 
            href="#settings" 
            className="admin-sidebar__nav-item"
            onClick={(e) => {
              e.preventDefault();
              alert("시스템 설정 메뉴는 준비 중입니다.");
            }}
          >
            <Settings size={18} />
            <span>시스템 설정</span>
          </a>
        </nav>



        <div className="admin-sidebar__footer">
          {showDropdown && (
            <div className="admin-profile-dropdown codex-style">
              <div className="admin-profile-dropdown__header">
                <span className="admin-profile-dropdown__email">admin@system.com</span>
                <span className="admin-profile-dropdown__badge">관리자 계정</span>
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
              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&fit=crop&q=80" 
              alt="Admin Avatar" 
              className="admin-profile-card__avatar"
              onError={(e) => {
                e.target.style.display = "none";
              }}
            />
            <div className="admin-profile-card__info">
              <span className="admin-profile-card__name">Admin</span>
              <span className="admin-profile-card__email">admin@system.com</span>
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

      {/* 2. Right Content Pane */}
      <main className="admin-main">
        {/* Upper Header Control Row */}
        <header className="admin-header">
          <h1 className="admin-header__title">{getHeaderTitle()}</h1>
        </header>

        {/* Content Render Target */}
        <div className="admin-scroll-content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default AdminLayout;
