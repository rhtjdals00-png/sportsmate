import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import DesktopAuthPage from "../components/auth/desktop/DesktopAuthPage.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useResponsive } from "../hooks/useResponsive";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { login, socialLogin, isAuthenticated, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(location.state?.from || "/");
    }
  }, [authLoading, isAuthenticated, location.state?.from, navigate]);
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form);
      sessionStorage.setItem("sportsmate_flash", "\ub85c\uadf8\uc778\ud558\uc168\uc2b5\ub2c8\ub2e4.");
      navigate(location.state?.from || "/");
    } catch (submitError) {
      setError(submitError.message || submitError.response?.data?.message || "로그인에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleSocialLogin = async (provider) => {
    setError("");
    try {
      await socialLogin(provider);
    } catch (socialError) {
      setError(socialError.message || "소셜 로그인 요청에 실패했습니다.");
    }
  };

  if (!isMobile) {
    return (
      <DesktopAuthPage
        mode="login"
        form={form}
        onChange={setForm}
        onSubmit={submit}
        loading={loading}
        error={error}
        notice={notice}
        onSocialLogin={handleSocialLogin}
      />
    );
  }

  return (
    <>
      <MobileHeader title="로그인" />
      <form className="mobile-form auth-form" onSubmit={submit}>
        <label>
          이메일
          <input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        </label>
        <label>
          비밀번호
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        </label>
        <Button type="submit" disabled={loading}>{loading ? "처리 중..." : "로그인"}</Button>
        <Link to="/register">계정 만들기</Link>
      </form>
    </>
  );
}

export default LoginPage;


