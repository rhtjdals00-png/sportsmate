import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, Send, X } from "lucide-react";
import Button from "../components/common/Button.jsx";
import DesktopAuthPage from "../components/auth/desktop/DesktopAuthPage.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import SocialLoginButtons from "../components/auth/SocialLoginButtons.jsx";
import { supportApi } from "../api/supportApi";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useResponsive } from "../hooks/useResponsive";

function isSuspendedLoginError(error) {
  const message = error?.response?.data?.message || error?.message || "";
  return /정지|차단|제한/.test(message);
}

function loginErrorMessage(error) {
  const message = error?.response?.data?.message || error?.message || "";
  if (/invalid login credentials/i.test(message)) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (/email not confirmed/i.test(message)) {
    return "이메일 인증을 완료한 뒤 로그인해주세요.";
  }
  return message || "로그인에 실패했습니다.";
}

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const { login, socialLogin, isAuthenticated, loading: authLoading } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [suspendedModalOpen, setSuspendedModalOpen] = useState(false);
  const [suspendedInquiry, setSuspendedInquiry] = useState({
    title: "계정 정지 관련 문의",
    content: ""
  });
  const [suspendedInquiryStatus, setSuspendedInquiryStatus] = useState("");
  const [suspendedInquiryLoading, setSuspendedInquiryLoading] = useState(false);
  const [supportSuccessOpen, setSupportSuccessOpen] = useState(false);

  useEffect(() => {
    const authError = sessionStorage.getItem("sportsmate_auth_error");
    if (authError) {
      setError(authError);
      sessionStorage.removeItem("sportsmate_auth_error");
    }
  }, []);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(location.state?.from || "/");
    }
  }, [authLoading, isAuthenticated, location.state?.from, navigate]);
  const submit = async (event) => {
    event.preventDefault();
    
    if (isMobile && (!form.email.trim() || !form.password.trim())) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setError("");
    setLoading(true);
    try {
      await login(form);
      sessionStorage.setItem("sportsmate_flash", "로그인 되었습니다.");
      navigate(location.state?.from || "/");
    } catch (submitError) {
      setError(loginErrorMessage(submitError));
      if (!isMobile && isSuspendedLoginError(submitError)) {
        setSuspendedInquiryStatus("");
        setSuspendedModalOpen(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const submitSuspendedInquiry = async (event) => {
    event.preventDefault();
    setSuspendedInquiryStatus("");
    setSuspendedInquiryLoading(true);
    try {
      await supportApi.createPublicInquiry({
        category: "account",
        source: "suspended_login",
        email: form.email,
        title: suspendedInquiry.title,
        content: suspendedInquiry.content
      });
      setSuspendedInquiry({ title: "계정 정지 관련 문의", content: "" });
      setSuspendedModalOpen(false);
      setSupportSuccessOpen(true);
    } catch (inquiryError) {
      setSuspendedInquiryStatus(inquiryError.response?.data?.message || "문의 접수에 실패했습니다.");
    } finally {
      setSuspendedInquiryLoading(false);
    }
  };

  const suspendedInquiryModal = suspendedModalOpen && !isMobile ? (
    <div className="desktop-suspended-support-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-suspended-support-title" onMouseDown={(event) => event.target === event.currentTarget && setSuspendedModalOpen(false)}>
      <form className="desktop-suspended-support-modal__panel" onSubmit={submitSuspendedInquiry}>
        <header>
          <div>
            <span>계정 이용 제한</span>
            <h2 id="desktop-suspended-support-title">정지된 계정입니다.</h2>
            <p>현재 계정은 서비스 이용이 제한되어 있습니다. 문의가 필요하면 아래 내용을 남겨주세요.</p>
          </div>
          <button type="button" aria-label="닫기" onClick={() => setSuspendedModalOpen(false)}><X size={18} /></button>
        </header>
        <label>
          답변 받을 이메일
          <input value={form.email} readOnly />
        </label>
        <label>
          문의 제목
          <input
            required
            minLength={2}
            maxLength={120}
            value={suspendedInquiry.title}
            onChange={(event) => setSuspendedInquiry((current) => ({ ...current, title: event.target.value }))}
          />
        </label>
        <label>
          문의 내용
          <textarea
            required
            minLength={5}
            rows={6}
            value={suspendedInquiry.content}
            onChange={(event) => setSuspendedInquiry((current) => ({ ...current, content: event.target.value }))}
            placeholder="계정 정지에 대해 확인이 필요한 내용을 적어주세요."
          />
        </label>
        {suspendedInquiryStatus ? <p className="desktop-suspended-support-modal__message">{suspendedInquiryStatus}</p> : null}
        <div className="desktop-suspended-support-modal__actions">
          <button type="button" onClick={() => setSuspendedModalOpen(false)}>닫기</button>
          <button type="submit" disabled={suspendedInquiryLoading}>
            <Send size={16} /> {suspendedInquiryLoading ? "접수 중" : "문의 접수"}
          </button>
        </div>
      </form>
    </div>
  ) : null;

  const supportSuccessModal = supportSuccessOpen && !isMobile ? (
    <div className="desktop-support-success-modal" role="dialog" aria-modal="true" aria-labelledby="desktop-support-success-title" onMouseDown={(event) => event.target === event.currentTarget && setSupportSuccessOpen(false)}>
      <section className="desktop-support-success-modal__panel">
        <h2 id="desktop-support-success-title">문의가 접수되었습니다.</h2>
        <p>관리자가 확인 후 처리 내역을 기록합니다.</p>
        <button type="button" onClick={() => setSupportSuccessOpen(false)}>확인</button>
      </section>
    </div>
  ) : null;

  const handleSocialLogin = async (provider) => {
    setError("");
    try {
      await socialLogin(provider);
    } catch (socialError) {
      setError(loginErrorMessage(socialError) || "소셜 로그인 요청에 실패했습니다.");
    }
  };

  if (!isMobile) {
    return (
      <>
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
        {suspendedInquiryModal}
        {supportSuccessModal}
      </>
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

        {error ? <p className="mobile-auth-message mobile-auth-message--error">{error}</p> : null}
        {notice ? <p className="mobile-auth-message mobile-auth-message--notice">{notice}</p> : null}
        <Button type="submit" disabled={loading}>{loading ? "처리 중..." : "로그인"}</Button>
        <SocialLoginButtons />
        <Link to="/register">계정 만들기</Link>
      </form>

      {/* 로그인 시도 중 모달 로딩 팝업 */}
      {loading && (
        <div className="mobile-logout-modal-overlay">
          <div className="mobile-logout-modal-content">
            <Loader2 size={36} className="mobile-logout-spinner" />
            <p>로그인 중입니다...</p>
          </div>
        </div>
      )}
    </>
  );
}

export default LoginPage;

