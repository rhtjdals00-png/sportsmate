const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");

async function loadLifecycleModule() {
  const result = await esbuild.build({
    entryPoints: ["src/utils/meetingLifecycle.js"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs"
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, { module, exports: module.exports, require, console, Date });
  return module.exports;
}

const NOW = new Date("2026-07-23T12:00:00");
const FUTURE_START = "2026-07-24T19:00:00";
const FUTURE_END = "2026-07-24T21:00:00";

test("regular meeting uses next_session start as its representative date", async () => {
  const { getMeetingRepresentativeStartAt } = await loadLifecycleModule();
  const meeting = {
    meeting_type: "regular",
    start_at: "2026-07-01T00:00:00",
    next_session: { start_at: FUTURE_START }
  };
  assert.equal(getMeetingRepresentativeStartAt(meeting), FUTURE_START);
});

test("regular meeting without a next session does not present its legacy start as current", async () => {
  const { getMeetingRepresentativeStartAt } = await loadLifecycleModule();
  assert.equal(getMeetingRepresentativeStartAt({
    meeting_type: "regular",
    start_at: "2026-07-01T00:00:00",
    next_session: null
  }), null);
});

test("one-time meeting prefers next_session when provided", async () => {
  const { getMeetingRepresentativeStartAt } = await loadLifecycleModule();
  assert.equal(getMeetingRepresentativeStartAt({
    meeting_type: "one_time",
    start_at: "2026-07-24T10:00:00",
    next_session: { start_at: FUTURE_START }
  }), FUTURE_START);
});

test("one-time meeting falls back to its meeting start", async () => {
  const { getMeetingRepresentativeStartAt } = await loadLifecycleModule();
  assert.equal(getMeetingRepresentativeStartAt({
    meeting_type: "one_time",
    start_at: FUTURE_START
  }), FUTURE_START);
});

test("missing representative date returns null", async () => {
  const { getMeetingRepresentativeStartAt } = await loadLifecycleModule();
  assert.equal(getMeetingRepresentativeStartAt({ meeting_type: "one_time" }), null);
});

test("invalid representative date returns null", async () => {
  const { getMeetingRepresentativeStartAt } = await loadLifecycleModule();
  assert.equal(getMeetingRepresentativeStartAt({
    meeting_type: "one_time",
    start_at: "not-a-date"
  }), null);
});

test("cancelled lifecycle takes priority", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "regular",
    status: "cancelled",
    end_at: "2026-07-01T23:59:59"
  }, NOW), "cancelled");
});

test("suspended lifecycle takes priority", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "regular",
    status: "suspended",
    end_at: "2026-07-01T23:59:59"
  }, NOW), "suspended");
});

test("regular meeting past its operation end is ended", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "regular",
    status: "open",
    end_at: "2026-07-22T23:59:59"
  }, NOW), "ended");
});

test("regular meeting before its operation end is not ended", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "regular",
    status: "open",
    end_at: "2026-07-24T23:59:59"
  }, NOW), "upcoming");
});

test("indefinite regular meeting without a next session is not assumed ended", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "regular",
    status: "open",
    end_at: null,
    next_session: null
  }, NOW), "upcoming");
});

test("closed regular meeting with a future session is not ended", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "regular",
    status: "closed",
    next_session: { start_at: FUTURE_START, end_at: FUTURE_END }
  }, NOW), "upcoming");
});

test("full one-time meeting with a future date is not ended", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "one_time",
    status: "full",
    start_at: FUTURE_START,
    end_at: FUTURE_END
  }, NOW), "upcoming");
});

test("one-time meeting after its explicit end is ended", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "one_time",
    status: "open",
    start_at: "2026-07-23T09:00:00",
    end_at: "2026-07-23T11:00:00"
  }, NOW), "ended");
});

test("future one-time meeting is upcoming", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "one_time",
    status: "open",
    start_at: FUTURE_START,
    end_at: FUTURE_END
  }, NOW), "upcoming");
});

test("currently active one-time meeting is ongoing", async () => {
  const { getMeetingLifecycleState } = await loadLifecycleModule();
  assert.equal(getMeetingLifecycleState({
    meeting_type: "one_time",
    status: "open",
    start_at: "2026-07-23T11:00:00",
    end_at: "2026-07-23T13:00:00"
  }, NOW), "ongoing");
});

const participationCases = [
  ["ended meeting", { meeting_type: "regular", status: "open", end_at: "2026-07-22T23:59:59" }, false],
  ["cancelled meeting", { meeting_type: "regular", status: "cancelled" }, false],
  ["suspended meeting", { meeting_type: "regular", status: "suspended" }, false],
  ["closed meeting", { meeting_type: "regular", status: "closed", next_session: { start_at: FUTURE_START } }, false],
  ["full meeting", { meeting_type: "regular", status: "full", next_session: { start_at: FUTURE_START } }, false],
  ["open upcoming meeting", { meeting_type: "regular", status: "open", next_session: { start_at: FUTURE_START } }, true]
];

for (const [name, meeting, expected] of participationCases) {
  test(`${name} participation policy`, async () => {
    const { canRequestMeetingParticipation } = await loadLifecycleModule();
    assert.equal(canRequestMeetingParticipation({ meeting, now: NOW }), expected);
  });
}

test("host cannot request participation", async () => {
  const { canRequestMeetingParticipation } = await loadLifecycleModule();
  assert.equal(canRequestMeetingParticipation({
    meeting: { meeting_type: "regular", status: "open", next_session: { start_at: FUTURE_START } },
    isHost: true,
    now: NOW
  }), false);
});

test("approved participant cannot request participation again", async () => {
  const { canRequestMeetingParticipation } = await loadLifecycleModule();
  assert.equal(canRequestMeetingParticipation({
    meeting: { meeting_type: "regular", status: "open", next_session: { start_at: FUTURE_START } },
    isApprovedParticipant: true,
    now: NOW
  }), false);
});

test("pending participant cannot request participation again", async () => {
  const { canRequestMeetingParticipation } = await loadLifecycleModule();
  assert.equal(canRequestMeetingParticipation({
    meeting: { meeting_type: "regular", status: "open", next_session: { start_at: FUTURE_START } },
    isPendingParticipant: true,
    now: NOW
  }), false);
});

const presentationCases = [
  ["cancelled", { meeting_type: "regular", status: "cancelled" }, "취소됨"],
  ["suspended", { meeting_type: "regular", status: "suspended" }, "운영중지"],
  ["ended", { meeting_type: "regular", status: "open", end_at: "2026-07-22T23:59:59" }, "종료"],
  ["open", { meeting_type: "regular", status: "open", next_session: { start_at: FUTURE_START } }, "모집중"],
  ["full", { meeting_type: "regular", status: "full", next_session: { start_at: FUTURE_START } }, "정원마감"],
  ["closed", { meeting_type: "regular", status: "closed", next_session: { start_at: FUTURE_START } }, "모집마감"]
];

for (const [name, meeting, expectedLabel] of presentationCases) {
  test(`${name} status presentation`, async () => {
    const { getMeetingStatusPresentation } = await loadLifecycleModule();
    assert.equal(getMeetingStatusPresentation(meeting, NOW).label, expectedLabel);
  });
}
