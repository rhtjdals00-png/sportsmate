export function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const REPEAT_DAY_LABELS = {
  MO: "월",
  TU: "화",
  WE: "수",
  TH: "목",
  FR: "금",
  SA: "토",
  SU: "일"
};

const REPEAT_DAY_ORDER = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatTime(value) {
  const date = validDate(value);
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function parseRepeatDays(repeatRule, repeatDays = []) {
  const rawDays = Array.isArray(repeatDays) && repeatDays.length
    ? repeatDays
    : String(repeatRule || "").match(/BYDAY=([^;]+)/i)?.[1]?.split(",") || [];
  const seen = new Set();
  rawDays.forEach((day) => {
    const normalized = String(day || "").trim().toUpperCase();
    if (REPEAT_DAY_LABELS[normalized]) seen.add(normalized);
  });
  return REPEAT_DAY_ORDER.filter((day) => seen.has(day));
}

export function getRegularSessionTemplate(meeting) {
  const sessions = Array.isArray(meeting?.sessions) ? meeting.sessions : [];
  return meeting?.next_session
    || sessions.find((session) => session?.status === "scheduled" && validDate(session.start_at))
    || sessions.find((session) => validDate(session?.start_at))
    || null;
}

export function formatRegularMeetingSchedule(meeting, fallback = "정기 일정") {
  const days = parseRepeatDays(meeting?.repeat_rule, meeting?.repeat_days);
  if (!days.length) return fallback;
  const template = getRegularSessionTemplate(meeting);
  const startTime = formatTime(template?.start_at);
  const endTime = formatTime(template?.end_at);
  const timeRange = startTime ? `${startTime}${endTime ? `~${endTime}` : ""}` : "";
  return `매주 ${days.map((day) => REPEAT_DAY_LABELS[day]).join("·")}${timeRange ? ` ${timeRange}` : ""}`;
}

export function formatMeetingSchedule(meeting) {
  if (meeting?.meeting_type === "regular") {
    return formatRegularMeetingSchedule(meeting);
  }
  return formatDateTime(meeting?.next_session?.start_at || meeting?.start_at);
}

export function formatMeetingType(type) {
  return type === "regular" ? "정기모임" : "일회성";
}

export function formatExerciseLevel(level) {
  const labels = {
    // 2026-07-01: exercise_level 표시 명칭을 모바일/프로필 수정 화면과 통일.
    beginner: "입문",
    intermediate: "중급",
    advanced: "상급"
  };
  return labels[level] || "수준 미설정";
}
