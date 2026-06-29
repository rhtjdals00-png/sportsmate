import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, Search, ShieldCheck } from "lucide-react";
import Button from "../../common/Button.jsx";

function DesktopRecoveryPage({ mode }) {
  const isPassword = mode === "password";
  const [step, setStep] = useState("email");
  const [form, setForm] = useState({ email: "", code: "", password: "", passwordConfirm: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const title = isPassword ? "비밀번호 찾기" : "계정 찾기";
  const description = isPassword
    ? "가입한 이메일로 인증번호를 받은 뒤 새 비밀번호를 설정합니다."
    : "가입한 이메일 인증으로 SportsMate 계정을 확인합니다.";

  const sendCode = (event) => {
    event.preventDefault();
    setError("");
    if (!form.email.trim()) {
      setError("이메일을 입력해주세요.");
      return;
    }
    setStep("verify");
    setMessage("인증번호 발송 API가 연결되면 입력한 이메일로 코드가 전송됩니다.");
  };

  const verifyCode = (event) => {
    event.preventDefault();
    setError("");
    if (!form.code.trim()) {
      setError("인증번호를 입력해주세요.");
      return;
    }
    if (isPassword) {
      setStep("reset");
      setMessage("이메일 인증이 완료되었습니다. 새 비밀번호를 입력해주세요.");
      return;
    }
    setStep("complete");
    setMessage("이메일 인증이 완료되었습니다. 가입 계정을 확인했습니다.");
  };

  const resetPassword = (event) => {
    event.preventDefault();
    setError("");
    if (form.password.length < 8) {
      setError("비밀번호는 8자 이상 입력해주세요.");
      return;
    }
    if (form.password !== form.passwordConfirm) {
      setError("비밀번호와 비밀번호 확인이 일치하지 않습니다.");
      return;
    }
    setStep("complete");
    setMessage("비밀번호 재설정 API가 연결되면 새 비밀번호로 변경됩니다.");
  };

  return (
    <div className="desktop-auth-page">
      <section className="desktop-auth-card desktop-auth-recovery-card" aria-label={title}>
        <div className="desktop-auth-card__head">
          <span>EMAIL VERIFICATION</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>

        {step === "email" ? (
          <form className="desktop-auth-form" onSubmit={sendCode}>
            <section className="desktop-auth-fieldset">
              <label>
                이메일
                <span>
                  <Mail size={18} />
                  <input
                    required
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm({ ...form, email: event.target.value })}
                    placeholder="you@sportsmate.kr"
                  />
                </span>
              </label>
            </section>
            {error ? <p className="desktop-auth-error">{error}</p> : null}
            <Button type="submit" className="desktop-auth-submit">
              인증번호 받기
              <ShieldCheck size={18} />
            </Button>
          </form>
        ) : null}

        {step === "verify" ? (
          <form className="desktop-auth-form" onSubmit={verifyCode}>
            <section className="desktop-auth-fieldset">
              <label>
                인증번호
                <span>
                  <KeyRound size={18} />
                  <input
                    required
                    value={form.code}
                    onChange={(event) => setForm({ ...form, code: event.target.value })}
                    placeholder="이메일로 받은 인증번호"
                  />
                </span>
              </label>
            </section>
            {message ? <p className="desktop-auth-notice">{message}</p> : null}
            {error ? <p className="desktop-auth-error">{error}</p> : null}
            <Button type="submit" className="desktop-auth-submit">
              인증 확인
              <CheckCircle2 size={18} />
            </Button>
          </form>
        ) : null}

        {step === "reset" ? (
          <form className="desktop-auth-form" onSubmit={resetPassword}>
            <section className="desktop-auth-fieldset">
              <label>
                새 비밀번호
                <span>
                  <LockKeyhole size={18} />
                  <input
                    required
                    type="password"
                    minLength="8"
                    value={form.password}
                    onChange={(event) => setForm({ ...form, password: event.target.value })}
                    placeholder="8자 이상 입력"
                  />
                </span>
              </label>
              <label>
                새 비밀번호 확인
                <span>
                  <LockKeyhole size={18} />
                  <input
                    required
                    type="password"
                    minLength="8"
                    value={form.passwordConfirm}
                    onChange={(event) => setForm({ ...form, passwordConfirm: event.target.value })}
                    placeholder="비밀번호를 한 번 더 입력"
                  />
                </span>
              </label>
            </section>
            {message ? <p className="desktop-auth-notice">{message}</p> : null}
            {error ? <p className="desktop-auth-error">{error}</p> : null}
            <Button type="submit" className="desktop-auth-submit">
              비밀번호 재설정
              <LockKeyhole size={18} />
            </Button>
          </form>
        ) : null}

        {step === "complete" ? (
          <div className="desktop-auth-complete desktop-auth-recovery-complete">
            <div className="desktop-auth-complete__mark"><CheckCircle2 size={34} /></div>
            <p className="desktop-auth-notice">{message}</p>
            {!isPassword ? (
              <div className="desktop-auth-found-account">
                <Search size={18} />
                <span>{form.email}</span>
              </div>
            ) : null}
            <Link className="desktop-auth-primary-link" to="/login">로그인으로 이동</Link>
          </div>
        ) : null}

        <p className="desktop-auth-switch">
          <Link to="/login"><ArrowLeft size={15} /> 로그인으로 돌아가기</Link>
        </p>
      </section>
    </div>
  );
}

export default DesktopRecoveryPage;
