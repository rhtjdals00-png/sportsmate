import { ChevronLeft, ChevronRight, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { getMeetingCoverImage } from "../../../utils/sportThumbnails";
import { formatRegularMeetingSchedule } from "../../../utils/formatters";
import DesktopScheduleCard, { formatScheduleTime, getDesktopScheduleState, validScheduleDate } from "./DesktopScheduleCard.jsx";

const FALLBACK_IMAGE = "/images/logo.png";
const SCHEDULE_REASON_MAX_LENGTH = 255;

function formatDateTime(value) {
  const date = validScheduleDate(value);
  if (!date) return "일정 미정";
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}.${day}(${weekday}) ${hours}:${minutes}`;
}

function isUpcoming(value) {
  const target = validScheduleDate(value);
  if (!target) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return target >= today;
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => {
    const first = validScheduleDate(a.start_at);
    const second = validScheduleDate(b.start_at);
    if (!first && !second) return 0;
    if (!first) return 1;
    if (!second) return -1;
    return first - second;
  });
}

export function normalizeDesktopScheduleMeeting(meeting, participantStatus = "joined") {
  const isRegular = meeting.meeting_type === "regular";
  const sessions = sortSessions(meeting.sessions || []);
  const scheduledSessions = sessions.filter((session) => session.status === "scheduled");
  const now = new Date();
  const currentSession = scheduledSessions.find((session) => {
    const start = validScheduleDate(session.start_at);
    const end = validScheduleDate(session.end_at);
    return start && end && start <= now && now < end;
  });
  const fallbackNextSession = currentSession || scheduledSessions.find((session) => isUpcoming(session.start_at));
  const nextSession = isRegular ? meeting.next_session || fallbackNextSession || null : null;
  const lastSession = isRegular ? [...scheduledSessions].reverse().find((session) => validScheduleDate(session.start_at)) : null;
  const operationEndAt = meeting.end_at || null;
  const useLastSession = isRegular && !nextSession && operationEndAt && validScheduleDate(operationEndAt) < now;
  const startAt = isRegular ? (nextSession?.start_at || (useLastSession ? lastSession?.start_at : null) || null) : meeting.start_at;
  const endAt = isRegular ? (nextSession?.end_at || (useLastSession ? lastSession?.end_at : null) || null) : meeting.end_at;
  const currentParticipants = meeting.current_participants ?? 0;
  const maxParticipants = meeting.max_participants ?? 0;

  return {
    id: meeting.id,
    meetingId: meeting.id,
    title: meeting.title || "제목 없는 모임",
    location: meeting.location_name || meeting.address || "장소 미정",
    place: meeting.location_name || meeting.address || "장소 미정",
    meetingType: meeting.meeting_type || "one_time",
    meetingTypeLabel: meeting.meeting_type === "regular" ? "정기모임" : "일회성",
    meetingStatus: meeting.status || "",
    status: meeting.status || "",
    sportName: meeting?.sport?.name || meeting?.sport_name || "",
    nextSession,
    repeatRule: meeting.repeat_rule || "",
    repeatLabel: isRegular ? formatRegularMeetingSchedule({ ...meeting, next_session: nextSession, sessions: scheduledSessions }, "") : "",
    time: formatDateTime(startAt),
    startAt: startAt || null,
    rawTime: startAt || null,
    endAt: endAt || null,
    endTime: endAt || null,
    operationEndAt,
    sessions,
    currentParticipants,
    maxParticipants,
    member: maxParticipants ? `${currentParticipants}/${maxParticipants}` : `${currentParticipants}`,
    participantStatus,
    state: participantStatus,
    isHost: participantStatus === "host",
    chatRoomId: meeting.chat_room_id,
    image: getMeetingCoverImage(meeting) || FALLBACK_IMAGE,
    img: getMeetingCoverImage(meeting) || FALLBACK_IMAGE
  };
}

export function buildDesktopScheduleItems(meetings) {
  const items = new Map();
  meetings.forEach((meeting) => {
    if (meeting.meetingType === "regular") {
      meeting.sessions.forEach((session) => {
        if (!validScheduleDate(session.start_at)) return;
        const key = `${meeting.id}-${session.id}`;
        items.set(key, {
          ...meeting,
          calendarKey: key,
          sessionId: session.id,
          sessionNumber: session.session_number,
          sessionStatus: session.status || "scheduled",
          startAt: session.start_at,
          rawTime: session.start_at,
          endAt: session.end_at,
          endTime: session.end_at,
          cancellationReason: session.cancellation_reason || "",
          originalStartAt: session.original_start_at || "",
          originalEndAt: session.original_end_at || "",
          rescheduleReason: session.reschedule_reason || "",
          time: formatDateTime(session.start_at)
        });
      });
      return;
    }
    if (!validScheduleDate(meeting.startAt)) return;
    items.set(`${meeting.id}-one-time`, { ...meeting, calendarKey: `${meeting.id}-one-time` });
  });
  return Array.from(items.values()).sort((a, b) => validScheduleDate(a.startAt) - validScheduleDate(b.startAt));
}

export function getDesktopScheduleInitialDate(items) {
  const now = new Date();
  const active = items.find((item) => getDesktopScheduleState(item).state === "active");
  if (active) return validScheduleDate(active.startAt);
  const upcoming = items.find((item) => {
    const date = validScheduleDate(item.startAt);
    return date && date >= now && !["cancelled", "suspended"].includes(getDesktopScheduleState(item).state);
  });
  return validScheduleDate(upcoming?.startAt) || now;
}

function isSameDate(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function calendarBaseDate(items, initialDate) {
  return validScheduleDate(initialDate) || items.map((item) => validScheduleDate(item.startAt)).find(Boolean) || new Date();
}

function buildCells(monthDate, items) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPreviousMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  return Array.from({ length: 42 }, (_, index) => {
    const currentDay = index - firstDay + 1;
    const outside = currentDay < 1 || currentDay > daysInMonth;
    const day = currentDay < 1 ? daysInPreviousMonth + currentDay : currentDay > daysInMonth ? currentDay - daysInMonth : currentDay;
    const cellDate = new Date(year, outside && currentDay < 1 ? month - 1 : outside ? month + 1 : month, day);
    const cellItems = outside ? [] : items.filter((item) => isSameDate(validScheduleDate(item.startAt), cellDate));
    return {
      key: `${cellDate.toISOString()}-${index}`,
      date: cellDate,
      day,
      outside,
      isToday: isSameDate(cellDate, today),
      isPast: cellDate < todayStart,
      items: cellItems
    };
  });
}

function dayTitle(date) {
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][date.getDay()];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekday})`;
}

