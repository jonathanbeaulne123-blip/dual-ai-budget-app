import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { EMPTY_ATLAS_READING, type AtlasReading } from "../data/reading.ts";
import { atlasDressingFrom, type AtlasDressing } from "./dressing.ts";

/**
 * The Atlas (LITTLE_HARBOUR_v2 §4) — the room up the kitchen stair, where the
 * whole Journey is seen and entered.
 *
 * The Journey is an island world, and the room is built round a model of it:
 * an oak atlas stand under a low brass lamp, and on it **the household's own
 * island** — the turf, the cut earth of its shore, the ring of month stones
 * you have walked, the era's own roof on the crown, and the gate at the ring's
 * end with a lantern for every condition the finish line names, lit or not.
 * A plank runs off the stand's rim to a smaller table where the **next era**
 * waits, still wrapped in its weather. The dormer looks out to the real island
 * over the harbour.
 *
 * The model is not the world: it is an authored miniature in the harbour's own
 * materials, fed by `buildAtlasReading` (which reads the Journey's own
 * `core/pathEras.ts`). The full path world is never fetched into this room —
 * the island on the table is a **door** onto it (`onOpen("journey")`), and the
 * era plaque is a door onto that era. Nothing here proposes, crosses or
 * retires an era; the room writes nothing at all.
 */

export const ATLAS_LAYOUT = {
  halfWidth: 3.5,
  halfDepth: 2.7,
  wallHeight: 2.3,
  /** The atlas stand in the middle of the room, and the height of its top. */
  stand: { x: -0.25, z: -0.45, radius: 1.02, top: 0.86 },
  /** The island model's own radius on that top, and how high its turf stands. */
  island: { radius: 0.78, turf: 0.19 },
  /** The side table across the plank: the next era, in the fog. */
  side: { x: 1.68, z: -1.15, radius: 0.48, top: 0.7 },
  /** The era plaque on its brass easel, in the back-left corner, turned to the door. */
  easel: [-2.25, 0, -1.55] as const,
  /** The dormer in the back wall, and the lamp hanging over the stand. */
  window: [0.55, 1.42, -2.58] as const,
  lamp: [-0.25, 1.96, -0.45] as const,
  /** The stair down into the Kitchen, and the door back to the Court. */
  stair: [-2.55, 0, 2.15] as const,
  door: [1.45, 0, 2.5] as const,
} as const;

/** Month stones the ring can hold; a longer era is walked in the world itself. */
export const ATLAS_RING_STONES = 24;
/** Lanterns the gate can hang; the rest are counted in the plaque's words. */
export const ATLAS_GATE_LANTERNS = 8;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** "7 months walked" — and "not a month yet" for a brand new era, which is a state and not a fault. */
export function monthsWalked(months: number): string {
  return months <= 0 ? "not a month yet" : count(months, "month walked", "months walked");
}

/** "the 2nd era of 4". Ordinals to nineteenth, then plain numbers — the room never says "2th". */
export function eraPlace(index: number, eras: number): string {
  const suffix = index % 100 >= 11 && index % 100 <= 13 ? "th" : index % 10 === 1 ? "st" : index % 10 === 2 ? "nd" : index % 10 === 3 ? "rd" : "th";
  return eras > 1 ? `the ${index}${suffix} era of ${eras}` : "the first era";
}

/**
 * What the era plaque says, in the era's own words and never a figure: the
 * name, where it stands on the journey, the months walked, and the gate.
 *
 * Three short lines, never one long one: an engraved plate squeezes a line to
 * fit its face (`ctx.fillText`'s own `maxWidth`), so a sentence that runs the
 * width of the room comes out as slivers nobody can read.
 */
export function eraPlaqueWords(atlas: AtlasReading): string {
  const era = atlas.era;
  if (!era) return atlas.crossed > 0
    ? `${count(atlas.crossed, "era crossed", "eras crossed")}\nThe next one is yours to name`
    : "No era yet\nThe island is waiting to be named";
  return `${era.name}\n${eraPlace(era.index, atlas.eras)} · ${monthsWalked(era.months)}\n${atlas.gate?.words ?? "The gate is not set"}`;
}

/** The little card on the next island: its name, or the fog's own honest word. */
export function nextIslandWords(atlas: AtlasReading): string {
  if (!atlas.next) return "Across the bridge\nUnplanned";
  return atlas.next.sketched
    ? `Across the bridge\n“${atlas.next.name}”, suggested`
    : `Across the bridge\n“${atlas.next.name}”`;
}

/** Where the `index`th month stone stands on the ring, of `total` — clockwise from the gate. */
export function stonePin(index: number, total: number): { x: number; z: number } {
  const span = Math.max(1, total);
  const angle = -Math.PI * 0.62 + (index / span) * Math.PI * 1.62;
  const radius = ATLAS_LAYOUT.island.radius * 0.62;
  return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius };
}

