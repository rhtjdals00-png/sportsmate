import { useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  CalendarDays,
  ClipboardCheck,
  Edit3,
  MapPin,
  Megaphone,
  ShieldCheck,
  UserCheck,
  Users,
  Vote,
  Plus,
  Trash2,
  FileText,
  MessageCircle
} from "lucide-react";
import Button from "../components/common/Button.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { sportApi } from "../api/sportApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import { formatExerciseLevel } from "../utils/formatters";

function HostMeetingManagePage() {
  const { isMobile } = useResponsive();
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState({ title: "", content: "", is_pinned: true });
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
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
    const ok = window.confirm("모집 종료하시겠습니까?");
    if (!ok) return;
    try {
      await meetingApi.update(meeting.id, { status: "closed" });
      alert("모집이 종료되었습니다.");
      window.location.reload();
    } catch (err) {
      console.error("Failed to close meeting", err);
      alert("모집 종료 중 오류가 발생했습니다.");
    }
  };

  const toggleMeetingStatus = async () => {
    const isCurrentlyOpen = meeting.status === "open";
    const confirmMessage = isCurrentlyOpen
      ? "모집을 종료하시겠습니까?"
      : "모집을 다시 시작하시겠습니까?";
    
    const ok = window.confirm(confirmMessage);
    if (!ok) return;

    try {
      const nextStatus = isCurrentlyOpen ? "closed" : "open";
      await meetingApi.update(meeting.id, { status: nextStatus });
      alert(isCurrentlyOpen ? "모집이 종료되었습니다." : "모집이 시작되었습니다.");
      window.location.reload();
    } catch (err) {
      console.error("Failed to update meeting status", err);
      alert(isCurrentlyOpen ? "모집 종료 중 오류가 발생했습니다." : "모집 시작 중 오류가 발생했습니다.");
    }
  };

  const deleteMeeting = async () => {
    if (isDeletingMeeting) return;

    const ok = window.confirm(
      "이 모임을 삭제할까요?\n\n삭제하면 참여자에게 더 이상 표시되지 않으며, 모임에 접근할 수 없습니다."
    );
    if (!ok) return;

    try {
      setIsDeletingMeeting(true);
      await meetingApi.cancel(meeting.id);
      alert("모임이 삭제되었습니다.");
      navigate("/mypage?panel=hosted");
    } catch (err) {
      console.error("Failed to delete meeting", err);
      alert(err.response?.data?.message || "모임 삭제에 실패했습니다. 다시 시도해 주세요.");
      setIsDeletingMeeting(false);
    }
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
        toggleMeetingStatus={toggleMeetingStatus}
        deleteMeeting={deleteMeeting}
        isDeletingMeeting={isDeletingMeeting}
      />
    );
  }

  return (
    <>
      <MobileHeader title="모임 관리" />
      <div className="manage-page">
        <section className="host-manage-hero">
          <span>운영 중</span>
          <h1>{meeting.title}</h1>
          <p>{meeting.location_name || meeting.place || meeting.address || "장소 미정"}</p>
          <div>
            <strong><Users size={16} />{meeting.current_participants ?? 0}/{meeting.max_participants ?? 0}명</strong>
            <strong><CalendarDays size={16} />{meeting.start_at ? new Date(meeting.start_at).toLocaleDateString("ko-KR", { month: "short", day: "numeric", weekday: "short" }) : "일정 미정"}</strong>
          </div>
        </section>
        <MeetingCard meeting={meeting} />
        <div className="manage-actions">
          <Link to={`/meetings/${meeting.id}/edit`}><Edit3 size={18} /> 정보 수정</Link>
          <Link to={`/host/meetings/${meeting.id}/applicants`}><UserCheck size={18} /> 신청자 관리</Link>
          <Link to={`/host/meetings/${meeting.id}/attendance`}><ClipboardCheck size={18} /> 출석 관리</Link>
          <Link to={`/host/meetings/${meeting.id}/vote`}><Vote size={18} /> 투표 관리</Link>
        </div>
        <section className="detail-card host-notice-editor">
          <div className="host-section-head">
            <div>
              <span><Megaphone size={15} />공지</span>
              <h2>참여자에게 알릴 내용을 작성해요</h2>
            </div>
            <ShieldCheck size={22} />
          </div>
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
        <section className="detail-card host-notice-history">
          <div className="host-section-head">
            <div>
              <span><Megaphone size={15} />최근 공지</span>
              <h2>등록된 공지</h2>
            </div>
            <strong>{noticeItems.length}개</strong>
          </div>
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
        <div className="host-manage-bottom-buttons">
          <Button variant="outline" onClick={() => navigate(`/meetings/${meeting.id}`)}>수정 취소</Button>
          <Button variant="danger" onClick={cancelMeeting}>모집종료</Button>
        </div>
      </div>
    </>
  );
}

