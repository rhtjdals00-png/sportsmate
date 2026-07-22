import { Link } from "react-router-dom";
import { BarChart3, CalendarCheck, ClipboardCheck, UserCheck, Users, Vote } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatDateTime } from "../../../utils/formatters";

function MobileHostDashboard() {
  const meetings = useAsync(() => meetingApi.list({ mine: "host" }), []);
  const meetingItems = meetings.data?.items || [];
  const openMeetings = meetingItems.filter((meeting) => meeting.status === "open");
  const totalParticipants = meetingItems.reduce((sum, meeting) => sum + Number(meeting.current_participants || 0), 0);

  return (
    <>
      <MobileHeader title="방장 관리" />
      <section className="host-mobile-hero">
        <span>HOST CENTER</span>
        <h1>내가 관리하는 모임을 운영해요</h1>
        <p>신청자 승인, 공지, 투표, 출석 관리를 한곳에서 확인합니다.</p>
      </section>
      <section className="host-dashboard-stats">
        <div className="admin-panel host-stats-grid">
          <div><CalendarCheck size={20} /><strong>운영 모임</strong><span>{meetingItems.length}개</span></div>
          <div><Users size={20} /><strong>전체 참여자</strong><span>{totalParticipants}명</span></div>
          <div><BarChart3 size={20} /><strong>모집중</strong><span>{openMeetings.length}개</span></div>
        </div>
      </section>
      <section className="section">
        <div className="section-title"><h2>내가 관리하는 모임</h2></div>
        {meetings.loading ? (
          <LoadingCards count={2} />
        ) : meetingItems.length ? (
          <div className="card-list">
            {meetingItems.map((meeting) => (
              <article className="host-card host-card--rich" key={meeting.id}>
                <div className="host-card__summary">
                  <span>{meeting.sport?.name || meeting.sport_name || "종목 미정"}</span>
                  <strong>{meeting.title}</strong>
                  <p>{meeting.location_name || meeting.address || "장소 미정"} · {formatDateTime(meeting.start_at)}</p>
                  <em>{meeting.current_participants}/{meeting.max_participants}명 참여 중</em>
                </div>
                <div>
                  <Link to={`/host/meetings/${meeting.id}`}>관리</Link>
                  <Link to={`/host/meetings/${meeting.id}/applicants`}><UserCheck size={17} /> 신청자</Link>
                  <Link to={`/host/meetings/${meeting.id}/attendance`}><ClipboardCheck size={17} /> 출석</Link>
                  <Link to={`/host/meetings/${meeting.id}/vote`}><Vote size={17} /> 투표</Link>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="운영 중인 모임이 없습니다." description="모임을 만들면 신청자와 출석, 공지를 이곳에서 관리할 수 있습니다." />
        )}
      </section>
    </>
  );
}

export default MobileHostDashboard;
