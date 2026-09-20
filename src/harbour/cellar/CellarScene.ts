// WRITER C REPLACES — the thinnest Place that registers id "cellar" so tsc,
// the shell and the travel tests run before `src/harbour/cellar/**` lands. It
// has the contract writer C's cellar keeps: `setLid(k)` for the court's floor
// lifting away, `setScrub(index)` for the day on the rail, a `stair` anchor
// back to the court, and one anchor per jar. Everything it draws is a box.
import * as THREE from "three";
import { registerPlace, type Anchor, type Place, type PlaceHandle, type PlaceReading, type Pose } from "../scene/place.ts";

export type CellarHandle = PlaceHandle & { setLid(k: number): void; setScrub(index: number): void };

export const cellarPlace: Place = registerPlace({
  id: "cellar",
  build(scene, dressing, reading) {
    const group = new THREE.Group();
    group.name = "Cellar (placeholder)";
    const material = new THREE.MeshStandardMaterial({ color: new THREE.Color(dressing.stone), roughness: 1 });
    const rail = new THREE.Mesh(new THREE.BoxGeometry(5, 0.2, 0.6), material);
    rail.position.set(0, -1.4, -1.2);
    rail.userData.anchor = "rail";
    const lid = new THREE.Mesh(new THREE.BoxGeometry(6, 0.2, 6), material);
    lid.name = "lid";
    lid.position.y = 0;
    group.add(rail, lid);
    scene.add(group);
    let current: PlaceReading | null = reading;
    let day = current?.cellar.todayIndex ?? 0;
    const handle: CellarHandle = {
      group,
      setLid(k) { lid.position.y = Math.max(0, Math.min(1, k)) * 3; },
      setScrub(index) { day = index; },
      update(next) { current = next; day = Math.min(day, Math.max(0, (next?.cellar.days.length ?? 1) - 1)); },
      animate() {},
      dispose() {
        scene.remove(group);
        rail.geometry.dispose(); lid.geometry.dispose(); material.dispose();
      },
      anchors(): Anchor[] {
        const jars = current?.cellar.jars ?? [];
        return [
          { id: "stair", position: [0, -2, 1.8], zone: "stair", label: "The stair up. Back to the Court." },
          { id: "waterline", position: [0, -1.8, -2], zone: "water", label: `The water line, day ${day + 1} of the month.` },
          ...jars.map((jar, index): Anchor => ({
            id: `jar:${jar.key}`,
            position: [(index - (jars.length - 1) / 2) * 0.7, -1.1, -1.2],
            zone: "rail",
            label: `${jar.label}. Open the Cellar at this jar.`,
            door: { target: "cellar-bills", object: `jar/${jar.key}` },
          })),
        ];
      },
      poses(): Record<string, Pose> { return { court: { target: [0, -1.4, 0], r: 6.5, theta: 0, phi: 1.2 } }; },
      regions() { return []; },
    };
    return handle;
  },
});
