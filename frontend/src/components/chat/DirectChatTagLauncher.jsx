import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatApi } from "../../api/chatApi";
import { reportApi } from "../../api/reportApi";

const actionLabel = {
  room: "1:1 톡 시작",
  request: "대화 요청 보내기",
  request_pending: "수락 대기 중",
  request_received: "받은 요청 확인",
  denied: "상대방이 요청을 받지 않아요",
};

export default function DirectChatTagLauncher({ compact = false, onChanged, openRequests = false }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("find");
  const [tag, setTag] = useState("");
  const [intro, setIntro] = useState("");
  const [result, setResult] = useState(null);
  const [requests, setRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const incomingCount = useMemo(
    () => requests.filter((item) => item.direction === "incoming").length,
    [requests]
  );

  const loadRequests = async () => {
    try {
      const [requestData, blockData] = await Promise.all([
        chatApi.directRequests(),
        chatApi.blockedDirectUsers(),
      ]);
      setRequests(requestData.items || []);
      setBlockedUsers(blockData.items || []);
    } catch {
      setRequests([]);
      setBlockedUsers([]);
    }
  };

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    if (open) loadRequests();
  }, [open]);

  useEffect(() => {
    if (!openRequests) return;
    setTab("requests");
    setOpen(true);
  }, [openRequests]);

  const search = async (event) => {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setResult(null);
    try {
      const data = await chatApi.findDirectUserByTag(tag);
      setResult(data.user);
    } catch (error) {
      setMessage(error.response?.data?.message || "사용자를 찾지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const contact = async () => {
    if (!result || result.contact_action === "denied") return;
    if (result.contact_action === "request_received") {
      setTab("requests");
      return;
    }
    if (result.contact_action === "request_pending") return;
    setBusy(true);
    setMessage("");
    try {
      const data = await chatApi.contactDirectUserByTag({ tag: result.user_tag, message: intro });
      if (data.kind === "room" && data.room?.id) {
        setOpen(false);
        onChanged?.();
        navigate(`/chats/direct/${data.room.id}`);
        return;
      }
      setMessage("대화 요청을 보냈습니다. 상대방이 수락하면 채팅방이 열립니다.");
      setIntro("");
      await loadRequests();
    } catch (error) {
      setMessage(error.response?.data?.message || "대화를 시작하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (requestId, action) => {
    setBusy(true);
    setMessage("");
    try {
      const data = await chatApi.respondDirectRequest(requestId, action);
      await loadRequests();
      onChanged?.();
      if (action === "accept" && data.room?.id) {
        setOpen(false);
        navigate(`/chats/direct/${data.room.id}`);
      }
    } catch (error) {
      setMessage(error.response?.data?.message || "요청을 처리하지 못했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const block = async (target) => {
    if (!window.confirm(`${target.nickname || "이 사용자"}님을 차단할까요? 이후 대화 요청과 메시지를 받을 수 없습니다.`)) return;
    try {
      await chatApi.blockDirectUser(target.id);
      setResult(null);
      setMessage("사용자를 차단했습니다.");
      await loadRequests();
    } catch (error) {
      setMessage(error.response?.data?.message || "차단하지 못했습니다.");
    }
  };

  const report = async (target) => {
    const detail = window.prompt("신고 사유를 5자 이상 입력해주세요.");
    if (!detail) return;
    try {
      await reportApi.create({ target_type: "user", target_id: target.id, reason: "1:1 대화 요청", reason_detail: detail });
      setMessage("신고가 접수되었습니다.");
    } catch (error) {
      setMessage(error.response?.data?.message || "신고하지 못했습니다.");
    }
  };

  const unblock = async (target) => {
    try {
      await chatApi.unblockDirectUser(target.id);
      setMessage(`${target.nickname || "사용자"}님의 차단을 해제했습니다.`);
      await loadRequests();
    } catch (error) {
      setMessage(error.response?.data?.message || "차단을 해제하지 못했습니다.");
    }
  };

  return (
    <>
      <div className={`direct-tag-launcher-group ${compact ? "is-compact" : ""}`}>
        <button
          className={`direct-tag-launcher ${compact ? "is-compact" : ""}`}
          type="button"
          onClick={() => {
            setTab("find");
            setOpen(true);
          }}
        >
          <span>＋</span>태그 검색 / 대화 요청
          {incomingCount ? <i>{incomingCount}</i> : null}
        </button>
      </div>
      {open ? (
        <div className="direct-tag-modal" role="dialog" aria-modal="true" aria-label="태그로 1:1 톡 보내기">
          <button className="direct-tag-modal__backdrop" type="button" onClick={() => setOpen(false)} aria-label="닫기" />
          <section>
            <header>
              <div><strong>태그로 1:1 톡</strong><small>상대방의 고유 태그를 정확히 입력해주세요.</small></div>
              <button type="button" onClick={() => setOpen(false)}>×</button>
            </header>
            <nav>
              <button className={tab === "find" ? "active" : ""} type="button" onClick={() => setTab("find")}>태그 검색</button>
              <button className={tab === "requests" ? "active" : ""} type="button" onClick={() => setTab("requests")}>대화 요청 {incomingCount ? `(${incomingCount})` : ""}</button>
            </nav>
            {tab === "find" ? (
              <>
                <form className="direct-tag-search" onSubmit={search}>
                  <span>#</span>
                  <input value={tag} onChange={(event) => setTag(event.target.value.replace(/^#/, ""))} maxLength={4} placeholder="고유 태그" autoFocus />
                  <button type="submit" disabled={busy}>검색</button>
                </form>
                {result ? (
                  <article className="direct-tag-result">
                    {result.profile_image_url ? <img src={result.profile_image_url} alt="" /> : <span>{(result.nickname || "?").slice(0, 1)}</span>}
                    <div>
                      <strong>{result.nickname} <em>#{result.user_tag}</em></strong>
                      <small>{result.region || "지역 미설정"}</small>
                      {result.bio ? <p>{result.bio}</p> : null}
                    </div>
                    {result.contact_action === "request" ? (
                      <textarea value={intro} onChange={(event) => setIntro(event.target.value.slice(0, 500))} placeholder="간단한 인사말을 남겨주세요. (선택)" />
                    ) : null}
                    <button className="primary" type="button" onClick={contact} disabled={busy || ["denied", "request_pending"].includes(result.contact_action)}>
                      {actionLabel[result.contact_action] || "1:1 톡 시작"}
                    </button>
                    <div className="direct-tag-result__safety">
                      <button type="button" onClick={() => block(result)}>차단</button>
                      <button type="button" onClick={() => report(result)}>신고</button>
                    </div>
                  </article>
                ) : null}
              </>
            ) : (
              <div className="direct-request-list">
                {requests.length ? requests.map((item) => (
                  <article key={item.id}>
                    <div>
                      <strong>{item.counterpart?.nickname || "사용자"} <em>#{item.counterpart?.user_tag}</em></strong>
                      <small>{item.direction === "incoming" ? "나에게 보낸 요청" : "내가 보낸 요청 · 수락 대기 중"}</small>
                      {item.message ? <p>{item.message}</p> : null}
                    </div>
                    {item.direction === "incoming" ? (
                      <span>
                        <button className="direct-request-reject" type="button" onClick={() => respond(item.id, "reject")} disabled={busy}>거절</button>
                        <button className="primary" type="button" onClick={() => respond(item.id, "accept")} disabled={busy}>수락</button>
                        <button type="button" onClick={() => block(item.counterpart)}>차단</button>
                        <button type="button" onClick={() => report(item.counterpart)}>신고</button>
                      </span>
                    ) : null}
                  </article>
                )) : <p className="direct-request-list__empty">대기 중인 대화 요청이 없습니다.</p>}
                {blockedUsers.length ? (
                  <>
                    <h4>차단한 사용자</h4>
                    {blockedUsers.map((target) => (
                      <article key={`blocked-${target.id}`}>
                        <div><strong>{target.nickname} <em>#{target.user_tag}</em></strong><small>대화 및 요청 차단 중</small></div>
                        <span><button type="button" onClick={() => unblock(target)}>차단 해제</button></span>
                      </article>
                    ))}
                  </>
                ) : null}
              </div>
            )}
            {message ? <p className="direct-tag-modal__message">{message}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
