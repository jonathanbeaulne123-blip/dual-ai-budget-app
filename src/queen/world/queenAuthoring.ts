import type { KittyPaintV1, KittyPart, KittyPieceV1, KittyStampV1 } from "../../core/types.ts";
import { defaultKittyPaint, displayedKittyPiece } from "../../core/kittyStudio.ts";
import type { NestBank } from "../../core/kittyNest.ts";
import type { KittyNestDesign, SaveNestDesignInput } from "../../core/kittyNestDesigns.ts";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";
import type { QueenStill } from "../../core/queenPresentation.ts";
import { stampPlacement } from "../../kitty/studio/stampArt.ts";
import { nestDefaultPiece } from "../../kitty/nestAppearance.ts";
import { QUEEN_CHARM_LIMITS, QUEEN_CHARM_STARTER_SET, shapeQueenCharm, type QueenCharmKind, type QueenCharmV1 } from "../../core/queenCharms.ts";
import { queenCharmAllowed } from "./queenCharmSurface.ts";

/**
 * The Queen in the studio — what is hers and theirs, and what is reserved.
 *
 * Every function here is pure and touches no money. The Queen's look lives on
 * the household King design (`bankKey: "king"`, the shared Fund) exactly where
 * the nest already keeps it, so nothing new is stored. What changes is the
 * reading: her reserved channels are separate geometry the paint can never
 * reach, the glaze axis belongs to evidence freshness rather than to a kiln,
 * and she is never final — her look is read draft-first and never fired.
 * Charms ride the same draft and pass the same guard: unearned kinds and
 * seats on a reserved channel are dropped there, not only in the tool.
 */

/** Parts of her the couple may paint. Everything else on her is a reading. */
export const QUEEN_PAINTABLE_PARTS = ["body", "head"] as const;
export type QueenPaintablePart = typeof QUEEN_PAINTABLE_PARTS[number];

export const QUEEN_RESERVED_CHANNELS = [
  { id: "vine", label: "The mandevilla vine", reading: "the Chapter; her identity and the growth channel" },
  { id: "posture", label: "Body posture and scale", reading: "the pulse" },
  { id: "fill", label: "The belly's fill", reading: "how much is held" },
  { id: "eyes", label: "Eyes and brow", reading: "gaze — closed and serene, opening toward what needs you" },
  { id: "crown", label: "The crown", reading: "both partners present" },
  { id: "seams", label: "Gold seams", reading: "mended corrections, left visible on purpose" },
  { id: "hands", label: "Her hands", reading: "where the Move sits" },
  { id: "feet", label: "Her feet and the ground around them", reading: "where obligations gather" },
  { id: "glaze", label: "The glaze / fired axis", reading: "evidence freshness" },
] as const;
export type QueenReservedChannel = typeof QUEEN_RESERVED_CHANNELS[number]["id"];

/** Stamp kinds that would impersonate a reserved reading if baked onto her head. */
const RESERVED_STAMP_KINDS: ReadonlySet<string> = new Set(["crown", "party-hat", "sun-hat", "beanie", "glasses", "sunglasses"]);

/** The material axis a kitty bank uses for fired versus unfired clay, reserved on her for freshness. */
export const QUEEN_GLAZE_AXIS = {
  glazed: { roughness: 0.23, clearcoat: 1, envMapIntensity: 0.7 },
  matte: { roughness: 0.86, clearcoat: 0, envMapIntensity: 0.15 },
} as const;
export type QueenGlazeAxis = typeof QUEEN_GLAZE_AXIS[keyof typeof QUEEN_GLAZE_AXIS];

/** Freshness decides her surface. `firedAt` on any piece is ignored on purpose: nobody can fire her. */
export function queenGlazeAxis(glaze: QueenStill["glaze"] | FundPulseFreshness): QueenGlazeAxis {
  return glaze === "glazed" || glaze === "current" ? QUEEN_GLAZE_AXIS.glazed : QUEEN_GLAZE_AXIS.matte;
}

const isPaintable = (part: KittyPart | undefined): part is QueenPaintablePart => part === "body" || part === "head";

