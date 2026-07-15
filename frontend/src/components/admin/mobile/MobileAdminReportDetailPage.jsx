import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowUpRight, CheckCircle, MessageSquareText, ShieldAlert, UserRound } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { adminApi } from "../../../api/adminApi";

const statusLabel = {
  pending: "대기 중",
  in_progress: "처리 중",
  resolved: "처리 완료",
  dismissed: "반려"
};

const reportTypeLabel = {
  user: "회원 신고",
  meeting: "모임 신고",
  chat_room: "채팅방 신고"
};

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function displayName(user) {
  if (!user) return "정보 없음";
  return user.nickname_with_tag || user.nickname || user.name || user.email || `회원 #${user.id}`;
}

function UserRiskCard({ title, user, tone = "default" }) {
  const stats = user?.report_stats || {};
  return (
    <section style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: tone === "danger" ? "1px solid #fca5a5" : "1px solid #e2e8f0", marginBottom: "16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700, color: tone === "danger" ? "#dc2626" : "#334155" }}>
          <UserRound size={16} />{title}
        </span>
      </header>
      {user ? (
        <>
          <strong style={{ fontSize: "16px", color: "#0f172a" }}>{displayName(user)}</strong>
          <p style={{ fontSize: "13px", color: "#64748b", margin: "4px 0 16px 0" }}>{user.email}</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", textAlign: "center" }}>
            <div style={{ padding: "8px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
              <b style={{ display: "block", fontSize: "16px", color: tone === "danger" ? "#ef4444" : "#3b82f6" }}>{stats.made_total || 0}</b>
              <span style={{ fontSize: "11px", color: "#64748b" }}>신고한 횟수</span>
            </div>
            <div style={{ padding: "8px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
              <b style={{ display: "block", fontSize: "16px", color: tone === "danger" ? "#ef4444" : "#3b82f6" }}>{stats.received_total || 0}</b>
              <span style={{ fontSize: "11px", color: "#64748b" }}>신고 받은 횟수</span>
            </div>
            <div style={{ padding: "8px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
              <b style={{ display: "block", fontSize: "16px", color: tone === "danger" ? "#ef4444" : "#3b82f6" }}>{stats.received_pending || 0}</b>
              <span style={{ fontSize: "11px", color: "#64748b" }}>대기 중 피신고</span>
            </div>
          </div>
        </>
      ) : (
        <p style={{ fontSize: "13px", color: "#64748b" }}>이 신고에는 특정 대상 회원이 연결되어 있지 않습니다.</p>
      )}
    </section>
  );
}

function ChatLogList({ title, logs, emptyText }) {
  return (
    <section style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700, color: "#334155" }}>
          <MessageSquareText size={16} />{title}
        </span>
        <b style={{ fontSize: "14px", color: "#3b82f6" }}>{logs.length}건</b>
      </header>
      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        {logs.length ? logs.map((message) => (
          <article key={`${message.room_type}-${message.id}`} style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <strong style={{ fontSize: "13px", color: "#1e293b" }}>{displayName(message.sender)}</strong>
              <time style={{ fontSize: "11px", color: "#94a3b8" }}>{formatDateTime(message.created_at)}</time>
            </div>
            {message.meeting && <small style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "4px" }}>{message.meeting.title}</small>}
            <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.5 }}>{message.message_type === "image" ? `[사진] ${message.attachment_name || ""}` : message.content}</p>
          </article>
        )) : <p style={{ fontSize: "13px", color: "#64748b", textAlign: "center", padding: "12px 0" }}>{emptyText}</p>}
      </div>
    </section>
  );
}

