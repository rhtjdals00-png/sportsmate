import { Link, useNavigate, useSearchParams } from "react-router-dom";
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
  Sparkles,
  Users,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { userApi } from "../../../api/userApi";
import { meetingApi } from "../../../api/meetingApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { useAsync } from "../../../hooks/useAsync";
import { markProfileEditVerified } from "../../../utils/profileEditAccess";
import { getMeetingCoverImage } from "../../../utils/sportThumbnails";
import { formatRegularMeetingSchedule } from "../../../utils/formatters";

const PROFILE_INTRO_MAX_LENGTH = 30;
const SCHEDULE_REASON_MAX_LENGTH = 255;
const PROFILE_INTRO_EMPTY_TEXT = "아직 한 줄 소개가 없습니다.";
const FALLBACK_PROFILE_IMAGE = "/images/logo.png";
const MEETING_FILTERS = [
  { key: "all", label: "전체" },
  { key: "regular", label: "정기모임" },
  { key: "one_time", label: "일회성" },
  { key: "ended", label: "종료됨" }
];

const levelLabels = {
  // 2026-07-01: 紐⑤컮???꾨줈??湲곗?怨??숈씪?섍쾶 ?대룞 ?섏? 紐낆묶???듭씪.
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

function formatDateInputValue(value) {
  const date = validDate(value);
  if (!date) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTimeInputValue(value) {
  const date = validDate(value);
  if (!date) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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
  return diff > 0 ? `D-${diff}` : "종료됨";
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

function meetingImage(meeting) {
  return getMeetingCoverImage(meeting) || FALLBACK_PROFILE_IMAGE;
}

function meetingMemberText(meeting) {
  const current = meeting.current_participants ?? 0;
  const max = meeting.max_participants ?? 0;
  return max ? `${current}/${max}` : `${current}`;
}

function sportNameOf(meeting) {
  return meeting?.sport?.name || meeting?.sport_name || "";
}

function meetingTypeLabel(type) {
  if (type === "regular") return "정기모임";
  if (type === "one_time") return "일회성";
  return "";
}

function sortSessionsByStart(sessions) {
  return [...sessions].sort((a, b) => {
    const dateA = validDate(a.start_at);
    const dateB = validDate(b.start_at);
    if (!dateA && !dateB) return 0;
    if (!dateA) return 1;
    if (!dateB) return -1;
    return dateA - dateB;
  });
}

function isPastByDay(value) {
  const date = validDate(value);
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date < today;
}

function isPastDateTime(value) {
  const date = validDate(value);
  return date ? date < new Date() : false;
}

function isMeetingEnded(item) {
  if (["closed", "completed", "cancelled", "suspended"].includes(item.status)) return true;
  if (item.meetingType === "regular") {
    return item.operationEndAt ? isPastDateTime(item.operationEndAt) : false;
  }
  return isPastByDay(item.endTime || item.rawTime);
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

function hasLinkedEmailProvider(user) {
  return (user?.provider || "")
    .split(",")
    .map((item) => item.trim())
    .includes("email");
}

function normalizeMeeting(meeting, state) {
  const isRegular = meeting.meeting_type === "regular";
  const allSessions = sortSessionsByStart(meeting.sessions || []);
  const scheduledSessions = allSessions.filter((session) => session.status === "scheduled");
  const fallbackNextSession = scheduledSessions.find((session) => isUpcomingSchedule(session.start_at));
  const nextSession = isRegular ? meeting.next_session || fallbackNextSession || null : null;
  const lastSession = isRegular ? [...scheduledSessions].reverse().find((session) => validDate(session.start_at)) : null;
  // 2026-07-13: ?뺢린紐⑥엫? Meeting.start_at留뚯쑝濡?醫낅즺 ?먮떒?섏? ?딄퀬 ?ㅼ젣 ?뚯감 ?곗씠?곕? ?곗꽑?쒕떎.
  const scheduleStart = isRegular ? (nextSession?.start_at || lastSession?.start_at || null) : meeting.start_at;
  const scheduleEnd = isRegular ? (nextSession?.end_at || lastSession?.end_at || null) : meeting.end_at;
  return {
    id: meeting.id,
    title: meeting.title || "제목 없는 모임",
    place: meeting.location_name || meeting.address || "장소 미정",
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
    operationEndAt: meeting.end_at || null,
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

function buildCalendarItems(items) {
  const byKey = new Map();
  items.forEach((item) => {
    if (item.meetingType === "regular") {
      item.sessions.forEach((session) => {
        const date = validDate(session.start_at);
        if (!date) return;
        const key = `${item.id}-${session.id}`;
        byKey.set(key, {
          ...item,
          calendarKey: key,
          sessionId: session.id,
          sessionNumber: session.session_number,
          sessionStatus: session.status || "scheduled",
          rawTime: session.start_at,
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
    if (!validDate(item.rawTime)) return;
    byKey.set(`${item.id}-one-time`, {
      ...item,
      calendarKey: `${item.id}-one-time`
    });
  });
  return Array.from(byKey.values()).sort((a, b) => validDate(a.rawTime) - validDate(b.rawTime));
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
  const isEnded = isMeetingEnded(item);
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
        {(showTypeTag || item.sportName) && (
          <div className="profile-schedule-tags">
            {showTypeTag && <ScheduleTag tone={item.meetingType === "regular" ? "regular" : "one-time"}>{item.meetingTypeLabel}</ScheduleTag>}
            {item.sportName && <ScheduleTag tone="sport">{item.sportName}</ScheduleTag>}
          </div>
        )}
        <div className="schedule-meta-row">
          <span className="schedule-date">{item.time}</span>
          <span className={`schedule-dday ${isEnded ? "is-ended" : ""}`}>{isEnded ? "종료됨" : getDday(item.rawTime)}</span>
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

function isSameCalendarDate(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function calendarStateLabel(item) {
  if (item.sessionStatus === "cancelled") return "취소";
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

  const today = new Date();

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

    return { key: `${cellDate.toISOString()}-${index}`, date: cellDate, day, outside, isToday: isSameCalendarDate(cellDate, today), items: cellItems };
  });
}

function CalendarModal({ open, items, loading, error, onClose, highlightMeetingId, highlightChatRoomId, highlightSource, autoOpenHighlightedDay, onRequestChange, onRequestCancel }) {
  const [monthDate, setMonthDate] = useState(() => calendarBaseDate(items));
  const [selectedDay, setSelectedDay] = useState(null);
  const autoOpenConsumedRef = useRef(false);
  const cells = useMemo(() => buildCalendarCells(monthDate, items), [monthDate, items]);
  const isHighlightedItem = (item) => {
    if (highlightChatRoomId && item.chatRoomId) {
      return String(item.chatRoomId) === String(highlightChatRoomId);
    }
    return String(item.id) === String(highlightMeetingId);
  };
  const highlightedItem = useMemo(
    () => items.find((item) => {
      if (highlightChatRoomId && item.chatRoomId) {
        return String(item.chatRoomId) === String(highlightChatRoomId);
      }
      return String(item.id) === String(highlightMeetingId);
    }),
    [highlightChatRoomId, highlightMeetingId, items]
  );
  const isChatbotHighlight = highlightSource === "chatbot" && Boolean(highlightedItem);

  useEffect(() => {
    if (open) {
      const highlightedDate = validDate(highlightedItem?.rawTime);
      setMonthDate(highlightedDate ? new Date(highlightedDate.getFullYear(), highlightedDate.getMonth(), 1) : calendarBaseDate(items));
    }
  }, [open, items, highlightedItem]);

  useEffect(() => {
    if (!open) {
      autoOpenConsumedRef.current = false;
      setSelectedDay(null);
      return;
    }
    if (!highlightedItem || !autoOpenHighlightedDay || autoOpenConsumedRef.current) return;
    const matchedCell = cells.find((cell) => cell.items.some(isHighlightedItem));
    if (matchedCell) {
      setSelectedDay(matchedCell);
      autoOpenConsumedRef.current = true;
    }
  }, [autoOpenHighlightedDay, cells, highlightedItem, open]);

  useEffect(() => {
    if (!selectedDay) return;
    const refreshedCell = cells.find((cell) => {
      const current = selectedDay.date;
      return cell.date.getFullYear() === current.getFullYear()
        && cell.date.getMonth() === current.getMonth()
        && cell.date.getDate() === current.getDate();
    });
    setSelectedDay(refreshedCell?.items.length ? refreshedCell : null);
  }, [cells, selectedDay?.date]);

  if (!open) return null;
  return (
    <>
      <div className="schedule-modal schedule-modal--calendar is-open is-calendar-modal" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
        <div className="schedule-modal-panel">
          <button className="schedule-modal-close" type="button" onClick={onClose}><X size={18} /></button>
          <h2 className="schedule-modal-title">다가오는 일정</h2>
          {isChatbotHighlight && (
            <div className="profile-calendar-ai-note">
              <Sparkles size={17} />
              <span>
                <strong>AI 비서가 알려준 일정이에요.</strong>
                달력에서 해당 날짜를 열어 바로 확인할 수 있게 표시해두었습니다.
              </span>
            </div>
          )}
          <div className="schedule-modal-body">
            <div className="profile-calendar-expanded">
              <section className="page-card calendar-card">
                <div className="calendar-head">
                  <button type="button" aria-label="이전 달" onClick={() => { setSelectedDay(null); setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1)); }}>
                    <ChevronLeft size={20} />
                  </button>
                  <div>
                    <p>{calendarTitle(monthDate)}</p>
                    <h2>내 운동 일정</h2>
                  </div>
                  <button type="button" aria-label="다음 달" onClick={() => { setSelectedDay(null); setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1)); }}>
                    <ChevronRight size={20} />
                  </button>
                </div>
                <div className="calendar-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
                <div className="calendar-grid">
                  {cells.map((cell) => (
                    <button
                      type="button"
                      key={cell.key}
                      className={`calendar-day profile-calendar-day ${cell.outside ? "is-outside" : ""} ${cell.items.length ? "has-event" : ""} ${cell.items.some((item) => item.state === "host") ? "host-day" : ""} ${cell.items.some((item) => item.sessionStatus === "cancelled") ? "has-cancelled-event" : ""} ${cell.items.some(isHighlightedItem) ? "is-highlighted-from-chat" : ""}`}
                      disabled={cell.outside || !cell.items.length}
                      onClick={() => cell.items.length && setSelectedDay(cell)}
                    >
                      <b>{cell.day}{cell.isToday && !cell.outside ? <span>오늘</span> : null}</b>
                      {cell.items.some(isHighlightedItem) && isChatbotHighlight ? <i>AI 추천</i> : null}
                      {cell.items[0] && (
                        <>
                          <small>{cell.items[0].title}</small>
                          <em>{cell.items.length > 1 ? `+${cell.items.length - 1}개 더보기` : `${calendarStateLabel(cell.items[0])} · ${calendarItemTime(cell.items[0].rawTime)}`}</em>
                        </>
                      )}
                    </button>
                  ))}
                </div>
                {loading && <p className="empty-schedule profile-calendar-empty">달력 일정을 불러오는 중입니다.</p>}
                {error && !loading && <p className="empty-schedule profile-calendar-empty">{error}</p>}
                {!loading && !items.length && <p className="empty-schedule profile-calendar-empty">표시할 일정이 없습니다.</p>}
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
              {selectedDay.items.map((item) => {
                const canManageSchedule = item.state === "host"
                  && item.meetingType === "regular"
                  && item.sessionId
                  && item.sessionStatus === "scheduled"
                  && !isPastDateTime(item.rawTime);
                return (
                <article className={`schedule-modal-item ${item.sessionStatus === "cancelled" ? "is-cancelled-session" : ""} ${isHighlightedItem(item) ? "is-highlighted-from-chat" : ""}`} key={item.calendarKey || `${item.state}-${item.id}`}>
                  <img src={item.img} alt={item.title} />
                  <div>
                    {isHighlightedItem(item) && isChatbotHighlight && (
                      <div className="schedule-modal-ai-badge">
                        <Sparkles size={13} />
                        AI 비서가 알려준 일정
                      </div>
                    )}
                    {item.state === "host" && <div className="schedule-modal-status"><span className="board-badge host"><Crown size={13} />내가 방장</span></div>}
                    <span>{calendarItemTime(item.rawTime)}</span>
                    <h3>{item.title}</h3>
                    <p>{item.place} · {item.member}</p>
                    {item.sessionStatus === "cancelled" && (
                      <div className="schedule-session-note is-cancelled">
                        <b>일정 취소</b>
                        <span>{item.cancellationReason || "취소 사유가 등록되지 않았습니다."}</span>
                      </div>
                    )}
                    {item.sessionStatus === "scheduled" && item.rescheduleReason && item.originalStartAt && (
                      <div className="schedule-session-note">
                        <b>일정 변경됨</b>
                        <span>기존 {formatDateTime(item.originalStartAt)} · 사유: {item.rescheduleReason}</span>
                      </div>
                    )}
                    {item.state !== "host" && <span className={`board-badge ${item.state}`}>{calendarStateLabel(item)}</span>}
                    <footer>
                      <Link className="ghost-btn" to={`/meetings/${item.id}`}>상세 보기</Link>
                      {item.chatRoomId && <Link className="ghost-btn is-chat-return" to={`/chats/${item.chatRoomId}`}>채팅으로 이동</Link>}
                      {item.state === "host" && <Link className="ghost-btn" to={`/host/meetings/${item.id}`}>관리</Link>}
                    </footer>
                    {canManageSchedule && (
                      <footer className="schedule-session-actions">
                        <button className="ghost-btn schedule-session-change-btn" type="button" onClick={() => onRequestChange?.(item)}>일정 변경</button>
                        <button className="ghost-btn schedule-session-cancel-btn" type="button" onClick={() => onRequestCancel?.(item)}>일정 취소</button>
                      </footer>
                    )}
                  </div>
                </article>
              );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function ScheduleChangeModal({ item, submitting, error, onClose, onSubmit }) {
  const [dateValue, setDateValue] = useState(formatDateInputValue(item?.rawTime));
  const [startValue, setStartValue] = useState(formatTimeInputValue(item?.rawTime));
  const [endValue, setEndValue] = useState(formatTimeInputValue(item?.endTime));
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDateValue(formatDateInputValue(item?.rawTime));
    setStartValue(formatTimeInputValue(item?.rawTime));
    setEndValue(formatTimeInputValue(item?.endTime));
    setReason("");
  }, [item]);

  if (!item) return null;

  const submit = (event) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!dateValue || !startValue || !endValue) {
      onSubmit(null, "변경 날짜와 시간을 모두 입력해 주세요.");
      return;
    }
    if (!trimmedReason) {
      onSubmit(null, "변경 사유를 입력해 주세요.");
      return;
    }
    if (trimmedReason.length > SCHEDULE_REASON_MAX_LENGTH) {
      onSubmit(null, `변경 사유는 ${SCHEDULE_REASON_MAX_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }
    const startAt = `${dateValue}T${startValue}:00`;
    const endAt = `${dateValue}T${endValue}:00`;
    if (new Date(endAt) <= new Date(startAt)) {
      onSubmit(null, "종료 시간은 시작 시간 이후여야 합니다.");
      return;
    }
    if (new Date(startAt) <= new Date()) {
      onSubmit(null, "현재 이후의 시간으로만 변경할 수 있습니다.");
      return;
    }
    onSubmit({ start_at: startAt, end_at: endAt, reason: trimmedReason });
  };

  return (
    <div className="schedule-modal schedule-modal--form is-open" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <form className="schedule-modal-panel schedule-action-panel" onSubmit={submit}>
        <button className="schedule-modal-close" type="button" onClick={onClose} disabled={submitting}><X size={18} /></button>
        <h2 className="schedule-modal-title">일정 변경</h2>
        <p className="schedule-action-guide">선택한 일정만 변경됩니다. 다른 정기 일정에는 영향을 주지 않습니다.</p>
        <div className="schedule-action-current">
          <b>{item.title}</b>
          <span>현재 일정 {formatDateTime(item.rawTime)}{item.endTime ? `~${calendarItemTime(item.endTime)}` : ""}</span>
        </div>
        <div className="schedule-action-grid">
          <label>변경 날짜 *<input type="date" value={dateValue} onChange={(event) => setDateValue(event.target.value)} /></label>
          <label>시작 시간 *<input type="time" value={startValue} onChange={(event) => setStartValue(event.target.value)} /></label>
          <label>종료 시간 *<input type="time" value={endValue} onChange={(event) => setEndValue(event.target.value)} /></label>
        </div>
        <label className="schedule-action-field">변경 사유 *
          <textarea value={reason} maxLength={SCHEDULE_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} placeholder="참여자에게 전달할 변경 사유를 입력해 주세요." />
          <small>{reason.length}/{SCHEDULE_REASON_MAX_LENGTH}</small>
        </label>
        <p className="schedule-action-note">일정을 변경하면 승인된 참여자에게 알림이 전송됩니다.</p>
        {error && <p className="schedule-action-error">{error}</p>}
        <div className="schedule-action-buttons">
          <button className="ghost-btn" type="button" onClick={onClose} disabled={submitting}>돌아가기</button>
          <button className="schedule-action-submit" type="submit" disabled={submitting}>{submitting ? "변경 중..." : "일정 변경"}</button>
        </div>
      </form>
    </div>
  );
}

const CANCEL_REASON_PRESETS = [
  { label: "우천", text: "우천으로 인해 이번 일정은 취소합니다." },
  { label: "장소 문제", text: "장소 이용 문제로 이번 일정은 취소합니다." },
  { label: "방장 사정", text: "방장 사정으로 이번 일정은 취소합니다." },
  { label: "참여 인원 부족", text: "참여 인원 부족으로 이번 일정은 취소합니다." }
];

function ScheduleCancelModal({ item, submitting, error, onClose, onSubmit }) {
  const [reason, setReason] = useState("");

  useEffect(() => {
    setReason("");
  }, [item]);

  if (!item) return null;

  const submit = (event) => {
    event.preventDefault();
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      onSubmit(null, "취소 사유를 입력해 주세요.");
      return;
    }
    if (trimmedReason.length > SCHEDULE_REASON_MAX_LENGTH) {
      onSubmit(null, `취소 사유는 ${SCHEDULE_REASON_MAX_LENGTH}자 이내로 입력해 주세요.`);
      return;
    }
    onSubmit({ reason: trimmedReason });
  };

  return (
    <div className="schedule-modal schedule-modal--form is-open" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && !submitting && onClose()}>
      <form className="schedule-modal-panel schedule-action-panel" onSubmit={submit}>
        <button className="schedule-modal-close" type="button" onClick={onClose} disabled={submitting}><X size={18} /></button>
        <h2 className="schedule-modal-title">일정 취소</h2>
        <p className="schedule-action-guide">{formatDateTime(item.rawTime)}{item.endTime ? `~${calendarItemTime(item.endTime)}` : ""} 일정만 취소합니다.</p>
        <div className="schedule-reason-presets">
          {CANCEL_REASON_PRESETS.map((preset) => (
            <button key={preset.label} type="button" onClick={() => setReason(preset.text)}>{preset.label}</button>
          ))}
        </div>
        <label className="schedule-action-field">취소 사유 *
          <textarea value={reason} maxLength={SCHEDULE_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} placeholder="참여자에게 전달할 취소 사유를 입력해 주세요." />
          <small>{reason.length}/{SCHEDULE_REASON_MAX_LENGTH}</small>
        </label>
        <p className="schedule-action-note">취소하면 이 일정은 달력에 취소 상태로 남고, 승인된 참여자에게 알림이 전송됩니다.</p>
        {error && <p className="schedule-action-error">{error}</p>}
        <div className="schedule-action-buttons">
          <button className="ghost-btn" type="button" onClick={onClose} disabled={submitting}>돌아가기</button>
          <button className="schedule-action-submit is-danger" type="submit" disabled={submitting}>{submitting ? "취소 중..." : "일정 취소"}</button>
        </div>
      </form>
    </div>
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
  const [authOpen, setAuthOpen] = useState(false);
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authChecking, setAuthChecking] = useState(false);
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
    if (panel && ["schedule", "hosted", "joined", "favorite", "reviews"].includes(panel)) {
      setActiveActivity(panel);
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
    // 2026-07-01: 諛깆뿏??JWT 以鍮???蹂댄샇 API ?몄텧濡?諛쒖깮?섎뜕 401 諛섎났??諛⑹?.
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
  const hostedMeetings = (meetingsState.data?.hosted || []).map((meeting) => normalizeMeeting(meeting, "host"));
  const joinedMeetings = (meetingsState.data?.joined || []).map((meeting) => normalizeMeeting(meeting, "joined"));
  const filteredHostedMeetings = useMemo(
    () => filterMeetingItems(hostedMeetings, createdMeetingFilter),
    [createdMeetingFilter, hostedMeetings]
  );
  const filteredJoinedMeetings = useMemo(
    () => filterMeetingItems(joinedMeetings, joinedMeetingFilter),
    [joinedMeetingFilter, joinedMeetings]
  );
  const calendarHostedMeetings = (calendarMeetings?.hosted || []).map((meeting) => normalizeMeeting(meeting, "host"));
  const calendarJoinedMeetings = (calendarMeetings?.joined || []).map((meeting) => normalizeMeeting(meeting, "joined"));
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
      return buildCalendarItems(uniqueMeetingsById(sourceItems));
    },
    [calendarHostedMeetings, calendarJoinedMeetings, calendarMeetings, hostedMeetings, joinedMeetings]
  );
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
    favorite: { label: "관심 모임", count: 0, items: [] },
    reviews: { label: "후기 관리", count: writtenReviews.length + receivedReviews.length, items: [] }
  };
  const activityMenu = [
    { key: "schedule", label: "다가오는 일정", icon: CalendarDays },
    { key: "hosted", label: "내가 만든 모임", icon: Crown },
    { key: "joined", label: "참여한 모임", icon: Users },
    { key: "favorite", label: "관심 모임", icon: CircleDot },
    { key: "reviews", label: "후기 관리", icon: FileText }
  ];
  const activePanel = activityPanels[activeActivity];
  // 2026-07-02: PC ?꾨줈???섏젙 蹂댄샇??SportsMate DB provider??email ?곕룞???ㅼ젣 諛섏쁺??寃쎌슦?먮쭔 ?듦낵.
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
      // 2026-07-01: PC ???뺣낫 ??以??뚭컻瑜?諛깆뿏???꾨줈??bio? ?곌껐.
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
      // 2026-07-01: ?ㅼ젣 ?뚯씪 ?낅줈??API ?꾩엯 ?꾧퉴吏 ?꾨줈???대?吏 URL ?꾨뱶??誘몃━蹂닿린 媛믪쓣 ???
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

  useEffect(() => {
    if (searchParams.get("edit_profile") === "1") {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.delete("edit_profile");
      setSearchParams(nextParams, { replace: true });
      openProtectedEdit();
    }
  }, [searchParams, setSearchParams]);

  const confirmProtectedEdit = async () => {
    if (!authPassword.trim()) {
      setAuthError("비밀번호를 입력해 주세요.");
      return;
    }

    setAuthChecking(true);
    setAuthError("");
    try {
      if (!isSupabaseConfigured || !supabase) {
        throw new Error("인증 서비스 설정을 확인해 주세요.");
      }
      // 2026-07-02: 鍮꾨?踰덊샇 ?먮낯? Supabase Auth???덉쑝誘濡?Supabase 濡쒓렇??寃利앹쓣 癒쇱? ?섑뻾.
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
            {!meetingsState.loading && !reviewsLoading && activeActivity === "favorite" && (
              <p className="empty-schedule">관심 모임 기능은 아직 준비 중입니다.</p>
            )}
            {!meetingsState.loading && !reviewsLoading && !["reviews", "favorite"].includes(activeActivity) && (
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
            <div className="profile-auth-actions">
              <button className="ghost-btn" type="button" onClick={() => setAuthOpen(false)}>취소</button>
              <button className="primary-small" type="submit" disabled={authChecking}>
                {authChecking ? "확인 중..." : "확인"}
              </button>
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
            <div className="profile-auth-actions">
              <button className="ghost-btn" type="button" onClick={() => setAuthOpen(false)}>나중에 하기</button>
              <button className="primary-small" type="button" onClick={() => navigate("/mypage/account-link")}>연동하기</button>
            </div>
          </section>
        </div>
      )}
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
      <CalendarModal
        open={calendarOpen}
        items={calendarItems}
        loading={calendarLoading}
        error={calendarError}
        onClose={() => { setCalendarOpen(false); setCalendarHighlight((current) => ({ ...current, autoOpen: false })); }}
        highlightMeetingId={calendarHighlight.meetingId}
        highlightChatRoomId={calendarHighlight.chatRoomId}
        highlightSource={calendarHighlight.source}
        autoOpenHighlightedDay={calendarHighlight.autoOpen}
        onRequestChange={(item) => openScheduleAction("change", item)}
        onRequestCancel={(item) => openScheduleAction("cancel", item)}
      />
      <ScheduleChangeModal
        item={scheduleAction?.type === "change" ? scheduleAction.item : null}
        submitting={scheduleActionSubmitting}
        error={scheduleAction?.type === "change" ? scheduleActionError : ""}
        onClose={closeScheduleAction}
        onSubmit={handleScheduleChange}
      />
      <ScheduleCancelModal
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
