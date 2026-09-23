import * as THREE from "three";
import type { PlaceDressing } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";

export type CellarDetails = { group: THREE.Group; dispose(): void };

/**
 * Quiet architectural finish for the open cellar: a readable rear wall and a
 * warm floor, while the bill rail, centre aisle, and stair remain clear.
 */
export function buildCellarDetails(dressing: PlaceDressing, tier: RenderTier): CellarDetails {
  const group = new THREE.Group(); group.name = "cellar-architectural-details";
  const owned = new Set<{ dispose(): void }>(); let disposed = false;
  const material = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .86, ...extra }); owned.add(value); return value;
  };
  const stone = material(dressing.stone), paleStone = material(dressing.plinth), mortar = material(dressing.joint), timber = material(dressing.timber), brass = material(dressing.metal, { metalness: .62, roughness: .32 }), ember = material("#e6a95d", { emissive: "#c87732", emissiveIntensity: .5, roughness: .45 });
  const shadowed = (item: THREE.Object3D) => { item.traverse((node) => { const mesh = node as THREE.Mesh; if (mesh.isMesh) { mesh.castShadow = tier === "full"; mesh.receiveShadow = true; } }); return item; };
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string, at: readonly [number, number, number], rotation: readonly [number, number, number] = [0, 0, 0]) => {
    owned.add(geometry); const item = new THREE.Mesh(geometry, mat); item.name = name; item.position.set(...at); item.rotation.set(...rotation); shadowed(item); group.add(item); return item;
  };
  const instanced = (geometry: THREE.BufferGeometry, mat: THREE.Material, name: string, points: readonly (readonly [number, number, number])[]) => {
    owned.add(geometry); const item = new THREE.InstancedMesh(geometry, mat, points.length); item.name = name;
    const matrix = new THREE.Matrix4(); for (let i = 0; i < points.length; i++) { matrix.makeTranslation(...points[i]!); item.setMatrixAt(i, matrix); }
    item.instanceMatrix.needsUpdate = true; item.castShadow = tier === "full"; item.receiveShadow = true; group.add(item); return item;
  };

  // The floor reads as fitted flagstone without a single broad, anonymous slab.
  const darkTiles: [number, number, number][] = [], lightTiles: [number, number, number][] = [];
  for (let row = 0; row < 7; row++) for (let column = 0; column < 9; column++) {
    const target = (row + column) % 3 === 0 ? lightTiles : darkTiles;
    target.push([-4 + column, .025, -2.9 + row * .96]);
  }
  instanced(new THREE.BoxGeometry(.94, .05, .9), stone, "cellar-flagstone-dark", darkTiles);
  instanced(new THREE.BoxGeometry(.94, .05, .9), paleStone, "cellar-flagstone-light", lightTiles);

  // Staggered rear blocks live behind the rail at z=-1.5, with shallow joints catching the sconce light.
  const rearBlocks: [number, number, number][] = [], rearCaps: [number, number, number][] = [];
  for (let row = 0; row < 4; row++) for (let column = 0; column < 9; column++) {
    const x = -4 + column + (row % 2 ? .34 : 0); const target = (row + column) % 3 === 0 ? rearCaps : rearBlocks;
    target.push([x, .28 + row * .5, -3.19]);
  }
  instanced(new THREE.BoxGeometry(.92, .43, .1), stone, "cellar-rear-stonework", rearBlocks);
  instanced(new THREE.BoxGeometry(.92, .43, .1), paleStone, "cellar-rear-stonework-light", rearCaps);
  for (let row = 0; row < 4; row++) mesh(new THREE.BoxGeometry(8.9, .025, .025), mortar, "cellar-rear-mortar-course", [0, .51 + row * .5, -3.13]);

  // A runner gives the aisle a warm direction, but stops well before the rail and leaves the stair corner open.
  mesh(new THREE.BoxGeometry(1.22, .018, 2.45), material(dressing.theme === "newfoundland" ? "#3d6e78" : "#754c3c"), "cellar-centre-runner", [0, .065, 1.28]);

  // Low stores stay in left and rear-side corners, outside the x=-4..4 bill rail and stair at x=3.6,z=1.9.
  for (const [x, z] of [[-3.7, 2.32], [-3.08, 2.5]] as const) {
    mesh(new THREE.CylinderGeometry(.38, .44, .66, 10), timber, "cellar-side-barrel", [x, .38, z]);
    mesh(new THREE.TorusGeometry(.4, .025, 6, 12), brass, "cellar-barrel-hoop", [x, .28, z], [Math.PI / 2, 0, 0]);
    mesh(new THREE.TorusGeometry(.4, .025, 6, 12), brass, "cellar-barrel-hoop", [x, .49, z], [Math.PI / 2, 0, 0]);
  }
  for (const [x, z, yaw] of [[-3.68, .96, .1], [3.72, -2.72, -.12]] as const) {
    mesh(new THREE.BoxGeometry(.78, .5, .7), timber, "cellar-side-crate", [x, .3, z], [0, yaw, 0]);
    mesh(new THREE.BoxGeometry(.1, .54, .74), brass, "cellar-crate-band", [x, .31, z], [0, yaw, 0]);
  }

  // Two shallow sconces pool warm light on the rear stone without claiming any financial information.
  for (const x of [-3.15, 3.15]) {
    mesh(new THREE.BoxGeometry(.22, .28, .07), brass, "cellar-wall-sconce-bracket", [x, 1.34, -3.1]);
    mesh(new THREE.CylinderGeometry(.11, .08, .2, 8), ember, "cellar-wall-sconce", [x, 1.43, -3.01]);
    const light = new THREE.PointLight("#e7b267", tier === "full" ? .42 : .25, 2.1, 2); light.name = "cellar-wall-sconce-light"; light.position.set(x, 1.44, -2.86); group.add(light);
  }

  return { group, dispose() { if (disposed) return; disposed = true; group.removeFromParent(); for (const item of owned) item.dispose(); owned.clear(); group.clear(); } };
}
