import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Eye, MapPin, MessageSquareText, ShieldCheck, UserRound, UsersRound } from "lucide-react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import StaticMapCard from "../../map/StaticMapCard.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";

function DesktopMeetingDetail() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [joining, setJoining] = useState(false);
  const [message, setMessage] = useState({ text: "", tone: "notice" });
  const [refreshKey, setRefreshKey] = useState(0);
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId, refreshKey]);

  if (detail.loading) return <LoadingCards count={3} />;
  if (detail.error || !detail.data?.meeting) {
    return (
      <EmptyState
        title="모임을 찾을 수 없습니다."
        description="삭제되었거나 접근할 수 없는 모임입니다."
        actionLabel="모임 게시판"
        actionTo="/meetings"
      />
    );
  }

  const meeting = detail.data.meeting;
  const myParticipant = meeting.my_participant;
  const isHost = user?.id === meeting.host?.id || myParticipant?.role === "host";
  const isClosed = meeting.status !== "open";
  const isFull = Number(meeting.current_participants || 0) >= Number(meeting.max_participants || 0);
  const hasApplied = Boolean(myParticipant && myParticipant.role !== "host" && myParticipant.status !== "cancelled");
  const canJoin = !isHost && !hasApplied && !isClosed && !isFull && !joining;

  const joinMeeting = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }

    setJoining(true);
    setMessage({ text: "", tone: "notice" });
    try {
      await meetingApi.join(meeting.id, { join_message: "참여 신청합니다." });
      setMessage({
        text: meeting.approval_required ? "참가 신청이 접수됐습니다. 방장 승인 후 참여가 확정됩니다." : "모임 참여가 완료됐습니다.",
        tone: "notice"
      });
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "참가 신청을 처리하지 못했습니다.", tone: "error" });
    } finally {
      setJoining(false);
    }
  };

  const statusLabel = getStatusLabel(meeting.status);
  const participantLabel = getParticipantLabel(myParticipant);
  const actionLabel = getActionLabel({ joining, isClosed, isFull, isHost, myParticipant });

  return (
    <div className="desktop-meeting-detail">
      <div className="screen-title desktop-meeting-detail__title">
        <div>
          <span>모임 게시판</span>
          <h1>{meeting.title}</h1>
          <p>{meeting.location_name || meeting.address}</p>
        </div>
        <Link className="ghost-btn" to="/meetings">목록으로</Link>
      </div>

      <div className="desktop-meeting-detail__grid">
        <main className="desktop-meeting-detail__main">
          <section className="desktop-meeting-detail__hero" style={meeting.cover_image_url ? { backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.12), rgba(15, 23, 42, 0.66)), url(${meeting.cover_image_url})` } : undefined}>
            {!meeting.cover_image_url && <span>{meeting.sport?.name || "SportsMate"}</span>}
          </section>

          <section className="desktop-section desktop-meeting-detail__body">
            <div className="desktop-section__head">
              <h2>상세 내용</h2>
              <span>{meeting.sport?.name || "종목 미정"} · {formatMeetingType(meeting.meeting_type)}</span>
            </div>
            <p>{meeting.description || "등록된 모임 설명이 없습니다."}</p>
            <div className="desktop-meeting-detail__chips">
              <span className={`desktop-meeting-status ${meeting.status === "open" ? "is-open" : "is-closed"}`}>{statusLabel}</span>
              <span>{meeting.approval_required ? "방장 승인 필요" : "즉시 참여"}</span>
              {participantLabel && <span>{participantLabel}</span>}
            </div>
          </section>

          <section className="desktop-section desktop-meeting-detail__map">
            <div className="desktop-section__head">
              <h2>모임 장소</h2>
              <span>{meeting.address || "주소 미정"}</span>
            </div>
            <StaticMapCard meeting={meeting} />
          </section>
        </main>

        <aside className="desktop-meeting-detail__side">
          <section className="desktop-section desktop-meeting-detail__panel">
            <div className="desktop-meeting-detail__host">
              <span><UserRound size={22} /></span>
              <div>
                <strong>{meeting.host?.nickname || meeting.host?.name || "방장"}</strong>
                <small>모임 방장</small>
              </div>
            </div>

            <dl className="desktop-meeting-detail__info">
              <div><CalendarClock size={18} /><span>{formatDateTime(meeting.start_at)}</span></div>
              <div><MapPin size={18} /><span>{meeting.location_name || "장소 미정"}</span></div>
              <div><UsersRound size={18} /><span>{meeting.current_participants}/{meeting.max_participants}명</span></div>
              <div><Eye size={18} /><span>조회 {meeting.view_count || 0}</span></div>
              <div><ShieldCheck size={18} /><span>{meeting.approval_required ? "승인제 모임" : "선착순 모임"}</span></div>
            </dl>

            {message.text && <p className={`desktop-meeting-detail__message is-${message.tone}`}>{message.text}</p>}

            {isHost ? (
              <Link className="primary-btn full" to={`/host/meetings/${meeting.id}`}>방장 관리</Link>
            ) : (
              <button className="primary-btn full" type="button" onClick={joinMeeting} disabled={!canJoin}>
                {actionLabel}
              </button>
            )}

            {myParticipant?.status === "approved" && (
              <Link className="ghost-btn full" to="/chats">
                <MessageSquareText size={16} /> 채팅방 보기
              </Link>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function getStatusLabel(status) {
  if (status === "open") return "모집중";
  if (status === "cancelled") return "취소됨";
  return "모집마감";
}

function getParticipantLabel(participant) {
  if (!participant) return "";
  if (participant.role === "host") return "내가 만든 모임";
  if (participant.status === "pending") return "신청 대기중";
  if (participant.status === "approved") return "참여중";
  if (participant.status === "rejected") return "신청 거절됨";
  if (participant.status === "cancelled") return "신청 취소됨";
  return "";
}

function getActionLabel({ joining, isClosed, isFull, isHost, myParticipant }) {
  if (joining) return "신청 중...";
  if (isHost) return "방장 관리";
  if (myParticipant?.status === "pending") return "승인 대기중";
  if (myParticipant?.status === "approved") return "참여중";
  if (myParticipant?.status === "rejected") return "신청 거절됨";
  if (isClosed) return "모집 마감";
  if (isFull) return "정원 마감";
  return "참가 신청";
}

export default DesktopMeetingDetail;
