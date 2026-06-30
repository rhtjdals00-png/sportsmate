import { useState, useEffect } from "react";
import { adminApi } from "../api/adminApi";
import { CheckCircle, AlertTriangle } from "lucide-react";

// Mock reports database
const mockReports = [
  { id: 1, type: "욕설", target: "User_FC02", reporter: "킥마스터", reason: "대화방에서 지속적인 언어폭력과 인격 모독을 자행함", date: "2023.10.27", status: "대기 중" },
  { id: 2, type: "노쇼", target: "러닝초보", reporter: "야간러너", date: "2023.10.26", reason: "모임 시간 직전 무단 탈퇴 후 당일 연락 두절", status: "대기 중" },
  { id: 3, type: "기타", target: "스팸계정99", reporter: "농구조아", date: "2023.10.25", reason: "프로필 소개란에 음란성 도배 광고 링크 게재", status: "처리 완료" },
  { id: 4, type: "욕설", target: "화난사람", reporter: "테니스킹", date: "2023.10.24", reason: "댓글란에 비속어 작성 및 시비조 댓글 반복 작성", status: "처리 완료" }
];

function AdminReportsPage() {
  const [reports, setReports] = useState(mockReports);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReports() {
      try {
        setLoading(true);
        const res = await adminApi.reports();
        if (res && res.items) {
          const formatted = res.items.map((r, index) => ({
            id: r.id || index + 1,
            type: r.reason || "기타",
            target: r.target_name || r.target_type || `대상 #${r.target_id || ""}`,
            reporter: r.reporter_name || "신고자",
            reason: r.reason_detail || "상세 사유가 제공되지 않았습니다.",
            date: r.created_at ? new Date(r.created_at).toLocaleDateString() : "2023.10.27",
            status: r.status === "pending" || r.status === "대기 중" ? "대기 중" : "처리 완료"
          }));
          setReports(formatted);
        }
      } catch (err) {
        console.error("API error while loading reports, showing mock defaults", err);
      } finally {
        setLoading(false);
      }
    }
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

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-card__header">
        <h2 className="admin-panel-card__title">전체 신고 내역 목록 ({reports.length}건)</h2>
      </div>
      <div className="admin-panel-card__body">
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
              {reports.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: "center", color: "#64748b", padding: "48px 24px" }}>
                    접수된 신고 내역이 없습니다.
                  </td>
                </tr>
              ) : reports.map((r) => {
                const isWaiting = r.status === "대기 중";
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
                        <span className={`admin-state-indicator__dot admin-state-indicator__dot--${isWaiting ? "waiting" : "done"}`}></span>
                        <span className={`admin-state-indicator__text--${isWaiting ? "waiting" : "done"}`}>
                          {r.status}
                        </span>
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <button
                        type="button"
                        onClick={() => handleProcess(r.id)}
                        disabled={!isWaiting}
                        className={`admin-table-action-btn admin-table-action-btn--${isWaiting ? "primary" : "outline"}`}
                        style={{ opacity: isWaiting ? 1 : 0.6, cursor: isWaiting ? "pointer" : "default" }}
                      >
                        {isWaiting ? (
                          <>
                            <AlertTriangle size={13} style={{ marginRight: "4px" }} /> 처리하기
                          </>
                        ) : (
                          <>
                            <CheckCircle size={13} style={{ marginRight: "4px" }} /> 처리 완료됨
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default AdminReportsPage;
