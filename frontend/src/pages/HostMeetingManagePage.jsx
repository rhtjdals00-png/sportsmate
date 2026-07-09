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
  Trash2
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

function DesktopHostMeetingManage({ meeting, notice, noticeItems, noticesLoading, setNotice, submitNotice, cancelMeeting }) {
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

  const submitEdit = async (e) => {
    e.preventDefault();
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

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>방장 관리</h1>
          <span>모임 정보와 운영 메뉴, 공지 내용을 한 화면에서 편리하게 관리합니다.</span>
        </div>
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
            <span className="host-status-pill">모집중</span>
            <h2>{meeting.title}</h2>
            <div className="desktop-host-meeting-details-grid">
              <p><CalendarDays size={15} />{formatMeetingDate(meetingDate)}</p>
              <p><MapPin size={15} />{place}</p>
              <p><Users size={15} />참여 인원: {current} / {max}명</p>
            </div>
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
            <form className="review-form desktop-host-edit-form" onSubmit={submitEdit}>
              <div className="form-row-2">
                <label>
                  종목
                  <select value={editForm.sport_id} onChange={(e) => setEditForm({ ...editForm, sport_id: e.target.value })}>
                    {(sports.data?.items || []).map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label>정원 (2~{maxLimit}명)<input type="number" min="2" max={maxLimit} value={editForm.max_participants} onChange={(e) => setEditForm({ ...editForm, max_participants: e.target.value })} /></label>
              </div>
              <label>제목<input required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} /></label>
              <label>설명<textarea required value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} /></label>
              <label>모집 목적<input value={editForm.purpose} onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })} /></label>
              <div className="form-row-2">
                <label>장소명<input required value={editForm.location_name} onChange={(e) => setEditForm({ ...editForm, location_name: e.target.value })} /></label>
                <label>주소<input required value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} /></label>
              </div>
              <div className="form-row-2">
                <label>시작 시간<input required type="datetime-local" value={editForm.start_at} onChange={(e) => setEditForm({ ...editForm, start_at: e.target.value })} /></label>
                <label>종료 시간<input type="datetime-local" value={editForm.end_at} onChange={(e) => setEditForm({ ...editForm, end_at: e.target.value })} /></label>
              </div>
              <button className="primary-small" type="submit">수정 완료</button>
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
            <div className="desktop-two-column" style={{ marginTop: 0 }}>
              <section className="host-vote-desktop-card" style={{ padding: 0, border: 0, boxShadow: 'none' }}>
                <h3>새 투표 만들기</h3>
                <form className="review-form host-vote-desktop-form" onSubmit={submitVote}>
                  <label>제목<input required value={voteForm.title} onChange={(event) => setVoteForm({ ...voteForm, title: event.target.value })} /></label>
                  <div className="host-vote-option-grid">
                    {voteForm.options.map((option, index) => (
                      <label key={index}>선택지 {index + 1}<input required value={option} onChange={(event) => updateVoteOption(index, event.target.value)} /></label>
                    ))}
                  </div>
                  <button className="ghost-btn" style={{ marginBottom: 12 }} type="button" onClick={() => setVoteForm((current) => ({ ...current, options: [...current.options, ""] }))}>선택지 추가</button>
                  <label>투표 종료일자<input type="datetime-local" value={voteForm.ends_at} onChange={(event) => setVoteForm({ ...voteForm, ends_at: event.target.value })} /></label>
                  <div className="host-vote-desktop-switches">
                    <label><input type="checkbox" checked={voteForm.allow_multiple} onChange={(event) => setVoteForm({ ...voteForm, allow_multiple: event.target.checked })} /> 복수 선택 허용</label>
                    <label><input type="checkbox" checked={!voteForm.is_anonymous} onChange={(event) => setVoteForm({ ...voteForm, is_anonymous: !event.target.checked })} /> 공개 투표</label>
                  </div>
                  <Button type="submit">투표 등록</Button>
                </form>
              </section>
              <section className="host-vote-result-card" style={{ padding: 0, border: 0, boxShadow: 'none' }}>
                <h3>진행중인 투표 ({votes.data?.items?.length || 0})</h3>
                {votes.loading ? (
                  <LoadingCards count={1} />
                ) : votes.data?.items?.length ? (
                  <div className="host-vote-result-list">
                    {(votes.data?.items || []).map((vote) => {
                      const total = vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0);
                      return (
                        <article key={vote.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px', marginBottom: '14px' }}>
                          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <div>
                              <strong style={{ display: 'block', fontSize: '15px' }}>{vote.title}</strong>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>{vote.allow_multiple ? "복수 선택" : "단일 선택"} · {vote.is_anonymous ? "비공개" : "공개"}</span>
                            </div>
                            <b>{total}표</b>
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
        )}

        {/* 모임 취소 구역 */}
        <section className="page-card desktop-host-danger-card">
          <div className="desktop-host-danger-zone">
            <button type="button" onClick={cancelMeeting}>모집종료</button>
          </div>
        </section>
      </div>
    </div>
  );
}

export default HostMeetingManagePage;
