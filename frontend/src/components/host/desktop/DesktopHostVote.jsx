import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../../common/Button.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";

function formatDeadline(value) {
  if (!value) return "종료일 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function voterName(voter) {
  return voter.nickname || voter.name || "참여자";
}

function DesktopHostVote() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({
    title: "",
    options: ["찬성", "반대"],
    ends_at: "",
    allow_multiple: false,
    is_anonymous: true
  });
  const votes = useAsync(() => meetingApi.votes(meetingId), [meetingId, refreshKey]);

  const submit = async (event) => {
    event.preventDefault();
    await meetingApi.createVote(meetingId, {
      title: form.title.trim(),
      options: form.options.map((item) => item.trim()).filter(Boolean),
      ends_at: form.ends_at || null,
      allow_multiple: form.allow_multiple,
      is_anonymous: form.is_anonymous
    });
    setForm({ title: "", options: ["찬성", "반대"], ends_at: "", allow_multiple: false, is_anonymous: true });
    setRefreshKey((value) => value + 1);
  };

  const updateOption = (index, value) => {
    setForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  return (
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>투표 관리</h1>
          <span>방장이 투표를 만들고 결과를 자세히 확인하는 화면입니다.</span>
        </div>
      </div>
      <div className="desktop-two-column">
        <section className="page-card host-vote-desktop-card">
          <div className="section-head"><h2>투표 생성</h2></div>
          <form className="review-form host-vote-desktop-form" onSubmit={submit}>
            <label>제목<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <div className="host-vote-option-grid">
              {form.options.map((option, index) => (
                <label key={index}>선택지 {index + 1}<input required value={option} onChange={(event) => updateOption(index, event.target.value)} /></label>
              ))}
            </div>
            <button className="ghost-btn" type="button" onClick={() => setForm((current) => ({ ...current, options: [...current.options, ""] }))}>선택지 추가</button>
            <label>투표 종료일자<input type="datetime-local" value={form.ends_at} onChange={(event) => setForm({ ...form, ends_at: event.target.value })} /></label>
            <div className="host-vote-desktop-switches">
              <label><input type="checkbox" checked={form.allow_multiple} onChange={(event) => setForm({ ...form, allow_multiple: event.target.checked })} /> 복수 선택 허용</label>
              <label><input type="checkbox" checked={!form.is_anonymous} onChange={(event) => setForm({ ...form, is_anonymous: !event.target.checked })} /> 공개 투표</label>
            </div>
            <Button type="submit">투표 등록</Button>
          </form>
        </section>
        <section className="page-card host-vote-result-card">
          <div className="section-head"><h2>진행중인 투표</h2><strong>{votes.data?.items?.length || 0}개</strong></div>
          {votes.loading ? (
            <LoadingCards count={1} />
          ) : votes.data?.items?.length ? (
            <div className="host-vote-result-list">
              {(votes.data?.items || []).map((vote) => {
                const total = vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0);
                return (
                  <article key={vote.id}>
                    <header>
                      <div>
                        <strong>{vote.title}</strong>
                        <span>{vote.allow_multiple ? "복수 선택" : "단일 선택"} · {vote.is_anonymous ? "비공개" : "공개"} · {formatDeadline(vote.ends_at)}</span>
                      </div>
                      <b>{total}표</b>
                    </header>
                    <div className="host-vote-result-options">
                      {vote.options.map((option) => {
                        const count = Number(option.response_count || 0);
                        const percent = total ? Math.round((count / total) * 100) : 0;
                        return (
                          <section key={option.id}>
                            <div>
                              <strong>{option.text}</strong>
                              <span>{count}표 · {percent}%</span>
                            </div>
                            <i><b style={{ width: `${percent}%` }} /></i>
                            {!vote.is_anonymous ? (
                              <p>{option.voters?.length ? option.voters.map(voterName).join(", ") : "아직 선택한 참여자가 없습니다."}</p>
                            ) : null}
                          </section>
                        );
                      })}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="empty-schedule">진행중인 투표가 없습니다.</p>
          )}
        </section>
      </div>
    </div>
  );
}

export default DesktopHostVote;
