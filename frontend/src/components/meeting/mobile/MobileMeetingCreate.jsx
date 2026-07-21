import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import { AlarmClock, CalendarClock, ChevronLeft, ChevronRight, MapPin, Map as MapIcon, Search } from "lucide-react";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { locationApi } from "../../../api/locationApi";
import { useAsync } from "../../../hooks/useAsync";

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

const ADMIN_REGION_PATTERN = /(특별시|광역시|특별자치시|도|시|군|구|읍|면|동|리)$/;
const normalizePlaceText = (value) => (value || "").replace(/<[^>]+>/g, "").trim();
const isAdministrativeRegion = (place) => {
  const title = normalizePlaceText(place?.title || place?.address || place?.road_address);
  const category = normalizePlaceText(place?.category);
  return category === "주소" && ADMIN_REGION_PATTERN.test(title.split(/\s+/).at(-1) || title);
};

function MobileLocationMap({ clientId, selectedLocation, results, onSelect }) {
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
            style: maps.ZoomControlStyle.SMALL,
          },
        });
        maps.Event.addListener(mapRef.current, "click", (event) => {
          onSelect({
            source: "map-click",
            latitude: event.coord.lat(),
            longitude: event.coord.lng(),
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

  if (!clientId) return null;

  return (
    <div style={{ width: '100%', marginTop: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
      <div style={{ padding: '8px 12px', background: '#f8fafc', fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid #e2e8f0' }}>
        <MapIcon size={14} /> 지도에서 클릭하여 위치 지정 가능
      </div>
      <div ref={mapElementRef} style={{ width: '100%', height: '240px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {mapStatus === "loading" && <span style={{ fontSize: '14px', color: '#64748b' }}>지도를 불러오는 중입니다.</span>}
        {mapStatus === "error" && <span style={{ fontSize: '14px', color: '#ef4444' }}>지도를 불러오지 못했습니다.</span>}
      </div>
    </div>
  );
}

const TITLE_MAX_LENGTH = 40;
const CUSTOM_PURPOSE = "custom";
const DEFAULT_PURPOSE_OPTIONS = ["운동 메이트 모집", "팀 모집", "파트너 모집", "동행 모집", "친선전"];

const TIME_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

const REPEAT_DAYS = [
  { label: "월", value: "MO" },
  { label: "화", value: "TU" },
  { label: "수", value: "WE" },
  { label: "목", value: "TH" },
  { label: "금", value: "FR" },
  { label: "토", value: "SA" },
  { label: "일", value: "SU" },
];

const WEEKDAY_LABELS = ["\uc77c", "\uc6d4", "\ud654", "\uc218", "\ubaa9", "\uae08", "\ud1a0"];
const padDatePart = (value) => String(value).padStart(2, "0");
const formatDateValue = (date) => `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
const parseDateValue = (value) => {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};
const getMonthDays = (date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const lastDate = new Date(year, month + 1, 0).getDate();
  return [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: lastDate }, (_, index) => new Date(year, month, index + 1)),
  ];
};
const displayDateValue = (value) => {
  const date = parseDateValue(value);
  if (!date) return "\ub0a0\uc9dc \uc120\ud0dd";
  return `${date.getFullYear()}\ub144 ${date.getMonth() + 1}\uc6d4 ${date.getDate()}\uc77c`;
};

function CalendarSelect({ value, onChange, min, icon, label }) {
  const selectedDate = parseDateValue(value);
  const minDate = parseDateValue(min);
  const baseDate = selectedDate || minDate || new Date();
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(new Date(baseDate.getFullYear(), baseDate.getMonth(), 1));
  const monthDays = getMonthDays(viewDate);
  const selectDate = (date) => {
    if (!date) return;
    if (minDate && date < minDate) return;
    onChange(formatDateValue(date));
    setOpen(false);
  };
  const moveMonth = (amount) => setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + amount, 1));

  return (
    <span className="meeting-calendar-field">
      <button type="button" className="meeting-calendar-trigger" onClick={() => setOpen((current) => !current)} aria-label={label}>
        {icon}
        <span>{displayDateValue(value)}</span>
      </button>
      {open && (
        <div className="meeting-calendar-popover">
          <div className="meeting-calendar-head">
            <button type="button" onClick={() => moveMonth(-1)} aria-label={"이전 달"}><ChevronLeft size={18} /></button>
            <strong>{viewDate.getFullYear()}{"년"} {viewDate.getMonth() + 1}{"월"}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label={"다음 달"}><ChevronRight size={18} /></button>
          </div>
          <div className="meeting-calendar-weekdays">
            {WEEKDAY_LABELS.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="meeting-calendar-days">
            {monthDays.map((date, index) => {
              const dateValue = date ? formatDateValue(date) : `blank-${index}`;
              const disabled = Boolean(date && minDate && date < minDate);
              const selected = Boolean(date && value === dateValue);
              return (
                <button type="button" key={dateValue} disabled={!date || disabled} className={selected ? "selected" : ""} onClick={() => selectDate(date)}>
                  {date ? date.getDate() : ""}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </span>
  );
}


const splitTimeValue = (value) => {
  if (!value) return { period: "AM", hour: "", minute: "00" };
  const [rawHour, minute = "00"] = value.split(":");
  const hour24 = Number(rawHour);
  const period = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return { period, hour: String(hour12).padStart(2, "0"), minute };
};

const buildTimeValue = ({ period, hour, minute }) => {
  if (!hour) return "";
  const hourNumber = Number(hour);
  const hour24 = period === "PM" ? (hourNumber === 12 ? 12 : hourNumber + 12) : (hourNumber === 12 ? 0 : hourNumber);
  return `${String(hour24).padStart(2, "0")}:${minute}`;
};

function TimeSelect({ value, onChange, required = false }) {
  const [localParts, setLocalParts] = useState(() => splitTimeValue(value));

  useEffect(() => {
    setLocalParts(splitTimeValue(value));
  }, [value]);

  const changePart = (key, nextValue) => {
    const nextParts = { ...localParts, [key]: nextValue };
    setLocalParts(nextParts);
    const nextTime = buildTimeValue(nextParts);
    if (nextTime) {
      onChange(nextTime);
    }
  };

  return (
    <span className="meeting-time-select" data-required={required ? "true" : "false"}>
      <select aria-label={"오전 오후"} value={localParts.period} onChange={(event) => changePart("period", event.target.value)}>
        <option value="AM">{"오전"}</option>
        <option value="PM">{"오후"}</option>
      </select>
      <select aria-label={"시"} value={localParts.hour} onChange={(event) => changePart("hour", event.target.value)}>
        <option value="">{"시"}</option>
        {TIME_HOURS.map((hour) => <option key={hour} value={hour}>{Number(hour)}</option>)}
      </select>
      <select aria-label={"분"} value={localParts.minute} onChange={(event) => changePart("minute", event.target.value)}>
        {TIME_MINUTES.map((minute) => <option key={minute} value={minute}>{minute}</option>)}
      </select>
    </span>
  );
}

const initialForm = {
  category_id: "",
  sport_id: "",
  title: "",
  description: "",
  meeting_type: "one_time",
  purpose: "운동 메이트 모집",
  location_name: "",
  address: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  repeat_days: [],
  max_participants: 6
};

const fallbackSportGroups = [
  { category: { id: "fallback-ball", name: "구기 종목", purpose: "팀 모집 / 친선전" }, sports: ["축구", "풋살", "농구", "배구", "야구", "족구"] },
  { category: { id: "fallback-racket", name: "라켓 스포츠", purpose: "파트너 모집 / 친선전" }, sports: ["배드민턴", "탁구", "테니스", "스쿼시"] },
  { category: { id: "fallback-fitness", name: "피트니스", purpose: "파트너 모집 / 운동 메이트 모집" }, sports: ["헬스", "크로스핏", "클라이밍", "요가", "필라테스"] },
  { category: { id: "fallback-etc", name: "기타", purpose: "파트너 모집" }, sports: ["볼링", "당구", "골프", "수영"] }
];

const fallbackCategories = fallbackSportGroups.map((group) => group.category);
const fallbackSports = fallbackSportGroups.flatMap((group) => group.sports.map((name, index) => ({ id: `${group.category.id}-${index}`, name, category_id: group.category.id })));
const mergeSportCategories = (items = []) => {
  const merged = [...items];
  fallbackCategories.forEach((fallback) => {
    if (!merged.some((category) => category.name === fallback.name)) {
      merged.push(fallback);
    }
  });
  return merged;
};
const findFallbackGroup = (category) => {
  if (!category) return fallbackSportGroups[0];
  return fallbackSportGroups.find((group) => group.category.name === category.name || group.category.name.includes(category.name) || category.name.includes(group.category.name)) || fallbackSportGroups[0];
};
const pad = (value) => String(value).padStart(2, "0");
const toDateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const toTimeInputValue = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const combineDateTime = (date, time) => date && time ? `${date}T${time}` : "";
const isNumericId = (value) => /^\d+$/.test(String(value || ""));
const uniqueValues = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

function MobileMeetingCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [locationKeyword, setLocationKeyword] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationScope, setLocationScope] = useState("");
  const [mapClientId, setMapClientId] = useState("");
  
  const locationSearchRequestRef = useRef(0);
  const selectedLocationKeywordRef = useRef("");
  const locationReverseRequestRef = useRef(0);

  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [purposeMode, setPurposeMode] = useState(initialForm.purpose);
  const [hasStartSchedule, setHasStartSchedule] = useState(true);
  const [hasEndSchedule, setHasEndSchedule] = useState(false);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(() => sportApi.sports(isNumericId(form.category_id) ? { category_id: form.category_id } : {}), [form.category_id]);
  const today = toDateInputValue(new Date());
  const nowTime = toTimeInputValue(new Date());
  
  const displayCategories = useMemo(() => mergeSportCategories(categories.data?.items || []), [categories.data?.items]);
  const displaySports = useMemo(() => {
    if (!form.category_id) return [];
    const currentSports = sports.data?.items || [];
    const matchedSports = currentSports.filter((sport) => String(sport.category_id) === String(form.category_id));
    const category = displayCategories.find((item) => String(item.id) === String(form.category_id));
    const fallbackGroup = findFallbackGroup(category);
    const mergedSports = [...matchedSports];
    fallbackGroup.sports.forEach((name, index) => {
      if (!mergedSports.some((sport) => sport.name === name)) {
        mergedSports.push({ id: `${fallbackGroup.category.id}-${index}`, name, category_id: fallbackGroup.category.id });
      }
    });
    return mergedSports;
  }, [displayCategories, form.category_id, sports.data?.items]);
  const usingFallbackSports = !displaySports.some((sport) => isNumericId(sport.id) && String(sport.category_id) === String(form.category_id));
  const selectedCategory = useMemo(() => displayCategories.find((category) => String(category.id) === String(form.category_id)), [displayCategories, form.category_id]);
  const purposeOptions = useMemo(() => uniqueValues([...(selectedCategory?.purpose?.split("/") || []), ...DEFAULT_PURPOSE_OPTIONS]), [selectedCategory?.purpose]);

  const [maxLimit, setMaxLimit] = useState(6);

  useEffect(() => {
    locationApi.mapConfig()
      .then((data) => setMapClientId(data.naver_dynamic_map_client_id || ""))
      .catch(() => setMapClientId(""));

    meetingApi.getConfig()
      .then((data) => {
        if (data && data.defaultMaxParticipants) {
          setMaxLimit(data.defaultMaxParticipants);
        }
      })
      .catch((err) => console.error("Failed to load meeting config", err));
  }, []);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  // Remove auto-selection of first sport to keep placeholder
  useEffect(() => {
    if (displaySports.length > 0 && form.sport_id && !displaySports.some((sport) => String(sport.id) === String(form.sport_id))) {
      setForm((prev) => ({ ...prev, sport_id: "" }));
    }
  }, [displaySports, form.sport_id]);

  useEffect(() => {
    const keyword = locationKeyword.trim();
    if (!keyword || selectedLocationKeywordRef.current === keyword) {
      setLocationResults([]);
      setLocationLoading(false);
      return;
    }
    const scopedKeyword = locationScope && !keyword.startsWith(locationScope) ? `${locationScope} ${keyword}` : keyword;
    const requestId = locationSearchRequestRef.current + 1;
    locationSearchRequestRef.current = requestId;
    const timer = window.setTimeout(() => {
      setLocationLoading(true);
      locationApi.searchPlaces({ keyword: scopedKeyword, size: 8 })
        .then((data) => {
          if (locationSearchRequestRef.current !== requestId || selectedLocationKeywordRef.current === keyword) return;
          setLocationResults(data.items || []);
        })
        .catch(() => {
          if (locationSearchRequestRef.current === requestId) setLocationResults([]);
        })
        .finally(() => {
          if (locationSearchRequestRef.current === requestId) setLocationLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [locationKeyword, locationScope]);

  const updateCategory = (categoryId) => {
    const category = displayCategories.find((item) => String(item.id) === String(categoryId));
    const firstPurpose = category?.purpose?.split("/")?.[0]?.trim() || initialForm.purpose;
    setPurposeMode(firstPurpose);
    setForm((prev) => ({ ...prev, category_id: categoryId, sport_id: "", purpose: firstPurpose }));
  };

  const updatePurposeMode = (value) => {
    setPurposeMode(value);
    update("purpose", value === CUSTOM_PURPOSE ? "" : value);
  };

  const selectLocation = useCallback(async (place) => {
    if (place.source === "map-click") {
      const requestId = locationReverseRequestRef.current + 1;
      locationReverseRequestRef.current = requestId;
      const latitude = place.latitude;
      const longitude = place.longitude;
      selectedLocationKeywordRef.current = "지도에서 선택한 위치";
      locationSearchRequestRef.current += 1;
      setLocationScope("");
      setLocationResults([]);
      setLocationLoading(false);
      setLocationKeyword("지도에서 선택한 위치");
      setForm((prev) => ({
        ...prev,
        location_name: "주소 확인 중",
        address: "지도에서 선택한 위치의 주소를 확인하고 있습니다.",
        latitude,
        longitude
      }));

      try {
        const data = await locationApi.reverseGeocode({ latitude, longitude });
        const item = data.item || {};
        const title = normalizePlaceText(item.title) || item.address || "지도에서 선택한 위치";
        const address = item.address || item.road_address || title;
        if (locationReverseRequestRef.current !== requestId) return;
        selectedLocationKeywordRef.current = address;
        setForm((prev) => ({
          ...prev,
          location_name: title,
          address,
          latitude,
          longitude
        }));
        setLocationKeyword(address);
      } catch {
        if (locationReverseRequestRef.current !== requestId) return;
        setForm((prev) => ({
          ...prev,
          location_name: "지도에서 선택한 위치",
          address: `위도 ${Number(latitude).toFixed(6)}, 경도 ${Number(longitude).toFixed(6)}`,
          latitude,
          longitude
        }));
      }
      return;
    }

    const title = normalizePlaceText(place.title);
    const address = place.address || place.road_address || title;
    if (isAdministrativeRegion(place)) {
      const scope = address || title;
      selectedLocationKeywordRef.current = "";
      locationSearchRequestRef.current += 1;
      setLocationScope(scope);
      setLocationKeyword("");
      setLocationResults([]);
      setLocationLoading(false);
      setForm((prev) => ({ ...prev, location_name: "", address: scope, latitude: undefined, longitude: undefined }));
      return;
    }
    selectedLocationKeywordRef.current = address;
    locationSearchRequestRef.current += 1;
    setLocationScope("");
    setForm((prev) => ({ ...prev, location_name: title || address, address, latitude: place.latitude, longitude: place.longitude }));
    setLocationKeyword(address);
    setLocationResults([]);
    setLocationLoading(false);
  }, []);

  const toggleStartSchedule = (checked) => {
    setHasStartSchedule(checked);
    if (!checked) {
      setHasEndSchedule(false);
      setForm((prev) => ({ ...prev, start_date: "", start_time: "", end_date: "", end_time: "", meeting_type: "regular" }));
    }
  };

  const toggleEndSchedule = (checked) => {
    setHasEndSchedule(checked);
    if (!checked) setForm((prev) => ({ ...prev, end_date: "", end_time: "" }));
  };

  const updateStartDate = (value) => {
    setForm((prev) => {
      const nextForm = { ...prev, start_date: value };
      if (prev.meeting_type === "regular" && value) {
        const dateObj = new Date(value);
        if (!isNaN(dateObj.getTime())) {
          const dayIndex = dateObj.getDay(); // 0(Sun) ~ 6(Sat)
          const daysOfWeek = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
          const selectedDay = daysOfWeek[dayIndex];
          if (!prev.repeat_days.includes(selectedDay)) {
            nextForm.repeat_days = [...prev.repeat_days, selectedDay];
          }
        }
      }
      return nextForm;
    });
  };
  const updateStartTime = (value) => setForm((prev) => ({ 
    ...prev, 
    start_time: value 
  }));

  const updateEndDate = (value) => setForm((prev) => ({
    ...prev,
    end_date: value,
  }));

  const updateEndTime = (value) => setForm((prev) => ({
    ...prev,
    end_time: value,
  }));

  const updateTitle = (value) => update("title", value.slice(0, TITLE_MAX_LENGTH));

  const scheduleError = (() => {
    if (hasStartSchedule) {
      if (form.start_date && form.start_date < today) {
        return "과거 날짜는 선택할 수 없습니다.";
      }
      if (form.start_date === today && form.start_time && form.start_time < nowTime) {
        return "과거 시간은 선택할 수 없습니다.";
      }
    }
    if (hasStartSchedule && hasEndSchedule) {
      if (form.start_date && form.end_date) {
        if (form.end_date < form.start_date) {
          return "시작 날짜보다 전 날짜, 시간은 선택할 수 없습니다.";
        }
        if (form.end_date === form.start_date && form.start_time && form.end_time) {
          if (form.end_time <= form.start_time) {
            return "시작 날짜보다 전 날짜, 시간은 선택할 수 없습니다.";
          }
        }
      }
    }
    return "";
  })();

  const validateStep = (targetStep = step) => {
    const errors = {};
    if (targetStep === 1) {
      if (!form.category_id || !form.sport_id) errors.sport = "종목을 선택해주세요.";
      if (usingFallbackSports || !isNumericId(form.sport_id)) errors.sport = "종목 데이터가 아직 DB와 연결되지 않았습니다. 관리자에게 종목 데이터 등록을 요청해주세요.";
      if (!form.meeting_type || !form.purpose.trim()) errors.purpose = "모임 방식과 목적을 입력해주세요.";
    }
    if (targetStep === 2) {
      if (!form.title.trim()) errors.title = "모임 제목을 입력해주세요.";
      if (!form.description.trim()) errors.description = "모임 설명을 입력해주세요.";
    }
    if (targetStep === 3) {
      if (!form.address.trim()) errors.address = "주소를 검색해 장소를 선택해주세요.";
      if (!form.location_name.trim()) errors.location_name = "장소명을 입력해주세요.";
      
      if (form.meeting_type === "regular") {
        if (!form.repeat_days || form.repeat_days.length === 0) errors.repeat_days = "반복할 요일을 하나 이상 선택해주세요.";
      }
      
      if (hasStartSchedule) {
        if (!form.start_date) errors.start_date = "시작 날짜를 선택해주세요.";
        if (!form.start_time) errors.start_time = "시작 시간을 선택해주세요.";
      }
      
      if (hasEndSchedule) {
        if (!hasStartSchedule) errors.end_schedule = "종료 일정은 시작 일정이 있을 때만 설정할 수 있습니다.";
        if (!form.end_time) errors.end_time = "종료 시간을 선택해주세요.";
      }
      
      if (scheduleError) errors.schedule = scheduleError;
      
      if (Number(form.max_participants) < 2) errors.max_participants = "정원은 최소 2명 이상이어야 합니다.";
      if (Number(form.max_participants) > maxLimit) errors.max_participants = `개설 최대 정원은 ${maxLimit}명 이하로만 설정 가능합니다.`;
    }
    return errors;
  };

  const goNext = () => {
    const errors = validateStep(step);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setStep(step + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    const errors = validateStep(3);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      const isRegular = form.meeting_type === "regular";
      
      const payload = {
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        purpose: form.purpose.trim(),
        location_name: form.location_name.trim(),
        address: form.address.trim(),
        meeting_type: form.meeting_type,
        sport_id: Number(form.sport_id),
        max_participants: Number(form.max_participants)
      };

      if (isRegular) {
        payload.schedule_start_date = hasStartSchedule ? form.start_date : null;
        payload.schedule_end_date = hasEndSchedule ? (form.end_date || null) : null;
        payload.start_time = hasStartSchedule ? form.start_time : null;
        payload.end_time = hasEndSchedule ? form.end_time : null;
        payload.repeat_days = form.repeat_days;
      } else {
        payload.start_at = hasStartSchedule ? combineDateTime(form.start_date, form.start_time) : null;
        payload.end_at = hasEndSchedule ? combineDateTime(form.end_date, form.end_time) : null;
      }

      const data = await meetingApi.create(payload);
      navigate(`/meetings/${data.meeting.id}`, { state: { createdMeeting: true, chatRoomId: data.meeting.chat_room_id } });
    } catch (error) {
      setFormMessage(error.response?.data?.message || "모임을 등록하지 못했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <MobileHeader title="모임 만들기" />
      <form className="mobile-form" onSubmit={submit}>
        <div className="meeting-create-hero"><span>SportsMate</span><h1>{form.meeting_type === "regular" ? "정기 모임 만들기" : "일회성 모임 만들기"}</h1><p>운동 종목, 일정, 장소 정보를 순서대로 입력합니다.</p></div>
        <div className="form-progress"><span>단계 {step}/3</span><div aria-hidden="true">{[1, 2, 3].map((item) => <i key={item} className={item <= step ? "active" : ""} />)}</div></div>
        {formMessage && !formMessage.startsWith("_HIDDEN") ? <p className="mobile-form-message mobile-form-message--error">{formMessage}</p> : null}
        {step === 1 && <section>
          <label>카테고리<select value={form.category_id} onChange={(event) => updateCategory(event.target.value)}><option value="">카테고리 선택</option>{displayCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>종목<select required value={form.sport_id} onChange={(event) => update("sport_id", event.target.value)} disabled={!form.category_id}><option value="">종목 선택</option>{displaySports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
          {fieldErrors.sport && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.sport}</div>}
          {usingFallbackSports ? <p className="mobile-form-message">기본 종목 목록을 표시하고 있습니다. 실제 등록은 DB 종목 데이터가 연결된 뒤 가능합니다.</p> : null}
          <div className="meeting-type-segment" role="group" aria-label="모임 방식"><button type="button" className={form.meeting_type === "one_time" ? "active" : ""} onClick={() => update("meeting_type", "one_time")}>일회성 모임</button><button type="button" className={form.meeting_type === "regular" ? "active" : ""} onClick={() => update("meeting_type", "regular")}>정기 모임</button></div>
          <label>모집 목적<select value={purposeMode} onChange={(event) => updatePurposeMode(event.target.value)}>{purposeOptions.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}<option value={CUSTOM_PURPOSE}>기타</option></select></label>
          {purposeMode === CUSTOM_PURPOSE && <label>기타 모집 목적<input value={form.purpose} onChange={(event) => update("purpose", event.target.value.slice(0, 30))} /></label>}
          {fieldErrors.purpose && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.purpose}</div>}
        </section>}
        {step === 2 && <section>
          <label><span className="desktop-field-label-row">제목<em>{form.title.length}/{TITLE_MAX_LENGTH}</em></span><input required maxLength={TITLE_MAX_LENGTH} value={form.title} onChange={(event) => updateTitle(event.target.value)} /></label>
          {fieldErrors.title && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.title}</div>}
          <label style={{ marginTop: '16px' }}>설명<textarea required value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          {fieldErrors.description && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.description}</div>}
        </section>}
        {step === 3 && <section>
          <label>모임 장소 검색<span className="mobile-icon-input"><Search size={17} /><input type="text" value={locationKeyword} onChange={(event) => { selectedLocationKeywordRef.current = ""; setLocationKeyword(event.target.value); setLocationScope(""); setForm((prev) => ({ ...prev, address: event.target.value, location_name: "", latitude: undefined, longitude: undefined })); }} placeholder="검색할 주소나 장소명 입력 (예: 강남역, 올림픽공원)" /></span></label>
          {locationLoading && <div style={{ padding: '8px', fontSize: '13px', color: '#64748b' }}>검색 중...</div>}
          {locationResults.length > 0 && <div className="address-result-list" style={{ marginTop: '4px', marginBottom: '16px', background: '#f8fafc' }}>
            {locationResults.length === 0 && !locationLoading && selectedLocationKeywordRef.current !== locationKeyword.trim() ? (
              <div style={{ padding: '16px', fontSize: '14px', color: '#64748b', textAlign: 'center' }}>검색 결과가 없습니다.</div>
            ) : (
              locationResults.map((place, index) => {
                const isRegion = isAdministrativeRegion(place);
                const title = (place.title || "").replace(/<[^>]+>/g, "");
                return (
                  <button type="button" key={`${title}-${index}`} onClick={() => selectLocation(place)} style={{ width: '100%', textAlign: 'left', padding: '12px', borderBottom: '1px solid #f1f5f9', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                    <strong style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px', color: '#1e293b' }}>
                      {isRegion ? <MapIcon size={14} /> : <MapPin size={14} />} {title}
                    </strong>
                    <small style={{ display: 'block', marginTop: '4px', fontSize: '12px', color: '#64748b' }}>{place.address || place.road_address}</small>
                  </button>
                );
              })
            )}
          </div>}
          <label>선택된 장소명<input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} placeholder="검색 결과를 선택하면 장소명이 자동으로 입력됩니다." /></label>
          {fieldErrors.address && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.address}</div>}
          {fieldErrors.location_name && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.location_name}</div>}
          <MobileLocationMap clientId={mapClientId} selectedLocation={(form.location_name && !locationScope) ? form : null} results={locationResults} onSelect={selectLocation} />
          
          <div className="mobile-schedule-toggles" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '30px', width: '100%', marginBottom: '12px', marginTop: '24px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: 'auto', fontWeight: '600', flexDirection: 'row', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasStartSchedule} onChange={(event) => toggleStartSchedule(event.target.checked)} style={{ width: '20px', height: '20px', minHeight: '20px', accentColor: '#4f46e5', margin: 0, padding: 0, cursor: 'pointer' }} /> 
              시작 일정 있음
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', minHeight: 'auto', fontWeight: '600', flexDirection: 'row', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasEndSchedule} disabled={!hasStartSchedule} onChange={(event) => toggleEndSchedule(event.target.checked)} style={{ width: '20px', height: '20px', minHeight: '20px', accentColor: '#4f46e5', margin: 0, padding: 0, cursor: 'pointer' }} /> 
              종료 일정 있음
            </label>
          </div>
          {fieldErrors.end_schedule && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', textAlign: 'center' }}>{fieldErrors.end_schedule}</div>}

          {hasStartSchedule && (
            <div className="date-time-row" style={{ marginTop: '8px' }}>
              <label>{"시작일"}<CalendarSelect min={toDateInputValue(new Date())} label={"시작일"} value={form.start_date} onChange={updateStartDate} icon={<CalendarClock size={17} />} /></label>
              <label>{"시작 시간"}<TimeSelect required value={form.start_time} onChange={updateStartTime} /></label>
            </div>
          )}
          
          {hasEndSchedule && (
            <div className="date-time-row" style={{ marginTop: '8px' }}>
              <label>{"종료일"}<CalendarSelect min={form.start_date || toDateInputValue(new Date())} label={"종료일"} value={form.end_date} onChange={updateEndDate} icon={<CalendarClock size={17} />} /></label>
              <label>{"종료 시간"}<TimeSelect required value={form.end_time} onChange={updateEndTime} /></label>
            </div>
          )}

          {form.meeting_type === "regular" && (
            <div className="date-time-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              <label>반복 요일
                <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
                  {REPEAT_DAYS.map(day => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => {
                        setForm(prev => {
                          const days = prev.repeat_days || [];
                          return { ...prev, repeat_days: days.includes(day.value) ? days.filter(d => d !== day.value) : [...days, day.value] };
                        });
                      }}
                      style={{
                        flex: 1, padding: '8px 0', borderRadius: '8px', border: '1px solid #e2e8f0', 
                        background: (form.repeat_days || []).includes(day.value) ? '#4f46e5' : '#fff',
                        color: (form.repeat_days || []).includes(day.value) ? '#fff' : '#1e293b',
                        fontWeight: '600', fontSize: '14px', cursor: 'pointer'
                      }}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </label>
              {fieldErrors.repeat_days && <div style={{ color: '#ef4444', fontSize: '12px' }}>{fieldErrors.repeat_days}</div>}
            </div>
          )}
          <label>
            정원
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '6px' }}>
              <input type="number" min="2" max={maxLimit} value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} style={{ maxWidth: '120px', textAlign: 'center' }} />
              <span style={{ fontSize: '14px', color: '#64748b', fontWeight: '500' }}>명 (최소 2명 ~ 최대 {maxLimit}명)</span>
            </div>
          </label>
          {fieldErrors.max_participants && <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>{fieldErrors.max_participants}</div>}
        </section>}
        <div className="form-actions">{step > 1 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>이전</Button>}{step < 3 ? <Button type="button" onClick={goNext}>다음</Button> : <Button type="submit" disabled={submitting}>{submitting ? "등록 중..." : "모임 등록"}</Button>}</div>
      </form>
    </>
  );
}

export default MobileMeetingCreate;
