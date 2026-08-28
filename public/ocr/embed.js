/* Toast OCR iframe loader. Drop on any HTTPS page:
 *   <div id="toast-ocr"></div>
 *   <script src="https://…/ocr/embed.js" data-mount="#toast-ocr" data-fill="#notes"></script>
 * Or: ToastOcr.mount("#toast-ocr", { onResult({ text }) { … } })
 */
(() => {
  const MSG_PREFIX = "toast-ocr:";
  const script = document.currentScript;
  const scriptUrl = (() => {
    if (script && script.src) return new URL(script.src, window.location.href);
    return new URL("embed.js", window.location.href);
  })();

  function defaultFrameSrc() {
    const override = script && script.getAttribute("data-src");
    if (override) return new URL(override, window.location.href).href;
    const dir = scriptUrl.pathname.replace(/\/[^/]+$/, "") || "";
    const path = dir.endsWith("/static") ? "/" : `${dir}/`;
    const url = new URL(path, scriptUrl.origin);
    url.searchParams.set("embed", "1");
    if (window.location.protocol === "http:" || window.location.protocol === "https:") {
      url.searchParams.set("parent", window.location.origin);
    }
    return url.href;
  }

  function resolveTarget(selector) {
    if (!selector) return null;
    if (typeof selector !== "string") return selector;
    return document.querySelector(selector);
  }

  function fillField(el, text) {
    if (!el) return;
    if ("value" in el) {
      el.value = text;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    el.textContent = text;
  }

  function mount(selector, options) {
    const opts = options || {};
    const el = resolveTarget(selector);
    if (!el) throw new Error(`Toast OCR: mount target not found: ${selector}`);

    const fillSel = opts.fill || (script && script.getAttribute("data-fill")) || "";
    const fillEl = fillSel ? resolveTarget(fillSel) : null;

    const iframe = document.createElement("iframe");
    iframe.title = opts.title || "Toast OCR";
    iframe.setAttribute("allow", "camera; clipboard-write");
    iframe.setAttribute("loading", "lazy");
    iframe.style.cssText =
      "display:block;width:100%;border:0;min-height:420px;background:#1a1612;";
    iframe.src = opts.src || defaultFrameSrc();

    const frameOrigin = new URL(iframe.src, window.location.href).origin;

    function onMessage(event) {
      if (event.origin !== frameOrigin) return;
      if (event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || typeof data.type !== "string" || data.type.indexOf(MSG_PREFIX) !== 0) return;
      if (data.type === "toast-ocr:resize" && typeof data.height === "number") {
        iframe.style.height = `${Math.max(320, Math.ceil(data.height))}px`;
      }
      if (data.type === "toast-ocr:result") {
        fillField(fillEl, data.text || "");
        if (typeof opts.onResult === "function") opts.onResult(data);
      }
      if (data.type === "toast-ocr:error" && typeof opts.onError === "function") {
        opts.onError(data);
      }
      if (data.type === "toast-ocr:ready" && typeof opts.onReady === "function") {
        opts.onReady(data);
      }
      if (data.type === "toast-ocr:reset") {
        fillField(fillEl, "");
        if (typeof opts.onReset === "function") opts.onReset(data);
      }
    }

    window.addEventListener("message", onMessage);
    el.replaceChildren(iframe);

    return {
      iframe,
      reset() {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: "toast-ocr:reset" }, frameOrigin);
        }
      },
      destroy() {
        window.removeEventListener("message", onMessage);
        iframe.remove();
      },
    };
  }

  window.ToastOcr = { mount };

  const autoMount = script && script.getAttribute("data-mount");
  if (autoMount) {
    const boot = () => {
      try {
        mount(autoMount, {
          fill: (script && script.getAttribute("data-fill")) || undefined,
          src: (script && script.getAttribute("data-src")) || undefined,
        });
      } catch (err) {
        console.error(err);
      }
    };
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", boot);
    } else {
      boot();
    }
  }
})();
