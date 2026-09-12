import type { KittyFeature, KittyPart, KittyPieceV1, KittySculptV1, KittyStampV1, KittyStrokeV1 } from "../core/types.ts";
import { defaultKittySculpt, isKittyColor, KITTY_FEATURES, KITTY_PARTS, shapeKittyPaint, shapeKittySculpt } from "../core/kittyStudio.ts";

export const KITTY_DESIGN_VERSION = 1 as const;
export const KITTY_DESIGN_CAPABILITY = "hearthside-design-operations-v1" as const;
export const KITTY_DESIGN_LIMITS = { operationBytes: 64 * 1024, historyEntries: 20000, checkpointBytes: 32 * 1024 * 1024, pieces: 200 } as const;
export type KittyDesignScope = { environment: "development" | "production"; householdId: string; ownerMemberId: string | null };
export type KittyShapeField = Exclude<keyof KittySculptV1, "features" | "profile"> | `profile.${0 | 1 | 2 | 3}` | `features.${KittyFeature}`;
export type KittyStampField = Exclude<keyof KittyStampV1, "id" | "part" | "u" | "v"> | "placement";
export type KittyStampPlacement = { part: KittyPart; u: number; v: number } | null;
type Base = { version: 1; id: string; designId: string; pieceId: string; gestureId: string };
type Edit = { expectedEditEpoch: number };
export type KittyDesignOperation = Base & (
  | { kind: "create-piece"; base: string; sculpt?: KittySculptV1 }
  | Edit & { kind: "append-stroke"; surfaceRevision: number; stroke: KittyStrokeV1 }
  | Edit & { kind: "change-shape-field"; field: KittyShapeField; value: string | number; expectedFieldRevision: number }
  | Edit & { kind: "change-dip"; part: KittyPart | "base"; color: string | null; expectedFieldRevision: number }
  | Edit & { kind: "add-stamp"; stamp: KittyStampV1 }
  | Edit & { kind: "update-stamp"; stampId: string; field: KittyStampField; value: string | number | KittyStampPlacement; expectedFieldRevision: number }
  | Edit & { kind: "undo-gesture" | "redo-gesture"; targetGestureId: string; expectedGestureRevision: number }
  | { kind: "fire" | "reopen" | "archive-piece"; expectedRevision: number }
  | { kind: "select-display"; expectedDisplayRevision: number }
);
export type KittyAcceptedDesignOperation = { operation: KittyDesignOperation; actorId: string; order: number; acceptedAt: string };
export type KittyLegacyBaseline = { version: 1; migrationId: string; pieces: KittyPieceV1[]; displayPieceId: string | null; authorship: "unknown" };
/** Separately loaded canonical document. Never put this journal in a goal envelope. */
export type KittyDesignDocument = { version: 1; id: string; scope: KittyDesignScope; legacy: KittyLegacyBaseline | null; revision: number; operations: KittyAcceptedDesignOperation[] };
export type KittyDesignReference = { version: 1; designId: string; revision: number; displayPieceId: string | null };
/** Constructed by authenticated authority, never decoded from a client operation. */
export type KittyDesignAuthority = { environment: "development" | "production"; householdId: string; actorId: string; order: number; acceptedAt: string };

