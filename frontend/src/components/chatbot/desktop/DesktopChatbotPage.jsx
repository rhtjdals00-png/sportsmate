import { ArrowRight, Bot, CalendarDays, MessageSquare, Plus, Search, Send, Trash2, User } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { chatbotApi } from "../../../api/chatbotApi";

const CHATBOT_MESSAGE_PAGE_SIZE = 40;

function formatChatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

function isMyNearbyRequest(content) {
  return /내\s*(주변|근처|위치)|현재\s*위치|주변\s*모임/.test(content || "");
}

function requestBrowserLocation() {
  if (!navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 },
    );
  });
}

function getMessageActions(message) {
  if (message.role === "user") return [];
  if (Array.isArray(message.actions) && message.actions.length) return message.actions;
  return [];
}

function ChatbotActionIcon({ type }) {
  if (type === "schedule") return <CalendarDays size={15} />;
  if (type === "meeting_search") return <Search size={15} />;
  return <ArrowRight size={15} />;
}

function displayMessageContent(content) {
  return String(content || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("참고한 정보"))
    .join("\n")
    .trim();
}

function DesktopChatbotPage() {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [memorySummary, setMemorySummary] = useState("");
  const [error, setError] = useState("");
  const messagesEndRef = useRef(null);
  const skipNextScrollRef = useRef(false);

  const loadSessions = async (selectFirst = false) => {
    const data = await chatbotApi.sessions();
    const items = data.items || [];
    setSessions(items);
    if (items.length && (selectFirst || !currentSessionId)) {
      setCurrentSessionId(items[0].id);
    }
    if (!items.length) {
      const session = await chatbotApi.createSession({ title: "새로운 대화" });
      setSessions([session]);
      setCurrentSessionId(session.id);
    }
  };

  const loadMessages = async (sessionId) => {
    if (!sessionId) return;
    const data = await chatbotApi.messages(sessionId, { limit: CHATBOT_MESSAGE_PAGE_SIZE });
    setMessages(data.items || []);
    setHasMoreMessages(Boolean(data.has_more));
    setNextBeforeId(data.next_before_id || null);
  };

  const loadOlderMessages = async () => {
    if (!currentSessionId || !hasMoreMessages || !nextBeforeId || loadingOlder) return;
    setLoadingOlder(true);
    setError("");
    try {
      const data = await chatbotApi.messages(currentSessionId, { limit: CHATBOT_MESSAGE_PAGE_SIZE, before_id: nextBeforeId });
      skipNextScrollRef.current = true;
      setMessages((current) => [...(data.items || []), ...current]);
      setHasMoreMessages(Boolean(data.has_more));
      setNextBeforeId(data.next_before_id || null);
    } catch {
      setError("이전 대화를 불러오지 못했습니다.");
    } finally {
      setLoadingOlder(false);
    }
  };

  const loadMemory = async () => {
    try {
      const data = await chatbotApi.memory?.();
      setMemorySummary(data?.memory?.summary || "아직 쌓인 맞춤 정보가 없습니다.");
    } catch {
      setMemorySummary("맞춤 정보를 불러오지 못했습니다.");
    }
  };

  useEffect(() => {
    loadSessions(true).catch(() => setError("대화 목록을 불러오지 못했습니다."));
    loadMemory();
  }, []);

  useEffect(() => {
    loadMessages(currentSessionId).catch(() => setError("메시지를 불러오지 못했습니다."));
  }, [currentSessionId]);

  useEffect(() => {
    if (skipNextScrollRef.current) {
      skipNextScrollRef.current = false;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewSession = async () => {
    setError("");
    const session = await chatbotApi.createSession({ title: "새로운 대화" });
    setSessions((current) => [session, ...current]);
    setCurrentSessionId(session.id);
    setMessages([]);
    setHasMoreMessages(false);
    setNextBeforeId(null);
  };

  const handleDeleteSession = async (event, sessionId) => {
    event.stopPropagation();
    if (!window.confirm("이 대화방을 삭제할까요?")) return;
    await chatbotApi.deleteSession(sessionId);
    const remaining = sessions.filter((session) => session.id !== sessionId);
    setSessions(remaining);
    setCurrentSessionId(remaining[0]?.id || null);
    if (!remaining.length) await handleNewSession();
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    const content = inputText.trim();
    if (!content || !currentSessionId || sending) return;

    const tempMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setInputText("");
    setSending(true);
    setError("");
    setMessages((current) => [...current, tempMessage]);

    try {
      const location = isMyNearbyRequest(content) ? await requestBrowserLocation() : null;
      const response = await chatbotApi.sendMessage(currentSessionId, { content, location });
      const botMessage = response.bot_message
        ? { ...response.bot_message, actions: response.actions || response.bot_message.actions || [] }
        : null;
      setMessages((current) => [
        ...current.filter((message) => message.id !== tempMessage.id),
        response.user_message,
        botMessage,
      ].filter(Boolean));
      if (response.memory?.summary) setMemorySummary(response.memory.summary);
      await loadSessions();
    } catch (sendError) {
      setError(sendError.response?.data?.message || "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const quickPrompts = [
    "내 주변 모임 알려줘",
    "내 일정 알려줘",
    "나한테 맞는 모임 추천해줘",
    "한강 근처 러닝 모임 찾아줘",
  ];

  return (
    <section className="desktop-page desktop-prototype desktop-chatbot-page">
      <div className="desktop-chatbot-shell">
        <aside className="desktop-chatbot-sidebar">
          <div className="desktop-chatbot-sidebar__header">
            <div>
              <h2>AI 비서</h2>
              <p>대화 기록과 프로필을 바탕으로 맞춤 추천을 제공합니다.</p>
            </div>
            <button type="button" onClick={handleNewSession} aria-label="새 대화"><Plus size={18} /></button>
          </div>
          <div className="desktop-chatbot-memory">
            <strong>맞춤 메모리</strong>
            <span>{memorySummary}</span>
          </div>
          <div className="desktop-chatbot-session-list">
            {sessions.map((session) => (
              <div key={session.id} className={`desktop-chatbot-session ${session.id === currentSessionId ? "is-active" : ""}`}>
                <button type="button" onClick={() => setCurrentSessionId(session.id)}>
                  <MessageSquare size={17} />
                  <span>
                    <b>{session.title || "새로운 대화"}</b>
                    <small>{session.last_message?.content || "아직 대화가 없습니다."}</small>
                  </span>
                  <em>{formatChatTime(session.updated_at || session.created_at)}</em>
                </button>
                <button type="button" className="desktop-chatbot-session__delete" onClick={(event) => handleDeleteSession(event, session.id)} aria-label="대화 삭제"><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
        </aside>

        <main className="desktop-chatbot-room">
          <header className="desktop-chatbot-room__header">
            <span><Bot size={20} /></span>
            <div>
              <strong>{sessions.find((session) => session.id === currentSessionId)?.title || "새로운 대화"}</strong>
              <small>모임 추천, 일정 확인, 관심사 기반 안내를 도와드려요.</small>
            </div>
          </header>

          <div className="desktop-chatbot-messages">
            {hasMoreMessages && messages.length ? (
              <button className="desktop-chatbot-load-more" type="button" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? "불러오는 중..." : "이전 대화 더 보기"}
              </button>
            ) : null}
            {!messages.length ? (
              <div className="desktop-chatbot-welcome">
                <Bot size={34} />
                <strong>무엇을 도와드릴까요?</strong>
                <p>SportsMate DB를 보고 내 일정이나 맞춤 모임을 찾아드릴 수 있어요.</p>
                <div>
                  {quickPrompts.map((prompt) => <button key={prompt} type="button" onClick={() => setInputText(prompt)}>{prompt}</button>)}
                </div>
              </div>
            ) : messages.map((message) => {
              const isUser = message.role === "user";
              const actions = getMessageActions(message);
              return (
                <article key={message.id} className={`desktop-chatbot-message ${isUser ? "is-user" : "is-assistant"}`}>
                  <span>{isUser ? <User size={16} /> : <Bot size={16} />}</span>
                  <div>
                    <p>{displayMessageContent(message.content)}</p>
                    {!isUser && actions.length ? (
                      <div className="desktop-chatbot-message__actions">
                        {actions.map((action) => (
                          <Link key={`${message.id}-${action.type}-${action.href}`} to={action.href}>
                            <ChatbotActionIcon type={action.type} />
                            <span>{action.label}</span>
                          </Link>
                        ))}
                      </div>
                    ) : null}
                    <time>{formatChatTime(message.created_at)}</time>
                  </div>
                </article>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {error ? <p className="desktop-chatbot-error">{error}</p> : null}
          <form className="desktop-chatbot-input" onSubmit={handleSendMessage}>
            <input value={inputText} onChange={(event) => setInputText(event.target.value)} placeholder="예: 내 주변 모임 알려줘, 반포 근처 자전거 모임 찾아줘" />
            <button type="submit" disabled={sending || !inputText.trim()}><Send size={18} /></button>
          </form>
        </main>
      </div>
    </section>
  );
}

export default DesktopChatbotPage;
