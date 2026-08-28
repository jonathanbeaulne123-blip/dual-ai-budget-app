/* Phone-first capture UI. Primary path: file input + capture=environment (works on HTTP). */

(() => {
  const BASE = (document.documentElement.dataset.base || "").replace(/\/$/, "");
  const ENGINE = document.documentElement.dataset.engine || "server";
  const api = (path) => `${BASE}${path}`;
  const $ = (id) => document.getElementById(id);

  const captureInput = $("captureInput");
  const libraryInput = $("libraryInput");
  const nextCaptureInput = $("nextCaptureInput");
  const nextLibraryInput = $("nextLibraryInput");

  const els = {
    error: $("error"),
    errorText: $("errorText"),
    busy: $("busy"),
    busyLabel: $("busyLabel"),
    captureHome: $("captureHome"),
    livePanel: $("livePanel"),
    liveVideo: $("liveVideo"),
    liveError: $("liveError"),
    btnLive: $("btnLive"),
    httpHint: $("httpHint"),
    previewCard: $("previewCard"),
    previewImg: $("previewImg"),
    qualityCard: $("qualityCard"),
    qualityState: $("qualityState"),
    qualitySummary: $("qualitySummary"),
    qualityReasons: $("qualityReasons"),
    successCard: $("successCard"),
    successText: $("successText"),
    slicesCard: $("slicesCard"),
    slicesList: $("slicesList"),
    guidanceCard: $("guidanceCard"),
    guidanceTitle: $("guidanceTitle"),
    guidanceMessage: $("guidanceMessage"),
    guidanceSteps: $("guidanceSteps"),
    multiCard: $("multiCard"),
    thumbs: $("thumbs"),
    btnDone: $("btnDone"),
    multiHint: $("multiHint"),
    batchCard: $("batchCard"),
    batchTitle: $("batchTitle"),
    batchMessage: $("batchMessage"),
    batchThumbs: $("batchThumbs"),
    batchWarnings: $("batchWarnings"),
    btnReset: $("btnReset"),
  };

  /** @type {{ id: string, file: File, url: string }[]} */
  let batch = [];
  /** @type {MediaStream | null} */
  let liveStream = null;

  function show(el, on = true) {
    el.hidden = !on;
  }

  function setBusy(on, label) {
    show(els.busy, on);
    if (label) els.busyLabel.textContent = label;
  }

  function showError(message) {
    els.errorText.textContent = message;
    show(els.error, true);
  }

  function clearError() {
    show(els.error, false);
  }

  function resetResults() {
    show(els.qualityCard, false);
    show(els.successCard, false);
    show(els.slicesCard, false);
    show(els.guidanceCard, false);
    show(els.multiCard, false);
    show(els.batchCard, false);
    show(els.previewCard, false);
  }

  function startOver() {
    stopLive();
    batch.forEach((item) => URL.revokeObjectURL(item.url));
    batch = [];
    renderThumbs();
    resetResults();
    show(els.captureHome, true);
    show(els.btnReset, false);
    clearError();
    captureInput.value = "";
    libraryInput.value = "";
    nextCaptureInput.value = "";
    nextLibraryInput.value = "";
  }

  function previewFile(file) {
    const url = URL.createObjectURL(file);
    els.previewImg.onload = () => URL.revokeObjectURL(url);
    els.previewImg.src = url;
    show(els.previewCard, true);
  }

  async function parseJson(res) {
    const text = await res.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch {
      body = { detail: text };
    }
    return body;
  }

  function networkFailMessage(err) {
    const msg = String(err && err.message ? err.message : err);
    if (/failed to fetch|networkerror|load failed/i.test(msg)) {
      return "Can't reach the laptop. Is Toast OCR still running? Phone and laptop must be on the same Wi-Fi. If Windows Firewall pops up, allow Python on private networks.";
    }
    return msg;
  }

  function renderQuality(quality, state) {
    els.qualityState.textContent = state;
    els.qualityState.className = "state-pill " + (state === "OK" ? "ok" : "bad");
    const score = typeof quality.score === "number" ? quality.score.toFixed(2) : "—";
    els.qualitySummary.textContent =
      `Score ${score} · Laplacian ${Math.round(quality.laplacian_variance || 0)} · ` +
      `${quality.width}×${quality.height}`;
    els.qualityReasons.innerHTML = "";
    (quality.reasons || []).forEach((r) => {
      const li = document.createElement("li");
      li.textContent = r;
      els.qualityReasons.appendChild(li);
    });
    show(els.qualityCard, true);
  }

  function renderSlices(slices) {
    els.slicesList.innerHTML = "";
    slices.forEach((sl) => {
      const fig = document.createElement("figure");
      fig.className = "slice";
      const img = document.createElement("img");
      img.src = sl.preview;
      img.alt = `Slice ${sl.index + 1}`;
      const cap = document.createElement("figcaption");
      cap.textContent = `#${sl.index + 1}  rows ${sl.content_y_start}–${sl.content_y_end}  (${sl.cut_reason.replaceAll("_", " ")})`;
      fig.append(img, cap);
      els.slicesList.appendChild(fig);
    });
    show(els.slicesCard, slices.length > 0);
  }

  function renderGuidance(guidance) {
    if (!guidance) return;
    els.guidanceTitle.textContent = guidance.title || "Need overlapping closer shots";
    els.guidanceMessage.textContent = guidance.message || "";
    els.guidanceSteps.innerHTML = "";
    (guidance.steps || []).forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      els.guidanceSteps.appendChild(li);
    });
    show(els.guidanceCard, true);
    show(els.multiCard, true);
    show(els.btnReset, true);
  }

  function renderThumbs() {
    els.thumbs.innerHTML = "";
    batch.forEach((item, index) => {
      const wrap = document.createElement("div");
      wrap.className = "thumb";
      const img = document.createElement("img");
      img.src = item.url;
      img.alt = `Shot ${index + 1}`;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${index + 1} of ${batch.length}`;
      const actions = document.createElement("div");
      actions.className = "thumb-actions";
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "▲";
      up.disabled = index === 0;
      up.addEventListener("click", () => moveShot(index, -1));
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "▼";
      down.disabled = index === batch.length - 1;
      down.addEventListener("click", () => moveShot(index, 1));
      const del = document.createElement("button");
      del.type = "button";
      del.textContent = "✕";
      del.addEventListener("click", () => removeShot(index));
      actions.append(up, down, del);
      wrap.append(img, meta, actions);
      els.thumbs.appendChild(wrap);
    });
    const ready = batch.length >= 2;
    els.btnDone.disabled = !ready;
    els.multiHint.textContent = ready
      ? `${batch.length} shots in order. Tap I’m done to submit.`
      : `Need at least 2 overlapping shots (${batch.length} so far).`;
  }

  function moveShot(index, delta) {
    const next = index + delta;
    if (next < 0 || next >= batch.length) return;
    const copy = batch.slice();
    const [item] = copy.splice(index, 1);
    copy.splice(next, 0, item);
    batch = copy;
    renderThumbs();
  }

  function removeShot(index) {
    const [removed] = batch.splice(index, 1);
    if (removed) URL.revokeObjectURL(removed.url);
    renderThumbs();
  }

  function addShot(file) {
    batch.push({
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      file,
      url: URL.createObjectURL(file),
    });
    renderThumbs();
  }

  function applyPrepareResult(body) {
    renderQuality(body.quality || {}, body.state);
    if (body.ok && body.slices && body.slices.length) {
      els.successText.textContent =
        `${body.slices.length} slice${body.slices.length === 1 ? "" : "s"} from a ${body.quality.width}×${body.quality.height} image.`;
      show(els.successCard, true);
      renderSlices(body.slices);
      return;
    }
    renderGuidance(body.guidance);
  }

  function applyBatchResult(body) {
    show(els.multiCard, false);
    show(els.guidanceCard, false);
    els.batchTitle.textContent = `${body.count} shots accepted`;
    const mergeMsg = (body.merge && body.merge.message) || "";
    els.batchMessage.textContent =
      `Overlap hint ${Math.round((body.overlap_hint || 0.2) * 100)}%. ${mergeMsg}`;
    els.batchThumbs.innerHTML = "";
    (body.items || []).forEach((item) => {
      const wrap = document.createElement("div");
      wrap.className = "thumb";
      const img = document.createElement("img");
      img.src = item.preview;
      img.alt = `Accepted ${item.index + 1}`;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = `${item.width}×${item.height}`;
      wrap.append(img, meta);
      els.batchThumbs.appendChild(wrap);
    });
    els.batchWarnings.innerHTML = "";
    (body.width_warnings || []).forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      els.batchWarnings.appendChild(li);
    });
    show(els.batchCard, true);
  }

  async function postPrepare(file) {
    clearError();
    resetResults();
    show(els.captureHome, false);
    show(els.livePanel, false);
    previewFile(file);
    show(els.btnReset, true);
    setBusy(true, "Checking readability…");
    if (ENGINE === "browser" && window.ToastPipeline) {
      try {
        const body = await window.ToastPipeline.prepare(file);
        setBusy(false);
        applyPrepareResult(body);
      } catch (err) {
        setBusy(false);
        showError(err && err.message ? err.message : "Could not read that photo.");
        show(els.captureHome, true);
      }
      return;
    }
    const fd = new FormData();
    fd.append("file", file, file.name || "capture.jpg");
    let res;
    try {
      res = await fetch(api("/api/prepare"), { method: "POST", body: fd });
    } catch (err) {
      setBusy(false);
      showError(networkFailMessage(err));
      show(els.captureHome, true);
      return;
    }
    const body = await parseJson(res);
    setBusy(false);
    if (!res.ok) {
      const detail = body.detail || body.error || `Server error (${res.status})`;
      showError(typeof detail === "string" ? detail : JSON.stringify(detail));
      show(els.captureHome, true);
      return;
    }
    applyPrepareResult(body);
  }

  async function submitBatch() {
    if (batch.length < 2) return;
    clearError();
    setBusy(true, "Saving the overlapping batch…");
    if (ENGINE === "browser" && window.ToastPipeline) {
      try {
        const body = await window.ToastPipeline.ingestMulti(
          batch.map((item) => item.file),
          0.2
        );
        setBusy(false);
        applyBatchResult(body);
      } catch (err) {
        setBusy(false);
        showError(err && err.message ? err.message : "Could not save that batch.");
      }
      return;
    }
    const fd = new FormData();
    batch.forEach((item, i) => {
      fd.append("files", item.file, item.file.name || `shot-${i + 1}.jpg`);
    });
    fd.append("overlap_hint", "0.2");
    let res;
    try {
      res = await fetch(api("/api/multi"), { method: "POST", body: fd });
    } catch (err) {
      setBusy(false);
      showError(networkFailMessage(err));
      return;
    }
    const body = await parseJson(res);
    setBusy(false);
    if (!res.ok) {
      const detail = body.detail || body.error || `Server error (${res.status})`;
      showError(typeof detail === "string" ? detail : JSON.stringify(detail));
      return;
    }
    applyBatchResult(body);
  }

  function onFileInput(input, handler) {
    input.addEventListener("change", () => {
      const file = input.files && input.files[0];
      input.value = "";
      if (file) handler(file);
    });
  }

  function stopLive() {
    if (liveStream) {
      liveStream.getTracks().forEach((t) => t.stop());
      liveStream = null;
    }
    els.liveVideo.srcObject = null;
    show(els.livePanel, false);
  }

  async function startLive() {
    els.liveError.hidden = true;
    if (!window.isSecureContext) {
      showError("Live camera needs HTTPS or localhost. On your phone, use Take photo instead.");
      return;
    }
    try {
      liveStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      els.liveVideo.srcObject = liveStream;
      show(els.livePanel, true);
      show(els.captureHome, false);
    } catch (err) {
      const name = err && err.name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        showError("Camera permission denied. Allow the camera, or use Take photo / camera roll.");
      } else {
        showError("Could not open the live camera. Use Take photo instead — it opens the system camera.");
      }
    }
  }

  async function captureLiveFrame() {
    const video = els.liveVideo;
    if (!video.videoWidth) {
      els.liveError.textContent = "Camera is still starting…";
      els.liveError.hidden = false;
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      stopLive();
      const file = new File([blob], "live.jpg", { type: "image/jpeg" });
      await postPrepare(file);
    }, "image/jpeg", 0.92);
  }

  $("btnCapture").addEventListener("click", () => captureInput.click());
  $("btnLibrary").addEventListener("click", () => libraryInput.click());
  $("btnNextShot").addEventListener("click", () => nextCaptureInput.click());
  $("btnNextLibrary").addEventListener("click", () => nextLibraryInput.click());
  $("btnDone").addEventListener("click", () => submitBatch());
  $("btnReset").addEventListener("click", () => startOver());
  $("errorDismiss").addEventListener("click", () => clearError());
  $("btnLive").addEventListener("click", () => startLive());
  $("btnLiveClose").addEventListener("click", () => {
    stopLive();
    show(els.captureHome, true);
  });
  $("btnShutter").addEventListener("click", () => captureLiveFrame());

  onFileInput(captureInput, postPrepare);
  onFileInput(libraryInput, postPrepare);
  onFileInput(nextCaptureInput, addShot);
  onFileInput(nextLibraryInput, addShot);

  if (window.isSecureContext && navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    show(els.btnLive, true);
    els.httpHint.textContent =
      "HTTPS is on — Take photo opens the system camera, and Live camera is available too.";
  }
  if (ENGINE === "browser") {
    const foot = $("footNote");
    if (foot) {
      foot.textContent =
        "Photos stay on this phone. Quality check and slicing run here — no laptop required. Add to Home Screen from the share menu.";
    }
  }

  if ("serviceWorker" in navigator) {
    const swUrl = BASE ? `${BASE}/sw.js` : "/sw.js";
    const scope = BASE ? `${BASE}/` : "/";
    navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
      /* non-fatal: PWA install still works without a worker on some browsers */
    });
  }
})();
