/* Phase 4 merge — JS port of toast_ocr.merge.overlap.merge_overlapping_texts.
 *
 * Python is the source of truth (src/toast_ocr/merge/). Keep these numbered
 * steps in sync with overlap.py. Do not invent OCR text.
 *
 * Strategy, per consecutive pair (never delete unique text to chase a score):
 * 1. Longest *line* suffix of the left transcript that equals a prefix of the right.
 * 2. Else longest *fuzzy* line suffix/prefix (ratio >= similarityThreshold, min 2 lines).
 * 3. Else longest *token* suffix/prefix (minimum 3 tokens, or 1 if shorter).
 * 4. Else longest common substring near the seam (overlapHint is a window bias only).
 * 5. If nothing matches, concatenate. Missing a dedupe is better than dropping a paragraph.
 */
(() => {
  const DEFAULT_HINT = 0.2;
  const SIMILARITY = 0.85;
  const MIN_FUZZY = 2;

  function splitLines(text) {
    if (!text) return [];
    return String(text).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  }

  function ratio(a, b) {
    const left = String(a || "").trim();
    const right = String(b || "").trim();
    if (!left && !right) return 1;
    if (!left || !right) return 0;
    if (left === right) return 1;
    // Tiny SequenceMatcher-style ratio: 2 * LCS / (lenA + lenB).
    const n = left.length;
    const m = right.length;
    const dp = new Array(m + 1).fill(0);
    let best = 0;
    for (let i = 1; i <= n; i += 1) {
      let prev = 0;
      for (let j = 1; j <= m; j += 1) {
        const tmp = dp[j];
        if (left[i - 1] === right[j - 1]) {
          dp[j] = prev + 1;
          if (dp[j] > best) best = dp[j];
        } else {
          dp[j] = 0;
        }
        prev = tmp;
      }
    }
    return (2 * best) / (n + m);
  }

  function longestLineOverlap(left, right) {
    const maxK = Math.min(left.length, right.length);
    const leftS = left.map((ln) => ln.trim());
    const rightS = right.map((ln) => ln.trim());
    for (let k = maxK; k > 0; k -= 1) {
      let same = true;
      let any = false;
      for (let i = 0; i < k; i += 1) {
        if (leftS[leftS.length - k + i] !== rightS[i]) {
          same = false;
          break;
        }
        if (leftS[leftS.length - k + i]) any = true;
      }
      if (same && any) return k;
    }
    return 0;
  }

  function longestFuzzyLineOverlap(left, right, threshold, minK) {
    const maxK = Math.min(left.length, right.length);
    const floor = Math.max(minK, 1);
    const leftS = left.map((ln) => ln.trim());
    const rightS = right.map((ln) => ln.trim());
    for (let k = maxK; k >= floor; k -= 1) {
      let ok = true;
      let any = false;
      for (let i = 0; i < k; i += 1) {
        const a = leftS[leftS.length - k + i];
        const b = rightS[i];
        if (a || b) any = true;
        if (ratio(a, b) < threshold) {
          ok = false;
          break;
        }
      }
      if (ok && any) return k;
    }
    return 0;
  }

  function longestTokenOverlap(left, right, minLen) {
    const maxK = Math.min(left.length, right.length);
    for (let k = maxK; k >= minLen; k -= 1) {
      let same = true;
      for (let i = 0; i < k; i += 1) {
        if (left[left.length - k + i] !== right[i]) {
          same = false;
          break;
        }
      }
      if (same) return k;
    }
    return 0;
  }

  function longestCommonSubstring(a, b) {
    const n = a.length;
    const m = b.length;
    let best = { size: 0, a: 0, b: 0 };
    const dp = new Array(m + 1).fill(0);
    for (let i = 1; i <= n; i += 1) {
      let prev = 0;
      for (let j = 1; j <= m; j += 1) {
        const tmp = dp[j];
        if (a[i - 1] === b[j - 1]) {
          dp[j] = prev + 1;
          if (dp[j] > best.size) {
            best = { size: dp[j], a: i - dp[j], b: j - dp[j] };
          }
        } else {
          dp[j] = 0;
        }
        prev = tmp;
      }
    }
    return best;
  }

  function mergeSequenceMatcher(left, right, overlapHint) {
    const hint = Math.min(0.8, Math.max(0.05, overlapHint));
    const window = Math.max(32, Math.floor(left.length * hint * 2) || 32);
    const leftTail = left.slice(-window);
    const rightHead = right.slice(0, window);
    const block = longestCommonSubstring(leftTail, rightHead);
    const seam =
      block.size >= 12 &&
      leftTail.length - (block.a + block.size) <= 8 &&
      block.b <= 8;
    if (seam) {
      let prefix = right.slice(block.b + block.size);
      if (prefix.startsWith("\n")) prefix = prefix.slice(1);
      const kept = left.slice(0, left.length - leftTail.length + block.a + block.size);
      if (prefix && !prefix.startsWith("\n")) return `${kept}\n${prefix}`;
      return kept + prefix;
    }
    return `${left.replace(/\s+$/, "")}\n${right.replace(/^\s+/, "")}`;
  }

  function mergePair(left, right, overlapHint, similarityThreshold, minFuzzy) {
    if (!String(right).trim()) return { text: left, matched: true, k: 0 };
    if (!String(left).trim()) return { text: right, matched: true, k: 0 };
    const leftLines = splitLines(left);
    const rightLines = splitLines(right);
    const k = longestLineOverlap(leftLines, rightLines);
    if (k > 0) {
      return { text: leftLines.concat(rightLines.slice(k)).join("\n"), matched: true, k };
    }
    const kf = longestFuzzyLineOverlap(leftLines, rightLines, similarityThreshold, minFuzzy);
    if (kf > 0) {
      return { text: leftLines.concat(rightLines.slice(kf)).join("\n"), matched: true, k: kf };
    }
    const leftToks = left.split(/\s+/).filter(Boolean);
    const rightToks = right.split(/\s+/).filter(Boolean);
    const minTok = Math.min(leftToks.length, rightToks.length) >= 3 ? 3 : 1;
    const kt = longestTokenOverlap(leftToks, rightToks, minTok);
    if (kt > 0) {
      return { text: leftToks.concat(rightToks.slice(kt)).join(" "), matched: true, k: kt };
    }
    const merged = mergeSequenceMatcher(left, right, overlapHint);
    const concat = `${left.replace(/\s+$/, "")}\n${right.replace(/^\s+/, "")}`;
    return { text: merged, matched: merged !== concat, k: merged === concat ? 0 : 1 };
  }

  function mergeOverlappingTexts(texts, overlapHint, similarityThreshold) {
    const hint = typeof overlapHint === "number" ? overlapHint : DEFAULT_HINT;
    const sim = typeof similarityThreshold === "number" ? similarityThreshold : SIMILARITY;
    if (!texts || !texts.length) return "";
    const cleaned = texts.map((t) => (typeof t === "string" ? t : String(t)));
    let merged = cleaned[0];
    for (let i = 1; i < cleaned.length; i += 1) {
      merged = mergePair(merged, cleaned[i], hint, sim, MIN_FUZZY).text;
    }
    return merged;
  }

  function stitchSliceTexts(parts, overlapHint) {
    const texts = (parts || []).map((p) => (p && p.text ? String(p.text) : ""));
    const merged = mergeOverlappingTexts(texts, overlapHint);
    return {
      status: merged.trim() ? "ok" : "empty",
      phase: 4,
      engine: "tesseract",
      text: merged,
      warnings: [],
      duplication_estimate: 0,
      message: merged.trim()
        ? "Stitched slices in reading order."
        : "No text found after stitching.",
    };
  }

  window.ToastMerge = {
    mergeOverlappingTexts,
    stitchSliceTexts,
    mergePair,
  };
})();
