import {
  BarChart3,
  CalendarDays,
  Camera,
  ClipboardList,
  Eye,
  EyeOff,
  FileText,
  LocateFixed,
  LogOut,
  MapPin,
  Megaphone,
  MessageCircle,
  Pin,
  Plus,
  Reply,
  Search,
  Send,
  Settings,
  UsersRound,
  Vote,
  X
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import EmptyState from "../../common/EmptyState.jsx";
import LoadingCards from "../../common/LoadingCards.jsx";
import { chatApi } from "../../../api/chatApi";
import { locationApi } from "../../../api/locationApi";
import { meetingApi } from "../../../api/meetingApi";
import { isSupabaseConfigured, supabase } from "../../../api/supabaseClient";
import { voteApi } from "../../../api/voteApi";
import { useAuth } from "../../../contexts/AuthContext.jsx";
import { useAsync } from "../../../hooks/useAsync";

function formatMessageTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatMessageDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function messageDateKey(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "Asia/Seoul"
  }).format(new Date(value));
}

function formatVoteDateTimeOption(date, time) {
  if (!date) return "";
  const value = `${date}T${time || "00:00"}:00+09:00`;
  const options = {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul"
  };
  if (time) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }
  return new Intl.DateTimeFormat("ko-KR", options).format(new Date(value));
}

