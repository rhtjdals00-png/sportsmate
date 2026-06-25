import { Link } from "react-router-dom";
import { ClipboardCheck, UserCheck, Vote } from "lucide-react";
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
    </>
  );
}

export default MobileHostDashboard;
