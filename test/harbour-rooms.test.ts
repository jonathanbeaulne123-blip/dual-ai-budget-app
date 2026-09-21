// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  EMPTY_ATLAS_READING, EMPTY_BOATHOUSE_READING, EMPTY_COTTAGE_READING, EMPTY_KILN_READING, EMPTY_KITCHEN_READING, buildAtlasReading, buildBoathouseReading, buildCottageReading,
  buildKilnReading, buildKitchenReading, KILN_SHELF_CAP, KILN_WARM_DAYS, KITCHEN_CARD_CAP,
} from "../src/harbour/data/reading.ts";
import { ATLAS_DRESSING } from "../src/harbour/atlas/dressing.ts";
import { ATLAS_GATE_LANTERNS, ATLAS_RING_STONES, atlasPoses, createAtlas, eraPlace, eraPlaqueWords, monthsWalked, nextIslandWords, readAtlasReading, stonePin } from "../src/harbour/atlas/AtlasScene.ts";
import { COTTAGE_DRESSING } from "../src/harbour/cottage/dressing.ts";
import { createCottage, cottagePoses, kept, readCottageReading, wearingWords } from "../src/harbour/cottage/CottageScene.ts";
import { KILN_DRESSING } from "../src/harbour/kiln/dressing.ts";
import { createKiln, kilnHeatWords, kilnPoses, pieceScale, readKilnReading, shelfPin } from "../src/harbour/kiln/KilnScene.ts";
import { KITCHEN_DRESSING } from "../src/harbour/kitchen/dressing.ts";
import { cardDollars, cardPin, cardWords, createKitchen, kitchenPoses, readKitchenReading } from "../src/harbour/kitchen/KitchenScene.ts";
import { BOATHOUSE_DRESSING } from "../src/harbour/boathouse/dressing.ts";
import { createBoathouse, fewWords, readBoathouseReading } from "../src/harbour/boathouse/BoathouseScene.ts";
import { LIBRARY_DRESSING } from "../src/harbour/library/dressing.ts";
import { BINDERY_MACHINES, createLibrary, libraryPoses } from "../src/harbour/library/LibraryScene.ts";
import { PLACES, PLACE_HOLDS } from "../src/harbour/scene/place.ts";
import { holdPoseInRoom, poseEye } from "../src/harbour/camera/poses.ts";
import type { PlanLine, PlanVersion } from "../src/core/planSystem.ts";

const today = "2026-09-20";

const line = (over: Partial<PlanLine> & { id: string }): PlanLine => ({
  lens: "build", kind: "commitment" as PlanLine["kind"], labelSnapshot: "Autumn getaway", amountCents: 100_000,
  cadence: "one-time", assumptionIds: [], createdBy: "MEM-001",
  ...over,
});

const version = (lines: PlanLine[], state: PlanVersion["state"] = "active"): PlanVersion => ({
  id: "PLANV-1", scope: "household", monthKey: "2026-09", sequence: 1, lines, assumptions: [],
  reason: "test", digest: "d1", state, createdBy: "MEM-001", createdAt: "2026-09-01T00:00:00.000Z",
});

const household = (versions: PlanVersion[], acknowledgements: { planVersionId: string; planDigest: string; memberId: string }[] = []) => ({
  planVersions: versions,
  planAcknowledgements: acknowledgements.map((row, index) => ({ id: `ACK-${index}`, acknowledgedAt: "2026-09-02T00:00:00.000Z", ...row })),
  members: [{ id: "MEM-001", name: "Jonathan", active: true }, { id: "MEM-002", name: "Bianca", active: true }],
});

