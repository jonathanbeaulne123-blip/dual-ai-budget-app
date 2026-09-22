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

export type Footprints = {
  group: THREE.Group;
  /** Drop a print. Costs nothing but two writes to a matrix. */
  drop(x: number, y: number, z: number, yaw: number, left: boolean): void;
  /** Fade them by `dt` seconds. True while any print is still showing. */
  fade(dt: number): boolean;
  clear(): void;
  dispose(): void;
};

export function createFootprints(colour: string): Footprints {
  const group = new THREE.Group();
  group.name = "footprints";
  const geometry = new THREE.CircleGeometry(1, 8);
  const meshes: THREE.Mesh[] = [];
  const materials: THREE.MeshBasicMaterial[] = [];
  const ages = new Float32Array(FOOTPRINT_POOL).fill(FOOTPRINT_LIFE);
  for (let i = 0; i < FOOTPRINT_POOL; i += 1) {
    const material = new THREE.MeshBasicMaterial({ color: colour, transparent: true, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.rotation.order = "YXZ";
    mesh.rotation.x = -Math.PI / 2;
    mesh.scale.set(0.035, 0.052, 1);
    mesh.visible = false;
    mesh.renderOrder = -1;
    group.add(mesh);
    meshes.push(mesh); materials.push(material);
  }
  let next = 0, live = 0;
  return {
    group,
    drop(x, y, z, yaw, left) {
      const mesh = meshes[next]!, material = materials[next]!;
      if (ages[next]! >= FOOTPRINT_LIFE) live += 1;
      // A print sits under the foot that landed, a half-width to its side.
      const side = left ? -0.048 : 0.048;
      mesh.position.set(x + Math.cos(yaw) * side, y + 0.012, z - Math.sin(yaw) * side);
      mesh.rotation.y = yaw;
      mesh.visible = true;
      material.opacity = 0.34;
      ages[next] = 0;
      next = (next + 1) % FOOTPRINT_POOL;
    },
    fade(dt) {
      if (!live) return false;
      live = 0;
      for (let i = 0; i < FOOTPRINT_POOL; i += 1) {
        const age = ages[i]!;
        if (age >= FOOTPRINT_LIFE) continue;
        const next = age + dt;
        ages[i] = next;
        if (next >= FOOTPRINT_LIFE) { meshes[i]!.visible = false; materials[i]!.opacity = 0; continue; }
        materials[i]!.opacity = 0.34 * (1 - next / FOOTPRINT_LIFE);
        live += 1;
      }
      return live > 0;
    },
    clear() {
      live = 0;
      for (let i = 0; i < FOOTPRINT_POOL; i += 1) { ages[i] = FOOTPRINT_LIFE; meshes[i]!.visible = false; materials[i]!.opacity = 0; }
    },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}
