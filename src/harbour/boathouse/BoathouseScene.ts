import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { EMPTY_BOATHOUSE_READING, type BoathouseReading } from "../data/reading.ts";
import { boathouseDressingFrom, type BoathouseDressing } from "./dressing.ts";

/**
 * The Boathouse (LITTLE_HARBOUR_v2 §5) — Together, inside at last.
 *
 * One room over the water. The slip runs down the middle with a rowboat
 * floating in it; wishes hang as paper lanterns from the rafters, one lit
 * for each idea in the light; the Theatre is a sail hung on the back wall
 * with the projector on a crate aimed at it; the workbench holds the clay,
 * the writing desk holds the letters, and the memory shelf keeps the framed
 * compositions. Everything Codex built keeps its machinery — private drafts,
 * reviewed sharing, separate recollections, the three-memory reel — behind
 * its own door here. The room shows **counts, never contents**: a private
 * wish does not render in the other copy, so it does not render here either.
 *
 * Nothing here writes a wish, a memory, a letter or a moment. Every station
 * is a door (`onOpen`); the rooms behind them stay the rooms.
 */

export const BOATHOUSE_LAYOUT = {
  halfWidth: 3.6,
  halfDepth: 2.9,
  wallHeight: 2.5,
  ridge: 3.6,
  /** The slip: an opening of water down the middle, boat floating in it. */
  slip: { halfWidth: 0.85, fromZ: -0.4, toZ: 2.9 },
  boat: [0, 0, 1.1] as const,
  /** The sail on the back wall, the projector on its crate. */
  /** Hung clear of the wall strakes (which face at z −2.78) so nothing fights. */
  sail: [0.4, 1.5, -2.7] as const,
  projector: [0.4, 0, -0.9] as const,
  /** The workbench (left wall), the writing desk (right front), the memory shelf (right wall). */
  bench: [-3.0, 0, -1.2] as const,
  desk: [2.85, 0, 0.4] as const,
  shelfX: 3.45,
  shelfY: 1.5,
  /** Lanterns hang from the rafters over the deck. */
  lanternY: 2.35,
  /** The shore door back to the Court, front-left on the deck. */
  door: [-2.2, 0, 2.75] as const,
  /** The unlit lantern by the door: the one you take down to make a wish. */
  wishLantern: [-2.2, 2.05, 2.35] as const,
} as const;

/** How far a lantern hangs below the rafter its cord is nailed to. */
export const LANTERN_DROP = 0.63;

/** How far the newest lantern swings, and how long one swing takes. Gentle: a draught, not a wind. */
export const LANTERN_SWAY = { radians: 0.07, seconds: 4.2 } as const;

/** The newest lantern's tilt `t` seconds in. A slow sine — the same clock the frame policy hands every place. */
export function lanternSway(t: number): number {
  return Math.sin((t * 2 * Math.PI) / LANTERN_SWAY.seconds) * LANTERN_SWAY.radians;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A count in words that never shames an empty room: "nothing yet" is a state, not a fault. */
export function fewWords(count: number, one: string, many: string): string {
  return count === 0 ? `nothing yet` : `${count} ${count === 1 ? one : many}`;
}

/**
 * What the lanterns say. Counts, never contents: how many ideas are in the
 * light, and — when one has just gone up — that one has, and nothing of what
 * it is.
 */
export function lanternWords(wishes: number, hung: number): string {
  const lit = `The lanterns — ${fewWords(wishes, "idea in the light", "ideas in the light")}`;
  return hung > 0 ? `${lit}; a new wish was hung this week` : lit;
}

// Stand on the deck's west corner looking down the slip: the water and the
// rowboat in the middle, the sail on the back wall, lanterns overhead.
const PHONE_ROOM: Pose = { target: [0.3, 0.65, -0.1], r: 3.7, theta: -0.72, phi: 1.28 };
const DESKTOP_ROOM: Pose = { target: [0.4, 0.6, 0.1], r: 3.93, theta: -0.879, phi: 1.274 };

export function boathousePoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "boathouse:phone": PHONE_ROOM,
    "boathouse:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.2, -0.4], r: 6.2, theta: 0, phi: 1.05 },
    "sky:desktop": { target: [0, 1.25, -0.4], r: 6.8, theta: 0.2, phi: 1.02 },
    // The door frieze: the slip and the sail, for the band above an open tool.
    "door:phone": { target: [0, 1.05, -1.2], r: 2.0, theta: 0.02, phi: 1.3 },
    "door:desktop": { target: [0.1, 1.05, -1.2], r: 2.2, theta: 0.05, phi: 1.3 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 4.5) * 0.6, -0.65, 0.65);
    const close = anchor.zone === "stair" ? 2.4 : 1.8;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.6, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.6, y), z], r: close + 0.4, theta: theta + 0.16, phi: 1.14 };
  }
  return poses;
}

