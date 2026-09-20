import * as THREE from "three";
import type { PlaceDressing } from "./place.ts";
import type { RenderTier } from "./quality.ts";

/**
 * The court's island patch (BUILD_PLAN §2 #8): a 60-unit vertex-coloured,
 * flat-shaded disc in the island's material language (`pathWorld3d.ts`
 * terrain) — a level terrace, a lawn ring that rises a little, a shore that
 * falls to the sea — plus the sea plane and the theme's fog.
 */
export const GROUND_RADIUS = 24;
/** The court's own terrace and lawn ring (`COURT_LAYOUT`) reach 9.5; the island's apron sits just under them. */
export const TERRACE_RADIUS = 9.6;
/** The lawn ends in a sandy shore that falls to the sea; the island's edge is a real edge. */
export const LAWN_RADIUS = 16;
export const SEA_LEVEL = -0.45;
/** The apron is a hair below the court's paving so the tiles, not the island, are the surface you see. */
export const TERRACE_LEVEL = -0.05;

const RINGS = 26;
const SECTORS = 96;

/** Height of the island at a point. Pure; the terrace is level so every plinth and paving stone sits at 0. */
export function groundHeightAt(x: number, z: number): number {
  const r = Math.hypot(x, z);
  if (r <= TERRACE_RADIUS) return TERRACE_LEVEL;
  if (r <= LAWN_RADIUS) {
    const t = (r - TERRACE_RADIUS) / (LAWN_RADIUS - TERRACE_RADIUS);
    // A gentle hump peaking mid-lawn, back to the terrace level at the shore's edge.
    return TERRACE_LEVEL + Math.sin(t * Math.PI) * 0.28;
  }
  if (r <= GROUND_RADIUS) {
    const t = (r - LAWN_RADIUS) / (GROUND_RADIUS - LAWN_RADIUS);
    return TERRACE_LEVEL - t * t * 1.1;
  }
  return SEA_LEVEL - 0.3;
}

/** Low-poly, flat-shaded trees and shrubs around the lawn's outer ring, in the island's palette; instanced (four draw calls). */
function plantRing(group: THREE.Group, dressing: PlaceDressing, tier: RenderTier, track: <T extends { dispose(): void }>(item: T) => T): { canopies: THREE.InstancedMesh; trunks: THREE.InstancedMesh; shrubs: THREE.InstancedMesh; setColours(next: PlaceDressing): void } {
  const TREES = tier === "full" ? 18 : 14, SHRUBS = 16;
  const canopyGeometry = track(new THREE.ConeGeometry(1, 2.2, 6));
  const trunkGeometry = track(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 5));
  const shrubGeometry = track(new THREE.IcosahedronGeometry(0.55, 0));
  const canopyMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.lawn, roughness: 0.95, flatShading: true }));
  const trunkMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.timber, roughness: 0.9, flatShading: true }));
  const shrubMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.moss, roughness: 0.95, flatShading: true }));
  const canopies = new THREE.InstancedMesh(canopyGeometry, canopyMaterial, TREES), trunks = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, TREES), shrubs = new THREE.InstancedMesh(shrubGeometry, shrubMaterial, SHRUBS);
  canopies.name = "trees"; trunks.name = "trunks"; shrubs.name = "shrubs";
  canopies.castShadow = trunks.castShadow = shrubs.castShadow = true;
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), tone = new THREE.Color();
  let seed = 0x7a11;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const paint = (mesh: THREE.InstancedMesh, base: string, count: number) => { for (let i = 0; i < count; i += 1) { tone.set(base).offsetHSL(0, 0, (rand() - 0.5) * 0.12); mesh.setColorAt(i, tone); } if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  for (let i = 0; i < TREES; i += 1) {
    // Leave the gate side (+z, in front of the camera) open so the trees frame the court rather than hide it.
    const a = Math.PI * 0.62 + (i / TREES) * Math.PI * 1.76 + (rand() - 0.5) * 0.14;
    const r = 13 + rand() * 2.4, x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundHeightAt(x, z), size = 0.5 + rand() * 0.38;
    position.set(x, y + 0.55 + 1.1 * size, z); scale.set(size, size, size); quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    matrix.compose(position, quaternion, scale); canopies.setMatrixAt(i, matrix);
    position.set(x, y + 0.3, z); scale.set(0.8, 0.75, 0.8); matrix.compose(position, quaternion, scale); trunks.setMatrixAt(i, matrix);
  }
  for (let i = 0; i < SHRUBS; i += 1) {
    const a = (i / SHRUBS) * Math.PI * 2 + rand() * 0.3, r = 10.6 + rand() * 1.8, x = Math.cos(a) * r, z = Math.sin(a) * r, size = 0.6 + rand() * 0.7;
    position.set(x, groundHeightAt(x, z) + 0.3 * size, z); scale.set(size, size * 0.8, size); quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand() * Math.PI);
    matrix.compose(position, quaternion, scale); shrubs.setMatrixAt(i, matrix);
  }
  canopies.instanceMatrix.needsUpdate = trunks.instanceMatrix.needsUpdate = shrubs.instanceMatrix.needsUpdate = true;
  const setColours = (next: PlaceDressing) => { seed = 0x7a11; paint(canopies, next.lawn, TREES); paint(shrubs, next.moss, SHRUBS); trunkMaterial.color.set(next.timber); };
  setColours(dressing);
  group.add(canopies, trunks, shrubs);
  return { canopies, trunks, shrubs, setColours };
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
  const stone = new THREE.Color(dressing.terrace), joint = new THREE.Color(dressing.joint), moss = new THREE.Color(dressing.lawn), sea = new THREE.Color(dressing.sea);
  const sand = new THREE.Color(dressing.stone).lerp(sea, 0.25);
  const c = new THREE.Color();
  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3] ?? 0, z = positions[i * 3 + 2] ?? 0, r = Math.hypot(x, z);
    // A quiet, deterministic variation so flat shading reads as stone, not plastic.
    const grain = 0.94 + 0.06 * (0.5 + 0.5 * Math.sin(x * 1.7 + z * 2.3) * Math.cos(x * 0.9 - z * 1.1));
    if (r <= TERRACE_RADIUS) c.copy(stone).lerp(joint, r > TERRACE_RADIUS - 0.6 ? 0.55 : 0.08);
    else if (r <= LAWN_RADIUS) c.copy(moss).lerp(sand, Math.max(0, (r - TERRACE_RADIUS) / (LAWN_RADIUS - TERRACE_RADIUS) - 0.8) * 2.5);
    else { const t = (r - LAWN_RADIUS) / (GROUND_RADIUS - LAWN_RADIUS); c.copy(sand).lerp(sea.clone().multiplyScalar(0.7), Math.max(0, t - 0.5) * 1.6); }
    c.multiplyScalar(grain);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
}

