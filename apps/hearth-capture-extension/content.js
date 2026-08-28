let enabled = false;

function acceptCapture(event) {
  if (!enabled || event.source !== window || window.top !== window || location.origin !== "https://app.7shifts.com") return;
  if (event.data?.type !== "HEARTH_7SHIFTS_VISIBLE_RESPONSE") return;
  const payload = globalThis.HearthCaptureSafety?.sanitizeVisibleResponsePayload(event.data.payload);
  if (!payload) return;
  chrome.runtime.sendMessage({ type: "HEARTH_CAPTURED_RESPONSE", payload, pagePath: location.pathname });
}

window.addEventListener("message", acceptCapture);
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "HEARTH_CAPTURE_ENABLE" && window.top === window) {
    enabled = true;
    const safety = document.createElement("script");
    safety.src = chrome.runtime.getURL("capture-safety.js");
    safety.dataset.hearthCapture = "safety";
    safety.addEventListener("load", () => {
      const script = document.createElement("script");
      script.src = chrome.runtime.getURL("page-bridge.js");
      script.dataset.hearthCapture = "explicit";
      (document.head || document.documentElement).append(script);
      safety.remove();
    }, { once: true });
    (document.head || document.documentElement).append(safety);
  }
  if (message?.type === "HEARTH_CAPTURE_DISABLE") enabled = false;
  if (message?.type === "HEARTH_SELECTED_SCREEN" && enabled && window.top === window && typeof message.image === "string" && message.image.startsWith("data:image/png;base64,") && message.image.length <= 10 * 1024 * 1024) {
    chrome.runtime.sendMessage({ type: "HEARTH_SELECTED_SCREEN", image: message.image, pagePath: location.pathname });
  }
});
window.addEventListener("pagehide", () => { enabled = false; });
