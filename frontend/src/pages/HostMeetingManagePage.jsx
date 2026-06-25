import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ClipboardCheck, Edit3, UserCheck, Vote } from "lucide-react";
import Button from "../components/common/Button.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";

function HostMeetingManagePage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState({ title: "", content: "", is_pinned: true });
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId]);
  const notices = useAsync(() => meetingApi.notices(meetingId), [meetingId, refreshKey]);

  const cancelMeeting = async () => {
    await meetingApi.cancel(meetingId);
    navigate("/host");
  };

  const submitNotice = async (event) => {
    event.preventDefault();
    await meetingApi.createNotice(meetingId, notice);
    setNotice({ title: "", content: "", is_pinned: true });
    setRefreshKey((value) => value + 1);
  };

  if (detail.loading) return <LoadingCards count={2} />;
  const meeting = detail.data?.meeting;

  return (
    <>
      <MobileHeader title="모임 관리" />
      {meeting && (
        <div className="manage-page">
          <MeetingCard meeting={meeting} />
          <div className="manage-actions">
            <Link to={`/meetings/${meeting.id}/edit`}><Edit3 size={18} /> 정보 수정</Link>
            <Link to={`/host/meetings/${meeting.id}/applicants`}><UserCheck size={18} /> 신청자 관리</Link>
            <Link to={`/host/meetings/${meeting.id}/attendance`}><ClipboardCheck size={18} /> 출석 관리</Link>
            <Link to={`/host/meetings/${meeting.id}/vote`}><Vote size={18} /> 투표 관리</Link>
          </div>
          <section className="detail-card">
            <h2>공지 작성</h2>
            <form className="review-form" onSubmit={submitNotice}>
              <label>제목<input required value={notice.title} onChange={(event) => setNotice({ ...notice, title: event.target.value })} /></label>
              <label>내용<textarea required value={notice.content} onChange={(event) => setNotice({ ...notice, content: event.target.value })} /></label>
              <label className="checkbox-line">
                <input type="checkbox" checked={notice.is_pinned} onChange={(event) => setNotice({ ...notice, is_pinned: event.target.checked })} />
                상단 고정
              </label>
              <Button type="submit" variant="secondary">공지 등록</Button>
            </form>
          </section>
          <section className="detail-card">
            <h2>등록된 공지</h2>
            <div className="notice-list">
              {(notices.data?.items || []).map((item) => (
                <article key={item.id}>
                  <strong>{item.title}</strong>
                  <p>{item.content}</p>
                </article>
              ))}
              {!notices.loading && !notices.data?.items?.length && <p>등록된 공지가 없습니다.</p>}
            </div>
          </section>
          <Button variant="secondary" onClick={cancelMeeting}>모임 취소</Button>
        </div>
      )}
    </>
  );
}

export default HostMeetingManagePage;