describe("the Kitchen reading (LITTLE_HARBOUR_v2 §4)", () => {
  it("reads the month's standing plan as five-line cards: what, how much, by when, from which pot, who", () => {
    const reading = buildKitchenReading(household([version([
      line({ id: "a", labelSnapshot: "Autumn getaway", amountCents: 100_000, lens: "build", dueDate: "2026-10-08", responsibility: { kind: "joint" } }),
      line({ id: "b", labelSnapshot: "Winter tires", amountCents: 48_000, lens: "prepare", responsibility: { kind: "member", memberId: "MEM-001" }, decision: { targetCents: 52_000, deadline: "2026-11-15" } }),
      line({ id: "c", labelSnapshot: "Hydro", amountCents: 11_800, lens: "everyday" }),
    ])]), "MEM-001", today);
    expect(reading.monthKey).toBe("2026-09");
    expect(reading.state).toBe("active");
    const a = reading.cards.find((card) => card.key === "line/a")!;
    expect(a).toMatchObject({ what: "Autumn getaway", amountCents: 100_000, when: "2026-10-08", pot: "build", who: "both" });
    // The decision's own target and deadline outrank the line's raw figures.
    const b = reading.cards.find((card) => card.key === "line/b")!;
    expect(b).toMatchObject({ amountCents: 52_000, when: "2026-11-15", who: "mine" });
    expect(reading.cards.find((card) => card.key === "line/c")).toMatchObject({ pot: "everyday", who: null, when: null });
  });

  it("holds a proposed plan on the table until both have sat, and reads no plan as an empty wall", () => {
    const proposed = version([line({ id: "a" })], "proposed");
    const half = buildKitchenReading(household([proposed], [{ planVersionId: "PLANV-1", planDigest: "d1", memberId: "MEM-001" }]), "MEM-001", today);
    expect(half.state).toBe("proposed");
    expect(half.waiting).toBe(true);
    const both = buildKitchenReading(household([proposed], [
      { planVersionId: "PLANV-1", planDigest: "d1", memberId: "MEM-001" },
      { planVersionId: "PLANV-1", planDigest: "d1", memberId: "MEM-002" },
    ]), "MEM-001", today);
    expect(both.waiting).toBe(false);
    expect(buildKitchenReading(household([]), "MEM-001", today)).toEqual(EMPTY_KITCHEN_READING);
  });

  it("caps the wall and says the rest is in the drawer", () => {
    const many = Array.from({ length: KITCHEN_CARD_CAP + 3 }, (_, i) => line({ id: `l${i}` }));
    const reading = buildKitchenReading(household([version(many)]), "MEM-001", today);
    expect(reading.cards.length).toBe(KITCHEN_CARD_CAP);
    expect(reading.overflow).toBe(3);
  });

  it("speaks a card in the card's own order, and pins the wall as a grid", () => {
    expect(cardDollars(124_000)).toBe("$1,240");
    expect(cardWords({ key: "line/a", what: "Autumn getaway", amountCents: 100_000, when: "2026-10-08", pot: "build", who: "both" }))
      .toBe("Autumn getaway — $1,000 · by Oct 8 · Build · both of you");
    const first = cardPin(0), fourth = cardPin(3);
    expect(first.x).not.toBe(cardPin(1).x);
    expect(fourth.y).toBeLessThan(first.y);
  });
});

// ── The Kiln (LITTLE_HARBOUR_v2 §2) ─────────────────────────────────────────

const clay = (firedAt: string | null) => ({ id: `P-${firedAt ?? "wet"}`, createdAt: "2026-09-01T00:00:00.000Z", firedAt, sculpt: {}, paint: {} });
const designRow = (over: Record<string, unknown>) => ({
  version: 1, id: `NEST:${over.bankKey}`, bankKey: "plan:build", visibility: "household", createdBy: "MEM-001", revision: 1,
  name: "The Build bank", glaze: "sea-glass", category: "build", archivedAt: null, setupCompletedAt: null,
  createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-19T00:00:00.000Z", ...over,
});
const kilnHousehold = {
  members: [{ id: "MEM-001", name: "Jonathan", active: true }, { id: "MEM-002", name: "Bianca", active: true }],
  kittyNestDesigns: [
    designRow({ bankKey: "plan:build", studio: { version: 1, draft: null, fired: [clay("2026-09-19T10:00:00.000Z"), clay("2026-09-12T10:00:00.000Z")] } }),
    // Somebody else's own shelf: a count, and nothing else.
    designRow({ bankKey: "plan:protect", visibility: "personal", createdBy: "MEM-002", name: "Her own bank", glaze: "midnight", category: "protect", studio: { version: 1, draft: null, fired: [clay("2026-09-18T10:00:00.000Z")] } }),
    // Nothing fired yet, but something on the wheel.
    designRow({ bankKey: "plan:prepare", name: "The Prepare bank", glaze: "cream", category: "prepare", studio: { version: 1, draft: clay(null), fired: [] } }),
  ],
  goals: [
    { id: "GOAL-1", name: "Autumn getaway", shared: true, ownerMemberId: null, targetCents: 100_000, savedCents: 40_000, status: "open",
      envelope: { version: 1, kind: "build", glaze: "rose", studio: { version: 1, draft: clay(null), fired: [clay("2026-09-20T09:00:00.000Z")] } } },
    { id: "GOAL-2", name: "Her surprise", shared: false, ownerMemberId: "MEM-002", targetCents: 20_000, savedCents: 0, status: "open",
      envelope: { version: 1, kind: "build", glaze: "cream", studio: { version: 1, draft: null, fired: [clay("2026-09-11T09:00:00.000Z")] } } },
  ],
};
const kilnReading = buildKilnReading(kilnHousehold as never, "MEM-001", today);

