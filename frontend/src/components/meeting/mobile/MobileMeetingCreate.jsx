import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import { AlarmClock, CalendarClock, ChevronLeft, ChevronRight } from "lucide-react";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { locationApi } from "../../../api/locationApi";
import { useAsync } from "../../../hooks/useAsync";
import { koreaRegions } from "../../../data/koreaRegions";

const TITLE_MAX_LENGTH = 40;
const CUSTOM_PURPOSE = "custom";
const DEFAULT_PURPOSE_OPTIONS = ["운동 메이트 모집", "팀 모집", "파트너 모집", "동행 모집", "친선전"];

const TIME_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

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

function TimeSelect({ value, onChange, min, required = false }) {
  const parts = splitTimeValue(value);
  const changePart = (key, nextValue) => {
    const nextParts = { ...parts, [key]: nextValue };
    const nextTime = buildTimeValue(nextParts);
    if (!nextTime) return onChange("");
    if (min && nextTime <= min) return onChange("");
    return onChange(nextTime);
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

const initialForm = {
  category_id: "",
  sport_id: "",
  title: "",
  description: "",
  meeting_type: "one_time",
  purpose: "운동 메이트 모집",
  region_sido_code: "",
  region_sigungu_code: "",
  region_sido: "",
  region_area: "",
  location_name: "",
  address: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  max_participants: 6,
  approval_required: true
};

const fallbackSportGroups = [
  { category: { id: "fallback-ball", name: "구기 종목", purpose: "팀 모집 / 친선전" }, sports: ["축구", "풋살", "농구", "배구", "야구", "족구"] },
  { category: { id: "fallback-racket", name: "라켓 스포츠", purpose: "파트너 모집 / 친선전" }, sports: ["배드민턴", "탁구", "테니스", "스쿼시"] },
  { category: { id: "fallback-outdoor", name: "러닝 / 야외", purpose: "동행 모집 / 팀 모집" }, sports: ["러닝", "등산", "트래킹", "자전거", "산책"] },
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
  const [addressKeyword, setAddressKeyword] = useState("");
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [purposeMode, setPurposeMode] = useState(initialForm.purpose);
  const [hasStartSchedule, setHasStartSchedule] = useState(true);
  const [hasEndSchedule, setHasEndSchedule] = useState(false);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(() => sportApi.sports(isNumericId(form.category_id) ? { category_id: form.category_id } : {}), [form.category_id]);
  const today = toDateInputValue(new Date());
  const nowTime = toTimeInputValue(new Date());
  const selectedRegion = koreaRegions.find((region) => region.name === form.region_sido);
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

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    const firstSport = displaySports[0];
    if (firstSport && !displaySports.some((sport) => String(sport.id) === String(form.sport_id))) {
      setForm((prev) => ({ ...prev, sport_id: String(firstSport.id) }));
    } else if (!firstSport && form.sport_id) {
      setForm((prev) => ({ ...prev, sport_id: "" }));
    }
  }, [displaySports, form.sport_id]);

  useEffect(() => {
    if (!addressKeyword.trim()) {
      setAddressResults([]);
      return;
    }
    const timer = window.setTimeout(() => {
      setAddressLoading(true);
      locationApi.searchPlaces({ keyword: addressKeyword.trim(), size: 8 })
        .then((data) => setAddressResults(data.items || []))
        .catch(() => setAddressResults([]))
        .finally(() => setAddressLoading(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [addressKeyword]);

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

  const updateRegion = (sidoName, areaName = "") => {
    const regionName = sidoName ? (areaName ? `${sidoName} ${areaName}` : sidoName) : "";
    setForm((prev) => ({ ...prev, region_sido: sidoName, region_area: areaName, region_sido_code: sidoName, region_sigungu_code: areaName, address: regionName && !prev.address ? regionName : prev.address }));
  };

  const selectAddress = (place) => {
    const title = (place.title || "").replace(/<[^>]+>/g, "");
    const address = place.address || title;
    setForm((prev) => ({ ...prev, location_name: title || address, address, latitude: place.latitude, longitude: place.longitude }));
    setAddressKeyword(address);
    setAddressResults([]);
  };

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

  const updateStartDate = (value) => setForm((prev) => ({ ...prev, start_date: value, start_time: value === today && prev.start_time && prev.start_time < nowTime ? nowTime : prev.start_time, end_date: prev.end_date && prev.end_date < value ? value : prev.end_date }));
  const updateStartTime = (value) => setForm((prev) => ({ ...prev, start_time: prev.start_date === today && value < nowTime ? nowTime : value, end_time: prev.end_date === prev.start_date && prev.end_time && value && prev.end_time <= value ? "" : prev.end_time }));

  const updateEndDate = (value) => setForm((prev) => {
    const minDate = prev.start_date || today;
    const nextEndDate = value && value < minDate ? minDate : value;
    return {
      ...prev,
      end_date: nextEndDate,
      end_time: nextEndDate === prev.start_date && prev.start_time && prev.end_time && prev.end_time <= prev.start_time ? "" : prev.end_time,
    };
  });

  const updateEndTime = (value) => setForm((prev) => {
    if (prev.end_date === prev.start_date && prev.start_time && value && value <= prev.start_time) {
      return { ...prev, end_time: "" };
    }
    return { ...prev, end_time: value };
  });

  const updateTitle = (value) => update("title", value.slice(0, TITLE_MAX_LENGTH));

  const validateStep = (targetStep = step) => {
    if (targetStep === 1) {
      if (!form.category_id || !form.sport_id) return "종목을 선택해주세요.";
      if (usingFallbackSports || !isNumericId(form.sport_id)) return "종목 데이터가 아직 DB와 연결되지 않았습니다. 관리자에게 종목 데이터 등록을 요청해주세요.";
      if (!form.meeting_type || !form.purpose.trim()) return "모임 방식과 목적을 입력해주세요.";
    }
    if (targetStep === 2) {
      if (!form.title.trim()) return "모임 제목을 입력해주세요.";
      if (!form.description.trim()) return "모임 설명을 입력해주세요.";
    }
    if (targetStep === 3) {
      if (!form.address.trim()) return "주소를 입력하거나 검색 결과를 선택해주세요.";
      if (!form.location_name.trim()) return "장소명을 입력해주세요.";
      if (hasStartSchedule && (!form.start_date || !form.start_time)) return "시작 일정이 있는 모임은 시작일과 시작 시간을 입력해주세요.";
      if (hasEndSchedule && !hasStartSchedule) return "종료 일정은 시작 일정이 있을 때만 설정할 수 있습니다.";
      if (hasEndSchedule && (!form.end_date || !form.end_time)) return "종료 일정이 있는 모임은 종료일과 종료 시간을 입력해주세요.";
      if (hasEndSchedule && new Date(combineDateTime(form.end_date, form.end_time)) <= new Date(combineDateTime(form.start_date, form.start_time))) return "종료 시간은 시작 시간 이후로 선택해주세요.";
      if (Number(form.max_participants) < 2) return "정원은 최소 2명 이상이어야 합니다.";
    }
    return "";
  };

  const goNext = () => {
    const message = validateStep(step);
    if (message) return setFormMessage(message);
    setFormMessage("");
    setStep(step + 1);
  };

  const submit = async (event) => {
    event.preventDefault();
    const validationMessage = validateStep(3);
    if (validationMessage) return setFormMessage(validationMessage);
    setFormMessage("");
    setSubmitting(true);
    try {
      const data = await meetingApi.create({
        ...form,
        title: form.title.trim(),
        description: form.description.trim(),
        purpose: form.purpose.trim(),
        location_name: form.location_name.trim(),
        address: form.address.trim(),
        approval_required: true,
        start_at: hasStartSchedule ? combineDateTime(form.start_date, form.start_time) : null,
        end_at: hasEndSchedule ? combineDateTime(form.end_date, form.end_time) : null,
        meeting_type: hasEndSchedule || !hasStartSchedule ? "regular" : form.meeting_type,
        sport_id: Number(form.sport_id),
        max_participants: Number(form.max_participants)
      });
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
        <div className="meeting-create-hero"><span>SportsMate</span><h1>{form.meeting_type === "regular" ? "반복 모임 만들기" : "한 번만 진행하는 모임"}</h1><p>운동 종목, 일정, 장소 정보를 순서대로 입력합니다.</p></div>
        <div className="form-progress"><span>단계 {step}/3</span><div aria-hidden="true">{[1, 2, 3].map((item) => <i key={item} className={item <= step ? "active" : ""} />)}</div></div>
        {formMessage ? <p className="mobile-form-message mobile-form-message--error">{formMessage}</p> : null}
        {step === 1 && <section>
          <label>카테고리<select value={form.category_id} onChange={(event) => updateCategory(event.target.value)}><option value="">카테고리 선택</option>{displayCategories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>종목<select required value={form.sport_id} onChange={(event) => update("sport_id", event.target.value)} disabled={!form.category_id}><option value="">종목 선택</option>{displaySports.map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
          {usingFallbackSports ? <p className="mobile-form-message">기본 종목 목록을 표시하고 있습니다. 실제 등록은 DB 종목 데이터가 연결된 뒤 가능합니다.</p> : null}
          <div className="meeting-type-segment" role="group" aria-label="모임 방식"><button type="button" className={form.meeting_type === "one_time" ? "active" : ""} onClick={() => update("meeting_type", "one_time")}>한 번만 진행</button><button type="button" className={form.meeting_type === "regular" ? "active" : ""} onClick={() => update("meeting_type", "regular")}>반복 진행</button></div>
          <label>모집 목적<select value={purposeMode} onChange={(event) => updatePurposeMode(event.target.value)}>{purposeOptions.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}<option value={CUSTOM_PURPOSE}>기타</option></select></label>
          {purposeMode === CUSTOM_PURPOSE && <label>기타 모집 목적<input value={form.purpose} onChange={(event) => update("purpose", event.target.value.slice(0, 30))} /></label>}
        </section>}
        {step === 2 && <section>
          <label><span className="desktop-field-label-row">제목<em>{form.title.length}/{TITLE_MAX_LENGTH}</em></span><input required maxLength={TITLE_MAX_LENGTH} value={form.title} onChange={(event) => updateTitle(event.target.value)} /></label>
          <label>설명<textarea required value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        </section>}
        {step === 3 && <section>
          <section className="profile-region-field meeting-region-field"><strong>지역</strong><div className="region-inline"><select value={form.region_sido} onChange={(event) => updateRegion(event.target.value, "")}><option value="">전국</option>{koreaRegions.map((region) => <option key={region.name} value={region.name}>{region.name}</option>)}</select><select value={form.region_area} onChange={(event) => updateRegion(form.region_sido, event.target.value)} disabled={!form.region_sido}><option value="">전체</option>{(selectedRegion?.areas || []).map((area) => <option key={area} value={area}>{area}</option>)}</select></div></section>
          <label>주소 검색<input required value={addressKeyword || form.address} placeholder="주소나 장소명을 입력하세요" onChange={(event) => { setAddressKeyword(event.target.value); update("address", event.target.value); }} /></label>
          {(addressLoading || addressResults.length > 0) && <div className="address-result-list">{addressLoading ? <span>검색 중입니다.</span> : addressResults.map((place, index) => <button type="button" key={`${place.title}-${index}`} onClick={() => selectAddress(place)}><strong>{(place.title || place.address || "").replace(/<[^>]+>/g, "")}</strong><small>{place.address}</small></button>)}</div>}
          <label>장소명<input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} /></label>
          <div className="mobile-schedule-toggles"><label><input type="checkbox" checked={hasStartSchedule} onChange={(event) => toggleStartSchedule(event.target.checked)} /> 시작 일정 있음</label><label><input type="checkbox" checked={hasEndSchedule} disabled={!hasStartSchedule} onChange={(event) => toggleEndSchedule(event.target.checked)} /> 종료 일정 있음</label></div>
          {hasStartSchedule && <div className="date-time-row"><label>{"\uc2dc\uc791 \ub0a0\uc9dc"}<CalendarSelect label={"\uc2dc\uc791\uc77c"} min={today} value={form.start_date} onChange={updateStartDate} icon={<CalendarClock size={17} />} /></label><label>{"\uc2dc\uc791 \uc2dc\uac04"}<span className="mobile-icon-input"><AlarmClock size={17} /><TimeSelect required min={form.start_date === today ? nowTime : undefined} value={form.start_time} onChange={updateStartTime} /></span></label></div>}
          {hasEndSchedule && <div className="date-time-row"><label>{"\uc885\ub8cc \ub0a0\uc9dc"}<CalendarSelect label={"\uc885\ub8cc\uc77c"} min={form.start_date || today} value={form.end_date} onChange={updateEndDate} icon={<CalendarClock size={17} />} /></label><label>{"\uc885\ub8cc \uc2dc\uac04"}<span className="mobile-icon-input"><AlarmClock size={17} /><TimeSelect required min={form.end_date === form.start_date ? form.start_time : undefined} value={form.end_time} onChange={updateEndTime} /></span></label></div>}
          <label>정원<input type="number" min="2" max="50" value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} /></label>
        </section>}
        <div className="form-actions">{step > 1 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>이전</Button>}{step < 3 ? <Button type="button" onClick={goNext}>다음</Button> : <Button type="submit" disabled={submitting}>{submitting ? "등록 중..." : "모임 등록"}</Button>}</div>
      </form>
    </>
  );
}

export default MobileMeetingCreate;
