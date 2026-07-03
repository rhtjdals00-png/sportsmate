import { MessageCircle, Search } from "lucide-react";
import { supabase } from "../../api/supabaseClient";

const providers = [
  { id: "google", label: "Google로 계속하기", icon: Search },
  { id: "kakao", label: "Kakao로 계속하기", icon: MessageCircle }
];

function normalizeAuthProvider(provider) {
  return typeof provider === "string" ? provider : provider?.id;
}

function SocialLoginButtons() {
  const redirectTo = `${window.location.origin}/auth/callback`;

  const startSocialLogin = async (provider) => {
    const nextProvider = normalizeAuthProvider(provider);
    if (!supabase) {
      window.alert("Supabase 환경변수가 설정되지 않았습니다.");
      return;
    }
    if (!nextProvider) {
      window.alert("지원하지 않는 소셜 로그인 제공자입니다.");
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: nextProvider,
      options: { redirectTo }
    });
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
