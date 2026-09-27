import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import type { GlassPot, GlassPotState, GlasshouseReading, MinePots } from "../data/reading.ts";
import { EMPTY_GLASSHOUSE_READING } from "../data/reading.ts";
import { glasshouseDressingFrom, type GlasshouseDressing } from "./dressing.ts";

/**
 * The Glasshouse (LITTLE_HARBOUR_v2 §3) — the Master Planner, redesigned.
 *
 * Throw out the list. A task is a plant in a pot with a paper tag, and the
 * planner is a glasshouse with benches by week: this week is the front bench
 * in the light, next week behind it, the month at the back. A pot's state is
 * its plant — a seed for not started, a sprout for taken up — and done pots
 * stand blooming on the harvest shelf; nothing is deleted, it is harvested.
 * A pot past its date is not red, it is **dry**, and the watering can stands
 * by the bench. Rituals are perennials in the long bed; they come back on
 * their own.
 *
 * Nothing here posts, saves, completes or reschedules a task. Every pot is a
 * door onto the Master Planner (`onOpen("planner", "task/<id>")`) and the far
 * pane is a door onto the Calendar; the paper stays the paper.
 */

export const GLASSHOUSE_LAYOUT = {
  /** Interior half-width (x) and half-depth (z) inside the brick plinth. */
  halfWidth: 4.2,
  halfDepth: 3.2,
  plinth: 0.55,
  ridge: 3.5,
  /** The three benches: this week, next week, the month. Front bench toward the eye (+z). */
  benches: [
    { z: 0.62, top: 0.82, name: "This week" },
    { z: -0.85, top: 0.96, name: "Next week" },
    { z: -2.25, top: 1.1, name: "The month" },
  ],
  benchLength: 5.4,
  benchDepth: 0.72,
  /** Pots stand a step apart from the middle outward; the bench length is the limit. */
  potStep: 0.64,
  phonePotStep: 0.5,
  /** The perennial bed along the left wall, and the harvest shelf on the right. */
  bedX: -3.55,
  shelfX: 3.55,
  shelfY: 1.34,
  /** The garden door back to the Court, behind the eye. */
  door: [0.9, 0, 2.95] as const,
  can: [-1.15, 0, 1.35] as const,
  /** The side bench: the member's own private pots, along the right wall in front of the harvest shelf. */
  mine: { x: 3.4, z: 1.95, top: 0.86, length: 1.5, depth: 0.5 },
} as const;

/** The side bench stands at most this many pots per state; the count is in the plate's words either way. */
export const GLASSHOUSE_MINE_CAP = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where the `index`th of `count` pots stands along its bench. Centred, a step apart, never past the bench end. */
export function potSpot(index: number, count: number, composition: Composition = "desktop"): number {
  if (count <= 1) return 0;
  const step = Math.min(
    composition === "phone" ? GLASSHOUSE_LAYOUT.phonePotStep : GLASSHOUSE_LAYOUT.potStep,
    (GLASSHOUSE_LAYOUT.benchLength - 0.5) / (count - 1),
  );
  return -(step * (count - 1)) / 2 + index * step;
}

/** The benches' pots, grouped by bench index. Pure. */
export function benchRows(pots: readonly GlassPot[]): [GlassPot[], GlassPot[], GlassPot[]] {
  const rows: [GlassPot[], GlassPot[], GlassPot[]] = [[], [], []];
  for (const pot of pots) rows[pot.bench].push(pot);
  return rows;
}

/** The bench plate's words. Never a bare zero with no story: an empty bench is "a clear bench". */
export function benchWords(name: string, count: number, dry: number): string {
  if (count === 0) return `${name} — a clear bench`;
  const pots = `${count} ${count === 1 ? "pot" : "pots"}`;
  return dry > 0 ? `${name} — ${pots}, ${dry} dry` : `${name} — ${pots}`;
}

/**
 * The side bench's words: the member's own private pots, by state and only by
 * state. Nothing a private task says ever reaches this string — three counts
 * and the glasshouse's own three words for them.
 */
