const MAX_TEXT_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 500;
const MAX_COLUMNS = 256;
const MAX_MIME_PARTS = 32;
const MAX_MIME_DEPTH = 4;
const MAX_DRIFT_PER_RECORD = 128;
const PARSER_VERSION = "hearth-s7-extract-v1";

const KNOWN_KEYS = new Set([
  "id", "uuid", "timepunchid", "timepunchuuid", "punchid", "timesheetid", "shiftid", "revision", "version", "updatedat", "modifiedat",
  "companyid", "tenantid", "locationid", "roleid", "departmentid", "user_id", "userid", "employeeid", "staffid", "employee", "employeename",
  "date", "businessdate", "workdate", "clockedin", "clockedout", "punchin", "punchout", "start", "end", "starttime", "endtime", "startedat", "endedat",
  "breaks", "breakminutes", "paidbreakminutes", "unpaidbreakminutes", "totalbreakminutes", "paidbreaks", "unpaidbreaks",
  "hours", "totalhours", "workedhours", "workedminutes", "regularhours", "overtimehours", "holidayhours", "compliancehours",
  "approved", "isapproved", "approvalstatus", "status", "closed", "isclosed", "final", "deleted", "isdeleted", "flags", "modifications", "auto_clocked_out", "autoclockedout",
  "tips", "cashtips", "cardtips", "credittips", "totaltips", "declaredtips", "withheldcardtips", "gratuity", "tipin", "tipout", "earnedtips",
  "wages", "grosspay", "finalwages", "regularwages", "overtimewages", "holidaywages", "compliancepay", "estimatedwage", "hourlywage",
  "sales", "salescents", "netsales", "grosssales", "covers", "headcount", "customersserved", "staffing", "staffingcount",
  "artifactdigest", "sourceartifactdigest", "provider", "data", "results", "rows", "items", "timepunches", "punches", "timesheets", "shifts", "reports", "shiftDraft",
].map(key));

function key(value) {
  return String(value || "").replace(/[^A-Za-z0-9]/g, "").toLowerCase();
}

function bounded(value, max = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function scalar(value) {
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) ? value : bounded(value, 80);
  if (typeof value === "string") return bounded(value, 500);
  return bounded(JSON.stringify(value), 500);
}

function stableToken(value) {
  let hash = 0x811c9dc5;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function find(row, aliases) {
  if (!row || typeof row !== "object" || Array.isArray(row)) return { name: null, value: undefined };
  const wanted = new Set(aliases.map(key));
  for (const [name, value] of Object.entries(row)) if (wanted.has(key(name))) return { name, value };
  return { name: null, value: undefined };
}

function numberValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const clean = String(value ?? "").replace(/,/g, "").replace(/[^0-9+.-]/g, "");
  if (!clean || !/^[+-]?(?:\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const parsed = Number(clean);
  return Number.isFinite(parsed) ? parsed : null;
}

function integer(value, min, max) {
  const parsed = numberValue(value);
  if (parsed === null) return null;
  const result = Math.round(parsed);
  return Number.isSafeInteger(result) && result >= min && result <= max ? result : null;
}

function cents(value) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    const nested = find(value, ["amount_cents", "cents", "amount", "value", "total", "gross"]).value;
    return nested === undefined ? null : cents(nested);
  }
  const text = String(value).trim();
  const parsed = numberValue(value);
  if (parsed === null || parsed < 0) return null;
  const explicitlyCents = /cents?$/i.test(text.replace(/\s+/g, ""));
  const decimalOrCurrency = /[.$,]/.test(text);
  const result = explicitlyCents || (!decimalOrCurrency && Number.isInteger(parsed) && parsed > 10_000)
    ? Math.round(parsed)
    : Math.round(parsed * 100);
  return Number.isSafeInteger(result) && result >= 0 && result <= 100_000_000 ? result : null;
}

const torontoFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});
const torontoDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto", year: "numeric", month: "2-digit", day: "2-digit",
});

