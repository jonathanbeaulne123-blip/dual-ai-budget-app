/** Canonical creative authority. No money, network, browser or room dependencies. */
import { defaultKittySculpt, displayedKittyPiece, KITTY_PARTS, KITTY_STUDIO_LIMITS, newKittyPiece, shapeKittyPiece, shapeKittyStudio } from "../core/kittyStudio.ts";
import type { KittyPart, KittyPieceV1, KittySculptV1, KittyStrokeV1, KittyStudioV1 } from "../core/types.ts";
import {
  canonicalDesignJSON, changeKittyShape, changeKittyStamp, decodeKittyDesignOperation, decodeKittySculpt, designArray, designAssert, designId, designInteger, designRecord, designTime,
  KITTY_DESIGN_LIMITS, type KittyAcceptedDesignOperation, type KittyDesignAuthority, type KittyDesignDocument, type KittyDesignOperation, type KittyDesignReference,
  type KittyDesignScope, type KittyLegacyBaseline, type KittyShapeField,
} from "./designContracts.ts";
export * from "./designContracts.ts";

type Gesture = { id: string; actorId: string; pieceId: string; active: boolean; revision: number; editable: boolean };
type Surface = { revision: number; sculpt: KittySculptV1; mapping: "kitty-uv-v1" };
type PieceState = {
  baseline: KittyPieceV1; revision: number; editEpoch: number; status: "clay" | "fired" | "archived"; edits: KittyAcceptedDesignOperation[];
  fields: Map<string, number>; surfaces: Record<KittyPart, Surface[]>; snapshots: KittyDesignSnapshot[]; lastFired: KittyPieceV1 | null;
  sculpt: KittySculptV1; strokeCount: number; pointCount: number; stampIds: Set<string>;
};
type DesignState = { pieces: Map<string, PieceState>; gestures: Map<string, Gesture>; displayPieceId: string | null; displayRevision: number; receipts: Map<string, KittyDesignReceipt>; operations: Map<string, KittyAcceptedDesignOperation> };
export type KittyDesignSnapshot = { version: 1; id: string; designId: string; pieceId: string; revision: number; receiptId: string; actorId: string | null; acceptedAt: string; piece: KittyPieceV1; recoveredPaint: KittyRecoveredPaint[] };
export type KittyRecoveredPaint = { operationId: string | null; gestureId: string | null; actorId: string | null; order: number; stroke: KittyStrokeV1; surface: Surface; reason: "surface-absent" };
export type KittyProjectedStroke = { operationId: string | null; gestureId: string | null; actorId: string | null; order: number; stroke: KittyStrokeV1; surface: Surface };
export type KittyDesignPieceView = {
  piece: KittyPieceV1; revision: number; editEpoch: number; status: PieceState["status"]; fieldRevisions: Record<string, number>; surfaceRevisions: Record<KittyPart, number>;
  strokes: KittyProjectedStroke[]; recoverablePaint: KittyRecoveredPaint[]; snapshots: KittyDesignSnapshot[];
};
export type KittyDesignView = { version: 1; designId: string; revision: number; displayPieceId: string | null; displayRevision: number; pieces: KittyDesignPieceView[]; gestures: Gesture[] };
export type KittyDesignReceipt = { version: 1; id: string; designId: string; pieceId: string; gestureId: string; actorId: string; revision: number; acceptedAt: string; kind: KittyDesignOperation["kind"]; finishActiveStrokes: KittyPart[]; revealId: string | null };
export type KittyDesignAcceptance = { document: KittyDesignDocument; receipt: KittyDesignReceipt; duplicate: boolean };

type CachedDesign = { state?: DesignState; view?: KittyDesignView; checkpointBytes: number };
// Only documents deeply frozen here enter this cache. An externally frozen object
// or a mutable JSON copy must pass the complete history validator first.
const acceptedDocuments = new WeakMap<KittyDesignDocument, CachedDesign>();
function freezeTree<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freezeTree(child);
    Object.freeze(value);
  }
  return value;
}
function retain(document: KittyDesignDocument, state: DesignState, checkpointBytes = new TextEncoder().encode(canonicalDesignJSON({version:1,kind:"kitty-design-checkpoint",document})).length): KittyDesignDocument {
  designAssert(checkpointBytes <= KITTY_DESIGN_LIMITS.checkpointBytes, "CHECKPOINT_LIMIT", "This creative checkpoint is too large.");
  freezeTree(document); acceptedDocuments.set(document, { state, checkpointBytes }); return document;
}
function trusted(input: KittyDesignDocument): KittyDesignDocument {
  return acceptedDocuments.has(input) ? input : decodeKittyDesignDocument(input);
}
function stateFor(input: KittyDesignDocument) {
  const document = trusted(input), cache = acceptedDocuments.get(document)!;
  cache.state ??= replay(document);
  return { document, cache, state: cache.state };
}

