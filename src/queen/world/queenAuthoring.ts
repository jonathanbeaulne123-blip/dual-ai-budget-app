import type { KittyPaintV1, KittyPart, KittyPieceV1, KittyStampV1, KittyStrokeV1 } from "../../core/types.ts";
import { KITTY_PARTS, defaultKittyPaint, displayedKittyPiece } from "../../core/kittyStudio.ts";
import type { NestBank } from "../../core/kittyNest.ts";
import type { KittyNestDesign, SaveNestDesignInput } from "../../core/kittyNestDesigns.ts";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";
import type { QueenStill } from "../../core/queenPresentation.ts";
import { stampPlacement } from "../../kitty/studio/stampArt.ts";
import { nestDefaultPiece } from "../../kitty/nestAppearance.ts";
import { QUEEN_CHARM_LIMITS, QUEEN_CHARM_STARTER_SET, shapeQueenCharm, type QueenCharmKind, type QueenCharmV1 } from "../../core/queenCharms.ts";
import { queenCharmAllowed, QUEEN_UNDERSIDE_V, type QueenForm } from "./queenCharmSurface.ts";
import { QUEEN_FORM_REST, queenFormHandles, queenFormProfile, queenRingCount, shapeQueenPortraits, shapeQueenWheel, type QueenPortraitV1, type QueenWheelV1 } from "../../core/queenForm.ts";

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

/**
 * Parts of her the couple may paint: all six the studio knows, so she can be
 * worked on there exactly like a bank. Everything else on her — the hair, the
 * flower crown, the eyes and brow, the seams, her cupped hands, the stones at
 * her feet — is separate geometry carrying a reading, and no brush reaches it.
 */
export const QUEEN_PAINTABLE_PARTS = KITTY_PARTS;
export type QueenPaintablePart = KittyPart;

/**
 * Her clay, from the real pot she is drawn from: the terracotta ground, the
 * two mottling tones fired earthenware is never without, and the mandevilla's
 * two colours — white on her left, crimson on her right.
 */
export const QUEEN_CLAY = {
  base: "#c4794f",
  deep: "#a8603b",
  light: "#d89066",
  petalWhite: "#f7f1e4",
  petalRed: "#c8103c",
} as const;