function torontoDate(ms) {
  const parts = Object.fromEntries(torontoDateFormatter.formatToParts(new Date(ms)).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function torontoParts(ms) {
  return Object.fromEntries(torontoFormatter.formatToParts(new Date(ms)).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

function torontoInstant(date, time) {
  const isoDate = String(date || "").trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const mdyDate = String(date || "").trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  let year; let month; let day;
  if (isoDate) [year, month, day] = [Number(isoDate[1]), Number(isoDate[2]), Number(isoDate[3])];
  else if (mdyDate) [month, day, year] = [Number(mdyDate[1]), Number(mdyDate[2]), Number(mdyDate[3])];
  else return null;
  const clock = String(time || "").trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!clock) return null;
  let hour = Number(clock[1]);
  const minute = Number(clock[2]);
  const second = Number(clock[3] || 0);
  if (clock[4]) { if (hour === 12) hour = 0; if (clock[4].toLowerCase() === "pm") hour += 12; }
  if (year < 2000 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const target = Date.UTC(year, month - 1, day, hour, minute, second);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = torontoParts(guess);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    guess += target - represented;
  }
  return new Date(guess).toISOString();
}

function explicitInstant(value) {
  const text = String(value ?? "").trim();
  if (!text) return null;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) {
    const parsed = Date.parse(text);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
  }
  const combined = text.match(/^(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})[ T](\d{1,2}:\d{2}(?::\d{2})?\s*(?:am|pm)?)$/i);
  return combined ? torontoInstant(combined[1], combined[2]) : null;
}

function dateKey(value) {
  const text = String(value ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (!match) return null;
  const month = Number(match[1]); const day = Number(match[2]); const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function rowInstant(row, directAliases, dateAliases, timeAliases) {
  const direct = find(row, directAliases);
  const parsed = explicitInstant(direct.value);
  if (parsed) return { value: parsed, path: direct.name };
  const date = find(row, dateAliases);
  const time = find(row, timeAliases);
  const combined = torontoInstant(dateKey(date.value), time.value);
  return combined ? { value: combined, path: `${date.name}+${time.name}` } : { value: null, path: null };
}

function minutesBetween(startedAt, endedAt) {
  const result = Math.round((Date.parse(endedAt) - Date.parse(startedAt)) / 60_000);
  return Number.isSafeInteger(result) && result > 0 && result <= 36 * 60 ? result : null;
}

function breakFacts(row, stopAt) {
  const breaks = find(row, ["breaks"]).value;
  let paid = 0; let unpaid = 0;
  if (Array.isArray(breaks)) {
    for (const item of breaks.slice(0, 32)) {
      if (!item || typeof item !== "object" || Array.isArray(item)) continue;
      const start = explicitInstant(find(item, ["clocked_in", "start", "started_at"]).value);
      const end = explicitInstant(find(item, ["clocked_out", "end", "ended_at"]).value) || stopAt;
      const duration = start && end ? minutesBetween(start, end) : integer(find(item, ["minutes", "duration_minutes", "duration"]).value, 0, 24 * 60);
      if (duration === null) continue;
      const paidFlag = find(item, ["paid", "is_paid", "break_type"]).value;
      const isPaid = paidFlag === true || /paid/i.test(String(paidFlag || "")) && !/unpaid/i.test(String(paidFlag || ""));
      if (isPaid) paid += duration; else unpaid += duration;
    }
  }
  const directPaid = integer(find(row, ["paid_break_minutes", "paid breaks", "paid_breaks"]).value, 0, 24 * 60);
  const directUnpaid = integer(find(row, ["unpaid_break_minutes", "unpaid breaks", "unpaid_breaks"]).value, 0, 24 * 60);
  const total = integer(find(row, ["break_minutes", "total_break_minutes", "breaks minutes"]).value, 0, 24 * 60);
  if (directPaid !== null) paid = directPaid;
  if (directUnpaid !== null) unpaid = directUnpaid;
  else if (total !== null) unpaid = Math.max(0, total - paid);
  return { paid, unpaid };
}

function finality(row, endedAt) {
  const deleted = find(row, ["deleted", "is_deleted"]).value === true;
  if (deleted) return "provisional";
  const status = bounded(find(row, ["approval_status", "status"]).value, 40).toLowerCase();
  const approvedValue = find(row, ["approved", "is_approved"]).value;
  const approved = approvedValue === true || /^(?:1|yes|y|true)$/i.test(String(approvedValue || "")) || /approved|final/.test(status);
  const closed = find(row, ["closed", "is_closed", "final"]).value === true || /closed|final|paid/.test(status);
  if (approved && closed) return "final";
  if (approved) return "approved";
  return endedAt ? "provisional" : "outlook";
}

function observation(field, value, unit, sourcePath, finalityValue, extraction, confidenceBps = 10_000) {
  if (value === null || value === undefined || value === "") return null;
  return { field, value, unit, sourcePath: bounded(sourcePath || field, 160), confidenceBps, finality: finalityValue, extraction, conflict: "clear" };
}

function addMoney(observations, row, aliases, field, sourcePath, finalityValue, extraction, allowFinal = true) {
  let found = find(row, aliases);
  if (found.value === undefined) {
    for (const containerName of ["tips", "wages", "pay", "earnings", "sales"]) {
      const container = find(row, [containerName]).value;
      const nested = find(container, aliases);
      if (nested.value !== undefined) { found = { name: `${containerName}.${nested.name}`, value: nested.value }; break; }
    }
  }
  const value = /cents/i.test(String(found.name || ""))
    ? integer(found.value, 0, 100_000_000)
    : cents(found.value);
  if (value === null) return;
  observations.push(observation(field, value, "cad-cents", `${sourcePath}.${found.name}`, finalityValue, extraction, allowFinal ? 10_000 : 9_000));
}

function driftForRow(row, sourcePath) {
  const result = [];
  for (const [name, value] of Object.entries(row || {})) {
    if (KNOWN_KEYS.has(key(name))) continue;
    result.push({ path: `${sourcePath}.${bounded(name, 80)}`, value: scalar(value), valueType: Array.isArray(value) ? "array" : value === null ? "null" : typeof value });
    if (result.length >= MAX_DRIFT_PER_RECORD) break;
  }
  return result;
}

function normalizeStructuredRow(row, sourcePath, captureKind) {
  const start = rowInstant(row, ["clocked_in", "punch_in", "started_at", "start"], ["date", "business_date", "work_date"], ["clock in", "start time", "in"]);
  let end = rowInstant(row, ["clocked_out", "punch_out", "ended_at", "end"], ["date", "business_date", "work_date"], ["clock out", "end time", "out"]);
  if (start.value && end.value && Date.parse(end.value) <= Date.parse(start.value)) end = { ...end, value: new Date(Date.parse(end.value) + 86_400_000).toISOString() };
  const elapsed = start.value && end.value ? minutesBetween(start.value, end.value) : null;
  const breaks = breakFacts(row, end.value);
  const explicitMinutes = integer(find(row, ["worked_minutes"]).value, 0, 36 * 60);
  const hours = numberValue(find(row, ["worked_hours", "total_hours", "hours"]).value);
  const workedMinutes = explicitMinutes ?? (hours !== null && hours >= 0 && hours <= 36 ? Math.round(hours * 60) : elapsed !== null ? Math.max(0, elapsed - breaks.paid - breaks.unpaid) : null);
  const date = dateKey(find(row, ["date", "business_date", "work_date"]).value)
    || (start.value ? torontoDate(Date.parse(start.value)) : null);
  const finalityValue = finality(row, end.value);
  const extraction = captureKind === "local-ocr" ? "local-ocr" : captureKind === "cloud-vision" ? "cloud-vision" : "structured";
  const observations = [];
  observations.push(observation("date", date, "date", `${sourcePath}.date`, finalityValue, extraction));
  observations.push(observation("startedAt", start.value, "iso-time", `${sourcePath}.${start.path}`, finalityValue, extraction));
  observations.push(observation("endedAt", end.value, "iso-time", `${sourcePath}.${end.path}`, finalityValue, extraction));
  observations.push(observation("workedMinutes", workedMinutes, "minutes", `${sourcePath}.worked`, finalityValue, extraction));
  observations.push(observation("paidBreakMinutes", breaks.paid, "minutes", `${sourcePath}.breaks.paid`, finalityValue, extraction));
  observations.push(observation("unpaidBreakMinutes", breaks.unpaid, "minutes", `${sourcePath}.breaks.unpaid`, finalityValue, extraction));
  const regularHours = numberValue(find(row, ["regular_hours"]).value);
  const overtimeHours = numberValue(find(row, ["overtime_hours"]).value);
  const holidayHours = numberValue(find(row, ["holiday_hours"]).value);
  if (regularHours !== null) observations.push(observation("regularMinutes", Math.round(regularHours * 60), "minutes", `${sourcePath}.regular_hours`, finalityValue, extraction));
  if (overtimeHours !== null) observations.push(observation("overtimeMinutes", Math.round(overtimeHours * 60), "minutes", `${sourcePath}.overtime_hours`, finalityValue, extraction));
  if (holidayHours !== null) observations.push(observation("holidayMinutes", Math.round(holidayHours * 60), "minutes", `${sourcePath}.holiday_hours`, finalityValue, extraction));
  addMoney(observations, row, ["cash_tips"], "cashTipsCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["card_tips", "credit_tips"], "cardTipsCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["total_tips", "earned_tips", "tips"], "totalTipsCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["declared_tips"], "declaredTipsCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["withheld_card_tips"], "withheldCardTipsCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["gratuity"], "gratuityCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["tip_in"], "tipInCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["tip_out"], "tipOutCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["gross_pay", "final_wages", "total_wages", "wages"], finalityValue === "final" ? "finalWagesCents" : "reportedWagesCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["regular_wages"], "regularWagesCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["overtime_wages"], "overtimeWagesCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["holiday_wages"], "holidayWagesCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["compliance_pay"], "compliancePayCents", sourcePath, finalityValue, extraction);
  addMoney(observations, row, ["estimated_wage"], "estimatedWagesCents", sourcePath, "provisional", extraction, false);
  addMoney(observations, row, ["hourly_wage"], "hourlyWageCents", sourcePath, "provisional", extraction, false);
  addMoney(observations, row, ["net_sales", "gross_sales", "sales", "sales_cents"], "salesCents", sourcePath, finalityValue, extraction);
  const customers = integer(find(row, ["covers", "headcount", "customers_served"]).value, 0, 5000);
  const staffing = integer(find(row, ["staffing", "staffing_count"]).value, 1, 500);
  if (customers !== null) observations.push(observation("customersServed", customers, "count", `${sourcePath}.covers`, finalityValue, extraction));
  if (staffing !== null) observations.push(observation("staffingCount", staffing, "count", `${sourcePath}.staffing`, finalityValue, extraction));
  const approved = finalityValue === "approved" || finalityValue === "final";
  observations.push(observation("approved", approved, "boolean", `${sourcePath}.approval`, finalityValue, extraction));
  const deleted = find(row, ["deleted", "is_deleted"]).value;
  if (typeof deleted === "boolean") observations.push(observation("deleted", deleted, "boolean", `${sourcePath}.deleted`, finalityValue, extraction));
  const autoClocked = find(row, ["auto_clocked_out", "autoClockedOut"]).value;
  if (typeof autoClocked === "boolean") observations.push(observation("autoClockedOut", autoClocked, "boolean", `${sourcePath}.auto_clocked_out`, finalityValue, extraction));
  const modifications = find(row, ["modifications"]).value;
  if (Array.isArray(modifications)) observations.push(observation("modificationCount", modifications.length, "count", `${sourcePath}.modifications`, finalityValue, extraction));
  const flags = find(row, ["flags"]).value;
  if (flags !== undefined) observations.push(observation("providerFlags", bounded(JSON.stringify(flags), 500), "text", `${sourcePath}.flags`, finalityValue, extraction));
  const rawSubject = find(row, ["user_id", "employee_id", "staff_id"]).value;
  const rawTenant = find(row, ["company_id", "tenant_id"]).value;
  const rawLocation = find(row, ["location_id"]).value;
  const rawRole = find(row, ["role_id"]).value;
  const rawResource = find(row, ["id", "time_punch_id", "time_punch_uuid", "punch_id", "timesheet_id", "shift_id", "uuid"]).value;
  const revision = find(row, ["revision", "version", "updated_at", "modified_at"]).value;
  const artifactDigest = bounded(find(row, ["artifact_digest", "source_artifact_digest"]).value, 128) || null;
  const canonicalSeed = artifactDigest ? `screen:${artifactDigest}:${date || "unknown"}`
    : `shift:${rawTenant ?? "tenant"}:${rawSubject ?? "unbound"}:${rawResource ?? start.value ?? date ?? stableToken(JSON.stringify(row))}`;
  return {
    kind: start.value && end.value ? "worked-shift" : "report-fragment",
    canonicalSeed,
    rawSubject: rawSubject == null ? null : String(rawSubject),
    rawTenant: rawTenant == null ? null : String(rawTenant),
    rawLocation: rawLocation == null ? null : String(rawLocation),
    rawRole: rawRole == null ? null : String(rawRole),
    rawResource: rawResource == null ? null : String(rawResource),
    rawRevision: revision == null ? null : String(revision),
    startedAt: start.value,
    endedAt: end.value,
    workedMinutes,
    paidBreakMinutes: breaks.paid,
    observedAt: explicitInstant(find(row, ["updated_at", "modified_at"]).value),
    finality: finalityValue,
    observations: observations.filter(Boolean),
    drift: driftForRow(row, sourcePath),
    schemaShape: Object.fromEntries(Object.entries(row).map(([name, value]) => [name, Array.isArray(value) ? "array" : value === null ? "null" : typeof value])),
  };
}

function candidateRows(value) {
  if (Array.isArray(value)) return value.filter((row) => row && typeof row === "object" && !Array.isArray(row)).slice(0, MAX_ROWS);
  if (!value || typeof value !== "object") return [];
  for (const alias of ["time_punches", "punches", "timesheets", "shifts", "rows", "results", "items", "data", "reports", "shiftDraft"]) {
    const found = find(value, [alias]).value;
    if (Array.isArray(found)) return found.filter((row) => row && typeof row === "object" && !Array.isArray(row)).slice(0, MAX_ROWS);
    if (found && typeof found === "object" && !Array.isArray(found)) {
      const nested = candidateRows(found);
      if (nested.length) return nested;
    }
  }
  return [value];
}

function parseCsv(text) {
  const rows = [];
  let row = []; let field = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; if (rows.length > MAX_ROWS + 1) throw new Error("Evidence CSV has too many rows."); }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw new Error("Evidence CSV has an unterminated quoted field.");
  if (field || row.length) { row.push(field); rows.push(row); }
  if (rows.length > MAX_ROWS + 1) throw new Error("Evidence CSV has too many rows.");
  const headers = (rows.shift() || []).map((item) => bounded(item, 120));
  if (!headers.length || headers.length > MAX_COLUMNS || new Set(headers.map(key)).size !== headers.length) throw new Error("Evidence CSV headers are invalid or duplicated.");
  return rows.filter((cells) => cells.some((cell) => String(cell).trim())).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? ""])));
}

