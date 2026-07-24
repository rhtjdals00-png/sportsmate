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
  const nextSession = meeting.nextSession ?? meeting.next_session ?? null;
  const nextSessionDay = calendarDayValue(nextSession?.endAt ?? nextSession?.end_at ?? nextSession?.startAt ?? nextSession?.start_at);
  const latestSessionDay = sessions.reduce((latest, session) => {
    const day = calendarDayValue(session.end_at ?? session.start_at);
    return day === null ? latest : Math.max(latest ?? day, day);
  }, nextSessionDay);
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

function meetingTypeOf(meeting) {
  return meeting?.meetingType ?? meeting?.meeting_type ?? "one_time";
}

function meetingStatusOf(meeting) {
  return String(meeting?.meetingStatus ?? meeting?.status ?? "");
}

function sessionStartAt(session) {
  return session?.startAt ?? session?.start_at ?? null;
}

function sessionEndAt(session) {
  return session?.endAt ?? session?.end_at ?? null;
}

function nextSessionOf(meeting) {
  return meeting?.nextSession ?? meeting?.next_session ?? null;
}

export function getMeetingRepresentativeStartAt(meeting) {
  const nextStartAt = sessionStartAt(nextSessionOf(meeting));
  if (validMeetingDate(nextStartAt)) return nextStartAt;

  if (meetingTypeOf(meeting) === "regular") {
    return null;
  }

  const meetingStartAt = meeting?.startAt ?? meeting?.rawTime ?? meeting?.start_at ?? null;
  return validMeetingDate(meetingStartAt) ? meetingStartAt : null;
}

export function getMeetingLifecycleState(meeting, now = new Date()) {
  const status = meetingStatusOf(meeting);
  if (status === "cancelled") return "cancelled";
  if (status === "suspended") return "suspended";

  const currentTime = validMeetingDate(now) ?? new Date();
  const meetingType = meetingTypeOf(meeting);
  const nextSession = nextSessionOf(meeting);
  const representativeStartAt = getMeetingRepresentativeStartAt(meeting);
  const representativeStart = validMeetingDate(representativeStartAt);
  const nextEnd = validMeetingDate(sessionEndAt(nextSession));

  if (meetingType === "regular") {
    let operationEndAt = getMeetingOperationEndAt(meeting);
    const operationEndDay = calendarDayValue(operationEndAt);
    const nextSessionDay = calendarDayValue(representativeStartAt);

    // A later next session proves that an older Meeting.end_at is a legacy
    // first-session value rather than the regular meeting's operation end.
    if (operationEndDay !== null && nextSessionDay !== null && operationEndDay < nextSessionDay) {
      operationEndAt = null;
    }

    const operationCutoff = startOfFollowingDay(operationEndAt);
    if (operationCutoff && currentTime >= operationCutoff) return "ended";
  } else {
    const explicitEndAt = nextEnd
      ?? validMeetingDate(meeting?.endAt ?? meeting?.endTime ?? meeting?.end_at);
    if (explicitEndAt && currentTime >= explicitEndAt) return "ended";
    if (isMeetingLifecycleEnded(meeting, currentTime)) return "ended";
  }

  if (status === "completed") return "ended";
  if (representativeStart && currentTime >= representativeStart && (!nextEnd || currentTime < nextEnd)) {
    return "ongoing";
  }
  return "upcoming";
}

export function getMeetingRecruitmentState(meeting) {
  const status = meetingStatusOf(meeting);
  if (status === "closed") return "closed";
  if (status === "full") return "full";

  const currentParticipants = Number(meeting?.currentParticipants ?? meeting?.current_participants ?? 0);
  const maxParticipants = Number(meeting?.maxParticipants ?? meeting?.max_participants ?? 0);
  if (status === "open" && maxParticipants > 0 && currentParticipants >= maxParticipants) {
    return "full";
  }
  return status === "open" ? "open" : "closed";
}

export function getMeetingStatusPresentation(meeting, now = new Date()) {
  const lifecycleState = getMeetingLifecycleState(meeting, now);
  if (lifecycleState === "cancelled") {
    return { state: lifecycleState, label: "취소됨", tone: "danger" };
  }
  if (lifecycleState === "suspended") {
    return { state: lifecycleState, label: "운영중지", tone: "warning" };
  }
  if (lifecycleState === "ended") {
    return { state: lifecycleState, label: "종료", tone: "slate" };
  }

  const recruitmentState = getMeetingRecruitmentState(meeting);
  if (recruitmentState === "full") {
    return { state: recruitmentState, label: "정원마감", tone: "slate" };
  }
  if (recruitmentState === "closed") {
    return { state: recruitmentState, label: "모집마감", tone: "slate" };
  }
  return { state: "open", label: "모집중", tone: "success" };
}

export function canRequestMeetingParticipation({
  meeting,
  isHost = false,
  isApprovedParticipant = false,
  isPendingParticipant = false,
  isJoining = false,
  now = new Date()
}) {
  if (!meeting || isHost || isApprovedParticipant || isPendingParticipant || isJoining) {
    return false;
  }

  const lifecycleState = getMeetingLifecycleState(meeting, now);
  if (["cancelled", "suspended", "ended"].includes(lifecycleState)) {
    return false;
  }
  return getMeetingRecruitmentState(meeting) === "open";
}
