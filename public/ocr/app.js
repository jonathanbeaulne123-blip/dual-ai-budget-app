/* Phone-first capture UI. Primary path: file input + capture=environment (works on HTTP). */

(() => {
  const BASE = (document.documentElement.dataset.base || "").replace(/\/$/, "");
  const ENGINE = document.documentElement.dataset.engine || "server";
  const params = new URLSearchParams(location.search);
  const EMBED = params.get("embed") === "1" || document.documentElement.dataset.embed === "1";
  const api = (path) => `${BASE}${path}`;
  const $ = (id) => document.getElementById(id);

  function parentOrigin() {
    const raw = params.get("parent") || "";
    if (!raw) return "*";
    try {
      const parsed = new URL(raw);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "*";
      return parsed.origin;
    } catch {
      return "*";
    }
  }

  /** @type {object | null} */
  let lastQuality = null;
  /** @type {string | null} */
  let lastState = null;
  let resettingFromParent = false;

  function postToParent(type, extra) {
    if (!EMBED || window.parent === window) return;
    const payload = Object.assign({ type }, extra || {});
    try {
      window.parent.postMessage(payload, parentOrigin());
    } catch {
      /* ignore blocked postMessage */
    }
  }

  function qualitySummary(quality) {
    if (!quality || typeof quality !== "object") return null;
    return {
      score: typeof quality.score === "number" ? quality.score : null,
      width: quality.width || null,
      height: quality.height || null,
    };
  }

  function notifyResult(ocr, stitched, formatted) {
    const text =
      (formatted && formatted.text) ||
      (stitched && stitched.text) ||
      (ocr && ocr.text) ||
      "";
    if (!String(text).trim()) return;
    const blocks = ((formatted && formatted.blocks) || []).map((block) => ({
      kind: block.kind || "paragraph",
      text: block.text || "",
      line_count: block.line_count || 0,
    }));
    postToParent("toast-ocr:result", {
      text,
      blocks,
      state: lastState,
      quality: qualitySummary(lastQuality),
    });
  }

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
    ocrCard: $("ocrCard"),
    ocrTitle: $("ocrTitle"),
    ocrMeta: $("ocrMeta"),
    ocrText: $("ocrText"),
    ocrNote: $("ocrNote"),
    ocrConfidence: $("ocrConfidence"),
    btnCopy: $("btnCopy"),
    btnExportPacket: $("btnExportPacket"),
    btnDownloadCrops: $("btnDownloadCrops"),
    btnAutoTeach: $("btnAutoTeach"),
    btnAutoTeachLast: $("btnAutoTeachLast"),
    teachCard: $("teachCard"),
    teachTitle: $("teachTitle"),
    teachMeta: $("teachMeta"),
    teachLog: $("teachLog"),
    teachGrid: $("teachGrid"),
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
  /** @type {File | null} */
  let lastFile = null;
  /** @type {object | null} */
  let lastTeach = null;
  let teachPending = false;

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
    postToParent("toast-ocr:error", { message: String(message || "") });
  }

  function clearError() {
    show(els.error, false);
  }

  function resetResults() {
    show(els.qualityCard, false);
    show(els.successCard, false);
    show(els.ocrCard, false);
    if (els.ocrConfidence) {
      els.ocrConfidence.innerHTML = "";
      show(els.ocrConfidence, false);
    }
    show(els.slicesCard, false);
    show(els.guidanceCard, false);
    show(els.multiCard, false);
    show(els.batchCard, false);
    show(els.previewCard, false);
    if (els.teachCard) show(els.teachCard, false);
  }

  function startOver() {
    stopLive();
    batch.forEach((item) => URL.revokeObjectURL(item.url));
    batch = [];
    lastQuality = null;
    lastState = null;
    lastFile = null;
    lastTeach = null;
    teachPending = false;
    renderThumbs();
    resetResults();
    show(els.captureHome, true);
    show(els.btnReset, false);
    clearError();
    captureInput.value = "";
    libraryInput.value = "";
    nextCaptureInput.value = "";
    nextLibraryInput.value = "";
    if (EMBED && !resettingFromParent) postToParent("toast-ocr:reset");
  }

  function previewFile(file) {
    lastFile = file;
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

  let lastSlicePack = { slices: [], ocrSlices: [] };

  function confidenceBand(pct) {
    if (pct >= 75) return "high";
    if (pct >= 50) return "mid";
    return "low";
  }

  function confidencePct(guide) {
    if (!guide) return null;
    if (typeof guide.confidence === "number") return guide.confidence;
    if (typeof guide.overall === "number") return Math.round(guide.overall * 100);
    return null;
  }

  function renderConfidenceBlock(guide) {
    const wrap = document.createElement("div");
    wrap.className = "confidence";
    const pct = confidencePct(guide);
    if (pct === null) return wrap;
    const headline = document.createElement("p");
    headline.className = `confidence-headline ${confidenceBand(pct)}`;
    headline.textContent = `System confidence ${pct}%`;
    const sub = document.createElement("p");
    sub.className = "confidence-sub";
    const bits = [];
    if (typeof guide.text_confidence === "number") bits.push(`Text ${guide.text_confidence}%`);
    if (guide.engine_confidence) bits.push(`Engine ${guide.engine_confidence}%`);
    sub.textContent = bits.join(" · ") || "What the scorer thinks of this crop.";
    const meter = document.createElement("div");
    meter.className = "confidence-meter";
    const fill = document.createElement("span");
    fill.className = `confidence-fill ${confidenceBand(pct)}`;
    fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
    meter.appendChild(fill);
    wrap.append(headline, sub, meter);
    const list = document.createElement("ul");
    list.className = "confidence-cats";
    (guide.categories || []).forEach((c) => {
      if (c.applicable === false) return;
      const cp = typeof c.confidence === "number" ? c.confidence : Math.round((Number(c.score) || 0) * 100);
      const li = document.createElement("li");
      const name = document.createElement("span");
      name.className = "confidence-name";
      name.textContent = String(c.id || "").replace(/_/g, " ");
      const bar = document.createElement("span");
      bar.className = "confidence-bar";
      const inner = document.createElement("span");
      inner.className = `confidence-fill ${confidenceBand(cp)}`;
      inner.style.width = `${cp}%`;
      bar.appendChild(inner);
      const num = document.createElement("span");
      num.className = `confidence-pct ${confidenceBand(cp)}`;
      num.textContent = `${cp}%`;
      li.append(name, bar, num);
      list.appendChild(li);
    });
    wrap.appendChild(list);
    return wrap;
  }

  function aggregateSliceGuides(slices) {
    const rows = (slices || []).map((s) => s && s.guide).filter(Boolean);
    if (!rows.length) return null;
    const byId = new Map();
    rows.forEach((g) => {
      (g.categories || []).forEach((c) => {
        if (!c || c.applicable === false) return;
        const cur = byId.get(c.id) || { id: c.id, question: c.question, scores: [] };
        cur.scores.push(Number(c.score) || 0);
        byId.set(c.id, cur);
      });
    });
    const categories = Array.from(byId.values()).map((row) => {
      const score = row.scores.reduce((a, b) => a + b, 0) / row.scores.length;
      return {
        id: row.id,
        question: row.question,
        score,
        confidence: Math.round(score * 100),
        applicable: true,
      };
    });
    const overall =
      categories.length
        ? categories.reduce((s, c) => s + c.score, 0) / categories.length
        : rows.reduce((s, g) => s + (Number(g.overall) || 0), 0) / rows.length;
    const confs = rows
      .map((g) => (typeof g.confidence === "number" ? g.confidence : Math.round((Number(g.overall) || 0) * 100)))
      .filter((n) => typeof n === "number");
    const textCs = rows.map((g) => g.text_confidence).filter((n) => typeof n === "number");
    const engCs = rows.map((g) => g.engine_confidence).filter((n) => typeof n === "number");
    return {
      overall,
      confidence: confs.length ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length) : Math.round(overall * 100),
      text_confidence: textCs.length ? Math.round(textCs.reduce((a, b) => a + b, 0) / textCs.length) : undefined,
      engine_confidence: engCs.length ? Math.round(engCs.reduce((a, b) => a + b, 0) / engCs.length) : undefined,
      categories,
    };
  }

  function combinedGuide(ocr, text) {
    if (ocr && ocr.guide && (ocr.guide.categories || typeof ocr.guide.confidence === "number")) {
      return ocr.guide;
    }
    if (text && window.ToastGuide && typeof window.ToastGuide.scoreSnippet === "function") {
      const scored = window.ToastGuide.scoreSnippet(text);
      const slices = (ocr && ocr.slices) || [];
      const engineVals = slices.map((p) => Number(p.mean_confidence) || 0).filter((n) => n > 0);
      const engine01 = engineVals.length ? engineVals.reduce((a, b) => a + b, 0) / engineVals.length : 0;
      if (typeof window.ToastGuide.withConfidence === "function") {
        return window.ToastGuide.withConfidence(scored, engine01);
      }
      return scored;
    }
    if (ocr && ocr.slices) return aggregateSliceGuides(ocr.slices);
    if (ocr && typeof ocr.confidence === "number") return { confidence: ocr.confidence, categories: [] };
    return null;
  }

  function hideOcrConfidence() {
    if (!els.ocrConfidence) return;
    els.ocrConfidence.innerHTML = "";
    show(els.ocrConfidence, false);
  }

  function showOcrConfidence(guide) {
    if (!els.ocrConfidence) return;
    els.ocrConfidence.innerHTML = "";
    const pct = confidencePct(guide);
    if (!guide || pct === null) {
      show(els.ocrConfidence, false);
      return;
    }
    els.ocrConfidence.appendChild(renderConfidenceBlock(guide));
    show(els.ocrConfidence, true);
  }

  function defaultGuidePrompts(guide) {
    const g = guide || {};
    if (Array.isArray(g.prompts) && g.prompts.length) return g.prompts;
    return [
      { id: "letters", question: "Are the letters good?", good: !!g.letters_good },
      { id: "numbers", question: "Are the numbers good?", good: !!g.numbers_good },
      { id: "format", question: "Is the format good?", good: !!g.format_good },
    ];
  }

  function teachSnippet(part, axis, good) {
    if (!part.guide) part.guide = {};
    part.guide[`${axis}_good`] = good;
    const prompts = part.guide.prompts || defaultGuidePrompts(part.guide);
    part.guide.prompts = prompts.map((p) =>
      p.id === axis ? Object.assign({}, p, { good }) : p
    );
    const votes = {};
    votes[axis] = good;
    const payload = {
      letters_good: axis === "letters" ? good : null,
      numbers_good: axis === "numbers" || axis === "money" ? good : null,
      format_good: axis === "format" ? good : null,
      before: part.raw_text || "",
      after: part.text || "",
      votes,
      scores: part.guide || {},
    };
    if (window.ToastGuide && typeof window.ToastGuide.record === "function") {
      window.ToastGuide.record(payload);
    }
    fetch(api("/api/guide"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => undefined);
    renderSlices(lastSlicePack.slices, lastSlicePack.ocrSlices);
  }

  function renderSlices(slices, ocrSlices) {
    lastSlicePack = { slices: slices || [], ocrSlices: ocrSlices || [] };
    const byIndex = new Map();
    (ocrSlices || []).forEach((part) => {
      byIndex.set(part.slice_index, part);
    });
    els.slicesList.innerHTML = "";
    slices.forEach((sl) => {
      const fig = document.createElement("figure");
      fig.className = "slice";
      const img = document.createElement("img");
      img.src = sl.preview;
      img.alt = `Snippet ${sl.index + 1}`;
      const cap = document.createElement("figcaption");
      cap.textContent = `#${sl.index + 1}  ${(sl.cut_reason || "slice").replaceAll("_", " ")}`;
      fig.append(img, cap);
      const part = byIndex.get(sl.index);
      if (part && part.text) {
        const pre = document.createElement("pre");
        pre.className = "slice-text";
        pre.textContent = part.text;
        fig.append(pre);
        if (part.guide) fig.append(renderConfidenceBlock(part.guide));
        const guideBox = document.createElement("div");
        guideBox.className = "guide";
        const prompts = (part.guide && part.guide.prompts) || defaultGuidePrompts(part.guide);
        const primary = prompts.filter((p) => ["letters", "money", "numbers", "format"].includes(p.id));
        const shown = primary.length ? primary : prompts.slice(0, 3);
        shown.forEach((prompt) => {
          const row = document.createElement("div");
          row.className = "guide-row";
          const q = document.createElement("p");
          q.className = "guide-q";
          q.textContent = prompt.question;
          const btns = document.createElement("div");
          btns.className = "guide-btns";
          const yes = document.createElement("button");
          yes.type = "button";
          yes.textContent = "Yes";
          yes.className = prompt.good ? "on-good" : "";
          yes.addEventListener("click", () => teachSnippet(part, prompt.id, true));
          const no = document.createElement("button");
          no.type = "button";
          no.textContent = "No";
          no.className = prompt.good === false ? "on-bad" : "";
          no.addEventListener("click", () => teachSnippet(part, prompt.id, false));
          btns.append(yes, no);
          row.append(q, btns);
          guideBox.appendChild(row);
        });
        fig.append(guideBox);
      }
      els.slicesList.appendChild(fig);
    });
    show(els.slicesCard, slices.length > 0);
    showDownloadButtons(slices.length > 0 || !!lastTeach);
  }

  function showDownloadButtons(on) {
    if (els.btnDownloadCrops) show(els.btnDownloadCrops, on);
    if (els.btnAutoTeachLast) show(els.btnAutoTeachLast, !!lastFile);
  }

  function renderTeach(teach) {
    lastTeach = teach || null;
    if (!els.teachCard) return;
    if (!teach || !teach.crops || !teach.crops.length) {
      show(els.teachCard, false);
      return;
    }
    if (els.teachTitle) {
      els.teachTitle.textContent = `${teach.crop_count || teach.crops.length} parse crops`;
    }
    if (els.teachMeta) {
      const learned = teach.learned_fixes ? Object.keys(teach.learned_fixes).length : 0;
      els.teachMeta.textContent =
        (teach.message || `Parsed ${teach.crops.length} crops.`) +
        (learned ? ` Learned ${learned} letter map${learned === 1 ? "" : "s"}.` : "");
    }
    if (els.teachLog) {
      els.teachLog.innerHTML = "";
      (teach.log || []).forEach((row) => {
        const li = document.createElement("li");
        const focus = row.focus ? `${row.focus}: ` : "";
        const delta =
          typeof row.before === "number" && typeof row.after === "number"
            ? ` (${row.before}% → ${row.after}%)`
            : "";
        li.textContent = `${focus}${row.wrong || "weak read"} → ${row.action || "zoom"}${delta}`;
        els.teachLog.appendChild(li);
      });
      if (!(teach.log || []).length) {
        const li = document.createElement("li");
        li.textContent = "No weak category needed a second zoom. Crops are still saved for download.";
        els.teachLog.appendChild(li);
      }
    }
    if (els.teachGrid) {
      els.teachGrid.innerHTML = "";
      teach.crops.forEach((crop) => {
        const fig = document.createElement("figure");
        const pct = typeof crop.confidence === "number" ? crop.confidence : 0;
        fig.className = `teach-tile ${confidenceBand(pct)}`;
        const img = document.createElement("img");
        img.src = crop.preview || crop.image_jpeg || "";
        img.alt = crop.reason || "crop";
        const cap = document.createElement("figcaption");
        cap.textContent = `${String(crop.reason || "crop").replaceAll("_", " ")} · ${pct}%`;
        fig.append(img, cap);
        els.teachGrid.appendChild(fig);
      });
    }
    show(els.teachCard, true);
    showDownloadButtons(true);
  }

  function renderOcr(ocr, stitched, formatted) {
    if (!ocr && !stitched && !formatted) {
      show(els.ocrCard, false);
      hideOcrConfidence();
      return;
    }
    const status =
      (formatted && formatted.status) ||
      (stitched && stitched.status) ||
      (ocr && ocr.status) ||
      "unavailable";
    const text =
      (formatted && formatted.text) ||
      (stitched && stitched.text) ||
      (ocr && ocr.text) ||
      "";
    if ((status === "ok" || stitched || formatted) && text) {
      els.ocrTitle.textContent = "Readable text";
      els.ocrText.textContent = text;
      els.ocrMeta.textContent =
        (formatted && formatted.message) ||
        (stitched && stitched.message) ||
        (ocr && ocr.message) ||
        "";
      const nBlocks = formatted && (formatted.block_count || (formatted.blocks || []).length);
      els.ocrNote.textContent = nBlocks
        ? `Formatted into ${nBlocks} paragraph${nBlocks === 1 ? "" : "s"}. Line breaks from the page are kept.`
        : "Reading order, top to bottom. Overlapping slice lines and photo seams are kept once.";
      showOcrConfidence(combinedGuide(ocr, text));
      show(els.ocrCard, true);
      show(els.btnCopy, true);
      if (els.btnExportPacket) show(els.btnExportPacket, true);
      return;
    }
    els.ocrTitle.textContent = status === "empty" ? "No text found" : "Could not read text";
    els.ocrText.textContent = "";
    els.ocrMeta.textContent = (ocr && ocr.message) || "";
    els.ocrNote.textContent =
      status === "empty"
        ? "This photo passed the sharpness check, but OCR did not find words. Try a closer shot of the actual page."
        : "Quality check and slicing still ran. Text extract needs a working OCR engine on this device.";
      show(els.ocrCard, true);
      show(els.btnCopy, false);
      if (els.btnExportPacket) show(els.btnExportPacket, false);
      hideOcrConfidence();
  }

  async function copyOcrText() {
    const text = els.ocrText.textContent || "";
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      els.btnCopy.textContent = "Copied";
      setTimeout(() => {
        els.btnCopy.textContent = "Copy text";
      }, 1600);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(els.ocrText);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }
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
    lastQuality = body.quality || null;
    lastState = body.state || null;
    renderQuality(body.quality || {}, body.state);
    if (body.ok && body.slices && body.slices.length) {
      els.successText.textContent =
        `${body.slices.length} slice${body.slices.length === 1 ? "" : "s"} from a ${body.quality.width}×${body.quality.height} image.`;
      show(els.successCard, true);
      renderOcr(body.ocr, body.stitched, body.formatted);
      const ocrSlices = (body.ocr && body.ocr.slices) || [];
      if (body.teach) {
        renderTeach(body.teach);
        const zoomed = (body.slices || []).filter((sl) => /zoom|retry/.test(String(sl.cut_reason || "")));
        const shown = zoomed.length ? zoomed.slice(0, 8) : (body.slices || []).slice(0, 6);
        const idxs = new Set(shown.map((s) => s.index));
        renderSlices(shown, ocrSlices.filter((p) => idxs.has(p.slice_index)));
      } else {
        renderSlices(body.slices, ocrSlices);
      }
      notifyResult(body.ocr, body.stitched, body.formatted);
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
    const merge = body.merge || {};
    (merge.warnings || []).forEach((w) => {
      const li = document.createElement("li");
      li.textContent = w;
      els.batchWarnings.appendChild(li);
    });
    show(els.batchCard, true);
    if (merge.text || (body.formatted && body.formatted.text)) {
      lastState = lastState || "OK";
      renderOcr(
        {
          status: merge.status || "ok",
          text: merge.text || "",
          message: merge.message || "",
          guide: merge.guide || null,
          confidence: merge.guide && typeof merge.guide.confidence === "number" ? merge.guide.confidence : null,
          slices: [],
        },
        merge,
        body.formatted || null
      );
      notifyResult(
        {
          status: merge.status || "ok",
          text: merge.text || "",
        },
        merge,
        body.formatted || null
      );
    }
  }

  async function postAutoTeach(file) {
    clearError();
    resetResults();
    show(els.captureHome, false);
    show(els.livePanel, false);
    previewFile(file);
    show(els.btnReset, true);
    setBusy(true, "Auto-teach: planning 30–50 crops…");
    if (ENGINE === "browser" && window.ToastAutoTeach && window.ToastAutoTeach.autoTeach) {
      try {
        const body = await window.ToastAutoTeach.autoTeach(file, {
          onProgress: (p) => setBusy(true, p.message || `Auto-teach ${p.index}/${p.total}`),
        });
        setBusy(false);
        applyPrepareResult(body);
        if (body.teach) renderTeach(body.teach);
      } catch (err) {
        setBusy(false);
        showError(err && err.message ? err.message : "Auto-teach failed.");
        show(els.captureHome, true);
      }
      return;
    }
    const fd = new FormData();
    fd.append("file", file, file.name || "capture.jpg");
    let res;
    try {
      res = await fetch(api("/api/auto-teach"), { method: "POST", body: fd });
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
    if (body.teach) renderTeach(body.teach);
  }

  function startAutoTeach() {
    if (lastFile) {
      postAutoTeach(lastFile);
      return;
    }
    teachPending = true;
    captureInput.click();
  }

  function downloadParsedImages() {
    if (lastTeach && window.ToastAutoTeach && window.ToastAutoTeach.downloadCropsZip) {
      window.ToastAutoTeach.downloadCropsZip(lastTeach);
      return;
    }
    if (window.ToastAutoTeach && window.ToastAutoTeach.downloadSliceZip) {
      window.ToastAutoTeach.downloadSliceZip(lastSlicePack.slices, lastSlicePack.ocrSlices);
      return;
    }
    if (lastFile && ENGINE !== "browser") {
      const fd = new FormData();
      fd.append("file", lastFile, lastFile.name || "capture.jpg");
      fetch(api("/api/auto-teach/zip"), { method: "POST", body: fd })
        .then((res) => res.blob())
        .then((blob) => {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "toast-ocr-parsed-crops.zip";
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 800);
        })
        .catch((err) => showError(networkFailMessage(err)));
    }
  }

  async function postPrepare(file) {
    clearError();
    resetResults();
    show(els.captureHome, false);
    show(els.livePanel, false);
    previewFile(file);
    show(els.btnReset, true);
    setBusy(true, "Checking readability and reading text…");
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
    setBusy(true, "Reading and merging overlapping shots…");
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
  $("btnCopy").addEventListener("click", () => copyOcrText());
  if ($("btnExportPacket")) {
    $("btnExportPacket").addEventListener("click", () => {
      if (window.ToastGuide && typeof window.ToastGuide.exportPacket === "function") {
        window.ToastGuide.exportPacket();
        return;
      }
      window.location.href = api("/api/guide/export");
    });
  }
  if ($("btnAutoTeach")) $("btnAutoTeach").addEventListener("click", () => startAutoTeach());
  if ($("btnAutoTeachLast")) $("btnAutoTeachLast").addEventListener("click", () => startAutoTeach());
  if ($("btnDownloadCrops")) $("btnDownloadCrops").addEventListener("click", () => downloadParsedImages());
  $("errorDismiss").addEventListener("click", () => clearError());
  $("btnLive").addEventListener("click", () => startLive());
  $("btnLiveClose").addEventListener("click", () => {
    stopLive();
    show(els.captureHome, true);
  });
  $("btnShutter").addEventListener("click", () => captureLiveFrame());

  function onCaptureFile(file) {
    if (teachPending) {
      teachPending = false;
      postAutoTeach(file);
      return;
    }
    postPrepare(file);
  }

  onFileInput(captureInput, onCaptureFile);
  onFileInput(libraryInput, onCaptureFile);
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
      foot.textContent = EMBED
        ? "Photos stay on this device. Extracted text is sent to the page that embedded this scanner."
        : "Photos stay on this phone. Quality check and slicing run here — no laptop required. Add to Home Screen from the share menu.";
    }
  }

  if (EMBED) {
    document.documentElement.classList.add("embed");
    const appRoot = document.querySelector(".app");
    const sendResize = () => {
      const height = Math.ceil(
        (appRoot && appRoot.getBoundingClientRect().height) ||
          document.documentElement.scrollHeight ||
          420
      );
      postToParent("toast-ocr:resize", { height });
    };
    if (typeof ResizeObserver !== "undefined" && appRoot) {
      new ResizeObserver(() => sendResize()).observe(appRoot);
    }
    window.addEventListener("load", sendResize);
    sendResize();
    postToParent("toast-ocr:ready");
    window.addEventListener("message", (event) => {
      if (event.source !== window.parent) return;
      const allowed = parentOrigin();
      if (allowed !== "*" && event.origin !== allowed) return;
      const data = event.data;
      if (!data || data.type !== "toast-ocr:reset") return;
      resettingFromParent = true;
      try {
        startOver();
      } finally {
        resettingFromParent = false;
      }
    });
  } else if ("serviceWorker" in navigator) {
    const swUrl = BASE ? `${BASE}/sw.js` : "/sw.js";
    const scope = BASE ? `${BASE}/` : "/";
    navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
      /* non-fatal: PWA install still works without a worker on some browsers */
    });
  }
})();
