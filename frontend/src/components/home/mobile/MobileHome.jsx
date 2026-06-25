import { Link } from "react-router-dom";
import { CalendarPlus, MapPinned, Search, Sparkles } from "lucide-react";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import MeetingCard from "../../meeting/shared/MeetingCard.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";

function MobileHome() {
  const meetings = useAsync(() => meetingApi.list({ limit: 5 }), []);
  const categories = useAsync(() => sportApi.categories(), []);

  return (
    <>
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

      <section className="section">
        <div className="section-title">
          <h2>스포츠 카테고리</h2>
          <MapPinned size={18} />
        </div>
        <div className="category-scroll">
          {(categories.data?.items || []).map((category) => (
            <Link key={category.id} to={`/meetings?category=${category.id}`}>
              {category.name}
            </Link>
          ))}
        </div>
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
            {(meetings.data?.items || []).map((meeting) => (
              <MeetingCard key={meeting.id} meeting={meeting} compact />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default MobileHome;

