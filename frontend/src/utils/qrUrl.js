function parseHttpOrigin(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized) return null;

  try {
    const parsed = new URL(normalized);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export function resolveQrPublicOrigin(configuredOrigin, currentOrigin) {
  const fallbackOrigin = parseHttpOrigin(currentOrigin);
  const preferredOrigin = parseHttpOrigin(configuredOrigin);

  if (!preferredOrigin) return fallbackOrigin || "";
  if (fallbackOrigin?.startsWith("https://") && preferredOrigin.startsWith("http://")) {
    return fallbackOrigin;
  }
  return preferredOrigin;
}

export function buildAttendanceCheckinUrl({ token, configuredOrigin, currentOrigin }) {
  if (token === null || token === undefined || String(token).length === 0) return "";
  const origin = resolveQrPublicOrigin(configuredOrigin, currentOrigin);
  if (!origin) return "";
  return `${origin}/attendance/checkin/${encodeURIComponent(String(token))}`;
}

export function isLoopbackQrOrigin(origin) {
  const normalizedOrigin = parseHttpOrigin(origin);
  if (!normalizedOrigin) return false;
  const hostname = new URL(normalizedOrigin).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}