export const QUEEN_RESERVED_CHANNELS = [
  { id: "vine", label: "The mandevilla — her hair", reading: "the Chapter; her identity and the growth channel" },
  { id: "posture", label: "Body posture and scale", reading: "the pulse" },
  { id: "fill", label: "The belly's fill", reading: "how much is held" },
  { id: "eyes", label: "Eyes and brow", reading: "gaze — closed and serene, opening toward what needs you" },
  { id: "crown", label: "The crown", reading: "both partners present" },
  { id: "seams", label: "Gold seams", reading: "mended corrections, left visible on purpose" },
  { id: "hands", label: "Her cupped hands", reading: "where the Move sits — between her paws, never under them" },
  { id: "feet", label: "Her feet and the ground around them", reading: "where obligations gather" },
  { id: "glaze", label: "The glaze / fired axis", reading: "evidence freshness" },
  { id: "rings", label: "Growth rings", reading: "closed Chapters; one shallow band each, permanent" },
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

const isPaintable = (part: KittyPart | undefined): part is QueenPaintablePart => Boolean(part) && (KITTY_PARTS as readonly string[]).includes(part as string);

/**
 * Keep only the paint that lands on her paintable parts. She has all six, so
 * strokes reach her ears, her tail and her paws the way they reach a bank's,
 * mirroring included. What is still dropped is paint aimed at a reading: her
 * underside, where the makers' marks are pressed, and stamps that would sit a
 * false crown on her or cover her eyes. Colour, pattern, marks and decoration
 * everywhere else pass through untouched.
 */
export function queenSanitizePaint(paint: KittyPaintV1 | null | undefined): KittyPaintV1 {
  const source = paint ?? defaultKittyPaint();
  const parts: Partial<Record<KittyPart, string>> = {};
  for (const part of QUEEN_PAINTABLE_PARTS) if (source.parts[part]) parts[part] = source.parts[part];
  const strokes = source.strokes.filter((stroke) => isPaintable(stroke.part) && !onUnderside(stroke));
  const stamps = source.stamps.filter((stamp) => queenStampAllowed(stamp));
  return { base: source.base, parts, strokes, stamps };
}

/** Her underside — the base disc she tips over to show — is not paintable: a stroke that dips below the hem is dropped. */
const onUnderside = (stroke: Pick<KittyStrokeV1, "part" | "pts">): boolean => stroke.part === "body" && stroke.pts.some((n, i) => i % 2 === 1 && n < QUEEN_UNDERSIDE_V);
export function queenStampAllowed(stamp: KittyStampV1): boolean {
  const placement = stampPlacement(stamp);
  if (!isPaintable(placement.part)) return false;
  if (placement.part === "body" && placement.v < QUEEN_UNDERSIDE_V) return false;
  if (RESERVED_STAMP_KINDS.has(stamp.kind)) return false;
  // The upper third of her head wrap is where the eyes, brow and the flower crown sit; nothing bakes there.
  if (placement.part === "head" && placement.v > 0.55) return false;
  return true;
}

/** Her look, draft-first: she is worked on over time and is never a fired keepsake. */
export function queenLook(design: Pick<KittyNestDesign, "studio" | "glaze"> | undefined): { paint: KittyPaintV1; base: string } {
  const piece: KittyPieceV1 | null = design?.studio?.draft ?? displayedKittyPiece(design?.studio);
  // Terracotta is her clay, not a choice the couple has yet to make: unpainted, she is the pot she was thrown from.
  const paint = queenSanitizePaint(piece?.paint ?? defaultKittyPaint(design?.glaze ?? "terracotta"));
  return { paint, base: paint.base };
}

export class QueenAuthoringError extends Error {}

/** Her form, draft-first: the thrown handles within her bounds and one ring per closed Chapter. Rings come from the household, never from the piece. */
export function queenForm(design: Pick<KittyNestDesign, "studio"> | undefined, household: Parameters<typeof queenRingCount>[0]): QueenForm {
  const piece: KittyPieceV1 | null = design?.studio?.draft ?? displayedKittyPiece(design?.studio);
  const handles = piece?.sculpt?.profile ? queenFormHandles(piece.sculpt.profile) : QUEEN_FORM_REST;
  const rest = handles.belly === 1 && handles.waist === 1 && handles.shoulder === 1 && handles.neck === 1;
  return { handles: rest ? QUEEN_FORM_REST : handles, rings: queenRingCount(household) };
}
/** Who threw her, if she has been thrown. */
export function queenWheel(design: Pick<KittyNestDesign, "studio"> | undefined): QueenWheelV1 | null {
  const piece: KittyPieceV1 | null = design?.studio?.draft ?? displayedKittyPiece(design?.studio);
  return piece?.wheel ?? null;
}
/** The shelf, oldest first. */
export function queenPortraits(design: Pick<KittyNestDesign, "studio"> | undefined): QueenPortraitV1[] {
  const piece: KittyPieceV1 | null = design?.studio?.draft ?? displayedKittyPiece(design?.studio);
  return piece?.portraits ?? [];
}

/**
 * What the guard may be told about the household. Absent, only the starter
 * charms can be written. `rings` lets seats on a ring band be refused; `kept`
 * is the shelf as it stands, and a year already on it can never be replaced
 * or removed through the guard — only new years may join.
 */
export type QueenGuardContext = { earned: ReadonlySet<QueenCharmKind>; rings?: number; kept?: readonly QueenPortraitV1[] };

/**
 * Keep only the charms she can wear: an earned or starter kind, a seat on her
 * paintable surface that covers no reserved channel and faces the room, the
 * stored fields and nothing else (a charm cannot smuggle a glaze, a firing or
 * a reading), at most the cap. Anything else is dropped, quietly — the
 * physical refusal already happened in the tool; this is the same rule for a
 * caller that never saw the tool.
 */
export function queenSanitizeCharms(charms: readonly unknown[] | null | undefined, earned: ReadonlySet<QueenCharmKind> = QUEEN_CHARM_STARTER_SET, form?: QueenForm): QueenCharmV1[] {
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
    if (!queenCharmAllowed(charm.part, charm.u, charm.v, form)) { seen.delete(charm.id); continue; }
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
 * refuses setup completion (which fires the King), reads the thrown form
 * within her own bounds (posture and fill stay readings; the four handles are
 * the wheel's and nothing else on the sculpt is hers), keeps the wheel's two
 * attributed turns, keeps the shelf immutable, sanitizes the paint and
 * sanitizes the charms against what the household has earned and what is
 * reserved — rings included. Everything it returns is a plain
 * `saveKittyNestDesign` input for the household King.
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
  const handles = queenFormHandles(draft.sculpt?.profile);
  const form: QueenForm = { handles, rings: context?.rings ?? 0 };
  const charms = queenSanitizeCharms(draft.charms, context?.earned, form);
  let wheel: QueenWheelV1 | undefined;
  try { wheel = shapeQueenWheel(draft.wheel); } catch { wheel = undefined; }
  const kept = context?.kept ?? [];
  const keptYears = new Set(kept.map((row) => row.year));
  let offered: QueenPortraitV1[] = [];
  try { offered = shapeQueenPortraits(draft.portraits) ?? []; } catch { offered = []; }
  const portraits = [...kept.map((row) => ({ ...row, charms: row.charms.map((charm) => ({ ...charm })) })), ...offered.filter((row) => !keptYears.has(row.year))].sort((a, b) => a.year - b.year);
  const keep: KittyPieceV1 = {
    ...draft, firedAt: null, sculpt: { ...draft.sculpt, profile: queenFormProfile(handles) }, paint: queenSanitizePaint(draft.paint),
    ...(charms.length ? { charms } : {}), ...(wheel ? { wheel } : {}), ...(portraits.length ? { portraits } : {}),
  };
  delete (keep as Partial<KittyPieceV1>).firedBy;
  if (!charms.length) delete (keep as Partial<KittyPieceV1>).charms;
  if (!wheel) delete (keep as Partial<KittyPieceV1>).wheel;
  if (!portraits.length) delete (keep as Partial<KittyPieceV1>).portraits;
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
/**
 * The same still when Jonathan's sculpted Queen stands in the world (D-266).
 * Her face is sculpted serene and does not move, so the words say only what
 * the 3D path actually shows: her posture, and the coins beside her that
 * carry the evidence's freshness.
 */
export function queenModelStill(still: Pick<QueenStill, "state" | "posture" | "eyes" | "gaze" | "brow" | "mouth" | "glaze" | "description">): string {
  const pose = queenPose(still);
  const lean = pose.lean === 0 ? "upright" : `leaning ${Math.abs((pose.lean * 180) / Math.PI).toFixed(1)}° ${pose.lean < 0 ? "in" : "back"}`;
  const coins = still.glaze === "glazed" ? "polished" : still.glaze === "offline" ? "dull, offline" : "dull";
  return `${still.description} In the world: the Mandevilla Queen in her planter, ${lean} at ${Math.round(pose.scale * 100)}% scale, eyes closed as sculpted, the coins beside her ${coins}.`;
}

export function queenWorldStill(still: Pick<QueenStill, "state" | "posture" | "eyes" | "gaze" | "brow" | "mouth" | "glaze" | "description">): string {
  const pose = queenPose(still);
  const lean = pose.lean === 0 ? "upright" : `leaning ${Math.abs((pose.lean * 180) / Math.PI).toFixed(1)}° ${pose.lean < 0 ? "in" : "back"}`;
  const surface = still.glaze === "glazed" ? "glazed and clearcoated" : still.glaze === "offline" ? "matte, unglazed, offline" : "matte and unglazed";
  return `${still.description} In the world: body ${lean} at ${Math.round(pose.scale * 100)}% scale, eyes ${pose.eyes}${pose.eyes === "open" ? ` toward ${pose.gaze}` : ""}, brow ${pose.brow}, mouth ${pose.mouth}, surface ${surface}.`;
}
