import type { ChalkInk, ChalkNote, ChalkPoint, ChalkStroke } from "./types.ts";

export const MAX_CHALK_STROKES = 80;
export const MAX_CHALK_POINTS = 200;
export const MAX_NEAT_CHARS = 160;

const GLYPH_COLS = 5;
const GLYPH_ROWS = 7;

/** 5×7 bitmaps, LSB = leftmost pixel. On-device; never a vendor. */
const FONT: Record<string, number[]> = {
  " ": [0, 0, 0, 0, 0, 0, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x04, 0x0c, 0x08],
  "/": [0x01, 0x02, 0x04, 0x08, 0x10, 0, 0],
  $: [0x0e, 0x15, 0x14, 0x0e, 0x05, 0x15, 0x0e],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x02, 0x04, 0x08, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1c, 0x12, 0x11, 0x11, 0x11, 0x12, 0x1c],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0e],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x01, 0x01, 0x01, 0x01, 0x11, 0x11, 0x0e],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
};

export function shapeChalkInk(raw: unknown): ChalkInk | null {
  if (!raw || typeof raw !== "object") return null;
  const record = raw as ChalkInk;
  const w = Number(record.w);
  const h = Number(record.h);
  if (!Array.isArray(record.strokes) || !Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const strokes: ChalkStroke[] = [];
  for (const row of record.strokes.slice(0, MAX_CHALK_STROKES)) {
    if (!row || typeof row !== "object" || !Array.isArray(row.points)) continue;
    const points: ChalkPoint[] = [];
    for (const point of row.points.slice(0, MAX_CHALK_POINTS)) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      points.push({ x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) });
    }
    if (points.length >= 2) strokes.push({ points });
  }
  if (!strokes.length) return null;
  return { w, h, strokes };
}

export function hasChalkInk(ink?: ChalkInk | null): boolean {
  return Boolean(ink && ink.strokes.length);
}

type GlyphBox = { x0: number; y0: number; x1: number; y1: number; points: ChalkPoint[] };

function clusterByGap(items: GlyphBox[], axis: "x" | "y", minGap: number): GlyphBox[][] {
  if (!items.length) return [];
  const sorted = [...items].sort((left, right) => (axis === "x" ? left.x0 - right.x0 : left.y0 - right.y0));
  const groups: GlyphBox[][] = [[sorted[0]!]];
  for (let i = 1; i < sorted.length; i += 1) {
    const prev = groups[groups.length - 1]!;
    const last = prev[prev.length - 1]!;
    const current = sorted[i]!;
    const gap = axis === "x" ? current.x0 - last.x1 : current.y0 - last.y1;
    if (gap > minGap) groups.push([current]);
    else prev.push(current);
  }
  return groups;
}

function strokeBox(stroke: ChalkStroke): GlyphBox | null {
  if (stroke.points.length < 2) return null;
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  for (const point of stroke.points) {
    x0 = Math.min(x0, point.x);
    y0 = Math.min(y0, point.y);
    x1 = Math.max(x1, point.x);
    y1 = Math.max(y1, point.y);
  }
  if (x1 - x0 < 0.002 && y1 - y0 < 0.002) return null;
  return { x0, y0, x1, y1, points: stroke.points };
}

function mergeBoxes(boxes: GlyphBox[]): GlyphBox {
  let x0 = 1;
  let y0 = 1;
  let x1 = 0;
  let y1 = 0;
  const points: ChalkPoint[] = [];
  for (const box of boxes) {
    x0 = Math.min(x0, box.x0);
    y0 = Math.min(y0, box.y0);
    x1 = Math.max(x1, box.x1);
    y1 = Math.max(y1, box.y1);
    points.push(...box.points);
  }
  return { x0, y0, x1, y1, points };
}

export function segmentChalkGlyphs(ink: ChalkInk): GlyphBox[] {
  const strokes = ink.strokes.map(strokeBox).filter((row): row is GlyphBox => Boolean(row));
  if (!strokes.length) return [];
  const heights = strokes.map((box) => Math.max(0.02, box.y1 - box.y0)).sort((a, b) => a - b);
  const widths = strokes.map((box) => Math.max(0.02, box.x1 - box.x0)).sort((a, b) => a - b);
  const medianH = heights[Math.floor(heights.length / 2)] ?? 0.08;
  const medianW = widths[Math.floor(widths.length / 2)] ?? 0.05;
  const lines = clusterByGap(strokes, "y", medianH * 0.55);
  const glyphs: GlyphBox[] = [];
  for (const line of lines) {
    const letters = clusterByGap(line, "x", Math.max(0.018, medianW * 0.45));
    for (const letter of letters) glyphs.push(mergeBoxes(letter));
  }
  return glyphs;
}

function rasterize(box: GlyphBox): number[] {
  const padX = Math.max(0.004, (box.x1 - box.x0) * 0.08);
  const padY = Math.max(0.004, (box.y1 - box.y0) * 0.08);
  const x0 = box.x0 - padX;
  const y0 = box.y0 - padY;
  const w = Math.max(0.01, box.x1 - box.x0 + padX * 2);
  const h = Math.max(0.01, box.y1 - box.y0 + padY * 2);
  const cells = new Array(GLYPH_COLS * GLYPH_ROWS).fill(0);
  for (const point of box.points) {
    const col = Math.min(GLYPH_COLS - 1, Math.max(0, Math.floor(((point.x - x0) / w) * GLYPH_COLS)));
    const row = Math.min(GLYPH_ROWS - 1, Math.max(0, Math.floor(((point.y - y0) / h) * GLYPH_ROWS)));
    cells[row * GLYPH_COLS + col] = 1;
  }
  return cells;
}

