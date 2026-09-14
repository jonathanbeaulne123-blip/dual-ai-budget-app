// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import type { KittyPaintV1, KittyStampV1, KittyStrokeV1 } from "../src/core/types.ts";
import { KITTY_PARTS, defaultKittyPaint, newKittyPiece } from "../src/core/kittyStudio.ts";
import type { FundPulseState } from "../src/core/fundPulse.ts";
import { allocateNestTotal, projectKittyNest } from "../src/core/kittyNest.ts";
import { queenBanks, queenStill } from "../src/core/queenPresentation.ts";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import {
  QUEEN_GLAZE_AXIS, QUEEN_PAINTABLE_PARTS, QUEEN_RESERVED_CHANNELS, QueenAuthoringError,
  guardQueenDesignSave, queenBankFired, queenBankPiece, queenGlazeAxis, queenLook, queenPose, queenSanitizePaint, queenStampAllowed, queenWorldStill,
} from "../src/queen/world/queenAuthoring.ts";
import { createQueenSculpture } from "../src/queen/world/queenSculpture.ts";
import { createNestSculptedProp } from "../src/kitty/nestSculpture.ts";

const STATES: FundPulseState[] = ["checking", "reset", "needs-us", "covered", "building"];
const stroke = (part: KittyStrokeV1["part"]): KittyStrokeV1 => ({ part, tool: "brush", color: "#b33a63", size: 40, opacity: 1, mirror: true, pts: [0.5, 0.5, 0.6, 0.6] });
const stamp = (over: Partial<KittyStampV1>): KittyStampV1 => ({ id: `s-${Math.random()}`, anchor: "belly", part: "body", u: 0.5, v: 0.6, kind: "heart", color: "#b33a63", size: 0.3, rotation: 0, ...over });
/** A paint that tries every part, every reserved zone and every impersonating kind. */
function everywherePaint(): KittyPaintV1 {
  return {
    base: "midnight",
    parts: Object.fromEntries(KITTY_PARTS.map((part) => [part, "#111111"])),
    strokes: KITTY_PARTS.map(stroke),
    stamps: [
      stamp({ part: "body", v: 0.6 }),
      stamp({ part: "head", v: 0.3, kind: "star" }),
      stamp({ part: "head", v: 0.9, kind: "star" }),
      stamp({ part: "head", v: 0.3, kind: "crown" }),
      stamp({ part: "head", v: 0.4, kind: "glasses" }),
      stamp({ part: "earL", v: 0.5, anchor: "leftEar" }),
      stamp({ part: "tail", v: 0.5, anchor: "tailTip" }),
      stamp({ part: "paws", v: 0.5, anchor: "chest" }),
    ],
  };
}

