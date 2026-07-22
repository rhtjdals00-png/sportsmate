export function validMeetingDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function startOfFollowingDay(value) {
  const date = validMeetingDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

function calendarDayValue(value) {
  const date = validMeetingDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

export function getMeetingOperationEndAt(meeting) {
  const meetingType = meeting.meetingType ?? meeting.meeting_type ?? "one_time";
  if (meetingType !== "regular") {
    return meeting.endAt ?? meeting.endTime ?? meeting.end_at
      ?? meeting.startAt ?? meeting.rawTime ?? meeting.start_at ?? null;
  }

  if (Object.prototype.hasOwnProperty.call(meeting, "operationEndAt")) {
    return meeting.operationEndAt;
  }
  if (Object.prototype.hasOwnProperty.call(meeting, "operation_end_at")) {
    return meeting.operation_end_at;
  }

  const meetingEnd = meeting.end_at ?? null;
  if (!meetingEnd) return null;

  const sessions = Array.isArray(meeting.sessions)
    ? meeting.sessions.filter((session) => session.status !== "cancelled")
    : [];
  const latestSessionDay = sessions.reduce((latest, session) => {
    const day = calendarDayValue(session.end_at ?? session.start_at);
    return day === null ? latest : Math.max(latest ?? day, day);
  }, null);
  const meetingEndDay = calendarDayValue(meetingEnd);

  // Legacy regular meetings may store the first session's end time in Meeting.end_at.
  // If a later generated session exists, the room has no explicit operation end date.
  if (latestSessionDay !== null && meetingEndDay !== null && meetingEndDay < latestSessionDay) {
    return null;
  }
  return meetingEnd;
}

export function isMeetingLifecycleEnded(meeting, now = new Date()) {
  const status = String(meeting.meetingStatus ?? meeting.status ?? "");
  if (["cancelled", "suspended"].includes(status)) return true;

  const meetingType = meeting.meetingType ?? meeting.meeting_type ?? "one_time";
  if (meetingType === "regular") {
    const operationEnd = getMeetingOperationEndAt(meeting);
    const cutoff = startOfFollowingDay(operationEnd);
    return cutoff ? now >= cutoff : status === "completed";
  }

  const meetingEnd = meeting.endAt ?? meeting.endTime ?? meeting.end_at
    ?? meeting.startAt ?? meeting.rawTime ?? meeting.start_at;
  const cutoff = startOfFollowingDay(meetingEnd);
  return cutoff ? now >= cutoff : status === "completed";
}
