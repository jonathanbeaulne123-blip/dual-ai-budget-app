/* Auto-teach: 30–50 focused crops, score, zoom the weak spots, download ZIP. */
(() => {
  const MIN = 30;
  const MAX = 50;
  const WORD_CONF_LOW = 62;
  const MONEY_RE = /\$\s*-?\d{1,6}[.,]\d{2}|-?\d{1,6}[.,]\d{2}/;

  function clampRect(x, y, w, h, fw, fh) {
    x = Math.max(0, x | 0);
    y = Math.max(0, y | 0);
    w = Math.max(1, w | 0);
    h = Math.max(1, h | 0);
    if (x >= fw) x = Math.max(0, fw - 1);
    if (y >= fh) y = Math.max(0, fh - 1);
    w = Math.min(w, fw - x);
    h = Math.min(h, fh - y);
    return { x, y, w: Math.max(1, w), h: Math.max(1, h) };
  }

  function iou(a, b) {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.w, b.x + b.w);
    const y1 = Math.min(a.y + a.h, b.y + b.h);
    if (x1 <= x0 || y1 <= y0) return 0;
    const inter = (x1 - x0) * (y1 - y0);
    return inter / Math.max(1, a.w * a.h + b.w * b.h - inter);
  }

  function dedupe(rects, limit) {
    const keep = [];
    rects.forEach((r) => {
      if (keep.some((p) => iou(r, p) >= 0.88 && Math.abs((r.scale || 1) - (p.scale || 1)) < 0.12)) return;
      keep.push(r);
    });
    return keep.slice(0, limit || MAX);
  }

  function add(rects, fw, fh, x, y, w, h, reason, focus, scale, parent) {
    const box = clampRect(x, y, w, h, fw, fh);
    if (box.w < 24 || box.h < 14) return;
    box.reason = reason;
    box.focus = focus;
    box.scale = scale || 1;
    box.parent = parent == null ? null : parent;
    rects.push(box);
  }

  function inkBands(dens, maxBands) {
    if (!dens || !dens.length) return [];
    const copy = Array.from(dens);
    copy.sort((a, b) => a - b);
    const thr = Math.max(0.035, copy[Math.floor(copy.length * 0.52)] || 0);
    const bands = [];
    let start = -1;
    for (let y = 0; y < dens.length; y += 1) {
      if (dens[y] >= thr) {
        if (start < 0) start = y;
      } else if (start >= 0) {
        if (y - start >= 10) bands.push([start, y]);
        start = -1;
      }
    }
    if (start >= 0 && dens.length - start >= 10) bands.push([start, dens.length]);
    const merged = [];
    bands.forEach(([y0, y1]) => {
      if (merged.length && y0 - merged[merged.length - 1][1] <= 6) {
        merged[merged.length - 1][1] = y1;
      } else merged.push([y0, y1]);
    });
    return merged.slice(0, maxBands || 14);
  }

  function sliding(fw, fh, need) {
    const extra = [];
    const step = Math.max(32, (fh / Math.max(8, need + 2)) | 0);
    const win = Math.min(fh, (step * 1.4) | 0);
    let y = 0;
    let i = 0;
    while (extra.length < need && y < fh) {
      add(extra, fw, fh, 0, y, fw, win, `scan_window_${i}`, "completeness", 1.15, null);
      y += step;
      i += 1;
      if (i > 80) break;
    }
    return extra;
  }

  function planRects(fw, fh, documents, dens) {
    const docs = documents && documents.length ? documents : [{ x: 0, y: 0, width: fw, height: fh, w: fw, h: fh }];
    const rects = [];
    docs.forEach((d, di) => {
      const tag = docs.length > 1 ? `d${di}_` : "";
      const x = d.x | 0;
      const y = d.y | 0;
      const w = (d.w || d.width) | 0;
      const h = (d.h || d.height) | 0;
      add(rects, fw, fh, x, y, w, h, `${tag}document`, "format", 1, null);
      add(rects, fw, fh, x, y, w, Math.max(24, (h * 0.18) | 0), `${tag}header_band`, "headers", 1.5, null);
      add(rects, fw, fh, x, y + ((h * 0.76) | 0), w, Math.max(24, (h * 0.24) | 0), `${tag}totals_band`, "money", 1.5, null);
      add(rects, fw, fh, x, y, Math.max(32, (w * 0.62) | 0), h, `${tag}label_column`, "letters", 1.25, null);
      add(rects, fw, fh, x + ((w * 0.54) | 0), y, Math.max(32, (w * 0.46) | 0), h, `${tag}money_column`, "money", 1.7, null);
      add(rects, fw, fh, x + ((w / 5) | 0), y + ((h / 5) | 0), Math.max(40, ((w * 3) / 5) | 0), Math.max(40, ((h * 3) / 5) | 0), `${tag}center_zoom`, "letters", 2.2, null);
    });
    let bands = inkBands(dens, 14);
    if (!bands.length) {
      const n = 12;
      const bh = Math.max(28, (fh / n) | 0);
      for (let i = 0; i < n; i += 1) {
        const y0 = n === 1 ? 0 : ((i * (fh - bh)) / Math.max(1, n - 1)) | 0;
        bands.push([y0, Math.min(fh, y0 + bh)]);
      }
    }
    bands.slice(0, 16).forEach(([y0, y1], i) => {
      add(rects, fw, fh, 0, y0 - 8, fw, y1 - y0 + 16, `ink_band_${i}`, "format", 1.35, null);
    });
    const planned = dedupe(rects, MAX);
    const fillNeed = Math.max(0, Math.min(MAX - 14, MIN - 12) - planned.length);
    if (fillNeed > 0) planned.push.apply(planned, sliding(fw, fh, fillNeed));
    return dedupe(planned, MAX);
  }

  function boxToFrame(bbox, parent, upW, upH) {
    const sx = parent.w / Math.max(1, upW);
    const sy = parent.h / Math.max(1, upH);
    const x0 = parent.x + bbox.x0 * sx;
    const y0 = parent.y + bbox.y0 * sy;
    const x1 = parent.x + bbox.x1 * sx;
    const y1 = parent.y + bbox.y1 * sy;
    const bw = Math.max(8, x1 - x0);
    const bh = Math.max(8, y1 - y0);
    const padX = Math.max(8, bw * 0.4);
    const padY = Math.max(6, bh * 0.4);
    return { x: (x0 - padX) | 0, y: (y0 - padY) | 0, w: (bw + 2 * padX) | 0, h: (bh + 2 * padY) | 0 };
  }

  function followups(parent, words, guide, upW, upH, fw, fh, maxNew) {
    const cats = (guide && guide.categories) || [];
    const weak = new Set(cats.filter((c) => c && c.applicable !== false && !c.good).map((c) => c.id));
    const out = [];
    const low = (words || [])
      .filter((w) => typeof w.confidence === "number" && w.confidence < WORD_CONF_LOW)
      .sort((a, b) => a.confidence - b.confidence)
      .slice(0, 6);
    low.forEach((word) => {
      const local = boxToFrame(word.bbox, parent, upW, upH);
      const focus = MONEY_RE.test(word.text || "") ? "money" : "letters";
      add(out, fw, fh, local.x, local.y, local.w, local.h, "word_zoom", focus, 2.4, parent.index);
      add(out, fw, fh, local.x - 12, local.y - 8, local.w + 24, local.h + 16, "line_zoom", focus, 1.9, parent.index);
    });
    if (weak.has("money")) add(out, fw, fh, parent.x + ((parent.w * 0.52) | 0), parent.y, (parent.w * 0.48) | 0, parent.h, "money_retry", "money", 2.1, parent.index);
    if (weak.has("headers") || weak.has("letters")) add(out, fw, fh, parent.x, parent.y, parent.w, Math.max(24, (parent.h * 0.22) | 0), "header_retry", "headers", 2.0, parent.index);
    if (weak.has("dates") || weak.has("times") || weak.has("hours")) add(out, fw, fh, parent.x, parent.y, parent.w, parent.h, "time_retry", "times", 1.8, parent.index);
    if (weak.has("columns")) add(out, fw, fh, parent.x, parent.y, parent.w, parent.h, "columns_retry", "columns", 1.6, parent.index);
    return dedupe(out, maxNew || 8);
  }

  function cropRect(src, rect) {
    const pad = 2;
    const x0 = Math.max(0, rect.x - pad);
    const y0 = Math.max(0, rect.y - pad);
    const x1 = Math.min(src.width, rect.x + rect.w + pad);
    const y1 = Math.min(src.height, rect.y + rect.h + pad);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, x1 - x0);
    canvas.height = Math.max(1, y1 - y0);
    canvas.getContext("2d").drawImage(src, x0, y0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    return canvas;
  }

  function materialize(src, rect, P) {
    const raw = cropRect(src, rect);
    let out = P.contrastGrayCanvas ? P.contrastGrayCanvas(raw) : raw;
    const scale = rect.scale || 1;
    const target = Math.min(1800, Math.max(720, Math.round(Math.max(out.width, 1) * Math.max(1, scale))));
    if (out.width < target) {
      const s = Math.min(4.5, target / out.width);
      const zoomed = document.createElement("canvas");
      zoomed.width = Math.max(1, Math.round(out.width * s));
      zoomed.height = Math.max(1, Math.round(out.height * s));
      const ctx = zoomed.getContext("2d");
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(out, 0, 0, zoomed.width, zoomed.height);
      out = zoomed;
    }
    return { raw, ocr: out };
  }

  function psmFor(reason) {
    const PSM = (typeof Tesseract !== "undefined" && Tesseract.PSM) || {};
    if (reason === "word_zoom") return PSM.SINGLE_WORD || "8";
    if (reason === "line_zoom" || String(reason).indexOf("ink_band") === 0) return PSM.SINGLE_LINE || "7";
    return PSM.SINGLE_COLUMN || "4";
  }

  function weakIds(guide) {
    return ((guide && guide.categories) || [])
      .filter((c) => c && c.applicable !== false && !c.good)
      .map((c) => c.id);
  }

  function notesOf(guide) {
    const out = [];
    ((guide && guide.categories) || []).forEach((c) => {
      (c.reasons || []).forEach((r) => out.push(r));
    });
    return out;
  }

  function mergePasses(passes) {
    const ranked = [];
    passes.forEach((row) => {
      const text = String(row.text || "").trim();
      if (!text) return;
      const lines = text.split(/\n/).map((ln) => ln.trim()).filter(Boolean);
      const n = Math.max(1, lines.length);
      const h = Math.max(1, row.h || 1);
      lines.forEach((line, i) => {
        ranked.push({
          y: (row.y || 0) + Math.round((i * h) / n),
          conf: (row.confidence || 0) / 100,
          reason: row.reason || "",
          line,
        });
      });
    });
    ranked.sort((a, b) => a.y - b.y || b.conf - a.conf);
    const kept = [];
    ranked.forEach((row) => {
      if (String(row.reason).indexOf("word_zoom") === 0 && row.conf < 0.45) return;
      if (kept.length && Math.abs(row.y - kept[kept.length - 1].y) <= 14) {
        const prev = kept[kept.length - 1];
        if (MONEY_RE.test(prev.line) && !MONEY_RE.test(row.line)) return;
        if (row.conf >= prev.conf - 0.02 && (row.line.length >= prev.line.length || row.conf > prev.conf)) {
          if (MONEY_RE.test(row.line) || !MONEY_RE.test(prev.line)) kept[kept.length - 1] = row;
        }
        return;
      }
      kept.push(row);
    });
    const lines = [];
    kept.forEach((row) => {
      if (lines.length && lines[lines.length - 1].toUpperCase() === row.line.toUpperCase() && row.line.length > 8) return;
      lines.push(row.line);
    });
    return lines.join("\n").trim();
  }

  function crcTable() {
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
    return table;
  }

  const CRC = crcTable();

  function crc32(bytes) {
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  function u16(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255]);
  }

  function u32(n) {
    return new Uint8Array([n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]);
  }

  function concat(parts) {
    const len = parts.reduce((s, p) => s + p.length, 0);
    const out = new Uint8Array(len);
    let o = 0;
    parts.forEach((p) => {
      out.set(p, o);
      o += p.length;
    });
    return out;
  }

  function encodeUtf8(text) {
    return new TextEncoder().encode(String(text || ""));
  }

  function jpegFromDataUrl(url) {
    if (!url) return new Uint8Array(0);
    const comma = url.indexOf(",");
    const b64 = comma >= 0 ? url.slice(comma + 1) : url;
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }

  function zipStore(files) {
    const locals = [];
    const centrals = [];
    let offset = 0;
    files.forEach((file) => {
      const name = encodeUtf8(file.name);
      const data = file.data instanceof Uint8Array ? file.data : encodeUtf8(file.data);
      const crc = crc32(data);
      const local = concat([
        u32(0x04034b50),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        name,
        data,
      ]);
      const central = concat([
        u32(0x02014b50),
        u16(20),
        u16(20),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(crc),
        u32(data.length),
        u32(data.length),
        u16(name.length),
        u16(0),
        u16(0),
        u16(0),
        u16(0),
        u32(0),
        u32(offset),
        name,
      ]);
      locals.push(local);
      centrals.push(central);
      offset += local.length;
    });
    const center = concat(centrals);
    const eocd = concat([
      u32(0x06054b50),
      u16(0),
      u16(0),
      u16(files.length),
      u16(files.length),
      u32(center.length),
      u32(offset),
      u16(0),
    ]);
    return concat(locals.concat([center, eocd]));
  }

  function triggerDownload(filename, bytes, mime) {
    const blob = new Blob([bytes], { type: mime || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 800);
  }

  function downloadCropsZip(result) {
    const crops = (result && result.crops) || [];
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const files = [
      {
        name: "manifest.json",
        data: encodeUtf8(
          JSON.stringify(
            {
              schema: "toast-ocr-autoteach-crops.v1",
              crop_count: crops.length,
              confidence: result && result.confidence,
              text: (result && result.text) || "",
              log: (result && result.log) || [],
              learned_fixes: (result && result.learned_fixes) || {},
              crops: crops.map((c) => ({
                index: c.index,
                reason: c.reason,
                focus: c.focus,
                scale: c.scale,
                confidence: c.confidence,
                weak: c.weak,
                notes: c.notes,
                text: c.text,
              })),
            },
            null,
            2
          )
        ),
      },
      { name: "merged.txt", data: encodeUtf8((result && result.text) || "") },
      { name: "log.json", data: encodeUtf8(JSON.stringify((result && result.log) || [], null, 2)) },
    ];
    crops.forEach((c) => {
      const safe = String(c.reason || "crop").replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
      const base = `${String(c.index).padStart(2, "0")}-${safe}`;
      const jpeg = jpegFromDataUrl(c.image_jpeg || c.preview || "");
      if (jpeg.length) files.push({ name: `crops/${base}.jpg`, data: jpeg });
      files.push({ name: `crops/${base}.txt`, data: encodeUtf8(c.text || c.raw_text || "") });
    });
    triggerDownload(`toast-ocr-parsed-crops-${stamp}.zip`, zipStore(files), "application/zip");
  }

  function downloadSliceZip(slices, ocrSlices) {
    const byIndex = new Map();
    (ocrSlices || []).forEach((p) => byIndex.set(p.slice_index, p));
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const files = [{ name: "manifest.json", data: encodeUtf8(JSON.stringify({ schema: "toast-ocr-slices.v1", count: (slices || []).length }, null, 2)) }];
    (slices || []).forEach((sl, i) => {
      const part = byIndex.get(sl.index) || {};
      const jpeg = jpegFromDataUrl(sl.ocr_image || sl.processed_preview || sl.preview || "");
      const base = `${String(i).padStart(2, "0")}-${String(sl.cut_reason || "slice").replace(/[^a-zA-Z0-9_-]+/g, "_")}`;
      if (jpeg.length) files.push({ name: `crops/${base}.jpg`, data: jpeg });
      files.push({ name: `crops/${base}.txt`, data: encodeUtf8(part.text || "") });
    });
    triggerDownload(`toast-ocr-parsed-crops-${stamp}.zip`, zipStore(files), "application/zip");
  }

  async function autoTeach(file, opts) {
    const onProgress = (opts && opts.onProgress) || (() => undefined);
    const P = window.ToastPipeline || {};
    if (!P.fileToCanvas) throw new Error("Parser is not loaded.");
    const canvas = await P.fileToCanvas(file, 2000);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quality = P.assess ? P.assess(imageData) : { state: "OK", width: canvas.width, height: canvas.height };
    const regions = P.detectDocuments ? P.detectDocuments(imageData) : [];
    const grayPack = P.toGray ? P.toGray(imageData) : null;
    const dens = grayPack && P.inkProjection ? P.inkProjection(grayPack.gray, grayPack.w, grayPack.h) : null;
    let queue = planRects(canvas.width, canvas.height, regions, dens);
    const passes = [];
    const log = [];
    const seen = [];
    let worker = null;

    if (typeof Tesseract !== "undefined") {
      worker = await Tesseract.createWorker("eng");
      await worker.setParameters({
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
    }

    async function readCrop(rect) {
      const { raw, ocr } = materialize(canvas, rect, P);
      const reason = rect.reason || "crop";
      if (worker) {
        await worker.setParameters({ tessedit_pageseg_mode: psmFor(reason) });
      }
      let rawText = "";
      let mean = 0;
      let words = [];
      if (worker) {
        const png = P.pngFromCanvas ? P.pngFromCanvas(ocr) : ocr.toDataURL("image/png");
        const { data } = await worker.recognize(png);
        rawText = String(data.text || "").replace(/[ \t]+\n/g, "\n").trim();
        mean = typeof data.confidence === "number" ? data.confidence / 100 : 0;
        words = (data.words || []).map((w) => ({
          text: w.text || "",
          confidence: typeof w.confidence === "number" ? w.confidence : 100,
          bbox: w.bbox || { x0: 0, y0: 0, x1: ocr.width, y1: ocr.height },
        }));
      }
      const lexed =
        window.ToastLexicon && window.ToastLexicon.correctText ? window.ToastLexicon.correctText(rawText) : rawText;
      const guided =
        window.ToastGuide && window.ToastGuide.improve
          ? window.ToastGuide.improve(lexed, {
              slice_index: rect.index,
              cut_reason: reason,
              engine_confidence: mean,
            })
          : { text: lexed, guide: null };
      const preview = P.jpegFromCanvas ? P.jpegFromCanvas(raw, 280, 0.62) : raw.toDataURL("image/jpeg", 0.62);
      const imageJpeg = P.jpegFromCanvas ? P.jpegFromCanvas(ocr, 1400, 0.78) : ocr.toDataURL("image/jpeg", 0.78);
      const guide = guided.guide || null;
      return {
        index: rect.index,
        x: rect.x,
        y: rect.y,
        w: rect.w,
        h: rect.h,
        reason,
        focus: rect.focus,
        scale: rect.scale,
        parent: rect.parent,
        text: guided.text || lexed,
        raw_text: rawText,
        confidence: guide && typeof guide.confidence === "number" ? guide.confidence : Math.round(mean * 100),
        engine_confidence: Math.round(mean * 100),
        weak: weakIds(guide),
        notes: notesOf(guide),
        guide,
        preview,
        image_jpeg: imageJpeg,
        words,
        ocrWidth: ocr.width,
        ocrHeight: ocr.height,
      };
    }

    try {
      while (queue.length && passes.length < MAX) {
        const rect = Object.assign({}, queue.shift());
        if (seen.some((p) => iou(rect, p) >= 0.9 && Math.abs((rect.scale || 1) - (p.scale || 1)) < 0.15)) continue;
        seen.push(rect);
        rect.index = passes.length;
        onProgress({
          index: rect.index + 1,
          total: MAX,
          reason: rect.reason,
          focus: rect.focus,
          message: `Auto-teach ${rect.index + 1}/${MAX} — ${String(rect.reason || "crop").replace(/_/g, " ")}`,
        });
        const row = await readCrop(rect);
        if (typeof row.parent === "number" && passes[row.parent]) {
          const parent = passes[row.parent];
          if (row.confidence > (parent.confidence || 0) + 3 && row.text && row.text !== parent.text) {
            log.push({
              crop: row.index,
              parent: row.parent,
              focus: row.focus,
              wrong: (parent.notes || row.notes || []).join("; ") || "Low confidence on parent crop",
              action: `zoom ${row.scale}× ${row.reason}`,
              before: parent.confidence,
              after: row.confidence,
            });
            if (window.ToastGuide && window.ToastGuide.record) {
              window.ToastGuide.record({
                letters_good: true,
                before: parent.raw_text || parent.text,
                after: row.text,
                scores: row.guide,
                votes: Object.fromEntries((parent.weak || []).map((id) => [id, false])),
              });
            }
          }
        }
        passes.push(row);
        if (row.weak && row.weak.length && passes.length + queue.length < MAX) {
          const more = followups(
            row,
            row.words,
            row.guide,
            row.ocrWidth,
            row.ocrHeight,
            canvas.width,
            canvas.height,
            Math.min(6, MAX - passes.length - queue.length)
          );
          queue.push.apply(queue, more);
        }
      }
      if (passes.length < MIN) {
        queue = sliding(canvas.width, canvas.height, MIN - passes.length);
        while (queue.length && passes.length < MIN) {
          const rect = Object.assign({}, queue.shift());
          rect.index = passes.length;
          onProgress({
            index: rect.index + 1,
            total: MAX,
            reason: rect.reason,
            message: `Auto-teach ${rect.index + 1}/${MAX} — filling parse set`,
          });
          passes.push(await readCrop(rect));
        }
      }
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
    }

    const joined = mergePasses(passes);
    const guidedJoined =
      window.ToastGuide && window.ToastGuide.improve
        ? window.ToastGuide.improve(joined, { cut_reason: "auto_teach" })
        : { text: joined, guide: null };
    const text = guidedJoined.text || joined;
    const guide = guidedJoined.guide || null;
    const docConf = guide && typeof guide.confidence === "number" ? guide.confidence : null;
    const slices = passes.map((p) => ({
      index: p.index,
      y_start: p.y,
      y_end: p.y + p.h,
      content_y_start: p.y,
      content_y_end: p.y + p.h,
      overlap_top: 0,
      overlap_bottom: 0,
      cut_reason: p.reason,
      width: p.w,
      height: p.h,
      preview: p.preview,
      processed_preview: p.preview,
      ocr_image: p.image_jpeg,
    }));
    const ocrSlices = passes.map((p) => ({
      slice_index: p.index,
      text: p.text,
      raw_text: p.raw_text,
      guide: p.guide,
      mean_confidence: (p.engine_confidence || 0) / 100,
      box_count: (p.words || []).length,
    }));
    if (!log.length) {
      const weak = weakIds(guide);
      if (weak.length) {
        log.push({
          crop: null,
          focus: weak[0],
          wrong: notesOf(guide).join("; ") || "Weak categories after merge",
          action: `parsed ${passes.length} crops`,
          before: null,
          after: docConf,
        });
      }
    }
    const message = text
      ? `Auto-teach parsed ${passes.length} crops. System confidence ${docConf}%.`
      : `Parsed ${passes.length} crops. No text found.`;
    return {
      state: quality.state || "OK",
      ok: true,
      quality,
      deskew_angle_deg: 0,
      source_shape: [canvas.height, canvas.width, 3],
      guidance: null,
      slices,
      document_count: Math.max(1, regions.length),
      documents: regions,
      ocr: {
        status: text ? "ok" : "empty",
        phase: 3,
        engine: "tesseract",
        text,
        box_count: ocrSlices.filter((s) => s.text).length,
        slices: ocrSlices,
        confidence: docConf,
        guide,
        message,
      },
      stitched: { status: text ? "ok" : "empty", text, message },
      formatted:
        window.ToastFormat && window.ToastFormat.formatPlaintext
          ? window.ToastFormat.formatPlaintext(text, "tesseract")
          : null,
      teach: {
        crop_count: passes.length,
        crops: passes,
        log,
        learned_fixes: (window.ToastGuide && window.ToastGuide.loadMemory ? window.ToastGuide.loadMemory().letter_fixes : {}) || {},
        confidence: docConf,
        text,
        message,
      },
    };
  }

  window.ToastAutoTeach = {
    MIN,
    MAX,
    planRects,
    autoTeach,
    downloadCropsZip,
    downloadSliceZip,
  };
})();
