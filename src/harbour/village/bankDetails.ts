import * as THREE from "three";
import { EngravedPlate, plateFinish } from "../court/engraved.ts";
import type { PlaceDressing } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";

export type BankDetails = { group: THREE.Group; animate(t: number): boolean; dispose(): void };

/** Architectural finish for the Bank hall; all geometry remains local and read-only. */
export function buildBankDetails(dressing: PlaceDressing, tier: RenderTier): BankDetails {
  const group = new THREE.Group(); group.name = "bank-architectural-details";
  const owned = new Set<{ dispose(): void }>(); let dead = false;
  const mat = (color: string, opt: Partial<THREE.MeshStandardMaterialParameters> = {}) => { const value = new THREE.MeshStandardMaterial({ color, roughness: .78, ...opt }); owned.add(value); return value; };
  const stone = mat(dressing.stone), pale = mat("#d9c7a2"), teal = mat("#285c5b"), brass = mat(dressing.metal, { metalness: .66, roughness: .34 }), timber = mat(dressing.timber), paper = mat("#eadfbe");
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, at: readonly [number, number, number], rot: readonly [number, number, number] = [0, 0, 0]) => { owned.add(geometry); const item = new THREE.Mesh(geometry, material); item.name = name; item.position.set(...at); item.rotation.set(...rot); item.castShadow = tier === "full"; item.receiveShadow = true; group.add(item); return item; };
  // Two instanced inlay colours make a proper checker floor without forty-nine draw calls.
  const tileGeometry = new THREE.BoxGeometry(.62, .018, .62); owned.add(tileGeometry);
  const darkTiles = new THREE.InstancedMesh(tileGeometry, stone, 49), lightTiles = new THREE.InstancedMesh(tileGeometry, pale, 49); darkTiles.name = "bank-floor-inlay-dark"; lightTiles.name = "bank-floor-inlay-light";
  const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), scale = new THREE.Vector3(1, 1, 1), rotation = new THREE.Quaternion(); let dark = 0, light = 0;
  for (let x = 0; x < 7; x++) for (let z = 0; z < 7; z++) { point.set(-1.86 + x * .62, .015, -2.8 + z * .62); const target = (x + z) % 2 ? darkTiles : lightTiles, index = (x + z) % 2 ? dark++ : light++; target.setMatrixAt(index, matrix.compose(point, rotation, scale)); }
  darkTiles.count = dark; lightTiles.count = light; darkTiles.instanceMatrix.needsUpdate = true; lightTiles.instanceMatrix.needsUpdate = true; group.add(darkTiles, lightTiles);
  mesh(new THREE.BoxGeometry(1.48, .025, 4.0), teal, "bank-teal-runner", [0, .032, -.94]);
  // Teller window: a timber opening lined by a fine brass grille and ledger shelf.
  mesh(new THREE.BoxGeometry(5.25, .11, .1), brass, "bank-teller-grille-top", [0, 2.25, -2.38]);
  for (let i = -10; i <= 10; i++) mesh(new THREE.CylinderGeometry(.018, .018, .92, 6), brass, "bank-teller-grille-bar", [i * .23, 1.79, -2.37]);
  mesh(new THREE.BoxGeometry(5.15, .13, .34), timber, "bank-ledger-trim", [0, 1.27, -2.21]);
  for (const x of [-2.55, -1.7, 1.7, 2.55]) mesh(new THREE.BoxGeometry(.46, .045, .3), paper, "bank-ledger-folio", [x, 1.36, -2.06], [0, (x % 2) * .08, 0]);
  // A shallow wall clock and vault pins keep the far wall legible from the room-wide camera.
  const clock = mesh(new THREE.CylinderGeometry(.38, .38, .06, 18), brass, "bank-wall-clock", [-2.65, 2.25, -3.18], [Math.PI / 2, 0, 0]);
  mesh(new THREE.BoxGeometry(.035, .2, .035), timber, "bank-clock-hand-minute", [-2.65, 2.25, -3.22], [0, 0, -.35]); mesh(new THREE.BoxGeometry(.035, .13, .035), timber, "bank-clock-hand-hour", [-2.65, 2.25, -3.225], [0, 0, .95]);
  for (let i = 0; i < 8; i++) mesh(new THREE.SphereGeometry(.045, 6, 5), brass, "bank-vault-pin", [2.42 + Math.cos(i * Math.PI / 4) * .82, 1.2 + Math.sin(i * Math.PI / 4) * .82, -2.84]);
  // Two consultation silhouettes are shaped seats and backs, not anonymous cubes.
  for (const x of [-3.05, -1.45]) { mesh(new THREE.BoxGeometry(.58, .14, .58), timber, "bank-consultation-chair-seat", [x, .48, 1.95]); mesh(new THREE.BoxGeometry(.58, .48, .08), timber, "bank-consultation-chair-back", [x, .75, 2.18]); for (const dx of [-.18, .18]) for (const dz of [-.18, .18]) mesh(new THREE.CylinderGeometry(.035, .045, .42, 6), timber, "bank-consultation-chair-leg", [x + dx, .21, 1.95 + dz]); }
  const plaque = new EngravedPlate({ stone: "#e9dbc0", highlight: "#fff4d8", ink: "#244544", size: "small", fit: true }, 2.35, .52); plaque.mesh.name = "bank-household-fund-plaque"; plaque.set("Household Fund", plateFinish("current")); plaque.mesh.position.set(0, 2.75, -3.17); group.add(plaque.mesh); owned.add(plaque);
  return { group, animate(t) { clock.rotation.z = Math.sin(t * .12) * .01; return false; }, dispose() { if (dead) return; dead = true; group.removeFromParent(); for (const item of owned) item.dispose(); owned.clear(); group.clear(); } };
}
