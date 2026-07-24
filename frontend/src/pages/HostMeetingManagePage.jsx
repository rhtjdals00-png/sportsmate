import { useMemo, useState, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Camera,
  CalendarDays,
  CircleAlert,
  CircleCheck,
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
import AttendanceQrPanel from "../components/attendance/AttendanceQrPanel.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import DesktopHostParticipantManager from "../components/host/desktop/DesktopHostParticipantManager.jsx";
import DesktopScheduleCalendarModal, {
  buildDesktopScheduleItems,
  DesktopScheduleCancelModal,
  DesktopScheduleChangeModal,
  getDesktopScheduleInitialDate,
  normalizeDesktopScheduleMeeting
} from "../components/schedule/desktop/DesktopScheduleCalendarModal.jsx";
import { validScheduleDate } from "../components/schedule/desktop/DesktopScheduleCard.jsx";
import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { sportApi } from "../api/sportApi";
import { userApi } from "../api/userApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import {
  attendanceSessionSignature,
  evaluateHostManualAttendance,
} from "../utils/attendancePolicy.js";

function parseMeetingDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatAttendanceSession(session) {
  if (!session?.start_at) return `${session?.session_number || "-"}회차`;
  const date = new Date(session.start_at);
  const dateLabel = date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  });
  const timeLabel = date.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  return `${session.session_number}회차 · ${dateLabel} ${timeLabel}${session.status === "cancelled" ? " · 취소" : ""}`;
}

function getMeetingOperationEndAt(meeting) {
  if (!meeting) return null;
  if (meeting.meeting_type === "one_time") {
    const explicitEnd = parseMeetingDate(meeting.end_at);
    if (explicitEnd) return explicitEnd;
    const fallbackEnd = parseMeetingDate(meeting.start_at);
    if (!fallbackEnd) return null;
    fallbackEnd.setHours(23, 59, 59, 999);
    return fallbackEnd;
  }
  if (meeting.meeting_type === "regular") {
    if (meeting.next_session) return null;
    return parseMeetingDate(meeting.end_at);
  }
  return parseMeetingDate(meeting.end_at) || parseMeetingDate(meeting.start_at);
}

function isMeetingOperationEnded(meeting, now = new Date()) {
  const operationEndAt = getMeetingOperationEndAt(meeting);
  return Boolean(operationEndAt && now >= operationEndAt);
}

function getRecruitmentAction(meeting) {
  if (meeting.status === "open") {
    return { label: "모집종료", className: "btn-close", disabled: false };
  }
  if (meeting.status === "closed") {
    if (isMeetingOperationEnded(meeting)) {
      return {
        label: "운영 종료",
        className: "btn-start",
        disabled: true,
        message: "종료된 모임은 모집을 다시 시작할 수 없습니다."
      };
    }
    return { label: "모집시작", className: "btn-start", disabled: false };
  }
  if (meeting.status === "full") {
    return { label: "모집마감", className: "btn-start", disabled: true };
  }
  if (meeting.status === "cancelled") {
    return {
      label: "취소됨",
      className: "btn-start",
      disabled: true,
      message: "취소된 모임은 모집을 다시 시작할 수 없습니다."
    };
  }
  if (meeting.status === "suspended") {
    return {
      label: "운영중지",
      className: "btn-start",
      disabled: true,
      message: "운영 중지된 모임은 모집을 다시 시작할 수 없습니다."
    };
  }
  return { label: "상태 확인", className: "btn-start", disabled: true };
}

