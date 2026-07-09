import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, Check, Dumbbell, Footprints, MapPin, MessageCircle, Pencil, ShieldCheck, Star, Trophy, X, ChevronDown, ChevronUp } from "lucide-react";
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

function getSportTagLabel(sport, preferredSportLevels) {
  const levelKey = preferredSportLevels?.[sport];
  const levelName = levelLabels[levelKey];
  return levelName ? `${sport}:${levelName}` : sport;
}

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
    state
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
  const calendarCells = useMemo(() => buildMonthCells(monthBase, scheduleItems), [monthBase, scheduleItems]);
  const activeScheduleKey = selectedScheduleKey || dateKey(new Date());
  const selectedSchedules = scheduleItems.filter((item) => dateKey(item.start_at) === activeScheduleKey);

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
          {preferredSports.length ? preferredSports.slice(0, 6).map((sport) => (
            <div key={sport} className="profile-card__sport-grid-item">
              <Dumbbell size={14} />
              <span>{getSportTagLabel(sport, profile.preferred_sport_levels)}</span>
            </div>
          )) : (
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
      <section className={`mobile-my-calendar ${isCalendarExpanded ? "is-expanded" : ""}`} aria-label="내 운동 일정">
        <div 
          className="mobile-my-calendar__head" 
          onClick={() => setIsCalendarExpanded(!isCalendarExpanded)} 
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div>
            <span>{monthBase.getFullYear()}년 {monthBase.getMonth() + 1}월</span>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              내 운동 일정
              {isCalendarExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </h2>
          </div>
          <Link to="/mypage/meetings" onClick={(e) => e.stopPropagation()}>전체 보기</Link>
        </div>
        <div className={`mobile-my-calendar__body ${isCalendarExpanded ? "is-expanded" : ""}`}>
          <div className="mobile-my-calendar__week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
          <div className="mobile-my-calendar__grid">
            {calendarCells.map((cell) => cell.empty ? (
              <span key={cell.key} aria-hidden="true" />
            ) : (
              <button key={cell.key} type="button" className={`${cell.items.length ? "has-event" : ""} ${activeScheduleKey === cell.key ? "is-active" : ""}`} onClick={() => cell.items.length && setSelectedScheduleKey(cell.key)} disabled={!cell.items.length}>
                <b>{cell.day}</b>
                {cell.items.length ? <em>{cell.items.length}</em> : null}
              </button>
            ))}
          </div>
          <div className="mobile-my-calendar__list">
            {selectedSchedules.length ? selectedSchedules.map((item) => (
              <Link key={`${item.state}-${item.id}`} to={item.state === "host" ? `/host/meetings/${item.id}` : `/meetings/${item.id}`}>
                <span>{item.state === "host" ? "방장" : "참여"} · {shortTime(item.start_at)}</span>
                <strong>{item.title}</strong>
                <p>{item.place}</p>
              </Link>
            )) : <p>표시할 일정이 없습니다.</p>}
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
