import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  Mail,
  Phone,
  Sparkles,
  UserRound,
  XCircle
} from "lucide-react";
import Button from "../../common/Button.jsx";

const socialProviders = [
  { id: "google", label: "Google로 계속하기", className: "desktop-auth-social--google" },
  { id: "kakao", label: "카카오로 계속하기", className: "desktop-auth-social--kakao" }
];

const getPasswordChecks = (password) => [
  { id: "length", label: "8자 이상", passed: password.length >= 8 },
  { id: "upper", label: "영문 대문자", passed: /[A-Z]/.test(password) },
  { id: "lower", label: "영문 소문자", passed: /[a-z]/.test(password) },
  { id: "number", label: "숫자", passed: /\d/.test(password) },
  { id: "special", label: "특수문자", passed: /[^A-Za-z0-9]/.test(password) }
];

const getPasswordStrength = (password) => {
  const passedCount = getPasswordChecks(password).filter((item) => item.passed).length;
  if (!password) return { label: "입력 전", level: "empty", percent: 0 };
  if (passedCount <= 2) return { label: "위험", level: "danger", percent: 32 };
  if (passedCount <= 4) return { label: "보통", level: "normal", percent: 66 };
  return { label: "안전", level: "safe", percent: 100 };
};

function AvailabilityMessage({ state }) {
  if (!state?.message) return null;
  return <p className={`desktop-auth-availability desktop-auth-availability--${state.status}`}>{state.message}</p>;
}

