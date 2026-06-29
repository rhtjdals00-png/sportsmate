import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import DesktopAuthPage from "../components/auth/desktop/DesktopAuthPage.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
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

function RegisterPage() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const { register, registerVerifiedEmail, requestSignupEmailVerification, socialLogin, session } = useAuth();
  const [form, setForm] = useState(initialRegisterForm);
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

  useEffect(() => {
    const timers = availabilityFields.map((field) => {
      const value = (form[field] || "").trim();
      if (!value) {
        setAvailability((current) => ({ ...current, [field]: emptyAvailability }));
        return null;
      }

      setAvailability((current) => ({
        ...current,
        [field]: { status: "checking", message: "확인 중입니다.", available: null }
      }));

      return window.setTimeout(() => {
        authApi
          .availability(field, value)
          .then((data) => {
            setAvailability((current) => ({
              ...current,
              [field]: {
                status: data.available ? "available" : "unavailable",
                message: data.message,
                available: data.available
              }
            }));
          })
          .catch(() => {
            setAvailability((current) => ({
              ...current,
              [field]: { status: "error", message: "중복 확인에 실패했습니다.", available: null }
            }));
          });
      }, 350);
    });

    return () => timers.forEach((timer) => timer && window.clearTimeout(timer));
  }, [form.email, form.nickname, form.phone_number]);

  const checkNickname = async () => {
    const value = form.nickname.trim();
    if (!value) {
      setAvailability((current) => ({
        ...current,
        nickname: { status: "unavailable", message: "닉네임을 입력해주세요.", available: false }
      }));
      return;
    }

    setAvailability((current) => ({
      ...current,
      nickname: { status: "checking", message: "확인 중입니다.", available: null }
    }));
    try {
      const data = await authApi.availability("nickname", value);
      setAvailability((current) => ({
        ...current,
        nickname: {
          status: data.available ? "available" : "unavailable",
          message: data.message,
          available: data.available
        }
      }));
    } catch {
      setAvailability((current) => ({
        ...current,
        nickname: { status: "error", message: "닉네임 중복 확인에 실패했습니다.", available: null }
      }));
    }
  };

  const requestEmailVerification = async () => {
    setNotice("");
    const email = form.email.trim();
    if (!email) {
      setError("이메일을 입력해주세요.");
      return;
    }
    try {
      await resendSignupEmail(email);
      setNotice("인증 메일을 다시 보냈습니다. 메일함을 확인해주세요.");
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
        navigate("/");
      } else {
        await registerVerifiedEmail(payload);
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
        onChange={(nextForm) => setForm((current) => updateRegisterForm(current, nextForm))}
        onSubmit={submit}
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
        <label>닉네임<input required value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
        <label>이메일<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>비밀번호<input required type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <Button type="submit" disabled={loading}>{loading ? "처리 중..." : "가입하기"}</Button>
        <Link to="/login">이미 계정이 있어요</Link>
      </form>
    </>
  );
}

export default RegisterPage;



