const status = document.querySelector("#status");
const enable = document.querySelector("#enable");
const screen = document.querySelector("#screen");
const schedule = document.querySelector("#schedule");
const timesheet = document.querySelector("#timesheet");
const stop = document.querySelector("#stop");
const pair = document.querySelector("#pair");
const capability = document.querySelector("#capability");

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
    });
    const payload = globalThis.HearthCaptureSafety.sanitizeVisibleResponsePayload(execution?.result);
    const count = Array.isArray(payload?.body?.shifts) ? payload.body.shifts.length : 0;
    if (!payload || count < 1) throw new Error("No bounded visible schedule rows were found.");
    const { evidenceCapability } = await chrome.storage.session.get("evidenceCapability");
    if (!evidenceCapability) throw new Error("Pair a fresh one-use code first.");
    await chrome.storage.session.remove(["evidenceCapability", "pendingEvidence"]);
    const response = await fetch("https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/capability-upload", {
      method: "POST",
      headers: { Authorization: `Evidence ${evidenceCapability}`, "Content-Type": "application/json", "X-Evidence-Capture-Kind": "browser-structured" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Hearth rejected the selected schedule (${response.status}).`);
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
    });
    const payload = globalThis.HearthCaptureSafety.sanitizeVisibleResponsePayload(execution?.result, { allowSelectedTimesheet: true });
    const count = Array.isArray(payload?.body?.timesheets) ? payload.body.timesheets.length : 0;
    if (!payload || count < 1) throw new Error("No bounded visible timesheet rows were found.");
    const { evidenceCapability } = await chrome.storage.session.get("evidenceCapability");
    if (!evidenceCapability) throw new Error("Pair a fresh one-use code first.");
    await chrome.storage.session.remove(["evidenceCapability", "pendingEvidence"]);
    const response = await fetch("https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/capability-upload", {
      method: "POST",
      headers: { Authorization: `Evidence ${evidenceCapability}`, "Content-Type": "application/json", "X-Evidence-Capture-Kind": "browser-structured" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Hearth rejected the selected timesheet (${response.status}).`);
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
