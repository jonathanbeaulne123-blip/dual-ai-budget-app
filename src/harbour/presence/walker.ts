import * as THREE from "three";

/**
 * A body that can be walked around the island — and the one-line seam the real
 * character drops into.
 *
 * The character itself is being built on another branch (`src/harbour/body/**`)
 * and is not on this one, so this lane owns the *interface* and ships a
 * deliberately plain placeholder behind it: a capsule, a head, a heading and a
 * small bob while it moves. Everything that drives a body on this lane —
 * `presence/partnerWalker.ts`, the Court — talks only to `Walker`, never to
 * the placeholder.
 *
 * **The seam.** `createWalker()` calls whatever factory is registered.
 * Integration is one line, run once at import time by the character module:
 *
 * ```ts
 * import { useWalkerFactory } from "../presence/walker.ts";
 * useWalkerFactory(createCharacterWalker);   // <- the whole integration
 * ```
 *
 * The real factory has to satisfy exactly this: take `WalkerOptions`, return
 * an object with `group`, `setPose`, `setMoving`, `setOpacity`, `animate` and
 * `dispose`, and put its origin at the body's feet facing +z at yaw 0 so a
 * yaw from the wire means the same thing for both bodies.
 */

export type Walker = {
  /** Added to the place's group; the walker never touches the scene itself. */
  readonly group: THREE.Object3D;
  /** World metres and a heading in radians. Origin at the feet, +z at yaw 0. */
  setPose(x: number, z: number, yaw: number): void;
  /** Whether to play the stride. Never derived from position inside the walker: the lane decides. */
  setMoving(moving: boolean): void;
  /** 0..1. The honest fade when a peer's feed goes quiet; 0 hides the body. */
  setOpacity(opacity: number): void;
  /** `t` seconds since mount, `dt` since the last animated frame. */
  animate(t: number, dt: number): void;
  dispose(): void;
};

export type WalkerOptions = {
  /** The body's cloth colour, taken from the place's dressing. */
  tint: string;
  /** The head's colour. */
  skin: string;
  /** The island's height under a point, so a body stands on the ground rather than through it. */
  groundHeightAt?: (x: number, z: number) => number;
  /** Total height in metres. The Court's people are model-village scale. */
  height?: number;
};

export type WalkerFactory = (options: WalkerOptions) => Walker;

/** The stand-in: a capsule, a head, and a bob. Replaced wholesale by the character lane. */
export function createPlaceholderWalker(options: WalkerOptions): Walker {
  const height = options.height ?? 0.46;
  const group = new THREE.Group();
  group.name = "walker";
  const pivot = new THREE.Group();
  group.add(pivot);

  const bodyHeight = height * 0.62, headRadius = height * 0.2;
  const cloth = new THREE.MeshStandardMaterial({ color: options.tint, roughness: 0.62, metalness: 0, transparent: true, opacity: 1 });
  const skin = new THREE.MeshStandardMaterial({ color: options.skin, roughness: 0.42, metalness: 0, transparent: true, opacity: 1 });
  const bodyGeometry = new THREE.CapsuleGeometry(height * 0.17, bodyHeight - height * 0.34, 4, 10);
  const headGeometry = new THREE.SphereGeometry(headRadius, 14, 10);
  const noseGeometry = new THREE.ConeGeometry(height * 0.05, height * 0.1, 6);

  const body = new THREE.Mesh(bodyGeometry, cloth);
  body.position.y = bodyHeight / 2;
  body.castShadow = true; body.receiveShadow = true;
  const head = new THREE.Mesh(headGeometry, skin);
  head.position.y = bodyHeight + headRadius * 0.82;
  head.castShadow = true; head.receiveShadow = true;
  // A small snout so a heading is readable at model-village scale: which way a
  // body faces is the whole point of carrying yaw.
  const nose = new THREE.Mesh(noseGeometry, skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, head.position.y, headRadius * 0.92);
  nose.castShadow = true;
  pivot.add(body, head, nose);

  let moving = false, phase = 0, baseY = 0, opacity = 1;

  const apply = () => { pivot.position.y = baseY + (moving ? Math.abs(Math.sin(phase)) * height * 0.055 : 0); };

  return {
    group,
    setPose(x, z, yaw) {
      const ground = options.groundHeightAt?.(x, z) ?? 0;
      group.position.set(x, ground, z);
      group.rotation.y = yaw;
      baseY = 0;
      apply();
    },
    setMoving(next) { if (moving === next) return; moving = next; if (!next) phase = 0; apply(); },
    setOpacity(next) {
      const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0));
      if (clamped === opacity) return;
      opacity = clamped;
      cloth.opacity = clamped; skin.opacity = clamped;
      group.visible = clamped > 0.01;
    },
    animate(_t, dt) {
      if (!moving) return;
      // Two steps a second at a walk; the stride is the lane's `moving` flag,
      // never an inference from a position that may be a guess.
      phase += dt * Math.PI * 4;
      apply();
    },
    dispose() {
      group.removeFromParent();
      bodyGeometry.dispose(); headGeometry.dispose(); noseGeometry.dispose();
      cloth.dispose(); skin.dispose();
    },
  };
}

let factory: WalkerFactory = createPlaceholderWalker;

/**
 * The integration seam. The character lane calls this once at import time;
 * everything already built keeps working because nothing outside this module
 * names the placeholder. Returns the way back to the previous factory, which
 * is what the tests use.
 */
export function useWalkerFactory(next: WalkerFactory): () => void {
  const previous = factory;
  factory = next;
  return () => { factory = previous; };
}

export function createWalker(options: WalkerOptions): Walker {
  return factory(options);
}

/** Which factory is standing. Only the fence test reads this. */
export const walkerFactoryIsPlaceholder = (): boolean => factory === createPlaceholderWalker;