describe("the Kiln reading (LITTLE_HARBOUR_v2 §2)", () => {
  it("stands one piece per fired bank, newest out of the kiln first, in its own glaze and at its own step", () => {
    expect(kilnReading.pieces.map((piece) => piece.key)).toEqual(["goal/GOAL-1", "bank/plan:build"]);
    expect(kilnReading.pieces[0]).toMatchObject({ name: "Autumn getaway", glaze: "rose", category: "build", firings: 1, firedOn: "2026-09-20" });
    expect(kilnReading.pieces[1]).toMatchObject({ name: "The Build bank", glaze: "sea-glass", firings: 2, firedOn: "2026-09-19" });
    for (const piece of kilnReading.pieces) expect(piece.step).toBeGreaterThanOrEqual(0);
    // Counts, never contents: three fired pieces on the shelf, two kept privately and named nowhere.
    expect(kilnReading.fired).toBe(3);
    expect(kilnReading.keptPrivate).toBe(2);
    expect(JSON.stringify(kilnReading)).not.toContain("Her own bank");
    expect(JSON.stringify(kilnReading)).not.toContain("Her surprise");
    // Two lumps still clay: one on a bank's wheel, one on the goal's.
    expect(kilnReading.onTheWheel).toBe(2);
  });

  it("reads the heat from the last firing and lets it go cold, and a household with no studio work is a swept shelf", () => {
    expect(kilnReading).toMatchObject({ lastFiredOn: "2026-09-20", sinceFiring: 0, warmth: 1 });
    expect(kilnHeatWords(kilnReading)).toBe("still hot, fired today");
    const later = buildKilnReading(kilnHousehold as never, "MEM-001", "2026-09-23");
    expect(later.sinceFiring).toBe(3);
    expect(later.warmth).toBeCloseTo(1 - 3 / KILN_WARM_DAYS, 6);
    expect(kilnHeatWords(later)).toBe("warm, fired 3 days ago");
    const cold = buildKilnReading(kilnHousehold as never, "MEM-001", "2026-10-20");
    expect(cold.warmth).toBe(0);
    expect(kilnHeatWords(cold)).toContain("cold");
    expect(kilnHeatWords({ sinceFiring: null, warmth: 0 })).toBe("cold, nothing fired yet");
    expect(buildKilnReading({ members: [] } as never, "MEM-001", today)).toEqual(EMPTY_KILN_READING);
  });

  it("caps the shelf and says the rest is in the Studio", () => {
    const many = Array.from({ length: KILN_SHELF_CAP + 2 }, (_, i) => designRow({
      bankKey: `recurrence:${i}`, name: `Bank ${i}`, category: null,
      studio: { version: 1, draft: null, fired: [clay(`2026-09-0${(i % 9) + 1}T10:00:00.000Z`)] },
    }));
    const reading = buildKilnReading({ members: [], kittyNestDesigns: many } as never, "MEM-001", today);
    expect(reading.pieces.length).toBe(KILN_SHELF_CAP);
    expect(reading.overflow).toBe(2);
    expect(reading.fired).toBe(KILN_SHELF_CAP + 2);
  });

  it("pins the shelf four to a board and sizes a piece by its bank's ten steps", () => {
    expect(shelfPin(0).x).not.toBe(shelfPin(1).x);
    expect(shelfPin(4).y).toBeLessThan(shelfPin(0).y);
    expect(shelfPin(4).x).toBe(shelfPin(0).x);
    expect(pieceScale(0)).toBeLessThan(pieceScale(10));
    expect(pieceScale(10)).toBeCloseTo(1, 6);
    expect(pieceScale(-4)).toBe(pieceScale(0));
  });
});

// ── The Atlas (LITTLE_HARBOUR_v2 §4, the room up the kitchen stair) ─────────

const eraSpec = (over: Record<string, unknown> = {}) => ({
  order: 1, name: "The small flat", finishLine: "When the rent stops being the whole of it", from: "2026-03", by: null,
  home: "flat", finish: { kind: "agree" }, plans: [], crossedOn: null, retired: false, ...over,
});
const eraRow = (id: string, active: Record<string, unknown> | null, over: Record<string, unknown> = {}) => ({
  version: 1, id, kind: "era", updatedAt: "2026-09-01T00:00:00.000Z",
  active, pending: null, pendingBy: null, pendingRevision: 0, agreedByMemberIds: [], ...over,
});
const members = [{ id: "MEM-001", name: "Jonathan", active: true }, { id: "MEM-002", name: "Bianca", active: true }];
const journey = (rows: unknown[], over: Record<string, unknown> = {}) => ({
  members, goals: [], accounts: [], pathWorld: rows, ...over,
});

