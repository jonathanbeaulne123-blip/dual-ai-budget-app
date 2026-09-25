import {townChannelHeight} from '../mountain/townChannel.ts';
import {mountainBaseHeight,districtAt} from '../mountain/definition.ts';
import {mountainGround as mountainGroundRaw} from '../mountain/mountainGround.ts';
import {islandHeight,SEA_LEVEL as ISLAND_SEA_LEVEL,TERRACE_LEVEL as ISLAND_TERRACE_LEVEL} from '../mountain/islandShape.ts';
import * as THREE from "three";
import type { PlaceDressing } from "./place.ts";
import { plantPlan } from "./planting.ts";
import type { RenderTier } from "./quality.ts";
import { HARBOUR_LAND } from '../village/world.ts';

/**
 * The court's island patch (BUILD_PLAN §2 #8): a 60-unit vertex-coloured,
 * flat-shaded disc in the island's material language (`pathWorld3d.ts`
 * terrain) — a level terrace, a lawn ring that rises a little, a shore that
 * falls to the sea — plus the sea plane and the theme's fog.
 */
export const GROUND_RADIUS = HARBOUR_LAND.radius;
/** The court's own terrace and lawn ring (`COURT_LAYOUT`) reach 9.5; the island's apron sits just under them. */
export const TERRACE_RADIUS = HARBOUR_LAND.terrace;
/** The lawn ends in a sandy shore that falls to the sea; the island's edge is a real edge. */
export const LAWN_RADIUS = HARBOUR_LAND.lawn;
export const SEA_LEVEL = ISLAND_SEA_LEVEL;
/** The apron is a hair below the court's paving so the tiles, not the island, are the surface you see. */
export const TERRACE_LEVEL = ISLAND_TERRACE_LEVEL;
/**
 * The rendered terrain lattice reaches past the walkable WORLD_BOUNDS so the mountain's coast
 * and the summit's back slope are real ground meeting the sea, not a cut edge.
 */
export const TERRAIN_LATTICE_BOUNDS = {minX:-200,maxX:200,minZ:-396,maxZ:84} as const;


/**
 * Ground height at a point: the harbour island (with its town channel) and, north of it, the
 * baked mountain heightfield (landform, plateaus, gorge, and every road/path/foundation bench).
 * One function for physics and the render lattice; it has no vertical discontinuities.
 */
export function groundHeightAt(x: number, z: number): number {
  if(z < -48)return Math.max(islandHeight(x,z),mountainBaseHeight(x,z));
  // The island's north edge also carries the road foot's embankment and the funicular platform (raise-only).
  const island=z<-30?Math.max(islandHeight(x,z),mountainGroundRaw(x,z)):islandHeight(x,z);
  return townChannelHeight(x,z,island);
}

/**
 * Low-poly, flat-shaded trees and shrubs around the lawn's outer ring, in the
 * island's palette; instanced (four draw calls).
 *
 * **Where** each plant stands is not decided here: `scene/planting.ts`
 * `plantPlan` sows the ring — same LCG, same four draws per plant, now with
 * the buildings' footprints and doorways kept clear — and `body/obstacles.ts`
 * reads that same plan for the trunks a body bumps into. This function only
 * draws what the plan says, so the island cannot grow a tree you can walk
 * through, or one you bump into that is not there.
 */
