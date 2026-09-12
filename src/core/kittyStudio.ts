/**
 * Kitty Bank Studio pieces (2026-09-11): sculpt, paint and fire a ceramic cat.
 *
 * Cosmetic only. Nothing here reads or writes money. Studio data rides inside
 * `goal.envelope.studio` so it follows the goal's sync scope exactly like `glaze`:
 * a shared bank's design is shared with the household; a personal bank's stays
 * with its owner. Validation is strict and throws the existing "compatible
 * envelope reader" error so an unknown future shape never loads silently.
 */
import { ValidationError, type KittyFeature, type KittyGlaze, type KittyPaintV1, type KittyPart, type KittyPieceV1, type KittySculptV1, type KittyStampV1, type KittyStrokeV1, type KittyStudioV1 } from "./types.ts";

export const KITTY_BODIES = ["round", "pear", "loaf", "tall", "bean"] as const;
export const KITTY_HEADS = ["round", "wedge", "chubby", "heart"] as const;
export const KITTY_EARS = ["pointed", "round", "folded", "tufted", "none"] as const;
export const KITTY_EYES = ["open", "happy", "wide", "sleepy", "sparkle", "wink", "closed"] as const;
export const KITTY_MOUTHS = ["smile", "w", "tongue", "grin", "serene", "oh"] as const;
export const KITTY_WHISKERS = ["short", "long", "curly", "none"] as const;
export const KITTY_TAILS = ["curl", "up", "wrap", "none"] as const;
export const KITTY_NOSES = ["button", "heart", "tiny"] as const;
export const KITTY_PARTS = ["body", "head", "earL", "earR", "tail", "paws"] as const;
export const KITTY_ANCHORS = ["forehead", "leftCheek", "rightCheek", "chin", "chest", "belly", "back", "leftFlank", "rightFlank", "rump", "leftEar", "rightEar", "tailTip"] as const;
export const KITTY_STAMP_KINDS = [
  "heart", "star", "paw", "fish", "moon", "flower", "bolt", "initial",
  "party-hat", "sun-hat", "beanie", "crown", "glasses", "sunglasses", "bowtie", "scarf",
  "purse", "suitcase", "camera", "palm", "shell", "ticket", "balloon", "sun", "cloud", "key", "leaf", "cupcake",
] as const;
/** Add-ons wear their shape rather than a flat silhouette: they get a trim colour and a suggested home. */
export const KITTY_ADDON_KINDS = ["party-hat", "sun-hat", "beanie", "crown", "glasses", "sunglasses", "bowtie", "scarf", "purse", "suitcase", "camera", "palm", "shell", "ticket", "balloon", "sun", "cloud", "key", "leaf", "cupcake"] as const;
export const KITTY_FEATURES = ["head", "ears", "eyes", "nose", "mouth", "whiskers", "tail"] as const;
export const KITTY_TOOLS = ["brush", "marker", "sponge", "eraser"] as const;

export const KITTY_STUDIO_LIMITS = {
  strokes: 400,
  points: 6000,
  stamps: 64,
  fired: 6,
  bytes: 64 * 1024,
  profileMin: 0.55,
  profileMax: 1.15,
  featureMin: 0.5,
  featureMax: 1.8,
  strokeSize: [1, 96] as const,
  stampSize: [0.04, 0.75] as const,
} as const;

const GLAZE_NAMES: readonly string[] = ["cream", "sea-glass", "terracotta", "midnight", "rose"];
const HEX = /^#[0-9a-f]{6}$/;
const bad = () => new ValidationError("This Kitty Bank needs a compatible envelope reader. Reload Hearth.");
const oneOf = <T extends readonly string[]>(list: T, value: unknown): value is T[number] => typeof value === "string" && list.includes(value);
const isIso = (value: unknown) => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const q3 = (n: number) => Math.round(n * 1000) / 1000;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** A feature dial as a number: 1 unless the piece says otherwise. */
export const kittyFeature = (sculpt: KittySculptV1, feature: KittyFeature): number => {
  const value = sculpt.features?.[feature];
  return typeof value === "number" && Number.isFinite(value) ? clamp(value, KITTY_STUDIO_LIMITS.featureMin, KITTY_STUDIO_LIMITS.featureMax) : 1;
};
export const withKittyFeature = (sculpt: KittySculptV1, feature: KittyFeature, value: number): KittySculptV1 => {
  const next = { ...(sculpt.features ?? {}), [feature]: Math.round(clamp(value, KITTY_STUDIO_LIMITS.featureMin, KITTY_STUDIO_LIMITS.featureMax) * 100) / 100 };
  for (const key of KITTY_FEATURES) if (next[key] === 1) delete next[key];
  return Object.keys(next).length ? { ...sculpt, features: next } : (({ features: _drop, ...rest }) => rest as KittySculptV1)(sculpt);
};
export const isKittyAddon = (kind: string): boolean => (KITTY_ADDON_KINDS as readonly string[]).includes(kind);

