import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, Eye, LockKeyhole, MessageCircle, UserRound, Users, ChevronDown, Star, Crown, Share2 } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MobilePushPermissionModal from "../../notification/mobile/MobilePushPermissionModal.jsx";
import Badge from "../../common/Badge.jsx";
import Button from "../../common/Button.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import MobileMeetingLocationMap from "./MobileMeetingLocationMap.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../../../utils/sportThumbnails";
import { reportApi } from "../../../api/reportApi";
import { voteApi } from "../../../api/voteApi";
import { chatApi } from "../../../api/chatApi";

function MobileMeetingDetail() {
  const { meetingId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [message, setMessage] = useState({ text: "", tone: "notice" });
  const [review, setReview] = useState({ rating: 5, content: "" });
  const [reportReason, setReportReason] = useState("");
  const [joining, setJoining] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [checkingAttendance, setCheckingAttendance] = useState(false);
  const [hostProfileOpen, setHostProfileOpen] = useState(false);
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId, refreshKey]);
  const detailMeeting = detail.data?.meeting;
  const detailIsHost = user?.id === detailMeeting?.host?.id;
  const detailViewerStatus = detailMeeting?.viewer_status || detailMeeting?.my_participant?.status || "";
  const detailCanViewMemberContent = Boolean(detailMeeting && (detailIsHost || detailViewerStatus === "approved"));
  const reviews = useAsync(
    () => detailCanViewMemberContent ? meetingApi.reviews(meetingId) : Promise.resolve({ items: [] }),
    [meetingId, refreshKey, detailCanViewMemberContent]
  );
  const notices = useAsync(
    () => detailCanViewMemberContent ? meetingApi.notices(meetingId) : Promise.resolve({ items: [] }),
    [meetingId, refreshKey, detailCanViewMemberContent]
  );
  const votes = useAsync(
    () => detailCanViewMemberContent ? meetingApi.votes(meetingId) : Promise.resolve({ items: [] }),
    [meetingId, refreshKey, detailCanViewMemberContent]
  );

  useEffect(() => {
    if (!message.text) return undefined;
    const timer = window.setTimeout(() => setMessage({ text: "", tone: "notice" }), 2400);
    return () => window.clearTimeout(timer);
  }, [message.text]);

  if (detail.loading) return <LoadingCards count={2} />;

  const meeting = detail.data?.meeting;
  if (!meeting) return <p className="page-message">모임 정보를 찾을 수 없습니다.</p>;
  const isHost = user?.id === meeting.host?.id;
  const isClosed = meeting.status !== "open";
  const isFull = Number(meeting.current_participants || 0) >= Number(meeting.max_participants || 0);
  const viewerStatus = meeting.viewer_status || meeting.my_participant?.status || "";
  const isApprovedParticipant = viewerStatus === "approved";
  const isPendingParticipant = viewerStatus === "pending";
  const canJoin = !isHost && !isApprovedParticipant && !isPendingParticipant && !isClosed && !isFull && !joining;
  const chatRoomId = meeting.chat_room_id || location.state?.chatRoomId;
  const canViewMemberContent = isHost || viewerStatus === "approved";

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

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewing(true);
    try {
      await meetingApi.createReview(meeting.id, { rating: Number(review.rating), content: review.content });
      setReview({ rating: 5, content: "" });
      setRefreshKey((value) => value + 1);
      setMessage({ text: "후기가 등록되었습니다.", tone: "notice" });
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "후기를 등록하지 못했습니다.", tone: "error" });
    } finally {
      setReviewing(false);
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    setReporting(true);
    try {
      await reportApi.create({ target_type: "meeting", target_id: meeting.id, reason: reportReason });
      setReportReason("");
      setMessage({ text: "신고가 접수되었습니다.", tone: "notice" });
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

  const checkAttendance = async () => {
    setCheckingAttendance(true);
    try {
      await meetingApi.checkAttendance(meeting.id);
      setMessage({ text: "출석 체크가 완료되었습니다.", tone: "notice" });
    } catch (error) {
      setMessage({ text: error.response?.data?.message || "출석 체크를 처리하지 못했습니다.", tone: "error" });
    } finally {
      setCheckingAttendance(false);
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
            <Badge tone={meeting.status === "open" ? "success" : "slate"}>{meeting.status === "open" ? "모집중" : "모집마감"}</Badge>
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
              <span>{formatDateTime(meeting.start_at)}</span>
            </div>
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
              <span>조회 {meeting.view_count || 0}</span>
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
                모임 참여가 완료되었다면 본인의 출석 현황을 확인하여 반영해 주세요.
              </p>
              {isAuthenticated && (
                <Button 
                  type="button" 
                  variant="secondary" 
                  onClick={checkAttendance} 
                  disabled={checkingAttendance}
                  style={{ width: "100%" }}
                >
                  {checkingAttendance ? "처리 중..." : "출석 체크 하기"}
                </Button>
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
          <h2>후기 요약</h2>
          <div className="review-list">
            {(reviews.data?.items || []).map((item) => (
              <article key={item.id}>
                <strong>{item.rating}점 · {item.reviewer.nickname}</strong>
                <p>{item.content}</p>
              </article>
            ))}
            {!reviews.loading && !reviews.data?.items?.length && <p>아직 작성된 후기가 없습니다.</p>}
          </div>
          {isAuthenticated && canViewMemberContent && (
            <form className="review-form" onSubmit={submitReview}>
              <label>
                평점
                <select value={review.rating} onChange={(event) => setReview({ ...review, rating: event.target.value })}>
                  <option value="5">5점</option>
                  <option value="4">4점</option>
                  <option value="3">3점</option>
                  <option value="2">2점</option>
                  <option value="1">1점</option>
                </select>
              </label>
              <label>
                후기
                <textarea required value={review.content} onChange={(event) => setReview({ ...review, content: event.target.value })} placeholder="모임 후기를 작성하세요" />
              </label>
              <Button type="submit" variant="secondary" disabled={reviewing}>{reviewing ? "등록 중..." : "후기 등록"}</Button>
            </form>
          )}
        </section>
        <section className="detail-card">
          <h2>신고</h2>
          <form className="review-form" onSubmit={submitReport}>
            <label>
              신고 사유
              <textarea required value={reportReason} onChange={(event) => setReportReason(event.target.value)} placeholder="신고 사유를 입력하세요" />
            </label>
            <Button type="submit" variant="secondary" disabled={reporting}>{reporting ? "접수 중..." : "신고 접수"}</Button>
          </form>
        </section>
      </article>
      <div className="sticky-cta">
        {message.text && <span className={`sticky-cta__message sticky-cta__message--${message.tone}`}>{message.text}</span>}
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
            {joining ? "신청 중..." : isClosed ? "모집 마감" : isFull ? "정원 마감" : "참여 신청"}
          </Button>
        )}
      </div>
      <MobilePushPermissionModal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
      />
    </>
  );
}

export default MobileMeetingDetail;