/**
 * Keep only the paint that lands on her paintable parts. Strokes and stamps
 * aimed at parts she does not have (ears, tail, paws) are dropped, and stamps
 * that would sit a false crown or cover her eyes are dropped too. Colour,
 * pattern, marks and decoration on body and head pass through untouched.
 */
export function queenSanitizePaint(paint: KittyPaintV1 | null | undefined): KittyPaintV1 {
  const source = paint ?? defaultKittyPaint();
  const parts: Partial<Record<KittyPart, string>> = {};
  for (const part of QUEEN_PAINTABLE_PARTS) if (source.parts[part]) parts[part] = source.parts[part];
  const strokes = source.strokes.filter((stroke) => isPaintable(stroke.part)).map((stroke) => ({ ...stroke, mirror: false }));
  const stamps = source.stamps.filter((stamp) => queenStampAllowed(stamp));
  return { base: source.base, parts, strokes, stamps };
}

export function queenStampAllowed(stamp: KittyStampV1): boolean {
  const placement = stampPlacement(stamp);
  if (!isPaintable(placement.part)) return false;
  if (RESERVED_STAMP_KINDS.has(stamp.kind)) return false;
  // The upper third of her head wrap is where the eyes, brow and crown sit; nothing bakes there.
  if (placement.part === "head" && placement.v > 0.55) return false;
  return true;
}

/** Her look, draft-first: she is worked on over time and is never a fired keepsake. */
export function queenLook(design: Pick<KittyNestDesign, "studio" | "glaze"> | undefined): { paint: KittyPaintV1; base: string } {
  const piece: KittyPieceV1 | null = design?.studio?.draft ?? displayedKittyPiece(design?.studio);
  const paint = queenSanitizePaint(piece?.paint ?? defaultKittyPaint(design?.glaze ?? "cream"));
  return { paint, base: paint.base };
}

export class QueenAuthoringError extends Error {}

/** What the guard may be told about the household. Absent, only the starter charms can be written. */
export type QueenGuardContext = { earned: ReadonlySet<QueenCharmKind> };

/**
 * Keep only the charms she can wear: an earned or starter kind, a seat on her
 * paintable surface that covers no reserved channel and faces the room, the
 * stored fields and nothing else (a charm cannot smuggle a glaze, a firing or
 * a reading), at most the cap. Anything else is dropped, quietly — the
 * physical refusal already happened in the tool; this is the same rule for a
 * caller that never saw the tool.
 */
export function queenSanitizeCharms(charms: readonly unknown[] | null | undefined, earned: ReadonlySet<QueenCharmKind> = QUEEN_CHARM_STARTER_SET): QueenCharmV1[] {
  if (!charms?.length) return [];
  const seen = new Set<string>();
  const kept: QueenCharmV1[] = [];
  for (const raw of charms) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const slim = { id: row.id, kind: row.kind, part: row.part, u: row.u, v: row.v, spin: row.spin, tilt: row.tilt, scale: row.scale, color: row.color, ...(row.by !== undefined ? { by: row.by } : {}) };
    let charm: QueenCharmV1;
    try { charm = shapeQueenCharm(slim, seen); } catch { continue; }
    if (!earned.has(charm.kind)) { seen.delete(charm.id); continue; }
    if (!queenCharmAllowed(charm.part, charm.u, charm.v)) { seen.delete(charm.id); continue; }
    kept.push(charm);
    if (kept.length >= QUEEN_CHARM_LIMITS.count) break;
  }
  return kept;
}
/** The charms she wears, draft-first, unsanitized against earning (the reader shows what was kept; the guard decides what is kept). */
export function queenWornCharms(design: Pick<KittyNestDesign, "studio"> | undefined): QueenCharmV1[] {
  const piece: KittyPieceV1 | null = design?.studio?.draft ?? displayedKittyPiece(design?.studio);
  return piece?.charms ?? [];
}

/**
 * The only way the Home world writes her look. It refuses the kiln outright,
 * refuses setup completion (which fires the King), drops any sculpt (her posture
 * and form are readings, not dials), sanitizes the paint and sanitizes the
 * charms against what the household has earned and what is reserved.
 * Everything it returns is a plain `saveKittyNestDesign` input for the
 * household King.
 */