function MobileAdminReportDetailPage() {
  const { reportId } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ status: "in_progress", admin_note: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function loadReport() {
      try {
        setLoading(true);
        const res = await adminApi.reportDetail(reportId);
        setData(res);
        setForm({
          status: res.report?.status || "in_progress",
          admin_note: res.report?.admin_note || ""
        });
      } catch (error) {
        setMessage(error.response?.data?.message || "신고 상세 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [reportId]);

  const allUserLogs = useMemo(() => [
    ...(data?.user_chat_logs || []),
    ...(data?.user_direct_logs || [])
  ].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)), [data]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateReport(reportId, form);
      alert("신고 처리 결과가 저장되었습니다.");
      navigate("/admin/reports", { state: { notice: "성공적으로 저장되었습니다." } });
    } catch (error) {
      alert(error.response?.data?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="신고 상세 조회" />
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "calc(100vh - 60px)", backgroundColor: "#f8fafc" }}>
          <p style={{ color: "#64748b" }}>불러오는 중...</p>
        </div>
      </>
    );
  }

  if (message || !data) {
    return (
      <>
        <MobileHeader title="신고 상세 조회" />
        <div style={{ padding: "24px", textAlign: "center", backgroundColor: "#f8fafc", minHeight: "100vh" }}>
          <AlertTriangle size={48} style={{ color: "#ef4444", margin: "0 auto 16px auto" }} />
          <h3 style={{ fontSize: "18px", color: "#1e293b", marginBottom: "8px" }}>오류</h3>
          <p style={{ fontSize: "14px", color: "#64748b" }}>{message || "정보를 불러올 수 없습니다."}</p>
        </div>
      </>
    );
  }

  const { report, reporter, target_user, target_meeting, target_chat_room, target_chat_log } = data;

  return (
    <div style={{ backgroundColor: "#f1f5f9", minHeight: "100vh", paddingBottom: "80px" }}>
      <MobileHeader title={`신고 내역 #${report.id}`} />
      
      <div style={{ padding: "16px" }}>
        
        {/* Report Basic Info */}
        <section style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "16px" }}>
            <div>
              <span style={{ fontSize: "12px", color: "#64748b" }}>유형</span>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#1e293b", marginTop: "2px" }}>{reportTypeLabel[report.target_type] || report.target_type}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <span style={{ fontSize: "12px", color: "#64748b" }}>신고일시</span>
              <div style={{ fontSize: "14px", color: "#1e293b", marginTop: "2px" }}>{formatDateTime(report.created_at)}</div>
            </div>
          </div>
          
          <div style={{ backgroundColor: "#fef2f2", padding: "12px", borderRadius: "8px", border: "1px solid #fecaca" }}>
            <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 700 }}>신고 사유</span>
            <p style={{ margin: "4px 0 0 0", fontSize: "15px", color: "#7f1d1d", lineHeight: 1.5 }}>
              {report.reason || "사유 없음"}
            </p>
          </div>
        </section>

        <UserRiskCard title="피신고인 (대상자) 정보" user={target_user} tone="danger" />
        <UserRiskCard title="신고인 (제보자) 정보" user={reporter} />

        {(target_meeting || target_chat_room) && (
          <section style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
            <header style={{ fontSize: "15px", fontWeight: 700, color: "#334155", marginBottom: "12px" }}>관련 모임/채팅방</header>
            {target_meeting && (
              <div style={{ marginBottom: "12px" }}>
                <span style={{ fontSize: "12px", color: "#64748b" }}>모임명</span>
                <p style={{ margin: 0, fontSize: "15px", color: "#1e293b" }}>{target_meeting.title}</p>
              </div>
            )}
            {target_chat_room && (
              <div>
                <span style={{ fontSize: "12px", color: "#64748b" }}>채팅방 정보</span>
                <p style={{ margin: 0, fontSize: "15px", color: "#1e293b" }}>
                  {target_chat_room.room_type === "meeting" ? "모임 채팅방" : "1:1 채팅방"} (#{target_chat_room.id})
                </p>
              </div>
            )}
          </section>
        )}

        {target_chat_log && (
          <section style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #ef4444", marginBottom: "16px" }}>
            <header style={{ fontSize: "15px", fontWeight: 700, color: "#dc2626", marginBottom: "8px" }}>신고된 특정 메시지 내역</header>
            <div style={{ backgroundColor: "#fef2f2", padding: "12px", borderRadius: "8px" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "#7f1d1d" }}>
                {target_chat_log.message_type === "image" ? "[사진 전송됨]" : target_chat_log.content}
              </p>
              <time style={{ display: "block", marginTop: "8px", fontSize: "11px", color: "#ef4444" }}>{formatDateTime(target_chat_log.created_at)}</time>
            </div>
          </section>
        )}

        <ChatLogList title="대상자의 최근 채팅 기록 (최대 10건)" logs={allUserLogs} emptyText="최근에 대상자가 남긴 메시지가 없습니다." />
      </div>

      {/* Sticky Bottom Form */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTop: "1px solid #e2e8f0", padding: "16px", boxShadow: "0 -4px 6px -1px rgba(0, 0, 0, 0.05)", zIndex: 10 }}>
        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>처리 상태</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", backgroundColor: form.status === "resolved" ? "#f0fdf4" : form.status === "dismissed" ? "#fef2f2" : "#fff", color: form.status === "resolved" ? "#166534" : form.status === "dismissed" ? "#991b1b" : "#334155" }}
              >
                {Object.entries(statusLabel).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>
            <div style={{ flex: 2 }}>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "#64748b", marginBottom: "4px" }}>관리자 처리 메모</label>
              <input
                type="text"
                placeholder="조치 내역을 입력하세요"
                value={form.admin_note}
                onChange={(e) => setForm({ ...form, admin_note: e.target.value })}
                style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" }}
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={saving}
            style={{ width: "100%", padding: "12px", backgroundColor: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "15px", fontWeight: 700 }}
          >
            {saving ? "저장 중..." : "결과 저장"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default MobileAdminReportDetailPage;
