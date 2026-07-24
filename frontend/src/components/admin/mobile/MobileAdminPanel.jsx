import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Activity, 
  AlertTriangle, 
  BarChart3, 
  CalendarDays, 
  ChevronRight, 
  CircleDollarSign, 
  Dumbbell, 
  Gavel, 
  Search, 
  ShieldCheck, 
  Trophy, 
  User, 
  UserRound, 
  UsersRound, 
  Bell, 
  ClipboardList, 
  Settings 
} from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { adminApi } from "../../../api/adminApi";
import { getSportEmoji } from "../../../utils/sportIcons.jsx";

function MobileAdminPanel({ title = "운영 대시보드" }) {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDashboardData = async () => {
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
        setError("데이터를 로딩하지 못했습니다. 서버 상태나 관리자 권한을 확인해 주세요.");
        return;
      }

      if (usersRes.status === "fulfilled" && usersRes.value?.items) {
        setUsers(usersRes.value.items);
      }
      if (meetingsRes.status === "fulfilled" && meetingsRes.value?.items) {
        setMeetings(meetingsRes.value.items);
      }
      if (reportsRes.status === "fulfilled" && reportsRes.value?.items) {
        setReports(reportsRes.value.items);
      }
    } catch (err) {
      console.error("Failed to load dashboard data", err);
      setError("오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const pendingReportsCount = reports.filter(r => r.status === "pending" || r.status === "대기 중").length;

  const summaryItems = [
    { label: "총 회원수", value: loading ? "확인 중" : `${users.length}명`, icon: UsersRound, tone: "blue", link: "/admin/users" },
    { label: "활성 모임", value: loading ? "확인 중" : `${meetings.length}개`, icon: Dumbbell, tone: "indigo", link: "/admin/meetings" },
    { label: "신고 대기", value: loading ? "확인 중" : `${pendingReportsCount}건`, icon: AlertTriangle, tone: "amber", link: "/admin/reports" },
    { label: "시스템 설정", value: "정상 가동", icon: Settings, tone: "green", link: "/admin/settings" }
  ];

  const handleReportAction = (reportId, currentStatus) => {
    const isWaiting = currentStatus === "처리 전" || currentStatus === "pending";
    if (isWaiting) {
      alert(`신고 번호 #${reportId} 처리를 시작합니다.`);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status: "처리 완료" } : r));
    } else {
      alert(`신고 번호 #${reportId} 상세 내역을 조회합니다.`);
    }
  };

  // Get recent 4 reports
  const recentReports = reports.slice(0, 4).map((r, idx) => ({
    id: r.id || idx + 1,
    type: r.target_type === 'meeting' ? '모임' : r.target_type === 'user' ? '사용자' : r.target_type || '기타',
    target: r.target_name || `대상 #${r.target_id || ""}`,
    reporter: r.reporter_name || "신고자",
    reason: r.reason || "상세 사유가 제공되지 않았습니다.",
    date: r.created_at ? new Date(r.created_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.10.27",
    status: r.status === "pending" || r.status === "대기 중" ? "처리 전" : "처리 완료"
  }));

  // Get recent 4 users
  const recentNewUsers = users.slice(0, 4).map((u) => {
    const name = u.name || u.nickname || "이름없음";
    const initial = name.slice(0, 1).toUpperCase();
    const sport = u.profile?.preferred_sports || "일반";
    const emoji = getSportEmoji(sport);
    return {
      id: u.id,
      name,
      initial,
      sport,
      emoji,
      created_at: u.created_at ? new Date(u.created_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.10.27"
    };
  });

  if (error) {
    return (
      <>
        <MobileHeader title={title} />
        <div style={{ padding: '40px 24px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <AlertTriangle size={48} color="#ef4444" />
          <span style={{ fontSize: '15px', color: '#ef4444', fontWeight: '800' }}>{error}</span>
          <button
            type="button"
            onClick={fetchDashboardData}
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
      <MobileHeader title={title} />
      
      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--mobile-primary)', letterSpacing: '1px' }}>SPORTSMATE OPERATIONAL</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>{title}</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>회원 활동, 모임 현황 및 유입 보고서를 한눈에 관리합니다.</p>
      </section>

      {/* 요약 지표 */}
      <section className="mobile-admin-grid" style={{ padding: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        {summaryItems.map((item) => {
          const Icon = item.icon;
          return (
            <article 
              key={item.label}
              onClick={() => navigate(item.link)}
              style={{
                background: '#fff',
                border: '1px solid #e2e8f0',
                borderRadius: '16px',
                padding: '14px',
                display: 'grid',
                gap: '6px',
                boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                cursor: 'pointer'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Icon size={18} style={{ color: item.tone === 'blue' ? '#3b82f6' : item.tone === 'indigo' ? '#6366f1' : item.tone === 'amber' ? '#f59e0b' : '#10b981' }} />
                <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
              </div>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>{item.label}</span>
              <strong style={{ fontSize: '16px', color: '#1e293b' }}>{item.value}</strong>
            </article>
          );
        })}
      </section>

      {/* 관리 메뉴 */}
      <section className="detail-card" style={{ margin: '0 16px 16px 16px', padding: '16px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0' }}>운영 관리 메뉴</h2>
        <div style={{ display: 'grid', gap: '4px' }}>
          <Link to="/admin/users" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <UserRound size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>회원 관리</span>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
          <Link to="/admin/meetings" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <Dumbbell size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>모임 관리</span>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
          <Link to="/admin/reports" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <Gavel size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>리포트 및 신고 관리</span>
            <em style={{ fontStyle: 'normal', fontSize: '11px', color: '#ef4444', backgroundColor: '#fee2e2', padding: '1px 6px', borderRadius: '4px', marginRight: '6px', fontWeight: '800' }}>
              {pendingReportsCount}건 대기
            </em>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
          <Link to="/admin/broadcast" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <Bell size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>전체 알림 및 공지</span>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
          <Link to="/admin/analytics" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <BarChart3 size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>보고서 및 분석</span>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
          <Link to="/admin/audit-logs" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #f1f5f9', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <ClipboardList size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>작업 이력 로그</span>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
          <Link to="/admin/settings" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', textDecoration: 'none', color: '#334155', fontSize: '13px', fontWeight: '700' }}>
            <Settings size={16} style={{ color: '#64748b' }} />
            <span style={{ flex: 1 }}>시스템 설정</span>
            <ChevronRight size={14} style={{ color: '#cbd5e1' }} />
          </Link>
        </div>
      </section>

      {/* 최근 신고 현황 (실시간 연동) */}
      <section className="detail-card" style={{ margin: '0 16px 16px 16px', padding: '16px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: 0 }}>최근 신고 관리</h2>
          <Link to="/admin/reports" style={{ fontSize: '12px', color: 'var(--mobile-primary)', textDecoration: 'none', fontWeight: 'bold' }}>전체 보기 &gt;</Link>
        </div>
        
        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>신고 접수 내역 로딩 중...</div>
        ) : recentReports.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>최근 접수된 신고 내역이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {recentReports.map((report) => {
              const isWaiting = report.status === "처리 전";
              return (
                <div 
                  key={report.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #f1f5f9',
                    borderRadius: '12px'
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', backgroundColor: report.type === "욕설" ? '#fee2e2' : report.type === "노쇼" ? '#ffedd5' : '#f1f5f9', color: report.type === "욕설" ? '#ef4444' : report.type === "노쇼" ? '#ea580c' : '#475569', fontWeight: '800' }}>
                        {report.type}
                      </span>
                      <strong style={{ fontSize: '13px', color: '#1e293b' }}>{report.target}</strong>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>신고자: {report.reporter} | {report.date}</span>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => handleReportAction(report.id, report.status)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: isWaiting ? 0 : '1px solid #cbd5e1',
                      backgroundColor: isWaiting ? 'var(--mobile-primary)' : '#fff',
                      color: isWaiting ? '#fff' : '#475569',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                  >
                    {isWaiting ? "처리" : "조회"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 최근 가입 회원 (실시간 연동) */}
      <section className="detail-card" style={{ margin: '0 16px 24px 16px', padding: '16px', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: 0 }}>최근 가입 회원</h2>
          <Link to="/admin/users" style={{ fontSize: '12px', color: 'var(--mobile-primary)', textDecoration: 'none', fontWeight: 'bold' }}>전체 보기 &gt;</Link>
        </div>

        {loading ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>신규 가입 회원 로딩 중...</div>
        ) : recentNewUsers.length === 0 ? (
          <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>최근 가입한 회원이 없습니다.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {recentNewUsers.map((userItem) => (
              <div 
                key={userItem.id}
                onClick={() => navigate(`/admin/users/${userItem.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '12px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#e0e7ff', color: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>
                    {userItem.initial}
                  </div>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{userItem.name}</strong>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '1px' }}>가입일: {userItem.created_at}</span>
                  </div>
                </div>
                
                <span style={{ fontSize: '12px' }}>
                  {userItem.emoji} <small style={{ fontSize: '11px', color: '#64748b' }}>{userItem.sport}</small>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default MobileAdminPanel;
