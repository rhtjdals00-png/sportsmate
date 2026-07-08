import { useState, useEffect } from "react";
import { 
  ClipboardList, 
  Search, 
  RefreshCw, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Shield,
  AlertCircle
} from "lucide-react";
import { adminApi } from "../../../api/adminApi";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

function MobileAdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAuditLogs();
      if (data) {
        setLogs(data);
      }
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const actionTypes = [
    { value: "", label: "전체 작업 유형" },
    { value: "회원 관리", label: "회원 관리" },
    { value: "모임 수정", label: "모임 수정" },
    { value: "모임 폐쇄", label: "모임 폐쇄" },
    { value: "모임 복구", label: "모임 복구" },
    { value: "멤버 강퇴", label: "멤버 강퇴" },
    { value: "설정 변경", label: "설정 변경" },
    { value: "개별 알림 발송", label: "개별 알림 발송" },
    { value: "단체 알림 발송", label: "단체 알림 발송" }
  ];

  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.admin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.action_type && log.action_type.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesType = !selectedActionType || log.action_type === selectedActionType;
    return matchesSearch && matchesType;
  });

  const reversedLogs = [...filteredLogs].reverse();
  const totalPages = Math.max(Math.ceil(reversedLogs.length / itemsPerPage), 1);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedActionType]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = reversedLogs.slice(indexOfFirstItem, indexOfLastItem);

  const getBadgeStyle = (actionType) => {
    const base = {
      padding: "2px 8px",
      borderRadius: "6px",
      fontSize: "10px",
      fontWeight: "800",
      display: "inline-flex",
      alignItems: "center"
    };

    switch (actionType) {
      case "회원 관리":
        return { ...base, backgroundColor: "#eff6ff", color: "#1d4ed8", border: "1px solid #dbeafe" };
      case "모임 수정":
        return { ...base, backgroundColor: "#ecfdf5", color: "#047857", border: "1px solid #d1fae5" };
      case "모임 폐쇄":
        return { ...base, backgroundColor: "#fef2f2", color: "#b91c1c", border: "1px solid #fee2e2" };
      case "모임 복구":
        return { ...base, backgroundColor: "#f0fdf4", color: "#15803d", border: "1px solid #dcfce7" };
      case "멤버 강퇴":
        return { ...base, backgroundColor: "#fff7ed", color: "#c2410c", border: "1px solid #ffedd5" };
      case "개별 알림 발송":
      case "단체 알림 발송":
        return { ...base, backgroundColor: "#faf5ff", color: "#6b21a8", border: "1px solid #f3e8ff" };
      default:
        return { ...base, backgroundColor: "#f1f5f9", color: "#475569", border: "1px solid #e2e8f0" };
    }
  };

  return (
    <>
      <MobileHeader title="작업 이력 로그" />

      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: '#94a3b8', letterSpacing: '1px' }}>SPORTSMATE AUDIT LOGS</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>관리자 작업 이력</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>서비스 내 관리자 계정이 실행한 모든 작업 명세를 기록합니다.</p>
      </section>

      <section style={{ padding: '16px', display: 'grid', gap: '12px' }}>
        
        {/* 필터 및 검색 */}
        <div style={{ display: 'grid', gap: '8px' }}>
          <select 
            value={selectedActionType}
            onChange={(e) => setSelectedActionType(e.target.value)}
            style={{ height: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '0 8px', fontSize: '13px', backgroundColor: '#fff', fontWeight: 'bold' }}
          >
            {actionTypes.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 60px', gap: '6px' }}>
            <input 
              type="search" 
              placeholder="작업자 또는 내역 검색..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ height: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px' }}
            />
            <button 
              type="button" 
              onClick={fetchLogs}
              style={{ height: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', backgroundColor: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569' }}
            >
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>로그 데이터를 불러오는 중...</span>
          </div>
        ) : currentLogs.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            기록된 작업 로그가 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {currentLogs.map((log) => (
              <article 
                key={log.id}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'grid',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={getBadgeStyle(log.action_type)}>
                    {log.action_type || "일반"}
                  </span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                    {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                  </span>
                </div>

                <p style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 1.4, fontWeight: '700' }}>
                  {log.description}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '4px', fontSize: '11px', color: '#64748b' }}>
                  <span>실행 관리자: <strong>{log.admin}</strong></span>
                  <span style={{ fontFamily: 'monospace' }}>IP: {log.ip_address || "127.0.0.1"}</span>
                </div>
              </article>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', marginTop: '16px', paddingBottom: '24px' }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: currentPage === 1 ? '#f1f5f9' : '#fff',
                color: currentPage === 1 ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '800'
              }}
            >
              이전
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: '1px solid',
                  borderColor: currentPage === pageNum ? 'var(--mobile-primary)' : '#cbd5e1',
                  backgroundColor: currentPage === pageNum ? 'var(--mobile-primary)' : '#fff',
                  color: currentPage === pageNum ? '#fff' : '#334155',
                  fontSize: '12px',
                  fontWeight: '800'
                }}
              >
                {pageNum}
              </button>
            ))}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              style={{
                height: '32px',
                padding: '0 10px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: currentPage === totalPages ? '#f1f5f9' : '#fff',
                color: currentPage === totalPages ? '#94a3b8' : '#334155',
                fontSize: '12px',
                fontWeight: '800'
              }}
            >
              다음
            </button>
          </div>
        )}
      </section>
    </>
  );
}

export default MobileAdminAuditLogsPage;
