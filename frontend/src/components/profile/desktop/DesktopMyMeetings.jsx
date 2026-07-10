import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileText,
  LayoutDashboard,
  MessageCircle,
  X
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";

const joinedStates = new Set(["host", "joined"]);
const meetings = [];

function meetingDay(item) {
  return Number(item.time.match(/05\.(\d+)/)?.[1] || 0);
}

function meetingsOnDay(day) {
  return meetings.filter((item) => joinedStates.has(item.state) && meetingDay(item) === day);
}

function getDday(time) {
  const day = Number(time.match(/05\.(\d+)/)?.[1] || 0);
  if (!day) return "";
  const diff = day - 25;
  if (diff === 0) return "D-DAY";
  return diff > 0 ? `D-${diff}` : "종료";
}

function stateBadge(item) {
  if (item.state === "host") {
    return (
      <span className="board-badge host">
        <Crown size={13} />
        내가 방장
      </span>
    );
  }
  if (item.state === "joined") return <span className="board-badge joined">참여중</span>;
  return <span className="board-badge open">모집중</span>;
}

function CalendarGrid({ openDayModal }) {
  return (
    <section className="page-card calendar-card">
      <div className="calendar-head">
        <button type="button"><ChevronLeft size={20} /></button>
        <div>
          <p>2025년 5월</p>
          <h2>이번 달 운동 일정</h2>
        </div>
        <button type="button"><ChevronRight size={20} /></button>
      </div>
      <div className="calendar-week"><span>일</span><span>월</span><span>화</span><span>수</span><span>목</span><span>금</span><span>토</span></div>
      <div className="calendar-grid">
        {Array.from({ length: 35 }, (_, index) => {
          const day = index - 2;
          const items = day > 0 && day <= 31 ? meetingsOnDay(day) : [];
          const first = items[0];
          return (
            <button
              type="button"
              key={index}
              onClick={() => day > 0 && day <= 31 && openDayModal(day)}
              className={`calendar-day ${items.length ? "has-event" : ""} ${items.some((item) => item.state === "host") ? "host-day" : ""}`}
            >
              <b>{day > 0 && day <= 31 ? day : ""}</b>
              {first && (
                <>
                  <small>{first.title}</small>
                  <em>{items.length > 1 ? `+${items.length - 1}개 더보기` : first.state === "host" ? "방장" : first.state === "joined" ? "참여" : "모집"}</em>
                </>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ScheduleItem({ item }) {
  const isHost = item.state === "host";
  return (
    <article className={`proto-schedule-item ${isHost ? "proto-schedule-item--host" : ""}`}>
      {isHost && <Link className="schedule-manage-btn is-active" to={`/host/meetings/${item.id}`}><LayoutDashboard size={14} />관리</Link>}
      <img src={item.img} alt={item.title} />
      <div>
        {isHost && <div className="schedule-item-status"><span className="host-badge"><Crown size={13} />내가 방장</span></div>}
        <div className="schedule-meta-row">
          <span className="schedule-date">{item.time}</span>
          <span className="schedule-dday">{getDday(item.time)}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.place} · {item.member}</p>
        {!isHost && <div><span className="member-badge">참여중</span></div>}
        <footer>
          <Link className="ghost-btn" to={`/meetings/${item.id}`}><FileText size={14} />상세</Link>
          <Link className="ghost-btn" to={`/chats/${item.id}`}><MessageCircle size={14} />채팅</Link>
        </footer>
      </div>
    </article>
  );
}

function CalendarModal({ open, close, openDayModal }) {
  if (!open) return null;
  return (
    <div className="schedule-modal schedule-modal--calendar is-open is-calendar-modal" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="schedule-modal-panel">
        <button className="schedule-modal-close" type="button" onClick={close}><X size={18} /></button>
        <h2 className="schedule-modal-title">2025년 5월 전체 일정</h2>
        <div className="schedule-modal-body">
          <div className="profile-calendar-expanded">
            <CalendarGrid openDayModal={openDayModal} />
          </div>
        </div>
      </div>
    </div>
  );
}

function DayModal({ modal, close }) {
  if (!modal) return null;
  return (
    <div className="schedule-modal schedule-modal--day is-open" aria-hidden="false" onMouseDown={(event) => event.target === event.currentTarget && close()}>
      <div className="schedule-modal-panel">
        <button className="schedule-modal-close" type="button" onClick={close}><X size={18} /></button>
        <h2 className="schedule-modal-title">5월 {modal.day}일 일정</h2>
        <div className="schedule-modal-body">
          {modal.items.length ? modal.items.map((item) => (
            <article className="schedule-modal-item" key={item.id}>
              <img src={item.img} alt={item.title} />
              <div>
                {item.state === "host" && <div className="schedule-modal-status">{stateBadge(item)}</div>}
                <span>{item.time}</span>
                <h3>{item.title}</h3>
                <p>{item.place} · {item.member}</p>
                {item.state !== "host" && stateBadge(item)}
                <footer>
                  <Link className="ghost-btn" to={`/meetings/${item.id}`}>상세 보기</Link>
                  {joinedStates.has(item.state) ? <Link className="ghost-btn" to={`/chats/${item.id}`}>채팅</Link> : <Link className="primary-small" to="/mypage/meetings">참가 신청</Link>}
                  {item.state === "host" && <Link className="primary-small" to={`/host/meetings/${item.id}`}>관리</Link>}
                </footer>
              </div>
            </article>
          )) : <p className="empty-schedule">등록된 일정이 없습니다.</p>}
        </div>
      </div>
    </div>
  );
}

function DesktopMyMeetings() {
  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [dayModal, setDayModal] = useState(null);
  const scheduled = meetings.filter((item) => joinedStates.has(item.state));

  // 2026-07-10: /mypage/meetings 화면을 DesktopPrototype 의존 없이 독립 렌더링하도록 분리.
  const openDayModal = (day) => setDayModal({ day, items: meetingsOnDay(day) });
  const closeCalendarModal = () => {
    setCalendarModalOpen(false);
    setDayModal(null);
  };

  return (
    <div className="desktop-page desktop-prototype legacy-pc">
      <div className="screen-title">
        <div>
          <h1>내 일정</h1>
          <span>참여 예정인 모임과 내가 방장인 모임을 캘린더로 확인합니다.</span>
        </div>
      </div>
      <div className="schedule-layout">
        <CalendarGrid openDayModal={openDayModal} />
        <aside className="page-card schedule-list">
          <div className="section-head">
            <h2>다가오는 일정</h2>
            <span>{scheduled.length}개</span>
          </div>
          {scheduled.map((item) => <ScheduleItem key={item.id} item={item} />)}
        </aside>
      </div>
      <CalendarModal open={calendarModalOpen} close={closeCalendarModal} openDayModal={openDayModal} />
      <DayModal modal={dayModal} close={() => setDayModal(null)} />
    </div>
  );
}

export default DesktopMyMeetings;
