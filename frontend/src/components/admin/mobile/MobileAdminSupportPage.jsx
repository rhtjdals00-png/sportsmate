import { Headphones, MessageSquareReply, RefreshCw, Search, ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import { adminApi } from "../../../api/adminApi";

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

function MobileAdminSupportPage() {
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [edit, setEdit] = useState({ status: "pending", priority: "normal", admin_response: "", internal_note: "" });

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await adminApi.supportInquiries(statusFilter === "all" ? {} : { status: statusFilter });
      setItems(data.items || []);
    } catch (error) {
      console.error("Failed to fetch support inquiries", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, [statusFilter]);

  const handleSelect = (item) => {
    setSelectedItem(item);
    setEdit({
      status: item.status || "pending",
      priority: item.priority || "normal",
      admin_response: item.admin_response || "",
      internal_note: item.internal_note || ""
    });
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await adminApi.updateSupportInquiry(selectedItem.id, edit);
      alert("성공적으로 저장되었습니다.");
      loadItems();
      setSelectedItem(null);
    } catch (error) {
      alert(error.response?.data?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  if (selectedItem) {
    return (
      <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
        <MobileHeader title="문의 상세 처리" onBack={() => setSelectedItem(null)} />
        <div style={{ padding: "16px", paddingBottom: "80px" }}>
          <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "12px", fontWeight: 700, color: "#3b82f6", backgroundColor: "#eff6ff", padding: "4px 8px", borderRadius: "4px" }}>
                {CATEGORY_LABELS[selectedItem.category] || selectedItem.category}
              </span>
              <span style={{ fontSize: "12px", color: "#64748b" }}>{formatTime(selectedItem.created_at)}</span>
            </div>
            <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1e293b", marginBottom: "8px", lineHeight: 1.4 }}>{selectedItem.title}</h2>
            <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.6, whiteSpace: "pre-wrap", marginBottom: "16px" }}>
              {selectedItem.content}
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
              <strong>문의자:</strong> {requesterLabel(selectedItem)}
            </div>
          </div>

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "15px", fontWeight: 700, color: "#334155", marginBottom: "12px" }}>
                <MessageSquareReply size={16} /> 고객 답변 작성
              </label>
              <textarea
                value={edit.admin_response}
                onChange={(e) => setEdit({ ...edit, admin_response: e.target.value })}
                placeholder="고객에게 전송될 답변 내용을 입력하세요"
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", minHeight: "150px", resize: "vertical" }}
              />
            </div>

            <div style={{ backgroundColor: "#fff", padding: "16px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <label style={{ fontSize: "14px", fontWeight: 700, color: "#334155", display: "block", marginBottom: "8px" }}>상태 변경</label>
              <select
                value={edit.status}
                onChange={(e) => setEdit({ ...edit, status: e.target.value })}
                style={{ width: "100%", padding: "12px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "14px", backgroundColor: "#fff" }}
              >
                <option value="pending">접수중 (답변 대기)</option>
                <option value="resolved">답변 완료</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              style={{ width: "100%", padding: "14px", backgroundColor: saving ? "#93c5fd" : "#2563eb", color: "#fff", border: "none", borderRadius: "8px", fontSize: "16px", fontWeight: 700 }}
            >
              {saving ? "저장 중..." : "답변 저장 및 처리 완료"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <MobileHeader title="고객센터 (관리자)" />
      <div style={{ backgroundColor: "#f8fafc", minHeight: "100vh" }}>
        
        {/* Tabs */}
        <div style={{ display: "flex", backgroundColor: "#fff", borderBottom: "1px solid #e2e8f0" }}>
          <button 
            onClick={() => setStatusFilter("all")} 
            style={{ flex: 1, padding: "14px", border: "none", backgroundColor: "transparent", fontSize: "14px", fontWeight: statusFilter === "all" ? 700 : 500, color: statusFilter === "all" ? "#2563eb" : "#64748b", borderBottom: statusFilter === "all" ? "2px solid #2563eb" : "2px solid transparent" }}
          >
            전체 내역
          </button>
          <button 
            onClick={() => setStatusFilter("pending")} 
            style={{ flex: 1, padding: "14px", border: "none", backgroundColor: "transparent", fontSize: "14px", fontWeight: statusFilter === "pending" ? 700 : 500, color: statusFilter === "pending" ? "#2563eb" : "#64748b", borderBottom: statusFilter === "pending" ? "2px solid #2563eb" : "2px solid transparent" }}
          >
            미답변 (접수중)
          </button>
        </div>

        {/* List */}
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
              <RefreshCw className="animate-spin" size={24} style={{ margin: "0 auto 8px" }} />
              <p>로딩 중...</p>
            </div>
          ) : items.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", backgroundColor: "#fff", borderRadius: "8px" }}>
              <Headphones size={32} style={{ margin: "0 auto 12px", color: "#cbd5e1" }} />
              <p style={{ margin: 0, fontWeight: 500 }}>조회된 문의가 없습니다.</p>
            </div>
          ) : (
            items.map((item) => (
              <div 
                key={item.id} 
                onClick={() => handleSelect(item)}
                style={{ padding: "16px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.05)", cursor: "pointer" }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "12px", fontWeight: 700, color: item.status === "resolved" ? "#059669" : "#dc2626", backgroundColor: item.status === "resolved" ? "#d1fae5" : "#fee2e2", padding: "4px 8px", borderRadius: "4px" }}>
                    {statusLabel(item.status)}
                  </span>
                  <span style={{ fontSize: "12px", color: "#64748b" }}>{CATEGORY_LABELS[item.category] || item.category}</span>
                </div>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "15px", fontWeight: 700, color: "#1e293b", lineHeight: 1.4 }}>
                  {item.title}
                </h3>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", color: "#64748b" }}>
                  <span>{requesterLabel(item)}</span>
                  <span>{formatTime(item.created_at)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}

export default MobileAdminSupportPage;
