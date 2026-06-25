import { useParams } from "react-router-dom";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";

function HostAttendancePage() {
  const { meetingId } = useParams();
  const attendance = useAsync(() => meetingApi.attendance(meetingId), [meetingId]);
  const checkedIds = new Set((attendance.data?.items || []).map((item) => item.user.id));

  return (
    <>
      <MobileHeader title="출석 관리" />
      {attendance.loading ? (
        <LoadingCards count={2} />
      ) : (
        <div className="attendance-list">
          {(attendance.data?.approved_participants || []).map((participant) => (
            <article key={participant.id}>
              <strong>{participant.user.nickname}</strong>
              <span>{checkedIds.has(participant.user.id) ? "출석 완료" : "미출석"}</span>
            </article>
          ))}
        </div>
      )}
    </>
  );
}

export default HostAttendancePage;