export function mineWords(mine: MinePots): string {
  const parts = [
    mine.seed > 0 ? `${mine.seed} ${mine.seed === 1 ? "seed" : "seeds"}` : null,
    mine.sprout > 0 ? `${mine.sprout} ${mine.sprout === 1 ? "sprout" : "sprouts"}` : null,
    mine.bloom > 0 ? `${mine.bloom} harvested this week` : null,
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? "Your own bench — clear" : `Your own bench — ${parts.join(", ")}`;
}

/** The pots the side bench stands: up to the cap per state, in the glasshouse's own order. Pure. */
export function minePots(mine: MinePots, cap = GLASSHOUSE_MINE_CAP): GlassPotState[] {
  return ([["seed", mine.seed], ["sprout", mine.sprout], ["bloom", mine.bloom]] as const)
    .flatMap(([state, count]) => Array.from({ length: Math.min(cap, Math.max(0, count)) }, () => state));
}

const PHONE_ROOM: Pose = { target: [0.7, 0.88, -0.95], r: 3.4, theta: 0.12, phi: 1.315 };
const DESKTOP_ROOM: Pose = { target: [0.35, 0.88, -0.95], r: 4.05, theta: 0.09, phi: 1.305 };

export function glasshousePoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "glasshouse:phone": PHONE_ROOM,
    "glasshouse:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.1, -0.6], r: 7.4, theta: 0, phi: 1.05 },
    "sky:desktop": { target: [0, 1.15, -0.6], r: 8.2, theta: 0.24, phi: 1.02 },
    // The door frieze: the front bench close and level, for the band above an open tool.
    "door:phone": { target: [0, 0.86, 0.62], r: 2.1, theta: 0.02, phi: 1.31 },
    "door:desktop": { target: [0, 0.86, 0.62], r: 2.3, theta: 0.05, phi: 1.31 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 5) * 0.6, -0.6, 0.6);
    const close = anchor.zone === "pot" ? 1.6 : anchor.zone === "stair" ? 2.6 : 2.2;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.55, y), z], r: close, theta, phi: 1.22 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.55, y), z], r: close + 0.4, theta: theta + 0.18, phi: 1.16 };
  }
  return poses;
}

export type GlasshouseSceneReading = { glasshouse: GlasshouseReading | null };

/** Narrows whatever the shell hands over to the glasshouse's own rows. */
export function readGlasshouseReading(value: unknown): GlasshouseSceneReading {
  if (!value || typeof value !== "object") return { glasshouse: null };
  const source = value as { glasshouse?: Partial<GlasshouseReading> & GlasshouseReading };
  const glasshouse = source.glasshouse ?? null;
  if (!glasshouse) return { glasshouse: null };
  // A reading from before the side bench existed stands an empty one, never a broken room.
  return { glasshouse: glasshouse.mine ? glasshouse : { ...glasshouse, mine: EMPTY_GLASSHOUSE_READING.mine } };
}

