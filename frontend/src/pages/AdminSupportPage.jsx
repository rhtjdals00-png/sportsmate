import { Headphones, MessageSquareReply, RefreshCw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import { adminApi } from "../api/adminApi";

const STATUS_OPTIONS = [
  { value: "pending", label: "접수" },
  { value: "in_progress", label: "처리 중" },
  { value: "resolved", label: "답변 완료" },
  { value: "closed", label: "종료" }
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "낮음" },
  { value: "normal", label: "보통" },
  { value: "high", label: "높음" },
  { value: "urgent", label: "긴급" }
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
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value;
}

function priorityLabel(value) {
  return PRIORITY_OPTIONS.find((item) => item.value === value)?.label || value;
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

function AdminSupportPage() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [savedFeedback, setSavedFeedback] = useState("");
  const [edit, setEdit] = useState({ status: "pending", priority: "normal", admin_response: "", internal_note: "" });

  const loadItems = async () => {
    setLoading(true);
    setMessage("");
    setSavedFeedback("");
    try {
      const data = await adminApi.supportInquiries(statusFilter === "all" ? {} : { status: statusFilter });
      const nextItems = data.items || [];
      setItems(nextItems);
      setSelectedId((current) => current || nextItems[0]?.id || null);
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

  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return items;
    return items.filter((item) => {
      const userText = `${requesterLabel(item)} ${requesterEmail(item)}`.toLowerCase();
      return item.title.toLowerCase().includes(keyword) || item.content.toLowerCase().includes(keyword) || userText.includes(keyword);
    });
  }, [items, search]);

  const saveSelected = async () => {
    if (!selected) return;
    setSaving(true);
    setMessage("");
    setSavedFeedback("");
    try {
      const data = await adminApi.updateSupportInquiry(selected.id, edit);
      const updated = data.item;
      setItems((current) => current.map((item) => item.id === updated.id ? updated : item));
      setMessage("문의 처리 내용이 저장되었습니다.");
      setSavedFeedback("저장 완료");
      window.setTimeout(() => setSavedFeedback(""), 2400);
    } catch (error) {
      setMessage(error.response?.data?.message || "저장에 실패했습니다.");
      setSavedFeedback("저장 실패");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="admin-support-page">
      <header className="admin-support-hero">
        <span><Headphones size={18} /> 고객 문의 관리</span>
        <h1>접수된 1:1 문의를 처리하고 답변을 남깁니다.</h1>
        <p>문의 유형, 처리 상태, 담당 관리자와 내부 메모까지 함께 기록됩니다.</p>
      </header>

      <div className="admin-support-toolbar">
        <div className="admin-support-search">
          <Search size={16} />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="제목, 내용, 회원 검색" />
        </div>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="all">전체 상태</option>
          {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
        <button type="button" onClick={loadItems}><RefreshCw size={16} /> 새로고침</button>
      </div>

      {message ? <p className="admin-support-message">{message}</p> : null}

      <div className="admin-support-grid">
        <section className="admin-support-list" aria-label="고객 문의 목록">
          {loading ? (
            <LoadingCards count={4} />
          ) : filteredItems.length ? (
            filteredItems.map((item) => (
              <button key={item.id} type="button" className={`admin-support-card ${item.id === selectedId ? "is-active" : ""}`} onClick={() => setSelectedId(item.id)}>
                <span className={`support-inquiry-status is-${item.status}`}>{statusLabel(item.status)}</span>
                <strong>{item.title}</strong>
                <p>{item.content}</p>
                <small>{sourceLabel(item.source)} · {CATEGORY_LABELS[item.category] || item.category} · {requesterLabel(item)} · {item.attachment_url ? "사진 첨부 · " : ""}{formatTime(item.created_at)}</small>
              </button>
            ))
          ) : (
            <EmptyState title="문의가 없습니다." description="현재 조건에 맞는 문의가 없습니다." />
          )}
        </section>

        <section className="admin-support-detail" aria-label="문의 처리 상세">
          {selected ? (
            <>
              <div className="admin-support-detail__head">
                <div>
                  <span>{CATEGORY_LABELS[selected.category] || selected.category}</span>
                  <h2>{selected.title}</h2>
                  <p>{sourceLabel(selected.source)} · {requesterLabel(selected)} · {requesterEmail(selected)}</p>
                </div>
                <b>{priorityLabel(selected.priority)}</b>
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
                <label>
                  <span>처리 상태</span>
                  <select value={edit.status} onChange={(event) => setEdit((current) => ({ ...current, status: event.target.value }))}>
                    {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label>
                  <span>우선순위</span>
                  <select value={edit.priority} onChange={(event) => setEdit((current) => ({ ...current, priority: event.target.value }))}>
                    {PRIORITY_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
                <label className="admin-support-form__wide">
                  <span>회원에게 보낼 답변</span>
                  <textarea rows={6} value={edit.admin_response} onChange={(event) => setEdit((current) => ({ ...current, admin_response: event.target.value }))} placeholder="답변을 입력하면 회원 알림과 문의 내역에 표시됩니다." />
                </label>
                <label className="admin-support-form__wide">
                  <span>내부 처리 메모</span>
                  <textarea rows={4} value={edit.internal_note} onChange={(event) => setEdit((current) => ({ ...current, internal_note: event.target.value }))} placeholder="관리자만 보는 처리 메모입니다." />
                </label>
              </div>
              <div className="admin-support-save-row">
                <button className={`admin-support-save ${savedFeedback === "저장 완료" ? "is-saved" : ""}`} type="button" onClick={saveSelected} disabled={saving}>
                  <MessageSquareReply size={16} /> {saving ? "저장 중" : savedFeedback === "저장 완료" ? "저장 완료" : "처리 저장"}
                </button>
                {savedFeedback ? (
                  <span className={`admin-support-save-feedback ${savedFeedback === "저장 완료" ? "is-success" : "is-error"}`}>
                    {savedFeedback === "저장 완료" ? "상태와 답변이 반영되었습니다." : "저장에 실패했습니다."}
                  </span>
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState title="선택된 문의가 없습니다." description="왼쪽 목록에서 처리할 문의를 선택해주세요." />
          )}
        </section>
      </div>
    </section>
  );
}

export default AdminSupportPage;
