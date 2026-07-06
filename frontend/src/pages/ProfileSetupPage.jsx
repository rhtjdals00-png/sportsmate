import { Camera, Map as MapIcon, MapPin, Plus, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import { useAuth } from "../contexts/AuthContext.jsx";
import { locationApi } from "../api/locationApi";
import { sportApi } from "../api/sportApi";
import { userApi } from "../api/userApi";

const levelOptions = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "상급" }
];

const fallbackSportGroups = [
  { id: "ball", name: "구기 종목", sports: ["축구", "풋살", "농구", "배구", "야구", "족구"] },
  { id: "racket", name: "라켓 스포츠", sports: ["배드민턴", "탁구", "테니스", "스쿼시"] },
  { id: "outdoor", name: "러닝 / 야외", sports: ["러닝", "등산", "트래킹", "자전거", "산책"] },
  { id: "fitness", name: "피트니스", sports: ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"] },
  { id: "etc", name: "기타", sports: ["볼링", "당구", "골프", "수영"] }
];

function formatPhoneNumber(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

function text(value) {
  return value;
}

function splitSports(value) {
  return (value || "")
    .split(",")
    .map((sport) => sport.trim())
    .filter(Boolean);
}

function parsePreferredLevels(value) {
  if (!value) return {};
  if (typeof value === "object") return Object.keys(value).length ? value : {};
  try {
    const parsed = JSON.parse(value);
    return parsed && Object.keys(parsed).length ? parsed : {};
  } catch {
    return {};
  }
}

function hasBrokenText(value) {
  return !value || /\\u[0-9a-f]{4}|\ufffd|\?\?/.test(String(value));
}

function buildSportGroups(categories, sports) {
  if (!categories.length || !sports.length || categories.some((category) => hasBrokenText(category.name))) {
    return fallbackSportGroups;
  }

  const groups = categories
    .map((category) => ({
      id: String(category.id),
      name: category.name,
      sports: sports
        .filter((sport) => String(sport.category_id) === String(category.id))
        .map((sport) => sport.name)
        .filter((name) => !hasBrokenText(name))
    }))
    .filter((group) => group.sports.length);

  return groups.length ? groups : fallbackSportGroups;
}

const DEFAULT_MAP_CENTER = { latitude: 37.5665, longitude: 126.9780 };
const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";

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

function toMapPoint(place) {
  const latitude = Number(place?.latitude);
  const longitude = Number(place?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function normalizePlaceText(value) {
  return (value || "").replace(/<[^>]+>/g, "").trim();
}

function ProfileRegionMap({ clientId, selectedLocation, results, onSelect }) {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null);
  const selectedMarkerRef = useRef(null);
  const resultMarkersRef = useRef([]);
  const [mapStatus, setMapStatus] = useState("idle");

  useEffect(() => {
    if (!clientId) return;
    let disposed = false;
    setMapStatus("loading");
    loadNaverMapScript(clientId)
      .then((maps) => {
        if (disposed || !mapElementRef.current || mapRef.current) return;
        const center = new maps.LatLng(DEFAULT_MAP_CENTER.latitude, DEFAULT_MAP_CENTER.longitude);
        mapRef.current = new maps.Map(mapElementRef.current, {
          center,
          zoom: 12,
          mapDataControl: false,
          scaleControl: false,
          zoomControl: true,
          zoomControlOptions: {
            position: maps.Position.TOP_RIGHT,
            style: maps.ZoomControlStyle.SMALL
          }
        });
        maps.Event.addListener(mapRef.current, "click", (event) => {
          onSelect({
            source: "map-click",
            latitude: event.coord.lat(),
            longitude: event.coord.lng()
          });
        });
        setMapStatus("ready");
      })
      .catch(() => setMapStatus("error"));

    return () => {
      disposed = true;
    };
  }, [clientId, onSelect]);

  useEffect(() => {
    const maps = window.naver?.maps;
    const map = mapRef.current;
    const selectedPoint = toMapPoint(selectedLocation);
    if (!maps || !map || !selectedPoint) return;

    const position = new maps.LatLng(selectedPoint.latitude, selectedPoint.longitude);
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
      maps.Event.addListener(marker, "click", () => onSelect(place));
      resultMarkersRef.current.push(marker);
      bounds.extend(position);
      hasBounds = true;
    });
    if (hasBounds && !toMapPoint(selectedLocation)) map.fitBounds(bounds, { top: 36, right: 36, bottom: 36, left: 36 });
  }, [results, onSelect, selectedLocation?.latitude, selectedLocation?.longitude]);

  if (!clientId) {
    return <div className="profile-setup__map-empty"><MapIcon size={20} />네이버 지도 클라이언트 키를 설정하면 지도에서 위치를 지정할 수 있습니다.</div>;
  }

  return (
    <div className="profile-setup__map-panel">
      <div className="profile-setup__map-toolbar">
        <span><MapIcon size={17} />지도에서 활동지역 지정</span>
        <small>검색 결과 마커나 지도 위치를 클릭하세요.</small>
      </div>
      <div className="profile-setup__map" ref={mapElementRef}>
        {mapStatus === "loading" ? <span>지도를 불러오는 중입니다.</span> : null}
        {mapStatus === "error" ? <span>지도를 불러오지 못했습니다.</span> : null}
      </div>
    </div>
  );
}

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `#${normalized}` : "";
}