function decodeScope(value: unknown): KittyDesignScope {
  designRecord(value, ["environment", "householdId", "ownerMemberId"]);
  designAssert(value.environment === "development" || value.environment === "production", "INVALID_SCOPE", "Choose an existing ledger environment.");
  designId(value.householdId); if (value.ownerMemberId !== null) designId(value.ownerMemberId);
  return structuredClone(value) as KittyDesignScope;
}
function decodeLegacyPiece(value: unknown): KittyPieceV1 {
  designRecord(value, ["id", "createdAt", "firedAt", "firedBy", "firings", "sculpt", "paint"], ["id", "createdAt", "firedAt", "sculpt", "paint"]);
  decodeKittySculpt(value.sculpt);
  designRecord(value.paint, ["base", "parts", "strokes", "stamps"]);
  designRecord(value.paint.parts, KITTY_PARTS, []);
  designArray(value.paint.strokes, KITTY_STUDIO_LIMITS.strokes);
  for (const stroke of value.paint.strokes) {
    designRecord(stroke, ["part", "tool", "color", "size", "opacity", "mirror", "pts"]); designArray(stroke.pts, KITTY_STUDIO_LIMITS.points * 2);
  }
  designArray(value.paint.stamps, KITTY_STUDIO_LIMITS.stamps);
  for (const stamp of value.paint.stamps) designRecord(stamp, ["id", "anchor", "kind", "color", "size", "rotation", "text", "part", "u", "v", "trim"], ["id", "anchor", "kind", "color", "size", "rotation"]);
  return shapeKittyPiece(value);
}
export function createKittyDesignDocument(id: string, scope: KittyDesignScope): KittyDesignDocument {
  designId(id);
  const document: KittyDesignDocument = { version: 1, id, scope: decodeScope(scope), legacy: null, revision: 0, operations: [] };
  return retain(document, emptyState(document));
}
/** A repeated migration must match the first preserved legacy baseline exactly. */
export function migrateLegacyKittyStudio(id: string, scope: KittyDesignScope, studio: KittyStudioV1 | undefined, migrationId: string, existing?: KittyDesignDocument): KittyDesignDocument {
  designId(migrationId);
  const shaped = shapeKittyStudio(studio);
  const legacy: KittyLegacyBaseline = {
    version: 1, migrationId, pieces: structuredClone([...(shaped?.fired ?? []), ...(shaped?.draft ? [shaped.draft] : [])]),
    displayPieceId: displayedKittyPiece(shaped)?.id ?? null, authorship: "unknown",
  };
  if (existing) {
    existing = trusted(existing);
    designAssert(existing.id === id && canonicalDesignJSON(existing.scope) === canonicalDesignJSON(scope) && canonicalDesignJSON(existing.legacy) === canonicalDesignJSON(legacy), "MIGRATION_CONFLICT", "This design was already migrated. Restore its creative history instead of overwriting it.");
    return existing;
  }
  const document = { ...createKittyDesignDocument(id, scope), legacy };
  return retain(document, emptyState(document));
}
function pieceState(piece: KittyPieceV1): PieceState {
  return {
    baseline: structuredClone(piece), revision: 0, editEpoch: 0, status: piece.firedAt ? "fired" : "clay", edits: [], fields: new Map(), snapshots: [], lastFired: piece.firedAt ? structuredClone(piece) : null,
    sculpt: structuredClone(piece.sculpt), strokeCount: piece.paint.strokes.length, pointCount: piece.paint.strokes.reduce((n, stroke) => n + stroke.pts.length / 2, 0), stampIds: new Set(piece.paint.stamps.map(stamp => stamp.id)),
    surfaces: Object.fromEntries(KITTY_PARTS.map((part) => [part, [{ revision: 0, sculpt: structuredClone(piece.sculpt), mapping: "kitty-uv-v1" }]])) as Record<KittyPart, Surface[]>,
  };
}
function emptyState(document: KittyDesignDocument): DesignState {
  return { pieces: new Map(document.legacy?.pieces.map((p) => [p.id, pieceState(p)]) ?? []), gestures: new Map(), displayPieceId: document.legacy?.displayPieceId ?? null, displayRevision: 0, receipts: new Map(), operations: new Map() };
}
function isEditable(operation: KittyDesignOperation): boolean { return ["append-stroke", "change-shape-field", "change-dip", "add-stamp", "update-stamp"].includes(operation.kind); }
function active(state: DesignState, entry: KittyAcceptedDesignOperation): boolean { return state.gestures.get(entry.operation.gestureId)?.active === true; }
function affectedSurfaces(field: KittyShapeField): KittyPart[] {
  if (field === "body" || field.startsWith("profile.")) return ["body", "paws"];
  if (field === "ears" || field === "features.ears") return ["earL", "earR"];
  if (field === "tail" || field === "features.tail") return ["tail"];
  if (field === "head" || field === "features.head") return ["head", "earL", "earR"];
  return [];
}
function fieldKey(operation: KittyDesignOperation): string | null {
  if (operation.kind === "change-shape-field") return `shape:${operation.field}`;
  if (operation.kind === "change-dip") return `dip:${operation.part}`;
  if (operation.kind === "update-stamp") return `stamp:${operation.stampId}:${operation.field}`;
  if (operation.kind === "add-stamp") return `stamp:${operation.stamp.id}:create`;
  return null;
}
function surfacePresent(sculpt: KittySculptV1, part: KittyPart): boolean {
  return part === "tail" ? sculpt.tail !== "none" : part === "earL" || part === "earR" ? sculpt.ears !== "none" : true;
}
/** Stamp constraints do not depend on paint or geometry. Validate only the
 * affected stamp instead of cloning every brush point during each history edit. */
