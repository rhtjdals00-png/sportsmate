import { Bike, Footprints, Mountain, Navigation } from "lucide-react";
import { Link } from "react-router-dom";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";

function MapPage() {
  const { isMobile } = useResponsive();
  const meetings = useAsync(() => meetingApi.list({ limit: 12 }), []);
  const items = meetings.data?.items || [];

  if (isMobile) {
    return (
      <>
        <MobileHeader title="지도 검색" />
        {meetings.loading ? (
          <LoadingCards count={2} />
        ) : (
          <div className="mobile-map-page">
            <section className="mobile-map-search">
              <input aria-label="지도 검색" placeholder="지역, 장소를 검색하세요" />
              <button type="button" aria-label="현재 위치"><Navigation size={19} /></button>
            </section>
            <section className="mobile-map-canvas">
              <div className="map-current-label"><Navigation size={15} />내 현재 위치 기준</div>
              <div className="map-pin p1"><Footprints size={22} /></div>
              <div className="map-pin p2"><Bike size={22} /></div>
              <div className="map-pin p3"><Mountain size={22} /></div>
              <div className="map-center" />
            </section>
            <section className="mobile-map-results">
              <div className="section-title">
                <h2>주변 모임</h2>
                <span>{items.length}개</span>
              </div>
              {items.slice(0, 5).map((meeting) => (
                <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="map-result">
                  <img src={meeting.cover_image_url || "/img/test3.png"} alt="" />
                  <span>
                    <b>{meeting.title}</b>
                    <small>{meeting.location_name || meeting.address} · {meeting.current_participants}/{meeting.max_participants}명</small>
                  </span>
                </Link>
              ))}
            </section>
          </div>
        )}
      </>
    );
  }

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>지도 검색</h1>
          <span>내 주변 모임을 지도와 결과 목록으로 훑어보는 화면입니다.</span>
        </div>
      </div>

      {meetings.loading ? (
        <LoadingCards count={2} />
      ) : (
        <div className="map-layout">
          <section className="mock-map page-card">
            <div className="map-current-label"><Navigation size={15} />내 현재 위치 기준</div>
            <div className="map-pin p1"><Footprints size={22} /></div>
            <div className="map-pin p2"><Bike size={22} /></div>
            <div className="map-pin p3"><Mountain size={22} /></div>
            <div className="map-center" />
          </section>
          <aside className="page-card map-side-list">
            <div className="section-head">
              <h2>검색 결과</h2>
              <span>{items.length}개</span>
            </div>
            {items.map((meeting) => (
              <Link key={meeting.id} to={`/meetings/${meeting.id}`} className="map-result">
                <img src={meeting.cover_image_url || "/img/test3.png"} alt="" />
                <span>
                  <b>{meeting.title}</b>
                  <small>{meeting.location_name || meeting.address} · {meeting.current_participants}/{meeting.max_participants}명</small>
                </span>
              </Link>
            ))}
          </aside>
        </div>
      )}
    </div>
  );
}

export default MapPage;
