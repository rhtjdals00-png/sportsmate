import { Link, useNavigate } from "react-router-dom";
import {
  CalendarDays,
  Camera,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Crown,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Pencil,
  ShieldCheck,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { userApi } from "../../../api/userApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { useAsync } from "../../../hooks/useAsync";
import { markProfileEditVerified } from "../../../utils/profileEditAccess";

const PROFILE_INTRO_MAX_LENGTH = 30;
const PROFILE_INTRO_EMPTY_TEXT = "아직 한 줄 소개가 없습니다.";
const FALLBACK_PROFILE_IMAGE = "/images/logo.png";

const levelLabels = {
  // 2026-07-01: 모바일 프로필 기준과 동일하게 운동 수준 명칭을 통일.
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

function formatRating(value) {
  const rating = Number(value || 0);
  return rating > 0 ? rating.toFixed(1) : "0.0";
}

function formatAttendanceRate(value) {
  const rate = Number(value || 0);
  return rate > 0 ? `${Math.round(rate)}%` : "0%";
}

function formatDateTime(value) {
  if (!value) return "일정 미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}.${day}(${weekday}) ${hours}:${minutes}`;
}

function getDday(value) {
  if (!value) return "D-?";
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return "D-?";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : `D+${Math.abs(diff)}`;
}

function meetingImage(meeting) {
  return meeting.cover_image_url || meeting.image_url || meeting.thumbnail_url || FALLBACK_PROFILE_IMAGE;
}

function meetingMemberText(meeting) {
  const current = meeting.current_participants ?? 0;
  const max = meeting.max_participants ?? 0;
  return max ? `${current}/${max}` : `${current}`;
}

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `#${normalized}` : "";
}

function hasLinkedEmailProvider(user) {
  return (user?.provider || "")
    .split(",")
    .map((item) => item.trim())
    .includes("email");
}

function normalizeMeeting(meeting, state) {
  return {
    id: meeting.id,
    title: meeting.title || "제목 없는 모임",
    place: meeting.location_name || meeting.address || "장소 미정",
    time: formatDateTime(meeting.start_at),
    rawTime: meeting.start_at,
    member: meetingMemberText(meeting),
    state,
    img: meetingImage(meeting)
  };
}

function pageTitle(title, desc) {
  return (
    <div className="screen-title profile-page-title">
      <div>
        <h1>{title}</h1>
        <span>{desc}</span>
      </div>
    </div>
  );
}

function ScheduleItem({ item }) {
  const isHost = item.state === "host";
  return (
    <article className={`proto-schedule-item proto-schedule-item--profile ${isHost ? "proto-schedule-item--host" : ""}`}>
      {isHost && (
        <Link className="schedule-manage-btn is-active" to={`/host/meetings/${item.id}`}>
          <LayoutDashboard size={14} />
          관리
        </Link>
      )}
      <img src={item.img} alt={item.title} />
      <div>
        {isHost && (
          <div className="schedule-item-status">
            <span className="host-badge"><Crown size={13} />내가 방장</span>
          </div>
        )}
        <div className="schedule-meta-row">
          <span className="schedule-date">{item.time}</span>
          <span className="schedule-dday">{getDday(item.rawTime)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.place} · {item.member}</p>
        <footer>
          <Link className="ghost-btn" to={`/meetings/${item.id}`}><FileText size={14} />상세</Link>
          <Link className="ghost-btn" to={`/chats/${item.id}`}><MessageCircle size={14} />채팅</Link>
        </footer>
      </div>
    </article>
  );
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function calendarBaseDate(items) {
  const firstDate = items.map((item) => validDate(item.rawTime)).find(Boolean);
  return firstDate || new Date();
}

function calendarTitle(date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function calendarDayTitle(date) {
  if (!date) return "선택한 날짜";
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

function calendarItemTime(value) {
  const date = validDate(value);
  if (!date) return "시간 미정";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function calendarStateLabel(item) {
  if (item.state === "host") return "방장";
  if (item.state === "joined") return "참여";
  return "모집";
}

function buildCalendarCells(monthDate, items) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const currentDay = index - firstDay + 1;
    const outside = currentDay < 1 || currentDay > daysInMonth;
    const day = currentDay < 1
      ? daysInPrevMonth + currentDay
      : currentDay > daysInMonth
        ? currentDay - daysInMonth
        : currentDay;
    const cellDate = new Date(year, outside && currentDay < 1 ? month - 1 : outside ? month + 1 : month, day);
    const cellItems = outside ? [] : items.filter((item) => {
      const itemDate = validDate(item.rawTime);
      return itemDate
        && itemDate.getFullYear() === year
        && itemDate.getMonth() === month
        && itemDate.getDate() === day;
    });

    return { key: `${cellDate.toISOString()}-${index}`, date: cellDate, day, outside, items: cellItems };
  });
}

function CalendarModal({ open, items, onClose }) {
  const [monthDate, setMonthDate] = useState(() => calendarBaseDate(items));
  const [selectedDay, setSelectedDay] = useState(null);
  const cells = useMemo(() => buildCalendarCells(monthDate, items), [monthDate, items]);

  useEffect(() => {
    if (open) {
      setMonthDate(calendarBaseDate(items));
      setSelectedDay(null);
    }
  }, [open, items]);

  if (!open) return null;
  return (
    <>
      <div className="schedule-modal schedule-modal--calendar is-open is-calendar-modal" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <div className="schedule-modal-panel">
          <button className="schedule-modal-close" type="button" onClick={onClose}><X size={18} /></button>
          <h2 className="schedule-modal-title">다가오는 일정</h2>
          <div className="schedule-modal-body">
            <div className="profile-calendar-expanded">
              <section className="page-card calendar-card">
                <div className="calendar-head">
                  <button type="button" aria-label="이전 달" onClick={() => setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <p>{calendarTitle(monthDate)}</p>
                    <h2>내 운동 일정</h2>
                  </div>
                  <button type="button" aria-label="다음 달" onClick={() => setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="calendar-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
                <div className="calendar-grid">
                  {cells.map((cell) => (
                    <button
                      type="button"
                      key={cell.key}
                      className={`calendar-day profile-calendar-day ${cell.outside ? "is-outside" : ""} ${cell.items.length ? "has-event" : ""} ${cell.items.some((item) => item.state === "host") ? "host-day" : ""}`}
                      disabled={cell.outside || !cell.items.length}
                      onClick={() => cell.items.length && setSelectedDay(cell)}
                    >
                      <b>{cell.day}</b>
                      {cell.items[0] && (
                        <>
                          <small>{cell.items[0].title}</small>
                          <em>{cell.items.length > 1 ? `+${cell.items.length - 1}개 더보기` : `${calendarStateLabel(cell.items[0])} · ${calendarItemTime(cell.items[0].rawTime)}`}</em>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                {!items.length && <p className="empty-schedule profile-calendar-empty">표시할 일정이 없습니다.</p>}
              </section>
            </div>
          </div>
        </div>
      </div>
      {selectedDay && (
        <div className="schedule-modal schedule-modal--day is-open" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && setSelectedDay(null)}>
          <div className="schedule-modal-panel profile-calendar-day-panel">
            <button className="schedule-modal-close" type="button" onClick={() => setSelectedDay(null)}><X size={18} /></button>
            <h2 className="schedule-modal-title">{calendarDayTitle(selectedDay.date)} 일정</h2>
            <div className="schedule-modal-body">
              {selectedDay.items.map((item) => (
                <article className="schedule-modal-item" key={`${item.state}-${item.id}`}>
                  <img src={item.img} alt={item.title} />
                  <div>
                    {item.state === "host" && <div className="schedule-modal-status"><span className="board-badge host"><Crown size={13} />내가 방장</span></div>}
                    <span>{calendarItemTime(item.rawTime)}</span>
                    <h3>{item.title}</h3>
                    <p>{item.place} · {item.member}</p>
                    {item.state !== "host" && <span className={`board-badge ${item.state}`}>{calendarStateLabel(item)}</span>}
                    <footer>
                      <Link className="ghost-btn" to={`/meetings/${item.id}`}>상세 보기</Link>
                      {item.state === "host" && <Link className="ghost-btn" to={`/host/meetings/${item.id}`}>관리</Link>}
                    </footer>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DesktopMyPage() {
  const navigate = useNavigate();
  const { user: authUser, backendTokenReady, setCurrentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeActivity, setActiveActivity] = useState("schedule");
  const [introEdit, setIntroEdit] = useState(false);
  const [introDraft, setIntroDraft] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authChecking, setAuthChecking] = useState(false);
  const [savingIntro, setSavingIntro] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const canUseProtectedUserApi = Boolean(authUser && backendTokenReady);

  const profileState = useAsync(
    // 2026-07-01: 백엔드 JWT 준비 전 보호 API 호출로 발생하던 401 반복을 방지.
    () => (canUseProtectedUserApi ? userApi.me() : Promise.resolve({ user: null })),
    [canUseProtectedUserApi, authUser?.id, refreshKey]
  );
  const meetingsState = useAsync(
    () => (canUseProtectedUserApi ? userApi.myMeetings() : Promise.resolve({ hosted: [], joined: [], pending: [] })),
    [canUseProtectedUserApi, authUser?.id, refreshKey]
  );
  const reviewsState = useAsync(
    () => (canUseProtectedUserApi ? userApi.myReviews() : Promise.resolve({ items: [] })),
    [canUseProtectedUserApi, authUser?.id, refreshKey]
  );

  const user = profileState.data?.user || authUser;
  const profile = user?.profile || {};
  const displayTag = tagLabel(user);
  const preferredSports = splitPreferredSports(profile.preferred_sports);
  const savedIntro = profile.bio || "";
  const hostedMeetings = (meetingsState.data?.hosted || []).map((meeting) => normalizeMeeting(meeting, "host"));
  const joinedMeetings = (meetingsState.data?.joined || []).map((meeting) => normalizeMeeting(meeting, "joined"));
  const scheduled = useMemo(
    () => [...hostedMeetings, ...joinedMeetings].sort((a, b) => new Date(a.rawTime || 0) - new Date(b.rawTime || 0)),
    [hostedMeetings, joinedMeetings]
  );
  const reviewItems = reviewsState.data?.items || [];

  const activityPanels = {
    schedule: { label: "다가오는 일정", count: scheduled.length, items: scheduled },
    hosted: { label: "내가 만든 모임", count: hostedMeetings.length, items: hostedMeetings },
    joined: { label: "참여 중인 모임", count: joinedMeetings.length, items: joinedMeetings },
    favorite: { label: "관심 모임", count: 0, items: [] },
    reviews: { label: "후기 관리", count: reviewItems.length, items: reviewItems }
  };
  const activityMenu = [
    { key: "schedule", label: "다가오는 일정", icon: CalendarDays },
    { key: "hosted", label: "내가 만든 모임", icon: Crown },
    { key: "joined", label: "참여 중인 모임", icon: Users },
    { key: "favorite", label: "관심 모임", icon: CircleDot },
    { key: "reviews", label: "후기 관리", icon: FileText }
  ];
  const activePanel = activityPanels[activeActivity];
  // 2026-07-02: PC 프로필 수정 보호는 SportsMate DB provider에 email 연동이 실제 반영된 경우에만 통과.
  const canVerifyPassword = hasLinkedEmailProvider(user);

  const startIntroEdit = () => {
    setIntroDraft(savedIntro.slice(0, PROFILE_INTRO_MAX_LENGTH));
    setIntroEdit(true);
  };

  const saveIntro = async () => {
    if (!canUseProtectedUserApi) return;
    const nextIntro = introDraft.trim().slice(0, PROFILE_INTRO_MAX_LENGTH);
    setSavingIntro(true);
    try {
      // 2026-07-01: PC 내 정보 한 줄 소개를 백엔드 프로필 bio와 연결.
      const data = await userApi.updateMe({ bio: nextIntro });
      setCurrentUser?.(data.user);
      setRefreshKey((key) => key + 1);
      setIntroEdit(false);
    } finally {
      setSavingIntro(false);
    }
  };

  const changeProfileImage = (event) => {
    if (!canUseProtectedUserApi) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const imageUrl = reader.result;
      // 2026-07-01: 실제 파일 업로드 API 도입 전까지 프로필 이미지 URL 필드에 미리보기 값을 저장.
      const data = await userApi.updateMe({ profile_image_url: imageUrl });
      setCurrentUser?.(data.user);
      setRefreshKey((key) => key + 1);
    };
    reader.readAsDataURL(file);
  };

  const openProtectedEdit = () => {
    setAuthError("");
    if (!canVerifyPassword) {
      setAuthPassword("");
      setAuthOpen("account-link");
      return;
    }
    setAuthOpen(true);
    setAuthPassword("");
  };

  const confirmProtectedEdit = async () => {
    if (!authPassword.trim()) {
      setAuthError("비밀번호를 입력해주세요.");
      return;
    }

    setAuthChecking(true);
    setAuthError("");
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("인증 서비스 설정을 확인해주세요.");
      }
      // 2026-07-02: 비밀번호 원본은 Supabase Auth에 있으므로 Supabase 로그인 검증을 먼저 수행.
      const { error: supabaseError } = await supabase.auth.signInWithPassword({
        email: user?.email || "",
        password: authPassword
      });
      if (supabaseError) {
        throw new Error("비밀번호가 올바르지 않습니다.");
      }
      await userApi.verifyPassword({ password: authPassword });
      markProfileEditVerified();
      setAuthOpen(false);
      navigate("/mypage/profile");
    } catch (error) {
      setAuthError(error?.response?.data?.message || "비밀번호 확인에 실패했습니다.");
    } finally {
      setAuthChecking(false);
    }
  };

  if (!authUser && !profileState.loading) {
    return (
      <div className="desktop-prototype">
        {pageTitle("내 정보", "로그인 후 프로필과 운동 일정을 확인할 수 있습니다.")}
        <section className="page-card">
          <p className="empty-schedule">로그인이 필요합니다.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="desktop-prototype">
      {pageTitle("내 정보", "프로필을 관리하고 이번 달 운동 일정을 모니터링합니다.")}
      <div className="profile-grid profile-grid--8b">
        <div className="profile-left-stack">
          <section className="profile-card profile-gold-card">
            <button className="profile-edit-btn" type="button" onClick={openProtectedEdit}>프로필 수정</button>
            <label className="profile-photo-quick" aria-label="프로필 사진 바꾸기">
              <Camera size={15} />
              <input type="file" accept="image/*" onChange={changeProfileImage} />
            </label>
            <img src={user?.profile_image_url || FALLBACK_PROFILE_IMAGE} alt="프로필 이미지" />
            <h2>{user?.nickname || user?.name || "스포츠메이트"}</h2>
            {displayTag && <span className="profile-user-tag">{displayTag}</span>}
            <div className="profile-intro-slot">
              {introEdit ? (
                <div className="profile-intro-edit">
                  <input
                    value={introDraft}
                    maxLength={PROFILE_INTRO_MAX_LENGTH}
                    onChange={(event) => setIntroDraft(event.target.value.slice(0, PROFILE_INTRO_MAX_LENGTH))}
                  />
                  <div>
                    <span>{introDraft.length}/{PROFILE_INTRO_MAX_LENGTH}</span>
                    <button type="button" onClick={saveIntro} disabled={savingIntro}>{savingIntro ? "저장 중" : "저장"}</button>
                    <button type="button" onClick={() => { setIntroDraft(savedIntro); setIntroEdit(false); }}>취소</button>
                  </div>
                </div>
              ) : (
                <div className="profile-intro-quick">
                  <span className={!savedIntro ? "is-empty" : ""}>{savedIntro || PROFILE_INTRO_EMPTY_TEXT}</span>
                  <button type="button" onClick={startIntroEdit}><Pencil size={12} />수정</button>
                </div>
              )}
            </div>
            <div className="profile-stats-row">
              <span><b>{formatRating(profile.rating_average)}</b><em>평점</em></span>
              <span><b>{formatAttendanceRate(profile.attendance_rate)}</b><em>참여율</em></span>
              <span><b>{joinedMeetings.length}회</b><em>누적 참여</em></span>
            </div>
          </section>
          <section className="page-card profile-preference-card">
            <h3>기본 정보 및 운동 성향</h3>
            <div className="preference-list">
              <p><b>선호 지역</b><span>{profile.region || "미설정"}</span></p>
              <p><b>관심 종목</b><span>{preferredSports.length ? preferredSports.join(", ") : "미설정"}</span></p>
              <p><b>운동 수준</b><span>{levelLabels[profile.exercise_level] || "미설정"}</span></p>
            </div>
          </section>
        </div>

        <section className="page-card schedule-list profile-schedule-panel">
          <div className="profile-activity-tabs">
            {activityMenu.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                className={activeActivity === key ? "is-active" : ""}
                type="button"
                onClick={() => setActiveActivity(key)}
              >
                <Icon size={15} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          <div className="section-head profile-schedule-head">
            <div>
              <h2>{activePanel.label} <span className="schedule-count-inline">{activePanel.count}개</span></h2>
            </div>
            <div className={`profile-schedule-actions ${activeActivity !== "schedule" ? "is-placeholder" : ""}`}>
              {activeActivity === "schedule" ? (
                <button className="calendar-expand-btn" type="button" onClick={() => setCalendarOpen(true)}><CalendarDays size={15} />달력으로 보기</button>
              ) : (
                <span aria-hidden="true">달력으로 보기</span>
              )}
            </div>
          </div>
          <div className="profile-schedule-body">
            {(meetingsState.loading || reviewsState.loading) && <p className="empty-schedule">내 활동 정보를 불러오는 중입니다.</p>}
            {!meetingsState.loading && !reviewsState.loading && activeActivity === "reviews" && (
              reviewItems.length ? reviewItems.map((review) => (
                <article className="profile-review-item" key={review.id}>
                  <div>
                    <b>{review.content || "작성한 후기"}</b>
                    <span>평점 {review.rating || 0}점</span>
                  </div>
                  <Link className="ghost-btn" to={`/meetings/${review.meeting_id}`}>모임 보기</Link>
                </article>
              )) : <p className="empty-schedule">작성한 후기가 없습니다.</p>
            )}
            {!meetingsState.loading && !reviewsState.loading && activeActivity === "favorite" && (
              <p className="empty-schedule">관심 모임 기능은 아직 준비 중입니다.</p>
            )}
            {!meetingsState.loading && !reviewsState.loading && !["reviews", "favorite"].includes(activeActivity) && (
              activePanel.items.length
                ? activePanel.items.map((item) => <ScheduleItem key={`${item.state}-${item.id}`} item={item} />)
                : <p className="empty-schedule">표시할 항목이 없습니다.</p>
            )}
          </div>
        </section>
      </div>

      {authOpen === true && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
          <form
            className="profile-auth-modal"
            onSubmit={(event) => {
              event.preventDefault();
              if (!authChecking) confirmProtectedEdit();
            }}
          >
            <button className="schedule-modal-close" type="button" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            <ShieldCheck size={26} />
            <h2>프로필 수정 확인</h2>
            <p>중요한 프로필 정보를 수정하기 전에 비밀번호 확인이 필요합니다.</p>
            <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} placeholder="비밀번호 입력" />
            {authError && <em className="nickname-check warn">{authError}</em>}
            <div>
              <button className="ghost-btn" type="button" onClick={() => setAuthOpen(false)}>취소</button>
              <button className="primary-small" type="submit" disabled={authChecking}>{authChecking ? "확인 중" : "확인"}</button>
            </div>
          </form>
        </div>
      )}
      {authOpen === "account-link" && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setAuthOpen(false)}>
          <section className="profile-auth-modal">
            <button className="schedule-modal-close" type="button" onClick={() => setAuthOpen(false)}><X size={18} /></button>
            <ShieldCheck size={26} />
            <h2>계정 연동이 필요합니다</h2>
            <p>소셜 로그인 계정은 이름, 핸드폰 번호, 이메일 로그인 정보를 등록한 뒤 프로필 수정을 이용할 수 있습니다.</p>
            <div>
              <button className="ghost-btn" type="button" onClick={() => setAuthOpen(false)}>나중에 하기</button>
              <button className="primary-small" type="button" onClick={() => navigate("/mypage/account-link")}>연동하기</button>
            </div>
          </section>
        </div>
      )}
      <CalendarModal open={calendarOpen} items={scheduled} onClose={() => setCalendarOpen(false)} />
    </div>
  );
}

export default DesktopMyPage;
