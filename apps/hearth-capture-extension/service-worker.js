import {
  DAILY_ALARM,
  GMAIL_ALARM,
  GMAIL_SCOPE,
  HEARTH_EVIDENCE_ORIGIN,
  decodeBase64Url,
  exactSevenShiftsSender,
  exactSevenShiftsUrl,
  fixedProjection,
  gmailListUrl,
  torontoShiftInstant,
} from "./autonomous-sync.js";

const MAX_PENDING_BYTES = 10 * 1024 * 1024;
const EDGE_PREFIX = "hearth-7shifts-edge:";

async function setBadge(text, color = "#b23a2b") {
  await chrome.action.setBadgeBackgroundColor({ color });
  await chrome.action.setBadgeText({ text });
}

async function uploadEvidence(body, kind, contentType, options = {}) {
  const local = await chrome.storage.local.get(["companionRegistration"]);
  const session = await chrome.storage.session.get(["evidenceCapability"]);
  const companion = local.companionRegistration || null;
  const capability = session.evidenceCapability;
  const useCompanion = Boolean(options.requireCompanion || !capability);
  const credential = useCompanion ? companion?.token : capability;
  if (!credential) throw new Error(options.requireCompanion ? "Register the autonomous companion in Hearth first." : "Pair a fresh one-use code or register the companion first.");
  const response = await fetch(`${HEARTH_EVIDENCE_ORIGIN}/work/evidence/${useCompanion ? "companion-upload" : "capability-upload"}`, {
    method: "POST",
    headers: {
      Authorization: `${useCompanion ? "Companion" : "Evidence"} ${credential}`,
      "Content-Type": contentType,
      "X-Evidence-Capture-Kind": kind,
    },
    body,
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    if (useCompanion && companion && /expired|revoked|disabled/i.test(String(detail.error || ""))) {
      await chrome.storage.local.remove("companionRegistration");
      await setBadge("!");
    }
    throw new Error(detail.error || `Hearth rejected capture (${response.status}).`);
  }
  if (!useCompanion) await chrome.storage.session.remove(["evidenceCapability", "pendingEvidence", "lastManualCaptureError"]);
  await setBadge("", "#2f6b4f");
  return response.json();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (sender.id !== chrome.runtime.id) return;
  if (message?.type === "HEARTH_SYNC_NOW") {
    void syncConfigured(true).then((result) => sendResponse({ ok: true, ...result })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "HEARTH_GMAIL_CONNECT") {
    void syncGmail(true).then((result) => sendResponse({ ok: true, ...result })).catch((error) => sendResponse({ ok: false, error: error.message }));
    return true;
  }
  if (message?.type === "HEARTH_REGISTER_COMPANION") {
    const token = String(message.token || "");
    const selfDisplayName = String(message.selfDisplayName || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
    if (!/^[dp]comp_[A-Za-z0-9_-]{40,80}$/.test(token)) { sendResponse({ ok: false, error: "Paste the capture-only companion token from Hearth." }); return; }
    if (!selfDisplayName) { sendResponse({ ok: false, error: "Enter your exact 7shifts display name before registering." }); return; }
    void chrome.storage.local.set({ companionRegistration: { token, registeredAt: new Date().toISOString(), selfDisplayName }, autonomousEnabled: true })
      .then(() => chrome.storage.local.remove(["sevenShiftsAccountBinding", "scheduleUrl", "timesheetUrl"]))
      .then(() => ensureAlarms()).then(() => sendResponse({ ok: true }));
    return true;
  }
  const origin = sender.tab?.url ? new URL(sender.tab.url).origin : "";
  if (origin !== "https://app.7shifts.com") return;
  if (!["HEARTH_CAPTURED_RESPONSE", "HEARTH_SELECTED_SCREEN"].includes(message?.type)) return;
  if (JSON.stringify(message).length > MAX_PENDING_BYTES) return;
  void sendSelectedEvidence(message);
});

async function sendSelectedEvidence(message) {
  let body;
  let kind;
  let contentType;
  if (message.type === "HEARTH_SELECTED_SCREEN") {
    body = await (await fetch(message.image)).blob();
    kind = "screenshot";
    contentType = "image/png";
  } else {
    body = JSON.stringify(message.payload);
    kind = "browser-structured";
    contentType = "application/json";
  }
  try { await uploadEvidence(body, kind, contentType); } catch (error) {
    await chrome.storage.session.set({
      pendingEvidence: { ...message, capturedAt: new Date().toISOString() },
      lastManualCaptureError: String(error?.message || error || "Selected capture upload failed.").slice(0, 180),
    });
    await setBadge("!");
  }
}

async function waitForTab(tabId, timeoutMs = 20_000) {
  const existing = await chrome.tabs.get(tabId);
  if (existing.status === "complete") return existing;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); reject(new Error("7shifts page did not finish loading.")); }, timeoutMs);
    const listener = (updatedId, info, tab) => {
      if (updatedId !== tabId || info.status !== "complete") return;
      clearTimeout(timer); chrome.tabs.onUpdated.removeListener(listener); resolve(tab);
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function tabForUrl(rawUrl) {
  const url = exactSevenShiftsUrl(rawUrl);
  if (!url) throw new Error("Saved 7shifts page is invalid.");
  const tabs = await chrome.tabs.query({ url: "https://app.7shifts.com/*" });
  const existing = tabs.find((tab) => tab.id && exactSevenShiftsUrl(tab.url)?.pathname === url.pathname);
  if (existing?.id) return waitForTab(existing.id);
  const created = await chrome.tabs.create({ url: url.href, active: false });
  if (!created.id) throw new Error("Chrome could not open the quiet 7shifts tab.");
  return waitForTab(created.id);
}

async function captureProjection(rawUrl, captureClass, selfDisplayName, expectedAccountBinding = null) {
  const tab = await tabForUrl(rawUrl);
  if (!tab.id || !exactSevenShiftsUrl(tab.url)) throw new Error("Sign back into 7shifts.");
  const file = captureClass === "published-schedule" ? "visible-schedule.js" : "visible-timesheet.js";
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, world: "ISOLATED", files: [file] });
  const [execution] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "ISOLATED",
    func: (kind, ownName, accountBinding) => kind === "published-schedule"
      ? globalThis.HearthVisibleSchedule.extractVisibleSchedule(document, location.href, ownName)
      : globalThis.HearthVisibleTimesheet.extractVisibleTimesheet(document, location.href, accountBinding),
    args: [captureClass, selfDisplayName || "", expectedAccountBinding],
  });
  const projected = execution?.result;
  const payload = fixedProjection(projected, captureClass);
  if (!payload) throw new Error("7shifts changed this page shape. Hearth stopped instead of guessing.");
  if (expectedAccountBinding && JSON.stringify(payload.accountBinding) !== JSON.stringify(expectedAccountBinding)) {
    throw new Error("The signed-in 7shifts account changed. Hearth stopped before uploading; sign into the paired account or register again.");
  }
  await uploadEvidence(JSON.stringify(payload), "browser-structured", "application/json", { requireCompanion: true });
  return payload;
}

