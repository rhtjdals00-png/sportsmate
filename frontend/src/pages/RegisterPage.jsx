import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import DesktopAuthPage from "../components/auth/desktop/DesktopAuthPage.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import SocialLoginButtons from "../components/auth/SocialLoginButtons.jsx";
import { authApi } from "../api/authApi";
import { useAuth } from "../contexts/AuthContext.jsx";
import { useResponsive } from "../hooks/useResponsive";

const passwordRules = [
  { id: "length", test: (password) => password.length >= 8 },
  { id: "upper", test: (password) => /[A-Z]/.test(password) },
  { id: "lower", test: (password) => /[a-z]/.test(password) },
  { id: "number", test: (password) => /\d/.test(password) },
  { id: "special", test: (password) => /[^A-Za-z0-9]/.test(password) }
];

const availabilityFields = ["email", "nickname", "phone_number"];
const emptyAvailability = { status: "idle", message: "", available: null };

const isValidPassword = (password) => passwordRules.every((rule) => rule.test(password));
const hasAvailabilityError = (availability) => availabilityFields.some((field) => availability[field]?.available === false);

const formatPhoneNumber = (value) => {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
};

const updateRegisterForm = (current, next) => ({
  ...next,
  phone_number: formatPhoneNumber(next.phone_number ?? current.phone_number)
});

const initialRegisterForm = {
  name: "",
  phone_number: "",
  email: "",
  password: "",
  passwordConfirm: "",
  nickname: "",
  agreeTerms: false,
  agreePrivacy: false
};

const getInitialRegisterForm = () => ({
  ...initialRegisterForm,
  email: localStorage.getItem("sportsmate_pending_signup_email") || ""
});