function unfoldIcs(text) {
  return text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
}

function parseIcs(text) {
  const events = [];
  let current = null;
  for (const line of unfoldIcs(text)) {
    if (line === "BEGIN:VEVENT") { current = {}; continue; }
    if (line === "END:VEVENT") { if (current) events.push(current); current = null; if (events.length > MAX_ROWS) throw new Error("Evidence calendar has too many events."); continue; }
    if (!current) continue;
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    const rawKey = line.slice(0, colon).split(";", 1)[0];
    current[rawKey] = line.slice(colon + 1);
  }
  return events.map((event, index) => {
    const convert = (value) => {
      const textValue = String(value || "");
      if (/^\d{8}T\d{6}Z$/.test(textValue)) return new Date(`${textValue.slice(0, 4)}-${textValue.slice(4, 6)}-${textValue.slice(6, 8)}T${textValue.slice(9, 11)}:${textValue.slice(11, 13)}:${textValue.slice(13, 15)}Z`).toISOString();
      if (/^\d{8}T\d{6}$/.test(textValue)) return torontoInstant(`${textValue.slice(0, 4)}-${textValue.slice(4, 6)}-${textValue.slice(6, 8)}`, `${textValue.slice(9, 11)}:${textValue.slice(11, 13)}:${textValue.slice(13, 15)}`);
      return explicitInstant(textValue);
    };
    const startedAt = convert(event.DTSTART); const endedAt = convert(event.DTEND);
    const elapsed = startedAt && endedAt ? minutesBetween(startedAt, endedAt) : null;
    const observations = [
      observation("date", startedAt ? torontoDate(Date.parse(startedAt)) : null, "date", `ics[${index}].DTSTART`, "outlook", "calendar"),
      observation("startedAt", startedAt, "iso-time", `ics[${index}].DTSTART`, "outlook", "calendar"),
      observation("endedAt", endedAt, "iso-time", `ics[${index}].DTEND`, "outlook", "calendar"),
      observation("scheduledMinutes", elapsed, "minutes", `ics[${index}].DTEND`, "outlook", "calendar"),
    ].filter(Boolean);
    return {
      kind: "schedule", canonicalSeed: `calendar:${event.UID || startedAt || index}`, rawSubject: null, rawTenant: null,
      rawLocation: event.LOCATION || null, rawRole: null, rawResource: event.UID || null, rawRevision: event.SEQUENCE || event["LAST-MODIFIED"] || null,
      startedAt, endedAt, workedMinutes: null, paidBreakMinutes: 0, observedAt: explicitInstant(event["LAST-MODIFIED"] || event.DTSTAMP), finality: "outlook",
      observations, drift: driftForRow(event, `ics[${index}]`), schemaShape: Object.fromEntries(Object.keys(event).map((name) => [name, "string"])),
    };
  });
}

