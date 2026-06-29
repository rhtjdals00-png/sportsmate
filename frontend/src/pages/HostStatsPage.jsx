import { Activity, BarChart3, Heart, Trophy, UsersRound } from "lucide-react";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";

function HostStatsPage() {
  return (
    <>
      <MobileHeader title="모임 통계" />
      <section className="host-stats-hero">
        <span>방장 리포트</span>
        <h1>이번 달 운영 통계</h1>
        <p>참여 흐름과 인기 종목을 빠르게 확인합니다.</p>
      </section>
      <section className="admin-panel host-stats-grid">
        <div><UsersRound size={20} /><strong>참여율</strong><span>92%</span></div>
        <div><Trophy size={20} /><strong>후기 평점</strong><span>4.8</span></div>
        <div><Heart size={20} /><strong>신청 전환</strong><span>68%</span></div>
        <div><Activity size={20} /><strong>재참여</strong><span>74%</span></div>
      </section>
      <section className="detail-card host-stats-chart">
        <h2>인기 종목</h2>
        <article><span>러닝</span><meter min="0" max="100" value="52">52%</meter><em>52%</em></article>
        <article><span>풋살</span><meter min="0" max="100" value="20">20%</meter><em>20%</em></article>
        <article><span>등산</span><meter min="0" max="100" value="15">15%</meter><em>15%</em></article>
        <article><span>배드민턴</span><meter min="0" max="100" value="13">13%</meter><em>13%</em></article>
      </section>
      <section className="detail-card host-stats-chart">
        <h2>평점 추이</h2>
        <div className="mini-line-chart" aria-hidden="true">
          <BarChart3 size={22} />
          <span style={{ height: "36%" }} />
          <span style={{ height: "48%" }} />
          <span style={{ height: "62%" }} />
          <span style={{ height: "72%" }} />
          <span style={{ height: "84%" }} />
        </div>
      </section>
    </>
  );
}

export default HostStatsPage;
