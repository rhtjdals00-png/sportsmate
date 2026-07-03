import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { adminApi } from "../api/adminApi";
import { useAuth } from "../contexts/AuthContext.jsx";
import { 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Edit, 
  Send,
  Users,
  CheckSquare,
  Star,
  ShieldAlert,
  Edit3,
  Ban,
  ArrowLeft
} from "lucide-react";

// Mock Database of user details mapped by userId
const userDetailDb = {
  // 김민수 (Default / 1)
  "1": {
    name: "김민수",
    sportTag: "⚽ 축구 매니아",
    status: "정상 회원",
    email: "minsu.kim@example.com",
    phone: "010-1234-5678",
    joinedDate: "2023.05.12",
    location: "서울 강남구",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&fit=crop&q=80",
    stats: {
      meetingsCount: 24,
      meetingsTrend: "+3",
      attendanceRate: 98,
      attendanceNote: "상위 5% 우수 회원",
      mannerScore: 4.8,
      reviewsCount: 15
    },
    activities: [
      { id: 1, title: "강남역 저녁 풋살 한게임", category: "풋살", time: "2023.10.24 19:00", status: "참여완료" },
      { id: 2, title: "주말 아침 한강 러닝크루", category: "러닝", time: "2023.10.21 07:00", status: "참여완료" },
      { id: 3, title: "반포 농구 코트 3:3 픽업게임", category: "농구", time: "2023.10.15 18:00", status: "참여완료" },
      { id: 4, title: "초보 환영 테니스 랠리", category: "테니스", time: "2023.10.10 10:00", status: "결석" }
    ],
    reports: [
      { id: 1, date: "2023.09.12", reason: "지각 및 비매너 행위로 인한 경고 1회 누적 (풋살 모임)" }
    ],
    memo: "우수 회원 승급 대상자. 매너 점수 지속적 모니터링 요망."
  },
  // 서지훈 (2)
  "2": {
    name: "서지훈",
    sportTag: "⚽ 축구 전문가",
    status: "정상 회원",
    email: "seojh@gmail.com",
    phone: "010-9876-5432",
    joinedDate: "2023.10.27",
    location: "서울 마포구",
    avatar: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=150&fit=crop&q=80",
    stats: {
      meetingsCount: 12,
      meetingsTrend: "+1",
      attendanceRate: 100,
      attendanceNote: "100% 무결점 회원",
      mannerScore: 4.9,
      reviewsCount: 8
    },
    activities: [
      { id: 1, title: "합정역 실내 풋살장 평일 매치", category: "풋살", time: "2023.10.27 20:00", status: "참여완료" },
      { id: 2, title: "상암 월드컵 보조경기장 11:11", category: "축구", time: "2023.10.25 18:00", status: "참여완료" }
    ],
    reports: [],
    memo: "열정적이고 친근한 태도로 모든 모임에서 높은 평판을 얻고 있음."
  },
  // 민경훈 (3)
  "3": {
    name: "민경훈",
    sportTag: "🏃 러닝 고수",
    status: "정상 회원",
    email: "minkh@naver.com",
    phone: "010-5555-4444",
    joinedDate: "2023.10.27",
    location: "서울 성동구",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&fit=crop&q=80",
    stats: {
      meetingsCount: 18,
      meetingsTrend: "+4",
      attendanceRate: 92,
      attendanceNote: "성실한 활동 회원",
      mannerScore: 4.5,
      reviewsCount: 12
    },
    activities: [
      { id: 1, title: "뚝섬유원지 야간 페이스 러닝", category: "러닝", time: "2023.10.26 21:00", status: "참여완료" },
      { id: 2, title: "서울숲 모닝 5km 조깅", category: "러닝", time: "2023.10.24 07:00", status: "참여완료" }
    ],
    reports: [],
    memo: "러닝 크루 리더로 적극 활동 중."
  },
  // 이지은 (4)
  "4": {
    name: "이지은",
    sportTag: "🎾 테니스 요정",
    status: "정상 회원",
    email: "jieun@daum.net",
    phone: "010-8888-9999",
    joinedDate: "2023.10.26",
    location: "서울 송파구",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&fit=crop&q=80",
    stats: {
      meetingsCount: 6,
      meetingsTrend: "+2",
      attendanceRate: 85,
      attendanceNote: "테니스 비기너",
      mannerScore: 4.7,
      reviewsCount: 5
    },
    activities: [
      { id: 1, title: "올림픽공원 테니스 랠리 모임", category: "테니스", time: "2023.10.26 14:00", status: "참여완료" },
      { id: 2, title: "잠실 테니스 초보 강습/게임", category: "테니스", time: "2023.10.23 19:00", status: "참여완료" }
    ],
    reports: [],
    memo: "매너가 훌륭하나 초보라 랠리 지속 시간이 짧음. 동기부여 필요."
  },
  // 최현우 (5)
  "5": {
    name: "최현우",
    sportTag: "🏀 농구 슈터",
    status: "정지",
    email: "hyunwoo@gmail.com",
    phone: "010-7777-3333",
    joinedDate: "2023.10.26",
    location: "서울 영등포구",
    avatar: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&fit=crop&q=80",
    stats: {
      meetingsCount: 15,
      meetingsTrend: "-2",
      attendanceRate: 65,
      attendanceNote: "상습 지각 및 무단 불참",
      mannerScore: 3.2,
      reviewsCount: 22
    },
    activities: [
      { id: 1, title: "여의도공원 농구코트 3:3 야간", category: "농구", time: "2023.10.25 18:00", status: "참여완료" },
      { id: 2, title: "당산 실내 체육관 대관 풀코트", category: "농구", time: "2023.10.20 15:00", status: "결석" }
    ],
    reports: [
      { id: 1, date: "2023.10.20", reason: "농구 모임 무단 불참 및 비매너 행위로 인한 신고 누적" }
    ],
    memo: "상습 노쇼 발생. 모임원들과의 마찰 신고 다수 접수됨."
  }
};

function AdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { user: currentUser } = useAuth();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    nickname: "",
    email: "",
    phone: "",
    location: "",
    preferred_sports: "",
    role: "user"
  });

  useEffect(() => {
    async function fetchUserDetail() {
      try {
        setLoading(true);
        const res = await adminApi.userDetail(userId);
        if (res && res.user) {
          const user = res.user;
          const formatted = {
            id: user.id,
            name: user.name || "이름 없음",
            nickname: user.nickname || "닉네임 없음",
            sportTag: user.profile && user.profile.preferred_sports ? `🏃 ${user.profile.preferred_sports}` : "운동 메이트",
            preferred_sports: user.profile && user.profile.preferred_sports ? user.profile.preferred_sports : "",
            status: user.is_active === false ? "정지" : "정상 회원",
            email: user.email || "이메일 없음",
            phone: user.phone_number || "전화번호 없음",
            joinedDate: user.created_at ? new Date(user.created_at).toLocaleDateString().replace(/\s/g, "").replace(/\.$/, "") : "2023.10.27",
            location: user.profile && user.profile.region ? user.profile.region : "지역 미설정",
            avatar: user.profile_image_url || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&fit=crop&q=80",
            role: user.role || "user",
            stats: {
              meetingsCount: user.stats ? user.stats.meetingsCount : 0,
              meetingsTrend: "",
              attendanceRate: user.stats ? user.stats.attendanceRate : 0,
              attendanceNote: user.stats && user.stats.attendanceRate >= 90 ? "상위 우수 회원" : "보통 회원",
              mannerScore: user.stats ? user.stats.mannerScore : 0.0,
              reviewsCount: user.stats ? user.stats.reviewsCount : 0
            },
            activities: user.activities || [],
            reports: user.reports || [],
            memo: user.is_active === false ? "정지된 계정입니다." : "정상적으로 서비스 이용 중인 회원입니다."
          };
          setUserData(formatted);
        }
      } catch (err) {
        console.error("API error while loading user detail", err);
        // Fallback to mock database
        const fallback = userDetailDb[userId] || userDetailDb["1"];
        setUserData({ ...fallback, id: Number(userId) });
      } finally {
        setLoading(false);
      }
    }
    fetchUserDetail();
  }, [userId]);

  const handleEditInfo = () => {
    if (!userData) return;
    setEditForm({
      name: userData.name,
      nickname: userData.nickname,
      email: userData.email,
      phone: userData.phone === "전화번호 없음" ? "" : userData.phone,
      location: userData.location === "지역 미설정" ? "" : userData.location,
      preferred_sports: userData.preferred_sports || "",
      role: userData.role || "user"
    });
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const res = await adminApi.updateUser(userId, {
        name: editForm.name,
        nickname: editForm.nickname,
        email: editForm.email,
        phone_number: editForm.phone,
        region: editForm.location,
        preferred_sports: editForm.preferred_sports,
        role: editForm.role
      });
      if (res && res.user) {
        const u = res.user;
        setUserData(prev => ({
          ...prev,
          name: u.name || "이름 없음",
          nickname: u.nickname || "닉네임 없음",
          sportTag: u.profile && u.profile.preferred_sports ? `🏃 ${u.profile.preferred_sports}` : "운동 메이트",
          preferred_sports: u.profile && u.profile.preferred_sports ? u.profile.preferred_sports : "",
          email: u.email || "이메일 없음",
          phone: u.phone_number || "전화번호 없음",
          location: u.profile && u.profile.region ? u.profile.region : "지역 미설정",
          role: u.role || "user"
        }));
        setIsEditModalOpen(false);
        alert("회원 정보가 성공적으로 수정되었습니다.");
      }
    } catch (err) {
      console.error("Failed to update user info", err);
      alert("회원 정보 수정에 실패했습니다.");
    }
  };

  const handleSendMessage = () => {
    if (!userData) return;
    const text = prompt(`${userData.name} 회원에게 전송할 메시지를 입력해 주세요:`);
    if (text) {
      alert(`[메시지 전송 성공]
수신: ${userData.email}
내용: "${text}"`);
    }
  };

  const toggleStatus = async () => {
    if (!userData) return;
    const nextStatus = userData.status === "정상 회원" ? "정지" : "정상 회원";
    if (window.confirm(`${userData.name} 회원의 상태를 '${nextStatus}'(으)로 변경하시겠습니까?`)) {
      try {
        const nextIsActive = nextStatus === "정상 회원";
        const res = await adminApi.updateUser(userId, {
          is_active: nextIsActive
        });
        if (res && res.user) {
          const u = res.user;
          setUserData(prev => ({
            ...prev,
            status: u.is_active === false ? "정지" : "정상 회원",
            memo: u.is_active === false ? "정지된 계정입니다." : "정상적으로 서비스 이용 중인 회원입니다."
          }));
          alert(`계정이 성공적으로 ${nextStatus} 처리되었습니다.`);
        }
      } catch (err) {
        console.error("Failed to update user status", err);
        alert(err.response?.data?.message || "계정 상태 변경에 실패했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "300px" }}>
        <span style={{ fontSize: "16px", color: "#64748b", fontWeight: 600 }}>회원 상세 정보 불러오는 중...</span>
      </div>
    );
  }

  if (!userData) {
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <p style={{ color: "#ef4444", fontWeight: 600 }}>회원 정보를 불러오지 못했습니다.</p>
        <Link to="/admin/users" style={{ color: "#2563eb", textDecoration: "none", fontWeight: 600 }}>
          회원 목록으로 돌아가기
        </Link>
      </div>
    );
  }

  return (
    <div className="admin-user-detail">
      {/* Back button */}
      <div style={{ marginBottom: "20px" }}>
        <Link to="/admin/users" style={{ display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none", color: "#64748b", fontWeight: 600, fontSize: "14px" }}>
          <ArrowLeft size={16} />
          <span>전체 회원 목록으로 돌아가기</span>
        </Link>
      </div>

      {/* 1. Profile Header Card */}
      <section className="admin-detail-header-card">
        <div className="admin-detail-header-card__avatar-container">
          <img 
            src={userData.avatar} 
            alt={userData.name} 
            className="admin-detail-header-card__avatar"
          />
          {userData.status === "정상 회원" && (
            <div className="admin-detail-header-card__badge-ok" title="정상 회원">✓</div>
          )}
        </div>
        
        <div className="admin-detail-header-card__info">
          <div className="admin-detail-header-card__title-row">
            <span className="admin-detail-header-card__name">{userData.name}</span>
            <span className="admin-badge admin-badge--gray">{userData.sportTag}</span>
            <span className={`admin-badge admin-badge--${userData.status === "정상 회원" ? "green" : "red"}`}>
              {userData.status}
            </span>
          </div>
          
          <div className="admin-detail-header-card__meta-grid">
            <div className="admin-detail-header-card__meta-item">
              <Mail size={16} />
              <span>{userData.email}</span>
            </div>
            <div className="admin-detail-header-card__meta-item">
              <Phone size={16} />
              <span>{userData.phone}</span>
            </div>
            <div className="admin-detail-header-card__meta-item">
              <Calendar size={16} />
              <span>가입일: {userData.joinedDate}</span>
            </div>
            <div className="admin-detail-header-card__meta-item">
              <MapPin size={16} />
              <span>주 활동 지역: {userData.location}</span>
            </div>
          </div>
        </div>

        <div className="admin-detail-header-card__actions">
          <button 
            type="button" 
            onClick={handleEditInfo}
            className="admin-detail-action-btn admin-detail-action-btn--primary"
          >
            <Edit size={15} />
            <span>정보 수정</span>
          </button>
          <button 
            type="button" 
            onClick={handleSendMessage}
            className="admin-detail-action-btn admin-detail-action-btn--outline"
          >
            <Mail size={15} />
            <span>메시지 전송</span>
          </button>
        </div>
      </section>

      {/* 2. Three Metric Widget cards */}
      <section className="admin-stats-grid" style={{ marginBottom: "24px" }}>
        {/* Metric 1 */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">참여 모임 수</span>
            <div className="admin-stat-card__value">
              {userData.stats.meetingsCount}
              <span className="admin-stat-card__unit">회</span>
            </div>
            <span className="admin-stat-card__trend admin-stat-card__trend--up">
              전일 대비 {userData.stats.meetingsTrend}
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--blue">
            <Users size={20} />
          </div>
        </div>

        {/* Metric 2 */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">출석률</span>
            <div className="admin-stat-card__value">
              {userData.stats.attendanceRate}
              <span className="admin-stat-card__unit">%</span>
            </div>
            <span className="admin-stat-card__trend" style={{ color: "#64748b" }}>
              {userData.stats.attendanceNote}
            </span>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--orange">
            <CheckSquare size={20} />
          </div>
        </div>

        {/* Metric 3 */}
        <div className="admin-stat-card">
          <div className="admin-stat-card__main">
            <span className="admin-stat-card__title">매너 점수</span>
            <div className="admin-stat-card__value">
              {userData.stats.mannerScore}
              <span className="admin-stat-card__unit">/ 5.0</span>
            </div>
            <div className="admin-stat-card__trend" style={{ color: "#f59e0b", display: "flex", gap: "2px" }}>
              <Star size={12} fill="#f59e0b" stroke="none" />
              <Star size={12} fill="#f59e0b" stroke="none" />
              <Star size={12} fill="#f59e0b" stroke="none" />
              <Star size={12} fill="#f59e0b" stroke="none" />
              <Star size={12} fill={userData.stats.mannerScore >= 4.8 ? "#f59e0b" : "none"} stroke="#f59e0b" />
              <span style={{ color: "#64748b", marginLeft: "4px" }}>리뷰 {userData.stats.reviewsCount}건</span>
            </div>
          </div>
          <div className="admin-stat-card__icon-box admin-stat-card__icon-box--green">
            <Star size={20} />
          </div>
        </div>
      </section>

      {/* 3. Bottom Grid: Activities & Restrictions */}
      <div className="admin-grid-cols">
        {/* Left Column: Recent Activities list */}
        <section className="admin-panel-card" style={{ marginBottom: 0 }}>
          <div className="admin-panel-card__header">
            <h2 className="admin-panel-card__title">최근 활동 내역</h2>
            <a href="#all" className="admin-panel-card__link" onClick={(e) => { e.preventDefault(); alert("전체 활동 조회를 준비 중입니다."); }}>
              전체 보기 &gt;
            </a>
          </div>
          <div className="admin-panel-card__body">
            <div className="admin-table-wrapper">
              <table className="admin-data-table">
                <thead>
                  <tr>
                    <th>모임명</th>
                    <th>카테고리</th>
                    <th>날짜</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {userData.activities.map((act) => (
                    <tr key={act.id}>
                      <td style={{ fontWeight: 600 }}>{act.title}</td>
                      <td>{act.category}</td>
                      <td style={{ color: "#64748b" }}>{act.time}</td>
                      <td>
                        <span className={`admin-badge admin-badge--${act.status === "참여완료" ? "green" : "red"}`}>
                          {act.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {userData.activities.length === 0 && (
                    <tr>
                      <td colSpan="4" style={{ textAlign: "center", color: "#94a3b8", padding: "30px" }}>
                        최근 참여한 모임 활동 내역이 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Right Column: Sanctions & Admin Status Memo */}
        <section className="admin-restrict-card">
          <h3 className="admin-restrict-card__title">제재 내역 및 관리</h3>
          
          {/* Report Alert box */}
          <div className={`admin-restrict-box${userData.reports.length > 0 ? " admin-restrict-box--danger" : ""}`}>
            <div className="admin-restrict-box__header">
              <span>신고 받은 내역</span>
              <span className="admin-restrict-box__count">
                {userData.reports.length}건
              </span>
            </div>
            <div className="admin-restrict-box__content">
              {userData.reports.length > 0 ? (
                userData.reports.map(r => (
                  <div key={r.id}>
                    <strong>{r.date}</strong> - {r.reason}
                  </div>
                ))
              ) : (
                <span style={{ color: "#64748b" }}>누적된 신고 이력이 없습니다.</span>
              )}
            </div>
          </div>

          {/* Memo Box */}
          <div className="admin-memo-box">
            <div className="admin-memo-box__header">
              <span>계정 상태 메모</span>
              <Edit3 size={13} className="admin-memo-box__edit" onClick={() => {
                const text = prompt("계정 메모를 수정합니다:", userData.memo);
                if (text !== null) {
                  setUserData(prev => ({ ...prev, memo: text }));
                }
              }} />
            </div>
            <p className="admin-memo-box__content">
              {userData.memo || "작성된 메모가 없습니다."}
            </p>
          </div>

          {/* Ban/Release account button */}
          <button 
            type="button" 
            onClick={toggleStatus}
            className="admin-restrict-card__btn"
          >
            <Ban size={15} />
            <span>{userData.status === "정상 회원" ? "계정 정지 처리" : "계정 정지 해제"}</span>
          </button>
        </section>
      </div>

      {isEditModalOpen && (() => {
        const isRoleDisabled = (currentUser?.role === "admin" && (userData?.role === "superadmin" || userData?.role === "admin")) ||
                               (currentUser?.role === "superadmin" && currentUser?.id === userData?.id);
        const showAllOptions = currentUser?.role === "superadmin";

        return (
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
              <h3 style={{ margin: "0 0 20px 0", fontSize: "20px", fontWeight: 700, color: "#1e293b" }}>회원 정보 수정</h3>
              <form onSubmit={handleSaveEdit}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div>
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>이름</label>
                    <input 
                      type="text" 
                      value={editForm.name} 
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
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
                    <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>닉네임</label>
                    <input 
                      type="text" 
                      value={editForm.nickname} 
                      onChange={(e) => setEditForm({ ...editForm, nickname: e.target.value })}
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

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>이메일</label>
                  <input 
                    type="email" 
                    value={editForm.email} 
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
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
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>전화번호</label>
                  <input 
                    type="text" 
                    value={editForm.phone} 
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    placeholder="예: 010-1234-5678"
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
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>주 활동 지역</label>
                  <input 
                    type="text" 
                    value={editForm.location} 
                    onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                    placeholder="예: 서울특별시 용산구"
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
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>선호 운동 종목</label>
                  <input 
                    type="text" 
                    value={editForm.preferred_sports} 
                    onChange={(e) => setEditForm({ ...editForm, preferred_sports: e.target.value })}
                    placeholder="예: 축구, 러닝, 농구"
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

                <div style={{ marginBottom: "24px" }}>
                  <label style={{ display: "block", marginBottom: "6px", fontSize: "14px", fontWeight: 600, color: "#475569" }}>구분 (회원 등급)</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                    disabled={isRoleDisabled}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      backgroundColor: isRoleDisabled ? "#f1f5f9" : "#ffffff",
                      cursor: isRoleDisabled ? "not-allowed" : "default",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  >
                    {showAllOptions ? (
                      <>
                        <option value="superadmin" disabled={userData?.role !== "admin" && userData?.role !== "superadmin"}>
                          최고관리자 (superadmin){userData?.role !== "admin" && userData?.role !== "superadmin" ? " (관리자만 이양 가능)" : ""}
                        </option>
                        <option value="admin">관리자 (admin)</option>
                        <option value="user">일반회원 (user)</option>
                        <option value="suspended">정지회원 (suspended)</option>
                        <option value="pending_withdrawal">탈퇴대기회원 (pending_withdrawal)</option>
                      </>
                    ) : (
                      <>
                        <option value="user">일반회원 (user)</option>
                        <option value="suspended">정지회원 (suspended)</option>
                        <option value="pending_withdrawal">탈퇴대기회원 (pending_withdrawal)</option>
                        {(userData?.role === "admin" || userData?.role === "superadmin") && (
                          <option value={userData.role} disabled>
                            {userData.role === "superadmin" ? "최고관리자 (변경 불가)" : "관리자 (변경 불가)"}
                          </option>
                        )}
                      </>
                    )}
                  </select>
                  {isRoleDisabled && (
                    <span style={{ fontSize: "12px", color: "#ef4444", marginTop: "4px", display: "block" }}>
                      {currentUser?.id === userData?.id 
                        ? "최고관리자는 자기 자신을 다른 등급으로 변경할 수 없습니다."
                        : "일반 관리자는 최고관리자 및 관리자 등급을 변경할 수 없습니다."}
                    </span>
                  )}
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
        );
      })()}
    </div>
  );
}

export default AdminUserDetailPage;
