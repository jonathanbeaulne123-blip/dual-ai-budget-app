import * as THREE from "three";

/**
 * Little Harbour · the dust a walk kicks up.
 *
 * The sibling of `footprints.ts`, and built to exactly the same rule: a
 * **fixed pool**, reused oldest-first, one shared geometry, nothing allocated
 * while walking and nothing drawn once the last puff has gone. A print is
 * what a foot *left*; a puff is what it *threw* — so the two together are the
 * difference between feet that touch the ground and feet that land on it.
 *
 * A puff is a low-poly sphere rather than a disc on the grass, because the
 * follow camera sits at about sixty degrees off vertical and a disc read edge
 * on is a line. It rises a little, spreads a lot, and fades out in half a
 * second: a scuff, not a smoke machine.
 *
 * Reduced motion never raises one of these at all (`body/walker.ts`): the
 * body still walks, the ground stops performing.
 */

/** How many puffs stand at once, on a desktop and on a phone, and how long one lasts. */
export const DUST_POOL = 18, DUST_POOL_LITE = 9, DUST_LIFE = 0.55;

export type Dust = {
  group: THREE.Group;
  /**
   * Throw a puff from a foot. `force` is 0…1: a walk barely scuffs, a run
   * throws a proper cloud. Costs one matrix write and one number.
   */
  puff(x: number, y: number, z: number, force: number): void;
  /** Age them by `dt` seconds. True while any puff is still showing. */
  fade(dt: number): boolean;
  clear(): void;
  dispose(): void;
};

/** How far a puff drifts up over its life, and how wide it opens, at full force. */
const RISE = 0.075, WIDE = 0.105, NARROW = 0.018;

export function createDust(colour: string, pool: number = DUST_POOL): Dust {
  const group = new THREE.Group();
  group.name = "dust";
  // Six by four: twenty-odd triangles a puff, and it only ever reads as a
  // smudge of light anyway.
  const geometry = new THREE.SphereGeometry(1, 6, 4);
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];
  const ages = new Float32Array(pool).fill(DUST_LIFE);
  /** Each puff's own force, so one cloud can be a scuff and the next a burst. */
  const forces = new Float32Array(pool);
  /** Where each puff started, so `fade` can lift it without re-reading the mesh. */
  const base = new Float32Array(pool * 3);
  for (let i = 0; i < pool; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    mesh.renderOrder = -1;
    mesh.frustumCulled = false;
    group.add(mesh);
    meshes.push(mesh); materials.push(material);
  }
  let next = 0, live = 0;

  function write(i: number, age: number): void {
    const force = forces[i]!;
    const life = age / DUST_LIFE;
    const mesh = meshes[i]!;
    const spread = NARROW + (WIDE * force - NARROW) * Math.min(1, life * 2.2);
    mesh.scale.setScalar(Math.max(0.004, spread));
    mesh.position.set(base[i * 3]!, base[i * 3 + 1]! + RISE * force * life, base[i * 3 + 2]!);
    // Bright at once, gone on a curve: a puff is mostly its first moment.
    materials[i]!.opacity = 0.42 * force * (1 - life) * (1 - life);
  }

  return {
    group,
    puff(x, y, z, force) {
      const strength = force < 0.08 ? 0.08 : force > 1 ? 1 : force;
      if (ages[next]! >= DUST_LIFE) live += 1;
      forces[next] = strength;
      base[next * 3] = x; base[next * 3 + 1] = y + 0.012; base[next * 3 + 2] = z;
      ages[next] = 0;
      meshes[next]!.visible = true;
      write(next, 0);
      next = (next + 1) % pool;
    },
    fade(dt) {
      if (!live) return false;
      live = 0;
      for (let i = 0; i < pool; i += 1) {
        const age = ages[i]!;
        if (age >= DUST_LIFE) continue;
        const aged = age + dt;
        ages[i] = aged;
        if (aged >= DUST_LIFE) { meshes[i]!.visible = false; materials[i]!.opacity = 0; continue; }
        write(i, aged);
        live += 1;
      }
      return live > 0;
    },
    clear() {
      live = 0;
      for (let i = 0; i < pool; i += 1) { ages[i] = DUST_LIFE; meshes[i]!.visible = false; materials[i]!.opacity = 0; }
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
