// @vitest-environment jsdom
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { PlaceReading } from "../src/harbour/scene/place.ts";
import { createLoft, LOFT_LAYOUT } from "../src/harbour/village/LoftScene.ts";

// The real scene deliberately falls back when canvas is unavailable; make that
// normal jsdom condition quiet so this focused topology test stays readable.
Object.defineProperty(HTMLCanvasElement.prototype, "getContext", { configurable: true, value: () => null });

const reading = (banks: number): PlaceReading => ({ tower: { shelves: [{ id: "shelf", share: 1, cutoff: 10, full: false, banks: Array.from({ length: banks }, (_, index) => ({ key: `bank-${index}`, goalId: null, name: `Bank ${index}`, cents: index * 100, targetCents: 1000, step: index % 11, category: "build", sculptSeed: `bank-${index}` })) }], jug: { safeCents: 0, custodian: false, holder: null }, gun: { available: false }, largestTargetCents: 1000, smallestTargetCents: 1000 } } as PlaceReading);
const dressing = { timber: "#704a37", metal: "#b58b45", stone: "#d9c8a6" };

describe("village loft", () => {
  it("keeps every Kitty Bank beyond the original eighteen-slot rack and routes it to the functional Loft", () => {
    const scene = new THREE.Scene(), loft = createLoft(scene, dressing, reading(LOFT_LAYOUT.columns * 4 + 3), "lite");
    const anchors = loft.anchors();
    expect(anchors.filter(anchor => anchor.zone === "bank")).toHaveLength(LOFT_LAYOUT.columns * 4 + 3);
    expect(anchors.find(anchor => anchor.id === "loft-banks")?.door).toEqual({ target: "loft-banks" });
    expect(anchors.find(anchor => anchor.id === "bank:bank-0")?.door?.object).toBe("bank/plan:bank-0");
    loft.dispose();
  });

  it("does not rebuild the standing banks when unrelated reading identity changes", () => {
    const scene = new THREE.Scene(), loft = createLoft(scene, dressing, reading(2), "lite");
    const first = loft.group.children.find(node => node.userData.anchor === "bank:bank-0")!;
    loft.update({ ...reading(2), partner: { fresh: true, name: "Bianca" } });
    expect(loft.group.children.find(node => node.userData.anchor === "bank:bank-0")).toBe(first);
    expect(loft.group.getObjectByName("loft-back-window-glass")).toBeTruthy(); expect(loft.group.getObjectByName("loft-window-seat-cushion")).toBeTruthy(); loft.dispose();
  });

  it("leaves both authored stair portals clear and retains local region boxes", () => {
    const loft = createLoft(new THREE.Scene(), dressing, reading(0), "lite");
    expect(loft.anchors().filter(anchor => anchor.zone === "portal").map(anchor => anchor.position)).toEqual([[-2, 0, 1.7], [2, 0, -1.5]]);
    for (const region of loft.regions()) expect(region.box?.min.x).toBeGreaterThanOrEqual(-LOFT_LAYOUT.halfX - .1);
    loft.dispose();
  });
});
