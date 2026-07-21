import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "../../../api/adminApi";
import { 
  Trophy, 
  User, 
  Calendar, 
  Users, 
  Percent, 
  ShieldCheck, 
  AlertTriangle, 
  Trash2, 
  ArrowLeft, 
  Edit, 
  XCircle,
  RotateCcw
} from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

const meetingDetailDb = {
  "1": {
    title: "주말 오전 11:11 축구 모임",
    host: "킥마스터",
    sport: "축구",
    emoji: "⚽",
    createdDate: "2023.10.15",
    capacity: "12 / 16",
    location: "서울 서초구 반포체육공원 축구장",
    stats: {
      totalAttendees: 12,
      attendeesTrend: "최근 2명 추가 가입",
      fillRate: 75,
      hostRating: "A+",
      hostRatingNote: "신고 누적 0건 우수 방장"
    },
    members: [
      { id: 101, nickname: "킥마스터", role: "방장", joinedAt: "2023.10.15", manner: "4.9 / 5.0" }
    ],
    reports: [],
    memo: "정원 관리가 안정적임."
  }
};

import { getSportEmoji } from "../../../utils/sportIcons.jsx";

function MobileAdminMeetingDetailPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meetingData, setMeetingData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    location_name: "",
    address: "",
    max_participants: 10,
    purpose: ""
  });

  const fetchMeetingDetail = async () => {
    try {
      setLoading(true);
      const res = await adminApi.meetingDetail(meetingId);
      if (res && res.meeting) {
        const m = res.meeting;
        const fillPercent = m.max_participants ? Math.round((m.current_participants / m.max_participants) * 100) : 0;
        const formatted = {
          id: m.id,
          title: m.title || "제목 없음",
          host: m.host ? (m.host.nickname || m.host.name || `방장 #${m.host.id}`) : "알 수 없음",
          sport: m.sport ? m.sport.name : "일반",
          emoji: getSportEmoji(m.sport ? m.sport.name : ""),
          createdDate: m.created_at ? (() => {
            const d = new Date(m.created_at);
            return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
          })() : "2023.10.15",
          capacity: `${m.current_participants || 0} / ${m.max_participants || 0}`,
          max_participants: m.max_participants || 0,
          location: m.address || m.location_name || "위치 정보 없음",
          location_name: m.location_name || "",
          address: m.address || "",
          purpose: m.purpose || "",
          status: m.status || "open",
          remaining_days: m.remaining_days,
          stats: {
            totalAttendees: m.current_participants || 0,
            attendeesTrend: `최대 정원 ${m.max_participants || 0}명`,
            fillRate: fillPercent,
            hostRating: "A",
            hostRatingNote: "신고 및 제재 이력 없음"
          },
          members: m.members || [],
          reports: m.reports || [],
          memo: m.description || "등록된 상세 소개 설명이 없습니다."
        };
        setMeetingData(formatted);
      }
    } catch (err) {
      console.error("API error while loading meeting detail", err);
      const fallback = meetingDetailDb[meetingId] || meetingDetailDb["1"];
      setMeetingData({ ...fallback, id: Number(meetingId) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetingDetail();
  }, [meetingId]);

  const handleEditInfo = () => {
    if (!meetingData) return;
    setEditForm({
      title: meetingData.title,
      description: meetingData.memo,
      location_name: meetingData.location_name || "",
      address: meetingData.address || "",
      max_participants: meetingData.max_participants,
      purpose: meetingData.purpose || ""
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.updateMeeting(meetingId, editForm);
      if (res && res.meeting) {
        const m = res.meeting;
        const fillPercent = m.max_participants ? Math.round((m.current_participants / m.max_participants) * 100) : 0;
        setMeetingData(prev => ({
          ...prev,
          title: m.title || "제목 없음",
          purpose: m.purpose || "",
          memo: m.description || "등록된 상세 소개 설명이 없습니다.",
          location_name: m.location_name || "",
          address: m.address || "",
          max_participants: m.max_participants || 0,
          location: m.address || m.location_name || "위치 정보 없음",
          capacity: `${m.current_participants || 0} / ${m.max_participants || 0}`,
          status: m.status || "open",
          remaining_days: m.remaining_days,
          stats: {
            ...prev.stats,
            totalAttendees: m.current_participants || 0,
            attendeesTrend: `최대 정원 ${m.max_participants || 0}명`,
            fillRate: fillPercent
          }
        }));
        setIsEditModalOpen(false);
        alert("모임 정보가 성공적으로 수정되었습니다.");
      }
    } catch (err) {
      console.error("Failed to update meeting info", err);
      alert("모임 정보 수정에 실패했습니다.");
    }
  };

  const handleKickMember = async (memberId, nickname) => {
    if (!meetingData) return;
    if (window.confirm(`정말 '${nickname}' 멤버를 이 모임에서 강제 추방하시겠습니까?`)) {
      try {
        await adminApi.kickMember(meetingId, memberId);
        setMeetingData(prev => {
          const nextMembers = prev.members.filter(m => m.id !== memberId);
          const nextCount = Math.max(1, nextMembers.length);
          const maxParticipants = prev.max_participants || 1;
          const fillPercent = Math.round((nextCount / maxParticipants) * 100);
          return {
            ...prev,
            members: nextMembers,
            capacity: `${nextCount} / ${maxParticipants}`,
            stats: {
              ...prev.stats,
              totalAttendees: nextCount,
              fillRate: fillPercent
            }
          };
        });
        alert("성공적으로 추방 처리되었습니다.");
      } catch (err) {
        console.error("Failed to kick member", err);
        alert("멤버 강제 추방에 실패했습니다.");
      }
    }
  };

  const handleCloseMeeting = async () => {
    if (!meetingData) return;
    if (window.confirm(`'${meetingData.title}' 모임을 폐쇄 처리하시겠습니까?\n\n이 모임은 즉시 영구 삭제되지 않고 30일 동안 폐쇄 유예 상태(비활성화)로 보관되며, 이 기간 동안 모든 활동이 정지됩니다.`)) {
      try {
        await adminApi.deleteMeeting(meetingId);
        setMeetingData(prev => ({ ...prev, status: "closed" }));
        alert("모임이 성공적으로 폐쇄 처리되었습니다.");
      } catch (err) {
        console.error("Failed to delete meeting", err);
        alert("모임 폐쇄에 실패했습니다.");
      }
    }
  };

  const handleRestoreMeeting = async () => {
    if (!meetingData) return;
    if (window.confirm(`'${meetingData.title}' 모임을 정상 상태로 복구하시겠습니까?\n\n복구 즉시 모든 방 활동과 채팅방 이용이 다시 활성화됩니다.`)) {
      try {
        const res = await adminApi.restoreMeeting(meetingId);
        const nextStatus = res?.meeting?.status || "open";
        setMeetingData(prev => ({ ...prev, status: nextStatus }));
        alert("모임이 성공적으로 복구되었습니다.");
      } catch (err) {
        console.error("Failed to restore meeting", err);
        alert("모임 복구에 실패했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="모임 상세 관리" />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', color: '#64748b' }}>
          <span>모임 상세 정보를 불러오는 중...</span>
        </div>
      </>
    );
  }

  if (!meetingData) {
    return (
      <>
        <MobileHeader title="모임 상세 관리" />
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontWeight: '800' }}>모임 정보를 불러오지 못했습니다.</p>
          <button 
            type="button" 
            onClick={() => navigate("/admin/meetings")}
            style={{ border: 0, background: 'none', color: 'var(--mobile-primary)', fontWeight: '800', marginTop: '12px' }}
          >
            모임 목록으로 돌아가기
          </button>
        </div>
      </>
    );
  }

  const isClosed = meetingData.status === "closed" || meetingData.status === "cancelled" || meetingData.status === "폐쇄 유예";

  return (
    <>
      <MobileHeader title="모임 상세 정보" />

      {/* 뒤로가기 버튼 */}
      <section style={{ padding: '12px 16px 0 16px' }}>
        <button 
          type="button" 
          onClick={() => navigate("/admin/meetings")}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 0, background: 'none', color: '#64748b', fontSize: '13px', fontWeight: '800', padding: 0 }}
        >
          <ArrowLeft size={16} />
          <span>전체 모임 목록으로</span>
        </button>
      </section>

      {/* 모임 정보 오버뷰 카드 */}
      <section className="detail-card" style={{ margin: '16px', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.03)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <span style={{ fontSize: '12px', fontWeight: '800', color: 'var(--mobile-primary)', background: '#eef2ff', padding: '2px 8px', borderRadius: '6px' }}>
            #{meetingData.id}
          </span>
          <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: isClosed ? '#fee2e2' : '#d1fae5', color: isClosed ? '#991b1b' : '#065f46', padding: '2px 8px', borderRadius: '6px' }}>
            {isClosed ? "기간 마감 / 폐쇄됨" : "모집 진행 중"}
          </span>
        </div>

        <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b', margin: '12px 0 8px 0', lineHeight: 1.4 }}>
          {meetingData.title}
        </h1>

        <div style={{ display: 'grid', gap: '10px', marginTop: '16px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <User size={15} style={{ color: '#64748b' }} />
            <span>개설자: <strong>{meetingData.host}</strong></span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <Trophy size={15} style={{ color: '#64748b' }} />
            <span>종목: {meetingData.emoji} {meetingData.sport}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <Calendar size={15} style={{ color: '#64748b' }} />
            <span>개설일: {meetingData.createdDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <Users size={15} style={{ color: '#64748b' }} />
            <span>정원 현황: {meetingData.capacity}명</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#64748b', display: 'inline-flex', alignItems: 'center', height: '18px' }}>위치:</span>
            <span style={{ lineHeight: 1.3 }}>{meetingData.location}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '16px' }}>
          <button 
            type="button"
            onClick={handleEditInfo}
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
              gap: '6px'
            }}
          >
            <Edit size={16} /> 모임 정보 수정
          </button>
          
          {isClosed ? (
            <button 
              type="button"
              onClick={handleRestoreMeeting}
              style={{
                height: '42px',
                borderRadius: '12px',
                border: '1px solid #10b981',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                fontWeight: '800',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <RotateCcw size={16} /> 모임 복구
            </button>
          ) : (
            <button 
              type="button"
              onClick={handleCloseMeeting}
              style={{
                height: '42px',
                borderRadius: '12px',
                border: '1px solid #fee2e2',
                backgroundColor: '#fff5f5',
                color: '#ef4444',
                fontWeight: '800',
                fontSize: '14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px'
              }}
            >
              <Trash2 size={16} /> 모임 폐쇄
            </button>
          )}
        </div>
      </section>

      {/* 주요 지표 현황 */}
      <section style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#eef2ff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', color: '#4f46e5' }}>
            <Users size={16} />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>현재 참여자 수</span>
          <strong style={{ fontSize: '18px', color: '#1e293b', marginTop: '2px', display: 'block' }}>{meetingData.stats.totalAttendees} <small style={{ fontSize: '11px', fontWeight: 'normal' }}>명</small></strong>
        </article>

        <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#ecfdf5', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', color: '#059669' }}>
            <Percent size={16} />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>정원 충족률</span>
          <strong style={{ fontSize: '18px', color: '#1e293b', marginTop: '2px', display: 'block' }}>{meetingData.stats.fillRate}<small style={{ fontSize: '11px', fontWeight: 'normal' }}>%</small></strong>
        </article>
      </section>

      {/* 모임 소개 */}
      <section className="detail-card" style={{ margin: '16px', padding: '16px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 10px 0' }}>모임 소개 내용</h2>
        <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.5, margin: 0, whiteSpace: 'pre-wrap' }}>
          {meetingData.memo}
        </p>
      </section>

      {/* 참여 멤버 리스트 */}
      <section className="detail-card" style={{ margin: '16px', padding: '16px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 12px 0' }}>참여 멤버 목록 ({meetingData.members.length}명)</h2>
        {meetingData.members.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '12px 0' }}>참여 중인 멤버가 없습니다.</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {meetingData.members.map((member) => (
              <div 
                key={member.id} 
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 12px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '12px'
                }}
              >
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <strong style={{ fontSize: '13px', color: '#1e293b' }}>{member.nickname}</strong>
                    <span style={{ fontSize: '9px', fontWeight: '800', backgroundColor: member.role === "방장" ? '#fee2e2' : '#f1f5f9', color: member.role === "방장" ? '#ef4444' : '#475569', padding: '1px 5px', borderRadius: '4px' }}>
                      {member.role}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '3px' }}>가입일: {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "-"} | 매너: {member.manner || "4.5 / 5.0"}</span>
                </div>
                
                {member.role !== "방장" && (
                  <button 
                    type="button"
                    onClick={() => handleKickMember(member.id, member.nickname)}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px solid #fee2e2',
                      backgroundColor: '#fff',
                      color: '#ef4444',
                      fontSize: '11px',
                      fontWeight: '800'
                    }}
                  >
                    추방
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 신고 사항 */}
      {meetingData.reports && meetingData.reports.length > 0 && (
        <section className="detail-card" style={{ margin: '16px', padding: '16px', borderRadius: '16px', backgroundColor: '#fff5f5', border: '1px solid #fecaca' }}>
          <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#991b1b', margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={16} /> 신고 내역 ({meetingData.reports.length}건)
          </h2>
          <div style={{ display: 'grid', gap: '8px' }}>
            {meetingData.reports.map((rep) => (
              <div key={rep.id} style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px' }}>
                <span style={{ color: '#64748b', fontSize: '11px', display: 'block' }}>{rep.date || "최근"}</span>
                <p style={{ margin: '4px 0 0 0', color: '#334155' }}>{rep.reason}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Edit Meeting Info Modal */}
      {isEditModalOpen && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
          onClick={() => setIsEditModalOpen(false)}
        >
          <div 
            style={{
              backgroundColor: '#fff',
              borderRadius: '20px',
              width: '100%',
              maxWidth: '380px',
              padding: '20px',
              boxSizing: 'border-box'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>모임 정보 수정</h3>
            <form onSubmit={handleSaveEdit} style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>모임 제목</label>
                <input 
                  type="text"
                  required
                  value={editForm.title}
                  onChange={(e) => setEditForm(prev => ({ ...prev, title: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>모임 설명 (소개)</label>
                <textarea 
                  rows={3}
                  value={editForm.description}
                  onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                  style={{ border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>장소명 (기본)</label>
                <input 
                  type="text"
                  value={editForm.location_name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, location_name: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>상세 주소</label>
                <input 
                  type="text"
                  value={editForm.address}
                  onChange={(e) => setEditForm(prev => ({ ...prev, address: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>정원 제한</label>
                <input 
                  type="number"
                  required
                  min={2}
                  value={editForm.max_participants}
                  onChange={(e) => setEditForm(prev => ({ ...prev, max_participants: Number(e.target.value) }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>모임 목적 / 개설 의도</label>
                <input 
                  type="text"
                  value={editForm.purpose}
                  onChange={(e) => setEditForm(prev => ({ ...prev, purpose: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '8px' }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  style={{ height: '36px', borderRadius: '8px', border: '1px solid #cbd5e1', backgroundColor: '#fff', color: '#475569', fontSize: '13px', fontWeight: '800' }}
                >
                  취소
                </button>
                <button 
                  type="submit"
                  style={{ height: '36px', borderRadius: '8px', border: 0, backgroundColor: 'var(--mobile-primary)', color: '#fff', fontSize: '13px', fontWeight: '800' }}
                >
                  저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default MobileAdminMeetingDetailPage;
