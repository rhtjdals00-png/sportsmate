const assert = require("node:assert/strict");
const test = require("node:test");

async function loadVisibility() {
  return import("../src/utils/chatMessageVisibility.js");
}

test("builds account, room type, and room scoped storage keys", async () => {
  const { buildHiddenChatUsersStorageKey } = await loadVisibility();

  assert.equal(
    buildHiddenChatUsersStorageKey(12, 34, "meeting"),
    "sportsmate_hidden_chat_users_12_meeting_34",
  );
  assert.notEqual(
    buildHiddenChatUsersStorageKey(12, 34, "meeting"),
    buildHiddenChatUsersStorageKey(13, 34, "meeting"),
  );
  assert.notEqual(
    buildHiddenChatUsersStorageKey(12, 34, "meeting"),
    buildHiddenChatUsersStorageKey(12, 35, "meeting"),
  );
  assert.notEqual(
    buildHiddenChatUsersStorageKey(12, 34, "meeting"),
    buildHiddenChatUsersStorageKey(12, 34, "direct"),
  );
});

test("does not build a storage key when a required identifier is missing", async () => {
  const { buildHiddenChatUsersStorageKey } = await loadVisibility();

  assert.equal(buildHiddenChatUsersStorageKey(null, 34), "");
  assert.equal(buildHiddenChatUsersStorageKey(12, undefined), "");
  assert.equal(buildHiddenChatUsersStorageKey(12, 34, ""), "");
});

test("parses hidden ids safely and normalizes duplicate numeric ids", async () => {
  const { parseHiddenChatUserIds } = await loadVisibility();

  assert.deepEqual(parseHiddenChatUserIds(""), []);
  assert.deepEqual(parseHiddenChatUserIds("{invalid"), []);
  assert.deepEqual(parseHiddenChatUserIds('{"id":1}'), []);
  assert.deepEqual(parseHiddenChatUserIds('[1,"1"," 2 ",null,""]'), ["1", "2"]);
});

test("adds and removes normalized ids without duplicates", async () => {
  const { addHiddenChatUserId, removeHiddenChatUserId } = await loadVisibility();

  assert.deepEqual(addHiddenChatUserId([], 7), ["7"]);
  assert.deepEqual(addHiddenChatUserId(["7"], "7"), ["7"]);
  assert.deepEqual(removeHiddenChatUserId(["7", 8], "7"), ["8"]);
  assert.deepEqual(removeHiddenChatUserId(["7"], "9"), ["7"]);
});

test("hides only a hidden user's ordinary messages", async () => {
  const { shouldHideChatMessage } = await loadVisibility();
  const hidden = ["7"];

  assert.equal(shouldHideChatMessage({ sender_id: 7, message_type: "text" }, hidden, 1), true);
  assert.equal(shouldHideChatMessage({ user_id: "7", message_type: "image" }, hidden, 1), true);
  assert.equal(shouldHideChatMessage({ sender: { id: 8 }, message_type: "text" }, hidden, 1), false);
  assert.equal(shouldHideChatMessage({ sender_id: 1, message_type: "text" }, hidden, 1), false);
  assert.equal(shouldHideChatMessage({ message_type: "text" }, hidden, 1), false);
});

test("always preserves system, notice, and schedule messages", async () => {
  const { shouldHideChatMessage } = await loadVisibility();
  const hidden = ["7"];

  assert.equal(shouldHideChatMessage({ sender_id: 7, message_type: "system" }, hidden, 1), false);
  assert.equal(shouldHideChatMessage({ sender_id: 7, message_type: "notice" }, hidden, 1), false);
  assert.equal(shouldHideChatMessage({ sender_id: 7, type: "schedule_changed" }, hidden, 1), false);
  assert.equal(shouldHideChatMessage({ sender_id: 7, type: "schedule_cancelled" }, hidden, 1), false);
});
