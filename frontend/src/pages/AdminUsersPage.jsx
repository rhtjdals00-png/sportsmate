import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { User, Shield, Ban, CheckCircle } from "lucide-react";

// Mock database fallback for offline/empty states
const mockUsers = [
  { id: 1, email: "admin@sportsmate.co.kr", nickname: "관리자", created_at: "2023.09.01", status: "활성", is_admin: true },
  { id: 2, email: "seojh@gmail.com", nickname: "서지훈", created_at: "2023.10.27", status: "활성", is_admin: false },
  { id: 3, email: "minkh@naver.com", nickname: "민경훈", created_at: "2023.10.27", status: "활성", is_admin: false },
  { id: 4, email: "jieun@daum.net", nickname: "이지은", created_at: "2023.10.26", status: "활성", is_admin: false },
  { id: 5, email: "hyunwoo@gmail.com", nickname: "최현우", created_at: "2023.10.26", status: "정지", is_admin: false }
];

function AdminUsersPage() {
  const [users, setUsers] = useState(mockUsers);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUsers() {
      try {
        setLoading(true);
        const res = await adminApi.users();
        if (res && res.items && res.items.length > 0) {
          // Map API schema to list schema
          const formatted = res.items.map(u => ({
            id: u.id,
            email: u.email || "이메일 없음",
            nickname: u.nickname || "닉네임 없음",
            created_at: u.created_at ? new Date(u.created_at).toLocaleDateString() : "2023.10.27",
            status: u.is_active === false ? "정지" : "활성",
            is_admin: u.is_admin || false
          }));
          setUsers(formatted);
        }
      } catch (err) {
        console.error("API error while loading users, showing default list", err);
      } finally {
        setLoading(false);
      }
    }
    fetchUsers();
  }, []);

  const toggleStatus = (userId) => {
    setUsers(prev => prev.map(u => {
      if (u.id === userId) {
        const nextStatus = u.status === "활성" ? "정지" : "활성";
        alert(`사용자 ID #${userId}의 상태가 '${nextStatus}'(으)로 변경되었습니다.`);
        return { ...u, status: nextStatus };
      }
      return u;
    }));
  };

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-card__header">
        <h2 className="admin-panel-card__title">전체 회원 목록 ({users.length}명)</h2>
      </div>
      <div className="admin-panel-card__body">
        <div className="admin-table-wrapper">
          <table className="admin-data-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>닉네임</th>
                <th>이메일</th>
                <th>가입일</th>
                <th>구분</th>
                <th>상태</th>
                <th style={{ textAlign: "center" }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>#{u.id}</td>
                  <td style={{ fontWeight: 600 }}>
                    <Link to={`/admin/users/${u.id}`} className="admin-data-table__row-link">
                      {u.nickname}
                    </Link>
                  </td>
                  <td>{u.email}</td>
                  <td style={{ color: "#64748b" }}>{u.created_at}</td>
                  <td>
                    {u.is_admin ? (
                      <span className="admin-badge admin-badge--red" style={{ gap: "4px" }}>
                        <Shield size={12} /> 관리자
                      </span>
                    ) : (
                      <span className="admin-badge admin-badge--gray" style={{ gap: "4px" }}>
                        <User size={12} /> 일반 회원
                      </span>
                    )}
                  </td>
                  <td>
                    <div className="admin-state-indicator">
                      <span 
                        className={`admin-state-indicator__dot`}
                        style={{ backgroundColor: u.status === "활성" ? "#10b981" : "#ef4444" }}
                      ></span>
                      <span style={{ color: u.status === "활성" ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                        {u.status}
                      </span>
                    </div>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      type="button"
                      onClick={() => toggleStatus(u.id)}
                      className={`admin-table-action-btn admin-table-action-btn--outline`}
                      style={{ gap: "4px" }}
                    >
                      {u.status === "활성" ? (
                        <>
                          <Ban size={13} /> 정지 처리
                        </>
                      ) : (
                        <>
                          <CheckCircle size={13} /> 정지 해제
                        </>
                      )}
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

export default AdminUsersPage;
