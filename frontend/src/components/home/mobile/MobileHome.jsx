import { Link } from "react-router-dom";
import { CalendarPlus, Dumbbell, Search, ShieldCheck, Sparkles } from "lucide-react";
import { useMemo } from "react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MobilePullToRefresh from "../../layout/mobile/MobilePullToRefresh.jsx";
import MeetingCard from "../../meeting/shared/MeetingCard.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { getSportIcon } from "../../../utils/sportIcons.jsx";

function splitPreferredSports(value) {
  if (Array.isArray(value)) {
    return value.map((sport) => String(sport || "").trim()).filter(Boolean);
  }
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function isAdminUser(user) {
  const role = String(user?.role || user?.profile?.role || "").toLowerCase();
  return Boolean(user?.is_admin || user?.isAdmin || role === "admin" || role === "administrator");
}

function MobileHome() {
  const { user } = useAuth();
  const meetings = useAsync(() => meetingApi.list({ limit: 5, status: "open" }), []);
  const preferredSports = useMemo(
    () => splitPreferredSports(user?.profile?.preferred_sports),
    [user?.profile?.preferred_sports]
  );
  const sportShortcuts = useMemo(
    () => preferredSports.slice(0, 6).map((label) => ({ label, icon: getSportIcon(label) })),
    [preferredSports]
  );
  const hasPreferredSports = sportShortcuts.length > 0;
  const showAdminEntry = isAdminUser(user);

  return (
    <MobilePullToRefresh onRefresh={async () => { await meetings.execute(); }}>
      <MobileHeader showLogo />
      <section className="home-hero">
        <div>
          <span>내 주변 운동 모임</span>
          <h1>오늘 같이 운동할 메이트를 찾아보세요.</h1>
          <p>추천 모임, 신규 모임, 인기 종목을 한 화면에서 빠르게 확인합니다.</p>
        </div>
        <img src="/images/logo.png" alt="SportsMate 로고" />
      </section>

      <div className="quick-actions">
        <Link to="/meetings">
          <Search size={20} />
          모임 찾기
        </Link>
        <Link to="/meetings/create">
          <CalendarPlus size={20} />
          모임 만들기
        </Link>
      </div>

      {showAdminEntry ? (
        <Link className="mobile-admin-entry" to="/admin">
          <ShieldCheck size={20} />
          <span>관리자 대시보드 이동하기</span>
        </Link>
      ) : null}

      <section className="home-sport-shortcuts" aria-label="선호 종목 바로가기">
        {hasPreferredSports ? (
          sportShortcuts.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.label} to={`/meetings?keyword=${encodeURIComponent(item.label)}`}>
                <Icon size={22} style={{ color: 'var(--mobile-primary, #4f46e5)' }} />
                <span>{item.label}</span>
              </Link>
            );
          })
        ) : (
          <Link className="home-sport-shortcuts__empty" to="/mypage/profile">
            <Dumbbell size={22} style={{ color: 'var(--mobile-primary, #4f46e5)' }} />
            <span>선호 종목 설정</span>
          </Link>
        )}
      </section>


      <section className="section">
        <div className="section-title">
          <h2>추천 모임</h2>
          <Sparkles size={18} />
        </div>
        {meetings.loading ? (
          <LoadingCards count={3} />
        ) : (
          <div className="card-list">
            {(meetings.data?.items || [])
              .filter((meeting) => meeting.status === "open" && new Date(meeting.start_at) >= new Date())
              .map((meeting) => (
                <MeetingCard key={meeting.id} meeting={meeting} compact />
            ))}
          </div>
        )}
      </section>
    </MobilePullToRefresh>
  );
}

export default MobileHome;
