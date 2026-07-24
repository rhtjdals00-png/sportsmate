import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import MobilePullToRefresh from "../components/layout/mobile/MobilePullToRefresh.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import { userApi } from "../api/userApi";
import { Navigate, useSearchParams } from "react-router-dom";
import { isMeetingLifecycleEnded } from "../utils/meetingLifecycle.js";

function MyMeetingsPage() {
  const { isMobile } = useResponsive();
  const [params, setParams] = useSearchParams();
  const [hostedExpanded, setHostedExpanded] = useState(false);
  const [joinedExpanded, setJoinedExpanded] = useState(false);
  const meetings = useAsync(() => userApi.myMeetings(), []);
  const activeTab = params.get("tab") || "all";
  const tabs = [
    { id: "all", label: "전체" },
    { id: "hosted", label: "내가 관리하는 모임" },
    { id: "joined", label: "참여 중" },
    { id: "pending", label: "승인 대기" },
    { id: "completed", label: "종료된 모임" }
  ];

  const setTab = (tab) => {
    const next = new URLSearchParams(params);
    if (tab === "all") next.delete("tab");
    else next.set("tab", tab);
    setParams(next);
  };

  if (!isMobile) return <Navigate to="/mypage" replace />;

  const now = new Date();
  const isMeetingCompleted = (meeting) => {
    if (meeting.status === "completed" || meeting.status === "cancelled") return true;
    let dateToCompare = meeting.end_at || meeting.start_at;
    if (meeting.meeting_type === "regular" && meeting.next_session?.start_at) {
      dateToCompare = meeting.next_session.end_at || meeting.next_session.start_at;
    }
    if (!dateToCompare) return false;
    const meetingEndTime = new Date(dateToCompare);
    if (!meeting.end_at && (!meeting.next_session || !meeting.next_session.end_at)) {
      meetingEndTime.setHours(meetingEndTime.getHours() + 2);
    }
    return meetingEndTime < now;
  };
  const isMeetingClosed = (meeting) => isMeetingLifecycleEnded(meeting);

  const allHosted = meetings.data?.hosted || [];
  const allJoined = meetings.data?.joined || [];
  const pending = meetings.data?.pending || [];

  const hosted = allHosted.filter((m) => !isMeetingCompleted(m));
  const joined = allJoined.filter((m) => !isMeetingCompleted(m));
  
  const closedHosted = allHosted.filter((m) => isMeetingCompleted(m)).sort((a, b) => new Date(b.start_at) - new Date(a.start_at));
  const closedJoined = allJoined.filter((m) => isMeetingCompleted(m)).sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

  const closed = [
    ...allHosted.filter(isMeetingCompleted),
    ...allJoined.filter(isMeetingCompleted)
  ].sort((a, b) => new Date(b.start_at) - new Date(a.start_at));

  return (
    <MobilePullToRefresh onRefresh={async () => { await meetings.execute(); }}>
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
            <div className="section-title">
              <h2>내가 관리하는 모임</h2>
            </div>
            {hosted.length === 0 && (
              <EmptyState title="현재 관리 중인 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
            )}
            {hosted.length > 0 && (
              <div className="card-list">
                {hosted.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
              </div>
            )}
            {activeTab === "hosted" && closedHosted.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <button 
                  type="button" 
                  onClick={() => setHostedExpanded(!hostedExpanded)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', padding: '0 0 12px 4px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#64748b', margin: 0 }}>종료된 모임</h3>
                  {hostedExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </button>
                {hostedExpanded && (
                  <div className="card-list">
                    {closedHosted.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
                  </div>
                )}
              </div>
            )}
          </section>}
          {(activeTab === "all" || activeTab === "joined") && <section className="section">
            <div className="section-title">
              <h2>참여 중인 모임</h2>
            </div>
            {joined.length === 0 && (
              <EmptyState title="진행 중인 참여 모임이 없습니다." actionLabel="모임 찾기" actionTo="/meetings" />
            )}
            {joined.length > 0 && (
              <div className="card-list">
                {joined.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
              </div>
            )}
            {activeTab === "joined" && closedJoined.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <button 
                  type="button" 
                  onClick={() => setJoinedExpanded(!joinedExpanded)}
                  style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', padding: '0 0 12px 4px', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 'bold', color: '#64748b', margin: 0 }}>종료된 모임</h3>
                  {joinedExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                </button>
                {joinedExpanded && (
                  <div className="card-list">
                    {closedJoined.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}
                  </div>
                )}
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
          {activeTab === "completed" && <section className="section">
            <div className="section-title"><h2>종료된 모임</h2></div>
            {closed.length ? (
              <div className="card-list">{closed.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <p className="subtle-text">종료된 모임이 없습니다.</p>
            )}
          </section>}
        </div>
      )}
    </MobilePullToRefresh>
  );
}

export default MyMeetingsPage;