export type BoathouseSceneReading = { boathouse: BoathouseReading | null; partnerName: string | null };

/** Narrows whatever the shell hands over to the boathouse's own counts. */
export function readBoathouseReading(value: unknown): BoathouseSceneReading {
  if (!value || typeof value !== "object") return { boathouse: null, partnerName: null };
  const source = value as { boathouse?: BoathouseReading; partner?: { name?: string } | null };
  return { boathouse: source.boathouse ?? null, partnerName: source.partner?.name ?? null };
}

export type BoathouseOptions = {
  dressing: BoathouseDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createBoathouse(scene: THREE.Scene, options: BoathouseOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "boathouse";
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
  const { halfWidth, halfDepth, wallHeight, ridge, slip } = BOATHOUSE_LAYOUT;

  // ── The deck, with the slip of water cut down the middle toward the eye ───
  const deckMaterial = mat(dressing.deck, { roughness: 0.94 });
  const deckSideWidth = halfWidth - slip.halfWidth;
  const deck = merged([
    // Two side decks along the slip, and a full head deck behind it.
    placed(new THREE.BoxGeometry(deckSideWidth, 0.12, slip.toZ - slip.fromZ), -(slip.halfWidth + deckSideWidth / 2), -0.06, (slip.fromZ + slip.toZ) / 2),
    placed(new THREE.BoxGeometry(deckSideWidth, 0.12, slip.toZ - slip.fromZ), slip.halfWidth + deckSideWidth / 2, -0.06, (slip.fromZ + slip.toZ) / 2),
    placed(new THREE.BoxGeometry(halfWidth * 2, 0.12, slip.fromZ + halfDepth), 0, -0.06, (slip.fromZ - halfDepth) / 2),
  ], deckMaterial);
  shadowed(deck, false, true); deck.name = "boathouse-deck"; group.add(deck);
  // The water in the slip, dark and still, a lighter surface film on it.
  const water = new THREE.Mesh(track(new THREE.PlaneGeometry(slip.halfWidth * 2 - 0.06, slip.toZ - slip.fromZ)), mat(dressing.waterDeep, { roughness: 0.75, metalness: 0.05 }));
  // The island's terrace sits at −0.05 under every room, so the water must float above it.
  water.rotation.x = -Math.PI / 2; water.position.set(0, -0.03, (slip.fromZ + slip.toZ) / 2); water.name = "boathouse-water"; group.add(water);
  const film = new THREE.Mesh(track(new THREE.PlaneGeometry(slip.halfWidth * 2 - 0.1, slip.toZ - slip.fromZ - 0.1)), track(new THREE.MeshStandardMaterial({ color: dressing.water, roughness: 0.5, metalness: 0.05, transparent: true, opacity: 0.55 })));
  film.rotation.x = -Math.PI / 2; film.position.set(0, -0.012, (slip.fromZ + slip.toZ) / 2); film.name = "boathouse-film"; group.add(film);

  // ── The walls, plank on frame, and the gable rafters overhead ─────────────
  const walls = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.18), 0, wallHeight / 2, -halfDepth),
    placed(new THREE.BoxGeometry(0.18, wallHeight, halfDepth * 2), -halfWidth, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(0.18, wallHeight, halfDepth * 2), halfWidth, wallHeight / 2, 0),
  ], mat(dressing.plank, { roughness: 0.94 }));
  shadowed(walls, false, true); walls.name = "boathouse-walls"; group.add(walls);
  const strakes = merged(
    [0.5, 1.0, 1.5, 2.0].flatMap((y) => [
      placed(new THREE.BoxGeometry(halfWidth * 2, 0.03, 0.02), 0, y, -halfDepth + 0.11),
      placed(new THREE.BoxGeometry(0.02, 0.03, halfDepth * 2), -halfWidth + 0.11, y, 0),
      placed(new THREE.BoxGeometry(0.02, 0.03, halfDepth * 2), halfWidth - 0.11, y, 0),
    ]),
    mat(dressing.frame, { roughness: 0.9 }),
  );
  strakes.name = "boathouse-strakes"; group.add(strakes);
  const rafters: THREE.BufferGeometry[] = [];
  const rafterLength = Math.hypot(halfWidth, ridge - wallHeight);
  const pitch = Math.atan2(halfWidth, ridge - wallHeight);
  for (let i = 0; i < 5; i++) {
    const z = -halfDepth + 0.4 + (i / 4) * (halfDepth * 2 - 0.8);
    for (const side of [-1, 1] as const) {
      rafters.push(placed(new THREE.BoxGeometry(0.08, rafterLength, 0.08), (side * halfWidth) / 2, (wallHeight + ridge) / 2, z, [0, 0, side * pitch]));
    }
  }
  rafters.push(placed(new THREE.BoxGeometry(0.1, 0.12, halfDepth * 2), 0, ridge, 0));
  const roofFrame = merged(rafters, mat(dressing.frame, { roughness: 0.88 }));
  roofFrame.name = "boathouse-rafters"; group.add(roofFrame);

  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.5);
  group.add(hemi);

  // ── The rowboat, floating in the slip ────────────────────────────────────
  const boat = new THREE.Group();
  boat.name = "boathouse-boat";
  {
    // A stretched open dish riding low in the water — the hull's rim stays dry, its belly dips.
    const hullMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.hull, roughness: 0.8, side: THREE.DoubleSide }));
    const hull = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.5, 12, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), hullMaterial));
    hull.scale.set(0.8, 0.6, 1.9); hull.position.y = 0.16; boat.add(hull);
    const gunwale = new THREE.Mesh(track(new THREE.TorusGeometry(0.46, 0.035, 6, 16)), mat(dressing.hullTrim, { roughness: 0.7 }));
    gunwale.scale.set(0.85, 2.0, 1); gunwale.rotation.x = Math.PI / 2; gunwale.position.y = 0.16; boat.add(gunwale);
    const thwart = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.04, 0.16)), mat(dressing.frame, { roughness: 0.85 }));
    thwart.position.y = 0.06; boat.add(thwart);
    boat.position.set(BOATHOUSE_LAYOUT.boat[0], 0, BOATHOUSE_LAYOUT.boat[2]);
    boat.userData.anchor = "boat";
    boat.traverse((node) => { node.userData.anchor = "boat"; });
    group.add(boat);
  }

  // ── The Theatre: the sail on the back wall, the projector on its crate ────
  const [sx, sy, sz] = BOATHOUSE_LAYOUT.sail;
  const sail = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(2.1, 1.5)), mat(dressing.sail, { roughness: 0.95 })), false, true);
  sail.position.set(sx, sy, sz); sail.name = "boathouse-sail"; sail.userData.anchor = "projector"; group.add(sail);
  const [px, , pz] = BOATHOUSE_LAYOUT.projector;
  const crate = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.5, 0.5)), mat(dressing.frame, { roughness: 0.9 })));
  crate.position.set(px, 0.25, pz); crate.userData.anchor = "projector"; group.add(crate);
  const projector = merged([
    placed(new THREE.BoxGeometry(0.3, 0.2, 0.24), px, 0.6, pz),
    placed(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), px, 0.6, pz - 0.18, [Math.PI / 2, 0, 0]),
    placed(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), px - 0.08, 0.78, pz + 0.04, [0, 0, Math.PI / 2]),
    placed(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 10), px + 0.08, 0.78, pz + 0.04, [0, 0, Math.PI / 2]),
  ], mat(dressing.brass, { roughness: 0.4, metalness: 0.5 }));
  projector.userData.anchor = "projector"; projector.name = "boathouse-projector"; group.add(projector);
  // The beam: a faint cone from lens to sail.
  const beamLength = Math.hypot(sz - pz, sy - 0.6);
  const beam = new THREE.Mesh(track(new THREE.CylinderGeometry(0.05, 0.48, beamLength, 10, 1, true)), track(new THREE.MeshBasicMaterial({ color: dressing.beam, transparent: true, opacity: 0.06, depthWrite: false, side: THREE.DoubleSide })));
  beam.position.set((px + sx) / 2, (0.6 + sy) / 2, (pz + sz) / 2);
  beam.rotation.x = Math.PI / 2 - Math.atan2(sy - 0.6, Math.abs(sz - pz));
  beam.renderOrder = 3; beam.name = "boathouse-beam"; group.add(beam);
  contacts.disc(px, pz, 0.4, 0.55, group);

  // ── The stations: workbench (clay), writing desk (letters), memory shelf ──
  const [bx, , bz] = BOATHOUSE_LAYOUT.bench;
  const bench = merged([
    placed(new THREE.BoxGeometry(0.85, 0.07, 2.0), bx, 0.86, bz),
    placed(new THREE.BoxGeometry(0.09, 0.82, 0.09), bx - 0.3, 0.41, bz - 0.85),
    placed(new THREE.BoxGeometry(0.09, 0.82, 0.09), bx + 0.3, 0.41, bz - 0.85),
    placed(new THREE.BoxGeometry(0.09, 0.82, 0.09), bx - 0.3, 0.41, bz + 0.85),
    placed(new THREE.BoxGeometry(0.09, 0.82, 0.09), bx + 0.3, 0.41, bz + 0.85),
  ], mat(dressing.bench, { roughness: 0.85 }));
  shadowed(bench, false, true); bench.name = "boathouse-bench"; bench.userData.anchor = "pottery"; group.add(bench);
  const pots = merged([
    placed(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 10), bx - 0.15, 0.98, bz - 0.5),
    placed(new THREE.CylinderGeometry(0.11, 0.08, 0.12, 10), bx + 0.12, 0.96, bz - 0.1),
    placed(new THREE.SphereGeometry(0.1, 10, 8), bx - 0.05, 0.98, bz + 0.45),
  ], mat(dressing.clay, { roughness: 0.9 }));
  pots.userData.anchor = "pottery"; pots.name = "boathouse-clay"; group.add(pots);
  contacts.disc(bx, bz, 0.6, 0.5, group);

  const [dkx, , dkz] = BOATHOUSE_LAYOUT.desk;
  const desk = merged([
    placed(new THREE.BoxGeometry(0.8, 0.06, 1.1), dkx, 0.8, dkz),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), dkx - 0.3, 0.385, dkz - 0.44),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), dkx + 0.3, 0.385, dkz - 0.44),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), dkx - 0.3, 0.385, dkz + 0.44),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), dkx + 0.3, 0.385, dkz + 0.44),
  ], mat(dressing.desk, { roughness: 0.85 }));
  shadowed(desk, false, true); desk.name = "boathouse-desk"; desk.userData.anchor = "letters"; group.add(desk);
  const letters = merged([
    placed(new THREE.BoxGeometry(0.26, 0.012, 0.18), dkx - 0.12, 0.84, dkz - 0.2, [0, 0.2, 0]),
    placed(new THREE.BoxGeometry(0.26, 0.012, 0.18), dkx + 0.1, 0.845, dkz + 0.12, [0, -0.3, 0]),
  ], mat(dressing.paper, { roughness: 0.9 }));
  letters.userData.anchor = "letters"; letters.name = "boathouse-letters"; group.add(letters);
  contacts.disc(dkx, dkz, 0.5, 0.5, group);

  const shelf = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.05, 2.2)), mat(dressing.shelf, { roughness: 0.8 })));
  shelf.position.set(BOATHOUSE_LAYOUT.shelfX, BOATHOUSE_LAYOUT.shelfY, -1.3);
  shelf.name = "boathouse-shelf"; shelf.userData.anchor = "memories"; group.add(shelf);

  // ── What the reading stands: lanterns, frames, and the plates ─────────────
  const finishNow = (): PlateFinish => plateFinish("current");
  const plateFor = (width: number, height: number): EngravedPlate =>
    track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, width, height));
  const wishesPlate = plateFor(1.15, 0.2);
  wishesPlate.mesh.position.set(-1.9, 1.9, -halfDepth + 0.11); wishesPlate.mesh.userData.anchor = "wishes"; group.add(wishesPlate.mesh);
  const memoriesPlate = plateFor(1.15, 0.2);
  memoriesPlate.mesh.position.set(BOATHOUSE_LAYOUT.shelfX + 0.04, BOATHOUSE_LAYOUT.shelfY + 0.32, -1.3);
  memoriesPlate.mesh.rotation.y = -Math.PI / 2; memoriesPlate.mesh.userData.anchor = "memories"; group.add(memoriesPlate.mesh);
  const lettersPlate = plateFor(1.0, 0.18);
  lettersPlate.mesh.position.set(dkx - 0.42, 1.15, dkz);
  lettersPlate.mesh.rotation.y = Math.PI / 2; lettersPlate.mesh.userData.anchor = "letters"; group.add(lettersPlate.mesh);

  // ── The unlit lantern by the door: the way a wish is made ────────────────
  // It hangs cold beside the shore door and never lights of its own accord —
  // it is a door onto the room where a wish is written, and the harbour writes
  // nothing. It is built once and stands whatever the reading says.
  const [wlx, wly, wlz] = BOATHOUSE_LAYOUT.wishLantern;
  const wishLantern = new THREE.Group();
  wishLantern.name = "boathouse-wish-lantern";
  {
    const shade = new THREE.Mesh(track(new THREE.SphereGeometry(0.12, 10, 8)), mat(dressing.lantern, { roughness: 0.9 }));
    shade.scale.y = 1.25; wishLantern.add(shade);
    const cord = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.42, 4)), mat(dressing.frame, { roughness: 0.9 }));
    cord.position.y = 0.34; wishLantern.add(cord);
    wishLantern.position.set(wlx, wly, wlz);
    wishLantern.userData.anchor = "wish";
    wishLantern.traverse((node) => { node.userData.anchor = "wish"; });
    group.add(wishLantern);
  }

  let lanternMeshes: THREE.Object3D[] = [];
  /** The newest lantern, while the reading says one has just gone up. It sways; nothing else does. */
  let newestLantern: THREE.Object3D | null = null;
  let frameMeshes: THREE.Object3D[] = [];
  let view: BoathouseReading = EMPTY_BOATHOUSE_READING;
  let partnerName: string | null = null;

  const clearStood = (): void => {
    for (const row of [...lanternMeshes, ...frameMeshes]) row.removeFromParent();
    lanternMeshes = []; frameMeshes = []; newestLantern = null;
  };

  const layOut = (): void => {
    clearStood();
    // One lit lantern per idea in the light, up to six; an empty rafter keeps two unlit.
    const lit = Math.min(6, view.wishes);
    const hanging = Math.max(lit, 2);
    // The first lantern is the newest wish: when one has just gone up it burns
    // warmer than the rest — the same paper, the same colour, more light in it.
    const newest = view.hung > 0 && lit > 0;
    for (let i = 0; i < hanging; i++) {
      const lantern = new THREE.Group();
      const isLit = i < lit;
      const warm = newest && i === 0;
      const shade = new THREE.Mesh(track(new THREE.SphereGeometry(0.12, 10, 8)), isLit
        ? track(new THREE.MeshStandardMaterial({ color: dressing.lanternGlow, emissive: new THREE.Color(dressing.lanternGlow), emissiveIntensity: warm ? 1.15 : 0.7, roughness: 0.6 }))
        : mat(dressing.lantern, { roughness: 0.9 }));
      shade.scale.y = 1.25; lantern.add(shade);
      const cord = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4)), mat(dressing.frame, { roughness: 0.9 }));
      cord.position.y = 0.38; lantern.add(cord);
      // A lantern hangs from the rafter, so it turns about the rafter and not
      // about itself: the hanger stands where the cord is nailed and the lantern
      // swings below it. The places are exactly where they were.
      const hanger = new THREE.Group();
      hanger.position.set(-2.4 + (i % 3) * 1.0, BOATHOUSE_LAYOUT.lanternY + (i % 2 ? 0.15 : 0) + LANTERN_DROP, -1.9 + Math.floor(i / 3) * 1.1);
      lantern.position.set(0, -LANTERN_DROP, 0);
      hanger.add(lantern);
      hanger.userData.anchor = "wishes";
      hanger.traverse((node) => { node.userData.anchor = "wishes"; });
      group.add(hanger);
      lanternMeshes.push(hanger);
      if (warm) newestLantern = hanger;
    }
    // Framed compositions on the memory shelf, up to five.
    const kept = Math.min(5, view.memories);
    for (let i = 0; i < kept; i++) {
      const frame = new THREE.Group();
      const wood = new THREE.Mesh(track(new THREE.BoxGeometry(0.02, 0.3, 0.24)), mat(dressing.frameWood, { roughness: 0.85 }));
      frame.add(wood);
      const print = new THREE.Mesh(track(new THREE.PlaneGeometry(0.2, 0.24)), mat(dressing.paper, { roughness: 0.9 }));
      print.rotation.y = -Math.PI / 2; print.position.x = -0.012; frame.add(print);
      frame.position.set(BOATHOUSE_LAYOUT.shelfX, BOATHOUSE_LAYOUT.shelfY + 0.18, -2.2 + i * 0.42);
      frame.rotation.z = 0.05 * (i % 2 ? 1 : -1);
      frame.userData.anchor = "memories";
      frame.traverse((node) => { node.userData.anchor = "memories"; });
      group.add(frame);
      frameMeshes.push(frame);
    }
    wishesPlate.set(view.hung > 0 ? "Lanterns — a new wish was hung this week" : `Lanterns — ${fewWords(view.wishes, "idea in the light", "ideas in the light")}`, finishNow());
    memoriesPlate.set(`The shelf — ${fewWords(view.memories, "memory kept", "memories kept")}`, finishNow());
    lettersPlate.set(`The desk — ${fewWords(view.letters, "note placed", "notes placed")}`, finishNow());
  };

  const signatureOf = (reading: BoathouseReading, partner: string | null): string =>
    [reading.wishes, reading.memories, reading.letters, reading.encounters, reading.hung, partner].join("§");
  let signature = "";

  function update(value: unknown): void {
    const next = readBoathouseReading(value);
    const reading = next.boathouse ?? EMPTY_BOATHOUSE_READING;
    const nextSignature = signatureOf(reading, next.partnerName);
    if (nextSignature === signature) return;
    view = reading; partnerName = next.partnerName; signature = nextSignature;
    layOut();
    // Something in the room started moving that the runtime did not ask for.
    // The frame policy owns the clock from here; reduced motion never animates.
    if (newestLantern) options.onAnimate?.();
  }
  update(options.reading ?? null);

  /**
   * The newest lantern sways on the draught off the slip, on the runtime's own
   * animated frames (`animate(t, dt)` — never a raw rAF). Nothing else in the
   * room moves, and when no wish is newly hung nothing does at all.
   */
  function animate(t: number, _dt: number): boolean {
    if (!newestLantern) return false;
    newestLantern.rotation.z = lanternSway(t);
    return true;
  }

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = [
      { id: "wishes", position: at(-1.6, BOATHOUSE_LAYOUT.lanternY - 0.2, -1.4), zone: "station", label: `${lanternWords(view.wishes, view.hung)}. Tend a wish.`, door: { target: "wishes" } },
      // The unlit lantern by the door: take it down and make a wish. A door onto
      // the room where a wish is written — the harbour never writes one itself.
      { id: "wish", position: at(wlx, wly, wlz), zone: "station", label: "The unlit lantern by the door — take it down and make a wish. Tend a wish.", door: { target: "wishes" } },
      { id: "projector", position: at(px, 0.8, pz), zone: "station", label: `The projector, aimed at the sail — choose three memories.`, door: { target: "projector" } },
      { id: "memories", position: at(BOATHOUSE_LAYOUT.shelfX - 0.2, BOATHOUSE_LAYOUT.shelfY + 0.1, -1.3), zone: "station", label: `The memory shelf — ${fewWords(view.memories, "memory kept", "memories kept")}. Open a memory.`, door: { target: "memories" } },
      { id: "pottery", position: at(bx, 1.0, bz), zone: "station", label: "The workbench — clay under the window. Open a bank's studio.", door: { target: "pottery" } },
      { id: "letters", position: at(dkx, 0.95, dkz), zone: "station", label: `The writing desk — ${fewWords(view.letters, "note placed", "notes placed")}. Open the writing desk.`, door: { target: "letters" } },
      { id: "boat", position: at(BOATHOUSE_LAYOUT.boat[0], 0.35, BOATHOUSE_LAYOUT.boat[2]), zone: "station", label: `The rowboat in the slip, two thwarts${partnerName ? ` — room for you and ${partnerName}` : ""} — ${fewWords(view.encounters, "moment spent together", "moments spent together")}. Open what you made together.`, door: { target: "memories" } },
      { id: "shore-door", position: at(BOATHOUSE_LAYOUT.door[0], 1.0, BOATHOUSE_LAYOUT.door[2] - 0.2), zone: "stair", label: "The shore door — back to the Court." },
    ];
    return rows;
  };

  const regionList = (): Region[] => [
    { id: "wishes", group: "boathouse", label: "The lanterns", box: box(-2.7, BOATHOUSE_LAYOUT.lanternY - 0.4, -2.2, -0.2, BOATHOUSE_LAYOUT.lanternY + 0.5, -0.6) },
    { id: "wish", group: "boathouse", label: "The unlit lantern by the door — make a wish", box: box(wlx - 0.26, wly - 0.26, wlz - 0.26, wlx + 0.26, wly + 0.5, wlz + 0.26) },
    { id: "projector", group: "boathouse", label: "The projector and the sail", box: box(px - 0.5, 0, pz - 0.5, px + 0.5, 1.1, pz + 0.5) },
    { id: "memories", group: "boathouse", label: "The memory shelf", box: box(BOATHOUSE_LAYOUT.shelfX - 0.5, BOATHOUSE_LAYOUT.shelfY - 0.2, -2.5, BOATHOUSE_LAYOUT.shelfX + 0.3, BOATHOUSE_LAYOUT.shelfY + 0.6, -0.1) },
    { id: "pottery", group: "boathouse", label: "The workbench", box: box(bx - 0.6, 0, bz - 1.1, bx + 0.6, 1.2, bz + 1.1) },
    { id: "letters", group: "boathouse", label: "The writing desk", box: box(dkx - 0.55, 0, dkz - 0.7, dkx + 0.55, 1.05, dkz + 0.7) },
    { id: "boat", group: "boathouse", label: "The rowboat", box: box(-0.6, -0.1, 0.4, 0.6, 0.5, 1.9) },
    { id: "shore-door", group: "boathouse", label: "The shore door — back to the Court", box: box(BOATHOUSE_LAYOUT.door[0] - 0.6, 0, BOATHOUSE_LAYOUT.door[2] - 0.3, BOATHOUSE_LAYOUT.door[0] + 0.6, 2.0, BOATHOUSE_LAYOUT.door[2] + 0.2) },
  ];

  return {
    group,
    update,
    animate,
    dispose() {
      scene.remove(group);
      clearStood();
      for (const item of disposables) item.dispose();
    },
    anchors: anchorList,
    poses: () => boathousePoses(anchorList()),
    regions: regionList,
  };
}

export const boathousePlace: Place = registerPlace({
  id: "boathouse",
  build(scene, dressing, reading, quality, context) {
    return createBoathouse(scene, {
      dressing: boathouseDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