function HostMeetingManagePage() {
  const { isMobile } = useResponsive();
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [notice, setNotice] = useState({ title: "", content: "", is_pinned: true, notice_type: "text", session_id: null });
  const [isDeletingMeeting, setIsDeletingMeeting] = useState(false);
  const [transferringUserId, setTransferringUserId] = useState(null);
  const [transferError, setTransferError] = useState("");
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId, refreshKey]);
  const notices = useAsync(() => meetingApi.notices(meetingId), [meetingId, refreshKey]);
  const mobileMembers = useAsync(
    () => isMobile ? meetingApi.getMembers(meetingId) : Promise.resolve({ items: [] }),
    [isMobile, meetingId, refreshKey]
  );

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
  const transferableMembers = (mobileMembers.data?.items || []).filter((member) => member.can_transfer_host);

  const transferHost = async (member) => {
    if (transferringUserId !== null || !member?.can_transfer_host) return;

    const nickname = member.user?.nickname || "참가자";
    const confirmed = window.confirm(
      `${nickname}님에게 방장 권한을 위임하시겠습니까?\n\n위임 즉시 현재 방장은 일반 참가자로 변경되며, 이 관리 페이지에 더 이상 접근할 수 없습니다.`
    );
    if (!confirmed) return;

    setTransferringUserId(member.user_id);
    setTransferError("");
    try {
      const result = await meetingApi.transferHost(meeting.id, member.user_id);
      window.alert(`${result.new_host?.nickname || nickname}님에게 방장 권한을 위임했습니다.`);
      navigate(`/meetings/${meeting.id}`);
    } catch (error) {
      setTransferError(error?.response?.data?.message || error?.message || "방장 권한을 위임하지 못했습니다.");
      setTransferringUserId(null);
    }
  };

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
    if (!isCurrentlyOpen) {
      const action = getRecruitmentAction(meeting);
      if (action.disabled) {
        alert(action.message || "현재 상태에서는 모집을 다시 시작할 수 없습니다.");
        return;
      }
    }
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
    setNotice({ title: "", content: "", is_pinned: true, notice_type: "text", session_id: null });
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
        onMeetingUpdated={() => setRefreshKey((value) => value + 1)}
        onHostTransferred={() => navigate(`/meetings/${meeting.id}`)}
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
        <section className="detail-card mobile-host-transfer">
          <div className="host-section-head">
            <div>
              <span><ShieldCheck size={15} />방장 위임</span>
              <h2>새 방장을 선택해 주세요</h2>
            </div>
            <strong>{transferableMembers.length}명</strong>
          </div>
          <p className="mobile-host-transfer__description">
            위임하면 현재 방장은 일반 참가자로 변경되고 새 방장이 모임을 관리합니다.
          </p>
          {transferError ? <p className="mobile-host-transfer__message is-error">{transferError}</p> : null}
          {mobileMembers.error ? (
            <p className="mobile-host-transfer__message is-error">
              {mobileMembers.error?.response?.data?.message || "참가자 정보를 불러오지 못했습니다."}
            </p>
          ) : null}
          <div className="mobile-host-transfer__list">
            {transferableMembers.map((member) => {
              const nickname = member.user?.nickname || "참가자";
              const isTransferring = transferringUserId === member.user_id;
              return (
                <article key={member.id || member.user_id} className="mobile-host-transfer__member">
                  <div className="mobile-host-transfer__profile">
                    <span className="mobile-host-transfer__avatar">
                      {member.user?.profile_image_url ? (
                        <img src={member.user.profile_image_url} alt="" />
                      ) : nickname.slice(0, 1)}
                    </span>
                    <span>
                      <b>{nickname}</b>
                      <small>현재 참가 중</small>
                    </span>
                  </div>
                  <Button
                    type="button"
                    onClick={() => transferHost(member)}
                    disabled={transferringUserId !== null}
                  >
                    {isTransferring ? "위임 중..." : "방장 위임"}
                  </Button>
                </article>
              );
            })}
            {!mobileMembers.loading && !mobileMembers.error && transferableMembers.length === 0 ? (
              <p className="mobile-host-transfer__empty">위임할 수 있는 참가자가 없습니다.</p>
            ) : null}
            {mobileMembers.loading ? <p className="mobile-host-transfer__empty">참가자 정보를 불러오는 중...</p> : null}
          </div>
        </section>
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
      hour12: true
    }).format(d);
  } catch {
    return dateStr;
  }
}

