import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { meetingApi } from "../../../api/meetingApi";
import { sportApi } from "../../../api/sportApi";
import { useAsync } from "../../../hooks/useAsync";

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

function DesktopMeetingCreate() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const categories = useAsync(() => sportApi.categories(), []);
  const sports = useAsync(
    () => sportApi.sports(form.category_id ? { category_id: form.category_id } : {}),
    [form.category_id]
  );

  useEffect(() => {
    const firstCategory = categories.data?.items?.[0];
    if (!form.category_id && firstCategory) {
      setForm((prev) => ({ ...prev, category_id: String(firstCategory.id) }));
    }
  }, [categories.data?.items, form.category_id]);

  useEffect(() => {
    const firstSport = sports.data?.items?.[0];
    if (firstSport && !sports.data.items.some((sport) => String(sport.id) === String(form.sport_id))) {
      setForm((prev) => ({ ...prev, sport_id: String(firstSport.id) }));
    }
  }, [sports.data?.items, form.sport_id]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const data = await meetingApi.create({
      ...form,
      start_at: combineDateTime(form.start_date, form.start_time),
      end_at: combineDateTime(form.end_date, form.end_time),
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

      <form className="desktop-form-panel" onSubmit={submit}>
        <section>
          <h2>종목 정보</h2>
          <div className="desktop-form-grid">
            <label>
              카테고리
              <select value={form.category_id} onChange={(event) => update("category_id", event.target.value)}>
                {(categories.data?.items || []).map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
            </label>
            <label>
              종목
              <select required value={form.sport_id} onChange={(event) => update("sport_id", event.target.value)}>
                {(sports.data?.items || []).map((sport) => (
                  <option key={sport.id} value={sport.id}>{sport.name}</option>
                ))}
              </select>
            </label>
            <label>
              모임 유형
              <select value={form.meeting_type} onChange={(event) => update("meeting_type", event.target.value)}>
                <option value="one_time">원데이 모임</option>
                <option value="regular">정기 모임</option>
              </select>
            </label>
          </div>
        </section>

        <section>
          <h2>기본 정보</h2>
          <div className="desktop-form-grid desktop-form-grid--wide">
            <label>
              제목
              <input required value={form.title} onChange={(event) => update("title", event.target.value)} />
            </label>
            <label>
              모집 목적
              <input value={form.purpose} onChange={(event) => update("purpose", event.target.value)} />
            </label>
            <label className="desktop-form-full">
              설명
              <textarea required rows="5" value={form.description} onChange={(event) => update("description", event.target.value)} />
            </label>
          </div>
        </section>

        <section>
          <h2>일정 및 장소</h2>
          <div className="desktop-form-grid">
            <label>
              시작일
              <input required type="date" value={form.start_date} onChange={(event) => update("start_date", event.target.value)} />
            </label>
            <label>
              시작 시간
              <input required type="time" value={form.start_time} onChange={(event) => update("start_time", event.target.value)} />
            </label>
            <label>
              종료일
              <input type="date" value={form.end_date} onChange={(event) => update("end_date", event.target.value)} />
            </label>
            <label>
              종료 시간
              <input type="time" value={form.end_time} onChange={(event) => update("end_time", event.target.value)} />
            </label>
            <label>
              장소명
              <input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} />
            </label>
            <label>
              주소
              <input required value={form.address} onChange={(event) => update("address", event.target.value)} />
            </label>
            <label>
              최대 인원
              <input min="1" type="number" value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} />
            </label>
          </div>
        </section>

        <div className="desktop-form-actions">
          <label>
            <input
              type="checkbox"
              checked={form.approval_required}
              onChange={(event) => update("approval_required", event.target.checked)}
            />
            방장 승인 후 참여
          </label>
          <button type="submit">모임 등록</button>
        </div>
      </form>
    </div>
  );
}

export default DesktopMeetingCreate;