export const defaultKittySculpt = (): KittySculptV1 => ({
  body: "round",
  profile: [1, 0.92, 0.82, 0.6],
  head: "round",
  ears: "pointed",
  eyes: "open",
  mouth: "w",
  whiskers: "short",
  tail: "curl",
  nose: "button",
});
export const defaultKittyPaint = (base: KittyGlaze | string = "cream"): KittyPaintV1 => ({ base, parts: {}, strokes: [], stamps: [] });
export const newKittyPiece = (id: string, createdAt: string, base: KittyGlaze | string = "cream"): KittyPieceV1 => ({
  id,
  createdAt,
  firedAt: null,
  sculpt: defaultKittySculpt(),
  paint: defaultKittyPaint(base),
});
export const emptyKittyStudio = (): KittyStudioV1 => ({ version: 1, draft: null, fired: [] });

/** Colour that legacy readers (shelf seals, `.kitty-seal`) can use: a glaze name when the base is one of the five, else undefined. */
export function kittyGlazeForBase(base: string): KittyGlaze | undefined {
  return GLAZE_NAMES.includes(base) ? (base as KittyGlaze) : undefined;
}
export function isKittyColor(value: unknown): value is string {
  return typeof value === "string" && (HEX.test(value) || GLAZE_NAMES.includes(value));
}

