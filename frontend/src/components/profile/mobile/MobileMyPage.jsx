import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, Check, Dumbbell, Footprints, MapPin, MessageCircle, Pencil, ShieldCheck, Star, Trophy, X, Loader2, Headphones } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { userApi } from "../../../api/userApi";
import { useAsync } from "../../../hooks/useAsync";
import { getSportIcon } from "../../../utils/sportIcons.jsx";
import { meetingApi } from "../../../api/meetingApi.js";
import MobileMyMeetings from "./MobileMyMeetings.jsx";

const levelLabels = {
  beginner: "입문",
  intermediate: "중급",
  advanced: "상급"
};

function getSportTagLabel(sport, preferredSportLevels) {
  const levelKey = preferredSportLevels?.[sport];
  const levelName = levelLabels[levelKey];
  return levelName ? `${sport}:${levelName}` : sport;
}

function splitPreferredSports(value) {
  if (Array.isArray(value)) {
    return value.map((sport) => String(sport || "").trim()).filter(Boolean);
  }
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function formatAttendanceRate(value) {
  const rate = Number(value || 0);
  return `${Math.round(rate)}%`;
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
  const receivedReviewsCount = reviews.data?.received?.length || 0;
  const writtenReviewsCount = reviews.data?.written?.length || 0;

  // 새 후기 여부 검증 (로컬스토리지에 저장된 값과 현재 받은 후기 개수 비교)
  const hasNewReviews = useMemo(() => {
    if (!user || !reviews.data) return false;
    const lastCount = Number(localStorage.getItem(`sportsmate_viewed_reviews_count_${user.id}`) || "0");
    return receivedReviewsCount > lastCount;
  }, [user, reviews.data, receivedReviewsCount]);

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
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const promptLogout = () => {
    setLogoutConfirmOpen(true);
  };

  const executeLogout = async () => {
    setLogoutConfirmOpen(false);
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await logout();
      sessionStorage.setItem("sportsmate_flash", "로그아웃 되었습니다.");
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("로그아웃 실패:", err);
      setIsLoggingOut(false);
    }
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
        <div className="profile-card__main-row">
          <img src={user?.profile_image_url || "/images/logo.png"} alt="프로필" />
          <div className="profile-card__info">
            <strong className="profile-card__nickname-row">
              <span className="profile-card__nickname">{user.nickname || user.name || "스포츠메이트"}</span>
              {user?.user_tag && <span className="profile-card__user-tag">#{user.user_tag}</span>}
            </strong>
            
            <div className="mobile-profile-intro-slot">
              {introEdit ? (
                <div className="mobile-profile-intro-edit">
                  <input
                    value={introDraft}
                    maxLength={30}
                    onChange={(event) => setIntroDraft(event.target.value)}
                    placeholder="상태메시지를 입력하세요"
                    autoFocus
                  />
                  <span className="mobile-profile-intro-char-count">{introDraft.length}/30</span>
                  <div className="mobile-profile-intro-edit-actions">
                    <button type="button" onClick={saveIntro} disabled={introSaving} aria-label="상태메시지 저장">
                      <Check size={13} />
                    </button>
                    <button type="button" onClick={() => { setIntroDraft(initialIntro); setIntroEdit(false); }} aria-label="상태메시지 취소">
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ) : (
                <button className="mobile-profile-intro-quick" type="button" onClick={() => setIntroEdit(true)}>
                  <span className="mobile-profile-intro-text">{initialIntro || "상태메시지 입력"}</span>
                  <Pencil size={12} />
                </button>
              )}
              {introMessage ? <em className="mobile-profile-intro-error">{introMessage}</em> : null}
            </div>

            <p className="profile-card__meta-text">{profile.region || "활동 지역 미설정"} / {exerciseLevel}</p>
          </div>
        </div>
        
        <div className="profile-card__divider" />

        <div className="profile-card__sports-grid" aria-label="선호 종목">
          {preferredSports.length ? preferredSports.slice(0, 6).map((sport) => {
            return (
              <div key={sport} className="profile-card__sport-grid-item">
                {(() => {
                  const SportIcon = getSportIcon(sport);
                  return <SportIcon size={14} />;
                })()}
                <span>{getSportTagLabel(sport, profile.preferred_sport_levels)}</span>
              </div>
            );
          }) : (
            <div className="profile-card__sport-grid-empty">
              <Footprints size={14} />
              <span>선호 종목 설정 전</span>
            </div>
          )}
        </div>
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
        <Link to="/mypage/reviews" style={{ position: 'relative' }}>
          <MessageCircle size={18} />
          <span>후기</span>
          <strong>{reviews.loading ? "확인 중" : `남김 ${writtenReviewsCount} · 받음 ${receivedReviewsCount}`}</strong>
          {hasNewReviews && (
            <span
              style={{
                position: 'absolute',
                top: '12px',
                right: '28px',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ef4444'
              }}
              aria-label="새로운 후기 알림"
            />
          )}
        </Link>
        <Link to="/mypage/meetings?tab=pending">
          <CalendarCheck size={18} />
          <span>승인 대기</span>
          <strong>{meetings.loading ? "확인 중" : `${pendingCount}건`}</strong>
        </Link>
      </section>
      <MobileMyMeetings meetings={meetings} />
      <div className="menu-list">
        {showAdminEntry ? (
          <Link className="mobile-my-admin-link" to="/admin">
            <ShieldCheck size={18} />
            <span>관리자 페이지로 이동</span>
          </Link>
        ) : null}
        <Link to="/mypage/profile">프로필 수정</Link>
        <Link to="/mypage/meetings" style={{ fontWeight: 'bold', color: '#4f46e5' }}>📝 내 전체 모임 목록 보기</Link>
        <Link to="/mypage/meetings?tab=hosted">내가 만든 모임 <span>{hostedCount}</span></Link>
        <Link to="/mypage/meetings?tab=joined">참여 중인 모임 <span>{joinedCount}</span></Link>
        <Link to="/meetings">관심 모임</Link>
        <Link to="/support" className="mobile-my-support-link" style={{ borderTop: '1px solid #f1f5f9', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Headphones size={18} style={{ color: '#64748b' }} />
            <b style={{ color: '#0f172a', fontSize: '15px', fontWeight: '900' }}>고객센터</b>
          </div>
        </Link>
      </div>
      <div className="mobile-mypage-logout-wrapper">
        <Button variant="danger" className="mobile-mypage-logout-btn" onClick={promptLogout}>로그아웃</Button>
      </div>

      <div className="mobile-mypage-footer-links" style={{
        display: 'flex',
        justifyContent: 'center',
        gap: '12px',
        margin: '0 20px 40px',
        fontSize: '12px',
        color: '#94a3b8'
      }}>
        <Link to="/terms/service" style={{ color: 'inherit', textDecoration: 'none' }}>이용약관</Link>
        <span>|</span>
        <Link to="/terms/privacy" style={{ color: 'inherit', textDecoration: 'none', fontWeight: 'bold' }}>개인정보처리방침</Link>
        <span>|</span>
        <Link to="/terms/location" style={{ color: 'inherit', textDecoration: 'none' }}>위치기반서비스</Link>
      </div>



      {/* 로그아웃 확인 모달 팝업 */}
      {logoutConfirmOpen && (
        <div className="mobile-logout-modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && setLogoutConfirmOpen(false)}>
          <div className="mobile-logout-modal-content" style={{ padding: '24px', textAlign: 'center', width: '280px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '700', marginBottom: '8px' }}>로그아웃</h3>
            <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '24px' }}>정말 로그아웃 하시겠습니까?</p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
              <Button variant="ghost" onClick={() => setLogoutConfirmOpen(false)} style={{ flex: 1, whiteSpace: 'nowrap', minWidth: 'fit-content' }}>취소</Button>
              <Button variant="danger" onClick={executeLogout} style={{ flex: 1, whiteSpace: 'nowrap', minWidth: 'fit-content' }}>로그아웃</Button>
            </div>
          </div>
        </div>
      )}

      {/* 로그아웃 대기 상태 모달 팝업 */}
      {isLoggingOut && (
        <div className="mobile-logout-modal-overlay">
          <div className="mobile-logout-modal-content">
            <Loader2 size={36} className="mobile-logout-spinner" />
            <p>로그아웃 중입니다...</p>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileMyPage;
