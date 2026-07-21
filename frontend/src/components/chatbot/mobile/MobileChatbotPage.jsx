import { ArrowLeft, Bot, CloudSun, MessageSquare, Plus, Send, Trash2, User, Edit2, Check, X, CalendarDays, ArrowRight, Search, Headphones } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { chatbotApi } from "../../../api/chatbotApi";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

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
  return /내\s*(주변|근처|위치)|현재\s*위치|주변\s*모임|날씨|기온|온도|강수|비\s*(올|와)|눈\s*올|우산|습도|풍속|미세먼지|예보/.test(content || "");
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
  if (type === "support") return <Headphones size={15} />;
  if (type === "weather") return <CloudSun size={15} />;
  return <ArrowRight size={15} />;
}

function displayMessageContent(content) {
  return String(content || "")
    .split("\n")
    .filter((line) => !line.trim().startsWith("참고한 정보"))
    .join("\n")
    .trim();
}

function MobileChatbotPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [savingSessionId, setSavingSessionId] = useState(null);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBeforeId, setNextBeforeId] = useState(null);
  const [loadingOlder, setLoadingOlder] = useState(false);

  const messagesEndRef = useRef(null);

  const handleStartEdit = (e, session) => {
    e.stopPropagation();
    setEditingSessionId(session.id);
    setEditTitle(session.title);
  };

  const handleSaveEdit = async (sessionId) => {
    if (savingSessionId === sessionId) return;
    if (!editTitle.trim()) {
      setEditingSessionId(null);
      return;
    }
    setSavingSessionId(sessionId);
    try {
      await chatbotApi.updateSession(sessionId, { title: editTitle.trim() });
      setEditingSessionId(null);
      await loadSessions();
    } catch (err) {
      console.error("세션 제목 수정 실패:", err);
      setEditingSessionId(null);
    } finally {
      setSavingSessionId(null);
    }
  };

  const handleCancelEdit = (e) => {
    if (e) e.stopPropagation();
    setEditingSessionId(null);
    setEditTitle("");
  };

  // 1. 세션 목록 로드
  const loadSessions = async (selectFirst = false) => {
    try {
      const data = await chatbotApi.sessions();
      const items = data.items || [];
      setSessions(items);

      if (items.length > 0) {
        if (selectFirst || !currentSessionId) {
          // 첫 번째 세션 선택
          setCurrentSessionId(items[0].id);
        }
      } else {
        // 세션이 아예 없으면 기본 세션 하나 생성
        await handleNewSession();
      }
    } catch (err) {
      console.error("세션 목록 로드 실패:", err);
    }
  };

  // 2. 메시지 목록 로드
  const loadMessages = async (sessionId) => {
    if (!sessionId) return;
    try {
      const data = await chatbotApi.messages(sessionId, { limit: 40 });
      setMessages(data.items || []);
      setHasMoreMessages(Boolean(data.has_more));
      setNextBeforeId(data.next_before_id || null);
    } catch (err) {
      console.error("메시지 조회 실패:", err);
    }
  };

  // 2.5 이전 메시지 로드 (페이징)
  const loadOlderMessages = async () => {
    if (!currentSessionId || !hasMoreMessages || !nextBeforeId || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const data = await chatbotApi.messages(currentSessionId, { limit: 40, before_id: nextBeforeId });
      setMessages((current) => [...(data.items || []), ...current]);
      setHasMoreMessages(Boolean(data.has_more));
      setNextBeforeId(data.next_before_id || null);
    } catch (err) {
      console.error("이전 메시지 로드 실패:", err);
    } finally {
      setLoadingOlder(false);
    }
  };

  // 3. 새 대화 시작
  const handleNewSession = async () => {
    try {
      const newSession = await chatbotApi.createSession({ title: "새로운 대화" });
      setCurrentSessionId(newSession.id);
      setSidebarOpen(false);
      setMessages([]);
      setHasMoreMessages(false);
      setNextBeforeId(null);
      await loadSessions();
    } catch (err) {
      console.error("새 대화 생성 실패:", err);
    }
  };

  // 4. 메시지 전송
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || sending || !currentSessionId) return;

    const userText = inputText.trim();
    setInputText("");
    setSending(true);

    const tempUserMsg = {
      id: Date.now(),
      role: "user",
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const location = isMyNearbyRequest(userText) ? await requestBrowserLocation() : null;
      const res = await chatbotApi.sendMessage(currentSessionId, { content: userText, location });
      
      if (res.bot_message) {
        setMessages((prev) => {
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          const botMsg = {
            ...res.bot_message,
            actions: res.actions || res.bot_message.actions || []
          };
          return [...filtered, res.user_message, botMsg];
        });
      }
      await loadSessions();
    } catch (err) {
      console.error("메시지 전송 실패:", err);
    } finally {
      setSending(false);
    }
  };

  // 5. 세션 삭제
  const handleDeleteSession = async (e, sessionId) => {
    e.stopPropagation();
    if (!window.confirm("이 대화방을 삭제하시겠습니까?")) return;

    try {
      await chatbotApi.deleteSession(sessionId);
      if (currentSessionId === sessionId) {
        const remaining = sessions.filter((s) => s.id !== sessionId);
        if (remaining.length > 0) {
          setCurrentSessionId(remaining[0].id);
        } else {
          setCurrentSessionId(null);
        }
      }
      await loadSessions(true);
    } catch (err) {
      console.error("세션 삭제 실패:", err);
    }
  };

  // 초기 로드
  useEffect(() => {
    loadSessions(true);
  }, []);

  // 세션 변경 시 메시지 로드
  useEffect(() => {
    if (currentSessionId) {
      loadMessages(currentSessionId);
    } else {
      setMessages([]);
    }
  }, [currentSessionId]);

  // 메시지 리스트 하단 스크롤 자동 이동
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const currentSession = sessions.find((s) => s.id === currentSessionId);
  const sessionTitle = currentSession ? currentSession.title : "AI 챗봇";

  const quickPrompts = [
    "내 주변 모임 알려줘",
    "내 일정 알려줘",
    "나한테 맞는 모임 추천해줘",
    "한강 근처 러닝 모임 찾아줘",
  ];

  const quickActions = [
    { type: "schedule", label: "참여 중인 모임", href: "/mypage?panel=joined" },
    { type: "support", label: "고객센터 문의하기", href: "/support" },
  ];

  return (
    <div className="mobile-chatbot-container">
      {/* 모바일 헤더 */}
      <MobileHeader
        title={sessionTitle}
        showBack={true}
        actions={
          <div className="mobile-header__actions">
            <button
              type="button"
              className="mobile-header__session-list-btn"
              onClick={() => setSidebarOpen(true)}
              aria-label="이전 대화 목록"
            >
              <MessageSquare size={20} />
            </button>
          </div>
        }
      />

      {/* 대화 영역 */}
      <div className="mobile-chatbot-chat-area">
        {messages.length === 0 ? (
          <div className="mobile-chatbot-welcome">
            <div className="mobile-chatbot-welcome-icon">
              <img src="/img/sportsmate_bot.png" alt="sportsmate bot" />
            </div>
            <h3>스포츠메이트 AI 챗봇</h3>
            <p>스포츠 모임 정보, 매칭, 장소 추천 등 궁금한 점을 질문해보세요!</p>
            <div className="mobile-chatbot-quick-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', margin: '20px 0 10px 0' }}>
              {quickActions.map((action) => (
                <Link key={action.label} to={action.href} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: '#f8fafc', border: '1px solid #e2e8f0',
                  padding: '8px 12px', borderRadius: '20px',
                  fontSize: '13px', color: '#334155', textDecoration: 'none',
                  fontWeight: '600'
                }}>
                  <ChatbotActionIcon type={action.type} />
                  <span>{action.label}</span>
                </Link>
              ))}
            </div>
            <div className="mobile-chatbot-quick-prompts">
              {quickPrompts.map((prompt) => (
                <button key={prompt} type="button" onClick={() => setInputText(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mobile-chatbot-message-list">
            {hasMoreMessages && messages.length ? (
              <button className="mobile-chatbot-load-more" type="button" onClick={loadOlderMessages} disabled={loadingOlder}>
                {loadingOlder ? "불러오는 중..." : "이전 대화 더 보기"}
              </button>
            ) : null}
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const actions = getMessageActions(msg);
              return (
                <div
                  key={msg.id}
                  className={`mobile-chatbot-bubble-row ${
                    isUser ? "mobile-chatbot-bubble-row--user" : "mobile-chatbot-bubble-row--bot"
                  }`}
                >
                  {!isUser && (
                    <div className="mobile-chatbot-bubble-avatar">
                      <img src="/img/sportsmate_bot.png" alt="sportsmate bot" />
                    </div>
                  )}
                  <div className="mobile-chatbot-bubble-wrapper">
                    {!isUser && <span className="mobile-chatbot-bubble-name">AI 비서</span>}
                    <div className="mobile-chatbot-bubble-bubble">
                      <p>{displayMessageContent(msg.content)}</p>
                      {!isUser && actions.length ? (
                        <div className="mobile-chatbot-message-actions">
                          {actions.map((action) => (
                            <Link key={`${msg.id}-${action.type}-${action.href}`} to={action.href} className="mobile-chatbot-action-btn">
                              <ChatbotActionIcon type={action.type} />
                              <span>{action.label}</span>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </div>
                    <time className="mobile-chatbot-bubble-time">
                      {formatChatTime(msg.created_at)}
                    </time>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 입력 영역 */}
      <form className="mobile-chatbot-input-bar" onSubmit={handleSendMessage}>
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="AI에게 무엇이든 물어보세요..."
          disabled={sending || !currentSessionId}
        />
        <button type="submit" disabled={!inputText.trim() || sending || !currentSessionId}>
          <Send size={18} />
        </button>
      </form>

      {/* 세션 목록 드로어 (사이드바) */}
      {sidebarOpen && (
        <div className="mobile-chatbot-sidebar-overlay" onClick={() => setSidebarOpen(false)}>
          <div className="mobile-chatbot-sidebar" onClick={(e) => e.stopPropagation()}>
            <div className="mobile-chatbot-sidebar-header">
              <h3>대화 목록</h3>
              <button
                type="button"
                className="mobile-chatbot-new-chat-btn"
                onClick={handleNewSession}
              >
                <Plus size={16} />
                <span>새 대화</span>
              </button>
            </div>
            <div className="mobile-chatbot-sidebar-list">
              {sessions.map((s) => (
                <div
                  key={s.id}
                  className={`mobile-chatbot-sidebar-item ${
                    s.id === currentSessionId ? "mobile-chatbot-sidebar-item--active" : ""
                  }`}
                  onClick={() => {
                    setCurrentSessionId(s.id);
                    setSidebarOpen(false);
                  }}
                >
                  <MessageSquare size={16} />
                  {editingSessionId === s.id ? (
                    <>
                      <input
                        type="text"
                        className="mobile-chatbot-sidebar-item-input"
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSaveEdit(s.id);
                          } else if (e.key === "Escape") {
                            handleCancelEdit();
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                        autoFocus
                      />
                      <div className="mobile-chatbot-sidebar-item-actions" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="mobile-chatbot-sidebar-item-save"
                          onClick={() => handleSaveEdit(s.id)}
                          aria-label="저장"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          className="mobile-chatbot-sidebar-item-cancel"
                          onClick={handleCancelEdit}
                          aria-label="취소"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="mobile-chatbot-sidebar-item-title">
                        {s.title || "대화방"}
                      </span>
                      <button
                        type="button"
                        className="mobile-chatbot-sidebar-item-edit"
                        onClick={(e) => handleStartEdit(e, s)}
                        aria-label="이름 수정"
                      >
                        <Edit2 size={13} />
                      </button>
                      <button
                        type="button"
                        className="mobile-chatbot-sidebar-item-delete"
                        onClick={(e) => handleDeleteSession(e, s.id)}
                        aria-label="삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MobileChatbotPage;
