import { ArrowLeft, Bot, MessageSquare, Plus, Send, Trash2, User, Edit2, Check, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { chatbotApi } from "../../../api/chatbotApi";
import MobileHeader from "../../layout/mobile/MobileHeader.jsx";

function formatChatTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
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
      const data = await chatbotApi.messages(sessionId);
      setMessages(data.items || []);
    } catch (err) {
      console.error("메시지 조회 실패:", err);
    }
  };

  // 3. 새 대화 시작
  const handleNewSession = async () => {
    try {
      const newSession = await chatbotApi.createSession({ title: "새로운 대화" });
      setCurrentSessionId(newSession.id);
      setSidebarOpen(false);
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

    // 낙관적 UI 업데이트 (사용자 말풍선 바로 띄우기)
    const tempUserMsg = {
      id: Date.now(),
      role: "user",
      content: userText,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await chatbotApi.sendMessage(currentSessionId, { content: userText });
      
      // 실제 서버 응답으로 메시지 리스트 덮어쓰기 또는 봇 말풍선 추가
      if (res.bot_message) {
        setMessages((prev) => {
          // 낙관적으로 추가했던 tempUserMsg를 실제 서버에서 생성된 user_message로 바꾸고 bot_message 추가
          const filtered = prev.filter((m) => m.id !== tempUserMsg.id);
          return [...filtered, res.user_message, res.bot_message];
        });
      }

      // 첫 메시지 전송 시 세션 제목을 메시지 내용 요약으로 업데이트하기 위해 세션 목록 갱신
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
              <Bot size={40} />
            </div>
            <h3>스포츠메이트 AI 챗봇</h3>
            <p>스포츠 모임 정보, 매칭, 장소 추천 등 궁금한 점을 질문해보세요!</p>
          </div>
        ) : (
          <div className="mobile-chatbot-message-list">
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              return (
                <div
                  key={msg.id}
                  className={`mobile-chatbot-bubble-row ${
                    isUser ? "mobile-chatbot-bubble-row--user" : "mobile-chatbot-bubble-row--bot"
                  }`}
                >
                  {!isUser && (
                    <div className="mobile-chatbot-bubble-avatar">
                      <Bot size={16} />
                    </div>
                  )}
                  <div className="mobile-chatbot-bubble-wrapper">
                    {!isUser && <span className="mobile-chatbot-bubble-name">AI 비서</span>}
                    <div className="mobile-chatbot-bubble-bubble">
                      <p>{msg.content}</p>
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
