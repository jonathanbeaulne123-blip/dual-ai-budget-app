import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { planLifeFixture } from "./fixtures/plan-life.ts";
import {
  addGoal,
  allocateHouseholdFundSurplus,
  assembleHousehold,
  fundGoal,
  purchaseGoal,
  saveGoalEnvelope,
  splitForSync,
  type Household,
  type KittyPieceV1,
  type KittyStudioV1,
} from "../src/core/index.ts";
import { kittyBankBackingStep, kittyBankStep } from "../src/core/kittyBanks.ts";
import { defaultGoalEnvelope, shapeGoalEnvelope, assertGoalEnvelopeTransition } from "../src/core/goalEnvelopes.ts";
import { KITTY_ADDON_KINDS, KITTY_STAMP_KINDS, KITTY_STUDIO_LIMITS, displayedKittyPiece, kittyFeature, newKittyPiece, quantizeKittyStroke, removeKittyPiece, reopenKittyPiece, shapeKittyStudio, withKittyFeature } from "../src/core/kittyStudio.ts";
import { STAMP_ART, nearestKittyAnchor, stampPlacement, stampTrim } from "../src/kitty/studio/stampArt.ts";
import { financialAuditHash } from "../src/core/commandIdentity.ts";
import { STUDIO_PALETTE } from "../src/kitty/studio/palette.ts";

const date = "2026-09-11", memberId = "MEM-001";
const first = (h: Household) => h.goals[0]!;
const piece = (id = "piece-1", extra: Partial<KittyPieceV1> = {}): KittyPieceV1 => ({
  ...newKittyPiece(id, "2026-09-11T10:00:00.000Z", "marigold-is-not-a-glaze-name"),
  ...extra,
  paint: {
    base: "#e3a534",
    parts: { head: "#4a2e4d" },
    strokes: [{ part: "body", tool: "brush", color: "#a3283d", size: 12, opacity: 0.8, mirror: true, pts: [0.1, 0.2, 0.3, 0.4] }],
    stamps: [{ id: "s1", anchor: "forehead", kind: "initial", color: "#2b2926", size: 0.2, rotation: 15, text: "JB" }],
    ...(extra.paint ?? {}),
  },
});
const studio = (draft: KittyPieceV1 | null, fired: KittyPieceV1[] = []): KittyStudioV1 => ({ version: 1, draft, fired });
const save = (h: Household, studioValue: KittyStudioV1 | undefined, extra: { fire?: boolean; createdBy?: string } = {}) => {
  const goal = first(h);
  return saveGoalEnvelope(h, {
    goalId: goal.id,
    expectedUpdatedAt: goal.updatedAt,
    name: goal.name,
    target: goal.targetCents / 100,
    arrivalDate: goal.arrivalDate,
    envelope: { ...(goal.envelope ?? defaultGoalEnvelope()), ...(studioValue ? { studio: studioValue } : {}) },
    createdBy: extra.createdBy ?? memberId,
    ...(extra.fire ? { fire: true } : {}),
  }).household;
};

