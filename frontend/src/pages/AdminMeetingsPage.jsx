import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { Trash2, AlertCircle, RotateCcw } from "lucide-react";
import { useResponsive } from "../hooks/useResponsive";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { getSportEmoji } from "../utils/sportIcons.jsx";

// Mock meetings data
const mockMeetings = [
  { id: 1, title: "주말 오전 11:1 축구 모임", host: "킥마스터", sport: "축구", emoji: "⚽", date: "2023.11.04", capacity: "12 / 16", status: "모집중" },
  { id: 2, title: "한강 밤 러닝 크루 모집", host: "야간러너", sport: "러닝", emoji: "🏃", date: "2023.11.02", capacity: "8 / 10", status: "모집중" },
  { id: 3, title: "단식 테니스 매칭 (초보 환영)", host: "테니스킹", sport: "테니스", emoji: "🎾", date: "2023.10.30", capacity: "2 / 2", status: "마감" },
  { id: 4, title: "퇴근 후 실내 농구 게스트", host: "농구조아", sport: "농구", emoji: "🏀", date: "2023.10.29", capacity: "10 / 10", status: "마감" }
];

function AdminMeetingsPage() {
  const navigate = useNavigate();
  const { isMobile } = useResponsive();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState("all");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [activeSearchField, setActiveSearchField] = useState("all");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
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
    async function fetchMeetings() {
      try {
        setLoading(true);
        const res = await adminApi.meetings();
        if (res && res.items && res.items.length > 0) {
          const formatted = res.items.map(m => ({
            id: m.id,
            title: m.title || "제목 없음",
            host: m.host ? (m.host.nickname || m.host.name || `방장 #${m.host.id}`) : "알 수 없음",
            sport: m.sport ? m.sport.name : "일반",
            emoji: getSportEmoji(m.sport ? m.sport.name : ""),
            date: m.start_at ? new Date(m.start_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.11.04",
            capacity: `${m.current_participants || 0} / ${m.max_participants || 0}`,
            status: m.status_label || (m.status === "full" || m.current_participants === m.max_participants ? "모집 마감" : m.status === "closed" ? "모집종료" : m.status === "cancelled" ? "취소됨" : "모집중")
          }));
          setMeetings(formatted);
        }
      } catch (err) {
        console.error("API error while loading meetings, showing defaults", err);
      } finally {
        setLoading(false);
      }
    }
    fetchMeetings();
  }, []);

  const deleteMeeting = async (meetingId, title) => {
    if (window.confirm(`'${title || `ID #${meetingId}`}' 모임을 폐쇄 처리하시겠습니까?\n\n이 모임은 즉시 영구 삭제되지 않고 30일 동안 폐쇄 유예 상태(비활성화)로 보관되며, 이 기간 동안 모든 활동이 정지됩니다. 유예 기간 내에 언제든지 복구할 수 있습니다.`)) {
      try {
        await adminApi.deleteMeeting(meetingId);
        alert("모임이 성공적으로 폐쇄(비활성화) 처리되었습니다.");
        setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, status: "폐쇄 유예" } : m));
      } catch (err) {
        console.error("Failed to delete meeting", err);
        alert("모임 폐쇄에 실패했습니다.");
      }
    }
  };

  const restoreMeeting = async (meetingId, title) => {
    if (window.confirm(`'${title || `ID #${meetingId}`}' 모임을 정상 상태로 복구하시겠습니까?\n\n복구 즉시 모든 방 활동과 채팅방 이용이 다시 활성화됩니다.`)) {
      try {
        const res = await adminApi.restoreMeeting(meetingId);
        alert("모임이 성공적으로 복구되었습니다.");
        const newStatus = res?.meeting?.status_label || "모집중";
        setMeetings(prev => prev.map(m => m.id === meetingId ? { ...m, status: newStatus } : m));
      } catch (err) {
        console.error("Failed to restore meeting", err);
        alert("모임 복구에 실패했습니다.");
      }
    }
  };

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchQuery, activeSearchField]);

  const filteredMeetings = meetings.filter(m => {
    if (!activeSearchQuery) return true;
    const query = activeSearchQuery.toLowerCase();
    
    const titleText = m.title ? m.title.toLowerCase() : "";
    const hostText = m.host ? m.host.toLowerCase() : "";
    const sportText = m.sport ? m.sport.toLowerCase() : "";
    const statusText = m.status ? m.status.toLowerCase() : "";

    if (activeSearchField === "title") {
      return titleText.includes(query);
    } else if (activeSearchField === "host") {
      return hostText.includes(query);
    } else if (activeSearchField === "sport") {
      return sportText.includes(query);
    } else if (activeSearchField === "status") {
      return statusText.includes(query);
    } else {
      // all
      return (
        titleText.includes(query) ||
        hostText.includes(query) ||
        sportText.includes(query) ||
        statusText.includes(query)
      );
    }
  });

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(filteredMeetings.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedMeetings = filteredMeetings.slice(startIndex, startIndex + itemsPerPage);

  if (isMobile) {
    return (
      <>
        <MobileHeader title="모임 관리" />
        <div className="mobile-admin-meetings">
          <section className="mobile-admin-list-head">
            <h2>개설된 모임 목록 <span>{filteredMeetings.length}개</span></h2>
            <div>
              <select value={searchField} onChange={(e) => setSearchField(e.target.value)}>
                <option value="all">전체</option>
                <option value="title">모임명</option>
                <option value="host">개설자</option>
                <option value="sport">종목</option>
                <option value="status">상태</option>
              </select>
              <input
                type="search"
                placeholder="검색어 입력"
                value={tempSearchQuery}
                onChange={(e) => setTempSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button type="button" onClick={handleSearch}>검색</button>
            </div>
          </section>
          {loading ? (
            <div className="mobile-admin-loading">모임 데이터를 불러오는 중입니다.</div>
          ) : paginatedMeetings.length ? (
            <section className="mobile-admin-meeting-list">
              {paginatedMeetings.map((meeting) => (
                <article key={meeting.id} onClick={() => navigate(`/admin/meetings/${meeting.id}`)}>
                  <div>
                    <span>#{meeting.id}</span>
                    <em style={meeting.status === "폐쇄 유예" ? { backgroundColor: "#fef2f2", color: "#ef4444", border: "1px solid #fca5a5" } : undefined}>
                      {meeting.status}
                    </em>
                  </div>
                  <strong>{meeting.title}</strong>
                  <dl>
                    <div><dt>개설자</dt><dd>{meeting.host}</dd></div>
                    <div><dt>종목</dt><dd>{meeting.emoji} {meeting.sport}</dd></div>
                    <div><dt>날짜</dt><dd>{meeting.date}</dd></div>
                    <div><dt>정원</dt><dd>{meeting.capacity}</dd></div>
                  </dl>
                  {meeting.status === "폐쇄 유예" ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        restoreMeeting(meeting.id, meeting.title);
                      }}
                      style={{ backgroundColor: "#10b981", color: "#ffffff", border: "1px solid #10b981" }}
                    >
                      복구 처리
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        deleteMeeting(meeting.id, meeting.title);
                      }}
                    >
                      폐쇄 처리
                    </button>
                  )}
                </article>
              ))}
              
              {totalPages >= 1 && (
                <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "24px", paddingBottom: "24px" }}>
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
                      cursor: currentPage === 1 ? "not-allowed" : "pointer"
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
                        cursor: "pointer"
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
                      cursor: currentPage === totalPages ? "not-allowed" : "pointer"
                    }}
                  >
                    다음
                  </button>
                </div>
              )}
            </section>
          ) : (
            <div className="mobile-admin-loading">검색 결과 조건에 맞는 모임이 없습니다.</div>
          )}
        </div>
      </>
    );
  }

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-card__header" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: "24px" }}>
        <h2 className="admin-panel-card__title" style={{ margin: 0 }}>개설된 모임 목록 ({filteredMeetings.length}개)</h2>
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
            <option value="title">모임명</option>
            <option value="host">개설자</option>
            <option value="sport">종목</option>
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
        <div className="admin-table-wrapper">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>모임명</th>
                <th>개설자</th>
                <th>종목</th>
                <th>날짜</th>
                <th>정원</th>
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
                      <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>모임 데이터를 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : filteredMeetings.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", color: "#94a3b8", padding: "30px" }}>
                    검색 결과 조건에 맞는 모임이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedMeetings.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => navigate(`/admin/meetings/${m.id}`)}
                    style={{ 
                      cursor: "pointer",
                      backgroundColor: m.status === "폐쇄 유예" ? "#fef2f2" : undefined
                    }}
                  >
                    <td>#{m.id}</td>
                    <td style={{ fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                       {m.title}
                    </td>
                    <td>{m.host}</td>
                    <td>
                      <span className="admin-user-item__tag" style={{ padding: "3px 8px", fontSize: "12px" }}>
                        <span>{m.emoji}</span> <span>{m.sport}</span>
                      </span>
                    </td>
                    <td style={{ color: "#64748b" }}>{m.date}</td>
                    <td>{m.capacity}</td>
                    <td>
                      <span 
                        className={`admin-badge admin-badge--${m.status === "모집중" ? "orange" : "gray"}`}
                        style={m.status === "폐쇄 유예" ? { backgroundColor: "#fef2f2", color: "#ef4444", borderColor: "#fca5a5" } : undefined}
                      >
                        {m.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {m.status === "폐쇄 유예" ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            restoreMeeting(m.id, m.title);
                          }}
                          className="admin-table-action-btn admin-table-action-btn--outline"
                          style={{ color: "#10b981", borderColor: "#a7f3d0" }}
                        >
                          <RotateCcw size={13} style={{ marginRight: "4px" }} /> 복구 처리
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMeeting(m.id, m.title);
                          }}
                          className="admin-table-action-btn admin-table-action-btn--outline"
                          style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                        >
                          <Trash2 size={13} style={{ marginRight: "4px" }} /> 폐쇄 처리
                        </button>
                      )}
                    </td>
                  </tr>
                ))
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

export default AdminMeetingsPage;
