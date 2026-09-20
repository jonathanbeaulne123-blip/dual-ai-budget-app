import * as THREE from "three";
import type { CellarDressing } from "./dressing.ts";

/**
 * The Cellar's one dollar scale (BUILD_PLAN_SLICE2 §3, LITTLE_HARBOUR_v2 §2).
 *
 * Prepare's balance stands as a body of water behind the rail; each bill is a
 * jar on the rail. Both are measured by `dollarsToUnits`, so $1,000 of water
 * is exactly as tall as a $1,000 jar — the whole point of putting them in one
 * room. Nothing here reads or moves money: it is a ruler, not a ledger.
 */

/** The world height one whole `scaleCents` of money occupies. The rail's jars and the water share it. */
export const CELLAR_SCALE_UNITS = 1.15;

/**
 * Money → world units on the cellar's one scale. `scaleCents` is the room's
 * ruler (the reading's `scaleCents`: the largest thing on the rail, or the
 * crest of the month's water, whichever the reading chose).
 *
 * Pure, clamped to `[0, CELLAR_SCALE_UNITS]`, and total: an unusable scale, a
 * negative amount or a non-finite number all read as no height at all, never
 * as a wrong one.
 */
export function dollarsToUnits(cents: number, scaleCents: number): number {
  if (!Number.isFinite(cents) || !Number.isFinite(scaleCents) || scaleCents <= 0 || cents <= 0) return 0;
  return Math.min(CELLAR_SCALE_UNITS, (cents / scaleCents) * CELLAR_SCALE_UNITS);
}

/** The water's geometry in the room: a pool behind the rail, from the back wall forward. */
export const CELLAR_WATER = {
  /** The pool's footprint (x half-width, z from the back wall). */
  halfWidth: 4.6,
  backZ: -4.35,
  frontZ: -2.55,
  /** The surface never sinks entirely out of sight: an empty cellar still has a wet floor. */
  floor: 0.02,
  /** How wide the dark stain line on the wall is. */
  stainHeight: 0.045,
} as const;

export type CellarWater = {
  group: THREE.Group;
  /** Set the water to `cents` on the room's scale. With `animate` false (reduced motion) it cuts. */
  setLevel(cents: number | null, animate?: boolean): void;
  /** The world height the water currently stands at (its settled target, not the ripple). */
  height(): number;
  /** Advance the settle and the ripple. Returns true while something is still moving. */
  tick(t: number, dt: number): boolean;
  /** The words beneath the water line, for the twins. Never a bare "$0". */
  words(): string;
  dispose(): void;
};

export type CellarWaterOptions = {
  dressing: CellarDressing;
  /** The room's ruler. */
  scaleCents: number;
  /** Reduced motion: no ripple, instant level. */
  reduced?: boolean;
  /** Formats cents for the twin's words; unknown reads "—". */
  format?: (cents: number | null) => string;
};

const defaultFormat = (cents: number | null): string => {
  if (cents === null || !Number.isFinite(cents)) return "—";
  const dollars = Math.trunc(Math.abs(cents) / 100);
  return `${cents < 0 && dollars > 0 ? "−" : ""}$${String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
};

/**
 * Prepare's water and the wall's water line. One surface plane, one dark stain
 * band that rides with it, and a shallow ripple that settles to still.
 */
export function createWater(options: CellarWaterOptions): CellarWater {
  const { dressing } = options;
  const reduced = options.reduced === true;
  const format = options.format ?? defaultFormat;
  const { halfWidth, backZ, frontZ, floor, stainHeight } = CELLAR_WATER;
  const depth = frontZ - backZ;
  const midZ = (backZ + frontZ) / 2;

  const group = new THREE.Group();
  group.name = "cellar-water";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };

  // The body: a slab from the floor up to the surface, scaled in y as the level moves.
  const bodyGeometry = track(new THREE.BoxGeometry(halfWidth * 2, 1, depth));
  bodyGeometry.translate(0, 0.5, 0);
  const bodyMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.waterDeep, roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.88 }));
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.set(0, floor, midZ);
  body.name = "water-body";
  group.add(body);

  // The surface: a lighter plane that carries the ripple.
  const surface = new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, depth)), track(new THREE.MeshStandardMaterial({ color: dressing.water, roughness: 0.14, metalness: 0.12, transparent: true, opacity: 0.94 })));
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(0, floor, midZ);
  surface.name = "water-surface";
  group.add(surface);

  // The wall's dark stain: a band on the back wall at the water's own height.
  const stain = new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, stainHeight)), track(new THREE.MeshStandardMaterial({ color: dressing.stain, roughness: 1, transparent: true, opacity: 0.75 })));
  stain.position.set(0, floor, backZ + 0.012);
  stain.name = "water-line";
  group.add(stain);

  let target = 0;
  let current = 0;
  let ripple = 0;
  let cents: number | null = null;

  const apply = (height: number, wobble: number): void => {
    const y = floor + Math.max(0, height);
    body.scale.y = Math.max(0.001, height);
    surface.position.y = y + wobble;
    stain.position.y = y;
  };
  apply(0, 0);

  return {
    group,
    setLevel(next, animate = !reduced) {
      cents = next;
      target = next === null ? 0 : dollarsToUnits(next, options.scaleCents);
      if (!animate || reduced) { current = target; ripple = 0; apply(current, 0); return; }
      ripple = Math.min(0.05, Math.abs(target - current) * 0.35 + 0.006);
    },
    height: () => target,
    tick(t, dt) {
      if (reduced) { apply(current, 0); return false; }
      const settling = Math.abs(target - current) > 0.0005;
      if (settling) current += (target - current) * (1 - Math.exp(-dt * 6));
      else current = target;
      const rippling = ripple > 0.0006;
      if (rippling) ripple *= Math.exp(-dt * 2.4);
      else ripple = 0;
      apply(current, rippling ? Math.sin(t * 5.2) * ripple : 0);
      return settling || rippling;
    },
    words: () => `Prepare's water — ${format(cents)}`,
    dispose() { for (const item of disposables) item.dispose(); },
  };
}
