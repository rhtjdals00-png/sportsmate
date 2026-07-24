import { isMeetingLifecycleEnded } from "./meetingLifecycle.js";

export function validScheduleOccurrenceDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(first, second) {
  return Boolean(first && second)
    && first.getFullYear() === second.getFullYear()
    && first.getMonth() === second.getMonth()
    && first.getDate() === second.getDate();
}

function endOfDay(value) {
  const date = validScheduleOccurrenceDate(value);
  if (!date) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function dDayLabel(value, now) {
  const target = validScheduleOccurrenceDate(value);
  if (!target) return "D-?";
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : "종료됨";
}

export function getScheduleOccurrenceState(item, nowValue = new Date()) {
  const now = validScheduleOccurrenceDate(nowValue) || new Date();
  const meetingStatus = String(item?.meetingStatus ?? item?.status ?? "");
  const sessionStatus = String(item?.sessionStatus ?? item?.session_status ?? "");
  const meetingType = item?.meetingType ?? item?.meeting_type ?? "one_time";
  const isRegular = meetingType === "regular";

  if (meetingStatus === "cancelled" || sessionStatus === "cancelled") {
    return { label: "취소됨", isEnded: true, state: "cancelled" };
  }
  if (meetingStatus === "suspended") {
    return { label: "운영중지", isEnded: true, state: "suspended" };
  }
  if (sessionStatus === "completed") {
    return { label: "종료됨", isEnded: true, state: "ended" };
  }
  if (isMeetingLifecycleEnded(item, now)) {
    return { label: "종료됨", isEnded: true, state: "ended" };
  }

  const start = validScheduleOccurrenceDate(
    item?.startAt ?? item?.rawTime ?? item?.start_at
  );
  if (!start) {
    return {
      label: isRegular ? "다음 일정 준비" : "예정 없음",
      isEnded: false,
      state: "unscheduled"
    };
  }

  const explicitEnd = validScheduleOccurrenceDate(
    item?.endAt ?? item?.endTime ?? item?.end_at
  );
  const end = explicitEnd || endOfDay(start);

  if (end && now >= start && now < end) {
    return { label: "진행 중", isEnded: false, state: "active" };
  }
  if (end && now >= end) {
    if (isSameDay(end, now)) {
      return { label: "오늘 일정 완료", isEnded: false, state: "today" };
    }
    return { label: "종료됨", isEnded: true, state: "ended" };
  }
  if (isSameDay(start, now)) {
    return { label: "D-DAY", isEnded: false, state: "today" };
  }
  return { label: dDayLabel(start, now), isEnded: false, state: "upcoming" };
}

export function moveEndedScheduleItemsLast(items, nowValue = new Date()) {
  const activeItems = [];
  const endedItems = [];

  (items || []).forEach((item) => {
    const target = getScheduleOccurrenceState(item, nowValue).isEnded
      ? endedItems
      : activeItems;
    target.push(item);
  });

  return [...activeItems, ...endedItems];
}
