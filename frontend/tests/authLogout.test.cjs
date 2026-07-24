const assert = require("node:assert/strict");
const test = require("node:test");

async function loadAuthLogout() {
  return import("../src/utils/authLogout.js");
}

test("runs preparation, Supabase signOut, and every local cleanup task", async () => {
  const { completeLogout } = await loadAuthLogout();
  const calls = [];

  const result = await completeLogout({
    beforeTasks: [() => calls.push("prepare")],
    signOut: async () => calls.push("signOut"),
    cleanupTasks: [
      () => calls.push("token"),
      () => calls.push("user"),
      () => calls.push("session"),
    ],
  });

  assert.deepEqual(calls, ["prepare", "signOut", "token", "user", "session"]);
  assert.equal(result.signOutError, null);
  assert.deepEqual(result.cleanupErrors, []);
});

test("finishes local cleanup when Supabase signOut fails", async () => {
  const { completeLogout } = await loadAuthLogout();
  const calls = [];
  const reported = [];

  const result = await completeLogout({
    signOut: async () => {
      throw new Error("signOut failed");
    },
    cleanupTasks: [
      () => calls.push("sportsmate_token"),
      () => calls.push("backendTokenReady"),
      () => calls.push("user"),
      () => calls.push("session"),
    ],
    reportError: (...args) => reported.push(args),
  });

  assert.equal(result.signOutError?.message, "signOut failed");
  assert.deepEqual(calls, ["sportsmate_token", "backendTokenReady", "user", "session"]);
  assert.equal(reported.length, 1);
});

test("isolates a cleanup error so later authentication state is still cleared", async () => {
  const { completeLogout } = await loadAuthLogout();
  const calls = [];
  const reported = [];

  const result = await completeLogout({
    cleanupTasks: [
      () => {
        throw new Error("storage unavailable");
      },
      () => calls.push("user"),
      () => calls.push("session"),
    ],
    reportError: (...args) => reported.push(args),
  });

  assert.equal(result.cleanupErrors.length, 1);
  assert.deepEqual(calls, ["user", "session"]);
  assert.equal(reported.length, 1);
});
