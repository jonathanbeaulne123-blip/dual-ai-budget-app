import * as THREE from "three";
import { queenGlazeFor, type QueenGlaze } from "../../core/queenPresentation.ts";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";

/**
 * Engraved stone plates: the only textures in the Court. Letters are carved
 * (dark inset, a light bevel below-right), the stone carries a faint grain, and
 * the finish dulls when the books are stale so a frozen number never looks
 * freshly cut.
 */
export type PlateFinish = QueenGlaze; // "glazed" | "matte" | "offline"

export type EngravedOptions = {
  /** Canvas width in pixels; height follows the line count. Default 512. */
  width?: number;
  finish?: PlateFinish;
  /** Stone face and letter colours (from the court dressing). */
  stone?: string;
  highlight?: string;
  ink?: string;
  /** Paper plates (the slip) use a softer face, no bevel. */
  paper?: boolean;
  /** Letter scale: "large" for the one big number, "small" for tags. */
  size?: "large" | "medium" | "small";
  align?: "left" | "center";
  /**
   * Draw the canvas to this width ÷ height and shrink the letters until every
   * line fits inside it (W5 #1). A number or a tag is a few glyphs and the
   * default box is drawn around them; a **door sign** is a line of words on a
   * board of a fixed shape, and its letters have to come down to the board
   * rather than the board stretch around them. `EngravedPlate` passes the
   * mesh's own aspect here when its options say `fit`.
   */
  aspect?: number;
  /** The plate is a board of a fixed shape: `EngravedPlate` draws it to the mesh's aspect and fits the words to it. */
  fit?: boolean;
};

