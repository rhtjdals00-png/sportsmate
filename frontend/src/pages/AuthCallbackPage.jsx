import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext.jsx";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { loading, isAuthenticated, authError } = useAuth();

  useEffect(() => {
    if (loading) return;

    const redirectPath = localStorage.getItem("sportsmate_post_auth_redirect") || "/";
    localStorage.removeItem("sportsmate_post_auth_redirect");

    if (isAuthenticated) {
      sessionStorage.setItem("sportsmate_flash", "\ub85c\uadf8\uc778\ud558\uc168\uc2b5\ub2c8\ub2e4.");
      navigate(redirectPath, { replace: true });
      return;
    }

    if (authError) {
      sessionStorage.setItem("sportsmate_auth_error", authError);
    }
    navigate("/login", { replace: true });
  }, [loading, isAuthenticated, authError, navigate]);

  return <div className="page-message">\ub85c\uadf8\uc778 \uc815\ubcf4\ub97c \ud655\uc778\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4.</div>;
}

export default AuthCallbackPage;
