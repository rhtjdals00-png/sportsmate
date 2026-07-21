import { useState } from "react";
import { useParams } from "react-router-dom";
import { QrCode } from "lucide-react";
import Button from "../components/common/Button.jsx";
import EmptyState from "../components/common/EmptyState.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";

function HostAttendancePage() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [checkingId, setCheckingId] = useState(null);
  const [isShowingQR, setIsShowingQR] = useState(false);
  const attendance = useAsync(() => meetingApi.attendance(meetingId), [meetingId, refreshKey]);
  const checkedIds = new Set((attendance.data?.items || []).map((item) => item.user.id));

  const checkParticipant = async (userId) => {
    setCheckingId(userId);
    try {
      await meetingApi.checkAttendance(meetingId, { user_id: userId });
      setRefreshKey((value) => value + 1);
    } finally {
      setCheckingId(null);
    }
  };

  return (
    <>
      <MobileHeader title="출석 관리" />
      
      <div style={{ padding: '16px 16px 0 16px' }}>
        <button 
          onClick={() => setIsShowingQR(true)}
          style={{ 
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            width: '100%', padding: '16px', background: '#3b82f6', color: 'white', 
            borderRadius: '12px', border: 'none', fontWeight: 'bold', fontSize: '16px', 
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.25)', cursor: 'pointer' 
          }}
        >
          <QrCode size={20} />
          QR 출력하기
        </button>
      </div>

      {attendance.loading ? (
        <LoadingCards count={2} />
      ) : attendance.data?.approved_participants?.length ? (
        <div className="attendance-list">
          {(attendance.data?.approved_participants || []).map((participant) => (
            <article key={participant.id}>
              <div>
                <img src={participant.user.profile_image_url || "/images/logo.png"} alt="" />
                <strong>{participant.user.nickname}</strong>
              </div>
              <div className="attendance-list__control">
                <span className={checkedIds.has(participant.user.id) ? "checked" : ""}>{checkedIds.has(participant.user.id) ? "출석 완료" : "미출석"}</span>
                {!checkedIds.has(participant.user.id) && (
                  <Button type="button" onClick={() => checkParticipant(participant.user.id)} disabled={checkingId === participant.user.id}>
                    {checkingId === participant.user.id ? "처리 중" : "출석 체크"}
                  </Button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="출석 대상이 없습니다." description="승인된 참여자가 생기면 출석 체크를 진행할 수 있습니다." />
      )}

      {isShowingQR && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px'
        }}>
          <div style={{
            background: '#fff', borderRadius: '24px', width: '100%', maxWidth: '340px',
            padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px'
          }}>
            <h3 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0 }}>출석 QR 코드</h3>
            <div style={{ 
              width: '200px', height: '200px', background: '#f1f5f9', borderRadius: '12px',
              display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
              <span style={{ color: '#94a3b8' }}>QR 이미지 출력 예정</span>
            </div>
            <p style={{ margin: 0, color: '#64748b', textAlign: 'center', fontSize: '15px' }}>
              회원분들이 이 QR을 스캔하면<br />자동으로 출석 처리됩니다.
            </p>
            <button
              onClick={() => setIsShowingQR(false)}
              style={{
                width: '100%', padding: '14px', background: '#e2e8f0', border: 'none',
                borderRadius: '12px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer'
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

export default HostAttendancePage;
