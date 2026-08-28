const MAX_CAPTURE_CHARS = 2 * 1024 * 1024;
let enabled = false;

function safePayload(value) {
  const blocked = /authorization|cookie|password|passwd|token|bearer|session|csrf|secret|jwt/i;
  const seen = new WeakSet();
  return JSON.parse(JSON.stringify(value, (key, item) => {
    if (blocked.test(key)) return undefined;
    if (typeof item === "string" && /^(?:Bearer\s+|eyJ[A-Za-z0-9_-]+\.)/.test(item)) return "[credential removed]";
    if (item && typeof item === "object") {
      if (seen.has(item)) return "[cycle]";
      seen.add(item);
    }
    return item;
  }));
}

function acceptCapture(event) {
  if (!enabled || event.source !== window || window.top !== window || location.origin !== "https://app.7shifts.com") return;
  if (event.data?.type !== "HEARTH_7SHIFTS_VISIBLE_RESPONSE") return;
  const payload = safePayload(event.data.payload);
  const text = JSON.stringify(payload);
  if (text.length > MAX_CAPTURE_CHARS) return;
  chrome.runtime.sendMessage({ type: "HEARTH_CAPTURED_RESPONSE", payload, pagePath: location.pathname });
}

window.addEventListener("message", acceptCapture);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "HEARTH_CAPTURE_ENABLE" && window.top === window) {
    enabled = true;
    const script = document.createElement("script");
    script.src = chrome.runtime.getURL("page-bridge.js");
    script.dataset.hearthCapture = "explicit";
    (document.head || document.documentElement).append(script);
  }
  if (message?.type === "HEARTH_CAPTURE_DISABLE") enabled = false;
  if (message?.type === "HEARTH_SELECTED_SCREEN" && enabled && window.top === window && typeof message.image === "string" && message.image.startsWith("data:image/png;base64,") && message.image.length <= 10 * 1024 * 1024) {
    chrome.runtime.sendMessage({ type: "HEARTH_SELECTED_SCREEN", image: message.image, pagePath: location.pathname });
  }
});
window.addEventListener("pagehide", () => { enabled = false; });
