import React, { useState, useEffect } from "react";
import { 
  ClipboardList, 
  Search, 
  RefreshCw, 
  Filter, 
  ChevronLeft, 
  ChevronRight,
  Shield,
  Calendar,
  AlertCircle
} from "lucide-react";
import { adminApi } from "../api/adminApi";

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedActionType, setSelectedActionType] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Load audit logs
  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getAuditLogs();
      setLogs(data);
    } catch (err) {
      console.error("Failed to load audit logs", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter types based on logs content
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

  // Filtering logs
  const filteredLogs = logs.filter((log) => {
    const matchesSearch = 
      log.admin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (log.action_type && log.action_type.toLowerCase().includes(searchQuery.toLowerCase()));
      
    const matchesType = !selectedActionType || log.action_type === selectedActionType;
    return matchesSearch && matchesType;
  });

  // Latest logs first (reverse order)
  const reversedLogs = [...filteredLogs].reverse();

  // Pagination
  const totalPages = Math.max(Math.ceil(reversedLogs.length / itemsPerPage), 1);
  
  // Reset to first page if search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedActionType]);

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = reversedLogs.slice(indexOfFirstItem, indexOfLastItem);

  // Helper for Badge styles
  const getBadgeStyle = (actionType) => {
    const base = {
      padding: "4px 10px",
      borderRadius: "12px",
      fontSize: "11px",
      fontWeight: 700,
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      textTransform: "uppercase"
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
      case "설정 변경":
        return { ...base, backgroundColor: "#faf5ff", color: "#6b21a8", border: "1px solid #f3e8ff" };
      case "개별 알림 발송":
      case "단체 알림 발송":
        return { ...base, backgroundColor: "#f0fdfa", color: "#0f766e", border: "1px solid #ccfbf1" };
      default:
        return { ...base, backgroundColor: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" };
    }
  };

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "calc(100vh - 160px)",
      gap: "20px",
      boxSizing: "border-box",
      padding: "2px"
    }}>
      {/* Control bar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: "12px",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#ffffff",
        padding: "16px 24px",
        borderRadius: "16px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px 0 rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <ClipboardList size={20} style={{ color: "#3b82f6" }} />
          <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a", margin: 0 }}>
            어드민 작업 로그 모니터링
          </h2>
        </div>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Search Input */}
          <div style={{ position: "relative", width: "240px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="관리자명, 작업내용 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                fontSize: "13px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                outline: "none",
                boxSizing: "border-box",
                transition: "border-color 0.2s"
              }}
              onFocus={(e) => e.target.style.borderColor = "#3b82f6"}
              onBlur={(e) => e.target.style.borderColor = "#cbd5e1"}
            />
          </div>

          {/* Action Type Filter */}
          <div style={{ position: "relative" }}>
            <select
              value={selectedActionType}
              onChange={(e) => setSelectedActionType(e.target.value)}
              style={{
                padding: "8px 32px 8px 12px",
                fontSize: "13px",
                border: "1px solid #cbd5e1",
                borderRadius: "8px",
                outline: "none",
                backgroundColor: "#ffffff",
                cursor: "pointer",
                appearance: "none",
                minWidth: "150px"
              }}
            >
              {actionTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            <Filter size={14} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none" }} />
          </div>

          {/* Refresh button */}
          <button
            onClick={fetchLogs}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              backgroundColor: "#f8fafc",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              fontSize: "13px",
              color: "#334155",
              cursor: loading ? "not-allowed" : "pointer",
              fontWeight: 600,
              transition: "background-color 0.15s"
            }}
            onMouseOver={(e) => { if(!loading) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
            onMouseOut={(e) => { if(!loading) e.currentTarget.style.backgroundColor = "#f8fafc"; }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            새로고침
          </button>
        </div>
      </div>

      {/* Main logs list panel */}
      <div className="admin-panel-card" style={{
        padding: "24px 30px",
        borderRadius: "16px",
        backgroundColor: "#ffffff",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        boxSizing: "border-box",
        overflow: "hidden"
      }}>
        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#64748b", gap: "10px" }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: "#3b82f6" }} />
            <span style={{ fontSize: "14px" }}>작업 이력 로그를 불러오는 중...</span>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#94a3b8", gap: "12px" }}>
            <AlertCircle size={36} style={{ color: "#cbd5e1" }} />
            <span style={{ fontSize: "14px" }}>일치하거나 기록된 관리자 작업 이력이 없습니다.</span>
          </div>
        ) : (
          <>
            {/* Table Area */}
            <div style={{ flex: 1, overflowY: "auto", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #f1f5f9" }}>
                    <th style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#475569", width: "160px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Calendar size={13} /> 발생 시각</span>
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#475569", width: "150px" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}><Shield size={13} /> 담당 관리자</span>
                    </th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#475569", width: "120px" }}>작업 분류</th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#475569" }}>작업 상세 상세 설명</th>
                    <th style={{ padding: "12px 16px", fontSize: "13px", fontWeight: 700, color: "#475569", width: "100px", textAlign: "right" }}>대상 ID</th>
                  </tr>
                </thead>
                <tbody>
                  {currentLogs.map((log, index) => (
                    <tr 
                      key={index} 
                      style={{ 
                        borderBottom: "1px solid #f1f5f9", 
                        transition: "background-color 0.15s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#64748b", fontWeight: 500 }}>
                        {log.timestamp}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#1e293b", fontWeight: 700 }}>
                        {log.admin}
                      </td>
                      <td style={{ padding: "14px 16px" }}>
                        <span style={getBadgeStyle(log.action_type)}>
                          {log.action_type || "기타"}
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>
                        {log.description}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: "13px", color: "#64748b", fontWeight: 700, textAlign: "right" }}>
                        {log.target_id !== null && log.target_id !== undefined ? `#${log.target_id}` : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "16px",
              borderTop: "1px solid #e2e8f0"
            }}>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                검색 결과: 총 <strong>{reversedLogs.length}</strong>건 중 <strong>{indexOfFirstItem + 1}-{Math.min(indexOfLastItem, reversedLogs.length)}</strong>건 표시
              </span>
              
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: currentPage === 1 ? "#f1f5f9" : "#ffffff",
                    color: currentPage === 1 ? "#94a3b8" : "#334155",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    transition: "background-color 0.15s"
                  }}
                  onMouseOver={(e) => { if(currentPage !== 1) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                  onMouseOut={(e) => { if(currentPage !== 1) e.currentTarget.style.backgroundColor = "#ffffff"; }}
                >
                  <ChevronLeft size={16} />
                </button>
                
                <span style={{ fontSize: "13px", color: "#334155", fontWeight: 700, minWidth: "45px", textAlign: "center" }}>
                  {currentPage} / {totalPages}
                </span>
                
                <button
                  type="button"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: currentPage === totalPages ? "#f1f5f9" : "#ffffff",
                    color: currentPage === totalPages ? "#94a3b8" : "#334155",
                    cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                    transition: "background-color 0.15s"
                  }}
                  onMouseOver={(e) => { if(currentPage !== totalPages) e.currentTarget.style.backgroundColor = "#f1f5f9"; }}
                  onMouseOut={(e) => { if(currentPage !== totalPages) e.currentTarget.style.backgroundColor = "#ffffff"; }}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
