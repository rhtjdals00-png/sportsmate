import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import AttendanceQrPanel from "../components/attendance/AttendanceQrPanel.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";

function formatAttendanceSession(session) {
  if (!session?.start_at) return `${session?.session_number || "-"}회차`;
  const date = new Date(session.start_at);
  const dateLabel = date.toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const timeLabel = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${session.session_number}회차 · ${dateLabel} ${timeLabel}${session.status === "cancelled" ? " · 취소" : ""}`;
}

function HostAttendancePage() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkingId, setCheckingId] = useState(null);
  const [selectedSessionId, setSelectedSessionId] = useState("");
  const attendance = useAsync(
    () => meetingApi.attendance(meetingId, selectedSessionId ? { session_id: selectedSessionId } : {}),
    [meetingId, refreshKey, selectedSessionId],
  );
  const attendanceStatusByUser = new Map(
    (attendance.data?.items || []).map((item) => [item.user.id, item.status]),
  );
  const activeSessionId = selectedSessionId || attendance.data?.selected_session?.id || "";

  const checkParticipant = async (userId, status) => {
    if (!activeSessionId) return;
    setCheckingId(userId);
    try {
      await meetingApi.checkAttendance(meetingId, {
        user_id: userId,
        status,
        session_id: Number(activeSessionId),
      });
      setRefreshKey((value) => value + 1);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <>
      <MobileHeader title="출석 관리" />
      {(attendance.data?.sessions?.length || attendance.data?.past_sessions?.length) ? (
        <label className="attendance-session-picker">
          <span>출석 회차</span>
          <select value={activeSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
            {!activeSessionId ? <option value="">회차를 선택해 주세요</option> : null}
            {attendance.data.sessions?.length ? (
              <optgroup label="이번 주 남은 회차">
                {attendance.data.sessions.map((session) => (
                  <option key={session.id} value={session.id}>{formatAttendanceSession(session)}</option>
                ))}
              </optgroup>
            ) : null}
            {attendance.data.past_sessions?.length ? (
              <optgroup label="지난 회차 수정">
                {attendance.data.past_sessions.map((session) => (
                  <option key={session.id} value={session.id}>{formatAttendanceSession(session)}</option>
                ))}
              </optgroup>
            ) : null}
          </select>
        </label>
      ) : null}
      {attendance.loading ? (
        <LoadingCards count={2} />
      ) : !attendance.data?.selected_session ? (
        <EmptyState title="출석 회차를 선택해 주세요." description="지난 회차는 수정할 수 있고, 다음 주 회차는 다음 주 월요일부터 열립니다." />
      ) : attendance.data?.approved_participants?.length ? (
        <>
          <AttendanceQrPanel
            key={attendance.data.selected_session.id}
            meetingId={meetingId}
            session={attendance.data.selected_session}
          />
          <div className="attendance-list">
            {(attendance.data?.approved_participants || []).map((participant) => {
            const isPresent = attendanceStatusByUser.get(participant.user.id) === "present";
            const isUpdating = checkingId === participant.user.id;
            return (
            <article key={participant.id}>
              <div>
                <img src={participant.user.profile_image_url || "/images/logo.png"} alt="" />
                <strong>{participant.user.nickname}</strong>
              </div>
              <div className="attendance-list__control">
                <span className={isPresent ? "checked" : ""}>{isPresent ? "출석 완료" : "미출석"}</span>
                <Button
                  type="button"
                  onClick={() => checkParticipant(participant.user.id, isPresent ? "absent" : "present")}
                  disabled={!activeSessionId || isUpdating}
                >
                  {isUpdating ? "처리 중" : isPresent ? "미출석으로 변경" : "출석 체크"}
                </Button>
              </div>
            </article>
            );
            })}
          </div>
        </>
      ) : (
        <EmptyState title="출석 대상이 없습니다." description="승인된 참여자가 생기면 출석 체크를 진행할 수 있습니다." />
      )}
    </>
  );
}

export default HostAttendancePage;
