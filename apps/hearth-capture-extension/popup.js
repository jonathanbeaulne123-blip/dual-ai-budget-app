const status = document.querySelector("#status");
const enable = document.querySelector("#enable");
const screen = document.querySelector("#screen");
const schedule = document.querySelector("#schedule");
const timesheet = document.querySelector("#timesheet");
const stop = document.querySelector("#stop");
const pair = document.querySelector("#pair");
const capability = document.querySelector("#capability");
const companion = document.querySelector("#companion");
const register = document.querySelector("#register");
const sync = document.querySelector("#sync");
const gmail = document.querySelector("#gmail");
const selfName = document.querySelector("#selfName");

void chrome.storage.local.get(["selfDisplayName", "companionRegistration", "lastAutonomousSyncAt", "lastAutonomousError"]).then((stored) => {
  selfName.value = stored.selfDisplayName || "";
  if (stored.companionRegistration) status.textContent = stored.lastAutonomousError || `Autonomous capture registered${stored.lastAutonomousSyncAt ? ` · last ${new Date(stored.lastAutonomousSyncAt).toLocaleString()}` : ""}.`;
});
void chrome.storage.session.get(["pendingEvidence", "lastManualCaptureError"]).then((stored) => {
  if (stored.pendingEvidence && stored.lastManualCaptureError) {
    status.textContent = `Selected capture is still pending: ${stored.lastManualCaptureError} Pair a fresh one-use code and capture again.`;
  }
});

selfName.addEventListener("change", () => chrome.storage.local.set({ selfDisplayName: selfName.value.replace(/\s+/g, " ").trim().slice(0, 80) }));

register.addEventListener("click", async () => {
  const exactSelfName = selfName.value.replace(/\s+/g, " ").trim().slice(0, 80);
  const response = await chrome.runtime.sendMessage({ type: "HEARTH_REGISTER_COMPANION", token: companion.value.trim(), selfDisplayName: exactSelfName });
  if (!response?.ok) { status.textContent = response?.error || "Companion registration failed."; return; }
  companion.value = "";
  await chrome.storage.local.set({ selfDisplayName: selfName.value.replace(/\s+/g, " ").trim().slice(0, 80) });
  status.textContent = "Autonomous capture registered. Save one Schedule page and My Timesheets page below, then Sync now.";
});

sync.addEventListener("click", async () => {
  status.textContent = "Syncing fixed 7shifts projections…";
  const response = await chrome.runtime.sendMessage({ type: "HEARTH_SYNC_NOW" });
  status.textContent = response?.ok ? `Sync complete · ${response.captured} page${response.captured === 1 ? "" : "s"}.` : response?.error || "Sync failed.";
});

gmail.addEventListener("click", async () => {
  status.textContent = "Opening Google read-only consent…";
  const response = await chrome.runtime.sendMessage({ type: "HEARTH_GMAIL_CONNECT" });
  status.textContent = response?.ok ? `Gmail connected · ${response.imported} verified 7shifts message${response.imported === 1 ? "" : "s"} captured.` : response?.error || "Gmail connection failed.";
});

async function currentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !/^https:\/\/app\.7shifts\.com\//.test(tab.url || "")) throw new Error("Open an employee-visible app.7shifts.com page first.");
  return tab;
}

async function setEnabled(value) {
  const tab = await currentTab();
  await chrome.tabs.sendMessage(tab.id, { type: value ? "HEARTH_CAPTURE_ENABLE" : "HEARTH_CAPTURE_DISABLE" });
  status.textContent = value ? "Enabled for this tab only. Close or navigate away to stop." : "Off";
  screen.disabled = !value;
  schedule.disabled = !value;
  timesheet.disabled = !value;
  stop.disabled = !value;
}

