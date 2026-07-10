import { Bike, Footprints, Mountain, Navigation } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";
import { getMeetingCoverImage, isUsingSportThumbnail } from "../utils/sportThumbnails";

function MapPage() {
  const { isMobile } = useResponsive();
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [position, setPosition] = useState(null);
  const [locationMessage, setLocationMessage] = useState("");
  const params = useMemo(
    () => ({
      limit: 12,
      ...(keyword ? { keyword } : {}),
      ...(position ? { lat: position.latitude, lng: position.longitude } : {})
    }),
    [keyword, position]
  );
  const meetings = useAsync(() => meetingApi.list(params), [params]);
  const items = meetings.data?.items || [];

  const search = (event) => {
    event?.preventDefault();
    setKeyword(keywordInput.trim());
  };

  const requestCurrentLocation = () => {
    setLocationMessage("");
    if (!("geolocation" in navigator)) {
      setLocationMessage("이 브라우저에서는 현재 위치를 사용할 수 없습니다.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          latitude: result.coords.latitude,
          longitude: result.coords.longitude
        });
        setLocationMessage("현재 위치 기준으로 주변 모임을 정렬했습니다.");
      },
      () => setLocationMessage("위치 권한이 허용되지 않았습니다. 브라우저 설정에서 위치 권한을 확인해주세요."),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  if (isMobile) {
    return (
      <>
        <MobileHeader title="지도 검색" />
        {meetings.loading ? (
          <LoadingCards count={2} />
        ) : (
          <div className="mobile-map-page">
            <form className="mobile-map-search" onSubmit={search}>
              <input aria-label="지도 검색" placeholder="지역, 장소를 검색하세요" value={keywordInput} onChange={(event) => setKeywordInput(event.target.value)} />
              <button type="submit" aria-label="검색">검색</button>
              <button type="button" aria-label="현재 위치" onClick={requestCurrentLocation}><Navigation size={19} /></button>
            </form>
            {locationMessage ? <p className="mobile-map-status">{locationMessage}</p> : null}
            <section className="mobile-map-canvas">
              <div className="map-current-label"><Navigation size={15} />{position ? "내 현재 위치 기준" : "지역/장소 검색 기준"}</div>
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
                  <img src={getMeetingCoverImage(meeting) || "/img/test3.png"} alt="" className={isUsingSportThumbnail(meeting) ? "is-sport-thumbnail" : ""} />
                  <span>
                    <b>{meeting.title}</b>
                    <small>{meeting.distance_km != null ? `${meeting.distance_km}km · ` : ""}{meeting.location_name || meeting.address} · {meeting.current_participants}/{meeting.max_participants}명</small>
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
