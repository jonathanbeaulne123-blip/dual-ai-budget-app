/**
 * 2D paint replay for one Kitty part. Pure canvas, no three.js, so the same
 * stroke data renders identically in the 3D studio and anywhere else.
 *
 * Layer canvas = true colour (the underglaze as painted).
 * Display canvas = what the material shows: identical when fired, "bisque"
 * lifted (35% toward chalk, 25% desaturated) while the clay is unfired.
 */
import type { KittyAnchor, KittyPaintV1, KittyPart, KittyStampV1, KittyStrokeV1 } from "../../core/types.ts";
import { studioHex } from "./palette.ts";

export const PART_CANVAS_SIZE: Record<KittyPart, number> = { body: 512, head: 512, earL: 256, earR: 256, tail: 256, paws: 256 };
/** Part-local uv for every named anchor. Front centre of every part is u = 0.5. */
export const KITTY_ANCHOR_UV: Record<KittyAnchor, { part: KittyPart; u: number; v: number }> = {
  forehead: { part: "head", u: 0.5, v: 0.74 },
  leftCheek: { part: "head", u: 0.36, v: 0.46 },
  rightCheek: { part: "head", u: 0.64, v: 0.46 },
  chin: { part: "head", u: 0.5, v: 0.2 },
  chest: { part: "body", u: 0.5, v: 0.82 },
  belly: { part: "body", u: 0.5, v: 0.64 },
  back: { part: "body", u: 0.0, v: 0.62 },
  leftFlank: { part: "body", u: 0.25, v: 0.55 },
  rightFlank: { part: "body", u: 0.75, v: 0.55 },
  rump: { part: "body", u: 0.0, v: 0.3 },
  leftEar: { part: "earL", u: 0.5, v: 0.45 },
  rightEar: { part: "earR", u: 0.5, v: 0.45 },
  tailTip: { part: "tail", u: 0.9, v: 0.5 },
};
export const mirrorU = (u: number) => 1 - u;
export const mirrorPart = (part: KittyPart): KittyPart => (part === "earL" ? "earR" : part === "earR" ? "earL" : part);
export const BISQUE = { r: 239, g: 230, b: 216 };

export function partDip(paint: KittyPaintV1, part: KittyPart): string {
  return studioHex(paint.parts[part] ?? paint.base);
}
type Ctx = CanvasRenderingContext2D;
const px = (u: number, v: number, size: number) => ({ x: u * size, y: (1 - v) * size });

