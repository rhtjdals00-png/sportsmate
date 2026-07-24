const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");

async function loadScheduleModule(entryPoint = "src/components/schedule/desktop/DesktopScheduleCalendarModal.jsx") {
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    external: ["react", "react-router-dom", "lucide-react"]
  });
  const module = { exports: {} };
  const mockRequire = (id) => {
    if (id === "lucide-react") {
      return new Proxy({}, {
        get: () => () => null
      });
    }
    if (id === "react" || id === "react-router-dom") {
      return {};
    }
    return require(id);
  };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require: mockRequire, console, Date });
  return module.exports;
}

test("desktop schedule normalization preserves meeting location fields", async () => {
  const { normalizeDesktopScheduleMeeting } = await loadScheduleModule();
  const normalized = normalizeDesktopScheduleMeeting({
    id: 1,
    title: "Meeting",
    meeting_type: "one_time",
    address: "Seoul",
    latitude: 37.5,
    longitude: 127.0,
    sessions: []
  });

  assert.equal(normalized.address, "Seoul");
  assert.equal(normalized.latitude, 37.5);
  assert.equal(normalized.longitude, 127.0);
});

test("desktop schedule normalization keeps missing coordinates undefined", async () => {
  const { normalizeDesktopScheduleMeeting } = await loadScheduleModule();
  const normalized = normalizeDesktopScheduleMeeting({
    id: 2,
    title: "Meeting",
    meeting_type: "one_time",
    sessions: []
  });

  assert.equal(normalized.address, undefined);
  assert.equal(normalized.latitude, undefined);
  assert.equal(normalized.longitude, undefined);
});

test("desktop schedule normalization prefers an ongoing session over the API next session", async () => {
  const { normalizeDesktopScheduleMeeting } = await loadScheduleModule();
  const now = Date.now();
  const ongoing = {
    id: 10,
    start_at: new Date(now - 15 * 60 * 1000).toISOString(),
    end_at: new Date(now + 60 * 60 * 1000).toISOString(),
    status: "scheduled",
  };
  const future = {
    id: 11,
    start_at: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
    end_at: new Date(now + 14 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
    status: "scheduled",
  };

  const normalized = normalizeDesktopScheduleMeeting({
    id: 3,
    title: "Regular meeting",
    meeting_type: "regular",
    sessions: [ongoing, future],
    next_session: future,
  });

  assert.equal(normalized.nextSession.id, ongoing.id);
  assert.equal(normalized.startAt, ongoing.start_at);
  assert.equal(normalized.endAt, ongoing.end_at);
});

test("desktop schedule state remains unchanged for a future one-time meeting", async () => {
  const { getDesktopScheduleState } = await loadScheduleModule("src/components/schedule/desktop/DesktopScheduleCard.jsx");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(12, 0, 0, 0);
  const end = new Date(tomorrow);
  end.setHours(13, 0, 0, 0);

  const state = getDesktopScheduleState({
    meetingType: "one_time",
    startAt: tomorrow.toISOString(),
    endAt: end.toISOString(),
    status: "open"
  });
  assert.equal(state.label, "D-1");
  assert.equal(state.isEnded, false);
  assert.equal(state.state, "upcoming");
});
