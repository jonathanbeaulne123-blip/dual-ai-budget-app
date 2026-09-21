// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import {
  EMPTY_BOATHOUSE_READING, EMPTY_KITCHEN_READING, buildBoathouseReading, buildKitchenReading, KITCHEN_CARD_CAP,
} from "../src/harbour/data/reading.ts";
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

  it("draws each room inside the harbour's budget and keeps every pose inside its own hold", () => {
    for (const [id, build] of [
      ["kitchen", () => createKitchen(new THREE.Scene(), { dressing: KITCHEN_DRESSING.classic, reading: kitchenReading, quality: "lite" })],
      ["boathouse", () => createBoathouse(new THREE.Scene(), { dressing: BOATHOUSE_DRESSING.classic, reading: { boathouse: { wishes: 4, memories: 3, letters: 2, encounters: 1 } }, quality: "lite" })],
      ["library", () => createLibrary(new THREE.Scene(), { dressing: LIBRARY_DRESSING.classic, quality: "lite" })],
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
    expect(readKitchenReading(null)).toEqual({ kitchen: null, partnerName: null });
    expect(readBoathouseReading(null)).toEqual({ boathouse: null, partnerName: null });
    expect(kitchenPoses([])["door:desktop"]).toBeTruthy();
    expect(libraryPoses([])["door:phone"]).toBeTruthy();
  });
});
