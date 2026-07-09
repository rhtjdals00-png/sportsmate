export function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

export function formatMeetingType(type) {
  return type === "regular" ? "정기 모임" : "일회성 모임";
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
