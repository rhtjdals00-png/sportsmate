import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, Check, Dumbbell, Footprints, MapPin, MessageCircle, Pencil, ShieldCheck, Star, Trophy, X, ChevronDown, ChevronUp, Loader2, Headphones } from "lucide-react";
import { useMemo, useState } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { userApi } from "../../../api/userApi";
import { useAsync } from "../../../hooks/useAsync";
import { getSportIcon } from "../../../utils/sportIcons.jsx";


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

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = validDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortTime(value) {
  const date = validDate(value);
  if (!date) return "시간 미정";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function normalizeScheduleMeeting(meeting, state) {
  return {
    id: meeting.id,
    title: meeting.title || "제목 없는 모임",
    place: meeting.location_name || meeting.address || "장소 미정",
    start_at: meeting.start_at,
    state,
    status: meeting.status, // 모집 상태(open, closed 등) 추가하여 캘린더에서 구분
    meeting_type: meeting.meeting_type // 일회성/정기 구분용 추가
  };
}

function buildMonthCells(baseDate, items) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return { key: `empty-${index}`, empty: true };
    const day = index - firstDay + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { key, day, items: items.filter((item) => dateKey(item.start_at) === key) };
  });
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
  const scheduleItems = useMemo(() => [
    ...(meetings.data?.hosted || []).map((meeting) => normalizeScheduleMeeting(meeting, "host")),
    ...(meetings.data?.joined || []).map((meeting) => normalizeScheduleMeeting(meeting, "joined"))
  ].filter((item) => validDate(item.start_at)).sort((a, b) => new Date(a.start_at) - new Date(b.start_at)), [meetings.data]);
  const monthBase = useMemo(() => new Date(), []);
  const [selectedScheduleKey, setSelectedScheduleKey] = useState("");
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const calendarCells = useMemo(() => buildMonthCells(monthBase, scheduleItems), [monthBase, scheduleItems]);
  const activeScheduleKey = selectedScheduleKey || dateKey(new Date());
  const selectedSchedules = scheduleItems.filter((item) => dateKey(item.start_at) === activeScheduleKey);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    try {
      await logout();
      sessionStorage.setItem("sportsmate_flash", "로그아웃 되었습니다.");
      navigate("/login", { replace: true });
    } catch (err) {
      console.error("로그아웃 실패:", err);
    } finally {
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
      <section className={`mobile-my-calendar ${isCalendarExpanded ? "is-expanded" : ""}`} aria-label="내 운동 일정">
        <header 
          className="mobile-my-calendar__head"
          onClick={() => setIsCalendarExpanded(!isCalendarExpanded)} 
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div>
            <span>{monthBase.getFullYear()}년 {monthBase.getMonth() + 1}월</span>
            <h2>내 운동 일정</h2>
          </div>
          <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
            {isCalendarExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </header>
        <div className={`mobile-my-calendar__body ${isCalendarExpanded ? "is-expanded" : ""}`}>
          <div className="mobile-my-calendar__week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
          <div className="mobile-my-calendar__grid">
            {calendarCells.map((cell) => {
              const isActive = activeScheduleKey === cell.key;
              return cell.empty ? (
                <span key={cell.key} aria-hidden="true" />
              ) : (
                <button key={cell.key} type="button" className={`${cell.items.length ? "has-event" : ""} ${isActive ? "is-active" : ""}`} onClick={() => cell.items.length && setSelectedScheduleKey(cell.key)} disabled={!cell.items.length} style={{ position: 'relative' }}>
                  <b>{cell.day}</b>
                  {cell.items.length ? (
                    <em style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      background: isActive ? '#ffffff' : '#4f46e5',
                      color: isActive ? '#4f46e5' : 'white',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      fontStyle: 'normal',
                      padding: '0 4px'
                    }}>
                      {cell.items.length}
                    </em>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mobile-my-calendar__list">
            {selectedSchedules.length ? selectedSchedules.map((item) => {
              // 모집 종료 여부 확인 (open이 아니면 종료로 간주)
              const isClosed = item.status !== "open";
              
              return (
                <Link key={`${item.state}-${item.id}`} to={item.state === "host" ? `/host/meetings/${item.id}` : `/meetings/${item.id}`}>
                  {/* 방장/참여중 및 모집 종료 여부를 직관적으로 보여주는 뱃지 영역 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: item.state === "host" ? "#eff6ff" : "#f0fdf4",
                      color: item.state === "host" ? "#3b82f6" : "#22c55e",
                      fontWeight: '800'
                    }}>
                      {item.state === "host" ? "👑 방장" : "🙌 참여중"}
                    </span>
                    
                    {/* 일회성 / 정기 구분 뱃지 */}
                    <span style={{
                      fontSize: '11px',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: "#fff7ed",
                      color: "#ea580c",
                      fontWeight: '800'
                    }}>
                      {item.meeting_type === "regular" ? "🔄 정기" : "⚡ 일회성"}
                    </span>
                    
                    {isClosed && (
                      <span style={{
                        fontSize: '11px',
                        padding: '3px 8px',
                        borderRadius: '12px',
                        background: "#f1f5f9",
                        color: "#64748b",
                        fontWeight: '800'
                      }}>
                        🔒 모집 종료
                      </span>
                    )}
                    
                    <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>
                      {shortTime(item.start_at)}
                    </span>
                  </div>
                  
                  {/* 모집 종료된 모임은 약간 흐리게 처리하여 시각적으로 구분 */}
                  <strong style={{ color: isClosed ? "#94a3b8" : "inherit" }}>{item.title}</strong>
                  <p style={{ color: isClosed ? "#cbd5e1" : "inherit" }}>{item.place}</p>
                </Link>
              );
            }) : <p>표시할 일정이 없습니다.</p>}
          </div>
        </div>
      </section>
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
        <Button variant="danger" className="mobile-mypage-logout-btn" onClick={handleLogout}>로그아웃</Button>
      </div>

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
