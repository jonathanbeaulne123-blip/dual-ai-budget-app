/**
 * Stamp and add-on artwork (2026-09-12), authored once.
 *
 * Every piece is a list of sub-paths in a −1..1 box with y pointing down, so
 * the same data draws into the 3D part canvases (`new Path2D(d)`) and into the
 * flat SVG (`<path d>`). One shape, one look, wherever the kitty is shown.
 *
 * Roles pick the colour: `body` is the chosen glaze, `trim` its partner colour,
 * `ink` and `white` are the fixed studio inks. Cosmetic only; no money here.
 */
import type { KittyAnchor, KittyPart, KittyStampKind, KittyStampV1 } from "../../core/types.ts";
import { KITTY_ANCHOR_UV } from "./anchors.ts";
import { STAMP_FALLBACK, STAMP_INK, STAMP_WHITE } from "./palette.ts";

export type StampRole = "body" | "trim" | "ink" | "white";
export type StampPiece = { d: string; role: StampRole; stroke?: number };

const round = (n: number) => Math.round(n * 1000) / 1000;
const circle = (cx: number, cy: number, r: number) => `M${round(cx - r)} ${round(cy)}a${round(r)} ${round(r)} 0 1 0 ${round(r * 2)} 0a${round(r)} ${round(r)} 0 1 0 ${round(-r * 2)} 0Z`;
const poly = (points: Array<[number, number]>) => `M${points.map(([x, y]) => `${round(x)} ${round(y)}`).join("L")}Z`;
const star = () => poly(Array.from({ length: 10 }, (_, i) => {
  const a = (i * Math.PI) / 5 - Math.PI / 2, r = i % 2 ? 0.45 : 1;
  return [Math.cos(a) * r, Math.sin(a) * r] as [number, number];
}));