describe("the Atlas reading (LITTLE_HARBOUR_v2 §4)", () => {
  it("reads a household with no journey as a bare stand — a state, never a fault", () => {
    expect(buildAtlasReading(journey([]) as never, "MEM-001", today)).toEqual(EMPTY_ATLAS_READING);
    expect(buildAtlasReading({ members } as never, "MEM-001", today)).toEqual(EMPTY_ATLAS_READING);
  });

  it("stands the era we are in: its name, its place on the journey, the months walked, and the home it is lived in", () => {
    const reading = buildAtlasReading(journey([
      eraRow("PATH-ERA-A", eraSpec({ order: 1, name: "Two rooms", from: "2025-09", crossedOn: "2026-03" })),
      eraRow("PATH-ERA-B", eraSpec({ order: 2, name: "The small flat", from: "2026-03", home: "furnished" })),
    ]) as never, "MEM-001", today);
    expect(reading.era).toMatchObject({ key: "era:PATH-ERA-B", name: "The small flat", index: 2, home: "furnished", homeLabel: "the flat, furnished" });
    // March through September, inclusive: seven months of this era walked.
    expect(reading.era!.months).toBe(7);
    expect(reading.eras).toBe(2);
    expect(reading.crossed).toBe(1);
    // The stones of the whole path: the crossed era's six months and this era's seven.
    expect(reading.stones).toBe(13);
    // An "agree" gate is one lantern and it is already lit — you may cross whenever you both say so.
    expect(reading.gate).toMatchObject({ kind: "agree", met: true, lit: 1, lanterns: 1, words: "Ready to cross" });
    expect(reading.crossing).toBe(false);
    expect(reading.next).toBeNull();
    expect(reading.keptPrivate).toBe(0);
  });

  it("counts the gate's lanterns while they are still filling, and says so when they are all lit", () => {
    const filling = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ name: "Saving for the house", finish: { kind: "banks", goalIds: ["GOAL-1", "GOAL-2"] } })),
    ], {
      goals: [
        { id: "GOAL-1", name: "Deposit", shared: true, ownerMemberId: null, targetCents: 100_000, savedCents: 0, status: "open", purchaseId: null },
        { id: "GOAL-2", name: "Movers", shared: true, ownerMemberId: null, targetCents: 20_000, savedCents: 0, status: "open", purchaseId: "PUR-1" },
      ],
    }) as never, "MEM-001", today);
    expect(filling.gate).toMatchObject({ kind: "banks", met: false, lit: 1, lanterns: 2, words: "1 of 2 lit" });
    const met = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ finish: { kind: "banks", goalIds: ["GOAL-2"] } })),
    ], {
      goals: [{ id: "GOAL-2", name: "Movers", shared: true, ownerMemberId: null, targetCents: 20_000, savedCents: 0, status: "open", purchaseId: "PUR-1" }],
    }) as never, "MEM-001", today);
    expect(met.gate).toMatchObject({ met: true, lit: 1, lanterns: 1, words: "Ready to cross" });
    // The gate's words never carry a figure — an era cannot, and neither can its room.
    expect(JSON.stringify(met)).not.toMatch(/\$|\d{4,}/);
  });

  it("names the island across the bridge, marks a merely suggested one, and says 'unplanned' when there is none", () => {
    const planned = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ order: 1, name: "The small flat" })),
      eraRow("PATH-ERA-C", eraSpec({ order: 2, name: "The house with the porch", from: "2028-01", home: "porch" })),
    ]) as never, "MEM-001", today);
    expect(planned.next).toEqual({ key: "era:PATH-ERA-C", name: "The house with the porch", sketched: false });
    expect(nextIslandWords(planned)).toBe("Across the bridge\n“The house with the porch”");
    // One of you has suggested an era; nothing is agreed, so it reaches the room only as a sketch.
    const suggested = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ order: 1 })),
      eraRow("PATH-ERA-C", null, { pending: eraSpec({ order: 2, name: "A cabin, eventually", from: "2029-01", home: "cabin" }), pendingBy: "MEM-002", agreedByMemberIds: ["MEM-002"] }),
    ]) as never, "MEM-001", today);
    expect(suggested.next).toEqual({ key: "era:PATH-ERA-C", name: "A cabin, eventually", sketched: true });
    // A sketch is never counted among the agreed eras standing on the journey.
    expect(suggested.eras).toBe(1);
    expect(nextIslandWords(suggested)).toContain("suggested");
    const alone = buildAtlasReading(journey([eraRow("PATH-ERA-B", eraSpec())]) as never, "MEM-001", today);
    expect(alone.next).toBeNull();
    expect(nextIslandWords(alone)).toBe("Across the bridge\nUnplanned");
  });

  it("holds a crossing that is waiting for both of you, without crossing anything", () => {
    const waiting = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ name: "The small flat" }), { pending: eraSpec({ name: "The small flat", crossedOn: "2026-10" }), pendingBy: "MEM-002", agreedByMemberIds: ["MEM-002"] }),
    ]) as never, "MEM-001", today);
    expect(waiting.crossing).toBe(true);
    expect(waiting.gate?.words).toBe("Crossing · waiting for both of you");
    // The era is still the one we are in: nothing has crossed.
    expect(waiting.era).toMatchObject({ name: "The small flat", index: 1 });
    expect(waiting.crossed).toBe(0);
  });

  it("counts a bank it may not see and never names it", () => {
    const reading = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({
        finish: { kind: "banks", goalIds: ["GOAL-1", "GOAL-HERS"] },
        plans: [
          { id: "PLAN-1", kind: "bank", label: "The deposit", goalId: "GOAL-1", month: null },
          { id: "PLAN-2", kind: "bank", label: "Her own", goalId: "GOAL-HERS", month: null },
          { id: "PLAN-3", kind: "trip", label: "A week in Gros Morne", goalId: null, month: "2027-07" },
        ],
      })),
    ], {
      goals: [
        { id: "GOAL-1", name: "Deposit", shared: true, ownerMemberId: null, targetCents: 100_000, savedCents: 0, status: "open", purchaseId: null },
        { id: "GOAL-HERS", name: "Her surprise", shared: false, ownerMemberId: "MEM-002", targetCents: 20_000, savedCents: 0, status: "open", purchaseId: null },
      ],
    }) as never, "MEM-001", today);
    // Once on the finish line, once as a plan: two footpaths that are hers, counted and named nowhere.
    expect(reading.keptPrivate).toBe(2);
    expect(reading.era!.plans).toBe(3);
    expect(JSON.stringify(reading)).not.toContain("Her surprise");
    expect(JSON.stringify(reading)).not.toContain("GOAL-HERS");
    // Her own member reads the same era and keeps nothing private of her own.
    expect(buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ finish: { kind: "banks", goalIds: ["GOAL-HERS"] } })),
    ], {
      goals: [{ id: "GOAL-HERS", name: "Her surprise", shared: false, ownerMemberId: "MEM-002", targetCents: 20_000, savedCents: 0, status: "open", purchaseId: null }],
    }) as never, "MEM-002", today).keptPrivate).toBe(0);
  });

  it("speaks the era in words, and lays the ring out from the gate", () => {
    expect(monthsWalked(0)).toBe("not a month yet");
    expect(monthsWalked(1)).toBe("1 month walked");
    expect(monthsWalked(7)).toBe("7 months walked");
    expect(eraPlace(1, 1)).toBe("the first era");
    expect(eraPlace(2, 4)).toBe("the 2nd era of 4");
    expect(eraPlace(3, 4)).toBe("the 3rd era of 4");
    expect(eraPlace(11, 12)).toBe("the 11th era of 12");
    expect(eraPlaqueWords(EMPTY_ATLAS_READING)).toContain("No era yet");
    expect(eraPlaqueWords({ ...EMPTY_ATLAS_READING, era: { key: "era:X", name: "The small flat", index: 2, months: 7, home: "flat", homeLabel: "a small flat", finishLine: "", plans: 0 }, eras: 3, gate: { kind: "agree", met: true, lit: 1, lanterns: 1, words: "Ready to cross" } }))
      .toBe("The small flat\nthe 2nd era of 3 · 7 months walked\nReady to cross");
    // The ring runs clockwise from the gate, and never off the turf.
    expect(stonePin(0, 12).x).not.toBe(stonePin(1, 12).x);
    for (const index of [0, 6, 11]) expect(Math.hypot(stonePin(index, 12).x, stonePin(index, 12).z)).toBeCloseTo(0.78 * 0.62, 6);
  });
});

