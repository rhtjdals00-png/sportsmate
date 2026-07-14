import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";
import MobileAdminReportsPage from "../components/admin/mobile/MobileAdminReportsPage.jsx";

// Mock reports database
const mockReports = [
  { id: 1, type: "욕설", target: "User_FC02", reporter: "킥마스터", reason: "대화방에서 지속적인 언어폭력 and 인격 모독을 자행함", date: "2023.10.27", status: "대기 중" },
  { id: 2, type: "노쇼", target: "러닝초보", reporter: "야간러너", date: "2023.10.26", reason: "모임 시간 직전 무단 탈퇴 후 당일 연락 두절", status: "대기 중" },
  { id: 3, type: "기타", target: "스팸계정99", reporter: "농구조아", date: "2023.10.25", reason: "프로필 소개란에 음란성 도배 광고 링크 게재", status: "처리 완료" },
  { id: 4, type: "욕설", target: "화난사람", reporter: "테니스킹", date: "2023.10.24", reason: "댓글란에 비속어 작성 및 시비조 댓글 반복 작성", status: "처리 완료" }
];

const reportTypeLabel = {
  user: "회원 신고",
  meeting: "모임 신고",
  chat_room: "채팅방 신고"
};

const statusLabel = {
  pending: "대기 중",
  in_progress: "처리 중",
  resolved: "처리 완료",
  dismissed: "반려"
};

const statusTone = {
  pending: "pending",
  in_progress: "progress",
  resolved: "resolved",
  dismissed: "dismissed"
};

