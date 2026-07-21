import { useState, useEffect } from "react";
import { Settings, Save, RefreshCw, Shield, Bell, Database, ClipboardList, Eye, EyeOff } from "lucide-react";
import { adminApi } from "../../../api/adminApi";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

function MobileAdminSettingsPage() {
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
    supabaseUrl: "https://ssuncptlzlmuulqmtnqf.supabase.co",
    kakaoApiKey: "5d3ec3100e15e07c16c5a3799a090f1c",
    googleClientId: "40413-t9tr8ha.apps.googleusercontent.com"
  });
  const [lastSync, setLastSync] = useState(null);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState([]);
  const [showKakaoApiKey, setShowKakaoApiKey] = useState(false);
  const [showGoogleClientId, setShowGoogleClientId] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

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
      alert("시스템 설정이 성공적으로 저장되었습니다.");
      await fetchSettings();
    } catch (err) {
      console.error("Failed to save settings", err);
      alert("설정 저장에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewLogs = async () => {
    setShowLogs(true);
    setLogsLoading(true);
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

  return (
    <>
      <MobileHeader title="시스템 설정" />

      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #020617 0%, #1e1b4b 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: '#a5b4fc', letterSpacing: '1px' }}>SPORTSMATE SYSTEM</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>시스템 환경 설정</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>기본 정책, 데이터베이스 및 소셜 API 자격 증명을 구성합니다.</p>
      </section>

      <section style={{ padding: '16px', display: 'grid', gap: '16px' }}>
        
        {/* 설정 변경이력 이동 버튼 */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            type="button" 
            onClick={handleViewLogs}
            style={{
              flex: 1,
              height: '38px',
              borderRadius: '10px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              color: '#334155',
              fontSize: '13px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <ClipboardList size={14} /> 설정 변경 이력 보기
          </button>
          
          <button 
            type="button" 
            onClick={handleReset}
            style={{
              padding: '0 12px',
              height: '38px',
              borderRadius: '10px',
              border: '1px solid #fee2e2',
              backgroundColor: '#fff5f5',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: '800'
            }}
          >
            기본값 초기화
          </button>
        </div>

        {/* 설정 내용 양식 */}
        <form onSubmit={handleSave} style={{ display: 'grid', gap: '16px' }}>
          
          {/* 1. 기본 서비스 설정 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Settings size={15} style={{ color: '#3b82f6' }} /> 기본 서비스 정보
            </h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>사이트 명칭</label>
                <input 
                  type="text" 
                  name="siteName" 
                  value={settings.siteName} 
                  onChange={handleChange}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>대표 관리자 이메일</label>
                <input 
                  type="email" 
                  name="adminEmail" 
                  value={settings.adminEmail} 
                  onChange={handleChange}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input 
                  type="checkbox" 
                  name="maintenanceMode" 
                  id="maintenanceMode"
                  checked={settings.maintenanceMode} 
                  onChange={handleChange}
                  style={{ width: '16px', height: '16px' }}
                />
                <label htmlFor="maintenanceMode" style={{ fontSize: '13px', color: '#e11d48', fontWeight: 'bold', cursor: 'pointer' }}>서비스 정검 모드 활성화 (일반 유저 차단)</label>
              </div>
            </div>
          </article>

          {/* 2. 정책 규칙 및 제재 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Shield size={15} style={{ color: '#ef4444' }} /> 제재 및 가이드 정책
            </h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>폐쇄 유예 보관 기간 (일)</label>
                <input 
                  type="number" 
                  name="suspensionGracePeriod" 
                  value={settings.suspensionGracePeriod} 
                  onChange={handleChange}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>노쇼 시 감점 매너 점수</label>
                <input 
                  type="number" 
                  step="0.1" 
                  name="mannerRatingDecrement" 
                  value={settings.mannerRatingDecrement} 
                  onChange={handleChange}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>자동 정지 유발 누적 신고 수 (회)</label>
                <input 
                  type="number" 
                  name="autoBanReportCount" 
                  value={settings.autoBanReportCount} 
                  onChange={handleChange}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>
            </div>
          </article>

          {/* 3. API 자격 증명 */}
          <article className="detail-card" style={{ padding: '16px', borderRadius: '16px' }}>
            <h2 style={{ fontSize: '14px', fontWeight: '900', color: '#1e293b', margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Database size={15} style={{ color: '#10b981' }} /> 연동 API 키 정보
            </h2>
            <div style={{ display: 'grid', gap: '10px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Supabase URL</label>
                <input 
                  type="text" 
                  name="supabaseUrl" 
                  value={settings.supabaseUrl} 
                  onChange={handleChange}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Kakao Developers REST Key</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showKakaoApiKey ? "text" : "password"} 
                    name="kakaoApiKey" 
                    value={settings.kakaoApiKey} 
                    onChange={handleChange}
                    style={{ width: '100%', height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 36px 0 10px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKakaoApiKey(prev => !prev)}
                    title={showKakaoApiKey ? "API 키 숨기기" : "API 키 보기"}
                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {showKakaoApiKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>Google Cloud Client ID</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showGoogleClientId ? "text" : "password"} 
                    name="googleClientId" 
                    value={settings.googleClientId} 
                    onChange={handleChange}
                    style={{ width: '100%', height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 36px 0 10px', fontSize: '13px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowGoogleClientId(prev => !prev)}
                    title={showGoogleClientId ? "클라이언트 ID 숨기기" : "클라이언트 ID 보기"}
                    style={{ position: 'absolute', right: '6px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px', display: 'flex', alignItems: 'center' }}
                  >
                    {showGoogleClientId ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            </div>
          </article>

          <button 
            type="submit"
            disabled={loading}
            style={{
              height: '42px',
              borderRadius: '12px',
              border: 0,
              backgroundColor: 'var(--mobile-primary)',
              color: '#fff',
              fontWeight: '800',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              opacity: loading ? 0.7 : 1,
              marginBottom: '24px'
            }}
          >
            <Save size={15} /> {loading ? "설정 저장 중..." : "시스템 설정 적용"}
          </button>
        </form>
      </section>

      {/* 설정 변경 이력 모달 오버레이 */}
      {showLogs && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px'
          }}
          onClick={() => setShowLogs(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '380px',
              maxHeight: '80vh',
              overflowY: 'auto',
              padding: '20px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: '900', color: '#1e293b' }}>설정 변경 최근 이력</h3>
            
            {logsLoading ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#64748b' }}>이력 조회 중...</div>
            ) : logs.length === 0 ? (
              <div style={{ padding: '20px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>변경 이력이 없습니다.</div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {logs.slice(0, 5).map((log) => (
                  <div key={log.id} style={{ padding: '10px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '10px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: '10px' }}>
                      <span>수정자: {log.updated_by || "Admin"}</span>
                      <span>{log.updated_at ? new Date(log.updated_at).toLocaleString() : ""}</span>
                    </div>
                    <p style={{ margin: '4px 0 0 0', color: '#475569', lineHeight: 1.3 }}>{log.detail || "설정 속성을 변경했습니다."}</p>
                  </div>
                ))}
              </div>
            )}

            <button 
              type="button" 
              onClick={() => setShowLogs(false)}
              style={{
                height: '36px',
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                backgroundColor: '#fff',
                color: '#475569',
                fontSize: '13px',
                fontWeight: '800',
                marginTop: '16px'
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileAdminSettingsPage;
