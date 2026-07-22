import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock, CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Map as MapIcon, MapPin, Repeat2, Search } from "lucide-react";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { locationApi } from "../../../api/locationApi";
import { weatherApi } from "../../../api/weatherApi";
import { useAsync } from "../../../hooks/useAsync";
import DesktopWeatherCard from "./DesktopWeatherCard.jsx";

const TITLE_MAX_LENGTH = 40;
const CUSTOM_PURPOSE = "custom";
const DEFAULT_PURPOSE_OPTIONS = ["운동 메이트 모집", "팀 모집", "파트너 모집", "동행 모집", "친선전"];

const TIME_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

const WEEKDAY_LABELS = ["\uc77c", "\uc6d4", "\ud654", "\uc218", "\ubaa9", "\uae08", "\ud1a0"];
const REPEAT_DAY_OPTIONS = [
  { value: "MO", label: "\uc6d4" },
  { value: "TU", label: "\ud654" },
  { value: "WE", label: "\uc218" },
  { value: "TH", label: "\ubaa9" },
  { value: "FR", label: "\uae08" },
  { value: "SA", label: "\ud1a0" },
  { value: "SU", label: "\uc77c" }
];
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
            <button type="button" onClick={() => moveMonth(-1)} aria-label={"\uc774\uc804 \ub2ec"}><ChevronLeft size={18} /></button>
            <strong>{viewDate.getFullYear()}{"\ub144"} {viewDate.getMonth() + 1}{"\uc6d4"}</strong>
            <button type="button" onClick={() => moveMonth(1)} aria-label={"\ub2e4\uc74c \ub2ec"}><ChevronRight size={18} /></button>
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

const formatTimeFromMinutes = (totalMinutes) => {
  const clamped = Math.max(0, Math.min(totalMinutes, 23 * 60 + 55));
  const hour = Math.floor(clamped / 60);
  const minute = Math.floor(clamped % 60 / 5) * 5;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
};

const roundUpToNextSlot = (date = new Date()) => {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  return formatTimeFromMinutes(Math.ceil((totalMinutes + 1) / 5) * 5);
};

const addMinutesToTime = (value, minutes) => {
  if (!value) return "";
  const [hour, minute] = value.split(":").map(Number);
  return formatTimeFromMinutes(hour * 60 + minute + minutes);
};

const defaultStartTimeForDate = (dateValue, todayValue) => (dateValue === todayValue ? roundUpToNextSlot() : "09:00");

const clampTimeAfterMin = (value, min) => {
  if (!value || !min || value > min) return value;
  const [minHour, minMinute] = min.split(":").map(Number);
  const nextTotalMinutes = Math.ceil((minHour * 60 + minMinute + 1) / 5) * 5;
  if (nextTotalMinutes >= 24 * 60) return "";
  return formatTimeFromMinutes(nextTotalMinutes);
};

