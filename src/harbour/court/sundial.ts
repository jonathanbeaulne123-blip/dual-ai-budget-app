import * as THREE from "three";
import { EngravedPlate, type PlateFinish } from "./engraved.ts";
import type { CourtDressing } from "./dressing.ts";

/** Days at which the shadow reaches the dial's rim. Anything further is "the rim". */
export const SUNDIAL_HORIZON_DAYS = 31;

/**
 * Pure: the shadow's angle from noon, in radians. `0` days → noon (0), and the
 * shadow swings toward the rim (π/2) as the commitment sits further out. A
 * commitment already due (negative days) also reads as noon.
 */
export function sundialAngle(daysAhead: number): number {
  if (!Number.isFinite(daysAhead)) return Math.PI / 2;
  const clamped = Math.max(0, Math.min(SUNDIAL_HORIZON_DAYS, daysAhead));
  return (clamped / SUNDIAL_HORIZON_DAYS) * (Math.PI / 2);
}

/** Pure: how far the shadow reaches across the dial (0.35 at noon → 1 at the rim). */
export function sundialReach(daysAhead: number): number {
  const angle = sundialAngle(daysAhead);
  return 0.35 + 0.65 * (angle / (Math.PI / 2));
}

export type SundialCommitment = { label: string; daysAhead: number } | null;

export type Sundial = {
  group: THREE.Group;
  /** Moves the shadow and rewrites the tag; `null` hides both (no dated commitment). */
  set(next: SundialCommitment, finish?: PlateFinish): void;
  dispose(): void;
};

/**
 * Dial + gnomon + a flat shadow wedge that swings by `sundialAngle`, and a small
 * engraved tag hung on the gnomon with the commitment's label.
 */
export function createSundial(dressing: CourtDressing): Sundial {
  const group = new THREE.Group();
  group.name = "sundial";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };

  const stone = track(new THREE.MeshStandardMaterial({ color: dressing.plinth, roughness: 0.85 }));
  const face = track(new THREE.MeshStandardMaterial({ color: dressing.plate, roughness: 0.7 }));
  const metal = track(new THREE.MeshStandardMaterial({ color: dressing.metal, roughness: 0.35, metalness: 0.6 }));
  const shade = track(new THREE.MeshStandardMaterial({ color: dressing.ink, roughness: 1, transparent: true, opacity: 0.42, depthWrite: false }));

  // Pedestal and dial.
  const pedestal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.26, 0.34, 0.9, 12)), stone);
  pedestal.position.y = 0.45; pedestal.castShadow = true; pedestal.receiveShadow = true; group.add(pedestal);
  const dial = new THREE.Mesh(track(new THREE.CylinderGeometry(0.62, 0.66, 0.08, 24)), face);
  dial.position.y = 0.94; dial.receiveShadow = true; dial.castShadow = true; group.add(dial);
  // Hour ticks as one ring of small boxes merged into the dial's look: a thin torus reads as the rim.
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(0.58, 0.018, 6, 36)), metal);
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.985; group.add(rim);
  // Gnomon: a thin triangular blade standing on the dial, leaning toward the sun (-z).
  const blade = new THREE.Shape();
  blade.moveTo(0, 0); blade.lineTo(0.42, 0); blade.lineTo(0, 0.38); blade.closePath();
  const gnomon = new THREE.Mesh(track(new THREE.ExtrudeGeometry(blade, { depth: 0.03, bevelEnabled: false })), metal);
  gnomon.rotation.y = Math.PI / 2; gnomon.position.set(0.015, 0.98, 0.2); gnomon.castShadow = true; group.add(gnomon);

  // Shadow wedge: a flat plane pivoting at the gnomon's foot.
  const shadowPivot = new THREE.Group(); shadowPivot.position.set(0, 0.986, 0.2); group.add(shadowPivot);
  const shadowGeometry = track(new THREE.PlaneGeometry(0.09, 1));
  shadowGeometry.translate(0, -0.5, 0); // pivot at one end
  const shadow = new THREE.Mesh(shadowGeometry, shade);
  shadow.rotation.x = -Math.PI / 2; shadowPivot.add(shadow);

  // Tag hung on the gnomon.
  const tag = new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 0.7, 0.24);
  tag.mesh.position.set(0, 1.28, 0.32); tag.mesh.rotation.x = -0.15; group.add(tag.mesh);
  const string = new THREE.Mesh(track(new THREE.CylinderGeometry(0.006, 0.006, 0.2, 5)), metal);
  string.position.set(0, 1.42, 0.3); string.rotation.x = 0.35; group.add(string);
  disposables.push(tag);

  const set = (next: SundialCommitment, finish: PlateFinish = "glazed") => {
    const shown = next !== null;
    shadowPivot.visible = shown; tag.mesh.visible = shown; string.visible = shown;
    if (!next) return;
    // Noon points the shadow straight toward the camera (+z); further-out dates swing it toward the rim.
    shadowPivot.rotation.y = Math.PI - sundialAngle(next.daysAhead);
    const reach = sundialReach(next.daysAhead);
    shadow.scale.y = 0.55 * reach;
    tag.set(next.label.length > 26 ? next.label.slice(0, 25) + "…" : next.label, finish);
  };
  set(null);

  return {
    group,
    set,
    dispose() { for (const item of disposables) item.dispose(); },
  };
}
