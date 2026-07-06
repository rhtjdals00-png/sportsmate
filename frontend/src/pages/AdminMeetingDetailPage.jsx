import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
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
  XCircle,
  Clock,
  Star,
  RotateCcw
} from "lucide-react";
import { adminApi } from "../api/adminApi";

// Mock Database of meeting details mapped by meetingId
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
      { id: 101, nickname: "킥마스터", role: "방장", joinedAt: "2023.10.15", manner: "4.9 / 5.0" },
      { id: 102, nickname: "서지훈", role: "멤버", joinedAt: "2023.10.27", manner: "4.9 / 5.0" },
      { id: 103, nickname: "김민수", role: "멤버", joinedAt: "2023.10.24", manner: "4.8 / 5.0" },
      { id: 104, nickname: "축구초보", role: "멤버", joinedAt: "2023.10.26", manner: "4.1 / 5.0" }
    ],
    reports: [
      { id: 1, date: "2023.10.26", reason: "대관 예약 확정 지연에 대한 문의 신고 접수 (해결됨)" }
    ],
    memo: "반포 체육공원 매주 토요일 대관 진행 모임. 정원 관리가 안정적임."
  },
  "2": {
    title: "한강 밤 러닝 크루 모집",
    host: "야간러너",
    sport: "러닝",
    emoji: "🏃",
    createdDate: "2023.10.20",
    capacity: "8 / 10",
    location: "서울 마포구 망원한강공원 입구",
    stats: {
      totalAttendees: 8,
      attendeesTrend: "최근 1명 추가 가입",
      fillRate: 80,
      hostRating: "A",
      hostRatingNote: "코스 안내 만족도 높음"
    },
    members: [
      { id: 201, nickname: "야간러너", role: "방장", joinedAt: "2023.10.20", manner: "4.7 / 5.0" },
      { id: 202, nickname: "민경훈", role: "멤버", joinedAt: "2023.10.27", manner: "4.5 / 5.0" },
      { id: 203, nickname: "런스타", role: "멤버", joinedAt: "2023.10.25", manner: "4.3 / 5.0" }
    ],
    reports: [],
    memo: "코스가 평탄해 무릎 부담이 적음. 야간 시야 확보용 장비 권장."
  },
  "3": {
    title: "단식 테니스 매칭 (초보 환영)",
    host: "테니스킹",
    sport: "테니스",
    emoji: "🎾",
    createdDate: "2023.10.25",
    capacity: "2 / 2",
    location: "서울 송파구 올림픽공원 테니스장",
    stats: {
      totalAttendees: 2,
      attendeesTrend: "정원 충족 완료",
      fillRate: 100,
      hostRating: "B+",
      hostRatingNote: "친절하나 간혹 시간 변경 있음"
    },
    members: [
      { id: 301, nickname: "테니스킹", role: "방장", joinedAt: "2023.10.25", manner: "4.6 / 5.0" },
      { id: 302, nickname: "이지은", role: "멤버", joinedAt: "2023.10.26", manner: "4.7 / 5.0" }
    ],
    reports: [],
    memo: "하드 코트 대관. 게임 매너 준수 철저 요구."
  },
  "4": {
    title: "퇴근 후 실내 농구 게스트",
    host: "농구조아",
    sport: "농구",
    emoji: "🏀",
    createdDate: "2023.10.24",
    capacity: "10 / 10",
    location: "서울 영등포구 체육회관 2코트",
    stats: {
      totalAttendees: 10,
      attendeesTrend: "정원 충족 완료",
      fillRate: 100,
      hostRating: "B",
      hostRatingNote: "노쇼 인원 추방 이력 있음"
    },
    members: [
      { id: 401, nickname: "농구조아", role: "방장", joinedAt: "2023.10.24", manner: "4.4 / 5.0" },
      { id: 402, nickname: "슛돌이", role: "멤버", joinedAt: "2023.10.25", manner: "4.2 / 5.0" },
      { id: 403, nickname: "최현우", role: "멤버", joinedAt: "2023.10.26", manner: "3.2 / 5.0" }
    ],
    reports: [
      { id: 1, date: "2023.10.26", reason: "상대 비하적 발언을 하는 부적절한 회원이 포함되었다는 민원 2건 접수" }
    ],
    memo: "게스트 매칭을 주기적으로 진행함. 실내 농구화 지참 필수."
  }
};

function AdminMeetingDetailPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const [meetingData, setMeetingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    location_name: "",
    address: "",
    max_participants: 6,
    purpose: ""
  });

  useEffect(() => {
    async function fetchMeetingDetail() {
      try {
        setLoading(true);
        const res = await adminApi.meetingDetail(meetingId);
        if (res && res.meeting) {
          const m = res.meeting;
          const fillPercent = m.max_participants ? Math.round((m.current_participants / m.max_participants) * 100) : 0;
          const formatted = {
            title: m.title || "제목 없음",
            host: m.host ? (m.host.nickname || m.host.name || `방장 #${m.host.id}`) : "알 수 없음",
            sport: m.sport ? m.sport.name : "일반",
            emoji: m.sport ? (m.sport.name === "축구" ? "⚽" : m.sport.name === "러닝" ? "🏃" : m.sport.name === "테니스" ? "🎾" : m.sport.name === "농구" ? "🏀" : "👟") : "👟",
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
        setMeetingData(fallback);
      } finally {
        setLoading(false);
      }
    }
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
        alert(`${nickname} 회원이 모임에서 추방되었습니다.`);
      } catch (err) {
        console.error("Failed to kick member", err);
        alert("멤버 강제 퇴장에 실패했습니다.");
      }
    }
  };

  const handleDeleteMeeting = async () => {
    if (!meetingData) return;
    if (window.confirm(`'${meetingData.title}' 모임을 폐쇄 처리하시겠습니까?\n\n이 모임은 즉시 영구 삭제되지 않고 30일 동안 폐쇄 유예 상태(비활성화)로 보관되며, 이 기간 동안 모든 방 활동이 정지됩니다. 유예 기간 내에 언제든지 복구할 수 있습니다.`)) {
      try {
        await adminApi.deleteMeeting(meetingId);
        alert("모임이 성공적으로 폐쇄(비활성화) 처리되었습니다.");
        
        // Reload meeting details to show suspended UI
        const res = await adminApi.meetingDetail(meetingId);
        if (res && res.meeting) {
          const m = res.meeting;
          const fillPercent = m.max_participants ? Math.round((m.current_participants / m.max_participants) * 100) : 0;
          setMeetingData({
            title: m.title || "제목 없음",
            host: m.host ? (m.host.nickname || m.host.name || `방장 #${m.host.id}`) : "알 수 없음",
            sport: m.sport ? m.sport.name : "일반",
            emoji: m.sport ? (m.sport.name === "축구" ? "⚽" : m.sport.name === "러닝" ? "🏃" : m.sport.name === "테니스" ? "🎾" : m.sport.name === "농구" ? "🏀" : "👟") : "👟",
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
          });
        }
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
        await adminApi.restoreMeeting(meetingId);
        alert("모임이 성공적으로 복구되었습니다.");
        
        // Reload meeting details
        const res = await adminApi.meetingDetail(meetingId);
        if (res && res.meeting) {
          const m = res.meeting;
          const fillPercent = m.max_participants ? Math.round((m.current_participants / m.max_participants) * 100) : 0;
          setMeetingData({
            title: m.title || "제목 없음",
            host: m.host ? (m.host.nickname || m.host.name || `방장 #${m.host.id}`) : "알 수 없음",
            sport: m.sport ? m.sport.name : "일반",
            emoji: m.sport ? (m.sport.name === "축구" ? "⚽" : m.sport.name === "러닝" ? "🏃" : m.sport.name === "테니스" ? "🎾" : m.sport.name === "농구" ? "🏀" : "👟") : "👟",
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
          });
        }
      } catch (err) {
        console.error("Failed to restore meeting", err);
        alert("모임 복구에 실패했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
        <span style={{ fontSize: "16px", color: "#64748b", fontWeight: 600 }}>모임 상세 정보 불러오는 중...</span>
      </div>
    );
  }

  if (!meetingData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontWeight: 600 }}>모임 정보를 불러오지 못했습니다.</p>
        <Link to="/admin/meetings" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          모임 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-meeting-detail">
      {/* Back button */}
      <div style={{ marginBottom: "20px" }}>
        <Link to="/admin/meetings" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "#64748b", fontWeight: 600, fontSize: "14px" }}>
          <ArrowLeft size={16} />
          <span>전체 모임 목록으로 돌아가기</span>
        </Link>
      </div>

      {/* 1. Meeting Overview Header Card */}
      <section className="admin-detail-header-card">
        <div className="admin-detail-header-card__avatar-container" style={{ display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#f8fafc", border: "2px solid #e2e8f0", borderRadius: "16px", fontSize: "36px" }}>
          {meetingData.emoji}
        </div>
        
        <div className="admin-detail-header-card__info">
          <div className="admin-detail-header-card__title-row">
            <span className="admin-detail-header-card__name">{meetingData.title}</span>
            <span className="admin-badge admin-badge--blue">{meetingData.sport}</span>
            {meetingData.status === "suspended" ? (
              <>
                <span className="admin-badge" style={{ backgroundColor: "#ef4444", color: "#ffffff", border: "none" }}>
                  폐쇄 유예
                </span>
                <span className="admin-badge" style={{ color: "#ef4444", borderColor: "#fca5a5" }}>
                  남은 유예기간: {meetingData.remaining_days}일
                </span>
              </>
            ) : (
              <span className={`admin-badge admin-badge--${meetingData.capacity.split(" / ")[0] === meetingData.capacity.split(" / ")[1] ? "gray" : "orange"}`}>
                {meetingData.capacity.split(" / ")[0] === meetingData.capacity.split(" / ")[1] ? "마감" : "모집중"}
              </span>
            )}
          </div>
          
          <div className="admin-detail-header-card__meta-grid">
            <div className="admin-detail-header-card__meta-item">
              <User size={16} />
              <span>개설 방장: {meetingData.host}</span>
            </div>
            <div className="admin-detail-header-card__meta-item">
              <Calendar size={16} />
              <span>개설일: {meetingData.createdDate}</span>
            </div>
            <div className="admin-detail-header-card__meta-item">
              <Users size={16} />
              <span>모집 정원: {meetingData.capacity} 명</span>
            </div>
            <div className="admin-detail-header-card__meta-item">
              <Clock size={16} />
              <span>진행 위치: {meetingData.location}</span>
            </div>
          </div>
        </div>

        <div className="admin-detail-header-card__actions">
          {meetingData.status !== "suspended" ? (
            <>
              <button 
                type="button" 
                onClick={handleEditInfo}
                className="admin-detail-action-btn admin-detail-action-btn--primary"
              >
                <Trophy size={15} />
                <span>모임 정보 수정</span>
              </button>
              <button 
                type="button" 
                onClick={handleDeleteMeeting}
                className="admin-detail-action-btn admin-detail-action-btn--outline"
                style={{ color: "#ef4444", borderColor: "#fca5a5" }}
              >
                <Trash2 size={15} />
                <span>모임 폐쇄</span>
              </button>
            </>
          ) : (
            <button 
              type="button" 
              onClick={handleRestoreMeeting}
              className="admin-detail-action-btn admin-detail-action-btn--primary"
              style={{ backgroundColor: "#10b981", borderColor: "#10b981", color: "#ffffff" }}
            >
              <RotateCcw size={15} />
              <span>모임 복구</span>
            </button>
          )}
        </div>
      </section>

      {/* 2. Metric Cards */}
      <section className="admin-stats-grid" style={{ marginBottom: "24px" }}>
        {/* Metric 1 */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">현재 참여 인원</span>
            <div className="admin-stat-card__value">
              {meetingData.stats.totalAttendees}
              <span className="admin-stat-card__unit">명</span>
            </div>
            <span className="admin-stat-card__trend admin-stat-card__trend--up">
              {meetingData.stats.attendeesTrend}
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--blue">
            <Users size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">정원 충족률</span>
            <div className="admin-stat-card__value">
              {meetingData.stats.fillRate}
              <span className="admin-stat-card__unit">%</span>
            </div>
            <span className="admin-stat-card__trend" style={{ color: "#2563eb" }}>
              인원 모집 활성도 양호
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--orange">
            <Percent size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">방장 신뢰 등급</span>
            <div className="admin-stat-card__value">
              {meetingData.stats.hostRating}
            </div>
            <span className="admin-stat-card__trend" style={{ color: "#10b981" }}>
              {meetingData.stats.hostRatingNote}
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--green">
            <ShieldCheck size={20} />
          </div>
        </div>
      </section>

      {/* 3. Bottom Grid: Member directory & warnings */}
      <div className="admin-grid-cols">
        {/* Left Column: Member List Table */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">모임 참여 멤버 목록 ({meetingData.members.length}명)</h2>
          </div>
          <div className="admin-panel-card__body">
            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>닉네임</th>
                    <th>가입 시간</th>
                    <th>매너 점수</th>
                    <th>구분</th>
                    <th style={{ textAlign: "center" }}>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {meetingData.members.map((member) => (
                    <tr key={member.id}>
                      <td style={{ fontWeight: 600 }}>{member.nickname}</td>
                      <td style={{ color: "#64748b" }}>{member.joinedAt}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <Star size={12} fill="#f59e0b" stroke="none" />
                          <span style={{ fontWeight: 600 }}>{member.manner}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`admin-badge admin-badge--${member.role === "방장" ? "red" : "gray"}`}>
                          {member.role}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {member.role !== "방장" ? (
                          <button
                            type="button"
                            onClick={() => handleKickMember(member.id, member.nickname)}
                            className="admin-table-action-btn admin-table-action-btn--outline"
                            style={{ color: "#ef4444", borderColor: "#fca5a5", padding: "4px 10px" }}
                          >
                            <XCircle size={12} style={{ marginRight: "4px" }} /> 강제 퇴장
                          </button>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px", fontStyle: "italic" }}>위임 필수</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Right Column: Alerts and admin state notes */}
        <section className="admin-restrict-card">
          <h3 className="admin-restrict-card__title">신고 내역 및 모임 상태</h3>

          <div className={`admin-restrict-box${meetingData.reports.length > 0 ? " admin-restrict-box--danger" : ""}`}>
            <div className="admin-restrict-box__header">
              <span>모임 관련 신고 건수</span>
              <span className="admin-restrict-box__count">
                {meetingData.reports.length}건
              </span>
            </div>
            <div className="admin-restrict-box__content">
              {meetingData.reports.length > 0 ? (
                meetingData.reports.map(r => (
                  <div key={r.id}>
                    <strong>{r.date}</strong> - {r.reason}
                  </div>
                ))
              ) : (
                <span style={{ color: "#64748b" }}>접수된 신고가 없습니다.</span>
              )}
            </div>
          </div>

          <div className="admin-memo-box">
            <div className="admin-memo-box__header">
              <span>모임 상태 메모</span>
            </div>
            <p className="admin-memo-box__content">
              {meetingData.memo || "작성된 메모가 없습니다."}
            </p>
          </div>
        </section>
      </div>

      {isEditModalOpen && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
          backdropFilter: "blur(4px)"
        }}>
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "28px",
            width: "500px",
            maxWidth: "95%",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
            boxSizing: "border-box"
          }}>
            <h3 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 700, color: "#1e293b" }}>모임 정보 수정</h3>
            <form onSubmit={handleSaveEdit}>
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>모임명</label>
                <input 
                  type="text" 
                  value={editForm.title} 
                  onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>모임 목적 (한줄 요약)</label>
                <input 
                  type="text" 
                  value={editForm.purpose} 
                  onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>모임 소개</label>
                <textarea 
                  value={editForm.description} 
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  required
                  rows="4"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    resize: "vertical",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>장소명</label>
                  <input 
                    type="text" 
                    value={editForm.location_name} 
                    onChange={(e) => setEditForm({ ...editForm, location_name: e.target.value })}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>최대 정원</label>
                  <input 
                    type="number" 
                    min="2"
                    max="100"
                    value={editForm.max_participants} 
                    onChange={(e) => setEditForm({ ...editForm, max_participants: parseInt(e.target.value) || 2 })}
                    required
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: "24px" }}>
                <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>상세 주소</label>
                <input 
                  type="text" 
                  value={editForm.address} 
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  required
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button 
                  type="button" 
                  onClick={() => setIsEditModalOpen(false)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  취소
                </button>
                <button 
                  type="submit"
                  style={{
                    padding: "8px 16px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#3b82f6",
                    color: "#ffffff",
                    fontWeight: 600,
                    fontSize: "14px",
                    cursor: "pointer"
                  }}
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminMeetingDetailPage;
