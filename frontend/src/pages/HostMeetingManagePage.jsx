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
import LoadingCards from "../components/common/LoadingCards.jsx";
import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";

const fallbackMeetingImage = "https://images.unsplash.com/photo-1575361204480-aadea25e6e68?auto=format&fit=crop&w=700&q=80";
const fallbackHostMeetings = {
  "0": {
    title: "한강 러닝 같이 하실 분!",
    sport: "러닝",
    place: "여의도 한강공원",
    starts_at: "05.25(월) 19:00",
    current_participants: 12,
    max_participants: 20,
    image_url: "https://images.unsplash.com/photo-1552674605-db6ffd4facb5?auto=format&fit=crop&w=700&q=80"
  }
};

function HostMeetingManagePage() {
  const { isMobile } = useResponsive();
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState({ title: "", content: "", is_pinned: true });
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId]);
  const notices = useAsync(() => meetingApi.notices(meetingId), [meetingId, refreshKey]);

  const fallbackMeeting = {
    id: meetingId || "0",
    title: "초보자 환영 풋살 모임",
    sport: "축구 / 풋살",
    place: "여의도 풋살장",
    starts_at: "2026-10-28 19:00",
    current_participants: 8,
    max_participants: 10,
    image_url: fallbackMeetingImage,
    ...(fallbackHostMeetings[meetingId] || {})
  };
  const meeting = detail.data?.meeting || fallbackMeeting;
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

  if (detail.loading) return <LoadingCards count={2} />;

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
  const meetingDate = meeting.starts_at || meeting.time || "2026-10-28 19:00";
  const current = meeting.current_participants ?? 8;
  const max = meeting.max_participants ?? 10;
  const thumbnail = meeting.image_url || meeting.thumbnail_url || meeting.img || fallbackMeetingImage;

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>방장 관리</h1>
          <span>모임 정보와 운영 메뉴, 공지 내용을 관리합니다.</span>
        </div>
      </div>
      {/* 2026-06-30: 개별 모임 관리 화면은 실제 데이터가 없어도 프론트 작업이 가능하도록 fallback 정보를 표시. */}
      <div className="desktop-host-manage-layout">
        <section className="page-card desktop-host-meeting-card">
          <div className="desktop-host-thumbnail">
            <img src={thumbnail} alt="" />
            <button type="button"><Camera size={15} />사진 변경</button>
          </div>
          <div className="desktop-host-meeting-info">
            <span className="host-status-pill">모집중</span>
            <h2>{meeting.title}</h2>
            <p><CalendarDays size={15} />{meetingDate}</p>
            <p><MapPin size={15} />{meeting.place || meeting.location || "장소 미정"}</p>
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
