(() => {
  if (window.top !== window || location.origin !== "https://app.7shifts.com" || window.__hearth7shiftsBridge) return;
  window.__hearth7shiftsBridge = true;
  const allowed = (url) => {
    try { const target = new URL(url, location.href); return target.origin === location.origin && /(?:api|time|shift|schedule|report|tip|labor|receipt|notification|availability)/i.test(target.pathname); }
    catch { return false; }
  };
  const publish = (kind, url, body) => window.postMessage({ type: "HEARTH_7SHIFTS_VISIBLE_RESPONSE", payload: { kind, path: new URL(url, location.href).pathname, capturedAt: new Date().toISOString(), body } }, location.origin);
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const response = await originalFetch(...args);
    const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
    const type = response.headers.get("content-type") || "";
    if (allowed(url) && /json|csv|calendar|text\//i.test(type)) response.clone().text().then((text) => { if (text.length <= 2 * 1024 * 1024) publish("fetch", url, text); }).catch(() => undefined);
    return response;
  };
  const open = XMLHttpRequest.prototype.open;
  const send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) { this.__hearthUrl = String(url); return open.call(this, method, url, ...rest); };
  XMLHttpRequest.prototype.send = function(...args) {
    this.addEventListener("load", () => { const type = this.getResponseHeader("content-type") || ""; if (allowed(this.__hearthUrl) && /json|csv|calendar|text\//i.test(type) && typeof this.responseText === "string" && this.responseText.length <= 2 * 1024 * 1024) publish("xhr", this.__hearthUrl, this.responseText); }, { once: true });
    return send.apply(this, args);
  };
})();