function RegisterPage() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { register, registerVerifiedEmail, requestSignupEmailVerification, socialLogin, session } = useAuth();
  const [form, setForm] = useState(getInitialRegisterForm);
  const [availability, setAvailability] = useState({
    email: emptyAvailability,
    nickname: emptyAvailability,
    phone_number: emptyAvailability
  });
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const verifiedEmail = session?.user?.email_confirmed_at || session?.user?.confirmed_at ? session?.user?.email || "" : "";
  const isCurrentEmailVerified = Boolean(!isMobile && verifiedEmail && verifiedEmail.toLowerCase() === form.email.trim().toLowerCase());

  const setAvailabilityState = (field, state) => {
    setAvailability((current) => ({ ...current, [field]: state }));
  };

  const handleFormChange = (nextForm) => {
    const formatted = updateRegisterForm(form, nextForm);
    availabilityFields.forEach((field) => {
      if ((form[field] || "") !== (formatted[field] || "")) {
        setAvailabilityState(field, emptyAvailability);
      }
    });
    setForm(formatted);
  };

  const checkAvailability = async (field, rawValue = form[field]) => {
    const value = (rawValue || "").trim();
    const fieldMessages = {
      email: "이메일을 입력해주세요.",
      nickname: "닉네임을 입력해주세요.",
      phone_number: "핸드폰 번호를 입력해주세요."
    };

    if (!value) {
      const state = { status: "unavailable", message: fieldMessages[field], available: false };
      setAvailabilityState(field, state);
      return state;
    }

    setAvailabilityState(field, { status: "checking", message: "확인 중입니다.", available: null });
    try {
      const data = await authApi.availability(field, value);
      const state = {
        status: data.available ? "available" : "unavailable",
        message: data.message,
        available: data.available
      };
      setAvailabilityState(field, state);
      return state;
    } catch (availabilityError) {
      const message = availabilityError.response?.data?.message || "중복 확인에 실패했습니다.";
      const state = { status: "error", message, available: null };
      setAvailabilityState(field, state);
      return state;
    }
  };

  const checkPhoneNumber = () => checkAvailability("phone_number");
  const checkNickname = () => checkAvailability("nickname");

  const requestEmailVerification = async () => {
    setNotice("");
    const email = form.email.trim();
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    try {
      const emailState = await checkAvailability("email", email);
      if (emailState.available === false) {
        setError(emailState.message || "이미 사용 중인 이메일입니다.");
        return;
      }
      if (emailState.status === "error") {
        setError(emailState.message || "이메일 중복 확인에 실패했습니다.");
        return;
      }
      localStorage.setItem("sportsmate_pending_signup_email", email);
      await requestSignupEmailVerification(email);
      setNotice("인증 메일을 보냈습니다. 메일함에서 인증을 완료해주세요.");
    } catch (verificationError) {
      setError(verificationError.message || verificationError.response?.data?.message || "이메일 인증 요청에 실패했습니다.");
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!isMobile) {
      if (!isValidPassword(form.password)) {
        setError("비밀번호는 8자 이상이며 영문 대문자, 영문 소문자, 숫자, 특수문자를 모두 포함해야 합니다.");
        return;
      }
      if (form.password !== form.passwordConfirm) {
        setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
        return;
      }
      const requiredChecks = isCurrentEmailVerified ? ["nickname"] : ["email", "nickname"];
      const unchecked = requiredChecks.find((field) => availability[field]?.available !== true);
      if (unchecked) {
        setError("이메일 인증과 닉네임 중복 확인을 완료해주세요.");
        return;
      }
      if (form.phone_number && availability.phone_number?.available !== true) {
        setError("핸드폰 번호 중복 확인을 완료해주세요.");
        return;
      }
      if (hasAvailabilityError(availability)) {
        setError("이미 사용 중인 이메일, 닉네임 또는 핸드폰 번호가 있는지 확인해주세요.");
        return;
      }
      if (!form.agreeTerms || !form.agreePrivacy) {
        setError("필수 약관에 동의해주세요.");
        return;
      }
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name,
        phone_number: isMobile ? form.phone_number : formatPhoneNumber(form.phone_number),
        email: form.email,
        password: form.password,
        nickname: form.nickname
      };
      if (!isMobile && !isCurrentEmailVerified) {
        setError("\uc774\uba54\uc77c \uc778\uc99d\uc744 \uc644\ub8cc\ud574 \uc8fc\uc138\uc694.");
        return;
      }
      if (isMobile) {
        await register(payload);
        navigate("/mypage/profile");
      } else {
        await registerVerifiedEmail(payload);
        localStorage.removeItem("sportsmate_pending_signup_email");
        setCompleted(true);
      }
    } catch (submitError) {
      setError(submitError.message || submitError.response?.data?.message || "회원가입에 실패했습니다.");
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
        mode="register"
        form={form}
        availability={availability}
        onChange={handleFormChange}
        onSubmit={submit}
        onCheckPhoneNumber={checkPhoneNumber}
        onCheckNickname={checkNickname}
        onEmailVerification={requestEmailVerification}
        emailVerified={isCurrentEmailVerified}
        verifiedEmail={verifiedEmail}
        loading={loading}
        error={error}
        notice={notice}
        onSocialLogin={handleSocialLogin}
        completed={completed}
      />
    );
  }

  return (
    <>
      <MobileHeader title="회원가입" />
      <form className="mobile-form auth-form" onSubmit={submit}>
        <label>이름<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>핸드폰 번호<input type="tel" value={form.phone_number} onChange={(event) => setForm({ ...form, phone_number: event.target.value })} /></label>
        <label>닉네임<input required maxLength={12} value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value.slice(0, 12) })} /></label>
        <label>이메일<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>비밀번호<input required type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>

        {error ? <p className="mobile-auth-message mobile-auth-message--error">{error}</p> : null}
        {notice ? <p className="mobile-auth-message mobile-auth-message--notice">{notice}</p> : null}
        <Button type="submit" disabled={loading}>{loading ? "처리 중..." : "가입하기"}</Button>
        <SocialLoginButtons />
        <Link to="/login">이미 계정이 있어요</Link>

      </form>
    </>
  );
}

export default RegisterPage;
