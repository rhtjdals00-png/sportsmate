const assert = require("node:assert/strict");
const test = require("node:test");

async function loadQrUrl() {
  return import("../src/utils/qrUrl.js");
}

test("uses a valid configured HTTPS origin", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  assert.equal(
    resolveQrPublicOrigin("https://frontend.example.com", "https://current.example.com"),
    "https://frontend.example.com",
  );
});

test("falls back for missing, empty, whitespace, and invalid configured origins", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  const currentOrigin = "https://current.example.com";
  assert.equal(resolveQrPublicOrigin(undefined, currentOrigin), currentOrigin);
  assert.equal(resolveQrPublicOrigin("", currentOrigin), currentOrigin);
  assert.equal(resolveQrPublicOrigin("   ", currentOrigin), currentOrigin);
  assert.equal(resolveQrPublicOrigin("sportsmate.example.com", currentOrigin), currentOrigin);
});

test("rejects unsupported protocols", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  const currentOrigin = "https://current.example.com";
  assert.equal(resolveQrPublicOrigin("ftp://frontend.example.com", currentOrigin), currentOrigin);
  assert.equal(resolveQrPublicOrigin("javascript:alert(1)", currentOrigin), currentOrigin);
});

test("normalizes trailing slash, path, query, and hash to the configured origin", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  assert.equal(
    resolveQrPublicOrigin(
      "https://frontend.example.com/some/path?source=qr#section",
      "https://current.example.com",
    ),
    "https://frontend.example.com",
  );
});

test("rejects credentials in a configured URL", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  assert.equal(
    resolveQrPublicOrigin("https://user:password@frontend.example.com", "https://current.example.com"),
    "https://current.example.com",
  );
});

test("prevents HTTPS downgrade but allows local HTTP LAN development", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  assert.equal(
    resolveQrPublicOrigin("http://frontend.example.com", "https://current.example.com"),
    "https://current.example.com",
  );
  assert.equal(
    resolveQrPublicOrigin("http://192.168.0.10:5173", "http://localhost:5173"),
    "http://192.168.0.10:5173",
  );
  assert.equal(
    resolveQrPublicOrigin("https://frontend.example.com", "http://localhost:5173"),
    "https://frontend.example.com",
  );
});

test("preserves ports and IPv4 LAN origins", async () => {
  const { resolveQrPublicOrigin } = await loadQrUrl();
  assert.equal(
    resolveQrPublicOrigin("http://192.168.1.20:4173/", "http://localhost:5173"),
    "http://192.168.1.20:4173",
  );
});

test("builds the frontend check-in path and encodes the token", async () => {
  const { buildAttendanceCheckinUrl } = await loadQrUrl();
  assert.equal(
    buildAttendanceCheckinUrl({
      token: "abc/123?next=yes",
      configuredOrigin: "https://frontend.example.com///",
      currentOrigin: "https://current.example.com",
    }),
    "https://frontend.example.com/attendance/checkin/abc%2F123%3Fnext%3Dyes",
  );
});

test("returns an empty string when the token or usable origin is missing", async () => {
  const { buildAttendanceCheckinUrl } = await loadQrUrl();
  assert.equal(
    buildAttendanceCheckinUrl({
      token: "",
      configuredOrigin: "https://frontend.example.com",
      currentOrigin: "https://current.example.com",
    }),
    "",
  );
  assert.equal(
    buildAttendanceCheckinUrl({
      token: "abc",
      configuredOrigin: "invalid",
      currentOrigin: "invalid",
    }),
    "",
  );
});

test("detects localhost and loopback origins only", async () => {
  const { isLoopbackQrOrigin } = await loadQrUrl();
  assert.equal(isLoopbackQrOrigin("http://localhost:5173"), true);
  assert.equal(isLoopbackQrOrigin("http://127.0.0.1:5173"), true);
  assert.equal(isLoopbackQrOrigin("http://[::1]:5173"), true);
  assert.equal(isLoopbackQrOrigin("http://192.168.0.10:5173"), false);
  assert.equal(isLoopbackQrOrigin("https://frontend.example.com"), false);
});
