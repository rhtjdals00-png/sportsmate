import { CalendarClock, CalendarX, Crown, FileText, LayoutDashboard, MessageCircle, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { isMeetingLifecycleEnded } from "../../../utils/meetingLifecycle.js";

const ACTION_ICONS = {
  detail: FileText,
  chat: MessageCircle,
  manage: LayoutDashboard,
  change: Pencil,
  cancel: CalendarX
};

export function validScheduleDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameDay(a, b) {
  return Boolean(a && b)
    && a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function getDday(value) {
  const target = validScheduleDate(value);
  if (!target) return "D-?";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today) / (1000 * 60 * 60 * 24));
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : "종료됨";
}

export function getDesktopScheduleState(item) {
  const meetingStatus = String(item.meetingStatus ?? item.status ?? "");
  if (meetingStatus === "cancelled" || item.sessionStatus === "cancelled") {
    return { label: "취소됨", isEnded: true, state: "cancelled" };
  }
  if (meetingStatus === "suspended") {
    return { label: "운영중지", isEnded: true, state: "suspended" };
  }
  const now = new Date();
  const start = validScheduleDate(item.startAt ?? item.rawTime);
  const end = validScheduleDate(item.endAt ?? item.endTime);
  const isRegular = (item.meetingType ?? item.meeting_type) === "regular";

  if (isMeetingLifecycleEnded(item, now)) {
    return { label: "종료됨", isEnded: true, state: "ended" };
  }

  if (!start) {
    return { label: isRegular ? "다음 일정 준비" : "예정 없음", isEnded: false, state: "unscheduled" };
  }
  if (end) {
    if (now >= start && now < end) return { label: "진행 중", isEnded: false, state: "active" };
    if (now >= end && isSameDay(end, now)) {
      return { label: "오늘 일정 완료", isEnded: false, state: "today" };
    }
    if (now >= end) {
      return { label: isRegular ? "다음 일정 준비" : "예정 없음", isEnded: false, state: "unscheduled" };
    }
  } else if (now > start && !isSameDay(start, now)) {
    return { label: isRegular ? "다음 일정 준비" : "예정 없음", isEnded: false, state: "unscheduled" };
  }
  if (isSameDay(start, now)) {
    return { label: "D-DAY", isEnded: false, state: "today" };
  }
  return { label: getDday(start), isEnded: false, state: "upcoming" };
}

export function formatScheduleTime(value) {
  const date = validScheduleDate(value);
  if (!date) return "시간 미정";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function ScheduleAction({ action }) {
  const Icon = action.icon || ACTION_ICONS[action.key] || CalendarClock;
  const className = `desktop-schedule-card__action is-${action.tone || "secondary"}`;
  const content = <><Icon size={14} /><span>{action.label}</span></>;
  if (action.to) {
    return <Link className={className} to={action.to}>{content}</Link>;
  }
  return <button className={className} type="button" onClick={action.onClick} disabled={action.disabled}>{content}</button>;
}

function DesktopScheduleCard({ item, actions = [], highlighted = false, chatbotHighlight = false, isManaged = false }) {
  const scheduleState = getDesktopScheduleState(item);
  const isHost = item.isHost ?? item.state === "host";
  const startAt = item.startAt ?? item.rawTime;
  const regularActions = actions.filter((action) => action.tone !== "danger");
  const dangerActions = actions.filter((action) => action.tone === "danger");

  return (
    <article className={`desktop-schedule-card is-${scheduleState.state} ${isManaged ? "is-managed" : ""} ${highlighted ? "is-highlighted-from-chat" : ""}`}>
      <img className="desktop-schedule-card__image" src={item.image ?? item.img} alt={item.title} />
      <div className="desktop-schedule-card__content">
        <div className="desktop-schedule-card__badges">
          {chatbotHighlight && <span className="desktop-schedule-card__badge is-ai">AI 비서가 알려준 일정</span>}
          {isHost && <span className="desktop-schedule-card__badge is-host"><Crown size={13} />내가 방장</span>}
          {isManaged && <span className="desktop-schedule-card__badge is-managed">현재 관리 중</span>}
          <span className={`desktop-schedule-card__badge is-state is-${scheduleState.state}`}>{scheduleState.label}</span>
        </div>
        <span className="desktop-schedule-card__time">{formatScheduleTime(startAt)}</span>
        <h3>{item.title}</h3>
        <p>{item.location ?? item.place} · {item.currentParticipants ?? item.current_participants ?? 0}/{item.maxParticipants ?? item.max_participants ?? 0}명</p>
        {item.sessionStatus === "cancelled" && (
          <div className="desktop-schedule-card__note is-cancelled">
            <b>일정 취소</b>
            <span>{item.cancellationReason || "취소 사유가 등록되지 않았습니다."}</span>
          </div>
        )}
        {item.sessionStatus === "scheduled" && item.rescheduleReason && item.originalStartAt && (
          <div className="desktop-schedule-card__note">
            <b>일정 변경됨</b>
            <span>변경 사유: {item.rescheduleReason}</span>
          </div>
        )}
        {regularActions.length > 0 && <footer className="desktop-schedule-card__actions">{regularActions.map((action) => <ScheduleAction key={action.key} action={action} />)}</footer>}
        {dangerActions.length > 0 && <footer className="desktop-schedule-card__danger-zone">{dangerActions.map((action) => <ScheduleAction key={action.key} action={action} />)}</footer>}
      </div>
    </article>
  );
}

export default DesktopScheduleCard;
