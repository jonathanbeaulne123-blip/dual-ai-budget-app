import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { buildCellarDetails } from "../src/harbour/village/cellarDetails.ts";

const dressing = { theme: "classic", stone: "#777", joint: "#555", moss: "#486", plinth: "#968", timber: "#765", metal: "#b98", gate: "#654", terrace: "#765", lawn: "#486", sky: "#cdf", sea: "#579", fog: "#abc", fogNear: 1, fogFar: 10, light: { sun: "#fff", hemiSky: "#fff", hemiGround: "#333", intensity: 1 } } as const;

describe("village cellar details", () => {
  it("batches the fitted floor and rear stonework, leaving the bill rail and stair approach clear", () => {
    const made = buildCellarDetails(dressing, "lite");
    const floor = made.group.getObjectByName("cellar-flagstone-dark") as THREE.InstancedMesh;
    const wall = made.group.getObjectByName("cellar-rear-stonework") as THREE.InstancedMesh;
    expect(floor.isInstancedMesh).toBe(true); expect(floor.count).toBeGreaterThan(30);
    expect(wall.isInstancedMesh).toBe(true); expect(wall.count).toBeGreaterThan(15);
    expect(made.group.getObjectByName("cellar-centre-runner")?.position.y).toBeCloseTo(.065);
    for (const name of ["cellar-side-barrel", "cellar-side-crate", "cellar-wall-sconce", "cellar-wall-sconce-light"]) expect(made.group.getObjectByName(name)).toBeTruthy();
    const stairClearance = new THREE.Box3(new THREE.Vector3(2.8, 0, 1.05), new THREE.Vector3(4.5, 2, 3.3));
    for (const child of made.group.children) if (child.name.startsWith("cellar-side-")) expect(new THREE.Box3().setFromObject(child).intersectsBox(stairClearance)).toBe(false);
    made.dispose(); made.dispose(); expect(made.group.children).toHaveLength(0); expect(made.group.parent).toBeNull();
  });
});
