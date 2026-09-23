import * as THREE from "three";
import type { PlaceDressing } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";

export type RoomDressingRoom = "kitchen" | "tower" | "cellar" | "atlas" | "bank" | "library" | "glasshouse" | "kiln" | "cottage" | "boathouse";
export type RoomLook = { layout: "gather" | "open"; plant: "fern" | "flowers"; light: "warm" | "daylight"; displays?: { kind: "piece" | "memory"; id: string; revision: number; designId?: string }[] };
export type RoomDressing = { group: THREE.Group; apply(look: RoomLook | null): void; dispose(): void };

/**
 * A small host-owned side arrangement.  It never creates a pretend memory or
 * artwork: `displays` is accepted as an eligibility boundary, but actual art
 * belongs to the caller that can render a real approved reference.
 */
export function buildRoomDressing(room: RoomDressingRoom, dressing: PlaceDressing, tier: RenderTier): RoomDressing {
  const group = new THREE.Group(); group.name = `room-dressing-${room}`;
  const owned = new Set<{ dispose(): void }>(); let dead = false;
  const material = (color: string, opt: Partial<THREE.MeshStandardMaterialParameters> = {}) => { const result = new THREE.MeshStandardMaterial({ color, roughness: .8, ...opt }); owned.add(result); return result; };
  const timber = material(dressing.timber), trim = material(dressing.metal, { metalness: .28 }), rug = material(dressing.theme === "newfoundland" ? "#547a78" : dressing.theme === "taylor" ? "#927779" : "#89634b"), leaf = material("#55724a"), flower = material("#cf8d79"), pot = material("#9c7057");
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string, at: readonly [number, number, number]) => { owned.add(geometry); const mesh = new THREE.Mesh(geometry, mat); mesh.name = `${room}-${name}`; mesh.position.set(...at); mesh.castShadow = tier === "full"; mesh.receiveShadow = true; group.add(mesh); return mesh; };
  // Stay in a side corner: inherited room centre, doors and stair routes remain clear.
  const base = room === "cellar" ? [3.7, .02, 1.75] as const : room === "atlas" ? [2.45, .02, 1.45] as const : room === "tower" ? [-1.9, .02, -1.85] as const : [-2.45, .02, 1.72] as const;
  const furniture = new THREE.Group(); furniture.name = `${room}-side-furniture`; furniture.position.set(base[0],base[1],base[2]); group.add(furniture);
  const plantGroup = new THREE.Group(); plantGroup.name = `${room}-living-plant`; plantGroup.position.set(base[0] + .65, .02, base[2] - .4); group.add(plantGroup);
  const place = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string, at: readonly [number, number, number]) => { owned.add(geometry); const mesh = new THREE.Mesh(geometry, mat); mesh.name = `${room}-${name}`; mesh.position.set(...at); mesh.castShadow = tier === "full"; mesh.receiveShadow = true; furniture.add(mesh); return mesh; };
  place(new THREE.BoxGeometry(1.7, .035, 1.16), rug, "side-rug", [0, .025, 0]);
  place(new THREE.CylinderGeometry(.36, .42, .56, 10), timber, "side-table", [0, .31, 0]);
  place(new THREE.CylinderGeometry(.45, .45, .075, 10), trim, "side-table-top", [0, .62, 0]);
  const bench = place(new THREE.BoxGeometry(1.25, .16, .42), timber, "bench-seat", [0, .48, -.48]);
  const chairA = place(new THREE.BoxGeometry(.46, .16, .46), timber, "chair-a-seat", [-.62, .43, .34]);
  const chairB = place(new THREE.BoxGeometry(.46, .16, .46), timber, "chair-b-seat", [.62, .43, .34]);
  // Short legs communicate furniture while keeping the draw cost to a handful of meshes.
  for (const [x, z] of [[-.48, -.62], [.48, -.62], [-.83, .18], [-.42, .18], [.42, .18], [.83, .18]] as const) place(new THREE.CylinderGeometry(.04, .05, .42, 6), timber, "furniture-leg", [x, .21, z]);
  const lamp = new THREE.PointLight("#ffd49a", tier === "full" ? .68 : .4, 4.5, 2); lamp.name = `${room}-dressing-lamp`; lamp.position.set(base[0], 1.85, base[2]); group.add(lamp);
  const clearPlant = () => { plantGroup.traverse(node => { if (node instanceof THREE.Mesh) { node.geometry.dispose(); owned.delete(node.geometry); } }); plantGroup.clear(); };
  const fern = () => { clearPlant(); const vessel = add(new THREE.CylinderGeometry(.17, .22, .3, 10), pot, "fern-pot", [0, .15, 0]); plantGroup.add(vessel); for (let i = 0; i < 9; i++) { const frond = add(new THREE.ConeGeometry(.1, .65, 5), leaf, `fern-frond-${i}`, [0, .55, 0]); frond.rotation.z = (i - 4) * .18; frond.rotation.y = i * .7; plantGroup.add(frond); } };
  const flowers = () => { clearPlant(); const vessel = add(new THREE.CylinderGeometry(.18, .23, .32, 10), pot, "flower-pot", [0, .16, 0]); plantGroup.add(vessel); for (let i = 0; i < 5; i++) { const stem = add(new THREE.CylinderGeometry(.018, .02, .46, 6), leaf, `flower-stem-${i}`, [(i - 2) * .08, .48, 0]); const bloom = add(new THREE.SphereGeometry(.1, 8, 6), flower, `flower-bloom-${i}`, [(i - 2) * .08, .75 + (i % 2) * .07, 0]); plantGroup.add(stem, bloom); } };
  const apply = (look: RoomLook | null) => {
    const next = look ?? { layout: "gather", plant: "fern", light: "warm" } satisfies RoomLook;
    // Gather faces the seats toward the table; open moves them to the rug edge and leaves a clear middle.
    bench.position.set(0, .48, next.layout === "gather" ? -.48 : -.62); chairA.position.set(next.layout === "gather" ? -.62 : -.78, .43, next.layout === "gather" ? .34 : .54); chairB.position.set(next.layout === "gather" ? .62 : .78, .43, next.layout === "gather" ? .34 : .54);
    if (next.plant === "fern") fern(); else flowers();
    const daylight = next.light === "daylight"; lamp.color.set(daylight ? "#d8ecff" : "#ffd49a"); lamp.intensity = daylight ? (tier === "full" ? .38 : .24) : (tier === "full" ? .68 : .4);
    // `displays` intentionally has no visual fallback: a generic frame would invent a memory or art piece.
  };
  apply(null);
  return { group, apply, dispose: () => { if (dead) return; dead = true; group.removeFromParent(); for (const item of owned) item.dispose(); owned.clear(); group.clear(); } };
}
