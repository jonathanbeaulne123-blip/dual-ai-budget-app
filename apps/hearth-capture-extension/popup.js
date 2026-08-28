const status = document.querySelector("#status");
const enable = document.querySelector("#enable");
const screen = document.querySelector("#screen");
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
screen.addEventListener("click", async () => {
  try {
    const tab = await currentTab();
    const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: "png" });
    await chrome.tabs.sendMessage(tab.id, { type: "HEARTH_SELECTED_SCREEN", image });
    status.textContent = "Selected screen held for encrypted transfer to Hearth.";
  } catch (error) { status.textContent = error.message; }
});