export function guardQueenDesignSave(input: SaveNestDesignInput, context?: QueenGuardContext): SaveNestDesignInput {
  if (input.bankKey !== "king" || input.view !== "household") throw new QueenAuthoringError("Only the shared Fund's King is the Queen.");
  if (input.fire) throw new QueenAuthoringError("The kiln is unavailable for her. She is never final.");
  if (input.completeSetup) throw new QueenAuthoringError("Her setup is the couple's ceremony in the banks, not here.");
  if (input.archived) throw new QueenAuthoringError("She cannot be archived.");
  const studio = input.studio;
  if (!studio) return { ...input, fire: false, completeSetup: false };
  const draft = studio.draft ?? displayedKittyPiece(studio);
  if (!draft) return { ...input, fire: false, completeSetup: false, studio: { ...studio, draft: null } };
  const charms = queenSanitizeCharms(draft.charms, context?.earned);
  const keep: KittyPieceV1 = { ...draft, firedAt: null, paint: queenSanitizePaint(draft.paint), ...(charms.length ? { charms } : {}) };
  delete (keep as Partial<KittyPieceV1>).firedBy;
  if (!charms.length) delete (keep as Partial<KittyPieceV1>).charms;
  return { ...input, fire: false, completeSetup: false, studio: { ...studio, draft: keep } };
}

/** Which studio-authored piece a bank wears: the goal's own, else the design's, else the nest default. */
export function queenBankPiece(bank: Pick<NestBank, "id" | "tier" | "category" | "goal" | "design">): KittyPieceV1 {
  return (bank.goal ? displayedKittyPiece(bank.goal.envelope?.studio) : displayedKittyPiece(bank.design?.studio)) ?? nestDefaultPiece(bank);
}
export function queenBankGlaze(bank: Pick<NestBank, "goal" | "design">): string {
  return bank.design?.glaze ?? bank.goal?.envelope?.glaze ?? "cream";
}
/** Fired is a real material change on a bank; it is read from the piece and never faked. */
export function queenBankFired(piece: Pick<KittyPieceV1, "firedAt">): boolean {
  return Boolean(piece.firedAt);
}

/** Posture as the 3D body group reads it: the same numbers the flat figure uses, in radians. */
export type QueenPose = { scale: number; lean: number; eyes: QueenStill["eyes"]; gaze: QueenStill["gaze"]; brow: QueenStill["brow"]; mouth: QueenStill["mouth"] };
const POSTURE: Record<QueenStill["posture"], { scale: number; leanDeg: number }> = {
  upright: { scale: 1, leanDeg: 0 },
  "leaning-in": { scale: 0.97, leanDeg: -1.5 },
  attentive: { scale: 0.98, leanDeg: 0 },
  tilted: { scale: 0.9, leanDeg: 3 },
  depleted: { scale: 0.82, leanDeg: 2 },
  matte: { scale: 0.95, leanDeg: 0 },
};
export function queenPose(still: Pick<QueenStill, "posture" | "eyes" | "gaze" | "brow" | "mouth">): QueenPose {
  const posture = POSTURE[still.posture];
  return { scale: posture.scale, lean: (posture.leanDeg * Math.PI) / 180, eyes: still.eyes, gaze: still.gaze, brow: still.brow, mouth: still.mouth };
}

/** The 3D path's own legible still: what the body group, the eyes and the surface are doing, in words. */
export function queenWorldStill(still: Pick<QueenStill, "state" | "posture" | "eyes" | "gaze" | "brow" | "mouth" | "glaze" | "description">): string {
  const pose = queenPose(still);
  const lean = pose.lean === 0 ? "upright" : `leaning ${Math.abs((pose.lean * 180) / Math.PI).toFixed(1)}° ${pose.lean < 0 ? "in" : "back"}`;
  const surface = still.glaze === "glazed" ? "glazed and clearcoated" : still.glaze === "offline" ? "matte, unglazed, offline" : "matte and unglazed";
  return `${still.description} In the world: body ${lean} at ${Math.round(pose.scale * 100)}% scale, eyes ${pose.eyes}${pose.eyes === "open" ? ` toward ${pose.gaze}` : ""}, brow ${pose.brow}, mouth ${pose.mouth}, surface ${surface}.`;
}
