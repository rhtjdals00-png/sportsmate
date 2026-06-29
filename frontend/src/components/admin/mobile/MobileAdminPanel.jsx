import { Link } from "react-router-dom";
import { Activity, AlertTriangle, BarChart3, CalendarDays, ChevronRight, CircleDollarSign, Dumbbell, Gavel, Search, ShieldCheck, Trophy, UserRound, UsersRound } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

const summaryItems = [
  { label: "총 회원수", value: "12,450", icon: UsersRound, tone: "blue" },
  { label: "활성 모임", value: "342", icon: Dumbbell, tone: "indigo" },
  { label: "신고 대기", value: "18", icon: AlertTriangle, tone: "amber" },
  { label: "월간 수익", value: "₩12.4M", icon: CircleDollarSign, tone: "green" }
];

const categoryItems = [
  { label: "축구", value: "42%", trend: "+12%", icon: Trophy },
  { label: "테니스", value: "28%", trend: "+15%", icon: Activity },
  { label: "러닝", value: "18%", trend: "+8%", icon: BarChart3 }
];

function MobileAdminPanel({ title = "관리자 관리" }) {
  return (
    <>
      <MobileHeader title={title} />
      <section className="mobile-admin-hero">
        <span>SPORTSMATE ADMIN</span>
        <h1>{title}</h1>
        <p>회원, 모임, 신고, 종목별 지표를 모바일에서도 빠르게 확인합니다.</p>
      </section>

      <section className="mobile-admin-grid">
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article className={`mobile-admin-stat mobile-admin-stat--${item.tone}`} key={item.label}>
              <Icon size={20} />
              <span>{item.label}</span>
              <strong>{item.value}</strong>
            </article>
          );
        })}
      </section>

      <section className="detail-card mobile-admin-menu">
        <h2>관리 메뉴</h2>
        <Link to="/admin/users"><UserRound size={18} />회원 관리<ChevronRight size={17} /></Link>
        <Link to="/admin/meetings"><Dumbbell size={18} />모임 관리<ChevronRight size={17} /></Link>
        <Link to="/admin/reports"><Gavel size={18} />신고 관리<em>18건</em><ChevronRight size={17} /></Link>
        <Link to="/admin"><ShieldCheck size={18} />운영 대시보드<ChevronRight size={17} /></Link>
      </section>

      <section className="detail-card mobile-admin-chart">
        <div className="section-title">
          <h2>종목별 통계</h2>
          <Search size={18} />
        </div>
        {categoryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label}>
              <div>
                <Icon size={18} />
                <strong>{item.label}</strong>
                <span>{item.trend}</span>
              </div>
              <meter min="0" max="100" value={Number(item.value.replace("%", ""))}>{item.value}</meter>
              <em>{item.value}</em>
            </article>
          );
        })}
      </section>

      <section className="detail-card mobile-admin-activity">
        <h2>최근 활동 및 알림</h2>
        <article>
          <AlertTriangle size={18} />
          <div>
            <strong>[신고 접수] 부적절한 언어 사용</strong>
            <p>초보자 환영 풋살 모임 채팅방</p>
          </div>
        </article>
        <article>
          <CalendarDays size={18} />
          <div>
            <strong>신규 모임 12건 생성</strong>
            <p>최근 24시간 기준</p>
          </div>
        </article>
      </section>
    </>
  );
}

export default MobileAdminPanel;
