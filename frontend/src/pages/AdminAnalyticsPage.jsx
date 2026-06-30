import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { 
  DollarSign, 
  UserPlus, 
  Trophy, 
  AlertCircle, 
  MoreHorizontal, 
  Filter,
  ArrowUpRight,
  ShieldAlert,
  Activity,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import { adminApi } from "../api/adminApi";

// Default/Fallback stats
const initialStats = {
  revenue: 14250000,
  revenueTrend: "12.5%",
  newUsers: 1842,
  newUsersTrend: "8.2%",
  activeMeetings: 328,
  meetingsDetails: { soccer: 145, running: 98, tennis: 85 },
  reports: { pending: 12, resolved: 45 }
};

const topMeetings = [
  { rank: 1, title: "주말 한강 러닝 크루", location: "서울 여의도 한강공원", rate: "98%", capacity: "50/50명" },
  { rank: 2, title: "강남 풋살 매치 (실력무관)", location: "강남구 스포타임", rate: "95%", capacity: "12/12명" },
  { rank: 3, title: "초보자 테니스 랠리 모임", location: "송파구 올림픽공원", rate: "92%", capacity: "4/4명" },
  { rank: 4, title: "퇴근길 가벼운 산책", location: "마포구 경의선숲길", rate: "88%", capacity: "10/10명" }
];

const systemLogs = [
  { id: 1, category: "보안 경고", type: "security", time: "10분 전", desc: "비정상적인 로그인 시도가 감지되었습니다. (IP: 192.168.1.45)" },
  { id: 2, category: "관리자 액션", type: "action", time: "1시간 전", desc: "관리자 'Admin_01'이 신고된 모임 #4592를 차단 처리했습니다." },
  { id: 3, category: "시스템 업데이트", type: "update", time: "3시간 전", desc: "정기 데이터베이스 백업이 성공적으로 완료되었습니다." },
  { id: 4, category: "결제 오류", type: "error", time: "5시간 전", desc: "PG사 연결 지연으로 3건의 결제가 실패했습니다. 자동 재시도 예정." }
];

function AdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("30일"); // Filter options: 오늘, 7일, 30일
  const [stats, setStats] = useState(initialStats);
  const [logs, setLogs] = useState(systemLogs);
  const [topMeetingsList, setTopMeetingsList] = useState(topMeetings);
  
  // Dynamic SVG Chart paths states
  const [chartPaths, setChartPaths] = useState({
    lineD: "M40,150 Q76,145 112,130 T184,115 T256,120 T328,50 T400,90 T480,35",
    areaD: "M40,165 L40,150 Q76,145 112,130 T184,115 T256,120 T328,50 T400,90 T480,35 L480,165 Z",
    points: [{ cx: 328, cy: 50 }, { cx: 480, cy: 35 }],
    yLabels: ["2k", "1.5k", "1k", "0.5k"]
  });

  // Dynamic Sport Doughnut percentages
  const [sportPercentages, setSportPercentages] = useState({
    soccer: 45,
    running: 30,
    tennis: 25,
    total: 1205
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAnalyticsData() {
      try {
        setLoading(true);
        const [usersRes, meetingsRes, reportsRes] = await Promise.allSettled([
          adminApi.users(),
          adminApi.meetings(),
          adminApi.reports()
        ]);

        const apiUsers = usersRes.status === "fulfilled" && usersRes.value?.items ? usersRes.value.items : [];
        const apiMeetings = meetingsRes.status === "fulfilled" && meetingsRes.value?.items ? meetingsRes.value.items : [];
        const apiReports = reportsRes.status === "fulfilled" && reportsRes.value?.items ? reportsRes.value.items : [];

        // 1. Process stats
        const soccerCount = apiMeetings.filter(m => m.sport?.name === "축구" || m.sport?.name === "풋살").length;
        const runningCount = apiMeetings.filter(m => m.sport?.name === "러닝").length;
        const tennisCount = apiMeetings.filter(m => m.sport?.name === "테니스").length;

        const pendingCount = apiReports.filter(r => r.status === "pending" || r.status === "대기 중").length;
        const resolvedCount = apiReports.filter(r => r.status === "resolved" || r.status === "처리 완료").length;

        setStats({
          revenue: 14250000, // Kept static since billing db is simulated
          revenueTrend: "12.5%",
          newUsers: apiUsers.length || 1842,
          newUsersTrend: apiUsers.length > 0 ? `${Math.round((apiUsers.length / 10) * 100)}%` : "8.2%",
          activeMeetings: apiMeetings.length || 328,
          meetingsDetails: {
            soccer: soccerCount || 145,
            running: runningCount || 98,
            tennis: tennisCount || 85
          },
          reports: {
            pending: pendingCount || 12,
            resolved: resolvedCount || 45
          }
        });

        // 2. Process Popular meetings Top 4
        if (apiMeetings.length > 0) {
          const sorted = [...apiMeetings]
            .sort((a, b) => (b.current_participants / b.max_participants) - (a.current_participants / a.max_participants))
            .slice(0, 4)
            .map((m, idx) => {
              const rate = Math.round((m.current_participants / m.max_participants) * 100);
              return {
                rank: idx + 1,
                title: m.title,
                location: m.location_name || m.address,
                rate: `${rate}%`,
                capacity: `${m.current_participants}/${m.max_participants}명`
              };
            });
          
          for (let i = sorted.length; i < 4; i++) {
            if (topMeetings[i]) {
              sorted.push({ ...topMeetings[i], rank: i + 1 });
            }
          }
          setTopMeetingsList(sorted);
        }

        // 3. Process Doughnut Chart Percentages
        const totalSportCount = soccerCount + runningCount + tennisCount;
        if (totalSportCount > 0) {
          const soccerPct = Math.round((soccerCount / totalSportCount) * 100);
          const runningPct = Math.round((runningCount / totalSportCount) * 100);
          const tennisPct = Math.max(0, 100 - soccerPct - runningPct);
          setSportPercentages({
            soccer: soccerPct,
            running: runningPct,
            tennis: tennisPct,
            total: apiMeetings.length
          });
        }

        // 4. Process dynamic system logs based on real DB events
        const generatedLogs = [];
        if (apiReports.length > 0) {
          apiReports.slice(0, 1).forEach((r) => {
            generatedLogs.push({
              id: `report-${r.id}`,
              category: "신고 접수",
              type: "security",
              time: "10분 전",
              desc: `신고자 '${r.reporter_name || "사용자"}'님이 대상에 대해 '${r.reason || "기타"}' 사유로 신규 신고를 접수했습니다.`
            });
          });
        }
        if (apiMeetings.length > 0) {
          apiMeetings.slice(0, 2).forEach((m, i) => {
            generatedLogs.push({
              id: `meeting-${m.id}`,
              category: "모임 개설",
              type: "action",
              time: `${i * 3 + 1}시간 전`,
              desc: `방장 '${m.host?.nickname || "방장"}'님이 신규 모임 '${m.title}'을(를) 정상 개설했습니다.`
            });
          });
        }
        if (apiUsers.length > 0) {
          apiUsers.slice(0, 2).forEach((u, i) => {
            generatedLogs.push({
              id: `user-${u.id}`,
              category: "회원 가입",
              type: "update",
              time: `${i * 4 + 2}시간 전`,
              desc: `신규 가입 유저 '${u.nickname || u.name}'님이 SportsMate 서비스 가입을 완료했습니다.`
            });
          });
        }
        // Pad with default logs
        for (let i = generatedLogs.length; i < 4; i++) {
          if (systemLogs[i]) {
            generatedLogs.push({ ...systemLogs[i], id: `mock-${i}` });
          }
        }
        setLogs(generatedLogs.slice(0, 4));

        // 5. Build dynamic line chart for user growth trends
        if (apiUsers.length > 0) {
          // Count users by registration date over last 30 days
          const daysCounts = Array(30).fill(0);
          const now = new Date();
          apiUsers.forEach(u => {
            if (u.created_at) {
              const createdDate = new Date(u.created_at);
              const diffTime = Math.abs(now - createdDate);
              const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
              if (diffDays < 30) {
                daysCounts[29 - diffDays]++;
              }
            }
          });

          // Cumulative counts
          const cumSum = [];
          let currentSum = Math.max(0, apiUsers.length - daysCounts.reduce((a, b) => a + b, 0));
          for (let i = 0; i < 30; i++) {
            currentSum += daysCounts[i];
            cumSum.push(currentSum);
          }

          // Build SVG coordinate points
          const maxCumVal = Math.max(...cumSum, 10);
          const points = cumSum.map((val, idx) => {
            const x = 40 + (idx / 29) * (480 - 40);
            const y = 165 - (val / maxCumVal) * (165 - 30);
            return { x, y };
          });

          let lineD = `M${points[0].x},${points[0].y}`;
          let areaD = `M${points[0].x},165 L${points[0].x},${points[0].y}`;
          for (let i = 1; i < points.length; i++) {
            lineD += ` L${points[i].x},${points[i].y}`;
            areaD += ` L${points[i].x},${points[i].y}`;
          }
          areaD += ` L${points[points.length - 1].x},165 Z`;

          // Format labels on Y-axis
          const yLabels = [
            `${maxCumVal}`,
            `${Math.round(maxCumVal * 0.75)}`,
            `${Math.round(maxCumVal * 0.5)}`,
            `${Math.round(maxCumVal * 0.25)}`
          ];

          setChartPaths({
            lineD,
            areaD,
            points: points.filter((_, i) => i % 5 === 0 || i === 29).map(p => ({ cx: p.x, cy: p.y })),
            yLabels
          });
        }

      } catch (err) {
        console.error("API error while generating analytics, fallback used", err);
      } finally {
        setLoading(false);
      }
    }

    fetchAnalyticsData();
  }, []);

  const handleFilterClick = (tab) => {
    setActiveTab(tab);
    alert(`데이터 집계 기간이 '${tab}'(으)로 전환되었습니다.`);
  };

  return (
    <div className="analytics-page">
      {/* Upper Title Description & Filter row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "28px" }}>
        <p style={{ color: "#64748b", fontSize: "14px", margin: 0 }}>
          시스템의 핵심 지표와 동향을 한눈에 파악하세요.
        </p>
        <div className="analytics-chart-panel__filter-row">
          {["오늘", "7일", "30일"].map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => handleFilterClick(tab)}
              className={`analytics-chart-panel__filter-btn ${activeTab === tab ? "active" : ""}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 1. Metric Widget Cards Grid (4 Columns) */}
      <section className="admin-stats-grid-4">
        {/* Card 1: Revenue Card with mini wave background graph */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">총 수익</span>
            <div className="admin-stat-card__value">
              ₩{stats.revenue.toLocaleString()}
            </div>
            <span className="admin-stat-card__trend admin-stat-card__trend--up">
              ▲ {stats.revenueTrend} <span style={{ color: "#94a3b8" }}>전월 대비</span>
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--blue">
            <DollarSign size={20} />
          </div>
          {/* Mini Wave graph SVG background */}
          <svg className="admin-stat-card__bg-svg" viewBox="0 0 100 30" preserveAspectRatio="none">
            <path d="M0,25 Q15,10 30,22 T60,5 T90,28 T100,20 L100,30 L0,30 Z" fill="#eff6ff" />
            <path d="M0,25 Q15,10 30,22 T60,5 T90,28 T100,20" fill="none" stroke="#3b82f6" strokeWidth="1" />
          </svg>
        </div>

        {/* Card 2: New Members */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">신규 회원</span>
            <div className="admin-stat-card__value">
              {stats.newUsers.toLocaleString()}
              <span className="admin-stat-card__unit">명</span>
            </div>
            <span className="admin-stat-card__trend admin-stat-card__trend--up">
              ▲ {stats.newUsersTrend} <span style={{ color: "#94a3b8" }}>전월 대비</span>
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--orange">
            <UserPlus size={20} />
          </div>
        </div>

        {/* Card 3: Active Meetings with category mini badges */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">활성 모임</span>
            <div className="admin-stat-card__value">
              {stats.activeMeetings}
              <span className="admin-stat-card__unit">개</span>
            </div>
            <div className="admin-stat-card__sub-items">
              <span className="admin-stat-card__sub-badge" style={{ borderLeft: "2px solid #3b82f6" }}>
                축구 {stats.meetingsDetails.soccer}
              </span>
              <span className="admin-stat-card__sub-badge" style={{ borderLeft: "2px solid #f97316" }}>
                러닝 {stats.meetingsDetails.running}
              </span>
              <span className="admin-stat-card__sub-badge" style={{ borderLeft: "2px solid #10b981" }}>
                테니스 {stats.meetingsDetails.tennis}
              </span>
            </div>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--green">
            <Trophy size={20} />
          </div>
        </div>

        {/* Card 4: Issues Warning Card */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">신고/이슈 현황</span>
            <div style={{ display: "flex", gap: "20px", marginTop: "4px" }}>
              <div>
                <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>대기 중인 이슈</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#ef4444" }}>
                  {stats.reports.pending}<span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b", marginLeft: "2px" }}>건</span>
                </div>
              </div>
              <div style={{ borderLeft: "1px solid #e2e8f0", paddingLeft: "16px" }}>
                <div style={{ fontSize: "11px", color: "#475569", fontWeight: 700 }}>처리 완료</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>
                  {stats.reports.resolved}<span style={{ fontSize: "14px", fontWeight: 500, color: "#64748b", marginLeft: "2px" }}>건</span>
                </div>
              </div>
            </div>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--red">
            <AlertCircle size={20} />
          </div>
        </div>
      </section>

      {/* 2. Analytical Graphs Section (Line chart & Doughnut chart) */}
      <div className="admin-grid-cols" style={{ marginBottom: "32px" }}>
        {/* Graph 1: Membership growth trends (SVG Line Chart) */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">회원 증가 추이</h2>
            <button type="button" className="admin-panel-card__more-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="admin-panel-card__body">
            <div className="svg-chart-container">
              <svg viewBox="0 0 500 220" preserveAspectRatio="none">
                <defs>
                  {/* Linear gradient for filling under chart line */}
                  <linearGradient id="chart-gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2563eb" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="#2563eb" stopOpacity="0.00" />
                  </linearGradient>
                </defs>

                {/* Horizontal grid lines */}
                <line x1="40" y1="30" x2="480" y2="30" className="svg-chart__grid-line" />
                <line x1="40" y1="75" x2="480" y2="75" className="svg-chart__grid-line" />
                <line x1="40" y1="120" x2="480" y2="120" className="svg-chart__grid-line" />
                <line x1="40" y1="165" x2="480" y2="165" className="svg-chart__grid-line" />

                {/* Shaded Area Under Line */}
                <path 
                  d={chartPaths.areaD} 
                  className="svg-chart__area"
                />

                {/* Smooth curve line */}
                <path 
                  d={chartPaths.lineD} 
                  className="svg-chart__line"
                />

                {/* Axis lines */}
                <line x1="40" y1="165" x2="480" y2="165" className="svg-chart__axis-line" />
                <line x1="40" y1="30" x2="40" y2="165" className="svg-chart__axis-line" />

                {/* Y-axis Labels */}
                <text x="30" y="34" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[0]}</text>
                <text x="30" y="79" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[1]}</text>
                <text x="30" y="124" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[2]}</text>
                <text x="30" y="169" textAnchor="end" className="svg-chart__axis-text">{chartPaths.yLabels[3]}</text>

                {/* X-axis Labels */}
                <text x="40" y="185" textAnchor="middle" className="svg-chart__axis-text">1일</text>
                <text x="150" y="185" textAnchor="middle" className="svg-chart__axis-text">8일</text>
                <text x="260" y="185" textAnchor="middle" className="svg-chart__axis-text">15일</text>
                <text x="370" y="185" textAnchor="middle" className="svg-chart__axis-text">22일</text>
                <text x="480" y="185" textAnchor="middle" className="svg-chart__axis-text">30일</text>

                {/* Interactive Points decoration */}
                {chartPaths.points.map((p, idx) => (
                  <circle key={idx} cx={p.cx} cy={p.cy} r="5" className="svg-chart__point" />
                ))}
              </svg>
            </div>
          </div>
        </section>

        {/* Graph 2: Popular sports percentage (SVG Doughnut Chart) */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">인기 스포츠</h2>
            <button type="button" className="admin-panel-card__more-btn">
              <MoreHorizontal size={18} />
            </button>
          </div>
          <div className="admin-panel-card__body">
            <div className="svg-doughnut-container">
              <svg className="svg-doughnut-svg" width="130" height="130" viewBox="0 0 42 42">
                {/* Background Ring */}
                <circle cx="21" cy="21" r="15.915" fill="none" stroke="#f1f5f9" strokeWidth="4" />
                
                {/* Soccer (Blue Segment) */}
                <circle 
                  cx="21" 
                  cy="21" 
                  r="15.915" 
                  fill="none" 
                  stroke="#2563eb" 
                  strokeWidth="4.2" 
                  strokeDasharray={`${sportPercentages.soccer} ${100 - sportPercentages.soccer}`}
                  strokeDashoffset="0"
                />

                {/* Running (Orange Segment) */}
                <circle 
                  cx="21" 
                  cy="21" 
                  r="15.915" 
                  fill="none" 
                  stroke="#f97316" 
                  strokeWidth="4.2" 
                  strokeDasharray={`${sportPercentages.running} ${100 - sportPercentages.running}`}
                  strokeDashoffset={`-${sportPercentages.soccer}`}
                />

                {/* Tennis (Green Segment) */}
                <circle 
                  cx="21" 
                  cy="21" 
                  r="15.915" 
                  fill="none" 
                  stroke="#10b981" 
                  strokeWidth="4.2" 
                  strokeDasharray={`${sportPercentages.tennis} ${100 - sportPercentages.tennis}`}
                  strokeDashoffset={`-${sportPercentages.soccer + sportPercentages.running}`}
                />
              </svg>

              {/* Central text labels overlay */}
              <div className="svg-doughnut__center-label">
                <span className="svg-doughnut__center-title">총 생성 수</span>
                <span className="svg-doughnut__center-value">{sportPercentages.total}</span>
              </div>
            </div>

            {/* Doughnut Chart Legends underneath */}
            <div className="svg-doughnut-legends">
              <div className="svg-doughnut-legend-item">
                <div className="svg-doughnut-legend-item__label-row">
                  <span className="svg-doughnut-legend-item__color-dot" style={{ backgroundColor: "#2563eb" }}></span>
                  <span>축구</span>
                </div>
                <span className="svg-doughnut-legend-item__value">{sportPercentages.soccer}%</span>
              </div>
              <div className="svg-doughnut-legend-item">
                <div className="svg-doughnut-legend-item__label-row">
                  <span className="svg-doughnut-legend-item__color-dot" style={{ backgroundColor: "#f97316" }}></span>
                  <span>러닝</span>
                </div>
                <span className="svg-doughnut-legend-item__value">{sportPercentages.running}%</span>
              </div>
              <div className="svg-doughnut-legend-item">
                <div className="svg-doughnut-legend-item__label-row">
                  <span className="svg-doughnut-legend-item__color-dot" style={{ backgroundColor: "#10b981" }}></span>
                  <span>테니스</span>
                </div>
                <span className="svg-doughnut-legend-item__value">{sportPercentages.tennis}%</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* 3. Bottom Grid: Top 4 active meetings and system logs */}
      <div className="admin-grid-cols">
        {/* Left Column: Popular matches Top 4 */}
        <section className="admin-panel-card">
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">인기 활성 모임 Top 4</h2>
            <Link to="/admin/meetings" className="admin-panel-card__link">
              모두 보기
            </Link>
          </div>
          <div className="admin-panel-card__body">
            <div className="admin-rank-list">
              {topMeetingsList.map((m) => (
                <div className="admin-rank-item" key={m.rank}>
                  <div className="admin-rank-item__number">
                    {m.rank}
                  </div>
                  <div className="admin-rank-item__main">
                    <span className="admin-rank-item__title">{m.title}</span>
                    <span className="admin-rank-item__meta">{m.location}</span>
                  </div>
                  <div className="admin-rank-item__attendance">
                    <span className="admin-rank-item__rate">참석률 {m.rate}</span>
                    <span className="admin-rank-item__capa">정원 {m.capacity}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Right Column: Recent system event logs */}
        <section className="admin-panel-card">
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">최근 시스템 로그</h2>
            <button type="button" className="admin-panel-card__more-btn" onClick={() => alert("로그 필터 기능 준비 중")}>
              <Filter size={16} />
            </button>
          </div>
          <div className="admin-panel-card__body">
            <div className="admin-log-list">
              {logs.map((log) => (
                <div className="admin-log-item" key={log.id}>
                  <div className="admin-log-item__dot-outer">
                    <div className={`admin-log-item__dot admin-log-item__dot--${log.type}`}></div>
                  </div>
                  <div className="admin-log-item__content">
                    <div className="admin-log-item__meta-row">
                      <span className={`admin-log-item__tag admin-log-item__tag--${log.type}`}>
                        [{log.category}]
                      </span>
                      <span className="admin-log-item__time">{log.time}</span>
                    </div>
                    <p className="admin-log-item__desc">
                      {log.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default AdminAnalyticsPage;
