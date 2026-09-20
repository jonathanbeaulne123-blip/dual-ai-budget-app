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
 * The foot of the ruler: the amount at which a thing is still only just a
 * thing. Below it every bill would be the same stub, so the scale's low end
 * is anchored here rather than at zero.
 */
export const CELLAR_SCALE_ANCHOR_CENTS = 2_500;

/**
 * Money → world units on the cellar's one scale. `scaleCents` is the room's
 * ruler (the reading's `scaleCents`: the largest thing on the rail, or the
 * crest of the month's water, whichever is bigger).
 *
 * The ruler is **logarithmic**, for the same reason the Tower's banks are
 * (`tower/banks.ts` `bankHeight`): a household's buffer is routinely twenty
 * times its largest bill, and on a straight scale that buries every jar at
 * the floor height and the room says nothing. A log scale keeps the ordering
 * exactly — a taller jar is always more money, and the water read against the
 * jars is the same question answered the same way — while leaving the small
 * end legible. What it does not claim is proportion: this is a ruler for
 * reading a room at a glance, and the figures themselves are on the plates.
 *
 * Pure, clamped to `[0, CELLAR_SCALE_UNITS]`, and total: an unusable scale, a
 * negative amount or a non-finite number all read as no height at all, never
 * as a wrong one.
 */
export function dollarsToUnits(cents: number, scaleCents: number): number {
  if (!Number.isFinite(cents) || !Number.isFinite(scaleCents) || scaleCents <= 0 || cents <= 0) return 0;
  const anchor = CELLAR_SCALE_ANCHOR_CENTS;
  const top = Math.log1p(scaleCents / anchor);
  if (top <= 0) return 0;
  return Math.min(CELLAR_SCALE_UNITS, (Math.log1p(cents / anchor) / top) * CELLAR_SCALE_UNITS);
}

/**
 * The cistern, and where it stands. It is a **great glass jar** on a stone
 * plinth at the back of the room — the same glass as the bills on the rail,
 * at the room's own scale. That is the whole argument for putting Prepare and
 * the month's bills in one room: you can see the household's buffer standing
 * beside the bills it is there to cover, measured with the same ruler.
 *
 * A slab of water spread across the back wall (what stood here before) reads
 * as paint on the plaster and drowns the jars it is supposed to be read
 * against; a jar reads at a glance and belongs to the room's five materials.
 */
export const CELLAR_WATER = {
  /** The glass's inner radius, where it stands, and how tall the glass itself is. */
  radius: 0.46,
  centerX: -2.15,
  centerZ: -2.75,
  glassTop: 1.44,
  /** The plinth it stands on: the water is measured from the plinth's top, not the floor. */
  plinth: 0.2,
  /** The surface never sinks entirely out of sight: an empty cistern still has a wet bottom. */
  floor: 0.02,
  /** How deep the tide mark around the glass is. */
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
  const { radius, glassTop, plinth, floor, stainHeight } = CELLAR_WATER;

  const group = new THREE.Group();
  group.name = "cellar-water";
  // The whole cistern stands where the room puts it; everything inside is built about its own foot.
  group.position.set(CELLAR_WATER.centerX, plinth, CELLAR_WATER.centerZ);
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };

  // The water itself: a cylinder that grows from the glass's foot as the level rises.
  const bodyGeometry = track(new THREE.CylinderGeometry(radius, radius, 1, 24, 1, false));
  bodyGeometry.translate(0, 0.5, 0);
  const bodyMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.waterDeep, roughness: 0.22, metalness: 0.05, transparent: true, opacity: 0.82 }));
  const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
  body.position.y = floor;
  body.name = "water-body";
  group.add(body);

  // The surface: a brighter disc that carries the ripple.
  const surface = new THREE.Mesh(track(new THREE.CircleGeometry(radius - 0.005, 24)), track(new THREE.MeshStandardMaterial({ color: dressing.water, roughness: 0.14, metalness: 0.12, transparent: true, opacity: 0.96 })));
  surface.rotation.x = -Math.PI / 2;
  surface.position.y = floor;
  surface.name = "water-surface";
  group.add(surface);

  // The tide mark: a band around the glass at the water's own height, so the level
  // has a line even where the water behind it is pale.
  const stain = new THREE.Mesh(track(new THREE.CylinderGeometry(radius + 0.012, radius + 0.012, stainHeight, 24, 1, true)), track(new THREE.MeshStandardMaterial({ color: dressing.stain, roughness: 1, transparent: true, opacity: 0.6, side: THREE.DoubleSide })));
  stain.position.y = floor;
  stain.name = "water-line";
  group.add(stain);

  // The glass: an open cylinder, a thicker rim at its mouth and a foot at its base.
  const glassMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.water, roughness: 0.08, metalness: 0.04, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false }));
  const glass = new THREE.Mesh(track(new THREE.CylinderGeometry(radius + 0.03, radius + 0.03, glassTop, 24, 1, true)), glassMaterial);
  glass.position.y = glassTop / 2;
  glass.name = "cistern-glass";
  glass.renderOrder = 2;
  group.add(glass);
  const rim = new THREE.Mesh(track(new THREE.TorusGeometry(radius + 0.035, 0.032, 6, 24)), track(new THREE.MeshStandardMaterial({ color: dressing.brass, roughness: 0.34, metalness: 0.66 })));
  rim.rotation.x = Math.PI / 2; rim.position.y = glassTop; rim.name = "cistern-rim";
  group.add(rim);
  const foot = new THREE.Mesh(track(new THREE.CylinderGeometry(radius + 0.1, radius + 0.13, 0.08, 24)), track(new THREE.MeshStandardMaterial({ color: dressing.brass, roughness: 0.4, metalness: 0.55 })));
  foot.position.y = 0.04; foot.name = "cistern-foot";
  group.add(foot);

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
