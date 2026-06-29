import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";
import { useResponsive } from "../../hooks/useResponsive";

function ProtectedRoute({ children }) {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const { isDesktop } = useResponsive();

  if (loading) {
    return <div className="page-message">로그인 정보를 확인하고 있습니다.</div>;
  }

  if (!isAuthenticated && !isDesktop) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export default ProtectedRoute;
