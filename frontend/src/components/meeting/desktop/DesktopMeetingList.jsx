import { CalendarClock, Crown, FileText, Info, LocateFixed, Map, MapPin, Plus, RotateCcw, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { locationApi } from "../../../api/locationApi";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";
import { formatRegularMeetingSchedule } from "../../../utils/formatters";
import { getMeetingCoverImage } from "../../../utils/sportThumbnails";
import { koreaRegions } from "../../../data/koreaRegions";

const DEFAULT_RADIUS_KM = 6;
const DEFAULT_MAP_CENTER = { latitude: 37.5665, longitude: 126.978 };
const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";
const MEETING_MAP_MARKER_LOGO = "/images/logo.png";

function loadNaverMapScript(clientId) {
  if (!clientId) return Promise.reject(new Error("missing naver map client id"));
  if (window.naver?.maps) return Promise.resolve(window.naver.maps);
  if (window.__sportsmateNaverMapPromise) return window.__sportsmateNaverMapPromise;

  window.__sportsmateNaverMapPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById(NAVER_MAP_SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(window.naver.maps), { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = NAVER_MAP_SCRIPT_ID;
    script.async = true;
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(clientId)}`;
    script.onload = () => resolve(window.naver.maps);
    script.onerror = reject;
    document.head.appendChild(script);
  });

  return window.__sportsmateNaverMapPromise;
}

function normalizePlaceText(value) {
  return (value || "").replace(/<[^>]+>/g, "").trim();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function meetingMapMarkerContent(meeting) {
  return `
    <button class="desktop-meeting-map-marker" type="button" aria-label="${escapeHtml(meeting.title || "모임 위치")}">
      <span class="desktop-meeting-map-marker__logo">
        <img src="${MEETING_MAP_MARKER_LOGO}" alt="" />
      </span>
      <span class="desktop-meeting-map-marker__point"></span>
    </button>
  `;
}

function normalizeLocationCandidate(place) {
  const title = normalizePlaceText(place?.title || place?.name || "");
  const address = normalizePlaceText(place?.address || place?.road_address || "");
  const latitude = place?.latitude ?? null;
  const longitude = place?.longitude ?? null;

  return {
    id: place?.id || `${title || address}-${latitude || ""}-${longitude || ""}`,
    name: title || address || "선택한 위치",
    address,
    latitude,
    longitude
  };
}

function toMapPoint(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

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

function getDisplayStartAt(meeting) {
  return meeting.meeting_type === "regular" ? meeting.next_session?.start_at || meeting.start_at : meeting.start_at;
}

function getScheduleLabel(meeting) {
  if (meeting.meeting_type === "regular") {
    return formatRegularMeetingSchedule(meeting, "") || getDateLabel(getDisplayStartAt(meeting));
  }
  return getDateLabel(getDisplayStartAt(meeting));
}

function getMeetingTypeLabel(type) {
  return type === "regular" ? "정기모임" : "일회성";
}

function isHostMeeting(meeting) {
  return meeting.my_participant?.role === "host";
}

function getStatusLabel(status) {
  if (status === "full") return "모집마감";
  if (status === "closed") return "모집종료";
  if (status === "cancelled") return "취소됨";
  return "모집중";
}

function getStatusClass(status) {
  if (status === "full") return "is-full";
  if (status === "closed" || status === "cancelled") return "is-closed";
  return "is-open";
}

function formatDistance(value) {
  if (value === null || value === undefined || value === "") return "";
  const distance = Number(value);
  if (!Number.isFinite(distance)) return "";
  return distance < 1 ? `${Math.round(distance * 1000)}m` : `${distance.toFixed(distance >= 10 ? 0 : 1)}km`;
}

function DesktopMeetingList() {
  const [params, setParams] = useSearchParams();
  const [searchText, setSearchText] = useState(params.get("keyword") || "");
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [isRadiusModalOpen, setIsRadiusModalOpen] = useState(false);
  const [inputRadius, setInputRadius] = useState(6);
  const [isCancelHovered, setIsCancelHovered] = useState(false);
  const [isConfirmHovered, setIsConfirmHovered] = useState(false);
  const [isCloseHovered, setIsCloseHovered] = useState(false);
  const autoMapLocationTriedRef = useRef(false);
  const [advancedOpen, setAdvancedOpen] = useState(() => Boolean(params.get("category") || params.get("sport") || params.get("sido") || params.get("sigungu") || params.get("status")));
  const queryKey = params.toString();
  const query = Object.fromEntries(params.entries());
  delete query.view;
  delete query.near;
  delete query.map_auto_near;
  if (query.status === "all") {
    delete query.status;
    query.include_all = "1";
  }

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
  const selectedMeetingType = params.get("meeting_type") || "";
  const radiusKm = params.get("radius_km") || params.get("radius") || "";
  const radiusLabel = Number(radiusKm || DEFAULT_RADIUS_KM);
  const nearLabel = params.get("near") || (params.get("lat") && params.get("lng") ? "선택 위치" : "");
  const hasRadiusSearch = Boolean(params.get("lat") && params.get("lng"));
  const hasAdvancedFilters = Boolean(params.get("category") || params.get("sport") || params.get("sido") || params.get("sigungu") || params.get("status") || params.get("meeting_type"));
  const items = getItems(meetings.data).filter((meeting) => {
    if (selectedStatus === "all") return true;
    if (selectedStatus && selectedStatus !== "all") return meeting.status === selectedStatus;
    return meeting.status === "open";
  });
  const categoryItems = getItems(categories.data);
  const sportItems = getItems(sports.data);
  const selectedCategory = categoryItems.find((category) => String(category.id) === String(params.get("category")));
  const sportPlaceholderLabel = selectedCategory?.name || "전체 종목";
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
    next.delete("map_auto_near");
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

  const applyNearbyLocation = (location) => {
    const point = toMapPoint(location);
    if (!point) {
      setPlaceError("선택한 위치의 좌표를 확인할 수 없습니다.");
      return;
    }
    const next = clearRadiusSearch(new URLSearchParams(params));
    next.set("lat", String(point.latitude));
    next.set("lng", String(point.longitude));
    next.set("radius_km", String(DEFAULT_RADIUS_KM));
    next.set("near", location.name || "선택 위치");
    next.delete("keyword");
    next.delete("sido");
    next.delete("sigungu");
    setSearchText("");
    setPlaceError("");
    setParams(next);
    setLocationPickerOpen(false);
  };

  const applyCurrentLocation = ({ autoMap = false, radius = DEFAULT_RADIUS_KM } = {}) => {
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
        next.set("radius_km", String(radius));
        if (autoMap) next.set("map_auto_near", "1");
        else next.delete("map_auto_near");
        next.set("near", "내 현재 위치");
        next.delete("keyword");
        next.delete("sido");
        next.delete("sigungu");
        setSearchText("");
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

  const handleNearMeClick = () => {
    const currentRadius = Number(params.get("radius_km") || DEFAULT_RADIUS_KM);
    setInputRadius(currentRadius);
    setIsRadiusModalOpen(true);
  };

  const handleConfirmRadius = () => {
    setIsRadiusModalOpen(false);
    const currentLat = params.get("lat");
    const currentLng = params.get("lng");
    if (currentLat && currentLng) {
      const next = new URLSearchParams(params);
      next.set("radius_km", String(inputRadius));
      setParams(next);
    } else {
      applyCurrentLocation({ radius: inputRadius });
    }
  };

  useEffect(() => {
    if (viewMode !== "map") {
      autoMapLocationTriedRef.current = false;
      return;
    }
    if (hasRadiusSearch || autoMapLocationTriedRef.current) return;
    autoMapLocationTriedRef.current = true;
    applyCurrentLocation({ autoMap: true });
  }, [viewMode, hasRadiusSearch]);

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

  const toggleViewMode = () => {
    const next = new URLSearchParams(params);
    if (viewMode === "map") {
      next.set("view", "list");
      if (next.get("map_auto_near") === "1") {
        clearRadiusSearch(next);
      }
    } else {
      next.set("view", "map");
    }
    setPlaceError("");
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
          <button className="desktop-meeting-board__view-toggle" type="button" onClick={toggleViewMode}>
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
          <button type="button" className="is-secondary" onClick={() => setLocationPickerOpen(true)} disabled={placeLoading}>
            <MapPin size={15} />
            위치 검색
          </button>
          <button type="button" className="is-ghost" onClick={handleNearMeClick} disabled={placeLoading}>
            <LocateFixed size={15} />
            내 주변
          </button>
        </form>

        <div className="desktop-meeting-board__filter-help">
          <span>검색: 제목·종목·장소 포함</span>
          <span>위치 검색: 지도에서 선택한 위치 반경 6km</span>
        </div>

        {placeError ? <p className="desktop-meeting-board__radius-error">{placeError}</p> : null}
        {hasRadiusSearch ? (
          <div className="desktop-meeting-board__active-radius">
            <span>
              <MapPin size={15} />
              {nearLabel} 반경 {Number.isFinite(radiusLabel) ? radiusLabel : DEFAULT_RADIUS_KM}km
            </span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button type="button" onClick={handleNearMeClick}>수정</button>
              <button type="button" onClick={removeRadiusSearch}>해제</button>
            </div>
          </div>
        ) : null}

        <details className="desktop-meeting-board__advanced" open={advancedOpen} onToggle={(event) => setAdvancedOpen(event.currentTarget.open)}>
          <summary>
            <span><SlidersHorizontal size={15} />상세 필터</span>
            {hasAdvancedFilters ? <em>적용 중</em> : null}
          </summary>
          <div className="desktop-meeting-board__quick-filters">
            <div className="desktop-meeting-board__filter-group">
              <span>모집 상태</span>
              <div>
                <button type="button" className={selectedStatus === "all" ? "is-active" : ""} onClick={() => setParam("status", "all")}>
                  전체
                </button>
                <button type="button" className={!selectedStatus || selectedStatus === "open" ? "is-active" : ""} onClick={() => setParam("status", "open")}>
                  모집중
                </button>
              </div>
            </div>
            <div className="desktop-meeting-board__filter-group">
              <span>모임 유형</span>
              <div>
                <button type="button" className={!selectedMeetingType ? "is-active" : ""} onClick={() => setParam("meeting_type", "")}>
                  전체 유형
                </button>
                <button type="button" className={selectedMeetingType === "regular" ? "is-active" : ""} onClick={() => setParam("meeting_type", selectedMeetingType === "regular" ? "" : "regular")}>
                  정기
                </button>
                <button type="button" className={selectedMeetingType === "one_time" ? "is-active" : ""} onClick={() => setParam("meeting_type", selectedMeetingType === "one_time" ? "" : "one_time")}>
                  일회성
                </button>
              </div>
            </div>
            <div className="desktop-meeting-board__filter-group">
              <span>종목</span>
              <div>
                <select value={params.get("category") || ""} onChange={(event) => setParam("category", event.target.value, ["sport"])}>
                  <option value="">전체 대분류</option>
                  {categoryItems.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
                <select value={params.get("sport") || ""} onChange={(event) => setParam("sport", event.target.value)}>
                  <option value="">{sportPlaceholderLabel}</option>
                  {sportItems.map((sport) => (
                    <option key={sport.id} value={sport.id}>
                      {sport.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="desktop-meeting-board__filter-group">
              <span>지역</span>
              <div>
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
              </div>
            </div>
            <button type="button" className="desktop-meeting-board__filter-reset" onClick={resetFilters}>
              <RotateCcw size={14} />
              초기화
            </button>
          </div>
        </details>
      </section>

      {viewMode === "map" ? (
        <DesktopMeetingMap
          items={items}
          loading={meetings.loading}
          error={meetings.error}
          centerLocation={hasRadiusSearch ? { name: nearLabel, latitude: params.get("lat"), longitude: params.get("lng") } : null}
        />
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

      {locationPickerOpen ? (
        <NearbyLocationPicker
          initialLocation={hasRadiusSearch ? { name: nearLabel, latitude: params.get("lat"), longitude: params.get("lng") } : null}
          onClose={() => setLocationPickerOpen(false)}
          onApply={applyNearbyLocation}
        />
      ) : null}

      {isRadiusModalOpen ? (
        <div className="desktop-meeting-location-modal" role="dialog" aria-modal="true" aria-label="반경 설정">
          <div className="desktop-meeting-location-modal__backdrop" onClick={() => setIsRadiusModalOpen(false)} />
          <section className="desktop-meeting-location-modal__panel" style={{ position: "relative", maxWidth: "520px", borderRadius: "12px", overflow: "hidden", background: "#ffffff", boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)" }}>
            <div className="desktop-meeting-location-modal__head" style={{ borderBottom: "1px solid #f1f5f9", padding: "20px 24px", paddingRight: "54px" }}>
              <div style={{ display: "grid", gap: "4px" }}>
                <h2 style={{ fontSize: "18px", color: "#0f172a", margin: 0, fontWeight: 800 }}>내 주변 검색 반경 설정</h2>
                <span style={{ fontSize: "13px", color: "#64748b" }}>내 위치를 기준으로 모임을 탐색할 반경을 입력하세요.</span>
              </div>
              <button
                type="button"
                onClick={() => setIsRadiusModalOpen(false)}
                onMouseEnter={() => setIsCloseHovered(true)}
                onMouseLeave={() => setIsCloseHovered(false)}
                style={{ position: "absolute", top: "18px", right: "20px", background: "none", border: "none", cursor: "pointer", color: isCloseHovered ? "#334155" : "#94a3b8", padding: "4px", transition: "color 0.2s" }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="desktop-meeting-location-modal__body" style={{ display: "block", padding: "24px", minHeight: "auto" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 16px", background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: "8px", color: "#0369a1", fontSize: "13px", fontWeight: "700", lineHeight: "1.45", marginBottom: "20px" }}>
                <Info size={16} style={{ flexShrink: 0, marginTop: "2px", color: "#0284c7" }} />
                <span>검색 반경은 지도상의 직선거리 기준입니다. 실제 이동 경로(도보, 자차, 대중교통 등)의 주행 거리와는 차이가 있을 수 있습니다.</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px", fontWeight: "800", color: "#64748b" }}>
                  반경 설정 (단위: km)
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={inputRadius}
                    onChange={(e) => setInputRadius(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{
                      padding: "10px 14px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "15px",
                      fontWeight: "700",
                      color: "#0f172a",
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                  />
                </label>
              </div>
            </div>
            <div className="desktop-meeting-location-modal__actions" style={{ display: "flex", justifyContent: "flex-end", gap: "10px", padding: "16px 24px", borderTop: "1px solid #f1f5f9", background: "transparent" }}>
              <button
                type="button"
                className="is-muted"
                onClick={() => setIsRadiusModalOpen(false)}
                onMouseEnter={() => setIsCancelHovered(true)}
                onMouseLeave={() => setIsCancelHovered(false)}
                style={{
                  padding: "9px 17px",
                  borderRadius: "8px",
                  border: isCancelHovered ? "1px solid #94a3b8" : "1px solid #cbd5e1",
                  background: isCancelHovered ? "#f8fafc" : "#ffffff",
                  color: isCancelHovered ? "#0f172a" : "#475569",
                  fontSize: "13px",
                  fontWeight: "800",
                  cursor: "pointer",
                  transition: "background-color 0.2s, border-color 0.2s, color 0.2s"
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirmRadius}
                onMouseEnter={() => setIsConfirmHovered(true)}
                onMouseLeave={() => setIsConfirmHovered(false)}
                style={{
                  padding: "10px 18px",
                  borderRadius: "8px",
                  border: "none",
                  background: isConfirmHovered ? "#1d4ed8" : "#2563eb",
                  color: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "800",
                  cursor: "pointer",
                  transition: "background-color 0.2s"
                }}
              >
                확인
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function NearbyLocationPicker({ initialLocation, onClose, onApply }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const selectedMarkerRef = useRef(null);
  const resultMarkersRef = useRef([]);
  const [mapClientId, setMapClientId] = useState("");
  const [mapStatus, setMapStatus] = useState("idle");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [selectedLocation, setSelectedLocation] = useState(() => (initialLocation ? normalizeLocationCandidate(initialLocation) : null));
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const selectLocation = useCallback((location) => {
    const normalized = normalizeLocationCandidate(location);
    setSelectedLocation(normalized);
    setMessage("");
  }, []);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  useEffect(() => {
    if (!mapClientId) return;
    let disposed = false;
    setMapStatus("loading");
    loadNaverMapScript(mapClientId)
      .then((maps) => {
        if (disposed || !mapElementRef.current || mapRef.current) return;
        const initialPoint = toMapPoint(selectedLocation) || DEFAULT_MAP_CENTER;
        const center = new maps.LatLng(initialPoint.latitude, initialPoint.longitude);
        mapRef.current = new maps.Map(mapElementRef.current, {
          center,
          zoom: initialPoint === DEFAULT_MAP_CENTER ? 12 : 15,
          mapDataControl: false,
          scaleControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: maps.Position.TOP_RIGHT,
            style: maps.ZoomControlStyle.SMALL
          }
        });
        maps.Event.addListener(mapRef.current, "click", (event) => {
          const latitude = event.coord.lat();
          const longitude = event.coord.lng();
          const fallback = {
            name: "지도에서 선택한 위치",
            address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
            latitude,
            longitude
          };
          selectLocation(fallback);
          locationApi.reverseGeocode({ latitude, longitude })
            .then((data) => {
              const item = data.item || {};
              selectLocation({
                name: normalizePlaceText(item.title) || item.address || "지도에서 선택한 위치",
                address: item.address || fallback.address,
                latitude,
                longitude
              });
            })
            .catch(() => {});
        });
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("error"));

    return () => {
      disposed = true;
    };
  }, [mapClientId, selectLocation]);

  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    const point = toMapPoint(selectedLocation);
    if (!maps || !map || !point) return;

    const position = new maps.LatLng(point.latitude, point.longitude);
    if (!selectedMarkerRef.current) {
      selectedMarkerRef.current = new maps.Marker({ map, position });
    } else {
      selectedMarkerRef.current.setPosition(position);
      selectedMarkerRef.current.setMap(map);
    }
    map.setCenter(position);
    if (map.getZoom() < 14) map.setZoom(15);
  }, [selectedLocation?.latitude, selectedLocation?.longitude]);

  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    resultMarkersRef.current.forEach((marker) => marker.setMap(null));
    resultMarkersRef.current = [];

    const bounds = new maps.LatLngBounds();
    let hasBounds = false;
    results.forEach((place) => {
      const point = toMapPoint(place);
      if (!point) return;
      const position = new maps.LatLng(point.latitude, point.longitude);
      const marker = new maps.Marker({ map, position });
      maps.Event.addListener(marker, "click", () => selectLocation(place));
      resultMarkersRef.current.push(marker);
      bounds.extend(position);
      hasBounds = true;
    });

    if (hasBounds && !toMapPoint(selectedLocation)) {
      map.fitBounds(bounds, { top: 36, right: 36, bottom: 36, left: 36 });
    }
  }, [results, selectLocation, selectedLocation?.latitude, selectedLocation?.longitude]);

  const searchPlaces = async (event) => {
    event.preventDefault();
    const keyword = query.trim();
    if (!keyword) {
      setMessage("장소명이나 지역명을 입력해주세요.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const data = await locationApi.searchPlaces({ keyword, size: 8 });
      const nextResults = (data.items || [])
        .map(normalizeLocationCandidate)
        .filter((item) => toMapPoint(item));
      setResults(nextResults);
      if (nextResults.length) {
        selectLocation(nextResults[0]);
      } else {
        setMessage("좌표가 있는 장소를 찾지 못했습니다. 다른 장소명으로 검색해주세요.");
      }
    } catch {
      setMessage("장소 검색에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("현재 브라우저에서 위치 정보를 사용할 수 없습니다.");
      return;
    }
    setLoading(true);
    setMessage("");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        selectLocation({
          name: "내 현재 위치",
          address: "",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLoading(false);
      },
      () => {
        setMessage("위치 권한을 허용하면 현재 위치를 기준으로 검색할 수 있습니다.");
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  };

  const canApply = Boolean(toMapPoint(selectedLocation));

  return (
    <div className="desktop-meeting-location-modal" role="dialog" aria-modal="true" aria-label="검색 위치 선택">
      <div className="desktop-meeting-location-modal__backdrop" onClick={onClose} />
      <section className="desktop-meeting-location-modal__panel">
        <div className="desktop-meeting-location-modal__head">
          <div>
            <h2>검색 위치 선택</h2>
            <span>선택한 위치 반경 {DEFAULT_RADIUS_KM}km 안의 모임을 조회합니다.</span>
          </div>
          <button type="button" onClick={onClose} aria-label="닫기">
            <X size={18} />
          </button>
        </div>

        <form className="desktop-meeting-location-modal__search" onSubmit={searchPlaces}>
          <label>
            <Search size={17} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="장소명이나 지역명을 검색하세요. 예: 성수역, 잠실" />
          </label>
          <button type="submit" disabled={loading}>검색</button>
          <button type="button" className="is-ghost" onClick={useCurrentLocation} disabled={loading}>
            <LocateFixed size={15} />
            내 현재 위치
          </button>
        </form>

        <div className="desktop-meeting-location-modal__body">
          <div className="desktop-meeting-location-modal__map" ref={mapElementRef}>
            {!mapClientId ? <span>네이버 지도 클라이언트 키를 설정하면 지도에서 위치를 클릭할 수 있습니다.</span> : null}
            {mapStatus === "loading" ? <span>지도를 불러오는 중입니다.</span> : null}
            {mapStatus === "error" ? <span>지도를 불러오지 못했습니다. 검색 결과에서 위치를 선택해주세요.</span> : null}
          </div>
          <aside className="desktop-meeting-location-modal__side">
            <div className="desktop-meeting-location-modal__selected">
              <strong>검색 기준 위치</strong>
              {selectedLocation ? (
                <p>
                  <MapPin size={15} />
                  <span>
                    <b>{selectedLocation.name}</b>
                    {selectedLocation.address ? <small>{selectedLocation.address}</small> : null}
                  </span>
                </p>
              ) : (
                <p>장소를 검색하거나 지도에서 위치를 선택해주세요.</p>
              )}
            </div>

            {message ? <p className="desktop-meeting-location-modal__message">{message}</p> : null}

            <div className="desktop-meeting-location-modal__results">
              {results.map((place) => (
                <button
                  type="button"
                  key={place.id}
                  className={selectedLocation?.id === place.id ? "is-selected" : ""}
                  onClick={() => selectLocation(place)}
                >
                  <b>{place.name}</b>
                  {place.address ? <span>{place.address}</span> : null}
                </button>
              ))}
            </div>
          </aside>
        </div>

        <div className="desktop-meeting-location-modal__actions">
          <button type="button" className="is-muted" onClick={onClose}>취소</button>
          <button type="button" onClick={() => onApply(selectedLocation)} disabled={!canApply}>
            이 위치로 검색
          </button>
        </div>
      </section>
    </div>
  );
}

function DesktopMeetingRow({ meeting }) {
  const coverImage = getMeetingCoverImage(meeting);
  const distanceLabel = formatDistance(meeting.distance_km);

  return (
    <Link className="desktop-meeting-row" to={`/meetings/${meeting.id}`}>
      <span className="desktop-meeting-row__thumb" style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}>
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
          <em className="desktop-meeting-sport-badge">{getSportName(meeting)}</em>
          <em className="desktop-meeting-type-badge">{getMeetingTypeLabel(meeting.meeting_type)}</em>
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
          <b>{getScheduleLabel(meeting)}</b>
        </span>
      </span>
      <span className="desktop-meeting-row__people">
        <Users size={17} />
        <b>{getParticipantLabel(meeting)}</b>
      </span>
    </Link>
  );
}

function DesktopMeetingMap({ items, loading, error, centerLocation }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const infoWindowRef = useRef(null);
  const [mapClientId, setMapClientId] = useState("");
  const [mapStatus, setMapStatus] = useState("idle");
  const mapItems = items.filter((meeting) => toMapPoint(meeting));
  const centerPoint = toMapPoint(centerLocation);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  useEffect(() => {
    if (!mapClientId) return;
    let disposed = false;
    setMapStatus("loading");
    loadNaverMapScript(mapClientId)
      .then((maps) => {
        if (disposed || !mapElementRef.current) return;
        if (mapRef.current) {
          setMapStatus("ready");
          return;
        }
        const firstPoint = toMapPoint(mapItems[0]) || centerPoint || DEFAULT_MAP_CENTER;
        const center = new maps.LatLng(firstPoint.latitude, firstPoint.longitude);
        mapRef.current = new maps.Map(mapElementRef.current, {
          center,
          zoom: mapItems.length ? 13 : 11,
          mapDataControl: false,
          scaleControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: maps.Position.TOP_RIGHT,
            style: maps.ZoomControlStyle.SMALL
          }
        });
        infoWindowRef.current = new maps.InfoWindow({
          borderWidth: 0,
          disableAnchor: false,
          backgroundColor: "transparent"
        });
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("error"));

    return () => {
      disposed = true;
    };
  }, [mapClientId, mapItems.length, centerPoint?.latitude, centerPoint?.longitude]);

  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    if (!maps || !map) return;

    markersRef.current.forEach((marker) => marker.setMap(null));
    markersRef.current = [];

    if (!mapItems.length) {
      if (centerPoint) {
        map.setCenter(new maps.LatLng(centerPoint.latitude, centerPoint.longitude));
        map.setZoom(14);
      }
      return;
    }

    const bounds = new maps.LatLngBounds();
    mapItems.forEach((meeting) => {
      const point = toMapPoint(meeting);
      if (!point) return;
      const position = new maps.LatLng(point.latitude, point.longitude);
      const marker = new maps.Marker({
        map,
        position,
        title: meeting.title,
        icon: {
          content: meetingMapMarkerContent(meeting),
          size: new maps.Size(64, 76),
          anchor: new maps.Point(32, 76)
        },
        zIndex: 120
      });
      maps.Event.addListener(marker, "click", () => {
        const distanceLabel = formatDistance(meeting.distance_km);
        const content = `
          <div class="desktop-meeting-map-info">
            <strong>${escapeHtml(meeting.title || "모임")}</strong>
            <span>${escapeHtml(getPlaceName(meeting))}</span>
            <small>${escapeHtml(getSportName(meeting))}${distanceLabel ? ` · ${escapeHtml(distanceLabel)}` : ""}</small>
            <a href="/meetings/${meeting.id}">상세 보기</a>
          </div>
        `;
        infoWindowRef.current?.setContent(content);
        infoWindowRef.current?.open(map, marker);
      });
      markersRef.current.push(marker);
      bounds.extend(position);
    });

    if (mapItems.length === 1) {
      const onlyPoint = toMapPoint(mapItems[0]);
      map.setCenter(new maps.LatLng(onlyPoint.latitude, onlyPoint.longitude));
      map.setZoom(15);
    } else {
      map.fitBounds(bounds, { top: 48, right: 48, bottom: 48, left: 48 });
    }
  }, [mapItems, centerPoint?.latitude, centerPoint?.longitude]);

  return (
    <section className="desktop-meeting-map">
      <div className="desktop-meeting-map__canvas desktop-meeting-map__canvas--real" ref={mapElementRef}>
        {!mapClientId ? (
          <div className="desktop-meeting-map__fallback">
            <MapPin size={34} />
            <strong>네이버 지도 설정 필요</strong>
            <span>지도 클라이언트 키가 설정되면 이 영역에 모임 위치가 표시됩니다.</span>
          </div>
        ) : null}
        {mapStatus === "loading" ? (
          <div className="desktop-meeting-map__fallback">
            <MapPin size={34} />
            <strong>네이버 지도를 불러오는 중입니다.</strong>
          </div>
        ) : null}
        {mapStatus === "error" ? (
          <div className="desktop-meeting-map__fallback">
            <MapPin size={34} />
            <strong>지도를 불러오지 못했습니다.</strong>
            <span>네이버 지도 키와 네트워크 상태를 확인해주세요.</span>
          </div>
        ) : null}
        {mapStatus === "ready" && !mapItems.length ? (
          <div className="desktop-meeting-map__fallback">
            <MapPin size={34} />
            <strong>표시할 위치가 없습니다.</strong>
            <span>좌표가 등록된 모임만 지도에 표시됩니다.</span>
          </div>
        ) : null}
      </div>
      <aside className="desktop-meeting-map__list">
        <div className="desktop-section__head">
          <h2>지도에 표시된 모임</h2>
          <span>{mapItems.length}/{items.length}개</span>
        </div>
        {loading ? (
          <LoadingCards count={2} />
        ) : error ? (
          <EmptyState title="모임을 불러오지 못했습니다." description="백엔드 서버와 DB 연결 상태를 확인해주세요." />
        ) : (
          items.slice(0, 8).map((meeting) => (
            <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
              <span className="desktop-meeting-map__thumb" style={getMeetingCoverImage(meeting) ? { backgroundImage: `url(${getMeetingCoverImage(meeting)})` } : undefined} />
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
