import { BellRing, Headphones, ImagePlus, Megaphone, Send, ShieldCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { notificationApi } from "../api/notificationApi";
import { supportApi } from "../api/supportApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import MobileSupportPage from "../components/support/mobile/MobileSupportPage.jsx";

const ADMIN_NOTIFICATION_TYPES = new Set([
  "admin_broadcast",
  "admin_message",
  "account_suspension",
  "account_unsuspension",
  "broadcast",
  "admin",
  "system"
]);

const CATEGORIES = [
  { value: "general", label: "일반 문의" },
  { value: "account", label: "계정" },
  { value: "meeting", label: "모임" },
  { value: "payment", label: "결제" },
  { value: "bug", label: "오류 신고" },
  { value: "report", label: "신고/분쟁" }
];

const STATUS_LABELS = {
  pending: "접수",
  in_progress: "처리 중",
  resolved: "답변 완료",
  closed: "종료"
};

function isAdminNotification(item) {
  return ADMIN_NOTIFICATION_TYPES.has(item?.type);
}

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

function supportTypeLabel(type) {
  if (type === "admin_broadcast" || type === "broadcast") return "운영 공지";
  if (type === "admin_message") return "관리자 메시지";
  if (type === "account_suspension" || type === "account_unsuspension") return "계정 안내";
  if (type === "system") return "시스템 안내";
  return "운영 안내";
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
  const [selectedInquiry, setSelectedInquiry] = useState(null);
  const notifications = useAsync(() => notificationApi.list(), [refreshKey]);
  const inquiries = useAsync(() => supportApi.inquiries(), [refreshKey]);
  const supportItems = useMemo(() => (notifications.data?.items || []).filter(isAdminNotification), [notifications.data]);
  const unreadCount = supportItems.filter((item) => !item.is_read).length;

  const markRead = async (item) => {
    if (!item?.id || item.is_read) return;
    try {
      await notificationApi.read(item.id);
      setRefreshKey((value) => value + 1);
      window.dispatchEvent(new Event("notifications_updated"));
    } catch {
      setMessage("알림 읽음 처리에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

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
    } catch (error) {
      setMessage(error.response?.data?.message || "문의 접수에 실패했습니다. 내용을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const inquiryItems = inquiries.data?.items || [];

  const page = (
    <section className="support-center-page">
      <header className="support-center-hero">
        <span><Headphones size={18} /> 운영 메시지함</span>
        <h1>관리자 안내와 1:1 문의를 한 곳에서 확인해요.</h1>
        <p>관리자가 보낸 메시지, 전체 공지, 계정 안내를 모아보고 필요한 경우 앱 안에서 바로 문의를 남길 수 있습니다.</p>
      </header>

      <section className="support-center-grid">
        <form className="support-inquiry-form" onSubmit={submitInquiry}>
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
          <button className="support-submit-btn" type="submit" disabled={submitting}>
            <Send size={16} /> {submitting ? "접수 중" : "문의 접수"}
          </button>
        </form>

        <section className="support-center-panel">
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
            <div className="support-inquiry-list">
              {inquiryItems.map((item) => {
                const content = (
                  <>
                    <div className="support-inquiry-card__meta">
                      <span>{categoryLabel(item.category)}</span>
                      <time>{formatSupportTime(item.created_at)}</time>
                      <b className={`support-inquiry-status is-${item.status}`}>{STATUS_LABELS[item.status] || item.status}</b>
                    </div>
                    <strong>{item.title}</strong>
                    <p>{item.content}</p>
                    {item.attachment_url ? (
                      <div className="support-inquiry-attachment">
                        <img src={item.attachment_url} alt={item.attachment_name || "문의 첨부 이미지"} />
                        <span>{item.attachment_name || "첨부 이미지"}</span>
                      </div>
                    ) : null}
                    {item.admin_response ? (
                      <div className="support-inquiry-answer">
                        <span>관리자 답변</span>
                        <p>{item.admin_response}</p>
                      </div>
                    ) : null}
                  </>
                );
                if (isMobile) {
                  return <article key={item.id} className="support-inquiry-card">{content}</article>;
                }
                return (
                  <button key={item.id} type="button" className="support-inquiry-card support-inquiry-card--button" onClick={() => setSelectedInquiry(item)}>
                    {content}
                    <span className="support-inquiry-card__detail">상세 보기</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <EmptyState title="접수한 문의가 없습니다." description="궁금한 점이 생기면 왼쪽 폼으로 바로 문의해주세요." />
          )}
        </section>
      </section>

      <section className="support-center-panel">
        <div className="support-center-panel__head">
          <div>
            <h2>관리자 메시지</h2>
            <p>운영진이 보낸 안내와 공지입니다.</p>
          </div>
          <em>{unreadCount}개 안 읽음</em>
        </div>

        {notifications.loading && !notifications.data ? (
          <LoadingCards count={3} />
        ) : supportItems.length ? (
          <div className="support-message-list">
            {supportItems.map((item) => (
              <article key={item.id} className={`support-message-card ${item.is_read ? "is-read" : "is-unread"}`}>
                <div className="support-message-card__icon">
                  {item.type === "admin_broadcast" || item.type === "broadcast" ? <Megaphone size={18} /> : <ShieldCheck size={18} />}
                </div>
                <div className="support-message-card__body">
                  <div className="support-message-card__meta">
                    <span>{supportTypeLabel(item.type)}</span>
                    <time>{formatSupportTime(item.created_at)}</time>
                  </div>
                  <strong>{item.title || "운영 안내"}</strong>
                  <p>{item.message}</p>
                  {!item.is_read ? <button type="button" onClick={() => markRead(item)}>읽음 처리</button> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="관리자 메시지가 없습니다." description="운영 공지나 개별 안내가 도착하면 이곳에 표시됩니다." />
        )}
        <Link className="support-muted-link" to="/notifications"><BellRing size={15} /> 전체 알림 보기</Link>
      </section>

      {!isMobile && selectedInquiry ? (
        <div className="support-inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="support-inquiry-modal-title" onMouseDown={(event) => event.target === event.currentTarget && setSelectedInquiry(null)}>
          <section className="support-inquiry-modal__panel">
            <header className="support-inquiry-modal__head">
              <div>
                <span>{categoryLabel(selectedInquiry.category)}</span>
                <h2 id="support-inquiry-modal-title">{selectedInquiry.title}</h2>
                <p>{formatSupportTime(selectedInquiry.created_at)} · {STATUS_LABELS[selectedInquiry.status] || selectedInquiry.status}</p>
              </div>
              <button type="button" onClick={() => setSelectedInquiry(null)} aria-label="닫기">
                <X size={18} />
              </button>
            </header>

            <div className="support-inquiry-modal__body">
              <section>
                <h3>문의 내용</h3>
                <p>{selectedInquiry.content}</p>
                {selectedInquiry.attachment_url ? (
                  <figure className="support-inquiry-modal__attachment">
                    <img src={selectedInquiry.attachment_url} alt={selectedInquiry.attachment_name || "문의 첨부 이미지"} />
                    <figcaption>{selectedInquiry.attachment_name || "첨부 이미지"}</figcaption>
                  </figure>
                ) : null}
              </section>

              <section className={selectedInquiry.admin_response ? "has-answer" : ""}>
                <h3>관리자 답변</h3>
                {selectedInquiry.admin_response ? (
                  <p>{selectedInquiry.admin_response}</p>
                ) : (
                  <p className="support-inquiry-modal__empty">아직 등록된 답변이 없습니다. 답변이 등록되면 이 화면과 알림에서 확인할 수 있습니다.</p>
                )}
              </section>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );

  if (isMobile) {
    return <MobileSupportPage />;
  }

  return page;
}

export default SupportPage;
