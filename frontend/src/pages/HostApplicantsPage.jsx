import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";
import { formatExerciseLevel } from "../utils/formatters";

function HostApplicantsPage() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const applicants = useAsync(() => meetingApi.applicants(meetingId), [meetingId, refreshKey]);

  const decide = async (userId, action) => {
    if (action === "approve") await meetingApi.approve(meetingId, userId);
    else await meetingApi.reject(meetingId, userId);
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <MobileHeader title="신청자 관리" />
      {applicants.loading ? (
        <LoadingCards count={2} />
      ) : applicants.data?.items?.length ? (
        <div className="applicant-list">
          {applicants.data.items.map((item) => (
            <article className="applicant-card" key={item.id}>
              <div>
                <div className="applicant-card__header">
                  <img src={item.user.profile_image_url || "/images/logo.png"} alt="" />
                  <div>
                    <strong>{item.user.nickname}</strong>
                    <span>승인 대기</span>
                  </div>
                </div>
                <div className="applicant-card__chips">
                  <span>{item.user.profile?.region || "지역 미설정"}</span>
                  <span>{formatExerciseLevel(item.user.profile?.exercise_level)}</span>
                  <span>{item.user.profile?.preferred_sports || "선호 종목 미설정"}</span>
                </div>
                <p>{item.join_message || "참여 신청 메시지가 없습니다."}</p>
              </div>
              <div className="applicant-card__actions">
                <Button type="button" onClick={() => decide(item.user.id, "approve")}>승인</Button>
                <Button type="button" variant="danger" onClick={() => decide(item.user.id, "reject")}>거절</Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="대기 중인 신청자가 없습니다." description="새 참여 신청이 들어오면 이곳에서 승인하거나 거절할 수 있습니다." />
      )}
    </>
  );
}

export default HostApplicantsPage;
