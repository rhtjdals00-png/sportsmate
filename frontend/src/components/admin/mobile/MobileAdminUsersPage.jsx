import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi } from "../../../api/adminApi";
import { User, Shield, Ban, Search, RefreshCw } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

function MobileAdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
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

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await adminApi.users();
      if (res && res.items) {
        const formatted = res.items.map(u => ({
          id: u.id,
          email: u.email || "이메일 없음",
          name: u.name || "",
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
      console.error("API error while loading users", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => {
    if (!activeSearchQuery) return true;
    const query = activeSearchQuery.toLowerCase();
    
    const emailText = u.email ? u.email.toLowerCase() : "";
    const nicknameText = u.nickname ? u.nickname.toLowerCase() : "";
    const nameText = u.name ? u.name.toLowerCase() : "";
    const tagText = u.user_tag ? u.user_tag.toLowerCase() : "";
 
    if (activeSearchField === "nickname") {
      return nicknameText.includes(query) || nameText.includes(query);
    } else if (activeSearchField === "user_tag") {
      return tagText.includes(query);
    } else if (activeSearchField === "email") {
      return emailText.includes(query);
    } else {
      return nicknameText.includes(query) || nameText.includes(query) || tagText.includes(query) || emailText.includes(query);
    }
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  return (
    <>
      <MobileHeader title="회원 관리" />
      
      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: 'var(--mobile-primary)', letterSpacing: '1px' }}>SPORTSMATE ADMIN</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>전체 회원 관리</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>회원 검색 및 정지/권한 세부 정보를 관리합니다.</p>
      </section>

      <section style={{ padding: '16px', display: 'grid', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 60px', gap: '6px' }}>
          <select 
            value={searchField} 
            onChange={(e) => setSearchField(e.target.value)}
            style={{ height: '40px', borderRadius: '12px', border: '1px solid #cbd5e1', padding: '0 4px', fontSize: '13px', backgroundColor: '#fff', fontWeight: '600' }}
          >
            <option value="all">전체</option>
            <option value="nickname">이름/닉네임</option>
            <option value="user_tag">태그</option>
            <option value="email">이메일</option>
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
              검색 결과: <strong>{filteredUsers.length}명</strong>
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
            <span style={{ fontSize: '14px', color: '#64748b' }}>데이터를 로딩 중입니다...</span>
          </div>
        ) : paginatedUsers.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#94a3b8', background: '#fff', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
            등록된 회원이 없습니다.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {paginatedUsers.map((u) => (
              <article 
                key={u.id}
                onClick={() => navigate(`/admin/users/${u.id}`)}
                style={{
                  background: '#fff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '16px',
                  padding: '14px',
                  display: 'grid',
                  gap: '8px',
                  boxShadow: '0 2px 4px rgba(0, 0, 0, 0.02)',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--mobile-primary)', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
                    #{u.id}
                  </span>
                  {u.user_tag && (
                    <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#64748b', fontWeight: '700' }}>
                      #{u.user_tag}
                    </span>
                  )}
                </div>
                
                <div>
                  <strong style={{ fontSize: '16px', color: '#1e293b' }}>{u.name || "이름 없음"}</strong>
                  <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '6px' }}>({u.nickname})</span>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#475569' }}>
                  <span>{u.email}</span>
                  {(() => {
                    const list = (u.provider || "").split(",").map(p => p.trim());
                    const hasSocial = list.includes("google") || list.includes("kakao");
                    const filtered = hasSocial ? list.filter(p => p !== "email") : list;
                    return filtered.map(trimP => {
                      if (trimP === "kakao") return <span key={trimP} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#fef3c7', color: '#d97706', fontWeight: '800' }}>카카오</span>;
                      if (trimP === "google") return <span key={trimP} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#dbeafe', color: '#2563eb', fontWeight: '800' }}>구글</span>;
                      if (trimP === "email") return <span key={trimP} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#475569', fontWeight: '800' }}>이메일</span>;
                      return null;
                    });
                  })()}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f1f5f9', paddingTop: '8px', marginTop: '4px' }}>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>가입일: {u.created_at}</span>
                  
                  {/* 역할 표시 배지 */}
                  {u.role === "superadmin" && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', backgroundColor: '#fee2e2', color: '#ef4444', padding: '2px 8px', borderRadius: '999px' }}>
                      <Shield size={10} /> 최고관리자
                    </span>
                  )}
                  {u.role === "admin" && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', backgroundColor: '#ffedd5', color: '#ea580c', padding: '2px 8px', borderRadius: '999px' }}>
                      <Shield size={10} /> 관리자
                    </span>
                  )}
                  {u.role === "user" && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', backgroundColor: '#dbeafe', color: '#2563eb', padding: '2px 8px', borderRadius: '999px' }}>
                      <User size={10} /> 일반회원
                    </span>
                  )}
                  {u.role === "suspended" && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', backgroundColor: '#fecaca', color: '#dc2626', padding: '2px 8px', borderRadius: '999px' }}>
                      <Ban size={10} /> 정지회원
                    </span>
                  )}
                  {u.role === "pending_withdrawal" && (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '800', backgroundColor: '#e2e8f0', color: '#64748b', padding: '2px 8px', borderRadius: '999px' }}>
                      <User size={10} /> 탈퇴대기
                    </span>
                  )}
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

export default MobileAdminUsersPage;
