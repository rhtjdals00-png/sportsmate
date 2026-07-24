import { Link } from "react-router-dom";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { meetingApi } from "../../../api/meetingApi.js";
import { weatherApi } from "../../../api/weatherApi.js";
import MobileWeatherCard from "../../meeting/mobile/MobileWeatherCard.jsx";

const SCHEDULE_REASON_MAX_LENGTH = 100;

function validDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dateKey(value) {
  const date = validDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function shortTime(value) {
  const date = validDate(value);
  if (!date) return "시간 미정";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildMonthCells(baseDate, items) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return Array.from({ length: firstDay + daysInMonth }, (_, index) => {
    if (index < firstDay) return { key: `empty-${index}`, empty: true };
    const day = index - firstDay + 1;
    const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { key, day, items: items.filter((item) => dateKey(item.start_at) === key) };
  });
}

function formatDateTime(value) {
  const date = validDate(value);
  if (!date) return "";
  const ampm = date.getHours() >= 12 ? "오후" : "오전";
  const h = date.getHours() % 12 || 12;
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${date.getMonth() + 1}월 ${date.getDate()}일 ${ampm} ${h}:${m}`;
}

function formatDateInputValue(value) {
  const date = validDate(value);
  if (!date) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeInputValue(value) {
  const date = validDate(value);
  if (!date) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function calendarItemTime(value) {
  const date = validDate(value);
  if (!date) return "";
  const ampm = date.getHours() >= 12 ? "오후" : "오전";
  const h = date.getHours() % 12 || 12;
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${ampm} ${h}:${m}`;
}

function isPastDateTime(value) {
  const date = validDate(value);
  return date ? date < new Date() : false;
}

function ScheduleChangeModal({ item, submitting, error, onClose, onSubmit }) {
  const [dateValue, setDateValue] = useState(formatDateInputValue(item?.start_at));
  const [startValue, setStartValue] = useState(formatTimeInputValue(item?.start_at));
  const [endValue, setEndValue] = useState(formatTimeInputValue(item?.end_at));
  const [reason, setReason] = useState("");

  useEffect(() => {
    setDateValue(formatDateInputValue(item?.start_at));
    setStartValue(formatTimeInputValue(item?.start_at));
    setEndValue(formatTimeInputValue(item?.end_at));
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
        <h2 className="schedule-modal-title" style={{ marginTop: '0' }}>일정 변경</h2>
        <p className="schedule-action-guide" style={{ fontSize: '13px', color: '#64748b', marginBottom: '12px' }}>선택한 일정만 변경됩니다. 다른 정기 일정에는 영향을 주지 않습니다.</p>
        <div className="schedule-action-current" style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
          <b style={{ display: 'block', marginBottom: '4px' }}>{item.title}</b>
          <span style={{ fontSize: '13px', color: '#475569' }}>현재 일정 {formatDateTime(item.start_at)}{item.end_at ? `~${calendarItemTime(item.end_at)}` : ""}</span>
        </div>
        <div className="schedule-action-grid" style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
          <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold' }}>변경 날짜 *<input type="date" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px' }} value={dateValue} onChange={(event) => setDateValue(event.target.value)} /></label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold' }}>시작 시간 *<input type="time" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px' }} value={startValue} onChange={(event) => setStartValue(event.target.value)} /></label>
            <label style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold' }}>종료 시간 *<input type="time" style={{ padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px' }} value={endValue} onChange={(event) => setEndValue(event.target.value)} /></label>
          </div>
        </div>
        <label className="schedule-action-field" style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>변경 사유 *
          <textarea style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px', minHeight: '80px', resize: 'vertical' }} value={reason} maxLength={SCHEDULE_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} placeholder="참여자에게 전달할 변경 사유를 입력해 주세요." />
          <small style={{ color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>{reason.length}/{SCHEDULE_REASON_MAX_LENGTH}</small>
        </label>
        <p className="schedule-action-note" style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>일정을 변경하면 승인된 참여자에게 알림이 전송됩니다.</p>
        {error && <p className="schedule-action-error" style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', fontWeight: 'bold' }}>{error}</p>}
        <div className="schedule-action-buttons" style={{ display: 'flex', gap: '8px' }}>
          <button className="ghost-btn" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold' }} type="button" onClick={onClose} disabled={submitting}>돌아가기</button>
          <button className="schedule-action-submit" style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#4f46e5', color: '#fff', border: 'none', fontWeight: 'bold' }} type="submit" disabled={submitting}>{submitting ? "변경 중..." : "일정 변경"}</button>
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
        <h2 className="schedule-modal-title" style={{ marginTop: '0' }}>일정 취소</h2>
        <p className="schedule-action-guide" style={{ fontSize: '13px', color: '#64748b', marginBottom: '16px' }}>{formatDateTime(item.start_at)}{item.end_at ? `~${calendarItemTime(item.end_at)}` : ""} 일정만 취소합니다.</p>
        <div className="schedule-reason-presets" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
          {CANCEL_REASON_PRESETS.map((preset) => (
            <button key={preset.label} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '20px', border: '1px solid #cbd5e1', background: '#f8fafc', cursor: 'pointer', color: '#334155' }} type="button" onClick={() => setReason(preset.text)}>{preset.label}</button>
          ))}
        </div>
        <label className="schedule-action-field" style={{ display: 'flex', flexDirection: 'column', fontSize: '13px', fontWeight: 'bold', marginBottom: '16px' }}>취소 사유 *
          <textarea style={{ padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', marginTop: '4px', minHeight: '80px', resize: 'vertical' }} value={reason} maxLength={SCHEDULE_REASON_MAX_LENGTH} onChange={(event) => setReason(event.target.value)} placeholder="참여자에게 전달할 취소 사유를 입력해 주세요." />
          <small style={{ color: '#94a3b8', textAlign: 'right', marginTop: '4px' }}>{reason.length}/{SCHEDULE_REASON_MAX_LENGTH}</small>
        </label>
        <p className="schedule-action-note" style={{ fontSize: '12px', color: '#64748b', marginBottom: '20px' }}>취소하면 이 일정은 달력에 취소 상태로 남고, 승인된 참여자에게 알림이 전송됩니다.</p>
        {error && <p className="schedule-action-error" style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', fontWeight: 'bold' }}>{error}</p>}
        <div className="schedule-action-buttons" style={{ display: 'flex', gap: '8px' }}>
          <button className="ghost-btn" style={{ flex: 1, padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', fontWeight: 'bold' }} type="button" onClick={onClose} disabled={submitting}>돌아가기</button>
          <button className="schedule-action-submit is-danger" style={{ flex: 1, padding: '12px', borderRadius: '8px', background: '#ef4444', color: '#fff', border: 'none', fontWeight: 'bold' }} type="submit" disabled={submitting}>{submitting ? "취소 중..." : "일정 취소"}</button>
        </div>
      </form>
    </div>
  );
}

function MobileMyMeetingItem({ item, openScheduleAction }) {
  const isClosed = item.status !== "open";
  const [weatherState, setWeatherState] = useState({ loading: false, forecast: null });

  useEffect(() => {
    let active = true;
    if (item.latitude && item.longitude && item.start_at) {
      setWeatherState({ loading: true, forecast: null });
      weatherApi.forecast({
        latitude: item.latitude,
        longitude: item.longitude,
        at: item.start_at,
        address: item.address
      })
      .then((data) => {
        if (active) setWeatherState({ loading: false, forecast: data.forecast });
      })
      .catch((error) => {
        if (active) setWeatherState({ loading: false, forecast: { available: false, message: error.response?.data?.message || "날씨 정보를 불러올 수 없습니다." } });
      });
    }
    return () => { active = false; };
  }, [item.latitude, item.longitude, item.start_at, item.address]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid #f1f5f9', paddingBottom: '16px', marginBottom: '16px' }}>
      <Link to={item.state === "host" ? `/host/meetings/${item.id}` : `/meetings/${item.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            background: item.state === "host" ? "#eff6ff" : "#f0fdf4",
            color: item.state === "host" ? "#3b82f6" : "#22c55e",
            fontWeight: '800'
          }}>
            {item.state === "host" ? "👑 방장" : "🙌 참여중"}
          </span>
          
          <span style={{
            fontSize: '11px',
            padding: '3px 8px',
            borderRadius: '12px',
            background: "#fff7ed",
            color: "#ea580c",
            fontWeight: '800'
          }}>
            {item.meeting_type === "regular" ? "🔄 정기" : "⚡ 일회성"}
          </span>
          
          {isClosed && (
            <span style={{
              fontSize: '11px',
              padding: '3px 8px',
              borderRadius: '12px',
              background: "#f1f5f9",
              color: "#64748b",
              fontWeight: '800'
            }}>
              🔒 모집 종료
            </span>
          )}
          
          <span style={{ fontSize: '12px', color: '#94a3b8', marginLeft: 'auto' }}>
            {shortTime(item.start_at)}
          </span>
        </div>
        
        <strong style={{ color: isClosed ? "#94a3b8" : "inherit", display: 'block' }}>{item.title}</strong>
        <p style={{ color: isClosed ? "#cbd5e1" : "inherit", margin: '4px 0 0 0', fontSize: '13px' }}>{item.place}</p>
        
        <div style={{ marginTop: '12px' }}>
          <MobileWeatherCard forecast={weatherState.forecast} loading={weatherState.loading} title="운동 일정 날씨" />
        </div>

        {item.sessionStatus === "cancelled" && (
          <div style={{ marginTop: '8px', padding: '8px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px' }}>
            <b style={{ color: '#ef4444', fontSize: '12px', display: 'block' }}>일정 취소됨</b>
            <span style={{ color: '#7f1d1d', fontSize: '12px' }}>{item.cancellationReason || "취소 사유가 등록되지 않았습니다."}</span>
          </div>
        )}
        {item.sessionStatus === "scheduled" && item.rescheduleReason && item.originalStartAt && (
          <div style={{ marginTop: '8px', padding: '8px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
            <b style={{ color: '#16a34a', fontSize: '12px', display: 'block' }}>일정 변경됨</b>
            <span style={{ color: '#166534', fontSize: '12px' }}>기존 {formatDateTime(item.originalStartAt)} · 사유: {item.rescheduleReason}</span>
          </div>
        )}
      </Link>
      
      {item.state === "host" && item.meeting_type === "regular" && item.sessionId && item.sessionStatus === "scheduled" && !isPastDateTime(item.start_at) && (
        <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScheduleAction("change", item); }} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: '6px', background: '#fff' }}>일정 변경</button>
          <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); openScheduleAction("cancel", item); }} style={{ flex: 1, padding: '8px', fontSize: '12px', fontWeight: 'bold', color: '#ef4444', border: '1px solid #fecaca', borderRadius: '6px', background: '#fff' }}>일정 취소</button>
        </div>
      )}
    </div>
  );
}

export default function MobileMyMeetings({ meetings }) {
  const scheduleItems = useMemo(() => {
    const rawItems = [
      ...(meetings.data?.hosted || []).map(m => ({...m, state: "host"})),
      ...(meetings.data?.joined || []).map(m => ({...m, state: "joined"}))
    ];
    const expanded = [];
    rawItems.forEach(meeting => {
      if (meeting.meeting_type === "regular" && meeting.sessions && meeting.sessions.length > 0) {
        meeting.sessions.forEach(session => {
          if (!validDate(session.start_at)) return;
          expanded.push({
            id: meeting.id,
            sessionId: session.id,
            title: meeting.title || "제목 없는 모임",
            place: meeting.location_name || meeting.address || "장소 미정",
            start_at: session.start_at,
            end_at: session.end_at,
            state: meeting.state,
            status: meeting.status,
            meeting_type: meeting.meeting_type,
            sessionStatus: session.status || "scheduled",
            cancellationReason: session.cancellation_reason || "",
            rescheduleReason: session.reschedule_reason || "",
            originalStartAt: session.original_start_at || "",
            latitude: meeting.latitude,
            longitude: meeting.longitude,
            address: meeting.address || meeting.location_name || ""
          });
        });
      } else {
        if (!validDate(meeting.start_at)) return;
        expanded.push({
          id: meeting.id,
          sessionId: null,
          title: meeting.title || "제목 없는 모임",
          place: meeting.location_name || meeting.address || "장소 미정",
          start_at: meeting.start_at,
          end_at: meeting.end_at,
          state: meeting.state,
          status: meeting.status,
          meeting_type: meeting.meeting_type,
          sessionStatus: null,
          latitude: meeting.latitude,
          longitude: meeting.longitude,
          address: meeting.address || meeting.location_name || ""
        });
      }
    });
    const byKey = new Map();
    expanded.forEach(item => {
      const key = `${item.id}-${item.sessionId || 'one-time'}-${item.start_at}`;
      const existing = byKey.get(key);
      if (!existing || (item.state === "host" && existing.state !== "host")) {
        byKey.set(key, item);
      }
    });
    return Array.from(byKey.values()).sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
  }, [meetings.data]);

  const [scheduleAction, setScheduleAction] = useState(null);
  const [scheduleActionSubmitting, setScheduleActionSubmitting] = useState(false);
  const [scheduleActionError, setScheduleActionError] = useState("");

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
    if (scheduleActionSubmitting) return;
    if (clientError) {
      setScheduleActionError(clientError);
      return;
    }
    setScheduleActionSubmitting(true);
    setScheduleActionError("");
    try {
      await meetingApi.updateSession(scheduleAction.item.id, scheduleAction.item.sessionId, payload);
      setScheduleAction(null);
      meetings.execute(); 
    } catch (error) {
      setScheduleActionError(error.response?.data?.message || "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setScheduleActionSubmitting(false);
    }
  };

  const handleScheduleCancel = async (payload, clientError = "") => {
    if (scheduleActionSubmitting) return;
    if (clientError) {
      setScheduleActionError(clientError);
      return;
    }
    setScheduleActionSubmitting(true);
    setScheduleActionError("");
    try {
      await meetingApi.cancelSession(scheduleAction.item.id, scheduleAction.item.sessionId, payload.reason);
      setScheduleAction(null);
      meetings.execute(); 
    } catch (error) {
      setScheduleActionError(error.response?.data?.message || "요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setScheduleActionSubmitting(false);
    }
  };

  const monthBase = useMemo(() => new Date(), []);
  const [selectedScheduleKey, setSelectedScheduleKey] = useState("");
  const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
  const calendarCells = useMemo(() => buildMonthCells(monthBase, scheduleItems), [monthBase, scheduleItems]);
  const activeScheduleKey = selectedScheduleKey || dateKey(new Date());
  const selectedSchedules = scheduleItems.filter((item) => dateKey(item.start_at) === activeScheduleKey);

  return (
    <>
      <section className={`mobile-my-calendar ${isCalendarExpanded ? "is-expanded" : ""}`} aria-label="내 운동 일정">
        <header 
          className="mobile-my-calendar__head"
          onClick={() => setIsCalendarExpanded(!isCalendarExpanded)} 
          style={{ cursor: 'pointer', userSelect: 'none' }}
        >
          <div>
            <span>{monthBase.getFullYear()}년 {monthBase.getMonth() + 1}월</span>
            <h2>내 운동 일정</h2>
          </div>
          <div style={{ color: '#64748b', display: 'flex', alignItems: 'center' }}>
            {isCalendarExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
          </div>
        </header>
        <div className={`mobile-my-calendar__body ${isCalendarExpanded ? "is-expanded" : ""}`}>
          <div className="mobile-my-calendar__week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
          <div className="mobile-my-calendar__grid">
            {calendarCells.map((cell) => {
              const isActive = activeScheduleKey === cell.key;
              return cell.empty ? (
                <span key={cell.key} aria-hidden="true" />
              ) : (
                <button key={cell.key} type="button" className={`${cell.items.length ? "has-event" : ""} ${isActive ? "is-active" : ""}`} onClick={() => cell.items.length && setSelectedScheduleKey(cell.key)} disabled={!cell.items.length} style={{ position: 'relative' }}>
                  <b>{cell.day}</b>
                  {cell.items.length ? (
                    <em style={{
                      position: 'absolute',
                      bottom: '4px',
                      right: '4px',
                      background: isActive ? '#ffffff' : '#4f46e5',
                      color: isActive ? '#4f46e5' : 'white',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      minWidth: '16px',
                      height: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      fontStyle: 'normal',
                      padding: '0 4px'
                    }}>
                      {cell.items.length}
                    </em>
                  ) : null}
                </button>
              );
            })}
          </div>
          <div className="mobile-my-calendar__list">
            {selectedSchedules.length ? selectedSchedules.map((item) => (
              <MobileMyMeetingItem key={`${item.state}-${item.id}-${item.start_at}`} item={item} openScheduleAction={openScheduleAction} />
            )) : <p>표시할 일정이 없습니다.</p>}
          </div>
        </div>
      </section>

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
    </>
  );
}