function formatMeetingDate(dateStr) {
  if (!dateStr || dateStr === "일정 미정") return "일정 미정";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(d);
  } catch {
    return dateStr;
  }
}

function DesktopHostMeetingManage({ meeting, notice, noticeItems, noticesLoading, setNotice, submitNotice, toggleMeetingStatus, deleteMeeting, isDeletingMeeting }) {
  const [activeTab, setActiveTab] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const fileInputRef = useRef(null);

  const handleTabClick = (tabName) => {
    setActiveTab((prev) => (prev === tabName ? null : tabName));
  };

  const handlePhotoBtnClick = () => {
    fileInputRef.current?.click();
  };

  const handlePhotoChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset value so onChange will fire next time even with the same file
    event.target.value = "";

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        // Resize if larger than 1200px
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);

        meetingApi.update(meeting.id, { cover_image_url: compressedDataUrl })
          .then(() => {
            alert("모임 대표 사진이 변경되었습니다.");
            window.location.reload();
          })
          .catch((err) => {
            console.error("Failed to upload image", err);
            alert("사진 업로드 중 오류가 발생했습니다.");
          });
      };
      img.onerror = () => {
        alert("올바르지 않은 이미지 파일입니다.");
      };
      img.src = e.target.result;
    };
    reader.onerror = () => {
      alert("파일을 읽는 동안 오류가 발생했습니다.");
    };
    reader.readAsDataURL(file);
  };

  const meetingDate = meeting.start_at || meeting.starts_at || meeting.time || "일정 미정";
  const current = meeting.current_participants ?? 0;
  const max = meeting.max_participants ?? "-";
  const thumbnail = meeting.cover_image_url || meeting.image_url || meeting.thumbnail_url || meeting.img;
  const place = meeting.location_name || meeting.address || meeting.place || meeting.location || "장소 미정";

  // 0. 관리자 설정 값 조회
  const config = useAsync(() => meetingApi.getConfig(), []);
  const maxLimit = config.data?.defaultMaxParticipants || 50;

  // 1. 모임 수정 관련 State & API 호출
  const sports = useAsync(() => (activeTab === "edit" ? sportApi.sports() : Promise.resolve(null)), [activeTab]);
  const [editForm, setEditForm] = useState({
    sport_id: meeting.sport?.id || "",
    title: meeting.title || "",
    description: meeting.description || "",
    purpose: meeting.purpose || "",
    location_name: meeting.location_name || "",
    address: meeting.address || "",
    start_at: meeting.start_at?.slice(0, 16) || "",
    end_at: meeting.end_at?.slice(0, 16) || "",
    max_participants: meeting.max_participants || 2
  });

  const isTimeInvalid = Boolean(editForm.start_at && editForm.end_at && new Date(editForm.end_at) <= new Date(editForm.start_at));

  const handleStartAtChange = (e) => {
    const startVal = e.target.value;
    if (!startVal) {
      setEditForm((prev) => ({ ...prev, start_at: startVal }));
      return;
    }
    const startDate = new Date(startVal);
    startDate.setHours(startDate.getHours() + 1);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, "0");
    const day = String(startDate.getDate()).padStart(2, "0");
    const hours = String(startDate.getHours()).padStart(2, "0");
    const minutes = String(startDate.getMinutes()).padStart(2, "0");
    const newEndAt = `${year}-${month}-${day}T${hours}:${minutes}`;
    setEditForm((prev) => ({
      ...prev,
      start_at: startVal,
      end_at: newEndAt
    }));
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (isTimeInvalid) return;
    const maxPartCount = Number(editForm.max_participants);
    if (maxPartCount > maxLimit) {
      return alert(`최대 정원은 ${maxLimit}명 이하로만 설정 가능합니다.`);
    }
    await meetingApi.update(meeting.id, {
      ...editForm,
      sport_id: Number(editForm.sport_id),
      max_participants: maxPartCount
    });
    alert("모임 정보가 수정되었습니다.");
    window.location.reload();
  };

  // 2. 신청자 관리 관련 API 호출
  const applicants = useAsync(
    () => (activeTab === "applicants" ? meetingApi.applicants(meeting.id) : Promise.resolve(null)),
    [meeting.id, activeTab, refreshKey]
  );

  const decideApplicant = async (userId, action) => {
    if (action === "approve") await meetingApi.approve(meeting.id, userId);
    else await meetingApi.reject(meeting.id, userId);
    setRefreshKey((value) => value + 1);
    alert(action === "approve" ? "승인되었습니다." : "거절되었습니다.");
  };

  // 3. 출석 관리 관련 API 호출
  const attendance = useAsync(
    () => (activeTab === "attendance" ? meetingApi.attendance(meeting.id) : Promise.resolve(null)),
    [meeting.id, activeTab, refreshKey]
  );
  const checkedIds = new Set((attendance.data?.items || []).map((item) => item.user.id));
  const checkParticipant = async (userId) => {
    await meetingApi.checkAttendance(meeting.id, { user_id: userId });
    setRefreshKey((value) => value + 1);
    alert("출석 체크되었습니다.");
  };

  // 4. 투표 관리 관련 API 호출
  const votes = useAsync(
    () => (activeTab === "vote" ? meetingApi.votes(meeting.id) : Promise.resolve(null)),
    [meeting.id, activeTab, refreshKey]
  );
  const [voteForm, setVoteForm] = useState({
    title: "",
    options: ["찬성", "반대"],
    ends_at: "",
    allow_multiple: false,
    is_anonymous: true
  });
  const submitVote = async (e) => {
    e.preventDefault();
    await meetingApi.createVote(meeting.id, {
      title: voteForm.title.trim(),
      options: voteForm.options.map((item) => item.trim()).filter(Boolean),
      ends_at: voteForm.ends_at || null,
      allow_multiple: voteForm.allow_multiple,
      is_anonymous: voteForm.is_anonymous
    });
    setVoteForm({ title: "", options: ["찬성", "반대"], ends_at: "", allow_multiple: false, is_anonymous: true });
    setRefreshKey((value) => value + 1);
    alert("투표가 생성되었습니다.");
  };
  const updateVoteOption = (index, value) => {
    setVoteForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  const removeVoteOption = (indexToRemove) => {
    if (voteForm.options.length <= 2) return;
    setVoteForm((current) => ({
      ...current,
      options: current.options.filter((_, idx) => idx !== indexToRemove)
    }));
  };

  const handleDeleteVote = async (voteId) => {
    const ok = window.confirm("투표를 삭제하시겠습니까? 삭제 시 채팅방의 투표 공지도 '삭제된 투표입니다.'로 변경됩니다.");
    if (!ok) return;
    try {
      await meetingApi.deleteVote(meeting.id, voteId);
      alert("투표가 삭제되었습니다.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      console.error("Failed to delete vote", err);
      alert("투표 삭제 중 오류가 발생했습니다.");
    }
  };

  const handleDeleteNotice = async (noticeId) => {
    const ok = window.confirm("공지를 삭제하시겠습니까? 삭제 시 채팅방의 공지도 '삭제된 공지입니다.'로 변경됩니다.");
    if (!ok) return;
    try {
      await meetingApi.deleteNotice(meeting.id, noticeId);
      alert("공지가 삭제되었습니다.");
      setRefreshKey((value) => value + 1);
    } catch (err) {
      console.error("Failed to delete notice", err);
      alert("공지 삭제 중 오류가 발생했습니다.");
    }
  };

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>방장 관리</h1>
          <span>모임 정보와 운영 메뉴, 공지 내용을 한 화면에서 편리하게 관리합니다.</span>
        </div>
        <button
          type="button"
          className="desktop-host-delete-link"
          onClick={deleteMeeting}
          disabled={isDeletingMeeting}
        >
          {isDeletingMeeting ? "삭제 중..." : "모임 삭제"}
        </button>
      </div>
      <div className="desktop-host-manage-layout">
        {/* 모임 기본 정보 카드 */}
        <section className="page-card desktop-host-meeting-card">
          <div className="desktop-host-thumbnail-container">
            <div className="desktop-host-thumbnail">
              {thumbnail ? <img src={thumbnail} alt="" /> : <div className="no-thumbnail-placeholder">등록된 사진 없음</div>}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              accept="image/*"
              onChange={handlePhotoChange}
            />
            <button
              type="button"
              className="desktop-host-change-photo-btn"
              onClick={handlePhotoBtnClick}
            >
              <Camera size={15} />
              사진 변경
            </button>
          </div>
          <div className="desktop-host-meeting-info">
            <span className={`host-status-pill ${meeting.status !== "open" ? "closed" : ""}`}>
              {meeting.status === "open" ? "모집중" : "모집마감"}
            </span>
            <h2>{meeting.title}</h2>
            <div className="desktop-host-meeting-details-grid">
              <p><CalendarDays size={15} />{formatMeetingDate(meetingDate)}</p>
              <p><MapPin size={15} />{place}</p>
              <p><Users size={15} />참여 인원: {current} / {max}명</p>
            </div>
          </div>
          <div className="desktop-host-card-actions">
            <Link to={`/meetings/${meeting.id}`} className="ghost-btn">
              <FileText size={14} />
              <span>상세</span>
            </Link>
            <Link to={meeting.chat_room_id ? `/chats/${meeting.chat_room_id}` : "/chats"} className="ghost-btn">
              <MessageCircle size={14} />
              <span>채팅</span>
            </Link>
          </div>
        </section>

        {/* 탭 기반 관리 메뉴 */}
        <section className="page-card desktop-host-tool-card">
          <div className="section-head"><h2>관리 메뉴</h2></div>
          <div className="desktop-host-tool-grid-5">
            <button
              type="button"
              className={`desktop-host-tool-button ${activeTab === "edit" ? "active" : ""}`}
              onClick={() => handleTabClick("edit")}
            >
              <Edit3 size={20} />
              <span>정보 수정</span>
            </button>
            <button
              type="button"
              className={`desktop-host-tool-button ${activeTab === "applicants" ? "active" : ""}`}
              onClick={() => handleTabClick("applicants")}
            >
              <UserCheck size={20} />
              <span>신청자 관리</span>
            </button>
            <button
              type="button"
              className={`desktop-host-tool-button ${activeTab === "attendance" ? "active" : ""}`}
              onClick={() => handleTabClick("attendance")}
            >
              <ClipboardCheck size={20} />
              <span>출석 관리</span>
            </button>
            <button
              type="button"
              className={`desktop-host-tool-button ${activeTab === "vote" ? "active" : ""}`}
              onClick={() => handleTabClick("vote")}
            >
              <Vote size={20} />
              <span>투표 관리</span>
            </button>
            <button
              type="button"
              className={`desktop-host-tool-button ${activeTab === "notice" ? "active" : ""}`}
              onClick={() => handleTabClick("notice")}
            >
              <Megaphone size={20} />
              <span>공지 관리</span>
            </button>
          </div>
        </section>

        {/* 탭 콘텐츠 영역 */}
        {activeTab === "edit" && (
          <section className="page-card desktop-host-tab-content-card">
            <div className="section-head"><h2>모임 정보 수정</h2></div>
            <form className="desktop-host-edit-form" onSubmit={submitEdit}>
              <div className="form-section">
                <h3 className="form-section-title">기본 정보</h3>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="sport_id">운동 종목</label>
                    <select id="sport_id" value={editForm.sport_id} onChange={(e) => setEditForm({ ...editForm, sport_id: e.target.value })}>
                      {(sports.data?.items || []).map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="max_participants">정원 (2~{maxLimit}명)</label>
                    <input id="max_participants" type="number" min="2" max={maxLimit} value={editForm.max_participants} onChange={(e) => setEditForm({ ...editForm, max_participants: e.target.value })} />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="title">모임 제목</label>
                  <input id="title" required placeholder="모임의 매력적인 제목을 지어보세요" value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} />
                </div>

                <div className="form-group">
                  <label htmlFor="purpose">모집 목적</label>
                  <input id="purpose" placeholder="예: 운동 실력 향상, 메이트 찾기, 친목 도모 등" value={editForm.purpose} onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} />
                </div>

                <div className="form-group">
                  <label htmlFor="description">모임 설명</label>
                  <textarea id="description" required placeholder="진행할 운동 루틴이나 상세한 계획을 작성해주세요." value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                </div>
              </div>

              <div className="form-section">
                <h3 className="form-section-title">일정 및 장소</h3>
                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="start_at">시작 시간</label>
                    <input id="start_at" required type="datetime-local" value={editForm.start_at} onChange={handleStartAtChange} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="end_at">종료 시간</label>
                    <input id="end_at" type="datetime-local" value={editForm.end_at} onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })} />
                    {isTimeInvalid && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>종료 시간은 시작 시간 이후여야 합니다.</span>}
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-group">
                    <label htmlFor="location_name">장소명</label>
                    <input id="location_name" required placeholder="예: 강남 체육공원, 스타피트니스" value={editForm.location_name} onChange={(e) => setEditForm({ ...editForm, location_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label htmlFor="address">주소</label>
                    <input id="address" required placeholder="도로명 주소 또는 상세 주소" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} />
                  </div>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="cancel-btn"
                  type="button"
                  onClick={() => {
                    setEditForm({
                      sport_id: meeting.sport?.id || "",
                      title: meeting.title || "",
                      description: meeting.description || "",
                      purpose: meeting.purpose || "",
                      location_name: meeting.location_name || "",
                      address: meeting.address || "",
                      start_at: meeting.start_at?.slice(0, 16) || "",
                      end_at: meeting.end_at?.slice(0, 16) || "",
                      max_participants: meeting.max_participants || 2
                    });
                    setActiveTab(null);
                  }}
                >
                  취소
                </button>
                <button className="submit-btn" type="submit" disabled={isTimeInvalid}>수정 완료</button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "applicants" && (
          <section className="page-card desktop-host-tab-content-card">
            <div className="section-head"><h2>참가자 관리</h2></div>
            {applicants.loading ? (
              <LoadingCards count={2} />
            ) : applicants.data?.items?.length ? (
              <table className="flow-table">
                <thead>
                  <tr>
                    <th>참가자</th>
                    <th>상태</th>
                    <th>운동 성향</th>
                    <th>신청 메시지</th>
                    <th>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="table-user">
                          <img src={item.user.profile_image_url || "/img/test3.png"} alt="" />
                          <span><b>{item.user.nickname}</b><small>{item.user.profile?.region || "지역 미설정"}</small></span>
                        </div>
                      </td>
                      <td><span className="status wait">대기</span></td>
                      <td>{formatExerciseLevel(item.user.profile?.exercise_level)} · {item.user.profile?.preferred_sports || "선호 종목 미설정"}</td>
                      <td>{item.join_message || "참여 신청 메시지가 없습니다."}</td>
                      <td>
                        <div className="table-actions">
                          <Button type="button" onClick={() => decideApplicant(item.user.id, "approve")}>승인</Button>
                          <Button type="button" variant="danger" onClick={() => decideApplicant(item.user.id, "reject")}>거절</Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <EmptyState title="대기 중인 신청자가 없습니다." description="새 참여 신청이 들어오면 이곳에서 승인하거나 거절할 수 있습니다." />
            )}
          </section>
        )}

        {activeTab === "attendance" && (
          <section className="page-card desktop-host-tab-content-card">
            <div className="section-head"><h2>출석 체크 관리</h2></div>
            {attendance.loading ? (
              <LoadingCards count={2} />
            ) : attendance.data?.approved_participants?.length ? (
              <div className="attendance-list">
                {(attendance.data?.approved_participants || []).map((participant) => (
                  <article key={participant.id} className="desktop-attendance-item">
                    <div className="user-info">
                      <img src={participant.user.profile_image_url || "/images/logo.png"} alt="" />
                      <strong>{participant.user.nickname}</strong>
                    </div>
                    <div className="control">
                      <span className={checkedIds.has(participant.user.id) ? "status-badge checked" : "status-badge"}>
                        {checkedIds.has(participant.user.id) ? "출석 완료" : "미출석"}
                      </span>
                      {!checkedIds.has(participant.user.id) && (
                        <Button type="button" onClick={() => checkParticipant(participant.user.id)}>
                          출석 체크
                        </Button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="출석 대상이 없습니다." description="승인된 참여자가 생기면 출석 체크를 진행할 수 있습니다." />
            )}
          </section>
        )}

        {activeTab === "vote" && (
          <section className="page-card desktop-host-tab-content-card">
            <div className="section-head"><h2>투표 관리</h2></div>
            <div className="desktop-two-column vote-column" style={{ marginTop: 0 }}>
              <section className="host-vote-desktop-card">
                <h3>새 투표 만들기</h3>
                <form className="host-vote-desktop-form" onSubmit={submitVote}>
                  <div className="form-group">
                    <label htmlFor="vote-title">제목</label>
                    <input id="vote-title" type="text" required placeholder="투표 제목을 입력하세요" value={voteForm.title} onChange={(event) => setVoteForm({ ...voteForm, title: event.target.value })} />
                  </div>

                  <div className="form-group">
                    <label>선택지</label>
                    <div className="vote-options-list">
                      {voteForm.options.map((option, index) => (
                        <div key={index} className="vote-option-item">
                          <input
                            type="text"
                            required
                            placeholder={`선택지 ${index + 1}`}
                            value={option}
                            onChange={(event) => updateVoteOption(index, event.target.value)}
                          />
                          {voteForm.options.length > 2 && (
                            <button
                              type="button"
                              className="remove-option-btn"
                              onClick={() => removeVoteOption(index)}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button className="add-option-btn" type="button" onClick={() => setVoteForm((current) => ({ ...current, options: [...current.options, ""] }))}>
                      <Plus size={15} /> 선택지 추가
                    </button>
                  </div>

                  <div className="form-group">
                    <label htmlFor="vote-ends-at">투표 종료일자</label>
                    <input id="vote-ends-at" type="datetime-local" value={voteForm.ends_at} onChange={(event) => setVoteForm({ ...voteForm, ends_at: event.target.value })} />
                  </div>

                  <div className="host-vote-switches-grid">
                    <label className={`switch-card ${voteForm.allow_multiple ? "active" : ""}`}>
                      <input type="checkbox" checked={voteForm.allow_multiple} onChange={(event) => setVoteForm({ ...voteForm, allow_multiple: event.target.checked })} />
                      <div className="switch-card-content">
                        <strong>복수 선택 허용</strong>
                        <span>여러 개의 답변 선택 가능</span>
                      </div>
                    </label>
                    <label className={`switch-card ${!voteForm.is_anonymous ? "active" : ""}`}>
                      <input type="checkbox" checked={!voteForm.is_anonymous} onChange={(event) => setVoteForm({ ...voteForm, is_anonymous: !event.target.checked })} />
                      <div className="switch-card-content">
                        <strong>공개 투표</strong>
                        <span>누가 투표했는지 투표자 공개</span>
                      </div>
                    </label>
                  </div>

                  <div className="form-actions">
                    <button className="submit-btn" type="submit">투표 등록</button>
                  </div>
                </form>
              </section>
              <section className="host-vote-result-card">
                <h3>진행중인 투표 ({votes.data?.items?.length || 0})</h3>
                {votes.loading ? (
                  <LoadingCards count={1} />
                ) : votes.data?.items?.length ? (
                  <div className="host-vote-result-list">
                    {(votes.data?.items || []).map((vote) => {
                      const total = vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0);
                      return (
                        <article key={vote.id}>
                          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                              <strong style={{ display: 'block', fontSize: '15px' }}>{vote.title}</strong>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>{vote.allow_multiple ? "복수 선택" : "단일 선택"} · {vote.is_anonymous ? "비공개" : "공개"}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <b style={{ fontSize: '15px' }}>{total}표</b>
                              <button 
                                type="button" 
                                className="delete-vote-btn"
                                onClick={() => handleDeleteVote(vote.id)}
                                title="투표 삭제"
                              >
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </header>
                          <div className="host-vote-result-options">
                            {vote.options.map((option) => {
                              const count = Number(option.response_count || 0);
                              const percent = total ? Math.round((count / total) * 100) : 0;
                              return (
                                <section key={option.id} style={{ marginBottom: '8px' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                                    <span>{option.text}</span>
                                    <span>{count}표 ({percent}%)</span>
                                  </div>
                                  <div style={{ height: '6px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', background: '#2563eb', width: `${percent}%` }} />
                                  </div>
                                </section>
                              );
                            })}
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : (
                  <p>진행중인 투표가 없습니다.</p>
                )}
              </section>
            </div>
          </section>
        )}

        {activeTab === "notice" && (
          <section className="page-card desktop-host-tab-content-card">
            <div className="section-head"><h2>공지 관리</h2></div>
            <div className="desktop-two-column notice-column" style={{ marginTop: 0 }}>
              <form className="host-notice-desktop-form" onSubmit={submitNotice}>
                <div className="form-group">
                  <label htmlFor="notice-title">제목</label>
                  <input id="notice-title" type="text" required placeholder="공지 제목을 입력하세요" value={notice.title} onChange={(event) => setNotice({ ...notice, title: event.target.value })} />
                </div>
                
                <div className="form-group">
                  <label htmlFor="notice-content">내용</label>
                  <textarea id="notice-content" required placeholder="공지 내용을 입력하세요" value={notice.content} onChange={(event) => setNotice({ ...notice, content: event.target.value })} />
                </div>

                <div className="host-notice-switches-grid">
                  <label className={`switch-card ${notice.is_pinned ? "active" : ""}`}>
                    <input type="checkbox" checked={notice.is_pinned} onChange={(event) => setNotice({ ...notice, is_pinned: event.target.checked })} />
                    <div className="switch-card-content">
                      <strong>상단 고정</strong>
                      <span>공지사항을 목록 최상단에 고정합니다</span>
                    </div>
                  </label>
                </div>

                <div className="form-actions">
                  <button className="submit-btn" type="submit">
                    <Megaphone size={15} /> 공지 등록
                  </button>
                </div>
              </form>
              <div className="desktop-host-notice-list-container">
                <h3>등록된 공지 ({noticeItems.length})</h3>
                {noticesLoading ? (
                  <LoadingCards count={1} />
                ) : noticeItems.length ? (
                  noticeItems.map((item) => (
                    <article key={item.id}>
                      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <strong style={{ fontSize: '15px', color: '#1e293b' }}>{item.title}</strong>
                        <button 
                          type="button" 
                          className="delete-notice-btn"
                          onClick={() => handleDeleteNotice(item.id)}
                          title="공지 삭제"
                        >
                          <Trash2 size={15} />
                        </button>
                      </header>
                      <p style={{ margin: 0, color: '#475569', fontSize: '13.5px', lineHeight: '1.5' }}>{item.content}</p>
                    </article>
                  ))
                ) : (
                  <p>등록된 공지가 없습니다.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {/* 모임 취소 구역 */}
        <section className="page-card desktop-host-danger-card">
          <div className="desktop-host-danger-zone">
            <button
              type="button"
              className={meeting.status === "open" ? "btn-close" : "btn-start"}
              onClick={toggleMeetingStatus}
            >
              {meeting.status === "open" ? "모집종료" : "모집시작"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HostMeetingManagePage;
