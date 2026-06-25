import { Link } from "react-router-dom";
import { CalendarCheck, Star, Trophy } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import { useAuth } from "../../../contexts/AuthContext.jsx";

function MobileMyPage() {
  const { user, logout } = useAuth();

  return (
    <>
      <MobileHeader title="마이페이지" />
      <section className="profile-card">
        <img src={user?.profile_image_url || "/images/logo.png"} alt="프로필" />
        <div>
          <strong>{user?.nickname || "게스트"}</strong>
          <p>{user?.email || "로그인 후 이용할 수 있습니다."}</p>
        </div>
      </section>
      <div className="stats-grid">
        <span><Trophy size={18} /> 모임 4</span>
        <span><CalendarCheck size={18} /> 참여율 92%</span>
        <span><Star size={18} /> 평점 4.8</span>
      </div>
      <div className="menu-list">
        <Link to="/mypage/profile">프로필 수정</Link>
        <Link to="/mypage/meetings">내 모임</Link>
        <Link to="/mypage/reviews">내 후기</Link>
        <Link to="/host">방장 관리</Link>
      </div>
      {user ? (
        <Button variant="secondary" onClick={logout}>로그아웃</Button>
      ) : (
        <Link className="button button--primary" to="/login">로그인</Link>
      )}
    </>
  );
}

export default MobileMyPage;

