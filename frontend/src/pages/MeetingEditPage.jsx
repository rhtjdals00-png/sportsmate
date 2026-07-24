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
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!detail.data?.meeting) return;
    const meeting = detail.data.meeting;
    setForm({
      sport_id: meeting.sport.id,
      title: meeting.title,
      description: meeting.description,
      meeting_type: meeting.meeting_type,
      is_lesson: meeting.is_lesson || false,
      purpose: meeting.purpose,
      location_name: meeting.location_name,
      address: meeting.address,
      start_at: meeting.start_at?.slice(0, 16),
      end_at: meeting.end_at?.slice(0, 16) || "",
      max_participants: meeting.max_participants
    });
  }, [detail.data]);

  const update = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const isTimeInvalid = Boolean(form && form.start_at && form.end_at && new Date(form.end_at) <= new Date(form.start_at));

  const handleStartAtChange = (startVal) => {
    if (!startVal) {
      setForm((prev) => ({ ...prev, start_at: startVal }));
      return;
    }
    const startDate = new Date(startVal);
    startDate.setHours(startDate.getHours() + 1);
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, "0");
    const day = String(startDate.getDate()).padStart(2, "0");
    const hours = String(startDate.getHours()).padStart(2, "0");
    const minutes = String(startDate.getMinutes()).padStart(2, "0");
    const newEndAt = `${year}-${month}-${day}T${hours}:${minutes}`;
    setForm((prev) => ({
      ...prev,
      start_at: startVal,
      end_at: newEndAt
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (isTimeInvalid || submitting) return;
    setSubmitting(true);
    try {
      const data = await meetingApi.update(meetingId, {
        ...form,
        sport_id: Number(form.sport_id),
        max_participants: Number(form.max_participants)
      });
      navigate(`/meetings/${data.meeting.id}`);
    } catch (err) {
      alert(err.response?.data?.message || "수정에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
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
        
        {form.meeting_type === "regular" && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px', background: '#f8fafc', borderRadius: '8px', marginBottom: '16px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.is_lesson} onChange={(e) => update("is_lesson", e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
            <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>기간이 정해진 강습 형태입니다</span>
          </label>
        )}
        
        <label>모집 목적<input value={form.purpose} onChange={(event) => update("purpose", event.target.value)} /></label>
        <label>장소명<input required value={form.location_name} onChange={(event) => update("location_name", event.target.value)} /></label>
        <label>주소<input required value={form.address} onChange={(event) => update("address", event.target.value)} /></label>
        {form.is_lesson && (
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e293b' }}>📅 강습 기간 설정</h4>
            <p style={{ margin: '0 0 0 0', fontSize: '11px', color: '#64748b' }}>강습 전체 기간과 진행 요일/시간을 확인하세요.</p>
          </div>
        )}
        <label>{form.is_lesson ? "강습 시작 일정" : "시작 시간"}<input required type="datetime-local" value={form.start_at} onChange={(event) => handleStartAtChange(event.target.value)} /></label>
        <label>
          {form.is_lesson ? "강습 종료 일정" : "종료 시간"}
          <input type="datetime-local" value={form.end_at} onChange={(event) => update("end_at", event.target.value)} />
          {isTimeInvalid && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>종료 시간은 시작 시간 이후여야 합니다.</span>}
        </label>
        <label>정원<input type="number" min="2" max="50" value={form.max_participants} onChange={(event) => update("max_participants", event.target.value)} /></label>
        <Button type="submit" disabled={isTimeInvalid || submitting}>{submitting ? "저장 중..." : "수정 저장"}</Button>
      </form>
    </>
  );
}

export default MeetingEditPage;
