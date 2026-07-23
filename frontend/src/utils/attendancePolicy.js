const KST_OFFSET = "+09:00";
const QR_EARLY_MINUTES = 30;
const QR_FALLBACK_MINUTES = 30;
const UNAVAILABLE_MEETING_STATUSES = new Set(["cancelled", "suspended"]);

export function parseKstDateTime(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (!value) return null;
  const text = String(value).trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text);
  const parsed = new Date(hasTimezone ? text : `${text}${KST_OFFSET}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getQrAttendanceWindow(session) {
  const startAt = parseKstDateTime(session?.start_at);
  if (!startAt) return { opensAt: null, closesAt: null };
  const endAt = parseKstDateTime(session?.end_at);
  return {
    opensAt: new Date(startAt.getTime() - QR_EARLY_MINUTES * 60 * 1000),
    closesAt: endAt || new Date(startAt.getTime() + QR_FALLBACK_MINUTES * 60 * 1000),
  };
}

export function evaluateQrAttendance(session, nowValue = new Date(), meetingStatus = null) {
  const now = parseKstDateTime(nowValue);
  const { opensAt, closesAt } = getQrAttendanceWindow(session);
  if (!now || !opensAt || !closesAt) {
    return { allowed: false, code: "INVALID_SESSION", message: "출석 회차 정보를 확인할 수 없습니다.", opensAt, closesAt };
  }
  if (UNAVAILABLE_MEETING_STATUSES.has(meetingStatus)) {
    return { allowed: false, code: "MEETING_UNAVAILABLE", message: "현재 모임에서는 출석 체크를 진행할 수 없습니다.", opensAt, closesAt };
  }
  if (session?.status === "cancelled") {
    return { allowed: false, code: "SESSION_CANCELLED", message: "취소된 일정은 출석 체크할 수 없습니다.", opensAt, closesAt };
  }
  if (session?.status !== "scheduled") {
    return { allowed: false, code: "INVALID_SESSION", message: "현재 출석 체크할 수 없는 일정입니다.", opensAt, closesAt };
  }
  if (now < opensAt) {
    return { allowed: false, code: "TOO_EARLY", message: "출석 체크는 일정 시작 30분 전부터 가능합니다.", opensAt, closesAt };
  }
  if (now >= closesAt) {
    return { allowed: false, code: "WINDOW_CLOSED", message: "출석 가능 시간이 종료되었습니다.", opensAt, closesAt };
  }
  return { allowed: true, code: null, message: "", opensAt, closesAt };
}

export function evaluateHostManualAttendance(session, nowValue = new Date()) {
  const now = parseKstDateTime(nowValue);
  const startAt = parseKstDateTime(session?.start_at);
  if (!now || !startAt) {
    return { allowed: false, code: "INVALID_SESSION", message: "출석 회차 정보를 확인할 수 없습니다." };
  }
  if (session?.status === "cancelled") {
    return { allowed: false, code: "SESSION_CANCELLED", message: "취소된 일정은 출석을 변경할 수 없습니다." };
  }
  if (now < startAt) {
    return { allowed: false, code: "TOO_EARLY", message: "수동 출석 처리는 일정 시작 이후 가능합니다." };
  }
  return { allowed: true, code: null, message: "" };
}

export function attendanceSessionSignature(session) {
  if (!session) return "";
  return [
    session.id ?? "",
    session.start_at ?? "",
    session.end_at ?? "",
    session.status ?? "",
  ].join("|");
}
