import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

const providerLinkMessages = {
  google: "기존 이메일 계정에 Google 로그인이 연결되었습니다. 앞으로 이메일 로그인과 Google 로그인을 모두 사용할 수 있습니다.",
  kakao: "기존 이메일 계정에 카카오 로그인이 연결되었습니다. 앞으로 이메일 로그인과 카카오 로그인을 모두 사용할 수 있습니다."
};

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
        const result = await completeOAuthCallback(window.location.href);
        const redirectPath = localStorage.getItem("sportsmate_post_auth_redirect") || "/";
        localStorage.removeItem("sportsmate_post_auth_redirect");

        const linkMessage = result?.provider_linked ? providerLinkMessages[result.linked_provider] : "";
        sessionStorage.setItem("sportsmate_flash", linkMessage || "로그인했습니다.");

        if (mounted && linkMessage) {
          setMessage(linkMessage);
          redirectTimer = window.setTimeout(() => navigate(redirectPath, { replace: true }), 1600);
        } else {
          navigate(redirectPath, { replace: true });
        }
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

      {/* 소셜 로그인 진행 중 회전하는 로딩 모달 스피너 */}
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