/** "$1,240" for cents; "—" for unknown. Zero cents IS "$0"; only `null` is unknown. */
export function engravedWords(cents: number | null): string {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const dollars = Math.trunc(Math.abs(cents) / 100);
  const digits = String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${cents < 0 && dollars > 0 ? "−" : ""}$${digits}`;
}

/** Matte when stale, dulled when offline — the same rule as the Queen's glaze. */
export function plateFinish(freshness: FundPulseFreshness): PlateFinish {
  return queenGlazeFor(freshness);
}

/** Small deterministic PRNG so the grain is stable between re-engravings. */
export function seeded(seed: number): () => number {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function textSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

function withAlpha(hex: string, alpha: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

const FONT_SIZE = { large: 0.56, medium: 0.34, small: 0.24 } as const;

/** Splits text into at most `max` lines; each line is trimmed and never empty. */
export function plateLines(text: string, max = 3): string[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, max);
  return lines.length ? lines : ["—"];
}

/**
 * Draws the plate and returns an sRGB CanvasTexture (`play/room.ts:61` pattern).
 * Without a 2D context (jsdom, a starved tab) the texture is a blank stone so the
 * scene still builds; the DOM twin carries the words.
 */
export function engravedPlate(text: string, options: EngravedOptions = {}): THREE.CanvasTexture {
  const width = Math.max(64, Math.round(options.width ?? 512));
  const lines = plateLines(text);
  const size = options.size ?? (lines.length > 1 ? "small" : "medium");
  const pad = Math.round(width * 0.08);
  // A board of a fixed shape keeps its shape and the letters come down to it;
  // everything else keeps slice 1's box, drawn around the letters.
  const fitted = Number.isFinite(options.aspect) && (options.aspect ?? 0) > 0;
  const lineHeight = fitted
    ? Math.max(8, Math.floor((Math.max(64, Math.round(width / options.aspect!)) - pad * 2) / lines.length))
    : Math.round(width * FONT_SIZE[size] * 0.72);
  const height = fitted ? Math.max(64, Math.round(width / options.aspect!)) : Math.max(64, lines.length * lineHeight + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.userData = { text, aspect: width / height, finish: options.finish ?? "glazed" };
  const ctx = canvas.getContext("2d");
  if (!ctx) return texture;
  const stone = options.stone ?? (options.paper ? "#fffaf1" : "#d9c8a6");
  const highlight = options.highlight ?? (options.paper ? "#ffffff" : "#efe3c9");
  const ink = options.ink ?? "#30251f";
  const finish = options.finish ?? "glazed";
  // Face.
  ctx.fillStyle = stone;
  ctx.fillRect(0, 0, width, height);
  if (!options.paper) {
    // Faint grain: stable speckle per text so re-engraving the same words is a no-op visually.
    const rand = seeded(textSeed(text) ^ width);
    const count = Math.round((width * height) / 260);
    for (let i = 0; i < count; i++) {
      const x = rand() * width, y = rand() * height, r = 0.6 + rand() * 1.4;
      ctx.fillStyle = withAlpha(rand() > 0.5 ? highlight : ink, 0.045 + rand() * 0.05);
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // A soft chamfer around the edge.
    ctx.strokeStyle = withAlpha(highlight, 0.55); ctx.lineWidth = Math.max(2, width * 0.012);
    ctx.strokeRect(ctx.lineWidth / 2, ctx.lineWidth / 2, width - ctx.lineWidth, height - ctx.lineWidth);
    ctx.strokeStyle = withAlpha(ink, 0.22);
    ctx.strokeRect(ctx.lineWidth * 1.5, ctx.lineWidth * 1.5, width - ctx.lineWidth * 3, height - ctx.lineWidth * 3);
  } else {
    // Paper: a ruled edge and a pin shadow.
    ctx.strokeStyle = withAlpha(ink, 0.18); ctx.lineWidth = Math.max(1, width * 0.006);
    ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, width - ctx.lineWidth * 2, height - ctx.lineWidth * 2);
  }
  // Letters.
  const family = options.paper ? '"Caveat", "Fraunces", Georgia, serif' : '"Fraunces", Georgia, serif';
  const weight = options.paper ? 500 : 600;
  let px = Math.round(width * FONT_SIZE[size] * 0.6);
  if (fitted) {
    // Down to the line's height first, then down again until the longest line
    // fits the board's width — so a sign is never carved off its own edge.
    px = Math.max(8, Math.min(px, Math.floor(lineHeight * 0.72)));
    ctx.font = `${weight} ${px}px ${family}`;
    const widest = lines.reduce((wide, line) => Math.max(wide, ctx.measureText(line).width), 0);
    const room = width - pad * 2;
    if (widest > room && room > 0) px = Math.max(8, Math.floor(px * (room / widest)));
  }
  ctx.font = `${weight} ${px}px ${family}`;
  ctx.textBaseline = "middle";
  ctx.textAlign = options.align ?? "center";
  const x = (options.align ?? "center") === "left" ? pad : width / 2;
  const maxWidth = width - pad * 2;
  const bevel = Math.max(1, Math.round(px * 0.045));
  lines.forEach((line, index) => {
    const y = pad + lineHeight * index + lineHeight / 2;
    if (!options.paper) {
      // Carved: light bevel below-right, dark inset letters on top.
      ctx.fillStyle = withAlpha(highlight, 0.9);
      ctx.fillText(line, x + bevel, y + bevel, maxWidth);
      ctx.fillStyle = withAlpha("#000000", 0.28);
      ctx.fillText(line, x - bevel * 0.5, y - bevel * 0.5, maxWidth);
    }
    ctx.fillStyle = ink;
    ctx.fillText(line, x, y, maxWidth);
  });
  // Finish: matte dulls, offline greys.
  if (finish === "matte") { ctx.fillStyle = "rgba(120,110,100,0.16)"; ctx.fillRect(0, 0, width, height); }
  if (finish === "offline") { ctx.fillStyle = "rgba(90,90,96,0.30)"; ctx.fillRect(0, 0, width, height); }
  texture.needsUpdate = true;
  return texture;
}

/** Material for a plate face: unlit-ish standard material so the letters read under any rig. */
export function plateMaterial(texture: THREE.CanvasTexture, finish: PlateFinish = "glazed"): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ map: texture, roughness: finish === "glazed" ? 0.55 : 0.92, metalness: 0 });
}

/**
 * A plate mesh that re-engraves itself only when its words or finish change.
 * `width`/`height` are world units; the canvas aspect follows the mesh.
 */
export class EngravedPlate {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private texture: THREE.CanvasTexture | null = null;
  private key = "";
  constructor(private readonly base: EngravedOptions, width: number, height: number) {
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshStandardMaterial({ color: base.stone ?? "#d9c8a6", roughness: 0.6 }));
    this.mesh.userData.plate = true;
  }
  set(text: string, finish: PlateFinish = "glazed"): boolean {
    const key = `${finish}|${text}`;
    if (key === this.key) return false;
    this.key = key;
    const aspect = this.mesh.geometry.parameters.width / this.mesh.geometry.parameters.height;
    const width = this.base.width ?? 512;
    const lines = plateLines(text).length;
    const size = this.base.size ?? (lines > 1 ? "small" : "medium");
    // A board of a fixed shape (a door sign): the canvas takes the board's own
    // aspect and the letters are fitted to it.
    if (this.base.fit) {
      const board = engravedPlate(text, { ...this.base, size, finish, width, aspect });
      this.texture?.dispose();
      this.texture = board;
      this.mesh.material.map = board;
      this.mesh.material.color.set("#ffffff");
      this.mesh.material.roughness = finish === "glazed" ? 0.55 : 0.92;
      this.mesh.material.needsUpdate = true;
      return true;
    }
    // Pick a canvas width whose natural height matches the plate's aspect (avoids stretching letters).
    const naturalHeight = lines * Math.round(width * FONT_SIZE[size] * 0.72) + Math.round(width * 0.08) * 2;
    const drawWidth = Math.round(Math.max(64, Math.min(1024, naturalHeight * aspect)));
    const next = engravedPlate(text, { ...this.base, size, finish, width: drawWidth });
    this.texture?.dispose();
    this.texture = next;
    this.mesh.material.map = next;
    this.mesh.material.color.set("#ffffff");
    this.mesh.material.roughness = finish === "glazed" ? 0.55 : 0.92;
    this.mesh.material.needsUpdate = true;
    return true;
  }
  get words(): string { return this.key.slice(this.key.indexOf("|") + 1); }
  dispose(): void { this.texture?.dispose(); this.mesh.material.dispose(); this.mesh.geometry.dispose(); }
}
