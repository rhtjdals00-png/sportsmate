import { Headphones, ImagePlus, Send, X, Megaphone, ChevronDown, ChevronUp } from "lucide-react";
import { useEffect, useState } from "react";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { supportApi } from "../api/supportApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import MobileSupportPage from "../components/support/mobile/MobileSupportPage.jsx";

const CATEGORIES = [
  { value: "general", label: "일반 문의" },
  { value: "account", label: "계정" },
  { value: "meeting", label: "모임" },
  { value: "payment", label: "결제" },
  { value: "bug", label: "오류 신고" },
  { value: "report", label: "신고/분쟁" }
];

const STATUS_LABELS = {
  pending: "접수중",
  in_progress: "접수중",
  resolved: "답변 완료",
  closed: "답변 완료"
};



function formatSupportTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}



function categoryLabel(value) {
  return CATEGORIES.find((item) => item.value === value)?.label || "일반 문의";
}

function SupportPage() {
  const { isMobile } = useResponsive();
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ category: "general", title: "", content: "", attachment_url: "", attachment_name: "" });
  const [expandedInquiry, setExpandedInquiry] = useState(null);
  const [view, setView] = useState("notice"); // 'notice', 'submit', or 'history'
  const [expandedNotice, setExpandedNotice] = useState(null);
  const [noticePage, setNoticePage] = useState(1);
  const inquiries = useAsync(() => supportApi.inquiries(), [refreshKey]);
  const notices = useAsync(() => supportApi.getNotices(), [refreshKey]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const updateForm = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateAttachment = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("이미지 파일만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMessage("첨부 이미지는 3MB 이하로 올려주세요.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setMessage("");
      setForm((current) => ({
        ...current,
        attachment_url: reader.result,
        attachment_name: file.name
      }));
    };
    reader.onerror = () => setMessage("이미지를 읽지 못했습니다. 다른 파일로 다시 시도해주세요.");
    reader.readAsDataURL(file);
  };

  const clearAttachment = () => {
    setForm((current) => ({ ...current, attachment_url: "", attachment_name: "" }));
  };

  const submitInquiry = async (event) => {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    try {
      await supportApi.createInquiry(form);
      setForm({ category: "general", title: "", content: "", attachment_url: "", attachment_name: "" });
      setMessage("문의가 접수되었습니다. 답변이 등록되면 이 페이지와 알림에서 확인할 수 있어요.");
      setRefreshKey((value) => value + 1);
      setView("history");
    } catch (error) {
      setMessage(error.response?.data?.message || "문의 접수에 실패했습니다. 내용을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const inquiryItems = inquiries.data?.items || [];
  const noticeItems = notices.data?.items || [];

  const noticesPerPage = 10;
  const totalNoticePages = Math.ceil(noticeItems.length / noticesPerPage);
  const paginatedNotices = noticeItems.slice((noticePage - 1) * noticesPerPage, noticePage * noticesPerPage);

  const page = (
    <section className="support-center-page">
      <header className="support-center-hero" style={{
        marginBottom: "22px"
      }}>
        <div>
          <span><Headphones size={18} /> 고객센터</span>
          <h1 style={{ marginTop: "8px" }}>무엇을 도와드릴까요?</h1>
          <p style={{ marginTop: "8px" }}>스포츠메이트 서비스 공지사항을 확인하고 1:1 문의를 남기실 수 있습니다.</p>
        </div>
      </header>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", marginBottom: "24px", paddingBottom: "2px" }}>
        <button
          type="button"
          onClick={() => { setView("notice"); setNoticePage(1); }}
          style={{
            padding: "10px 20px",
            fontSize: "15px",
            fontWeight: 700,
            color: view === "notice" ? "#2563eb" : "#64748b",
            borderBottom: view === "notice" ? "2px solid #2563eb" : "2px solid transparent",
            backgroundColor: "transparent",
            cursor: "pointer",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            outline: "none",
            transition: "all 0.15s ease",
            marginBottom: "-3px"
          }}
        >
          공지사항
        </button>
        <button
          type="button"
          onClick={() => setView("submit")}
          style={{
            padding: "10px 20px",
            fontSize: "15px",
            fontWeight: 700,
            color: view === "submit" ? "#2563eb" : "#64748b",
            borderBottom: view === "submit" ? "2px solid #2563eb" : "2px solid transparent",
            backgroundColor: "transparent",
            cursor: "pointer",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            outline: "none",
            transition: "all 0.15s ease",
            marginBottom: "-3px"
          }}
        >
          1:1 문의하기
        </button>
        <button
          type="button"
          onClick={() => setView("history")}
          style={{
            padding: "10px 20px",
            fontSize: "15px",
            fontWeight: 700,
            color: view === "history" ? "#2563eb" : "#64748b",
            borderBottom: view === "history" ? "2px solid #2563eb" : "2px solid transparent",
            backgroundColor: "transparent",
            cursor: "pointer",
            borderTop: "none",
            borderLeft: "none",
            borderRight: "none",
            outline: "none",
            transition: "all 0.15s ease",
            marginBottom: "-3px"
          }}
        >
          내 문의 내역 ({inquiryItems.length})
        </button>
      </div>

      <section className="support-center-grid" style={{ gridTemplateColumns: "1fr" }}>
        {view === "notice" ? (
          /* Notice Panel */
          <section className="support-center-panel" style={{ marginTop: 0, width: "100%" }}>
            {notices.loading && !notices.data ? (
              <LoadingCards count={3} />
            ) : noticeItems.length ? (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
                  {paginatedNotices.map((item, index) => {
                    const globalIndex = (noticePage - 1) * noticesPerPage + index;
                    const isExpanded = expandedNotice === globalIndex;
                    return (
                      <div
                        key={item.id || index}
                        style={{
                          background: "#ffffff",
                          border: item.is_pinned ? "1px solid #fed7d7" : "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "18px 24px",
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                          boxShadow: item.is_pinned ? "0 2px 8px rgba(239, 68, 68, 0.05)" : "0 2px 4px rgba(0,0,0,0.02)",
                          backgroundColor: item.is_pinned ? "#fffafb" : "#ffffff"
                        }}
                        onClick={() => setExpandedNotice(isExpanded ? null : globalIndex)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <span style={{
                              background: item.is_pinned ? "#ef4444" : "#64748b",
                              color: "#ffffff",
                              fontSize: "11px",
                              fontWeight: 800,
                              padding: "3px 8px",
                              borderRadius: "6px",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              {item.is_pinned ? "중요 공지" : "공지"}
                            </span>
                            <strong style={{ fontSize: "16px", color: "#1e293b" }}>{item.title}</strong>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                            <span style={{ fontSize: "13px", color: "#94a3b8" }}>{formatSupportTime(item.created_at || item.timestamp)}</span>
                            {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                          </div>
                        </div>
                        
                        {isExpanded && (
                          <div
                            style={{
                              marginTop: "16px",
                              paddingTop: "16px",
                              borderTop: "1px solid #f1f5f9",
                              fontSize: "14px",
                              color: "#475569",
                              lineHeight: "1.6",
                              whiteSpace: "pre-wrap"
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {item.content || item.message}
                            {item.link_url && item.link_url !== "/notifications" && (
                              <div style={{ marginTop: "12px" }}>
                                <a
                                  href={item.link_url}
                                  style={{
                                    color: "#2563eb",
                                    fontWeight: 600,
                                    textDecoration: "underline"
                                  }}
                                >
                                  관련 링크로 이동 →
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination Controls */}
                {totalNoticePages > 1 && (
                  <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "6px", marginTop: "24px" }}>
                    <button
                      disabled={noticePage === 1}
                      onClick={() => { setNoticePage(p => Math.max(p - 1, 1)); setExpandedNotice(null); }}
                      style={{
                        border: "1px solid #cbd5e1",
                        backgroundColor: noticePage === 1 ? "#f1f5f9" : "#ffffff",
                        color: noticePage === 1 ? "#94a3b8" : "#334155",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: noticePage === 1 ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontWeight: 600
                      }}
                    >
                      이전
                    </button>
                    <span style={{ fontSize: "13px", color: "#475569", fontWeight: 700 }}>
                      {noticePage} / {totalNoticePages}
                    </span>
                    <button
                      disabled={noticePage === totalNoticePages}
                      onClick={() => { setNoticePage(p => Math.min(p + 1, totalNoticePages)); setExpandedNotice(null); }}
                      style={{
                        border: "1px solid #cbd5e1",
                        backgroundColor: noticePage === totalNoticePages ? "#f1f5f9" : "#ffffff",
                        color: noticePage === totalNoticePages ? "#94a3b8" : "#334155",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        cursor: noticePage === totalNoticePages ? "not-allowed" : "pointer",
                        fontSize: "13px",
                        fontWeight: 600
                      }}
                    >
                      다음
                    </button>
                  </div>
                )}
              </>
            ) : (
              <EmptyState title="등록된 공지사항이 없습니다." description="새로운 소식이 등록되면 이곳에 표시됩니다." />
            )}
          </section>
        ) : view === "submit" ? (
          <form className="support-inquiry-form" onSubmit={submitInquiry} style={{ width: "100%" }}>
            <div className="support-center-panel__head">
              <div>
                <h2>1:1 문의하기</h2>
                <p>문의 유형과 내용을 남기면 관리자가 처리 내역을 기록합니다.</p>
              </div>
            </div>
            <label className="support-form-field">
              <span>문의 유형</span>
              <select value={form.category} onChange={(event) => updateForm("category", event.target.value)}>
                {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>
            <label className="support-form-field">
              <span>제목</span>
              <input value={form.title} maxLength={120} onChange={(event) => updateForm("title", event.target.value)} placeholder="문의 제목을 입력해주세요" />
            </label>
            <label className="support-form-field">
              <span>내용</span>
              <textarea value={form.content} maxLength={4000} onChange={(event) => updateForm("content", event.target.value)} placeholder="상황을 자세히 적어주시면 더 빠르게 확인할 수 있어요." rows={7} />
            </label>
            <div className="support-form-field support-attachment-field">
              <span>사진 첨부</span>
              {form.attachment_url ? (
                <div className="support-attachment-preview">
                  <img src={form.attachment_url} alt="문의 첨부 미리보기" />
                  <div>
                    <strong>{form.attachment_name || "첨부 이미지"}</strong>
                    <button type="button" onClick={clearAttachment}><X size={14} /> 삭제</button>
                  </div>
                </div>
              ) : (
                <label className="support-attachment-picker">
                  <ImagePlus size={17} />
                  <span>이미지 선택</span>
                  <small>PNG, JPG 등 3MB 이하</small>
                  <input type="file" accept="image/*" onChange={updateAttachment} />
                </label>
              )}
            </div>
            {message ? <p className="support-form-message">{message}</p> : null}
            <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
              <button className="support-submit-btn" type="submit" disabled={submitting}>
                <Send size={16} /> {submitting ? "접수 중" : "문의 접수"}
              </button>
            </div>
          </form>
        ) : (
          <section className="support-center-panel" style={{ marginTop: 0, width: "100%" }}>
            <div className="support-center-panel__head">
              <div>
                <h2>내 문의 내역</h2>
                <p>접수 상태와 관리자 답변을 확인합니다.</p>
              </div>
              <em>{inquiryItems.length}건</em>
            </div>
            {inquiries.loading && !inquiries.data ? (
              <LoadingCards count={2} />
            ) : inquiryItems.length ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {inquiryItems.map((item) => {
                  const isExpanded = expandedInquiry === item.id;
                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "12px",
                        padding: "18px 24px",
                        cursor: "pointer",
                        transition: "all 0.2s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                      }}
                      onClick={() => setExpandedInquiry(isExpanded ? null : item.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{
                            background: "#f1f5f9",
                            color: "#475569",
                            fontSize: "12px",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}>
                            {categoryLabel(item.category)}
                          </span>
                          <strong style={{ fontSize: "16px", color: "#1e293b" }}>{item.title}</strong>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{
                            background: item.status === "resolved" ? "#dcfce7" : "#fef3c7",
                            color: item.status === "resolved" ? "#16a34a" : "#d97706",
                            fontSize: "12px",
                            fontWeight: 800,
                            padding: "3px 8px",
                            borderRadius: "6px"
                          }}>
                            {STATUS_LABELS[item.status] || "접수중"}
                          </span>
                          <span style={{ fontSize: "13px", color: "#94a3b8" }}>{formatSupportTime(item.created_at)}</span>
                          {isExpanded ? <ChevronUp size={16} color="#64748b" /> : <ChevronDown size={16} color="#64748b" />}
                        </div>
                      </div>

                      {isExpanded && (
                        <div
                          style={{
                            marginTop: "16px",
                            paddingTop: "16px",
                            borderTop: "1px solid #f1f5f9",
                            fontSize: "14px",
                            color: "#475569",
                            lineHeight: "1.6"
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ marginBottom: "14px" }}>
                            <span style={{ display: "block", fontSize: "12px", color: "#94a3b8", fontWeight: 600, marginBottom: "4px" }}>문의 내용</span>
                            <p style={{ margin: 0, color: "#334155", whiteSpace: "pre-wrap" }}>{item.content}</p>
                          </div>
                          
                          {item.attachment_url && (
                            <div style={{ marginTop: "12px", marginBottom: "14px" }}>
                              <img src={item.attachment_url} alt={item.attachment_name || "문의 첨부 이미지"} style={{ maxWidth: "100%", maxHeight: "240px", borderRadius: "8px", objectFit: "contain", border: "1px solid #e2e8f0" }} />
                              <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{item.attachment_name || "첨부 이미지"}</div>
                            </div>
                          )}

                          {item.admin_response ? (
                            <div style={{ marginTop: "16px", padding: "16px", backgroundColor: "#f0f7ff", borderRadius: "10px" }}>
                              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                                <span style={{ fontSize: "12px", color: "#2563eb", fontWeight: 700 }}>관리자 답변</span>
                                <span style={{ fontSize: "11px", color: "#60a5fa", fontWeight: 500 }}>{formatSupportTime(item.resolved_at || item.updated_at)}</span>
                              </div>
                              <p style={{ margin: 0, color: "#1e3a8a", whiteSpace: "pre-wrap" }}>{item.admin_response}</p>
                            </div>
                          ) : (
                            <div style={{ marginTop: "16px", padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                              아직 답변이 등록되지 않았습니다. 조금만 기다려주세요!
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="접수한 문의가 없습니다." description="궁금한 점이 생기면 1:1 문의를 등록해 보세요." />
            )}
          </section>
        )}
      </section>
    </section>
  );

  if (isMobile) {
    return <MobileSupportPage />;
  }

  return page;
}

export default SupportPage;