describe("the three rooms as places", () => {
  const kitchenReading = { kitchen: buildKitchenReading(household([version([
    line({ id: "a", dueDate: "2026-10-08", responsibility: { kind: "joint" } }),
    line({ id: "b", lens: "prepare" }),
  ])]), "MEM-001", today), partner: { name: "Bianca", fresh: true } };

  it("the Kitchen: every card, the empty card, the drawer and the folio are doors — never commands", () => {
    const scene = new THREE.Scene();
    const handle = PLACES.kitchen!.build(scene, { theme: "classic" } as never, kitchenReading as never, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    const cards = anchors.filter((anchor) => anchor.zone === "card" && anchor.id.startsWith("card:"));
    expect(cards.length).toBe(2);
    for (const card of cards) expect(card.door).toMatchObject({ target: "plan-studio" });
    expect(anchors.find((anchor) => anchor.id === "empty-card")?.door?.target).toBe("plan-studio");
    expect(anchors.find((anchor) => anchor.id === "drawer")?.door?.target).toBe("plan-studio");
    expect(anchors.find((anchor) => anchor.id === "folio")?.door?.target).toBe("conversation");
    expect(anchors.find((anchor) => anchor.id === "court-door")?.zone).toBe("stair");
    expect(anchors.find((anchor) => anchor.id === "atlas")?.zone).toBe("landmark");
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("the Boathouse: six stations, each a door onto the room that owns it, counts and never contents", () => {
    const scene = new THREE.Scene();
    const reading = { boathouse: buildBoathouseReading({ hearthside: { experiences: [1, 2, 3], memories: [1], notes: [], encounters: [1, 2] } as never }), partner: null };
    const handle = PLACES.boathouse!.build(scene, { theme: "classic" } as never, reading as never, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const doors = Object.fromEntries(handle.anchors().filter((anchor) => anchor.door).map((anchor) => [anchor.id, anchor.door!.target]));
    expect(doors).toEqual({ wishes: "wishes", projector: "projector", memories: "memories", pottery: "pottery", letters: "letters", boat: "encounters" });
    expect(handle.anchors().find((anchor) => anchor.id === "wishes")?.label).toContain("3 ideas in the light");
    handle.dispose();
    expect(buildBoathouseReading({})).toEqual(EMPTY_BOATHOUSE_READING);
    expect(fewWords(0, "x", "xs")).toBe("nothing yet");
  });

  it("the Library: the Book, the Bindery and the Time Machine all open the Standing Book", () => {
    const scene = new THREE.Scene();
    const handle = PLACES.library!.build(scene, { theme: "classic" } as never, null, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    for (const id of ["book", "bindery", "time-machine", "balcony"]) expect(anchors.find((anchor) => anchor.id === id)?.door?.target).toBe("books");
    expect(anchors.find((anchor) => anchor.id === "glasshouse-way")?.zone).toBe("landmark");
    expect(anchors.find((anchor) => anchor.id === "court-door")?.zone).toBe("stair");
    expect(BINDERY_MACHINES.length).toBe(5);
    handle.dispose();
  });

  it("the Cottage reading counts what Hercules keeps and never what it is", () => {
    const reading = buildCottageReading({
      kitchen: { companion: { name: "Hercules", equipped: { hat: "straw", chain: null, house: "", collar: "bell" } } },
      companionGallery: [{ value: { look: { name: "Sunday best" } } }, { value: null }, { value: { look: { name: "Snow day" } } }],
      playRoom: { slots: [{ value: { kind: "keepsake", id: "shell" } }, { value: null }] },
    });
    expect(reading).toEqual({ name: "Hercules", worn: 2, looks: 2, keepsakes: 1 });
    // The staged outfit outranks the legacy four when one is on.
    expect(buildCottageReading({
      kitchen: { companion: { name: "Herc", equipped: { hat: "straw", chain: null, house: null, collar: null } } },
      playRoom: { stageOutfit: { value: { selections: { head: { itemId: "a", variantId: "b" }, body: { itemId: "c", variantId: "d" }, charm: { itemId: "e", variantId: "f" } } } } },
    })).toMatchObject({ name: "Herc", worn: 3 });
    // A household without a companion is an empty cottage, not a broken one.
    expect(buildCottageReading({})).toEqual(EMPTY_COTTAGE_READING);
    expect(kept(0, "look kept", "looks kept")).toBe("nothing yet");
    expect(kept(1, "look kept", "looks kept")).toBe("1 look kept");
    expect(wearingWords(0, "Hercules")).toBe("Hercules is in his own fur today");
    expect(wearingWords(1, "Hercules")).toBe("Hercules is wearing 1 piece");
  });

  it("the Cottage: five stations, each a door onto the room that already owns it — and the room writes nothing", () => {
    const scene = new THREE.Scene();
    const reading = { cottage: buildCottageReading({ kitchen: { companion: { name: "Hercules", equipped: { hat: "straw", chain: null, house: null, collar: "bell" } } }, companionGallery: [{ value: { look: {} } }] }) };
    const handle = PLACES.cottage!.build(scene, { theme: "classic" } as never, reading as never, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    const doors = Object.fromEntries(anchors.filter((anchor) => anchor.door).map((anchor) => [anchor.id, anchor.door!.target]));
    expect(doors).toEqual({ wardrobe: "wardrobe", mirror: "wardrobe", cabinet: "wardrobe", "window-seat": "hercules", bell: "hercules" });
    expect(anchors.find((anchor) => anchor.id === "cabinet")?.label).toContain("1 look kept");
    expect(anchors.find((anchor) => anchor.id === "window-seat")?.label).toContain("wearing 2 pieces");
    expect(anchors.find((anchor) => anchor.id === "court-door")?.zone).toBe("stair");
    // Every region the twins can reach is one of the six stations, and each has a box.
    for (const region of handle.regions()) expect(region.box).toBeTruthy();
    handle.dispose();
    expect(scene.children.length).toBe(0);
    expect(readCottageReading(null)).toEqual({ cottage: null });
    expect(cottagePoses([])["door:phone"]).toBeTruthy();
  });

  it("the Kiln: the wheel, the bench, the kiln and every fired piece are doors onto the Studio", () => {
    const scene = new THREE.Scene();
    const handle = PLACES.kiln!.build(scene, { theme: "classic" } as never, { kiln: kilnReading, partner: null } as never, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    const doors = Object.fromEntries(anchors.filter((anchor) => anchor.door).map((anchor) => [anchor.id, `${anchor.door!.target}${anchor.door!.object ? `/${anchor.door!.object}` : ""}`]));
    expect(doors).toEqual({
      wheel: "pottery/wheel", bench: "pottery/paint", kiln: "pottery/kiln", shelf: "pottery",
      "piece:goal/GOAL-1": "pottery/goal/GOAL-1", "piece:bank/plan:build": "pottery/bank/plan:build",
      hercules: "hercules",
    });
    // The shelf says what it holds and what it does not: counts, never contents.
    expect(anchors.find((anchor) => anchor.id === "shelf")?.label).toContain("3 pieces fired");
    expect(anchors.find((anchor) => anchor.id === "shelf")?.label).toContain("2 kept privately");
    expect(anchors.find((anchor) => anchor.id === "kiln")?.label).toContain("still hot");
    expect(anchors.find((anchor) => anchor.id === "court-door")?.zone).toBe("stair");
    expect(anchors.find((anchor) => anchor.id === "boathouse")?.zone).toBe("landmark");
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("the Atlas: the island, the gate, the plaque and the next island are doors onto Journey — the room writes nothing", () => {
    const scene = new THREE.Scene();
    const atlas = buildAtlasReading(journey([
      eraRow("PATH-ERA-B", eraSpec({ order: 1, name: "The small flat", from: "2026-03", finish: { kind: "banks", goalIds: ["GOAL-1", "GOAL-2"] } })),
      eraRow("PATH-ERA-C", eraSpec({ order: 2, name: "The house with the porch", from: "2028-01", home: "porch" })),
    ], {
      goals: [
        { id: "GOAL-1", name: "Deposit", shared: true, ownerMemberId: null, targetCents: 100_000, savedCents: 0, status: "open", purchaseId: null },
        { id: "GOAL-2", name: "Movers", shared: true, ownerMemberId: null, targetCents: 20_000, savedCents: 0, status: "open", purchaseId: "PUR-1" },
      ],
    }) as never, "MEM-001", today);
    const handle = PLACES.atlas!.build(scene, { theme: "classic" } as never, { atlas, partner: { name: "Bianca", fresh: true } } as never, "lite", { composition: "desktop", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    const doors = Object.fromEntries(anchors.filter((anchor) => anchor.door).map((anchor) => [anchor.id, `${anchor.door!.target}${anchor.door!.object ? `/${anchor.door!.object}` : ""}`]));
    expect(doors).toEqual({
      island: "journey/era:PATH-ERA-B",
      gate: "journey/era:PATH-ERA-B",
      plaque: "journey/era:PATH-ERA-B",
      "next-island": "journey/era:PATH-ERA-C",
      stones: "journey",
    });
    // Every door in this room opens the one world it is a map of, and nothing else.
    for (const anchor of anchors) if (anchor.door) expect(anchor.door.target).toBe("journey");
    expect(anchors.find((anchor) => anchor.id === "island")?.label).toContain("7 months walked");
    expect(anchors.find((anchor) => anchor.id === "island")?.label).toContain("a small flat");
    expect(anchors.find((anchor) => anchor.id === "gate")?.label).toContain("1 of 2 lit");
    expect(anchors.find((anchor) => anchor.id === "next-island")?.label).toContain("The house with the porch");
    expect(anchors.find((anchor) => anchor.id === "stones")?.label).toContain("7 stones laid");
    // The stair goes back down into the Kitchen; the loft door back to the Court.
    expect(anchors.find((anchor) => anchor.id === "kitchen-stair")?.zone).toBe("stair");
    expect(anchors.find((anchor) => anchor.id === "court-door")?.zone).toBe("stair");
    // The dormer is a view, not a door.
    expect(anchors.find((anchor) => anchor.id === "dormer")?.door).toBeUndefined();
    for (const region of handle.regions()) expect(region.box).toBeTruthy();
    handle.dispose();
    expect(scene.children.length).toBe(0);
    expect(readAtlasReading(null)).toEqual({ atlas: null, partnerName: null });
    expect(atlasPoses([])["door:phone"]).toBeTruthy();
  });

  it("the Atlas without a journey: a bare stand, no gate, and the fog still on the far table", () => {
    const scene = new THREE.Scene();
    const handle = PLACES.atlas!.build(scene, { theme: "classic" } as never, { atlas: EMPTY_ATLAS_READING } as never, "lite", { composition: "phone", signal: new AbortController().signal, invalidate: () => {} });
    const anchors = handle.anchors();
    expect(anchors.find((anchor) => anchor.id === "gate")).toBeUndefined();
    expect(anchors.find((anchor) => anchor.id === "island")?.label).toContain("the journey has not begun");
    expect(anchors.find((anchor) => anchor.id === "island")?.door).toMatchObject({ target: "journey", object: "era-home" });
    expect(anchors.find((anchor) => anchor.id === "next-island")?.label).toContain("no next era planned");
    expect(anchors.find((anchor) => anchor.id === "plaque")?.label).toBe("No era yet · The island is waiting to be named. Open this era in Journey.");
    expect(handle.regions().find((region) => region.id === "next-island")?.label).toContain("unplanned");
    handle.dispose();
    expect(scene.children.length).toBe(0);
  });

  it("draws each room inside the harbour's budget and keeps every pose inside its own hold", () => {
    for (const [id, build] of [
      ["kitchen", () => createKitchen(new THREE.Scene(), { dressing: KITCHEN_DRESSING.classic, reading: kitchenReading, quality: "lite" })],
      ["boathouse", () => createBoathouse(new THREE.Scene(), { dressing: BOATHOUSE_DRESSING.classic, reading: { boathouse: { wishes: 4, memories: 3, letters: 2, encounters: 1 } }, quality: "lite" })],
      ["library", () => createLibrary(new THREE.Scene(), { dressing: LIBRARY_DRESSING.classic, quality: "lite" })],
      ["cottage", () => createCottage(new THREE.Scene(), { dressing: COTTAGE_DRESSING.classic, reading: { cottage: { name: "Hercules", worn: 4, looks: 5, keepsakes: 4 } }, quality: "lite" })],
      ["kiln", () => createKiln(new THREE.Scene(), { dressing: KILN_DRESSING.classic, reading: { kiln: kilnReading }, quality: "lite" })],
      ["atlas", () => createAtlas(new THREE.Scene(), { dressing: ATLAS_DRESSING.classic, quality: "lite", reading: { atlas: {
        era: { key: "era:PATH-ERA-B", name: "The small flat", index: 2, months: ATLAS_RING_STONES + 6, home: "flat", homeLabel: "a small flat", finishLine: "When the rent stops being the whole of it", plans: 3 },
        eras: 3, crossed: 1, gate: { kind: "banks", met: false, lit: 2, lanterns: ATLAS_GATE_LANTERNS + 4, words: "2 of 12 lit" },
        crossing: false, next: { key: "era:PATH-ERA-C", name: "The house with the porch", sketched: false }, stones: 44, keptPrivate: 1,
      } } })],
    ] as const) {
      const handle = build();
      let meshes = 0;
      handle.group.traverse((node) => { if ((node as THREE.Mesh).isMesh) meshes++; });
      expect(meshes, `${id} meshes`).toBeLessThanOrEqual(120);
      const roomHold = PLACE_HOLDS[id]!;
      for (const [key, pose] of Object.entries(handle.poses())) {
        const heldPose = holdPoseInRoom(pose, roomHold);
        const eye = poseEye(heldPose);
        for (let axis = 0; axis < 3; axis++) {
          expect(eye[axis]!, `${id} ${key} eye[${axis}]`).toBeGreaterThanOrEqual(roomHold.eye.min[axis]! - 1e-6);
          expect(eye[axis]!, `${id} ${key} eye[${axis}]`).toBeLessThanOrEqual(roomHold.eye.max[axis]! + 1e-6);
        }
      }
      handle.dispose();
    }
    expect(readKilnReading(null)).toEqual({ kiln: null, partnerName: null });
    expect(kilnPoses([])["door:phone"]).toBeTruthy();
    expect(readKitchenReading(null)).toEqual({ kitchen: null, partnerName: null });
    expect(readBoathouseReading(null)).toEqual({ boathouse: null, partnerName: null });
    expect(kitchenPoses([])["door:desktop"]).toBeTruthy();
    expect(libraryPoses([])["door:phone"]).toBeTruthy();
  });
});
