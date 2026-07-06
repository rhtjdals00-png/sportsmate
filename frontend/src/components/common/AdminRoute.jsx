import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";

function isAdminUser(user) {
  const role = String(user?.role || user?.profile?.role || "").toLowerCase();
  return Boolean(
    user?.is_admin ||
      user?.isAdmin ||
      role === "admin" ||
      role === "superadmin" ||
      role === "administrator"
  );
}

function AdminRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div className="page-message">관리자 권한을 확인하고 있습니다.</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (!isAdminUser(user)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default AdminRoute;
