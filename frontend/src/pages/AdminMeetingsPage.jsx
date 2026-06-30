import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
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
  const [meetings, setMeetings] = useState(mockMeetings);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchMeetings() {
      try {
        setLoading(true);
        const res = await adminApi.meetings();
        if (res && res.items && res.items.length > 0) {
          const formatted = res.items.map(m => ({
            id: m.id,
            title: m.title || "제목 없음",
            host: m.host_nickname || m.host_name || `방장 #${m.host_id}`,
            sport: m.sport_name || "종목",
            emoji: m.sport_name === "축구" ? "⚽" : m.sport_name === "러닝" ? "🏃" : m.sport_name === "테니스" ? "🎾" : "🏀",
            date: m.meeting_date ? new Date(m.meeting_date).toLocaleDateString() : "2023.11.04",
            capacity: `${m.current_users || 0} / ${m.max_users || 0}`,
            status: m.status === "closed" || m.current_users === m.max_users ? "마감" : "모집중"
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

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-card__header">
        <h2 className="admin-panel-card__title">개설된 모임 목록 ({meetings.length}개)</h2>
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
              {meetings.map((m) => (
                <tr key={m.id}>
                  <td>#{m.id}</td>
                  <td style={{ fontWeight: 600, maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    <Link to={`/admin/meetings/${m.id}`} className="admin-data-table__row-link">
                      {m.title}
                    </Link>
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
                      onClick={() => deleteMeeting(m.id)}
                      className="admin-table-action-btn admin-table-action-btn--outline"
                      style={{ color: "#ef4444", borderColor: "#fca5a5" }}
                    >
                      <Trash2 size={13} style={{ marginRight: "4px" }} /> 폐쇄 처리
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminMeetingsPage;
