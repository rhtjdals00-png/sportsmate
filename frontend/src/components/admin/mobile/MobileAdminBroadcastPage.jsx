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
  Layers,
  ChevronRight,
  ArrowLeft
} from "lucide-react";
import { adminApi } from "../../../api/adminApi";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

function MobileAdminBroadcastPage() {
  const [loading, setLoading] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Form states
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("/notifications");
  const [targetType, setTargetType] = useState("all");
  const [targetValue, setTargetValue] = useState("");
  const [sendPush, setSendPush] = useState(true);

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
        setTitle("");
        setMessage("");
        setLinkUrl("/notifications");
        setTargetType("all");
        setTargetValue("");
        setSendPush(true);
        await fetchLogs();
      }
    } catch (err) {
      console.error("Failed to send broadcast", err);
      alert(err.response?.data?.message || "알림 전송에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const itemsPerPage = 4;
  const reversedLogs = [...logs].reverse();
  const totalPages = Math.max(Math.ceil(reversedLogs.length / itemsPerPage), 1);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentLogs = reversedLogs.slice(indexOfFirstItem, indexOfLastItem);

  return (
    <>
      <MobileHeader title="전체 알림 발송" />

      <section className="mobile-admin-hero" style={{ padding: '16px', background: 'linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%)', color: '#fff', textAlign: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: '900', color: '#60a5fa', letterSpacing: '1px' }}>SPORTSMATE NOTIFIER</span>
        <h1 style={{ fontSize: '20px', margin: '4px 0 6px 0', fontWeight: '900', color: '#fff' }}>전체 공지 및 알림 발송</h1>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.8 }}>특정 그룹 혹은 전체 회원에게 일괄 푸시 알림을 보냅니다.</p>
      </section>

      <section style={{ padding: '16px', display: 'grid', gap: '16px' }}>
        {/* 발송 폼 */}
        <form onSubmit={handleSend} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', display: 'grid', gap: '14px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.02)' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Megaphone size={16} style={{ color: '#2563eb' }} />
            새 알림 작성
          </h2>

          <div style={{ display: 'grid', gap: '6px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>알림 대상 지정</label>
            <div style={{ display: 'flex', gap: '10px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '10px', border: '1px solid #cbd5e1' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}>
                <input 
                  type="radio" 
                  name="targetType" 
                  value="all" 
                  checked={targetType === "all"}
                  onChange={() => { setTargetType("all"); setTargetValue(""); }}
                />
                전체
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}>
                <input 
                  type="radio" 
                  name="targetType" 
                  value="region" 
                  checked={targetType === "region"}
                  onChange={() => { setTargetType("region"); setTargetValue(""); }}
                />
                지역별
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#334155' }}>
                <input 
                  type="radio" 
                  name="targetType" 
                  value="role" 
                  checked={targetType === "role"}
                  onChange={() => { setTargetType("role"); setTargetValue(""); }}
                />
                등급별
              </label>
            </div>
          </div>

          {targetType === "region" && (
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>지역 선택</label>
              <select 
                value={targetValue} 
                onChange={(e) => setTargetValue(e.target.value)}
                style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 8px', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="">-- 지역 선택 --</option>
                {regionOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}

          {targetType === "role" && (
            <div style={{ display: 'grid', gap: '4px' }}>
              <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>등급 권한 선택</label>
              <select 
                value={targetValue} 
                onChange={(e) => setTargetValue(e.target.value)}
                style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 8px', fontSize: '13px', backgroundColor: '#fff' }}
              >
                <option value="">-- 등급 선택 --</option>
                {roleOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          )}

          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>알림 제목</label>
            <input 
              type="text" 
              placeholder="예: [안내] 서비스 임시 점검 공지"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>내용</label>
            <textarea 
              rows={3}
              placeholder="알림 상세 내용을 입력해 주세요..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit' }}
            />
          </div>

          <div style={{ display: 'grid', gap: '4px' }}>
            <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b' }}>연결 URL (선택)</label>
            <input 
              type="text" 
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input 
              type="checkbox" 
              id="sendPush" 
              checked={sendPush}
              onChange={(e) => setSendPush(e.target.checked)}
              style={{ width: '16px', height: '16px' }}
            />
            <label htmlFor="sendPush" style={{ fontSize: '13px', color: '#475569', fontWeight: 'bold', cursor: 'pointer' }}>실시간 브라우저 푸시 알림 발송</label>
          </div>

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
              marginTop: '6px',
              opacity: loading ? 0.7 : 1
            }}
          >
            <Send size={15} /> {loading ? "알림 발송 중..." : "전체 알림 발송하기"}
          </button>
        </form>

        {/* 이전 알림 내역 */}
        <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: 0 }}>이전 알림 이력 ({logs.length}건)</h2>
            <button 
              type="button" 
              onClick={fetchLogs} 
              disabled={logsLoading}
              style={{ border: 0, background: 'none', color: '#64748b', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '12px', fontWeight: '800' }}
            >
              <RefreshCw size={12} /> 새로고침
            </button>
          </div>

          {logsLoading ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#64748b' }}>이력 조회 중...</div>
          ) : currentLogs.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>발송된 내역이 없습니다.</div>
          ) : (
            <div style={{ display: 'grid', gap: '8px' }}>
              {currentLogs.map((log, index) => {
                const targetLabel = log.target_type === "all" ? "전체 회원" : log.target_type === "region" ? `지역: ${log.target_value}` : `등급: ${log.target_value}`;
                return (
                  <div 
                    key={log.id || `log-${index}`} 
                    style={{
                      padding: '12px',
                      backgroundColor: '#f8fafc',
                      border: '1px solid #f1f5f9',
                      borderRadius: '12px',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: '4px' }}>
                        {targetLabel}
                      </span>
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                        {log.created_at ? new Date(log.created_at).toLocaleString() : ""}
                      </span>
                    </div>
                    <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block', marginTop: '6px' }}>{log.title}</strong>
                    <p style={{ margin: '4px 0 0 0', color: '#475569', fontSize: '12px', lineHeight: 1.4 }}>{log.message}</p>
                    {log.link_url && (
                      <span style={{ display: 'block', marginTop: '4px', fontSize: '11px', color: '#2563eb', fontFamily: 'monospace' }}>Link: {log.link_url}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', marginTop: '16px' }}>
              <button 
                type="button" 
                disabled={currentPage === 1} 
                onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '11px', fontWeight: '800' }}
              >
                이전
              </button>
              <span style={{ fontSize: '12px', color: '#475569', fontWeight: '800' }}>{currentPage} / {totalPages}</span>
              <button 
                type="button" 
                disabled={currentPage === totalPages} 
                onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                style={{ height: '30px', padding: '0 10px', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: '#fff', fontSize: '11px', fontWeight: '800' }}
              >
                다음
              </button>
            </div>
          )}
        </section>
      </section>
    </>
  );
}

export default MobileAdminBroadcastPage;