function decodeQuotedPrintable(text) {
  return text.replace(/=\r?\n/g, "").replace(/=([A-Fa-f0-9]{2})/g, (_match, code) => String.fromCharCode(Number.parseInt(code, 16)));
}

function decodeBase64(text) {
  const clean = text.replace(/\s+/g, "");
  if (!clean || !/^[A-Za-z0-9+/]*={0,2}$/.test(clean)) return new Uint8Array();
  const raw = atob(clean);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function parseHeaders(raw) {
  const headers = {};
  const unfolded = raw.replace(/\r?\n[ \t]+/g, " ");
  for (const line of unfolded.split(/\r?\n/)) {
    const colon = line.indexOf(":");
    if (colon < 1) continue;
    headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim();
  }
  return headers;
}

function mimeParts(text, depth = 0, counter = { value: 0 }, path = "email") {
  if (depth > MAX_MIME_DEPTH || counter.value >= MAX_MIME_PARTS) return [];
  const split = text.search(/\r?\n\r?\n/);
  const headers = parseHeaders(split >= 0 ? text.slice(0, split) : text);
  const body = split >= 0 ? text.slice(split).replace(/^\r?\n\r?\n/, "") : "";
  const contentType = bounded(headers["content-type"] || "text/plain", 300).toLowerCase();
  const boundary = contentType.match(/boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i)?.slice(1).find(Boolean);
  if (contentType.startsWith("multipart/") && boundary) {
    return body.split(`--${boundary}`).slice(1, -1).flatMap((part, index) => mimeParts(part.replace(/^\r?\n/, ""), depth + 1, counter, `${path}.parts[${index}]`));
  }
  counter.value += 1;
  const transfer = bounded(headers["content-transfer-encoding"], 40).toLowerCase();
  let bytes;
  if (transfer === "base64") bytes = decodeBase64(body);
  else bytes = new TextEncoder().encode(transfer === "quoted-printable" ? decodeQuotedPrintable(body) : body);
  return [{ path, contentType: contentType.split(";", 1)[0], bytes, headers }];
}

function decodeText(bytes) {
  if (bytes.byteLength > MAX_TEXT_BYTES) throw new Error("Evidence text is too large to derive.");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^\uFEFF/, "");
}

