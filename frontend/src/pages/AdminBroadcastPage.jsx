import { useState, useEffect } from "react";
import { 
  Megaphone, 
  Users, 
  MapPin, 
  Shield, 
  Send, 
  Bell, 
  Sparkles, 
  RefreshCw,
  Layers
} from "lucide-react";
import { adminApi } from "../api/adminApi";
import { useResponsive } from "../hooks/useResponsive";
import MobileAdminBroadcastPage from "../components/admin/mobile/MobileAdminBroadcastPage.jsx";

function AdminBroadcastPage() {
  const { isMobile } = useResponsive();

  if (isMobile) {
    return <MobileAdminBroadcastPage />;
  }

  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [view, setView] = useState("form"); // 'form' or 'logs'
  
  // Form states
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("/notifications");
  const [targetType, setTargetType] = useState("all"); // all, region, role
  const [targetValue, setTargetValue] = useState("");
  const [sendPush, setSendPush] = useState(true);

  // Region options (based on typical locations)
  const regionOptions = [
    { value: "서울", label: "서울특별시" },
    { value: "경기", label: "경기도" },
    { value: "인천", label: "인천광역시" },
    { value: "부산", label: "부산광역시" },
    { value: "대구", label: "대구광역시" },
    { value: "대전", label: "대전광역시" },
    { value: "광주", label: "광주광역시" },
    { value: "울산", label: "울산광역시" }
  ];

  // Role options
  const roleOptions = [
    { value: "user", label: "일반 회원" },
    { value: "admin", label: "일반 관리자" }
  ];

  const fetchLogs = async () => {
    setLogsLoading(true);
    try {
      const res = await adminApi.getBroadcastLogs();
      if (res) {
        setLogs(res);
        setCurrentPage(1);
      }
    } catch (err) {
      console.error("Failed to load broadcast logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      alert("알림 제목과 내용을 모두 입력해 주세요.");
      return;
    }

    if ((targetType === "region" || targetType === "role") && !targetValue) {
      alert("필터 상세 기준을 선택해 주세요.");
      return;
    }

    const confirmMsg = `정말 알림을 전송하시겠습니까?\n\n- 대상: ${
      targetType === "all" 
        ? "전체 회원" 
        : targetType === "region" 
          ? `지역 필터 [${targetValue}]` 
          : `등급 필터 [${targetValue}]`
    }\n- 제목: ${title}\n- 푸시 전송 여부: ${sendPush ? "Y" : "N"}`;

    if (!window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const res = await adminApi.sendBroadcast({
        title,
        message,
        link_url: linkUrl,
        target_type: targetType,
        target_value: targetValue,
        send_push: sendPush
      });
      if (res && res.success) {
        alert(res.message);
        // Reset form
        setTitle("");
        setMessage("");
        setLinkUrl("/notifications");
        setTargetType("all");
        setTargetValue("");
        setSendPush(true);
        // Refresh logs
        await fetchLogs();
      }
    } catch (err) {
      console.error("Failed to send broadcast", err);
      alert(err.response?.data?.message || "알림 전송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // Pagination calculations
  const itemsPerPage = 5;
  const reversedLogs = [...logs].reverse();
  const totalPages = Math.max(Math.ceil(reversedLogs.length / itemsPerPage), 1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = reversedLogs.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <div style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>

      {view === "form" ? (
        /* Form Card */
        <div className="admin-panel-card" style={{ padding: "30px", borderRadius: "16px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
          <form onSubmit={handleSend} style={{ display: "flex", flexDirection: "column", gap: "16px", height: "100%", flex: 1 }}>
            
            {/* Target Select */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={16} style={{ color: "#3b82f6" }} />
                  알림 대상 지정
                </label>
                {/* 발송 이력 보기 버튼 */}
                <button
                  type="button"
                  onClick={() => setView("logs")}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#2563eb",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#1d4ed8"; }}
                  onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#2563eb"; }}
                >
                  <Bell size={14} />
                  {`발송 이력 (${logs.length}건) →`}
                </button>
              </div>
              
              <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", padding: "8px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#334155", cursor: "pointer", fontWeight: targetType === "all" ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="targetType"
                    value="all"
                    checked={targetType === "all"}
                    onChange={() => { setTargetType("all"); setTargetValue(""); }}
                  />
                  전체 회원
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#334155", cursor: "pointer", fontWeight: targetType === "region" ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="targetType"
                    value="region"
                    checked={targetType === "region"}
                    onChange={() => { setTargetType("region"); setTargetValue(""); }}
                  />
                  지역별 필터
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", color: "#334155", cursor: "pointer", fontWeight: targetType === "role" ? 600 : 400 }}>
                  <input
                    type="radio"
                    name="targetType"
                    value="role"
                    checked={targetType === "role"}
                    onChange={() => { setTargetType("role"); setTargetValue(""); }}
                  />
                  역할 등급별 필터
                </label>
              </div>

              {/* Sub controls depending on target selection */}
              {targetType === "region" && (
                <div style={{ marginTop: "8px", display: "flex", gap: "10px", alignItems: "center", animation: "slideDown 0.2s ease" }}>
                  <MapPin size={16} style={{ color: "#ef4444" }} />
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                      fontSize: "14px",
                      backgroundColor: "#ffffff",
                      flex: 1
                    }}
                  >
                    <option value="">-- 활성 활동 지역 선택 --</option>
                    {regionOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}

              {targetType === "role" && (
                <div style={{ marginTop: "8px", display: "flex", gap: "10px", alignItems: "center", animation: "slideDown 0.2s ease" }}>
                  <Shield size={16} style={{ color: "#10b981" }} />
                  <select
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      outline: "none",
                      fontSize: "14px",
                      backgroundColor: "#ffffff",
                      flex: 1
                    }}
                  >
                    <option value="">-- 회원 등급 선택 --</option>
                    {roleOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Title & Message */}
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>알림 제목</label>
                <input
                  type="text"
                  placeholder="예: 스포츠메이트 서버 점검 안내"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    transition: "border-color 0.2s"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>상세 알림 내용</label>
                <textarea
                  placeholder="회원들이 직접 읽을 알림 메시지 세부 내용을 입력해 주세요..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    resize: "none",
                    fontFamily: "inherit",
                    flex: 1,
                    minHeight: "100px"
                  }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <label style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>클릭 시 랜딩 페이지 링크</label>
                <input
                  type="text"
                  placeholder="예: /notifications 또는 /meetings/12"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>
            </div>

            {/* Toggle Web Push */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "16px 20px",
              backgroundColor: "#f8fafc",
              borderRadius: "10px",
              border: "1px solid #e2e8f0"
            }}>
              <div>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "block" }}>웹 푸시(Web Push) 알림 발송 포함</span>
                <span style={{ fontSize: "12px", color: "#64748b" }}>회원의 브라우저에 실시간 푸시 배너를 직접 띄웁니다.</span>
              </div>
              <label style={{ position: "relative", display: "inline-block", width: "48px", height: "24px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={sendPush}
                  onChange={(e) => setSendPush(e.target.checked)}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span style={{
                  position: "absolute",
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: sendPush ? "#3b82f6" : "#cbd5e1",
                  transition: "0.3s",
                  borderRadius: "24px"
                }}>
                  <span style={{
                    position: "absolute",
                    content: '""',
                    height: "18px", width: "18px",
                    left: sendPush ? "26px" : "4px",
                    bottom: "3px",
                    backgroundColor: "white",
                    transition: "0.3s",
                    borderRadius: "50%"
                  }} />
                </span>
              </label>
            </div>

            {/* Submit Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
              <button
                type="submit"
                disabled={loading}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "12px 28px",
                  borderRadius: "10px",
                  border: "none",
                  backgroundColor: loading ? "#93c5fd" : "#2563eb",
                  color: "#ffffff",
                  fontSize: "15px",
                  fontWeight: 700,
                  cursor: loading ? "not-allowed" : "pointer",
                  transition: "background-color 0.2s",
                  boxShadow: "0 4px 6px -1px rgba(37, 99, 235, 0.2)"
                }}
                onMouseOver={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#1d4ed8"; }}
                onMouseOut={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "#2563eb"; }}
              >
                <Send size={16} />
                <span>{loading ? "알림 전송 중..." : "전체 알림 발송하기"}</span>
              </button>
            </div>

          </form>
        </div>
      ) : (
        /* Broadcast logs history */
        <div className="admin-panel-card" style={{ padding: "30px", borderRadius: "16px", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", boxSizing: "border-box" }}>
          {/* 뒤로가기 버튼 */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "20px" }}>
            <button
              type="button"
              onClick={() => setView("form")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 16px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: "0 2px 8px rgba(37, 99, 235, 0.25)"
              }}
              onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#1d4ed8"; }}
              onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#2563eb"; }}
            >
              ← 알림 발송하기
            </button>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <Bell size={18} style={{ color: "#3b82f6" }} />
              최근 알림 발송 이력
            </h3>
            <button
              type="button"
              onClick={fetchLogs}
              disabled={logsLoading}
              style={{
                border: "none",
                backgroundColor: "transparent",
                color: "#64748b",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "13px"
              }}
            >
              <RefreshCw size={14} className={logsLoading ? "animate-spin" : ""} />
              새로고침
            </button>
          </div>

          {logsLoading ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#64748b", flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
              발송 이력을 불러오는 중...
            </div>
          ) : (
            <>
              {/* Scrollable logs/placeholder area */}
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto", flex: 1 }}>
                {logs.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "45px 0", color: "#94a3b8", fontSize: "14px", border: "1px dashed #e2e8f0", borderRadius: "10px" }}>
                    기록된 전체 알림 발송 이력이 없습니다.
                  </div>
                ) : (
                  currentLogs.map((log, index) => (
                    <div key={index} style={{
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc",
                      transition: "transform 0.15s, box-shadow 0.15s"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontWeight: 700, color: "#1e293b" }}>{log.title}</span>
                          <span style={{
                            padding: "2px 8px",
                            borderRadius: "4px",
                            fontSize: "11px",
                            fontWeight: 600,
                            backgroundColor: "#e0f2fe",
                            color: "#0369a1"
                          }}>
                            {log.target_type === "all" 
                              ? "전체 회원" 
                              : log.target_type === "region" 
                                ? `지역: ${log.target_value}` 
                                : `등급: ${log.target_value}`}
                          </span>
                          {log.send_push && (
                            <span style={{
                              padding: "2px 8px",
                              borderRadius: "4px",
                              fontSize: "11px",
                              fontWeight: 600,
                              backgroundColor: "#f0fdf4",
                              color: "#166534"
                            }}>
                              웹 푸시 포함
                            </span>
                          )}
                        </div>
                        <span style={{ color: "#64748b" }}>{log.timestamp}</span>
                      </div>
                      
                      <div style={{ fontSize: "13px", color: "#475569", lineHeight: "1.5", marginBottom: "8px" }}>
                        {log.message}
                      </div>
                      
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px", color: "#64748b" }}>
                        <span>발송 관리자: <strong>{log.admin}</strong></span>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          수신 회원: <strong style={{ color: "#1e293b" }}>{log.target_count}명</strong>
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination Controls - Rendered Unconditionally */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "20px",
                paddingTop: "15px",
                borderTop: "1px solid #e2e8f0"
              }}>
                <span style={{ fontSize: "13px", color: "#64748b" }}>
                  총 <strong>{reversedLogs.length}</strong>건 중 <strong>{reversedLogs.length === 0 ? "0" : `${indexOfFirstItem + 1}-${Math.min(indexOfLastItem, reversedLogs.length)}`}</strong>건
                </span>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={currentPage === 1 || reversedLogs.length === 0}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: currentPage === 1 || reversedLogs.length === 0 ? "#f1f5f9" : "#ffffff",
                      color: currentPage === 1 || reversedLogs.length === 0 ? "#94a3b8" : "#334155",
                      cursor: currentPage === 1 || reversedLogs.length === 0 ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      fontWeight: 600
                    }}
                  >
                    이전
                  </button>
                  <span style={{ fontSize: "13px", color: "#334155", fontWeight: 700 }}>
                    {currentPage} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={currentPage === totalPages || reversedLogs.length === 0}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: currentPage === totalPages || reversedLogs.length === 0 ? "#f1f5f9" : "#ffffff",
                      color: currentPage === totalPages || reversedLogs.length === 0 ? "#94a3b8" : "#334155",
                      cursor: currentPage === totalPages || reversedLogs.length === 0 ? "not-allowed" : "pointer",
                      fontSize: "13px",
                      fontWeight: 600
                    }}
                  >
                    다음
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Animation Style helper */}
      <style>{`
        @media (max-width: 900px) {
          .admin-broadcast-grid {
            grid-template-columns: 1fr;
            height: auto;
          }
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
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

export default AdminBroadcastPage;
