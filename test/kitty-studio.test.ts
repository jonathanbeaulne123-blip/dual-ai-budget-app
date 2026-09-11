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
import { KITTY_STUDIO_LIMITS, newKittyPiece, quantizeKittyStroke, shapeKittyStudio } from "../src/core/kittyStudio.ts";
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
    expect(quantizeKittyStroke({ part: "body", tool: "brush", color: "#000000", size: 900, opacity: 4, mirror: false, pts: [1.5, -1] }).size).toBe(64);
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
  it("fires a draft through the command, stamps firedAt/firedBy, and refuses to change a fired piece", () => {
    let h = save(planLifeFixture("personal"), studio(piece("clay")));
    expect(first(h).envelope!.studio!.draft!.firedAt).toBeNull();
    h = save(h, undefined, { fire: true });
    const fired = first(h).envelope!.studio!;
    expect(fired.draft).toBeNull();
    expect(fired.fired).toHaveLength(1);
    expect(fired.fired[0]!.firedBy).toBe(memberId);
    expect(Number.isFinite(Date.parse(fired.fired[0]!.firedAt!))).toBe(true);
    expect(() => save(h, undefined, { fire: true })).toThrow(/no unfired clay/);
    const tampered = structuredClone(h);
    tampered.goals[0]!.envelope!.studio!.fired[0]!.paint.base = "#000000";
    expect(() => assertGoalEnvelopeTransition(h, tampered)).toThrow(/final/);
    const removed = structuredClone(h);
    removed.goals[0]!.envelope!.studio!.fired = [];
    expect(() => assertGoalEnvelopeTransition(h, removed)).toThrow(/final/);
    const unmade = structuredClone(h);
    delete unmade.goals[0]!.envelope!.studio;
    expect(() => assertGoalEnvelopeTransition(h, unmade)).toThrow(/un-made/);
    expect(() => save(h, { ...fired, fired: [{ ...fired.fired[0]!, paint: { ...fired.fired[0]!.paint, base: "#111111" } }] })).toThrow(/final/);
    // Throw another: a new draft beside the untouched shelf is fine.
    const again = save(h, { ...fired, draft: piece("second") });
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
    expect(() => save(h, undefined, { fire: true })).toThrow(/shelf is full/);
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
