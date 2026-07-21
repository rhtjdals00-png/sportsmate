import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import ResponsiveLayout from "../layouts/ResponsiveLayout.jsx";
import HomePage from "../pages/HomePage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import AccountFindPage from "../pages/AccountFindPage.jsx";
import PasswordResetPage from "../pages/PasswordResetPage.jsx";
import AuthCallbackPage from "../pages/AuthCallbackPage.jsx";
import MeetingListPage from "../pages/MeetingListPage.jsx";
import MeetingDetailPage from "../pages/MeetingDetailPage.jsx";
import MeetingCreatePage from "../pages/MeetingCreatePage.jsx";
import MeetingEditPage from "../pages/MeetingEditPage.jsx";
import ChatListPage from "../pages/ChatListPage.jsx";
import ChatRoomPage from "../pages/ChatRoomPage.jsx";
import ChatbotPage from "../pages/ChatbotPage.jsx";
import MyPage from "../pages/MyPage.jsx";
import ProfileEditPage from "../pages/ProfileEditPage.jsx";
import ProfileIntroPage from "../pages/ProfileIntroPage.jsx";
import ProfileSetupPage from "../pages/ProfileSetupPage.jsx";
import MyMeetingsPage from "../pages/MyMeetingsPage.jsx";
import MyReviewsPage from "../pages/MyReviewsPage.jsx";
import HostDashboardPage from "../pages/HostDashboardPage.jsx";
import HostMeetingManagePage from "../pages/HostMeetingManagePage.jsx";
import HostApplicantsPage from "../pages/HostApplicantsPage.jsx";
import HostAttendancePage from "../pages/HostAttendancePage.jsx";
import HostVotePage from "../pages/HostVotePage.jsx";
import HostStatsPage from "../pages/HostStatsPage.jsx";
import AdminLayout from "../layouts/AdminLayout.jsx";
import AdminPage from "../pages/AdminPage.jsx";
import AdminUsersPage from "../pages/AdminUsersPage.jsx";
import AdminUserDetailPage from "../pages/AdminUserDetailPage.jsx";
import AdminMeetingsPage from "../pages/AdminMeetingsPage.jsx";
import AdminMeetingDetailPage from "../pages/AdminMeetingDetailPage.jsx";
import AdminReportsPage from "../pages/AdminReportsPage.jsx";
import AdminReportDetailPage from "../pages/AdminReportDetailPage.jsx";
import AdminAnalyticsPage from "../pages/AdminAnalyticsPage.jsx";
import AdminSettingsPage from "../pages/AdminSettingsPage.jsx";
import AdminBroadcastPage from "../pages/AdminBroadcastPage.jsx";
import AdminAuditLogsPage from "../pages/AdminAuditLogsPage.jsx";
import AdminSupportPage from "../pages/AdminSupportPage.jsx";
import AdminNoticesPage from "../pages/AdminNoticesPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import NotificationsPage from "../pages/NotificationsPage.jsx";
import MapPage from "../pages/MapPage.jsx";
import AppSettingsPage from "../pages/AppSettingsPage.jsx";
import WeatherPage from "../pages/WeatherPage.jsx";
import SupportPage from "../pages/SupportPage.jsx";
import ProtectedRoute from "../components/common/ProtectedRoute.jsx";
import AdminRoute from "../components/common/AdminRoute.jsx";
import { useResponsive } from "../hooks/useResponsive.js";

// Mobile Admin Imports
import MobileAdminNoticesPage from "../components/admin/mobile/MobileAdminNoticesPage.jsx";
import MobileAdminReportDetailPage from "../components/admin/mobile/MobileAdminReportDetailPage.jsx";
import MobileAdminSupportPage from "../components/admin/mobile/MobileAdminSupportPage.jsx";
import MobileTermsPage from "../components/profile/mobile/MobileTermsPage.jsx";

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function DesktopScrollToTop() {
  const { isMobile } = useResponsive();
  const { pathname, search } = useLocation();

  useEffect(() => {
    if (isMobile) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [isMobile, pathname, search]);

  return null;
}

const AdminNoticesRoute = () => {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileAdminNoticesPage /> : <AdminNoticesPage />;
};

const AdminReportDetailRoute = () => {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileAdminReportDetailPage /> : <AdminReportDetailPage />;
};

const AdminSupportRoute = () => {
  const { isMobile } = useResponsive();
  return isMobile ? <MobileAdminSupportPage /> : <AdminSupportPage />;
};

function AppRouter() {
  return (
    <>
      <DesktopScrollToTop />
      <Routes>
        <Route element={<ResponsiveLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/account/find" element={<AccountFindPage />} />
        <Route path="/password/reset" element={<PasswordResetPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/meetings" element={<MeetingListPage />} />
        <Route path="/meetings/create" element={protect(<MeetingCreatePage />)} />
        <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
        <Route path="/meetings/:meetingId/edit" element={protect(<MeetingEditPage />)} />
        <Route path="/chats" element={protect(<ChatListPage />)} />
        <Route path="/chats/direct/:directRoomId" element={protect(<ChatRoomPage />)} />
        <Route path="/chats/:chatRoomId" element={protect(<ChatRoomPage />)} />
        <Route path="/chatbot" element={protect(<ChatbotPage />)} />
        <Route path="/notifications" element={protect(<NotificationsPage />)} />
        <Route path="/support" element={protect(<SupportPage />)} />
        <Route path="/settings" element={protect(<AppSettingsPage />)} />
        <Route path="/map" element={<MapPage />} />
        <Route path="/weather" element={protect(<WeatherPage />)} />
        <Route path="/mypage" element={protect(<MyPage />)} />
        <Route path="/mypage/profile" element={protect(<ProfileEditPage />)} />
        <Route path="/profile/intro" element={protect(<ProfileIntroPage />)} />
        <Route path="/profile/setup" element={protect(<ProfileSetupPage />)} />
        <Route path="/mypage/meetings" element={protect(<MyMeetingsPage />)} />
        <Route path="/mypage/reviews" element={protect(<MyReviewsPage />)} />
        <Route path="/terms/:type" element={<MobileTermsPage />} />
        <Route path="/host" element={protect(<HostDashboardPage />)} />
        <Route path="/host/meetings/:meetingId" element={protect(<HostMeetingManagePage />)} />
        <Route path="/host/meetings/:meetingId/applicants" element={protect(<HostApplicantsPage />)} />
        <Route path="/host/meetings/:meetingId/attendance" element={protect(<HostAttendancePage />)} />
        <Route path="/host/meetings/:meetingId/vote" element={protect(<HostVotePage />)} />
        <Route path="/host/meetings/:meetingId/stats" element={protect(<HostStatsPage />)} />
        <Route path="/mobile/*" element={<Navigate to="/" replace />} />
        <Route path="/desktop/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

        {/* 관리자 권한이 있는 계정만 접근할 수 있는 라우트입니다. */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:userId" element={<AdminUserDetailPage />} />
          <Route path="meetings" element={<AdminMeetingsPage />} />
          <Route path="meetings/:meetingId" element={<AdminMeetingDetailPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="reports/:reportId" element={<AdminReportDetailRoute />} />
          <Route path="broadcast" element={<AdminBroadcastPage />} />
          <Route path="analytics" element={<AdminAnalyticsPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="support" element={<AdminSupportRoute />} />
          <Route path="notices" element={<AdminNoticesRoute />} />
          <Route path="settings" element={<AdminSettingsPage />} />
        </Route>
      </Routes>
    </>
  );
}

export default AppRouter;