function plantRing(group: THREE.Group, dressing: PlaceDressing, tier: RenderTier, track: <T extends { dispose(): void }>(item: T) => T): { canopies: THREE.InstancedMesh; trunks: THREE.InstancedMesh; shrubs: THREE.InstancedMesh; setColours(next: PlaceDressing): void } {
  const plan = plantPlan(tier);
  const TREES = plan.trees.length, SHRUBS = plan.shrubs.length;
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
  const up = new THREE.Vector3(0, 1, 0);
  // The tints keep their own run of the same LCG, reset at the top of every
  // dressing change exactly as before — the plan's draws are `planting.ts`'s
  // now and no longer share this sequence, so no colour moves.
  let seed = 0x7a11;
  const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const paint = (mesh: THREE.InstancedMesh, base: string, count: number) => { for (let i = 0; i < count; i += 1) { tone.set(base).offsetHSL(0, 0, (rand() - 0.5) * 0.12); mesh.setColorAt(i, tone); } if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; };
  for (let i = 0; i < TREES; i += 1) {
    const { x, z, size, spin } = plan.trees[i]!;
    const y = groundHeightAt(x, z);
    position.set(x, y + 0.55 + 1.1 * size, z); scale.set(size, size, size); quaternion.setFromAxisAngle(up, spin);
    matrix.compose(position, quaternion, scale); canopies.setMatrixAt(i, matrix);
    position.set(x, y + 0.3, z); scale.set(0.8, 0.75, 0.8); matrix.compose(position, quaternion, scale); trunks.setMatrixAt(i, matrix);
  }
  for (let i = 0; i < SHRUBS; i += 1) {
    const { x, z, size, spin } = plan.shrubs[i]!;
    position.set(x, groundHeightAt(x, z) + 0.3 * size, z); scale.set(size, size * 0.8, size); quaternion.setFromAxisAngle(up, spin);
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
    if(z < -55 && positions[i*3+1]! > 0) {
      const h=positions[i*3+1]!,d=districtAt(x,z),j=i+1;
      const slope=j<positions.length/3&&Math.abs(positions[j*3]!-x)<4?Math.abs(positions[j*3+1]!-h)/Math.max(.1,Math.abs(positions[j*3]!-x)):0;
      c.copy(moss);
      if(d?.biome==='woods')c.lerp(new THREE.Color(dressing.moss),.38);
      if(d?.biome==='meadow'||d?.biome==='orchard')c.lerp(new THREE.Color(dressing.plinth),.12);
      c.lerp(stone,Math.max(Math.min(.8,Math.max(0,slope-.35)*.65),Math.max(0,(h-66)/62)));
      if(h>103)c.lerp(new THREE.Color('#e6ece6'),.22);
    }
    else if (r <= TERRACE_RADIUS) c.copy(stone).lerp(joint, r > TERRACE_RADIUS - 0.6 ? 0.55 : 0.08);
    else if (r <= LAWN_RADIUS) c.copy(moss).lerp(sand, Math.max(0, (r - TERRACE_RADIUS) / (LAWN_RADIUS - TERRACE_RADIUS) - 0.8) * 2.5);
    else { const t = (r - LAWN_RADIUS) / (GROUND_RADIUS - LAWN_RADIUS); c.copy(sand).lerp(sea.clone().multiplyScalar(0.7), Math.min(1,Math.max(0, t - 0.5) * 1.6)); }
    c.multiplyScalar(grain);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
}

// Immutable geography is reused through theme changes and renderer rebuilds.
// Each scene still owns its GPU geometry, normals and colour buffers.
const lattices=new Map<RenderTier,{positions:Float32Array;indices:number[]}>();
function terrainLattice(tier:RenderTier){
  const cached=lattices.get(tier);if(cached)return cached;
  // ~2 unit spacing on full, ~3 on lite, over the whole island and mountain including its coast.
  const B=TERRAIN_LATTICE_BOUNDS,cols = tier==='full'?200:134, rows=tier==='full'?240:160;
  const vertexCount=(cols+1)*(rows+1), positions=new Float32Array(vertexCount*3), indices:number[]=[];
  for(let iz=0;iz<=rows;iz++)for(let ix=0;ix<=cols;ix++){
    const x=B.minX+ix/cols*(B.maxX-B.minX),z=B.minZ+iz/rows*(B.maxZ-B.minZ),i=iz*(cols+1)+ix;
    positions[i*3]=x;positions[i*3+1]=groundHeightAt(x,z);positions[i*3+2]=z;
    if(ix<cols&&iz<rows){const a=i,b=i+1,c=i+cols+1,d=c+1;indices.push(a,c,b,b,c,d);}
  }
  const result={positions,indices};lattices.set(tier,result);return result;
}

export function createGround(scene: THREE.Scene, dressing: PlaceDressing, tier: RenderTier): Ground {
  const group = new THREE.Group();
  group.name = "Harbour island";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const {positions,indices}=terrainLattice(tier),colors=new Float32Array(positions.length);
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
    scene.fog = new THREE.Fog(new THREE.Color(next.fog), Math.max(310, next.fogNear), Math.max(850, next.fogFar));
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
