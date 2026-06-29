import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../components/common/Button.jsx";
import LoadingCards from "../components/common/LoadingCards.jsx";
import MobileHeader from "../components/layout/mobile/MobileHeader.jsx";
import DesktopHostVote from "../components/host/desktop/DesktopHostVote.jsx";
import { meetingApi } from "../api/meetingApi";
import { useAsync } from "../hooks/useAsync";
import { useResponsive } from "../hooks/useResponsive";

function HostVotePage() {
  const { isMobile } = useResponsive();
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ title: "", options: "찬성, 반대" });
  const votes = useAsync(() => meetingApi.votes(meetingId), [meetingId, refreshKey]);

  if (!isMobile) return <DesktopHostVote />;

  const submit = async (event) => {
    event.preventDefault();
    await meetingApi.createVote(meetingId, {
      title: form.title,
      options: form.options.split(",").map((item) => item.trim()).filter(Boolean)
    });
    setForm({ title: "", options: "찬성, 반대" });
    setRefreshKey((value) => value + 1);
  };

  return (
    <>
      <MobileHeader title="투표 관리" />
      <section className="detail-card">
        <h2>투표 생성</h2>
        <form className="review-form" onSubmit={submit}>
          <label>제목<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <label>선택지<input required value={form.options} onChange={(event) => setForm({ ...form, options: event.target.value })} /></label>
          <Button type="submit">투표 등록</Button>
        </form>
      </section>
      <section className="detail-card">
        <h2>진행 중인 투표</h2>
        {votes.loading ? (
          <LoadingCards count={1} />
        ) : (
          <div className="vote-list">
            {(votes.data?.items || []).map((vote) => (
              <article key={vote.id}>
                <strong>{vote.title}</strong>
                <div>{vote.options.map((option) => <span key={option.id}>{option.text} · {option.response_count}</span>)}</div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default HostVotePage;
