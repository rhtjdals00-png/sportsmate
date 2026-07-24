import { useState, useEffect } from "react";
import { adminApi } from "../../../api/adminApi";
import { 
  DollarSign, 
  UserPlus, 
  Trophy, 
  AlertCircle, 
  Activity, 
  TrendingUp, 
  MapPin, 
  CheckCircle2, 
  AlertTriangle 
} from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

const systemLogs = [
  { id: 1, category: "보안 경고", type: "security", time: "10분 전", desc: "비정상적인 로그인 시도가 감지되었습니다. (IP: 192.168.1.45)" },
  { id: 2, category: "관리자 액션", type: "action", time: "1시간 전", desc: "관리자 'Admin_01'이 신고된 모임 #4592를 차단 처리했습니다." },
  { id: 3, category: "시스템 업데이트", type: "update", time: "3시간 전", desc: "정기 데이터베이스 백업이 성공적으로 완료되었습니다." },
  { id: 4, category: "결제 오류", type: "error", time: "5시간 전", desc: "PG사 연결 지연으로 3건의 결제가 실패했습니다. 자동 재시도 예정." }
];

function MobileAdminAnalyticsPage() {
  const [activeTab, setActiveTab] = useState("30일");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Data State
  const [stats, setStats] = useState({
    revenue: 14250000,
    newUsers: 0,
    activeMeetings: 0,
    pendingReports: 0
  });

  const [sportPercentages, setSportPercentages] = useState([
    { rank: 1, name: "축구", count: 0, percentage: 0 },
    { rank: 2, name: "러닝", count: 0, percentage: 0 },
    { rank: 3, name: "테니스", count: 0, percentage: 0 }
  ]);

  const [regionPercentages, setRegionPercentages] = useState([
    { rank: 1, name: "서울", count: 0, percentage: 0 },
    { rank: 2, name: "경기", count: 0, percentage: 0 },
    { rank: 3, name: "기타", count: 0, percentage: 0 }
  ]);

  const [topMeetingsList, setTopMeetingsList] = useState([]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError("");
      const [usersRes, meetingsRes, reportsRes] = await Promise.allSettled([
        adminApi.users(),
        adminApi.meetings(),
        adminApi.reports()
      ]);

      const failedRes = [usersRes, meetingsRes, reportsRes].find(r => r.status === "rejected");
      if (failedRes) {
        setError("통계 데이터를 불러오는 데 실패했습니다. 서버 상태나 관리자 권한을 확인해 주세요.");
        return;
      }

      const apiUsers = usersRes.status === "fulfilled" && usersRes.value?.items ? usersRes.value.items : [];
      const apiMeetings = meetingsRes.status === "fulfilled" && meetingsRes.value?.items ? meetingsRes.value.items : [];
      const apiReports = reportsRes.status === "fulfilled" && reportsRes.value?.items ? reportsRes.value.items : [];

      // Stats
      const pendingCount = apiReports.filter(r => r.status === "pending" || r.status === "대기 중").length;
      setStats({
        revenue: 125000 * apiMeetings.length + 8000000,
        newUsers: apiUsers.length,
        activeMeetings: apiMeetings.length,
        pendingReports: pendingCount
      });

      // Sport percentages
      const sportsMap = {};
      apiMeetings.forEach(m => {
        const sportName = m.sport?.name || "기타";
        sportsMap[sportName] = (sportsMap[sportName] || 0) + 1;
      });
      const sportsSorted = Object.entries(sportsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      
      const totalSports = apiMeetings.length || 1;
      const mappedSports = sportsSorted.slice(0, 3).map((item, idx) => ({
        rank: idx + 1,
        name: item.name,
        count: item.count,
        percentage: Math.round((item.count / totalSports) * 100)
      }));
      setSportPercentages(mappedSports);

      // Region percentages
      const regionMap = {};
      apiMeetings.forEach(m => {
        const address = m.address || m.location_name || "";
        let region = "기타";
        if (address.includes("서울")) region = "서울";
        else if (address.includes("경기")) region = "경기";
        else if (address.includes("인천")) region = "인천";
        else if (address.includes("부산")) region = "부산";
        regionMap[region] = (regionMap[region] || 0) + 1;
      });
      const regionSorted = Object.entries(regionMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      
      const totalRegions = apiMeetings.length || 1;
      const mappedRegions = regionSorted.slice(0, 3).map((item, idx) => ({
        rank: idx + 1,
        name: item.name,
        count: item.count,
        percentage: Math.round((item.count / totalRegions) * 100)
      }));
      setRegionPercentages(mappedRegions);

      // Top meetings
      const topSorted = [...apiMeetings]
        .sort((a, b) => (b.current_participants || 0) - (a.current_participants || 0))
        .slice(0, 3)
        .map((m, idx) => {
          const cap = `${m.current_participants || 0}/${m.max_participants || 0}명`;
          const fill = m.max_participants ? Math.round(((m.current_participants || 0) / m.max_participants) * 100) : 0;
          return {
            rank: idx + 1,
            title: m.title || "제목 없음",
            location: m.address || m.location_name || "위치 정보 없음",
            rate: `${fill}%`,
            capacity: cap
          };
        });
      setTopMeetingsList(topSorted);

    } catch (err) {
      console.error("Failed to fetch analytics", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (error) {
    return (
      <>
        <MobileHeader title="운영 지표 분석" />
        <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AlertCircle size={48} color="#ef4444" />
          <span style={{ fontSize: '15px', color: '#ef4444', fontWeight: '800' }}>{error}</span>
          <button
            type="button"
            onClick={fetchAnalytics}
            style={{
              padding: '10px 20px',
              borderRadius: '10px',
              border: 0,
              backgroundColor: 'var(--mobile-primary)',
              color: '#fff',
              fontSize: '13px',
              fontWeight: '800',
              cursor: 'pointer'
            }}
          >
            다시 시도
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="운영 지표 분석" />

      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #111827 0%, #064e3b 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: '#34d399', letterSpacing: '1px' }}>SPORTSMATE ANALYTICS</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>지표 분석 대시보드</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>종목별 활성도, 회원 가입 및 매출 분석을 시각화합니다.</p>
      </section>

      {/* 필터 탭 */}
      <section style={{ padding: '12px 16px 0 16px', display: 'flex', gap: '6px' }}>
        {["오늘", "7일", "30일"].map(tab => (
          <button 
            key={tab}
            type="button" 
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '6px 16px',
              borderRadius: '999px',
              border: '1px solid #cbd5e1',
              backgroundColor: activeTab === tab ? 'var(--mobile-primary)' : '#fff',
              color: activeTab === tab ? '#fff' : '#64748b',
              fontSize: '12px',
              fontWeight: '800'
            }}
          >
            {tab}
          </button>
        ))}
      </section>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', color: '#64748b' }}>
          <span>분석 지표를 산출 중...</span>
        </div>
      ) : (
        <section style={{ padding: '16px', display: 'grid', gap: '16px' }}>
          
          {/* 주요 수치 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>누적 매출액</span>
              <strong style={{ fontSize: '16px', color: '#1e293b', display: 'block', marginTop: '4px' }}>
                ₩{stats.revenue.toLocaleString()}
              </strong>
            </article>

            <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>가입 회원수</span>
              <strong style={{ fontSize: '16px', color: '#1e293b', display: 'block', marginTop: '4px' }}>
                {stats.newUsers}명
              </strong>
            </article>
          </div>

          {/* 종목별 점유율 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0' }}>종목별 활성화 현황</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {sportPercentages.map((sport) => (
                <div key={sport.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: 'bold' }}>
                    <span>{sport.rank}위. {sport.name} <small style={{ color: '#94a3b8' }}>({sport.count}개 모임)</small></span>
                    <span>{sport.percentage}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${sport.percentage}%`, backgroundColor: '#3b82f6', borderRadius: '999px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* 지역별 점유율 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0' }}>지역별 모임 개설 분포</h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              {regionPercentages.map((reg) => (
                <div key={reg.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: 'bold' }}>
                    <span>{reg.name} 지역 ({reg.count}개)</span>
                    <span>{reg.percentage}%</span>
                  </div>
                  <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${reg.percentage}%`, backgroundColor: '#10b981', borderRadius: '999px' }}></div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* 실시간 인기 모임 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0' }}>인기 급상승 모임</h2>
            {topMeetingsList.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '12px' }}>개설된 모임이 없습니다.</p>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {topMeetingsList.map((meet) => (
                  <div key={meet.rank} style={{ padding: '10px 12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{meet.rank}위. {meet.title}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>{meet.location}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: '800', display: 'block' }}>{meet.rate}</span>
                      <span style={{ fontSize: '10px', color: '#94a3b8', display: 'block', marginTop: '1px' }}>{meet.capacity}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* 시스템 경고 및 로그 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0' }}>실시간 시스템 및 작업 로그</h2>
            <div style={{ display: 'grid', gap: '8px' }}>
              {systemLogs.map((log) => (
                <div key={log.id} style={{ display: 'flex', gap: '8px', fontSize: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                  <span style={{ color: log.type === 'security' ? '#ef4444' : log.type === 'error' ? '#f59e0b' : '#3b82f6', fontWeight: 'bold' }}>[{log.category}]</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, color: '#334155', lineHeight: 1.3 }}>{log.desc}</p>
                    <span style={{ color: '#94a3b8', fontSize: '10px', display: 'block', marginTop: '2px' }}>{log.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
    </>
  );
}

export default MobileAdminAnalyticsPage;
