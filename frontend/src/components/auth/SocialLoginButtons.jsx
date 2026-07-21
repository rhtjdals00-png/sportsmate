import { MessageCircle, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext.jsx";

const providers = [
  { id: "google", label: "Google로 계속하기", icon: Search },
  { id: "kakao", label: "Kakao로 계속하기", icon: MessageCircle }
];

function normalizeAuthProvider(provider) {
  return typeof provider === "string" ? provider : provider?.id;
}

function SocialLoginButtons() {
  const { socialLogin } = useAuth();
  const location = useLocation();

  const startSocialLogin = async (provider) => {
    const nextProvider = normalizeAuthProvider(provider);
    if (!nextProvider) {
      window.alert("지원하지 않는 소셜 로그인 제공자입니다.");
      return;
    }
    try {
      const redirectPath = location.state?.from;
      if (redirectPath) localStorage.setItem("sportsmate_post_auth_redirect", redirectPath);
      else localStorage.removeItem("sportsmate_post_auth_redirect");
      await socialLogin(nextProvider);
    } catch (error) {
      window.alert(error?.message || "소셜 로그인 요청에 실패했습니다.");
    }
  };

  return (
    <section className="social-login-panel" aria-label="소셜 로그인">
      <div className="social-login-divider"><span>또는</span></div>
      {providers.map((item) => {
        const Icon = item.icon;
        return (
          <button
            className={`social-login-button social-login-button--${item.id}`}
            key={item.id}
            type="button"
            onClick={() => startSocialLogin(item.id)}
          >
            <Icon size={18} />
            {item.label}
          </button>
        );
      })}
    </section>
  );
}

export default SocialLoginButtons;
