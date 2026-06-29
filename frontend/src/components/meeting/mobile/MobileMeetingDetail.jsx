import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CalendarClock, UserRound, Users } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Badge from "../../common/Badge.jsx";
import Button from "../../common/Button.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import StaticMapCard from "../../map/StaticMapCard.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatDateTime, formatMeetingType } from "../../../utils/formatters";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { reportApi } from "../../../api/reportApi";
import { voteApi } from "../../../api/voteApi";

function MobileMeetingDetail() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [message, setMessage] = useState("");
  const [review, setReview] = useState({ rating: 5, content: "" });
  const [reportReason, setReportReason] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId]);
  const reviews = useAsync(() => meetingApi.reviews(meetingId), [meetingId, refreshKey]);
  const notices = useAsync(() => meetingApi.notices(meetingId), [meetingId, refreshKey]);
  const votes = useAsync(() => meetingApi.votes(meetingId), [meetingId, refreshKey]);

  if (detail.loading) return <LoadingCards count={2} />;

  const meeting = detail.data?.meeting;
  if (!meeting) return <p className="page-message">모임 정보를 찾을 수 없습니다.</p>;

  const joinMeeting = async () => {
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    try {
      await meetingApi.join(meeting.id, { join_message: "함께 운동하고 싶습니다." });
      setMessage("참여 신청이 완료되었습니다.");
    } catch (error) {
      setMessage(error.response?.data?.message || "참여 신청을 처리하지 못했습니다.");
    }
  };

  const submitReview = async (event) => {
    event.preventDefault();
    try {
      await meetingApi.createReview(meeting.id, { rating: Number(review.rating), content: review.content });
      setReview({ rating: 5, content: "" });
      setRefreshKey((value) => value + 1);
      setMessage("후기가 등록되었습니다.");
    } catch (error) {
      setMessage(error.response?.data?.message || "후기를 등록하지 못했습니다.");
    }
  };

  const submitReport = async (event) => {
    event.preventDefault();
    if (!isAuthenticated) {
      navigate("/login", { state: { from: `/meetings/${meeting.id}` } });
      return;
    }
    try {
      await reportApi.create({ target_type: "meeting", target_id: meeting.id, reason: reportReason });
      setReportReason("");
      setMessage("신고가 접수되었습니다.");
    } catch (error) {
      setMessage(error.response?.data?.message || "신고를 접수하지 못했습니다.");
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
      setMessage("투표가 반영되었습니다.");
    } catch (error) {
      setMessage(error.response?.data?.message || "투표를 반영하지 못했습니다.");
    }
  };

  const checkAttendance = async () => {
    try {
      await meetingApi.checkAttendance(meeting.id);
      setMessage("출석 체크가 완료되었습니다.");
    } catch (error) {
      setMessage(error.response?.data?.message || "출석 체크를 처리하지 못했습니다.");
    }
  };

  return (
    <>
      <MobileHeader title="모임 상세" />
      <article className="detail-page">
        <div className="detail-cover" style={meeting.cover_image_url ? { backgroundImage: `linear-gradient(180deg, rgba(15, 23, 42, 0.14), rgba(15, 23, 42, 0.76)), url(${meeting.cover_image_url})` } : undefined}>
          <div>
            <span>{meeting.sport?.name}</span>
            <strong>{meeting.title}</strong>
            <p>{meeting.location_name}</p>
          </div>
        </div>
        <div className="detail-card">
          <div className="meeting-card__top">
            <Badge tone="success">{meeting.status === "open" ? "모집중" : "모집마감"}</Badge>
            <Badge tone="sky">{formatMeetingType(meeting.meeting_type)}</Badge>
          </div>
          <p>{meeting.description}</p>
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
          </dl>
        </div>
        <StaticMapCard meeting={meeting} />
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
          {isAuthenticated && <Button type="button" variant="secondary" onClick={checkAttendance}>출석 체크</Button>}
        </section>
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
          {isAuthenticated && (
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
              <Button type="submit" variant="secondary">후기 등록</Button>
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
            <Button type="submit" variant="secondary">신고 접수</Button>
          </form>
        </section>
      </article>
      <div className="sticky-cta">
        {message && <span>{message}</span>}
        {user?.id === meeting.host?.id ? (
          <Link className="button button--primary" to={`/host/meetings/${meeting.id}`}>방장 관리</Link>
        ) : (
          <Button onClick={joinMeeting}>참여 신청</Button>
        )}
      </div>
    </>
  );
}

export default MobileMeetingDetail;
