import { useState, useEffect } from "react";
import { Settings, Save, RefreshCw, Shield, Bell, HeartHandshake, Database, Search, Calendar, ChevronDown, X } from "lucide-react";
import { adminApi } from "../api/adminApi";

function AdminSettingsPage() {
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({
    siteName: "SportsMate",
    adminEmail: "admin@sportsmate.co.kr",
    maintenanceMode: false,
    suspensionGracePeriod: 30,
    defaultMaxParticipants: 6,
    mannerRatingDecrement: 1.5,
    autoBanReportCount: 5,
    sessionExpiryMinutes: 60,
    termsVersion: "v1.4",
    supabaseUrl: "https://rhtjdals00-png.supabase.co",
    kakaoApiKey: "8f7b2a9d6e4c3f5b8a0d2f9e4c1b5a7d",
    googleClientId: "40413-t9tr8ha.apps.googleusercontent.com"
  });
  const [lastSync, setLastSync] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [logs, setLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // States for log filtering & pagination
  const [logSearchQuery, setLogSearchQuery] = useState("");
  const [logStartDate, setLogStartDate] = useState("");
  const [logEndDate, setLogEndDate] = useState("");
  const [visibleLogsCount, setVisibleLogsCount] = useState(10);

  const fetchSettings = async () => {
    try {
      const res = await adminApi.getSettings();
      if (res) {
        setSettings(res.settings || res);
        setLastSync(res.last_sync || null);
      }
    } catch (err) {
      console.error("Failed to load settings", err);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : (type === "number" ? Number(value) : value)
    }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await adminApi.updateSettings(settings);
      alert("시스템 설정이 안전하게 데이터베이스에 저장되고 실서버에 반영되었습니다.");
      await fetchSettings();
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("설정 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async () => {
    setShowLogsModal(true);
    setLogsLoading(true);
    setLogSearchQuery("");
    setLogStartDate("");
    setLogEndDate("");
    setVisibleLogsCount(10);
    try {
      const res = await adminApi.getSettingsLogs();
      if (res) {
        setLogs(res);
      }
    } catch (err) {
      console.error("Failed to load logs", err);
    } finally {
      setLogsLoading(false);
    }
  };

  const handleReset = () => {
    if (window.confirm("설정 값을 기본값으로 초기화하시겠습니까?")) {
      setSettings({
        siteName: "SportsMate",
        adminEmail: "admin@sportsmate.co.kr",
        maintenanceMode: false,
        suspensionGracePeriod: 30,
        defaultMaxParticipants: 6,
        mannerRatingDecrement: 1.5,
        autoBanReportCount: 5,
        sessionExpiryMinutes: 60,
        termsVersion: "v1.4",
        supabaseUrl: "https://rhtjdals00-png.supabase.co",
        kakaoApiKey: "8f7b2a9d6e4c3f5b8a0d2f9e4c1b5a7d",
        googleClientId: "40413-t9tr8ha.apps.googleusercontent.com"
      });
    }
  };

  // Filter and reverse the logs (newest first)
  const filteredLogs = logs
    .slice()
    .reverse()
    .filter((log) => {
      // 1. Keyword search (admin name or changes content)
      const query = logSearchQuery.trim().toLowerCase();
      const matchesKeyword = !query || 
        log.admin.toLowerCase().includes(query) || 
        log.changes.some(change => change.toLowerCase().includes(query));

      // 2. Date filtering (timestamp format: "YYYY-MM-DD HH:MM:SS")
      const logDateStr = log.timestamp.split(" ")[0]; // "YYYY-MM-DD"
      
      const matchesStartDate = !logStartDate || logDateStr >= logStartDate;
      const matchesEndDate = !logEndDate || logDateStr <= logEndDate;

      return matchesKeyword && matchesStartDate && matchesEndDate;
    });

  // Take only visible ones
  const displayedLogs = filteredLogs.slice(0, visibleLogsCount);

  return (
    <div className="admin-panel-card" style={{ maxWidth: "900px", margin: "0 auto" }}>
      <div className="admin-panel-card__header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
        <h2 className="admin-panel-card__title" style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <Settings size={22} className="text-blue-600" />
          <span>전체 시스템 설정</span>
        </h2>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            {lastSync ? (
              <>마지막 동기화 시각: <strong>{lastSync.timestamp}</strong> (관리자: <strong>{lastSync.admin}</strong>)</>
            ) : (
              "마지막 동기화 시각: 기록 없음"
            )}
          </span>
          <button
            type="button"
            onClick={handleViewLogs}
            style={{
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#ffffff",
              color: "#475569",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#f8fafc";
              e.currentTarget.style.borderColor = "#94a3b8";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
              e.currentTarget.style.borderColor = "#cbd5e1";
            }}
          >
            로그 전체보기
          </button>
        </div>
      </div>

      <div className="admin-panel-card__body">
        <form onSubmit={handleSave}>
          
          {/* Section 1: Basic Site Settings */}
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <legend style={{ padding: "0 8px", fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <Shield size={16} style={{ color: "#3b82f6" }} /> 기본 사이트 설정
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>서비스명</label>
                <input 
                  type="text" 
                  name="siteName" 
                  value={settings.siteName} 
                  onChange={handleChange}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" }}
                  required
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>대표 이메일</label>
                <input 
                  type="email" 
                  name="adminEmail" 
                  value={settings.adminEmail} 
                  onChange={handleChange}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" }}
                  required
                />
              </div>
            </div>
            <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "12px", backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
              <input 
                type="checkbox" 
                id="maintenanceMode" 
                name="maintenanceMode" 
                checked={settings.maintenanceMode} 
                onChange={handleChange}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <div>
                <label htmlFor="maintenanceMode" style={{ display: "block", fontSize: "13px", fontWeight: 700, color: settings.maintenanceMode ? "#ef4444" : "#1e293b", cursor: "pointer" }}>
                  서비스 점검 모드 활성화 (Maintenance Mode)
                </label>
                <span style={{ fontSize: "11px", color: "#64748b" }}>활성화 시, 일반 유저는 웹사이트 접속 시 점검 안내 화면으로 리다이렉트됩니다.</span>
              </div>
            </div>
          </fieldset>

          {/* Section 2: Meeting & Matching Settings */}
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <legend style={{ padding: "0 8px", fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <HeartHandshake size={16} style={{ color: "#10b981" }} /> 모임 및 매치 규칙 설정
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  모임 폐쇄 유예 기간
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="number" 
                    name="suspensionGracePeriod" 
                    value={settings.suspensionGracePeriod} 
                    onChange={handleChange}
                    style={{ width: "80px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", textAlign: "right" }}
                    min="1"
                    required
                  />
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>일 (기본값: 30일)</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>기본 개설 최대 정원</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="number" 
                    name="defaultMaxParticipants" 
                    value={settings.defaultMaxParticipants} 
                    onChange={handleChange}
                    style={{ width: "80px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", textAlign: "right" }}
                    min="2"
                    required
                  />
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>명</span>
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  신고 접수 시 호스트 매너 점수 감점량
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="number" 
                    name="mannerRatingDecrement" 
                    value={settings.mannerRatingDecrement} 
                    onChange={handleChange}
                    style={{ width: "80px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", textAlign: "right" }}
                    step="0.1"
                    min="0"
                    required
                  />
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>도 (신고 사유 정당성 검증 후 차감 적용)</span>
                </div>
              </div>
            </div>
          </fieldset>

          {/* Section 3: Safety & Restriction Settings */}
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <legend style={{ padding: "0 8px", fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <Bell size={16} style={{ color: "#ef4444" }} /> 안전 및 보안 정책
            </legend>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>
                  자동 계정 정지 기준 (신고 횟수)
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="number" 
                    name="autoBanReportCount" 
                    value={settings.autoBanReportCount} 
                    onChange={handleChange}
                    style={{ width: "80px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", textAlign: "right" }}
                    min="1"
                    required
                  />
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>회 누적 시 일시 정지</span>
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>관리자 세션 만료 시간</label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <input 
                    type="number" 
                    name="sessionExpiryMinutes" 
                    value={settings.sessionExpiryMinutes} 
                    onChange={handleChange}
                    style={{ width: "80px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none", textAlign: "right" }}
                    min="5"
                    required
                  />
                  <span style={{ fontSize: "13px", color: "#64748b", fontWeight: 500 }}>분</span>
                </div>
              </div>
              <div style={{ gridColumn: "span 2" }}>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>회원가입 약관(Terms) 버전</label>
                <input 
                  type="text" 
                  name="termsVersion" 
                  value={settings.termsVersion} 
                  onChange={handleChange}
                  style={{ width: "120px", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px", outline: "none" }}
                  required
                />
              </div>
            </div>
          </fieldset>

          {/* Section 4: External API Link Settings */}
          <fieldset style={{ border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", marginBottom: "24px" }}>
            <legend style={{ padding: "0 8px", fontSize: "14px", fontWeight: 700, color: "#1e293b", display: "flex", alignItems: "center", gap: "6px" }}>
              <Database size={16} style={{ color: "#f59e0b" }} /> 외부 API 연동 설정
            </legend>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", marginTop: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Supabase Project URL</label>
                <input 
                  type="text" 
                  name="supabaseUrl" 
                  value={settings.supabaseUrl} 
                  onChange={handleChange}
                  style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace", color: "#334155", outline: "none" }}
                  required
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Kakao Developers API Key</label>
                  <input 
                    type="password" 
                    name="kakaoApiKey" 
                    value={settings.kakaoApiKey} 
                    onChange={handleChange}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace", color: "#334155", outline: "none" }}
                    required
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 600, color: "#475569", marginBottom: "6px" }}>Google Cloud Client ID</label>
                  <input 
                    type="password" 
                    name="googleClientId" 
                    value={settings.googleClientId} 
                    onChange={handleChange}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", fontFamily: "monospace", color: "#334155", outline: "none" }}
                    required
                  />
                </div>
              </div>
            </div>
          </fieldset>

          {/* Form Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "12px", marginTop: "24px" }}>
            <button
              type="button"
              onClick={handleReset}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 20px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                color: "#475569",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.backgroundColor = "#f8fafc";
                e.currentTarget.style.borderColor = "#94a3b8";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.backgroundColor = "#ffffff";
                e.currentTarget.style.borderColor = "#cbd5e1";
              }}
            >
              <RefreshCw size={15} />
              <span>기본값 초기화</span>
            </button>

            <button
              type="submit"
              disabled={loading}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 24px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "14px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background-color 0.15s ease",
                opacity: loading ? 0.7 : 1
              }}
              onMouseOver={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#1d4ed8";
              }}
              onMouseOut={(e) => {
                if (!loading) e.currentTarget.style.backgroundColor = "#2563eb";
              }}
            >
              <Save size={15} />
              <span>{loading ? "저장 중..." : "설정 저장하기"}</span>
            </button>
          </div>

        </form>
      </div>

      {/* Logs Modal */}
      {showLogsModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(15, 23, 42, 0.6)",
          backdropFilter: "blur(4px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 9999,
          padding: "20px"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            width: "100%",
            maxWidth: "650px",
            height: "80vh",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            animation: "modalFadeIn 0.2s ease-out"
          }}>
            <style>{`
              @keyframes modalFadeIn {
                from { transform: scale(0.95); opacity: 0; }
                to { transform: scale(1); opacity: 1; }
              }
            `}</style>
            
            {/* Modal Header */}
            <div style={{
              padding: "20px 24px",
              borderBottom: "1px solid #f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}>
              <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#0f172a" }}>
                시스템 설정 변경 로그 내역
              </h3>
              <button 
                type="button"
                onClick={() => setShowLogsModal(false)}
                style={{
                  border: "none",
                  backgroundColor: "transparent",
                  fontSize: "20px",
                  color: "#64748b",
                  cursor: "pointer",
                  lineHeight: 1
                }}
              >
                &times;
              </button>
            </div>

            {/* Filter Section */}
            <div style={{
              padding: "16px 24px",
              backgroundColor: "#f8fafc",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
              {/* Search input with search icon */}
              <div style={{ position: "relative", width: "100%" }}>
                <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder="관리자 이름 또는 변경 내용 검색..."
                  value={logSearchQuery}
                  onChange={(e) => {
                    setLogSearchQuery(e.target.value);
                    setVisibleLogsCount(10);
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 36px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
                {logSearchQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogSearchQuery("");
                      setVisibleLogsCount(10);
                    }}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      border: "none",
                      backgroundColor: "transparent",
                      cursor: "pointer",
                      color: "#94a3b8",
                      padding: 0
                    }}
                  >
                    <X size={16} />
                  </button>
                )}
              </div>

              {/* Date Filters row */}
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={14} style={{ color: "#64748b" }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "#475569" }}>기간:</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="date"
                    value={logStartDate}
                    onChange={(e) => {
                      setLogStartDate(e.target.value);
                      setVisibleLogsCount(10);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                      color: "#334155"
                    }}
                  />
                  <span style={{ color: "#94a3b8" }}>~</span>
                  <input
                    type="date"
                    value={logEndDate}
                    onChange={(e) => {
                      setLogEndDate(e.target.value);
                      setVisibleLogsCount(10);
                    }}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none",
                      color: "#334155"
                    }}
                  />
                </div>
                {(logStartDate || logEndDate || logSearchQuery) && (
                  <button
                    type="button"
                    onClick={() => {
                      setLogStartDate("");
                      setLogEndDate("");
                      setLogSearchQuery("");
                      setVisibleLogsCount(10);
                    }}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "none",
                      backgroundColor: "#e2e8f0",
                      color: "#475569",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "background-color 0.2s"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#cbd5e1"}
                    onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#e2e8f0"}
                  >
                    필터 초기화
                  </button>
                )}
              </div>
            </div>

            {/* Modal Content */}
            <div style={{
              padding: "24px",
              overflowY: "auto",
              flex: 1
            }}>
              {logsLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  로그 데이터를 불러오는 중...
                </div>
              ) : filteredLogs.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b", fontSize: "14px" }}>
                  {logSearchQuery || logStartDate || logEndDate 
                    ? "검색 조건에 맞는 로그 내역이 없습니다."
                    : "기록된 시스템 설정 변경 이력이 없습니다."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {displayedLogs.map((log, index) => (
                    <div key={index} style={{
                      padding: "16px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      backgroundColor: "#f8fafc"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "13px" }}>
                        <span style={{ fontWeight: 700, color: "#1e293b" }}>{log.admin}</span>
                        <span style={{ color: "#64748b" }}>{log.timestamp}</span>
                      </div>
                      <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#475569", lineHeight: "1.6" }}>
                        {log.changes.map((change, cIdx) => (
                          <li key={cIdx}>{change}</li>
                        ))}
                      </ul>
                    </div>
                  ))}

                  {/* Load More Button */}
                  {filteredLogs.length > visibleLogsCount && (
                    <button
                      type="button"
                      onClick={() => setVisibleLogsCount(prev => prev + 10)}
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        border: "1px solid #e2e8f0",
                        backgroundColor: "#ffffff",
                        color: "#2563eb",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        marginTop: "8px",
                        transition: "background-color 0.2s"
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#ffffff"}
                    >
                      <ChevronDown size={16} />
                      <span>더 보기 ({filteredLogs.length - visibleLogsCount}개 남음)</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{
              padding: "16px 24px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              justifyContent: "flex-end"
            }}>
              <button
                type="button"
                onClick={() => setShowLogsModal(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  color: "#475569",
                  fontSize: "14px",
                  fontWeight: 600,
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

export default AdminSettingsPage;
