import { useEffect, useRef, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";

function AttendanceCheckinPage() {
  const { token } = useParams();
  const handledRef = useRef(false);
  const [state, setState] = useState({ status: "loading", message: "QR 출석 정보를 확인하고 있습니다.", data: null });

  useEffect(() => {
    if (!token || handledRef.current) return;
    handledRef.current = true;
    meetingApi.qrCheckin(token)
      .then((data) => setState({ status: "success", message: data.message, data }))
      .catch((error) => setState({
        status: "error",
        message: error.response?.data?.message || "QR 출석 체크에 실패했습니다.",
        data: null,
      }));
  }, [token]);

  const Icon = state.status === "success" ? CheckCircle2 : state.status === "error" ? XCircle : Loader2;
  return (
    <>
      <MobileHeader title="QR 출석 체크" />
      <main className={`attendance-checkin-result ${state.status}`}>
        <Icon size={58} className={state.status === "loading" ? "spin" : ""} />
        <h1>{state.status === "success" ? "출석 체크 완료" : state.status === "error" ? "체크인할 수 없습니다" : "출석 확인 중"}</h1>
        <p>{state.message}</p>
        {state.data ? (
          <div>
            <strong>{state.data.meeting?.title}</strong>
            <span><CalendarClock size={16} /> {new Date(state.data.session.start_at).toLocaleString("ko-KR")}</span>
            <span>현재 누적 출석률 {state.data.attendance_rate}%</span>
          </div>
        ) : null}
        <Link to={state.data?.meeting?.id ? `/meetings/${state.data.meeting.id}` : "/"}>확인</Link>
      </main>
    </>
  );
}

export default AttendanceCheckinPage;