describe("The Queen in the studio — what is hers and theirs, and what is reserved", () => {
  it("names every reserved channel with the reading it carries", () => {
    expect(QUEEN_RESERVED_CHANNELS.map((row) => row.id)).toEqual(["vine", "posture", "fill", "eyes", "crown", "seams", "hands", "feet", "glaze", "rings"]);
    for (const row of QUEEN_RESERVED_CHANNELS) expect(row.reading).toMatch(/\S/);
    expect(QUEEN_PAINTABLE_PARTS).toEqual(["body", "head"]);
  });

  it("keeps colour, pattern and marks on her body and head, and drops everything aimed elsewhere", () => {
    const paint = queenSanitizePaint(everywherePaint());
    expect(paint.base).toBe("midnight");
    expect(Object.keys(paint.parts).sort()).toEqual(["body", "head"]);
    expect(paint.strokes.map((row) => row.part)).toEqual(["body", "head"]);
    expect(paint.strokes.every((row) => row.mirror === false)).toBe(true);
    expect(paint.stamps.map((row) => `${row.part}:${row.kind}:${row.v}`)).toEqual(["body:heart:0.6", "head:star:0.3"]);
  });

  it("refuses a stamp on each reserved zone individually: the crown, the eyes and brow, the ears she has not got, the tail, the paws", () => {
    expect(queenStampAllowed(stamp({ part: "head", v: 0.9, kind: "star" }))).toBe(false); // the crown's seat
    expect(queenStampAllowed(stamp({ part: "head", v: 0.6, kind: "star" }))).toBe(false); // the eyes and brow
    expect(queenStampAllowed(stamp({ part: "head", v: 0.3, kind: "crown" }))).toBe(false); // a false crown anywhere
    for (const kind of ["party-hat", "sun-hat", "beanie", "glasses", "sunglasses"] as const) expect(queenStampAllowed(stamp({ kind, part: "head", v: 0.3 }))).toBe(false);
    expect(queenStampAllowed(stamp({ part: "earL", anchor: "leftEar" }))).toBe(false);
    expect(queenStampAllowed(stamp({ part: "tail", anchor: "tailTip" }))).toBe(false);
    expect(queenStampAllowed(stamp({ part: "paws", anchor: "chest" }))).toBe(false);
    expect(queenStampAllowed(stamp({ part: "body", v: 0.6 }))).toBe(true);
    expect(queenStampAllowed(stamp({ part: "head", v: 0.3, kind: "moon" }))).toBe(true);
    // Anchor-only stamps resolve through the same placement.
    expect(queenStampAllowed({ ...stamp({}), part: undefined, u: undefined, v: undefined, anchor: "forehead" })).toBe(false);
    expect(queenStampAllowed({ ...stamp({}), part: undefined, u: undefined, v: undefined, anchor: "belly" })).toBe(true);
  });

  it("owns the glaze axis: freshness decides the surface and firedAt is ignored", () => {
    expect(queenGlazeAxis("glazed")).toEqual(QUEEN_GLAZE_AXIS.glazed);
    expect(queenGlazeAxis("current")).toEqual(QUEEN_GLAZE_AXIS.glazed);
    expect(queenGlazeAxis("matte")).toEqual(QUEEN_GLAZE_AXIS.matte);
    expect(queenGlazeAxis("offline")).toEqual(QUEEN_GLAZE_AXIS.matte);
    expect(queenGlazeAxis("stale")).toEqual(QUEEN_GLAZE_AXIS.matte);
    // The same axis a kitty bank uses for fired versus unfired clay.
    expect(QUEEN_GLAZE_AXIS.glazed).toMatchObject({ roughness: 0.23, clearcoat: 1 });
    expect(QUEEN_GLAZE_AXIS.matte).toMatchObject({ roughness: 0.86, clearcoat: 0 });
    const fired = newKittyPiece("k", "2026-09-01T00:00:00.000Z", "rose");
    const look = queenLook({ glaze: "rose", studio: { version: 1, draft: null, fired: [{ ...fired, firedAt: "2026-09-02T00:00:00.000Z" }], displayId: fired.id } });
    expect(look.base).toBe("rose");
    // Nothing about firedAt reaches the axis: the look carries paint only.
    expect(Object.keys(look)).toEqual(["paint", "base"]);
  });

  it("reads her look draft-first, because she is never final", () => {
    const draft = newKittyPiece("d", "2026-09-03T00:00:00.000Z", "sea-glass");
    const fired = { ...newKittyPiece("f", "2026-09-01T00:00:00.000Z", "midnight"), firedAt: "2026-09-02T00:00:00.000Z" };
    expect(queenLook({ glaze: "cream", studio: { version: 1, draft, fired: [fired], displayId: "f" } }).base).toBe("sea-glass");
    expect(queenLook({ glaze: "cream", studio: { version: 1, draft: null, fired: [fired], displayId: "f" } }).base).toBe("midnight");
    expect(queenLook(undefined).base).toBe("cream");
    expect(queenLook({ glaze: "terracotta", studio: undefined }).base).toBe("terracotta");
  });

  it("cannot be fired by any path through the world's tool", () => {
    const base = { memberId: "MEM-001", view: "household" as const, bankKey: "king", expectedRevision: 0, name: "Our Queen", glaze: "cream" as const };
    expect(() => guardQueenDesignSave({ ...base, fire: true })).toThrow(QueenAuthoringError);
    expect(() => guardQueenDesignSave({ ...base, completeSetup: true })).toThrow(QueenAuthoringError);
    expect(() => guardQueenDesignSave({ ...base, archived: true })).toThrow(QueenAuthoringError);
    expect(() => guardQueenDesignSave({ ...base, bankKey: "plan:build" })).toThrow(QueenAuthoringError);
    expect(() => guardQueenDesignSave({ ...base, view: "personal" })).toThrow(QueenAuthoringError);
    const piece = { ...newKittyPiece("q", "2026-09-01T00:00:00.000Z", "rose"), firedAt: "2026-09-02T00:00:00.000Z", firedBy: "MEM-002", paint: everywherePaint() };
    const kept = guardQueenDesignSave({ ...base, studio: { version: 1, draft: piece, fired: [] } });
    expect(kept.fire).toBe(false);
    expect(kept.completeSetup).toBe(false);
    expect(kept.studio?.draft?.firedAt).toBeNull();
    expect(kept.studio?.draft).not.toHaveProperty("firedBy");
    expect(kept.studio?.draft?.paint.strokes.map((row) => row.part)).toEqual(["body", "head"]);
    expect(kept.studio?.draft?.paint.stamps).toHaveLength(2);
    // Her sculpture offers no kiln at all.
    const queen = createQueenSculpture();
    expect((queen as unknown as { setFired?: unknown }).setFired).toBeUndefined();
    queen.dispose();
  });

  it("gives every pulse state a distinct, non-empty still in both the flat and the 3D path", () => {
    const stills = STATES.map((state) => queenStill({ state, destination: state === "needs-us" ? "together" : "fund" }, "current"));
    const flat = stills.map((still) => still.description);
    const world = stills.map((still) => queenWorldStill(still));
    expect(new Set(flat).size).toBe(STATES.length);
    expect(new Set(world).size).toBe(STATES.length);
    for (const words of world) { expect(words).toMatch(/In the world: body/); expect(words).toMatch(/surface (glazed|matte)/); }
    const grave = queenWorldStill(queenStill({ state: "needs-us", destination: "fund" }, "current"));
    expect(grave).toMatch(/82% scale/);
    expect(grave).toMatch(/eyes open toward body/);
    expect(queenWorldStill(queenStill({ state: "checking", destination: "status" }, "stale"))).toMatch(/matte and unglazed/);
    expect(queenWorldStill(queenStill({ state: "checking", destination: "status" }, "offline"))).toMatch(/offline/);
    // The pose is numbers the body group can take, not colours.
    for (const still of stills) { const pose = queenPose(still); expect(pose.scale).toBeGreaterThan(0.5); expect(Math.abs(pose.lean)).toBeLessThan(0.1); }
  });
});