function fontRaster(char: string): number[] {
  const rows = FONT[char] ?? FONT[" "]!;
  const cells: number[] = [];
  for (const row of rows) {
    for (let col = 0; col < GLYPH_COLS; col += 1) {
      cells.push((row >> col) & 1);
    }
  }
  return cells;
}

function matchScore(a: number[], b: number[]): number {
  let same = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] === b[i]) same += 1;
  }
  return same / a.length;
}

const ALPHABET = Object.keys(FONT).filter((char) => char !== " ");

export function recognizeGlyph(box: GlyphBox): string {
  const aspect = (box.x1 - box.x0) / Math.max(0.001, box.y1 - box.y0);
  if (aspect > 3.2 && box.y1 - box.y0 < 0.04) return "-";
  const raster = rasterize(box);
  let best = "?";
  let score = 0.52;
  for (const char of ALPHABET) {
    const next = matchScore(raster, fontRaster(char));
    if (next > score) {
      score = next;
      best = char;
    }
  }
  if (aspect < 0.62 && (best === "T" || best === "I" || best === "1" || best === "J" || best === "?")) {
    const iScore = matchScore(raster, fontRaster("I"));
    const oneScore = matchScore(raster, fontRaster("1"));
    return iScore >= oneScore ? "I" : "1";
  }
  return best;
}

export function detectChalkLetters(ink: ChalkInk | null | undefined): string {
  const shaped = shapeChalkInk(ink ?? null);
  if (!shaped) return "";
  const glyphs = segmentChalkGlyphs(shaped);
  if (!glyphs.length) return "";
  const heights = glyphs.map((box) => box.y1 - box.y0);
  const widths = glyphs.map((box) => box.x1 - box.x0);
  const medianH = [...heights].sort((a, b) => a - b)[Math.floor(heights.length / 2)] ?? 0.08;
  const medianW = [...widths].sort((a, b) => a - b)[Math.floor(widths.length / 2)] ?? 0.05;
  const letters = glyphs.map((glyph) => recognizeGlyph(glyph));
  for (let i = 0; i < letters.length; i += 1) {
    const left = letters[i - 1] ?? "";
    const right = letters[i + 1] ?? "";
    if (letters[i] === "1" && /[A-Z]/.test(left) && /[A-Z]/.test(right)) letters[i] = "I";
  }
  let text = "";
  let last: GlyphBox | null = null;
  for (let i = 0; i < glyphs.length; i += 1) {
    const glyph = glyphs[i]!;
    if (last) {
      const lineGap = glyph.y0 - last.y1;
      const wordGap = glyph.x0 - last.x1;
      if (lineGap > medianH * 0.55) text += "\n";
      else if (wordGap > Math.max(0.08, medianW * 1.15)) text += " ";
    }
    text += letters[i] ?? "?";
    last = glyph;
  }
  return organizeNeatText(text);
}

export function organizeNeatText(raw: string): string {
  const lines = String(raw || "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.replace(/[?]{2,}/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[-.,/\s]+/, "").trim())
    .filter(Boolean);
  const dated: string[] = [];
  const shopping: string[] = [];
  const rest: string[] = [];
  for (const line of lines) {
    if (/\d{4}-\d{2}-\d{2}/.test(line) || /^(mon|tue|wed|thu|fri|sat|sun)\b/i.test(line)) dated.push(line);
    else if (/\b(milk|eggs|bread|oat|coffee|chili|chocolate|grocery|groceries)\b/i.test(line)) shopping.push(line);
    else rest.push(line);
  }
  return [...dated, ...shopping, ...rest].join("\n").slice(0, MAX_NEAT_CHARS);
}

export function organizeChalkNotes<T extends Pick<ChalkNote, "text" | "createdAt">>(notes: T[]): T[] {
  const rank = (text: string) => {
    if (/\d{4}-\d{2}-\d{2}/.test(text) || /^(mon|tue|wed|thu|fri|sat|sun)\b/i.test(text)) return 0;
    if (/\b(milk|eggs|bread|oat|coffee|chili|chocolate|grocery|groceries)\b/i.test(text)) return 1;
    return 2;
  };
  return [...notes].sort((left, right) => {
    const delta = rank(left.text) - rank(right.text);
    if (delta !== 0) return delta;
    return right.createdAt.localeCompare(left.createdAt);
  });
}

/** Deterministic ink for tests and for “typeset → chalk” round-trips. */
export function inkFromText(text: string): ChalkInk {
  const glyphs = String(text || "").toUpperCase().replace(/[^A-Z0-9 $.,\-\/\n]/g, " ").split("");
  const strokes: ChalkStroke[] = [];
  let cursorX = 0.04;
  let cursorY = 0.08;
  const cell = 0.018;
      const gap = 0.04;
  for (const char of glyphs) {
    if (char === "\n") {
      cursorX = 0.04;
      cursorY += GLYPH_ROWS * cell + 0.05;
      continue;
    }
    const rows = FONT[char] ?? FONT[" "]!;
    if (char !== " ") {
      const points: ChalkPoint[] = [];
      for (let row = 0; row < GLYPH_ROWS; row += 1) {
        for (let col = 0; col < GLYPH_COLS; col += 1) {
          if (!((rows[row]! >> col) & 1)) continue;
          points.push({
            x: cursorX + col * cell,
            y: cursorY + row * cell,
          });
        }
      }
      if (points.length === 1) points.push({ x: points[0]!.x + cell * 0.4, y: points[0]!.y + cell * 0.4 });
      if (points.length >= 2) strokes.push({ points });
    }
    cursorX += GLYPH_COLS * cell + gap;
  }
  return {
    w: 320,
    h: 180,
    strokes: strokes.slice(0, MAX_CHALK_STROKES),
  };
}
