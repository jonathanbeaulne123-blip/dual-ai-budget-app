// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import * as THREE from "three";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { addGoal, fundGoal, purchaseGoal, foundHouseholdCharter, signHouseholdCharter, postEntry, reversePostedMoney, saveKittyNestDesign } from "../src/core/index.ts";
import { closeChapter, openChapter, recordRitualHeld, openChapterFor } from "../src/core/chapters.ts";
import { shapeKittyPiece, newKittyPiece } from "../src/core/kittyStudio.ts";
import { allocateNestTotal, projectKittyNest } from "../src/core/kittyNest.ts";
import { queenBanks, queenStill } from "../src/core/queenPresentation.ts";
import {
  QUEEN_CHARM_KINDS, QUEEN_CHARM_LIBRARY, QUEEN_CHARM_LIMITS, QUEEN_CHARM_STARTERS, queenCharmKindsEarned, queenCharmsEarned, shapeQueenCharms, type QueenCharmKind, type QueenCharmV1,
} from "../src/core/queenCharms.ts";
import { QUEEN_RESERVED_CHANNELS, QueenAuthoringError, guardQueenDesignSave, queenSanitizeCharms, queenWornCharms, queenPose } from "../src/queen/world/queenAuthoring.ts";
import {
  QUEEN_CHARM_KEYBOARD_SEATS, QUEEN_CHARM_UNIT, QUEEN_HEAD, QUEEN_SEAM_PATHS, QUEEN_SKIRT_PROFILE,
  queenCharmAllowed, queenCharmFlatPick, queenCharmFlatSeat, queenCharmFreeSeat, queenCharmNudge, queenCharmRefusal, queenCharmSettle, queenSurfaceSeat, queenSurfaceUv,
} from "../src/queen/world/queenCharmSurface.ts";
import { createQueenSculpture } from "../src/queen/world/queenSculpture.ts";
import { buildCharmGeometry } from "../src/queen/world/queenCharmLibrary.ts";
import { QueenFigure } from "../src/queen/QueenFigure.tsx";
import { planLifeFixture } from "./fixtures/plan-life.ts";

const memberId = "MEM-001";
const charm = (over: Partial<QueenCharmV1> = {}): QueenCharmV1 => ({ id: `c-${Math.random().toString(36).slice(2, 8)}`, kind: "sitting-cat", part: "body", u: 0.62, v: 0.45, spin: 0, tilt: 0, scale: 1, color: "#e3a534", ...over });
const base = { memberId, view: "household" as const, bankKey: "king", expectedRevision: 0, name: "Our Queen", glaze: "cream" as const };
const draftWith = (charms: unknown[]) => ({ ...base, studio: { version: 1 as const, draft: { ...newKittyPiece("queen", "2026-09-01T00:00:00.000Z", "cream"), charms: charms as QueenCharmV1[] }, fired: [] } });
const ALL: ReadonlySet<QueenCharmKind> = new Set(QUEEN_CHARM_KINDS);

/** Seats that cover each spatial reserved channel, found by projecting her reserved geometry onto her surface. */
const RESERVED_SEATS: Record<"vine" | "fill" | "eyes" | "crown" | "seams" | "hands" | "feet", { part: "body" | "head"; u: number; v: number }> = {
  vine: { part: "head", ...queenSurfaceUv("head", [0, QUEEN_HEAD.position[1] + 0.3, QUEEN_HEAD.position[2] - 0.4]) },
  fill: { part: "body", u: 0.79, v: 0.6 },
  eyes: { part: "head", ...queenSurfaceUv("head", [0.19, QUEEN_HEAD.position[1] + 0.06, QUEEN_HEAD.position[2] + 0.46]) },
  crown: { part: "head", ...queenSurfaceUv("head", [0.34, QUEEN_HEAD.position[1] + 0.47, QUEEN_HEAD.position[2]]) },
  seams: { part: "body", ...queenSurfaceUv("body", [...QUEEN_SEAM_PATHS[0]![1]!]) },
  hands: { part: "body", ...queenSurfaceUv("body", [0, 1.86, 0.6]) },
  feet: { part: "body", u: 0.62, v: 0.05 },
};

