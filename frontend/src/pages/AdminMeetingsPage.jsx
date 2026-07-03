import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { Trash2, AlertCircle } from "lucide-react";

// Mock meetings data
const mockMeetings = [
  { id: 1, title: "주말 오전 11:1 축구 모임", host: "킥마스터", sport: "축구", emoji: "⚽", date: "2023.11.04", capacity: "12 / 16", status: "모집중" },
  { id: 2, title: "한강 밤 러닝 크루 모집", host: "야간러너", sport: "러닝", emoji: "🏃", date: "2023.11.02", capacity: "8 / 10", status: "모집중" },
  { id: 3, title: "단식 테니스 매칭 (초보 환영)", host: "테니스킹", sport: "테니스", emoji: "🎾", date: "2023.10.30", capacity: "2 / 2", status: "마감" },
  { id: 4, title: "퇴근 후 실내 농구 게스트", host: "농구조아", sport: "농구", emoji: "🏀", date: "2023.10.29", capacity: "10 / 10", status: "마감" }
];

function AdminMeetingsPage() {
  const navigate = useNavigate();
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchField, setSearchField] = useState("all");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [activeSearchField, setActiveSearchField] = useState("all");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  const handleSearch = () => {
    setActiveSearchField(searchField);
    setActiveSearchQuery(tempSearchQuery);
  };

  const handleReset = () => {
    setSearchField("all");
    setTempSearchQuery("");
    setActiveSearchField("all");
    setActiveSearchQuery("");
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
            emoji: m.sport ? (m.sport.name === "축구" ? "⚽" : m.sport.name === "러닝" ? "🏃" : m.sport.name === "테니스" ? "🎾" : m.sport.name === "농구" ? "🏀" : "👟") : "👟",
            date: m.start_at ? new Date(m.start_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.11.04",
            capacity: `${m.current_participants || 0} / ${m.max_participants || 0}`,
            status: m.status_label || (m.status === "full" || m.current_participants === m.max_participants ? "모집 마감" : m.status === "closed" ? "기간 마감" : m.status === "cancelled" ? "취소됨" : "모집중")
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

  const deleteMeeting = (meetingId) => {
    if (window.confirm(`모임 ID #${meetingId}을(를) 강제 삭제하시겠습니까? (이 작업은 되돌릴 수 없습니다)`)) {
      setMeetings(prev => prev.filter(m => m.id !== meetingId));
      alert("모임이 삭제되었습니다.");
    }
  };

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
                filteredMeetings.map((m) => (
                  <tr 
                    key={m.id} 
                    onClick={() => navigate(`/admin/meetings/${m.id}`)}
                    style={{ cursor: "pointer" }}
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
                      >
                        {m.status}
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteMeeting(m.id);
                        }}
                        className="admin-table-action-btn admin-table-action-btn--outline"
                        style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                      >
                        <Trash2 size={13} style={{ marginRight: "4px" }} /> 폐쇄 처리
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminMeetingsPage;
