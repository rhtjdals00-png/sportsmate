import { useState } from "react";
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
  const [hideClosed, setHideClosed] = useState(false);
  const meetings = useAsync(() => userApi.myMeetings(), []);
  const activeTab = params.get("tab") || "all";
  const tabs = [
    { id: "all", label: "전체" },
    { id: "hosted", label: "내가 만든 모임" },
    { id: "joined", label: "참여 중" },
    { id: "pending", label: "승인 대기" },
    { id: "closed", label: "모집 종료" }
  ];

  const setTab = (tab) => {
    const next = new URLSearchParams(params);
    if (tab === "all") next.delete("tab");
    else next.set("tab", tab);
    setParams(next);
  };

  if (!isMobile) return <DesktopMyMeetings />;

  const now = new Date();
  const isMeetingClosed = (meeting) =>
    meeting.status === "closed" || meeting.status === "cancelled" || new Date(meeting.start_at) < now;

  const allHosted = meetings.data?.hosted || [];
  const allJoined = meetings.data?.joined || [];
  const pending = meetings.data?.pending || [];

  const hosted = allHosted.filter((m) => !isMeetingClosed(m));
  const joined = allJoined.filter((m) => !isMeetingClosed(m));
  
  const closedHosted = allHosted.filter((m) => isMeetingClosed(m)).sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  const closedJoined = allJoined.filter((m) => isMeetingClosed(m)).sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

  const closed = [
    ...allHosted.filter(isMeetingClosed),
    ...allJoined.filter(isMeetingClosed)
  ].sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

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
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>내가 만든 모임</h2>
              {activeTab === "hosted" && (
                <label style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
                  마감 숨기기
                </label>
              )}
            </div>
            {hosted.length === 0 && (
              <EmptyState title="진행 중인 만든 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
            )}
            {hosted.length > 0 && (
              <div className="card-list">
                {hosted.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
              </div>
            )}
            {!hideClosed && closedHosted.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#64748b', marginBottom: '12px', paddingLeft: '4px' }}>모집 종료된 모임</h3>
                <div className="card-list">
                  {closedHosted.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
                </div>
              </div>
            )}
          </section>}
          {(activeTab === "all" || activeTab === "joined") && <section className="section">
            <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>참여 중인 모임</h2>
              {activeTab === "joined" && (
                <label style={{ fontSize: '13px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <input type="checkbox" checked={hideClosed} onChange={(e) => setHideClosed(e.target.checked)} />
                  마감 숨기기
                </label>
              )}
            </div>
            {joined.length === 0 && (
              <EmptyState title="진행 중인 참여 모임이 없습니다." actionLabel="모임 찾기" actionTo="/meetings" />
            )}
            {joined.length > 0 && (
              <div className="card-list">
                {joined.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
              </div>
            )}
            {!hideClosed && closedJoined.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#64748b', marginBottom: '12px', paddingLeft: '4px' }}>모집 종료된 모임</h3>
                <div className="card-list">
                  {closedJoined.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
                </div>
              </div>
            )}
          </section>}
          {(activeTab === "all" || activeTab === "pending") && <section className="section">
            <div className="section-title"><h2>승인 대기 모임</h2></div>
            {pending.length ? (
              <div className="card-list">{pending.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <p className="subtle-text">승인 대기 중인 모임이 없습니다.</p>
            )}
          </section>}
          {(activeTab === "all" || activeTab === "closed") && <section className="section">
            <div className="section-title"><h2>모집 종료된 모임</h2></div>
            {closed.length ? (
              <div className="card-list">{closed.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <p className="subtle-text">모집 종료된 모임이 없습니다.</p>
            )}
          </section>}
        </div>
      )}
    </>
  );
}

export default MyMeetingsPage;
