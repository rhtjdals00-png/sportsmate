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
  return type === "regular" ? "정기 모임" : "단발 모임";
}

export function formatExerciseLevel(level) {
  const labels = {
    beginner: "초급",
    intermediate: "중급",
    advanced: "상급"
  };
  return labels[level] || "수준 미설정";
}
