import { Check, CheckCircle2, CircleAlert, LockKeyhole, Map as MapIcon, MapPin, Pencil, Plus, Search, X, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { locationApi } from "../../../api/locationApi";
import { sportApi } from "../../../api/sportApi";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { userApi } from "../../../api/userApi";
import { useAuth } from "../../../contexts/AuthContext";

const NICKNAME_MAX_LENGTH = 12;
const MAX_PREFERRED_REGIONS = 2;
const DEFAULT_MAP_CENTER = { latitude: 37.5665, longitude: 126.978 };
const NAVER_MAP_SCRIPT_ID = "naver-map-sdk";

const passwordChecks = [
  { id: "length", label: "8자 이상", test: (password) => password.length >= 8 },
  { id: "upper", label: "영문 대문자", test: (password) => /[A-Z]/.test(password) },
  { id: "lower", label: "영문 소문자", test: (password) => /[a-z]/.test(password) },
  { id: "number", label: "숫자", test: (password) => /\d/.test(password) },
  { id: "special", label: "특수문자", test: (password) => /[^A-Za-z0-9]/.test(password) }
];

const isValidPassword = (password) => passwordChecks.every((item) => item.test(password));

function getPasswordCheckItems(password) {
  return passwordChecks.map((item) => ({ ...item, passed: item.test(password) }));
}

function getPasswordStrength(password) {
  const passedCount = getPasswordCheckItems(password).filter((item) => item.passed).length;
  if (!password) return { label: "입력 전", level: "empty", percent: 0 };
  if (passedCount <= 2) return { label: "위험", level: "danger", percent: 32 };
  if (passedCount <= 4) return { label: "보통", level: "normal", percent: 66 };
  return { label: "안전", level: "safe", percent: 100 };
}

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

const levelOptions = [
  { value: "beginner", label: "입문" },
  { value: "intermediate", label: "중급" },
  { value: "advanced", label: "고급" }
];

const fallbackSportCategories = [
  { id: "ball", name: "구기 종목", sports: ["축구", "농구", "야구", "배구", "풋살", "족구"] },
  { id: "racket", name: "라켓 스포츠", sports: ["배드민턴", "테니스", "탁구", "스쿼시"] },
  { id: "outdoor", name: "러닝 / 야외", sports: ["러닝", "등산", "트레킹", "자전거"] },
  { id: "fitness", name: "피트니스", sports: ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"] },
  { id: "etc", name: "기타", sports: ["볼링", "댄스", "골프", "수영"] }
];

function mergeSportNames(baseSports, apiSports) {
  const names = new Set(baseSports);
  apiSports.forEach((sportName) => {
    if (sportName) names.add(sportName);
  });
  return Array.from(names);
}

function buildSportGroups(categories, sports) {
  if (!categories.length) return fallbackSportCategories;

  const apiGroups = categories.map((category) => ({
    id: category.id,
    name: category.name,
    sports: sports
      .filter((sport) => String(sport.category_id) === String(category.id))
      .map((sport) => sport.name)
  }));
  const apiGroupByName = new Map(apiGroups.map((group) => [group.name, group]));

  // 2026-07-01: API 응답 도착 후에도 관심 종목 탭 순서와 기본 종목이 흔들리지 않도록 병합.
  const fixedGroups = fallbackSportCategories.map((fallbackGroup) => {
    const apiGroup = apiGroupByName.get(fallbackGroup.name);
    return {
      ...fallbackGroup,
      sports: mergeSportNames(fallbackGroup.sports, apiGroup?.sports || [])
    };
  });

  const extraGroups = apiGroups.filter(
    (apiGroup) => !fallbackSportCategories.some((fallbackGroup) => fallbackGroup.name === apiGroup.name)
  );

  return [...fixedGroups, ...extraGroups];
}

const emptyForm = {
  name: "",
  phone_number: "",
  nickname: "",
  email: "",
  profile_image_url: "",
  region: "",
  region_latitude: null,
  region_longitude: null,
  region_2: "",
  region_2_latitude: null,
  region_2_longitude: null,
  selected_regions: [],
  selected_region_locations: [],
  exercise_level: "beginner",
  preferred_sports: [],
  preferred_sport_levels: {}
};

function splitList(value) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizePlaceText(value) {
  return (value || "").replace(/<[^>]+>/g, "").trim();
}

function compactRegionText(value) {
  const parts = normalizePlaceText(value).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).join(" ");
}

function normalizeLocationCandidate(place) {
  const title = normalizePlaceText(place?.title || place?.name || "");
  const address = normalizePlaceText(place?.address || place?.road_address || "");
  const region = compactRegionText(address || place?.region || title);
  const latitude = place?.latitude ?? null;
  const longitude = place?.longitude ?? null;

  return {
    id: place?.id || `${title || address}-${latitude || ""}-${longitude || ""}`,
    type: place?.type || "place",
    name: title || address || "지도에서 선택한 위치",
    address,
    region,
    category: normalizePlaceText(place?.category || "장소"),
    latitude,
    longitude,
    source: place?.source || ""
  };
}

function locationLabel(location) {
  if (!location) return "";
  return location.type === "place"
    ? `${location.name} · ${location.region}`
    : location.region || location.name;
}

function regionToMockLocation(regionName, index) {
  return {
    id: `saved-${index}-${regionName}`,
    type: "region",
    name: regionName,
    address: "",
    region: regionName,
    category: "저장된 지역"
  };
}

function buildLocationFromProfile(label, latitude, longitude, index) {
  if (!label) return null;
  return {
    id: `profile-region-${index}`,
    type: "region",
    name: label,
    address: "",
    region: label,
    category: "저장된 선호지역",
    latitude,
    longitude,
    source: "profile"
  };
}

function ProfilePreferredLocationMap({ clientId, selectedLocation, results, onSelect }) {
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
    if (hasBounds && !toMapPoint(selectedLocation)) {
      map.fitBounds(bounds, { top: 36, right: 36, bottom: 36, left: 36 });
    }
  }, [results, onSelect, selectedLocation?.latitude, selectedLocation?.longitude]);

  if (!clientId) {
    return (
      <div className="desktop-profile-map-preview desktop-profile-map-preview--empty">
        <MapIcon size={22} />
        <span>지도 클라이언트 키가 설정되면 이 영역에서 위치를 확인할 수 있습니다.</span>
      </div>
    );
  }

  return (
    <div className="desktop-profile-map-preview desktop-profile-map-preview--real" ref={mapElementRef}>
      {mapStatus === "loading" && <span>지도를 불러오는 중입니다.</span>}
      {mapStatus === "error" && <span>지도를 불러오지 못했습니다.</span>}
    </div>
  );
}

