import type * as THREE from "three";
import { createBodyFigure, DEFAULT_FIGURE_COLOURS } from "./figure.ts";
import { useWalkerFactory, type Walker, type WalkerOptions } from "../presence/walker.ts";

/**
 * The real character, standing in the partner's place.
 *
 * `presence/walker.ts` owns the `Walker` interface and shipped a capsule
 * behind it because the character lived on another branch. This is the
 * integration it described: the same body the reader walks
 * (`body/figure.ts`), wrapped so that a peer's position off the wire moves it.
 *
 * The contract the seam states is honoured exactly, and it is the reason a yaw
 * from the wire means the same thing for both bodies:
 *
 * - **Origin at the feet.** `BodyFigure.group`'s position *is* the feet on the
 *   ground, which is what `setPose` sets.
 * - **Facing +z at yaw 0.** The body model's own convention is that a body
 *   "looks along (sin yaw, 0, cos yaw)" (`body/bodyModel.ts`), which is
 *   `(0, 0, 1)` at yaw 0. The local walker and the partner therefore read a
 *   yaw identically; neither needs an offset.
 *
 * What this wrapper does *not* do is decide whether the partner is walking.
 * `setMoving` is the lane's call, made from the freshness of the feed, never
 * inferred from a position that may be a guess — so a stale peer stands still
 * rather than moonwalking on interpolated samples.
 */

/** A partner is the same size as you unless the place asks for a different one. */
const DEFAULT_WALKER_HEIGHT = 0.46;

export function createCharacterWalker(options: WalkerOptions): Walker {
  const figure = createBodyFigure({
    // The place's dressing decides the two colours a body is told apart by;
    // everything else stays the house's own palette.
    coat: options.tint || DEFAULT_FIGURE_COLOURS.coat,
    skin: options.skin || DEFAULT_FIGURE_COLOURS.skin,
  });
  const group = figure.group;
  // The figure is authored at the reader's own height; a place may want its
  // people smaller. Scaling the group keeps the feet at the origin.
  const height = options.height ?? DEFAULT_WALKER_HEIGHT;
  const scale = figure.height > 0 ? height / figure.height : 1;
  group.scale.setScalar(scale);

  // Every material on this figure belongs to this figure (`createBodyFigure`
  // builds its own), so fading one body never fades the other.
  const materials: THREE.MeshStandardMaterial[] = [];
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (!mesh.isMesh) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const standard = material as THREE.MeshStandardMaterial;
      if (standard && !materials.includes(standard)) materials.push(standard);
    }
  });

  let moving = false, phase = 0, opacity = 1;
  // One step per π of phase, two steps a second at a walk — the same rate the
  // placeholder used, so the lane's smoothing reads the same either way.
  const STEP_RATE = Math.PI * 4;

  figure.pose(0, 0, 0);

  return {
    group,
    setPose(x, z, yaw) {
      const ground = options.groundHeightAt?.(x, z) ?? 0;
      group.position.set(x, ground, z);
      group.rotation.y = yaw;
    },
    setMoving(next) {
      if (moving === next) return;
      moving = next;
      if (!next) phase = 0;
    },
    setOpacity(next) {
      const clamped = Math.max(0, Math.min(1, Number.isFinite(next) ? next : 0));
      if (clamped === opacity) return;
      opacity = clamped;
      const shown = clamped > 0.01;
      for (const material of materials) { material.transparent = clamped < 1; material.opacity = clamped; }
      group.visible = shown;
    },
    animate(t, dt) {
      if (moving) phase += dt * STEP_RATE;
      // The idle breath runs whether or not the feet do, so a standing partner
      // is alive rather than a statue.
      figure.pose(phase, moving ? 1 : 0, t);
    },
    dispose() {
      group.removeFromParent();
      figure.dispose();
    },
  };
}

/**
 * The whole integration, exactly as `presence/walker.ts` specified it: one
 * line, run once at import time by the character module. `body/walker.ts`
 * imports this file so that any surface standing a body — the runtime imports
 * it before it can build a place — has the real character registered before
 * the first `createWalker()` call.
 */
export const stopUsingCharacterWalker = useWalkerFactory(createCharacterWalker);