async function scheduleShiftEdges(payload) {
  const body = JSON.parse(payload.body);
  const alarms = await chrome.alarms.getAll();
  await Promise.all(alarms.filter((alarm) => alarm.name.startsWith(EDGE_PREFIX)).map((alarm) => chrome.alarms.clear(alarm.name)));
  for (const [index, row] of body.shifts.filter((item) => item.hearth_self === true).slice(0, 50).entries()) {
    const start = torontoShiftInstant(row.date, row.start_time);
    let end = torontoShiftInstant(row.date, row.end_time);
    if (start && end && end <= start) {
      const [year, month, day] = row.date.split("-").map(Number);
      const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
      end = torontoShiftInstant(nextDate, row.end_time);
    }
    if (start && start - 2 * 60 * 60_000 > Date.now()) await chrome.alarms.create(`${EDGE_PREFIX}${index}:before`, { when: start - 2 * 60 * 60_000 });
    if (end && end + 30 * 60_000 > Date.now()) {
      await chrome.alarms.create(`${EDGE_PREFIX}${index}:after`, { when: end + 30 * 60_000 });
      for (let offset = 2; offset <= 24; offset += 2) await chrome.alarms.create(`${EDGE_PREFIX}${index}:await:${offset}`, { when: end + offset * 60 * 60_000 });
    }
  }
}

