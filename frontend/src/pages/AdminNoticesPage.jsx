import { Megaphone, RefreshCw, Search, Plus, Edit, Trash2, ArrowLeft, Pin } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import { adminApi } from "../api/adminApi";

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function AdminNoticesPage() {
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [searchField, setSearchField] = useState("all");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  
  const [activeSearchField, setActiveSearchField] = useState("all");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  
  // Form view states
  const [view, setView] = useState("list"); // 'list', 'create', 'edit'
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [form, setForm] = useState({ title: "", content: "", is_pinned: false });
  const [submitting, setSubmitting] = useState(false);

  const fetchNotices = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getNotices();
      setNotices(data || []);
    } catch (error) {
      console.error("Failed to fetch admin notices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotices();
  }, []);

  const handleCreate = () => {
    setForm({ title: "", content: "", is_pinned: false });
    setView("create");
  };

  const handleEdit = (notice) => {
    setSelectedNotice(notice);
    setForm({
      title: notice.title || "",
      content: notice.content || "",
      is_pinned: notice.is_pinned || false
    });
    setView("edit");
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      alert("제목과 내용을 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      if (view === "create") {
        await adminApi.createNotice(form);
        alert("공지사항이 등록되었습니다.");
      } else {
        await adminApi.updateNotice(selectedNotice.id, form);
        alert("공지사항이 수정되었습니다.");
      }
      setView("list");
      fetchNotices();
    } catch (error) {
      alert(error.response?.data?.message || "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (noticeId, title) => {
    if (!window.confirm(`'${title}' 공지사항을 삭제하시겠습니까?`)) {
      return;
    }
    try {
      await adminApi.deleteNotice(noticeId);
      alert("공지사항이 삭제되었습니다.");
      if (view === "detail") {
        setView("list");
        setSelectedNotice(null);
      }
      fetchNotices();
    } catch (error) {
      alert(error.response?.data?.message || "삭제에 실패했습니다.");
    }
  };

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

  const filteredNotices = useMemo(() => {
    let result = notices;

    // Filter by Query
    const query = activeSearchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(n => {
        const titleText = (n.title || "").toLowerCase();
        const contentText = (n.content || "").toLowerCase();
        const authorText = (n.author || "").toLowerCase();

        if (activeSearchField === "title") {
          return titleText.includes(query);
        } else if (activeSearchField === "content") {
          return contentText.includes(query);
        } else if (activeSearchField === "author") {
          return authorText.includes(query);
        } else {
          return titleText.includes(query) || contentText.includes(query) || authorText.includes(query);
        }
      });
    }

    return result;
  }, [notices, activeSearchField, activeSearchQuery]);

  return (
    <div style={{ maxWidth: "100%" }}>
      
      {view === "list" ? (
        <div className="admin-panel-card" style={{ padding: "30px", borderRadius: "16px", backgroundColor: "#ffffff" }}>
          
          {/* Header row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
              <Megaphone size={20} style={{ color: "#3b82f6" }} />
              공지사항 관리
            </h2>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={fetchNotices}
                disabled={loading}
                style={{
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#64748b",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "13px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontWeight: 600
                }}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                새로고침
              </button>
              <button
                type="button"
                onClick={handleCreate}
                style={{
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
                }}
              >
                <Plus size={16} />
                공지사항 등록
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ display: "flex", gap: "10px", alignItems: "center", marginBottom: "20px" }}>

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
              <option value="title">제목</option>
              <option value="content">내용</option>
              <option value="author">작성자</option>
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
                width: "300px",
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
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 0.2s ease"
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
                backgroundColor: "#ffffff",
                color: "#475569",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                transition: "background-color 0.2s ease"
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f1f5f9"}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
            >
              초기화
            </button>
          </div>

          {/* Table */}
          {loading ? (
            <LoadingCards count={3} />
          ) : filteredNotices.length ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "14px" }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #e2e8f0", color: "#64748b", fontWeight: 700 }}>
                    <th style={{ padding: "12px 16px" }}>고정</th>
                    <th style={{ padding: "12px 16px" }}>제목</th>
                    <th style={{ padding: "12px 16px" }}>작성자</th>
                    <th style={{ padding: "12px 16px" }}>작성일</th>
                    <th style={{ padding: "12px 16px", textAlign: "right" }}>관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredNotices.map((notice) => (
                    <tr 
                      key={notice.id} 
                      onClick={() => {
                        setSelectedNotice(notice);
                        setView("detail");
                      }}
                      style={{ 
                        borderBottom: "1px solid #f1f5f9", 
                        backgroundColor: notice.is_pinned ? "#fffafb" : "transparent",
                        cursor: "pointer",
                        transition: "background-color 0.15s ease"
                      }}
                      className="notice-row"
                    >
                      <td style={{ padding: "14px 16px" }}>
                        {notice.is_pinned ? <Pin size={16} style={{ color: "#ef4444", fill: "#ef4444" }} /> : "-"}
                      </td>
                      <td style={{ padding: "14px 16px", fontWeight: notice.is_pinned ? 700 : 500 }}>
                        <span style={{ color: "#1e293b" }}>{notice.title}</span>
                      </td>
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>
                        {notice.author}
                      </td>
                      <td style={{ padding: "14px 16px", color: "#64748b" }}>
                        {formatTime(notice.created_at)}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleEdit(notice); }}
                            style={{
                              border: "1px solid #cbd5e1",
                              backgroundColor: "#ffffff",
                              color: "#2563eb",
                              cursor: "pointer",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 600
                            }}
                          >
                            <Edit size={12} /> 수정
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(notice.id, notice.title); }}
                            style={{
                              border: "1px solid #fca5a5",
                              backgroundColor: "#ffffff",
                              color: "#ef4444",
                              cursor: "pointer",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "12px",
                              fontWeight: 600
                            }}
                          >
                            <Trash2 size={12} /> 삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="등록된 공지사항이 없습니다." description="새 공지사항 등록 버튼을 눌러 등록해 보세요." />
          )}

        </div>
      ) : view === "detail" ? (
        /* Detail view card */
        <div className="admin-panel-card" style={{ padding: "30px", borderRadius: "16px", backgroundColor: "#ffffff" }}>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", borderBottom: "1px solid #f1f5f9", paddingBottom: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <button
                type="button"
                onClick={() => { setView("list"); setSelectedNotice(null); }}
                style={{
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  cursor: "pointer",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600
                }}
              >
                <ArrowLeft size={14} /> 목록으로
              </button>
              <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#1e293b" }}>공지사항 상세</h2>
            </div>
            
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleEdit(selectedNotice)}
                style={{
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#2563eb",
                  cursor: "pointer",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600
                }}
              >
                <Edit size={14} /> 수정
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selectedNotice.id, selectedNotice.title)}
                style={{
                  border: "1px solid #fca5a5",
                  backgroundColor: "#ffffff",
                  color: "#ef4444",
                  cursor: "pointer",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "13px",
                  fontWeight: 600
                }}
              >
                <Trash2 size={14} /> 삭제
              </button>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {selectedNotice?.is_pinned && (
                  <span style={{
                    background: "#ef4444",
                    color: "#ffffff",
                    fontSize: "11px",
                    fontWeight: 800,
                    padding: "3px 8px",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}>
                    <Pin size={10} style={{ fill: "#ffffff" }} /> 상단 고정
                  </span>
                )}
                <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1e293b" }}>{selectedNotice?.title}</h3>
              </div>
              <div style={{ display: "flex", gap: "16px", fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                <span>작성자: <strong style={{ color: "#334155" }}>{selectedNotice?.author}</strong></span>
                <span>작성일시: <strong style={{ color: "#334155" }}>{formatTime(selectedNotice?.created_at)}</strong></span>
              </div>
            </div>

            <div style={{
              padding: "24px",
              backgroundColor: "#f8fafc",
              borderRadius: "12px",
              border: "1px solid #e2e8f0",
              fontSize: "15px",
              color: "#334155",
              lineHeight: "1.7",
              whiteSpace: "pre-wrap",
              minHeight: "200px"
            }}>
              {selectedNotice?.content}
            </div>
          </div>

        </div>
      ) : (
        /* Form view for Create / Edit */
        <div className="admin-panel-card" style={{ padding: "30px", borderRadius: "16px", backgroundColor: "#ffffff" }}>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
            <button
              type="button"
              onClick={() => setView(view === "edit" ? "detail" : "list")}
              style={{
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#334155",
                cursor: "pointer",
                padding: "8px 14px",
                borderRadius: "8px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600
              }}
            >
              <ArrowLeft size={14} /> 목록으로
            </button>
            <h2 style={{ margin: 0, fontSize: "20px", fontWeight: 900, color: "#1e293b" }}>
              {view === "create" ? "공지사항 등록" : "공지사항 수정"}
            </h2>
          </div>

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Title field */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>제목</label>
              <input
                type="text"
                placeholder="공지사항 제목을 입력해주세요"
                value={form.title}
                onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Content field */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155" }}>내용</label>
              <textarea
                placeholder="공지사항 상세 내용을 입력해주세요"
                value={form.content}
                rows={12}
                onChange={(e) => setForm(prev => ({ ...prev, content: e.target.value }))}
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "14px",
                  outline: "none",
                  resize: "vertical",
                  lineHeight: "1.6",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Pin option toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "#f8fafc", padding: "14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
              <input
                type="checkbox"
                id="is_pinned"
                checked={form.is_pinned}
                onChange={(e) => setForm(prev => ({ ...prev, is_pinned: e.target.checked }))}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="is_pinned" style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}>
                <Pin size={14} style={{ color: "#ef4444", fill: form.is_pinned ? "#ef4444" : "none" }} />
                공지사항 상단 고정하기
              </label>
            </div>

            {/* Buttons */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "20px" }}>
              <button
                type="button"
                onClick={() => setView(view === "edit" ? "detail" : "list")}
                style={{
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#334155",
                  cursor: "pointer",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 600
                }}
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                style={{
                  border: "none",
                  backgroundColor: "#2563eb",
                  color: "#ffffff",
                  cursor: "pointer",
                  padding: "12px 28px",
                  borderRadius: "8px",
                  fontSize: "14px",
                  fontWeight: 700,
                  boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
                }}
              >
                {submitting ? "저장 중..." : "공지 저장"}
              </button>
            </div>

          </form>

        </div>
      )}

      {/* Styles */}
      <style>{`
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>

    </div>
  );
}

export default AdminNoticesPage;
