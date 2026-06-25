import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../api/meetingApi";
import { sportApi } from "../api/sportApi";
import { useAsync } from "../hooks/useAsync";

function MeetingEditPage() {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  const detail = useAsync(() => meetingApi.detail(meetingId), [meetingId]);
  const sports = useAsync(() => sportApi.sports(), []);
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (!detail.data?.meeting) return;
    const meeting = detail.data.meeting;
    setForm({
      sport_id: meeting.sport.id,
      title: meeting.title,
      description: meeting.description,
      meeting_type: meeting.meeting_type,
      purpose: meeting.purpose,
      location_name: meeting.location_name,
      address: meeting.address,
      start_at: meeting.start_at?.slice(0, 16),
      end_at: meeting.end_at?.slice(0, 16) || "",
      max_participants: meeting.max_participants,
      approval_required: meeting.approval_required
    });
  }, [detail.data]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (event) => {
    event.preventDefault();
    const data = await meetingApi.update(meetingId, {
      ...form,
      sport_id: Number(form.sport_id),
      max_participants: Number(form.max_participants)
    });
    navigate(`/meetings/${data.meeting.id}`);
  };

  if (detail.loading || !form) return <LoadingCards count={2} />;

  return (
    <>
      <MobileHeader title="모임 수정" />
      <form className="mobile-form" onSubmit={submit}>
        <label>
          종목
          <select value={form.sport_id} onChange={(event) => update("sport_id", event.target.value)}>
            {(sports.data?.items || []).map((sport) => (
              <option key={sport.id} value={sport.id}>{sport.name}</option>
            ))}
          </select>
        </label>
        <label>제목<input required value={form.title} onChange={(event) => update("title", event.target.value)} /></label>
        <label>설명<textarea required value={form.description} onChange={(event) => update("description", event.target.value)} /></label>
        <label>모집 목적<input value={form.purpose} onChange={(event) => update("purpose", event.target.value)} /></label>
        <label>장소명<input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} /></label>
        <label>주소<input required value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
        <label>시작 시간<input required type="datetime-local" value={form.start_at} onChange={(event) => update("start_at", event.target.value)} /></label>
        <label>종료 시간<input type="datetime-local" value={form.end_at} onChange={(event) => update("end_at", event.target.value)} /></label>
        <label>정원<input type="number" min="2" max="50" value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} /></label>
        <Button type="submit">수정 저장</Button>
      </form>
    </>
  );
}

export default MeetingEditPage;