function renderStamp(state: DesignState, row: PieceState, stampId: string) {
  let stamp = row.baseline.paint.stamps.find(value => value.id === stampId);
  const dependent = row.edits.some(entry => active(state, entry) && entry.operation.kind === "update-stamp" && entry.operation.stampId === stampId);
  for (const entry of row.edits) {
    const op = entry.operation, enabled = active(state, entry);
    if (op.kind === "add-stamp" && op.stamp.id === stampId && (enabled || dependent)) stamp = op.stamp;
    if (op.kind === "update-stamp" && op.stampId === stampId && enabled && stamp) stamp = changeKittyStamp(stamp, op.field, op.value);
  }
  return stamp;
}
function renderPiece(state: DesignState, row: PieceState): { piece: KittyPieceV1; strokes: KittyProjectedStroke[]; recoverablePaint: KittyRecoveredPaint[] } {
  const sculpt = structuredClone(row.sculpt);
  const paint = structuredClone(row.baseline.paint);
  const stamps = new Map(paint.stamps.map((s) => [s.id, s]));
  const strokeEntries: KittyProjectedStroke[] = row.baseline.paint.strokes.map((stroke) => ({ operationId: null, gestureId: null, actorId: null, order: 0, stroke: structuredClone(stroke), surface: structuredClone(row.surfaces[stroke.part][0]!) }));
  // An undone author-created stamp remains a support for a partner's active edit.
  // Undo must never erase the partner's contributed work.
  const dependentStamps = new Set(row.edits.filter((e) => active(state, e) && e.operation.kind === "update-stamp").map((e) => (e.operation as Extract<KittyDesignOperation, { kind: "update-stamp" }>).stampId));
  for (const entry of row.edits) {
    const op = entry.operation;
    const enabled = active(state, entry);
    if (!enabled && !(op.kind === "add-stamp" && dependentStamps.has(op.stamp.id))) continue;
    if (op.kind === "change-dip") {
      if (op.part === "base") paint.base = op.color!;
      else if (op.color === null) delete paint.parts[op.part];
      else paint.parts[op.part] = op.color;
    }
    if (op.kind === "add-stamp") stamps.set(op.stamp.id, structuredClone(op.stamp));
    if (op.kind === "update-stamp") {
      const stamp = stamps.get(op.stampId);
      if (stamp) stamps.set(stamp.id, changeKittyStamp(stamp, op.field, op.value));
    }
    if (op.kind === "append-stroke") {
      const surface = row.surfaces[op.stroke.part].find((s) => s.revision === op.surfaceRevision)!;
      strokeEntries.push({ operationId: op.id, gestureId: op.gestureId, actorId: entry.actorId, order: entry.order, stroke: structuredClone(op.stroke), surface: structuredClone(surface) });
    }
  }
  const strokes: KittyProjectedStroke[] = [], recoverablePaint: KittyRecoveredPaint[] = [];
  for (const entry of strokeEntries) {
    if (surfacePresent(sculpt, entry.stroke.part)) strokes.push(entry);
    else recoverablePaint.push({ ...entry, reason: "surface-absent" });
  }
  paint.strokes = strokes.map((entry) => entry.stroke);
  paint.stamps = [...stamps.values()];
  const { firedBy: _oldBy, firings: _oldCount, ...baseline } = row.baseline;
  const piece: KittyPieceV1 = { ...baseline, sculpt, paint, firedAt: row.status === "fired" ? row.lastFired!.firedAt : null };
  if (row.lastFired) {
    piece.firings = row.lastFired.firings ?? 1;
    if (row.status === "fired" && row.lastFired.firedBy !== undefined) piece.firedBy = row.lastFired.firedBy;
  }
  return { piece, strokes, recoverablePaint };
}
function partsForOperation(state: DesignState, op: KittyDesignOperation): KittyPart[] {
  if (op.kind === "change-shape-field") return affectedSurfaces(op.field);
  if (op.kind === "undo-gesture" || op.kind === "redo-gesture") {
    return [...new Set(state.pieces.get(op.pieceId)!.edits.filter((entry) => entry.operation.gestureId === op.targetGestureId).flatMap((entry) => entry.operation.kind === "change-shape-field" ? affectedSurfaces(entry.operation.field) : []))];
  }
  return op.kind === "fire" || op.kind === "archive-piece" ? [...KITTY_PARTS] : [];
}
function applyAccepted(state: DesignState, entry: KittyAcceptedDesignOperation): void {
  const { operation: op, actorId, order, acceptedAt } = entry;
  state.receipts.set(op.id, receiptFor(state, entry)); state.operations.set(op.id, entry);
  if (!state.gestures.has(op.gestureId)) state.gestures.set(op.gestureId, { id: op.gestureId, pieceId: op.pieceId, actorId, active: true, revision: order, editable: isEditable(op) });
  else state.gestures.get(op.gestureId)!.revision = order;
  if (op.kind === "create-piece") {
    state.pieces.set(op.pieceId, pieceState({ ...newKittyPiece(op.pieceId, acceptedAt, op.base), sculpt: op.sculpt ?? defaultKittySculpt() }));
    if (state.displayPieceId === null) { state.displayPieceId = op.pieceId; state.displayRevision = order; }
  }
  const row = state.pieces.get(op.pieceId)!;
  const parts = partsForOperation(state, op);
  if (isEditable(op)) row.edits.push(entry);
  if (op.kind === "change-shape-field") row.sculpt = changeKittyShape(row.sculpt, op.field, op.value);
  if (op.kind === "append-stroke") { row.strokeCount++; row.pointCount += op.stroke.pts.length / 2; }
  if (op.kind === "add-stamp") row.stampIds.add(op.stamp.id);
  const key = fieldKey(op); if (key) row.fields.set(key, order);
  if (op.kind === "undo-gesture" || op.kind === "redo-gesture") {
    const gesture = state.gestures.get(op.targetGestureId)!;
    gesture.active = op.kind === "redo-gesture"; gesture.revision = order;
    for (const edit of row.edits.filter((e) => e.operation.gestureId === op.targetGestureId)) {
      const key = fieldKey(edit.operation); if (key) row.fields.set(key, order);
    }
    // Undo/redo changes only the target gesture's fields. A later active edit by
    // either partner keeps its original compositing position and wins that field.
    const fields = new Set(row.edits.flatMap(entry => entry.operation.gestureId === op.targetGestureId && entry.operation.kind === "change-shape-field" ? [entry.operation.field] : []));
    for (const field of fields) {
      let value: unknown = field.startsWith("profile.") ? row.baseline.sculpt.profile[Number(field.slice(8))]
        : field.startsWith("features.") ? row.baseline.sculpt.features?.[field.slice(9) as keyof NonNullable<KittySculptV1["features"]>] ?? 1
        : row.baseline.sculpt[field as keyof KittySculptV1];
      for (let i = row.edits.length - 1; i >= 0; i--) {
        const edit = row.edits[i]!, shape = edit.operation;
        if (shape.kind === "change-shape-field" && shape.field === field && active(state, edit)) { value = shape.value; break; }
      }
      row.sculpt = changeKittyShape(row.sculpt, field, value);
    }
  }
  if (parts.length && op.kind !== "fire" && op.kind !== "archive-piece") {
    const sculpt = row.sculpt;
    for (const part of parts) row.surfaces[part].push({ revision: order, sculpt: structuredClone(sculpt), mapping: "kitty-uv-v1" });
  }
  if (op.kind === "fire") {
    const rendered = renderPiece(state, row);
    const piece = { ...rendered.piece, firedAt: acceptedAt, firedBy: actorId, firings: (row.lastFired?.firings ?? (row.lastFired ? 1 : 0)) + 1 };
    const snapshot: KittyDesignSnapshot = { version: 1, id: `reveal:${op.id}`, designId: op.designId, pieceId: op.pieceId, revision: order, receiptId: op.id, actorId, acceptedAt, piece: structuredClone(piece), recoveredPaint: structuredClone(rendered.recoverablePaint) };
    row.snapshots.push(snapshot); row.lastFired = piece; row.status = "fired";
  }
  if (op.kind === "reopen") { row.status = "clay"; row.editEpoch = order; }
  if (op.kind === "archive-piece") {
    row.status = "archived";
    if (state.displayPieceId === op.pieceId) { state.displayPieceId = null; state.displayRevision = order; }
  }
  if (op.kind === "select-display") { state.displayPieceId = op.pieceId; state.displayRevision = order; }
  if (op.kind !== "select-display") row.revision = order;
}
function replay(document: KittyDesignDocument): DesignState {
  const state = emptyState(document);
  for (const accepted of document.operations) applyAccepted(state, accepted);
  return state;
}
function assertAcceptance(state: DesignState, op: KittyDesignOperation, actorId: string): void {
  const knownGesture = state.gestures.get(op.gestureId);
  designAssert(!knownGesture || knownGesture.actorId === actorId && knownGesture.pieceId === op.pieceId && knownGesture.editable && isEditable(op) && knownGesture.active, "GESTURE_CONFLICT", "This gesture belongs to another action or has already finished.");
  const row = state.pieces.get(op.pieceId);
  if (op.kind === "create-piece") {
    designAssert(!row, "PIECE_EXISTS", "This piece already exists.");
    designAssert(state.pieces.size < KITTY_DESIGN_LIMITS.pieces, "PIECE_LIMIT", "Keep this studio in an archive before creating another collection."); return;
  }
  designAssert(row && row.status !== "archived", "PIECE_UNAVAILABLE", "This piece is unavailable or archived.");
  if (isEditable(op) || op.kind === "undo-gesture" || op.kind === "redo-gesture" || op.kind === "fire") designAssert(row.status === "clay", "PIECE_FIRED", "Take this same piece back to the wheel before changing it.");
  if ("expectedEditEpoch" in op) designAssert(op.expectedEditEpoch === row.editEpoch, "STALE_EDIT_EPOCH", "This edit was made before the piece was reopened. Keep it in recovery and review it on the current clay.");
  if ("expectedRevision" in op) designAssert(op.expectedRevision === row.revision, "STALE_PIECE", "New creative edits arrived. Review the current piece first.");
  if (op.kind === "reopen") designAssert(row.status === "fired", "PIECE_NOT_FIRED", "This piece is already on the wheel.");
  if (op.kind === "fire") designAssert((row.lastFired?.firings ?? 0) < 999, "FIRING_LIMIT", "This piece has reached its recorded firing limit.");
  if (op.kind === "select-display") designAssert(op.expectedDisplayRevision === state.displayRevision, "STALE_DISPLAY", "The displayed piece changed. Choose again from the current shelf.");
  if ("expectedFieldRevision" in op) designAssert(op.expectedFieldRevision === (row.fields.get(fieldKey(op)!) ?? 0), "STALE_FIELD", "This field changed while you were editing it. Review both choices.");
  if (op.kind === "append-stroke") {
    designAssert(row.surfaces[op.stroke.part].some((s) => s.revision === op.surfaceRevision), "UNKNOWN_SURFACE", "Reload the sculpture surface before accepting this stroke.");
    // Count inactive and temporarily absent paint too: recovery and undo remain bounded.
    designAssert(row.strokeCount < KITTY_STUDIO_LIMITS.strokes && row.pointCount + op.stroke.pts.length / 2 <= KITTY_STUDIO_LIMITS.points, "PAINT_LIMIT", "This piece has reached its detailed paint limit. Its history is kept.");
  }
  if (op.kind === "add-stamp") {
    designAssert(!row.stampIds.has(op.stamp.id), "STAMP_EXISTS", "This stamp identity already belongs to a mark.");
    designAssert(row.stampIds.size < KITTY_STUDIO_LIMITS.stamps, "STAMP_LIMIT", "This piece has reached its add-on limit. Its history is kept.");
  }
  if (op.kind === "update-stamp") {
    const stamp = renderStamp(state, row, op.stampId);
    designAssert(stamp, "STAMP_UNAVAILABLE", "This stamp has been undone or is unavailable.");
    changeKittyStamp(stamp, op.field, op.value);
  }
  if (op.kind === "undo-gesture" || op.kind === "redo-gesture") {
    const gesture = state.gestures.get(op.targetGestureId);
    designAssert(gesture && gesture.pieceId === op.pieceId && gesture.actorId === actorId && gesture.editable, "NOT_YOUR_GESTURE", "You can undo only your own creative gestures.");
    designAssert(gesture.revision === op.expectedGestureRevision && gesture.active === (op.kind === "undo-gesture"), "STALE_GESTURE", "This gesture changed on another device. Refresh its history.");
    // Kind/text are dependent: refuse a revert that would invalidate a partner's stamp.
    const previous = gesture.active; gesture.active = !previous;
    try {
      const ids = new Set(row.edits.flatMap(entry => entry.operation.gestureId !== op.targetGestureId ? [] : entry.operation.kind === "add-stamp" ? [entry.operation.stamp.id] : entry.operation.kind === "update-stamp" ? [entry.operation.stampId] : []));
      for (const id of ids) renderStamp(state, row, id);
    } finally { gesture.active = previous; }
  }
}
function receiptFor(state: DesignState, entry: KittyAcceptedDesignOperation): KittyDesignReceipt {
  const op = entry.operation;
  return { version: 1, id: op.id, designId: op.designId, pieceId: op.pieceId, gestureId: op.gestureId, actorId: entry.actorId, revision: entry.order, acceptedAt: entry.acceptedAt, kind: op.kind, finishActiveStrokes: partsForOperation(state, op), revealId: op.kind === "fire" ? `reveal:${op.id}` : null };
}
/** Persist the returned document and receipt atomically before broadcasting acceptance. */
export function acceptKittyDesignOperation(document: KittyDesignDocument, input: unknown, authority: KittyDesignAuthority): KittyDesignAcceptance {
  const op = decodeKittyDesignOperation(input);
  designRecord(authority, ["environment", "householdId", "actorId", "order", "acceptedAt"]);
  designId(authority.actorId); designInteger(authority.order); designTime(authority.acceptedAt);
  designAssert(authority.actorId.length <= 60, "INVALID_ID", "The authenticated member identity is invalid.");
  const prepared = stateFor(document); document = prepared.document;
  designAssert(document.version === 1 && op.designId === document.id && authority.environment === document.scope.environment && authority.householdId === document.scope.householdId && (document.scope.ownerMemberId === null || document.scope.ownerMemberId === authority.actorId), "SCOPE_MISMATCH", "This creative action belongs to another household or person.");
  const state = prepared.state, prior = state.operations.get(op.id);
  if (prior) {
    designAssert(prior.actorId === authority.actorId && canonicalDesignJSON(prior.operation) === canonicalDesignJSON(op), "OPERATION_ID_REUSED", "This operation identity was already used for different work.");
    return { document, receipt: structuredClone(state.receipts.get(op.id)!), duplicate: true };
  }
  designAssert(authority.order > document.revision, "ORDER_CONFLICT", "The authority must supply a fresh accepted order.");
  designAssert(document.operations.length < KITTY_DESIGN_LIMITS.historyEntries, "HISTORY_LIMIT", "Creative history needs a new archival segment before more edits can be accepted.");
  assertAcceptance(state, op, authority.actorId);
  const accepted = { operation: op, actorId: authority.actorId, order: authority.order, acceptedAt: authority.acceptedAt };
  // Canonical metadata is unchanged. Count only the new entry, comma and revision
  // digits, using UTF-8 bytes so a future checkpoint is always restorable.
  const checkpointBytes = prepared.cache.checkpointBytes + new TextEncoder().encode(canonicalDesignJSON(accepted)).length
    + (document.operations.length ? 1 : 0) + String(accepted.order).length - String(document.revision).length;
  designAssert(checkpointBytes <= KITTY_DESIGN_LIMITS.checkpointBytes, "CHECKPOINT_LIMIT", "Store this creative history in archival segments before accepting more edits.");
  // Transfer the private mutable state to the new immutable revision. A retained
  // old document remains valid and can rebuild its own state if branched later.
  // This avoids retaining a complete state copy for every history prefix.
  prepared.cache.state = undefined;
  applyAccepted(state, accepted);
  const next = retain({ ...document, revision: accepted.order, operations: [...document.operations, accepted] }, state, checkpointBytes);
  return { document: next, receipt: structuredClone(state.receipts.get(op.id)!), duplicate: false };
}
export function projectKittyDesign(document: KittyDesignDocument): KittyDesignView {
  const prepared = stateFor(document), state = prepared.state; document = prepared.document;
  prepared.cache.view ??= {
    version: 1, designId: document.id, revision: document.revision, displayPieceId: state.displayPieceId, displayRevision: state.displayRevision,
    pieces: [...state.pieces.values()].map((row) => {
      const result = renderPiece(state, row);
      return { ...result, revision: row.revision, editEpoch: row.editEpoch, status: row.status, fieldRevisions: Object.fromEntries(row.fields), surfaceRevisions: Object.fromEntries(KITTY_PARTS.map((part) => [part, row.surfaces[part].at(-1)!.revision])) as Record<KittyPart, number>, snapshots: structuredClone(row.snapshots) };
    }), gestures: [...state.gestures.values()].map((g) => ({ ...g })),
  };
  // Consumers receive detached objects: painting a preview cannot change a
  // previously accepted document, a cached projection, or an immutable reveal.
  return structuredClone(prepared.cache.view);
}
export function kittyDesignReference(document: KittyDesignDocument): KittyDesignReference {
  const prepared = stateFor(document);
  return { version: 1, designId: prepared.document.id, revision: prepared.document.revision, displayPieceId: prepared.state.displayPieceId };
}
/** Render adapters consume a projected piece, not a writable legacy studio envelope. */
export function displayedKittyDesignPiece(document: KittyDesignDocument): KittyPieceV1 | null {
  const view = projectKittyDesign(document);
  return view.pieces.find((p) => p.piece.id === view.displayPieceId && p.status !== "archived")?.piece ?? null;
}
/** Recreate the exact accepted revision for a memory or export, independent of later paint. */
export function snapshotKittyDesignRevision(document: KittyDesignDocument, pieceId: string, revision: number) {
  document = trusted(document);
  designInteger(revision);
  designAssert(revision === 0 || document.operations.some((entry) => entry.order === revision), "REVISION_UNAVAILABLE", "This design revision is not in the retained history.");
  const prefix = { ...document, revision, operations: document.operations.filter((entry) => entry.order <= revision) };
  const row = projectKittyDesign(prefix).pieces.find((piece) => piece.piece.id === pieceId);
  designAssert(row, "PIECE_UNAVAILABLE", "This piece did not exist at the selected revision.");
  return { version: 1 as const, designId: document.id, pieceId, revision, piece: row.piece, recoveredPaint: row.recoverablePaint };
}
/** Journal-preserving checkpoint: attribution and inactive gestures are never raster-flattened. */
export function checkpointKittyDesign(document: KittyDesignDocument): string {
  document = trusted(document);
  const result = canonicalDesignJSON({ version: 1, kind: "kitty-design-checkpoint", document });
  designAssert(new TextEncoder().encode(result).length <= KITTY_DESIGN_LIMITS.checkpointBytes, "CHECKPOINT_LIMIT", "Store this creative history in archival segments before checkpointing again.");
  return result;
}
export function restoreKittyDesignCheckpoint(serialized: string): KittyDesignDocument {
  designAssert(new TextEncoder().encode(serialized).length <= KITTY_DESIGN_LIMITS.checkpointBytes, "CHECKPOINT_LIMIT", "This creative checkpoint is too large.");
  const input: unknown = JSON.parse(serialized);
  designRecord(input, ["version", "kind", "document"]);
  designAssert(input.version === 1 && input.kind === "kitty-design-checkpoint", "UNSUPPORTED_VERSION", "This checkpoint needs a compatible reader.");
  return decodeKittyDesignDocument(input.document);
}
/** Validate each supplied operation before trusting a mutable/decoded document.
 * The returned value is deeply immutable and supports safe incremental reuse. */
