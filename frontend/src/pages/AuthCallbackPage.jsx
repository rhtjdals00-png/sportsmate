import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("로그인 정보를 확인하고 있습니다.");
  const { completeOAuthCallback } = useAuth();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) return undefined;
    handledRef.current = true;
    let mounted = true;
    let redirectTimer = null;

    async function finishLogin() {
      try {
        await completeOAuthCallback(window.location.href);
        window.history.replaceState({}, document.title, window.location.pathname);
        const redirectPath = localStorage.getItem("sportsmate_post_auth_redirect") || "/";
        localStorage.removeItem("sportsmate_post_auth_redirect");
        sessionStorage.setItem("sportsmate_flash", "로그인하셨습니다.");
        navigate(redirectPath, { replace: true });
      } catch (error) {
        const errorMessage = error?.message || "로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.";
        sessionStorage.setItem("sportsmate_auth_error", errorMessage);
        if (mounted) {
          setMessage(errorMessage);
          redirectTimer = window.setTimeout(() => navigate("/login", { replace: true }), 1200);
        }
      }
    }

    finishLogin();

    return () => {
      mounted = false;
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [completeOAuthCallback, navigate]);

  return (
    <>
      <MobileHeader title="소셜 로그인" />
      <section className="mobile-form auth-form auth-callback-panel">
        <strong>SportsMate</strong>
        <p>{message}</p>
      </section>
    </>
  );

}

export default AuthCallbackPage;