function formatVoteDeadline(value) {
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

function selectedIdsOf(vote) {
  if (Array.isArray(vote.selected_option_ids)) return vote.selected_option_ids.map(Number);
  return vote.selected_option_id ? [Number(vote.selected_option_id)] : [];
}

function displayVoterName(voter) {
  return voter.nickname || voter.name || "참여자";
}

function senderLabel(sender) {
  return sender?.nickname || sender?.name || "참여자";
}

function userTagLabel(user) {
  if (user?.user_tag_display) return user.user_tag_display;
  return user?.user_tag ? `[${user.user_tag}]` : "";
}

function messagePreview(message) {
  if (!message) return "";
  if (message.message_type === "image") return message.attachment_name || "사진";
  if (message.message_type === "location") return message.location_label || "공유한 위치";
  return message.content || "";
}

function replySenderLabel(message) {
  return message?.reply_to_sender_name || senderLabel(message?.reply_to?.sender);
}

function replyContent(message) {
  if (!message) return "";
  return message.reply_to_content || messagePreview(message.reply_to);
}

function isSystemMessage(message) {
  return ["notice", "system"].includes(message?.message_type);
}

function mapUrl(message) {
  const lat = message.location_latitude;
  const lng = message.location_longitude;
  if (lat == null || lng == null) return "";
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function padNumber(value) {
  return String(value).padStart(2, "0");
}

function localDateKey(date) {
  return `${date.getFullYear()}-${padNumber(date.getMonth() + 1)}-${padNumber(date.getDate())}`;
}

function localTimeValue(date) {
  return `${padNumber(date.getHours())}:${padNumber(date.getMinutes())}`;
}

function deadlineLabel(value) {
  if (!value) return "종료일자를 선택해주세요";
  return formatVoteDeadline(value);
}

function buildDeadlineCalendar(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  return Array.from({ length: 42 }, (_, index) => {
    const currentDay = index - firstDay + 1;
    const outside = currentDay < 1 || currentDay > daysInMonth;
    const day = currentDay < 1
      ? daysInPrevMonth + currentDay
      : currentDay > daysInMonth
        ? currentDay - daysInMonth
        : currentDay;
    const date = new Date(year, outside && currentDay < 1 ? month - 1 : outside ? month + 1 : month, day);
    return { key: `${localDateKey(date)}-${index}`, date, day, outside };
  });
}

function VoteDeadlinePicker({ value, onChange }) {
  const selectedDate = value ? new Date(value) : null;
  const [open, setOpen] = useState(false);
  const [monthDate, setMonthDate] = useState(() => {
    const base = selectedDate && !Number.isNaN(selectedDate.getTime()) ? selectedDate : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  const selectedDateKey = selectedDate && !Number.isNaN(selectedDate.getTime()) ? localDateKey(selectedDate) : "";
  const selectedTime = selectedDate && !Number.isNaN(selectedDate.getTime()) ? localTimeValue(selectedDate) : "18:00";
  const cells = buildDeadlineCalendar(monthDate);
  const hours = Array.from({ length: 24 }, (_, index) => padNumber(index));
  const minutes = ["00", "10", "20", "30", "40", "50"];

  const commit = (dateKey = selectedDateKey, timeValue = selectedTime) => {
    if (!dateKey) return;
    onChange(`${dateKey}T${timeValue}`);
  };

  const selectDate = (date) => commit(localDateKey(date), selectedTime);

  const changeHour = (hour) => {
    const [, minute = "00"] = selectedTime.split(":");
    commit(selectedDateKey || localDateKey(new Date()), `${hour}:${minute}`);
  };

  const changeMinute = (minute) => {
    const [hour = "18"] = selectedTime.split(":");
    commit(selectedDateKey || localDateKey(new Date()), `${hour}:${minute}`);
  };

  return (
    <div className="chat-deadline-picker">
      <span>투표 종료일자</span>
      <button className={`chat-deadline-trigger ${open ? "is-open" : ""}`} type="button" onClick={() => setOpen((current) => !current)}>
        <CalendarDays size={16} />
        <b>{deadlineLabel(value)}</b>
      </button>
      {open ? (
        <div className="chat-deadline-modal" role="dialog" aria-modal="true" aria-label="투표 종료일자 선택" onMouseDown={(event) => event.target === event.currentTarget && setOpen(false)}>
        <div className="chat-deadline-popover" onMouseDown={(event) => event.stopPropagation()}>
          <div className="chat-deadline-calendar-head">
            <button type="button" onClick={() => setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() - 1, 1))}>이전</button>
            <strong>{monthDate.getFullYear()}년 {monthDate.getMonth() + 1}월</strong>
            <button type="button" onClick={() => setMonthDate((date) => new Date(date.getFullYear(), date.getMonth() + 1, 1))}>다음</button>
          </div>
          <div className="chat-deadline-week">
            {["일", "월", "화", "수", "목", "금", "토"].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="chat-deadline-calendar">
            {cells.map((cell) => {
              const dateKey = localDateKey(cell.date);
              return (
                <button
                  key={cell.key}
                  className={`${cell.outside ? "is-outside" : ""} ${dateKey === selectedDateKey ? "is-selected" : ""}`}
                  type="button"
                  onClick={() => selectDate(cell.date)}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
          <div className="chat-deadline-time">
            <label>시
              <select value={selectedTime.split(":")[0]} onChange={(event) => changeHour(event.target.value)}>
                {hours.map((hour) => <option key={hour} value={hour}>{hour}시</option>)}
              </select>
            </label>
            <label>분
              <select value={selectedTime.split(":")[1]} onChange={(event) => changeMinute(event.target.value)}>
                {minutes.map((minute) => <option key={minute} value={minute}>{minute}분</option>)}
              </select>
            </label>
          </div>
          <div className="chat-deadline-actions">
            <button type="button" onClick={() => onChange("")}>초기화</button>
            <button type="button" onClick={() => setOpen(false)}>적용</button>
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}

function DesktopChatRoom() {
  const { chatRoomId, directRoomId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDirectChat = Boolean(directRoomId);
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [roomRefreshKey, setRoomRefreshKey] = useState(0);
  const [directRefreshKey, setDirectRefreshKey] = useState(0);
  const [directRoomRefreshKey, setDirectRoomRefreshKey] = useState(0);
  const [chatListMode, setChatListMode] = useState(isDirectChat ? "direct" : "meeting");
  const [talkSearchOpen, setTalkSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [talkInfoOpen, setTalkInfoOpen] = useState(false);
  const [memberPanelOpen, setMemberPanelOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [actionNotice, setActionNotice] = useState("");
  const [leavingRoom, setLeavingRoom] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [leaveTargetRoom, setLeaveTargetRoom] = useState(null);
  const [privateChatNotice, setPrivateChatNotice] = useState("");
  const [profilePreviewUser, setProfilePreviewUser] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoZoom, setPhotoZoom] = useState(1);
  const [photoPan, setPhotoPan] = useState({ x: 0, y: 0 });
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [locationKeyword, setLocationKeyword] = useState("");
  const [locationResults, setLocationResults] = useState([]);
  const [locationSearching, setLocationSearching] = useState(false);
  const [locationPickerMessage, setLocationPickerMessage] = useState("");
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [noticeFormOpen, setNoticeFormOpen] = useState(false);
  const [noticeRefreshKey, setNoticeRefreshKey] = useState(0);
  const [noticeForm, setNoticeForm] = useState({ title: "", content: "", is_pinned: true });
  const [noticeSubmitting, setNoticeSubmitting] = useState(false);
  const [noticeError, setNoticeError] = useState("");
  const [messageMenu, setMessageMenu] = useState(null);
  const [replyTarget, setReplyTarget] = useState(null);
  const [focusedMessageId, setFocusedMessageId] = useState(null);
  const [showLatestJump, setShowLatestJump] = useState(false);
  const [draggingReply, setDraggingReply] = useState(null);
  const [voteOpen, setVoteOpen] = useState(false);
  const [voteMode, setVoteMode] = useState("list");
  const [voteKind, setVoteKind] = useState("general");
  const [voteRefreshKey, setVoteRefreshKey] = useState(0);
  const [voteForm, setVoteForm] = useState({
    title: "",
    options: ["참여", "불참"],
    ends_at: "",
    allow_multiple: false,
    is_anonymous: true
  });
  const [voteDateTime, setVoteDateTime] = useState({ date: "", time: "" });
  const [voteSelections, setVoteSelections] = useState({});
  const [voteConfirm, setVoteConfirm] = useState(null);
  const [voteSubmitting, setVoteSubmitting] = useState(false);
  const [voteError, setVoteError] = useState("");
  const messageListRef = useRef(null);
  const messageRefs = useRef({});
  const messageInputRef = useRef(null);
  const fileInputRef = useRef(null);
  const longPressTimerRef = useRef(null);
  const dragReplyRef = useRef(null);
  const photoDragRef = useRef(null);

  const messages = useAsync(() => chatRoomId ? chatApi.messages(chatRoomId) : Promise.resolve(null), [chatRoomId, refreshKey]);
  const directMessages = useAsync(() => directRoomId ? chatApi.directMessages(directRoomId) : Promise.resolve(null), [directRoomId, directRefreshKey]);
  const rooms = useAsync(() => chatApi.rooms(), [roomRefreshKey]);
  const directRooms = useAsync(() => chatApi.directRooms(), [directRoomRefreshKey]);
  const activeMessages = isDirectChat ? directMessages : messages;
  const room = activeMessages.data?.room;
  const directOtherUser = isDirectChat ? room?.other_user : null;
  const meeting = room?.meeting;
  const renderedMessages = activeMessages.data?.items || [];
  const roomItems = rooms.data?.items || [];
  const directRoomItems = directRooms.data?.items || [];
  const participantItems = room?.participants || [];
  const isRoomHost = String(meeting?.host?.id ?? "") === String(user?.id ?? "");
  const myRole = isRoomHost ? "host" : (meeting?.my_participant?.role || "member");
  const canManageRoom = Boolean(room?.can_manage || meeting?.can_manage || ["host", "cohost", "subhost", "assistant"].includes(String(myRole).toLowerCase()));
  const votes = useAsync(() => meeting?.id ? meetingApi.votes(meeting.id) : Promise.resolve({ items: [] }), [meeting?.id, voteRefreshKey]);
  const notices = useAsync(() => meeting?.id ? meetingApi.notices(meeting.id) : Promise.resolve({ items: [] }), [meeting?.id, noticeRefreshKey]);
  const pinnedNotice = useMemo(() => {
    const items = [...(notices.data?.items || [])].sort((first, second) => {
      const firstTime = new Date(first.created_at || 0).getTime();
      const secondTime = new Date(second.created_at || 0).getTime();
      if (secondTime !== firstTime) return secondTime - firstTime;
      return Number(second.id || 0) - Number(first.id || 0);
    });
    return items.find((item) => item.is_pinned) || items[0] || null;
  }, [notices.data?.items]);
  const pinnedNoticeText = pinnedNotice?.content || pinnedNotice?.title || "";
  const systemMessageText = (message) => {
    if (message.message_type === "system") return message.content;
    if (message.message_type !== "notice") return message.content;
    if (message.content && !message.content.endsWith(": 채팅 공지")) return message.content;
    return pinnedNoticeText ? `공지가 등록되었습니다: ${pinnedNoticeText}` : message.content;
  };

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const visibleMessages = normalizedSearchQuery
    ? renderedMessages.filter((message) => {
        const senderName = message.sender?.nickname || message.sender?.name || "";
        return `${senderName} ${message.content || ""}`.toLowerCase().includes(normalizedSearchQuery);
      })
    : renderedMessages;

  useEffect(() => {
    setChatListMode(isDirectChat ? "direct" : "meeting");
    setSearchQuery("");
    setReplyTarget(null);
    setActionMenuOpen(false);
  }, [isDirectChat, chatRoomId, directRoomId]);

  useLayoutEffect(() => {
    if (!messageListRef.current || !activeMessages.data?.items) return;
    messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
    setShowLatestJump(false);
    setRoomRefreshKey((value) => value + 1);
    if (isDirectChat) setDirectRoomRefreshKey((value) => value + 1);
  }, [activeMessages.data?.items?.length, pinnedNotice?.id, isDirectChat]);

  const scrollToLatestMessage = (behavior = "smooth") => {
    const node = messageListRef.current;
    if (!node) return;
    node.scrollTo({ top: node.scrollHeight, behavior });
    setShowLatestJump(false);
  };

  const handleMessageScroll = () => {
    const node = messageListRef.current;
    if (!node) return;
    const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
    setShowLatestJump(distanceFromBottom > 140);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || sending) return;
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      setDirectRefreshKey((value) => value + 1);
      setDirectRoomRefreshKey((value) => value + 1);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [sending]);

  useEffect(() => {
    if (!voteOpen || !meeting?.id) return undefined;
    const timer = window.setInterval(() => {
      if (!document.hidden) setVoteRefreshKey((value) => value + 1);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [voteOpen, meeting?.id]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !chatRoomId) {
      return undefined;
    }

    const refreshChat = () => {
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
    };
    const channel = supabase
      .channel(`desktop-chat-room-${chatRoomId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "chat_messages",
        filter: `chat_room_id=eq.${chatRoomId}`
      }, refreshChat)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_message_reads"
      }, refreshChat)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatRoomId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !directRoomId) {
      return undefined;
    }

    const refreshDirectChat = () => {
      setDirectRefreshKey((value) => value + 1);
      setDirectRoomRefreshKey((value) => value + 1);
    };
    const channel = supabase
      .channel(`desktop-direct-chat-${directRoomId}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "direct_chat_messages",
        filter: `direct_chat_room_id=eq.${directRoomId}`
      }, refreshDirectChat)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [directRoomId]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !meeting?.id) return undefined;
    const channel = supabase
      .channel(`desktop-chat-votes-${meeting.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "votes" }, () => setVoteRefreshKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_options" }, () => setVoteRefreshKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "vote_responses" }, () => setVoteRefreshKey((value) => value + 1))
      .on("postgres_changes", { event: "*", schema: "public", table: "notices" }, () => setNoticeRefreshKey((value) => value + 1))
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [meeting?.id]);

  useEffect(() => {
    if (!messageMenu) return undefined;
    const close = () => setMessageMenu(null);
    const closeOnEscape = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [messageMenu]);

  const send = async (event) => {
    event.preventDefault();
    if (!content.trim()) return;
    setError("");
    setActionNotice("");
    setSending(true);
    try {
      if (isDirectChat) {
        await chatApi.sendDirect(directRoomId, { content: content.trim() });
        setContent("");
        setDirectRefreshKey((value) => value + 1);
        setDirectRoomRefreshKey((value) => value + 1);
        return;
      }
      await chatApi.send(chatRoomId, {
        content: content.trim(),
        reply_to_message_id: replyTarget?.id || null
      });
      setContent("");
      setReplyTarget(null);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
    } catch (sendError) {
      setError(sendError.response?.data?.message || "메시지 전송에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const openPhotoPicker = () => {
    setActionNotice("");
    setError("");
    fileInputRef.current?.click();
  };

  const openPhotoPreview = (preview) => {
    setPhotoPreview(preview);
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
    photoDragRef.current = null;
  };

  const closePhotoPreview = () => {
    setPhotoPreview(null);
    setPhotoZoom(1);
    setPhotoPan({ x: 0, y: 0 });
    photoDragRef.current = null;
  };

  const handlePhotoWheel = (event) => {
    event.preventDefault();
    const nextZoom = Math.min(6, Math.max(0.5, photoZoom + (event.deltaY < 0 ? 0.18 : -0.18)));
    if (nextZoom === photoZoom) return;
    setPhotoZoom(nextZoom);
    if (nextZoom <= 1) setPhotoPan({ x: 0, y: 0 });
  };

  const startPhotoDrag = (event) => {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    photoDragRef.current = {
      x: event.clientX,
      y: event.clientY,
      pan: photoPan
    };
  };

  const movePhotoDrag = (event) => {
    const drag = photoDragRef.current;
    if (!drag) return;
    setPhotoPan({
      x: drag.pan.x + event.clientX - drag.x,
      y: drag.pan.y + event.clientY - drag.y
    });
  };

  const endPhotoDrag = (event) => {
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    photoDragRef.current = null;
  };

  const handlePhotoSelected = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const resetInput = () => {
      event.target.value = "";
    };
    if (!file.type.startsWith("image/")) {
      setActionNotice("이미지 파일만 전송할 수 있습니다.");
      resetInput();
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setActionNotice("사진은 5MB 이하만 전송할 수 있습니다.");
      resetInput();
      return;
    }
    setActionMenuOpen(false);
    setSending(true);
    setActionNotice("");
    setError("");
    readImageAsDataUrl(file)
      .then((dataUrl) => {
        const payload = {
          content: file.name || "사진",
          message_type: "image",
          attachment_url: dataUrl,
          attachment_name: file.name
        };
        return isDirectChat
          ? chatApi.sendDirect(directRoomId, payload)
          : chatApi.send(chatRoomId, {
              ...payload,
              reply_to_message_id: replyTarget?.id || null
            });
      })
      .then(() => {
        setReplyTarget(null);
        if (isDirectChat) {
          setDirectRefreshKey((value) => value + 1);
          setDirectRoomRefreshKey((value) => value + 1);
        } else {
          setRefreshKey((value) => value + 1);
          setRoomRefreshKey((value) => value + 1);
        }
      })
      .catch((photoError) => {
        setError(photoError.response?.data?.message || "사진 전송에 실패했습니다.");
      })
      .finally(() => {
        setSending(false);
        resetInput();
      });
  };

  const sendLocationPayload = async ({ latitude, longitude, label }) => {
    const payload = {
      content: "위치를 공유했습니다.",
      message_type: "location",
      location: {
        latitude,
        longitude,
        label: label || "공유한 위치"
      }
    };
    if (isDirectChat) {
      await chatApi.sendDirect(directRoomId, payload);
    } else {
      await chatApi.send(chatRoomId, {
        ...payload,
        reply_to_message_id: replyTarget?.id || null
      });
    }
    setReplyTarget(null);
    if (isDirectChat) {
      setDirectRefreshKey((value) => value + 1);
      setDirectRoomRefreshKey((value) => value + 1);
    } else {
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
    }
  };

  const openLocationPicker = () => {
    setActionNotice("");
    setError("");
    setActionMenuOpen(false);
    setLocationPickerMessage("");
    setLocationPickerOpen(true);
  };

  const shareLocation = () => {
    openLocationPicker();
  };

  const shareCurrentLocation = () => {
    setLocationPickerMessage("");
    if (!("geolocation" in navigator)) {
      setLocationPickerMessage("이 브라우저에서는 현재 위치를 확인할 수 없습니다.");
      return;
    }
    setSending(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          await sendLocationPayload({ latitude, longitude, label: "현재 위치" });
          setLocationPickerOpen(false);
        } catch (locationError) {
          setLocationPickerMessage(locationError.response?.data?.message || "위치 공유에 실패했습니다.");
        } finally {
          setSending(false);
        }
      },
      () => {
        setLocationPickerMessage("위치 권한이 허용되지 않았습니다. 브라우저 설정을 확인해주세요.");
        setSending(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
    );
  };

  const searchLocationPlaces = async (event) => {
    event?.preventDefault();
    const keyword = locationKeyword.trim();
    if (!keyword) {
      setLocationPickerMessage("검색할 장소나 주소를 입력해주세요.");
      return;
    }
    setLocationSearching(true);
    setLocationPickerMessage("");
    try {
      const data = await locationApi.searchPlaces({ keyword, size: 8 });
      const items = data.items || [];
      setLocationResults(items);
      setLocationPickerMessage(items.length ? "" : "검색 결과가 없습니다.");
    } catch (searchError) {
      setLocationPickerMessage(searchError.response?.data?.message || "장소 검색에 실패했습니다.");
    } finally {
      setLocationSearching(false);
    }
  };

  const shareSelectedLocation = async (place) => {
    const latitude = Number(place.latitude);
    const longitude = Number(place.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setLocationPickerMessage("좌표가 있는 장소만 공유할 수 있습니다.");
      return;
    }
    setSending(true);
    setLocationPickerMessage("");
    try {
      const title = String(place.title || "").replace(/<[^>]+>/g, "").trim();
      const address = place.road_address || place.address || "";
      await sendLocationPayload({
        latitude,
        longitude,
        label: title || address || "선택한 위치"
      });
      setLocationPickerOpen(false);
      setLocationKeyword("");
      setLocationResults([]);
    } catch (locationError) {
      setLocationPickerMessage(locationError.response?.data?.message || "위치 공유에 실패했습니다.");
    } finally {
      setSending(false);
    }
  };

  const openVoteList = () => {
    setVoteMode("list");
    setVoteError("");
    setVoteOpen(true);
  };

  const openVoteCreate = () => {
    setActionMenuOpen(false);
    setVoteMode("create");
    setVoteError("");
    setVoteOpen(true);
  };

  const updateVoteOption = (index, value) => {
    setVoteForm((current) => ({
      ...current,
      options: current.options.map((option, optionIndex) => optionIndex === index ? value : option)
    }));
  };

  const selectVoteKind = (kind) => {
    setVoteKind(kind);
    setVoteError("");
    if (kind === "datetime") {
      setVoteForm((current) => ({
        ...current,
        title: current.title || "모임 날짜/시간 투표",
        options: current.options.length === 2 && current.options[0] === "참여" && current.options[1] === "불참" ? ["", ""] : current.options
      }));
    }
  };

  const appendVoteOption = (value) => {
    const normalized = value.trim();
    if (!normalized) return;
    setVoteForm((current) => {
      if (current.options.some((option) => option.trim() === normalized)) return current;
      const emptyIndex = current.options.findIndex((option) => !option.trim());
      if (emptyIndex >= 0) {
        return {
          ...current,
          options: current.options.map((option, index) => index === emptyIndex ? normalized : option)
        };
      }
      return { ...current, options: [...current.options, normalized] };
    });
  };

  const addDateTimeVoteOption = () => {
    const option = formatVoteDateTimeOption(voteDateTime.date, voteDateTime.time);
    if (!option) {
      setVoteError("날짜를 먼저 선택해주세요.");
      return;
    }
    appendVoteOption(option);
    setVoteDateTime({ date: "", time: "" });
    setVoteError("");
  };

  const createVote = async (event) => {
    event.preventDefault();
    if (!meeting?.id) return;
    const options = voteForm.options.map((option) => option.trim()).filter(Boolean);
    if (!voteForm.title.trim() || options.length < 2) {
      setVoteError("투표 제목과 선택지 2개 이상을 입력해주세요.");
      return;
    }
    setVoteSubmitting(true);
    setVoteError("");
    try {
      await meetingApi.createVote(meeting.id, {
        title: voteForm.title.trim(),
        options,
        ends_at: voteForm.ends_at || null,
        allow_multiple: voteForm.allow_multiple,
        is_anonymous: voteForm.is_anonymous
      });
      setVoteForm({ title: "", options: ["참여", "불참"], ends_at: "", allow_multiple: false, is_anonymous: true });
      setVoteKind("general");
      setVoteDateTime({ date: "", time: "" });
      setVoteMode("list");
      setVoteRefreshKey((value) => value + 1);
    } catch (createError) {
      setVoteError(createError.response?.data?.message || "투표를 생성하지 못했습니다.");
    } finally {
      setVoteSubmitting(false);
    }
  };

  const toggleVoteSelection = (vote, optionId) => {
    if (!vote.allow_multiple) {
      const option = vote.options.find((item) => Number(item.id) === Number(optionId));
      setVoteConfirm({ vote, optionIds: [optionId], label: option?.text || "선택지" });
      return;
    }
    setVoteSelections((current) => {
      const base = current[vote.id] || selectedIdsOf(vote);
      const exists = base.some((id) => Number(id) === Number(optionId));
      return {
        ...current,
        [vote.id]: exists ? base.filter((id) => Number(id) !== Number(optionId)) : [...base, optionId]
      };
    });
  };

  const confirmMultipleVote = (vote) => {
    const optionIds = voteSelections[vote.id] || selectedIdsOf(vote);
    if (!optionIds.length) {
      setVoteError("투표 선택지를 선택해주세요.");
      return;
    }
    setVoteConfirm({ vote, optionIds, label: `${optionIds.length}개 선택지` });
  };

  const submitConfirmedVote = async () => {
    if (!voteConfirm) return;
    setVoteError("");
    try {
      await voteApi.participate(voteConfirm.vote.id, { option_ids: voteConfirm.optionIds });
      setVoteConfirm(null);
      setVoteSelections((current) => {
        const next = { ...current };
        delete next[voteConfirm.vote.id];
        return next;
      });
      setVoteRefreshKey((value) => value + 1);
    } catch (participateError) {
      setVoteError(participateError.response?.data?.message || "투표 참여에 실패했습니다.");
      setVoteConfirm(null);
    }
  };

  const openNoticeForm = (draft = {}) => {
    setNoticeError("");
    setNoticeForm({
      title: draft.title || "",
      content: draft.content || "",
      is_pinned: draft.is_pinned ?? true
    });
    setNoticeFormOpen(true);
  };

  const createNotice = async (event) => {
    event.preventDefault();
    if (!meeting?.id) return;
    if (!noticeForm.title.trim() || !noticeForm.content.trim()) {
      setNoticeError("공지 제목과 내용을 입력해주세요.");
      return;
    }
    setNoticeSubmitting(true);
    setNoticeError("");
    try {
      await meetingApi.createNotice(meeting.id, {
        title: noticeForm.title.trim(),
        content: noticeForm.content.trim(),
        is_pinned: noticeForm.is_pinned
      });
      setNoticeFormOpen(false);
      setNoticeRefreshKey((value) => value + 1);
      window.setTimeout(() => setNoticeRefreshKey((value) => value + 1), 250);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      setActionNotice("공지사항이 등록되었습니다.");
    } catch (noticeCreateError) {
      setNoticeError(noticeCreateError.response?.data?.message || "공지 등록에 실패했습니다.");
    } finally {
      setNoticeSubmitting(false);
    }
  };

  const openMessageNoticeDraft = (message) => {
    setMessageMenu(null);
    openNoticeForm({
      title: "채팅 공지",
      content: message.content || "",
      is_pinned: true
    });
  };

  const startReplyToMessage = (message) => {
    setMessageMenu(null);
    setReplyTarget(message);
    window.setTimeout(() => messageInputRef.current?.focus(), 0);
  };

  const focusReplySource = (messageId) => {
    if (!messageId) return;
    setSearchQuery("");
    window.requestAnimationFrame(() => {
      const node = messageRefs.current[messageId];
      if (!node) return;
      node.scrollIntoView({ block: "center", behavior: "smooth" });
      setFocusedMessageId(messageId);
      window.setTimeout(() => setFocusedMessageId((current) => current === messageId ? null : current), 1400);
    });
  };

  const canReplyToMessage = (message) => !isSystemMessage(message);
  const canNoticeMessage = (message) => canManageRoom && !isSystemMessage(message);
  const canUseMessageMenu = (message) => canReplyToMessage(message) || canNoticeMessage(message);

  const openMessageMenu = (event, message) => {
    if (!canReplyToMessage(message)) return;
    event.preventDefault();
    event.stopPropagation();
    const x = Math.min(Math.max(12, (event.clientX || 0) - 178), window.innerWidth - 190);
    const y = Math.min((event.clientY || 0) - 8, window.innerHeight - 96);
    setMessageMenu({ message, x: Math.max(12, x), y: Math.max(12, y) });
  };

  const startMessageLongPress = (event, message) => {
    if (!canUseMessageMenu(message)) return;
    window.clearTimeout(longPressTimerRef.current);
    dragReplyRef.current = {
      id: message.id,
      startX: event.clientX,
      startY: event.clientY,
      triggered: false
    };
    const rect = event.currentTarget.getBoundingClientRect();
    const x = rect.left + rect.width / 2;
    const y = rect.top + Math.min(rect.height, 48);
    longPressTimerRef.current = window.setTimeout(() => {
      setMessageMenu({
        message,
        x: Math.min(Math.max(12, x), window.innerWidth - 190),
        y: Math.min(Math.max(12, y), window.innerHeight - 90)
      });
    }, 520);
  };

  const handleMessagePointerMove = (event, message) => {
    const drag = dragReplyRef.current;
    if (!drag || drag.id !== message.id || drag.triggered || !canReplyToMessage(message)) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    const limitedDx = Math.max(-72, Math.min(72, dx));
    if (Math.abs(dx) > 8 && Math.abs(dy) < 44) {
      setDraggingReply({ id: message.id, dx: limitedDx });
    }
    if (Math.abs(dx) > 58 && Math.abs(dy) < 42) {
      drag.triggered = true;
      window.clearTimeout(longPressTimerRef.current);
      startReplyToMessage(message);
      setDraggingReply(null);
    }
  };

  const clearMessageLongPress = () => {
    window.clearTimeout(longPressTimerRef.current);
    dragReplyRef.current = null;
    setDraggingReply(null);
  };

  const requestPrivateChat = async (targetUser) => {
    if (!targetUser?.id || String(targetUser.id) === String(user?.id)) {
      setPrivateChatNotice("자기 자신에게는 개인톡을 보낼 수 없습니다.");
      return;
    }
    try {
      const data = await chatApi.createDirectRoom(targetUser.id);
      const roomId = data.room?.id;
      if (roomId) {
        setProfilePreviewUser(null);
        setPrivateChatNotice("");
        setDirectRoomRefreshKey((value) => value + 1);
        navigate(`/chats/direct/${roomId}`);
        return;
      }
      setPrivateChatNotice("1:1 톡방을 만들었지만 방 정보를 확인하지 못했습니다.");
    } catch (directError) {
      setPrivateChatNotice(directError.response?.data?.message || "1:1 톡방을 만들지 못했습니다.");
    }
  };

  const leaveRoom = async () => {
    const targetRoomId = leaveTargetRoom?.id || chatRoomId;
    if (!targetRoomId || leavingRoom) return;
    setLeavingRoom(true);
    setError("");
    try {
      await chatApi.leave(targetRoomId);
      setLeaveConfirmOpen(false);
      setLeaveTargetRoom(null);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      if (String(targetRoomId) === String(chatRoomId)) {
        navigate("/chats", { replace: true });
      }
    } catch (leaveError) {
      setError(leaveError.response?.data?.message || "채팅방 나가기에 실패했습니다.");
      setLeaveConfirmOpen(false);
    } finally {
      setLeavingRoom(false);
    }
  };

  const closeMeetingRoom = async () => {
    if (!meeting?.id) return;
    if (!window.confirm("이 모임 채팅방을 종료할까요? 모임도 취소 상태로 변경됩니다.")) return;
    setError("");
    try {
      await meetingApi.cancel(meeting.id);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
      navigate("/chats", { replace: true });
    } catch (closeError) {
      setError(closeError.response?.data?.message || "채팅방 종료에 실패했습니다.");
    }
  };

  const kickParticipant = async (participant) => {
    const targetUser = participant.user || {};
    const targetUserId = targetUser.id || participant.user_id;
    if (!meeting?.id || !targetUserId) return;
    if (!window.confirm(`${senderLabel(targetUser)}님을 이 채팅방에서 내보낼까요? 모임 참여도 함께 취소됩니다.`)) return;
    setError("");
    try {
      await meetingApi.kickMember(meeting.id, targetUserId);
      setProfilePreviewUser(null);
      setRefreshKey((value) => value + 1);
      setRoomRefreshKey((value) => value + 1);
    } catch (kickError) {
      setError(kickError.response?.data?.message || "멤버 추방에 실패했습니다.");
    }
  };

  const openVoteNoticeDraft = (vote) => {
    openNoticeForm({
      title: `투표: ${vote.title}`,
      content: vote.options.map((option, index) => `${index + 1}. ${option.text}`).join("\n"),
      is_pinned: true
    });
  };

  return (
    <section className="desktop-page desktop-prototype legacy-pc legacy-chat-page">
      <div className="screen-title">
        <div>
          <h1>내 채팅</h1>
          <span>참여중인 모임 채팅방을 한곳에서 확인합니다.</span>
        </div>
      </div>
      <div className="talk-layout">
        <aside className="page-card talk-list">
          <div className="talk-list-head">
            <h2>채팅방</h2>
            <span>{chatListMode === "direct" ? directRoomItems.length : roomItems.length}</span>
          </div>
          <div className="talk-list-tabs" role="tablist" aria-label="채팅방 종류">
            <button className={chatListMode === "meeting" ? "is-active" : ""} type="button" onClick={() => setChatListMode("meeting")}>
              참여중인 모임
            </button>
            <button className={chatListMode === "direct" ? "is-active" : ""} type="button" onClick={() => setChatListMode("direct")}>
              1대1톡
            </button>
          </div>
          {chatListMode === "meeting" && rooms.loading && !rooms.data ? (
            <LoadingCards count={4} />
          ) : chatListMode === "direct" && directRooms.loading && !directRooms.data ? (
            <LoadingCards count={4} />
          ) : chatListMode === "meeting" && roomItems.length ? (
            <div className="talk-list-items">
              {roomItems.map((item) => {
                const itemMeeting = item.meeting || {};
                return (
                  <div key={item.id} className={`proto-talk-room-item ${String(item.id) === String(chatRoomId) ? "selected" : ""}`}>
                    <Link to={`/chats/${item.id}`}>
                      {itemMeeting.cover_image_url ? <img src={itemMeeting.cover_image_url} alt="" /> : <div className="talk-room-fallback"><MessageCircle size={20} /></div>}
                      <span>
                        <b>{itemMeeting.title || "모임 채팅방"}</b>
                        <small>{itemMeeting.location_name || "장소 미정"} · {itemMeeting.current_participants || 0}/{itemMeeting.max_participants || 0}명</small>
                      </span>
                    <em>{formatMessageTime(item.last_message?.created_at) || "방금"}</em>
                    {Number(item.unread_count || 0) > 0 ? <i>{item.unread_count}</i> : null}
                  </Link>
                    <button
                      className="talk-room-leave-btn"
                      type="button"
                      onClick={() => {
                        setLeaveTargetRoom(item);
                        setLeaveConfirmOpen(true);
                      }}
                      aria-label="채팅방 나가기"
                    >
                      <LogOut size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : chatListMode === "direct" && directRoomItems.length ? (
            <div className="talk-list-items">
              {directRoomItems.map((item) => {
                const otherUser = item.other_user || {};
                return (
                  <div key={item.id} className={`proto-talk-room-item ${String(item.id) === String(directRoomId) ? "selected" : ""}`}>
                    <Link to={`/chats/direct/${item.id}`}>
                      {otherUser.profile_image_url ? <img src={otherUser.profile_image_url} alt="" /> : <div className="talk-room-fallback"><UsersRound size={20} /></div>}
                      <span>
                        <b>{senderLabel(otherUser)}</b>
                        <small>{item.last_message?.content || "아직 대화가 없습니다."}</small>
                      </span>
                      <em>{formatMessageTime(item.last_message?.created_at || item.updated_at || item.created_at) || "방금"}</em>
                    </Link>
                  </div>
                );
              })}
            </div>
          ) : chatListMode === "direct" ? (
            <EmptyState title="1대1 톡방이 없습니다." description="채팅방 멤버 프로필에서 1:1 톡을 시작해보세요." />
          ) : (
            <EmptyState title="참여 중인 채팅방이 없습니다." actionLabel="모임 찾기" actionTo="/meetings" />
          )}
        </aside>

        {activeMessages.loading && !activeMessages.data ? (
          <section className="page-card talk-room talk-room-open"><LoadingCards count={3} /></section>
        ) : activeMessages.error ? (
          <section className="page-card talk-room talk-room-empty">
            <EmptyState title="채팅방을 불러오지 못했습니다." description={isDirectChat ? "1:1 톡방 접근 상태를 확인하거나 잠시 후 다시 시도해주세요." : "참여 승인 상태를 확인하거나 잠시 후 다시 시도해주세요."} actionLabel="채팅 목록" actionTo="/chats" />
          </section>
        ) : (
          <section className="page-card talk-room talk-room-open">
            <div className="talk-room-top">
              <div>
                <strong>{isDirectChat ? senderLabel(directOtherUser) : (meeting?.title || "채팅방")}</strong>
                <small>
                  {isDirectChat
                    ? (directOtherUser?.profile?.region || "1:1 톡")
                    : `${meeting?.location_name || "장소 미정"} · ${meeting?.current_participants || 0}/${meeting?.max_participants || 0}명`}
                </small>
              </div>
              <span>
                {!isDirectChat ? (
                  <>
                    <button className="talk-tool-btn" type="button" onClick={() => setTalkInfoOpen((value) => !value)}>
                      <ClipboardList size={15} />
                      <b>공지/일정</b>
                    </button>
                    <button className="talk-tool-btn" type="button" onClick={openVoteList}>
                      <Vote size={15} />
                      <b>투표</b>
                    </button>
                    <button className="talk-tool-btn" type="button" onClick={() => setMemberPanelOpen((value) => !value)}>
                      <UsersRound size={15} />
                      <b>멤버</b>
                    </button>
                  </>
                ) : null}
                <button className="talk-icon-btn" type="button" onClick={() => setTalkSearchOpen((value) => !value)} aria-label="대화 검색">
                  <Search size={15} />
                </button>
                <Link className="talk-close-btn" to="/chats" aria-label="채팅 닫기"><X size={15} /></Link>
              </span>
            </div>

            <div className={`talk-search-panel ${talkSearchOpen ? "is-open" : ""}`}>
              <Search size={15} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="대화 내용 검색" />
            </div>

            {!isDirectChat ? <div className={`talk-info-panel ${talkInfoOpen ? "is-open" : ""}`}>
              {pinnedNotice ? (
                <button type="button" onClick={() => setNoticeOpen(true)}>
                  <Megaphone size={15} />
                  <span>공지 확인</span>
                </button>
              ) : null}
              {meeting?.id ? (
                <Link to={`/meetings/${meeting.id}`}>
                  <FileText size={15} />
                  <span>모임 상세 보기</span>
                </Link>
              ) : null}
              <Link to={`/mypage?panel=schedule&calendar=1${meeting?.id ? `&meeting=${meeting.id}` : ""}${chatRoomId ? `&chat=${chatRoomId}` : ""}`}>
                <CalendarDays size={15} />
                <span>내 모임 일정 보기</span>
              </Link>
              {canManageRoom && meeting?.id ? (
                <>
                  <button type="button" onClick={() => openNoticeForm()}>
                    <Pin size={15} />
                    <span>공지 작성</span>
                  </button>
                  {isRoomHost ? (
                    <button className="is-danger" type="button" onClick={closeMeetingRoom}>
                      <LogOut size={15} />
                      <span>채팅방 종료</span>
                    </button>
                  ) : null}
                  <Link to={`/host/meetings/${meeting.id}`}>
                    <Settings size={15} />
                    <span>방 관리</span>
                  </Link>
                </>
              ) : null}
            </div> : null}

            {!isDirectChat ? <div className={`talk-members-panel ${memberPanelOpen ? "is-open" : ""}`}>
              <header>
                <strong>참여자 {participantItems.length}명</strong>
                <button type="button" onClick={() => setMemberPanelOpen(false)} aria-label="참여자 닫기"><X size={14} /></button>
              </header>
              <div>
                {participantItems.map((participant) => {
                  const participantUser = participant.user || {};
                  const isMe = String(participantUser.id ?? participant.user_id) === String(user?.id ?? "");
                  return (
                    <div key={participant.id || participant.user_id} className="talk-member-row">
                      <button type="button" onClick={() => setProfilePreviewUser(participantUser)}>
                        {participantUser.profile_image_url ? <img src={participantUser.profile_image_url} alt="" /> : <span><UsersRound size={16} /></span>}
                        <b>{senderLabel(participantUser)}{isMe ? " (나)" : ""}</b>
                        <small>{participant.role === "host" ? "방장" : participant.role || "member"}</small>
                      </button>
                    </div>
                  );
                })}
                {!participantItems.length ? <p>참여자 정보를 불러오지 못했습니다.</p> : null}
              </div>
            </div> : null}

            {!isDirectChat && pinnedNotice ? (
              <button className="chat-pinned-notice" type="button" onClick={() => setNoticeOpen(true)}>
                <Megaphone size={16} />
                <strong>공지사항</strong>
                <span>{pinnedNoticeText}</span>
              </button>
            ) : null}

            <div className="talk-messages" ref={messageListRef} onScroll={handleMessageScroll}>
              {visibleMessages.length ? (
                visibleMessages.map((message, index) => {
                  const mine = isDirectChat ? message.sender_id === user?.id : message.user_id === user?.id;
                  const previous = visibleMessages[index - 1];
                  const showDivider = !previous || messageDateKey(previous.created_at) !== messageDateKey(message.created_at);
                  return (
                    <div key={message.id}>
                      {showDivider ? <div className="talk-date">{formatMessageDate(message.created_at)}</div> : null}
                      <div
                        ref={(node) => {
                          if (node) messageRefs.current[message.id] = node;
                          else delete messageRefs.current[message.id];
                        }}
                        className={`talk-bubble ${mine ? "right" : "left"} ${isSystemMessage(message) ? "is-system" : ""} ${!isDirectChat && canUseMessageMenu(message) ? "has-menu" : ""} ${draggingReply?.id === message.id ? "is-reply-dragging" : ""} ${focusedMessageId === message.id ? "is-focused" : ""}`}
                        style={{ "--reply-drag-x": `${draggingReply?.id === message.id ? draggingReply.dx : 0}px` }}
                        onContextMenu={(event) => !isDirectChat && openMessageMenu(event, message)}
                        onPointerDown={(event) => !isDirectChat && startMessageLongPress(event, message)}
                        onPointerMove={(event) => !isDirectChat && handleMessagePointerMove(event, message)}
                        onPointerUp={clearMessageLongPress}
                        onPointerLeave={clearMessageLongPress}
                        onPointerCancel={clearMessageLongPress}
                      >
                        <div className="talk-message-main">
                          {!mine && !isSystemMessage(message) ? (
                            <button className="talk-sender-button" type="button" onClick={() => setProfilePreviewUser(message.sender)}>
                              {message.sender?.profile_image_url ? <img src={message.sender.profile_image_url} alt="" /> : <span><UsersRound size={13} /></span>}
                              <b>{senderLabel(message.sender)}</b>
                            </button>
                          ) : null}
                          {(message.reply_to_message_id || message.reply_to_content) ? (
                            <button
                              className="talk-message-reply"
                              type="button"
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={() => focusReplySource(message.reply_to_message_id)}
                            >
                              <strong>{replySenderLabel(message)}</strong>
                              <span>{replyContent(message)}</span>
                            </button>
                          ) : null}
                          {message.message_type === "image" ? (
                            <figure className="talk-photo-message">
                              <button
                                type="button"
                                onPointerDown={(event) => event.stopPropagation()}
                                onClick={() => openPhotoPreview({
                                  url: message.attachment_url,
                                  name: message.attachment_name || "전송된 사진"
                                })}
                                aria-label="사진 확대 보기"
                              >
                                <img src={message.attachment_url} alt={message.attachment_name || "전송된 사진"} />
                              </button>
                              {message.attachment_name ? <figcaption>{message.attachment_name}</figcaption> : null}
                            </figure>
                          ) : message.message_type === "location" ? (
                            <a className="talk-location-message" href={mapUrl(message)} target="_blank" rel="noreferrer">
                              <MapPin size={18} />
                              <span>
                                <strong>{message.location_label || "공유한 위치"}</strong>
                                <small>{[message.location_latitude, message.location_longitude].filter((value) => value != null).join(", ")}</small>
                              </span>
                            </a>
                        ) : (
                            <p>{isSystemMessage(message) ? systemMessageText(message) : message.content}</p>
                          )}
                        </div>
                        <div className="talk-message-meta">
                          {!isDirectChat && !isSystemMessage(message) ? <span>{Number(message.read_count || 0)} 읽음</span> : null}
                          <time>{formatMessageTime(message.created_at)}</time>
                        </div>
                        {!isDirectChat && canUseMessageMenu(message) ? (
                          <button className="talk-message-menu-btn" type="button" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => openMessageMenu(event, message)} aria-label="메시지 메뉴">
                            <span />
                            <span />
                            <span />
                          </button>
                        ) : null}
                        {!isDirectChat && canManageRoom && !isSystemMessage(message) ? (
                          <button className="talk-message-notice-btn" type="button" onClick={() => openMessageNoticeDraft(message)}>공지로</button>
                        ) : null}
                      </div>
                    </div>
                  );
                })
              ) : normalizedSearchQuery ? (
                <div className="talk-message-empty">
                  <Search size={24} />
                  <strong>검색 결과가 없습니다.</strong>
                  <p>다른 이름이나 메시지 내용으로 검색해보세요.</p>
                </div>
              ) : (
                <div className="talk-message-empty">
                  <UsersRound size={24} />
                  <strong>아직 대화가 없습니다.</strong>
                  <p>{isDirectChat ? "1:1 대화를 먼저 시작해보세요." : "모임 준비 이야기를 먼저 시작해보세요."}</p>
                </div>
              )}
            </div>

            {showLatestJump ? (
              <button className="talk-latest-jump" type="button" onClick={() => scrollToLatestMessage()} aria-label="최신 메시지로 이동">
                최신 메시지로
              </button>
            ) : null}

            <form className="talk-input" onSubmit={send}>
              {!isDirectChat && replyTarget ? (
                <div className="talk-reply-preview">
                  <Reply size={15} />
                  <span>
                    <b>{messagePreview(replyTarget)}</b>
                    <small>{senderLabel(replyTarget.sender)}에게 답장</small>
                  </span>
                  <button type="button" onClick={() => setReplyTarget(null)} aria-label="답장 취소">
                    <X size={14} />
                  </button>
                </div>
              ) : null}
              {error ? <p className="talk-input-error">{error}</p> : null}
              {actionNotice ? <p className="talk-input-notice">{actionNotice}</p> : null}
              {actionMenuOpen ? (
                <div className="chat-action-menu" role="menu">
                  <button type="button" role="menuitem" onClick={openPhotoPicker}><Camera size={17} />사진 전송</button>
                  {!isDirectChat && canManageRoom ? <button type="button" role="menuitem" onClick={openVoteCreate}><Vote size={17} />투표 생성</button> : null}
                  {!isDirectChat && canManageRoom ? <button type="button" role="menuitem" onClick={() => openNoticeForm()}><Pin size={17} />공지 작성</button> : null}
                  <button type="button" role="menuitem" onClick={shareLocation}><MapPin size={17} />위치 공유</button>
                </div>
              ) : null}
              <input ref={fileInputRef} className="chat-file-input" type="file" accept="image/*" onChange={handlePhotoSelected} />
              <button className="talk-input-more" type="button" onClick={() => setActionMenuOpen((value) => !value)} aria-label="채팅 기능 더보기" aria-expanded={actionMenuOpen}>
                <Plus size={20} />
              </button>
              <input ref={messageInputRef} value={content} onChange={(event) => setContent(event.target.value)} placeholder="메시지를 입력하세요." aria-label="메시지 입력" />
              <button type="submit" disabled={sending || !content.trim()} aria-label="메시지 전송"><Send size={18} /></button>
            </form>
          </section>
        )}
      </div>

      {messageMenu ? (
        <div
          className="talk-message-context-menu"
          style={{ left: messageMenu.x, top: messageMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {canReplyToMessage(messageMenu.message) ? (
            <button type="button" onClick={() => startReplyToMessage(messageMenu.message)}>
              <Reply size={15} />
              답장하기
            </button>
          ) : null}
          {canNoticeMessage(messageMenu.message) ? (
            <button type="button" onClick={() => openMessageNoticeDraft(messageMenu.message)}>
              <Pin size={15} />
              공지하기
            </button>
          ) : null}
        </div>
      ) : null}

      {profilePreviewUser ? (
        <div className="chat-profile-sheet" role="dialog" aria-modal="true" aria-label="사용자 간략 정보">
          <button className="chat-profile-sheet__backdrop" type="button" onClick={() => setProfilePreviewUser(null)} aria-label="닫기" />
          <section>
            <div className="chat-profile-sheet__avatar">
              {profilePreviewUser.profile_image_url ? <img src={profilePreviewUser.profile_image_url} alt="" /> : <UsersRound size={24} />}
            </div>
            <strong className="chat-profile-sheet__name">
              <span>{profilePreviewUser.nickname || profilePreviewUser.name || "참여자"}</span>
              {userTagLabel(profilePreviewUser) ? <small>{userTagLabel(profilePreviewUser)}</small> : null}
            </strong>
            <p>{profilePreviewUser.profile?.region || "활동 지역 미설정"}</p>
            {privateChatNotice ? <p className="chat-profile-sheet__notice">{privateChatNotice}</p> : null}
            <div className="chat-profile-sheet__actions">
              <button type="button" onClick={() => requestPrivateChat(profilePreviewUser)}>1:1 톡</button>
              {(() => {
                const previewParticipant = participantItems.find((participant) => String(participant.user?.id ?? participant.user_id) === String(profilePreviewUser.id));
                const isPreviewMe = String(profilePreviewUser.id ?? "") === String(user?.id ?? "");
                return isRoomHost && previewParticipant && !isPreviewMe && previewParticipant.role !== "host" ? (
                  <button className="is-danger" type="button" onClick={() => kickParticipant(previewParticipant)}>추방</button>
                ) : null;
              })()}
              <button type="button">차단</button>
            </div>
          </section>
        </div>
      ) : null}

      {locationPickerOpen ? (
        <div className="chat-location-picker" role="dialog" aria-modal="true" aria-label="위치 공유">
          <button className="chat-location-picker__backdrop" type="button" onClick={() => setLocationPickerOpen(false)} aria-label="닫기" />
          <section>
            <header>
              <div>
                <strong>위치 공유</strong>
                <p>현재 위치를 보내거나 장소를 검색해서 공유할 수 있습니다.</p>
              </div>
              <button type="button" onClick={() => setLocationPickerOpen(false)} aria-label="닫기"><X size={18} /></button>
            </header>
            <button className="chat-location-picker__current" type="button" onClick={shareCurrentLocation} disabled={sending}>
              <LocateFixed size={18} />
              현재 위치 보내기
            </button>
            <form className="chat-location-picker__search" onSubmit={searchLocationPlaces}>
              <input
                value={locationKeyword}
                onChange={(event) => setLocationKeyword(event.target.value)}
                placeholder="장소명이나 주소를 입력하세요."
                aria-label="공유할 위치 검색"
              />
              <button type="submit" disabled={locationSearching}>{locationSearching ? "검색 중" : "검색"}</button>
            </form>
            {locationPickerMessage ? <p className="chat-location-picker__message">{locationPickerMessage}</p> : null}
            <div className="chat-location-picker__results">
              {locationResults.map((place, index) => {
                const title = String(place.title || place.address || "장소").replace(/<[^>]+>/g, "").trim();
                const address = place.road_address || place.address || "";
                return (
                  <button
                    key={`${title}-${address}-${index}`}
                    type="button"
                    onClick={() => shareSelectedLocation(place)}
                    disabled={sending}
                  >
                    <MapPin size={17} />
                    <span>
                      <strong>{title}</strong>
                      {address ? <small>{address}</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : null}

      {photoPreview ? (
        <div className="chat-photo-viewer" role="dialog" aria-modal="true" aria-label="사진 확대 보기">
          <button className="chat-photo-viewer__backdrop" type="button" onClick={closePhotoPreview} aria-label="닫기" />
          <section>
            <header>
              <strong>{photoPreview.name}</strong>
              <span>{Math.round(photoZoom * 100)}%</span>
              <button type="button" onClick={closePhotoPreview} aria-label="닫기"><X size={18} /></button>
            </header>
            <div
              className="chat-photo-viewer__stage"
              onWheel={handlePhotoWheel}
              onPointerDown={startPhotoDrag}
              onPointerMove={movePhotoDrag}
              onPointerUp={endPhotoDrag}
              onPointerCancel={endPhotoDrag}
            >
              <img
                src={photoPreview.url}
                alt={photoPreview.name}
                draggable="false"
                style={{
                  transform: `translate(${photoPan.x}px, ${photoPan.y}px) scale(${photoZoom})`
                }}
              />
            </div>
          </section>
        </div>
      ) : null}

      {leaveConfirmOpen ? (
        <div className="chat-vote-confirm" role="dialog" aria-modal="true" aria-label="채팅방 나가기">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setLeaveConfirmOpen(false)} aria-label="닫기" />
          <section>
            <strong>채팅방을 나갈까요?</strong>
            <p>{leaveTargetRoom?.meeting?.title || meeting?.title || "이 채팅방"}에서 나가면 모임 참여도 함께 취소됩니다.</p>
            <div className="chat-vote-confirm__actions">
              <button type="button" onClick={() => setLeaveConfirmOpen(false)}>취소</button>
              <button type="button" className="is-danger" onClick={leaveRoom} disabled={leavingRoom}>
                {leavingRoom ? "나가는 중" : "나가기"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {noticeOpen && pinnedNotice ? (
        <div className="chat-notice-modal" role="dialog" aria-modal="true" aria-label="공지사항">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setNoticeOpen(false)} aria-label="닫기" />
          <section>
            <div className="chat-vote-modal__header">
              <div>
                <span>공지사항</span>
                <p>채팅방 상단에 고정된 공지입니다.</p>
              </div>
              <button className="chat-vote-modal__close" type="button" onClick={() => setNoticeOpen(false)} aria-label="닫기"><X size={18} /></button>
            </div>
            <article className="chat-notice-detail">
              <strong>{pinnedNotice.title}</strong>
              <p>{pinnedNotice.content}</p>
              <small>{formatMessageDate(pinnedNotice.created_at)}</small>
            </article>
          </section>
        </div>
      ) : null}

      {noticeFormOpen ? (
        <div className="chat-notice-modal" role="dialog" aria-modal="true" aria-label="공지 작성">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setNoticeFormOpen(false)} aria-label="닫기" />
          <section>
            <div className="chat-vote-modal__header">
              <div>
                <span>공지 작성</span>
                <p>등록한 공지는 채팅방 상단에 고정하고 대화에도 안내 메시지를 남깁니다.</p>
              </div>
              <button className="chat-vote-modal__close" type="button" onClick={() => setNoticeFormOpen(false)} aria-label="닫기"><X size={18} /></button>
            </div>
            {noticeError ? <p className="chat-vote-modal__error">{noticeError}</p> : null}
            <form className="chat-notice-form" onSubmit={createNotice}>
              <label>공지 제목<input value={noticeForm.title} onChange={(event) => setNoticeForm({ ...noticeForm, title: event.target.value })} placeholder="예: 오늘 모임 안내" /></label>
              <label>공지 내용<textarea value={noticeForm.content} onChange={(event) => setNoticeForm({ ...noticeForm, content: event.target.value })} rows={6} placeholder="공지 내용을 입력해주세요." /></label>
              <label className="chat-vote-check"><input type="checkbox" checked={noticeForm.is_pinned} onChange={(event) => setNoticeForm({ ...noticeForm, is_pinned: event.target.checked })} /> 상단에 고정</label>
              <div className="chat-vote-create__actions">
                <button type="button" onClick={() => setNoticeFormOpen(false)}>취소</button>
                <button type="submit" disabled={noticeSubmitting}>{noticeSubmitting ? "등록 중..." : "공지 등록"}</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {voteOpen ? (
        <div className="chat-vote-modal" role="dialog" aria-modal="true" aria-label="투표">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setVoteOpen(false)} aria-label="닫기" />
          <section>
            <div className="chat-vote-modal__header">
              <div>
                <span>모임 투표</span>
                <p>날짜와 시간 투표, 일반 투표를 만들고 참여 현황을 확인합니다.</p>
              </div>
              <button className="chat-vote-modal__close" type="button" onClick={() => setVoteOpen(false)} aria-label="닫기"><X size={18} /></button>
            </div>
            {canManageRoom ? (
              <div className="chat-vote-modal__tabs">
                <button type="button" className={voteMode === "list" ? "active" : ""} onClick={() => setVoteMode("list")}>진행중인 투표</button>
                <button type="button" className={voteMode === "create" ? "active" : ""} onClick={() => setVoteMode("create")}>투표 만들기</button>
              </div>
            ) : null}
            {voteError ? <p className="chat-vote-modal__error">{voteError}</p> : null}
            {voteMode === "create" ? (
              <form className="chat-vote-create" onSubmit={createVote}>
                <div className="chat-vote-create__type" role="tablist" aria-label="투표 유형">
                  <button type="button" className={voteKind === "general" ? "active" : ""} onClick={() => selectVoteKind("general")}>일반 투표</button>
                  <button type="button" className={voteKind === "datetime" ? "active" : ""} onClick={() => selectVoteKind("datetime")}>날짜/시간 투표</button>
                </div>
                <label>투표 제목<input value={voteForm.title} onChange={(event) => setVoteForm({ ...voteForm, title: event.target.value })} placeholder="예: 오늘 참석 여부" /></label>
                {voteKind === "datetime" ? (
                  <div className="chat-vote-datetime">
                    <div className="chat-vote-datetime__fields">
                      <label>날짜<input type="date" value={voteDateTime.date} onChange={(event) => setVoteDateTime((current) => ({ ...current, date: event.target.value }))} /></label>
                      <label>시간<input type="time" value={voteDateTime.time} onChange={(event) => setVoteDateTime((current) => ({ ...current, time: event.target.value }))} /></label>
                      <button type="button" onClick={addDateTimeVoteOption} disabled={!voteDateTime.date}>선택지 추가</button>
                    </div>
                    <p>날짜와 시간을 고른 뒤 선택지로 추가해주세요. 여러 후보 시간을 빠르게 등록할 수 있습니다.</p>
                  </div>
                ) : null}
                <div className="chat-vote-create__grid">
                  {voteForm.options.map((option, index) => (
                    <label key={index}>선택지 {index + 1}<input value={option} onChange={(event) => updateVoteOption(index, event.target.value)} /></label>
                  ))}
                </div>
                <div className="chat-vote-settings">
                  <VoteDeadlinePicker value={voteForm.ends_at} onChange={(value) => setVoteForm({ ...voteForm, ends_at: value })} />
                  <label className="chat-vote-check"><input type="checkbox" checked={voteForm.allow_multiple} onChange={(event) => setVoteForm({ ...voteForm, allow_multiple: event.target.checked })} /> 복수 선택 허용</label>
                  <label className="chat-vote-check"><input type="checkbox" checked={!voteForm.is_anonymous} onChange={(event) => setVoteForm({ ...voteForm, is_anonymous: !event.target.checked })} /> 공개 투표</label>
                </div>
                <div className="chat-vote-create__actions">
                  <button type="button" onClick={() => setVoteForm((current) => ({ ...current, options: [...current.options, ""] }))}>선택지 추가</button>
                  <button type="submit" disabled={voteSubmitting}>{voteSubmitting ? "등록 중..." : "투표 등록"}</button>
                </div>
              </form>
            ) : votes.loading && !votes.data ? (
              <p className="chat-vote-empty">투표를 불러오는 중입니다.</p>
            ) : votes.data?.items?.length ? (
              <div className="chat-vote-list">
                {votes.data.items.map((vote) => {
                  const totalResponses = vote.options.reduce((sum, option) => sum + Number(option.response_count || 0), 0);
                  const currentSelection = voteSelections[vote.id] || selectedIdsOf(vote);
                  return (
                    <article key={vote.id}>
                      <header>
                        <div>
                          <strong>{vote.title}</strong>
                          <small>총 {totalResponses}표 · {vote.allow_multiple ? "복수 선택" : "단일 선택"} · {vote.is_anonymous ? "비공개" : "공개"} · {formatVoteDeadline(vote.ends_at)}</small>
                        </div>
                        <span className="chat-vote-header-actions">
                          {vote.is_anonymous ? <EyeOff size={15} /> : <Eye size={15} />}
                          {canManageRoom ? <button type="button" onClick={() => openVoteNoticeDraft(vote)}>공지로</button> : null}
                        </span>
                      </header>
                      <div>
                        {vote.options.map((option) => {
                          const count = Number(option.response_count || 0);
                          const percent = totalResponses ? Math.round((count / totalResponses) * 100) : 0;
                          const selected = currentSelection.some((id) => Number(id) === Number(option.id));
                          return (
                            <button type="button" key={option.id} className={selected ? "selected" : ""} onClick={() => toggleVoteSelection(vote, option.id)}>
                              <span>{option.text}</span>
                              <i><b style={{ width: `${percent}%` }} /></i>
                              <em>{count}표 · {percent}%</em>
                              {!vote.is_anonymous && option.voters?.length ? <small>{option.voters.map(displayVoterName).join(", ")}</small> : null}
                            </button>
                          );
                        })}
                      </div>
                      {vote.allow_multiple ? <button className="chat-vote-submit-selection" type="button" onClick={() => confirmMultipleVote(vote)}>선택 반영</button> : null}
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className="chat-vote-empty">진행중인 투표가 없습니다.</p>
            )}
          </section>
        </div>
      ) : null}

      {voteConfirm ? (
        <div className="chat-vote-confirm" role="dialog" aria-modal="true" aria-label="투표 확인">
          <button className="chat-vote-modal__backdrop" type="button" onClick={() => setVoteConfirm(null)} aria-label="닫기" />
          <section>
            <strong>"{voteConfirm.label}"에 투표하시겠습니까?</strong>
            <p>확인하면 선택한 내용으로 투표가 반영됩니다.</p>
            <div className="chat-vote-create__actions">
              <button type="button" onClick={() => setVoteConfirm(null)}>취소</button>
              <button type="button" onClick={submitConfirmedVote}>예, 투표하기</button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  );
}

export default DesktopChatRoom;
