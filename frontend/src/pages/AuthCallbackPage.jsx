import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../contexts/AuthContext.jsx";

function AuthCallbackPage() {
  const navigate = useNavigate();
  const { socialLogin } = useAuth();
  const [message, setMessage] = useState("소셜 로그인 정보를 확인하고 있습니다.");

  useEffect(() => {
    const finishLogin = async () => {
      try {
        if (!supabase) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const accessToken = data.session?.access_token;
        const provider = data.session?.user?.app_metadata?.provider || "supabase";
        if (!accessToken) throw new Error("소셜 로그인 세션을 찾지 못했습니다.");
        await socialLogin({ access_token: accessToken, provider });
        navigate("/", { replace: true });
      } catch (error) {
        setMessage(error.message || "소셜 로그인 처리에 실패했습니다.");
      }
    };
    finishLogin();
  }, [navigate, socialLogin]);

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
