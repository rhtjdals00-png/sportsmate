import { useState, useEffect } from "react";
import { adminApi } from "../../../api/adminApi";
import { CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

function MobileAdminReportsPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState("all");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [activeSearchField, setActiveSearchField] = useState("all");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const handleSearch = () => {
    setActiveSearchField(searchField);
    setActiveSearchQuery(tempSearchQuery);
    setCurrentPage(1);
  };

  const handleReset = () => {
    setSearchField("all");
    setTempSearchQuery("");
    setActiveSearchField("all");
    setActiveSearchQuery("");
    setCurrentPage(1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const fetchReports = async () => {
    try {
      setLoading(true);
      const res = await adminApi.reports();
      if (res && res.items) {
        const formatted = res.items.map((r, index) => ({
          id: r.id || index + 1,
          type: r.target_type === 'meeting' ? '모임' : r.target_type === 'user' ? '사용자' : r.target_type || '기타',
          target: r.target_name || `대상 #${r.target_id || ""}`,
          reporter: r.reporter_name || "신고자",
          reason: r.reason || "상세 사유가 제공되지 않았습니다.",
          date: r.created_at ? new Date(r.created_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.10.27",
          status: r.status === "pending" || r.status === "대기 중" ? "처리 전" : "처리 완료"
        }));
        setReports(formatted);
      }
    } catch (err) {
      console.error("API error loading reports", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleProcess = (reportId) => {
    setReports(prev => prev.map(r => {
      if (r.id === reportId) {
        if (r.status === "처리 완료") {
          alert(`신고 번호 #${reportId}은 이미 처리 완료된 건입니다.`);
          return r;
        }
        alert(`신고 번호 #${reportId}을(를) 처리 완료 상태로 업데이트했습니다.`);
        return { ...r, status: "처리 완료" };
      }
      return r;
    }));
  };

  const filteredReports = reports.filter(r => {
    if (!activeSearchQuery) return true;
    const query = activeSearchQuery.toLowerCase();
    
    const typeText = r.type ? r.type.toLowerCase() : "";
    const targetText = r.target ? r.target.toLowerCase() : "";
    const reporterText = r.reporter ? r.reporter.toLowerCase() : "";
    const reasonText = r.reason ? r.reason.toLowerCase() : "";
    const statusText = r.status ? r.status.toLowerCase() : "";

    if (activeSearchField === "type") {
      return typeText.includes(query);
    } else if (activeSearchField === "target") {
      return targetText.includes(query);
    } else if (activeSearchField === "reporter") {
      return reporterText.includes(query);
    } else if (activeSearchField === "reason") {
      return reasonText.includes(query);
    } else if (activeSearchField === "status") {
      return statusText.includes(query);
    } else {
      return (
        typeText.includes(query) ||
        targetText.includes(query) ||
        reporterText.includes(query) ||
        reasonText.includes(query) ||
        statusText.includes(query)
      );
    }
  });

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

  return (
    <>
      <MobileHeader title="신고 관리" />

      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #450a0a 0%, #1e1b4b 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: '#fca5a5', letterSpacing: '1px' }}>SPORTSMATE REPORTS</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>신고 및 제재 관리</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>부적절한 활동 및 노쇼 신고 건을 처리합니다.</p>
      </section>

      <section style={{ padding: '16px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', gap: '6px' }}>
          <select 
            value={searchField} 
            onChange={(e) => setSearchField(e.target.value)}
            style={{ height: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '13px', backgroundColor: '#fff', fontWeight: '600' }}
          >
            <option value="all">전체</option>
            <option value="type">유형</option>
            <option value="target">대상</option>
            <option value="reporter">신고자</option>
            <option value="reason">사유</option>
          </select>
          <input 
            type="search" 
            placeholder="검색어를 입력하세요..." 
            value={tempSearchQuery}
            onChange={(e) => setTempSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ height: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '0 12px', fontSize: '14px', boxSizing: 'border-box' }}
          />
          <button 
            type="button" 
            onClick={handleSearch}
            style={{ height: '40px', borderRadius: '12px', border: 0, backgroundColor: 'var(--mobile-primary)', color: '#fff', fontSize: '13px', fontWeight: '800' }}
          >
            검색
          </button>
        </div>

        {activeSearchQuery && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#475569' }}>
              검색 결과: <strong>{filteredReports.length}건</strong>
            </span>
            <button 
              type="button" 
              onClick={handleReset}
              style={{ border: 0, background: 'none', color: '#ef4444', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <RefreshCw size={12} /> 필터 초기화
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
            <span style={{ fontSize: '14px', color: '#64748b' }}>신고 접수 내역을 로딩 중...</span>
          </div>
        ) : paginatedReports.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            접수된 신고 내역이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {paginatedReports.map((r) => {
              const isWaiting = r.status === "처리 전";
              return (
                <article 
                  key={r.id}
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
                    <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--mobile-primary)', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
                      #{r.id}
                    </span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      backgroundColor: isWaiting ? '#fee2e2' : '#f1f5f9', 
                      color: isWaiting ? '#ef4444' : '#475569', 
                      padding: '2px 8px', 
                      borderRadius: '6px' 
                    }}>
                      {r.status}
                    </span>
                  </div>

                  <div>
                    <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>신고 유형 / 대상</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <span style={{ fontSize: '11px', padding: '1px 5px', borderRadius: '4px', backgroundColor: r.type === "욕설" ? '#fee2e2' : r.type === "노쇼" ? '#ffedd5' : '#f1f5f9', color: r.type === "욕설" ? '#ef4444' : r.type === "노쇼" ? '#ea580c' : '#475569', fontWeight: '800' }}>
                        {r.type}
                      </span>
                      <strong style={{ fontSize: '15px', color: '#1e293b' }}>{r.target}</strong>
                    </div>
                  </div>

                  <div style={{ backgroundColor: '#f8fafc', padding: '10px', borderRadius: '10px', fontSize: '13px', color: '#475569', lineHeight: 1.4 }}>
                    <strong style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '2px' }}>신고 상세 사유</strong>
                    {r.reason}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '4px' }}>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>신고자: {r.reporter} | {r.date}</span>
                    
                    {isWaiting ? (
                      <button 
                        type="button"
                        onClick={() => handleProcess(r.id)}
                        style={{
                          padding: '4px 12px',
                          borderRadius: '8px',
                          border: 0,
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          fontSize: '11px',
                          fontWeight: '800'
                        }}
                      >
                        신고 처리
                      </button>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#10b981', fontWeight: '800', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                        <CheckCircle size={12} /> 처리 완료됨
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
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

export default MobileAdminReportsPage;
