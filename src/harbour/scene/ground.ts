import * as THREE from "three";
import type { PlaceDressing } from "./place.ts";
import type { RenderTier } from "./quality.ts";

/**
 * The court's island patch (BUILD_PLAN §2 #8): a 60-unit vertex-coloured,
 * flat-shaded disc in the island's material language (`pathWorld3d.ts`
 * terrain) — a level terrace, a lawn ring that rises a little, a shore that
 * falls to the sea — plus the sea plane and the theme's fog.
 */
export const GROUND_RADIUS = 30;
export const TERRACE_RADIUS = 9;
export const LAWN_RADIUS = 20;
export const SEA_LEVEL = -0.45;

const RINGS = 26;
const SECTORS = 96;

/** Height of the island at a point. Pure; the terrace is level so every plinth and paving stone sits at 0. */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= TERRACE_RADIUS) return 0;
  if (r <= LAWN_RADIUS) {
    const t = (r - TERRACE_RADIUS) / (LAWN_RADIUS - TERRACE_RADIUS);
    // A gentle hump peaking mid-lawn, back to the terrace level at the shore's edge.
    return Math.sin(t * Math.PI) * 0.28;
  }
  if (r <= GROUND_RADIUS) {
    const t = (r - LAWN_RADIUS) / (GROUND_RADIUS - LAWN_RADIUS);
    return -t * t * 0.9;
  }
  return SEA_LEVEL - 0.2;
}

export type Ground = {
  group: THREE.Group;
  /** The mesh a raycast treats as "empty ground" (`userData.ground === true`). */
  island: THREE.Mesh;
  groundHeightAt(x: number, z: number): number;
  setDressing(dressing: PlaceDressing): void;
  dispose(): void;
};

function paintVertices(colors: Float32Array, positions: Float32Array, dressing: PlaceDressing): void {
  const stone = new THREE.Color(dressing.stone), joint = new THREE.Color(dressing.joint), moss = new THREE.Color(dressing.moss), sea = new THREE.Color(dressing.sea);
  const sand = stone.clone().lerp(sea, 0.25);
  const c = new THREE.Color();
  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3] ?? 0, z = positions[i * 3 + 2] ?? 0, r = Math.hypot(x, z);
    // A quiet, deterministic variation so flat shading reads as stone, not plastic.
    const grain = 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.cos(x * 0.9 - z * 1.1));
    if (r <= TERRACE_RADIUS) c.copy(stone).lerp(joint, r > TERRACE_RADIUS - 0.6 ? 0.55 : 0.08);
    else if (r <= LAWN_RADIUS) c.copy(moss).lerp(stone, Math.max(0, (r - TERRACE_RADIUS) / (LAWN_RADIUS - TERRACE_RADIUS) - 0.7) * 0.6);
    else c.copy(sand).lerp(sea, (r - LAWN_RADIUS) / (GROUND_RADIUS - LAWN_RADIUS) * 0.5);
    c.multiplyScalar(grain);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
}

export function createGround(scene: THREE.Scene, dressing: PlaceDressing, tier: RenderTier): Ground {
  const group = new THREE.Group();
  group.name = "Harbour island";
  const vertexCount = 1 + RINGS * SECTORS;
  const positions = new Float32Array(vertexCount * 3);
  const colors = new Float32Array(vertexCount * 3);
  const indices: number[] = [];
  positions[0] = 0; positions[1] = 0; positions[2] = 0;
  for (let ring = 1; ring <= RINGS; ring += 1) {
    const r = (ring / RINGS) * GROUND_RADIUS;
    for (let s = 0; s < SECTORS; s += 1) {
      const a = (s / SECTORS) * Math.PI * 2;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      const i = 1 + (ring - 1) * SECTORS + s;
      positions[i * 3] = x; positions[i * 3 + 1] = groundHeightAt(x, z); positions[i * 3 + 2] = z;
    }
  }
  for (let s = 0; s < SECTORS; s += 1) indices.push(0, 1 + ((s + 1) % SECTORS), 1 + s);
  for (let ring = 1; ring < RINGS; ring += 1) {
    for (let s = 0; s < SECTORS; s += 1) {
      const a = 1 + (ring - 1) * SECTORS + s, b = 1 + (ring - 1) * SECTORS + ((s + 1) % SECTORS);
      const c = a + SECTORS, d = b + SECTORS;
      indices.push(a, d, c, a, b, d);
    }
  }
  paintVertices(colors, positions, dressing);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true });
  const island = new THREE.Mesh(geometry, material);
  island.name = "Island ground";
  island.receiveShadow = tier === "full";
  island.userData.ground = true;
  group.add(island);

  const seaGeometry = new THREE.CircleGeometry(400, 48);
  const seaMaterial = new THREE.MeshStandardMaterial({ color: new THREE.Color(dressing.sea), roughness: 0.35, metalness: 0.05 });
  const sea = new THREE.Mesh(seaGeometry, seaMaterial);
  sea.name = "Sea";
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = SEA_LEVEL;
  sea.userData.ground = true;
  group.add(sea);
  scene.add(group);

  const applyAir = (next: PlaceDressing) => {
    const sky = new THREE.Color(next.sky);
    scene.background = sky;
    scene.fog = new THREE.Fog(new THREE.Color(next.fog), 42, 130);
  };
  applyAir(dressing);

  return {
    group, island, groundHeightAt,
    setDressing(next) {
      paintVertices(colors, positions, next);
      geometry.getAttribute("color").needsUpdate = true;
      seaMaterial.color.set(next.sea);
      applyAir(next);
    },
    dispose() {
      scene.remove(group);
      geometry.dispose(); material.dispose();
      seaGeometry.dispose(); seaMaterial.dispose();
      scene.fog = null; scene.background = null;
    },
  };
}
