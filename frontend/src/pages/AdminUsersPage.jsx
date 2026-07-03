import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { User, Shield, Ban, CheckCircle } from "lucide-react";

// Mock database fallback for offline/empty states
const mockUsers = [
  { id: 1, email: "admin@sportsmate.co.kr", nickname: "최고관리자", created_at: "2023.09.01", user_tag: "0001", provider: "email", role: "superadmin" },
  { id: 2, email: "seojh@gmail.com", nickname: "서지훈", created_at: "2023.10.27", user_tag: "1004", provider: "google", role: "user" },
  { id: 3, email: "minkh@naver.com", nickname: "민경훈", created_at: "2023.10.27", user_tag: "2048", provider: "kakao", role: "user" },
  { id: 4, email: "jieun@daum.net", nickname: "이지은", created_at: "2023.10.26", user_tag: "7777", provider: "email", role: "admin" },
  { id: 5, email: "hyunwoo@gmail.com", nickname: "최현우", created_at: "2023.10.26", user_tag: "9999", provider: "google", role: "suspended" }
];

function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
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
    async function fetchUsers() {
      try {
        setLoading(true);
        const res = await adminApi.users();
        if (res && res.items && res.items.length > 0) {
          console.log("res.items in fetchUsers:", res.items);
          // Map API schema to list schema
          const formatted = res.items.map(u => ({
            id: u.id,
            email: u.email || "이메일 없음",
            nickname: u.nickname || "닉네임 없음",
            user_tag: u.user_tag || "",
            provider: u.provider || "email",
            role: u.role || "user",
            created_at: u.created_at ? new Date(u.created_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.10.27",
            status: u.is_active === false ? "정지" : "활성"
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

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchQuery, activeSearchField]);

  const filteredUsers = users.filter(u => {
    if (!activeSearchQuery) return true;
    const query = activeSearchQuery.toLowerCase();
    
    let roleText = "";
    if (u.role === "superadmin") roleText = "최고관리자";
    else if (u.role === "admin") roleText = "관리자";
    else if (u.role === "user") roleText = "일반회원";
    else if (u.role === "suspended") roleText = "정지회원";
    else if (u.role === "pending_withdrawal") roleText = "탈퇴대기회원";

    const emailText = u.email ? u.email.toLowerCase() : "";
    const nicknameText = u.nickname ? u.nickname.toLowerCase() : "";
    const tagText = u.user_tag ? u.user_tag.toLowerCase() : "";

    if (activeSearchField === "nickname") {
      return nicknameText.includes(query);
    } else if (activeSearchField === "user_tag") {
      return tagText.includes(query);
    } else if (activeSearchField === "email") {
      return emailText.includes(query);
    } else if (activeSearchField === "role") {
      return roleText.includes(query);
    } else {
      // all
      return (
        nicknameText.includes(query) ||
        tagText.includes(query) ||
        emailText.includes(query) ||
        roleText.includes(query)
      );
    }
  });

  // Pagination slice
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="admin-panel-card">
      <div className="admin-panel-card__header" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: "24px" }}>
        <h2 className="admin-panel-card__title" style={{ margin: 0 }}>전체 회원 목록 ({filteredUsers.length}명)</h2>
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
            <option value="nickname">닉네임</option>
            <option value="user_tag">태그</option>
            <option value="email">이메일</option>
            <option value="role">구분</option>
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
                <th>닉네임</th>
                <th>태그</th>
                <th>이메일</th>
                <th>가입일</th>
                <th>구분</th>
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
                  <td colSpan="6" style={{ textAlign: "center", padding: "50px 0" }}>
                    <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
                      <div className="admin-loading-spinner" style={{
                        width: "32px",
                        height: "32px",
                        border: "3px solid #f3f3f3",
                        borderTop: "3px solid #3b82f6",
                        borderRadius: "50%",
                        animation: "admin-spin 1s linear infinite"
                      }}></div>
                      <span style={{ fontSize: "14px", color: "#64748b", fontWeight: 500 }}>회원 데이터를 불러오는 중...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: "center", color: "#94a3b8", padding: "30px" }}>
                    등록된 회원이 없습니다.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr 
                    key={u.id} 
                    onClick={() => navigate(`/admin/users/${u.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <td>#{u.id}</td>
                    <td style={{ fontWeight: 600 }}>
                      {u.nickname}
                    </td>
                    <td>
                      {u.user_tag ? (
                        <span style={{ color: "#64748b", fontFamily: "monospace", fontWeight: 500 }}>
                          #{u.user_tag}
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span>{u.email}</span>
                        {(() => {
                          const list = (u.provider || "").split(",").map(p => p.trim());
                          const hasSocial = list.includes("google") || list.includes("kakao");
                          const filtered = hasSocial ? list.filter(p => p !== "email") : list;
                          return filtered.map(trimP => {
                            if (trimP === "kakao") return <span key={trimP} className="admin-badge admin-badge--orange" style={{ fontSize: "10px", padding: "1px 5px", lineHeight: 1.2, marginLeft: "4px" }}>카카오</span>;
                            if (trimP === "google") return <span key={trimP} className="admin-badge admin-badge--blue" style={{ fontSize: "10px", padding: "1px 5px", lineHeight: 1.2, marginLeft: "4px" }}>구글</span>;
                            if (trimP === "email") return <span key={trimP} className="admin-badge admin-badge--gray" style={{ fontSize: "10px", padding: "1px 5px", lineHeight: 1.2, marginLeft: "4px" }}>이메일</span>;
                            return null;
                          });
                        })()}
                      </div>
                    </td>
                    <td style={{ color: "#64748b" }}>{u.created_at}</td>
                    <td>
                      {u.role === "superadmin" && (
                        <span className="admin-badge admin-badge--red" style={{ gap: "4px" }}>
                          <Shield size={12} /> 최고관리자
                        </span>
                      )}
                      {u.role === "admin" && (
                        <span className="admin-badge admin-badge--orange" style={{ gap: "4px", backgroundColor: "#ffedd5", color: "#ea580c" }}>
                          <Shield size={12} /> 관리자
                        </span>
                      )}
                      {u.role === "user" && (
                        <span className="admin-badge admin-badge--blue" style={{ gap: "4px" }}>
                          <User size={12} /> 일반회원
                        </span>
                      )}
                      {u.role === "suspended" && (
                        <span className="admin-badge admin-badge--red" style={{ gap: "4px", backgroundColor: "#fecaca", color: "#ef4444" }}>
                          <Ban size={12} /> 정지회원
                        </span>
                      )}
                      {u.role === "pending_withdrawal" && (
                        <span className="admin-badge admin-badge--gray" style={{ gap: "4px", backgroundColor: "#e2e8f0", color: "#64748b" }}>
                          <User size={12} /> 탈퇴대기회원
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
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

export default AdminUsersPage;
