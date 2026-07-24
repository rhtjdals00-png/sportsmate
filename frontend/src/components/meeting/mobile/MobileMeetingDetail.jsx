import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Eye, LockKeyhole, MessageCircle, UserRound, Users, ChevronDown, Star, Crown, Share2, QrCode } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MobilePushPermissionModal from "../../notification/mobile/MobilePushPermissionModal.jsx";
import Badge from "../../common/Badge.jsx";
import Button from "../../common/Button.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import MobileMeetingLocationMap from "./MobileMeetingLocationMap.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatDateTime, formatMeetingType, formatRegularMeetingSchedule } from "../../../utils/formatters";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../../../utils/sportThumbnails";
import {
  canRequestMeetingParticipation,
  getMeetingLifecycleState,
  getMeetingRepresentativeStartAt,
  getMeetingStatusPresentation
} from "../../../utils/meetingLifecycle";
import { reportApi } from "../../../api/reportApi";
import { voteApi } from "../../../api/voteApi";
import { chatApi } from "../../../api/chatApi";
import { weatherApi } from "../../../api/weatherApi";
import MobileWeatherCard from "./MobileWeatherCard.jsx";
import MobileQrScanner from "../../attendance/MobileQrScanner.jsx";

function getDisplayStartAt(meeting) {
  return getMeetingRepresentativeStartAt(meeting) || meeting?.start_at || null;
}

