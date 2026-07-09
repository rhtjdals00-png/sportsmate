import { CalendarClock, Crown, FileText, LocateFixed, Map, MapPin, Plus, RotateCcw, Search, SlidersHorizontal, Users } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useState } from "react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { locationApi } from "../../../api/locationApi";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";
import { getMeetingCoverImage, getSportNameFromMeeting, isUsingSportThumbnail } from "../../../utils/sportThumbnails";
import { koreaRegions } from "../../../data/koreaRegions";

const DEFAULT_RADIUS_KM = 6;

const fallbackSidoRegions = koreaRegions.map((region) => ({
  code: region.name,
  name: region.name,
}));

const mergeByName = (primary = [], fallback = []) => {
  const seen = new Set();
  return [...primary, ...fallback].filter((item) => {
    const name = item?.name;
    if (!name || seen.has(name)) return false;
    seen.add(name);
    return true;
  });
};

function getItems(data) {
  return data?.items || [];
}

function getSportName(meeting) {
  return meeting.sport?.name || "종목 미정";
}

function getPlaceName(meeting) {
  return meeting.location_name || meeting.address || "장소 미정";
}

function getParticipantLabel(meeting) {
  const current = meeting.current_participants ?? 0;
  const max = meeting.max_participants ?? "-";
  return `${current}/${max}명`;
}

