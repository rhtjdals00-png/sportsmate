import { Headphones, MessageSquareReply, RefreshCw, Search, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import { adminApi } from "../api/adminApi";

const STATUS_OPTIONS = [
  { value: "pending", label: "접수중" },
  { value: "resolved", label: "답변 완료" }
];

const CATEGORY_LABELS = {
  general: "일반 문의",
  account: "계정",
  meeting: "모임",
  payment: "결제",
  bug: "오류 신고",
  report: "신고/분쟁"
};

function statusLabel(value) {
  if (value === "resolved") return "답변 완료";
  return "접수중";
}

function requesterLabel(item) {
  return item.user?.display_name || item.requester_name || item.requester_email || "비회원";
}

function requesterEmail(item) {
  return item.user?.email || item.requester_email || "이메일 없음";
}

function sourceLabel(value) {
  if (value === "suspended_login") return "정지계정 문의";
  if (value === "guest") return "비회원 문의";
  return "회원 문의";
}

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

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatHourMinute(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function AdminSupportPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchField, setSearchField] = useState("all");
  const [tempSearchQuery, setTempSearchQuery] = useState("");
  const [activeSearchField, setActiveSearchField] = useState("all");
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [edit, setEdit] = useState({ status: "pending", priority: "normal", admin_response: "", internal_note: "" });

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [hasReplied, setHasReplied] = useState(false);

  const loadItems = async () => {
    setLoading(true);
    setMessage("");
    setSavedFeedback("");
    try {
      const data = await adminApi.supportInquiries(statusFilter === "all" ? {} : { status: statusFilter });
      const nextItems = data.items || [];
      setItems(nextItems);
      setSelectedId((current) => {
        if (current && nextItems.some((item) => item.id === current)) {
          return current;
        }
        return null;
      });
    } catch (error) {
      setMessage(error.response?.data?.message || "문의 목록을 불러오지 못했습니다.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter]);

  const selected = items.find((item) => item.id === selectedId) || null;

  useEffect(() => {
    if (!selected) return;
    setEdit({
      status: selected.status || "pending",
      priority: selected.priority || "normal",
      admin_response: selected.admin_response || "",
      internal_note: selected.internal_note || ""
    });
  }, [selectedId, selected?.updated_at]);

  useEffect(() => {
    setShowHistoryModal(false);
    setExpandedIndex(0);
    setHasReplied(false);
  }, [selectedId]);

  const filteredItems = useMemo(() => {
    const keyword = activeSearchQuery.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const userText = `${requesterLabel(item)} ${requesterEmail(item)}`.toLowerCase();
      const titleText = item.title.toLowerCase();
      const contentText = item.content.toLowerCase();
      
      if (activeSearchField === "title") {
        return titleText.includes(keyword);
      } else if (activeSearchField === "content") {
        return contentText.includes(keyword);
      } else if (activeSearchField === "requester") {
        return userText.includes(keyword);
      } else {
        return titleText.includes(keyword) || contentText.includes(keyword) || userText.includes(keyword);
      }
    });
  }, [items, activeSearchQuery, activeSearchField]);

  const historyList = useMemo(() => {
    if (selected?.reply_history && selected.reply_history.length > 0) {
      return selected.reply_history;
    }
    if (selected?.admin_response || selected?.internal_note) {
      return [{
        admin_name: selected.admin?.nickname || selected.admin?.name || selected.admin?.email || "관리자",
        admin_email: selected.admin?.email || "",
        admin_response: selected.admin_response,
        internal_note: selected.internal_note,
        status: selected.status,
        updated_at: selected.resolved_at || selected.updated_at
      }];
    }
    return [];
  }, [selected]);

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
    setStatusFilter("all");
    setCurrentPage(1);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearchQuery, activeSearchField, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedItems = filteredItems.slice(startIndex, startIndex + itemsPerPage);

  const saveSelected = async () => {
    if (!selected || hasReplied) return;
    const isEditMode = selected?.status === "resolved";
    setSaving(true);
    setMessage("");
    try {
      const data = await adminApi.updateSupportInquiry(selected.id, {
        ...edit,
        status: "resolved"
      });
      const updated = data.item;
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setEdit((current) => ({ ...current, status: "resolved" }));
      setHasReplied(true);
      alert(isEditMode ? "답변이 수정되었습니다." : "답변이 완료되었습니다.");
    } catch (error) {
      alert(error.response?.data?.message || (isEditMode ? "답변 수정에 실패했습니다." : "답변 등록에 실패했습니다."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: "100%" }}>



      {message ? <p className="admin-support-message">{message}</p> : null}

      {selectedId ? (
        <div className="admin-panel-card" aria-label="문의 처리 상세" style={{ padding: "24px", maxWidth: "100%" }}>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #cbd5e1",
              borderRadius: "8px",
              backgroundColor: "#ffffff",
              color: "#334155",
              padding: "8px 14px",
              fontSize: "14px",
              fontWeight: 600,
              cursor: "pointer",
              marginBottom: "20px",
              transition: "all 0.15s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#f1f5f9";
              e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            <ArrowLeft size={16} /> 목록으로 돌아가기
          </button>
          {selected ? (
            <>
              <div className="admin-support-detail__head">
                <div>
                  <span>{CATEGORY_LABELS[selected.category] || selected.category}</span>
                  <h2>{selected.title}</h2>
                  <p>{sourceLabel(selected.source)} · {requesterLabel(selected)} · {requesterEmail(selected)}</p>
                </div>
              </div>
              <article className="admin-support-original">
                <span>문의 내용</span>
                <p>{selected.content}</p>
                {selected.attachment_url ? (
                  <figure className="admin-support-attachment">
                    <img src={selected.attachment_url} alt={selected.attachment_name || "문의 첨부 이미지"} />
                    <figcaption>{selected.attachment_name || "첨부 이미지"}</figcaption>
                  </figure>
                ) : null}
                <time>접수: {formatTime(selected.created_at)}</time>
              </article>
              <div className="admin-support-form">
                <label className="admin-support-form__wide">
                  <span>회원에게 보낼 답변</span>
                  <textarea rows={6} value={edit.admin_response} onChange={(event) => setEdit((current) => ({ ...current, admin_response: event.target.value }))} placeholder="답변을 입력하면 회원 알림과 문의 내역에 표시됩니다." />
                </label>
                <label className="admin-support-form__wide">
                  <span>내부 처리 메모</span>
                  <textarea rows={4} value={edit.internal_note} onChange={(event) => setEdit((current) => ({ ...current, internal_note: event.target.value }))} placeholder="관리자만 보는 처리 메모입니다." />
                </label>
                <label className="admin-support-form__wide" style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <span>처리 상태</span>
                  <div style={{
                    padding: "8px 12px",
                    borderRadius: "6px",
                    backgroundColor: "#f8fafc",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: 700,
                    color: edit.status === "resolved" ? "#16a34a" : "#dc2626",
                    width: "fit-content",
                    userSelect: "none"
                  }}>
                    {edit.status === "resolved" ? "답변 완료" : "접수중"}
                  </div>
                </label>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "10px", marginTop: "16px", width: "100%" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <button className="admin-support-save" type="button" onClick={saveSelected} disabled={saving || hasReplied}>
                    <MessageSquareReply size={16} />{" "}
                    {saving
                      ? (selected?.status === "resolved" ? "수정 중..." : "답변 중...")
                      : hasReplied
                      ? (selected?.status === "resolved" ? "수정 완료됨" : "답변 완료됨")
                      : (selected?.status === "resolved" ? "답변 수정하기" : "답변하기")}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistoryModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    border: "1px solid #cbd5e1",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    padding: "8px 14px",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = "#f1f5f9";
                    e.currentTarget.style.borderColor = "#94a3b8";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = "#ffffff";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                >
                  답변 내역 보기
                </button>
              </div>
            </>
          ) : (
            <EmptyState title="선택된 문의가 없습니다." description="왼쪽 목록에서 처리할 문의를 선택해주세요." />
          )}
        </div>
      ) : (
        <div className="admin-panel-card" aria-label="고객 문의 목록" style={{ maxWidth: "100%" }}>
          <div className="admin-panel-card__header" style={{ display: "flex", justifyContent: "flex-start", alignItems: "center", flexWrap: "wrap", gap: "24px" }}>
            <h2 className="admin-panel-card__title" style={{ margin: 0 }}>
              전체 문의 내역 목록 ({filteredItems.length}건)
            </h2>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <select 
                value={statusFilter} 
                onChange={(event) => setStatusFilter(event.target.value)}
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
                <option value="all">전체 상태</option>
                {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>

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
                <option value="requester">작성자</option>
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
          </div>

          {loading ? (
            <LoadingCards count={4} />
          ) : filteredItems.length ? (
            <>
              <div className="admin-table-wrapper" style={{ margin: "0" }}>
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: "150px" }}>제목</th>
                      <th>회원 아이디 (닉네임)</th>
                      <th>회원 상태</th>
                      <th>문의 종류</th>
                      <th>문의 일시</th>
                      <th>문의 상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => setSelectedId(item.id)}
                        style={{ cursor: "pointer" }}
                      >
                        <td>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>
                            {item.title}
                          </span>
                        </td>
                        <td>
                          {item.user ? (
                            <span>
                              {item.user.email} <span style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>({item.user.nickname})</span>
                            </span>
                          ) : item.requester_email ? (
                            <span>
                              {item.requester_email} <span style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>({item.requester_name || "비회원"})</span>
                            </span>
                          ) : (
                            <span style={{ color: "#94a3b8" }}>비회원</span>
                          )}
                        </td>
                        <td>
                          {item.user ? (
                            item.user.is_active === false || item.source === "suspended_login" ? (
                              <span style={{ color: "#dc2626", fontWeight: 600 }}>정지회원</span>
                            ) : (
                              <span style={{ color: "#16a34a", fontWeight: 600 }}>일반회원</span>
                            )
                          ) : item.source === "suspended_login" ? (
                            <span style={{ color: "#dc2626", fontWeight: 600 }}>정지회원</span>
                          ) : (
                            <span style={{ color: "#64748b", fontWeight: 600 }}>비회원</span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", fontWeight: 500 }}>
                            {CATEGORY_LABELS[item.category] || item.category}
                          </span>
                        </td>
                        <td style={{ color: "#64748b", fontWeight: 500 }}>
                          {formatDate(item.created_at)} {formatHourMinute(item.created_at)}
                        </td>
                        <td>
                          <span className={`support-inquiry-status is-${item.status}`}>
                            {statusLabel(item.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

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
            </>
          ) : (
            <div style={{ textAlign: "center", color: "#64748b", padding: "48px 24px" }}>
              검색 조건에 부합하는 문의 내역이 없습니다.
            </div>
          )}
        </div>
      )}

      {showHistoryModal && selected && (
        <div className="support-inquiry-modal" onClick={() => setShowHistoryModal(false)}>
          <div
            className="support-inquiry-modal__panel"
            onClick={(e) => e.stopPropagation()}
            style={{
              padding: "24px",
              width: "760px",
              height: "640px",
              display: "flex",
              flexDirection: "column"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "16px", marginBottom: "20px" }}>
              <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#0f172a", margin: 0 }}>답변 및 처리 내역</h3>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  fontSize: "20px",
                  fontWeight: "bold",
                  cursor: "pointer"
                }}
              >
                &times;
              </button>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", flex: 1, overflowY: "auto", paddingRight: "4px" }}>
              {historyList.length > 0 ? (
                historyList.map((hist, idx) => {
                  const isExpanded = expandedIndex === idx;
                  return (
                    <div
                      key={idx}
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        backgroundColor: "#ffffff",
                        overflow: "hidden",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                      }}
                    >
                      {/* Accordion Header */}
                      <div
                        onClick={() => setExpandedIndex(prev => prev === idx ? null : idx)}
                        style={{
                          padding: "12px 16px",
                          backgroundColor: idx === 0 ? "#f8fafc" : "#ffffff",
                          borderBottom: isExpanded ? "1px solid #e2e8f0" : "none",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          cursor: "pointer",
                          userSelect: "none"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 800,
                              backgroundColor: idx === 0 ? "#eff6ff" : "#f1f5f9",
                              color: idx === 0 ? "#2563eb" : "#64748b",
                              padding: "2px 6px",
                              borderRadius: "4px",
                            }}
                          >
                            {idx === 0 ? "최근 답변" : `이전 내역 #${historyList.length - idx}`}
                          </span>
                          <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>
                            {hist.admin_name} <span style={{ color: "#64748b", fontSize: "12px", fontWeight: 500 }}>({hist.admin_email || "이메일 없음"})</span>
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            {formatTime(hist.updated_at)}
                          </span>
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 600,
                              color: hist.status === "resolved" ? "#16a34a" : "#dc2626"
                            }}
                          >
                            {statusLabel(hist.status)}
                          </span>
                          <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "bold" }}>
                            {isExpanded ? "▲" : "▼"}
                          </span>
                        </div>
                      </div>

                      {/* Accordion Content */}
                      {isExpanded && (
                        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "14px", backgroundColor: "#fcfdfe" }}>
                          {/* Admin Response */}
                          <div>
                            <h5 style={{ fontSize: "13px", fontWeight: 800, color: "#475569", margin: "0 0 6px 0" }}>답변 내용</h5>
                            <div
                              style={{
                                padding: "12px 14px",
                                borderRadius: "6px",
                                backgroundColor: "#eff6ff",
                                border: "1px solid #bfdbfe",
                                fontSize: "13.5px",
                                color: "#1e3a8a",
                                lineHeight: "1.5",
                                whiteSpace: "pre-wrap"
                              }}
                            >
                              {hist.admin_response ? hist.admin_response : <span style={{ color: "#93c5fd" }}>등록된 답변이 없습니다.</span>}
                            </div>
                          </div>

                          {/* Internal Memo */}
                          <div>
                            <h5 style={{ fontSize: "13px", fontWeight: 800, color: "#475569", margin: "0 0 6px 0" }}>내부 처리 메모</h5>
                            <div
                              style={{
                                padding: "12px 14px",
                                borderRadius: "6px",
                                backgroundColor: "#fef3c7",
                                border: "1px solid #fde68a",
                                fontSize: "13.5px",
                                color: "#78350f",
                                lineHeight: "1.5",
                                whiteSpace: "pre-wrap"
                              }}
                            >
                              {hist.internal_note ? hist.internal_note : <span style={{ color: "#fcd34d" }}>기록된 내부 메모가 없습니다.</span>}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
                  아직 답변 처리 및 메모 기록이 없습니다.
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "24px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  backgroundColor: "#0f172a",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "14px",
                  border: "none",
                  cursor: "pointer"
                }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminSupportPage;
