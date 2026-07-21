import { useState } from "react";
import Button from "../../common/Button.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";

function parseMeetingDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isMeetingOperationEnded(meeting, now = new Date()) {
  if (!meeting) return false;
  if (meeting.meeting_type === "regular") {
    if (meeting.next_session) return false;
    const endAt = parseMeetingDate(meeting.end_at);
    return Boolean(endAt && now >= endAt);
  }
  const endAt = parseMeetingDate(meeting.end_at || meeting.start_at);
  return Boolean(endAt && now >= endAt);
}

function formatParticipantDate(value) {
  const date = parseMeetingDate(value);
  if (!date) return "기록 없음";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function requestErrorMessage(error, fallback) {
  return error?.response?.data?.message || error?.message || fallback;
}

function DesktopHostParticipantManager({ meetingId, meeting: meetingProp = null, onMeetingUpdated, embedded = false }) {
  const [activeTab, setActiveTab] = useState("pending");
  const [refreshKey, setRefreshKey] = useState(0);
  const [meetingRefreshKey, setMeetingRefreshKey] = useState(0);
  const [decidingUserId, setDecidingUserId] = useState(null);
  const [kickingUserId, setKickingUserId] = useState(null);
  const [message, setMessage] = useState({ text: "", tone: "notice" });

  const detail = useAsync(
    () => meetingProp ? Promise.resolve({ meeting: meetingProp }) : meetingApi.detail(meetingId),
    [meetingId, meetingProp, meetingRefreshKey]
  );
  const applicants = useAsync(() => meetingApi.applicants(meetingId), [meetingId, refreshKey]);
  const members = useAsync(() => meetingApi.getMembers(meetingId), [meetingId, refreshKey]);

  const meeting = meetingProp || detail.data?.meeting;
  const applicantItems = applicants.data?.items || [];
  const memberItems = members.data?.items || [];
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
    if (decidingUserId !== null) return;
    setDecidingUserId(userId);
    setMessage({ text: "", tone: "notice" });
    try {
      if (action === "approve") await meetingApi.approve(meetingId, userId);
      else await meetingApi.reject(meetingId, userId);
      setMessage({ text: action === "approve" ? "참가 신청을 승인했습니다." : "참가 신청을 거절했습니다.", tone: "notice" });
      refreshParticipantData();
    } catch (error) {
      setMessage({ text: requestErrorMessage(error, "참가 신청을 처리하지 못했습니다."), tone: "error" });
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
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="table-user">
                          <img src={item.user.profile_image_url || "/img/test3.png"} alt="" />
                          <span><b>{item.user.nickname}</b><small>승인 대기</small></span>
                        </div>
                      </td>
                      <td className="desktop-host-participant-table__message">{item.join_message || "참여 신청 메시지가 없습니다."}</td>
                      <td>{formatParticipantDate(item.requested_at)}</td>
                      <td>
                        <div className="table-actions">
                          <Button type="button" onClick={() => decideApplicant(item.user.id, "approve")} disabled={isDeciding}>
                            {isDeciding ? "처리 중..." : "승인"}
                          </Button>
                          <Button type="button" variant="danger" onClick={() => decideApplicant(item.user.id, "reject")} disabled={isDeciding}>
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
                      {!isHost && member.can_kick && !kickBlocked ? (
                        <Button type="button" variant="danger" onClick={() => kickMember(member)} disabled={isKicking}>
                          {isKicking ? "처리 중..." : "강퇴"}
                        </Button>
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
    </section>
  );
}

export default DesktopHostParticipantManager;
