const MAX_PENDING_BYTES = 10 * 1024 * 1024;

chrome.runtime.onMessage.addListener((message, sender) => {
  if (sender.id !== chrome.runtime.id) return;
  const origin = sender.tab?.url ? new URL(sender.tab.url).origin : "";
  if (origin !== "https://app.7shifts.com") return;
  if (!['HEARTH_CAPTURED_RESPONSE', 'HEARTH_SELECTED_SCREEN'].includes(message?.type)) return;
  const serialized = JSON.stringify(message);
  if (serialized.length > MAX_PENDING_BYTES) return;
  void sendSelectedEvidence(message);
});

async function sendSelectedEvidence(message) {
  const { evidenceCapability } = await chrome.storage.session.get("evidenceCapability");
  if (!evidenceCapability) {
    await chrome.storage.session.set({ pendingEvidence: { ...message, capturedAt: new Date().toISOString() } });
    return;
  }
  await chrome.storage.session.remove(["evidenceCapability", "pendingEvidence"]);
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
  await fetch("https://hearth-books.jonathan-beaulne123.workers.dev/work/evidence/capability-upload", {
    method: "POST",
    headers: { Authorization: `Evidence ${evidenceCapability}`, "Content-Type": contentType, "X-Evidence-Capture-Kind": kind },
    body,
  });
}

chrome.tabs.onRemoved.addListener(() => chrome.storage.session.remove(["pendingEvidence", "evidenceCapability"]));
