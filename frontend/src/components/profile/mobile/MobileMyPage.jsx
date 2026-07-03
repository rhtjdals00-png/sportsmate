import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, Check, Dumbbell, Footprints, MapPin, MessageCircle, Pencil, ShieldCheck, Star, Trophy, X } from "lucide-react";
import { useMemo, useState } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { userApi } from "../../../api/userApi";
import { useAsync } from "../../../hooks/useAsync";

const levelLabels = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "상급"
};

function splitPreferredSports(value) {
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function formatAttendanceRate(value) {
  const rate = Number(value || 0);
  return rate > 0 ? `${Math.round(rate)}%` : "준비중";
}

function formatRating(value) {
  const rating = Number(value || 0);
  return rating > 0 ? rating.toFixed(1) : "신규";
}

function isAdminUser(user) {
  const role = String(user?.role || user?.profile?.role || "").toLowerCase();
  return Boolean(user?.is_admin || user?.isAdmin || role === "admin" || role === "superadmin" || role === "administrator");
}

function MobileMyPage() {
  const navigate = useNavigate();
  const { user, logout, setCurrentUser } = useAuth();
  const meetings = useAsync(() => (user ? userApi.myMeetings() : Promise.resolve({ hosted: [], joined: [], pending: [] })), [user?.id]);
  const reviews = useAsync(() => (user ? userApi.myReviews() : Promise.resolve({ items: [] })), [user?.id]);

  const profile = user?.profile || {};
  const preferredSports = splitPreferredSports(profile.preferred_sports);
  const hostedCount = meetings.data?.hosted?.length || 0;
  const joinedCount = meetings.data?.joined?.length || 0;
  const pendingCount = meetings.data?.pending?.length || 0;
  const reviewCount = reviews.data?.items?.length || 0;
  const exerciseLevel = levelLabels[profile.exercise_level] || "입문";
  const showAdminEntry = isAdminUser(user);
  const introStorageKey = user?.id ? `sportsmate_profile_extra_${user.id}` : "sportsmate_profile_extra_guest";
  const initialIntro = useMemo(() => profile.bio || (() => {
    try {
      return JSON.parse(localStorage.getItem(introStorageKey) || "{}").intro || "";
    } catch {
      return "";
    }
  })(), [introStorageKey, profile.bio]);
  const [introEdit, setIntroEdit] = useState(false);
  const [introDraft, setIntroDraft] = useState(initialIntro);
  const [introSaving, setIntroSaving] = useState(false);
  const [introMessage, setIntroMessage] = useState("");

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const saveIntro = async () => {
    const nextIntro = introDraft.trim().slice(0, 30);
    setIntroSaving(true);
    setIntroMessage("");
    try {
      const data = await userApi.updateMe({ bio: nextIntro });
      setCurrentUser(data.user);
      localStorage.setItem(introStorageKey, JSON.stringify({ intro: nextIntro }));
      setIntroEdit(false);
    } catch {
      setIntroMessage("상태메시지를 저장하지 못했습니다.");
    } finally {
      setIntroSaving(false);
    }
  };

  if (!user) {
    return (
      <>
        <MobileHeader title="내 정보" />
        <EmptyState
          title="로그인이 필요합니다."
          description="프로필과 참여 모임을 확인하려면 먼저 로그인해주세요."
          actionLabel="로그인"
          actionTo="/login"
        />
      </>
    );
  }

  return (
    <>
      <MobileHeader title="내 정보" />
      <section className="profile-card profile-card--stitch">
        <img src={user?.profile_image_url || "/images/logo.png"} alt="프로필" />
        <div>
          <strong>{user.nickname || user.name || "스포츠메이트"}</strong>
          <p>{exerciseLevel} · {profile.region || "활동 지역 미설정"}</p>
          <div className="mobile-profile-intro-slot">
            {introEdit ? (
              <div className="mobile-profile-intro-edit">
                <input
                  value={introDraft}
                  maxLength={30}
                  onChange={(event) => setIntroDraft(event.target.value)}
                  placeholder="상태메시지를 입력하세요"
                />
                <span>{introDraft.length}/30</span>
                <button type="button" onClick={saveIntro} disabled={introSaving} aria-label="상태메시지 저장">
                  <Check size={14} />
                </button>
                <button type="button" onClick={() => { setIntroDraft(initialIntro); setIntroEdit(false); }} aria-label="상태메시지 취소">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button className="mobile-profile-intro-quick" type="button" onClick={() => setIntroEdit(true)}>
                <span>{initialIntro || "상태메시지 입력"}</span>
                <Pencil size={13} />
              </button>
            )}
            {introMessage ? <em>{introMessage}</em> : null}
          </div>
          <div className="profile-sport-tags" aria-label="선호 종목">
            {preferredSports.length ? preferredSports.slice(0, 4).map((sport) => (
              <span key={sport}><Dumbbell size={16} />{sport}</span>
            )) : (
              <span><Footprints size={16} />선호 종목 설정 전</span>
            )}
          </div>
        </div>
        <Link className="profile-edit-shortcut" to="/mypage/profile" aria-label="프로필 수정">
          <Pencil size={17} />
        </Link>
      </section>
      <div className="stats-grid">
        <span><Trophy size={18} /><small>참여 모임</small><strong>{joinedCount}회</strong></span>
        <span><CalendarCheck size={18} /><small>참여율</small><strong>{formatAttendanceRate(profile.attendance_rate)}</strong></span>
        <span><Star size={18} /><small>평점</small><strong>{formatRating(profile.rating_average)}</strong></span>
      </div>
      <section className="mobile-profile-summary" aria-label="활동 요약">
        <div>
          <MapPin size={18} />
          <span>활동 지역</span>
          <strong>{profile.region || "지역 미설정"}</strong>
        </div>
        <div>
          <MessageCircle size={18} />
          <span>후기</span>
          <strong>{reviews.loading ? "확인 중" : `${reviewCount}개`}</strong>
        </div>
        <Link to="/mypage/meetings?tab=pending">
          <CalendarCheck size={18} />
          <span>승인 대기</span>
          <strong>{meetings.loading ? "확인 중" : `${pendingCount}건`}</strong>
        </Link>
      </section>
      <div className="menu-list">
        {showAdminEntry ? (
          <Link className="mobile-my-admin-link" to="/admin">
            <ShieldCheck size={18} />
            <span>관리자 페이지로 이동</span>
          </Link>
        ) : null}
        <Link to="/mypage/profile">프로필 수정</Link>
        <Link to="/mypage/meetings?tab=hosted">내가 만든 모임 <span>{hostedCount}</span></Link>
        <Link to="/mypage/meetings?tab=joined">참여 중인 모임 <span>{joinedCount}</span></Link>
        <Link to="/meetings">관심 모임</Link>
        <Link to="/mypage/reviews">내 후기 <span>{reviewCount}</span></Link>
      </div>
      <Button variant="secondary" onClick={handleLogout}>로그아웃</Button>
    </>
  );
}

export default MobileMyPage;
