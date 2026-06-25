import { Navigate, Route, Routes } from "react-router-dom";
import ResponsiveLayout from "../layouts/ResponsiveLayout.jsx";
import HomePage from "../pages/HomePage.jsx";
import LoginPage from "../pages/LoginPage.jsx";
import RegisterPage from "../pages/RegisterPage.jsx";
import MeetingListPage from "../pages/MeetingListPage.jsx";
import MeetingDetailPage from "../pages/MeetingDetailPage.jsx";
import MeetingCreatePage from "../pages/MeetingCreatePage.jsx";
import MeetingEditPage from "../pages/MeetingEditPage.jsx";
import ChatListPage from "../pages/ChatListPage.jsx";
import ChatRoomPage from "../pages/ChatRoomPage.jsx";
import MyPage from "../pages/MyPage.jsx";
import ProfileEditPage from "../pages/ProfileEditPage.jsx";
import MyMeetingsPage from "../pages/MyMeetingsPage.jsx";
import MyReviewsPage from "../pages/MyReviewsPage.jsx";
import HostDashboardPage from "../pages/HostDashboardPage.jsx";
import HostMeetingManagePage from "../pages/HostMeetingManagePage.jsx";
import HostApplicantsPage from "../pages/HostApplicantsPage.jsx";
import HostAttendancePage from "../pages/HostAttendancePage.jsx";
import HostVotePage from "../pages/HostVotePage.jsx";
import HostStatsPage from "../pages/HostStatsPage.jsx";
import AdminPage from "../pages/AdminPage.jsx";
import AdminUsersPage from "../pages/AdminUsersPage.jsx";
import AdminMeetingsPage from "../pages/AdminMeetingsPage.jsx";
import AdminReportsPage from "../pages/AdminReportsPage.jsx";
import NotFoundPage from "../pages/NotFoundPage.jsx";
import NotificationsPage from "../pages/NotificationsPage.jsx";
import ProtectedRoute from "../components/common/ProtectedRoute.jsx";

const protect = (element) => <ProtectedRoute>{element}</ProtectedRoute>;

function AppRouter() {
  return (
    <Routes>
      <Route element={<ResponsiveLayout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/meetings" element={<MeetingListPage />} />
        <Route path="/meetings/create" element={protect(<MeetingCreatePage />)} />
        <Route path="/meetings/:meetingId" element={<MeetingDetailPage />} />
        <Route path="/meetings/:meetingId/edit" element={protect(<MeetingEditPage />)} />
        <Route path="/chats" element={protect(<ChatListPage />)} />
        <Route path="/chats/:chatRoomId" element={protect(<ChatRoomPage />)} />
        <Route path="/notifications" element={protect(<NotificationsPage />)} />
        <Route path="/mypage" element={protect(<MyPage />)} />
        <Route path="/mypage/profile" element={protect(<ProfileEditPage />)} />
        <Route path="/mypage/meetings" element={protect(<MyMeetingsPage />)} />
        <Route path="/mypage/reviews" element={protect(<MyReviewsPage />)} />
        <Route path="/host" element={protect(<HostDashboardPage />)} />
        <Route path="/host/meetings/:meetingId" element={protect(<HostMeetingManagePage />)} />
        <Route path="/host/meetings/:meetingId/applicants" element={protect(<HostApplicantsPage />)} />
        <Route path="/host/meetings/:meetingId/attendance" element={protect(<HostAttendancePage />)} />
        <Route path="/host/meetings/:meetingId/vote" element={protect(<HostVotePage />)} />
        <Route path="/host/meetings/:meetingId/stats" element={protect(<HostStatsPage />)} />
        <Route path="/admin" element={protect(<AdminPage />)} />
        <Route path="/admin/users" element={protect(<AdminUsersPage />)} />
        <Route path="/admin/meetings" element={protect(<AdminMeetingsPage />)} />
        <Route path="/admin/reports" element={protect(<AdminReportsPage />)} />
        <Route path="/mobile/*" element={<Navigate to="/" replace />} />
        <Route path="/desktop/*" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default AppRouter;