export type GlasshouseOptions = {
  dressing: GlasshouseDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createGlasshouse(scene: THREE.Scene, options: GlasshouseOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";
  const composition: Composition = options.composition ?? "desktop";

  const group = new THREE.Group();
  group.name = "glasshouse";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra }));

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

  const contacts = track(createContactShadows({ ink: dressing.paperInk }));
  const { halfWidth, halfDepth, plinth, ridge } = GLASSHOUSE_LAYOUT;

  // ── The floor: a gravel bed with a brick path down the middle ─────────────
  const gravel = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, halfDepth * 2)), mat(dressing.gravel, { roughness: 1 })), false, true);
  gravel.rotation.x = -Math.PI / 2; gravel.name = "glasshouse-gravel"; group.add(gravel);
  const path = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(1.2, halfDepth * 2)), mat(dressing.path, { roughness: 0.96 })), false, true);
  path.rotation.x = -Math.PI / 2; path.position.y = 0.012; path.name = "glasshouse-path"; group.add(path);

  // ── The brick plinth: four low walls with a course line ───────────────────
  const plinthWalls = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2 + 0.24, plinth, 0.24), 0, plinth / 2, -halfDepth),
    placed(new THREE.BoxGeometry(halfWidth * 2 + 0.24, plinth, 0.24), 0, plinth / 2, halfDepth),
    placed(new THREE.BoxGeometry(0.24, plinth, halfDepth * 2), -halfWidth, plinth / 2, 0),
    placed(new THREE.BoxGeometry(0.24, plinth, halfDepth * 2), halfWidth, plinth / 2, 0),
  ], mat(dressing.brick, { roughness: 0.94 }));
  shadowed(plinthWalls, false, true); plinthWalls.name = "glasshouse-plinth"; group.add(plinthWalls);
  const course = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2 + 0.3, 0.05, 0.28), 0, plinth, -halfDepth),
    placed(new THREE.BoxGeometry(halfWidth * 2 + 0.3, 0.05, 0.28), 0, plinth, halfDepth),
    placed(new THREE.BoxGeometry(0.28, 0.05, halfDepth * 2), -halfWidth, plinth, 0),
    placed(new THREE.BoxGeometry(0.28, 0.05, halfDepth * 2), halfWidth, plinth, 0),
  ], mat(dressing.brickJoint, { roughness: 0.9 }));
  course.name = "glasshouse-course"; group.add(course);

  // ── The frame: ribs every 1.05 along x, rising from the plinth to the ridge ──
  const ribs: THREE.BufferGeometry[] = [];
  const ribCount = 7;
  for (let i = 0; i < ribCount; i++) {
    const x = -halfWidth + (i / (ribCount - 1)) * halfWidth * 2;
    // One rafter per rib, on the north pitch only: the south pitch — the half the
    // eye stands under — is open, the way the tower's wall opens toward the gap.
    // A rafter an inch from the lens is a grey wall across the whole frame.
    const rafterLength = Math.hypot(halfDepth, ridge - plinth);
    const pitch = Math.atan2(halfDepth, ridge - plinth);
    ribs.push(placed(new THREE.BoxGeometry(0.045, rafterLength, 0.045), x, (plinth + ridge) / 2, -halfDepth / 2, [-pitch, 0, 0]));
  }
  const frame = merged(ribs, mat(dressing.ridge, { roughness: 0.9 }));
  shadowed(frame, false, false); frame.name = "glasshouse-frame"; group.add(frame);
  const ridgeBeam = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(halfWidth * 2 + 0.2, 0.1, 0.12)), mat(dressing.ridge, { roughness: 0.7 })), false, false);
  ridgeBeam.position.y = ridge; ridgeBeam.name = "glasshouse-ridge"; group.add(ridgeBeam);

  // ── The glass: two roof planes and four wall bands, faint, never blocking the sun ──
  const glassMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.glass, transparent: true, opacity: 0.16, roughness: 0.12, metalness: 0.02, side: THREE.DoubleSide, depthWrite: false }));
  const roofLength = Math.hypot(halfDepth, ridge - plinth);
  {
    const pane = new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, roofLength)), glassMaterial);
    pane.rotation.x = -(Math.PI / 2 - Math.atan2(ridge - plinth, halfDepth));
    pane.position.set(0, (plinth + ridge) / 2, -halfDepth / 2);
    pane.renderOrder = 4;
    pane.name = "glasshouse-glass"; group.add(pane);
  }
  const wallGlass = merged([
    placed(new THREE.PlaneGeometry(halfWidth * 2, ridge * 0.42), 0, plinth + 0.5, -halfDepth),
    placed(new THREE.PlaneGeometry(halfDepth * 2, ridge * 0.42), -halfWidth, plinth + 0.5, 0, [0, Math.PI / 2, 0]),
    placed(new THREE.PlaneGeometry(halfDepth * 2, ridge * 0.42), halfWidth, plinth + 0.5, 0, [0, Math.PI / 2, 0]),
  ], glassMaterial);
  wallGlass.renderOrder = 4; wallGlass.name = "glasshouse-wall-glass"; group.add(wallGlass);

  // The day pouring in: a broad, faint wash under the south roof.
  const daylight = new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 1.7, halfDepth * 1.5)), track(new THREE.MeshBasicMaterial({ color: dressing.glassLight, transparent: true, opacity: 0.07, depthWrite: false })));
  daylight.rotation.x = -Math.PI / 2; daylight.position.set(0, 0.02, 0.4); daylight.renderOrder = 2; group.add(daylight);

  // Its own light: a warm hemisphere — a glasshouse is the island's brightest room.
  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.55);
  group.add(hemi);

  // ── The benches ───────────────────────────────────────────────────────────
  const benchMaterial = mat(dressing.bench, { roughness: 0.82 });
  const legMaterial = mat(dressing.benchLeg, { roughness: 0.86 });
  for (const [index, bench] of GLASSHOUSE_LAYOUT.benches.entries()) {
    const top = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(GLASSHOUSE_LAYOUT.benchLength, 0.08, GLASSHOUSE_LAYOUT.benchDepth)), benchMaterial));
    top.position.set(0, bench.top - 0.04, bench.z); top.name = `bench-${index}`; top.userData.anchor = `bench:${index}`; group.add(top);
    const legs = merged([
      placed(new THREE.BoxGeometry(0.1, bench.top - 0.08, 0.1), -GLASSHOUSE_LAYOUT.benchLength / 2 + 0.3, (bench.top - 0.08) / 2, bench.z),
      placed(new THREE.BoxGeometry(0.1, bench.top - 0.08, 0.1), GLASSHOUSE_LAYOUT.benchLength / 2 - 0.3, (bench.top - 0.08) / 2, bench.z),
      placed(new THREE.BoxGeometry(0.1, bench.top - 0.08, 0.1), 0, (bench.top - 0.08) / 2, bench.z),
    ], legMaterial);
    shadowed(legs, false, true); legs.name = `bench-legs-${index}`; group.add(legs);
    contacts.disc(0, bench.z, GLASSHOUSE_LAYOUT.benchLength * 0.36, 0.5, group);
  }

  // ── The perennial bed (left wall) and the harvest shelf (right wall) ──────
  const bed = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.9, 0.34, 4.4)), mat(dressing.brick, { roughness: 0.94 })));
  bed.position.set(GLASSHOUSE_LAYOUT.bedX, 0.17, -0.4); bed.name = "perennial-bed"; bed.userData.anchor = "perennials"; group.add(bed);
  const bedEarth = new THREE.Mesh(track(new THREE.BoxGeometry(0.74, 0.05, 4.24)), mat(dressing.earth, { roughness: 1 }));
  bedEarth.position.set(GLASSHOUSE_LAYOUT.bedX, 0.35, -0.4); bedEarth.userData.anchor = "perennials"; group.add(bedEarth);

  const shelf = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.6, 0.06, 3.4)), mat(dressing.shelf, { roughness: 0.8 })));
  shelf.position.set(GLASSHOUSE_LAYOUT.shelfX, GLASSHOUSE_LAYOUT.shelfY, -0.7); shelf.name = "harvest-shelf"; shelf.userData.anchor = "harvest"; group.add(shelf);
  const shelfBrackets = merged([
    placed(new THREE.BoxGeometry(0.5, 0.05, 0.08), GLASSHOUSE_LAYOUT.shelfX + 0.05, GLASSHOUSE_LAYOUT.shelfY - 0.2, -2.1, [0, 0, 0.5]),
    placed(new THREE.BoxGeometry(0.5, 0.05, 0.08), GLASSHOUSE_LAYOUT.shelfX + 0.05, GLASSHOUSE_LAYOUT.shelfY - 0.2, 0.7, [0, 0, 0.5]),
  ], legMaterial);
  shelfBrackets.name = "harvest-brackets"; group.add(shelfBrackets);

  // ── The side bench: the member's own private pots, under the near pane ────
  // A small bench of its own, along the right wall in front of the harvest shelf.
  // It stands counts, by state, and carries no word of what any of them is.
  const mineBench = GLASSHOUSE_LAYOUT.mine;
  const mineTop = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(mineBench.depth, 0.07, mineBench.length)), benchMaterial));
  mineTop.position.set(mineBench.x, mineBench.top - 0.035, mineBench.z);
  mineTop.name = "mine-bench"; mineTop.userData.anchor = "mine"; group.add(mineTop);
  const mineLegs = merged([
    placed(new THREE.BoxGeometry(0.08, mineBench.top - 0.07, 0.08), mineBench.x, (mineBench.top - 0.07) / 2, mineBench.z - mineBench.length / 2 + 0.16),
    placed(new THREE.BoxGeometry(0.08, mineBench.top - 0.07, 0.08), mineBench.x, (mineBench.top - 0.07) / 2, mineBench.z + mineBench.length / 2 - 0.16),
  ], legMaterial);
  shadowed(mineLegs, false, true); mineLegs.name = "mine-bench-legs"; mineLegs.userData.anchor = "mine"; group.add(mineLegs);
  contacts.disc(mineBench.x, mineBench.z, mineBench.length * 0.32, 0.5, group);

  // ── The watering can: out only while a pot is dry. Brass, kind, no badge. ──
  const can = new THREE.Group();
  can.name = "watering-can";
  can.userData.anchor = "can";
  const canBody = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.16, 0.19, 0.3, 12)), mat(dressing.brass, { roughness: 0.4, metalness: 0.55 })));
  canBody.position.y = 0.15; can.add(canBody);
  const spout = new THREE.Mesh(track(new THREE.CylinderGeometry(0.028, 0.04, 0.34, 8)), mat(dressing.brass, { roughness: 0.4, metalness: 0.55 }));
  spout.rotation.z = 0.9; spout.position.set(0.22, 0.24, 0); can.add(spout);
  const handle = new THREE.Mesh(track(new THREE.TorusGeometry(0.11, 0.02, 6, 14, Math.PI)), mat(dressing.brass, { roughness: 0.4, metalness: 0.55 }));
  handle.position.set(-0.13, 0.3, 0); handle.rotation.z = -0.5; can.add(handle);
  can.position.set(GLASSHOUSE_LAYOUT.can[0], 0, GLASSHOUSE_LAYOUT.can[2]);
  can.visible = false;
  group.add(can);
  contacts.disc(GLASSHOUSE_LAYOUT.can[0], GLASSHOUSE_LAYOUT.can[2], 0.24, 0.6, group);

  // ── The garden door back to the Court: a brick pier and a timber gate ─────
  const doorPier = merged([
    placed(new THREE.BoxGeometry(0.26, 1.5, 0.26), GLASSHOUSE_LAYOUT.door[0] - 0.55, 0.75, GLASSHOUSE_LAYOUT.door[2]),
    placed(new THREE.BoxGeometry(0.26, 1.5, 0.26), GLASSHOUSE_LAYOUT.door[0] + 0.55, 0.75, GLASSHOUSE_LAYOUT.door[2]),
    placed(new THREE.BoxGeometry(1.4, 0.16, 0.3), GLASSHOUSE_LAYOUT.door[0], 1.56, GLASSHOUSE_LAYOUT.door[2]),
  ], mat(dressing.brick, { roughness: 0.94 }));
  shadowed(doorPier, full, true); doorPier.name = "garden-door"; doorPier.userData.anchor = "garden-door"; group.add(doorPier);

  // ── Plates: one per bench, the harvest shelf's, and the beds' (the Calendar door) ──
  const finishNow = (): PlateFinish => plateFinish("current");
  const benchPlates = GLASSHOUSE_LAYOUT.benches.map((bench, index) => {
    const plate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.05, 0.18));
    plate.mesh.position.set(0.4, bench.top - 0.11, bench.z + GLASSHOUSE_LAYOUT.benchDepth / 2 - 0.02);
    plate.mesh.rotation.x = -0.3;
    plate.mesh.userData.anchor = `bench:${index}`;
    group.add(plate.mesh);
    return plate;
  });
  const harvestPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.3, 0.22));
  harvestPlate.mesh.position.set(GLASSHOUSE_LAYOUT.shelfX - 0.42, GLASSHOUSE_LAYOUT.shelfY + 0.24, -0.7);
  harvestPlate.mesh.rotation.y = -Math.PI / 2;
  harvestPlate.mesh.userData.anchor = "harvest";
  group.add(harvestPlate.mesh);
  const minePlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.3, 0.2));
  minePlate.mesh.position.set(mineBench.x - 0.28, mineBench.top - 0.1, mineBench.z);
  minePlate.mesh.rotation.y = -Math.PI / 2;
  minePlate.mesh.rotation.x = -0.3;
  minePlate.mesh.userData.anchor = "mine";
  group.add(minePlate.mesh);
  const bedsPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.6, 0.26));
  bedsPlate.mesh.position.set(0, 1.85, -halfDepth + 0.08);
  bedsPlate.mesh.userData.anchor = "beds";
  bedsPlate.set("The beds — the year around the glasshouse", finishNow());
  group.add(bedsPlate.mesh);

  // ── The pots ──────────────────────────────────────────────────────────────
  type StandingPot = { pot: GlassPot; group: THREE.Group; dispose(): void };
  let standing: StandingPot[] = [];
  let perennialMeshes: { dispose(): void; mesh: THREE.Object3D }[] = [];
  let harvestMeshes: { dispose(): void; mesh: THREE.Object3D }[] = [];
  let mineMeshes: { dispose(): void; mesh: THREE.Object3D }[] = [];
  let view: GlasshouseReading = EMPTY_GLASSHOUSE_READING;

  const buildPlant = (host: THREE.Group, state: "seed" | "sprout" | "bloom", dry: boolean, y: number): void => {
    if (state === "seed") {
      const mound = new THREE.Mesh(track(new THREE.SphereGeometry(0.05, 8, 6)), mat(dry ? dressing.earthDry : dressing.earth, { roughness: 1 }));
      mound.scale.y = 0.5; mound.position.y = y + 0.01; host.add(mound);
      return;
    }
    const stemMaterial = mat(dry ? dressing.earthDry : dressing.stem, { roughness: 0.8 });
    const leafMaterial = mat(dry ? dressing.earthDry : dressing.leaf, { roughness: 0.8 });
    const stem = new THREE.Mesh(track(new THREE.CylinderGeometry(0.014, 0.02, state === "bloom" ? 0.34 : 0.22, 6)), stemMaterial);
    stem.position.y = y + (state === "bloom" ? 0.17 : 0.11);
    if (dry) stem.rotation.z = 0.5;
    host.add(stem);
    for (const side of [-1, 1] as const) {
      const leaf = new THREE.Mesh(track(new THREE.SphereGeometry(0.055, 8, 6)), leafMaterial);
      leaf.scale.set(1.4, 0.5, 0.8);
      leaf.position.set(side * 0.07, y + (state === "bloom" ? 0.2 : 0.14), 0);
      if (dry) leaf.position.y -= 0.05;
      host.add(leaf);
    }
    if (state === "bloom") {
      const petals = new THREE.Mesh(track(new THREE.TorusGeometry(0.055, 0.03, 6, 10)), mat(dressing.petal, { roughness: 0.7 }));
      petals.rotation.x = Math.PI / 2; petals.position.y = y + 0.36; host.add(petals);
      const heart = new THREE.Mesh(track(new THREE.SphereGeometry(0.032, 8, 6)), mat(dressing.heart, { roughness: 0.8 }));
      heart.position.y = y + 0.36; host.add(heart);
    }
  };

  const buildPotMesh = (pot: GlassPot | null, position: Vec3, state: "seed" | "sprout" | "bloom", dry: boolean): { group: THREE.Group; dispose(): void } => {
    const host = new THREE.Group();
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(item: T): T => { own.push(item); return item; };
    const clay = new THREE.MeshStandardMaterial({ color: dressing.pot, roughness: 0.92 });
    keep(clay);
    const body = shadowed(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.14, 0.1, 0.24, 12)), clay));
    body.position.y = 0.12; host.add(body);
    const rimMaterial = keep(new THREE.MeshStandardMaterial({ color: dressing.potRim, roughness: 0.9 }));
    const rim = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.155, 0.15, 0.05, 12)), rimMaterial);
    rim.position.y = 0.245; host.add(rim);
    const earth = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.125, 0.125, 0.02, 12)), keep(new THREE.MeshStandardMaterial({ color: dry ? dressing.earthDry : dressing.earth, roughness: 1 })));
    earth.position.y = 0.26; host.add(earth);
    buildPlant(host, state, dry, 0.26);
    if (pot) {
      // The paper tag leaning on the pot, threaded pine, copper, or twisted.
      const tag = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.12, 0.08)), keep(new THREE.MeshStandardMaterial({ color: dressing.paper, roughness: 0.9, side: THREE.DoubleSide })));
      tag.position.set(0.1, 0.12, 0.13); tag.rotation.set(-0.5, 0.4, 0); host.add(tag);
      const threads: { color: string; offset: number }[] =
        pot.thread === "both" ? [{ color: dressing.threadPine, offset: -0.012 }, { color: dressing.threadCopper, offset: 0.012 }]
        : pot.thread === "mine" ? [{ color: dressing.threadCopper, offset: 0 }]
        : pot.thread === "partner" ? [{ color: dressing.threadPine, offset: 0 }]
        : [];
      for (const { color, offset } of threads) {
        const thread = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 5)), keep(new THREE.MeshStandardMaterial({ color, roughness: 0.85 })));
        thread.position.set(0.06 + offset, 0.2, 0.1); thread.rotation.z = 0.7; host.add(thread);
      }
      if (pot.staked) {
        const stake = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 6)), keep(new THREE.MeshStandardMaterial({ color: dressing.brass, roughness: 0.4, metalness: 0.5 })));
        stake.position.set(-0.09, 0.36, -0.05); host.add(stake);
      }
      if (pot.cat) {
        // The little cat on the tag: two cones for ears on a bead — a sign, not a sculpture.
        const bead = new THREE.Mesh(keep(new THREE.SphereGeometry(0.028, 8, 6)), keep(new THREE.MeshStandardMaterial({ color: dressing.brass, roughness: 0.5, metalness: 0.4 })));
        bead.position.set(0.13, 0.19, 0.14); host.add(bead);
        for (const side of [-1, 1] as const) {
          const ear = new THREE.Mesh(keep(new THREE.ConeGeometry(0.011, 0.024, 5)), keep(new THREE.MeshStandardMaterial({ color: dressing.brass, roughness: 0.5, metalness: 0.4 })));
          ear.position.set(0.13 + side * 0.016, 0.215, 0.14); host.add(ear);
        }
      }
    }
    host.position.set(position[0], position[1], position[2]);
    if (pot) {
      host.userData.anchor = `pot:${pot.key}`;
      host.traverse((node) => { node.userData.anchor = `pot:${pot.key}`; });
    }
    group.add(host);
    return { group: host, dispose() { host.removeFromParent(); for (const item of own) item.dispose(); } };
  };

  // A clear front bench is kept, not bare: a seed tray and a trowel wait on it,
  // and they step aside the moment a pot arrives.
  const tidy = new THREE.Group();
  tidy.name = "seed-tray";
  {
    const tray = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.05, 0.3)), mat(dressing.benchLeg, { roughness: 0.9 })));
    tray.position.y = 0.025; tidy.add(tray);
    for (let cell = 0; cell < 6; cell++) {
      const soil = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 8)), mat(dressing.earth, { roughness: 1 }));
      soil.position.set(-0.16 + (cell % 3) * 0.16, 0.05, cell < 3 ? -0.07 : 0.07);
      tidy.add(soil);
    }
    const blade = new THREE.Mesh(track(new THREE.ConeGeometry(0.045, 0.16, 6)), mat(dressing.brass, { roughness: 0.4, metalness: 0.5 }));
    blade.rotation.z = Math.PI / 2; blade.position.set(0.42, 0.03, 0.05); tidy.add(blade);
    const grip = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 0.02, 0.14, 6)), mat(dressing.benchLeg, { roughness: 0.85 }));
    grip.rotation.z = Math.PI / 2; grip.position.set(0.56, 0.03, 0.05); tidy.add(grip);
    tidy.position.set(-1.1, GLASSHOUSE_LAYOUT.benches[0].top, GLASSHOUSE_LAYOUT.benches[0].z);
    group.add(tidy);
  }

  const clearPots = (): void => {
    for (const row of standing) row.dispose();
    for (const row of perennialMeshes) row.dispose();
    for (const row of harvestMeshes) row.dispose();
    for (const row of mineMeshes) row.dispose();
    standing = []; perennialMeshes = []; harvestMeshes = []; mineMeshes = [];
  };

  const layOut = (): void => {
    clearPots();
    const rows = benchRows(view.pots);
    for (const [benchIndex, bench] of GLASSHOUSE_LAYOUT.benches.entries()) {
      const row = rows[benchIndex]!;
      row.forEach((pot, index) => {
        const x = potSpot(index, row.length, composition);
        const built = buildPotMesh(pot, [x, bench.top, bench.z], pot.state, pot.dry);
        standing.push({ pot, group: built.group, dispose: built.dispose });
      });
      const dryOnBench = row.filter((pot) => pot.dry).length;
      benchPlates[benchIndex]!.set(benchWords(bench.name, row.length, dryOnBench), finishNow());
    }
    // The harvest shelf: up to six blooming pots, one per harvest, the rest in the words.
    const blooms = Math.min(6, view.harvested);
    for (let i = 0; i < blooms; i++) {
      const z = -0.7 + (i - (blooms - 1) / 2) * 0.5;
      const built = buildPotMesh(null, [GLASSHOUSE_LAYOUT.shelfX, GLASSHOUSE_LAYOUT.shelfY + 0.03, z], "bloom", false);
      built.group.userData.anchor = "harvest";
      harvestMeshes.push({ mesh: built.group, dispose: built.dispose });
    }
    harvestPlate.set(view.harvested === 0 ? "The harvest shelf — nothing yet this week" : `Harvested — ${view.harvested} this week`, finishNow());
    // The side bench: one pot per private task, to the cap, by state. `buildPotMesh(null, …)`
    // stands a pot with no tag, no thread and no stake — there is nothing about it to say.
    const ownPots = minePots(view.mine);
    ownPots.forEach((state, index) => {
      const z = mineBench.z + (index - (ownPots.length - 1) / 2) * Math.min(0.42, (mineBench.length - 0.4) / Math.max(1, ownPots.length - 1));
      const built = buildPotMesh(null, [mineBench.x, mineBench.top, z], state, false);
      built.group.userData.anchor = "mine";
      built.group.traverse((node) => { node.userData.anchor = "mine"; });
      mineMeshes.push({ mesh: built.group, dispose: built.dispose });
    });
    minePlate.set(mineWords(view.mine), finishNow());
    // Perennials in the long bed.
    view.perennials.slice(0, 6).forEach((perennial, index) => {
      const z = -2.2 + index * 0.75;
      const host = new THREE.Group();
      host.position.set(GLASSHOUSE_LAYOUT.bedX, 0.37, z);
      host.userData.anchor = `perennial:${perennial.key}`;
      group.add(host);
      buildPlant(host, "sprout", false, 0);
      host.traverse((node) => { node.userData.anchor = `perennial:${perennial.key}`; });
      perennialMeshes.push({ mesh: host, dispose() { host.removeFromParent(); } });
    });
    can.visible = view.dry > 0;
    tidy.visible = benchRows(view.pots)[0].length === 0;
  };

  const signatureOf = (reading: GlasshouseReading): string =>
    [reading.harvested, reading.dry, reading.overflow, reading.mine.seed, reading.mine.sprout, reading.mine.bloom, reading.pots.map((pot) => `${pot.key}:${pot.state}:${pot.dry}:${pot.bench}:${pot.thread}:${pot.staked}:${pot.cat}`).join("|"), reading.perennials.map((p) => p.key).join("|")].join("§");
  let signature = "";

  function update(value: unknown): void {
    const next = readGlasshouseReading(value).glasshouse ?? EMPTY_GLASSHOUSE_READING;
    const nextSignature = signatureOf(next);
    if (nextSignature === signature) return;
    view = next; signature = nextSignature;
    layOut();
  }
  update(options.reading ?? null);

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const potWords = (pot: GlassPot): string => {
    const plant = pot.state === "seed" ? "a seed" : "a sprout";
    const water = pot.dry ? ", dry — the can is out" : "";
    const whose = pot.thread === "both" ? "both of you" : pot.thread === "mine" ? "yours" : pot.thread === "partner" ? "the partner's" : "nobody's yet";
    return `${pot.title} — ${plant}, ${whose}${water}. Open the steps.`;
  };

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = standing.map(({ pot, group: host }) => ({
      id: `pot:${pot.key}`,
      position: at(host.position.x, host.position.y + 0.3, host.position.z),
      zone: "pot",
      label: potWords(pot),
      door: { target: "planner", object: pot.key },
    }));
    rows.push({ id: "beds", position: at(0, 1.85, -halfDepth + 0.2), zone: "bed", label: "The beds around the glasshouse — unfold the Calendar.", door: { target: "calendar" } });
    rows.push({ id: "harvest", position: at(GLASSHOUSE_LAYOUT.shelfX, GLASSHOUSE_LAYOUT.shelfY + 0.2, -0.7), zone: "shelf", label: view.harvested === 0 ? "The harvest shelf — nothing yet this week. Open the steps." : `The harvest shelf — ${view.harvested} harvested this week. Open the steps.`, door: { target: "planner" } });
    if (view.perennials.length > 0) rows.push({ id: "perennials", position: at(GLASSHOUSE_LAYOUT.bedX, 0.6, -0.4), zone: "bed", label: `The long bed — ${view.perennials.length} ${view.perennials.length === 1 ? "perennial" : "perennials"}. Open the steps.`, door: { target: "planner" } });
    // Your own bench: counts, by state, and a door onto the planner. Never a title.
    rows.push({ id: "mine", position: at(mineBench.x, mineBench.top + 0.28, mineBench.z), zone: "bench", label: `${mineWords(view.mine)}. Yours alone. Open the steps.`, door: { target: "planner" } });
    rows.push({ id: "garden-door", position: at(GLASSHOUSE_LAYOUT.door[0], 1.0, GLASSHOUSE_LAYOUT.door[2] - 0.2), zone: "stair", label: "The garden door — back to the Court." });
    if (can.visible) rows.push({ id: "can", position: at(GLASSHOUSE_LAYOUT.can[0], 0.35, GLASSHOUSE_LAYOUT.can[2]), zone: "prop", label: `The watering can — ${view.dry} ${view.dry === 1 ? "pot is" : "pots are"} dry. Open the steps.`, door: { target: "planner" } });
    return rows;
  };

  const regionList = (): Region[] => {
    const rows: Region[] = standing.map(({ pot, group: host }) => ({
      id: `pot:${pot.key}`, group: "glasshouse", label: potWords(pot),
      box: box(host.position.x - 0.22, host.position.y - 0.05, host.position.z - 0.22, host.position.x + 0.22, host.position.y + 0.6, host.position.z + 0.22),
    }));
    rows.push({ id: "beds", group: "glasshouse", label: "The beds — unfold the Calendar", box: box(-1.2, 1.5, -halfDepth - 0.1, 1.2, 2.2, -halfDepth + 0.4) });
    rows.push({ id: "harvest", group: "glasshouse", label: "The harvest shelf", box: box(GLASSHOUSE_LAYOUT.shelfX - 0.5, GLASSHOUSE_LAYOUT.shelfY - 0.2, -2.4, GLASSHOUSE_LAYOUT.shelfX + 0.4, GLASSHOUSE_LAYOUT.shelfY + 0.7, 1.0) });
    rows.push({ id: "mine", group: "glasshouse", label: "Your own bench — yours alone", box: box(mineBench.x - 0.35, mineBench.top - 0.2, mineBench.z - mineBench.length / 2 - 0.1, mineBench.x + 0.3, mineBench.top + 0.65, mineBench.z + mineBench.length / 2 + 0.1) });
    rows.push({ id: "garden-door", group: "glasshouse", label: "The garden door — back to the Court", box: box(GLASSHOUSE_LAYOUT.door[0] - 0.8, 0, GLASSHOUSE_LAYOUT.door[2] - 0.4, GLASSHOUSE_LAYOUT.door[0] + 0.8, 1.7, GLASSHOUSE_LAYOUT.door[2] + 0.3) });
    if (view.perennials.length > 0) rows.push({ id: "perennials", group: "glasshouse", label: "The long bed of perennials", box: box(GLASSHOUSE_LAYOUT.bedX - 0.5, 0, -2.6, GLASSHOUSE_LAYOUT.bedX + 0.5, 0.8, 1.8) });
    if (can.visible) rows.push({ id: "can", group: "glasshouse", label: "The watering can", box: box(GLASSHOUSE_LAYOUT.can[0] - 0.3, 0, GLASSHOUSE_LAYOUT.can[2] - 0.3, GLASSHOUSE_LAYOUT.can[0] + 0.3, 0.6, GLASSHOUSE_LAYOUT.can[2] + 0.3) });
    return rows;
  };

  return {
    group,
    update,
    animate: () => false,
    dispose() {
      scene.remove(group);
      clearPots();
      for (const item of disposables) item.dispose();
    },
    anchors: anchorList,
    poses: () => glasshousePoses(anchorList()),
    regions: regionList,
  };
}

export const glasshousePlace: Place = registerPlace({
  id: "glasshouse",
  build(scene, dressing, reading, quality, context) {
    return createGlasshouse(scene, {
      dressing: glasshouseDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
