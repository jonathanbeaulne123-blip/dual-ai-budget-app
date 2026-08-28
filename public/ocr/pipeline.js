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

  const COLLAGE_STEPS = [
    "Photograph one receipt at a time. Don't shoot a table collage.",
    "Fill the frame with that receipt — move closer.",
    "No green/blue boxes drawn on the photo.",
    "Hold still so the type is sharp.",
    "Take another photo for the next receipt.",
  ];

  const D = {
    bgPct: 20,
    lowOff: 22,
    highPct: 72,
    maxSat: 70,
    overlaySat: 40,
    minAreaFrac: 0.004,
    minAreaPx: 2000,
    minFill: 0.18,
    maxRegionFrac: 0.7,
    fullPageFrac: 0.48,
    padPx: 8,
    padFrac: 0.03,
    targetMin: 1100,
    maxScale: 4.5,
    minCrop: 40,
    shortRatio: 0.55,
    minAlnum: 8,
    minLetters: 24,
  };

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function ramp(value, low, high) {
    if (high <= low) return value >= high ? 1 : 0;
    return clamp01((value - low) / (high - low));
  }

  function guidance(state, reason) {
    if (reason === "collage") {
      return {
        state: "NEEDS_MULTI_IMAGE",
        title: "Photograph one receipt at a time",
        message:
          "This looks like several receipts on a table, or the text came out as noise. Photograph one receipt per shot, fill the frame, no table collage, and no marker boxes.",
        steps: COLLAGE_STEPS,
        overlap_hint: 0.2,
      };
    }
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

  function percentile(values, pct) {
    if (!values.length) return 0;
    const copy = values.slice().sort((a, b) => a - b);
    const i = Math.max(0, Math.min(copy.length - 1, Math.round((pct / 100) * (copy.length - 1))));
    return copy[i];
  }

  function rgbToHsvOpenCv(r, g, b) {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;
    const s = max === 0 ? 0 : (delta / max) * 255;
    let h = 0;
    if (delta !== 0) {
      if (max === r) h = 60 * (((g - b) / delta) % 6);
      else if (max === g) h = 60 * ((b - r) / delta + 2);
      else h = 60 * ((r - g) / delta + 4);
      if (h < 0) h += 360;
    }
    return { h: h / 2, s, v: max };
  }

  function sampleGraySatHue(imageData) {
    const { width: w, height: h, data } = imageData;
    const gray = new Uint8Array(w * h);
    const sat = new Uint8Array(w * h);
    const hue = new Uint8Array(w * h);
    const samples = [];
    for (let y = 0, p = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1, p += 1) {
        const i = p * 4;
        const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        gray[p] = g;
        const hsv = rgbToHsvOpenCv(data[i], data[i + 1], data[i + 2]);
        sat[p] = hsv.s;
        hue[p] = hsv.h;
        if ((p & 3) === 0) samples.push(g);
      }
    }
    return { gray, sat, hue, samples, w, h };
  }

  function paperMask(gray, sat, hue, thr, w, h) {
    const mask = new Uint8Array(w * h);
    for (let i = 0; i < mask.length; i += 1) {
      const overlay =
        sat[i] > D.overlaySat &&
        ((hue[i] >= 35 && hue[i] <= 95) || (hue[i] >= 90 && hue[i] <= 140));
      mask[i] = gray[i] >= thr && sat[i] < D.maxSat && !overlay ? 1 : 0;
    }
    return mask;
  }

  function morphClose3(mask, w, h) {
    const tmp = new Uint8Array(mask.length);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        let on = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (mask[(y + dy) * w + (x + dx)]) on = 1;
          }
        }
        tmp[y * w + x] = on;
      }
    }
    const out = new Uint8Array(mask.length);
    for (let y = 1; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        let off = 0;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!tmp[(y + dy) * w + (x + dx)]) off = 1;
          }
        }
        out[y * w + x] = off ? 0 : 1;
      }
    }
    return out;
  }

  function connectedBoxes(mask, w, h, minArea, minFill, maxFrac) {
    const seen = new Uint8Array(mask.length);
    const boxes = [];
    const frame = w * h;
    for (let start = 0; start < mask.length; start += 1) {
      if (!mask[start] || seen[start]) continue;
      const stack = [start];
      seen[start] = 1;
      let area = 0;
      let minx = w;
      let miny = h;
      let maxx = 0;
      let maxy = 0;
      while (stack.length) {
        const p = stack.pop();
        const x = p % w;
        const y = (p / w) | 0;
        area += 1;
        if (x < minx) minx = x;
        if (y < miny) miny = y;
        if (x > maxx) maxx = x;
        if (y > maxy) maxy = y;
        for (let dy = -1; dy <= 1; dy += 1) {
          for (let dx = -1; dx <= 1; dx += 1) {
            if (!dx && !dy) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const np = ny * w + nx;
            if (!mask[np] || seen[np]) continue;
            seen[np] = 1;
            stack.push(np);
          }
        }
      }
      const bw = maxx - minx + 1;
      const bh = maxy - miny + 1;
      const fill = area / Math.max(1, bw * bh);
      if (area < minArea || fill < minFill || area > maxFrac * frame) continue;
      boxes.push({ x: minx, y: miny, width: bw, height: bh, area, fill });
    }
    return boxes;
  }

  function containFrac(outer, inner) {
    const x0 = Math.max(outer.x, inner.x);
    const y0 = Math.max(outer.y, inner.y);
    const x1 = Math.min(outer.x + outer.width, inner.x + inner.width);
    const y1 = Math.min(outer.y + outer.height, inner.y + inner.height);
    if (x1 <= x0 || y1 <= y0) return 0;
    return ((x1 - x0) * (y1 - y0)) / Math.max(1, inner.width * inner.height);
  }

  function boxIou(a, b) {
    const x0 = Math.max(a.x, b.x);
    const y0 = Math.max(a.y, b.y);
    const x1 = Math.min(a.x + a.width, b.x + b.width);
    const y1 = Math.min(a.y + a.height, b.y + b.height);
    if (x1 <= x0 || y1 <= y0) return 0;
    const inter = (x1 - x0) * (y1 - y0);
    return inter / Math.max(1, a.width * a.height + b.width * b.height - inter);
  }

  function dedupeBoxes(items) {
    const keep = items.map(() => true);
    for (let i = 0; i < items.length; i += 1) {
      if (!keep[i]) continue;
      for (let j = i + 1; j < items.length; j += 1) {
        if (!keep[j]) continue;
        const a = items[i];
        const b = items[j];
        if (boxIou(a, b) < 0.65 && containFrac(a, b) < 0.85 && containFrac(b, a) < 0.85) continue;
        const dropJ = a.fill > b.fill || (a.fill === b.fill && a.area >= b.area);
        keep[dropJ ? j : i] = false;
        if (!keep[i]) break;
      }
    }
    return items.filter((_, i) => keep[i]);
  }

  function mergeHighIntoLow(lows, highs) {
    const final = [];
    const used = new Set();
    lows.forEach((low) => {
      const kids = [];
      highs.forEach((hi, j) => {
        if (containFrac(low, hi) > 0.55) kids.push(j);
      });
      if (kids.length >= 2) {
        kids.forEach((j) => {
          final.push(highs[j]);
          used.add(j);
        });
        return;
      }
      if (kids.length === 1) {
        const hi = highs[kids[0]];
        final.push(hi.area > 0.5 * low.area ? hi : low);
        used.add(kids[0]);
        return;
      }
      final.push(low);
    });
    highs.forEach((hi, j) => {
      if (!used.has(j)) final.push(hi);
    });
    return dedupeBoxes(final);
  }

  function readingOrder(regions, frameW) {
    if (!regions.length) return [];
    const gap = Math.max(36, (frameW * 0.08) | 0);
    const ordered = regions.slice().sort((a, b) => a.x + a.width / 2 - (b.x + b.width / 2) || a.y - b.y);
    const columns = [];
    ordered.forEach((region) => {
      const cx = region.x + region.width / 2;
      let placed = false;
      for (let c = 0; c < columns.length; c += 1) {
        const col = columns[c];
        const colCx = col.reduce((s, r) => s + r.x + r.width / 2, 0) / col.length;
        if (Math.abs(cx - colCx) <= gap) {
          col.push(region);
          placed = true;
          break;
        }
      }
      if (!placed) columns.push([region]);
    });
    columns.sort((a, b) => {
      const ac = a.reduce((s, r) => s + r.x + r.width / 2, 0) / a.length;
      const bc = b.reduce((s, r) => s + r.x + r.width / 2, 0) / b.length;
      return ac - bc;
    });
    const out = [];
    columns.forEach((col) => {
      col.sort((a, b) => a.y - b.y);
      out.push.apply(out, col);
    });
    return out;
  }

  function detectDocuments(imageData) {
    const { gray, sat, hue, samples, w, h } = sampleGraySatHue(imageData);
    const bg = percentile(samples, D.bgPct);
    const lowThr = bg + D.lowOff;
    const highThr = Math.max(percentile(samples, D.highPct), lowThr + 8);
    const minArea = Math.max(D.minAreaPx, (D.minAreaFrac * w * h) | 0);
    const lowMask = morphClose3(paperMask(gray, sat, hue, lowThr, w, h), w, h);
    const highMask = paperMask(gray, sat, hue, highThr, w, h);
    const lows = connectedBoxes(lowMask, w, h, minArea, D.minFill, D.maxRegionFrac);
    const highs = connectedBoxes(
      highMask,
      w,
      h,
      Math.max(1200, (minArea / 2) | 0),
      Math.max(0.16, D.minFill - 0.04),
      D.maxRegionFrac
    );
    return readingOrder(mergeHighIntoLow(lows, highs), w);
  }

  function isFullPageLayout(regions, w, h) {
    if (!regions.length) return true;
    if (regions.length === 1) {
      const r = regions[0];
      return r.width * r.height >= 0.45 * w * h;
    }
    return false;
  }

  function cropCanvas(src, region) {
    const pad = Math.max(D.padPx, (D.padFrac * Math.min(region.width, region.height)) | 0);
    const x0 = Math.max(0, region.x - pad);
    const y0 = Math.max(0, region.y - pad);
    const x1 = Math.min(src.width, region.x + region.width + pad);
    const y1 = Math.min(src.height, region.y + region.height + pad);
    const cw = Math.max(1, x1 - x0);
    const ch = Math.max(1, y1 - y0);
    const canvas = document.createElement("canvas");
    canvas.width = cw;
    canvas.height = ch;
    canvas.getContext("2d").drawImage(src, x0, y0, cw, ch, 0, 0, cw, ch);
    return canvas;
  }

  function upscaleCanvas(src) {
    // Receipts are narrow; scale by width so glyphs get large enough for Tesseract.
    if (src.width >= D.targetMin) return src;
    const scale = Math.min(D.maxScale, D.targetMin / src.width);
    if (scale <= 1.05) return src;
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(src.width * scale));
    out.height = Math.max(1, Math.round(src.height * scale));
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(src, 0, 0, out.width, out.height);
    return out;
  }

  function contrastGrayCanvas(src) {
    const canvas = document.createElement("canvas");
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { gray } = toGray(img);
    const { mean, std } = meanStd(gray);
    const lo = mean - 1.4 * std;
    const hi = mean + 1.4 * std;
    const span = Math.max(8, hi - lo);
    for (let i = 0, p = 0; i < img.data.length; i += 4, p += 1) {
      let v = ((gray[p] - lo) / span) * 255;
      v = Math.max(0, Math.min(255, v));
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return canvas;
  }

  function pngFromCanvas(canvas) {
    return canvas.toDataURL("image/png");
  }

  function applyLexicon(text) {
    if (window.ToastLexicon && typeof window.ToastLexicon.correctText === "function") {
      return window.ToastLexicon.correctText(text);
    }
    return text;
  }

  function joinReceiptTexts(texts) {
    const parts = texts.map((t) => String(t || "").trim()).filter(Boolean);
    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    const chunks = [];
    parts.forEach((part, i) => {
      if (i > 0) chunks.push(`--- receipt ${i + 1} ---`);
      chunks.push(part);
    });
    return chunks.join("\n\n");
  }

  function isGarbage(text) {
    const blob = String(text || "");
    if (/EMPLOYEE|SHIFT|SALES|CASH|TILL|GROSS|TOTAL|RECEIPT|\d{2}\/\d{2}\/20\d{2}|\$\s*\d/i.test(blob)) {
      return false;
    }
    const tokens = blob.match(/\S+/g) || [];
    const alnum = tokens.filter((t) => /[A-Za-z0-9]/.test(t));
    const letters = (blob.match(/[A-Za-z]/g) || []).length;
    if (alnum.length < D.minAlnum) return false;
    const short = alnum.filter((t) => t.replace(/[^A-Za-z0-9]/g, "").length <= 2).length;
    return short / alnum.length >= D.shortRatio;
  }

  function sliceFromCanvas(canvas, index, extra) {
    const enhanced = contrastGrayCanvas(canvas);
    return Object.assign(
      {
        index,
        y_start: 0,
        y_end: canvas.height,
        content_y_start: 0,
        content_y_end: canvas.height,
        overlap_top: 0,
        overlap_bottom: 0,
        cut_reason: extra && extra.cut_reason ? extra.cut_reason : "document_crop",
        width: canvas.width,
        height: canvas.height,
        document_index: extra && extra.document_index ? extra.document_index : 0,
        preview: jpegFromCanvas(enhanced, 1600, 0.9),
        processed_preview: jpegFromCanvas(enhanced, 1600, 0.9),
        ocr_image: pngFromCanvas(enhanced),
      },
      extra || {}
    );
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
      const psm =
        (typeof Tesseract.PSM !== "undefined" && Tesseract.PSM.SINGLE_COLUMN) || "4";
      await worker.setParameters({
        tessedit_pageseg_mode: psm,
        preserve_interword_spaces: "1",
        user_defined_dpi: "300",
      });
      const parts = [];
      const byDoc = new Map();
      for (const sl of slices) {
        const source = sl.ocr_image || sl.preview || sl.processed_preview;
        const { data } = await worker.recognize(source);
        const raw = String(data.text || "").replace(/[ \t]+\n/g, "\n").trim();
        const lexed = applyLexicon(raw);
        const conf = typeof data.confidence === "number" ? data.confidence / 100 : 0;
        const guided =
          window.ToastGuide && typeof window.ToastGuide.improve === "function"
            ? window.ToastGuide.improve(lexed, {
                slice_index: sl.index,
                cut_reason: sl.cut_reason,
                engine_confidence: conf,
              })
            : { text: lexed, guide: null };
        const text = guided.text || lexed;
        const docIndex = sl.document_index || 0;
        parts.push({
          slice_index: sl.index,
          document_index: docIndex,
          text,
          raw_text: raw,
          guide: guided.guide || null,
          mean_confidence: Math.round(conf * 10000) / 10000,
          box_count: 0,
        });
        if (text) {
          if (!byDoc.has(docIndex)) byDoc.set(docIndex, []);
          byDoc.get(docIndex).push(text);
        }
      }
      const docTexts = Array.from(byDoc.keys())
        .sort((a, b) => a - b)
        .map((k) => (byDoc.get(k) || []).join("\n"));
      const avgEngine =
        parts.length
          ? parts.reduce((s, p) => s + (p.mean_confidence || 0), 0) / parts.length
          : 0;
      const guidedJoined =
        window.ToastGuide && typeof window.ToastGuide.improve === "function"
          ? window.ToastGuide.improve(joinReceiptTexts(docTexts), {
              engine_confidence: avgEngine,
            })
          : { text: joinReceiptTexts(docTexts), guide: null };
      const joined = applyLexicon(guidedJoined.text);
      if (!joined) {
        return {
          status: "empty",
          phase: 3,
          engine: "tesseract",
          text: "",
          box_count: 0,
          slices: parts,
          message: "No text found in this photo. Try a closer, sharper shot of one receipt.",
        };
      }
      const confs = parts
        .map((p) => (p.guide && typeof p.guide.confidence === "number" ? p.guide.confidence : null))
        .filter((n) => n !== null);
      const fromSlices = confs.length
        ? Math.round(confs.reduce((a, b) => a + b, 0) / confs.length)
        : null;
      const docConf =
        guidedJoined.guide && typeof guidedJoined.guide.confidence === "number"
          ? guidedJoined.guide.confidence
          : fromSlices;
      return {
        status: "ok",
        phase: 3,
        engine: "tesseract",
        text: joined,
        box_count: parts.filter((p) => p.text).length,
        slices: parts,
        confidence: docConf,
        guide: guidedJoined.guide || null,
        message:
          `${slices.length} crop${slices.length === 1 ? "" : "s"} read on this device.` +
          (docConf !== null ? ` System confidence ${docConf}%.` : ""),
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

  function collageHalt(quality, canvas, documents) {
    return {
      state: "NEEDS_MULTI_IMAGE",
      ok: false,
      quality,
      deskew_angle_deg: 0,
      source_shape: [canvas.height, canvas.width, 3],
      guidance: guidance("NEEDS_MULTI_IMAGE", "collage"),
      slices: [],
      document_count: (documents || []).length,
      documents: documents || [],
      ocr: {
        status: "skipped",
        phase: 3,
        engine: "tesseract",
        text: "",
        box_count: 0,
        slices: [],
        message: "Do not return a table collage as text. Photograph one receipt at a time.",
      },
      stitched: null,
      formatted: null,
    };
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
        document_count: 0,
        documents: [],
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
    const regions = detectDocuments(imageData);
    const multi = regions.length >= 2 && !isFullPageLayout(regions, canvas.width, canvas.height);
    let slices;
    if (multi) {
      const tiny = regions.every((r) => Math.min(r.width, r.height) < D.minCrop);
      if (tiny) return collageHalt(quality, canvas, regions);
      slices = regions.map((region, index) => {
        const crop = upscaleCanvas(cropCanvas(canvas, region));
        return sliceFromCanvas(crop, index, {
          document_index: index,
          cut_reason: "document_crop",
          y_start: region.y,
          y_end: region.y + region.height,
          content_y_start: region.y,
          content_y_end: region.y + region.height,
        });
      });
    } else {
      const { gray, w, h } = toGray(imageData);
      const dens = inkProjection(gray, w, h);
      const parts = planPartitions(h, dens);
      slices = parts.map((part, index) => {
        const y0 = part.c0 - part.ovTop;
        const y1 = part.c1 + part.ovBot;
        const crop = document.createElement("canvas");
        crop.width = w;
        crop.height = y1 - y0;
        crop.getContext("2d").drawImage(canvas, 0, y0, w, y1 - y0, 0, 0, w, y1 - y0);
        const ocrCanvas = upscaleCanvas(contrastGrayCanvas(crop));
        return {
          index,
          y_start: y0,
          y_end: y1,
          content_y_start: part.c0,
          content_y_end: part.c1,
          overlap_top: part.ovTop,
          overlap_bottom: part.ovBot,
          cut_reason: part.reason,
          width: ocrCanvas.width,
          height: ocrCanvas.height,
          document_index: 0,
          preview: jpegFromCanvas(ocrCanvas, 1600, 0.9),
          processed_preview: jpegFromCanvas(ocrCanvas, 1600, 0.9),
          ocr_image: pngFromCanvas(ocrCanvas),
        };
      });
    }
    const ocr = await extractWithTesseract(slices);
    if (ocr.status === "ok" && isGarbage(ocr.text) && !forceExtract) {
      return collageHalt(quality, canvas, regions);
    }
    const stitched =
      window.ToastMerge && typeof window.ToastMerge.stitchSliceTexts === "function"
        ? window.ToastMerge.stitchSliceTexts(ocr.slices || [], 0.2)
        : null;
    const blob = (ocr && ocr.text) || (stitched && stitched.text) || "";
    const formatted =
      window.ToastFormat && typeof window.ToastFormat.formatPlaintext === "function"
        ? window.ToastFormat.formatPlaintext(blob, (ocr && ocr.engine) || "tesseract")
        : null;
    return {
      state: quality.state === "OK" ? "OK" : quality.state,
      ok: quality.state === "OK",
      quality,
      deskew_angle_deg: 0,
      source_shape: [canvas.height, canvas.width, 3],
      guidance: quality.state === "OK" ? null : guidance(quality.state),
      slices,
      document_count: multi ? regions.length : Math.max(1, regions.length),
      documents: regions,
      ocr,
      stitched: ocr && ocr.text ? Object.assign({}, stitched || {}, { text: ocr.text, status: ocr.status }) : stitched,
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
    const mergedText = applyLexicon(
      merger ? merger(texts, overlapHint) : texts.filter(Boolean).join("\n")
    );
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
    const mergeGuide =
      hasText && window.ToastGuide && typeof window.ToastGuide.improve === "function"
        ? window.ToastGuide.improve(mergedText).guide
        : null;
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
        guide: mergeGuide,
        confidence: mergeGuide && typeof mergeGuide.confidence === "number" ? mergeGuide.confidence : null,
        message: hasText
          ? `Merged ${items.length} overlapping shots into one document.`
          : "No text found in these overlapping shots.",
      },
      formatted,
    };
  }

  window.ToastPipeline = {
    prepare,
    ingestMulti,
    assess,
    detectDocuments,
    isGarbage,
    fileToCanvas,
    cropCanvas,
    upscaleCanvas,
    contrastGrayCanvas,
    jpegFromCanvas,
    pngFromCanvas,
    toGray,
    inkProjection,
  };
})();