function strokeSegment(ctx: Ctx, stroke: KittyStrokeV1, dip: string, size: number, from: number, to: number) {
  const width = (stroke.size * size) / 512;
  const color = stroke.tool === "eraser" ? dip : stroke.color;
  ctx.save();
  ctx.lineCap = stroke.tool === "marker" ? "square" : "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.globalAlpha = stroke.tool === "eraser" ? 1 : stroke.tool === "marker" ? Math.max(0.85, stroke.opacity) : stroke.tool === "sponge" ? Math.min(0.5, stroke.opacity * 0.5) : stroke.opacity;
  ctx.lineWidth = width;
  const pts = stroke.pts;
  const draw = (offsetX: number) => {
    if (stroke.tool === "sponge") {
      for (let i = Math.max(0, from); i <= to; i++) {
        const p = px(pts[i * 2]!, pts[i * 2 + 1]!, size);
        for (let d = 0; d < 5; d++) {
          const seed = ((i * 7 + d * 13) % 11) / 11, seed2 = ((i * 3 + d * 5) % 7) / 7;
          ctx.beginPath();
          ctx.arc(p.x + offsetX + (seed - 0.5) * width, p.y + (seed2 - 0.5) * width, width * (0.22 + seed2 * 0.2), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      return;
    }
    ctx.beginPath();
    if (from === to || pts.length === 2) {
      const p = px(pts[from * 2]!, pts[from * 2 + 1]!, size);
      ctx.arc(p.x + offsetX, p.y, width / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    let prev = px(pts[from * 2]!, pts[from * 2 + 1]!, size);
    ctx.moveTo(prev.x + offsetX, prev.y);
    for (let i = from + 1; i <= to; i++) {
      let u = pts[i * 2]!;
      const prevU = pts[(i - 1) * 2]!;
      // Cross the seam the short way; the mirrored copy below covers the wrap.
      if (Math.abs(u - prevU) > 0.5) u += u > prevU ? -1 : 1;
      const p = px(u, pts[i * 2 + 1]!, size);
      ctx.lineTo(p.x + offsetX, p.y);
      prev = p;
    }
    ctx.stroke();
  };
  draw(0);
  draw(size);
  draw(-size);
  ctx.restore();
}
function stampPath(ctx: Ctx, kind: KittyStampV1["kind"], r: number, text?: string) {
  ctx.beginPath();
  switch (kind) {
    case "heart":
      ctx.moveTo(0, r * 0.8);
      ctx.bezierCurveTo(-r * 1.4, -r * 0.2, -r * 0.6, -r * 1.1, 0, -r * 0.35);
      ctx.bezierCurveTo(r * 0.6, -r * 1.1, r * 1.4, -r * 0.2, 0, r * 0.8);
      ctx.closePath();
      break;
    case "star":
      for (let i = 0; i < 10; i++) {
        const a = (i * Math.PI) / 5 - Math.PI / 2, rad = i % 2 ? r * 0.45 : r;
        ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      ctx.closePath();
      break;
    case "paw":
      ctx.ellipse(0, r * 0.3, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
      for (const [x, y] of [[-0.62, -0.2], [-0.22, -0.62], [0.22, -0.62], [0.62, -0.2]]) {
        ctx.moveTo(x! * r + r * 0.25, y! * r);
        ctx.arc(x! * r, y! * r, r * 0.25, 0, Math.PI * 2);
      }
      break;
    case "fish":
      ctx.moveTo(-r, 0);
      ctx.quadraticCurveTo(-r * 0.2, -r * 0.9, r * 0.5, 0);
      ctx.quadraticCurveTo(-r * 0.2, r * 0.9, -r, 0);
      ctx.moveTo(r * 0.45, 0);
      ctx.lineTo(r, -r * 0.5);
      ctx.lineTo(r, r * 0.5);
      ctx.closePath();
      break;
    case "moon":
      ctx.arc(0, 0, r, Math.PI * 0.2, Math.PI * 1.8);
      ctx.arc(r * 0.45, 0, r * 0.75, Math.PI * 1.6, Math.PI * 0.4, true);
      ctx.closePath();
      break;
    case "flower":
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(Math.cos(a) * r * 0.55 + r * 0.42, Math.sin(a) * r * 0.55);
        ctx.arc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.42, 0, Math.PI * 2);
      }
      break;
    case "bolt":
      ctx.moveTo(-r * 0.2, -r);
      ctx.lineTo(r * 0.45, -r);
      ctx.lineTo(r * 0.05, -r * 0.15);
      ctx.lineTo(r * 0.5, -r * 0.15);
      ctx.lineTo(-r * 0.35, r);
      ctx.lineTo(-r * 0.05, r * 0.2);
      ctx.lineTo(-r * 0.5, r * 0.2);
      ctx.closePath();
      break;
    case "initial":
      ctx.font = `700 ${r * 1.6}px Georgia, serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((text ?? "").slice(0, 2), 0, 0);
      return;
  }
  ctx.fill();
}
export function drawStamp(ctx: Ctx, stamp: KittyStampV1, size: number) {
  const anchor = KITTY_ANCHOR_UV[stamp.anchor];
  const p = px(anchor.u, anchor.v, size);
  const r = stamp.size * size * 0.5;
  for (const offset of [0, size, -size]) {
    ctx.save();
    ctx.translate(p.x + offset, p.y);
    ctx.rotate((stamp.rotation * Math.PI) / 180);
    ctx.fillStyle = stamp.color;
    stampPath(ctx, stamp.kind, r, stamp.text);
    ctx.restore();
  }
}
/** Full replay of one part's underglaze into `layer`. */
export function replayPart(layer: HTMLCanvasElement, paint: KittyPaintV1, part: KittyPart) {
  const size = layer.width;
  const ctx = layer.getContext("2d")!;
  const dip = partDip(paint, part);
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.fillStyle = dip;
  ctx.fillRect(0, 0, size, size);
  ctx.restore();
  for (const stroke of paint.strokes) {
    const last = stroke.pts.length / 2 - 1;
    if (stroke.part === part) strokeSegment(ctx, stroke, dip, size, 0, last);
    if (stroke.mirror) {
      const mirrored: KittyStrokeV1 = { ...stroke, part: mirrorPart(stroke.part), pts: stroke.pts.map((n, i) => (i % 2 ? n : mirrorU(n))) };
      if (mirrored.part === part) strokeSegment(ctx, mirrored, dip, size, 0, last);
    }
  }
  for (const stamp of paint.stamps) if (KITTY_ANCHOR_UV[stamp.anchor].part === part) drawStamp(ctx, stamp, size);
}
/** Draw only the newest segment(s) of an in-progress stroke. Returns the dirty rect. */
export function appendStroke(layer: HTMLCanvasElement, paint: KittyPaintV1, part: KittyPart, stroke: KittyStrokeV1, fromIndex: number) {
  const size = layer.width;
  const ctx = layer.getContext("2d")!;
  const dip = partDip(paint, part);
  const last = stroke.pts.length / 2 - 1;
  const from = Math.max(0, Math.min(fromIndex, last));
  const rects: Array<{ x: number; y: number; w: number; h: number }> = [];
  const draw = (s: KittyStrokeV1) => {
    strokeSegment(ctx, s, dip, size, from, last);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = from; i <= last; i++) {
      const p = px(s.pts[i * 2]!, s.pts[i * 2 + 1]!, size);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    const pad = (s.size * size) / 512 + 2;
    rects.push({ x: minX - pad, y: minY - pad, w: maxX - minX + pad * 2, h: maxY - minY + pad * 2 });
  };
  if (stroke.part === part) draw(stroke);
  if (stroke.mirror) {
    const mirrored: KittyStrokeV1 = { ...stroke, part: mirrorPart(stroke.part), pts: stroke.pts.map((n, i) => (i % 2 ? n : mirrorU(n))) };
    if (mirrored.part === part) draw(mirrored);
  }
  return rects;
}
/** Copy layer → display; unfired clay gets the chalky bisque lift. */
export function presentPart(layer: HTMLCanvasElement, display: HTMLCanvasElement, fired: boolean, rect?: { x: number; y: number; w: number; h: number }) {
  const size = layer.width;
  const ctx = display.getContext("2d", { willReadFrequently: true })!;
  const x = Math.max(0, Math.floor(rect?.x ?? 0)), y = Math.max(0, Math.floor(rect?.y ?? 0));
  const w = Math.min(size - x, Math.ceil(rect?.w ?? size)), h = Math.min(size - y, Math.ceil(rect?.h ?? size));
  if (w <= 0 || h <= 0) return;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.clearRect(x, y, w, h);
  ctx.drawImage(layer, x, y, w, h, x, y, w, h);
  ctx.restore();
  if (fired) return;
  const image = ctx.getImageData(x, y, w, h), data = image.data;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const dr = r + 0.25 * (gray - r), dg = g + 0.25 * (gray - g), db = b + 0.25 * (gray - b);
    data[i] = dr + 0.35 * (BISQUE.r - dr);
    data[i + 1] = dg + 0.35 * (BISQUE.g - dg);
    data[i + 2] = db + 0.35 * (BISQUE.b - db);
  }
  ctx.putImageData(image, x, y);
}
/** Same lift for flat/CSS previews: hex → bisque hex. */
export function bisqueHex(hex: string): string {
  const h = studioHex(hex);
  const n = parseInt(h.slice(1), 16);
  if (!Number.isFinite(n) || h.length !== 7) return h;
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  const lift = (c: number, t: number) => {
    const d = c + 0.25 * (gray - c);
    return Math.round(d + 0.35 * (t - d));
  };
  return "#" + [lift(r, BISQUE.r), lift(g, BISQUE.g), lift(b, BISQUE.b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}
