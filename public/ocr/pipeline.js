/* Phase 1–2 on the phone: Laplacian quality + whitespace slicing.
 * Mirrors toast_ocr.quality / preprocess.slicer so the PWA works on HTTPS
 * without a Python host. Does not invent OCR text. */

(() => {
  const Q = {
    laplacianBlur: 100,
    laplacianGood: 280,
    contrastPoor: 12,
    contrastGood: 48,
    minDim: 96,
    minDimGood: 720,
    okScore: 0.45,
    unreadable: 0.12,
    wSharp: 0.5,
    wContrast: 0.3,
    wSize: 0.2,
    extremeAspect: 4,
  };

  const S = {
    targetH: 1000,
    search: 90,
    safetyOv: 24,
    fallbackOv: 100,
    inkGap: 0.02,
    inkRelaxed: 0.06,
    smooth: 5,
    minGapRun: 3,
    minSlice: 80,
    minTail: 120,
    projW: 480,
    maxWidth: 2000,
  };

  const STEPS = [
    "Take several closer shots, starting at the top of the page and working down.",
    "Overlap each new shot with the previous one by about 20% — a few of the last lines should show up again.",
    "Keep lighting, zoom, and distance the same.",
    "Shoot in order. Don't skip a band of the page.",
    "Hold still so the photo isn't blurry.",
    "Tap I'm done when you have the whole document.",
  ];

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function ramp(value, low, high) {
    if (high <= low) return value >= high ? 1 : 0;
    return clamp01((value - low) / (high - low));
  }

  function guidance(state) {
    if (state === "TOO_SMALL") {
      return {
        state,
        title: "Image is too small to read",
        message: "Move closer, or recapture a long page as overlapping closer shots instead of one tiny full-page photo.",
        steps: STEPS,
        overlap_hint: 0.2,
      };
    }
    if (state === "UNREADABLE") {
      return {
        state,
        title: "Image is unreadable",
        message: "Focus, contrast, or resolution is too low. Recapture sharper, or take several overlapping closer shots.",
        steps: STEPS,
        overlap_hint: 0.2,
      };
    }
    return {
      state: "NEEDS_MULTI_IMAGE",
      title: "Need overlapping closer shots",
      message: "This single photo isn't readable enough (blur, compression, or the page is too long and dense). Take closer pictures from top to bottom with about 20% overlap, in order.",
      steps: STEPS,
      overlap_hint: 0.2,
    };
  }

  async function fileToCanvas(file, maxWidth) {
    const bmp = await createImageBitmap(file);
    const scale = bmp.width > maxWidth ? maxWidth / bmp.width : 1;
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(bmp, 0, 0, w, h);
    if (bmp.close) bmp.close();
    return canvas;
  }

  function toGray(imageData) {
    const { width: w, height: h, data } = imageData;
    const gray = new Float64Array(w * h);
    for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
      gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    }
    return { gray, w, h };
  }

  function meanStd(gray) {
    let sum = 0;
    for (let i = 0; i < gray.length; i += 1) sum += gray[i];
    const mean = sum / gray.length;
    let v = 0;
    for (let i = 0; i < gray.length; i += 1) {
      const d = gray[i] - mean;
      v += d * d;
    }
    return { mean, std: Math.sqrt(v / gray.length) };
  }

  function laplacianVariance(gray, w, h) {
    let n = 0;
    let sum = 0;
    let sum2 = 0;
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const i = y * w + x;
        const lap = gray[i - w] + gray[i - 1] + gray[i + 1] + gray[i + w] - 4 * gray[i];
        sum += lap;
        sum2 += lap * lap;
        n += 1;
      }
    }
    if (!n) return 0;
    const mean = sum / n;
    return sum2 / n - mean * mean;
  }

  function assess(imageData) {
    const { gray, w, h } = toGray(imageData);
    const minDim = Math.min(w, h);
    const aspect = w ? h / w : Infinity;
    const lap = laplacianVariance(gray, w, h);
    const { std: contrast } = meanStd(gray);
    const sharpS = ramp(lap, 0, Q.laplacianGood);
    const contrastS = ramp(contrast, Q.contrastPoor * 0.4, Q.contrastGood);
    const sizeS = ramp(minDim, Q.minDim, Q.minDimGood);
    const score = clamp01(
      (Q.wSharp * sharpS + Q.wContrast * contrastS + Q.wSize * sizeS) /
        (Q.wSharp + Q.wContrast + Q.wSize)
    );
    const reasons = [];
    if (contrast < Q.contrastPoor) reasons.push(`low contrast (std=${contrast.toFixed(1)})`);
    if (aspect >= Q.extremeAspect) {
      reasons.push(`extreme aspect ratio ${aspect.toFixed(1)}:1 (will smart-slice if quality passes)`);
    }
    let state = "OK";
    if (minDim < Q.minDim) {
      reasons.push(`min dimension ${minDim}px < ${Q.minDim}px (too small for reliable OCR)`);
      state = "TOO_SMALL";
    } else if (
      score < Q.unreadable ||
      (lap < Q.laplacianBlur * 0.25 && contrast < Q.contrastPoor)
    ) {
      reasons.push("composite score and/or sharpness+contrast are below a usable floor");
      state = "UNREADABLE";
    } else {
      const blurry = lap < Q.laplacianBlur;
      if (blurry) {
        reasons.push(
          `Laplacian variance ${lap.toFixed(1)} < ${Q.laplacianBlur} (likely blur, heavy compression, or downscale)`
        );
      }
      if (score < Q.okScore) reasons.push(`composite readability ${score.toFixed(3)} < ${Q.okScore}`);
      if (blurry || score < Q.okScore) state = "NEEDS_MULTI_IMAGE";
    }
    if (state === "OK" && !reasons.length) {
      reasons.push("sharpness, contrast, and size are within configured gates");
    }
    const recommended =
      state === "OK"
        ? "Proceed with single-image preprocess and smart slicing."
        : "Halt the single-image path. Take overlapping closer shots top-to-bottom (15–25% overlap).";
    return {
      score: +score.toFixed(4),
      laplacian_variance: +lap.toFixed(3),
      contrast: +contrast.toFixed(3),
      min_dimension: minDim,
      width: w,
      height: h,
      aspect_ratio: +aspect.toFixed(4),
      reasons,
      state,
      recommended_action: recommended,
      ocr_probe_used: false,
      ocr_probe_skipped_reason: "On-device Laplacian path (PaddleOCR probe not used in the phone PWA)",
      ocr_probe_confidence: null,
    };
  }

  function inkProjection(gray, w, h) {
    const pw = Math.min(w, S.projW);
    const dens = new Float64Array(h);
    const xStep = w / pw;
    for (let y = 0; y < h; y += 1) {
      let ink = 0;
      for (let xi = 0; xi < pw; xi += 1) {
        const x = Math.min(w - 1, Math.floor(xi * xStep));
        if (gray[y * w + x] < 140) ink += 1;
      }
      dens[y] = ink / pw;
    }
    const k = S.smooth;
    if (k >= 3 && h >= k) {
      const out = new Float64Array(h);
      const half = Math.floor(k / 2);
      for (let y = 0; y < h; y += 1) {
        let s = 0;
        let n = 0;
        for (let d = -half; d <= half; d += 1) {
          const yy = y + d;
          if (yy < 0 || yy >= h) continue;
          s += dens[yy];
          n += 1;
        }
        out[y] = n ? s / n : dens[y];
      }
      return out;
    }
    return dens;
  }

  function gapHits(dens, lo, hi, maxD, minRun) {
    const hits = [];
    let run = -1;
    for (let y = lo; y <= hi; y += 1) {
      if (dens[y] <= maxD) {
        if (run < 0) run = y;
      } else if (run >= 0) {
        if (y - run >= minRun) hits.push({ start: run, end: y, mid: (run + y) >> 1, length: y - run });
        run = -1;
      }
    }
    if (run >= 0 && hi + 1 - run >= minRun) {
      hits.push({ start: run, end: hi + 1, mid: (run + hi + 1) >> 1, length: hi + 1 - run });
    }
    return hits;
  }

  function bestGap(dens, center) {
    const h = dens.length;
    const c = Math.max(0, Math.min(h - 1, center));
    const lo = Math.max(0, c - S.search);
    const hi = Math.min(h - 1, c + S.search);
    let hits = gapHits(dens, lo, hi, S.inkGap, S.minGapRun);
    if (!hits.length) hits = gapHits(dens, lo, hi, S.inkRelaxed, S.minGapRun);
    if (!hits.length) return null;
    hits.sort((a, b) => b.length - a.length || Math.abs(a.mid - c) - Math.abs(b.mid - c));
    return hits[0].mid;
  }

  function planPartitions(h, dens) {
    if (h <= S.targetH) {
      return [{ c0: 0, c1: h, ovTop: 0, ovBot: 0, reason: "single_chunk" }];
    }
    const cuts = [];
    let y = 0;
    let guard = 0;
    const maxCuts = Math.floor(h / S.minSlice) + 2;
    while (guard < maxCuts) {
      guard += 1;
      if (h - y <= S.targetH) break;
      const target = y + S.targetH;
      if (h - target < S.minTail) break;
      const gap = bestGap(dens, target);
      if (gap != null && gap > y + S.minSlice) {
        cuts.push({ y: gap, reason: "whitespace_gap", ov: S.safetyOv });
        y = gap;
      } else {
        let fb = target;
        if (fb <= y) fb = y + S.targetH;
        fb = Math.min(fb, h - S.minSlice);
        if (fb <= y) break;
        cuts.push({ y: fb, reason: "overlap_fallback", ov: S.fallbackOv });
        y = fb;
      }
      if (y >= h - S.minSlice) break;
    }
    const bounds = [0, ...cuts.map((c) => c.y), h];
    const parts = [];
    for (let i = 0; i < bounds.length - 1; i += 1) {
      const c0 = bounds[i];
      const c1 = bounds[i + 1];
      if (c1 <= c0) continue;
      let ovTop = i > 0 ? cuts[i - 1].ov : 0;
      let ovBot = i < cuts.length ? cuts[i].ov : 0;
      ovTop = Math.min(ovTop, c0);
      ovBot = Math.min(ovBot, h - c1);
      let reason = "single_chunk";
      if (bounds.length > 2) reason = i === bounds.length - 2 ? "final_chunk" : cuts[i].reason;
      parts.push({ c0, c1, ovTop, ovBot, reason });
    }
    return parts;
  }

  function enhanceCrop(src, y0, y1) {
    const w = src.width;
    const h = y1 - y0;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, y0, w, h, 0, 0, w, h);
    const img = ctx.getImageData(0, 0, w, h);
    const { gray } = toGray(img);
    const { mean, std } = meanStd(gray);
    const lo = mean - 1.2 * std;
    const hi = mean + 1.2 * std;
    const span = Math.max(8, hi - lo);
    for (let i = 0, p = 0; i < img.data.length; i += 4, p += 1) {
      let v = ((gray[p] - lo) / span) * 255;
      v = Math.max(0, Math.min(255, v));
      const bin = v < 160 ? 0 : 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = bin;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return { color: src, y0, y1, processed: canvas };
  }

  function jpegFromCanvas(canvas, maxW, quality) {
    let out = canvas;
    if (canvas.width > maxW) {
      const scale = maxW / canvas.width;
      out = document.createElement("canvas");
      out.width = maxW;
      out.height = Math.max(1, Math.round(canvas.height * scale));
      out.getContext("2d").drawImage(canvas, 0, 0, out.width, out.height);
    }
    return out.toDataURL("image/jpeg", quality);
  }

  async function extractWithTesseract(slices) {
    const unavailable = (message) => ({
      status: "unavailable",
      phase: 3,
      engine: "tesseract",
      text: "",
      box_count: 0,
      slices: [],
      message,
    });
    if (typeof Tesseract === "undefined") {
      return unavailable("On-device OCR could not load. Refresh this HTTPS page, or use the laptop app.");
    }
    let worker;
    try {
      worker = await Tesseract.createWorker("eng");
      const parts = [];
      const texts = [];
      for (const sl of slices) {
        const { data } = await worker.recognize(sl.preview);
        const text = String(data.text || "").replace(/[ \t]+\n/g, "\n").trim();
        const conf = typeof data.confidence === "number" ? data.confidence / 100 : 0;
        parts.push({
          slice_index: sl.index,
          text,
          mean_confidence: Math.round(conf * 10000) / 10000,
          box_count: 0,
        });
        if (text) texts.push(text);
      }
      const joined = texts.join("\n\n");
      if (!joined) {
        return {
          status: "empty",
          phase: 3,
          engine: "tesseract",
          text: "",
          box_count: 0,
          slices: parts,
          message: "No text found in this photo. Try a closer, sharper shot of the page.",
        };
      }
      return {
        status: "ok",
        phase: 3,
        engine: "tesseract",
        text: joined,
        box_count: parts.filter((p) => p.text).length,
        slices: parts,
        message: `${slices.length} slice${slices.length === 1 ? "" : "s"} read on this device.`,
      };
    } catch (err) {
      return unavailable(err && err.message ? String(err.message) : "On-device OCR failed.");
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {
          /* ignore */
        }
      }
    }
  }

  async function prepare(file, opts) {
    const forceExtract = !!(opts && opts.forceExtract);
    const canvas = await fileToCanvas(file, S.maxWidth);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const quality = assess(imageData);
    if (quality.state !== "OK" && !forceExtract) {
      return {
        state: quality.state,
        ok: false,
        quality,
        deskew_angle_deg: 0,
        source_shape: [canvas.height, canvas.width, 3],
        guidance: guidance(quality.state),
        slices: [],
        ocr: {
          status: "skipped",
          phase: 3,
          engine: "tesseract",
          text: "",
          box_count: 0,
          slices: [],
          message: "Text extraction runs after a readable shot.",
        },
        stitched: null,
        formatted: null,
      };
    }
    const { gray, w, h } = toGray(imageData);
    const dens = inkProjection(gray, w, h);
    const parts = planPartitions(h, dens);
    const slices = parts.map((part, index) => {
      const y0 = part.c0 - part.ovTop;
      const y1 = part.c1 + part.ovBot;
      const crop = document.createElement("canvas");
      crop.width = w;
      crop.height = y1 - y0;
      crop.getContext("2d").drawImage(canvas, 0, y0, w, y1 - y0, 0, 0, w, y1 - y0);
      const enhanced = enhanceCrop(canvas, y0, y1);
      return {
        index,
        y_start: y0,
        y_end: y1,
        content_y_start: part.c0,
        content_y_end: part.c1,
        overlap_top: part.ovTop,
        overlap_bottom: part.ovBot,
        cut_reason: part.reason,
        width: w,
        height: y1 - y0,
        preview: jpegFromCanvas(crop, 720, 0.78),
        processed_preview: jpegFromCanvas(enhanced.processed, 720, 0.78),
      };
    });
    const ocr = await extractWithTesseract(slices);
    const stitched =
      window.ToastMerge && typeof window.ToastMerge.stitchSliceTexts === "function"
        ? window.ToastMerge.stitchSliceTexts(ocr.slices || [], 0.2)
        : null;
    const blob = (stitched && stitched.text) || (ocr && ocr.text) || "";
    const formatted =
      window.ToastFormat && typeof window.ToastFormat.formatPlaintext === "function"
        ? window.ToastFormat.formatPlaintext(blob, (ocr && ocr.engine) || "tesseract")
        : null;
    return {
      state: quality.state === "OK" ? "OK" : quality.state,
      ok: quality.state === "OK",
      quality,
      deskew_angle_deg: 0,
      source_shape: [h, w, 3],
      guidance: quality.state === "OK" ? null : guidance(quality.state),
      slices,
      ocr,
      stitched,
      formatted,
    };
  }

  async function ingestMulti(files, overlapHint) {
    const items = [];
    const widths = [];
    const texts = [];
    for (let i = 0; i < files.length; i += 1) {
      const canvas = await fileToCanvas(files[i], S.maxWidth);
      widths.push(canvas.width);
      items.push({
        index: i,
        width: canvas.width,
        height: canvas.height,
        preview: jpegFromCanvas(canvas, 720, 0.78),
      });
      const prepared = await prepare(files[i], { forceExtract: true });
      const text =
        (prepared.stitched && prepared.stitched.text) ||
        (prepared.ocr && prepared.ocr.text) ||
        "";
      texts.push(text);
    }
    const sorted = widths.slice().sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 1;
    const merger = window.ToastMerge && window.ToastMerge.mergeOverlappingTexts;
    const mergedText = merger ? merger(texts, overlapHint) : texts.filter(Boolean).join("\n");
    const warnings = [];
    items.forEach((item) => {
      const delta = Math.abs(item.width - median) / median;
      if (delta > 0.15) {
        warnings.push(
          `Frame ${item.index} width ${item.width}px differs from batch median ${median}px by ${(delta * 100).toFixed(0)}%. Keep the same zoom/distance.`
        );
      }
    });
    const hasText = !!String(mergedText || "").trim();
    const formatted =
      window.ToastFormat && typeof window.ToastFormat.formatPlaintext === "function"
        ? window.ToastFormat.formatPlaintext(mergedText || "", "tesseract")
        : null;
    return {
      count: items.length,
      overlap_hint: overlapHint,
      width_warnings: warnings,
      items,
      merge: {
        status: hasText ? "ok" : "empty",
        phase: 4,
        text: mergedText || "",
        message: hasText
          ? `Merged ${items.length} overlapping shots into one document.`
          : "No text found in these overlapping shots.",
      },
      formatted,
    };
  }

  window.ToastPipeline = { prepare, ingestMulti, assess };
})();
