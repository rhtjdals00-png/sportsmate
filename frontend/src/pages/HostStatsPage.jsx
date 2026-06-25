import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";

function HostStatsPage() {
  return (
    <>
      <MobileHeader title="모임 통계" />
      <section className="admin-panel">
        <div><strong>참여율</strong><span>92%</span></div>
        <div><strong>후기 평점</strong><span>4.8</span></div>
        <div><strong>신청 전환</strong><span>68%</span></div>
      </section>
    </>
  );
}

export default HostStatsPage;
