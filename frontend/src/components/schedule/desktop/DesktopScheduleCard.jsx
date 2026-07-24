import { CalendarClock, CalendarX, Crown, FileText, LayoutDashboard, MessageCircle, Pencil } from "lucide-react";
import { Link } from "react-router-dom";
import { formatKoreanTime } from "../../../utils/formatters";
import { getScheduleOccurrenceState } from "../../../utils/scheduleOccurrenceState.js";

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

export function getDesktopScheduleState(item) {
  return getScheduleOccurrenceState(item);
}

export function formatScheduleTime(value) {
  const date = validScheduleDate(value);
  if (!date) return "시간 미정";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function formatScheduleTimeLabel(value) {
  return formatKoreanTime(value) || "시간 미정";
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
        <span className="desktop-schedule-card__time">{formatScheduleTimeLabel(startAt)}</span>
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