function MobileMeetingDetail({ recordedViewCount = null }) {
  const { meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [message, setMessage] = useState({ text: "", tone: "notice" });
  const [reportReason, setReportReason] = useState("");
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [checkingAttendance, setCheckingAttendance] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [hostProfileOpen, setHostProfileOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [weatherState, setWeatherState] = useState({ loading: false, forecast: null });
  
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId, refreshKey]);
  const detailMeeting = detail.data?.meeting;
  const detailIsHost = user?.id === detailMeeting?.host?.id;
  const detailViewerStatus = detailMeeting?.viewer_status || detailMeeting?.my_participant?.status || "";
  const detailCanViewMemberContent = Boolean(detailMeeting && (detailIsHost || detailViewerStatus === "approved"));
  const notices = useAsync(
    () => detailCanViewMemberContent ? meetingApi.notices(meetingId) : Promise.resolve({ items: [] }),
    [meetingId, refreshKey, detailCanViewMemberContent]
  );
  const votes = useAsync(
    () => detailCanViewMemberContent ? meetingApi.votes(meetingId) : Promise.resolve({ items: [] }),
    [meetingId, refreshKey, detailCanViewMemberContent]
  );

  const handleQrScan = async (decodedText) => {
    try {
      const tokenMatch = decodedText.match(/checkin\/([^/?]+)/);
      const token = tokenMatch ? tokenMatch[1] : decodedText;

      await meetingApi.qrCheckin(token);
      setIsScanning(false);
      setMessage({ text: "출석 처리가 완료되었습니다!", tone: "notice" });
      setRefreshKey(k => k + 1);
    } catch (err) {
      setIsScanning(false);
      setMessage({ text: err.response?.data?.message || "유효하지 않은 QR 코드이거나 출석 처리에 실패했습니다.", tone: "danger" });
    }
  };

  useEffect(() => {
    if (!message.text) return undefined;
    const timer = window.setTimeout(() => setMessage({ text: "", tone: "notice" }), 2400);
    return () => window.clearTimeout(timer);
  }, [message.text]);

  useEffect(() => {
    const m = detail.data?.meeting;
    if (!m || !m.location_latitude || !m.location_longitude) return;
    
    let active = true;
    const at = getDisplayStartAt(m);
    setWeatherState({ loading: true, forecast: null });
    
    weatherApi.forecast({
      latitude: m.location_latitude,
      longitude: m.location_longitude,
      at: at,
      address: m.location_name
    })
      .then((data) => { if (active) setWeatherState({ loading: false, forecast: data.forecast }); })
      .catch(() => {
        if (active) setWeatherState({ loading: false, forecast: { available: false, message: "날씨 정보를 불러올 수 없습니다." } });
      });

    return () => { active = false; };
  }, [detail.data?.meeting?.id, detail.data?.meeting?.start_at, detail.data?.meeting?.location_latitude, detail.data?.meeting?.location_longitude]);

  if (detail.loading) return <LoadingCards count={2} />;

  const meeting = detail.data?.meeting;
  if (!meeting) return <p className="page-message">모임 정보를 찾을 수 없습니다.</p>;
  const isHost = user?.id === meeting.host?.id;
  const viewerStatus = meeting.viewer_status || meeting.my_participant?.status || "";
  const isApprovedParticipant = viewerStatus === "approved";
  const isPendingParticipant = viewerStatus === "pending";
  const lifecycleNow = new Date();
  const lifecycleState = getMeetingLifecycleState(meeting, lifecycleNow);
  const statusPresentation = getMeetingStatusPresentation(meeting, lifecycleNow);
  const representativeStartAt = getMeetingRepresentativeStartAt(meeting);
  const canJoin = canRequestMeetingParticipation({
    meeting,
    isHost,
    isApprovedParticipant,
    isPendingParticipant,
    isJoining: joining,
    now: lifecycleNow
  });
  const chatRoomId = meeting.chat_room_id || location.state?.chatRoomId;
  const canViewMemberContent = isHost || viewerStatus === "approved";
  const scheduleLabel = (() => {
    if (lifecycleState === "cancelled") return "취소된 모임입니다.";
    if (lifecycleState === "suspended") return "운영이 중지된 모임입니다.";
    if (lifecycleState === "ended") return "운영이 종료된 모임입니다.";
    if (meeting.meeting_type === "regular") {
      return representativeStartAt ? `다음 일정 ${formatDateTime(representativeStartAt)}` : "예정된 회차 없음";
    }
    return formatDateTime(representativeStartAt);
  })();

  const partBadge = (() => {
    const myParticipant = meeting?.my_participant;
    if (!myParticipant) return null;

    if (myParticipant.role === "host") {
      return { 
        text: (
          <span style={{ display: "inline-flex", alignItems: "center", gap: "3px" }}>
            <Crown size={12} style={{ fill: "currentColor" }} />
            내가 방장
          </span>
        ), 
        tone: "primary" 
      };
    }
    if (myParticipant.status === "pending") {
      return { text: "신청 대기중", tone: "warning" };
    }
    if (myParticipant.status === "approved") {
      return { text: "참여중", tone: "success" };
    }
    if (myParticipant.status === "rejected") {
      return { text: "신청 거절됨", tone: "danger" };
    }
    if (myParticipant.status === "cancelled") {
      return { text: "신청 취소됨", tone: "slate" };
    }
    return null;
  })();

  const joinMeeting = async () => {
    if (!canJoin) return;
    if (!isAuthenticated) {
      setMessage({ text: "로그인이 필요합니다.", tone: "danger" });
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    try {
      setJoining(true);
      await meetingApi.join(meetingId);
      setMessage({ text: "모임 참여를 신청했습니다.", tone: "success" });
      setRefreshKey((k) => k + 1);
      if ("Notification" in window && Notification.permission !== "granted") {
        if (!sessionStorage.getItem("sportsmate_push_prompted")) {
          setPermissionModalOpen(true);
          sessionStorage.setItem("sportsmate_push_prompted", "true");
        }
      }
    } catch (err) {
      setMessage({ text: err.response?.data?.message || "신청에 실패했습니다.", tone: "danger" });
    } finally {
      setJoining(false);
    }
  };

  const cancelMeetingJoin = async () => {
    if (!window.confirm(isApprovedParticipant ? "정말 이 모임에서 나가시겠습니까?" : "참여 신청을 취소하시겠습니까?")) return;
    try {
      setCancelling(true);
      await meetingApi.cancelJoin(meetingId);
      setMessage({ text: isApprovedParticipant ? "모임에서 나갔습니다." : "신청이 취소되었습니다.", tone: "success" });
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setMessage({ text: err.response?.data?.message || "취소 처리에 실패했습니다.", tone: "danger" });
    } finally {
      setCancelling(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    const reasonDetail = reportReason.trim();
    if (reasonDetail.length < 5) {
      setMessage({ text: "신고 사유를 5자 이상 자세히 입력해 주세요.", tone: "error" });
      return;
    }
    setReporting(true);
    try {
      await reportApi.create({
        target_type: "meeting",
        target_id: meeting.id,
        reason: "other",
        reason_detail: reasonDetail,
        context: JSON.stringify({
          meeting_id: meeting.id,
          meeting_title: meeting.title,
          source: "mobile_meeting_detail"
        })
      });
      setReportReason("");
      setMessage({ text: "신고가 접수되었습니다. 관리자가 확인 후 처리합니다.", tone: "success" });
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "신고를 접수하지 못했습니다.", tone: "error" });
    } finally {
      setReporting(false);
    }
  };

  const participateVote = async (voteId, optionId) => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    try {
      await voteApi.participate(voteId, { option_id: optionId });
      setRefreshKey((value) => value + 1);
      setMessage({ text: "투표가 반영되었습니다.", tone: "notice" });
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "투표를 반영하지 못했습니다.", tone: "error" });
    }
  };

  const startDirectChat = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    if (user?.id === meeting.host?.id) return;
    
    try {
      const data = await chatApi.createDirectRoom(meeting.host.id);
      if (data && data.room && data.room.id) {
        navigate(`/chats/direct/${data.room.id}`);
      } else {
        setMessage({ text: "채팅방을 생성하지 못했습니다.", tone: "error" });
      }
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "채팅방을 생성하지 못했습니다.", tone: "error" });
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: meeting.title,
      text: `[SportsMate] ${meeting.title} 모임에 함께해요!`,
      url: window.location.href,
    };
    
    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        // User cancelled share
      }
    } else {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setMessage({ text: "모임 링크가 클립보드에 복사되었습니다.", tone: "success" });
      } catch (err) {
        setMessage({ text: "링크 복사에 실패했습니다.", tone: "danger" });
      }
    }
  };

  return (
    <>
      <MobileHeader 
        title="모임 상세" 
        actions={
          <div className="mobile-header__actions">
            <button type="button" onClick={handleShare} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
              <Share2 size={20} />
            </button>
          </div>
        } 
      />
      <article className="detail-page">
        <div className={`detail-cover ${isUsingSportThumbnail(meeting) ? "is-sport-thumbnail" : ""}`} style={getMeetingCoverImage(meeting) ? { backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.14), rgba(15, 23, 42, 0.76)), url(${getMeetingCoverImage(meeting)})` } : undefined}>
          <div>
            <span>{meeting.sport?.name}</span>
            <strong>{meeting.title}</strong>
            <p>{meeting.location_name}</p>
          </div>
        </div>
        <div className="detail-card">
          <div className="meeting-card__top">
            <Badge tone={statusPresentation.tone}>{statusPresentation.label}</Badge>
            <Badge tone="sky">{meeting.is_lesson ? "강습형 모임" : formatMeetingType(meeting.meeting_type)}</Badge>
            {partBadge && <Badge tone={partBadge.tone}>{partBadge.text}</Badge>}
          </div>
          <p>{meeting.description}</p>
          
          {meeting.is_lesson && (
            <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', margin: '12px 0', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e293b', fontWeight: '800', marginBottom: '6px', fontSize: '13px' }}>
                <CalendarClock size={16} style={{ color: '#4f46e5' }} /> 강습 기간 안내
              </div>
              <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.4' }}>
                {meeting.start_at ? meeting.start_at.slice(0, 10).replace(/-/g, '.') : '?'} ~ {meeting.end_at ? meeting.end_at.slice(0, 10).replace(/-/g, '.') : '?'} 
                <br/>
                <span style={{ fontWeight: '600' }}>진행 시간:</span> {meeting.start_at ? meeting.start_at.slice(11, 16) : '?'} ~ {meeting.end_at ? meeting.end_at.slice(11, 16) : '?'}
              </p>
            </div>
          )}

          <dl className="info-list">
            <div>
              <CalendarClock size={18} />
              <span>{scheduleLabel}</span>
            </div>
            {meeting.meeting_type === "regular" && (
              <div>
                <CalendarClock size={18} />
                <span>{formatRegularMeetingSchedule(meeting, "반복 일정 미정")}</span>
              </div>
            )}
            <div>
              <Users size={18} />
              <span>
                {meeting.current_participants}/{meeting.max_participants}명
              </span>
            </div>
            <div>
              <UserRound size={18} />
              <span>{meeting.host?.nickname || "방장"}</span>
            </div>
            <div>
              <Eye size={18} />
              <span>조회 {Math.max(Number(meeting.view_count || 0), Number(recordedViewCount || 0))}</span>
            </div>
          </dl>

          {/* 방장 상세 프로필 아코디언 */}
          <div style={{ borderTop: "1px solid #f1f5f9", marginTop: "14px", paddingTop: "12px" }}>
            <button 
              type="button" 
              onClick={() => setHostProfileOpen(!hostProfileOpen)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: "none",
                border: 0,
                padding: 0,
                textAlign: "left",
                cursor: "pointer"
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#475569", display: "flex", alignItems: "center", gap: "6px" }}>
                <UserRound size={15} style={{ color: "var(--mobile-primary)" }} />
                방장 상세 프로필 {hostProfileOpen ? "접기" : "보기"}
              </span>
              <ChevronDown 
                size={16} 
                style={{ 
                  color: "#94a3b8", 
                  transition: "transform 0.2s ease",
                  transform: hostProfileOpen ? "rotate(180deg)" : "rotate(0)" 
                }} 
              />
            </button>

            {hostProfileOpen && (
              <div 
                style={{ 
                  marginTop: "12px", 
                  display: "grid",
                  gap: "10px",
                  animation: "mobileChatSlideDown 200ms ease both"
                }}
              >
                {/* 방장 프로필 요약 & 1:1 채팅 */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div 
                      style={{ 
                        width: "38px", height: "38px", borderRadius: "50%", 
                        backgroundColor: "#f1f5f9", overflow: "hidden", 
                        display: "flex", alignItems: "center", justifyContent: "center"
                      }}
                    >
                      {meeting.host?.profile_image_url ? (
                        <img src={meeting.host.profile_image_url} alt="Profile" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <UserRound size={20} color="#94a3b8" />
                      )}
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "800", color: "#1e293b", display: "flex", alignItems: "center", gap: "4px" }}>
                        {meeting.host?.nickname || "방장"}
                      </div>
                      <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                        #{meeting.host?.user_tag || "0000"}
                      </div>
                    </div>
                  </div>
                  {user?.id !== meeting.host?.id && (
                    <button
                      type="button"
                      onClick={startDirectChat}
                      style={{
                        display: "flex", alignItems: "center", gap: "4px",
                        padding: "6px 10px", borderRadius: "8px",
                        backgroundColor: "#eff6ff", border: "1px solid #bfdbfe",
                        color: "#3b82f6", fontSize: "12px", fontWeight: "800", cursor: "pointer"
                      }}
                    >
                      <MessageCircle size={14} />
                      1:1 채팅
                    </button>
                  )}
                </div>

                {/* 평점 및 통계 그리드 */}
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "3px", backgroundColor: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "4px 8px" }}>
                    <Star size={13} style={{ color: "#fbbf24", fill: "#fbbf24" }} />
                    <strong style={{ fontSize: "12px", color: "#b45309" }}>
                      {Number((meeting.host_summary || {}).rating_average || 0).toFixed(1)}
                    </strong>
                    <span style={{ fontSize: "10px", color: "#d97706" }}>/ 5.0</span>
                  </div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px", flex: 1, textAlign: "center" }}>
                    <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "4px 0" }}>
                      <span style={{ fontSize: "9px", color: "#64748b", display: "block" }}>개설</span>
                      <strong style={{ fontSize: "10px", color: "#334155" }}>{(meeting.host_summary || {}).hosted_count || 0}개</strong>
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "4px 0" }}>
                      <span style={{ fontSize: "9px", color: "#64748b", display: "block" }}>진행</span>
                      <strong style={{ fontSize: "10px", color: "#334155" }}>{(meeting.host_summary || {}).active_hosted_count || 0}개</strong>
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "4px 0" }}>
                      <span style={{ fontSize: "9px", color: "#64748b", display: "block" }}>마감</span>
                      <strong style={{ fontSize: "10px", color: "#334155" }}>{(meeting.host_summary || {}).completed_hosted_count || 0}개</strong>
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "4px 0" }}>
                      <span style={{ fontSize: "9px", color: "#64748b", display: "block" }}>후기</span>
                      <strong style={{ fontSize: "10px", color: "#334155" }}>{(meeting.host_summary || {}).review_count || 0}개</strong>
                    </div>
                  </div>
                </div>

                {/* 소개글 */}
                <p style={{ margin: 0, fontSize: "12px", color: "#475569", lineHeight: "1.45" }}>
                  {(meeting.host_summary || {}).bio || "등록된 방장 소개글이 없습니다."}
                </p>

                {/* 태그 리스트 */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "2px" }}>
                  {(meeting.host_summary || {}).region && (
                    <span style={{ fontSize: "10px", background: "#eff6ff", color: "#1d4ed8", padding: "2px 6px", borderRadius: "4px", fontWeight: "800" }}>
                      {(meeting.host_summary || {}).region}
                    </span>
                  )}
                  {(meeting.host_summary || {}).exercise_level && (
                    <span style={{ fontSize: "10px", background: "#ecfdf5", color: "#047857", padding: "2px 6px", borderRadius: "4px", fontWeight: "800" }}>
                      {(meeting.host_summary || {}).exercise_level === "beginner" ? "입문" : (meeting.host_summary || {}).exercise_level === "intermediate" ? "중급" : "상급"}
                    </span>
                  )}
                  {(meeting.host_summary || {}).preferred_sports && (
                    <span style={{ fontSize: "10px", background: "#f5f3ff", color: "#5b21b6", padding: "2px 6px", borderRadius: "4px", fontWeight: "800" }}>
                      {(meeting.host_summary || {}).preferred_sports}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ margin: "0 16px" }}>
          <MobileWeatherCard forecast={weatherState.forecast} loading={weatherState.loading} title={meeting.meeting_type === "regular" ? "다음 회차 날씨" : "모임 날씨"} />
        </div>
        <MobileMeetingLocationMap meeting={meeting} />
        {canViewMemberContent ? (
          <>
            <section className="detail-card">
              <h2>공지</h2>
              <div className="notice-list">
            {(notices.data?.items || []).map((notice) => (
              <article key={notice.id}>
                <strong>{notice.is_pinned ? "고정 · " : ""}{notice.title}</strong>
                <p>{notice.content}</p>
              </article>
            ))}
            {!notices.loading && !notices.data?.items?.length && <p>등록된 공지가 없습니다.</p>}
          </div>
        </section>
        <section className="detail-card">
              <h2>투표</h2>
              <div className="vote-list">
                {(votes.data?.items || []).map((vote) => (
                  <article key={vote.id}>
                    <strong>{vote.title}</strong>
                    <div>
                      {vote.options.map((option) => (
                        <button type="button" key={option.id} onClick={() => participateVote(vote.id, option.id)}>
                          {option.text} · {option.response_count}
                        </button>
                      ))}
                    </div>
                  </article>
                ))}
                {!votes.loading && !votes.data?.items?.length && <p>진행 중인 투표가 없습니다.</p>}
              </div>
            </section>

            <section className="detail-card">
              <h2>출석 체크</h2>
              <p style={{ fontSize: "12px", color: "#64748b", marginBottom: "12px", lineHeight: "1.4" }}>
                방장의 기기에 표시된 출석 QR 코드를 스캔해 주세요.
              </p>
              {isAuthenticated && (
                <button 
                  onClick={() => setIsScanning(true)}
                  style={{ 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                    width: '100%', padding: '16px', background: '#3b82f6', color: 'white', 
                    borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', 
                    boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', cursor: 'pointer' 
                  }}
                >
                  <QrCode size={20} />
                  QR 인식하기
                </button>
              )}
            </section>
          </>
        ) : (
          <section className="detail-card member-only-card">
            <LockKeyhole size={22} />
            <div>
              <h2>참여자 전용 정보</h2>
              <p>공지, 투표, 출석 정보는 참여 승인 후 확인할 수 있습니다.</p>
            </div>
          </section>
        )}
        <section className="detail-card">
          <h2>신고</h2>
          <form className="review-form" onSubmit={submitReport}>
            <label>
              신고 사유
              <textarea required minLength={5} value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="신고 사유를 자세히 입력해 주세요. (최소 5자)" />
              <small className="mobile-meeting-report-hint">입력한 내용은 모임 운영 확인을 위해 관리자에게 전달됩니다.</small>
            </label>
            <Button type="submit" variant="secondary" disabled={reporting}>{reporting ? "접수 중..." : "신고 접수"}</Button>
          </form>
        </section>
      </article>

      <div className="sticky-cta">
        {message.text && (
          <p
            className={`sticky-cta__message sticky-cta__message--${["error", "danger"].includes(message.tone) ? "error" : message.tone === "success" ? "success" : "notice"}`}
            role="status"
            aria-live="polite"
          >
            {message.text}
          </p>
        )}
        {isHost ? (
          <div className="sticky-cta__split">
            {chatRoomId ? (
              <Link className="button button--secondary" to={`/chats/${chatRoomId}`}>
                <MessageCircle size={18} />
                채팅방
              </Link>
            ) : null}
            <Link className="button button--primary" to={`/host/meetings/${meeting.id}`}>방장 관리</Link>
          </div>
        ) : isApprovedParticipant && chatRoomId ? (
          <div className="sticky-cta__split">
            <Button onClick={cancelMeetingJoin} disabled={cancelling} variant="danger">
              모임 나가기
            </Button>
            <Link className="button button--primary" to={`/chats/${chatRoomId}`}>
              <MessageCircle size={18} />
              채팅방 입장
            </Link>
          </div>
        ) : isApprovedParticipant ? (
          <Button onClick={cancelMeetingJoin} disabled={cancelling} variant="danger">
            모임 나가기
          </Button>
        ) : isPendingParticipant ? (
          <Button onClick={cancelMeetingJoin} disabled={cancelling} variant="secondary">
            신청 취소
          </Button>
        ) : (
          <Button onClick={joinMeeting} disabled={!canJoin}>
            {joining ? "신청 중..." : statusPresentation.state === "open" ? "참여 신청" : statusPresentation.label}
          </Button>
        )}
      </div>
      <MobilePushPermissionModal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
      />

      {isScanning && (
        <MobileQrScanner 
          onClose={() => setIsScanning(false)} 
          onScan={handleQrScan} 
        />
      )}
    </>
  );
}

export default MobileMeetingDetail;