function TimeSelect({ value, onChange, min, required = false }) {
  const parts = splitTimeValue(value);
  const changePart = (key, nextValue) => {
    const nextParts = { ...parts, [key]: nextValue };
    const nextTime = buildTimeValue(nextParts);
    if (!nextTime) return onChange("");
    return onChange(clampTimeAfterMin(nextTime, min));
  };

  return (
    <span className="meeting-time-select" data-required={required ? "true" : "false"}>
      <select aria-label={"\uc624\uc804 \uc624\ud6c4"} value={parts.period} onChange={(event) => changePart("period", event.target.value)}>
        <option value="AM">{"\uc624\uc804"}</option>
        <option value="PM">{"\uc624\ud6c4"}</option>
      </select>
      <select aria-label={"\uc2dc"} value={parts.hour} onChange={(event) => changePart("hour", event.target.value)}>
        <option value="">{"\uc2dc"}</option>
        {TIME_HOURS.map((hour) => <option key={hour} value={hour}>{Number(hour)}{"\uc2dc"}</option>)}
      </select>
      <select aria-label={"\ubd84"} value={parts.minute} onChange={(event) => changePart("minute", event.target.value)}>
        {TIME_MINUTES.map((minute) => <option key={minute} value={minute}>{minute}{"\ubd84"}</option>)}
      </select>
    </span>
  );
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

const ADMIN_REGION_PATTERN = /(특별시|광역시|특별자치시|도|시|군|구|읍|면|동|리)$/;
const normalizePlaceText = (value) => (value || "").replace(/<[^>]+>/g, "").trim();
const isAdministrativeRegion = (place) => {
  const title = normalizePlaceText(place?.title || place?.address || place?.road_address);
  const category = normalizePlaceText(place?.category);
  return category === "주소" && ADMIN_REGION_PATTERN.test(title.split(/\s+/).at(-1) || title);
};

function DesktopLocationMap({ clientId, selectedLocation, results, onSelect }) {
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

  if (!clientId) {
    return <div className="desktop-location-map-empty"><MapIcon size={20} />{"\ub124\uc774\ubc84 \uc9c0\ub3c4 \ud074\ub77c\uc774\uc5b8\ud2b8 \ud0a4\ub97c \uc124\uc815\ud558\uba74 \uc9c0\ub3c4\uc5d0\uc11c \uc704\uce58\ub97c \uc9c0\uc815\ud560 \uc218 \uc788\uc2b5\ub2c8\ub2e4."}</div>;
  }

  return (
    <div className="desktop-location-map-panel">
      <div className="desktop-location-map-toolbar">
        <span><MapIcon size={17} />{"\uc9c0\ub3c4\uc5d0\uc11c \uc704\uce58 \uc9c0\uc815"}</span>
        <small>{"\uac80\uc0c9 \uacb0\uacfc \ub9c8\ucee4\ub098 \uc9c0\ub3c4\uc758 \uc704\uce58\ub97c \ud074\ub9ad\ud558\uc138\uc694."}</small>
      </div>
      <div className="desktop-location-map" ref={mapElementRef}>
        {mapStatus === "loading" && <span>{"\uc9c0\ub3c4\ub97c \ubd88\ub7ec\uc624\ub294 \uc911\uc785\ub2c8\ub2e4."}</span>}
        {mapStatus === "error" && <span>{"\uc9c0\ub3c4\ub97c \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4."}</span>}
      </div>
    </div>
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

const combineDateTime = (date, time) => date && time ? `${date}T${time}` : "";
const toDateInputValue = (date) => date.toISOString().slice(0, 10);

function uniqueValues(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function getApiItems(payload) {
  if (Array.isArray(payload)) return payload;
  return Array.isArray(payload?.items) ? payload.items : [];
}

function DesktopMeetingCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [purposeMode, setPurposeMode] = useState(initialForm.purpose);
  const [hasStartSchedule, setHasStartSchedule] = useState(true);
  const [hasEndSchedule, setHasEndSchedule] = useState(false);
  const [locationKeyword, setLocationKeyword] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationLoading, setLocationLoading] = useState(false);
  const [locationScope, setLocationScope] = useState("");
  const [mapClientId, setMapClientId] = useState("");
  const [maxLimit, setMaxLimit] = useState(6);
  const locationSearchRequestRef = useRef(0);
  const selectedLocationKeywordRef = useRef("");
  const locationReverseRequestRef = useRef(0);
  const weatherRequestRef = useRef(0);
  const [weather, setWeather] = useState({ loading: false, forecast: null });
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(() => sportApi.sports(form.category_id ? { category_id: form.category_id } : {}), [form.category_id]);
  const today = toDateInputValue(new Date());
  const categoryItems = useMemo(() => getApiItems(categories.data), [categories.data]);
  const sportItems = useMemo(() => getApiItems(sports.data), [sports.data]);


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


  const selectedCategory = useMemo(
    () => categoryItems.find((category) => String(category.id) === String(form.category_id)),
    [categoryItems, form.category_id]
  );

  const purposeOptions = useMemo(() => {
    const categoryPurposes = selectedCategory?.purpose?.split("/") || [];
    return uniqueValues([...categoryPurposes, ...DEFAULT_PURPOSE_OPTIONS]);
  }, [selectedCategory?.purpose]);

  useEffect(() => {
    const firstCategory = categoryItems[0];
    if (!form.category_id && firstCategory) {
      const firstPurpose = firstCategory.purpose?.split("/")?.[0]?.trim() || initialForm.purpose;
      setPurposeMode(firstPurpose);
      setForm((prev) => ({ ...prev, category_id: String(firstCategory.id), purpose: firstPurpose }));
    }
  }, [categoryItems, form.category_id]);

  useEffect(() => {
    const firstSport = sportItems[0];
    if (firstSport && !sportItems.some((sport) => String(sport.id) === String(form.sport_id))) {
      setForm((prev) => ({ ...prev, sport_id: String(firstSport.id) }));
    }
  }, [sportItems, form.sport_id]);

  useEffect(() => {
    if (purposeMode === CUSTOM_PURPOSE || purposeOptions.includes(purposeMode)) return;
    const nextPurpose = purposeOptions[0] || initialForm.purpose;
    setPurposeMode(nextPurpose);
    setForm((prev) => ({ ...prev, purpose: nextPurpose }));
  }, [purposeMode, purposeOptions]);


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

  useEffect(() => {
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const at = combineDateTime(form.start_date, form.start_time);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !at) {
      weatherRequestRef.current += 1;
      setWeather({ loading: false, forecast: null });
      return;
    }
    const requestId = weatherRequestRef.current + 1;
    weatherRequestRef.current = requestId;
    setWeather({ loading: true, forecast: null });
    const timer = window.setTimeout(() => {
      weatherApi.forecast({ latitude, longitude, at, address: form.address })
        .then((data) => {
          if (weatherRequestRef.current === requestId) setWeather({ loading: false, forecast: data.forecast });
        })
        .catch((error) => {
          if (weatherRequestRef.current !== requestId) return;
          setWeather({
            loading: false,
            forecast: { available: false, message: error.response?.data?.message || "예보를 불러오지 못했습니다." },
          });
        });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [form.latitude, form.longitude, form.start_date, form.start_time, form.address]);

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

  const clearLocationScope = () => {
    selectedLocationKeywordRef.current = "";
    locationSearchRequestRef.current += 1;
    setLocationScope("");
    setLocationKeyword("");
    setLocationResults([]);
    setLocationLoading(false);
    setForm((prev) => ({ ...prev, location_name: "", address: "", latitude: undefined, longitude: undefined }));
  };

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateMeetingType = (meetingType) => {
    setForm((prev) => {
      if (meetingType === "regular") {
        const nextStartDate = prev.start_date || today;
        const nextStartTime = prev.start_time || defaultStartTimeForDate(nextStartDate, today);
        const nextEndTime = prev.end_time && prev.end_time > nextStartTime ? prev.end_time : addMinutesToTime(nextStartTime, 60);
        return {
          ...prev,
          meeting_type: "regular",
          start_date: nextStartDate,
          start_time: nextStartTime,
          end_date: "",
          end_time: nextEndTime,
        };
      }
      return {
        ...prev,
        meeting_type: "one_time",
        repeat_days: [],
        end_date: "",
        end_time: "",
      };
    });
    if (meetingType === "regular") {
      setHasStartSchedule(true);
      setHasEndSchedule(false);
    } else {
      setHasStartSchedule(true);
      setHasEndSchedule(false);
    }
  };

  const toggleRepeatDay = (day) => {
    setForm((prev) => {
      const exists = prev.repeat_days.includes(day);
      const nextDays = exists
        ? prev.repeat_days.filter((item) => item !== day)
        : [...prev.repeat_days, day];
      const sortedDays = REPEAT_DAY_OPTIONS
        .map((option) => option.value)
        .filter((value) => nextDays.includes(value));
      return { ...prev, repeat_days: sortedDays };
    });
  };

  const updateCategory = (categoryId) => {
    setForm((prev) => ({ ...prev, category_id: categoryId, sport_id: "" }));
  };

  const updateTitle = (value) => update("title", value.slice(0, TITLE_MAX_LENGTH));

  const updatePurposeMode = (value) => {
    setPurposeMode(value);
    update("purpose", value === CUSTOM_PURPOSE ? "" : value);
  };

  const toggleStartSchedule = (checked) => {
    setHasStartSchedule(checked);
    if (!checked) {
      setHasEndSchedule(false);
      setForm((prev) => ({ ...prev, start_date: "", start_time: "", end_date: "", end_time: "", meeting_type: "regular" }));
      return;
    }
    setForm((prev) => {
      const nextStartDate = prev.start_date || today;
      const nextStartTime = prev.start_time || defaultStartTimeForDate(nextStartDate, today);
      return { ...prev, start_date: nextStartDate, start_time: nextStartTime };
    });
  };

  const toggleEndSchedule = (checked) => {
    setHasEndSchedule(checked);
    if (!checked) {
      setForm((prev) => ({ ...prev, end_date: "" }));
      return;
    }
    setForm((prev) => {
      const nextStartDate = prev.start_date || today;
      const nextStartTime = prev.start_time || defaultStartTimeForDate(nextStartDate, today);
      const nextEndDate = prev.end_date || nextStartDate;
      return {
        ...prev,
        start_date: nextStartDate,
        start_time: nextStartTime,
        end_date: nextEndDate,
        end_time: prev.end_time || addMinutesToTime(nextStartTime, 60)
      };
    });
  };

  const updateStartDate = (value) => {
    setForm((prev) => {
      const nextStartTime = prev.start_time || defaultStartTimeForDate(value, today);
      const next = { ...prev, start_date: value, start_time: nextStartTime };
      if (prev.end_date && value && prev.end_date < value) next.end_date = value;
      if (next.end_date === value && next.end_time) next.end_time = clampTimeAfterMin(next.end_time, nextStartTime);
      return next;
    });
  };

  const updateStartTime = (value) => {
    setForm((prev) => {
      const next = { ...prev, start_time: value };
      if (prev.meeting_type === "regular" && value && prev.end_time && prev.end_time <= value) next.end_time = addMinutesToTime(value, 60);
      if (prev.end_date === prev.start_date && prev.end_time && value) next.end_time = clampTimeAfterMin(prev.end_time, value);
      return next;
    });
  };

  const updateEndDate = (value) => {
    setForm((prev) => {
      const minEndDate = prev.start_date || today;
      const nextEndDate = value && value < minEndDate ? minEndDate : value;
      const nextStartTime = prev.start_time || defaultStartTimeForDate(minEndDate, today);
      return { ...prev, start_time: prev.start_time || nextStartTime, end_date: nextEndDate };
    });
  };

  const updateEndTime = (value) => {
    setForm((prev) => ({
      ...prev,
      end_time: prev.meeting_type === "regular" || prev.end_date === prev.start_date ? clampTimeAfterMin(value, prev.start_time) : value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmedPurpose = form.purpose.trim();
    if (!form.category_id || !form.sport_id) return alert("카테고리와 종목을 선택해 주세요.");
    if (!trimmedPurpose) return alert("모집 목적을 선택하거나 입력해 주세요.");
    if (!form.location_name || !form.address) return alert("\uc704\uce58 \uac80\uc0c9 \uacb0\uacfc\ub098 \uc9c0\ub3c4\uc5d0\uc11c \uc704\uce58\ub97c \uc120\ud0dd\ud574\uc8fc\uc138\uc694.");

    if (form.meeting_type === "one_time") {
      if (!form.start_date) return alert("모임 시작 날짜를 선택해 주세요.");
      if (!form.start_time) return alert("모임 시작 시간을 선택해 주세요.");
    } else {
      if (!form.start_date) return alert("반복 일정 시작일을 선택해 주세요.");
      if (hasEndSchedule && !form.end_date) return alert("모임 종료일을 선택해 주세요.");
      if (hasEndSchedule && form.end_date < form.start_date) return alert("모임 종료일은 시작일보다 빠를 수 없습니다.");
      if (!form.start_time) return alert("시작 시간을 선택해 주세요.");
      if (!form.end_time) return alert("종료 시간을 선택해 주세요.");
      if (!form.repeat_days.length) return alert("반복 요일을 하나 이상 선택해 주세요.");
      if (form.end_time <= form.start_time) return alert("종료 시간은 시작 시간 이후여야 합니다.");
    }

    const maxPartCount = Number(form.max_participants);
    if (maxPartCount > maxLimit) {
      return alert(`개설 최대 정원은 ${maxLimit}명 이하로만 설정 가능합니다.`);
    }

    const basePayload = {
      sport_id: Number(form.sport_id),
      title: form.title,
      description: form.description,
      purpose: trimmedPurpose,
      location_name: form.location_name,
      address: form.address,
      latitude: form.latitude,
      longitude: form.longitude,
      region_sido_code: form.region_sido_code,
      region_sigungu_code: form.region_sigungu_code,
      max_participants: maxPartCount,
      cover_image_url: form.cover_image_url,
    };

    const payload = form.meeting_type === "regular"
      ? {
          ...basePayload,
          meeting_type: "regular",
          schedule_start_date: form.start_date,
          schedule_end_date: hasEndSchedule ? form.end_date : null,
          start_time: form.start_time,
          end_time: form.end_time,
          repeat_days: form.repeat_days,
        }
      : {
          ...basePayload,
          meeting_type: "one_time",
          start_at: combineDateTime(form.start_date, form.start_time),
        };

    const data = await meetingApi.create(payload);
    navigate(`/meetings/${data.meeting.id}`);
  };

  const showLocationResultsPanel = locationLoading || locationResults.length > 0;
  const showSelectedLocation = Boolean(form.location_name && !locationScope);

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>모임 만들기</h1>
          <span>함께 운동할 모임의 기본 정보와 일정을 등록하세요.</span>
        </div>
      </div>

      <form className="desktop-form-panel desktop-meeting-create-form" onSubmit={submit}>
        <section className="desktop-meeting-create-section">
          <div className="desktop-meeting-create-section__head">
            <span>01</span>
            <h2>종목 선택</h2>
          </div>
          <div className="desktop-form-grid desktop-form-grid--wide">
            <label>카테고리<select value={form.category_id} disabled={categories.loading || !categoryItems.length} onChange={(event) => updateCategory(event.target.value)}>{categoryItems.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>종목<select required value={form.sport_id} disabled={sports.loading || !sportItems.length} onChange={(event) => update("sport_id", event.target.value)}>{sportItems.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
          </div>
          <fieldset className="desktop-meeting-type-selector">
            <legend>모임 방식</legend>
            <div role="group" aria-label="모임 방식">
              <button type="button" className={form.meeting_type === "one_time" ? "is-selected" : ""} aria-pressed={form.meeting_type === "one_time"} onClick={() => updateMeetingType("one_time")}>
                <CalendarDays size={18} />
                일회성 모임
              </button>
              <button type="button" className={form.meeting_type === "regular" ? "is-selected" : ""} aria-pressed={form.meeting_type === "regular"} onClick={() => updateMeetingType("regular")}>
                <Repeat2 size={18} />
                정기 모임
              </button>
            </div>
          </fieldset>
        </section>

        <section className="desktop-meeting-create-section">
          <div className="desktop-meeting-create-section__head">
            <span>02</span>
            <h2>기본 정보</h2>
          </div>
          <div className="desktop-form-grid desktop-form-grid--wide">
            <label><span className="desktop-field-label-row">제목<em>{form.title.length}/{TITLE_MAX_LENGTH}</em></span><input required maxLength={TITLE_MAX_LENGTH} value={form.title} onChange={(event) => updateTitle(event.target.value)} placeholder="예: 여의도 한강 러닝 5km" /></label>
            <label>모집 목적<select value={purposeMode} onChange={(event) => updatePurposeMode(event.target.value)}>{purposeOptions.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}<option value={CUSTOM_PURPOSE}>기타</option></select></label>
            {purposeMode === CUSTOM_PURPOSE && <label className="desktop-form-full">기타 모집 목적<input required maxLength={30} value={form.purpose} onChange={(event) => update("purpose", event.target.value.slice(0, 30))} placeholder="모집 목적을 직접 입력하세요" /></label>}
            <label className="desktop-form-full">설명<textarea required rows="5" value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
            <label className="desktop-meeting-capacity">최대 인원<input min="2" max={maxLimit} type="number" value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} /></label>
          </div>
        </section>

        <section className="desktop-meeting-create-section">
          <div className="desktop-meeting-create-section__head">
            <span>03</span>
            <h2>일정</h2>
          </div>
          <div className="desktop-form-grid desktop-meeting-schedule-grid">
            {form.meeting_type === "regular" && (
              <fieldset className="desktop-regular-schedule desktop-form-full">
                <legend>반복 일정</legend>
                <p>선택한 기간 동안 지정한 요일에 일정이 반복됩니다.</p>
                <p>종료일을 설정하지 않으면 이번 달부터 다다음 달까지 일정이 미리 생성됩니다.</p>
                <div className="desktop-schedule-toggles">
                  <button type="button" role="switch" aria-checked={hasEndSchedule} onClick={() => toggleEndSchedule(!hasEndSchedule)}>
                    <span aria-hidden="true" />
                    모임 종료일 설정
                  </button>
                </div>
                <div className="desktop-regular-schedule__grid">
                  <label>모임 시작일<CalendarSelect label={"\ubaa8\uc784 \uc2dc\uc791\uc77c"} min={today} value={form.start_date} onChange={updateStartDate} icon={<CalendarClock size={18} />} /></label>
                  {hasEndSchedule && <label>모임 종료일<CalendarSelect label={"\ubaa8\uc784 \uc885\ub8cc\uc77c"} min={form.start_date || today} value={form.end_date} onChange={updateEndDate} icon={<CalendarClock size={18} />} /></label>}
                  <label>회차 시작 시간<span className="desktop-icon-input"><AlarmClock size={18} /><TimeSelect required value={form.start_time} onChange={updateStartTime} /></span></label>
                  <label>회차 종료 시간<span className="desktop-icon-input"><AlarmClock size={18} /><TimeSelect required min={form.start_time} value={form.end_time} onChange={updateEndTime} /></span></label>
                </div>
                <div className="desktop-repeat-days" role="group" aria-label="반복 요일">
                  {REPEAT_DAY_OPTIONS.map((day) => {
                    const selected = form.repeat_days.includes(day.value);
                    return (
                      <button type="button" key={day.value} className={selected ? "is-selected" : ""} aria-pressed={selected} onClick={() => toggleRepeatDay(day.value)}>
                        {day.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}
            {form.meeting_type === "one_time" && (
              <fieldset className="desktop-date-time-pair desktop-form-full">
                <legend>시작 일정</legend>
                <label>시작일<CalendarSelect label={"\uc2dc\uc791\uc77c"} min={today} value={form.start_date} onChange={updateStartDate} icon={<CalendarClock size={18} />} /></label>
                <label>시작 시간<span className="desktop-icon-input"><AlarmClock size={18} /><TimeSelect required value={form.start_time} onChange={updateStartTime} /></span></label>
              </fieldset>
            )}
            {(weather.loading || weather.forecast) && (
              <div className="desktop-form-full">
                <DesktopWeatherCard
                  forecast={weather.forecast}
                  loading={weather.loading}
                  title={form.meeting_type === "regular" ? "첫 회차 날씨" : "모임 날씨"}
                  selectedAt={combineDateTime(form.start_date, form.start_time)}
                />
              </div>
            )}
          </div>
        </section>

        <section className="desktop-meeting-create-section">
          <div className="desktop-meeting-create-section__head">
            <span>04</span>
            <h2>장소</h2>
          </div>
          <div className="desktop-location-picker">
            <label>{"도로명/주소 검색"}<span><Search size={18} /><input value={locationKeyword} placeholder="도로명, 건물명 또는 장소를 검색하세요" onChange={(event) => { selectedLocationKeywordRef.current = ""; setLocationKeyword(event.target.value); setLocationScope(""); setForm((prev) => ({ ...prev, address: event.target.value, location_name: "", latitude: undefined, longitude: undefined })); }} /></span></label>
            {locationScope && <div className="desktop-location-scope"><MapPin size={16} /><span><strong>{locationScope}</strong>{" 안에서 검색 중"}</span><button type="button" onClick={clearLocationScope}>{"범위 해제"}</button></div>}
            {showSelectedLocation && <div className="desktop-location-selected"><MapPin size={18} /><strong>{form.location_name || "선택된 주소"}</strong><span>{form.address}</span></div>}
            <div className={`desktop-location-workspace ${showLocationResultsPanel ? "has-results" : "is-map-only"}`}>
              {showLocationResultsPanel && (
                <div className="desktop-location-search-column">
                  <div className="desktop-location-results">{locationLoading ? <span>{"검색 중입니다."}</span> : locationResults.map((place, index) => <button type="button" key={`${place.title}-${index}`} onClick={() => selectLocation(place)}><MapPin size={17} /><strong>{(place.title || place.address || "").replace(/<[^>]+>/g, "")}</strong><small>{place.address || place.road_address}</small></button>)}</div>
                </div>
              )}
              <DesktopLocationMap clientId={mapClientId} selectedLocation={form} results={locationResults} onSelect={selectLocation} />
            </div>
          </div>
        </section>

        <div className="desktop-form-actions desktop-form-actions--submit-only">
          <button type="submit">모임 등록</button>
        </div>
      </form>
    </div>
  );
}

export default DesktopMeetingCreate;
