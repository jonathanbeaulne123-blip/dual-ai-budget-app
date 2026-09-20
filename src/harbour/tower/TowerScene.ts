// WRITER T REPLACES — the thinnest Place that registers id "tower" so tsc, the
// shell and the travel tests run before `src/harbour/tower/**` lands. It has
// the contract writer T's tower keeps: a `setRoof(k)` handle, a `stair` anchor
// back to the court, the jug and the gun on the landing, and one anchor per
// bank on the rack's shelves. Everything it draws is a box.
import * as THREE from "three";
import { registerPlace, type Anchor, type Place, type PlaceHandle, type PlaceReading, type Pose } from "../scene/place.ts";

export type TowerHandle = PlaceHandle & { setRoof(k: number): void };

export const towerPlace: Place = registerPlace({
  id: "tower",
  build(scene, dressing, reading) {
    const group = new THREE.Group();
    group.name = "Tower (placeholder)";
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(dressing.timber), roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.8, 3.2, 12), material);
    body.position.y = 1.6;
    body.userData.anchor = "stair";
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2, 1, 12), material);
    roof.name = "roof";
    roof.position.y = 3.7;
    group.add(body, roof);
    scene.add(group);
    let current: PlaceReading | null = reading;
    const banks = () => current?.tower.shelves.flatMap((shelf) => shelf.banks) ?? [];
    const handle: TowerHandle = {
      group,
      setRoof(k) { roof.position.y = 3.7 + Math.max(0, Math.min(1, k)) * 2.4; },
      update(next) { current = next; },
      animate() {},
      dispose() {
        scene.remove(group);
        body.geometry.dispose(); roof.geometry.dispose(); material.dispose();
      },
      anchors(): Anchor[] {
        return [
          { id: "stair", position: [0, 0, 1.8], zone: "stair", label: "The stair down. Back to the Court." },
          { id: "jug", position: [-1.2, 0, 1.2], zone: "landing", label: "The jug on its stand. Open the Loft at the pour.", door: { target: "loft-banks", object: "pour" } },
          { id: "gun", position: [1.2, 0, 1.2], zone: "landing", label: "The money gun on its peg. Open the Loft at the gun.", door: { target: "loft-banks", object: "gun" } },
          ...banks().map((bank, index): Anchor => ({
            id: `bank:${bank.key}`,
            position: [(index % 2 ? 1 : -1) * 1.1, 1 + index * 0.4, 0],
            zone: "shelves",
            label: `${bank.name}. Open the Loft at this bank.`,
            door: { target: "loft-banks", object: `bank/plan:${bank.key}` },
          })),
        ];
      },
      poses(): Record<string, Pose> { return { court: { target: [0, 1.6, 0], r: 7, theta: 0, phi: 1.05 } }; },
      regions() { return []; },
    };
    return handle;
  },
});