function cellStatus(item) {
  if (item.sessionStatus === "cancelled") return "취소";
  if (item.isHost) return "방장";
  if (item.participantStatus === "joined") return "참여";
  return "모집";
}

function DesktopScheduleCalendarModal({
  isOpen,
  onClose,
  items = [],
  loading = false,
  error = "",
  modalTitle = "다가오는 일정",
  calendarTitle = "내 운동 일정",
  initialDate,
  managedMeetingId,
  selectedMeetingId,
  selectedChatRoomId,
  highlightSource,
  autoOpenHighlightedDay = false,
  emptyMessage = "표시할 일정이 없습니다.",
  resolveActions = () => []
}) {
  const [monthDate, setMonthDate] = useState(() => calendarBaseDate(items, initialDate));
  const [selectedDay, setSelectedDay] = useState(null);
  const autoOpenConsumedRef = useRef(false);
  const titleId = useRef(`desktop-schedule-calendar-${Math.random().toString(36).slice(2)}`);
  const cells = useMemo(() => buildCells(monthDate, items), [monthDate, items]);
  const isHighlightedItem = (item) => selectedChatRoomId && item.chatRoomId
    ? String(item.chatRoomId) === String(selectedChatRoomId)
    : Boolean(selectedMeetingId) && String(item.id) === String(selectedMeetingId);
  const highlightedItem = useMemo(() => items.find(isHighlightedItem), [items, selectedChatRoomId, selectedMeetingId]);
  const isChatbotHighlight = highlightSource === "chatbot" && Boolean(highlightedItem);

  useEffect(() => {
    if (!isOpen) return;
    const highlightedDate = validScheduleDate(highlightedItem?.startAt);
    const base = highlightedDate || calendarBaseDate(items, initialDate);
    setMonthDate(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [highlightedItem, initialDate, isOpen, items]);

  useEffect(() => {
    if (!isOpen) {
      autoOpenConsumedRef.current = false;
      setSelectedDay(null);
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => event.key === "Escape" && (selectedDay ? setSelectedDay(null) : onClose());
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen, onClose, selectedDay]);

  useEffect(() => {
    if (!isOpen || !highlightedItem || !autoOpenHighlightedDay || autoOpenConsumedRef.current) return;
    const matchedCell = cells.find((cell) => cell.items.some(isHighlightedItem));
    if (matchedCell) {
      setSelectedDay(matchedCell);
      autoOpenConsumedRef.current = true;
    }
  }, [autoOpenHighlightedDay, cells, highlightedItem, isOpen]);

  useEffect(() => {
    if (!selectedDay) return;
    const refreshedCell = cells.find((cell) => isSameDate(cell.date, selectedDay.date));
    if (refreshedCell) setSelectedDay(refreshedCell);
  }, [cells, selectedDay?.date]);

  if (!isOpen) return null;
  return (
    <>
      <div className="desktop-schedule-calendar-modal is-calendar" role="dialog" aria-modal="true" aria-labelledby={titleId.current} onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <div className="desktop-schedule-calendar-modal__panel">
          <button className="desktop-schedule-calendar-modal__close" type="button" aria-label="달력 닫기" onClick={onClose}><X size={19} /></button>
          <h2 id={titleId.current} className="desktop-schedule-calendar-modal__title">{modalTitle}</h2>
          {isChatbotHighlight && <div className="desktop-schedule-calendar-modal__ai"><Sparkles size={17} /><span><strong>AI 비서가 알려준 일정이에요.</strong>달력에서 해당 날짜를 바로 확인할 수 있게 표시했습니다.</span></div>}
          <section className="desktop-schedule-calendar">
            <header className="desktop-schedule-calendar__head">
              <button type="button" aria-label="이전 달" onClick={() => { setSelectedDay(null); setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1)); }}><ChevronLeft size={20} /></button>
              <div><p>{monthDate.getFullYear()}년 {monthDate.getMonth() + 1}월</p><h3>{calendarTitle}</h3></div>
              <button type="button" aria-label="다음 달" onClick={() => { setSelectedDay(null); setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1)); }}><ChevronRight size={20} /></button>
            </header>
            <div className="desktop-schedule-calendar__week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
            <div className="desktop-schedule-calendar__grid">
              {cells.map((cell) => {
                const selected = selectedDay && isSameDate(cell.date, selectedDay.date);
                const itemStates = cell.items.map((item) => getDesktopScheduleState(item).state);
                const normalStates = ["upcoming", "today", "active", "unscheduled"];
                const hasNormalEvent = itemStates.some((state) => normalStates.includes(state));
                const roleItems = hasNormalEvent
                  ? cell.items.filter((_, index) => normalStates.includes(itemStates[index]))
                  : cell.items;
                const hasHostEvent = cell.items.some((item) => item.isHost ?? (item.state === "host"));
                const hasParticipantEvent = cell.items.some((item) => !(item.isHost ?? (item.state === "host")));
                const hasHostRole = roleItems.some((item) => item.isHost ?? (item.state === "host"));
                const hasParticipantRole = roleItems.some((item) => !(item.isHost ?? (item.state === "host")));
                const hasMixedRole = hasHostRole && hasParticipantRole;
                const hasCancelledEvent = itemStates.includes("cancelled");
                const hasEndedEvent = itemStates.includes("ended");
                const hasSuspendedEvent = itemStates.includes("suspended");
                const hasCancelledOnly = cell.items.length > 0 && itemStates.every((state) => state === "cancelled");
                const hasEndedOnly = cell.items.length > 0 && itemStates.every((state) => state === "ended");
                const hasSuspendedOnly = cell.items.length > 0 && itemStates.every((state) => state === "suspended");
                return (
                  <button
                    type="button"
                    key={cell.key}
                    className={`desktop-schedule-calendar__day ${cell.outside ? "is-outside" : ""} ${cell.isToday ? "is-today" : ""} ${selected ? "is-selected" : ""} ${cell.isPast ? "is-past" : ""} ${cell.items.length ? "has-events" : ""} ${hasHostEvent ? "has-host-event" : ""} ${hasHostRole && !hasParticipantRole ? "has-host-only" : ""} ${hasParticipantRole && !hasHostRole ? "has-participant-only" : ""} ${hasMixedRole ? "has-mixed-role" : ""} ${hasNormalEvent ? "has-normal-events" : ""} ${hasCancelledEvent ? "has-cancelled-events" : ""} ${hasEndedEvent ? "has-ended-events" : ""} ${hasSuspendedEvent ? "has-suspended-events" : ""} ${hasCancelledOnly ? "has-cancelled-only" : ""} ${hasEndedOnly ? "has-ended-only" : ""} ${hasSuspendedOnly ? "has-suspended-only" : ""} ${cell.items.some(isHighlightedItem) ? "is-highlighted-from-chat" : ""}`}
                    disabled={cell.outside}
                    aria-pressed={Boolean(selected)}
                    onClick={() => !cell.outside && setSelectedDay(cell)}
                  >
                    <b><span className="desktop-schedule-calendar__date-number">{cell.day}</span>{cell.isToday && !cell.outside ? <span className="desktop-schedule-calendar__today-label">오늘</span> : null}</b>
                    {cell.items.some(isHighlightedItem) && isChatbotHighlight ? <i>AI 추천</i> : null}
                    {cell.items.length > 0 && (
                      <span className="desktop-schedule-calendar__markers" aria-label="일정 역할과 상태">
                        {hasHostEvent && <span className="desktop-schedule-calendar__marker is-host" title="방장 일정">방장</span>}
                        {hasParticipantEvent && <span className="desktop-schedule-calendar__marker is-participant" title="참가 일정">참가</span>}
                        {hasCancelledEvent && <span className="desktop-schedule-calendar__marker is-cancelled" title="취소 일정 포함">취소</span>}
                        {hasEndedEvent && <span className="desktop-schedule-calendar__marker is-ended" title="종료 일정 포함">종료</span>}
                        {hasSuspendedEvent && <span className="desktop-schedule-calendar__marker is-suspended" title="운영중지 일정 포함">중지</span>}
                      </span>
                    )}
                    {cell.items[0] && <><small>{cell.items[0].title}</small><em>{cell.items.length > 1 ? `+${cell.items.length - 1}개 더보기` : `${cellStatus(cell.items[0])} · ${formatScheduleTime(cell.items[0].startAt)}`}</em></>}
                  </button>
                );
              })}
            </div>
            {loading && <p className="desktop-schedule-calendar__empty">달력 일정을 불러오는 중입니다.</p>}
            {error && !loading && <p className="desktop-schedule-calendar__empty is-error">{error}</p>}
            {!loading && !items.length && <p className="desktop-schedule-calendar__empty">{emptyMessage}</p>}
          </section>
        </div>
      </div>
      {selectedDay && (
        <div className="desktop-schedule-calendar-modal is-day" role="dialog" aria-modal="true" aria-label={`${dayTitle(selectedDay.date)} 일정`} onMouseDown={(event) => event.target === event.currentTarget && setSelectedDay(null)}>
          <div className="desktop-schedule-calendar-modal__panel is-day-panel">
            <button className="desktop-schedule-calendar-modal__close" type="button" aria-label="날짜별 일정 닫기" onClick={() => setSelectedDay(null)}><X size={19} /></button>
            <h2 className="desktop-schedule-calendar-modal__title">{dayTitle(selectedDay.date)} 일정</h2>
            <div className="desktop-schedule-calendar-modal__body">
              {selectedDay.items.length ? selectedDay.items.map((item) => (
                <DesktopScheduleCard
                  key={item.calendarKey || `${item.state}-${item.id}`}
                  item={item}
                  actions={resolveActions(item)}
                  highlighted={isHighlightedItem(item)}
                  chatbotHighlight={isHighlightedItem(item) && isChatbotHighlight}
                  isManaged={Boolean(managedMeetingId) && String(item.meetingId ?? item.id) === String(managedMeetingId)}
                />
              )) : <p className="desktop-schedule-calendar__empty">선택한 날짜에 일정이 없습니다.</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function formatDateInputValue(value) {
  const date = validScheduleDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function DesktopScheduleChangeModal({ item, submitting, error, onClose, onSubmit }) {
  const [dateValue, setDateValue] = useState(formatDateInputValue(item?.startAt));
  const [startValue, setStartValue] = useState(formatScheduleTime(item?.startAt));
  const [endValue, setEndValue] = useState(formatScheduleTime(item?.endAt));
  const [reason, setReason] = useState("");
  useEffect(() => {
    setDateValue(formatDateInputValue(item?.startAt));
    setStartValue(item ? formatScheduleTime(item.startAt) : "");
    setEndValue(item ? formatScheduleTime(item.endAt) : "");
    setReason("");
  }, [item]);
  if (!item) return null;

  const submit = (event) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!dateValue || !startValue || !endValue) return onSubmit(null, "변경 날짜와 시간을 모두 입력해 주세요.");
    if (!trimmedReason) return onSubmit(null, "변경 사유를 입력해 주세요.");
    if (trimmedReason.length > SCHEDULE_REASON_MAX_LENGTH) return onSubmit(null, `변경 사유는 ${SCHEDULE_REASON_MAX_LENGTH}자 이내로 입력해 주세요.`);
    const startAt = `${dateValue}T${startValue}:00`;
    const endAt = `${dateValue}T${endValue}:00`;
    if (new Date(endAt) <= new Date(startAt)) return onSubmit(null, "종료 시간은 시작 시간 이후여야 합니다.");
    if (new Date(startAt) <= new Date()) return onSubmit(null, "현재 이후의 시간으로만 변경할 수 있습니다.");
    return onSubmit({ start_at: startAt, end_at: endAt, reason: trimmedReason });
  };

  return (
    <div className="desktop-schedule-calendar-modal is-form" role="dialog" aria-modal="true" aria-label="일정 변경" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <form className="desktop-schedule-calendar-modal__panel is-form-panel" onSubmit={submit}>
        <button className="desktop-schedule-calendar-modal__close" type="button" aria-label="일정 변경 닫기" onClick={onClose} disabled={submitting}><X size={19} /></button>
        <h2 className="desktop-schedule-calendar-modal__title">일정 변경</h2>
        <p className="desktop-schedule-action__guide">선택한 일정만 변경되며 다른 정기 일정에는 영향을 주지 않습니다.</p>
        <div className="desktop-schedule-action__current"><b>{item.title}</b><span>현재 일정 {formatDateTime(item.startAt)}{item.endAt ? `~${formatScheduleTime(item.endAt)}` : ""}</span></div>
        <div className="desktop-schedule-action__grid">
          <label>변경 날짜 *<input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} /></label>
          <label>시작 시간 *<input type="time" value={startValue} onChange={(event) => setStartValue(event.target.value)} /></label>
          <label>종료 시간 *<input type="time" value={endValue} onChange={(event) => setEndValue(event.target.value)} /></label>
        </div>
        <label className="desktop-schedule-action__field">변경 사유 *<textarea value={reason} maxLength={SCHEDULE_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} /><small>{reason.length}/{SCHEDULE_REASON_MAX_LENGTH}</small></label>
        {error && <p className="desktop-schedule-action__error">{error}</p>}
        <div className="desktop-schedule-action__buttons"><button type="button" onClick={onClose} disabled={submitting}>돌아가기</button><button className="is-primary" type="submit" disabled={submitting}>{submitting ? "변경 중..." : "일정 변경"}</button></div>
      </form>
    </div>
  );
}

const CANCEL_REASON_PRESETS = [
  ["우천", "우천으로 인해 이번 일정은 취소합니다."],
  ["장소 문제", "장소 이용 문제로 이번 일정은 취소합니다."],
  ["방장 사정", "방장 사정으로 이번 일정은 취소합니다."],
  ["참여 인원 부족", "참여 인원 부족으로 이번 일정은 취소합니다."]
];

export function DesktopScheduleCancelModal({ item, submitting, error, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  useEffect(() => setReason(""), [item]);
  if (!item) return null;
  const submit = (event) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) return onSubmit(null, "취소 사유를 입력해 주세요.");
    if (trimmedReason.length > SCHEDULE_REASON_MAX_LENGTH) return onSubmit(null, `취소 사유는 ${SCHEDULE_REASON_MAX_LENGTH}자 이내로 입력해 주세요.`);
    return onSubmit({ reason: trimmedReason });
  };
  return (
    <div className="desktop-schedule-calendar-modal is-form" role="dialog" aria-modal="true" aria-label="일정 취소" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <form className="desktop-schedule-calendar-modal__panel is-form-panel" onSubmit={submit}>
        <button className="desktop-schedule-calendar-modal__close" type="button" aria-label="일정 취소 닫기" onClick={onClose} disabled={submitting}><X size={19} /></button>
        <h2 className="desktop-schedule-calendar-modal__title">일정 취소</h2>
        <p className="desktop-schedule-action__guide">{formatDateTime(item.startAt)} 일정을 취소합니다.</p>
        <div className="desktop-schedule-action__presets">{CANCEL_REASON_PRESETS.map(([label, text]) => <button key={label} type="button" onClick={() => setReason(text)}>{label}</button>)}</div>
        <label className="desktop-schedule-action__field">취소 사유 *<textarea value={reason} maxLength={SCHEDULE_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} /><small>{reason.length}/{SCHEDULE_REASON_MAX_LENGTH}</small></label>
        {error && <p className="desktop-schedule-action__error">{error}</p>}
        <div className="desktop-schedule-action__buttons"><button type="button" onClick={onClose} disabled={submitting}>돌아가기</button><button className="is-danger" type="submit" disabled={submitting}>{submitting ? "취소 중..." : "일정 취소"}</button></div>
      </form>
    </div>
  );
}

export default DesktopScheduleCalendarModal;
