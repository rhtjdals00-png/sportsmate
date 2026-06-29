import { Link } from "react-router-dom";
import { BarChart3, CalendarCheck, ClipboardCheck, Megaphone, UserCheck, Vote } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";

function MobileHostDashboard() {
  const meetings = useAsync(() => meetingApi.list({ mine: "host" }), []);

  return (
    <>
      <MobileHeader title="방장 관리" />
      <section className="section">
        <div className="section-title"><h2>내가 만든 모임</h2></div>
        <div className="card-list">
          {(meetings.data?.items || []).map((meeting) => (
            <article className="host-card" key={meeting.id}>
              <strong>{meeting.title}</strong>
              <p>{meeting.current_participants}/{meeting.max_participants}명 참여 중</p>
              <div>
                <Link to={`/host/meetings/${meeting.id}`}>관리</Link>
                <Link to={`/host/meetings/${meeting.id}/applicants`}><UserCheck size={17} /> 신청자</Link>
                <Link to={`/host/meetings/${meeting.id}/attendance`}><ClipboardCheck size={17} /> 출석</Link>
                <Link to={`/host/meetings/${meeting.id}/vote`}><Vote size={17} /> 투표</Link>
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="section host-dashboard-stats">
        <div className="section-title"><h2>활동 통계</h2></div>
        <div className="admin-panel host-stats-grid">
          <div><CalendarCheck size={20} /><strong>이번 달 모임</strong><span>4회</span></div>
          <div><BarChart3 size={20} /><strong>평균 참여율</strong><span>92%</span></div>
        </div>
      </section>
      <section className="detail-card host-tool-panel">
        <h2>모임 운영 도구</h2>
        <div>
          <Link to="/host"><Megaphone size={20} />공지 작성</Link>
          <Link to="/host"><Vote size={20} />투표 만들기</Link>
          <Link to="/host"><ClipboardCheck size={20} />출석 체크</Link>
        </div>
      </section>
      <section className="detail-card host-applicant-preview">
        <div className="section-title">
          <h2>신청자 관리</h2>
          <span>New 2</span>
        </div>
        <article>
          <img src="/img/test3.png" alt="" />
          <div>
            <strong>김철수 <em>36.5°</em></strong>
            <p>"열심히 뛰겠습니다! 잘 부탁드립니다."</p>
          </div>
        </article>
        <div>
          <button type="button">거절하기</button>
          <button type="button">승인하기</button>
        </div>
      </section>
    </>
  );
}

export default MobileHostDashboard;
