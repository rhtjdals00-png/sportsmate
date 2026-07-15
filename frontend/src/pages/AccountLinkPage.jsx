import { CheckCircle2, CircleAlert, LockKeyhole, ShieldCheck, XCircle } from "lucide-react";
import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import { userApi } from "../api/userApi";
import { isSupabaseConfigured, supabase } from "../api/supabaseClient";
import { useAuth } from "../contexts/AuthContext.jsx";
import { markProfileEditVerified } from "../utils/profileEditAccess";

const passwordRules = [
  { id: "length", label: "8자 이상", passed: (password) => password.length >= 8 },
  { id: "upper", label: "영문 대문자", passed: (password) => /[A-Z]/.test(password) },
  { id: "lower", label: "영문 소문자", passed: (password) => /[a-z]/.test(password) },
  { id: "number", label: "숫자", passed: (password) => /\d/.test(password) },
  { id: "special", label: "특수문자", passed: (password) => /[^A-Za-z0-9]/.test(password) }
];

function formatPhoneNumber(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function providerLabel(provider) {
  if ((provider || "").includes("kakao")) return "Kakao";
  if ((provider || "").includes("google")) return "Google";
  return "소셜";
}

function isValidPassword(password) {
  return passwordRules.every((rule) => rule.passed(password));
}

function getPasswordStrength(password) {
  const passedCount = passwordRules.filter((rule) => rule.passed(password)).length;
  if (!password) return { label: "입력 전", level: "empty", percent: 0 };
  if (passedCount <= 2) return { label: "위험", level: "danger", percent: 32 };
  if (passedCount <= 4) return { label: "보통", level: "normal", percent: 66 };
  return { label: "안전", level: "safe", percent: 100 };
}

function AccountLinkPage() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const [form, setForm] = useState(() => ({
    // 2026-07-02: 소셜 계정 이름은 실명 보장이 어려워 계정 연동 시 사용자가 직접 입력하도록 비움.
    name: "",
    phone_number: user?.phone_number || "",
    password: "",
    passwordConfirm: "",
    agree: false
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const passwordStrength = getPasswordStrength(form.password);
  const hasPasswordConfirm = Boolean(form.passwordConfirm);
  const passwordMatches = Boolean(form.password) && form.password === form.passwordConfirm;

  if (user?.has_password) {
    return <Navigate to="/mypage/profile" replace />;
  }

  const update = (key, value) => {
    setForm((current) => ({
      ...current,
      [key]: key === "phone_number" ? formatPhoneNumber(value) : value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("이름을 입력해주세요.");
      return;
    }
    if (!form.phone_number.trim()) {
      setError("핸드폰 번호를 입력해주세요.");
      return;
    }
    if (!isValidPassword(form.password)) {
      setError("비밀번호는 8자 이상, 영문 대/소문자, 숫자, 특수문자를 포함해야 합니다.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (!form.agree) {
      setError("계정 연동을 위해 약관 동의가 필요합니다.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setError("인증 서비스 설정을 확인해주세요.");
      return;
    }

    setSaving(true);
    try {
      // 2026-07-02: 소셜 계정에 이메일/비밀번호 로그인을 추가한 뒤 SportsMate 계정 상태를 연동 완료로 저장.
      const { error: supabaseError } = await supabase.auth.updateUser({
        password: form.password,
        data: {
          name: form.name.trim(),
          phone_number: form.phone_number
        }
      });
      if (supabaseError) throw supabaseError;

      const data = await userApi.linkEmailAccount({
        name: form.name.trim(),
        phone_number: form.phone_number
      });
      setCurrentUser?.(data.user);
      markProfileEditVerified();
      navigate("/mypage/profile", { replace: true });
    } catch (nextError) {
      setError(nextError?.response?.data?.message || nextError?.message || "계정 연동에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="profile-setup-page account-link-page">
      <div className="profile-setup account-link-shell">
        <section className="profile-setup__intro account-link-intro">
          <div>
            <p className="profile-setup__eyebrow">계정 연동</p>
            <h1>이메일 로그인 정보를 등록해주세요</h1>
            <p>프로필 수정과 계정 보호를 위해 부족한 정보를 한 번만 입력합니다.</p>
          </div>
          <div className="profile-setup__status">
            <ShieldCheck size={18} />
            {providerLabel(user?.provider)} 계정으로 로그인 중
          </div>
        </section>

        <form className="profile-setup__panel account-link-panel" onSubmit={submit}>
          <div className="profile-setup__fields account-link-fields">
            <label className="account-link-email">
              <span>이메일</span>
              <input value={user?.email || ""} readOnly />
            </label>
            <label>
              <span>이름</span>
              <input value={form.name} onChange={(event) => update("name", event.target.value)} placeholder="이름을 입력해주세요" />
            </label>
            <label>
              <span>핸드폰 번호</span>
              <input value={form.phone_number} onChange={(event) => update("phone_number", event.target.value)} placeholder="숫자만 입력해 주세요" />
            </label>
          </div>

          {/* 2026-07-02: 회원가입 화면과 같은 비밀번호 입력 흐름으로 계정 연동 UX를 통일. */}
          <div className="profile-setup__fields account-link-fields account-link-password-fields">
            <label>
              <span>비밀번호</span>
              <div className="account-link-password-input">
                <LockKeyhole size={18} />
                <input type="password" value={form.password} onChange={(event) => update("password", event.target.value)} placeholder="이메일 로그인에 사용할 비밀번호" />
              </div>
            </label>
          </div>

          <div className={`desktop-auth-password-meter desktop-auth-password-meter--${passwordStrength.level} account-link-password-meter`}>
            <div className="desktop-auth-password-meter__head">
              <strong>비밀번호 안전도</strong>
              <span>{passwordStrength.label}</span>
            </div>
            <div className="desktop-auth-password-meter__bar" aria-hidden="true">
              <i style={{ width: `${passwordStrength.percent}%` }} />
            </div>
            <ul className="desktop-auth-password-rules">
              {passwordRules.map((rule) => {
                const passed = rule.passed(form.password);
                return (
                  <li key={rule.id} className={passed ? "is-passed" : ""}>
                    {passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                    {rule.label}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="profile-setup__fields account-link-fields account-link-password-fields">
            <label>
              <span>비밀번호 확인</span>
              <div className={`account-link-password-input ${hasPasswordConfirm ? (passwordMatches ? "is-valid" : "is-invalid") : ""}`}>
                <LockKeyhole size={18} />
                <input type="password" value={form.passwordConfirm} onChange={(event) => update("passwordConfirm", event.target.value)} placeholder="비밀번호를 한 번 더 입력" />
              </div>
            </label>
          </div>

          {hasPasswordConfirm && (
            <p className={`desktop-auth-match ${passwordMatches ? "is-valid" : "is-invalid"}`}>
              {passwordMatches ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
              {passwordMatches ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
            </p>
          )}

          <label className="account-link-agree">
            <input type="checkbox" checked={form.agree} onChange={(event) => update("agree", event.target.checked)} />
            <span>SportsMate 이용약관과 개인정보 수집·이용, 이메일 로그인 연동에 동의합니다.</span>
          </label>

          {error && <p className="profile-setup__error">{error}</p>}

          <div className="profile-setup__actions">
            <Button type="button" variant="ghost" onClick={() => navigate("/mypage")}>나중에 하기</Button>
            <Button type="submit" disabled={saving}>{saving ? "연동 중..." : "계정 연동하기"}</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AccountLinkPage;
