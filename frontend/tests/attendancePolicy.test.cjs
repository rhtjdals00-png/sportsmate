const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");

async function loadPolicy() {
  const result = await esbuild.build({
    entryPoints: ["src/utils/attendancePolicy.js"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, Date, Set });
  return module.exports;
}

const session = {
  id: 7,
  start_at: "2026-07-23T19:00:00",
  end_at: "2026-07-23T21:00:00",
  status: "scheduled",
};

test("KST naive values are interpreted as Korea time", async () => {
  const { parseKstDateTime } = await loadPolicy();
  assert.equal(parseKstDateTime(session.start_at).toISOString(), "2026-07-23T10:00:00.000Z");
});

test("QR policy enforces both boundaries", async () => {
  const { evaluateQrAttendance } = await loadPolicy();
  assert.equal(evaluateQrAttendance(session, "2026-07-23T18:29:00+09:00").code, "TOO_EARLY");
  assert.equal(evaluateQrAttendance(session, "2026-07-23T18:30:00+09:00").allowed, true);
  assert.equal(evaluateQrAttendance(session, "2026-07-23T20:59:59+09:00").allowed, true);
  assert.equal(evaluateQrAttendance(session, "2026-07-23T21:00:00+09:00").code, "WINDOW_CLOSED");
});

test("QR policy falls back to thirty minutes after start", async () => {
  const { evaluateQrAttendance } = await loadPolicy();
  const withoutEnd = { ...session, end_at: null };
  assert.equal(evaluateQrAttendance(withoutEnd, "2026-07-23T19:29:59+09:00").allowed, true);
  assert.equal(evaluateQrAttendance(withoutEnd, "2026-07-23T19:30:00+09:00").code, "WINDOW_CLOSED");
});

test("manual attendance blocks future and cancelled sessions", async () => {
  const { evaluateHostManualAttendance } = await loadPolicy();
  assert.equal(evaluateHostManualAttendance(session, "2026-07-23T18:59:59+09:00").code, "TOO_EARLY");
  assert.equal(evaluateHostManualAttendance(session, "2026-07-23T19:00:00+09:00").allowed, true);
  assert.equal(
    evaluateHostManualAttendance({ ...session, status: "cancelled" }, "2026-07-24T19:00:00+09:00").code,
    "SESSION_CANCELLED",
  );
});

test("same session id gets a new signature after schedule changes", async () => {
  const { attendanceSessionSignature } = await loadPolicy();
  const changed = { ...session, start_at: "2026-07-23T21:00:00", end_at: "2026-07-23T23:00:00" };
  assert.notEqual(attendanceSessionSignature(session), attendanceSessionSignature(changed));
});
