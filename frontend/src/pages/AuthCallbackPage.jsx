import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (loading) return;
    const redirectPath = localStorage.getItem("sportsmate_post_auth_redirect") || "/";
    localStorage.removeItem("sportsmate_post_auth_redirect");
    if (isAuthenticated) {
      sessionStorage.setItem("sportsmate_flash", "\ub85c\uadf8\uc778\ud558\uc168\uc2b5\ub2c8\ub2e4.");
    }
    navigate(isAuthenticated ? redirectPath : "/login", { replace: true });
  }, [loading, isAuthenticated, navigate]);

  return <div className="page-message">로그인 정보를 확인하고 있습니다.</div>;
}

export default AuthCallbackPage;