function reportRow(text) {
  const take = (patterns) => patterns.map((pattern) => text.match(pattern)?.[1]).find(Boolean);
  return {
    date: take([/\bDate\s*[:=]\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i]),
    "Clock In": take([/\bClock\s*In\s*[:=]\s*([^\r\n]+)/i]),
    "Clock Out": take([/\bClock\s*Out\s*[:=]\s*([^\r\n]+)/i]),
    "Total Hours": take([/\b(?:Total|Worked)\s+Hours?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i]),
    "Regular Hours": take([/\bRegular\s+Hours?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i]),
    "Overtime Hours": take([/\bOvertime\s+Hours?\s*[:=]\s*([0-9]+(?:\.[0-9]+)?)/i]),
    "Paid Break Minutes": take([/\bPaid\s+Break(?:s|\s+Minutes)?\s*[:=]\s*([0-9]+)/i]),
    "Cash Tips": take([/\bCash\s+Tips?\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Card Tips": take([/\b(?:Card|Credit)\s+Tips?\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Total Tips": take([/\bTotal\s+Tips?\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Declared Tips": take([/\bDeclared\s+Tips?\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Withheld Card Tips": take([/\bWithheld(?:\s+Card)?\s+Tips?\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Gratuity": take([/\bGratuity\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Tip In": take([/\bTip\s*In\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Tip Out": take([/\bTip\s*Out\s*[:=]\s*\$?([0-9,.]+)/i]),
    "Gross Pay": take([/\b(?:Gross|Final)\s+(?:Pay|Wages)\s*[:=]\s*\$?([0-9,.]+)/i]),
    status: take([/\bStatus\s*[:=]\s*([^\r\n]+)/i]),
  };
}

function deriveText(text, captureKind, sourcePrefix = "source") {
  const trimmed = text.trim();
  if (!trimmed) return { records: [], drift: [], warnings: ["Evidence text was empty after decoding."] };
  if (captureKind === "selected-ics" || captureKind === "calendar-sync" || /BEGIN:VCALENDAR/i.test(trimmed)) {
    return { records: parseIcs(trimmed), drift: [], warnings: [] };
  }
  if (/^[{[]/.test(trimmed)) {
    try {
      const parsed = JSON.parse(trimmed);
      const rows = candidateRows(parsed);
      return { records: rows.map((row, index) => normalizeStructuredRow(row, `${sourcePrefix}.rows[${index}]`, captureKind)), drift: [], warnings: [] };
    } catch (error) {
      if (captureKind === "selected-json" || captureKind === "browser-structured" || captureKind === "local-ocr" || captureKind === "cloud-vision") throw error;
    }
  }
  if (captureKind === "selected-csv" || /^\s*[^\r\n,]+,[^\r\n,]+/m.test(trimmed)) {
    const rows = parseCsv(trimmed);
    return { records: rows.map((row, index) => normalizeStructuredRow(row, `${sourcePrefix}.rows[${index}]`, captureKind)), drift: [], warnings: [] };
  }
  try {
    const parsed = JSON.parse(trimmed);
    const rows = candidateRows(parsed);
    return { records: rows.map((row, index) => normalizeStructuredRow(row, `${sourcePrefix}.rows[${index}]`, captureKind)), drift: [], warnings: [] };
  } catch {
    const row = reportRow(trimmed);
    const hasFacts = Object.values(row).some((value) => value !== undefined);
    return hasFacts
      ? { records: [normalizeStructuredRow(row, `${sourcePrefix}.report`, captureKind)], drift: [], warnings: [] }
      : { records: [], drift: [{ path: `${sourcePrefix}.unrecognized-text`, value: bounded(trimmed, 500), valueType: "string" }], warnings: ["Text did not match a supported 7shifts report shape."] };
  }
}

export function deriveEvidenceBytes(input) {
  const captureKind = bounded(input.captureKind, 40);
  const contentType = bounded(input.contentType, 100).toLowerCase();
  if (contentType === "message/rfc822" || captureKind === "email") {
    const text = decodeText(input.bytes);
    const parts = mimeParts(text);
    const records = []; const drift = []; const warnings = [];
    for (const [index, part] of parts.entries()) {
      if (["application/json", "text/csv", "text/calendar", "text/plain", "text/html"].includes(part.contentType)) {
        try {
          const result = deriveText(decodeText(part.bytes).replace(/<[^>]*>/g, " "), "email", `email.parts[${index}]`);
          records.push(...result.records.map((record) => ({ ...record, finality: record.finality === "outlook" ? "outlook" : "provisional", observations: record.observations.map((row) => ({ ...row, finality: row.finality === "outlook" ? "outlook" : "provisional", extraction: "email" })) })));
          drift.push(...result.drift); warnings.push(...result.warnings);
        } catch (error) { warnings.push(`Email part ${index + 1} was retained but not parsed: ${bounded(error?.message || error, 120)}`); }
      } else {
        drift.push({ path: `email.parts[${index}]`, value: part.contentType, valueType: "attachment" });
      }
    }
    return { parserVersion: PARSER_VERSION, records: records.slice(0, MAX_ROWS), drift: drift.slice(0, MAX_DRIFT_PER_RECORD), warnings: warnings.slice(0, 32) };
  }
  if (["application/json", "text/csv", "text/calendar", "text/plain", "text/html"].includes(contentType)
    || ["browser-structured", "browser-dom", "selected-json", "selected-csv", "selected-ics", "calendar-sync", "local-ocr", "cloud-vision"].includes(captureKind)) {
    const result = deriveText(decodeText(input.bytes).replace(contentType === "text/html" ? /<[^>]*>/g : /$^/, " "), captureKind);
    return { parserVersion: PARSER_VERSION, ...result };
  }
  return {
    parserVersion: PARSER_VERSION,
    records: [],
    drift: [{ path: "source.binary", value: contentType || "application/octet-stream", valueType: "attachment" }],
    warnings: ["Binary evidence is retained encrypted and awaits independent local/cloud extraction."],
  };
}

export const evidenceExtractionLimits = Object.freeze({
  maxRows: MAX_ROWS,
  maxColumns: MAX_COLUMNS,
  maxMimeParts: MAX_MIME_PARTS,
  maxMimeDepth: MAX_MIME_DEPTH,
  parserVersion: PARSER_VERSION,
});
