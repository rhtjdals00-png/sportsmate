import MeetingCard from "../components/meeting/shared/MeetingCard.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import DesktopMyMeetings from "../components/profile/desktop/DesktopMyMeetings.jsx";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import { userApi } from "../api/userApi";

function MyMeetingsPage() {
  const { isMobile } = useResponsive();
  const meetings = useAsync(() => userApi.myMeetings(), []);

  if (!isMobile) return <DesktopMyMeetings />;

  return (
    <>
      <MobileHeader title="내 모임" />
      {meetings.loading ? (
        <LoadingCards />
      ) : (
        <div className="my-meetings">
          <section className="section">
            <div className="section-title"><h2>내가 만든 모임</h2></div>
            {meetings.data?.hosted?.length ? (
              <div className="card-list">{meetings.data.hosted.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <EmptyState title="만든 모임이 없습니다." actionLabel="모임 만들기" actionTo="/meetings/create" />
            )}
          </section>
          <section className="section">
            <div className="section-title"><h2>참여 중인 모임</h2></div>
            {meetings.data?.joined?.length ? (
              <div className="card-list">{meetings.data.joined.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <EmptyState title="참여 중인 모임이 없습니다." actionLabel="모임 찾기" actionTo="/meetings" />
            )}
          </section>
          <section className="section">
            <div className="section-title"><h2>승인 대기 모임</h2></div>
            {meetings.data?.pending?.length ? (
              <div className="card-list">{meetings.data.pending.map((meeting) => <MeetingCard key={meeting.id} meeting={meeting} compact />)}</div>
            ) : (
              <p className="subtle-text">승인 대기 중인 모임이 없습니다.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}

export default MyMeetingsPage;
