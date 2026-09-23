import * as THREE from "three";

/**
 * Little Harbour · the prints a walk leaves.
 *
 * A **fixed pool**, reused oldest-first, exactly as the Journey's island does
 * it (`path/world/pathWorld3d.ts`): nothing is allocated while walking, and
 * the whole trail is one geometry and one material. Two draw calls at most,
 * and none at all once the last print has faded.
 */

/** How many prints stand at once, and how long one takes to fade. */
export const FOOTPRINT_POOL = 24, FOOTPRINT_LIFE = 5.5;
/**
 * And how many on a phone. Prints used to be a desktop luxury; a pool of
 * twelve is one geometry, one draw call and twelve matrix writes a walk, so
 * the phone gets a trail too — just a shorter one.
 */
export const FOOTPRINT_POOL_LITE = 12;
/** The darkest a print gets, at a standstill and at a full run. A run digs in. */
const FAINT = 0.34, HARD = 0.5;
/**
 * How much faster a print fades once the body has stopped.
 *
 * This is the price of a trail on both tiers, paid honestly. A fading print
 * is a changing pixel, and a changing pixel means the frame policy cannot go
 * back to sleep — so a five-and-a-half second tail would keep the island
 * awake for five and a half seconds after every walk. Instead the prints keep
 * their full life *while you are walking*, which is when you can see them
 * stretching out behind you, and clear out inside a second and a half once
 * you stand still. The island sleeps; the walk still leaves a mark.
 */
export const FOOTPRINT_SETTLE = 4;
/**
 * How big a paw print is beside a footprint. Hercules is 0.28 to a person's
 * 0.58 and a cat's foot is small even for a cat, so his mark is a bit over a
 * third of yours — big enough to read as a trail across the lawn, small
 * enough that you can tell at a glance whose feet went that way.
 */
export const PAW_SIZE = 0.38;

export type Footprints = {
  group: THREE.Group;
  /**
   * Drop a print. Costs nothing but two writes to a matrix. `force` is 0…1
   * of a full run: a running foot leaves a longer, darker mark.
   */
  drop(x: number, y: number, z: number, yaw: number, left: boolean, force?: number): void;
  /**
   * Fade them by `dt` seconds. True while any print is still showing.
   * `settling` — the body has stopped — clears the trail out at
   * `FOOTPRINT_SETTLE` times the rate, so the world can go back to sleep.
   */
  fade(dt: number, settling?: boolean): boolean;
  clear(): void;
  dispose(): void;
};

/**
 * `size` scales the mark and how far to the side of the heading it is laid —
 * one geometry, one material and the same pool whatever it is. `PAW_SIZE`
 * makes the same trail a cat's.
 */
export function createFootprints(colour: string, pool: number = FOOTPRINT_POOL, size = 1): Footprints {
  const wide = 0.035 * size, long = 0.052 * size, sideStep = 0.048 * size;
  const group = new THREE.Group();
  group.name = "footprints";
  const geometry = new THREE.CircleGeometry(1, 8);
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];
  const ages = new Float32Array(pool).fill(FOOTPRINT_LIFE);
  /** How dark each print was dropped at, so a run's marks fade from darker. */
  const depths = new Float32Array(pool).fill(FAINT);
  for (let i = 0; i < pool; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.order = "YXZ";
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(wide, long, 1);
    mesh.visible = false;
    mesh.renderOrder = -1;
    group.add(mesh);
    meshes.push(mesh); materials.push(material);
  }
  let next = 0, live = 0;
  return {
    group,
    drop(x, y, z, yaw, left, force = 0) {
      const mesh = meshes[next]!, material = materials[next]!;
      if (ages[next]! >= FOOTPRINT_LIFE) live += 1;
      const hard = force < 0 ? 0 : force > 1 ? 1 : force;
      // A print sits under the foot that landed, a half-width to its side.
      const side = left ? -sideStep : sideStep;
      mesh.position.set(x + Math.cos(yaw) * side, y + 0.012, z - Math.sin(yaw) * side);
      mesh.rotation.y = yaw;
      // A running foot scrapes: longer along the heading, and darker.
      mesh.scale.set(wide * (1 + hard * 0.25), long * (1 + hard * 0.9), 1);
      mesh.visible = true;
      const depth = FAINT + (HARD - FAINT) * hard;
      depths[next] = depth;
      material.opacity = depth;
      ages[next] = 0;
      next = (next + 1) % pool;
    },
    fade(dt, settling = false) {
      if (!live) return false;
      live = 0;
      const step = settling ? dt * FOOTPRINT_SETTLE : dt;
      for (let i = 0; i < pool; i += 1) {
        const age = ages[i]!;
        if (age >= FOOTPRINT_LIFE) continue;
        const next = age + step;
        ages[i] = next;
        if (next >= FOOTPRINT_LIFE) { meshes[i]!.visible = false; materials[i]!.opacity = 0; continue; }
        materials[i]!.opacity = depths[i]! * (1 - next / FOOTPRINT_LIFE);
        live += 1;
      }
      return live > 0;
    },
    clear() {
      live = 0;
      for (let i = 0; i < pool; i += 1) { ages[i] = FOOTPRINT_LIFE; meshes[i]!.visible = false; materials[i]!.opacity = 0; }
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