// Stand just inside the loft door: the stand in front with the island on it,
// the easel on the left wall, the next island and the dormer beyond.
const PHONE_ROOM: Pose = { target: [-0.3, 0.9, -0.5], r: 4.2, theta: 0.8, phi: 1.3 };
const DESKTOP_ROOM: Pose = { target: [-0.05, 0.92, -0.5], r: 4.05, theta: 0.775, phi: 1.315 };

export function atlasPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "atlas:phone": PHONE_ROOM,
    "atlas:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.05, -0.4], r: 5.4, theta: 0, phi: 1.06 },
    "sky:desktop": { target: [0, 1.1, -0.4], r: 5.9, theta: 0.2, phi: 1.04 },
    // The door frieze: the island on its stand, raking, for the band above an open tool.
    "door:phone": { target: [-0.25, 1.02, -0.45], r: 1.74, theta: 0.04, phi: 1.24 },
    "door:desktop": { target: [-0.2, 1.02, -0.45], r: 1.92, theta: 0.08, phi: 1.24 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 5) * 0.6, -0.65, 0.65);
    const close = anchor.zone === "stair" ? 2.4 : anchor.zone === "model" ? 1.35 : 1.8;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.6, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.6, y), z], r: close + 0.36, theta: theta + 0.14, phi: 1.14 };
  }
  return poses;
}

export type AtlasSceneReading = { atlas: AtlasReading | null; partnerName: string | null };

/** Narrows whatever the shell hands over to the atlas's own rows. */
export function readAtlasReading(value: unknown): AtlasSceneReading {
  if (!value || typeof value !== "object") return { atlas: null, partnerName: null };
  const source = value as { atlas?: AtlasReading; partner?: { name?: string } | null };
  return { atlas: source.atlas ?? null, partnerName: source.partner?.name ?? null };
}

