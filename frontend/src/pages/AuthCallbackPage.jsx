import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useResponsive } from "../hooks/useResponsive";


function AuthCallbackPage() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [message, setMessage] = useState("로그인 정보를 확인하고 있습니다.");
  const { completeOAuthCallback } = useAuth();
  const completeOAuthCallbackRef = useRef(completeOAuthCallback);
  const handledRef = useRef(false);
  completeOAuthCallbackRef.current = completeOAuthCallback;

  useEffect(() => {
    let mounted = true;
    let redirectTimer = null;
    const authErrorRedirectTimer = window.setInterval(() => {
      if (sessionStorage.getItem("sportsmate_auth_error")) {
        navigate("/login", { replace: true });
      }
    }, 50);

    async function finishLogin() {
      try {
        await completeOAuthCallbackRef.current(window.location.href);
        const redirectPath = localStorage.getItem("sportsmate_post_auth_redirect") || "/";
        localStorage.removeItem("sportsmate_post_auth_redirect");
        sessionStorage.setItem("sportsmate_flash", "로그인 되었습니다.");
        navigate(redirectPath, { replace: true });
      } catch (error) {
        const errorMessage = error?.response?.data?.message || error?.message || "로그인 세션을 확인하지 못했습니다. 다시 로그인해주세요.";
        sessionStorage.setItem("sportsmate_auth_error", errorMessage);
        if (mounted) {
          const authErrorCode = error?.response?.data?.code || error?.response?.data?.error;
          if (["LOGIN_PROVIDER_MISMATCH", "AUTH_USER_ID_MISMATCH"].includes(authErrorCode)) {
            navigate("/login", { replace: true });
            return;
          }
          setMessage(errorMessage);
          redirectTimer = window.setTimeout(() => navigate("/login", { replace: true }), 1200);
        }
      }
    }

    // React Strict Mode mounts, cleans up, and mounts effects again in
    // development. Defer the one-time code exchange so the throwaway first
    // effect is cancelled and only the live second effect handles OAuth.
    const startTimer = window.setTimeout(() => {
      if (!mounted || handledRef.current) return;
      handledRef.current = true;
      finishLogin();
    }, 0);

    return () => {
      mounted = false;
      window.clearTimeout(startTimer);
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
      window.clearInterval(authErrorRedirectTimer);
    };
  }, [navigate]);

  if (!isMobile) {
    return (
      <div className="desktop-auth-page desktop-auth-page--callback">
        <section className="desktop-auth-card desktop-auth-callback" aria-label="소셜 로그인 처리 중">
          <div className="desktop-auth-callback__spinner" aria-hidden="true">
            <Loader2 size={34} />
          </div>
          <div className="desktop-auth-card__head" role="status" aria-live="polite">
            <h2>로그인 중입니다</h2>
            <p>{message} 잠시만 기다려 주세요.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <>
      <MobileHeader title="소셜 로그인" />
      <section className="mobile-form auth-form auth-callback-panel">
        <strong>SportsMate</strong>
        <p>{message}</p>
      </section>

      {/* 소셜 로그인 진행 중에 표시되는 로딩 모달 */}
      <div className="mobile-logout-modal-overlay">
        <div className="mobile-logout-modal-content">
          <Loader2 size={36} className="mobile-logout-spinner" />
          <p>소셜 로그인 중입니다...</p>
        </div>
      </div>
    </>
  );
}

export default AuthCallbackPage;