export function decodeKittyDesignDocument(raw: unknown): KittyDesignDocument {
  designRecord(raw, ["version", "id", "scope", "legacy", "revision", "operations"]);
  designAssert(raw.version === 1, "UNSUPPORTED_VERSION", "This document needs a compatible reader.");
  designId(raw.id); designInteger(raw.revision);
  const document: KittyDesignDocument = { version: 1, id: raw.id, scope: decodeScope(raw.scope), legacy: null, revision: 0, operations: [] };
  if (raw.legacy !== null) {
    const legacy = raw.legacy;
    designRecord(legacy, ["version", "migrationId", "pieces", "displayPieceId", "authorship"]);
    designAssert(legacy.version === 1 && legacy.authorship === "unknown" && Array.isArray(legacy.pieces) && legacy.pieces.length <= KITTY_DESIGN_LIMITS.pieces, "INVALID_BASELINE", "Legacy authorship and pieces must be preserved.");
    designId(legacy.migrationId);
    designArray(legacy.pieces, KITTY_DESIGN_LIMITS.pieces);
    const pieces = legacy.pieces.map(decodeLegacyPiece);
    designAssert(new Set(pieces.map((p) => p.id)).size === pieces.length && (legacy.displayPieceId === null || pieces.some((p) => p.id === legacy.displayPieceId)), "INVALID_BASELINE", "The legacy display identity is invalid.");
    document.legacy = { version: 1, migrationId: legacy.migrationId, pieces, displayPieceId: legacy.displayPieceId as string | null, authorship: "unknown" };
  }
  designArray(raw.operations, KITTY_DESIGN_LIMITS.historyEntries);
  const state = emptyState(document), seen = new Set<string>();
  for (const value of raw.operations) {
    designRecord(value, ["operation", "actorId", "order", "acceptedAt"]);
    designId(value.actorId); designInteger(value.order); designTime(value.acceptedAt);
    const operation = decodeKittyDesignOperation(value.operation);
    designAssert(!seen.has(operation.id), "INVALID_HISTORY", "The checkpoint repeats an accepted operation.");
    designAssert(value.order > document.revision, "ORDER_CONFLICT", "The authority must supply a fresh accepted order.");
    designAssert(operation.designId === document.id && value.actorId.length <= 60 && (document.scope.ownerMemberId === null || document.scope.ownerMemberId === value.actorId), "SCOPE_MISMATCH", "This creative action belongs to another household or person.");
    assertAcceptance(state, operation, value.actorId);
    const accepted = { operation, actorId: value.actorId, order: value.order, acceptedAt: value.acceptedAt };
    applyAccepted(state, accepted); seen.add(operation.id);
    document.operations.push(accepted); document.revision = value.order;
  }
  designAssert(document.revision === raw.revision, "INVALID_HISTORY", "The checkpoint revision does not match its accepted history.");
  return retain(document, state);
}
