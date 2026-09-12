import { describe, expect, it } from "vitest";
import { newKittyPiece } from "../src/core/kittyStudio.ts";
import type { KittyPart, KittyStrokeV1 } from "../src/core/types.ts";
import {
  acceptKittyDesignOperation, checkpointKittyDesign, createKittyDesignDocument, decodeKittyDesignOperation, displayedKittyDesignPiece, kittyDesignReference,
  migrateLegacyKittyStudio, projectKittyDesign, restoreKittyDesignCheckpoint, snapshotKittyDesignRevision,
  type KittyDesignDocument, type KittyDesignOperation, type KittyDesignScope,
} from "../src/hearthside/design.ts";

const scope: KittyDesignScope = { environment: "development", householdId: "couple-a", ownerMemberId: null };
const time = "2026-09-12T15:00:00.000Z";
type Intent = KittyDesignOperation extends infer U ? U extends KittyDesignOperation ? Omit<U, "version" | "id" | "designId" | "pieceId" | "gestureId" | "expectedEditEpoch"> & { expectedEditEpoch?: number } : never : never;
const stroke = (color: string, part: KittyPart = "body"): KittyStrokeV1 => ({ part, tool: "brush", color, size: 12, opacity: 1, mirror: false, pts: [0.2, 0.3, 0.4, 0.5] });
const intent = (id: string, payload: Intent, options: { pieceId?: string; gestureId?: string } = {}): KittyDesignOperation => ({ version: 1, id, designId: "studio-a", pieceId: options.pieceId ?? "cat-a", gestureId: options.gestureId ?? `gesture-${id}`, ...(["append-stroke", "change-shape-field", "change-dip", "add-stamp", "update-stamp", "undo-gesture", "redo-gesture"].includes(payload.kind) ? { expectedEditEpoch: payload.expectedEditEpoch ?? 0 } : {}), ...payload }) as KittyDesignOperation;
function studio() {
  let document = createKittyDesignDocument("studio-a", scope);
  const accept = (op: KittyDesignOperation, actorId = "alice", order = document.revision + 1) => {
    const result = acceptKittyDesignOperation(document, op, { ...scope, ownerMemberId: undefined, actorId, order, acceptedAt: time } as never);
    document = result.document; return result;
  };
  // Keep the authority shape explicit: no user-supplied scope keys are accepted.
  const send = (op: KittyDesignOperation, actorId = "alice", order = document.revision + 1) => {
    const result = acceptKittyDesignOperation(document, op, { environment: scope.environment, householdId: scope.householdId, actorId, order, acceptedAt: time });
    document = result.document; return result;
  };
  const view = () => projectKittyDesign(document);
  const piece = (id = "cat-a") => view().pieces.find((p) => p.piece.id === id)!;
  send(intent("create", { kind: "create-piece", base: "cream" }));
  return { send, invalidAuthority: accept, view, piece, doc: () => document, restore: (input: string) => { document = restoreKittyDesignCheckpoint(input); } };
}
const paint = (id: string, color = "#aa0000", part: KittyPart = "body", surfaceRevision = 0, gestureId?: string) => intent(id, { kind: "append-stroke", stroke: stroke(color, part), surfaceRevision }, { gestureId });