describe("Kitty Bank Studio pieces", () => {
  it("shapes a valid studio, quantizes stroke points and keeps legacy glaze in step with the dip", () => {
    const shaped = shapeGoalEnvelope({ ...defaultGoalEnvelope(), glaze: "rose", studio: studio(piece("d", { paint: { base: "midnight", parts: {}, strokes: [{ part: "head", tool: "marker", color: "#ffffff", size: 3.14159, opacity: 0.333333, mirror: false, pts: [0.123456, 0.98765] }], stamps: [] } })) })!;
    expect(shaped.glaze).toBe("midnight");
    expect(shaped.studio!.draft!.paint.strokes[0]!.pts).toEqual([0.123, 0.988]);
    expect(shaped.studio!.draft!.paint.strokes[0]!.size).toBe(3.1);
    expect(shaped.studio!.draft!.paint.strokes[0]!.opacity).toBe(0.33);
    const hexOnly = shapeGoalEnvelope({ ...defaultGoalEnvelope(), glaze: "rose", studio: studio(piece()) })!;
    expect(hexOnly.glaze).toBe("rose");
    expect(hexOnly.studio!.draft!.paint.base).toBe("#e3a534");
    expect(shapeGoalEnvelope(defaultGoalEnvelope())!.studio).toBeUndefined();
    expect(quantizeKittyStroke({ part: "body", tool: "brush", color: "#000000", size: 900, opacity: 4, mirror: false, pts: [1.5, -1] }).size).toBe(96);
  });
  it("rejects bad enums, non-finite numbers, oversize caps and unknown studio versions", () => {
    const bad = (value: unknown) => expect(() => shapeGoalEnvelope({ ...defaultGoalEnvelope(), studio: value })).toThrow(/compatible envelope reader/);
    bad({ version: 2, draft: null, fired: [] });
    bad(studio(piece("x", { sculpt: { ...newKittyPiece("x", date).sculpt, head: "cube" as never } })));
    bad(studio(piece("x", { sculpt: { ...newKittyPiece("x", date).sculpt, profile: [1, 1, 1, Number.NaN] } })));
    bad(studio(piece("x", { sculpt: { ...newKittyPiece("x", date).sculpt, profile: [1, 1, 1, 2] } })));
    bad(studio(piece("x", { paint: { base: "not-a-colour", parts: {}, strokes: [], stamps: [] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: { nose: "#ffffff" } as never, strokes: [], stamps: [] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [{ part: "body", tool: "brush", color: "red", size: 2, opacity: 1, mirror: false, pts: [0, 0] }], stamps: [] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [{ part: "body", tool: "brush", color: "#ff0000", size: 2, opacity: 1, mirror: false, pts: [0, 0, 0.5] }], stamps: [] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [], stamps: [{ id: "a", anchor: "nowhere" as never, kind: "star", color: "#ff0000", size: 0.2, rotation: 0 }] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [], stamps: [{ id: "a", anchor: "chest", kind: "initial", color: "#ff0000", size: 0.2, rotation: 0 }] } })));
    const stroke = { part: "body" as const, tool: "brush" as const, color: "#ff0000", size: 2, opacity: 1, mirror: false, pts: [0, 0, 1, 1] };
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: Array.from({ length: KITTY_STUDIO_LIMITS.strokes + 1 }, () => stroke), stamps: [] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [{ ...stroke, pts: Array.from({ length: (KITTY_STUDIO_LIMITS.points + 1) * 2 }, () => 0.5) }], stamps: [] } })));
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [], stamps: Array.from({ length: KITTY_STUDIO_LIMITS.stamps + 1 }, (_, i) => ({ id: `s${i}`, anchor: "chest" as const, kind: "star" as const, color: "#ff0000", size: 0.2, rotation: 0 })) } })));
    bad(studio(null, Array.from({ length: KITTY_STUDIO_LIMITS.fired + 1 }, (_, i) => piece(`f${i}`, { firedAt: date }))));
    bad(studio(piece("dup"), [piece("dup", { firedAt: date })]));
    bad(studio(piece("unfired", { firedAt: date })));
    bad(studio(null, [piece("still-wet")]));
    expect(shapeKittyStudio(undefined)).toBeUndefined();
  });
  it("rides in the shared half of the household, leaves the financial identity alone and survives round-trip", async () => {
    const h = planLifeFixture("household");
    const before = await financialAuditHash(h);
    const next = save(h, studio(piece("shared-draft")));
    expect(await financialAuditHash(next)).toBe(before);
    const split = splitForSync(next, memberId);
    expect(JSON.stringify(split.shared)).toContain("shared-draft");
    expect(JSON.stringify(split.personal)).not.toContain("shared-draft");
    const partner = splitForSync(next, "MEM-002");
    expect(JSON.stringify(partner.shared)).toContain("shared-draft");
    const restored = assembleHousehold(split.shared, split.personal).goals.find((row) => row.id === first(h).id)!;
    expect(restored.envelope?.studio?.draft?.id).toBe("shared-draft");
    expect(restored.envelope?.studio?.draft?.paint.stamps[0]?.text).toBe("JB");
  });
  it("fires a draft through the command, stamps firedAt/firedBy, and lets a fired piece be repainted, refired or thrown away", () => {
    let h = save(planLifeFixture("personal"), studio(piece("clay")));
    expect(first(h).envelope!.studio!.draft!.firedAt).toBeNull();
    h = save(h, undefined, { fire: true });
    const fired = first(h).envelope!.studio!;
    expect(fired.draft).toBeNull();
    expect(fired.fired).toHaveLength(1);
    expect(fired.fired[0]!.firedBy).toBe(memberId);
    expect(Number.isFinite(Date.parse(fired.fired[0]!.firedAt!))).toBe(true);
    expect(() => save(h, undefined, { fire: true })).toThrow(/no unfired clay/);
    expect(fired.displayId).toBe("clay");
    // Nothing is final (2026-09-12): a fired piece goes back to the wheel, is
    // repainted, fired again with a higher count, and can leave the shelf.
    const back = reopenKittyPiece(fired, "clay");
    expect(back.draft!.firedAt).toBeNull();
    expect(back.fired).toHaveLength(0);
    let again2 = save(h, { ...back, draft: { ...back.draft!, paint: { ...back.draft!.paint, base: "#111111" } } });
    expect(again2.goals[0]!.envelope!.studio!.draft!.paint.base).toBe("#111111");
    again2 = save(again2, undefined, { fire: true });
    const refired = again2.goals[0]!.envelope!.studio!;
    expect(refired.fired).toHaveLength(1);
    expect(refired.fired[0]!.firings).toBe(2);
    expect(refired.fired[0]!.paint.base).toBe("#111111");
    const emptied = save(again2, removeKittyPiece(refired, "clay"));
    expect(emptied.goals[0]!.envelope!.studio!.fired).toHaveLength(0);
    expect(() => assertGoalEnvelopeTransition(again2, emptied)).not.toThrow();
    // Throw another: a new draft beside the shelf is fine.
    const again = save(h, { ...fired, displayId: null, draft: piece("second") });
    expect(again.goals[0]!.envelope!.studio!.fired[0]).toEqual(fired.fired[0]);
    expect(again.goals[0]!.envelope!.studio!.draft!.id).toBe("second");
    // Another member cannot fire a personal bank.
    expect(() => save(again, undefined, { fire: true, createdBy: "MEM-002" })).toThrow(/outside/);
  });
  it("caps the fired shelf at six through the command", () => {
    let h = planLifeFixture("personal");
    for (let i = 0; i < KITTY_STUDIO_LIMITS.fired; i++) h = save(save(h, { ...(first(h).envelope?.studio ?? { version: 1, draft: null, fired: [] }), draft: piece(`p${i}`) }), undefined, { fire: true });
    expect(first(h).envelope!.studio!.fired).toHaveLength(6);
    h = save(h, { ...first(h).envelope!.studio!, draft: piece("seventh") });
    expect(() => save(h, undefined, { fire: true })).toThrow(/Take one off the shelf/);
  });
  it("carries feature dials, free-placed extras and a chosen display piece", () => {
    const dialled = shapeGoalEnvelope({
      ...defaultGoalEnvelope(),
      studio: studio(piece("dials", { sculpt: { ...newKittyPiece("dials", date).sculpt, features: { eyes: 1.45, head: 1, tail: 0.6 } } })),
    })!;
    // A dial sitting at 1 is the default and is not stored.
    expect(dialled.studio!.draft!.sculpt.features).toEqual({ eyes: 1.45, tail: 0.6 });
    expect(kittyFeature(dialled.studio!.draft!.sculpt, "eyes")).toBe(1.45);
    expect(kittyFeature(dialled.studio!.draft!.sculpt, "head")).toBe(1);
    expect(withKittyFeature(dialled.studio!.draft!.sculpt, "eyes", 1).features).toEqual({ tail: 0.6 });
    const bad = (value: unknown) => expect(() => shapeGoalEnvelope({ ...defaultGoalEnvelope(), studio: value })).toThrow(/compatible envelope reader/);
    bad(studio(piece("x", { sculpt: { ...newKittyPiece("x", date).sculpt, features: { eyes: 4 } } })));
    bad(studio(piece("x", { sculpt: { ...newKittyPiece("x", date).sculpt, features: { ears: Number.NaN } } })));
    bad(studio(piece("x", { sculpt: { ...newKittyPiece("x", date).sculpt, features: { elbow: 1.2 } as never } })));
    // An add-on baked anywhere keeps its own part and uv, plus the nearest anchor for older readers.
    const worn = shapeGoalEnvelope({
      ...defaultGoalEnvelope(),
      studio: studio(piece("worn", {
        paint: { base: "#e3a534", parts: {}, strokes: [], stamps: [{ id: "hat", anchor: "forehead", part: "head", u: 0.41, v: 0.88, kind: "sun-hat", color: "#a3283d", trim: "#2b2926", size: 0.5, rotation: -20 }] },
      })),
    })!;
    const stamp = worn.studio!.draft!.paint.stamps[0]!;
    expect(stamp).toMatchObject({ kind: "sun-hat", part: "head", u: 0.41, v: 0.88, trim: "#2b2926" });
    expect(stampPlacement(stamp)).toEqual({ part: "head", u: 0.41, v: 0.88 });
    expect(nearestKittyAnchor("head", 0.41, 0.88)).toBe("forehead");
    // A legacy stamp with only an anchor still lands on that anchor's spot.
    expect(stampPlacement({ id: "s", anchor: "chest", kind: "heart", color: "#a3283d", size: 0.2, rotation: 0 })).toMatchObject({ part: "body" });
    bad(studio(piece("x", { paint: { base: "#ffffff", parts: {}, strokes: [], stamps: [{ id: "s", anchor: "chest", part: "body", u: 0.5, kind: "heart", color: "#a3283d", size: 0.2, rotation: 0 } as never] } })));
    // The bank can be told which fired piece to show.
    const shelf: KittyStudioV1 = { version: 1, draft: null, fired: [{ ...piece("old"), firedAt: date + "T10:00:00.000Z" }, { ...piece("new"), firedAt: date + "T11:00:00.000Z" }] };
    expect(displayedKittyPiece(shelf)!.id).toBe("new");
    expect(displayedKittyPiece({ ...shelf, displayId: "old" })!.id).toBe("old");
    expect(() => shapeGoalEnvelope({ ...defaultGoalEnvelope(), studio: { ...shelf, displayId: "ghost" } })).toThrow(/compatible envelope reader/);
  });
  it("draws every stamp and add-on kind from one artwork table", () => {
    for (const kind of KITTY_STAMP_KINDS) {
      if (kind === "initial") continue;
      const art = STAMP_ART[kind as Exclude<typeof kind, "initial">];
      expect(art.length, kind).toBeGreaterThan(0);
      for (const piece of art) {
        expect(piece.d, kind).toMatch(/^[Mm]/);
        // Everything stays inside the -1..1 box the placement code scales by.
        for (const n of piece.d.match(/-?\d+(\.\d+)?/g) ?? []) expect(Math.abs(Number(n)), `${kind} ${piece.d}`).toBeLessThanOrEqual(2.2);
      }
    }
    expect(KITTY_ADDON_KINDS.every((kind) => (KITTY_STAMP_KINDS as readonly string[]).includes(kind))).toBe(true);
    expect(stampTrim({ color: "#ffffff" })).not.toBe("#ffffff");
    expect(stampTrim({ color: "#a3283d", trim: "#123456" })).toBe("#123456");
  });
  it("loads a legacy envelope without studio and a new bank with one", () => {
    const h = planLifeFixture("personal");
    const created = addGoal(h, { name: "Studio bank", target: 100, shared: false, ownerMemberId: memberId, envelope: { ...defaultGoalEnvelope(), studio: studio(piece("fresh")) } });
    expect(created.household.goals.at(-1)!.envelope!.studio!.draft!.id).toBe("fresh");
    expect(first(h).envelope).toBeUndefined();
    expect(() => save(h, undefined)).not.toThrow();
  });
  it("grows with current backing toward target and slims when money is used, in shelf steps", () => {
    let h = planLifeFixture("personal");
    const goal = first(h);
    expect(kittyBankBackingStep(h, goal, date)).toBe(kittyBankStep({ savedCents: 30000, targetCents: 120000 }));
    expect(kittyBankBackingStep(h, goal, date)).toBe(2);
    h = fundGoal(h, { goalId: goal.id, amount: 300, fromAccountId: "ACC-CHEQUING", date, createdBy: memberId }).household;
    expect(kittyBankBackingStep(h, first(h), date)).toBe(5);
    h = purchaseGoal(h, { goalId: goal.id, amount: 200, date, createdBy: memberId, keepOpen: true, lines: [{ amount: 200, note: "Fictional use" }] }).household;
    expect(kittyBankBackingStep(h, first(h), date)).toBe(3);
    expect(first(h).savedCents).toBe(60000);
    expect(kittyBankBackingStep(h, { ...first(h), targetCents: 0 }, date)).toBe(0);
    const shared = planLifeFixture("household");
    expect(kittyBankBackingStep(shared, first(shared), date)).toBe(2);
    const more = allocateHouseholdFundSurplus(shared, { memberId, date, allocations: [{ goalId: first(shared).id, amount: "900" }] }).household;
    expect(kittyBankBackingStep(more, first(more), date)).toBe(10);
  });
  it("has 24 unique named glazes including the five legacy ones", () => {
    expect(STUDIO_PALETTE).toHaveLength(24);
    expect(new Set(STUDIO_PALETTE.map((row) => row.hex)).size).toBe(24);
    expect(new Set(STUDIO_PALETTE.map((row) => row.id)).size).toBe(24);
    expect(new Set(STUDIO_PALETTE.map((row) => row.name)).size).toBe(24);
    expect(STUDIO_PALETTE.filter((row) => row.legacy).map((row) => row.legacy)).toEqual(["cream", "sea-glass", "terracotta", "midnight", "rose"]);
    for (const row of STUDIO_PALETTE) expect(row.hex).toMatch(/^#[0-9a-f]{6}$/);
  });
  it("keeps hex literals out of studio CSS and TSX (palette data file excepted)", () => {
    const dir = new URL("../src/kitty/studio/", import.meta.url);
    for (const file of readdirSync(dir)) {
      if (file === "palette.ts") continue;
      const text = readFileSync(new URL(file, dir), "utf8");
      expect(text, file).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
  });
});
