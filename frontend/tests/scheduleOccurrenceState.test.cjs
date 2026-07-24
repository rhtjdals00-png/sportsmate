const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const fs = require("node:fs");

function loadModule(filePath, imports = {}) {
  let source = fs.readFileSync(filePath, "utf8");
  const exportNames = [];

  source = source.replace(
    /import\s+\{\s*([^}]+)\s*\}\s+from\s+"([^"]+)";/g,
    (_match, names, specifier) => {
      const imported = names.split(",").map((name) => name.trim());
      return imported
        .map((name) => `const ${name} = __imports[${JSON.stringify(specifier)}].${name};`)
        .join("\n");
    }
  );
  source = source.replace(/export function\s+(\w+)/g, (_match, name) => {
    exportNames.push(name);
    return `function ${name}`;
  });
  source += `\nmodule.exports = { ${exportNames.join(", ")} };`;

  const context = {
    Date,
    module: { exports: {} },
    exports: {},
    __imports: imports
  };
  vm.runInNewContext(source, context, { filename: filePath });
  return context.module.exports;
}

const utilsDir = path.resolve(__dirname, "../src/utils");
const lifecycle = loadModule(path.join(utilsDir, "meetingLifecycle.js"));
const occurrence = loadModule(
  path.join(utilsDir, "scheduleOccurrenceState.js"),
  { "./meetingLifecycle.js": lifecycle }
);

test("past regular occurrence is ended without ending the whole regular meeting", () => {
  const state = occurrence.getScheduleOccurrenceState(
    {
      meetingType: "regular",
      meetingStatus: "open",
      operationEndAt: null,
      sessionStatus: "scheduled",
      startAt: "2026-07-16T03:45:00+09:00",
      endAt: "2026-07-16T05:00:00+09:00"
    },
    "2026-07-24T12:00:00+09:00"
  );

  assert.equal(state.state, "ended");
  assert.equal(state.label, "종료됨");
});

test("future occurrence remains upcoming in the same ongoing regular meeting", () => {
  const state = occurrence.getScheduleOccurrenceState(
    {
      meetingType: "regular",
      meetingStatus: "open",
      operationEndAt: null,
      sessionStatus: "scheduled",
      startAt: "2026-07-26T13:00:00+09:00",
      endAt: "2026-07-26T14:00:00+09:00"
    },
    "2026-07-24T12:00:00+09:00"
  );

  assert.equal(state.state, "upcoming");
  assert.equal(state.isEnded, false);
});

test("recruitment closure does not make a future occurrence ended", () => {
  const state = occurrence.getScheduleOccurrenceState(
    {
      meetingType: "regular",
      meetingStatus: "closed",
      operationEndAt: null,
      sessionStatus: "scheduled",
      startAt: "2026-07-26T13:00:00+09:00",
      endAt: "2026-07-26T14:00:00+09:00"
    },
    "2026-07-24T12:00:00+09:00"
  );

  assert.equal(state.state, "upcoming");
  assert.equal(state.isEnded, false);
});

test("cancelled occurrence keeps cancellation ahead of time-derived state", () => {
  const state = occurrence.getScheduleOccurrenceState(
    {
      meetingType: "regular",
      meetingStatus: "open",
      operationEndAt: null,
      sessionStatus: "cancelled",
      startAt: "2026-07-26T13:00:00+09:00",
      endAt: "2026-07-26T14:00:00+09:00"
    },
    "2026-07-24T12:00:00+09:00"
  );

  assert.equal(state.state, "cancelled");
  assert.equal(state.label, "취소됨");
});

test("an occurrence completed earlier today remains today's completed schedule", () => {
  const state = occurrence.getScheduleOccurrenceState(
    {
      meetingType: "regular",
      meetingStatus: "open",
      operationEndAt: null,
      sessionStatus: "scheduled",
      startAt: "2026-07-24T09:00:00+09:00",
      endAt: "2026-07-24T10:00:00+09:00"
    },
    "2026-07-24T12:00:00+09:00"
  );

  assert.equal(state.state, "today");
  assert.equal(state.isEnded, false);
});

test("ended meetings move behind active meetings without changing either group order", () => {
  const items = [
    {
      id: "ended-recent",
      meetingType: "one_time",
      startAt: "2026-07-22T09:00:00+09:00",
      endAt: "2026-07-22T10:00:00+09:00"
    },
    {
      id: "active-near",
      meetingType: "regular",
      operationEndAt: null,
      startAt: "2026-07-24T15:45:00+09:00",
      endAt: "2026-07-24T17:00:00+09:00"
    },
    {
      id: "active-later",
      meetingType: "regular",
      operationEndAt: null,
      startAt: "2026-07-26T13:00:00+09:00",
      endAt: "2026-07-26T14:00:00+09:00"
    },
    {
      id: "ended-old",
      meetingType: "one_time",
      startAt: "2026-07-14T12:00:00+09:00",
      endAt: "2026-07-14T13:00:00+09:00"
    }
  ];

  const sorted = occurrence.moveEndedScheduleItemsLast(
    items,
    "2026-07-24T12:00:00+09:00"
  );

  assert.deepEqual(
    Array.from(sorted, (item) => item.id),
    ["active-near", "active-later", "ended-recent", "ended-old"]
  );
});
