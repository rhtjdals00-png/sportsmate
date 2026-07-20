import { useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MapPin, ShieldQuestion, UserRound, XCircle } from "lucide-react";
import Button from "../../../components/common/Button.jsx";
import EmptyState from "../../../components/common/EmptyState.jsx";
import LoadingCards from "../../../components/common/LoadingCards.jsx";
import MobileHeader from "../../../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatExerciseLevel } from "../../../utils/formatters";

function MobileHostApplicants() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [decidingId, setDecidingId] = useState(null);
  const applicants = useAsync(() => meetingApi.applicants(meetingId), [meetingId, refreshKey]);
  const applicantItems = applicants.data?.items || [];

  const decide = async (userId, action) => {
    setDecidingId(`${userId}-${action}`);
    try {
      if (action === "approve") await meetingApi.approve(meetingId, userId);
      else await meetingApi.reject(meetingId, userId);
      setRefreshKey((value) => value + 1);
    } finally {
      setDecidingId(null);
    }
  };

  return (
    <>
      <MobileHeader title="신청자 관리" />
      <section className="host-applicant-hero">
        <span><ShieldQuestion size={15} />승인 대기</span>
        <h1>{applicantItems.length}명의 신청자가 기다려요</h1>
        <p>프로필 정보와 신청 메시지를 확인한 뒤 참여를 승인하거나 거절합니다.</p>
      </section>
      {applicants.loading ? (
        <LoadingCards count={2} />
      ) : applicantItems.length ? (
        <div className="applicant-list">
          {applicantItems.map((item) => (
            <article className="applicant-card" key={item.id}>
              <div>
                <div className="applicant-card__header">
                  <img src={item.user.profile_image_url || "/images/logo.png"} alt="" />
                  <div>
                    <strong>{item.user.nickname}</strong>
                    <span><UserRound size={12} />승인 대기</span>
                  </div>
                </div>
                <div className="applicant-card__chips">
                  <span><MapPin size={12} />{item.user.profile?.region || "지역 미설정"}</span>
                  <span>{formatExerciseLevel(item.user.profile?.exercise_level)}</span>
                  <span>{item.user.profile?.preferred_sports || "선호 종목 미설정"}</span>
                </div>
                <p>{item.join_message || "참여 신청 메시지가 없습니다."}</p>
              </div>
              <div className="applicant-card__actions">
                <Button type="button" onClick={() => decide(item.user.id, "approve")} disabled={Boolean(decidingId)}><CheckCircle2 size={16} />승인</Button>
                <Button type="button" variant="danger" onClick={() => decide(item.user.id, "reject")} disabled={Boolean(decidingId)}><XCircle size={16} />거절</Button>
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

export default MobileHostApplicants;
