export const HEARTH_EVIDENCE_ORIGIN = "https://hearth-books.jonathan-beaulne123.workers.dev";
export const DAILY_ALARM = "hearth-7shifts-daily";
export const GMAIL_ALARM = "hearth-7shifts-gmail";
export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function exactSevenShiftsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "app.7shifts.com" ? url : null;
  } catch {
    return null;
  }
}

export function projectionClassForUrl(value) {
  const url = exactSevenShiftsUrl(value);
  if (!url) return null;
  if (/^\/my[_-]?timesheets?\/?$/i.test(url.pathname)) return "punch";
  if (/\/schedule\/\d{4}-\d{2}-\d{2}(?:\/|$)/.test(url.pathname)) return "published-schedule";
  return null;
}

export function torontoShiftInstant(date, clock) {
  const dateMatch = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const clockMatch = String(clock || "").match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!dateMatch || !clockMatch) return null;
  let hour = Number(clockMatch[1]) % 12;
  if (clockMatch[3].toLowerCase() === "pm") hour += 12;
  const target = Date.UTC(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]), hour, Number(clockMatch[2]), 0);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    guess += target - represented;
  }
  return Number.isFinite(guess) ? guess : null;
}

export function fixedProjection(value, expectedClass) {
  if (!value || typeof value !== "object" || value.version !== 1 || value.captureClass !== expectedClass
    || value.transport !== "fetch" || value.contentType !== "application/json" || typeof value.body !== "string") return null;
  if (!value.accountBinding || !/^[a-z0-9' -]{1,80}$/.test(String(value.accountBinding.normalizedSelf || ""))
    || !/^employee:[A-Za-z0-9_-]{1,80}$/.test(String(value.accountBinding.subjectKey || ""))
    || !/^location:[0-9]{1,20}$/.test(String(value.accountBinding.locationKey || ""))) return null;
  const url = exactSevenShiftsUrl(`https://app.7shifts.com${String(value.path || "")}`);
  if (!url || JSON.stringify(value).length > 300 * 1024) return null;
  let body;
  try { body = JSON.parse(value.body); } catch { return null; }
  const rows = expectedClass === "published-schedule" ? body.shifts : body.timesheets;
  if (!Array.isArray(rows) || !rows.length || rows.length > 500) return null;
  if (expectedClass === "punch" && value.selectionKind !== "visible-timesheet-v1") return null;
  return value;
}

export function decodeBase64Url(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export function exactSevenShiftsSender(bytes) {
  const header = new TextDecoder("utf-8", { fatal: false }).decode(bytes.slice(0, Math.min(bytes.length, 64 * 1024)))
    .split(/\r?\n\r?\n/, 1)[0]
    .replace(/\r?\n[ \t]+/g, " ");
  const from = header.match(/^From:\s*(.+)$/im)?.[1] || "";
  const address = from.match(/<([^>]+)>/)?.[1] || from.match(/([A-Z0-9._%+-]+@[A-Z0-9.-]+)/i)?.[1] || "";
  const domain = address.toLowerCase().split("@")[1] || "";
  return domain === "7shifts.com" || domain.endsWith(".7shifts.com");
}

export function gmailListUrl(historyId) {
  if (historyId) return `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${encodeURIComponent(historyId)}&historyTypes=messageAdded&maxResults=100`;
  return "https://gmail.googleapis.com/gmail/v1/users/me/messages?q=from%3A%287shifts.com%29%20newer_than%3A2y&maxResults=100";
}