/** Every kind except `initial`, which draws its letters instead of a path. */
export const STAMP_ART: Record<Exclude<KittyStampKind, "initial">, StampPiece[]> = {
  heart: [{ d: "M0 0.8C-1.4 -0.2 -0.6 -1.1 0 -0.35C0.6 -1.1 1.4 -0.2 0 0.8Z", role: "body" }],
  star: [{ d: star(), role: "body" }],
  paw: [
    { d: "M0 0.3a0.6 0.5 0 1 0 0.001 0Z", role: "body" },
    { d: [circle(-0.62, -0.2, 0.25), circle(-0.22, -0.62, 0.25), circle(0.22, -0.62, 0.25), circle(0.62, -0.2, 0.25)].join(""), role: "body" },
  ],
  fish: [
    { d: "M-1 0Q-0.2 -0.9 0.5 0Q-0.2 0.9 -1 0Z", role: "body" },
    { d: poly([[0.45, 0], [1, -0.5], [1, 0.5]]), role: "body" },
    { d: circle(-0.45, -0.16, 0.1), role: "white" },
  ],
  moon: [{ d: "M0.31 0.95A1 1 0 1 1 0.31 -0.95A0.75 0.75 0 1 0 0.31 0.95Z", role: "body" }],
  flower: [
    { d: Array.from({ length: 6 }, (_, i) => circle(Math.cos((i * Math.PI) / 3) * 0.55, Math.sin((i * Math.PI) / 3) * 0.55, 0.42)).join(""), role: "body" },
    { d: circle(0, 0, 0.3), role: "trim" },
  ],
  bolt: [{ d: poly([[-0.2, -1], [0.45, -1], [0.05, -0.15], [0.5, -0.15], [-0.35, 1], [-0.05, 0.2], [-0.5, 0.2]]), role: "body" }],

  // ---- bake-on add-ons ----
  "party-hat": [
    { d: poly([[0, -1], [0.62, 0.62], [-0.62, 0.62]]), role: "body" },
    { d: "M-0.34 -0.06L0.2 -0.3M-0.52 0.4L0.44 0.02", role: "trim", stroke: 0.14 },
    { d: circle(0, -1.02, 0.19), role: "trim" },
  ],
  "sun-hat": [
    { d: "M-1 0.34a1 0.28 0 1 0 2 0a1 0.28 0 1 0 -2 0Z", role: "body" },
    { d: "M-0.52 0.3C-0.52 -0.62 0.52 -0.62 0.52 0.3Z", role: "body" },
    { d: "M-0.53 0.14C-0.2 0.32 0.2 0.32 0.53 0.14L0.5 -0.08C0.18 0.12 -0.18 0.12 -0.5 -0.08Z", role: "trim" },
  ],
  beanie: [
    { d: "M-0.78 0.3C-0.78 -0.78 0.78 -0.78 0.78 0.3Z", role: "body" },
    { d: "M-0.86 0.28h1.72v0.4h-1.72Z", role: "trim" },
    { d: circle(0, -0.78, 0.22), role: "trim" },
  ],
  crown: [
    { d: poly([[-0.9, 0.55], [-0.9, -0.5], [-0.45, -0.05], [0, -0.75], [0.45, -0.05], [0.9, -0.5], [0.9, 0.55]]), role: "body" },
    { d: `${circle(-0.45, 0.22, 0.14)}${circle(0.45, 0.22, 0.14)}${circle(0, 0.22, 0.17)}`, role: "trim" },
  ],
  glasses: [
    { d: `${circle(-0.52, 0, 0.42)}${circle(0.52, 0, 0.42)}`, role: "trim" },
    { d: "M-0.94 0a0.42 0.42 0 1 1 0.84 0a0.42 0.42 0 1 1 -0.84 0M0.1 0a0.42 0.42 0 1 1 0.84 0a0.42 0.42 0 1 1 -0.84 0M-0.1 -0.06h0.2M-0.94 -0.1L-1.25 -0.28M0.94 -0.1L1.25 -0.28", role: "body", stroke: 0.11 },
  ],
  sunglasses: [
    { d: "M-1 -0.26h2v0.2h-2Z", role: "body" },
    { d: "M-0.96 -0.1h0.8c0 0.55 -0.8 0.62 -0.8 0ZM0.16 -0.1h0.8c0 0.62 -0.8 0.55 -0.8 0Z", role: "trim" },
    { d: "M-0.16 -0.04h0.32", role: "body", stroke: 0.1 },
  ],
  bowtie: [
    { d: poly([[-0.9, -0.5], [-0.16, 0], [-0.9, 0.5]]), role: "body" },
    { d: poly([[0.9, -0.5], [0.16, 0], [0.9, 0.5]]), role: "body" },
    { d: "M-0.2 -0.26h0.4v0.52h-0.4Z", role: "trim" },
  ],
  scarf: [
    { d: "M-1 -0.3C-0.4 0.1 0.4 0.1 1 -0.3L1 0.1C0.4 0.5 -0.4 0.5 -1 0.1Z", role: "body" },
    { d: "M0.42 0.24L0.86 0.98L0.4 1.02L0.16 0.36Z", role: "trim" },
  ],
  purse: [
    { d: "M-0.72 -0.1h1.44l0.16 0.98h-1.76Z", role: "body" },
    { d: "M-0.42 -0.1C-0.42 -0.92 0.42 -0.92 0.42 -0.1", role: "trim", stroke: 0.13 },
    { d: "M-0.16 0.16h0.32v0.26h-0.32Z", role: "trim" },
  ],
  suitcase: [
    { d: "M-0.92 -0.32h1.84v1.16h-1.84Z", role: "body" },
    { d: "M-0.3 -0.32C-0.3 -0.86 0.3 -0.86 0.3 -0.32", role: "trim", stroke: 0.12 },
    { d: "M-0.5 -0.32v1.16M0.5 -0.32v1.16", role: "trim", stroke: 0.14 },
  ],
  camera: [
    { d: "M-0.94 -0.36h1.88v1.1h-1.88Z", role: "body" },
    { d: "M-0.44 -0.36l0.16 -0.3h0.56l0.16 0.3Z", role: "body" },
    { d: circle(0, 0.2, 0.36), role: "trim" },
    { d: circle(0, 0.2, 0.16), role: "white" },
  ],
  palm: [
    { d: "M-0.06 1L0.1 -0.2h0.18L0.16 1Z", role: "trim" },
    { d: "M0.12 -0.28C-0.3 -0.72 -0.8 -0.6 -0.98 -0.2C-0.6 -0.5 -0.3 -0.46 0.06 -0.14ZM0.12 -0.3C0.5 -0.78 1 -0.66 1.02 -0.24C0.66 -0.52 0.4 -0.48 0.18 -0.16ZM0.12 -0.32C0.2 -0.86 -0.1 -1.06 -0.5 -0.98C-0.12 -0.84 0 -0.6 0.04 -0.22Z", role: "body" },
  ],
  shell: [
    { d: "M0 0.8C-0.9 0.8 -1 -0.3 0 -0.9C1 -0.3 0.9 0.8 0 0.8Z", role: "body" },
    { d: "M0 -0.7v1.4M-0.42 -0.5L-0.58 0.6M0.42 -0.5L0.58 0.6", role: "trim", stroke: 0.08 },
  ],
  ticket: [
    { d: "M-1 -0.5h2v0.3a0.2 0.2 0 0 0 0 0.4v0.3h-2v-0.3a0.2 0.2 0 0 0 0 -0.4Z", role: "body" },
    { d: "M-0.6 -0.22v0.44M-0.28 -0.22v0.44", role: "trim", stroke: 0.09 },
  ],
  balloon: [
    { d: "M0 0.5C-0.62 0.14 -0.62 -0.9 0 -0.9C0.62 -0.9 0.62 0.14 0 0.5Z", role: "body" },
    { d: poly([[-0.12, 0.44], [0.12, 0.44], [0, 0.66]]), role: "trim" },
    { d: "M0 0.66C0.24 0.86 -0.2 1 0.02 1.2", role: "trim", stroke: 0.07 },
  ],
  sun: [
    { d: circle(0, 0, 0.52), role: "body" },
    { d: Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return `M${round(Math.cos(a) * 0.68)} ${round(Math.sin(a) * 0.68)}L${round(Math.cos(a) * 0.98)} ${round(Math.sin(a) * 0.98)}`;
    }).join(""), role: "trim", stroke: 0.12 },
  ],
  cloud: [
    { d: `${circle(-0.42, 0.1, 0.38)}${circle(0.12, -0.1, 0.5)}${circle(0.58, 0.14, 0.34)}M-0.42 0.1h1v0.38h-1Z`, role: "body" },
  ],
  key: [
    { d: circle(-0.46, -0.1, 0.42), role: "body" },
    { d: circle(-0.46, -0.1, 0.16), role: "trim" },
    { d: "M-0.06 -0.22h1.02v0.24h-1.02ZM0.62 0.02h0.14v0.34h-0.14ZM0.88 0.02h0.14v0.28h-0.14Z", role: "body" },
  ],
  leaf: [
    { d: "M0 -1C0.86 -0.46 0.86 0.6 0 1C-0.86 0.6 -0.86 -0.46 0 -1Z", role: "body" },
    { d: "M0 -0.86v1.8M0 -0.3L-0.42 -0.02M0 0.1L0.42 0.38", role: "trim", stroke: 0.08 },
  ],
  cupcake: [
    { d: "M-0.7 0.1h1.4l-0.22 0.9h-0.96Z", role: "trim" },
    { d: "M-0.72 0.1C-0.72 -0.72 0.72 -0.72 0.72 0.1Z", role: "body" },
    { d: circle(0, -0.72, 0.18), role: "trim" },
  ],
};

