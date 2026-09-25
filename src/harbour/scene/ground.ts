import {townChannelHeight} from '../mountain/townChannel.ts';
import {mountainBaseHeight} from '../mountain/definition.ts';
import {mountainGround as mountainGroundRaw} from '../mountain/mountainGround.ts';
import {islandHeight,SEA_LEVEL as ISLAND_SEA_LEVEL,TERRACE_LEVEL as ISLAND_TERRACE_LEVEL} from '../mountain/islandShape.ts';
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { PlaceDressing } from "./place.ts";
import { plantPlan } from "./planting.ts";
import type { RenderTier } from "./quality.ts";
import { HARBOUR_LAND } from '../village/world.ts';
import { buildLattice, groundMasks, paintGround, type Lattice } from './groundPaint.ts';
import { paperGrain } from '../art/cardScene.ts';

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
  // The island's trees are the same painted card as the mountain's: faceted crowns lit on
  // top and dark underneath (a vertex gradient), tinted per instance, on a visible trunk.
  const canopyGeometry = track(islandCrown());
  const trunkGeometry = track(new THREE.CylinderGeometry(0.12, 0.16, 0.9, 5));
  const shrubGeometry = track(islandBush());
  const paper = paperGrain();
  const canopyMaterial = track(new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.92, flatShading: true, map: paper }));
  const trunkMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.timber, roughness: 0.9, flatShading: true }));
  const shrubMaterial = track(new THREE.MeshStandardMaterial({ color: "#ffffff", vertexColors: true, roughness: 0.95, flatShading: true, map: paper }));
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
  // An ink shell round each crown on the full tier: the cut-paper outline.
  if (tier === "full") {
    const shell = new THREE.InstancedMesh(canopyGeometry, track(new THREE.MeshBasicMaterial({ color: "#2f2a24", side: THREE.BackSide })), TREES);
    shell.name = "tree outlines"; for (let i = 0; i < TREES; i += 1) { canopies.getMatrixAt(i, matrix); matrix.scale(scale.set(1.07, 1.06, 1.07)); shell.setMatrixAt(i, matrix); }
    shell.instanceMatrix.needsUpdate = true; group.add(shell); track(shell);
  }
  return { canopies, trunks, shrubs, setColours };
}

/** A round, faceted crown centred near its middle (about the old cone's size), dark under and lit on top. */
function islandCrown(): THREE.BufferGeometry {
  const parts = [new THREE.IcosahedronGeometry(1.05, 1).scale(1.05, .85, 1).translate(0, .05, 0), new THREE.IcosahedronGeometry(.7, 0).translate(.45, .55, .2), new THREE.IcosahedronGeometry(.65, 0).translate(-.5, .35, -.25)];
  return shadeUp(mergeGeometries(parts.map((g) => { const q = g.index ? g.toNonIndexed() : g; q.deleteAttribute("uv"); return q; }))!, .6, 1.1, -.8, 1.2);
}
function islandBush(): THREE.BufferGeometry { const g = new THREE.IcosahedronGeometry(0.55, 0); g.deleteAttribute("uv"); return shadeUp(g, .65, 1.1, -.5, .5); }
function shadeUp(g: THREE.BufferGeometry, low: number, high: number, y0: number, y1: number): THREE.BufferGeometry {
  const p = g.getAttribute("position"), c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i += 1) { const t = Math.max(0, Math.min(1, (p.getY(i) - y0) / (y1 - y0))), k = low + (high - low) * t; c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = k; }
  g.setAttribute("color", new THREE.BufferAttribute(c, 3)); return g;
}

export type Ground = {
  group: THREE.Group;
  /** The mesh a raycast treats as "empty ground" (`userData.ground === true`). */
  island: THREE.Mesh;
  groundHeightAt(x: number, z: number): number;
  setDressing(dressing: PlaceDressing): void;
  dispose(): void;
};

// Immutable geography is reused through theme changes and renderer rebuilds.
// Each scene still owns its GPU geometry, normals and colour buffers.
const lattices=new Map<RenderTier,Lattice>();
function terrainLattice(tier:RenderTier):Lattice{
  const cached=lattices.get(tier);if(cached)return cached;
  const result=buildLattice(TERRAIN_LATTICE_BOUNDS,tier,groundHeightAt);lattices.set(tier,result);return result;
}
/** Aerial depth: eye-level views fog from ~120 to ~420 (the summit a soft silhouette from town, the dam still reads); a high eye sees further through thinner air. */
export function fogRange(eyeHeight:number,dressing:Pick<PlaceDressing,'fogNear'|'fogFar'>):[number,number]{
  const lift=Math.max(0,eyeHeight);
  return [Math.max(dressing.fogNear,120+lift*.9),Math.max(dressing.fogFar,420+lift*1.35)];
}

export function createGround(scene: THREE.Scene, dressing: PlaceDressing, tier: RenderTier): Ground {
  const group = new THREE.Group();
  group.name = "Harbour island";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const lattice=terrainLattice(tier),{positions,indices}=lattice,colors=new Float32Array(positions.length);
  const masks=groundMasks(lattice,tier,groundHeightAt);
  paintGround(colors,lattice,masks,dressing);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  // Paper grain in world space, so the ground is the same card as everything standing on it.
  const uvs=new Float32Array(positions.length/3*2);for(let i=0;i<uvs.length/2;i++){uvs[i*2]=positions[i*3]!/9;uvs[i*2+1]=positions[i*3+2]!/9;}
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(new THREE.BufferAttribute(indices,1));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, map: paperGrain() });
  const island = new THREE.Mesh(geometry, material);
  island.name = "Island ground";
  island.receiveShadow = true;
  // The land casts: ridges throw their shadow across the slopes and the gorge.
  island.castShadow = true;
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

  let air=dressing;
  const fog=new THREE.Fog(new THREE.Color(dressing.fog),120,420);
  const applyAir = (next: PlaceDressing) => {
    air=next;
    scene.background = new THREE.Color(next.sky);
    fog.color.set(next.fog);scene.fog = fog;
  };
  applyAir(dressing);
  // Fog depth follows the eye's height above the land (see fogRange).
  const previousBefore=scene.onBeforeRender;
  scene.onBeforeRender=(renderer,sceneArg,camera,...rest)=>{
    const p=camera.position,[near,far]=fogRange(p.y-groundHeightAt(p.x,p.z),air);fog.near=near;fog.far=far;
    previousBefore.call(scene,renderer,sceneArg,camera,...rest);
  };

  return {
    group, island, groundHeightAt,
    setDressing(next) {
      paintGround(colors, lattice, masks, next);
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
      scene.onBeforeRender=previousBefore;scene.fog = null; scene.background = null;
    },
  };
}