export function shapeKittySculpt(value: unknown): KittySculptV1 {
  const row = value as KittySculptV1;
  if (
    !row || typeof row !== "object" ||
    !oneOf(KITTY_BODIES, row.body) || !oneOf(KITTY_HEADS, row.head) || !oneOf(KITTY_EARS, row.ears) ||
    !oneOf(KITTY_EYES, row.eyes) || !oneOf(KITTY_MOUTHS, row.mouth) || !oneOf(KITTY_WHISKERS, row.whiskers) ||
    !oneOf(KITTY_TAILS, row.tail) || !oneOf(KITTY_NOSES, row.nose) ||
    !Array.isArray(row.profile) || row.profile.length !== 4 ||
    row.profile.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < KITTY_STUDIO_LIMITS.profileMin || n > KITTY_STUDIO_LIMITS.profileMax)
  ) throw bad();
  let features: Partial<Record<KittyFeature, number>> | undefined;
  if (row.features !== undefined) {
    if (!row.features || typeof row.features !== "object" || Array.isArray(row.features)) throw bad();
    const dials: Partial<Record<KittyFeature, number>> = {};
    for (const [key, value] of Object.entries(row.features)) {
      if (!oneOf(KITTY_FEATURES, key) || typeof value !== "number" || !Number.isFinite(value) || value < KITTY_STUDIO_LIMITS.featureMin || value > KITTY_STUDIO_LIMITS.featureMax) throw bad();
      if (value !== 1) dials[key] = Math.round(value * 100) / 100;
    }
    if (Object.keys(dials).length) features = dials;
  }
  return {
    body: row.body,
    profile: row.profile.map(q3) as KittySculptV1["profile"],
    head: row.head,
    ears: row.ears,
    eyes: row.eyes,
    mouth: row.mouth,
    whiskers: row.whiskers,
    tail: row.tail,
    nose: row.nose,
    ...(features ? { features } : {}),
  };
}
function shapeStroke(value: unknown): KittyStrokeV1 {
  const row = value as KittyStrokeV1;
  if (
    !row || typeof row !== "object" || !oneOf(KITTY_PARTS, row.part) || !oneOf(KITTY_TOOLS, row.tool) ||
    typeof row.color !== "string" || !HEX.test(row.color) ||
    typeof row.size !== "number" || !Number.isFinite(row.size) || row.size < KITTY_STUDIO_LIMITS.strokeSize[0] || row.size > KITTY_STUDIO_LIMITS.strokeSize[1] ||
    typeof row.opacity !== "number" || !Number.isFinite(row.opacity) || row.opacity < 0 || row.opacity > 1 ||
    typeof row.mirror !== "boolean" ||
    !Array.isArray(row.pts) || row.pts.length < 2 || row.pts.length % 2 !== 0 ||
    row.pts.some((n) => typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > 1)
  ) throw bad();
  return {
    part: row.part,
    tool: row.tool,
    color: row.color,
    size: Math.round(row.size * 10) / 10,
    opacity: Math.round(row.opacity * 100) / 100,
    mirror: row.mirror,
    pts: row.pts.map(q3),
  };
}
function shapeStamp(value: unknown, seen: Set<string>): KittyStampV1 {
  const row = value as KittyStampV1;
  if (
    !row || typeof row !== "object" || typeof row.id !== "string" || !row.id || row.id.length > 40 || seen.has(row.id) ||
    !oneOf(KITTY_ANCHORS, row.anchor) || !oneOf(KITTY_STAMP_KINDS, row.kind) ||
    typeof row.color !== "string" || !HEX.test(row.color) ||
    (row.trim !== undefined && (typeof row.trim !== "string" || !HEX.test(row.trim))) ||
    (row.part !== undefined && !oneOf(KITTY_PARTS, row.part)) ||
    (row.u !== undefined && (typeof row.u !== "number" || !Number.isFinite(row.u) || row.u < 0 || row.u > 1)) ||
    (row.v !== undefined && (typeof row.v !== "number" || !Number.isFinite(row.v) || row.v < 0 || row.v > 1)) ||
    ((row.u === undefined) !== (row.v === undefined)) ||
    typeof row.size !== "number" || !Number.isFinite(row.size) || row.size < KITTY_STUDIO_LIMITS.stampSize[0] || row.size > KITTY_STUDIO_LIMITS.stampSize[1] ||
    typeof row.rotation !== "number" || !Number.isFinite(row.rotation) || row.rotation < -180 || row.rotation > 180 ||
    (row.text !== undefined && (typeof row.text !== "string" || row.text.length > 2 || (row.kind === "initial" && !row.text.trim()))) ||
    (row.kind === "initial" && row.text === undefined)
  ) throw bad();
  seen.add(row.id);
  return {
    id: row.id,
    anchor: row.anchor,
    ...(row.part !== undefined ? { part: row.part } : {}),
    ...(row.u !== undefined ? { u: q3(row.u), v: q3(row.v!) } : {}),
    kind: row.kind,
    color: row.color,
    ...(row.trim !== undefined ? { trim: row.trim } : {}),
    size: q3(row.size),
    rotation: Math.round(row.rotation),
    ...(row.text !== undefined ? { text: row.text } : {}),
  };
}
export function shapeKittyPaint(value: unknown): KittyPaintV1 {
  const row = value as KittyPaintV1;
  if (!row || typeof row !== "object" || !isKittyColor(row.base) || !row.parts || typeof row.parts !== "object" || Array.isArray(row.parts) || !Array.isArray(row.strokes) || !Array.isArray(row.stamps)) throw bad();
  const parts: Partial<Record<KittyPart, string>> = {};
  for (const [key, color] of Object.entries(row.parts)) {
    if (!oneOf(KITTY_PARTS, key) || typeof color !== "string" || !HEX.test(color)) throw bad();
    parts[key] = color;
  }
  if (row.strokes.length > KITTY_STUDIO_LIMITS.strokes || row.stamps.length > KITTY_STUDIO_LIMITS.stamps) throw bad();
  const strokes = row.strokes.map(shapeStroke);
  if (strokes.reduce((sum, stroke) => sum + stroke.pts.length / 2, 0) > KITTY_STUDIO_LIMITS.points) throw bad();
  const seen = new Set<string>();
  return { base: row.base, parts, strokes, stamps: row.stamps.map((stamp) => shapeStamp(stamp, seen)) };
}
export function shapeKittyPiece(value: unknown): KittyPieceV1 {
  const row = value as KittyPieceV1;
  if (
    !row || typeof row !== "object" || typeof row.id !== "string" || !row.id || row.id.length > 60 || !isIso(row.createdAt) ||
    (row.firedAt !== null && !isIso(row.firedAt)) ||
    (row.firedBy !== undefined && row.firedBy !== null && (typeof row.firedBy !== "string" || row.firedBy.length > 60)) ||
    (row.firings !== undefined && (typeof row.firings !== "number" || !Number.isInteger(row.firings) || row.firings < 1 || row.firings > 999))
  ) throw bad();
  return {
    id: row.id,
    createdAt: row.createdAt,
    firedAt: row.firedAt,
    ...(row.firedBy !== undefined ? { firedBy: row.firedBy } : {}),
    ...(row.firings !== undefined ? { firings: row.firings } : {}),
    sculpt: shapeKittySculpt(row.sculpt),
    paint: shapeKittyPaint(row.paint),
  };
}
export function shapeKittyStudio(value: unknown): KittyStudioV1 | undefined {
  if (value === undefined) return undefined;
  const row = value as KittyStudioV1;
  if (!row || typeof row !== "object" || row.version !== 1 || !Array.isArray(row.fired) || row.fired.length > KITTY_STUDIO_LIMITS.fired || (row.draft !== null && typeof row.draft !== "object")) throw bad();
  const fired = row.fired.map(shapeKittyPiece);
  if (fired.some((piece) => piece.firedAt === null)) throw bad();
  const draft = row.draft === null ? null : shapeKittyPiece(row.draft);
  if (draft && draft.firedAt !== null) throw bad();
  const ids = [...fired.map((piece) => piece.id), ...(draft ? [draft.id] : [])];
  if (new Set(ids).size !== ids.length) throw bad();
  if (row.displayId !== undefined && row.displayId !== null && (typeof row.displayId !== "string" || !ids.includes(row.displayId))) throw bad();
  const studio = { version: 1 as const, draft, fired, ...(row.displayId ? { displayId: row.displayId } : {}) };
  if (JSON.stringify(studio).length > KITTY_STUDIO_LIMITS.bytes) throw bad();
  return studio;
}
/** The piece on display: the chosen one, else the newest fired, else the draft, else nothing (legacy bank). */
export function displayedKittyPiece(studio: KittyStudioV1 | undefined): KittyPieceV1 | null {
  if (!studio) return null;
  if (studio.displayId) {
    const chosen = studio.fired.find((piece) => piece.id === studio.displayId) ?? (studio.draft?.id === studio.displayId ? studio.draft : null);
    if (chosen) return chosen;
  }
  return studio.fired[studio.fired.length - 1] ?? studio.draft;
}
/** Take a fired piece back to the wheel: same piece, same id, wet again. Firing is no longer final (2026-09-12). */
export function reopenKittyPiece(studio: KittyStudioV1, pieceId: string): KittyStudioV1 {
  const piece = studio.fired.find((row) => row.id === pieceId);
  if (!piece) return studio;
  const { firedAt: _was, firedBy: _by, ...rest } = piece;
  return {
    version: 1,
    draft: { ...rest, firedAt: null },
    fired: studio.fired.filter((row) => row.id !== pieceId),
    ...(studio.displayId && studio.displayId !== pieceId ? { displayId: studio.displayId } : {}),
  };
}
/** Throw a piece away. The bank keeps its money and its history; only the clay goes. */
export function removeKittyPiece(studio: KittyStudioV1, pieceId: string): KittyStudioV1 {
  const fired = studio.fired.filter((row) => row.id !== pieceId);
  const draft = studio.draft?.id === pieceId ? null : studio.draft;
  const displayId = studio.displayId && studio.displayId !== pieceId ? studio.displayId : null;
  return { version: 1, draft, fired, ...(displayId ? { displayId } : {}) };
}
/** Quantized, clamped stroke ready to store. Interpolation lives in the studio; this only trims. */
export function quantizeKittyStroke(stroke: KittyStrokeV1): KittyStrokeV1 {
  return shapeStroke({
    ...stroke,
    size: clamp(stroke.size, KITTY_STUDIO_LIMITS.strokeSize[0], KITTY_STUDIO_LIMITS.strokeSize[1]),
    opacity: clamp(stroke.opacity, 0, 1),
    pts: stroke.pts.map((n) => clamp(n, 0, 1)),
  });
}