function DesktopAuthPage({
  mode,
  form,
  availability = {},
  onChange,
  onSubmit,
  onCheckPhoneNumber,
  onCheckNickname,
  onEmailVerification,
  emailVerified = false,
  verifiedEmail = "",
  loading,
  error,
  notice,
  onSocialLogin,
  completed = false
}) {
  const isRegister = mode === "register";
  const title = isRegister ? "회원가입" : "로그인";
  const description = isRegister
    ? "기본 계정 정보를 입력하고 SportsMate를 시작하세요. 선호 종목과 운동 프로필은 가입 후 맞춤 추천 단계에서 설정할 수 있습니다."
    : "SportsMate 계정으로 모임과 채팅을 이어가세요.";
  const passwordChecks = getPasswordChecks(form.password || "");
  const passwordStrength = getPasswordStrength(form.password || "");
  const hasPasswordConfirm = Boolean(form.passwordConfirm);
  const passwordMatches = Boolean(form.password) && form.password === form.passwordConfirm;

  if (isRegister && completed) {
    return (
      <div className="desktop-auth-page">
        <section className="desktop-auth-card desktop-auth-complete" aria-label="회원가입 완료">
          <div className="desktop-auth-complete__mark"><CheckCircle2 size={34} /></div>
          <div className="desktop-auth-card__head">
            <span>WELCOME TO SPORTSMATE</span>
            <h2>가입이 완료되었습니다</h2>
            <p>이제 선호 종목, 운동 강도, 활동 지역을 설정하면 나에게 맞는 모임을 추천받을 수 있습니다.</p>
          </div>
          <div className="desktop-auth-complete__actions">
            <Link className="desktop-auth-primary-link" to="/profile/intro">
              <Sparkles size={18} /> 맞춤 정보 추천받기
            </Link>
            <Link className="desktop-auth-secondary-link" to="/">
              나중에 할게요
            </Link>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`desktop-auth-page ${isRegister ? "desktop-auth-page--register" : ""}`}>
      <section className="desktop-auth-card" aria-label={isRegister ? "회원가입" : "로그인"}>
        <div className="desktop-auth-card__head">
          <span>SPORTSMATE ACCOUNT</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        <form className="desktop-auth-form" onSubmit={onSubmit}>
          {isRegister ? (
            <section className="desktop-auth-fieldset desktop-auth-register-stack">
              <label>
                이름
                <span>
                  <UserRound size={18} />
                  <input
                    required
                    value={form.name}
                    onChange={(event) => onChange({ ...form, name: event.target.value })}
                    placeholder="실명을 입력해주세요"
                  />
                </span>
              </label>

              <label>
                핸드폰 번호
                <span className="desktop-auth-inline-action">
                  <Phone size={18} />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength="13"
                    value={form.phone_number}
                    onChange={(event) => onChange({ ...form, phone_number: event.target.value })}
                    placeholder="선택 입력"
                  />
                  <button type="button" onClick={onCheckPhoneNumber}>중복확인</button>
                </span>
                <AvailabilityMessage state={availability.phone_number} />
              </label>

              <label>
                닉네임
                <span className="desktop-auth-inline-action">
                  <UserRound size={18} />
                  <input
                    required
                    value={form.nickname}
                    onChange={(event) => onChange({ ...form, nickname: event.target.value })}
                    placeholder="모임에서 사용할 이름"
                  />
                  <button type="button" onClick={onCheckNickname}>중복확인</button>
                </span>
                <AvailabilityMessage state={availability.nickname} />
              </label>

              <label>
                이메일
                <span className="desktop-auth-inline-action">
                  <Mail size={18} />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => onChange({ ...form, email: event.target.value })}
                    placeholder="you@sportsmate.kr"
                  />
                  <button type="button" onClick={onEmailVerification}>인증</button>
                </span>
                <AvailabilityMessage state={availability.email} />
                {emailVerified ? (
                  <p className="desktop-auth-verified-message">\uc778\uc99d\ub41c \uc774\uba54\uc77c\uc785\ub2c8\ub2e4.</p>
                ) : form.email ? (
                  <p className="desktop-auth-verification-hint">\ud68c\uc6d0\uac00\uc785 \uc804 \uc774\uba54\uc77c \uc778\uc99d\uc744 \uc644\ub8cc\ud574 \uc8fc\uc138\uc694.</p>
                ) : null}
                {verifiedEmail && !emailVerified ? (
                  <p className="desktop-auth-verification-hint">\ud604\uc7ac \uc778\uc99d\ub41c \uc774\uba54\uc77c: {verifiedEmail}</p>
                ) : null}
              </label>

              <label>
                비밀번호
                <span>
                  <LockKeyhole size={18} />
                  <input
                    required
                    type="password"
                    minLength="8"
                    value={form.password}
                    onChange={(event) => onChange({ ...form, password: event.target.value })}
                    placeholder="대소문자, 숫자, 특수문자 포함"
                  />
                </span>
              </label>

              <div className={`desktop-auth-password-meter desktop-auth-password-meter--${passwordStrength.level}`}>
                <div className="desktop-auth-password-meter__head">
                  <strong>비밀번호 안전도</strong>
                  <span>{passwordStrength.label}</span>
                </div>
                <div className="desktop-auth-password-meter__bar" aria-hidden="true">
                  <i style={{ width: `${passwordStrength.percent}%` }} />
                </div>
                <ul className="desktop-auth-password-rules">
                  {passwordChecks.map((item) => (
                    <li key={item.id} className={item.passed ? "is-passed" : ""}>
                      {item.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                      {item.label}
                    </li>
                  ))}
                </ul>
              </div>

              <label>
                비밀번호 확인
                <span className={hasPasswordConfirm ? (passwordMatches ? "is-valid" : "is-invalid") : ""}>
                  <LockKeyhole size={18} />
                  <input
                    required
                    type="password"
                    minLength="8"
                    value={form.passwordConfirm}
                    onChange={(event) => onChange({ ...form, passwordConfirm: event.target.value })}
                    placeholder="비밀번호를 한 번 더 입력"
                  />
                </span>
              </label>
              {hasPasswordConfirm ? (
                <p className={`desktop-auth-match ${passwordMatches ? "is-valid" : "is-invalid"}`}>
                  {passwordMatches ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                  {passwordMatches ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
                </p>
              ) : null}
            </section>
          ) : (
            <section className="desktop-auth-fieldset">
              <label>
                이메일
                <span>
                  <Mail size={18} />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => onChange({ ...form, email: event.target.value })}
                    placeholder="you@sportsmate.kr"
                  />
                </span>
              </label>
              <label>
                비밀번호
                <span>
                  <LockKeyhole size={18} />
                  <input
                    required
                    type="password"
                    value={form.password}
                    onChange={(event) => onChange({ ...form, password: event.target.value })}
                    placeholder="비밀번호 입력"
                  />
                </span>
              </label>
              <div className="desktop-auth-recovery">
                <Link to="/account/find">계정 찾기</Link>
                <span aria-hidden="true">/</span>
                <Link to="/password/reset">비밀번호 찾기</Link>
              </div>
            </section>
          )}

          {isRegister ? (
            <section className="desktop-auth-agreements" aria-label="약관 동의">
              <label>
                <input
                  required
                  type="checkbox"
                  checked={form.agreeTerms}
                  onChange={(event) => onChange({ ...form, agreeTerms: event.target.checked })}
                />
                <span>서비스 이용약관에 동의합니다.</span>
              </label>
              <label>
                <input
                  required
                  type="checkbox"
                  checked={form.agreePrivacy}
                  onChange={(event) => onChange({ ...form, agreePrivacy: event.target.checked })}
                />
                <span>개인정보 수집 및 이용에 동의합니다.</span>
              </label>
            </section>
          ) : null}

          {error ? <p className="desktop-auth-error">{error}</p> : null}

          <Button type="submit" className="desktop-auth-submit" disabled={loading}>
            {loading ? "처리 중..." : isRegister ? "회원가입" : "로그인"}
            <ArrowRight size={18} />
          </Button>
        </form>

        <div className="desktop-auth-divider"><span>소셜 계정으로 {isRegister ? "가입" : "로그인"}</span></div>

        <div className="desktop-auth-socials">
          {socialProviders.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className={`desktop-auth-social ${provider.className}`}
              onClick={() => onSocialLogin(provider.id)}
            >
              <span>{provider.id === "google" ? "G" : "K"}</span>
              {provider.label}
            </button>
          ))}
        </div>

        {notice ? <p className="desktop-auth-notice">{notice}</p> : null}

        <p className="desktop-auth-switch">
          {isRegister ? "이미 계정이 있나요?" : "아직 계정이 없나요?"}
          <Link to={isRegister ? "/login" : "/register"}>{isRegister ? "로그인" : "회원가입"}</Link>
        </p>
      </section>
    </div>
  );
}

export default DesktopAuthPage;