export class KittyDesignError extends Error {
  constructor(public readonly code: string, message: string) { super(message); this.name = "KittyDesignError"; }
}
export function designAssert(test: unknown, code: string, message: string): asserts test {
  if (!test) throw new KittyDesignError(code, message);
}
export function designId(value: unknown): asserts value is string {
  designAssert(typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value), "INVALID_ID", "The creative identity is invalid.");
}
export function designInteger(value: unknown): asserts value is number {
  designAssert(typeof value === "number" && Number.isSafeInteger(value) && value >= 0, "INVALID_REVISION", "The creative revision is invalid.");
}
export function designRecord(value: unknown, allowed: readonly string[], required = allowed): asserts value is Record<string, unknown> {
  designAssert(value !== null && typeof value === "object" && !Array.isArray(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value)), "INVALID_SHAPE", "A compatible creative document is required.");
  const row = value as Record<string, unknown>;
  designAssert(Reflect.ownKeys(row).every((key) => typeof key === "string" && allowed.includes(key)) && required.every((key) => Object.hasOwn(row, key)), "INVALID_SHAPE", "Unexpected or missing creative fields.");
  designAssert(Object.values(Object.getOwnPropertyDescriptors(row)).every((d) => "value" in d), "INVALID_SHAPE", "Creative fields must be plain values.");
}
export function designTime(value: unknown): asserts value is string {
  designAssert(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value, "INVALID_TIME", "The authority timestamp is invalid.");
}
export function designArray(value: unknown, max: number): asserts value is unknown[] {
  designAssert(Array.isArray(value) && value.length <= max && Reflect.ownKeys(value).length === value.length + 1 && Object.getPrototypeOf(value) === Array.prototype, "INVALID_SHAPE", "Creative lists must be bounded, dense arrays.");
  for (let i = 0; i < value.length; i++) designAssert(Object.hasOwn(value, i) && "value" in Object.getOwnPropertyDescriptor(value, String(i))!, "INVALID_SHAPE", "Creative lists must contain plain values.");
}
export function canonicalDesignJSON(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalDesignJSON).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalDesignJSON((value as Record<string, unknown>)[key])}`).join(",")}}`;
}
const failValue = () => new KittyDesignError("INVALID_VALUE", "This creative edit contains an unsupported value.");
export const KITTY_SHAPE_FIELDS: readonly KittyShapeField[] = ["body", "head", "ears", "eyes", "mouth", "whiskers", "tail", "nose", "profile.0", "profile.1", "profile.2", "profile.3", ...KITTY_FEATURES.map((key) => `features.${key}` as const)];
export const KITTY_STAMP_FIELDS: readonly KittyStampField[] = ["anchor", "kind", "color", "trim", "size", "rotation", "text", "placement"];
export function decodeKittySculpt(value: unknown): KittySculptV1 {
  designRecord(value, ["body", "profile", "head", "ears", "eyes", "mouth", "whiskers", "tail", "nose", "features"], ["body", "profile", "head", "ears", "eyes", "mouth", "whiskers", "tail", "nose"]);
  designArray(value.profile, 4);
  if (value.features !== undefined) designRecord(value.features, KITTY_FEATURES, []);
  try { return shapeKittySculpt(value); } catch { throw failValue(); }
}
export function changeKittyShape(sculpt: KittySculptV1, field: KittyShapeField, value: unknown): KittySculptV1 {
  designAssert(KITTY_SHAPE_FIELDS.includes(field), "INVALID_FIELD", "The sculpture field is unknown.");
  const result = structuredClone(sculpt);
  if (field.startsWith("profile.")) result.profile[Number(field.slice(8))] = value as number;
  else if (field.startsWith("features.")) result.features = { ...result.features, [field.slice(9)]: value };
  else Object.assign(result, { [field]: value });
  try { return shapeKittySculpt(result); } catch { throw failValue(); }
}
export function decodeKittyStamp(value: unknown): KittyStampV1 {
  designRecord(value, ["id", "anchor", "kind", "color", "size", "rotation", "text", "part", "u", "v", "trim"], ["id", "anchor", "kind", "color", "size", "rotation"]);
  designId(value.id);
  // Treat exact free placement as one field so u/v never disagree after concurrent edits.
  designAssert((value.part === undefined) === (value.u === undefined) && (value.u === undefined) === (value.v === undefined), "INVALID_VALUE", "Free placement requires a part and both coordinates.");
  try { return shapeKittyPaint({ base: "cream", parts: {}, strokes: [], stamps: [value] }).stamps[0]!; } catch { throw failValue(); }
}
export function changeKittyStamp(stamp: KittyStampV1, field: KittyStampField, value: unknown): KittyStampV1 {
  const next = { ...stamp };
  if (field === "placement") {
    if (value === null) { delete next.part; delete next.u; delete next.v; }
    else { designRecord(value, ["part", "u", "v"]); Object.assign(next, value); }
  } else if (value === null && (field === "trim" || field === "text")) delete next[field];
  else Object.assign(next, { [field]: value });
  return decodeKittyStamp(next);
}
export function decodeKittyDesignOperation(value: unknown): KittyDesignOperation {
  designRecord(value, ["version", "id", "designId", "pieceId", "gestureId", "kind", "base", "sculpt", "surfaceRevision", "stroke", "field", "value", "expectedFieldRevision", "part", "color", "stamp", "stampId", "targetGestureId", "expectedGestureRevision", "expectedRevision", "expectedDisplayRevision", "expectedEditEpoch"], ["version", "id", "designId", "pieceId", "gestureId", "kind"]);
  const common = ["version", "id", "designId", "pieceId", "gestureId", "kind"];
  designAssert(value.version === 1, "UNSUPPORTED_VERSION", "Reload Hearth to use this creative version.");
  for (const key of ["id", "designId", "pieceId", "gestureId"]) designId(value[key]);
  designAssert((value.pieceId as string).length <= 60, "INVALID_ID", "Piece identities may contain at most 60 characters.");
  const fields = (required: string[], optional: string[] = []) => designRecord(value, [...common, ...required, ...optional], [...common, ...required]);
  const editFields = (required: string[]) => { fields([...required, "expectedEditEpoch"]); designInteger(value.expectedEditEpoch); };
  const copy = { ...value };
  switch (value.kind) {
    case "create-piece":
      fields(["base"], ["sculpt"]);
      designAssert(isKittyColor(value.base), "INVALID_VALUE", "Choose a supported dip colour.");
      if (value.sculpt !== undefined) {
        copy.sculpt = decodeKittySculpt(value.sculpt);
      }
      break;
    case "append-stroke":
      editFields(["surfaceRevision", "stroke"]); designInteger(value.surfaceRevision);
      designRecord(value.stroke, ["part", "tool", "color", "size", "opacity", "mirror", "pts"]);
      designArray(value.stroke.pts, 12000);
      try { copy.stroke = shapeKittyPaint({ base: "cream", parts: {}, strokes: [value.stroke], stamps: [] }).strokes[0]!; } catch { throw failValue(); }
      break;
    case "change-shape-field":
      editFields(["field", "value", "expectedFieldRevision"]); designInteger(value.expectedFieldRevision);
      changeKittyShape(defaultKittySculpt(), value.field as KittyShapeField, value.value);
      break;
    case "change-dip":
      editFields(["part", "color", "expectedFieldRevision"]); designInteger(value.expectedFieldRevision);
      designAssert(value.part === "base" || KITTY_PARTS.includes(value.part as KittyPart), "INVALID_FIELD", "Choose a known clay surface.");
      designAssert(value.part === "base" ? isKittyColor(value.color) : value.color === null || typeof value.color === "string" && /^#[0-9a-f]{6}$/.test(value.color), "INVALID_VALUE", "Choose a supported dip colour.");
      break;
    case "add-stamp": editFields(["stamp"]); copy.stamp = decodeKittyStamp(value.stamp); break;
    case "update-stamp":
      editFields(["stampId", "field", "value", "expectedFieldRevision"]); designId(value.stampId); designInteger(value.expectedFieldRevision);
      designAssert(KITTY_STAMP_FIELDS.includes(value.field as KittyStampField), "INVALID_FIELD", "The stamp field is unknown.");
      // Coupled kind/text validation occurs against the actual stamp inside acceptance.
      designAssert(value.value === null || typeof value.value === "string" || typeof value.value === "number" && Number.isFinite(value.value) || value.field === "placement" && typeof value.value === "object", "INVALID_VALUE", "The stamp value is invalid.");
      if (value.field === "placement" && value.value !== null) designRecord(value.value, ["part", "u", "v"]);
      break;
    case "undo-gesture": case "redo-gesture": editFields(["targetGestureId", "expectedGestureRevision"]); designId(value.targetGestureId); designInteger(value.expectedGestureRevision); break;
    case "fire": case "reopen": case "archive-piece": fields(["expectedRevision"]); designInteger(value.expectedRevision); break;
    case "select-display": fields(["expectedDisplayRevision"]); designInteger(value.expectedDisplayRevision); break;
    default: throw new KittyDesignError("UNSUPPORTED_OPERATION", "Reload Hearth to use this creative operation.");
  }
  designAssert(new TextEncoder().encode(canonicalDesignJSON(copy)).length <= KITTY_DESIGN_LIMITS.operationBytes, "OPERATION_TOO_LARGE", "Finish this stroke before continuing.");
  return structuredClone(copy) as KittyDesignOperation;
}

export function decodeKittyDesignReference(value:unknown):KittyDesignReference {
  designRecord(value,['version','designId','revision','displayPieceId']);
  designAssert(value.version===1,'UNSUPPORTED_VERSION','Reload Hearth to read this design.');
  designId(value.designId);designInteger(value.revision);
  if(value.displayPieceId!==null)designId(value.displayPieceId);
  return structuredClone(value) as KittyDesignReference;
}
