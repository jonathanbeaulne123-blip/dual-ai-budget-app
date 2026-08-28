/* Phase 5 format — JS port of toast_ocr.format.paragraphs.
 *
 * Python is the source of truth. Plaintext + paragraph/line blocks.
 * Blank lines (or large vertical gaps when boxes exist) start a paragraph.
 */
(() => {
  const GAP_RATIO = 0.85;
  const MIN_GAP = 8;

  function median(values) {
    if (!values.length) return 16;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    if (sorted.length % 2) return sorted[mid];
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  function emptyDoc(engine, status) {
    return {
      status: status === "unavailable" ? "unavailable" : "empty",
      phase: 5,
      engine: engine || "",
      text: "",
      block_count: 0,
      blocks: [],
    };
  }

  function fromBlocks(blocks, engine, status) {
    if (!blocks.length) return emptyDoc(engine, status);
    const text = blocks.map((b) => b.text).join("\n\n");
    return {
      status: text.trim() ? "ok" : "empty",
      phase: 5,
      engine: engine || "",
      text,
      block_count: blocks.length,
      blocks,
    };
  }

  function formatPlaintext(text, engine) {
    const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
    if (!raw) return emptyDoc(engine, "empty");
    const chunks = raw.split(/\n{2,}/);
    const blocks = [];
    chunks.forEach((chunk) => {
      const lines = chunk.split("\n").map((ln) => ln.trim()).filter(Boolean);
      if (!lines.length) return;
      blocks.push({
        kind: lines.length <= 1 ? "line" : "paragraph",
        text: lines.join("\n"),
        line_count: lines.length,
      });
    });
    return fromBlocks(blocks, engine, "ok");
  }

  function formatLines(lines, engine) {
    const items = (lines || []).filter((ln) => ln && String(ln.text || "").trim());
    if (!items.length) return emptyDoc(engine, "empty");
    const ordered = items.slice().sort((a, b) => (a.y0 || 0) - (b.y0 || 0) || (a.x0 || 0) - (b.x0 || 0));
    const heights = ordered.map((ln) => Math.max(8, (ln.y1 || 0) - (ln.y0 || 0)));
    const limit = Math.max(MIN_GAP, GAP_RATIO * median(heights));
    const groups = [];
    let current = [ordered[0]];
    for (let i = 1; i < ordered.length; i += 1) {
      const prev = ordered[i - 1];
      const nxt = ordered[i];
      const gap = (nxt.y0 || 0) - (prev.y1 || 0);
      if (gap > limit) {
        groups.push(current);
        current = [nxt];
      } else {
        current.push(nxt);
      }
    }
    groups.push(current);
    const blocks = groups.map((group) => {
      const texts = group.map((ln) => String(ln.text || "").trim()).filter(Boolean);
      return {
        kind: texts.length <= 1 ? "line" : "paragraph",
        text: texts.join("\n"),
        line_count: texts.length,
        y0: group[0].y0,
        y1: group[group.length - 1].y1,
      };
    });
    return fromBlocks(blocks, engine, "ok");
  }

  window.ToastFormat = { formatPlaintext, formatLines };
})();