export type AtlasOptions = {
  dressing: AtlasDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createAtlas(scene: THREE.Scene, options: AtlasOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "atlas";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, ...extra }));
  const placed = <T extends THREE.BufferGeometry>(geometry: T, x: number, y: number, z: number, rotation?: [number, number, number]): T => {
    if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
    geometry.translate(x, y, z);
    return geometry;
  };
  const merged = (geometries: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh => {
    const joined = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
    if (joined && geometries.length > 1) for (const g of geometries) g.dispose();
    const mesh = new THREE.Mesh(joined ?? geometries[0]!, material);
    track(mesh.geometry);
    return mesh;
  };
  const shadowed = <T extends THREE.Object3D>(object: T, cast = full, receive = true): T => {
    object.castShadow = cast; object.receiveShadow = receive; return object;
  };

  const contacts = track(createContactShadows({ ink: dressing.ink }));
  const { halfWidth, halfDepth, wallHeight, stand, island, side } = ATLAS_LAYOUT;

  // ── The loft: boarded floor, limewashed walls, rafters over your head ─────
  const floor = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, halfDepth * 2)), mat(dressing.floor, { roughness: 0.96 })), false, true);
  floor.rotation.x = -Math.PI / 2; floor.name = "atlas-floor"; group.add(floor);
  const boards = new THREE.InstancedMesh(track(new THREE.PlaneGeometry(halfWidth * 2, 0.02)), mat(dressing.floorAlt, { roughness: 1 }), 8);
  boards.rotation.x = -Math.PI / 2; boards.position.y = 0.004; boards.name = "atlas-board-joints";
  {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 8; i++) { matrix.makeTranslation(0, -halfDepth + ((i + 0.5) / 8) * halfDepth * 2, 0); boards.setMatrixAt(i, matrix); }
    boards.instanceMatrix.needsUpdate = true;
  }
  group.add(boards);

  const walls = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.22), 0, wallHeight / 2, -halfDepth),
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.22), 0, wallHeight / 2, halfDepth),
    placed(new THREE.BoxGeometry(0.22, wallHeight, halfDepth * 2), -halfWidth, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(0.22, wallHeight, halfDepth * 2), halfWidth, wallHeight / 2, 0),
  ], mat(dressing.plaster, { roughness: 0.96 }));
  shadowed(walls, false, true); walls.name = "atlas-walls"; group.add(walls);
  // The roof pitch: a ridge beam down the room with rafters leaning off it, so
  // the ceiling is the underside of the cottage's own roof and not a lid.
  const frame = merged([
    placed(new THREE.BoxGeometry(0.16, 0.18, halfDepth * 2 - 0.2), 0, wallHeight + 0.42, 0),
    placed(new THREE.BoxGeometry(halfWidth * 2 - 0.2, 0.12, 0.1), 0, wallHeight - 0.08, -halfDepth + 0.16),
    placed(new THREE.BoxGeometry(halfWidth * 2 - 0.2, 0.12, 0.1), 0, wallHeight - 0.08, halfDepth - 0.16),
    placed(new THREE.BoxGeometry(0.12, wallHeight, 0.12), -halfWidth + 0.14, wallHeight / 2, -halfDepth + 0.14),
    placed(new THREE.BoxGeometry(0.12, wallHeight, 0.12), halfWidth - 0.14, wallHeight / 2, -halfDepth + 0.14),
  ], mat(dressing.frame, { roughness: 0.85 }));
  frame.name = "atlas-frame"; group.add(frame);
  const rafters = new THREE.InstancedMesh(track(new THREE.BoxGeometry(halfWidth * 2.2, 0.1, 0.1)), mat(dressing.frame, { roughness: 0.85 }), 5);
  rafters.name = "atlas-rafters";
  {
    const matrix = new THREE.Matrix4(); const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion(); const scale = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 5; i++) {
      position.set(0, wallHeight + 0.2, -halfDepth + 0.6 + i * ((halfDepth * 2 - 1.2) / 4));
      quaternion.setFromEuler(new THREE.Euler(0, 0, i % 2 === 0 ? 0.24 : -0.24));
      rafters.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    rafters.instanceMatrix.needsUpdate = true;
  }
  group.add(rafters);

  // ── The dormer: the day, and the real island out there over the harbour ──
  const [wx, wy, wz] = ATLAS_LAYOUT.window;
  const dormer = merged([
    placed(new THREE.BoxGeometry(1.22, 0.1, 0.1), wx, wy + 0.56, wz + 0.13),
    placed(new THREE.BoxGeometry(1.22, 0.1, 0.1), wx, wy - 0.56, wz + 0.13),
    placed(new THREE.BoxGeometry(0.1, 1.22, 0.1), wx - 0.56, wy, wz + 0.13),
    placed(new THREE.BoxGeometry(0.1, 1.22, 0.1), wx + 0.56, wy, wz + 0.13),
    placed(new THREE.BoxGeometry(0.05, 1.1, 0.08), wx, wy, wz + 0.13),
  ], mat(dressing.window, { roughness: 0.7 }));
  dormer.name = "atlas-dormer"; dormer.userData.anchor = "dormer"; group.add(dormer);
  const day = new THREE.Mesh(track(new THREE.PlaneGeometry(1.06, 1.06)), track(new THREE.MeshBasicMaterial({ color: dressing.day })));
  day.position.set(wx, wy, wz + 0.11); day.name = "atlas-day"; day.userData.anchor = "dormer"; group.add(day);
  const farSea = new THREE.Mesh(track(new THREE.PlaneGeometry(1.04, 0.34)), track(new THREE.MeshBasicMaterial({ color: dressing.farSea })));
  farSea.position.set(wx, wy - 0.34, wz + 0.115); farSea.userData.anchor = "dormer"; group.add(farSea);
  // The island itself, small and far: the same shape the model on the stand has.
  const farIsland = merged([
    placed(new THREE.CircleGeometry(0.19, 16, 0, Math.PI), wx - 0.1, wy - 0.19, wz + 0.12),
    placed(new THREE.CircleGeometry(0.1, 12, 0, Math.PI), wx + 0.22, wy - 0.19, wz + 0.12),
  ], track(new THREE.MeshBasicMaterial({ color: dressing.farIsland })));
  farIsland.name = "atlas-far-island"; farIsland.userData.anchor = "dormer"; group.add(farIsland);

  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.46);
  group.add(hemi);

  // ── The lamp over the stand: the raking light the room is built round ─────
  const [lx, ly, lz] = ATLAS_LAYOUT.lamp;
  const lamp = merged([
    placed(new THREE.CylinderGeometry(0.02, 0.02, wallHeight + 0.5 - ly, 6), lx, ly + (wallHeight + 0.5 - ly) / 2, lz),
    placed(new THREE.ConeGeometry(0.23, 0.18, 14, 1, true), lx, ly - 0.05, lz),
  ], mat(dressing.lampShade, { roughness: 0.55, metalness: 0.25, side: THREE.DoubleSide }));
  lamp.name = "atlas-lamp"; group.add(lamp);
  const bulb = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 10, 8)), track(new THREE.MeshBasicMaterial({ color: dressing.light.lamp })));
  bulb.position.set(lx, ly - 0.14, lz); bulb.name = "atlas-bulb"; group.add(bulb);
  const lampLight = new THREE.PointLight(new THREE.Color(dressing.light.lamp), dressing.light.lampIntensity, 5.5, 2);
  lampLight.position.set(lx, ly - 0.12, lz);
  lampLight.castShadow = full;
  group.add(lampLight);

  // ── The atlas stand: an oak top on a turned column, a brass band at the rim ─
  const standTop = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(stand.radius, stand.radius, 0.07, 36)), mat(dressing.stand, { roughness: 0.78 })));
  standTop.position.set(stand.x, stand.top - 0.035, stand.z); standTop.name = "atlas-stand"; group.add(standTop);
  const standBand = new THREE.Mesh(track(new THREE.TorusGeometry(stand.radius + 0.005, 0.018, 6, 40)), mat(dressing.brass, { roughness: 0.38, metalness: 0.55 }));
  standBand.rotation.x = Math.PI / 2; standBand.position.set(stand.x, stand.top - 0.05, stand.z); standBand.name = "atlas-stand-band"; group.add(standBand);
  const standColumn = merged([
    placed(new THREE.CylinderGeometry(0.1, 0.13, stand.top - 0.17, 12), stand.x, (stand.top - 0.17) / 2 + 0.06, stand.z),
    placed(new THREE.SphereGeometry(0.11, 12, 8), stand.x, stand.top * 0.48, stand.z),
    placed(new THREE.BoxGeometry(0.62, 0.07, 0.13), stand.x, 0.05, stand.z),
    placed(new THREE.BoxGeometry(0.13, 0.07, 0.62), stand.x, 0.05, stand.z),
    placed(new THREE.BoxGeometry(0.5, 0.07, 0.13), stand.x, 0.05, stand.z, [0, Math.PI / 4, 0]),
  ], mat(dressing.standColumn, { roughness: 0.84 }));
  shadowed(standColumn, full, true); standColumn.name = "atlas-stand-column"; group.add(standColumn);
  contacts.disc(stand.x, stand.z, stand.radius * 0.78, 0.6, group);

  // ── The island on the stand ───────────────────────────────────────────────
  const model = new THREE.Group();
  model.name = "atlas-island";
  model.position.set(stand.x, stand.top, stand.z);
  model.userData.anchor = "island";
  group.add(model);

  // The sea it floats in: a ring of glass laid on the oak.
  const modelSea = new THREE.Mesh(track(new THREE.CylinderGeometry(island.radius + 0.14, island.radius + 0.14, 0.016, 36)), mat(dressing.modelSea, { roughness: 0.28, metalness: 0.1 }));
  modelSea.position.y = 0.008; modelSea.name = "atlas-model-sea"; model.add(modelSea);
  // The land, cut the way the world cuts it: a sand collar at the waterline,
  // the earth narrowing away under it, and the turf crowning the whole of it
  // — narrower at the top than at its edge, so the island has a brow and not
  // a lid.
  const shore = new THREE.Mesh(track(new THREE.CylinderGeometry(island.radius, island.radius, 0.03, 32)), mat(dressing.shore, { roughness: 0.98 }));
  shore.position.y = 0.02; shore.name = "atlas-model-shore"; model.add(shore);
  const landSides = merged([
    placed(new THREE.CylinderGeometry(island.radius - 0.06, island.radius - 0.2, 0.11, 32), 0, 0.085, 0),
  ], mat(dressing.earth, { roughness: 0.95 }));
  shadowed(landSides, full, true); landSides.name = "atlas-model-earth"; model.add(landSides);
  const turf = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(island.radius - 0.16, island.radius - 0.06, 0.05, 32)), mat(dressing.land, { roughness: 0.94 })));
  turf.position.y = island.turf - 0.025; turf.name = "atlas-model-turf"; model.add(turf);
  const turfTop = island.turf;
  // Three little trees on the turf, away from the path.
  const trees = new THREE.InstancedMesh(track(new THREE.ConeGeometry(0.045, 0.12, 6)), mat(dressing.tree, { roughness: 0.92 }), 5);
  trees.name = "atlas-model-trees";
  {
    const matrix = new THREE.Matrix4(); const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion(); const scale = new THREE.Vector3();
    for (let i = 0; i < 5; i++) {
      const angle = 1.35 + i * 0.52;
      position.set(Math.sin(angle) * island.radius * 0.3, turfTop + 0.06, Math.cos(angle) * island.radius * 0.3);
      quaternion.identity();
      scale.setScalar(0.8 + ((i * 7) % 5) * 0.09);
      trees.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    trees.instanceMatrix.needsUpdate = true;
  }
  model.add(trees);

  // The ring of month stones, and the one we are standing on.
  const stoneGeometry = track(new THREE.CylinderGeometry(0.026, 0.03, 0.02, 6));
  const stones = new THREE.InstancedMesh(stoneGeometry, mat(dressing.stone, { roughness: 0.9 }), ATLAS_RING_STONES);
  stones.name = "atlas-model-stones"; stones.userData.anchor = "island"; stones.count = 0; model.add(stones);
  const today = new THREE.Mesh(track(new THREE.CylinderGeometry(0.034, 0.038, 0.028, 8)), mat(dressing.stoneToday, { roughness: 0.72 }));
  today.name = "atlas-model-today"; today.userData.anchor = "island"; today.visible = false; model.add(today);

  // The era's own roof on the crown of the island.
  const homeGroup = new THREE.Group();
  homeGroup.name = "atlas-model-home"; homeGroup.userData.anchor = "island";
  {
    const homeWalls = new THREE.Mesh(track(new THREE.BoxGeometry(0.16, 0.11, 0.13)), mat(dressing.homeWall, { roughness: 0.9 }));
    homeWalls.position.y = 0.055; homeGroup.add(homeWalls);
    const roof = new THREE.Mesh(track(new THREE.ConeGeometry(0.135, 0.09, 4)), mat(dressing.homeRoof, { roughness: 0.86 }));
    roof.position.y = 0.155; roof.rotation.y = Math.PI / 4; homeGroup.add(roof);
    homeGroup.position.set(0, turfTop, -0.06);
    homeGroup.traverse((node) => { node.userData.anchor = "island"; });
    model.add(homeGroup);
  }

  // The gate at the end of the ring: two posts, a lintel, and a lantern per condition.
  const gateGroup = new THREE.Group();
  gateGroup.name = "atlas-model-gate"; gateGroup.userData.anchor = "gate";
  const gatePin = stonePin(1, 1);
  {
    const posts = merged([
      placed(new THREE.BoxGeometry(0.022, 0.15, 0.022), -0.085, 0.075, 0),
      placed(new THREE.BoxGeometry(0.022, 0.15, 0.022), 0.085, 0.075, 0),
      placed(new THREE.BoxGeometry(0.21, 0.022, 0.03), 0, 0.16, 0),
    ], mat(dressing.gate, { roughness: 0.8 }));
    posts.userData.anchor = "gate"; gateGroup.add(posts);
    gateGroup.position.set(gatePin.x, turfTop, gatePin.z);
    gateGroup.rotation.y = Math.atan2(gatePin.x, gatePin.z);
    model.add(gateGroup);
  }
  const lanternGeometry = track(new THREE.SphereGeometry(0.019, 8, 6));
  const lit = new THREE.InstancedMesh(lanternGeometry, track(new THREE.MeshBasicMaterial({ color: dressing.lanternLit })), ATLAS_GATE_LANTERNS);
  lit.name = "atlas-gate-lit"; lit.userData.anchor = "gate"; lit.count = 0; gateGroup.add(lit);
  const dark = new THREE.InstancedMesh(lanternGeometry, mat(dressing.lanternDark, { roughness: 0.85 }), ATLAS_GATE_LANTERNS);
  dark.name = "atlas-gate-dark"; dark.userData.anchor = "gate"; dark.count = 0; gateGroup.add(dark);

  contacts.disc(0, 0, island.radius * 0.9, 0.34, model, 0.004);

  // ── The plank off the rim, and the next island on its own small table ─────
  const bridge = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.12, 0.022, 0.15)), mat(dressing.bridge, { roughness: 0.86 })), false, true);
  bridge.position.set((stand.x + stand.radius + side.x - side.radius) / 2, stand.top - 0.02, (stand.z + side.z) / 2);
  bridge.rotation.set(0, Math.atan2(side.x - stand.x, side.z - stand.z) - Math.PI / 2, -0.12);
  bridge.name = "atlas-bridge"; bridge.userData.anchor = "next-island"; group.add(bridge);

  const sideTable = merged([
    placed(new THREE.CylinderGeometry(side.radius, side.radius, 0.06, 24), side.x, side.top - 0.03, side.z),
    placed(new THREE.CylinderGeometry(0.07, 0.1, side.top - 0.12, 10), side.x, (side.top - 0.12) / 2 + 0.05, side.z),
    placed(new THREE.CylinderGeometry(0.22, 0.24, 0.05, 14), side.x, 0.025, side.z),
  ], mat(dressing.standColumn, { roughness: 0.84 }));
  shadowed(sideTable, full, true); sideTable.name = "atlas-side-table"; group.add(sideTable);
  contacts.disc(side.x, side.z, side.radius * 0.8, 0.55, group);

  const nextModel = new THREE.Group();
  nextModel.name = "atlas-next-island";
  nextModel.position.set(side.x, side.top, side.z);
  nextModel.userData.anchor = "next-island";
  group.add(nextModel);
  {
    const sea = new THREE.Mesh(track(new THREE.CylinderGeometry(0.34, 0.34, 0.014, 24)), mat(dressing.modelSea, { roughness: 0.3, metalness: 0.1 }));
    sea.position.y = 0.007; nextModel.add(sea);
    const land = merged([
      placed(new THREE.CylinderGeometry(0.24, 0.17, 0.1, 22), 0, 0.05, 0),
    ], mat(dressing.earth, { roughness: 0.95 }));
    land.name = "atlas-next-earth"; nextModel.add(land);
    const nextTurf = new THREE.Mesh(track(new THREE.CylinderGeometry(0.235, 0.235, 0.024, 22)), mat(dressing.land, { roughness: 0.94 }));
    nextTurf.position.y = 0.105; nextModel.add(nextTurf);
    nextModel.traverse((node) => { node.userData.anchor = "next-island"; });
  }
  // The weather it keeps: a soft dome over the whole of it, thicker while nothing is planned.
  const fog = new THREE.Mesh(
    track(new THREE.SphereGeometry(0.33, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2)),
    track(new THREE.MeshBasicMaterial({ color: dressing.fog, transparent: true, opacity: 0.62, depthWrite: false, side: THREE.DoubleSide })),
  );
  fog.position.set(side.x, side.top + 0.01, side.z); fog.renderOrder = 3;
  fog.name = "atlas-fog"; fog.userData.anchor = "next-island"; group.add(fog);

  // ── The stair down into the Kitchen, and the loft door back to the Court ──
  const [sx, , sz] = ATLAS_LAYOUT.stair;
  const stairHead = merged([
    placed(new THREE.BoxGeometry(0.85, 0.07, 0.85), sx, 0.02, sz),
    placed(new THREE.BoxGeometry(0.08, 0.86, 0.08), sx - 0.4, 0.43, sz - 0.4),
    placed(new THREE.BoxGeometry(0.08, 0.86, 0.08), sx + 0.4, 0.43, sz - 0.4),
    placed(new THREE.BoxGeometry(0.88, 0.07, 0.07), sx, 0.86, sz - 0.4),
  ], mat(dressing.frame, { roughness: 0.85 }));
  stairHead.name = "atlas-stair"; stairHead.userData.anchor = "kitchen-stair"; group.add(stairHead);
  const stairWell = new THREE.Mesh(track(new THREE.PlaneGeometry(0.72, 0.72)), track(new THREE.MeshBasicMaterial({ color: dressing.frame })));
  stairWell.rotation.x = -Math.PI / 2; stairWell.position.set(sx, 0.006, sz);
  stairWell.userData.anchor = "kitchen-stair"; group.add(stairWell);

  const [dx, , dz] = ATLAS_LAYOUT.door;
  const doorFrame = merged([
    placed(new THREE.BoxGeometry(0.13, 1.9, 0.13), dx - 0.46, 0.95, dz),
    placed(new THREE.BoxGeometry(0.13, 1.9, 0.13), dx + 0.46, 0.95, dz),
    placed(new THREE.BoxGeometry(1.05, 0.13, 0.13), dx, 1.92, dz),
  ], mat(dressing.frame, { roughness: 0.85 }));
  doorFrame.name = "atlas-door"; doorFrame.userData.anchor = "court-door"; group.add(doorFrame);

  // ── The plates: the era on its easel, the card on the next island ─────────
  // The easel stands in the back-left corner and is turned to the door, so the
  // plaque is read from where you come in rather than from the wall.
  const [ex, , ez] = ATLAS_LAYOUT.easel;
  const EASEL_TURN = 0.62;
  const easel = new THREE.Group();
  easel.name = "atlas-easel";
  easel.position.set(ex, 0, ez);
  easel.rotation.y = EASEL_TURN;
  easel.userData.anchor = "plaque";
  {
    const legs = merged([
      placed(new THREE.BoxGeometry(0.05, 1.34, 0.05), -0.5, 0.67, 0.02, [0.06, 0, 0.09]),
      placed(new THREE.BoxGeometry(0.05, 1.34, 0.05), 0.5, 0.67, 0.02, [0.06, 0, -0.09]),
      placed(new THREE.BoxGeometry(0.05, 1.2, 0.05), 0, 0.6, -0.26, [-0.16, 0, 0]),
      placed(new THREE.BoxGeometry(1.14, 0.05, 0.09), 0, 0.96, 0.06),
      placed(new THREE.BoxGeometry(1.06, 0.04, 0.04), 0, 0.6, 0.04),
    ], mat(dressing.brass, { roughness: 0.42, metalness: 0.5 }));
    shadowed(legs, false, true);
    legs.userData.anchor = "plaque";
    easel.add(legs);
  }
  group.add(easel);
  contacts.disc(ex, ez, 0.4, 0.45, group);

  const finishNow = (): PlateFinish => plateFinish("current");
  const eraPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.2, 0.42));
  eraPlate.mesh.position.set(0, 1.2, 0.09);
  eraPlate.mesh.rotation.x = -0.14;
  eraPlate.mesh.userData.anchor = "plaque";
  easel.add(eraPlate.mesh);

  const nextPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, paper: true, size: "small" }, 0.7, 0.26));
  nextPlate.mesh.position.set(side.x, side.top + 0.012, side.z + 0.44);
  nextPlate.mesh.rotation.x = -Math.PI / 2.1;
  nextPlate.mesh.rotation.z = 0.26;
  nextPlate.mesh.userData.anchor = "next-island";
  group.add(nextPlate.mesh);

  // ── The reading, laid on the model ────────────────────────────────────────
  let view: AtlasReading = EMPTY_ATLAS_READING;
  let partnerName: string | null = null;

  const layOutIsland = (): void => {
    const months = view.era?.months ?? 0;
    const walked = Math.min(ATLAS_RING_STONES, Math.max(0, months));
    const matrix = new THREE.Matrix4(); const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion(); const scale = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < walked; i++) {
      const pin = stonePin(i, ATLAS_RING_STONES);
      position.set(pin.x, turfTop + 0.008, pin.z);
      quaternion.setFromEuler(new THREE.Euler(0, i * 0.41, 0));
      matrix.compose(position, quaternion, scale);
      stones.setMatrixAt(i, matrix);
    }
    stones.count = walked;
    stones.instanceMatrix.needsUpdate = true;
    // The stone we are standing on: the last one walked, proud of the rest.
    if (walked > 0) {
      const pin = stonePin(walked - 1, ATLAS_RING_STONES);
      today.position.set(pin.x, turfTop + 0.012, pin.z);
      today.visible = true;
    } else today.visible = false;
    // The island is the household's whether or not an era is running; only the
    // era's own roof and its gate wait for one to be named.
    homeGroup.visible = view.era !== null;

    const gate = view.gate;
    gateGroup.visible = gate !== null;
    const litCount = gate ? Math.min(ATLAS_GATE_LANTERNS, gate.lit) : 0;
    const darkCount = gate ? Math.min(ATLAS_GATE_LANTERNS - litCount, Math.max(0, gate.lanterns - gate.lit)) : 0;
    const hang = (mesh: THREE.InstancedMesh, from: number, howMany: number): void => {
      for (let i = 0; i < howMany; i++) {
        const slot = from + i;
        const total = Math.max(1, litCount + darkCount);
        position.set(-0.085 + (0.17 * (slot + 0.5)) / total, 0.185, 0);
        quaternion.identity();
        mesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
      }
      mesh.count = howMany;
      mesh.instanceMatrix.needsUpdate = true;
    };
    hang(lit, 0, litCount);
    hang(dark, litCount, darkCount);

    // The far side of the bridge: the fog lifts a little once an era is named,
    // and stays thick while nothing is planned.
    const material = fog.material as THREE.MeshBasicMaterial;
    material.opacity = view.next === null ? 0.72 : view.next.sketched ? 0.54 : 0.34;
    bridge.visible = view.era !== null;

    eraPlate.set(eraPlaqueWords(view), finishNow());
    nextPlate.set(nextIslandWords(view), finishNow());
  };

  const signatureOf = (reading: AtlasReading, partner: string | null): string => [
    reading.era?.key, reading.era?.name, reading.era?.index, reading.era?.months, reading.era?.home, reading.era?.plans,
    reading.eras, reading.crossed, reading.stones, reading.crossing, reading.keptPrivate,
    reading.gate?.kind, reading.gate?.met, reading.gate?.lit, reading.gate?.lanterns, reading.gate?.words,
    reading.next?.key, reading.next?.name, reading.next?.sketched, partner,
  ].join("§");
  let signature = "";

  function update(value: unknown): void {
    const next = readAtlasReading(value);
    const reading = next.atlas ?? EMPTY_ATLAS_READING;
    const nextSignature = signatureOf(reading, next.partnerName);
    if (nextSignature === signature) return;
    view = reading; partnerName = next.partnerName; signature = nextSignature;
    layOutIsland();
  }
  update(options.reading ?? null);

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const modelTop = stand.top + island.turf;

  /** The island's own words, for the model and for its twin. */
  const islandWords = (): string => {
    const era = view.era;
    if (!era) return view.crossed > 0
      ? `The stand — ${count(view.crossed, "era crossed", "eras crossed")} and no era running. Step into Journey.`
      : "The stand, waiting for an island — the journey has not begun. Step into Journey.";
    const held = view.keptPrivate > 0 ? ` · ${count(view.keptPrivate, "bank", "banks")} kept privately` : "";
    return `${era.name} — ${eraPlace(era.index, view.eras)}, ${monthsWalked(era.months)}, in ${era.homeLabel}${held}. Step into Journey.`;
  };

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = [
      { id: "island", position: at(stand.x, modelTop + 0.1, stand.z), zone: "model", label: islandWords(), door: { target: "journey", object: view.era?.key ?? "era-home" } },
    ];
    if (view.gate) rows.push({
      id: "gate", position: at(stand.x + gatePin.x, modelTop + 0.14, stand.z + gatePin.z), zone: "model",
      label: `The gate at the end of the ring — ${view.gate.words}${view.gate.met ? "" : view.era?.finishLine ? `. ${view.era.finishLine}` : ""}. Step into Journey.`,
      door: { target: "journey", object: view.era?.key ?? "era-home" },
    });
    rows.push({
      id: "plaque", position: at(ex + 0.06, 1.2, ez + 0.08), zone: "station",
      label: `${eraPlaqueWords(view).replace(/\n/g, " · ")}${view.crossing ? ` · waiting for ${partnerName ?? "the other of you"}` : ""}. Open this era in Journey.`,
      door: { target: "journey", object: view.era?.key ?? "era-home" },
    });
    rows.push({
      id: "next-island", position: at(side.x, side.top + 0.26, side.z), zone: "model",
      label: view.next
        ? `${nextIslandWords(view)}${view.next.sketched ? " — only one of you so far" : ""}. Step into Journey.`
        : "The far table, still in the fog — no next era planned. Step into Journey and name one.",
      door: { target: "journey", ...(view.next ? { object: view.next.key } : {}) },
    });
    rows.push({ id: "stones", position: at(stand.x, modelTop + 0.05, stand.z + island.radius * 0.5), zone: "model", label: `The path of months — ${count(view.stones, "stone laid", "stones laid")} on the journey so far. Step into Journey.`, door: { target: "journey" } });
    rows.push({ id: "dormer", position: at(wx, wy, wz + 0.3), zone: "prop", label: "The dormer — the real island out there, past the harbour." });
    rows.push({ id: "kitchen-stair", position: at(sx, 0.9, sz), zone: "stair", label: "The stair down — back into the Kitchen." });
    rows.push({ id: "court-door", position: at(dx, 1.0, dz - 0.15), zone: "stair", label: "The loft door — back to the Court." });
    return rows;
  };

  const regionList = (): Region[] => {
    const rows: Region[] = [
      { id: "island", group: "atlas", label: islandWords(), box: box(stand.x - island.radius - 0.16, stand.top - 0.1, stand.z - island.radius - 0.16, stand.x + island.radius + 0.16, modelTop + 0.3, stand.z + island.radius + 0.16) },
    ];
    if (view.gate) rows.push({
      id: "gate", group: "atlas", label: `The gate — ${view.gate.words}`,
      box: box(stand.x + gatePin.x - 0.16, modelTop - 0.02, stand.z + gatePin.z - 0.16, stand.x + gatePin.x + 0.16, modelTop + 0.24, stand.z + gatePin.z + 0.16),
    });
    rows.push({ id: "plaque", group: "atlas", label: "The era plaque on its easel", box: box(ex - 0.62, 0.88, ez - 0.55, ex + 0.62, 1.56, ez + 0.55) });
    rows.push({ id: "next-island", group: "atlas", label: view.next ? `The next island — ${view.next.name}` : "The next island — unplanned, still in the fog", box: box(side.x - 0.42, side.top - 0.12, side.z - 0.42, side.x + 0.42, side.top + 0.42, side.z + 0.42) });
    rows.push({ id: "dormer", group: "atlas", label: "The dormer over the harbour", box: box(wx - 0.7, wy - 0.7, wz - 0.1, wx + 0.7, wy + 0.7, wz + 0.35) });
    rows.push({ id: "kitchen-stair", group: "atlas", label: "The stair down into the Kitchen", box: box(sx - 0.5, 0, sz - 0.5, sx + 0.5, 1.0, sz + 0.5) });
    rows.push({ id: "court-door", group: "atlas", label: "The loft door — back to the Court", box: box(dx - 0.65, 0, dz - 0.3, dx + 0.65, 2.0, dz + 0.2) });
    return rows;
  };

  return {
    group,
    update,
    animate: () => false,
    dispose() {
      scene.remove(group);
      for (const item of disposables) item.dispose();
    },
    anchors: anchorList,
    poses: () => atlasPoses(anchorList()),
    regions: regionList,
  };
}

export const atlasPlace: Place = registerPlace({
  id: "atlas",
  build(scene, dressing, reading, quality, context) {
    return createAtlas(scene, {
      dressing: atlasDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
