import { useState } from "react";
import { useParams } from "react-router-dom";
import { Plus, Trash2, Vote } from "lucide-react";
import Button from "../../../components/common/Button.jsx";
import EmptyState from "../../../components/common/EmptyState.jsx";
import LoadingCards from "../../../components/common/LoadingCards.jsx";
import MobileHeader from "../../../components/layout/mobile/MobileHeader.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";

function MobileHostVote() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ title: "", options: ["찬성", "반대"] });
  const votes = useAsync(() => meetingApi.votes(meetingId), [meetingId, refreshKey]);

  const submit = async (event) => {
    event.preventDefault();
    await meetingApi.createVote(meetingId, {
      title: form.title,
      options: form.options.map((item) => item.trim()).filter(Boolean)
    });
    setForm({ title: "", options: ["찬성", "반대"] });
    setRefreshKey((value) => value + 1);
  };

  const updateOption = (index, value) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  const addOption = () => setForm((current) => ({ ...current, options: [...current.options, ""] }));

  const removeOption = (index) => {
    setForm((current) => ({
      ...current,
      options: current.options.filter((_, optionIndex) => optionIndex !== index)
    }));
  };

  return (
    <>
      <MobileHeader title="투표 관리" />
      <section className="detail-card host-vote-editor">
        <div className="host-section-head">
          <div>
            <span><Vote size={15} />투표</span>
            <h2>참여자 의견을 모아요</h2>
          </div>
          <button type="button" onClick={addOption}><Plus size={17} />선택지</button>
        </div>
        <form className="review-form" onSubmit={submit}>
          <label>제목<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
          <div className="host-vote-options">
            {form.options.map((option, index) => (
              <label key={index}>
                선택지 {index + 1}
                <span>
                  <input required value={option} onChange={(event) => updateOption(index, event.target.value)} />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(index)} aria-label="선택지 삭제"><Trash2 size={16} /></button>
                  )}
                </span>
              </label>
            ))}
          </div>
          <Button type="submit">투표 등록</Button>
        </form>
      </section>
      <section className="detail-card host-vote-history">
        <div className="host-section-head">
          <div>
            <span><Vote size={15} />진행 현황</span>
            <h2>진행 중인 투표</h2>
          </div>
          <strong>{votes.data?.items?.length || 0}개</strong>
        </div>
        {votes.loading ? (
          <LoadingCards count={1} />
        ) : votes.data?.items?.length ? (
          <div className="vote-list">
            {(votes.data?.items || []).map((vote) => (
              <article key={vote.id}>
                <strong>{vote.title}</strong>
                <div>{vote.options.map((option) => <span key={option.id}>{option.text} · {option.response_count}</span>)}</div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="진행 중인 투표가 없습니다." description="코스, 장소, 뒤풀이처럼 참여자 의견이 필요한 주제를 만들어보세요." />
        )}
      </section>
    </>
  );
}

export default MobileHostVote;
