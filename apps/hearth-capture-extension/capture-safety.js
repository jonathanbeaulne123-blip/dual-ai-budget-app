(() => {
  const BLOCKED_NORMALIZED_KEYS = ["authorization", "authentication", "authtoken", "apikey", "clientsecret", "cookie", "password", "passwd", "token", "bearer", "session", "csrf", "secret", "jwt", "prototype", "constructor"];
  const CREDENTIAL_TEXT = /(?:^|[\s"',])(?:authorization|authentication|api[_-]?key|client[_-]?secret|cookie|set-cookie|password|passwd|access[_-]?token|refresh[_-]?token|id[_-]?token|session[_-]?token|auth[_-]?token|csrf|secret|jwt)\s*[:=,]|\bBearer\s+[A-Za-z0-9._~+/=-]{12,}|\beyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/i;
  const MAX_BODY_CHARS = 2 * 1024 * 1024;

  const PATH_CLASSES = Object.freeze([
    ["punch", /\/(?:time[_-]?punches?|punches?|timesheets?)(?:\/|$)/i],
    ["published-schedule", /\/(?:schedules?|shifts?|open[_-]?shifts?|shift[_-]?pool|trades?)(?:\/|$)/i],
    ["tip-report", /\/(?:tips?|tip[_-]?reports?)(?:\/|$)/i],
    ["role-catalog", /\/(?:roles?|departments?)(?:\/|$)/i],
    ["roster", /\/(?:employees?|users?|staff|team|roster)(?:\/|$)/i],
    ["operations", /\/(?:labor|reports?|receipts?|sales|notifications?|availability|time[_-]?off|events?)(?:\/|$)/i],
  ]);

  function classify7shiftsPath(value, baseHref = "https://app.7shifts.com/") {
    try {
      const target = new URL(value, baseHref);
      if (target.origin !== "https://app.7shifts.com") return null;
      return PATH_CLASSES.find(([, pattern]) => pattern.test(target.pathname))?.[0] || null;
    } catch {
      return null;
    }
  }

  function blockedKey(key) {
    const normalizedKey = String(key).replace(/[^a-z0-9]/gi, "").toLowerCase();
    return key === "__proto__" || BLOCKED_NORMALIZED_KEYS.some((blocked) => normalizedKey.includes(blocked));
  }

  function sanitizeValue(value, seen = new WeakSet(), depth = 0) {
    if (depth > 16) return "[depth limit]";
    if (value === null || typeof value === "boolean" || typeof value === "number") return value;
    if (typeof value === "string") return CREDENTIAL_TEXT.test(value) ? "[credential removed]" : value;
    if (Array.isArray(value)) return value.slice(0, 500).map((item) => sanitizeValue(item, seen, depth + 1));
    if (!value || typeof value !== "object") return String(value ?? "");
    if (seen.has(value)) return "[cycle]";
    seen.add(value);
    const result = {};
    for (const [key, item] of Object.entries(value).slice(0, 512)) {
      if (blockedKey(key)) continue;
      result[key] = sanitizeValue(item, seen, depth + 1);
    }
    return result;
  }

  function sanitizeBody(body, contentType) {
    if (typeof body !== "string" || body.length > MAX_BODY_CHARS) return null;
    if (/json/i.test(contentType || "") || /^[\s\r\n]*[{[]/.test(body)) {
      try { return sanitizeValue(JSON.parse(body)); } catch { return null; }
    }
    if (/csv/i.test(contentType || "")) {
      const header = body.split(/\r?\n/, 1)[0] || "";
      if (header.split(",").some((key) => blockedKey(key.replace(/^\s*["']|["']\s*$/g, "")))) return null;
    }
    return CREDENTIAL_TEXT.test(body) ? null : body;
  }

  function sanitizeVisibleResponsePayload(payload, options = {}) {
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
    const path = typeof payload.path === "string" ? payload.path : "";
    const selectedTimesheet = options.allowSelectedTimesheet === true
      && payload.selectionKind === "visible-timesheet-v1"
      && /^\/my_timesheets\/?$/i.test(path);
    const captureClass = selectedTimesheet ? "punch" : classify7shiftsPath(path);
    if (!captureClass || payload.captureClass !== captureClass) return null;
    const contentType = String(payload.contentType || "").slice(0, 120);
    if (!/json|csv|calendar|text\//i.test(contentType)) return null;
    const body = sanitizeBody(payload.body, contentType);
    if (body === null) return null;
    return {
      version: 1,
      captureClass,
      ...(selectedTimesheet ? { selectionKind: "visible-timesheet-v1" } : {}),
      transport: payload.transport === "xhr" ? "xhr" : "fetch",
      path,
      capturedAt: typeof payload.capturedAt === "string" ? payload.capturedAt : new Date().toISOString(),
      contentType,
      body,
    };
  }

  globalThis.HearthCaptureSafety = Object.freeze({
    classify7shiftsPath,
    sanitizeVisibleResponsePayload,
  });
})();