function profilePhoneValue(value) {
  const formatted = formatPhoneNumber(value || "");
  const digits = formatted.replace(/\D/g, "");
  return digits === "01000000000" ? "" : formatted;
}

function ProfileSetupPage() {
  const navigate = useNavigate();
  const { user, setCurrentUser } = useAuth();
  const initialLevels = parsePreferredLevels(user?.profile?.preferred_sport_levels);
  const initialSports = splitSports(user?.profile?.preferred_sports);

  const [form, setForm] = useState({
    name: user?.name || "",
    nickname: user?.nickname || "",
    phone_number: profilePhoneValue(user?.phone_number),
    profile_image_url: user?.profile_image_url || "",
    bio: user?.profile?.bio || "",
    region: user?.profile?.region || "",
    region_latitude: user?.profile?.region_latitude,
    region_longitude: user?.profile?.region_longitude,
    region_2: user?.profile?.region_2 || "",
    region_2_latitude: user?.profile?.region_2_latitude,
    region_2_longitude: user?.profile?.region_2_longitude,
    exercise_level: user?.profile?.exercise_level || initialLevels.all || "beginner",
    preferred_sports: initialSports,
    preferred_sport_levels: initialLevels
  });
  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState(fallbackSportGroups[0].id);
  const [selectedSport, setSelectedSport] = useState("");
  const [selectedSportLevel, setSelectedSportLevel] = useState(user?.profile?.exercise_level || initialLevels.all || "beginner");
  const [useSportLevels, setUseSportLevels] = useState(
    initialSports.some((sportName) => Boolean(initialLevels[sportName]))
  );
  const [regionKeywords, setRegionKeywords] = useState({
    primary: user?.profile?.region || "",
    secondary: user?.profile?.region_2 || ""
  });
  const [showSecondaryRegion, setShowSecondaryRegion] = useState(Boolean(user?.profile?.region_2));
  const [activeRegionSlot, setActiveRegionSlot] = useState("primary");
  const [pendingRegionSelection, setPendingRegionSelection] = useState(null);
  const [regionResults, setRegionResults] = useState([]);
  const [regionLoading, setRegionLoading] = useState(false);
  const [regionMessage, setRegionMessage] = useState("");
  const [mapClientId, setMapClientId] = useState("");
  const regionSearchRequestRef = useRef(0);
  const regionReverseRequestRef = useRef(0);
  const selectedRegionKeywordRef = useRef({
    primary: user?.profile?.region || "",
    secondary: user?.profile?.region_2 || ""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([sportApi.categories(), sportApi.sports()])
      .then(([categoryData, sportData]) => {
        setCategories(categoryData.items || []);
        setSports(sportData.items || []);
      })
      .catch(() => {
        setCategories([]);
        setSports([]);
      });
  }, []);

  const sportGroups = useMemo(() => buildSportGroups(categories, sports), [categories, sports]);
  const activeSportGroup = sportGroups.find((group) => group.id === selectedCategoryId) || sportGroups[0];
  const selectedLevelLabel = levelOptions.find((level) => level.value === form.exercise_level)?.label || "입문";
  const displayTag = tagLabel(user);
  const selectedRegionLocation = activeRegionSlot === "secondary"
    ? { latitude: form.region_2_latitude, longitude: form.region_2_longitude }
    : { latitude: form.region_latitude, longitude: form.region_longitude };
  const mapSelectedLocation = pendingRegionSelection?.slot === activeRegionSlot ? pendingRegionSelection : selectedRegionLocation;
  const visibleRegionSlots = [
    { id: "primary", label: "활동지역 1", value: form.region },
    ...(showSecondaryRegion ? [{ id: "secondary", label: "활동지역 2", value: form.region_2 }] : [])
  ];

  useEffect(() => {
    if (!sportGroups.some((group) => group.id === selectedCategoryId)) {
      setSelectedCategoryId(sportGroups[0]?.id || "");
      setSelectedSport("");
    }
  }, [sportGroups, selectedCategoryId]);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updateRegionKeyword = (slot, value) => {
    setRegionKeywords((current) => ({ ...current, [slot]: value }));
  };

  const activateRegionSlot = (slot) => {
    if (activeRegionSlot === slot) return;
    setActiveRegionSlot(slot);
    setRegionResults([]);
    setPendingRegionSelection(null);
    setRegionMessage("");
  };

  const updateRegion = (slot, region, latitude, longitude) => {
    const fields = slot === "secondary"
      ? { region: "region_2", latitude: "region_2_latitude", longitude: "region_2_longitude" }
      : { region: "region", latitude: "region_latitude", longitude: "region_longitude" };
    setForm((current) => ({
      ...current,
      [fields.region]: region,
      [fields.latitude]: latitude,
      [fields.longitude]: longitude
    }));
  };

  const searchRegion = async (slot = activeRegionSlot) => {
    const keyword = (regionKeywords[slot] || "").trim();
    setActiveRegionSlot(slot);
    if (!keyword) {
      setRegionResults([]);
      setRegionMessage("검색할 주소나 장소를 입력해주세요.");
      return;
    }

    const requestId = regionSearchRequestRef.current + 1;
    regionSearchRequestRef.current = requestId;
    setPendingRegionSelection(null);
    setRegionLoading(true);
    setRegionMessage("");
    try {
      const data = await locationApi.searchPlaces({ keyword, size: 8 });
      if (regionSearchRequestRef.current !== requestId) return;
      const items = data.items || [];
      setRegionResults(items);
      setRegionMessage(items.length ? `${items.length}개의 검색 결과가 있습니다. 추가할 위치를 먼저 선택해주세요.` : "검색 결과가 없습니다.");
    } catch {
      if (regionSearchRequestRef.current === requestId) {
        setRegionResults([]);
        setRegionMessage("주소 검색에 실패했습니다.");
      }
    } finally {
      if (regionSearchRequestRef.current === requestId) setRegionLoading(false);
    }
  };

  const selectRegion = useCallback(async (place) => {
    const slot = activeRegionSlot;
    if (place.source === "map-click") {
      const requestId = regionReverseRequestRef.current + 1;
      regionReverseRequestRef.current = requestId;
      const { latitude, longitude } = place;
      selectedRegionKeywordRef.current[slot] = "지도에서 선택한 위치";
      regionSearchRequestRef.current += 1;
      setRegionResults([]);
      setRegionLoading(false);
      setRegionMessage("지도에서 선택한 위치의 주소를 확인하고 있습니다.");
      setPendingRegionSelection({ slot, title: "지도에서 선택한 위치", address: "지도에서 선택한 위치", latitude, longitude });

      try {
        const data = await locationApi.reverseGeocode({ latitude, longitude });
        const item = data.item || {};
        const title = normalizePlaceText(item.title) || item.address || "지도에서 선택한 위치";
        const address = item.address || item.road_address || title;
        if (regionReverseRequestRef.current !== requestId) return;
        setPendingRegionSelection({ slot, title, address, latitude, longitude });
        setRegionMessage("선택한 위치를 확인한 뒤 추가 버튼을 눌러주세요.");
      } catch {
        if (regionReverseRequestRef.current !== requestId) return;
        const coordinateLabel = `위도 ${Number(latitude).toFixed(6)}, 경도 ${Number(longitude).toFixed(6)}`;
        setPendingRegionSelection({ slot, title: "지도에서 선택한 위치", address: coordinateLabel, latitude, longitude });
        setRegionMessage("주소 확인에 실패했습니다. 좌표를 추가하려면 추가 버튼을 눌러주세요.");
      }
      return;
    }

    const title = normalizePlaceText(place.title);
    const address = place.address || place.road_address || title;
    setPendingRegionSelection({ slot, title: title || address, address, latitude: place.latitude, longitude: place.longitude });
    setRegionMessage("선택한 위치를 확인한 뒤 추가 버튼을 눌러주세요.");
  }, [activeRegionSlot, regionKeywords]);

  const addPendingRegion = () => {
    if (!pendingRegionSelection) {
      setRegionMessage("검색 결과나 지도에서 추가할 위치를 먼저 선택해주세요.");
      return;
    }
    const { slot, title, address, latitude, longitude } = pendingRegionSelection;
    const label = address || title;
    selectedRegionKeywordRef.current[slot] = label;
    regionSearchRequestRef.current += 1;
    updateRegionKeyword(slot, label);
    updateRegion(slot, label, latitude, longitude);
    setRegionResults([]);
    setPendingRegionSelection(null);
    setRegionLoading(false);
    setRegionMessage(`${slot === "secondary" ? "활동지역 2" : "활동지역 1"}에 추가되었습니다.`);
  };

  const addRegionPlace = (place) => {
    const slot = activeRegionSlot;
    const title = normalizePlaceText(place.title);
    const address = place.address || place.road_address || title;
    selectedRegionKeywordRef.current[slot] = address;
    regionSearchRequestRef.current += 1;
    updateRegionKeyword(slot, address);
    updateRegion(slot, address, place.latitude, place.longitude);
    setRegionResults([]);
    setPendingRegionSelection(null);
    setRegionLoading(false);
    setRegionMessage(`${slot === "secondary" ? "활동지역 2" : "활동지역 1"}에 추가되었습니다.`);
  };

  const updateExerciseLevel = (level) => {
    setForm((current) => ({
      ...current,
      exercise_level: level,
      preferred_sport_levels: {
        ...current.preferred_sport_levels,
        all: level
      }
    }));
    setSelectedSportLevel(level);
  };

  const addSport = () => {
    if (!selectedSport) return;
    setForm((current) => {
      if (current.preferred_sports.includes(selectedSport)) return current;
      return {
        ...current,
        preferred_sports: [...current.preferred_sports, selectedSport],
        preferred_sport_levels: {
          ...current.preferred_sport_levels,
          [selectedSport]: useSportLevels ? selectedSportLevel : current.exercise_level
        }
      };
    });
    setSelectedSport("");
  };

  const removeSport = (sportName) => {
    setForm((current) => {
      const nextLevels = { ...current.preferred_sport_levels };
      delete nextLevels[sportName];
      return {
        ...current,
        preferred_sports: current.preferred_sports.filter((name) => name !== sportName),
        preferred_sport_levels: nextLevels
      };
    });
  };

  const attachProfileImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updateField("profile_image_url", reader.result);
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setSaving(true);
    try {
      const phoneNumber = profilePhoneValue(form.phone_number);
      const data = await userApi.updateMe({
        name: form.name.trim(),
        phone_number: phoneNumber || null,
        nickname: form.nickname.trim(),
        profile_image_url: form.profile_image_url,
        bio: form.bio.trim(),
        region: form.region,
        region_latitude: form.region_latitude,
        region_longitude: form.region_longitude,
        region_2: form.region_2,
        region_2_latitude: form.region_2_latitude,
        region_2_longitude: form.region_2_longitude,
        exercise_level: form.exercise_level,
        preferred_sports: form.preferred_sports.join(", "),
        preferred_sport_levels: useSportLevels
          ? { ...form.preferred_sport_levels, all: form.exercise_level }
          : { all: form.exercise_level }
      });
      setCurrentUser(data.user);
      navigate("/", { replace: true });
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="profile-setup-page">
      <form className="profile-setup" onSubmit={submit}>
        <section className="profile-setup__intro">
          <div>
            <p className="profile-setup__eyebrow">{"추가 정보 입력"}</p>
            <h1>{"운동 메이트 추천을 위한 프로필을 완성해주세요"}</h1>
            <p>{"가입은 완료됐어요. 지역, 운동 수준, 선호 종목을 입력하면 더 정확한 추천을 받을 수 있습니다."}</p>
          </div>
        </section>

        <section className="profile-setup__nickname-notice" aria-label="nickname notice">
          <strong>{"닉네임과 식별 태그가 설정됐어요"}</strong>
          <p>{"카카오톡으로 처음 로그인하면 카카오톡 닉네임을 기본으로 사용합니다. 사용자 식별은 자동으로 생성된 4자리 태그를 사용하고, 닉네임은 마이페이지에서 언제든 수정할 수 있습니다."}</p>
          {form.nickname ? <span>{"현재 닉네임"}: {form.nickname} {displayTag}</span> : null}
        </section>

        <section className="profile-setup__panel profile-setup__identity">
          <div className="profile-setup__avatar">
            <img src={form.profile_image_url || "/images/logo.png"} alt="profile preview" />
            <label className="profile-setup__avatar-button">
              <Camera size={18} />
              <span>{"사진 변경"}</span>
              <input type="file" accept="image/*" onChange={attachProfileImage} />
            </label>
          </div>
          <div className="profile-setup__fields">
            <label>
              <span>{"이름"}</span>
              <input value={form.name} onChange={(event) => updateField("name", event.target.value)} placeholder={text("표시 이름")} />
            </label>
            <label>
              <span>{"닉네임"}</span>
              <input value={form.nickname} onChange={(event) => updateField("nickname", event.target.value)} placeholder={text("모임에서 사용할 닉네임")} required />
            </label>
            <label>
              <span>{"휴대폰 번호"}</span>
              <input
                type="tel"
                inputMode="numeric"
                value={form.phone_number}
                onChange={(event) => updateField("phone_number", formatPhoneNumber(event.target.value))}
                placeholder="010-0000-0000"
                maxLength={13}
              />
            </label>
            <label className="profile-setup__wide-field">
              <span>{"한 줄 소개"}</span>
              <textarea value={form.bio} onChange={(event) => updateField("bio", event.target.value)} placeholder={text("예: 평일 저녁 러닝과 주말 풋살을 좋아해요.")} rows={3} />
            </label>
          </div>
        </section>

        <section className="profile-setup__panel profile-setup__grid-section">
          <div>
            <h2>{"활동 지역"}</h2>
            <p>{"주소를 검색하거나 지도에서 활동할 위치를 선택해주세요."}</p>
          </div>
          <div className="profile-setup__region-picker">
            {visibleRegionSlots.map((slot) => (
              <div key={slot.id} className={`profile-setup__region-slot ${activeRegionSlot === slot.id ? "is-active" : ""}`}>
                <label className="profile-setup__address-row">
                  <Search size={18} />
                  <input
                    value={regionKeywords[slot.id]}
                    placeholder={`${slot.label} 주소 또는 장소`}
                    onFocus={() => activateRegionSlot(slot.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        searchRegion(slot.id);
                      }
                    }}
                    onChange={(event) => {
                      selectedRegionKeywordRef.current[slot.id] = "";
                      updateRegionKeyword(slot.id, event.target.value);
                      updateRegion(slot.id, event.target.value, undefined, undefined);
                      activateRegionSlot(slot.id);
                    }}
                  />
                  <button type="button" onClick={() => searchRegion(slot.id)} disabled={regionLoading && activeRegionSlot === slot.id}>
                    {regionLoading && activeRegionSlot === slot.id ? "검색 중" : "검색"}
                  </button>
                </label>
                <div className={`profile-setup__region-result ${slot.value ? "is-selected" : ""}`}>
                  <MapPin size={16} />
                  <strong>{slot.label}</strong>
                  <span>{slot.value || "아직 선택되지 않았습니다."}</span>
                </div>
              </div>
            ))}
            {!showSecondaryRegion ? (
              <button
                type="button"
                className="profile-setup__add-region-button"
                onClick={() => {
                  setShowSecondaryRegion(true);
                  activateRegionSlot("secondary");
                }}
              >
                <Plus size={16} /> 선호지역 추가
              </button>
            ) : null}
            {regionMessage ? <p className="profile-setup__address-message">{regionMessage}</p> : null}
            {regionResults.length > 0 ? (
              <div className="profile-setup__address-results">
                {regionResults.map((place, index) => (
                  <button
                    type="button"
                    key={`${place.title || place.address}-${index}`}
                    className={pendingRegionSelection?.address === (place.address || place.road_address || normalizePlaceText(place.title)) ? "is-pending" : ""}
                    onClick={() => selectRegion(place)}
                    onDoubleClick={() => addRegionPlace(place)}
                  >
                    <strong>{normalizePlaceText(place.title || place.address)}</strong>
                    {place.address || place.road_address ? <span>{place.address || place.road_address}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
            {pendingRegionSelection ? (
              <div className="profile-setup__pending-region">
                <div>
                  <strong>추가할 위치</strong>
                  <span>{pendingRegionSelection.address || pendingRegionSelection.title}</span>
                </div>
                <button type="button" onClick={addPendingRegion}>
                  <Plus size={16} /> 추가
                </button>
              </div>
            ) : null}
            <ProfileRegionMap clientId={mapClientId} selectedLocation={mapSelectedLocation} results={regionResults} onSelect={selectRegion} />
          </div>
        </section>

        <section className="profile-setup__panel profile-setup__grid-section">
          <div>
            <h2>{"운동 프로필"}</h2>
            <p>{"전체 운동 수준은"} <strong>{selectedLevelLabel}</strong>{"으로 저장됩니다."}</p>
          </div>
          <div className="profile-setup__level-buttons">
            {levelOptions.map((level) => (
              <button key={level.value} type="button" className={form.exercise_level === level.value ? "is-active" : ""} onClick={() => updateExerciseLevel(level.value)}>
                {level.label}
              </button>
            ))}
          </div>
        </section>

        <section className="profile-setup__panel profile-setup__sports">
          <div className="profile-setup__section-head">
            <div>
              <h2>{"선호 종목"}</h2>
              <p>{"대주제를 고른 뒤 소주제를 추가해주세요. 여러 종목을 선택할 수 있어요."}</p>
            </div>
            <span>{form.preferred_sports.length}{"개 선택"}</span>
          </div>
          <div className={`profile-setup__sport-dropdowns ${useSportLevels ? "profile-setup__sport-dropdowns--with-level" : ""}`}>
            <select value={selectedCategoryId} onChange={(event) => { setSelectedCategoryId(event.target.value); setSelectedSport(""); }}>
              {sportGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
            </select>
            <select value={selectedSport} onChange={(event) => setSelectedSport(event.target.value)}>
              <option value="">{"소주제 선택"}</option>
              {(activeSportGroup?.sports || []).map((sportName) => <option key={sportName} value={sportName}>{sportName}</option>)}
            </select>
            {useSportLevels ? (
              <select value={selectedSportLevel} onChange={(event) => setSelectedSportLevel(event.target.value)}>
                {levelOptions.map((level) => (
                  <option key={level.value} value={level.value}>{level.label}</option>
                ))}
              </select>
            ) : null}
            <button type="button" onClick={addSport} disabled={!selectedSport}>
              <Plus size={16} /> {"추가"}
            </button>
          </div>
          <label className="profile-setup__level-toggle">
            <input
              type="checkbox"
              checked={useSportLevels}
              onChange={(event) => setUseSportLevels(event.target.checked)}
            />
            <span>{"종목별 수준 선택하기"}</span>
          </label>
          {form.preferred_sports.length > 0 ? (
            <div className="profile-setup__selected">
              {form.preferred_sports.map((sportName) => {
                const levelLabel = levelOptions.find((level) => level.value === form.preferred_sport_levels[sportName])?.label;
                return (
                  <button type="button" key={sportName} onClick={() => removeSport(sportName)}>
                    {useSportLevels && levelLabel ? `${sportName}:${levelLabel}` : sportName}
                    <X size={14} />
                  </button>
                );
              })}
            </div>
          ) : null}
        </section>

        {error ? <p className="profile-setup__error">{error}</p> : null}
        <div className="profile-setup__actions">
          <Button type="button" variant="ghost" onClick={() => navigate("/", { replace: true })}>{"나중에 하기"}</Button>
          <Button type="submit" disabled={saving || !form.nickname.trim()}>{saving ? text("저장 중...") : text("프로필 저장")}</Button>
        </div>
      </form>
    </main>
  );
}

export default ProfileSetupPage;
