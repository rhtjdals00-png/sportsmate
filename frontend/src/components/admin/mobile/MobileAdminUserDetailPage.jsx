import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { adminApi } from "../../../api/adminApi";
import { 
  Mail, 
  Phone, 
  Calendar, 
  MapPin, 
  Edit, 
  Users, 
  CheckSquare, 
  Star, 
  ShieldAlert, 
  Ban, 
  ArrowLeft, 
  Bell,
  Activity,
  Trophy
} from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

const userDetailDb = {
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
      attendanceRate: 98,
      attendanceNote: "상위 5% 우수 회원",
      mannerScore: 4.8,
      reviewsCount: 15
    },
    activities: [
      { id: 1, title: "강남역 저녁 풋살 한게임", category: "풋살", time: "2023.10.24 19:00", status: "참여완료" }
    ],
    reports: [
      { id: 1, date: "2023.09.12", reason: "지각 및 비매너 행위로 인한 경고 1회 누적" }
    ],
    memo: "정상적으로 서비스 이용 중인 회원입니다."
  }
};

function MobileAdminUserDetailPage() {
  const { userId } = useParams();
  const navigate = useNavigate();
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Edit Modal States
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

  const fetchUserDetail = async () => {
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
      const fallback = userDetailDb[userId] || userDetailDb["1"];
      setUserData({ ...fallback, id: Number(userId) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
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

  const handleSendMessage = async () => {
    if (!userData) return;
    const text = prompt(`${userData.name} 회원에게 전송할 알림 내용을 입력해 주세요:`);
    if (text) {
      try {
        await adminApi.sendMessage(userId, text);
        alert("알림이 성공적으로 전송되었습니다.");
      } catch (err) {
        console.error("Failed to send notification", err);
        alert("알림 전송에 실패했습니다.");
      }
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
          alert(`상태가 '${nextStatus}'(으)로 성공적으로 변경되었습니다.`);
        }
      } catch (err) {
        console.error("Failed to toggle status", err);
        alert("상태 변경에 실패했습니다.");
      }
    }
  };

  if (loading) {
    return (
      <>
        <MobileHeader title="회원 상세 관리" />
        <div style={{ display: 'flex', justifyContent: 'center', padding: '100px 0', color: '#64748b' }}>
          <span>회원 상세 정보를 불러오는 중...</span>
        </div>
      </>
    );
  }

  if (!userData) {
    return (
      <>
        <MobileHeader title="회원 상세 관리" />
        <div style={{ padding: '24px', textAlign: 'center' }}>
          <p style={{ color: '#ef4444', fontWeight: '800' }}>회원 정보를 불러오지 못했습니다.</p>
          <button 
            type="button" 
            onClick={() => navigate("/admin/users")}
            style={{ border: 0, background: 'none', color: 'var(--mobile-primary)', fontWeight: '800', marginTop: '12px' }}
          >
            회원 목록으로 돌아가기
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <MobileHeader title="회원 상세 정보" />

      {/* 뒤로가기 버튼 */}
      <section style={{ padding: '12px 16px 0 16px' }}>
        <button 
          type="button" 
          onClick={() => navigate("/admin/users")}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', border: 0, background: 'none', color: '#64748b', fontSize: '13px', fontWeight: '800', padding: 0 }}
        >
          <ArrowLeft size={16} />
          <span>전체 회원 목록으로</span>
        </button>
      </section>

      {/* 프로필 카드 섹션 (디자인 개선) */}
      <section className="detail-card" style={{ margin: '16px', padding: '20px', borderRadius: '20px', boxShadow: '0 4px 6px rgba(0, 0, 0, 0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ position: 'relative' }}>
            <img 
              src={userData.avatar} 
              alt={userData.name} 
              style={{ width: '70px', height: '70px', borderRadius: '50%', objectFit: 'cover', border: '3px solid #f1f5f9' }}
            />
            {userData.status === "정상 회원" && (
              <div style={{ position: 'absolute', bottom: 0, right: 0, backgroundColor: '#10b981', color: '#fff', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', border: '2px solid #fff' }}>✓</div>
            )}
          </div>
          
          <div style={{ display: 'grid', gap: '4px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '18px', fontWeight: '900', color: '#1e293b' }}>{userData.name}</span>
              <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '6px' }}>{userData.sportTag}</span>
              <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: userData.status === "정상 회원" ? '#d1fae5' : '#fee2e2', color: userData.status === "정상 회원" ? '#065f46' : '#991b1b', padding: '2px 6px', borderRadius: '6px' }}>{userData.status}</span>
            </div>
            <span style={{ fontSize: '13px', color: '#64748b' }}>닉네임: {userData.nickname}</span>
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px', marginTop: '20px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '14px', border: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <Mail size={15} style={{ color: '#64748b' }} />
            <span>{userData.email}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <Phone size={15} style={{ color: '#64748b' }} />
            <span>{userData.phone}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <Calendar size={15} style={{ color: '#64748b' }} />
            <span>가입일: {userData.joinedDate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155' }}>
            <MapPin size={15} style={{ color: '#64748b' }} />
            <span>주 활동 지역: {userData.location}</span>
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
            <Edit size={16} /> 정보 수정
          </button>
          <button 
            type="button"
            onClick={handleSendMessage}
            style={{
              height: '42px',
              borderRadius: '12px',
              border: '1px solid #cbd5e1',
              backgroundColor: '#fff',
              color: '#475569',
              fontWeight: '800',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Bell size={16} /> 알림 전송
          </button>
        </div>
      </section>

      {/* 활동 요약 수치 그리드 */}
      <section style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
        <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#eef2ff', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', color: '#4f46e5' }}>
            <Users size={16} />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>참여 모임 수</span>
          <strong style={{ fontSize: '18px', color: '#1e293b', marginTop: '2px', display: 'block' }}>{userData.stats.meetingsCount} <small style={{ fontSize: '11px', fontWeight: 'normal' }}>회</small></strong>
        </article>

        <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#fef3c7', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', color: '#d97706' }}>
            <CheckSquare size={16} />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>출석률</span>
          <strong style={{ fontSize: '18px', color: '#1e293b', marginTop: '2px', display: 'block' }}>{userData.stats.attendanceRate}<small style={{ fontSize: '11px', fontWeight: 'normal' }}>%</small></strong>
        </article>

        <article style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '14px', textAlign: 'center' }}>
          <div style={{ backgroundColor: '#ecfdf5', width: '28px', height: '28px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px auto', color: '#059669' }}>
            <Star size={16} />
          </div>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>매너 점수</span>
          <strong style={{ fontSize: '18px', color: '#1e293b', marginTop: '2px', display: 'block' }}>{userData.stats.mannerScore} <small style={{ fontSize: '11px', fontWeight: 'normal' }}>점</small></strong>
        </article>
      </section>

      {/* 활동 내역 및 모임 이력 */}
      <section className="detail-card" style={{ margin: '16px', padding: '16px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 12px 0' }}>최근 활동 내역</h2>
        {userData.activities.length === 0 ? (
          <p style={{ color: '#94a3b8', fontSize: '13px', margin: '12px 0' }}>참여한 모임 활동 내역이 없습니다.</p>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {userData.activities.map((act) => (
              <div 
                key={act.id} 
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
                  <strong style={{ fontSize: '13px', color: '#1e293b', display: 'block' }}>{act.title}</strong>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block', marginTop: '2px' }}>{act.time} ({act.category})</span>
                </div>
                <span style={{ fontSize: '11px', fontWeight: '800', backgroundColor: act.status === "참여완료" ? '#ecfdf5' : '#fee2e2', color: act.status === "참여완료" ? '#059669' : '#dc2626', padding: '2px 8px', borderRadius: '6px' }}>
                  {act.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 제재 및 시스템 메모 */}
      <section className="detail-card" style={{ margin: '16px', padding: '16px', borderRadius: '16px' }}>
        <h2 style={{ fontSize: '15px', fontWeight: '800', color: '#1e293b', margin: '0 0 12px 0' }}>제재 내역 및 메모</h2>
        
        {/* 누적 신고 내역 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', marginBottom: '12px' }}>
          <ShieldAlert size={18} style={{ color: '#3b82f6' }} />
          <div>
            <span style={{ fontSize: '12px', color: '#1e40af', display: 'block', fontWeight: 'bold' }}>신고받은 내역</span>
            <span style={{ fontSize: '11px', color: '#2563eb', display: 'block', marginTop: '1px' }}>{userData.reports.length === 0 ? "누적된 신고 이력이 없습니다." : `${userData.reports.length}건 누적됨`}</span>
          </div>
        </div>

        {/* 계정 메모 */}
        <div style={{ padding: '12px', backgroundColor: '#f8fafc', border: '1px solid #f1f5f9', borderRadius: '12px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: 'bold' }}>계정 상태 메모</span>
          <p style={{ fontSize: '13px', color: '#334155', margin: '4px 0 0 0' }}>{userData.memo}</p>
        </div>

        {/* 제재 실행 버튼 */}
        <div style={{ marginTop: '16px', borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', justifyContent: 'flex-end' }}>
          <button 
            type="button" 
            onClick={toggleStatus}
            style={{
              padding: '8px 16px',
              borderRadius: '10px',
              border: '1px solid #fee2e2',
              backgroundColor: '#fff5f5',
              color: '#ef4444',
              fontSize: '13px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Ban size={14} />
            <span>{userData.status === "정상 회원" ? "계정 정지 처리" : "계정 정지 해제"}</span>
          </button>
        </div>
      </section>

      {/* Edit Info Modal */}
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
            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: '900', color: '#1e293b' }}>회원 정보 수정</h3>
            <form onSubmit={handleSaveEdit} style={{ display: 'grid', gap: '12px' }}>
              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>이름</label>
                <input 
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>닉네임</label>
                <input 
                  type="text"
                  required
                  value={editForm.nickname}
                  onChange={(e) => setEditForm(prev => ({ ...prev, nickname: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>이메일</label>
                <input 
                  type="email"
                  required
                  value={editForm.email}
                  onChange={(e) => setEditForm(prev => ({ ...prev, email: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>전화번호</label>
                <input 
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>주 활동 지역</label>
                <input 
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm(prev => ({ ...prev, location: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>선호 종목</label>
                <input 
                  type="text"
                  placeholder="예: 축구, 테니스"
                  value={editForm.preferred_sports}
                  onChange={(e) => setEditForm(prev => ({ ...prev, preferred_sports: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 10px', fontSize: '13px' }}
                />
              </div>

              <div style={{ display: 'grid', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>권한 설정</label>
                <select 
                  value={editForm.role}
                  onChange={(e) => setEditForm(prev => ({ ...prev, role: e.target.value }))}
                  style={{ height: '36px', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '0 6px', fontSize: '13px', backgroundColor: '#fff' }}
                >
                  <option value="user">일반회원</option>
                  <option value="admin">관리자</option>
                  <option value="superadmin">최고관리자</option>
                  <option value="suspended">정지회원</option>
                  <option value="pending_withdrawal">탈퇴대기</option>
                </select>
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

export default MobileAdminUserDetailPage;
