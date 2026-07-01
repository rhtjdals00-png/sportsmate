import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  CalendarDays,
  ClipboardCheck,
  Edit3,
  MapPin,
  Megaphone,
  UserCheck,
  Users,
  Vote
} from "lucide-react";
import Button from "../components/common/Button.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";

function HostMeetingManagePage() {
  const { isMobile } = useResponsive();
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState({ title: "", content: "", is_pinned: true });
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId]);
  const notices = useAsync(() => meetingApi.notices(meetingId), [meetingId, refreshKey]);

  if (detail.loading) return <LoadingCards count={2} />;
  if (detail.error || !detail.data?.meeting) {
    return (
      <EmptyState
        title="모임을 불러오지 못했습니다."
        description="방장 관리 화면은 DB에 저장된 모임 정보가 필요합니다."
        actionLabel="내 모임 보기"
        actionTo="/mypage/meetings"
      />
    );
  }

  const meeting = detail.data.meeting;
  const noticeItems = notices.data?.items || [];

  const cancelMeeting = async () => {
    await meetingApi.cancel(meeting.id);
    navigate("/mypage");
  };

  const submitNotice = async (event) => {
    event.preventDefault();
    await meetingApi.createNotice(meeting.id, notice);
    setNotice({ title: "", content: "", is_pinned: true });
    setRefreshKey((value) => value + 1);
  };

  if (!isMobile) {
    return (
      <DesktopHostMeetingManage
        meeting={meeting}
        notice={notice}
        noticeItems={noticeItems}
        noticesLoading={notices.loading}
        setNotice={setNotice}
        submitNotice={submitNotice}
        cancelMeeting={cancelMeeting}
      />
    );
  }

  return (
    <>
      <MobileHeader title="모임 관리" />
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
            {noticeItems.map((item) => (
              <article key={item.id}>
                <strong>{item.title}</strong>
                <p>{item.content}</p>
              </article>
            ))}
            {!notices.loading && !noticeItems.length && <p>등록된 공지가 없습니다.</p>}
          </div>
        </section>
        <Button variant="secondary" onClick={cancelMeeting}>모임 취소</Button>
      </div>
    </>
  );
}

function DesktopHostMeetingManage({ meeting, notice, noticeItems, noticesLoading, setNotice, submitNotice, cancelMeeting }) {
  const meetingDate = meeting.start_at || meeting.starts_at || meeting.time || "일정 미정";
  const current = meeting.current_participants ?? 0;
  const max = meeting.max_participants ?? "-";
  const thumbnail = meeting.cover_image_url || meeting.image_url || meeting.thumbnail_url || meeting.img;
  const place = meeting.location_name || meeting.address || meeting.place || meeting.location || "장소 미정";

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>방장 관리</h1>
          <span>모임 정보와 운영 메뉴, 공지 내용을 관리합니다.</span>
        </div>
      </div>
      <div className="desktop-host-manage-layout">
        <section className="page-card desktop-host-meeting-card">
          <div className="desktop-host-thumbnail">
            {thumbnail ? <img src={thumbnail} alt="" /> : <span>등록된 사진 없음</span>}
            <button type="button"><Camera size={15} />사진 변경</button>
          </div>
          <div className="desktop-host-meeting-info">
            <span className="host-status-pill">모집중</span>
            <h2>{meeting.title}</h2>
            <p><CalendarDays size={15} />{meetingDate}</p>
            <p><MapPin size={15} />{place}</p>
          </div>
          <div className="desktop-host-meeting-meta">
            <strong><Users size={17} />{current} / {max}명</strong>
            <Link to={`/meetings/${meeting.id}`}>모임 상세 보기</Link>
          </div>
        </section>

        <section className="page-card desktop-host-tool-card">
          <div className="section-head"><h2>관리 메뉴</h2></div>
          <div className="desktop-host-tool-grid">
            <Link to={`/meetings/${meeting.id}/edit`}><Edit3 size={20} /><span>정보 수정</span></Link>
            <Link to={`/host/meetings/${meeting.id}/applicants`}><UserCheck size={20} /><span>신청자 관리</span></Link>
            <Link to={`/host/meetings/${meeting.id}/attendance`}><ClipboardCheck size={20} /><span>출석 관리</span></Link>
            <Link to={`/host/meetings/${meeting.id}/vote`}><Vote size={20} /><span>투표 관리</span></Link>
          </div>
          <div className="desktop-host-danger-zone">
            <button type="button" onClick={cancelMeeting}>모임 취소</button>
          </div>
        </section>

        <section className="page-card desktop-host-notice-card">
          <div className="section-head"><h2>공지 관리</h2></div>
          <div className="desktop-host-notice-grid">
            <form className="review-form" onSubmit={submitNotice}>
              <label>제목<input required value={notice.title} onChange={(event) => setNotice({ ...notice, title: event.target.value })} /></label>
              <label>내용<textarea required value={notice.content} onChange={(event) => setNotice({ ...notice, content: event.target.value })} /></label>
              <label className="checkbox-line">
                <input type="checkbox" checked={notice.is_pinned} onChange={(event) => setNotice({ ...notice, is_pinned: event.target.checked })} />
                상단 고정
              </label>
              <button className="primary-small" type="submit"><Megaphone size={15} />공지 등록</button>
            </form>
            <div className="desktop-host-notice-list">
              <h3>등록된 공지</h3>
              {noticesLoading ? (
                <LoadingCards count={1} />
              ) : noticeItems.length ? (
                noticeItems.map((item) => (
                  <article key={item.id}>
                    <strong>{item.title}</strong>
                    <p>{item.content}</p>
                  </article>
                ))
              ) : (
                <p>등록된 공지가 없습니다.</p>
              )}
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

export default HostMeetingManagePage;
