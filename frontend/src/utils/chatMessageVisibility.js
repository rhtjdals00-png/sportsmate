const ALWAYS_VISIBLE_MESSAGE_TYPES = new Set([
  "system",
  "notice",
  "schedule_changed",
  "schedule_cancelled",
]);

function normalizeId(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function normalizeIdList(values) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map(normalizeId).filter(Boolean))];
}

export function buildHiddenChatUsersStorageKey(currentUserId, chatRoomId, roomType = "meeting") {
  const normalizedUserId = normalizeId(currentUserId);
  const normalizedRoomId = normalizeId(chatRoomId);
  const normalizedRoomType = normalizeId(roomType).toLowerCase();
  if (!normalizedUserId || !normalizedRoomId || !normalizedRoomType) return "";
  return `sportsmate_hidden_chat_users_${normalizedUserId}_${normalizedRoomType}_${normalizedRoomId}`;
}

export function parseHiddenChatUserIds(rawValue) {
  if (!rawValue) return [];
  try {
    return normalizeIdList(JSON.parse(rawValue));
  } catch {
    return [];
  }
}

export function addHiddenChatUserId(ids, targetUserId) {
  const normalizedTargetId = normalizeId(targetUserId);
  const normalizedIds = normalizeIdList(ids);
  if (!normalizedTargetId) return normalizedIds;
  return normalizeIdList([...normalizedIds, normalizedTargetId]);
}

export function removeHiddenChatUserId(ids, targetUserId) {
  const normalizedTargetId = normalizeId(targetUserId);
  return normalizeIdList(ids).filter((id) => id !== normalizedTargetId);
}

export function shouldHideChatMessage(message, hiddenUserIds, currentUserId) {
  const messageType = String(message?.message_type || message?.type || "").trim().toLowerCase();
  if (ALWAYS_VISIBLE_MESSAGE_TYPES.has(messageType)) return false;

  const senderId = normalizeId(message?.sender_id ?? message?.user_id ?? message?.sender?.id);
  if (!senderId || senderId === normalizeId(currentUserId)) return false;
  return normalizeIdList(hiddenUserIds).includes(senderId);
}
