import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";

function RegisterPage() {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState({ email: "", password: "", nickname: "" });

  const submit = async (event) => {
    event.preventDefault();
    await register(form);
    navigate("/");
  };

  return (
    <>
      <MobileHeader title="회원가입" />
      <form className="mobile-form auth-form" onSubmit={submit}>
        <label>닉네임<input required value={form.nickname} onChange={(event) => setForm({ ...form, nickname: event.target.value })} /></label>
        <label>이메일<input required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>비밀번호<input required type="password" minLength="8" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label>
        <Button type="submit">가입하기</Button>
      </form>
    </>
  );
}

export default RegisterPage;