/** Where a stamp actually sits: its own uv when it has one, else its anchor's. */
export function stampPlacement(stamp: KittyStampV1): { part: KittyPart; u: number; v: number } {
  if (stamp.part && typeof stamp.u === "number" && typeof stamp.v === "number") return { part: stamp.part, u: stamp.u, v: stamp.v };
  const anchor = KITTY_ANCHOR_UV[stamp.anchor];
  return { part: anchor.part, u: anchor.u, v: anchor.v };
}
/** Nearest named anchor to a uv on a part — kept on every stamp for older readers and for the spoken label. */
export function nearestKittyAnchor(part: KittyPart, u: number, v: number): KittyAnchor {
  let best: KittyAnchor = "chest", score = Infinity;
  for (const [name, spot] of Object.entries(KITTY_ANCHOR_UV) as Array<[KittyAnchor, { part: KittyPart; u: number; v: number }]>) {
    if (spot.part !== part) continue;
    const d = Math.hypot(spot.u - u, spot.v - v);
    if (d < score) { score = d; best = name; }
  }
  if (score === Infinity) return part === "head" ? "forehead" : part === "tail" ? "tailTip" : "chest";
  return best;
}
const HEX = /^#[0-9a-f]{6}$/;
/** Partner colour for an add-on: a deeper or lighter relative of the glaze, so two-tone pieces read without a second picker. */
export function stampTrim(stamp: { color: string; trim?: string }): string {
  if (stamp.trim && HEX.test(stamp.trim)) return stamp.trim;
  const hex = HEX.test(stamp.color) ? stamp.color : STAMP_FALLBACK;
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const light = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  const mix = light > 0.55 ? -0.42 : 0.5;
  const shift = (c: number) => Math.round(mix < 0 ? c * (1 + mix) : c + (255 - c) * mix);
  return "#" + [shift(r), shift(g), shift(b)].map((c) => c.toString(16).padStart(2, "0")).join("");
}
export { STAMP_INK, STAMP_WHITE };
export function stampRoleColor(role: StampRole, stamp: { color: string; trim?: string }): string {
  return role === "body" ? stamp.color : role === "trim" ? stampTrim(stamp) : role === "white" ? STAMP_WHITE : STAMP_INK;
}
