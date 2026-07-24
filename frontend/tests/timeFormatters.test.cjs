const assert = require("node:assert/strict");
const test = require("node:test");
const vm = require("node:vm");
const esbuild = require("esbuild");

async function loadFormatters() {
  const result = await esbuild.build({
    entryPoints: ["src/utils/formatters.js"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
  });
  const module = { exports: {} };
  vm.runInNewContext(result.outputFiles[0].text, {
    module,
    exports: module.exports,
    require,
    console,
    Date,
    Intl,
  });
  return module.exports;
}

test("Korean time omits a leading zero from the hour", async () => {
  const { formatKoreanTime } = await loadFormatters();
  const afternoon = new Date(2026, 6, 24, 15, 45);

  assert.equal(formatKoreanTime(afternoon), "오후 3:45");
});

test("Korean time range omits leading zeros from both hours", async () => {
  const { formatKoreanTimeRange } = await loadFormatters();
  const start = new Date(2026, 6, 24, 15, 45);
  const end = new Date(2026, 6, 24, 17, 0);

  assert.equal(formatKoreanTimeRange(start, end), "오후 3:45~5:00");
});
