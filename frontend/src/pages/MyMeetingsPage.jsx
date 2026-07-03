import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import DesktopMyMeetings from "../components/profile/desktop/DesktopMyMeetings.jsx";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import { userApi } from "../api/userApi";
import { useSearchParams } from "react-router-dom";

function MyMeetingsPage() {
  const { isMobile } = useResponsive();
  const [params, setParams] = useSearchParams();
  const meetings = useAsync(() => userApi.myMeetings(), []);
  const activeTab = params.get("tab") || "all";
  const tabs = [
    { id: "all", label: "전체" },
    { id: "hosted", label: "내가 만든 모임" },
    { id: "joined", label: "참여 중" },
    { id: "pending", label: "승인 대기" }
  ];

  const setTab = (tab) => {
    const next = new URLSearchParams(params);
    if (tab === "all") next.delete("tab");
    else next.set("tab", tab);
    setParams(next);
  };

  if (!isMobile) return <DesktopMyMeetings />;

  return (
    <>
      <MobileHeader title="내 모임" />
      {meetings.loading ? (
        <LoadingCards />
      ) : (
        <div className="my-meetings">
          <div className="mobile-tab-strip" role="tablist" aria-label="내 모임 분류">
            {tabs.map((tab) => (
              <button key={tab.id} type="button" className={activeTab === tab.id ? "is-active" : ""} onClick={() => setTab(tab.id)}>
                {tab.label}
              </button>
            ))}
          </div>
          {(activeTab === "all" || activeTab === "hosted") && <section className="section">
            <div className="section-title"><h2>내가 만든 모임</h2></div>
            {meetings.data?.hosted?.length ? (
              <div className="card-list">{meetings.data.hosted.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <EmptyState title="만든 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
            )}
          </section>}
          {(activeTab === "all" || activeTab === "joined") && <section className="section">
            <div className="section-title"><h2>참여 중인 모임</h2></div>
            {meetings.data?.joined?.length ? (
              <div className="card-list">{meetings.data.joined.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <EmptyState title="참여 중인 모임이 없습니다." actionLabel="모임 찾기" actionTo="/meetings" />
            )}
          </section>}
          {(activeTab === "all" || activeTab === "pending") && <section className="section">
            <div className="section-title"><h2>승인 대기 모임</h2></div>
            {meetings.data?.pending?.length ? (
              <div className="card-list">{meetings.data.pending.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <p className="subtle-text">승인 대기 중인 모임이 없습니다.</p>
            )}
          </section>}
        </div>
      )}
    </>
  );
}

export default MyMeetingsPage;