describe("The Queen as a sculpture — reserved geometry the paint never reaches", () => {
  it("keeps every reserved channel on its own material, with no texture map, whatever is painted", () => {
    const queen = createQueenSculpture();
    const paintables = new Set([queen.materials.body, queen.materials.head]);
    const reservedObjects = [queen.reserved.vine, queen.reserved.crown, queen.reserved.face, queen.reserved.hands, queen.reserved.feet, ...queen.reserved.seams];
    const before = new Map<string, string>();
    for (const root of reservedObjects) root.traverse((object) => {
      const mesh = object as { isMesh?: boolean; material?: { map?: unknown; color?: { getHexString(): string } }; name: string };
      if (!mesh.isMesh || !mesh.material) return;
      expect(paintables.has(mesh.material as never), `${mesh.name} must not share the paintable materials`).toBe(false);
      expect(mesh.material.map, `${mesh.name} carries no paint texture`).toBeFalsy();
      before.set(mesh.name + object.id, mesh.material.color?.getHexString() ?? "");
    });
    queen.setPaint(everywherePaint());
    for (const root of reservedObjects) root.traverse((object) => {
      const mesh = object as { isMesh?: boolean; material?: { color?: { getHexString(): string } }; name: string };
      if (!mesh.isMesh || !mesh.material) return;
      expect(mesh.material.color?.getHexString() ?? "", `${mesh.name} keeps its colour under any paint`).toBe(before.get(mesh.name + object.id));
    });
    // Paintable parts did take the paint (in this environment without a 2D canvas, as a flat dip).
    expect(queen.materials.body.color.getHexString()).not.toBe("ffffff");
    queen.dispose();
  });

  it("keeps the vine, the crown, the eyes, the seams, the hands and the feet present and readable under any paint or pose", () => {
    const queen = createQueenSculpture();
    queen.setPaint(everywherePaint());
    queen.setPose(queenPose(queenStill({ state: "needs-us", destination: "fund" }, "current")));
    queen.setVine(true, 3, 2);
    queen.setSeams(2);
    queen.setFeet(["near", "later"]);
    queen.setCrown(true);
    expect(queen.reserved.vine.children.filter((child) => child.visible && child.name === "queen-leaf")).toHaveLength(4);
    expect(queen.reserved.vine.children.filter((child) => child.visible && child.name === "queen-bud")).toHaveLength(2);
    expect(queen.reserved.crownLight.intensity).toBeGreaterThan(0);
    expect(queen.reserved.eyesOpen.visible).toBe(true);
    expect(queen.reserved.eyesClosed.visible).toBe(false);
    expect(queen.reserved.seams.filter((seam) => seam.visible)).toHaveLength(2);
    expect(queen.reserved.stones.filter((stone) => stone.visible)).toHaveLength(2);
    expect(queen.reserved.hands.visible).toBe(true);
    expect(queen.group.getObjectByName("queen-body")?.scale.x).toBeCloseTo(0.82);
    // Nothing the paint carries can hide them: paint touches only body and head materials.
    queen.setPaint({ ...defaultKittyPaint("midnight"), stamps: [stamp({ part: "head", v: 0.9, kind: "crown" })] });
    expect(queen.reserved.crown.visible).toBe(true);
    expect(queen.reserved.crownLight.intensity).toBeGreaterThan(0);
    queen.setCrown(false);
    expect(queen.reserved.crownLight.intensity).toBe(0);
    queen.setVine(false, 0, 0);
    expect(queen.reserved.vine.visible).toBe(true);
    expect(queen.reserved.vine.scale.x).toBeCloseTo(0.56);
    queen.dispose();
  });

  it("widens the belly with fill and follows freshness on the surface, never a kiln", () => {
    const queen = createQueenSculpture();
    queen.setFill(0);
    expect(queen.reserved.belly.scale.x).toBeCloseTo(0.86);
    queen.setFill(10);
    expect(queen.reserved.belly.scale.x).toBeCloseTo(1);
    queen.setGlaze(QUEEN_GLAZE_AXIS.matte);
    expect(queen.materials.body.roughness).toBe(0.86);
    expect(queen.materials.body.clearcoat).toBe(0);
    expect(queen.materials.reservedClay.roughness).toBe(0.86);
    queen.setGlaze(QUEEN_GLAZE_AXIS.glazed);
    expect(queen.materials.head.roughness).toBe(0.23);
    expect(queen.materials.head.clearcoat).toBe(1);
    queen.dispose();
  });

  it("disposes every geometry, material and texture on unmount and retains nothing", () => {
    const queen = createQueenSculpture();
    const counts = queen.counts();
    expect(counts.geometries).toBeGreaterThan(20);
    expect(counts.materials).toBeGreaterThan(8);
    const disposed: string[] = [];
    queen.group.traverse((object) => {
      const mesh = object as { isMesh?: boolean; geometry?: { dispose: () => void }; material?: { dispose: () => void } };
      if (!mesh.isMesh) return;
      if (mesh.geometry) vi.spyOn(mesh.geometry, "dispose").mockImplementation(() => { disposed.push("geometry"); });
      if (mesh.material && !("__spied" in mesh.material)) { (mesh.material as { __spied?: true }).__spied = true; vi.spyOn(mesh.material, "dispose").mockImplementation(() => { disposed.push("material"); }); }
    });
    queen.dispose();
    expect(queen.disposed).toBe(true);
    expect(queen.counts()).toEqual({ geometries: 0, materials: 0, textures: 0 });
    expect(disposed.filter((row) => row === "geometry").length).toBe(counts.geometries);
    expect(disposed.filter((row) => row === "material").length).toBeGreaterThanOrEqual(counts.materials - 1);
    expect(queen.group.children).toHaveLength(0);
    queen.dispose();
  });
});

