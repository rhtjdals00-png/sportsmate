import { Megaphone, RefreshCw, Search, Plus, Edit, Trash2, ArrowLeft, Pin, FileText } from "lucide-react";
import React, { useEffect, useState, useMemo } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { adminApi } from "../../../api/adminApi";

function formatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function MobileAdminNoticesPage() {
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
      alert(error?.response?.data?.message || "저장에 실패했습니다.");
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
      setView("list");
      fetchNotices();
    } catch (error) {
      alert(error?.response?.data?.message || "삭제에 실패했습니다.");
    }
  };

  const handleSearch = () => {
    setActiveSearchField(searchField);
    setActiveSearchQuery(tempSearchQuery);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const filteredNotices = useMemo(() => {
    let result = notices;
    const query = activeSearchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(n => {
        const titleText = (n.title || "").toLowerCase();
        const contentText = (n.content || "").toLowerCase();
        const authorText = (n.author || "").toLowerCase();
        if (activeSearchField === "title") return titleText.includes(query);
        if (activeSearchField === "content") return contentText.includes(query);
        if (activeSearchField === "author") return authorText.includes(query);
        return titleText.includes(query) || contentText.includes(query) || authorText.includes(query);
      });
    }
    return result;
  }, [notices, activeSearchField, activeSearchQuery]);

  if (view === "create" || view === "edit") {
    return (
      <>
        <MobileHeader 
          title={view === "create" ? "새 공지사항" : "공지사항 수정"} 
          onBack={() => setView("list")}
        />
        <div className="mobile-admin-form-container" style={{ padding: "16px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <label style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>제목</label>
              <input
                type="text"
                placeholder="공지사항 제목을 입력하세요"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "15px" }}
              />
            </div>
            
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#334155", padding: "8px 0" }}>
              <input 
                type="checkbox" 
                checked={form.is_pinned}
                onChange={(e) => setForm({ ...form, is_pinned: e.target.checked })}
                style={{ width: "18px", height: "18px" }}
              />
              <span style={{ fontWeight: 600 }}>상단 고정 (중요 공지)</span>
            </label>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
              <label style={{ fontSize: "14px", fontWeight: 600, color: "#334155" }}>내용</label>
              <textarea
                placeholder="공지사항 내용을 입력하세요"
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                style={{ padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "15px", minHeight: "250px", resize: "vertical" }}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: "16px",
                padding: "14px",
                backgroundColor: submitting ? "#93c5fd" : "#2563eb",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontSize: "16px",
                fontWeight: 700,
                width: "100%"
              }}
            >
              {submitting ? "저장 중..." : (view === "create" ? "등록하기" : "저장하기")}
            </button>
          </form>
        </div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="공지사항 관리" />
      <div className="mobile-admin-meetings" style={{ paddingBottom: "24px", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
        
        {/* Mobile Search/Filter Section */}
        <section className="mobile-admin-list-head" style={{ padding: "16px", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#1e293b" }}>공지 목록 <span>{filteredNotices.length}건</span></h2>
            <button 
              onClick={handleCreate}
              style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#2563eb", color: "#fff", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 600 }}
            >
              <Plus size={14} /> 작성
            </button>
          </div>
          
          <div style={{ display: "flex", gap: "8px" }}>
            <select 
              value={searchField} 
              onChange={(e) => setSearchField(e.target.value)}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "#fff", flex: 1 }}
            >
              <option value="all">전체</option>
              <option value="title">제목</option>
              <option value="content">내용</option>
              <option value="author">작성자</option>
            </select>
            <input
              type="search"
              placeholder="검색어 입력"
              value={tempSearchQuery}
              onChange={(e) => setTempSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              style={{ padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", flex: 2 }}
            />
            <button type="button" onClick={handleSearch} style={{ backgroundColor: "#334155", color: "#fff", border: "none", padding: "0 12px", borderRadius: "6px", fontSize: "13px" }}>검색</button>
          </div>
        </section>

        {/* List Section */}
        <section style={{ padding: "16px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 8px" }} />
              <p>로딩 중...</p>
            </div>
          ) : filteredNotices.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", backgroundColor: "#fff", borderRadius: "8px" }}>
              <FileText size={32} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
              <p style={{ margin: 0, fontWeight: 500 }}>공지사항이 없습니다.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {filteredNotices.map((n) => (
                <div key={n.id} style={{ padding: "16px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "8px" }}>
                    <h3 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#1e293b", lineHeight: 1.4, display: "flex", alignItems: "center", gap: "6px" }}>
                      {n.is_pinned && <Pin size={14} fill="#ef4444" color="#ef4444" />}
                      {n.title}
                    </h3>
                  </div>
                  
                  <div style={{ display: "flex", gap: "12px", fontSize: "13px", color: "#64748b", marginBottom: "12px" }}>
                    <span>{n.author}</span>
                    <span>{formatTime(n.created_at)}</span>
                  </div>
                  
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                    <button 
                      onClick={() => handleEdit(n)}
                      style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#f1f5f9", color: "#475569", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 600 }}
                    >
                      <Edit size={14} /> 수정
                    </button>
                    <button 
                      onClick={() => handleDelete(n.id, n.title)}
                      style={{ display: "flex", alignItems: "center", gap: "4px", backgroundColor: "#fef2f2", color: "#ef4444", border: "none", padding: "6px 12px", borderRadius: "6px", fontSize: "13px", fontWeight: 600 }}
                    >
                      <Trash2 size={14} /> 삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

export default MobileAdminNoticesPage;
