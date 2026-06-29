import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../../common/Button.jsx";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatExerciseLevel } from "../../../utils/formatters";

function DesktopHostApplicants() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const applicants = useAsync(() => meetingApi.applicants(meetingId), [meetingId, refreshKey]);

  const decide = async (userId, action) => {
    if (action === "approve") await meetingApi.approve(meetingId, userId);
    else await meetingApi.reject(meetingId, userId);
    setRefreshKey((value) => value + 1);
  };

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>참가자 관리</h1>
          <span>신청자 승인/거절 후 채팅방으로 초대하는 흐름입니다.</span>
        </div>
      </div>
      <section className="page-card">
        <div className="filter-bar">
          <button className="tab-on" type="button">전체</button>
          <button type="button">승인 대기</button>
          <button type="button">참여자</button>
          <input placeholder="이름 검색" />
        </div>
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
                      <Button type="button" onClick={() => decide(item.user.id, "approve")}>승인</Button>
                      <Button type="button" variant="danger" onClick={() => decide(item.user.id, "reject")}>거절</Button>
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
    </div>
  );
}

export default DesktopHostApplicants;
