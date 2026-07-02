import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock, CalendarClock } from "lucide-react";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";

const TITLE_MAX_LENGTH = 40;
const CUSTOM_PURPOSE = "custom";
const DEFAULT_PURPOSE_OPTIONS = ["운동 메이트 모집", "팀 모집", "파트너 모집", "동행 모집", "친선전"];

const TIME_MINUTES = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];
const TIME_HOURS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));

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
  location_name: "",
  address: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  max_participants: 6,
  approval_required: true
};

const combineDateTime = (date, time) => date && time ? `${date}T${time}` : "";
const toDateInputValue = (date) => date.toISOString().slice(0, 10);

function uniqueValues(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function DesktopMeetingCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [purposeMode, setPurposeMode] = useState(initialForm.purpose);
  const [hasStartSchedule, setHasStartSchedule] = useState(true);
  const [hasEndSchedule, setHasEndSchedule] = useState(false);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(() => sportApi.sports(form.category_id ? { category_id: form.category_id } : {}), [form.category_id]);
  const today = toDateInputValue(new Date());

  const selectedCategory = useMemo(
    () => categories.data?.items?.find((category) => String(category.id) === String(form.category_id)),
    [categories.data?.items, form.category_id]
  );

  const purposeOptions = useMemo(() => {
    const categoryPurposes = selectedCategory?.purpose?.split("/") || [];
    return uniqueValues([...categoryPurposes, ...DEFAULT_PURPOSE_OPTIONS]);
  }, [selectedCategory?.purpose]);

  useEffect(() => {
    const firstCategory = categories.data?.items?.[0];
    if (!form.category_id && firstCategory) {
      const firstPurpose = firstCategory.purpose?.split("/")?.[0]?.trim() || initialForm.purpose;
      setPurposeMode(firstPurpose);
      setForm((prev) => ({ ...prev, category_id: String(firstCategory.id), purpose: firstPurpose }));
    }
  }, [categories.data?.items, form.category_id]);

  useEffect(() => {
    const firstSport = sports.data?.items?.[0];
    if (firstSport && !sports.data.items.some((sport) => String(sport.id) === String(form.sport_id))) {
      setForm((prev) => ({ ...prev, sport_id: String(firstSport.id) }));
    }
  }, [sports.data?.items, form.sport_id]);

  useEffect(() => {
    if (purposeMode === CUSTOM_PURPOSE || purposeOptions.includes(purposeMode)) return;
    const nextPurpose = purposeOptions[0] || initialForm.purpose;
    setPurposeMode(nextPurpose);
    setForm((prev) => ({ ...prev, purpose: nextPurpose }));
  }, [purposeMode, purposeOptions]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
    }
  };

  const toggleEndSchedule = (checked) => {
    setHasEndSchedule(checked);
    if (!checked) {
      setForm((prev) => ({ ...prev, end_date: "", end_time: "" }));
    }
  };

  const updateStartDate = (value) => {
    setForm((prev) => {
      const next = { ...prev, start_date: value };
      if (prev.end_date && value && prev.end_date < value) next.end_date = value;
      return next;
    });
  };

  const updateStartTime = (value) => {
    setForm((prev) => {
      const next = { ...prev, start_time: value };
      if (prev.end_date === prev.start_date && prev.end_time && value && prev.end_time <= value) next.end_time = "";
      return next;
    });
  };

  const updateEndDate = (value) => {
    setForm((prev) => {
      const minEndDate = prev.start_date || today;
      const nextEndDate = value && value < minEndDate ? minEndDate : value;
      const next = { ...prev, end_date: nextEndDate };
      if (nextEndDate === prev.start_date && prev.start_time && prev.end_time && prev.end_time <= prev.start_time) next.end_time = "";
      return next;
    });
  };

  const updateEndTime = (value) => {
    setForm((prev) => {
      if (prev.end_date === prev.start_date && prev.start_time && value && value <= prev.start_time) {
        return { ...prev, end_time: "" };
      }
      return { ...prev, end_time: value };
    });
  };

  const submit = async (event) => {
    event.preventDefault();
    const trimmedPurpose = form.purpose.trim();
    if (!trimmedPurpose) return alert("모집 목적을 선택하거나 입력해주세요.");
    if (hasStartSchedule && (!form.start_date || !form.start_time)) return alert("시작 일정이 있는 모임은 시작일과 시작 시간을 입력해주세요.");
    if (hasEndSchedule && !hasStartSchedule) return alert("종료 일정은 시작 일정이 있을 때만 설정할 수 있습니다.");
    if (hasEndSchedule && (!form.end_date || !form.end_time)) return alert("종료 일정이 있는 모임은 종료일과 종료 시간을 입력해주세요.");
    if (hasEndSchedule && form.end_date < form.start_date) return alert("종료일은 시작일 이후로 선택해주세요.");
    if (hasEndSchedule) {
      const startAt = new Date(combineDateTime(form.start_date, form.start_time));
      const endAt = new Date(combineDateTime(form.end_date, form.end_time));
      if (endAt <= startAt) return alert("종료 시간은 시작 시간 이후로 설정해주세요.");
    }

    const data = await meetingApi.create({
      ...form,
      purpose: trimmedPurpose,
      approval_required: true,
      start_at: hasStartSchedule ? combineDateTime(form.start_date, form.start_time) : null,
      end_at: hasEndSchedule ? combineDateTime(form.end_date, form.end_time) : null,
      meeting_type: hasEndSchedule || !hasStartSchedule ? "regular" : form.meeting_type,
      sport_id: Number(form.sport_id),
      max_participants: Number(form.max_participants)
    });
    navigate(`/meetings/${data.meeting.id}`);
  };

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>모임 만들기</h1>
          <span>PC 화면에서 입력 항목을 한 번에 확인하며 모임을 등록합니다.</span>
        </div>
      </div>

      <form className="desktop-form-panel desktop-meeting-create-form" onSubmit={submit}>
        <section>
          <h2>종목 정보</h2>
          <div className="desktop-form-grid">
            <label>카테고리<select value={form.category_id} onChange={(event) => update("category_id", event.target.value)}>{(categories.data?.items || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
            <label>종목<select required value={form.sport_id} onChange={(event) => update("sport_id", event.target.value)}>{(sports.data?.items || []).map((sport) => <option key={sport.id} value={sport.id}>{sport.name}</option>)}</select></label>
            <label>모임 방식<select value={form.meeting_type} onChange={(event) => update("meeting_type", event.target.value)}><option value="one_time">한 번만 진행</option><option value="regular">반복 진행</option></select></label>
          </div>
        </section>

        <section>
          <h2>기본 정보</h2>
          <div className="desktop-form-grid desktop-form-grid--wide">
            <label><span className="desktop-field-label-row">제목<em>{form.title.length}/{TITLE_MAX_LENGTH}</em></span><input required maxLength={TITLE_MAX_LENGTH} value={form.title} onChange={(event) => updateTitle(event.target.value)} placeholder="예: 여의도 한강 러닝 5km" /></label>
            <label>모집 목적<select value={purposeMode} onChange={(event) => updatePurposeMode(event.target.value)}>{purposeOptions.map((purpose) => <option key={purpose} value={purpose}>{purpose}</option>)}<option value={CUSTOM_PURPOSE}>기타</option></select></label>
            {purposeMode === CUSTOM_PURPOSE && <label className="desktop-form-full">기타 모집 목적<input required maxLength={30} value={form.purpose} onChange={(event) => update("purpose", event.target.value.slice(0, 30))} placeholder="모집 목적을 직접 입력하세요" /></label>}
            <label className="desktop-form-full">설명<textarea required rows="5" value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
          </div>
        </section>

        <section>
          <h2>일정 및 장소</h2>
          <div className="desktop-schedule-toggles">
            <label><input type="checkbox" checked={hasStartSchedule} onChange={(event) => toggleStartSchedule(event.target.checked)} /> 시작 일정 있음</label>
            <label><input type="checkbox" checked={hasEndSchedule} disabled={!hasStartSchedule} onChange={(event) => toggleEndSchedule(event.target.checked)} /> 종료 일정 있음</label>
          </div>
          <div className="desktop-form-grid desktop-meeting-schedule-grid">
            {hasStartSchedule && (
              <fieldset className="desktop-date-time-pair">
                <legend>시작 일정</legend>
                <label>시작일<span className="desktop-icon-input"><CalendarClock size={18} /><input required type="date" min={today} value={form.start_date} onChange={(event) => updateStartDate(event.target.value)} /></span></label>
                <label>시작 시간<span className="desktop-icon-input"><AlarmClock size={18} /><TimeSelect required value={form.start_time} onChange={updateStartTime} /></span></label>
              </fieldset>
            )}
            {hasEndSchedule && (
              <fieldset className="desktop-date-time-pair">
                <legend>종료 일정</legend>
                <label>종료일<span className="desktop-icon-input"><CalendarClock size={18} /><input required type="date" min={form.start_date || today} value={form.end_date} onChange={(event) => updateEndDate(event.target.value)} /></span></label>
                <label>종료 시간<span className="desktop-icon-input"><AlarmClock size={18} /><TimeSelect required min={form.end_date === form.start_date ? form.start_time : undefined} value={form.end_time} onChange={updateEndTime} /></span></label>
              </fieldset>
            )}
            <label>장소명<input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} /></label>
            <label>주소<input required value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
            <label>최대 인원<input min="2" type="number" value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} /></label>
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