function normalizeLevels(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function tagLabel(user) {
  const rawTag = user?.user_tag || user?.user_tag_display || user?.nickname_with_tag?.match(/\[([^\]]+)\]/)?.[1] || "";
  const normalized = String(rawTag).replace(/^#/, "").replace(/^\[/, "").replace(/\]$/, "").trim();
  return normalized ? `#${normalized}` : "";
}

function buildFormFromUser(user) {
  const profile = user?.profile || {};
  const selectedLocations = [
    buildLocationFromProfile(profile.region, profile.region_latitude, profile.region_longitude, 1),
    buildLocationFromProfile(profile.region_2, profile.region_2_latitude, profile.region_2_longitude, 2)
  ].filter(Boolean);
  const selectedRegions = selectedLocations.length ? selectedLocations.map(locationLabel) : splitList(profile.region);
  const preferredSports = splitList(profile.preferred_sports);
  const levels = normalizeLevels(profile.preferred_sport_levels);

  return {
    name: user?.name || "",
    phone_number: user?.phone_number || "",
    nickname: (user?.nickname || "").slice(0, NICKNAME_MAX_LENGTH),
    email: user?.email || "",
    profile_image_url: user?.profile_image_url || "",
    region: profile.region || "",
    region_latitude: profile.region_latitude ?? null,
    region_longitude: profile.region_longitude ?? null,
    region_2: profile.region_2 || "",
    region_2_latitude: profile.region_2_latitude ?? null,
    region_2_longitude: profile.region_2_longitude ?? null,
    selected_regions: selectedRegions,
    selected_region_locations: selectedLocations,
    exercise_level: profile.exercise_level || levels.all || "beginner",
    preferred_sports: preferredSports,
    preferred_sport_levels: levels
  };
}

function DesktopProfileEdit() {
  const navigate = useNavigate();
  const { user, backendTokenReady, setCurrentUser } = useAuth();
  const [form, setForm] = useState(() => (user ? buildFormFromUser(user) : emptyForm));
  const [loadedUser, setLoadedUser] = useState(user);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const [categories, setCategories] = useState([]);
  const [sports, setSports] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(fallbackSportCategories[0].id);
  const [useSportLevels, setUseSportLevels] = useState(() => {
    const levels = form.preferred_sport_levels || {};
    return form.preferred_sports.some((sportName) => Boolean(levels[sportName]));
  });
  const [regionQuery, setRegionQuery] = useState("");
  const [regionResults, setRegionResults] = useState([]);
  const [regionSearching, setRegionSearching] = useState(false);
  const [regionMessage, setRegionMessage] = useState("");
  const [selectedRegionCandidate, setSelectedRegionCandidate] = useState(null);
  const [mapClientId, setMapClientId] = useState("");

  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ current: "", next: "", confirm: "" });
  const [passwordStatus, setPasswordStatus] = useState("idle");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawText, setWithdrawText] = useState("");
  const [withdrawStatus, setWithdrawStatus] = useState("idle");
  const profileLoadedRef = useRef(false);
  const passwordCloseTimerRef = useRef(null);

  useEffect(() => {
    let mounted = true;

    if (!backendTokenReady) {
      // 2026-07-01: 백엔드 토큰 준비 전 users/me 호출로 발생하던 401 표시를 방지.
      profileLoadedRef.current = false;
      setLoading(false);
      setLoadError("");
      return () => {
        mounted = false;
      };
    }

    if (profileLoadedRef.current) {
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    // 2026-07-01: 프로필 수정 진입 시 최초 1회만 최신 내 정보로 폼을 채우고, 편집 중 값은 덮어쓰지 않음.
    profileLoadedRef.current = true;
    setLoading(true);
    setLoadError("");
    userApi.me()
      .then((data) => {
        if (!mounted) return;
        setLoadedUser(data.user);
        setCurrentUser?.(data.user);
        const nextForm = buildFormFromUser(data.user);
        setForm(nextForm);
        setUseSportLevels(
          nextForm.preferred_sports.some((sportName) => Boolean(nextForm.preferred_sport_levels?.[sportName]))
        );
      })
      .catch((error) => {
        if (!mounted) return;
        profileLoadedRef.current = false;
        setLoadError(error?.response?.data?.message || "프로필 정보를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [backendTokenReady, setCurrentUser]);

  useEffect(() => {
    Promise.all([sportApi.categories(), sportApi.sports()])
      .then(([categoryData, sportData]) => {
        const nextCategories = categoryData.items || [];
        setCategories(nextCategories);
        setSports(sportData.items || []);
      })
      .catch(() => {
        setCategories([]);
        setSports([]);
      });
  }, []);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));
  }, []);

  useEffect(() => () => {
    if (passwordCloseTimerRef.current) {
      window.clearTimeout(passwordCloseTimerRef.current);
    }
  }, []);

  const sportCategoryGroups = useMemo(() => buildSportGroups(categories, sports), [categories, sports]);

  const activeSportGroup = sportCategoryGroups.find((group) => String(group.id) === String(activeCategoryId)) || sportCategoryGroups[0];
  const selectableSports = activeSportGroup?.sports || [];
  const displayTag = tagLabel(loadedUser);
  const savedIntro = loadedUser?.profile?.bio || "아직 한 줄 소개가 없습니다.";
  const newPasswordChecks = getPasswordCheckItems(passwordForm.next);
  const newPasswordStrength = getPasswordStrength(passwordForm.next);
  const hasPasswordConfirm = Boolean(passwordForm.confirm);
  const passwordMatches = Boolean(passwordForm.next) && passwordForm.next === passwordForm.confirm;
  const selectedLocationCount = form.selected_regions.length;
  const savedRegionLocation = (form.selected_region_locations || [])[0];
  const mapLocation = selectedRegionCandidate || savedRegionLocation || (form.selected_regions[0] ? regionToMockLocation(form.selected_regions[0], 0) : null);
  const pendingRegion = mapLocation ? locationLabel(mapLocation) : (regionQuery || "검색 결과를 선택하면 지도에서 확인할 수 있습니다");
  const candidateRegion = selectedRegionCandidate
    ? locationLabel(selectedRegionCandidate)
    : "검색 결과나 지도에서 위치를 선택하면 추가할 수 있습니다";
  const candidateNotice = selectedLocationCount >= MAX_PREFERRED_REGIONS
    ? `선호지역은 최대 ${MAX_PREFERRED_REGIONS}개까지 선택할 수 있습니다`
    : candidateRegion;

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  useEffect(() => {
    if (!sportCategoryGroups.length) return;
    if (!sportCategoryGroups.some((group) => String(group.id) === String(activeCategoryId))) {
      setActiveCategoryId(sportCategoryGroups[0].id);
    }
  }, [activeCategoryId, sportCategoryGroups]);

  const updateNickname = (value) => {
    update("nickname", value.slice(0, NICKNAME_MAX_LENGTH));
  };

  const addRegion = (location) => {
    const nextLocation = normalizeLocationCandidate(location);
    const nextRegion = locationLabel(nextLocation).trim();
    if (!nextRegion) return;
    if (form.selected_regions.length >= MAX_PREFERRED_REGIONS && !form.selected_regions.includes(nextRegion)) {
      setRegionMessage(`선호지역은 최대 ${MAX_PREFERRED_REGIONS}개까지 선택할 수 있습니다.`);
      return;
    }

    setForm((current) => {
      const nextRegions = current.selected_regions.includes(nextRegion)
        ? current.selected_regions
        : [...current.selected_regions, nextRegion];
      const nextLocations = current.selected_regions.includes(nextRegion)
        ? current.selected_region_locations
        : [...current.selected_region_locations, nextLocation];
      const firstLocation = nextLocations[0] || null;
      const secondLocation = nextLocations[1] || null;
      return {
        ...current,
        region: nextRegions[0] || "",
        region_latitude: firstLocation?.latitude ?? null,
        region_longitude: firstLocation?.longitude ?? null,
        region_2: nextRegions[1] || "",
        region_2_latitude: secondLocation?.latitude ?? null,
        region_2_longitude: secondLocation?.longitude ?? null,
        selected_regions: nextRegions,
        selected_region_locations: nextLocations
      };
    });
    setRegionQuery("");
    setRegionMessage("");
    setSelectedRegionCandidate(location);
  };

  const removeRegion = (regionName) => {
    setForm((current) => {
      const nextRegions = current.selected_regions.filter((region) => region !== regionName);
      const nextLocations = current.selected_region_locations.filter((location) => locationLabel(location) !== regionName);
      const firstLocation = nextLocations[0] || null;
      const secondLocation = nextLocations[1] || null;
      return {
        ...current,
        region: nextRegions[0] || "",
        region_latitude: firstLocation?.latitude ?? null,
        region_longitude: firstLocation?.longitude ?? null,
        region_2: nextRegions[1] || "",
        region_2_latitude: secondLocation?.latitude ?? null,
        region_2_longitude: secondLocation?.longitude ?? null,
        selected_regions: nextRegions,
        selected_region_locations: nextLocations
      };
    });
  };

  const searchRegion = async () => {
    const keyword = regionQuery.trim();
    setRegionMessage("");
    if (!keyword) {
      setRegionResults([]);
      setSelectedRegionCandidate(null);
      setRegionMessage("검색할 지역이나 장소를 입력해주세요.");
      return;
    }

    setRegionSearching(true);
    try {
      const data = await locationApi.searchPlaces({ keyword, size: 8 });
      const nextResults = (data.items || []).map(normalizeLocationCandidate);
      setRegionResults(nextResults);
      setSelectedRegionCandidate(nextResults[0] || null);
      if (!nextResults.length) setRegionMessage("검색 결과가 없습니다. 다른 장소명이나 지역명으로 검색해보세요.");
    } catch {
      setRegionResults([]);
      setSelectedRegionCandidate(null);
      setRegionMessage("장소 검색 API에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setRegionSearching(false);
    }
  };

  const selectRegionCandidate = useCallback(async (place) => {
    const location = normalizeLocationCandidate(place);
    setSelectedRegionCandidate(location);

    if (place?.source !== "map-click") return;

    try {
      const data = await locationApi.reverseGeocode({
        latitude: place.latitude,
        longitude: place.longitude
      });
      setSelectedRegionCandidate(normalizeLocationCandidate({
        ...(data.item || {}),
        latitude: place.latitude,
        longitude: place.longitude,
        source: "map-click"
      }));
    } catch {
      setSelectedRegionCandidate(location);
    }
  }, []);

  // 2026-07-03: profile/setup의 대분류-소주제-추가 흐름과 맞춰 PC 프로필 수정의 종목 선택 방식을 통일.
  const addSelectedSport = (sportName) => {
    if (!sportName) return;
    setForm((current) => {
      if (current.preferred_sports.includes(sportName)) return current;
      if (current.preferred_sports.length >= 6) {
        alert("선호 종목은 최대 6개까지만 선택할 수 있습니다.");
        return current;
      }
      return {
        ...current,
        preferred_sports: [...current.preferred_sports, sportName],
        preferred_sport_levels: {
          ...current.preferred_sport_levels,
          [sportName]: current.preferred_sport_levels[sportName] || current.exercise_level
        }
      };
    });
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

  const updateSportLevel = (sportName, level) => {
    setForm((current) => ({
      ...current,
      preferred_sport_levels: {
        ...current.preferred_sport_levels,
        [sportName]: level
      }
    }));
  };

  const updatePassword = (key, value) => {
    if (passwordCloseTimerRef.current) {
      window.clearTimeout(passwordCloseTimerRef.current);
      passwordCloseTimerRef.current = null;
    }
    setPasswordStatus("idle");
    setPasswordMessage("");
    setPasswordForm((current) => ({ ...current, [key]: value }));
  };

  const closePasswordModal = () => {
    if (passwordSaving) return;
    if (passwordCloseTimerRef.current) {
      window.clearTimeout(passwordCloseTimerRef.current);
      passwordCloseTimerRef.current = null;
    }
    setPasswordModalOpen(false);
    setPasswordForm({ current: "", next: "", confirm: "" });
    setPasswordStatus("idle");
    setPasswordMessage("");
  };

  const submitPasswordChange = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      setPasswordStatus("empty");
      setPasswordMessage("모든 비밀번호 항목을 입력해주세요.");
      return;
    }
    if (!isValidPassword(passwordForm.next)) {
      setPasswordStatus("invalid");
      setPasswordMessage("비밀번호는 8자 이상이며 영문 대문자, 영문 소문자, 숫자, 특수문자를 모두 포함해야 합니다.");
      return;
    }
    if (passwordForm.next !== passwordForm.confirm) {
      setPasswordStatus("mismatch");
      setPasswordMessage("새 비밀번호와 확인 값이 일치하지 않습니다.");
      return;
    }
    if (passwordForm.current === passwordForm.next) {
      setPasswordStatus("invalid");
      setPasswordMessage("현재 비밀번호와 다른 새 비밀번호를 입력해주세요.");
      return;
    }
    if (!isSupabaseConfigured || !supabase) {
      setPasswordStatus("error");
      setPasswordMessage("인증 서비스 설정을 확인해주세요.");
      return;
    }

    setPasswordSaving(true);
    setPasswordStatus("idle");
    setPasswordMessage("");
    try {
      const email = loadedUser?.email || user?.email || "";
      if (!email) {
        setPasswordStatus("error");
        setPasswordMessage("계정 이메일 정보를 확인할 수 없습니다.");
        return;
      }
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: passwordForm.current
      });
      if (signInError) {
        setPasswordStatus("error");
        setPasswordMessage("현재 비밀번호가 올바르지 않습니다.");
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: passwordForm.next });
      if (updateError) throw updateError;

      setPasswordStatus("success");
      setPasswordMessage("비밀번호가 변경되었습니다.");
      setPasswordForm({ current: "", next: "", confirm: "" });
      passwordCloseTimerRef.current = window.setTimeout(() => {
        setPasswordModalOpen(false);
        setPasswordStatus("idle");
        setPasswordMessage("");
        passwordCloseTimerRef.current = null;
      }, 1000);
    } catch (error) {
      const message = error?.message || "";
      setPasswordStatus("error");
      setPasswordMessage(
        message.includes("New password should be different from the old password")
          ? "현재 비밀번호와 다른 새 비밀번호를 입력해주세요."
          : "비밀번호 변경에 실패했습니다. 잠시 후 다시 시도해주세요."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const submitWithdraw = () => {
    if (withdrawText.trim() !== "탈퇴합니다") {
      setWithdrawStatus("mismatch");
      return;
    }
    setWithdrawStatus("success");
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaveError("");

    if (!loadedUser) {
      navigate("/mypage");
      return;
    }

    if (!backendTokenReady) {
      setSaveError("로그인 동기화가 완료된 뒤 다시 시도해주세요.");
      return;
    }

    setSaving(true);
    try {
      // 2026-07-01: PC 프로필 수정 저장을 백엔드 users/me PATCH와 연결.
      const data = await userApi.updateMe({
        name: form.name,
        nickname: form.nickname.trim(),
        profile_image_url: form.profile_image_url,
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
      setCurrentUser?.(data.user);
      navigate("/mypage");
    } catch (error) {
      setSaveError(error?.response?.data?.message || "프로필 저장에 실패했습니다.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="desktop-profile-edit" onSubmit={submit}>
      <div className="screen-title desktop-profile-edit__title">
        <div>
          <h1>프로필 수정</h1>
          <span>내 정보를 표시할 기본 정보와 운동 성향을 정리합니다.</span>
        </div>
        <div>
          <Link className="ghost-btn" to="/mypage">취소</Link>
          <button className="primary-small" type="submit" disabled={saving || loading}>
            {saving ? "저장 중..." : <><Check size={15} />저장</>}
          </button>
        </div>
      </div>

      {loadError && <p className="profile-setup__error">{loadError}</p>}
      {saveError && <p className="profile-setup__error">{saveError}</p>}

      <section className="page-card desktop-profile-top-card">
        <div className="section-head">
          <h2>기본 정보</h2>
        </div>
        <div className="desktop-profile-top-content">
          <div className="desktop-profile-preview">
            <img src={form.profile_image_url || "/images/logo.png"} alt="프로필 미리보기" />
            <h2>{form.nickname || "닉네임"}</h2>
            {displayTag && <span className="profile-user-tag desktop-profile-preview-tag">{displayTag}</span>}
            <p>{savedIntro}</p>
          </div>

          <div className="desktop-profile-basic-panel">
            <div className="desktop-profile-form-grid desktop-basic-info-grid">
              <label>
                이름
                <div className="desktop-basic-action-row">
                  <span className="desktop-readonly-field">{form.name || "미입력"}</span>
                  <span aria-hidden="true" />
                </div>
              </label>
              <label>
                이메일
                <div className="desktop-basic-action-row">
                  <span className="desktop-readonly-field">{form.email || "미입력"}</span>
                  <span aria-hidden="true" />
                </div>
              </label>
              <div className="desktop-nickname-tag-row">
                <label>
                  닉네임
                  <span className="desktop-edit-input desktop-edit-input--counted">
                    <input maxLength={NICKNAME_MAX_LENGTH} value={form.nickname} onChange={(event) => updateNickname(event.target.value)} />
                    <em>{form.nickname.length}/{NICKNAME_MAX_LENGTH}</em>
                    <Pencil size={15} />
                  </span>
                </label>
                <label>
                  고유 태그
                  {/* 2026-07-01: 고유 태그는 닉네임 식별 보조 정보라 닉네임 옆의 읽기 전용 필드로 표시. */}
                  <span className="desktop-nickname-tag">{displayTag || "태그 없음"}</span>
                </label>
              </div>
              <label>
                핸드폰 번호
                <div className="desktop-basic-action-row">
                  {/* 2026-07-01: 휴대폰 인증 정책 확정 전까지 번호는 읽기 전용으로만 표시. */}
                  <span className="desktop-readonly-field">{form.phone_number || "미입력"}</span>
                  <span aria-hidden="true" />
                </div>
              </label>
            </div>
          </div>
        </div>
      </section>

      <section className="page-card desktop-profile-edit-panel">
        <div className="section-head">
          <div>
            <h2>선호 지역</h2>
            <span>장소명이나 지역명을 검색하고 지도 위치를 확인해 최대 2개까지 추가할 수 있습니다.</span>
          </div>
        </div>
        <div className="desktop-region-picker">
          <label className="desktop-region-search-field">
            장소 또는 주소 검색
            <span className="desktop-region-search-box">
              <Search size={16} />
              <input
                value={regionQuery}
                placeholder="활동하고 싶은 지역이나 장소를 검색해보세요"
                onChange={(event) => setRegionQuery(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && (event.preventDefault(), searchRegion())}
              />
            </span>
          </label>
          <button className="primary-small" type="button" onClick={searchRegion} disabled={regionSearching}>
            {regionSearching ? "검색 중" : "검색"}
          </button>
        </div>
        {regionMessage && <em className="nickname-check warn">{regionMessage}</em>}
        <div className="desktop-region-selected">
          {form.selected_regions.length ? form.selected_regions.map((regionName) => (
            <button key={regionName} type="button" onClick={() => removeRegion(regionName)}>
              {regionName}
              <X size={14} />
            </button>
          )) : <span>선택된 선호지역이 없습니다.</span>}
          <em>{selectedLocationCount}/{MAX_PREFERRED_REGIONS}</em>
        </div>
        <div className="desktop-region-candidate">
          <span>
            <MapPin size={15} />
            <strong>현재 선택</strong>
            <em>{candidateNotice}</em>
          </span>
          <button
            className="desktop-region-add-button"
            type="button"
            disabled={!selectedRegionCandidate || selectedLocationCount >= MAX_PREFERRED_REGIONS}
            onClick={() => selectedRegionCandidate && addRegion(selectedRegionCandidate)}
          >
            <Plus size={16} />
            추가
          </button>
        </div>
        <div className="desktop-region-workspace">
          <div className="desktop-region-results">
            {regionResults.length ? regionResults.map((location) => {
              const isSelected = selectedRegionCandidate?.id === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  className={isSelected ? "is-selected" : ""}
                  onClick={() => selectRegionCandidate(location)}
                >
                  <MapPin size={15} />
                  <span>
                    <strong>{location.name}</strong>
                    <small>{location.address || location.region}</small>
                  </span>
                  <em>{location.category}</em>
                </button>
              );
            }) : (
              <div className="desktop-region-empty">
                <Search size={18} />
                <span>검색 결과가 여기에 표시됩니다.</span>
              </div>
            )}
          </div>
          <div className="desktop-profile-map-shell">
            <ProfilePreferredLocationMap
              clientId={mapClientId}
              selectedLocation={mapLocation}
              results={regionResults}
              onSelect={selectRegionCandidate}
            />
            <div className="map-current-label"><MapPin size={15} />{pendingRegion}</div>
            {mapLocation ? (
              <div className="desktop-map-place-card">
                <strong>{mapLocation.name}</strong>
                <span>{mapLocation.address || mapLocation.region}</span>
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="page-card desktop-profile-edit-panel">
        <div className="section-head">
          <h2>운동 설정</h2>
        </div>
        <div className="desktop-level-field">
          <span className="desktop-subsection-title">기본 운동 수준</span>
          <div className="desktop-level-segment" role="radiogroup" aria-label="기본 운동 수준">
            {levelOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={form.exercise_level === option.value}
                className={form.exercise_level === option.value ? "is-active" : ""}
                onClick={() => update("exercise_level", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="desktop-profile-sport-section">
          <div className="desktop-profile-sport-head">
            <span className="desktop-subsection-title">관심 종목</span>
            <em>{form.preferred_sports.length}개 선택</em>
          </div>
          <div className="desktop-sport-select-row">
            <label>
              대분류
              <select
                value={activeCategoryId}
                onChange={(event) => setActiveCategoryId(event.target.value)}
              >
                {sportCategoryGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </label>
            <span>대분류를 선택하면 아래에서 종목을 바로 고를 수 있습니다.</span>
          </div>
          <div className="desktop-profile-sport-grid" aria-label={`${activeSportGroup?.name || "선택한 대분류"} 종목`}>
            {selectableSports.map((sportName) => {
              const selected = form.preferred_sports.includes(sportName);
              return (
                <button
                  key={sportName}
                  className={selected ? "is-active" : ""}
                  type="button"
                  onClick={() => (selected ? removeSport(sportName) : addSelectedSport(sportName))}
                >
                  {sportName}
                </button>
              );
            })}
          </div>
          <div className="desktop-profile-sport-tags">
            {form.preferred_sports.length ? form.preferred_sports.map((sportName) => {
              const levelLabel = levelOptions.find((option) => option.value === (form.preferred_sport_levels[sportName] || form.exercise_level))?.label;
              return (
                <button key={sportName} type="button" onClick={() => removeSport(sportName)}>
                  {sportName}{useSportLevels && levelLabel ? `:${levelLabel}` : ""}
                  <X size={14} />
                </button>
              );
            }) : <span>선택한 종목이 없습니다.</span>}
          </div>
        </div>
        <label className="desktop-sport-level-toggle">
          <input
            type="checkbox"
            checked={useSportLevels}
            onChange={(event) => setUseSportLevels(event.target.checked)}
          />
          <span>종목별 수준 선택하기</span>
        </label>
        {useSportLevels && form.preferred_sports.length > 0 && (
          <>
            <span className="desktop-subsection-title">선택한 종목별 수준</span>
            <div className="desktop-profile-selected-sports">
              {form.preferred_sports.map((sportName) => (
                <div key={sportName}>
                  <button type="button" onClick={() => removeSport(sportName)}>
                    {sportName}
                    <X size={14} />
                  </button>
                  <select
                    aria-label={`${sportName} 운동 수준`}
                    value={form.preferred_sport_levels[sportName] || form.exercise_level}
                    onChange={(event) => updateSportLevel(sportName, event.target.value)}
                  >
                    {levelOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section className="page-card desktop-profile-edit-panel desktop-account-security-panel">
        <div className="section-head">
          <h2>계정 보안</h2>
        </div>
        <div className="desktop-security-section">
          <span>
            <strong>비밀번호</strong>
            <small>현재 비밀번호 확인 후 새 비밀번호로 변경합니다.</small>
          </span>
          <button type="button" onClick={() => setPasswordModalOpen(true)}>비밀번호 변경</button>
        </div>
        <div className="desktop-security-section desktop-security-section--danger">
          <span>
            <strong>회원 탈퇴</strong>
            <small>회원 탈퇴는 백엔드 API 연결 후 처리됩니다.</small>
          </span>
          <button type="button" onClick={() => setWithdrawModalOpen(true)}>회원 탈퇴</button>
        </div>
      </section>

      {passwordModalOpen && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && closePasswordModal()}>
          <section className="profile-auth-modal password-change-modal">
            <button className="schedule-modal-close" type="button" onClick={closePasswordModal} disabled={passwordSaving}><X size={18} /></button>
            <h2>비밀번호 변경</h2>
            <p>회원가입과 같은 기준으로 새 비밀번호를 설정합니다.</p>
            <label>
              현재 비밀번호
              <span className="password-change-input">
                <LockKeyhole size={17} />
                <input type="password" value={passwordForm.current} onChange={(event) => updatePassword("current", event.target.value)} autoComplete="current-password" />
              </span>
            </label>
            <label>
              새 비밀번호
              <span className="password-change-input">
                <LockKeyhole size={17} />
                <input type="password" minLength="8" value={passwordForm.next} onChange={(event) => updatePassword("next", event.target.value)} placeholder="대소문자, 숫자, 특수문자 포함" autoComplete="new-password" />
              </span>
            </label>
            <section className={`desktop-auth-password-meter desktop-auth-password-meter--${newPasswordStrength.level}`}>
              <div className="desktop-auth-password-meter__head">
                <strong>비밀번호 안전도</strong>
                <span>{newPasswordStrength.label}</span>
              </div>
              <div className="desktop-auth-password-meter__bar" aria-hidden="true">
                <i style={{ width: `${newPasswordStrength.percent}%` }} />
              </div>
              <ul className="desktop-auth-password-rules">
                {newPasswordChecks.map((item) => (
                  <li key={item.id} className={item.passed ? "is-passed" : ""}>
                    {item.passed ? <CheckCircle2 size={15} /> : <CircleAlert size={15} />}
                    {item.label}
                  </li>
                ))}
              </ul>
            </section>
            <label>
              새 비밀번호 확인
              <span className={`password-change-input ${hasPasswordConfirm ? (passwordMatches ? "is-valid" : "is-invalid") : ""}`}>
                <LockKeyhole size={17} />
                <input type="password" minLength="8" value={passwordForm.confirm} onChange={(event) => updatePassword("confirm", event.target.value)} placeholder="비밀번호를 한 번 더 입력" autoComplete="new-password" />
              </span>
            </label>
            {hasPasswordConfirm ? (
              <p className={`desktop-auth-match ${passwordMatches ? "is-valid" : "is-invalid"}`}>
                {passwordMatches ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {passwordMatches ? "비밀번호가 일치합니다." : "비밀번호가 일치하지 않습니다."}
              </p>
            ) : null}
            {passwordMessage ? <em className={`nickname-check ${passwordStatus === "success" ? "ok" : "warn"}`}>{passwordMessage}</em> : null}
            <div className="profile-auth-actions">
              <button className="ghost-btn" type="button" onClick={closePasswordModal} disabled={passwordSaving}>취소</button>
              <button className="primary-small" type="button" onClick={submitPasswordChange} disabled={passwordSaving}>
                {passwordSaving ? "변경 중..." : "변경하기"}
              </button>
            </div>
          </section>
        </div>
      )}

      {withdrawModalOpen && (
        <div className="profile-auth-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setWithdrawModalOpen(false)}>
          <section className="profile-auth-modal password-change-modal">
            <button className="schedule-modal-close" type="button" onClick={() => setWithdrawModalOpen(false)}><X size={18} /></button>
            <h2>회원 탈퇴</h2>
            <p>회원 탈퇴는 아직 백엔드 API가 없어 화면 흐름만 확인할 수 있습니다.</p>
            <label>
              확인 문구
              <input
                value={withdrawText}
                placeholder="탈퇴합니다"
                onChange={(event) => {
                  setWithdrawText(event.target.value);
                  setWithdrawStatus("idle");
                }}
              />
            </label>
            {withdrawStatus === "mismatch" && <em className="nickname-check warn">확인 문구를 정확히 입력해주세요.</em>}
            {withdrawStatus === "success" && <em className="nickname-check ok">회원 탈퇴 확인 흐름이 완료되었습니다.</em>}
            <div className="profile-auth-actions">
              <button className="ghost-btn" type="button" onClick={() => setWithdrawModalOpen(false)}>취소</button>
              <button className="primary-small danger-small" type="button" onClick={submitWithdraw}>탈퇴 확인</button>
            </div>
          </section>
        </div>
      )}
    </form>
  );
}

export default DesktopProfileEdit;
