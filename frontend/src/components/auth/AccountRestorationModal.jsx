import React, { useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { authApi } from "../../api/authApi";

export default function AccountRestorationModal({ restorationState, onRestored, onCancel }) {
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState("");

  if (!restorationState) return null;

  const { user, remainingDays } = restorationState;

  const handleRestore = async () => {
    setRestoring(true);
    setError("");
    try {
      const res = await authApi.restore();
      onRestored(res);
    } catch (e) {
      console.error("Failed to restore account:", e);
      setError(e?.response?.data?.message || e?.message || "계정 복구에 실패했습니다.");
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: "rgba(15, 23, 42, 0.65)",
      backdropFilter: "blur(4px)",
      zIndex: 9999,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px"
    }}>
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "20px",
        maxWidth: "440px",
        width: "100%",
        padding: "28px 24px",
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
        textAlign: "center"
      }}>
        <div style={{
          width: "56px",
          height: "56px",
          borderRadius: "50%",
          backgroundColor: "#fef3c7",
          color: "#d97706",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 16px auto"
        }}>
          <AlertTriangle size={28} />
        </div>

        <h3 style={{ fontSize: "18px", fontWeight: "800", color: "#0f172a", margin: "0 0 8px 0" }}>
          30일 탈퇴 유예 중인 계정입니다
        </h3>

        <p style={{ fontSize: "14px", color: "#475569", lineHeight: "1.5", margin: "0 0 16px 0" }}>
          안녕하세요, <strong>{user?.nickname || user?.name || "회원"}</strong>님!<br />
          현재 계정은 탈퇴 유예 기간입니다.
        </p>

        <div style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fef3c7",
          borderRadius: "12px",
          padding: "12px 16px",
          marginBottom: "20px",
          textAlign: "left"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "#92400e", fontWeight: "600" }}>
            <span>남은 유예 기간:</span>
            <span style={{ fontSize: "14px", fontWeight: "800", color: "#b45309" }}>{remainingDays ?? 30}일</span>
          </div>
          <p style={{ fontSize: "12px", color: "#78350f", margin: "6px 0 0 0", lineHeight: "1.4" }}>
            계정을 복구하시면 기존 작성 모임, 신청 내역 및 매너 점수 정보가 그대로 유지됩니다. 30일이 경과하면 DB에서 완전 삭제됩니다.
          </p>
        </div>

        {error && (
          <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "12px", fontWeight: "600" }}>
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: "10px" }}>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            style={{
              width: "100%",
              height: "44px",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: "700",
              cursor: restoring ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)"
            }}
          >
            {restoring ? <RefreshCw size={18} className="animate-spin" /> : "계정 복구하고 로그인하기"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            disabled={restoring}
            style={{
              width: "100%",
              height: "40px",
              backgroundColor: "#f1f5f9",
              color: "#64748b",
              border: "none",
              borderRadius: "12px",
              fontSize: "13px",
              fontWeight: "600",
              cursor: "pointer"
            }}
          >
            취소 (로그아웃 상태 유지)
          </button>
        </div>
      </div>
    </div>
  );
}