describe("Hearthside simultaneous canonical creative history", () => {
  it("composes two same-surface overlapping strokes in authenticated accepted order", () => {
    const s = studio();
    s.send(paint("alice-stroke"), "alice", 12);
    s.send(paint("bob-stroke", "#0000bb"), "bob", 20);
    expect(s.piece().piece.paint.strokes.map((s) => s.color)).toEqual(["#aa0000", "#0000bb"]);
    expect(s.piece().strokes.map(({ actorId, order }) => [actorId, order])).toEqual([["alice", 12], ["bob", 20]]);
    expect(kittyDesignReference(s.doc())).toEqual({ version: 1, designId: "studio-a", revision: 20, displayPieceId: "cat-a" });
  });

  it("individual undo leaves the partner painting; redo restores the original composition position", () => {
    const s = studio();
    s.send(paint("a"), "alice"); s.send(paint("b", "#0000bb"), "bob");
    s.send(intent("undo-a", { kind: "undo-gesture", targetGestureId: "gesture-a", expectedGestureRevision: 2 }));
    s.send(paint("b2", "#00bb00"), "bob");
    expect(s.piece().piece.paint.strokes.map((s) => s.color)).toEqual(["#0000bb", "#00bb00"]);
    s.send(intent("redo-a", { kind: "redo-gesture", targetGestureId: "gesture-a", expectedGestureRevision: 4 }));
    expect(s.piece().piece.paint.strokes.map((s) => s.color)).toEqual(["#aa0000", "#0000bb", "#00bb00"]);
    expect(() => s.send(intent("steal", { kind: "undo-gesture", targetGestureId: "gesture-b", expectedGestureRevision: 3 }))).toThrow("only your own");
  });

  it("same-author two-device retries acknowledge once and stale undo cannot revert a newer decision", () => {
    const s = studio(); const op = paint("phone-a"); const accepted = s.send(op);
    const retry = s.send(op, "alice", 99);
    expect(retry.duplicate).toBe(true); expect(retry.receipt).toEqual(accepted.receipt); expect(s.doc().revision).toBe(2);
    s.send(intent("phone-undo", { kind: "undo-gesture", targetGestureId: "gesture-phone-a", expectedGestureRevision: 2 }));
    expect(() => s.send(intent("tablet-undo", { kind: "undo-gesture", targetGestureId: "gesture-phone-a", expectedGestureRevision: 2 }))).toThrow("changed on another device");
    s.send(paint("tablet-a", "#0000bb"));
    expect(s.piece().piece.paint.strokes).toHaveLength(1);
    expect(() => s.send({ ...op, stroke: stroke("#ffffff") } as KittyDesignOperation)).toThrow("different work");
    expect(() => s.send(op, "bob")).toThrow("different work");
  });

  it("independent shape fields accept concurrently while same-field revisions require review", () => {
    const s = studio();
    s.send(intent("shape-a", { kind: "change-shape-field", field: "profile.0", value: 1.1, expectedFieldRevision: 0 }), "alice");
    s.send(intent("shape-b", { kind: "change-shape-field", field: "features.eyes", value: 1.4, expectedFieldRevision: 0 }), "bob");
    expect(s.piece().piece.sculpt.profile[0]).toBe(1.1); expect(s.piece().piece.sculpt.features?.eyes).toBe(1.4);
    expect(() => s.send(intent("stale", { kind: "change-shape-field", field: "profile.0", value: 0.8, expectedFieldRevision: 0 }), "bob")).toThrow("field changed");
    s.send(intent("undo-shape", { kind: "undo-gesture", targetGestureId: "gesture-shape-a", expectedGestureRevision: 2 }));
    expect(s.piece().piece.sculpt.profile[0]).toBe(1); expect(s.piece().piece.sculpt.features?.eyes).toBe(1.4);
    expect(s.piece().fieldRevisions["shape:profile.0"]).toBe(4);
  });

  it("shape changes finish preview surfaces and keep an in-flight stroke's prior mapping recoverable", () => {
    const s = studio();
    const topology = s.send(intent("no-tail", { kind: "change-shape-field", field: "tail", value: "none", expectedFieldRevision: 0 }));
    expect(topology.receipt.finishActiveStrokes).toEqual(["tail"]);
    s.send(paint("in-flight-tail", "#0000bb", "tail", 0), "bob");
    expect(s.piece().piece.paint.strokes).toHaveLength(0);
    expect(s.piece().recoverablePaint[0]).toMatchObject({ actorId: "bob", reason: "surface-absent", surface: { revision: 0, sculpt: { tail: "curl" } } });
    s.send(intent("tail-return", { kind: "undo-gesture", targetGestureId: "gesture-no-tail", expectedGestureRevision: 2 }));
    expect(s.piece().piece.paint.strokes[0]!.part).toBe("tail"); expect(s.piece().recoverablePaint).toHaveLength(0);
    expect(() => s.send(paint("unknown-surface", "#ffffff", "tail", 999))).toThrow("Reload the sculpture surface");
  });

  it("a continuous gesture crossing device submissions is undone as one authored gesture", () => {
    const s = studio();
    s.send(paint("chunk-1", "#aa0000", "body", 0, "drag-a"));
    s.send(paint("partner-chunk", "#0000bb"), "bob");
    s.send(paint("chunk-2", "#aa0000", "body", 0, "drag-a"));
    expect(() => s.send(paint("stolen-drag", "#ffffff", "body", 0, "drag-a"), "bob")).toThrow("another action");
    s.send(intent("undo-drag", { kind: "undo-gesture", targetGestureId: "drag-a", expectedGestureRevision: 4 }));
    expect(s.piece().piece.paint.strokes.map((s) => s.color)).toEqual(["#0000bb"]);
  });

  it("stamp field CAS permits independent changes and undo cannot erase a partner's decoration", () => {
    const s = studio();
    s.send(intent("stamp", { kind: "add-stamp", stamp: { id: "heart-a", anchor: "belly", kind: "heart", color: "#aa0000", size: 0.2, rotation: 0 } }));
    s.send(intent("stamp-color", { kind: "update-stamp", stampId: "heart-a", field: "color", value: "#0000bb", expectedFieldRevision: 0 }), "bob");
    s.send(intent("stamp-turn", { kind: "update-stamp", stampId: "heart-a", field: "rotation", value: 45, expectedFieldRevision: 0 }));
    expect(s.piece().piece.paint.stamps[0]).toMatchObject({ color: "#0000bb", rotation: 45 });
    expect(() => s.send(intent("stamp-color-stale", { kind: "update-stamp", stampId: "heart-a", field: "color", value: "#00bb00", expectedFieldRevision: 0 }))).toThrow("field changed");
    s.send(intent("undo-stamp", { kind: "undo-gesture", targetGestureId: "gesture-stamp", expectedGestureRevision: 2 }));
    expect(s.piece().piece.paint.stamps[0]).toMatchObject({ id: "heart-a", color: "#0000bb", rotation: 45 });
    s.send(intent("undo-turn", { kind: "undo-gesture", targetGestureId: "gesture-stamp-turn", expectedGestureRevision: 4 }));
    expect(s.piece().piece.paint.stamps[0]).toMatchObject({ color: "#0000bb", rotation: 0 });
  });

  it("stamp placement is atomic and separately revisioned from colour", () => {
    const s = studio();
    s.send(intent("stamp", { kind: "add-stamp", stamp: { id: "heart-a", anchor: "belly", kind: "heart", color: "#aa0000", size: 0.2, rotation: 0 } }));
    s.send(intent("placement", { kind: "update-stamp", stampId: "heart-a", field: "placement", value: { part: "head", u: 0.25, v: 0.6 }, expectedFieldRevision: 0 }));
    s.send(intent("colour", { kind: "update-stamp", stampId: "heart-a", field: "color", value: "#0000bb", expectedFieldRevision: 0 }), "bob");
    expect(s.piece().piece.paint.stamps[0]).toMatchObject({ part: "head", u: 0.25, v: 0.6, color: "#0000bb" });
    expect(() => s.send(intent("bad-placement", { kind: "update-stamp", stampId: "heart-a", field: "placement", value: { part: "head", u: 0.2 } as never, expectedFieldRevision: 3 }))).toThrow();
  });

  it("firing refuses pending revision changes and keeps an immutable reveal through reopen and undo", () => {
    const s = studio(); s.send(paint("a"));
    const oldRevision = s.piece().revision; s.send(paint("b", "#0000bb"), "bob");
    expect(() => s.send(intent("stale-fire", { kind: "fire", expectedRevision: oldRevision }))).toThrow("New creative edits");
    const fired = s.send(intent("fire", { kind: "fire", expectedRevision: 3 }));
    expect(fired.receipt.revealId).toBe("reveal:fire"); expect(fired.receipt.finishActiveStrokes).toHaveLength(6);
    const immutable = structuredClone(s.piece().snapshots[0]);
    expect(() => s.send(paint("late-stroke"))).toThrow("back to the wheel");
    s.send(intent("reopen", { kind: "reopen", expectedRevision: 4 }));
    expect(() => s.send(paint("late-stroke"))).toThrow("before the piece was reopened");
    s.send(intent("undo-a", { kind: "undo-gesture", targetGestureId: "gesture-a", expectedGestureRevision: 2, expectedEditEpoch: 5 }));
    expect(s.piece().piece.id).toBe("cat-a"); expect(s.piece().piece.paint.strokes).toHaveLength(1);
    expect(s.piece().snapshots[0]).toEqual(immutable);
    s.send(intent("fire-again", { kind: "fire", expectedRevision: 6 }));
    expect(s.piece().piece.firings).toBe(2); expect(s.piece().snapshots).toHaveLength(2);
    expect(s.send(intent("fire", { kind: "fire", expectedRevision: 3 })).receipt).toEqual(fired.receipt);
    expect(snapshotKittyDesignRevision(s.doc(), "cat-a", 4).piece.paint.strokes).toHaveLength(2);
  });

  it("checkpoint, JSON restart, and reconnect retain inactive history and original redo order", () => {
    const s = studio(); s.send(paint("a")); s.send(paint("b", "#0000bb"), "bob");
    s.send(intent("undo", { kind: "undo-gesture", targetGestureId: "gesture-a", expectedGestureRevision: 2 }));
    const before = s.doc(); s.restore(checkpointKittyDesign(before));
    expect(s.doc()).toEqual(before); expect(s.piece().strokes.map((s) => s.actorId)).toEqual(["bob"]);
    s.send(intent("redo", { kind: "redo-gesture", targetGestureId: "gesture-a", expectedGestureRevision: 4 }));
    expect(s.piece().strokes.map((s) => s.actorId)).toEqual(["alice", "bob"]);
    expect(s.send(paint("a")).duplicate).toBe(true); expect(s.doc().operations).toHaveLength(5);
    expect(checkpointKittyDesign(restoreKittyDesignCheckpoint(checkpointKittyDesign(s.doc())))).toEqual(checkpointKittyDesign(s.doc()));
  });

  it("migrates legacy fired artwork exactly, without inventing historical authors or allowing overwrite", () => {
    const oldPiece = { ...newKittyPiece("old-cat", time), firedAt: time, paint: { base: "cream", parts: {}, strokes: [stroke("#aa0000")], stamps: [] } };
    const old = { version: 1 as const, draft: null, fired: [oldPiece], displayId: "old-cat" };
    const doc = migrateLegacyKittyStudio("studio-a", scope, old, "migration-a");
    expect(doc.legacy?.authorship).toBe("unknown"); expect(displayedKittyDesignPiece(doc)).toMatchObject(oldPiece);
    expect(projectKittyDesign(doc).pieces[0]!.strokes[0]!.actorId).toBeNull();
    expect(migrateLegacyKittyStudio("studio-a", scope, old, "migration-a", doc)).toBe(doc);
    expect(() => migrateLegacyKittyStudio("studio-a", scope, { ...old, fired: [] }, "migration-a", doc)).toThrow();
    expect(restoreKittyDesignCheckpoint(checkpointKittyDesign(doc))).toEqual(doc);
    const reopened = acceptKittyDesignOperation(doc, intent("reopen-old", { kind: "reopen", expectedRevision: 0 }, { pieceId: "old-cat" }), { environment: scope.environment, householdId: scope.householdId, actorId: "bob", order: 1, acceptedAt: time }).document;
    expect(displayedKittyDesignPiece(reopened)?.id).toBe("old-cat"); expect(displayedKittyDesignPiece(reopened)?.paint).toEqual(oldPiece.paint);
  });

  it("display selection and archive have their own exact conflicts and retain the archived history", () => {
    const s = studio(); s.send(intent("second", { kind: "create-piece", base: "rose" }, { pieceId: "cat-b" }));
    s.send(intent("select-b", { kind: "select-display", expectedDisplayRevision: 1 }, { pieceId: "cat-b" }), "bob");
    expect(displayedKittyDesignPiece(s.doc())?.id).toBe("cat-b");
    expect(() => s.send(intent("stale-select", { kind: "select-display", expectedDisplayRevision: 1 }))).toThrow("displayed piece changed");
    s.send(intent("archive-b", { kind: "archive-piece", expectedRevision: 2 }, { pieceId: "cat-b" }));
    expect(displayedKittyDesignPiece(s.doc())).toBeNull(); expect(s.piece("cat-b").status).toBe("archived");
    expect(snapshotKittyDesignRevision(s.doc(), "cat-b", 2).piece.id).toBe("cat-b");
  });

  it("dip edits and an author's undo preserve independent part choices", () => {
    const s = studio();
    s.send(intent("base", { kind: "change-dip", part: "base", color: "rose", expectedFieldRevision: 0 }));
    s.send(intent("head", { kind: "change-dip", part: "head", color: "#0000bb", expectedFieldRevision: 0 }), "bob");
    s.send(intent("undo-base", { kind: "undo-gesture", targetGestureId: "gesture-base", expectedGestureRevision: 2 }));
    expect(s.piece().piece.paint).toMatchObject({ base: "cream", parts: { head: "#0000bb" } });
  });
});