async function uploadProjection(payload) {
  const local = await chrome.storage.local.get("companionRegistration");
  const session = await chrome.storage.session.get("evidenceCapability");
  const registration = local.companionRegistration;
  const capabilityToken = session.evidenceCapability;
  const useRegistration = !capabilityToken && Boolean(registration?.token);
  const token = useRegistration ? registration.token : capabilityToken;
  if (!token) throw new Error("Pair a fresh one-use code or register the companion first.");
  const response = await fetch(`https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/${useRegistration ? "companion-upload" : "capability-upload"}`, {
    method: "POST",
    headers: { Authorization: `${useRegistration ? "Companion" : "Evidence"} ${token}`, "Content-Type": "application/json", "X-Evidence-Capture-Kind": "browser-structured" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Hearth rejected the selected projection (${response.status}).`);
  if (!useRegistration) await chrome.storage.session.remove(["evidenceCapability", "pendingEvidence", "lastManualCaptureError"]);
}

enable.addEventListener("click", () => setEnabled(true).catch((error) => { status.textContent = error.message; }));
pair.addEventListener("click", async () => {
  const value = capability.value.trim();
  if (!/^[A-Za-z0-9_-]{40,80}$/.test(value)) { status.textContent = "Paste a fresh pairing code from Hearth."; return; }
  await chrome.storage.session.set({ evidenceCapability: value });
  capability.value = "";
  status.textContent = "Paired for the next selected capture only.";
});
stop.addEventListener("click", () => setEnabled(false).catch((error) => { status.textContent = error.message; }));
schedule.addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      func: globalThis.HearthVisibleSchedule.extractVisibleSchedule,
      args: [undefined, undefined, selfName.value.replace(/\s+/g, " ").trim().slice(0, 80)],
    });
    const sanitized = globalThis.HearthCaptureSafety.sanitizeVisibleResponsePayload(execution?.result);
    const payload = sanitized && execution?.result?.accountBinding ? { ...sanitized, body: JSON.stringify(sanitized.body), accountBinding: execution.result.accountBinding } : null;
    const count = Array.isArray(sanitized?.body?.shifts) ? sanitized.body.shifts.length : 0;
    if (!payload || count < 1) throw new Error("No bounded visible schedule rows were found.");
    await uploadProjection(payload);
    await chrome.storage.local.set({ scheduleUrl: tab.url, selfDisplayName: selfName.value.replace(/\s+/g, " ").trim().slice(0, 80), sevenShiftsAccountBinding: payload.accountBinding });
    status.textContent = `Captured and encrypted ${count} visible published shifts in Hearth.`;
  } catch (error) { status.textContent = error.message; }
});
timesheet.addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const [execution] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      world: "ISOLATED",
      func: globalThis.HearthVisibleTimesheet.extractVisibleTimesheet,
      args: [undefined, undefined, (await chrome.storage.local.get("sevenShiftsAccountBinding")).sevenShiftsAccountBinding],
    });
    const binding = (await chrome.storage.local.get("sevenShiftsAccountBinding")).sevenShiftsAccountBinding;
    if (!binding) throw new Error("Capture your registered employee schedule first so Hearth can bind this timesheet to the same 7shifts account.");
    const sanitized = globalThis.HearthCaptureSafety.sanitizeVisibleResponsePayload(execution?.result, { allowSelectedTimesheet: true });
    if (JSON.stringify(execution?.result?.accountBinding) !== JSON.stringify(binding)) throw new Error("The visible 7shifts employee does not match the registered schedule account.");
    const payload = sanitized ? { ...sanitized, body: JSON.stringify(sanitized.body), accountBinding: binding } : null;
    const count = Array.isArray(sanitized?.body?.timesheets) ? sanitized.body.timesheets.length : 0;
    if (!payload || count < 1) throw new Error("No bounded visible timesheet rows were found.");
    await uploadProjection(payload);
    await chrome.storage.local.set({ timesheetUrl: tab.url });
    status.textContent = `Captured and encrypted ${count} visible punch rows in Hearth.`;
  } catch (error) { status.textContent = error.message; }
});
screen.addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await chrome.tabs.sendMessage(tab.id, { type: "HEARTH_SELECTED_SCREEN", image });
    status.textContent = "Selected screen held for encrypted transfer to Hearth.";
  } catch (error) { status.textContent = error.message; }
});
