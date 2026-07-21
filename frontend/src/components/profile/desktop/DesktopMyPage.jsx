import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  CalendarDays,
  Camera,
  Cloud,
  CloudRain,
  ChevronLeft,
  ChevronRight,
  Crown,
  Droplets,
  FileText,
  LayoutDashboard,
  MessageCircle,
  Pencil,
  Snowflake,
  Sparkles,
  Sun,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { userApi } from "../../../api/userApi";
import { meetingApi } from "../../../api/meetingApi";
import DesktopScheduleCalendarModal, {
  buildDesktopScheduleItems,
  DesktopScheduleCancelModal,
  DesktopScheduleChangeModal,
  normalizeDesktopScheduleMeeting
} from "../../schedule/desktop/DesktopScheduleCalendarModal.jsx";
import { getDesktopScheduleState } from "../../schedule/desktop/DesktopScheduleCard.jsx";
import { weatherApi } from "../../../api/weatherApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { useAsync } from "../../../hooks/useAsync";

const PROFILE_INTRO_MAX_LENGTH = 30;
const PROFILE_INTRO_EMPTY_TEXT = "아직 한 줄 소개가 없습니다.";
const FALLBACK_PROFILE_IMAGE = "/images/logo.png";
const MEETING_FILTERS = [
  { key: "all", label: "전체" },
  { key: "regular", label: "정기모임" },
  { key: "one_time", label: "일회성" },
  { key: "ended", label: "종료됨" }
];

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

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isUpcomingSchedule(value) {
  if (!value) return false;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target >= today;
}

function isMeetingEnded(item) {
  return getDesktopScheduleState(item).isEnded;
}

function filterMeetingItems(items, filter) {
  if (filter === "regular") return items.filter((item) => item.meetingType === "regular");
  if (filter === "one_time") return items.filter((item) => item.meetingType === "one_time");
  if (filter === "ended") return items.filter(isMeetingEnded);
  return items;
}

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `#${normalized}` : "";
}

function normalizeMeeting(meeting, state) {
  const isRegular = meeting.meeting_type === "regular";
  const allSessions = sortSessionsByStart(meeting.sessions || []);
  const scheduledSessions = allSessions.filter((session) => session.status === "scheduled");
  const now = new Date();
  const currentSession = scheduledSessions.find((session) => {
    const start = validDate(session.start_at);
    const end = validDate(session.end_at);
    return start && end && start <= now && now < end;
  });
  const fallbackNextSession = currentSession || scheduledSessions.find((session) => isUpcomingSchedule(session.start_at));
  const nextSession = isRegular ? meeting.next_session || fallbackNextSession || null : null;
  const lastSession = isRegular ? [...scheduledSessions].reverse().find((session) => validDate(session.start_at)) : null;
  // 2026-07-13: 정기모임은 Meeting.start_at만으로 종료 판단하지 않고 실제 회차 데이터를 우선한다.
  const operationEndAt = meeting.end_at || null;
  const shouldUseLastSession = isRegular && !nextSession && operationEndAt && isPastDateTime(operationEndAt);
  const scheduleStart = isRegular ? (nextSession?.start_at || (shouldUseLastSession ? lastSession?.start_at : null) || null) : meeting.start_at;
  const scheduleEnd = isRegular ? (nextSession?.end_at || (shouldUseLastSession ? lastSession?.end_at : null) || null) : meeting.end_at;
  return {
    id: meeting.id,
    title: meeting.title || "제목 없는 모임",
    place: meeting.location_name || meeting.address || "장소 미정",
    address: meeting.address || meeting.location_name || "",
    latitude: meeting.latitude,
    longitude: meeting.longitude,
    meetingType: meeting.meeting_type || "one_time",
    meetingTypeLabel: meetingTypeLabel(meeting.meeting_type),
    status: meeting.status || "",
    sportName: sportNameOf(meeting),
    nextSession,
    repeatRule: meeting.repeat_rule || "",
    repeatLabel: isRegular ? formatRegularMeetingSchedule({ ...meeting, next_session: nextSession, sessions: scheduledSessions }, "") : "",
    time: formatDateTime(scheduleStart),
    rawTime: scheduleStart || null,
    endTime: scheduleEnd || null,
    operationEndAt,
    sessions: allSessions,
    member: meetingMemberText(meeting),
    state,
    chatRoomId: meeting.chat_room_id,
    img: meetingImage(meeting)
  };
}

