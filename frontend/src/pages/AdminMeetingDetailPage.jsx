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
  Clock
} from "lucide-react";

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

  const initialData = meetingDetailDb[meetingId] || meetingDetailDb["1"];
  const [meetingData, setMeetingData] = useState(initialData);

  useEffect(() => {
    setMeetingData(meetingDetailDb[meetingId] || meetingDetailDb["1"]);
  }, [meetingId]);

  const handleEditInfo = () => {
    alert(`'${meetingData.title}' 모임 정보 수정 화면(기획 진행 중)으로 이동합니다.`);
  };

  const handleKickMember = (memberId, nickname) => {
    if (window.confirm(`정말 '${nickname}' 멤버를 이 모임에서 강제 추방하시겠습니까?`)) {
      setMeetingData(prev => ({
        ...prev,
        members: prev.members.filter(m => m.id !== memberId)
      }));
      alert(`${nickname} 회원이 모임에서 추방되었습니다.`);
    }
  };

  const handleDeleteMeeting = () => {
    if (window.confirm(`'${meetingData.title}' 모임을 영구히 강제 삭제/폐쇄 처리하시겠습니까? 이 동작은 모임 게시판에도 즉시 반영됩니다.`)) {
      alert("모임이 성공적으로 폐쇄 처리되었습니다.");
      navigate("/admin/meetings");
    }
  };

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
            <span className={`admin-badge admin-badge--${meetingData.capacity.split(" / ")[0] === meetingData.capacity.split(" / ")[1] ? "gray" : "orange"}`}>
              {meetingData.capacity.split(" / ")[0] === meetingData.capacity.split(" / ")[1] ? "마감" : "모집중"}
            </span>
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

          <button 
            type="button" 
            onClick={handleDeleteMeeting}
            className="admin-restrict-card__btn"
          >
            <Trash2 size={15} />
            <span>모임 강제 폭파</span>
          </button>
        </section>
      </div>
    </div>
  );
}

export default AdminMeetingDetailPage;