describe("Banks in the world — studio sculptures, fired reads fired, money untouched", () => {
  it("wears the piece its owner authored, and fired versus unfired resolves to different material parameters", () => {
    const h = planLifeFixture("household");
    const nest = projectKittyNest(h, "MEM-001", "household", "2026-09-12");
    const protect = nest.categories.find((bank) => bank.category === "protect")!;
    const piece = queenBankPiece(protect);
    expect(piece.sculpt.body).toBe("loaf");
    expect(queenBankFired(piece)).toBe(false);
    expect(queenBankFired({ firedAt: "2026-09-02T00:00:00.000Z" })).toBe(true);
    const ornament = { tier: "plan" as const, category: "protect" as const, theme: "classic" };
    const fired = createNestSculptedProp(ornament, true), unfired = createNestSculptedProp(ornament, false);
    const material = (prop: typeof fired) => (prop.group.children[0] as unknown as { material: { roughness: number; clearcoat: number } }).material;
    expect(material(fired)).toMatchObject({ roughness: 0.23, clearcoat: 1 });
    expect(material(unfired)).toMatchObject({ roughness: 0.86, clearcoat: 0 });
    fired.dispose(); unfired.dispose();
  });

  it("keeps conservation exactly where the nest guarantees it", () => {
    const h = planLifeFixture("household");
    const nest = projectKittyNest(h, "MEM-001", "household", "2026-09-12");
    const banks = queenBanks(nest);
    const shown = [...banks.protect.banks, ...banks.whatnow.banks, ...banks.build.banks];
    expect(shown.reduce((sum, bank) => sum + bank.amountCents, 0)).toBe(nest.king.amountCents);
    for (const total of [0, 1, 12345, -50000]) {
      const allocation = allocateNestTotal(total, { build: 400, protect: 900, prepare: 250 });
      expect(allocation.protect + allocation.prepare + allocation.everyday + allocation.build).toBe(total);
    }
  });
});