function uniqueMeetingsById(items) {
  const byId = new Map();
  items.forEach((item) => {
    const key = String(item.id);
    const existing = byId.get(key);
    if (!existing || (item.state === "host" && existing.state !== "host")) {
      byId.set(key, item);
    }
  });
  return Array.from(byId.values());
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

function ScheduleTag({ children, tone = "sport" }) {
  return <span className={`profile-schedule-tag is-${tone}`}>{children}</span>;
}

function CalendarWeatherIcon({ condition }) {
  if (["rain", "rain_snow", "shower"].includes(condition)) return <CloudRain size={17} />;
  if (condition === "snow") return <Snowflake size={17} />;
  if (condition === "clear") return <Sun size={17} />;
  return <Cloud size={17} />;
}

function CalendarMeetingWeather({ item }) {
  const [forecast, setForecast] = useState(null);

  useEffect(() => {
    let active = true;
    const target = validDate(item.rawTime);
    const latitude = Number(item.latitude);
    const longitude = Number(item.longitude);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const targetDay = target ? new Date(target.getFullYear(), target.getMonth(), target.getDate()) : null;
    const daysAway = targetDay ? Math.round((targetDay - today) / 86400000) : null;

    setForecast(null);
    if (
      item.sessionStatus === "cancelled"
      || !target
      || target < new Date(now.getTime() - 2 * 60 * 60 * 1000)
      || daysAway < 0
      || daysAway > 10
      || !Number.isFinite(latitude)
      || !Number.isFinite(longitude)
    ) {
      return () => { active = false; };
    }

    weatherApi.forecast({
      latitude,
      longitude,
      at: item.rawTime,
      address: item.address || item.place || "",
    })
      .then((data) => {
        if (active && data.forecast?.available) setForecast(data.forecast);
      })
      .catch(() => {
        if (active) setForecast(null);
      });

    return () => { active = false; };
  }, [item.address, item.latitude, item.longitude, item.place, item.rawTime, item.sessionStatus]);

  if (!forecast) return null;
  const temperature = forecast.temperature_c != null ? `${Math.round(forecast.temperature_c)}°` : "";
  const temperatureRange = forecast.temperature_min_c != null || forecast.temperature_max_c != null
    ? `${forecast.temperature_min_c != null ? `${Math.round(forecast.temperature_min_c)}°` : "-"} / ${forecast.temperature_max_c != null ? `${Math.round(forecast.temperature_max_c)}°` : "-"}`
    : "";

  return (
    <div className="profile-calendar-weather" aria-label="모임 날씨">
      <CalendarWeatherIcon condition={forecast.condition} />
      <strong>{forecast.condition_label}{temperature ? ` ${temperature}` : ""}</strong>
      {temperatureRange ? <span>최저/최고 {temperatureRange}</span> : null}
      {forecast.precipitation_probability != null ? <span><Droplets size={13} /> 강수 {Math.round(forecast.precipitation_probability)}%</span> : null}
    </div>
  );
}

function recruitmentTag(status) {
  if (status === "open") return { label: "모집중", tone: "sport" };
  if (status === "full" || status === "closed") return { label: "모집마감", tone: "one-time" };
  if (status === "cancelled") return { label: "취소됨", tone: "one-time" };
  if (status === "suspended") return { label: "운영중지", tone: "one-time" };
  return null;
}

function MeetingFilterChips({ value, onChange }) {
  return (
    <div className="profile-meeting-filters" aria-label="모임 유형 필터">
      {MEETING_FILTERS.map((filter) => (
        <button
          key={filter.key}
          type="button"
          className={value === filter.key ? "is-active" : ""}
          aria-pressed={value === filter.key}
          onClick={() => onChange(filter.key)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}

function ScheduleItem({ item, variant = "schedule" }) {
  const isHost = item.state === "host";
  const showTypeTag = Boolean(item.meetingTypeLabel);
  const scheduleState = getDesktopScheduleState(item);
  const recruitment = recruitmentTag(item.status);
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
        {(showTypeTag || item.sportName || recruitment) && (
          <div className="profile-schedule-tags">
            {showTypeTag && <ScheduleTag tone={item.meetingType === "regular" ? "regular" : "one-time"}>{item.meetingTypeLabel}</ScheduleTag>}
            {item.sportName && <ScheduleTag tone="sport">{item.sportName}</ScheduleTag>}
            {recruitment && <ScheduleTag tone={recruitment.tone}>{recruitment.label}</ScheduleTag>}
          </div>
        )}
        <div className="schedule-meta-row">
          <span className="schedule-date">{item.time}</span>
          <span className={`schedule-dday ${scheduleState.isEnded ? "is-ended" : ""}`}>{scheduleState.label}</span>
        </div>
        <h3>{item.title}</h3>
        {item.repeatLabel && <p>{item.repeatLabel}</p>}
        <p>{item.place} · {item.member}</p>
        <footer>
          <Link className="ghost-btn" to={`/meetings/${item.id}`}><FileText size={14} />상세</Link>
          <Link className="ghost-btn" to={item.chatRoomId ? `/chats/${item.chatRoomId}` : "/chats"}><MessageCircle size={14} />채팅</Link>
        </footer>
      </div>
    </article>
  );
}
function DesktopMyPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user: authUser, backendTokenReady, setCurrentUser } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeActivity, setActiveActivity] = useState("schedule");
  const [introEdit, setIntroEdit] = useState(false);
  const [introDraft, setIntroDraft] = useState("");
  const [savingIntro, setSavingIntro] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarHighlight, setCalendarHighlight] = useState({ meetingId: "", chatRoomId: "", source: "", autoOpen: false });
  const [calendarMeetings, setCalendarMeetings] = useState(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState("");
  const [scheduleAction, setScheduleAction] = useState(null);
  const [scheduleActionSubmitting, setScheduleActionSubmitting] = useState(false);
  const [scheduleActionError, setScheduleActionError] = useState("");
  const [createdMeetingFilter, setCreatedMeetingFilter] = useState("all");
  const [joinedMeetingFilter, setJoinedMeetingFilter] = useState("all");

  const [reviewSubTab, setReviewSubTab] = useState("written"); // "written" | "received"
  const [writingReview, setWritingReview] = useState(null); // { meetingId, peerId, peerNickname, meetingTitle }
  const [rating, setRating] = useState(5);
  const [reviewContent, setReviewContent] = useState("");

  useEffect(() => {
    const panel = searchParams.get("panel");
    if (panel) {
      const validPanels = ["schedule", "hosted", "joined", "reviews"];
      setActiveActivity(validPanels.includes(panel) ? panel : "schedule");
    }
    if (searchParams.get("calendar") === "1") {
      setActiveActivity("schedule");
      setCalendarHighlight({
        meetingId: searchParams.get("meeting") || "",
        chatRoomId: searchParams.get("chat") || "",
        source: searchParams.get("from") || "",
        autoOpen: true
      });
      setCalendarOpen(true);
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("calendar");
      nextParams.delete("meeting");
      nextParams.delete("chat");
      nextParams.delete("from");
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
  const writtenReviewsState = useAsync(
    () => (canUseProtectedUserApi ? userApi.myWrittenReviews() : Promise.resolve({ items: [] })),
    [canUseProtectedUserApi, authUser?.id, refreshKey]
  );
  const receivedReviewsState = useAsync(
    () => (canUseProtectedUserApi ? userApi.myReceivedReviews() : Promise.resolve({ items: [] })),
    [canUseProtectedUserApi, authUser?.id, refreshKey]
  );
  const pendingReviewsState = useAsync(
    () => (canUseProtectedUserApi ? userApi.myPendingReviews() : Promise.resolve({ items: [] })),
    [canUseProtectedUserApi, authUser?.id, refreshKey]
  );
  const reviewsLoading = writtenReviewsState.loading || receivedReviewsState.loading || pendingReviewsState.loading;

  useEffect(() => {
    if (!calendarOpen || !canUseProtectedUserApi) return;
    let cancelled = false;
    setCalendarLoading(true);
    setCalendarError("");
    userApi.myCalendar()
      .then((data) => {
        if (!cancelled) setCalendarMeetings(data);
      })
      .catch(() => {
        if (!cancelled) setCalendarError("달력 일정을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setCalendarLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [calendarOpen, canUseProtectedUserApi, authUser?.id, refreshKey]);

  const refreshCalendarData = async () => {
    if (!canUseProtectedUserApi) return;
    const data = await userApi.myCalendar();
    setCalendarMeetings(data);
  };

  const openScheduleAction = (type, item) => {
    setScheduleAction({ type, item });
    setScheduleActionError("");
  };

  const closeScheduleAction = () => {
    if (scheduleActionSubmitting) return;
    setScheduleAction(null);
    setScheduleActionError("");
  };

  const handleScheduleChange = async (payload, clientError = "") => {
    if (clientError) {
      setScheduleActionError(clientError);
      return;
    }
    if (!scheduleAction?.item || !payload) return;
    setScheduleActionSubmitting(true);
    setScheduleActionError("");
    try {
      await meetingApi.updateSession(scheduleAction.item.id, scheduleAction.item.sessionId, payload);
      await refreshCalendarData();
      setRefreshKey((key) => key + 1);
      setScheduleAction(null);
      alert("일정이 변경되었습니다.");
    } catch (error) {
      setScheduleActionError(error.response?.data?.message || "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setScheduleActionSubmitting(false);
    }
  };

  const handleScheduleCancel = async (payload, clientError = "") => {
    if (clientError) {
      setScheduleActionError(clientError);
      return;
    }
    if (!scheduleAction?.item || !payload?.reason) return;
    setScheduleActionSubmitting(true);
    setScheduleActionError("");
    try {
      await meetingApi.cancelSession(scheduleAction.item.id, scheduleAction.item.sessionId, payload.reason);
      await refreshCalendarData();
      setRefreshKey((key) => key + 1);
      setScheduleAction(null);
      alert("일정이 취소되었습니다.");
    } catch (error) {
      setScheduleActionError(error.response?.data?.message || "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setScheduleActionSubmitting(false);
    }
  };

  const user = profileState.data?.user || authUser;
  const profile = user?.profile || {};
  const displayTag = tagLabel(user);
  const preferredSports = splitPreferredSports(profile.preferred_sports);
  const savedIntro = profile.bio || "";
  const hostedMeetings = (meetingsState.data?.hosted || []).map((meeting) => normalizeDesktopScheduleMeeting(meeting, "host"));
  const joinedMeetings = (meetingsState.data?.joined || []).map((meeting) => normalizeDesktopScheduleMeeting(meeting, "joined"));
  const filteredHostedMeetings = useMemo(
    () => filterMeetingItems(hostedMeetings, createdMeetingFilter),
    [createdMeetingFilter, hostedMeetings]
  );
  const filteredJoinedMeetings = useMemo(
    () => filterMeetingItems(joinedMeetings, joinedMeetingFilter),
    [joinedMeetingFilter, joinedMeetings]
  );
  const calendarHostedMeetings = (calendarMeetings?.hosted || []).map((meeting) => normalizeDesktopScheduleMeeting(meeting, "host"));
  const calendarJoinedMeetings = (calendarMeetings?.joined || []).map((meeting) => normalizeDesktopScheduleMeeting(meeting, "joined"));
  const scheduled = useMemo(
    () => uniqueMeetingsById([...hostedMeetings, ...joinedMeetings])
      .filter((item) => isUpcomingSchedule(item.rawTime))
      .sort((a, b) => validDate(a.rawTime) - validDate(b.rawTime)),
    [hostedMeetings, joinedMeetings]
  );
  const calendarItems = useMemo(
    () => {
      const sourceItems = calendarMeetings
        ? [...calendarHostedMeetings, ...calendarJoinedMeetings]
        : [...hostedMeetings, ...joinedMeetings];
      return buildDesktopScheduleItems(uniqueMeetingsById(sourceItems));
    },
    [calendarHostedMeetings, calendarJoinedMeetings, calendarMeetings, hostedMeetings, joinedMeetings]
  );
  const resolveCalendarActions = (item) => {
    const actions = [{ key: "detail", label: "상세 보기", to: `/meetings/${item.id}` }];
    if (item.chatRoomId) actions.push({ key: "chat", label: "채팅으로 이동", to: `/chats/${item.chatRoomId}`, tone: "primary" });
    if (item.state === "host") actions.push({ key: "manage", label: "관리", to: `/host/meetings/${item.id}` });
    const canManageSchedule = item.state === "host"
      && item.meetingType === "regular"
      && item.sessionId
      && item.sessionStatus === "scheduled"
      && validDate(item.startAt) > new Date();
    if (canManageSchedule) {
      actions.push({ key: "change", label: "일정 변경", onClick: () => openScheduleAction("change", item) });
      actions.push({ key: "cancel", label: "회차 취소", tone: "danger", onClick: () => openScheduleAction("cancel", item) });
    }
    return actions;
  };
  const writtenReviews = writtenReviewsState.data?.items || [];
  const receivedReviews = receivedReviewsState.data?.items || [];
  const pendingReviews = pendingReviewsState.data?.items || [];

  const pendingReviewsByMeeting = useMemo(() => {
    const grouped = {};
    for (const item of pendingReviews) {
      const mId = item.meeting.id;
      if (!grouped[mId]) {
        grouped[mId] = {
          meeting: item.meeting,
          peers: []
        };
      }
      grouped[mId].peers.push(item.peer);
    }
    return Object.values(grouped).sort((a, b) => {
      const timeA = validDate(a.meeting.start_time)?.getTime() ?? -Infinity;
      const timeB = validDate(b.meeting.start_time)?.getTime() ?? -Infinity;
      return timeB - timeA;
    });
  }, [pendingReviews]);

  const activityPanels = {
    schedule: { label: "다가오는 일정", count: scheduled.length, items: scheduled },
    hosted: { label: "내가 만든 모임", count: filteredHostedMeetings.length, items: filteredHostedMeetings, sourceCount: hostedMeetings.length, filter: createdMeetingFilter, setFilter: setCreatedMeetingFilter },
    joined: { label: "참여한 모임", count: filteredJoinedMeetings.length, items: filteredJoinedMeetings, sourceCount: joinedMeetings.length, filter: joinedMeetingFilter, setFilter: setJoinedMeetingFilter },
    reviews: { label: "후기 관리", count: writtenReviews.length + receivedReviews.length, items: [] }
  };
  const activityMenu = [
    { key: "schedule", label: "다가오는 일정", icon: CalendarDays },
    { key: "hosted", label: "내가 만든 모임", icon: Crown },
    { key: "joined", label: "참여한 모임", icon: Users },
    { key: "reviews", label: "후기 관리", icon: FileText }
  ];
  const activePanel = activityPanels[activeActivity];
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

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!writingReview) return;
    try {
      if (writingReview.isEdit) {
        await userApi.updateReview(writingReview.id, {
          rating,
          content: reviewContent
        });
        alert("후기가 수정되었습니다.");
      } else {
        await meetingApi.createReview(writingReview.meetingId, {
          reviewee_id: writingReview.peerId,
          rating,
          content: reviewContent
        });
        alert("후기가 등록되었습니다.");
      }
      setWritingReview(null);
      setReviewContent("");
      setRating(5);
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || "후기 처리 중 오류가 발생했습니다.");
    }
  };

  const handleEditReviewOpen = (review) => {
    setRating(review.rating);
    setReviewContent(review.content);
    setWritingReview({
      id: review.id,
      peerNickname: review.reviewee?.nickname || review.reviewee?.name || "사용자",
      meetingTitle: review.meeting?.title || "모임",
      isEdit: true
    });
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm("후기를 삭제하시겠습니까? 삭제 후 복구할 수 없습니다.")) return;
    try {
      await userApi.deleteReview(reviewId);
      alert("후기가 삭제되었습니다.");
      setRefreshKey((prev) => prev + 1);
    } catch (err) {
      alert(err.response?.data?.message || "후기 삭제에 실패했습니다.");
    }
  };

  const changeProfileImage = (event) => {
    if (!canUseProtectedUserApi) return;
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const imageUrl = reader.result;
      // 2026-07-01: 실제 파일 업로드 API 도입 전까지 프로필 이미지 URL 필드를 미리보기 값으로 저장.
      const data = await userApi.updateMe({ profile_image_url: imageUrl });
      setCurrentUser?.(data.user);
      setRefreshKey((key) => key + 1);
    };
    reader.readAsDataURL(file);
  };

  const openProtectedEdit = () => {
    navigate("/mypage/profile");
  };

  useEffect(() => {
    if (searchParams.get("edit_profile") === "1") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("edit_profile");
      setSearchParams(nextParams, { replace: true });
      openProtectedEdit();
    }
  }, [searchParams, setSearchParams]);

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
                    <button type="button" onClick={saveIntro} disabled={savingIntro}>저장</button>
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
            <div className={`profile-schedule-actions ${!["schedule", "hosted", "joined"].includes(activeActivity) ? "is-placeholder" : ""}`}>
              {["hosted", "joined"].includes(activeActivity) ? (
                <MeetingFilterChips value={activePanel.filter} onChange={activePanel.setFilter} />
              ) : activeActivity === "schedule" ? (
                <button className="calendar-expand-btn" type="button" onClick={() => { setCalendarHighlight((current) => ({ ...current, source: "", autoOpen: false })); setCalendarOpen(true); }}><CalendarDays size={15} />달력으로 보기</button>
              ) : (
                <span aria-hidden="true">달력으로 보기</span>
              )}
            </div>
          </div>
          <div className="profile-schedule-body">
            {(meetingsState.loading || reviewsLoading) && <p className="empty-schedule">활동 정보를 불러오는 중입니다.</p>}
            {!meetingsState.loading && !reviewsLoading && activeActivity === "reviews" && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
                {/* Sub tabs */}
                <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '10px' }}>
                  <button
                    type="button"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: reviewSubTab === "written" ? '#3b82f6' : 'transparent',
                      color: reviewSubTab === "written" ? '#ffffff' : '#4b5563',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setReviewSubTab("written")}
                  >
                    내가 작성한 후기
                  </button>
                  <button
                    type="button"
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      border: 'none',
                      backgroundColor: reviewSubTab === "received" ? '#3b82f6' : 'transparent',
                      color: reviewSubTab === "received" ? '#ffffff' : '#4b5563',
                      transition: 'all 0.2s'
                    }}
                    onClick={() => setReviewSubTab("received")}
                  >
                    내가 받은 후기
                  </button>
                </div>

                {/* Sub tab contents */}
                {reviewSubTab === "written" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* 1. Pending reviews (Writeable Reviews) */}
                    {pendingReviewsByMeeting.length > 0 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '10px' }}>
                        <h4 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 4px 0', color: '#111827' }}>작성 가능한 후기</h4>
                        {pendingReviewsByMeeting.map((group) => (
                          <div key={group.meeting.id} style={{ backgroundColor: '#f9fafb', borderRadius: '12px', padding: '16px', border: '1px solid #e5e7eb' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px', marginBottom: '12px' }}>
                              <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#0369a1', backgroundColor: '#e0f2fe', padding: '2px 8px', borderRadius: '4px' }}>모임</span>
                              <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#1f2937' }}>{group.meeting.title}</span>
                              {group.meeting.start_time && (
                                <span style={{ fontSize: '13px', fontWeight: '500', color: '#4b5563', marginLeft: 'auto' }}>
                                  {new Date(group.meeting.start_time).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                              {group.peers.map((peer) => (
                                <div key={peer.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #f3f4f6', boxShadow: '0 1px 2px rgba(0,0,0,0.02)' }}>
                                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#374151' }}>{peer.nickname || peer.name || "사용자"}님</span>
                                  <button
                                    type="button"
                                    className="ghost-btn"
                                    style={{ backgroundColor: '#3b82f6', color: '#ffffff', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: '600' }}
                                    onClick={() => setWritingReview({
                                      meetingId: group.meeting.id,
                                      peerId: peer.id,
                                      peerNickname: peer.nickname || peer.name || "사용자",
                                      meetingTitle: group.meeting.title
                                    })}
                                  >
                                    후기 작성
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 2. Written reviews list */}
                    {writtenReviews.length ? writtenReviews.map((review) => (
                      <article className="profile-review-item" key={review.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#9ca3af', display: 'block' }}>{review.meeting?.title || "모임"}</span>
                          <b style={{ fontSize: '14px', color: '#1f2937' }}>{review.reviewee?.nickname || review.reviewee?.name || "사용자"}님에게 남긴 후기</b>
                          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#4b5563' }}>{review.content}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#eab308' }}>★ {review.rating || 0}</span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              className="ghost-btn"
                              style={{ fontSize: '12px', padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', color: '#3b82f6' }}
                              onClick={() => handleEditReviewOpen(review)}
                            >
                              수정
                            </button>
                            <button
                              type="button"
                              className="ghost-btn"
                              style={{ fontSize: '12px', padding: '2px 6px', border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444' }}
                              onClick={() => handleDeleteReview(review.id)}
                            >
                              삭제
                            </button>
                          </div>
                          <Link className="ghost-btn" to={`/meetings/${review.meeting_id}`} style={{ fontSize: '12px' }}>모임 보기</Link>
                        </div>
                      </article>
                    )) : <p className="empty-schedule">작성한 후기가 없습니다.</p>}
                  </div>
                )}

                {reviewSubTab === "received" && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {receivedReviews.length ? receivedReviews.map((review) => (
                      <article className="profile-review-item" key={review.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f3f4f6', paddingBottom: '12px' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: '#9ca3af', display: 'block' }}>{review.meeting?.title || "모임"}</span>
                          <b style={{ fontSize: '14px', color: '#1f2937' }}>메이트에게 받은 후기</b>
                          <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#4b5563' }}>{review.content}</p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <span style={{ fontSize: '13px', fontWeight: '600', color: '#eab308' }}>★ {review.rating || 0}</span>
                          <Link className="ghost-btn" to={`/meetings/${review.meeting_id}`} style={{ fontSize: '12px' }}>모임 보기</Link>
                        </div>
                      </article>
                    )) : <p className="empty-schedule">받은 후기가 없습니다.</p>}
                  </div>
                )}
              </div>
            )}
            {!meetingsState.loading && !reviewsLoading && activeActivity !== "reviews" && (
              activePanel.items.length
                ? activePanel.items.map((item) => <ScheduleItem key={`${item.state}-${item.id}`} item={item} variant={activeActivity} />)
                : <p className="empty-schedule">
                    {["hosted", "joined"].includes(activeActivity) && activePanel.sourceCount > 0
                      ? "해당 조건의 모임이 없습니다."
                      : activeActivity === "hosted"
                        ? "아직 만든 모임이 없습니다."
                        : activeActivity === "joined"
                          ? "아직 참여한 모임이 없습니다."
                          : "표시할 항목이 없습니다."}
                  </p>
            )}
          </div>
        </section>
      </div>

      {writingReview && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setWritingReview(null)}>
          <form
            className="profile-auth-modal"
            onSubmit={handleReviewSubmit}
            style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '15px' }}
          >
            <button className="schedule-modal-close" type="button" onClick={() => setWritingReview(null)}><X size={18} /></button>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <span style={{ fontSize: '12px', color: '#6b7280' }}>{writingReview.meetingTitle}</span>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>{writingReview.peerNickname}님 후기 작성</h2>
            </div>
            <p style={{ margin: 0, fontSize: '13px', color: '#4b5563' }}>이 메이트와의 운동 경험은 어땠나요? 솔직한 후기를 남겨주세요.</p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>평점 선택</label>
              <select 
                value={rating} 
                onChange={(e) => setRating(Number(e.target.value))}
                style={{ padding: '8px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px' }}
              >
                <option value={5}>★ 5점 (최고예요)</option>
                <option value={4}>★ 4점 (좋아요)</option>
                <option value={3}>★ 3점 (보통이에요)</option>
                <option value={2}>★ 2점 (별로예요)</option>
                <option value={1}>★ 1점 (아쉬워요)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: '600', color: '#374151' }}>후기 내용</label>
              <textarea
                required
                value={reviewContent}
                onChange={(e) => setReviewContent(e.target.value)}
                placeholder="운동 매너, 소통, 참여 태도에 대해 남겨주세요."
                style={{ padding: '10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '14px', minHeight: '100px', resize: 'vertical' }}
              />
            </div>

            <div className="profile-auth-actions" style={{ marginTop: '10px' }}>
              <button className="ghost-btn" type="button" onClick={() => setWritingReview(null)}>취소</button>
              <button className="primary-small" type="submit" style={{ backgroundColor: '#3b82f6', color: '#ffffff' }}>작성 완료</button>
            </div>
          </form>
        </div>
      )}
      <DesktopScheduleCalendarModal
        isOpen={calendarOpen}
        items={calendarItems}
        loading={calendarLoading}
        error={calendarError}
        onClose={() => { setCalendarOpen(false); setCalendarHighlight((current) => ({ ...current, autoOpen: false })); }}
        selectedMeetingId={calendarHighlight.meetingId}
        selectedChatRoomId={calendarHighlight.chatRoomId}
        highlightSource={calendarHighlight.source}
        autoOpenHighlightedDay={calendarHighlight.autoOpen}
        resolveActions={resolveCalendarActions}
      />
      <DesktopScheduleChangeModal
        item={scheduleAction?.type === "change" ? scheduleAction.item : null}
        submitting={scheduleActionSubmitting}
        error={scheduleAction?.type === "change" ? scheduleActionError : ""}
        onClose={closeScheduleAction}
        onSubmit={handleScheduleChange}
      />
      <DesktopScheduleCancelModal
        item={scheduleAction?.type === "cancel" ? scheduleAction.item : null}
        submitting={scheduleActionSubmitting}
        error={scheduleAction?.type === "cancel" ? scheduleActionError : ""}
        onClose={closeScheduleAction}
        onSubmit={handleScheduleCancel}
      />
    </div>
  );
}

export default DesktopMyPage;
