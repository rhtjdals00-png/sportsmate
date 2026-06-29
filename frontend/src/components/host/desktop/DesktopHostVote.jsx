import { useState } from "react";
import { useParams } from "react-router-dom";
import Button from "../../common/Button.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { meetingApi } from "../../../api/meetingApi";
import { useAsync } from "../../../hooks/useAsync";

function DesktopHostVote() {
  const { meetingId } = useParams();
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ title: "", options: "찬성, 반대" });
  const votes = useAsync(() => meetingApi.votes(meetingId), [meetingId, refreshKey]);

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
    <div className="desktop-page">
      <div className="screen-title">
        <div>
          <h1>투표 관리</h1>
          <span>방장이 투표를 만들고 결과를 확인하는 화면입니다.</span>
        </div>
      </div>
      <div className="desktop-two-column">
        <section className="page-card">
          <div className="section-head"><h2>투표 생성</h2></div>
          <form className="review-form" onSubmit={submit}>
            <label>제목<input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
            <label>선택지<input required value={form.options} onChange={(event) => setForm({ ...form, options: event.target.value })} /></label>
            <Button type="submit">투표 등록</Button>
          </form>
        </section>
        <section className="page-card">
          <div className="section-head"><h2>진행 중인 투표</h2><button className="primary-small" type="button">+ 새 투표 생성</button></div>
          {votes.loading ? (
            <LoadingCards count={1} />
          ) : (
            <table className="flow-table">
              <thead>
                <tr>
                  <th>투표 제목</th>
                  <th>선택지</th>
                  <th>참여 수</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {(votes.data?.items || []).map((vote) => (
                  <tr key={vote.id}>
                    <td>{vote.title}</td>
                    <td>{vote.options.map((option) => option.text).join(" / ")}</td>
                    <td>{vote.options.reduce((sum, option) => sum + option.response_count, 0)}</td>
                    <td><span className="status wait">진행중</span></td>
                  </tr>
                ))}
                {!votes.data?.items?.length && (
                  <tr><td colSpan="4">진행 중인 투표가 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}

export default DesktopHostVote;
