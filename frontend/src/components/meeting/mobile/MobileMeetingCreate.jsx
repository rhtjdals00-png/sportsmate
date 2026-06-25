import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";
import Button from "../../common/Button.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { locationApi } from "../../../api/locationApi";
import { useAsync } from "../../../hooks/useAsync";
import { koreaRegions } from "../../../data/koreaRegions";

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
  start_at: "",
  end_at: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  max_participants: 6,
  approval_required: true
};

const pad = (value) => String(value).padStart(2, "0");

const toDateInputValue = (date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

const toTimeInputValue = (date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

const combineDateTime = (date, time) => date && time ? `${date}T${time}` : "";

const isPastStart = (date, time) => {
  if (!date || !time) return false;
  return new Date(combineDateTime(date, time)).getTime() < Date.now() - 1000;
};

function MobileMeetingCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(1);
  const [addressKeyword, setAddressKeyword] = useState("");
  const [addressResults, setAddressResults] = useState([]);
  const [addressLoading, setAddressLoading] = useState(false);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(() => sportApi.sports(form.category_id ? { category_id: form.category_id } : {}), [form.category_id]);
  const today = toDateInputValue(new Date());
  const nowTime = toTimeInputValue(new Date());
  const selectedRegion = koreaRegions.find((region) => region.name === form.region_sido);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));
  const selectedCategory = useMemo(
    () => (categories.data?.items || []).find((category) => String(category.id) === String(form.category_id)),
    [categories.data?.items, form.category_id]
  );

  useEffect(() => {
    const firstCategory = categories.data?.items?.[0];
    if (!form.category_id && firstCategory) {
      setForm((prev) => ({ ...prev, category_id: String(firstCategory.id), purpose: firstCategory.purpose.split("/")[0].trim() }));
    }
  }, [categories.data?.items, form.category_id]);

  useEffect(() => {
    const firstSport = sports.data?.items?.[0];
    if (firstSport && !sports.data.items.some((sport) => String(sport.id) === String(form.sport_id))) {
      setForm((prev) => ({ ...prev, sport_id: String(firstSport.id) }));
    }
  }, [sports.data?.items, form.sport_id]);

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
    const category = (categories.data?.items || []).find((item) => String(item.id) === String(categoryId));
    setForm((prev) => ({
      ...prev,
      category_id: categoryId,
      sport_id: "",
      purpose: category?.purpose?.split("/")?.[0]?.trim() || prev.purpose
    }));
  };

  const updateRegion = (sidoName, areaName = "") => {
    const regionName = sidoName ? (areaName ? `${sidoName} ${areaName}` : sidoName) : "";
    setForm((prev) => ({
      ...prev,
      region_sido: sidoName,
      region_area: areaName,
      region_sido_code: sidoName,
      region_sigungu_code: areaName,
      address: regionName && !prev.address ? regionName : prev.address
    }));
  };

  const selectAddress = (place) => {
    const title = (place.title || "").replace(/<[^>]+>/g, "");
    const address = place.address || title;
    setForm((prev) => ({
      ...prev,
      location_name: title || address,
      address,
      latitude: place.latitude,
      longitude: place.longitude
    }));
    setAddressKeyword(address);
    setAddressResults([]);
  };

  const updateStartDate = (value) => {
    setForm((prev) => {
      const next = { ...prev, start_date: value };
      if (value === today && prev.start_time && prev.start_time < nowTime) {
        next.start_time = nowTime;
      }
      return next;
    });
  };

  const updateStartTime = (value) => {
    setForm((prev) => ({
      ...prev,
      start_time: prev.start_date === today && value < nowTime ? nowTime : value
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const startAt = combineDateTime(form.start_date, form.start_time);
    const endAt = combineDateTime(form.end_date, form.end_time);
    if (!startAt || isPastStart(form.start_date, form.start_time)) {
      return;
    }
    const data = await meetingApi.create({
      ...form,
      start_at: startAt,
      end_at: endAt,
      sport_id: Number(form.sport_id),
      max_participants: Number(form.max_participants)
    });
    navigate(`/meetings/${data.meeting.id}`);
  };

  return (
    <>
      <MobileHeader title="모임 만들기" />
      <form className="mobile-form" onSubmit={submit}>
        <div className="form-progress">단계 {step}/3</div>
        {step === 1 && (
          <section>
            <label>
              대분류
              <select value={form.category_id} onChange={(event) => updateCategory(event.target.value)}>
                {(categories.data?.items || []).map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              종목
              <select required value={form.sport_id} onChange={(event) => update("sport_id", event.target.value)}>
                {(sports.data?.items || []).map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
            </label>
            {selectedCategory?.purpose && (
              <div className="purpose-pills">
                {selectedCategory.purpose.split("/").map((purpose) => (
                  <button
                    type="button"
                    key={purpose}
                    className={form.purpose === purpose.trim() ? "active" : ""}
                    onClick={() => update("purpose", purpose.trim())}
                  >
                    {purpose.trim()}
                  </button>
                ))}
              </div>
            )}
            <label>
              모임 유형
              <select value={form.meeting_type} onChange={(event) => update("meeting_type", event.target.value)}>
                <option value="one_time">단발 모임</option>
                <option value="regular">정기 모임</option>
              </select>
            </label>
            <label>
              모집 목적
              <input value={form.purpose} onChange={(event) => update("purpose", event.target.value)} />
            </label>
          </section>
        )}
        {step === 2 && (
          <section>
            <label>
              제목
              <input required value={form.title} onChange={(event) => update("title", event.target.value)} />
            </label>
            <label>
              설명
              <textarea required value={form.description} onChange={(event) => update("description", event.target.value)} />
            </label>
          </section>
        )}
        {step === 3 && (
          <section>
            <section className="profile-region-field meeting-region-field">
              <strong>지역</strong>
              <div className="region-inline">
                <select value={form.region_sido} onChange={(event) => updateRegion(event.target.value, "")}>
                  <option value="">전국</option>
                  {koreaRegions.map((region) => (
                    <option key={region.name} value={region.name}>
                      {region.name}
                    </option>
                  ))}
                </select>
                <select value={form.region_area} onChange={(event) => updateRegion(form.region_sido, event.target.value)} disabled={!form.region_sido}>
                  <option value="">전체</option>
                  {(selectedRegion?.areas || []).map((area) => (
                    <option key={area} value={area}>
                      {area}
                    </option>
                  ))}
                </select>
              </div>
            </section>
            <label>
              주소 검색
              <input
                required
                value={addressKeyword || form.address}
                placeholder="주소나 장소명을 입력하세요"
                onChange={(event) => {
                  setAddressKeyword(event.target.value);
                  update("address", event.target.value);
                }}
              />
            </label>
            {(addressLoading || addressResults.length > 0) && (
              <div className="address-result-list">
                {addressLoading ? <span>검색 중입니다.</span> : addressResults.map((place, index) => (
                  <button type="button" key={`${place.title}-${index}`} onClick={() => selectAddress(place)}>
                    <strong>{(place.title || place.address || "").replace(/<[^>]+>/g, "")}</strong>
                    <small>{place.address}</small>
                  </button>
                ))}
              </div>
            )}
            <label>
              장소명
              <input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} />
            </label>
            <div className="date-time-row">
              <label>
                시작 날짜
                <input required type="date" min={today} value={form.start_date} onChange={(event) => updateStartDate(event.target.value)} />
              </label>
              <label>
                시작 시간
                <input
                  required
                  type="time"
                  min={form.start_date === today ? nowTime : undefined}
                  value={form.start_time}
                  onChange={(event) => updateStartTime(event.target.value)}
                />
              </label>
            </div>
            <div className="date-time-row">
              <label>
                종료 날짜
                <input type="date" min={form.start_date || today} value={form.end_date} onChange={(event) => update("end_date", event.target.value)} />
              </label>
              <label>
                종료 시간
                <input
                  type="time"
                  min={form.end_date === form.start_date ? form.start_time : undefined}
                  value={form.end_time}
                  onChange={(event) => update("end_time", event.target.value)}
                />
              </label>
            </div>
            <label>
              정원
              <input
                type="number"
                min="2"
                max="50"
                value={form.max_participants}
                onChange={(event) => update("max_participants", event.target.value)}
              />
            </label>
          </section>
        )}
        <div className="form-actions">
          {step > 1 && <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>이전</Button>}
          {step < 3 ? (
            <Button type="button" onClick={() => setStep(step + 1)}>다음</Button>
          ) : (
            <Button type="submit">모임 등록</Button>
          )}
        </div>
      </form>
    </>
  );
}

export default MobileMeetingCreate;