function getDateLabel(value) {
  if (!value) return "일정 미정";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getMeetingTypeLabel(type) {
  return type === "regular" ? "정기 모임" : "일회성 모임";
}

function isHostMeeting(meeting) {
  return meeting.my_participant?.role === "host";
}

function getStatusLabel(status) {
  if (status === "full") return "모집 마감";
  if (status === "closed") return "모집종료";
  if (status === "cancelled") return "취소됨";
  return "모집중";
}

function getStatusClass(status) {
  if (status === "closed" || status === "full" || status === "cancelled") return "is-closed";
  return "is-open";
}

function formatDistance(value) {
  const distance = Number(value);
  if (!Number.isFinite(distance)) return "";
  return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(distance >= 10 ? 0 : 1)}km`;
}

function DesktopMeetingList() {
  const [params, setParams] = useSearchParams();
  const [searchText, setSearchText] = useState(params.get("near") || params.get("keyword") || "");
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(() => Boolean(params.get("category") || params.get("sport") || params.get("sido") || params.get("sigungu") || params.get("status")));
  const queryKey = params.toString();
  const query = Object.fromEntries(params.entries());
  delete query.view;
  delete query.category;
  delete query.near;

  const meetings = useAsync(() => meetingApi.list(query), [queryKey]);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(
    () => (params.get("category") ? sportApi.sports({ category_id: params.get("category") }) : sportApi.sports()),
    [params.get("category")]
  );
  const sidoRegions = useAsync(() => locationApi.regions({ level: "sido" }), []);
  const sigunguRegions = useAsync(
    () => (params.get("sido") ? locationApi.regions({ level: "sigungu", parent_code: params.get("sido") }) : Promise.resolve({ items: [] })),
    [params.get("sido")]
  );

  const viewMode = params.get("view") || "list";
  const selectedStatus = params.get("status") || "";
  const radiusKm = params.get("radius_km") || params.get("radius") || "";
  const radiusLabel = Number(radiusKm || DEFAULT_RADIUS_KM);
  const nearLabel = params.get("near") || (params.get("lat") && params.get("lng") ? "선택 위치" : "");
  const hasRadiusSearch = Boolean(params.get("lat") && params.get("lng"));
  const hasAdvancedFilters = Boolean(params.get("category") || params.get("sport") || params.get("sido") || params.get("sigungu") || params.get("status"));
  const items = getItems(meetings.data).filter((meeting) => {
    if (selectedStatus) return meeting.status === selectedStatus;
    return meeting.status === "open";
  });
  const categoryItems = getItems(categories.data);
  const sportItems = getItems(sports.data);
  const sidoItems = mergeByName(getItems(sidoRegions.data), fallbackSidoRegions);
  const currentSido = sidoItems.find((region) => String(region.code) === String(params.get("sido")));
  const fallbackSigunguRegions = currentSido
    ? (koreaRegions.find((region) => region.name === currentSido.name)?.areas || []).map((name) => ({ code: name, name }))
    : [];
  const sigunguItems = mergeByName(getItems(sigunguRegions.data), fallbackSigunguRegions);

  const setParam = (key, value, extraDeletes = []) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    extraDeletes.forEach((deleteKey) => next.delete(deleteKey));
    setParams(next);
  };

  const clearRadiusSearch = (next = new URLSearchParams(params)) => {
    next.delete("lat");
    next.delete("lng");
    next.delete("latitude");
    next.delete("longitude");
    next.delete("radius");
    next.delete("radius_km");
    next.delete("near");
    return next;
  };

  const resetFilters = () => {
    const next = new URLSearchParams();
    if (viewMode === "map") next.set("view", "map");
    setParams(next);
    setSearchText("");
    setPlaceError("");
  };

  const submitKeyword = (event) => {
    event.preventDefault();
    const keyword = searchText.trim();
    const next = clearRadiusSearch(new URLSearchParams(params));
    if (keyword) next.set("keyword", keyword);
    else next.delete("keyword");
    setParams(next);
    setPlaceError("");
  };

  const applyPlaceSearch = async () => {
    const keyword = searchText.trim();
    if (!keyword) {
      setPlaceError("장소를 입력하면 반경 6km 안의 모임을 찾을 수 있어요.");
      return;
    }
    setPlaceLoading(true);
    setPlaceError("");
    try {
      const result = await locationApi.searchPlaces({ keyword, size: 1 });
      const place = (result.items || []).find((item) => item.latitude != null && item.longitude != null);
      if (!place) {
        setPlaceError("좌표를 찾지 못했습니다. 예: 잠실역, 반포한강공원처럼 입력해보세요.");
        return;
      }
      const next = clearRadiusSearch(new URLSearchParams(params));
      next.set("lat", String(place.latitude));
      next.set("lng", String(place.longitude));
      next.set("radius_km", String(DEFAULT_RADIUS_KM));
      next.set("near", keyword);
      next.delete("keyword");
      next.delete("sido");
      next.delete("sigungu");
      setParams(next);
    } catch {
      setPlaceError("장소 검색에 실패했습니다.");
    } finally {
      setPlaceLoading(false);
    }
  };

  const applyCurrentLocation = () => {
    if (!navigator.geolocation) {
      setPlaceError("현재 브라우저에서 위치 정보를 사용할 수 없습니다.");
      return;
    }
    setPlaceLoading(true);
    setPlaceError("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = clearRadiusSearch(new URLSearchParams(params));
        next.set("lat", String(position.coords.latitude));
        next.set("lng", String(position.coords.longitude));
        next.set("radius_km", String(DEFAULT_RADIUS_KM));
        next.set("near", "내 현재 위치");
        next.delete("keyword");
        next.delete("sido");
        next.delete("sigungu");
        setSearchText("내 현재 위치");
        setParams(next);
        setPlaceLoading(false);
      },
      () => {
        setPlaceError("위치 권한을 허용하면 내 주변 모임을 볼 수 있습니다.");
        setPlaceLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  };

  const removeRadiusSearch = () => {
    const next = clearRadiusSearch(new URLSearchParams(params));
    setParams(next);
    setSearchText("");
    setPlaceError("");
  };

  const handleRegionChange = (key, value, extraDeletes = []) => {
    const next = clearRadiusSearch(new URLSearchParams(params));
    if (value) next.set(key, value);
    else next.delete(key);
    extraDeletes.forEach((deleteKey) => next.delete(deleteKey));
    setParams(next);
  };

  return (
    <div className="desktop-meeting-board">
      <div className="screen-title desktop-meeting-board__title">
        <div>
          <h1>모임 게시판</h1>
          <span>키워드로 찾거나 장소 주변 6km 안의 모임을 확인하세요.</span>
        </div>
        <div className="desktop-meeting-board__title-actions">
          <Link className="desktop-meeting-board__create-link" to="/meetings/create">
            <Plus size={16} />
            모임 만들기
          </Link>
          <button className="desktop-meeting-board__view-toggle" type="button" onClick={() => setParam("view", viewMode === "map" ? "list" : "map")}>
            {viewMode === "map" ? <FileText size={16} /> : <Map size={16} />}
            {viewMode === "map" ? "리스트로 보기" : "지도로 보기"}
          </button>
        </div>
      </div>

      <section className="desktop-meeting-board__filters desktop-meeting-board__filters--simple">
        <form className="desktop-meeting-board__smart-search" onSubmit={submitKeyword}>
          <label>
            <Search size={18} />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="제목, 종목, 장소를 검색하세요. 예: 풋살, 잠실"
            />
          </label>
          <button type="submit">검색</button>
          <button type="button" className="is-secondary" onClick={applyPlaceSearch} disabled={placeLoading}>
            <MapPin size={15} />
            주변 검색
          </button>
          <button type="button" className="is-ghost" onClick={applyCurrentLocation} disabled={placeLoading}>
            <LocateFixed size={15} />
            내 주변
          </button>
        </form>

        <div className="desktop-meeting-board__filter-help">
          <span>검색: 제목·종목·장소 포함</span>
          <span>주변 검색: 입력한 장소 반경 6km</span>
        </div>

        {placeError ? <p className="desktop-meeting-board__radius-error">{placeError}</p> : null}
        {hasRadiusSearch ? (
          <div className="desktop-meeting-board__active-radius">
            <span>
              <MapPin size={15} />
              {nearLabel} 반경 {Number.isFinite(radiusLabel) ? radiusLabel : DEFAULT_RADIUS_KM}km
            </span>
            <button type="button" onClick={removeRadiusSearch}>해제</button>
          </div>
        ) : null}

        <details className="desktop-meeting-board__advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
          <summary>
            <span><SlidersHorizontal size={15} />상세 필터</span>
            {hasAdvancedFilters ? <em>적용 중</em> : null}
          </summary>
          <div className="desktop-meeting-board__quick-filters">
            <button type="button" className={!params.get("status") ? "is-active" : ""} onClick={() => setParam("status", "")}>
              전체
            </button>
            <button type="button" className={selectedStatus === "open" ? "is-active" : ""} onClick={() => setParam("status", "open")}>
              모집중
            </button>
            <select value={params.get("category") || ""} onChange={(event) => setParam("category", event.target.value, ["sport"])}>
              <option value="">전체 대분류</option>
              {categoryItems.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select value={params.get("sport") || ""} onChange={(event) => setParam("sport", event.target.value)}>
              <option value="">전체 종목</option>
              {sportItems.map((sport) => (
                <option key={sport.id} value={sport.id}>
                  {sport.name}
                </option>
              ))}
            </select>
            <select value={params.get("sido") || ""} onChange={(event) => handleRegionChange("sido", event.target.value, ["sigungu"])}>
              <option value="">전체 지역</option>
              {sidoItems.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
            <select value={params.get("sigungu") || ""} onChange={(event) => handleRegionChange("sigungu", event.target.value)} disabled={!params.get("sido")}>
              <option value="">전체 구역</option>
              {sigunguItems.map((region) => (
                <option key={region.code} value={region.code}>
                  {region.name}
                </option>
              ))}
            </select>
            <button type="button" onClick={resetFilters}>
              <RotateCcw size={14} />
              초기화
            </button>
          </div>
        </details>
      </section>

      {viewMode === "map" ? (
        <DesktopMeetingMap items={items} loading={meetings.loading} error={meetings.error} />
      ) : (
        <section className="desktop-meeting-board__results">
          <div className="desktop-section__head">
            <h2>{hasRadiusSearch ? `${nearLabel} 주변 모임` : "모임 검색 결과"}</h2>
            <span>{items.length}개</span>
          </div>
          {meetings.loading ? (
            <LoadingCards count={4} />
          ) : meetings.error ? (
            <EmptyState title="모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." />
          ) : items.length ? (
            <div className="desktop-meeting-list">
              {items.map((meeting) => (
                <DesktopMeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          ) : (
            <EmptyState title="조건에 맞는 모임이 없습니다." description={hasRadiusSearch ? "장소를 바꾸거나 상세 필터를 줄여 다시 검색해보세요." : "검색어나 필터를 조금 넓혀서 다시 찾아보세요."} actionLabel="모임 만들기" actionTo="/meetings/create" />
          )}
        </section>
      )}
    </div>
  );
}

function DesktopMeetingRow({ meeting }) {
  const coverImage = getMeetingCoverImage(meeting);
  const showSportThumbnailLabel = isUsingSportThumbnail(meeting);
  const distanceLabel = formatDistance(meeting.distance_km);

  return (
    <Link className="desktop-meeting-row" to={`/meetings/${meeting.id}`}>
      <span className={`desktop-meeting-row__thumb ${showSportThumbnailLabel ? "is-sport-thumbnail" : ""}`} style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}>
        {showSportThumbnailLabel && <span className="sport-thumbnail-label">{getSportNameFromMeeting(meeting)}</span>}
        {!coverImage && getSportName(meeting)}
      </span>
      <span className="desktop-meeting-row__main">
        <span className="desktop-meeting-row__badges">
          {isHostMeeting(meeting) && (
            <em className="desktop-meeting-owner-badge">
              <Crown size={12} />
              내가 방장
            </em>
          )}
          <em className={`desktop-meeting-status ${getStatusClass(meeting.status)}`}>{getStatusLabel(meeting.status)}</em>
          <em>{getSportName(meeting)}</em>
          <em>{getMeetingTypeLabel(meeting.meeting_type)}</em>
          {distanceLabel ? <em className="desktop-meeting-distance-badge">{distanceLabel}</em> : null}
        </span>
        <strong>{meeting.title}</strong>
        <small>{meeting.description || "모임 설명이 없습니다."}</small>
      </span>
      <span className="desktop-meeting-row__meta">
        <span>
          <MapPin size={16} />
          <b>{getPlaceName(meeting)}</b>
        </span>
        <span>
          <CalendarClock size={16} />
          <b>{getDateLabel(meeting.start_at)}</b>
        </span>
      </span>
      <span className="desktop-meeting-row__people">
        <Users size={17} />
        <b>{getParticipantLabel(meeting)}</b>
      </span>
    </Link>
  );
}

function DesktopMeetingMap({ items, loading, error }) {
  return (
    <section className="desktop-meeting-map">
      <div className="desktop-meeting-map__canvas">
        <MapPin size={34} />
        <strong>지도 보기 영역</strong>
        <span>지도 API 연결 전까지 선택한 모임 목록을 기준으로 표시합니다.</span>
      </div>
      <aside className="desktop-meeting-map__list">
        <div className="desktop-section__head">
          <h2>주변 모임</h2>
          <span>{items.length}개</span>
        </div>
        {loading ? (
          <LoadingCards count={2} />
        ) : error ? (
          <EmptyState title="모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." />
        ) : (
          items.slice(0, 5).map((meeting) => (
            <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
              <span className={`desktop-meeting-map__thumb ${isUsingSportThumbnail(meeting) ? "is-sport-thumbnail" : ""}`} style={getMeetingCoverImage(meeting) ? { backgroundImage: `url(${getMeetingCoverImage(meeting)})` } : undefined}>
                {isUsingSportThumbnail(meeting) && <span className="sport-thumbnail-label">{getSportNameFromMeeting(meeting)}</span>}
              </span>
              <span>
                <strong>{meeting.title}</strong>
                <small>
                  {getPlaceName(meeting)} · {getSportName(meeting)} · {formatDistance(meeting.distance_km) || getParticipantLabel(meeting)}
                </small>
              </span>
            </Link>
          ))
        )}
      </aside>
    </section>
  );
}

export default DesktopMeetingList;