describe("Hearthside closed creative command and checkpoint boundaries", () => {
  it("rejects client authorship, server order, unknown versions, extra payloads, and prototype keys", () => {
    const op = paint("a");
    for (const input of [{ ...op, actorId: "bob" }, { ...op, order: 1 }, { ...op, version: 2 }, { ...op, money: 100 }, { ...op, stroke: { ...stroke("#ffffff"), url: "https://example.invalid" } }, JSON.parse(JSON.stringify(op).replace('"version":1', '"version":1,"__proto__":{}'))]) {
      expect(() => decodeKittyDesignOperation(input)).toThrow();
    }
    expect(() => decodeKittyDesignOperation({ ...op, kind: "replace-piece" })).toThrow("Reload Hearth");
    const sparse = [0.1, , 0.3, 0.4];
    expect(() => decodeKittyDesignOperation({ ...op, stroke: { ...stroke("#ffffff"), pts: sparse } })).toThrow("dense arrays");
    let read = false;
    const getter = { ...stroke("#ffffff"), get pts() { read = true; return [0.1, 0.2]; } };
    expect(() => decodeKittyDesignOperation({ ...op, stroke: getter })).toThrow("plain values");
    expect(read).toBe(false);
  });

  it("separates environments, household identity, and member-owned design access", () => {
    const s = studio();
    for (const auth of [{ environment: "production" as const, householdId: "couple-a", actorId: "alice" }, { environment: "development" as const, householdId: "couple-b", actorId: "alice" }]) {
      expect(() => acceptKittyDesignOperation(s.doc(), paint("scope"), { ...auth, order: 2, acceptedAt: time })).toThrow("another household");
    }
    const privateDoc = createKittyDesignDocument("studio-a", { ...scope, ownerMemberId: "alice" });
    expect(() => acceptKittyDesignOperation(privateDoc, intent("create", { kind: "create-piece", base: "cream" }), { environment: scope.environment, householdId: scope.householdId, actorId: "bob", order: 1, acceptedAt: time })).toThrow("another household");
    expect(() => s.invalidAuthority(paint("extra-authority-field"))).toThrow("Unexpected");
  });

  it("does not mutate the accepted document or snapshots through render consumer objects", () => {
    const s = studio(); s.send(paint("a")); const original = checkpointKittyDesign(s.doc());
    const view = s.view(); view.pieces[0]!.piece.paint.strokes[0]!.pts[0] = 0.9; view.pieces[0]!.strokes[0]!.surface.sculpt.tail = "none";
    expect(checkpointKittyDesign(s.doc())).toBe(original);
  });

  it("refuses malformed checkpoints and histories with reused or reordered authority events", () => {
    const s = studio(); s.send(paint("a"));
    const altered = (mutate: (d: KittyDesignDocument) => void) => { const d = structuredClone(s.doc()); mutate(d); return JSON.stringify({ version: 1, kind: "kitty-design-checkpoint", document: d }); };
    expect(() => restoreKittyDesignCheckpoint(altered((d) => { d.revision = 999; }))).toThrow("revision does not match");
    expect(() => restoreKittyDesignCheckpoint(altered((d) => { d.operations.push(d.operations[1]!); }))).toThrow("repeats");
    expect(() => restoreKittyDesignCheckpoint(altered((d) => { d.operations[1]!.order = 0; }))).toThrow("fresh accepted order");
    expect(() => restoreKittyDesignCheckpoint(altered((d) => { d.operations[1]!.actorId = ""; }))).toThrow();
    expect(() => snapshotKittyDesignRevision(s.doc(), "cat-a", 999)).toThrow("not in the retained history");
  });

  it("keeps inactive paint within limits and refuses extra accepted marks without erasing either author", () => {
    const s = studio();
    const dense = { ...stroke("#aa0000"), pts: Array.from({ length: 12000 }, (_, i) => i % 2 ? 0.5 : 0.3) };
    s.send(intent("dense", { kind: "append-stroke", surfaceRevision: 0, stroke: dense }));
    s.send(intent("undo-dense", { kind: "undo-gesture", targetGestureId: "gesture-dense", expectedGestureRevision: 2 }));
    const accepted = checkpointKittyDesign(s.doc());
    expect(() => s.send(paint("over-limit"), "bob")).toThrow("paint limit");
    expect(checkpointKittyDesign(s.doc())).toBe(accepted);
    s.send(intent("redo-dense", { kind: "redo-gesture", targetGestureId: "gesture-dense", expectedGestureRevision: 3 }));
    expect(s.piece().piece.paint.strokes[0]!.pts).toHaveLength(12000);
  });
});
