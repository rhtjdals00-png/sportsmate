import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "demo@sportsmate.kr", password: "password123" });

  const submit = async (event) => {
    event.preventDefault();
    await login(form);
    navigate(location.state?.from || "/");
  };

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
        <Button type="submit">로그인</Button>
        <Link to="/register">계정 만들기</Link>
      </form>
    </>
  );
}

export default LoginPage;