function formatReportRow(r, index = 0) {
  return {
    id: r.id || index + 1,
    type: reportTypeLabel[r.target_type] || r.reason || "기타",
    target: r.target_name || r.target_type || `대상 #${r.target_id || ""}`,
    reporter: r.reporter_name || "신고자",
    reason: r.reason_detail || r.reason || "상세 사유가 제공되지 않았습니다.",
    date: r.created_at ? new Date(r.created_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.10.27",
    status: statusLabel[r.status] || r.status || "대기 중",
    rawStatus: r.status || "pending",
    adminNote: r.admin_note || ""
  };
}

function AdminReportsPage() {
  const { isMobile } = useResponsive();
  const navigate = useNavigate();
  const location = useLocation();

  if (isMobile) {
    return <MobileAdminReportsPage />;
  }

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState("all");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [activeSearchField, setActiveSearchField] = useState("all");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [feedback, setFeedback] = useState(location.state?.notice || "");
  const itemsPerPage = 10;

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

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        const res = await adminApi.reports();
        if (res && res.items) {
          setReports(res.items.map(formatReportRow));
        }
      } catch (err) {
        console.error("API error while loading reports, showing mock defaults", err);
      } finally {
        setLoading(false);
      }
    }
    fetchReports();
  }, []);

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchQuery, activeSearchField]);

  const handleProcess = (reportId) => {
    navigate(`/admin/reports/${reportId}`);
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

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredReports.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReports = filteredReports.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-card__header" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: "24px" }}>
        <h2 className="admin-panel-card__title" style={{ margin: 0 }}>전체 신고 내역 목록 ({filteredReports.length}건)</h2>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <select 
            value={searchField} 
            onChange={(e) => setSearchField(e.target.value)}
            style={{ 
              padding: "6px 12px", 
              borderRadius: "6px", 
              border: "1px solid #cbd5e1", 
              fontSize: "14px", 
              backgroundColor: "#ffffff",
              color: "#334155",
              outline: "none"
            }}
          >
            <option value="all">전체</option>
            <option value="type">유형</option>
            <option value="target">신고 대상</option>
            <option value="reporter">신고자</option>
            <option value="reason">상세 사유</option>
            <option value="status">상태</option>
          </select>
          <input 
            type="text" 
            placeholder="검색어 입력..." 
            value={tempSearchQuery}
            onChange={(e) => setTempSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{ 
              padding: "6px 12px", 
              borderRadius: "6px", 
              border: "1px solid #cbd5e1", 
              fontSize: "14px", 
              width: "350px",
              outline: "none",
              color: "#334155"
            }}
          />
          <button
            type="button"
            onClick={handleSearch}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "#3b82f6",
              color: "#ffffff",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s ease"
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#2563eb"}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#3b82f6"}
          >
            검색하기
          </button>
          <button
            type="button"
            onClick={handleReset}
            style={{
              padding: "6px 16px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
              color: "#475569",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            초기화
          </button>
        </div>
      </div>
      <div className="admin-panel-card__body">
        {feedback ? (
          <div className="admin-inline-feedback" style={{ marginBottom: "14px", padding: "10px 12px", borderRadius: "8px", background: "#eff6ff", color: "#1d4ed8", fontWeight: 700 }}>
            {feedback}
          </div>
        ) : null}
        <div className="admin-table-wrapper">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>유형</th>
                <th>신고 대상</th>
                <th>신고자</th>
                <th style={{ width: "30%" }}>상세 사유</th>
                <th>접수일</th>
                <th>상태</th>
                <th style={{ textAlign: "center" }}>액션</th>
              </tr>
            </thead>
            <tbody>
              <style>{`
                @keyframes admin-spin {
                  0% { transform: rotate(0deg); }
                  100% { transform: rotate(360deg); }
                }
              `}</style>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", padding: "50px 0" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div className="admin-loading-spinner" style={{
                        width: "32px",
                        height: "32px",
                        border: "3px solid #f3f3f3",
                        borderTop: "3px solid #3b82f6",
                        borderRadius: "50%",
                        animation: "admin-spin 1s linear infinite"
                      }}></div>
                      <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>신고 데이터를 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedReports.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", color: "#64748b", padding: "48px 24px" }}>
                    접수된 신고 내역이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedReports.map((r) => {
                  const isActionable = ["pending", "in_progress"].includes(r.rawStatus) || ["대기 중", "처리 중"].includes(r.status);
                  const stateTone = statusTone[r.rawStatus] || (r.status === "대기 중" ? "pending" : r.status === "처리 중" ? "progress" : r.status === "반려" ? "dismissed" : "resolved");
                  const badgeType = 
                    r.type === "욕설" 
                      ? "red" 
                      : r.type === "노쇼" 
                        ? "orange" 
                        : "gray";

                  return (
                    <tr key={r.id}>
                      <td>#{r.id}</td>
                      <td>
                        <span className={`admin-badge admin-badge--${badgeType}`}>
                          {r.type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{r.target}</td>
                      <td>{r.reporter}</td>
                      <td style={{ color: "#475569", fontSize: "13px", lineHeight: "1.4" }}>
                        {r.reason || "사유가 적혀있지 않습니다."}
                      </td>
                      <td style={{ color: "#64748b" }}>{r.date}</td>
                      <td>
                        <div className="admin-state-indicator">
                          <span className={`admin-state-indicator__dot admin-state-indicator__dot--${stateTone}`}></span>
                          <span className={`admin-state-indicator__text--${stateTone}`}>
                            {r.status}
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <button
                          type="button"
                          onClick={() => handleProcess(r.id)}
                          className={`admin-table-action-btn admin-table-action-btn--${isActionable ? "primary" : "outline"}`}
                          style={{ opacity: 1, cursor: "pointer" }}
                        >
                          {isActionable ? (
                            <>
                              <AlertTriangle size={13} style={{ marginRight: "4px" }} /> 처리하기
                            </>
                          ) : (
                            <>
                              <CheckCircle size={13} style={{ marginRight: "4px" }} /> 처리 내역
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages >= 1 && (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "24px" }}>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                backgroundColor: currentPage === 1 ? "#f8fafc" : "#ffffff",
                color: currentPage === 1 ? "#94a3b8" : "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                transition: "all 0.15s ease"
              }}
            >
              이전
            </button>
            
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => setCurrentPage(pageNum)}
                style={{
                  width: "32px",
                  height: "32px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "6px",
                  border: "1px solid",
                  borderColor: currentPage === pageNum ? "#2563eb" : "#e2e8f0",
                  backgroundColor: currentPage === pageNum ? "#2563eb" : "#ffffff",
                  color: currentPage === pageNum ? "#ffffff" : "#475569",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                {pageNum}
              </button>
            ))}

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              style={{
                padding: "6px 12px",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                backgroundColor: currentPage === totalPages ? "#f8fafc" : "#ffffff",
                color: currentPage === totalPages ? "#94a3b8" : "#475569",
                fontSize: "13px",
                fontWeight: 600,
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                transition: "all 0.15s ease"
              }}
            >
              다음
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminReportsPage;
