import * as THREE from "three";
import { EngravedPlate, type PlateFinish } from "./engraved.ts";
import type { CourtDressing } from "./dressing.ts";

export const SLIP_MAX_LINES = 3;
export const SLIP_MAX_CHARS = 42;

/** Pure: the "since you were here" slip keeps at most three short lines. */
export function slipLines(lines: readonly string[]): string[] {
  return lines
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, SLIP_MAX_LINES)
    .map((line) => (line.length > SLIP_MAX_CHARS ? line.slice(0, SLIP_MAX_CHARS - 1).trimEnd() + "…" : line));
}

export type Mailbox = {
  group: THREE.Group;
  /** Flag up = she noticed something (`decide()`); down = nothing waiting. */
  setFlag(up: boolean): void;
  /** Rewrites the slip pinned beside the post; an empty list hides the slip. */
  setSlip(lines: readonly string[], finish?: PlateFinish): void;
  readonly flagUp: () => boolean;
  dispose(): void;
};

/**
 * Post + box + flag, and the slip plate on a short stake beside it. The box faces
 * +z (the camera), the flag pivots on the box's right side.
 */
export function createMailbox(dressing: CourtDressing): Mailbox {
  const group = new THREE.Group();
  group.name = "mailbox";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };

  const timber = track(new THREE.MeshStandardMaterial({ color: dressing.timber, roughness: 0.8 }));
  const paint = track(new THREE.MeshStandardMaterial({ color: dressing.gate.rail, roughness: 0.55 }));
  const flagPaint = track(new THREE.MeshStandardMaterial({ color: dressing.accent, roughness: 0.5 }));
  const metal = track(new THREE.MeshStandardMaterial({ color: dressing.metal, roughness: 0.35, metalness: 0.6 }));

  const post = new THREE.Mesh(track(new THREE.BoxGeometry(0.12, 1.05, 0.12)), timber);
  post.position.y = 0.525; post.castShadow = true; group.add(post);

  // Box: a body with a half-cylinder lid, door on the +z face.
  const body = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.26, 0.5)), paint);
  body.position.set(0, 1.18, 0); body.castShadow = true; group.add(body);
  const lid = new THREE.Mesh(track(new THREE.CylinderGeometry(0.17, 0.17, 0.5, 16, 1, false, 0, Math.PI)), paint);
  lid.rotation.z = Math.PI / 2; lid.rotation.y = Math.PI / 2; lid.position.set(0, 1.31, 0); lid.castShadow = true; group.add(lid);
  const door = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.22, 0.02)), metal);
  door.position.set(0, 1.19, 0.255); group.add(door);

  // Flag on a pivot at the box's right edge.
  const flagPivot = new THREE.Group(); flagPivot.position.set(0.19, 1.24, 0.12); group.add(flagPivot);
  const flagArm = new THREE.Mesh(track(new THREE.BoxGeometry(0.02, 0.28, 0.05)), flagPaint);
  flagArm.position.y = 0.14; flagPivot.add(flagArm);
  const flagHead = new THREE.Mesh(track(new THREE.BoxGeometry(0.02, 0.1, 0.16)), flagPaint);
  flagHead.position.set(0, 0.26, 0.06); flagPivot.add(flagHead);

  // Slip: a paper plate pinned to a short stake beside the post.
  const stake = new THREE.Mesh(track(new THREE.BoxGeometry(0.05, 0.62, 0.05)), timber);
  stake.position.set(0.55, 0.31, 0.1); group.add(stake);
  const slip = new EngravedPlate({ stone: dressing.paper, highlight: dressing.paper, ink: dressing.paperInk, paper: true, size: "small", align: "left" }, 0.66, 0.4);
  slip.mesh.position.set(0.55, 0.72, 0.13); slip.mesh.rotation.z = -0.04; group.add(slip.mesh);
  const pin = new THREE.Mesh(track(new THREE.SphereGeometry(0.02, 8, 8)), metal);
  pin.position.set(0.55, 0.9, 0.15); group.add(pin);
  disposables.push(slip);

  let up = false;
  const setFlag = (next: boolean) => { up = next; flagPivot.rotation.z = next ? 0 : -Math.PI / 2; };
  setFlag(false);
  const setSlip = (lines: readonly string[], finish: PlateFinish = "glazed") => {
    const kept = slipLines(lines);
    const shown = kept.length > 0;
    slip.mesh.visible = shown; stake.visible = shown; pin.visible = shown;
    if (shown) slip.set(kept.join("\n"), finish);
  };
  setSlip([]);

  return {
    group,
    setFlag,
    setSlip,
    flagUp: () => up,
    dispose() { for (const item of disposables) item.dispose(); },
  };
}