export function createGround(scene: THREE.Scene, dressing: PlaceDressing, tier: RenderTier): Ground {
  const group = new THREE.Group();
  group.name = "Harbour island";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
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
  island.receiveShadow = true;
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
  // Shallows: the sea is a little darker where it meets the shore.
  const shallowsGeometry = track(new THREE.RingGeometry(GROUND_RADIUS - 2.5, GROUND_RADIUS + 9, 64, 1));
  const shallowsMaterial = track(new THREE.MeshStandardMaterial({ color: new THREE.Color(dressing.sea).multiplyScalar(0.78), roughness: 0.4, metalness: 0.05, transparent: true, opacity: 0.85 }));
  const shallows = new THREE.Mesh(shallowsGeometry, shallowsMaterial);
  shallows.name = "Shallows"; shallows.rotation.x = -Math.PI / 2; shallows.position.y = SEA_LEVEL + 0.006; shallows.userData.ground = true;
  group.add(shallows);
  const plants = plantRing(group, dressing, tier, track);
  scene.add(group);

  const applyAir = (next: PlaceDressing) => {
    const sky = new THREE.Color(next.sky);
    scene.background = sky;
    scene.fog = new THREE.Fog(new THREE.Color(next.fog), next.fogNear, next.fogFar);
  };
  applyAir(dressing);

  return {
    group, island, groundHeightAt,
    setDressing(next) {
      paintVertices(colors, positions, next);
      geometry.getAttribute("color").needsUpdate = true;
      seaMaterial.color.set(next.sea);
      shallowsMaterial.color.set(next.sea).multiplyScalar(0.78);
      plants.setColours(next);
      applyAir(next);
    },
    dispose() {
      scene.remove(group);
      geometry.dispose(); material.dispose();
      seaGeometry.dispose(); seaMaterial.dispose();
      plants.canopies.dispose(); plants.trunks.dispose(); plants.shrubs.dispose();
      for (const item of disposables) item.dispose();
      scene.fog = null; scene.background = null;
    },
  };
}
