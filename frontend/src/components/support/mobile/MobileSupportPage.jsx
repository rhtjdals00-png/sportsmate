import { BellRing, Headphones, ImagePlus, Megaphone, Send, ShieldCheck, X, MessageSquareText, FileText } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { notificationApi } from "../../../api/notificationApi";
import { supportApi } from "../../../api/supportApi";
import { useAsync } from "../../../hooks/useAsync";

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

function MobileSupportPage() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const initialTab = searchParams.get("tab") || "inquiry";
  
  const [activeTab, setActiveTab] = useState(initialTab); // inquiry | history | messages
  const [refreshKey, setRefreshKey] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ category: "general", title: "", content: "", attachment_url: "", attachment_name: "" });
  
  const notifications = useAsync(() => notificationApi.list(), [refreshKey]);
  const inquiries = useAsync(() => supportApi.inquiries(), [refreshKey]);
  const supportItems = useMemo(() => (notifications.data?.items || []).filter(isAdminNotification), [notifications.data]);
  const unreadCount = supportItems.filter((item) => !item.is_read).length;
  const inquiryItems = inquiries.data?.items || [];

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
      setMessage("문의가 접수되었습니다. 답변이 등록되면 알림에서 확인할 수 있어요.");
      setRefreshKey((value) => value + 1);
      setActiveTab("history"); // 문의 접수 성공 시 내역 탭으로 이동
    } catch (error) {
      setMessage(error.response?.data?.message || "문의 접수에 실패했습니다. 내용을 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mobile-support-container" style={{ background: '#f8fafc', minHeight: '100vh', paddingBottom: '30px' }}>
      <MobileHeader title="고객센터" />

      {/* 모바일 탭 네비게이션 */}
      <nav style={{ display: 'flex', background: '#fff', borderBottom: '1px solid #e2e8f0', position: 'sticky', top: '56px', zIndex: 10 }}>
        <button 
          onClick={() => setActiveTab("inquiry")} 
          style={{ flex: 1, padding: '14px 0', fontSize: '14px', fontWeight: activeTab === 'inquiry' ? 'bold' : '500', color: activeTab === 'inquiry' ? '#4f46e5' : '#64748b', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', outline: 'none', borderBottom: activeTab === 'inquiry' ? '2px solid #4f46e5' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <Headphones size={16} /> 문의하기
        </button>
        <button 
          onClick={() => setActiveTab("history")} 
          style={{ flex: 1, padding: '14px 0', fontSize: '14px', fontWeight: activeTab === 'history' ? 'bold' : '500', color: activeTab === 'history' ? '#4f46e5' : '#64748b', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', outline: 'none', borderBottom: activeTab === 'history' ? '2px solid #4f46e5' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <FileText size={16} /> 내 문의 내역
        </button>
        <button 
          onClick={() => setActiveTab("messages")} 
          style={{ flex: 1, padding: '14px 0', fontSize: '14px', fontWeight: activeTab === 'messages' ? 'bold' : '500', color: activeTab === 'messages' ? '#4f46e5' : '#64748b', background: 'transparent', borderTop: 'none', borderLeft: 'none', borderRight: 'none', outline: 'none', borderBottom: activeTab === 'messages' ? '2px solid #4f46e5' : '2px solid transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', position: 'relative' }}
        >
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={16} /> 운영 메시지
            {unreadCount > 0 && (
              <span style={{ position: 'absolute', top: '-10px', right: '-24px', background: '#ef4444', color: '#fff', fontSize: '10px', fontWeight: 'bold', padding: '2px 5px', borderRadius: '10px', lineHeight: 1 }}>
                {unreadCount}
              </span>
            )}
          </div>
        </button>
      </nav>

      <main style={{ padding: '16px' }}>
        {/* 탭 1: 문의하기 */}
        {activeTab === "inquiry" && (
          <form className="support-inquiry-form" onSubmit={submitInquiry} style={{ background: '#fff', padding: '20px', borderRadius: '16px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: '0 0 4px 0' }}>1:1 문의하기</h2>
              <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>궁금한 점이나 불편한 점을 남겨주시면 빠르게 답변해 드리겠습니다.</p>
            </div>
            
            <label className="support-form-field" style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>문의 유형</span>
              <select 
                value={form.category} 
                onChange={(event) => updateForm("category", event.target.value)}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background: '#fff', color: '#334155' }}
              >
                {CATEGORIES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </label>

            <label className="support-form-field" style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>제목</span>
              <input 
                value={form.title} 
                maxLength={120} 
                onChange={(event) => updateForm("title", event.target.value)} 
                placeholder="문의 제목을 입력해주세요" 
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
              />
            </label>

            <label className="support-form-field" style={{ display: 'block', marginBottom: '16px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>내용</span>
              <textarea 
                value={form.content} 
                maxLength={4000} 
                onChange={(event) => updateForm("content", event.target.value)} 
                placeholder="상황을 자세히 적어주시면 더 빠르게 확인할 수 있어요." 
                rows={6}
                style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', resize: 'vertical' }}
              />
            </label>

            <div className="support-form-field support-attachment-field" style={{ marginBottom: '24px' }}>
              <span style={{ display: 'block', fontSize: '13px', fontWeight: 'bold', color: '#475569', marginBottom: '6px' }}>사진 첨부</span>
              {form.attachment_url ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#f8fafc' }}>
                  <img src={form.attachment_url} alt="첨부 미리보기" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '4px' }} />
                  <div style={{ flex: 1, overflow: 'hidden' }}>
                    <strong style={{ display: 'block', fontSize: '12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{form.attachment_name || "첨부 이미지"}</strong>
                    <button type="button" onClick={clearAttachment} style={{ color: '#ef4444', fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      <X size={12} /> 삭제
                    </button>
                  </div>
                </div>
              ) : (
                <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px', border: '1px dashed #cbd5e1', borderRadius: '8px', background: '#f8fafc', cursor: 'pointer', color: '#64748b' }}>
                  <ImagePlus size={24} style={{ marginBottom: '8px', color: '#94a3b8' }} />
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>이미지 선택</span>
                  <small style={{ fontSize: '11px', marginTop: '4px' }}>PNG, JPG 등 3MB 이하</small>
                  <input type="file" accept="image/*" onChange={updateAttachment} style={{ display: 'none' }} />
                </label>
              )}
            </div>

            {message && <p style={{ fontSize: '13px', color: '#ef4444', marginBottom: '16px', background: '#fee2e2', padding: '10px', borderRadius: '8px' }}>{message}</p>}
            
            <button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', background: '#4f46e5', color: '#fff', fontSize: '15px', fontWeight: 'bold', borderRadius: '8px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', opacity: submitting ? 0.7 : 1 }}>
              <Send size={16} /> {submitting ? "접수 중..." : "문의 접수하기"}
            </button>
          </form>
        )}

        {/* 탭 2: 내 문의 내역 */}
        {activeTab === "history" && (
          <div>
            {inquiries.loading && !inquiries.data ? (
              <LoadingCards count={2} />
            ) : inquiryItems.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {inquiryItems.map((item) => (
                  <article key={item.id} style={{ background: '#fff', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b', background: '#f1f5f9', padding: '4px 8px', borderRadius: '6px' }}>{categoryLabel(item.category)}</span>
                        <time style={{ fontSize: '12px', color: '#94a3b8' }}>{formatSupportTime(item.created_at)}</time>
                      </div>
                      <span style={{ 
                        fontSize: '11px', fontWeight: 'bold', padding: '4px 8px', borderRadius: '6px',
                        background: item.status === 'resolved' ? '#dcfce7' : item.status === 'in_progress' ? '#fef3c7' : '#f1f5f9',
                        color: item.status === 'resolved' ? '#16a34a' : item.status === 'in_progress' ? '#d97706' : '#64748b'
                      }}>
                        {STATUS_LABELS[item.status] || item.status}
                      </span>
                    </div>
                    <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b', marginBottom: '6px' }}>{item.title}</strong>
                    <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5, marginBottom: '12px' }}>{item.content}</p>
                    
                    {item.attachment_url && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', background: '#f8fafc', borderRadius: '8px', marginBottom: '12px' }}>
                        <ImagePlus size={14} color="#94a3b8" />
                        <span style={{ fontSize: '12px', color: '#64748b' }}>첨부 이미지 포함</span>
                      </div>
                    )}
                    
                    {item.admin_response ? (
                      <div style={{ background: '#eef2ff', padding: '12px', borderRadius: '8px', borderLeft: '3px solid #4f46e5' }}>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 'bold', color: '#4f46e5', marginBottom: '4px' }}>관리자 답변</span>
                        <p style={{ fontSize: '13px', color: '#334155', margin: 0, lineHeight: 1.5 }}>{item.admin_response}</p>
                      </div>
                    ) : (
                       <div style={{ background: '#f8fafc', padding: '10px', borderRadius: '8px', textAlign: 'center' }}>
                         <span style={{ fontSize: '12px', color: '#94a3b8' }}>아직 관리자 답변이 등록되지 않았습니다.</span>
                       </div>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="접수한 문의가 없습니다." description="궁금한 점이나 불편한 점은 '문의하기' 탭에서 남겨주세요." />
            )}
          </div>
        )}

        {/* 탭 3: 운영 메시지 */}
        {activeTab === "messages" && (
          <div>
            {notifications.loading && !notifications.data ? (
              <LoadingCards count={3} />
            ) : supportItems.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {supportItems.map((item) => (
                  <article key={item.id} style={{ background: item.is_read ? '#fff' : '#f0fdf4', border: item.is_read ? '1px solid transparent' : '1px solid #bbf7d0', padding: '16px', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                    <div style={{ display: 'flex', gap: '12px' }}>
                      <div style={{ background: item.type === "admin_broadcast" || item.type === "broadcast" ? '#fee2e2' : '#e0e7ff', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        {item.type === "admin_broadcast" || item.type === "broadcast" ? <Megaphone size={18} color="#ef4444" /> : <ShieldCheck size={18} color="#4f46e5" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>{supportTypeLabel(item.type)}</span>
                          <time style={{ fontSize: '11px', color: '#94a3b8' }}>{formatSupportTime(item.created_at)}</time>
                        </div>
                        <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b', marginBottom: '6px' }}>{item.title || "운영 안내"}</strong>
                        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.5, marginBottom: '12px' }}>{item.message}</p>
                        
                        {!item.is_read && (
                          <button 
                            type="button" 
                            onClick={() => markRead(item)}
                            style={{ background: '#22c55e', color: '#fff', fontSize: '12px', fontWeight: 'bold', padding: '6px 12px', borderRadius: '14px', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', cursor: 'pointer' }}
                          >
                            읽음 처리
                          </button>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <EmptyState title="운영 메시지가 없습니다." description="관리자로부터 안내 메시지나 공지가 오면 이곳에 표시됩니다." />
            )}
            
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
              <Link to="/notifications" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#64748b', fontWeight: 'bold', textDecoration: 'none', background: '#f1f5f9', padding: '8px 16px', borderRadius: '20px' }}>
                <BellRing size={14} /> 전체 알림 보기
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default MobileSupportPage;
