import { useState } from "react";
import { CalendarCheck, MapPin, Star, Trophy, X } from "lucide-react";
import Button from "../../common/Button.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatExerciseLevel } from "../../../utils/formatters";

function parseMeetingDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function oneTimeOperationEndAt(meeting) {
  const explicitEnd = parseMeetingDate(meeting?.end_at);
  if (explicitEnd) return explicitEnd;
  const fallbackEnd = parseMeetingDate(meeting?.start_at);
  if (!fallbackEnd) return null;
  fallbackEnd.setHours(23, 59, 59, 999);
  return fallbackEnd;
}

function isMeetingOperationEnded(meeting, now = new Date()) {
  if (!meeting) return false;
  if (meeting.meeting_type === "regular") {
    if (meeting.next_session) return false;
    const endAt = parseMeetingDate(meeting.end_at);
    return Boolean(endAt && now >= endAt);
  }
  const endAt = oneTimeOperationEndAt(meeting);
  return Boolean(endAt && now >= endAt);
}

function formatParticipantDate(value) {
  const date = parseMeetingDate(value);
  if (!date) return "기록 없음";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
  });
}

function requestErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function DesktopHostParticipantManager({ meetingId, meeting: meetingProp = null, onMeetingUpdated, onHostTransferred, embedded = false }) {
  const [activeTab, setActiveTab] = useState("pending");
  const [refreshKey, setRefreshKey] = useState(0);
  const [meetingRefreshKey, setMeetingRefreshKey] = useState(0);
  const [decidingUserId, setDecidingUserId] = useState(null);
  const [kickingUserId, setKickingUserId] = useState(null);
  const [transferringUserId, setTransferringUserId] = useState(null);
  const [message, setMessage] = useState({ text: "", tone: "notice" });
  const [selectedApplicant, setSelectedApplicant] = useState(null);

  const detail = useAsync(
    () => meetingProp ? Promise.resolve({ meeting: meetingProp }) : meetingApi.detail(meetingId),
    [meetingId, meetingProp, meetingRefreshKey]
  );
  const applicants = useAsync(() => meetingApi.applicants(meetingId), [meetingId, refreshKey]);
  const members = useAsync(() => meetingApi.getMembers(meetingId), [meetingId, refreshKey]);

  const meeting = meetingProp || detail.data?.meeting;
  const applicantItems = applicants.data?.items || [];
  const memberItems = members.data?.items || [];
  const capacityFull = Boolean(meeting) && (
    meeting.status === "full"
    || Number(meeting.current_participants || 0) >= Number(meeting.max_participants || 0)
  );
  const kickBlocked = !meeting
    || meeting.status === "cancelled"
    || meeting.status === "suspended"
    || isMeetingOperationEnded(meeting);

  const refreshParticipantData = () => {
    setRefreshKey((value) => value + 1);
    if (meetingProp) onMeetingUpdated?.();
    else setMeetingRefreshKey((value) => value + 1);
  };

  const decideApplicant = async (userId, action) => {
    if (decidingUserId !== null || (action === "approve" && capacityFull)) return;
    setDecidingUserId(userId);
    setMessage({ text: "", tone: "notice" });
    try {
      if (action === "approve") await meetingApi.approve(meetingId, userId);
      else await meetingApi.reject(meetingId, userId);
      setMessage({ text: action === "approve" ? "참가 신청을 승인했습니다." : "참가 신청을 거절했습니다.", tone: "notice" });
      setSelectedApplicant(null);
      refreshParticipantData();
    } catch (error) {
      setMessage({ text: requestErrorMessage(error, "참가 신청을 처리하지 못했습니다."), tone: "error" });
      if (error?.response?.data?.code === "PARTICIPANT_APPROVAL_CAPACITY_FULL") {
        refreshParticipantData();
      }
    } finally {
      setDecidingUserId(null);
    }
  };

  const kickMember = async (member) => {
    if (kickingUserId !== null || !member?.can_kick || kickBlocked) return;
    const nickname = member.user?.nickname || "참가자";
    const confirmed = window.confirm(
      `${nickname}님을 모임에서 내보내시겠습니까?\n강퇴된 사용자는 다시 참가 신청할 수 없습니다.`
    );
    if (!confirmed) return;

    setKickingUserId(member.user_id);
    setMessage({ text: "", tone: "notice" });
    try {
      await meetingApi.kickMember(meetingId, member.user_id);
      setMessage({ text: `${nickname}님을 모임에서 내보냈습니다.`, tone: "notice" });
      refreshParticipantData();
    } catch (error) {
      setMessage({ text: requestErrorMessage(error, "참가자를 내보내지 못했습니다."), tone: "error" });
    } finally {
      setKickingUserId(null);
    }
  };

  const transferHost = async (member) => {
    if (transferringUserId !== null || !member?.can_transfer_host || kickBlocked) return;
    const nickname = member.user?.nickname || "참가자";
    const confirmed = window.confirm(
      `${nickname}님에게 방장 권한을 위임하시겠습니까?\n\n위임 즉시 현재 방장은 일반 참가자로 변경되며, 이 관리 페이지에 더 이상 접근할 수 없습니다.`
    );
    if (!confirmed) return;

    setTransferringUserId(member.user_id);
    setMessage({ text: "", tone: "notice" });
    try {
      const result = await meetingApi.transferHost(meetingId, member.user_id);
      window.alert(`${result.new_host?.nickname || nickname}님에게 방장 권한을 위임했습니다.`);
      if (onHostTransferred) onHostTransferred(result);
      else window.location.assign(`/meetings/${meetingId}`);
    } catch (error) {
      setMessage({ text: requestErrorMessage(error, "방장 권한을 위임하지 못했습니다."), tone: "error" });
      setTransferringUserId(null);
    }
  };

  const activeRequest = activeTab === "pending" ? applicants : members;

  return (
    <section className={`page-card desktop-host-participant-manager${embedded ? " desktop-host-tab-content-card" : ""}`}>
      <div className="desktop-host-participant-manager__head">
        <div>
          <h2>참가자 관리</h2>
          <p>참가 신청을 검토하고 현재 참가자를 관리합니다.</p>
        </div>
        <div className="desktop-host-participant-tabs" role="tablist" aria-label="참가자 관리 분류">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "pending"}
            className={activeTab === "pending" ? "is-active" : ""}
            onClick={() => setActiveTab("pending")}
          >
            승인 대기 <span>{applicantItems.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "members"}
            className={activeTab === "members" ? "is-active" : ""}
            onClick={() => setActiveTab("members")}
          >
            참가자 목록 <span>{memberItems.length}</span>
          </button>
        </div>
      </div>

      {message.text ? <p className={`desktop-host-participant-manager__message is-${message.tone}`}>{message.text}</p> : null}
      {capacityFull ? (
        <p className="desktop-host-participant-manager__message is-capacity-full">
          모임 정원이 모두 찼습니다. 자리가 생기면 대기 중인 신청자를 승인할 수 있습니다.
        </p>
      ) : null}
      {activeRequest.error ? (
        <p className="desktop-host-participant-manager__message is-error">
          {requestErrorMessage(activeRequest.error, "참가자 정보를 불러오지 못했습니다.")}
        </p>
      ) : null}

      {activeRequest.loading ? (
        <LoadingCards count={2} />
      ) : activeTab === "pending" ? (
        applicantItems.length ? (
          <div className="desktop-host-participant-table-wrap">
            <table className="flow-table desktop-host-participant-table">
              <thead>
                <tr>
                  <th>신청자</th>
                  <th>신청 메시지</th>
                  <th>신청 시간</th>
                  <th>관리</th>
                </tr>
              </thead>
              <tbody>
                {applicantItems.map((item) => {
                  const isDeciding = decidingUserId === item.user.id;
                  const decisionInProgress = decidingUserId !== null;
                  return (
                    <tr key={item.id}>
                      <td>
                        <button
                          type="button"
                          className="table-user desktop-host-applicant-profile-button"
                          onClick={() => setSelectedApplicant(item)}
                          aria-label={`${item.user.nickname}님의 프로필 보기`}
                        >
                          <img src={item.user.profile_image_url || "/img/test3.png"} alt="" />
                          <span><b>{item.user.nickname}</b><small>프로필 보기</small></span>
                        </button>
                      </td>
                      <td className="desktop-host-participant-table__message">{item.join_message || "참여 신청 메시지가 없습니다."}</td>
                      <td>{formatParticipantDate(item.requested_at)}</td>
                      <td>
                        <div className="table-actions">
                          <Button
                            type="button"
                            onClick={() => decideApplicant(item.user.id, "approve")}
                            disabled={decisionInProgress || capacityFull}
                            title={capacityFull ? "모임 정원이 모두 찼습니다." : undefined}
                          >
                            {isDeciding ? "처리 중..." : capacityFull ? "정원 마감" : "승인"}
                          </Button>
                          <Button type="button" variant="danger" onClick={() => decideApplicant(item.user.id, "reject")} disabled={decisionInProgress}>
                            거절
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="대기 중인 신청자가 없습니다." description="새 참여 신청이 들어오면 이곳에서 승인하거나 거절할 수 있습니다." />
        )
      ) : memberItems.length ? (
        <div className="desktop-host-participant-table-wrap">
          <table className="flow-table desktop-host-participant-table">
            <thead>
              <tr>
                <th>참가자</th>
                <th>역할</th>
                <th>승인일</th>
                <th>관리</th>
              </tr>
            </thead>
            <tbody>
              {memberItems.map((member) => {
                const isHost = member.is_host || member.role === "host";
                const isKicking = kickingUserId === member.user_id;
                const isTransferring = transferringUserId === member.user_id;
                return (
                  <tr key={member.id}>
                    <td>
                      <div className="table-user">
                        <img src={member.user?.profile_image_url || "/img/test3.png"} alt="" />
                        <span><b>{member.user?.nickname || "참가자"}</b><small>현재 참가 중</small></span>
                      </div>
                    </td>
                    <td><span className={`desktop-host-participant-role is-${isHost ? "host" : "member"}`}>{isHost ? "방장" : "참가자"}</span></td>
                    <td>{formatParticipantDate(member.approved_at)}</td>
                    <td>
                      {!isHost && !kickBlocked ? (
                        <div className="desktop-host-member-actions">
                          {member.can_transfer_host ? (
                            <Button type="button" className="desktop-host-transfer-action" onClick={() => transferHost(member)} disabled={transferringUserId !== null || kickingUserId !== null}>
                              {isTransferring ? "위임 중..." : "방장 위임"}
                            </Button>
                          ) : null}
                          {member.can_kick ? (
                            <Button type="button" variant="danger" onClick={() => kickMember(member)} disabled={isKicking || transferringUserId !== null}>
                              {isKicking ? "처리 중..." : "강퇴"}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title="참가자 정보를 불러올 수 없습니다." description="모임 참가자 정보를 다시 확인해 주세요." />
      )}
      {selectedApplicant ? (
        <div
          className="desktop-applicant-profile-backdrop"
          role="presentation"
          onMouseDown={(event) => event.target === event.currentTarget && setSelectedApplicant(null)}
        >
          <section className="desktop-applicant-profile-modal" role="dialog" aria-modal="true" aria-labelledby="applicant-profile-title">
            <button className="desktop-applicant-profile-modal__close" type="button" onClick={() => setSelectedApplicant(null)} aria-label="닫기">
              <X size={18} />
            </button>
            <header className="desktop-applicant-profile-modal__header">
              <img src={selectedApplicant.user.profile_image_url || "/images/logo.png"} alt="" />
              <div>
                <span>참가 신청자</span>
                <h2 id="applicant-profile-title">{selectedApplicant.user.nickname}</h2>
                {selectedApplicant.user.user_tag ? <em>#{selectedApplicant.user.user_tag}</em> : null}
              </div>
            </header>

            <p className={`desktop-applicant-profile-modal__bio${selectedApplicant.user.profile?.bio ? "" : " is-empty"}`}>
              {selectedApplicant.user.profile?.bio || "아직 한 줄 소개가 없습니다."}
            </p>

            <div className="desktop-applicant-profile-modal__stats">
              <article><Star size={17} /><span>평점</span><strong>{Number(selectedApplicant.user.profile?.rating_average || 0).toFixed(1)}</strong></article>
              <article><CalendarCheck size={17} /><span>참여율</span><strong>{Math.round(Number(selectedApplicant.user.profile?.attendance_rate || 0))}%</strong></article>
              <article><Trophy size={17} /><span>누적 참여</span><strong>{selectedApplicant.user.profile?.attendance_count || 0}회</strong></article>
            </div>

            <dl className="desktop-applicant-profile-modal__details">
              <div><dt><MapPin size={15} />선호 지역</dt><dd>{selectedApplicant.user.profile?.region || "미설정"}</dd></div>
              <div><dt>관심 종목</dt><dd>{selectedApplicant.user.profile?.preferred_sports || "미설정"}</dd></div>
              <div><dt>운동 수준</dt><dd>{formatExerciseLevel(selectedApplicant.user.profile?.exercise_level)}</dd></div>
              <div><dt>신청 메시지</dt><dd>{selectedApplicant.join_message || "참여 신청 메시지가 없습니다."}</dd></div>
            </dl>

            <footer className="desktop-applicant-profile-modal__actions">
              <Button type="button" className="desktop-host-applicant-action" onClick={() => decideApplicant(selectedApplicant.user.id, "reject")} disabled={decidingUserId !== null}>거절</Button>
              <Button type="button" className="desktop-host-applicant-action" onClick={() => decideApplicant(selectedApplicant.user.id, "approve")} disabled={decidingUserId !== null}>
                {decidingUserId === selectedApplicant.user.id ? "처리 중..." : "승인"}
              </Button>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default DesktopHostParticipantManager;