describe("The charm library — a dozen small things, earned by acts", () => {
  it("names twelve kinds, six starters and six earned, each with a label and a reason", () => {
    expect(QUEEN_CHARM_KINDS).toHaveLength(12);
    expect(QUEEN_CHARM_LIBRARY.map((row) => row.kind).sort()).toEqual([...QUEEN_CHARM_KINDS].sort());
    expect(QUEEN_CHARM_STARTERS).toEqual(["sitting-cat", "teapot", "mushroom", "paper-boat", "small-bird", "die"]);
    expect(QUEEN_CHARM_LIBRARY.filter((row) => row.earnedBy).map((row) => row.kind)).toEqual(["paper-airplane", "coffee-mug", "snail", "key", "bell", "spool"]);
    for (const row of QUEEN_CHARM_LIBRARY) { expect(row.label).toMatch(/\S/); expect(row.short).toMatch(/\S/); }
    expect(QUEEN_CHARM_LIMITS.count).toBe(16);
  });

  it("gives a brand-new household the starters and nothing else", () => {
    const h = planLifeFixture("household");
    const earned = queenCharmsEarned(h);
    expect(earned.filter((row) => row.earned).map((row) => row.kind)).toEqual([...QUEEN_CHARM_STARTERS]);
    expect(earned.filter((row) => !row.earned).every((row) => row.earnedBy)).toBe(true);
  });

  it("derives every unlock from records that already exist, and touches nothing else on the household", () => {
    let h = planLifeFixture("household");
    const touched = new Set<string>();
    queenCharmsEarned(new Proxy(h, { get(target, key) { touched.add(String(key)); return (target as unknown as Record<string, unknown>)[String(key)]; } }));
    expect([...touched].sort()).toEqual(["chapters", "charter", "goals", "rituals", "sitDownSessions", "transactions"]);
    // The paper airplane: a travel goal filled and bought (retired with a purchase), named the way the nest reads travel.
    const trip = addGoal(h, { name: "Fictional weekend trip", target: "200", shared: true, ownerMemberId: memberId });
    h = fundGoal(trip.household, { goalId: trip.postedIds[0]!, amount: "200", fromAccountId: "ACC-CHEQUING", date: "2026-09-02", createdBy: memberId, visibility: "household" }).household;
    expect(queenCharmKindsEarned(h).has("paper-airplane")).toBe(false);
    h = purchaseGoal(h, { goalId: trip.postedIds[0]!, amount: "200", date: "2026-09-05", createdBy: memberId }).household;
    expect(queenCharmKindsEarned(h).has("paper-airplane")).toBe(true);
    const bike = addGoal(planLifeFixture("household"), { name: "Fictional bicycle", target: "200", shared: true, ownerMemberId: memberId });
    let other = fundGoal(bike.household, { goalId: bike.postedIds[0]!, amount: "200", fromAccountId: "ACC-CHEQUING", date: "2026-09-02", createdBy: memberId, visibility: "household" }).household;
    other = purchaseGoal(other, { goalId: bike.postedIds[0]!, amount: "200", date: "2026-09-05", createdBy: memberId }).household;
    expect(queenCharmKindsEarned(other).has("paper-airplane")).toBe(false);
    // The coffee mug: one Ritual held ten times — heldOn is evidence, and nine is not ten.
    h = openChapter(h, { memberId, foundationId: "see-our-shared-life", at: "2026-08-01T12:00:00.000Z" }).household;
    const ritual = h.rituals![0]!;
    for (let day = 1; day <= 9; day += 1) h = recordRitualHeld(h, { memberId, ritualId: ritual.id, onDate: `2026-08-${String(day).padStart(2, "0")}` }).household;
    expect(queenCharmKindsEarned(h).has("coffee-mug")).toBe(false);
    h = recordRitualHeld(h, { memberId, ritualId: ritual.id, onDate: "2026-08-10" }).household;
    expect(queenCharmKindsEarned(h).has("coffee-mug")).toBe(true);
    // The bell: the first Sitdown completed — a Chapter closed at one carries its id. The snail: closed after a hard month.
    expect(queenCharmKindsEarned(h).has("bell")).toBe(false);
    const established = closeChapter(h, { memberId, chapterId: openChapterFor(h)!.id, outcome: "established", at: "2026-08-30T12:00:00.000Z" }).household;
    expect(queenCharmKindsEarned(established).has("snail")).toBe(false);
    h = closeChapter(h, { memberId, chapterId: openChapterFor(h)!.id, outcome: "still-forming", sitdownId: "SIT-FICTION", at: "2026-08-30T12:00:00.000Z" }).household;
    expect(queenCharmKindsEarned(h).has("snail")).toBe(true);
    expect(queenCharmKindsEarned(h).has("bell")).toBe(true);
    expect(queenCharmKindsEarned({ ...planLifeFixture("household"), sitDownSessions: [{ id: "S", monthKey: "2026-09", targetMonth: "2026-10", act: 3, leftoverCents: 0, cashLikeCents: 0, billsNext30Cents: 0, minPaymentsCents: 0, slices: [], transferIds: [], contributionIds: [], budgetPosted: false, closedMonth: false, driveFileId: null, status: "closed", createdBy: memberId, createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" }] }).has("bell")).toBe(true);
    // The key: the Charter signed by every member, not one.
    expect(queenCharmKindsEarned(h).has("key")).toBe(false);
    h = foundHouseholdCharter(h, { memberId, custodianMemberId: h.householdFund?.custodianMemberId ?? memberId, purpose: "Fictional", splitRule: "even", splitNote: "", ceilingKind: "none", cadence: "monthly", date: "2026-08-01" }).household;
    h = signHouseholdCharter(h, { memberId, at: "2026-08-02T12:00:00.000Z" }).household;
    expect(queenCharmKindsEarned(h).has("key")).toBe(false);
    h = signHouseholdCharter(h, { memberId: "MEM-002", at: "2026-08-02T12:00:00.000Z" }).household;
    expect(queenCharmKindsEarned(h).has("key")).toBe(true);
    // The spool: a correction mended — the reversal a gold seam reads, in any month.
    expect(queenCharmKindsEarned(h).has("spool")).toBe(false);
    const posted = postEntry(h, { type: "expense", date: "2026-07-10", amount: "40", accountId: "ACC-CHEQUING", subcategoryId: "SUB-LIFE-FUN", createdBy: "MEM-002", visibility: "household" });
    h = reversePostedMoney(posted.household, posted.postedIds[0]!, { createdBy: memberId, reversalDate: "2026-07-11" }).household;
    expect(queenCharmKindsEarned(h).has("spool")).toBe(true);
    expect(queenCharmsEarned(h).every((row) => row.earned)).toBe(true);
    // Money in earns nothing: the Fund's balance is not among the fields read.
    expect(touched.has("householdFund")).toBe(false);
    expect(touched.has("accounts")).toBe(false);
  });
});

describe("Charms refuse the reserved zones — physically, and in the guard", () => {
  it("seats are her mesh: the surface maths agree with the lathe and the sphere three.js builds", () => {
    const lathe = new THREE.LatheGeometry(QUEEN_SKIRT_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 48, Math.PI / 2, Math.PI * 2);
    const pos = lathe.getAttribute("position"), uv = lathe.getAttribute("uv");
    for (let i = 0; i < pos.count; i += 5) {
      const seat = queenSurfaceSeat("body", uv.getX(i), uv.getY(i));
      expect(Math.hypot(seat.position[0] - pos.getX(i), seat.position[1] - pos.getY(i), seat.position[2] - pos.getZ(i))).toBeLessThan(1e-3);
    }
    const head = new THREE.Mesh(new THREE.SphereGeometry(QUEEN_HEAD.radius, 40, 28, QUEEN_HEAD.phiStart));
    head.position.set(...QUEEN_HEAD.position); head.scale.set(...QUEEN_HEAD.scale); head.updateMatrixWorld();
    const sp = head.geometry.getAttribute("position"), suv = head.geometry.getAttribute("uv");
    for (let i = 0; i < sp.count; i += 5) {
      const w = new THREE.Vector3(sp.getX(i), sp.getY(i), sp.getZ(i)).applyMatrix4(head.matrixWorld);
      const seat = queenSurfaceSeat("head", suv.getX(i), suv.getY(i));
      expect(w.distanceTo(new THREE.Vector3(...seat.position))).toBeLessThan(1e-3);
      if (suv.getY(i) > 0.02 && suv.getY(i) < 0.98) { const back = queenSurfaceUv("head", [w.x, w.y, w.z]); expect(Math.abs(back.v - suv.getY(i))).toBeLessThan(0.02); }
    }
    // The front centre faces the room; the room's right is +x on both parts.
    expect(queenSurfaceSeat("body", 0.75, 0.5).normal[2]).toBeGreaterThan(0.9);
    expect(queenSurfaceSeat("head", 0.5, 0.5).normal[2]).toBeGreaterThan(0.9);
    expect(queenSurfaceSeat("body", 0.8, 0.5).position[0]).toBeGreaterThan(0);
    expect(queenSurfaceSeat("head", 0.55, 0.5).position[0]).toBeGreaterThan(0);
    lathe.dispose(); head.geometry.dispose();
  });

  it("covers each spatial channel where her reserved geometry actually sits, and names it", () => {
    for (const [channel, seat] of Object.entries(RESERVED_SEATS)) expect(queenCharmRefusal(seat.part, seat.u, seat.v), channel).toBe(channel);
    // Every reserved mesh she has, projected onto her surface, lands in a refusal.
    const queen = createQueenSculpture();
    const covered = new Set<string>();
    const probe = (object: THREE.Object3D, part: "body" | "head") => {
      // Tubes carry their curve in the geometry, so probe the mesh's own centre, not its origin.
      const geometry = (object as THREE.Mesh).geometry;
      if (geometry && !geometry.boundingSphere) geometry.computeBoundingSphere();
      const point = geometry?.boundingSphere ? geometry.boundingSphere.center.clone().applyMatrix4(object.matrixWorld) : object.getWorldPosition(new THREE.Vector3());
      const uv = queenSurfaceUv(part, [point.x, point.y, point.z]);
      const refusal = queenCharmRefusal(part, uv.u, uv.v);
      expect(refusal, `${object.name} at ${part} ${uv.u.toFixed(2)},${uv.v.toFixed(2)}`).not.toBeNull();
      covered.add(refusal!);
    };
    queen.group.updateMatrixWorld(true);
    queen.reserved.face.traverse((object) => { if ((object as THREE.Mesh).isMesh) probe(object, "head"); });
    queen.reserved.crown.traverse((object) => { if ((object as THREE.Mesh).isMesh) probe(object, "head"); });
    probe(queen.reserved.vine, "head");
    probe(queen.reserved.hands, "body");
    for (const path of QUEEN_SEAM_PATHS) for (const point of path) { const uv = queenSurfaceUv("body", point); expect(uv.v < 0.2 ? "feet" : queenCharmRefusal("body", uv.u, uv.v)).toBe(uv.v < 0.2 ? "feet" : "seams"); expect(queenCharmRefusal("body", uv.u, uv.v)).not.toBeNull(); }
    for (const stone of queen.reserved.stones) expect(queenCharmRefusal("body", queenSurfaceUv("body", [stone.position.x, 0, stone.position.z]).u, 0.05)).toBe("feet");
    for (const id of ["crown", "eyes", "hands", "vine"]) expect(covered.has(id), id).toBe(true);
    const channels: readonly string[] = QUEEN_RESERVED_CHANNELS.map((row) => row.id);
    for (const id of covered) expect(channels.includes(id), id).toBe(true);
    queen.dispose();
    // Posture and the glaze axis are not places: a charm never returns them, never carries them, and never changes them.
    expect(QUEEN_RESERVED_CHANNELS.map((row) => row.id)).toEqual(["vine", "posture", "fill", "eyes", "crown", "seams", "hands", "feet", "glaze", "rings"]);
    const [kept] = queenSanitizeCharms([{ ...charm(), glaze: "glazed", fired: true, firedAt: "2026-09-01", posture: "depleted", scaleQueen: 2 }]);
    expect(kept).toBeDefined();
    expect(Object.keys(kept!).sort()).toEqual(["color", "id", "kind", "part", "scale", "spin", "tilt", "u", "v"]);
    const still = queenStill({ state: "needs-us", destination: "fund" }, "current");
    expect(queenPose(still)).toEqual(queenPose(still));
    // A face-away seat will not take either: she only wears what the room can see.
    expect(queenCharmRefusal("body", 0.25, 0.5)).toBe("unseen");
    // And the flanks, cheeks, chin and hem sides are hers to give.
    for (const seat of QUEEN_CHARM_KEYBOARD_SEATS) expect(queenCharmAllowed(seat.part, seat.u, seat.v), JSON.stringify(seat)).toBe(true);
  });

  it("slides a refused charm to the nearest seat that is hers to give, or will not take it — no words", () => {
    const slid = queenCharmSettle("body", 0.84, 0.5); // a hair inside the right seam's corridor
    expect(slid).not.toBeNull();
    expect(queenCharmAllowed("body", slid!.u, slid!.v)).toBe(true);
    expect(Math.abs(slid!.u - 0.84)).toBeLessThan(0.05);
    const off = queenCharmSettle("head", 0.3, 0.8); // pressed at the crown's edge, it settles on the cheek below
    expect(off && off.v).toBeLessThan(0.76);
    expect(queenCharmSettle("body", 0.75, 0.4)).toBeNull(); // the belly's fill window: too deep, it will not take
    expect(queenCharmSettle("head", 0.5, 0.55)).toBeNull(); // her eye
    expect(queenCharmSettle("body", 0.25, 0.5)).toBeNull(); // her back
    // Nudging toward the fill window slides off it rather than into it.
    const nudged = queenCharmNudge({ part: "body", u: 0.66, v: 0.45 }, 0.5, 0);
    expect(queenCharmAllowed("body", nudged.u, nudged.v)).toBe(true);
    expect(queenCharmRefusal("body", 0.66 + 0.5 / (Math.PI * 2 * 1.14), 0.45)).not.toBeNull();
    // Keyboard seats: sixteen distinct free seats, then the first again.
    const placed: { part: "body" | "head"; u: number; v: number }[] = [];
    for (let i = 0; i < QUEEN_CHARM_LIMITS.count; i += 1) placed.push(queenCharmFreeSeat(placed));
    expect(new Set(placed.map((row) => `${row.part}:${row.u.toFixed(2)},${row.v.toFixed(2)}`)).size).toBe(QUEEN_CHARM_LIMITS.count);
  });

  it("refuses a charm on each of the nine channels through the guard, not only the tool", () => {
    for (const [channel, seat] of Object.entries(RESERVED_SEATS)) {
      const kept = guardQueenDesignSave(draftWith([charm({ id: channel, ...seat })]), { earned: ALL });
      expect(kept.studio?.draft?.charms ?? [], channel).toEqual([]);
    }
    // Posture: a charm cannot scale or lean her — the record has no such field to carry, and hers is a reading.
    const posture = guardQueenDesignSave(draftWith([{ ...charm({ id: "p" }), posture: "depleted", lean: 30 }]), { earned: ALL });
    expect(posture.studio?.draft?.charms?.[0]).not.toHaveProperty("posture");
    // The four handles are the wheel's, read within her bounds (2026-09-14); nothing else on the sculpt moves.
    expect(posture.studio?.draft?.sculpt).toEqual({ ...newKittyPiece("q", "2026-09-01T00:00:00.000Z").sculpt, profile: [1, 0.92, 0.9, 0.9] });
    // Glaze: a charm cannot carry a firing or a material axis, and the piece stays wet.
    const glaze = guardQueenDesignSave(draftWith([{ ...charm({ id: "g" }), glaze: "glazed", firedAt: "2026-09-02T00:00:00.000Z" }]), { earned: ALL });
    expect(glaze.studio?.draft?.charms?.[0]).not.toHaveProperty("glaze");
    expect(glaze.studio?.draft?.charms?.[0]).not.toHaveProperty("firedAt");
    expect(glaze.studio?.draft?.firedAt).toBeNull();
    // A good seat passes through untouched.
    const good = guardQueenDesignSave(draftWith([charm({ id: "ok", u: 0.62, v: 0.45 })]), { earned: ALL });
    expect(good.studio?.draft?.charms?.map((row) => row.id)).toEqual(["ok"]);
  });

  it("drops an unearned charm — and, told nothing about the household, keeps only the starters", () => {
    const rows = [charm({ id: "cat", kind: "sitting-cat", u: 0.62 }), charm({ id: "key", kind: "key", u: 0.88 }), charm({ id: "mug", kind: "coffee-mug", u: 0.6, v: 0.28 })];
    expect(guardQueenDesignSave(draftWith(rows)).studio?.draft?.charms?.map((row) => row.id)).toEqual(["cat"]);
    expect(guardQueenDesignSave(draftWith(rows), { earned: new Set(["sitting-cat", "key"]) }).studio?.draft?.charms?.map((row) => row.id)).toEqual(["cat", "key"]);
    const h = planLifeFixture("household");
    expect(guardQueenDesignSave(draftWith(rows), { earned: queenCharmKindsEarned(h) }).studio?.draft?.charms?.map((row) => row.id)).toEqual(["cat"]);
    // Malformed, duplicate and over-cap charms are dropped, in order, at the cap.
    const many = Array.from({ length: 20 }, (_, i) => charm({ id: `m${i}`, ...QUEEN_CHARM_KEYBOARD_SEATS[i % QUEEN_CHARM_KEYBOARD_SEATS.length]! }));
    expect(queenSanitizeCharms([...many, { id: "m0" }, null, "x", charm({ id: "bad", scale: 9 })], ALL)).toHaveLength(QUEEN_CHARM_LIMITS.count);
    expect(() => shapeQueenCharms(Array.from({ length: 17 }, (_, i) => charm({ id: `s${i}` })))).toThrow();
  });
});

describe("Charms persist on the King's draft and round-trip through the guard", () => {
  it("writes through saveKittyNestDesign, reads back draft-first, and the kiln is still refused", () => {
    let h = planLifeFixture("household");
    const rows = [charm({ id: "one", by: memberId }), charm({ id: "two", kind: "teapot", u: 0.88, spin: 45, tilt: -10, scale: 1.2, color: "#3f6fa3", by: "MEM-002" })];
    const result = saveKittyNestDesign(h, guardQueenDesignSave(draftWith(rows), { earned: queenCharmKindsEarned(h) }));
    h = result.household;
    const design = h.kittyNestDesigns?.find((row) => row.bankKey === "king")!;
    expect(queenWornCharms(design)).toEqual(rows);
    expect(design.studio?.draft?.firedAt).toBeNull();
    // The sync shape keeps them; a fired write through the guard still throws; a fired draft written around the guard is not her look.
    expect(shapeKittyPiece(design.studio!.draft!).charms).toEqual(rows);
    expect(() => guardQueenDesignSave({ ...draftWith(rows), fire: true })).toThrow(QueenAuthoringError);
    expect(() => guardQueenDesignSave({ ...draftWith(rows), completeSetup: true })).toThrow(QueenAuthoringError);
    // A second member's press keeps the first member's charm and its author.
    const next = saveKittyNestDesign(h, guardQueenDesignSave({ ...draftWith([...rows, charm({ id: "three", kind: "die", part: "head", u: 0.3, v: 0.5, by: "MEM-002" })]), memberId: "MEM-002", expectedRevision: design.revision }, { earned: queenCharmKindsEarned(h) })).household;
    expect(queenWornCharms(next.kittyNestDesigns?.find((row) => row.bankKey === "king")).map((row) => `${row.id}:${row.by}`)).toEqual(["one:MEM-001", "two:MEM-002", "three:MEM-002"]);
    // Nothing about money moved.
    expect(next.transactions).toEqual(h.transactions);
    expect(next.householdFund).toEqual(h.householdFund);
  });

  it("conserves the King exactly as before: the categories still sum to the cent", () => {
    const h = planLifeFixture("household");
    const nest = projectKittyNest(h, memberId, "household", "2026-09-12");
    const banks = queenBanks(nest);
    expect([...banks.protect.banks, ...banks.whatnow.banks, ...banks.build.banks].reduce((sum, bank) => sum + bank.amountCents, 0)).toBe(nest.king.amountCents);
    for (const total of [0, 1, 12345, -50000]) {
      const allocation = allocateNestTotal(total, { build: 400, protect: 900, prepare: 250 });
      expect(allocation.protect + allocation.prepare + allocation.everyday + allocation.build).toBe(total);
    }
  });
});

describe("The flat path and the 3D path wear the same charms", () => {
  const sixteen = (): QueenCharmV1[] => QUEEN_CHARM_KEYBOARD_SEATS.map((seat, i) => charm({ id: `f${i}`, kind: QUEEN_CHARM_KINDS[i % QUEEN_CHARM_KINDS.length], ...seat, spin: (i * 37) % 120 - 60, scale: [1, 1.2, 0.8, 1.5, 0.7][i % 5]! }));

  it("draws every charm on the figure at the seat the 3D instance sits at", () => {
    const charms = sixteen();
    const still = queenStill({ state: "building", destination: "fund" }, "current");
    const markup = renderToStaticMarkup(createElement(QueenFigure, { still, body: { level: 5, fullness: "half", glaze: "glazed", seams: 1, amountCents: 100 }, crown: "both", vine: { chapter: null, growth: 0 }, buds: 0, feet: { count: 0, nearness: [] }, charms }));
    const drawn = [...markup.matchAll(/data-charm-id="([^"]+)"/g)].map((m) => m[1]);
    expect(drawn.sort()).toEqual(charms.map((row) => row.id).sort());
    for (const row of charms) {
      const seat = queenCharmFlatSeat(row);
      expect(markup).toContain(`translate(${seat.x.toFixed(1)} ${seat.y.toFixed(1)})`);
      expect(seat.x).toBeGreaterThan(20); expect(seat.x).toBeLessThan(220); expect(seat.y).toBeGreaterThan(60); expect(seat.y).toBeLessThan(300);
    }
    const queen = createQueenSculpture();
    queen.setCharms(charms);
    const counts = queen.charmCounts();
    expect(counts.instances).toBe(charms.length);
    expect(counts.kinds).toBe(new Set(charms.map((row) => row.kind)).size);
    expect(counts.drawCalls).toBeLessThanOrEqual(counts.kinds * 2);
    const body = queen.group.getObjectByName("queen-body")!;
    const m = new THREE.Matrix4(), p = new THREE.Vector3();
    for (const row of charms) {
      const mesh = body.children.find((child) => child.name === `queen-charm:${row.kind}`) as THREE.InstancedMesh;
      expect(mesh, row.kind).toBeDefined();
      expect(mesh.parent?.name).toBe("queen-body");
      const index = charms.filter((other) => other.kind === row.kind).indexOf(row);
      mesh.getMatrixAt(index, m);
      p.setFromMatrixPosition(m);
      const seat = queenSurfaceSeat(row.part, row.u, row.v);
      expect(p.distanceTo(new THREE.Vector3(...seat.position))).toBeLessThan(QUEEN_CHARM_UNIT * 0.1);
      const size = new THREE.Vector3().setFromMatrixScale(m);
      expect(size.x).toBeCloseTo(QUEEN_CHARM_UNIT * row.scale, 5);
    }
    // No charm mesh is inside any reserved group.
    for (const root of [queen.reserved.vine, queen.reserved.crown, queen.reserved.face, queen.reserved.feet]) root.traverse((object) => expect(object.name.startsWith("queen-charm")).toBe(false));
    queen.dispose();
  });

  it("picks the same seat from a flat point that the 3D ray would give", () => {
    for (const seat of QUEEN_CHARM_KEYBOARD_SEATS) {
      const flat = queenCharmFlatSeat({ ...seat, scale: 1 });
      const back = queenCharmFlatPick(flat.x, flat.y);
      expect(back?.part, JSON.stringify(seat)).toBe(seat.part);
      const p = queenSurfaceSeat(seat.part, seat.u, seat.v).position, q = queenSurfaceSeat(back!.part, back!.u, back!.v).position;
      expect(Math.hypot(p[0] - q[0], p[1] - q[1]), JSON.stringify(seat)).toBeLessThan(0.08);
    }
    expect(queenCharmFlatPick(120, 20)).toBeNull();
    expect(queenCharmFlatPick(10, 330)).toBeNull();
    // A ray through her in the world lands on the same uv the seat maths uses.
    const queen = createQueenSculpture();
    queen.group.updateMatrixWorld(true);
    const ray = new THREE.Raycaster();
    for (const seat of QUEEN_CHARM_KEYBOARD_SEATS.slice(0, 6)) {
      const s = queenSurfaceSeat(seat.part, seat.u, seat.v);
      ray.set(new THREE.Vector3(s.position[0], s.position[1], 10), new THREE.Vector3(0, 0, -1));
      const hit = queen.pick(ray);
      expect(hit?.part).toBe(seat.part);
      const du = Math.abs(hit!.u - seat.u);
      expect(Math.min(du, 1 - du)).toBeLessThan(0.03);
      expect(Math.abs(hit!.v - seat.v)).toBeLessThan(0.06);
    }
    queen.dispose();
  });

  it("follows the fill: charms on the belly ride its width in both paths", () => {
    const queen = createQueenSculpture();
    queen.setCharms([charm({ id: "b", u: 0.62, v: 0.45 })]);
    const mesh = () => queen.group.getObjectByName("queen-charm:sitting-cat") as THREE.InstancedMesh;
    const at = () => { const m = new THREE.Matrix4(); mesh().getMatrixAt(0, m); return new THREE.Vector3().setFromMatrixPosition(m); };
    queen.setFill(0);
    const empty = at();
    queen.setFill(10);
    const full = at();
    expect(Math.abs(full.x)).toBeGreaterThan(Math.abs(empty.x));
    expect(full.y).toBeCloseTo(empty.y, 2);
    queen.dispose();
  });
});

describe("Stillness and disposal", () => {
  it("builds each kind once, instances repeats, and returns every count to zero on dispose", () => {
    const queen = createQueenSculpture();
    const before = queen.counts();
    const charms = QUEEN_CHARM_KEYBOARD_SEATS.map((seat, i) => charm({ id: `d${i}`, kind: QUEEN_CHARM_KINDS[i % 4], ...seat }));
    queen.setCharms(charms);
    const with16 = queen.counts(), c = queen.charmCounts();
    expect(c.kinds).toBe(4);
    expect(c.geometries).toBeLessThanOrEqual(8);
    expect(c.instances).toBe(16);
    expect(c.drawCalls).toBeLessThanOrEqual(8);
    expect(with16.geometries - before.geometries).toBe(c.geometries);
    expect(with16.materials - before.materials).toBe(2);
    // Removing every charm keeps the built kinds for reuse and draws nothing.
    queen.setCharms([]);
    expect(queen.charmCounts().instances).toBe(0);
    expect(queen.charmCounts().drawCalls).toBe(0);
    queen.setCharms(charms.slice(0, 3));
    expect(queen.charmCounts().geometries).toBe(c.geometries);
    const disposed: string[] = [];
    queen.group.traverse((object) => {
      const mesh = object as THREE.Mesh;
      if (!mesh.isMesh || !object.name.startsWith("queen-charm")) return;
      vi.spyOn(mesh.geometry, "dispose").mockImplementation(() => { disposed.push("geometry"); });
    });
    queen.dispose();
    expect(queen.counts()).toEqual({ geometries: 0, materials: 0, textures: 0 });
    expect(queen.charmCounts()).toEqual({ kinds: 0, geometries: 0, materials: 2, meshes: 0, instances: 0, drawCalls: 0 });
    expect(disposed.length).toBeGreaterThanOrEqual(c.geometries);
    expect(queen.group.children).toHaveLength(0);
    // Every kind builds, merges to at most two geometries and has no texture.
    for (const kind of QUEEN_CHARM_KINDS) {
      const g = buildCharmGeometry(kind);
      expect(g.body.getAttribute("position").count).toBeGreaterThan(0);
      expect(g.body.getAttribute("uv")).toBeUndefined();
      g.body.dispose(); g.accent?.dispose();
    }
  });
});