async function syncConfigured(interactive = false) {
  const settings = await chrome.storage.local.get(["autonomousEnabled", "scheduleUrl", "timesheetUrl", "selfDisplayName", "companionRegistration", "sevenShiftsAccountBinding"]);
  if (!settings.autonomousEnabled || !settings.companionRegistration) return { captured: 0, detail: "Autonomous capture is off." };
  if (settings.companionRegistration.selfDisplayName !== String(settings.selfDisplayName || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA").replace(/[^a-z0-9' -]/g, "").replace(/\s+/g, " ").trim()) {
    throw new Error("The registered 7shifts employee name changed. Register the companion again before syncing.");
  }
  let captured = 0;
  try {
    let accountBinding = settings.sevenShiftsAccountBinding || null;
    if (settings.scheduleUrl) {
      const payload = await captureProjection(settings.scheduleUrl, "published-schedule", settings.selfDisplayName, accountBinding);
      accountBinding = payload.accountBinding;
      await chrome.storage.local.set({ sevenShiftsAccountBinding: accountBinding });
      await scheduleShiftEdges(payload);
      captured += 1;
    }
    if (settings.timesheetUrl) {
      if (!accountBinding) throw new Error("Capture the registered employee's published schedule once before syncing My Timesheets.");
      await captureProjection(settings.timesheetUrl, "punch", settings.selfDisplayName, accountBinding); captured += 1;
    }
    if (interactive) await syncGmail(false).catch(() => null);
    await chrome.storage.local.set({ lastAutonomousSyncAt: new Date().toISOString(), lastAutonomousError: "" });
    return { captured };
  } catch (error) {
    await chrome.storage.local.set({ lastAutonomousError: error.message });
    await setBadge("!");
    throw error;
  }
}

async function gmailToken(interactive) {
  const result = await chrome.identity.getAuthToken({ interactive, scopes: [GMAIL_SCOPE] });
  const token = typeof result === "string" ? result : result?.token;
  if (!token) throw new Error("Google Gmail read-only consent is not configured for this extension build.");
  return token;
}

async function gmailJson(url, token) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const error = new Error(`Gmail returned ${response.status}.`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

async function gmailMessageIds(token, historyId) {
  const ids = new Set();
  let url = gmailListUrl(historyId);
  let newestHistoryId = historyId || null;
  for (let page = 0; page < 10 && url; page += 1) {
    const body = await gmailJson(url, token);
    newestHistoryId = body.historyId || newestHistoryId;
    for (const item of body.messages || []) if (item.id) ids.add(item.id);
    for (const history of body.history || []) for (const added of history.messagesAdded || []) if (added.message?.id) ids.add(added.message.id);
    const pageToken = body.nextPageToken;
    if (!pageToken) break;
    url = `${gmailListUrl(historyId)}&pageToken=${encodeURIComponent(pageToken)}`;
  }
  return { ids: [...ids].slice(0, 1000), historyId: newestHistoryId };
}

async function syncGmail(interactive) {
  const settings = await chrome.storage.local.get(["companionRegistration", "gmailHistoryId", "gmailConnected"]);
  if (!settings.companionRegistration) throw new Error("Register the autonomous companion first.");
  if (!interactive && !settings.gmailConnected) return { imported: 0 };
  const token = await gmailToken(interactive);
  let listing;
  try { listing = await gmailMessageIds(token, settings.gmailHistoryId); }
  catch (error) {
    if (error.status !== 404 || !settings.gmailHistoryId) throw error;
    listing = await gmailMessageIds(token, null);
  }
  let imported = 0;
  for (const id of listing.ids) {
    const message = await gmailJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(id)}?format=raw`, token);
    const bytes = decodeBase64Url(message.raw);
    if (!exactSevenShiftsSender(bytes)) continue;
    await uploadEvidence(bytes, "gmail-7shifts-email", "message/rfc822", { requireCompanion: true });
    imported += 1;
    if (message.historyId && (!listing.historyId || BigInt(message.historyId) > BigInt(listing.historyId))) listing.historyId = message.historyId;
  }
  await chrome.storage.local.set({ gmailConnected: true, gmailHistoryId: listing.historyId, lastGmailSyncAt: new Date().toISOString() });
  return { imported };
}

async function ensureAlarms() {
  await chrome.alarms.create(DAILY_ALARM, { delayInMinutes: 1, periodInMinutes: 24 * 60 });
  await chrome.alarms.create(GMAIL_ALARM, { delayInMinutes: 10, periodInMinutes: 2 * 60 });
}

chrome.runtime.onInstalled.addListener(() => { void ensureAlarms(); });
chrome.runtime.onStartup.addListener(() => { void ensureAlarms().then(() => syncConfigured(false)); });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === GMAIL_ALARM) void syncGmail(false).catch(() => setBadge("!"));
  else if (alarm.name === DAILY_ALARM || alarm.name.startsWith(EDGE_PREFIX)) void syncConfigured(false).catch(() => setBadge("!"));
});
chrome.tabs.onRemoved.addListener(() => chrome.storage.session.remove(["pendingEvidence", "evidenceCapability"]));