function hostMeetingStatusLabel(status) {
  if (status === "open") return "모집중";
  if (status === "full") return "모집마감";
  if (status === "closed") return "모집종료";
  return "모집마감";
}

function hostMeetingStatusClass(status) {
  if (status === "open") return "";
  if (status === "full") return "is-full";
  return "closed";
}

function DesktopHostMeetingManage({ meeting, notice, noticeItems, noticesLoading, setNotice, submitNotice, toggleMeetingStatus, deleteMeeting, isDeletingMeeting, onMeetingUpdated, onHostTransferred }) {
  const [activeTab, setActiveTab] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleAction, setScheduleAction] = useState(null);
  const [scheduleActionError, setScheduleActionError] = useState("");
  const [scheduleActionSubmitting, setScheduleActionSubmitting] = useState(false);
  const [userCalendarData, setUserCalendarData] = useState(null);
  const [userCalendarLoading, setUserCalendarLoading] = useState(false);
  const [userCalendarError, setUserCalendarError] = useState("");
  const calendarRequestRef = useRef(null);
  const fileInputRef = useRef(null);
  const recruitmentAction = getRecruitmentAction(meeting);
  const sessions = useAsync(
    () => meeting.meeting_type === "regular" ? meetingApi.sessions(meeting.id) : Promise.resolve({ items: [] }),
    [meeting.id, meeting.meeting_type, refreshKey]
  );

  const managedMeetingWithSessions = useMemo(() => meeting.meeting_type === "regular"
    ? { ...meeting, sessions: sessions.data?.items || meeting.sessions || [] }
    : meeting, [meeting, sessions.data?.items]);
  const managedCalendarItems = useMemo(() => buildDesktopScheduleItems([
    normalizeDesktopScheduleMeeting(managedMeetingWithSessions, "host")
  ]), [managedMeetingWithSessions]);
  const calendarItems = useMemo(() => {
    const meetingsById = new Map();
    (userCalendarData?.joined || []).forEach((item) => {
      meetingsById.set(String(item.id), { meeting: item, participantStatus: "joined" });
    });
    (userCalendarData?.hosted || []).forEach((item) => {
      meetingsById.set(String(item.id), { meeting: item, participantStatus: "host" });
    });
    meetingsById.set(String(meeting.id), { meeting: managedMeetingWithSessions, participantStatus: "host" });
    return buildDesktopScheduleItems(Array.from(meetingsById.values(), ({ meeting: item, participantStatus }) => (
      normalizeDesktopScheduleMeeting(item, participantStatus)
    )));
  }, [managedMeetingWithSessions, meeting.id, userCalendarData]);
  const calendarInitialDate = useMemo(() => getDesktopScheduleInitialDate(managedCalendarItems), [managedCalendarItems]);

  const loadUserCalendar = async ({ force = false } = {}) => {
    if (!force && userCalendarData) return userCalendarData;
    if (calendarRequestRef.current) {
      const pendingData = await calendarRequestRef.current.catch(() => null);
      if (!force) return pendingData;
    }
    setUserCalendarLoading(true);
    setUserCalendarError("");
    const request = userApi.myCalendar();
    calendarRequestRef.current = request;
    try {
      const data = await request;
      setUserCalendarData(data);
      return data;
    } catch (error) {
      console.error("Failed to load user calendar", error);
      setUserCalendarError("다른 일정을 불러오지 못했습니다.");
      return null;
    } finally {
      if (calendarRequestRef.current === request) {
        calendarRequestRef.current = null;
        setUserCalendarLoading(false);
      }
    }
  };

  const openScheduleCalendar = () => {
    setScheduleOpen(true);
    if (!userCalendarData) loadUserCalendar();
  };

  const closeScheduleAction = () => {
    if (scheduleActionSubmitting) return;
    setScheduleAction(null);
    setScheduleActionError("");
  };

  const handleScheduleChange = async (payload, clientError = "") => {
    if (clientError) return setScheduleActionError(clientError);
    if (!scheduleAction?.item || !payload) return;
    if (String(scheduleAction.item.meetingId ?? scheduleAction.item.id) !== String(meeting.id)) return;
    setScheduleActionSubmitting(true);
    setScheduleActionError("");
    try {
      await meetingApi.updateSession(meeting.id, scheduleAction.item.sessionId, payload);
      setRefreshKey((value) => value + 1);
      onMeetingUpdated?.();
      loadUserCalendar({ force: true });
      setScheduleAction(null);
      alert("일정이 변경되었습니다. 기존 출석 QR은 만료되었으므로 새 QR을 발급해 주세요.");
    } catch (error) {
      setScheduleActionError(error.response?.data?.message || "일정 변경 중 오류가 발생했습니다.");
    } finally {
      setScheduleActionSubmitting(false);
    }
  };

  const handleScheduleCancel = async (payload, clientError = "") => {
    if (clientError) return setScheduleActionError(clientError);
    if (!scheduleAction?.item || !payload?.reason) return;
    if (String(scheduleAction.item.meetingId ?? scheduleAction.item.id) !== String(meeting.id)) return;
    setScheduleActionSubmitting(true);
    setScheduleActionError("");
    try {
      await meetingApi.cancelSession(meeting.id, scheduleAction.item.sessionId, payload.reason);
      setRefreshKey((value) => value + 1);
      onMeetingUpdated?.();
      loadUserCalendar({ force: true });
      setScheduleAction(null);
      alert("일정이 취소되었습니다.");
    } catch (error) {
      setScheduleActionError(error.response?.data?.message || "일정 취소 중 오류가 발생했습니다.");
    } finally {
      setScheduleActionSubmitting(false);
    }
  };

  const resolveCalendarActions = (item) => {
    const isManagedMeeting = String(item.meetingId ?? item.id) === String(meeting.id);
    const actions = [{ key: "detail", label: "상세 보기", to: `/meetings/${item.id}`, tone: "primary" }];
    if (item.chatRoomId) actions.push({ key: "chat", label: "채팅", to: `/chats/${item.chatRoomId}` });
    if (item.isHost) {
      actions.push(isManagedMeeting
        ? { key: "manage", label: "관리 화면", onClick: () => setScheduleOpen(false) }
        : { key: "manage", label: "관리 화면", to: `/host/meetings/${item.id}` });
    }
    const canManageSchedule = isManagedMeeting
      && item.meetingType === "regular"
      && item.sessionId
      && item.sessionStatus === "scheduled"
      && validScheduleDate(item.startAt) > new Date();
    if (canManageSchedule) {
      actions.push({ key: "change", label: "일정 변경", onClick: () => {
        if (String(item.meetingId ?? item.id) !== String(meeting.id)) return;
        setScheduleAction({ type: "change", item });
        setScheduleActionError("");
      } });
      actions.push({ key: "cancel", label: "회차 취소", tone: "danger", onClick: () => {
        if (String(item.meetingId ?? item.id) !== String(meeting.id)) return;
        setScheduleAction({ type: "cancel", item });
        setScheduleActionError("");
      } });
    }
    return actions;
  };

  const scheduleNoticeOptions = useMemo(() => {
    if (meeting.meeting_type === "regular") {
      return (sessions.data?.items || []).filter((item) => item.status !== "cancelled").map((item) => ({
        id: item.id,
        label: formatMeetingDate(item.start_at),
        content: `${meeting.title} 일정 안내\n일시: ${formatMeetingDate(item.start_at)}${meeting.location_name ? `\n장소: ${meeting.location_name}` : ""}`
      }));
    }
    if (!meeting.start_at) return [];
    return [{
      id: null,
      label: formatMeetingDate(meeting.start_at),
      content: `${meeting.title} 일정 안내\n일시: ${formatMeetingDate(meeting.start_at)}${meeting.location_name ? `\n장소: ${meeting.location_name}` : ""}`
    }];
  }, [meeting, sessions.data?.items]);

  const selectNoticeType = (noticeType) => {
    const firstSchedule = scheduleNoticeOptions[0];
    setNotice((current) => ({
      ...current,
      notice_type: noticeType,
      session_id: noticeType === "schedule" ? (firstSchedule?.id ?? null) : null,
      title: noticeType === "schedule" ? "일정 안내" : current.title,
      content: noticeType === "schedule" ? (firstSchedule?.content || current.content) : current.content
    }));
  };

  const selectScheduleNotice = (sessionId) => {
    const selected = scheduleNoticeOptions.find((item) => String(item.id ?? "one-time") === String(sessionId));
    setNotice((current) => ({
      ...current,
      session_id: selected?.id ?? null,
      title: "일정 안내",
      content: selected?.content || current.content
    }));
  };

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
  const [editFeedback, setEditFeedback] = useState(null);
  const [editSubmitting, setEditSubmitting] = useState(false);

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
    if (isTimeInvalid || editSubmitting) return;
    setEditFeedback(null);
    const maxPartCount = Number(editForm.max_participants);
    if (maxPartCount > maxLimit) {
      setEditFeedback({ type: "error", message: `최대 정원은 ${maxLimit}명 이하로만 설정 가능합니다.` });
      return;
    }
    if (maxPartCount < current) {
      setEditFeedback({ type: "error", message: "현재 승인된 참가 인원보다 최대 정원을 작게 설정할 수 없습니다." });
      return;
    }

    setEditSubmitting(true);
    try {
      await meetingApi.update(meeting.id, {
        ...editForm,
        sport_id: Number(editForm.sport_id),
        max_participants: maxPartCount
      });
      setEditFeedback({ type: "success", message: "모임 정보가 수정되었습니다." });
      onMeetingUpdated?.();
    } catch (error) {
      const response = error.response?.data;
      const message = response?.code === "MAX_PARTICIPANTS_BELOW_APPROVED_COUNT"
        ? "현재 승인된 참가 인원보다 최대 정원을 작게 설정할 수 없습니다."
        : response?.message || "모임 정보 수정에 실패했습니다. 다시 시도해 주세요.";
      setEditFeedback({ type: "error", message });
    } finally {
      setEditSubmitting(false);
    }
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
  const [selectedAttendanceSessionId, setSelectedAttendanceSessionId] = useState("");
  const attendance = useAsync(
    () => (activeTab === "attendance"
      ? meetingApi.attendance(meeting.id, selectedAttendanceSessionId ? { session_id: selectedAttendanceSessionId } : {})
      : Promise.resolve(null)),
    [meeting.id, activeTab, refreshKey, selectedAttendanceSessionId]
  );
  const [attendanceUpdatingId, setAttendanceUpdatingId] = useState(null);
  const [attendanceActionError, setAttendanceActionError] = useState("");
  const attendanceStatusByUser = new Map((attendance.data?.items || []).map((item) => [item.user.id, item.status]));
  const activeAttendanceSessionId = selectedAttendanceSessionId || attendance.data?.selected_session?.id || "";
  const manualAttendancePolicy = evaluateHostManualAttendance(attendance.data?.selected_session);
  const checkParticipant = async (userId, status) => {
    if (!activeAttendanceSessionId) {
      alert("출석을 기록할 회차를 선택해 주세요.");
      return;
    }
    setAttendanceActionError("");
    setAttendanceUpdatingId(userId);
    try {
      const latestAttendance = await attendance.execute();
      const latestSession = latestAttendance?.selected_session;
      const latestPolicy = evaluateHostManualAttendance(latestSession);
      if (!latestPolicy.allowed) {
        setAttendanceActionError(latestPolicy.message);
        return;
      }
      await meetingApi.checkAttendance(meeting.id, {
        user_id: userId,
        status,
        session_id: Number(activeAttendanceSessionId),
      });
      setRefreshKey((value) => value + 1);
      alert(status === "present" ? "출석으로 변경되었습니다." : "미출석으로 변경되었습니다.");
    } catch (error) {
      setAttendanceActionError(error.response?.data?.message || "출석 상태를 변경하지 못했습니다.");
    } finally {
      setAttendanceUpdatingId(null);
    }
  };

  // 3. 투표 관리 관련 API 호출
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
            <span className={`host-status-pill ${hostMeetingStatusClass(meeting.status)}`}>
              {hostMeetingStatusLabel(meeting.status)}
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
          <div className="desktop-host-tool-grid-6">
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
              className={`desktop-host-tool-button ${scheduleOpen ? "active" : ""}`}
              onClick={openScheduleCalendar}
            >
              <CalendarDays size={20} />
              <span>일정 관리</span>
            </button>
            <button
              type="button"
              className={`desktop-host-tool-button ${activeTab === "applicants" ? "active" : ""}`}
              onClick={() => handleTabClick("applicants")}
            >
              <UserCheck size={20} />
              <span>참가자 관리</span>
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
                    <input
                      id="max_participants"
                      type="number"
                      min="2"
                      max={maxLimit}
                      value={editForm.max_participants}
                      onChange={(e) => {
                        setEditForm({ ...editForm, max_participants: e.target.value });
                        setEditFeedback(null);
                      }}
                    />
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

              {editFeedback ? (
                <div
                  className={`desktop-host-edit-feedback is-${editFeedback.type}`}
                  role={editFeedback.type === "error" ? "alert" : "status"}
                >
                  {editFeedback.type === "error" ? <CircleAlert size={18} /> : <CircleCheck size={18} />}
                  <span>{editFeedback.message}</span>
                </div>
              ) : null}

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
                <button className="submit-btn" type="submit" disabled={isTimeInvalid || editSubmitting}>{editSubmitting ? "수정 중..." : "수정 완료"}</button>
              </div>
            </form>
          </section>
        )}

        {activeTab === "applicants" && (
          <DesktopHostParticipantManager
            meetingId={meeting.id}
            meeting={meeting}
            onMeetingUpdated={onMeetingUpdated}
            onHostTransferred={onHostTransferred}
            embedded
          />
        )}

        {activeTab === "attendance" && (
          <section className="page-card desktop-host-tab-content-card">
            <div className="section-head">
              <h2>출석 체크 관리</h2>
              {(attendance.data?.sessions?.length || attendance.data?.past_sessions?.length) ? (
                <select
                  className="desktop-attendance-session-select"
                  aria-label="출석 회차 선택"
                  value={activeAttendanceSessionId}
                  onChange={(event) => setSelectedAttendanceSessionId(event.target.value)}
                >
                  {!activeAttendanceSessionId ? <option value="">회차를 선택해 주세요</option> : null}
                  {attendance.data.sessions?.length ? (
                    <optgroup label="이번 주 남은 회차">
                      {attendance.data.sessions.map((session) => (
                        <option key={session.id} value={session.id}>{formatAttendanceSession(session)}</option>
                      ))}
                    </optgroup>
                  ) : null}
                  {attendance.data.past_sessions?.length ? (
                    <optgroup label="지난 회차 수정">
                      {attendance.data.past_sessions.map((session) => (
                        <option key={session.id} value={session.id}>{formatAttendanceSession(session)}</option>
                      ))}
                    </optgroup>
                  ) : null}
                </select>
              ) : null}
            </div>
            {attendance.loading ? (
              <LoadingCards count={2} />
            ) : !attendance.data?.selected_session ? (
              <EmptyState title="출석 회차를 선택해 주세요." description="지난 회차는 수정할 수 있고, 다음 주 회차는 다음 주 월요일부터 열립니다." />
            ) : attendance.data?.approved_participants?.length ? (
              <>
                <AttendanceQrPanel
                  key={attendanceSessionSignature(attendance.data.selected_session)}
                  meetingId={meeting.id}
                  session={attendance.data.selected_session}
                  onRefreshSession={attendance.execute}
                />
                {!manualAttendancePolicy.allowed ? (
                  <p className="attendance-qr-panel__error">{manualAttendancePolicy.message}</p>
                ) : null}
                {attendanceActionError ? (
                  <p className="attendance-qr-panel__error">{attendanceActionError}</p>
                ) : null}
                <div className="attendance-list">
                  {(attendance.data?.approved_participants || []).map((participant) => (
                  <article key={participant.id} className="desktop-attendance-item">
                    <div className="user-info">
                      <img src={participant.user.profile_image_url || "/images/logo.png"} alt="" />
                      <strong>{participant.user.nickname}</strong>
                    </div>
                    <div className="control">
                      <span className={attendanceStatusByUser.get(participant.user.id) === "present" ? "status-badge checked" : "status-badge"}>
                        {attendanceStatusByUser.get(participant.user.id) === "present" ? "출석 완료" : "미출석"}
                      </span>
                      <Button
                        type="button"
                        onClick={() => checkParticipant(
                          participant.user.id,
                          attendanceStatusByUser.get(participant.user.id) === "present" ? "absent" : "present"
                        )}
                        disabled={!activeAttendanceSessionId || !manualAttendancePolicy.allowed || attendanceUpdatingId === participant.user.id}
                      >
                        {attendanceUpdatingId === participant.user.id
                          ? "처리 중"
                          : attendanceStatusByUser.get(participant.user.id) === "present"
                            ? "미출석으로 변경"
                            : "출석 체크"}
                      </Button>
                    </div>
                  </article>
                  ))}
                </div>
              </>
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
                  <label htmlFor="notice-type">공지 유형</label>
                  <select id="notice-type" value={notice.notice_type || "text"} onChange={(event) => selectNoticeType(event.target.value)}>
                    <option value="text">일반 공지</option>
                    <option value="schedule">일정 공지</option>
                  </select>
                </div>
                {notice.notice_type === "schedule" ? (
                  <div className="form-group">
                    <label htmlFor="notice-session">공지할 일정</label>
                    <select id="notice-session" value={notice.session_id ?? "one-time"} onChange={(event) => selectScheduleNotice(event.target.value)} disabled={!scheduleNoticeOptions.length}>
                      {scheduleNoticeOptions.length ? scheduleNoticeOptions.map((item) => (
                        <option key={item.id ?? "one-time"} value={item.id ?? "one-time"}>{item.label}</option>
                      )) : <option value="one-time">등록된 일정이 없습니다.</option>}
                    </select>
                  </div>
                ) : null}
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
              className={recruitmentAction.className}
              disabled={recruitmentAction.disabled}
              onClick={recruitmentAction.disabled ? undefined : toggleMeetingStatus}
              title={recruitmentAction.message || recruitmentAction.label}
            >
              {recruitmentAction.label}
            </button>
          </div>
        </section>
      </div>
      <DesktopScheduleCalendarModal
        isOpen={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        items={calendarItems}
        loading={(meeting.meeting_type === "regular" && sessions.loading) || userCalendarLoading}
        error={sessions.error ? "등록된 일정을 불러오지 못했습니다." : userCalendarError}
        modalTitle="일정 관리"
        calendarTitle="내 운동 일정"
        initialDate={calendarInitialDate}
        managedMeetingId={meeting.id}
        emptyMessage="등록된 일정이 없습니다."
        resolveActions={resolveCalendarActions}
      />
      <DesktopScheduleChangeModal
        item={scheduleAction?.type === "change" ? scheduleAction.item : null}
        submitting={scheduleActionSubmitting}
        error={scheduleAction?.type === "change" ? scheduleActionError : ""}
        onClose={closeScheduleAction}
        onSubmit={handleScheduleChange}
      />
      <DesktopScheduleCancelModal
        item={scheduleAction?.type === "cancel" ? scheduleAction.item : null}
        submitting={scheduleActionSubmitting}
        error={scheduleAction?.type === "cancel" ? scheduleActionError : ""}
        onClose={closeScheduleAction}
        onSubmit={handleScheduleCancel}
      />
    </div>
  );
}

export default HostMeetingManagePage;
