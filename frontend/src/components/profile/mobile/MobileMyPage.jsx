import { Link } from "react-router-dom";
import { CalendarCheck, Dumbbell, Footprints, Star, Trophy } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import { useAuth } from "../../../contexts/AuthContext.jsx";

function MobileMyPage() {
  const { user, logout } = useAuth();

  return (
    <>
      <MobileHeader title="내 정보" />
      <section className="profile-card profile-card--stitch">
        <img src={user?.profile_image_url || "/images/logo.png"} alt="프로필" />
        <div>
          <strong>{user?.nickname || "게스트"}</strong>
          <p>{user?.profile?.exercise_level === "advanced" ? "상급" : user?.profile?.exercise_level === "intermediate" ? "중급" : "초보"}</p>
          <div className="profile-sport-tags">
            <span><Footprints size={16} />러닝</span>
            <span><Dumbbell size={16} />배드민턴</span>
          </div>
        </div>
      </section>
      <div className="stats-grid">
        <span><Trophy size={18} /><small>참여 모임</small><strong>4회</strong></span>
        <span><CalendarCheck size={18} /><small>참여율</small><strong>92%</strong></span>
        <span><Star size={18} /><small>평점</small><strong>4.8</strong></span>
      </div>
      <div className="menu-list">
        <Link to="/mypage/profile">프로필 수정</Link>
        <Link to="/mypage/meetings">내가 만든 모임</Link>
        <Link to="/mypage/meetings">참여 중인 모임</Link>
        <Link to="/meetings">관심 모임</Link>
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
