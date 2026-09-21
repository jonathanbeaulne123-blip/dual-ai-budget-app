import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";
import type { HouseCondition } from "../../core/houseCondition.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import { courtDressingFrom, type CourtDressing, type CourtProp } from "./dressing.ts";
import { EngravedPlate, engravedWords, plateFinish, seeded, type PlateFinish } from "./engraved.ts";
import { createMailbox, slipLines } from "./mailbox.ts";
import { groundHeightAt } from "../scene/ground.ts";
import { COURT_PIECES, PIECE_IDS, createCourtPieces, type CourtPieces, type CourtPiecesOptions, type PieceId } from "./pieces.ts";
import { CISTERN_POSITION, createCistern } from "./cistern.ts";
import { createSundial } from "./sundial.ts";
import { COURT_SIGN_PLACES, SIGN_TITLES, courtSigns, type CourtSign } from "../nav/doorSigns.ts";

/**
 * The Court — the first screen. A worn chessboard terrace with the Queen's spot
 * at the centre, her three at three points, the Everyday flagstone at her feet,
 * a sundial, a mailbox with the slip, a low gate, Hercules asleep, and the
 * partner's pin at the gate. Everything here is a "model village" object:
 * MeshStandardMaterial, no textures but the engraved plates.
 */

/** Layout shared with the camera poses (writer C) — +z faces the camera. */
/** The stairhead beside the Bishop, and how far the court lifts when it is the cellar's lid. */
export const STAIRHEAD = Object.freeze({ width: 1.15, run: 0.95, depth: 0.7, lift: 7 });

export const COURT_LAYOUT = {
  terraceRadius: 6,
  lawnOuter: 9.5,
  board: 8,
  tile: 1.05,
  joint: 0.035,
  tileHeight: 0.12,
  queen: [0, 0, 0],
  flagstone: [0, 0, 1.6],
  sundial: [4.0, 0, 3.2],
  mailbox: [-1.2, 0, 5.4],
  gate: [0, 0, 6.2],
  cistern: CISTERN_POSITION,
  hercules: [1.35, 0, 1.85],
  /** The way down: a stone stairhead beside the Bishop, opening onto the cellar. */
  stairhead: [1.75, 0, 4.15],
  partner: [-0.78, 0, 5.9],
  props: [[-4.6, 0, 2.6], [4.9, 0, 0.6], [-5.0, 0, -0.4], [2.6, 0, -4.8], [-2.4, 0, -4.9]],
} as const satisfies Record<string, unknown>;

/** Moss coverage in the joints by the house's condition (BUILD_PLAN §5). */
export const MOSS_BY_CONDITION: Record<HouseCondition["state"], number> = { checking: 0.2, settled: 0.2, growing: 0.35, wilting: 0.6, weathered: 0.8 };

/** What the Court reads; a structural subset of writer B's `HarbourReading`. */
export type CourtReading = {
  everyday: number | null;
  prepare: { cents: number | null };
  protect: { cents: number | null };
  build: { cents: number | null };
  next: { label: string; daysAhead: number } | null;
  noticed: { fact: string; next: string } | null;
  slip: string[];
  condition: { state: HouseCondition["state"] } | null;
  freshness: FundPulseFreshness;
  partner: { fresh: boolean; name?: string } | null;
};

const asCents = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const asFund = (value: unknown): { cents: number | null } => ({ cents: value && typeof value === "object" ? asCents((value as { cents?: unknown }).cents) : null });
const CONDITIONS: readonly HouseCondition["state"][] = ["checking", "settled", "growing", "wilting", "weathered"];

/** Narrows any reading-shaped value; missing parts read as unknown ("—"), never as zero. */
export function readCourtReading(value: unknown): CourtReading {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const next = row.next && typeof row.next === "object" ? (row.next as { label?: unknown; daysAhead?: unknown }) : null;
  const noticed = row.noticed && typeof row.noticed === "object" ? (row.noticed as { fact?: unknown; next?: unknown }) : null;
  const condition = row.condition && typeof row.condition === "object" ? (row.condition as { state?: unknown }).state : null;
  const partner = row.partner && typeof row.partner === "object" ? (row.partner as { fresh?: unknown; name?: unknown }) : null;
  const freshness = row.freshness === "stale" || row.freshness === "offline" ? row.freshness : "current";
  return {
    everyday: asCents(row.everyday),
    prepare: asFund(row.prepare),
    protect: asFund(row.protect),
    build: asFund(row.build),
    next: next && typeof next.label === "string" && typeof next.daysAhead === "number" ? { label: next.label, daysAhead: next.daysAhead } : null,
    noticed: noticed ? { fact: typeof noticed.fact === "string" ? noticed.fact : "", next: typeof noticed.next === "string" ? noticed.next : "" } : null,
    slip: Array.isArray(row.slip) ? row.slip.filter((line): line is string => typeof line === "string").slice(0, 3) : [],
    condition: typeof condition === "string" && (CONDITIONS as readonly string[]).includes(condition) ? { state: condition as HouseCondition["state"] } : null,
    freshness,
    partner: partner ? { fresh: partner.fresh === true, ...(typeof partner.name === "string" ? { name: partner.name } : {}) } : null,
  };
}

export const EMPTY_COURT_READING: CourtReading = { everyday: null, prepare: { cents: null }, protect: { cents: null }, build: { cents: null }, next: null, noticed: null, slip: [], condition: null, freshness: "current", partner: null };

export type CourtHandle = PlaceHandle & {
  /** Accepts any reading-shaped value (`readCourtReading` narrows it); missing parts read as "—". */
  update(value: unknown): void;
  /** The Queen's spot: writer B's `queenPlace` seats her here. Replaces any previous occupant. Her touch regions, when given, replace the coarse "queen" region for the twins. */
  attachQueen(object: THREE.Object3D, regions?: () => Region[]): void;
  detachQueen(): THREE.Object3D | null;
  pieces: CourtPieces;
  /** Resolves when the three pieces have landed or failed. */
  ready: Promise<void>;
  /** Current engraved words, for the DOM twins and tests. */
  words(): { everyday: string; rook: string; bishop: string; knight: string; tag: string | null; slip: string[]; flagUp: boolean };
  /** The door signs standing on the path, by the building's anchor id — what each plate is engraved with right now. */
  signs(): Record<string, CourtSign>;
  mossCoverage(): number;
  /**
   * The court's own floor, lifting away as the cellar's lid (BUILD_PLAN_SLICE2
   * §1). 0 is the court seated on its island; 1 is the whole court lifted
   * clear so the camera can descend through where it stood. The cellar's
   * ceiling is the underside of these flagstones, so this is the same move
   * read from below.
   */
  setLid(k: number): void;
  lid(): number;
  drawCalls(): number;
};

export type CourtOptions = {
  dressing: CourtDressing;
  reading?: CourtReading;
  quality: "full" | "lite";
  signal?: AbortSignal;
  /** Called when a piece lands so the runtime can schedule a frame. */
  onLanded?: (id: PieceId) => void;
  /** Test hooks. */
  load?: CourtPiecesOptions["load"];
  loadModels?: boolean;
};

const PHONE_COURT: Pose = { target: [0, 0.95, 0.7], r: 9.2, theta: 0, phi: 1.02 };
const DESKTOP_COURT: Pose = { target: [0, 0.8, 0.4], r: 10.5, theta: 0.38, phi: 0.92 };

/** Camera poses: position = target + r·(sinφ·sinθ, cosφ, sinφ·cosθ); θ = 0 looks in from +z. */
export function courtPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "court:phone": PHONE_COURT,
    "court:desktop": DESKTOP_COURT,
    "sky:phone": { target: [0, 0, 0.8], r: 19, theta: 0, phi: 0.42 },
    "sky:desktop": { target: [0, 0, 0.4], r: 21, theta: 0.3, phi: 0.5 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = Math.atan2(x, z + 9) * 0.6;
    const close = anchor.zone === "queen" ? 5.2 : anchor.zone === "gate" ? 5.5 : 4.2;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.6, y * 0.8), z], r: close, theta, phi: 1.05 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.6, y * 0.8), z], r: close + 0.8, theta: theta + 0.25, phi: 0.98 };
  }
  return poses;
}

function mergedMesh(geometries: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const joined = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
  if (joined && geometries.length > 1) for (const g of geometries) g.dispose();
  return new THREE.Mesh(joined ?? geometries[0]!, material);
}

function placed<T extends THREE.BufferGeometry>(geometry: T, x: number, y: number, z: number, rotation?: [number, number, number]): T {
  if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
  geometry.translate(x, y, z);
  return geometry;
}

export function createCourt(scene: THREE.Scene, options: CourtOptions): CourtHandle {
  const { dressing, quality } = options;
  const full = quality === "full";
  const group = new THREE.Group();
  group.name = "court";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, ...extra }));
  // Both tiers cast: the sun's soft shadow is what makes a model village sit on its table.
  const shadowed = <T extends THREE.Object3D>(object: T, cast = true, receive = true): T => { object.castShadow = cast; object.receiveShadow = receive; return object; };

  // Contact shadows: a radial-gradient disc under anything that stands, so it touches the ground.
  // Shared with the Tower through `scene/contact.ts`; both places sit their objects the same way.
  const contacts = track(createContactShadows());
  const contact = (x: number, z: number, radius: number, opacity = 1, parent: THREE.Object3D = group): void => {
    contacts.disc(x, z, radius, opacity, parent);
  };

  // ── Ground: terrace apron and lawn ring ─────────────────────────────────────
  const terrace = shadowed(new THREE.Mesh(track(new THREE.CircleGeometry(COURT_LAYOUT.terraceRadius, 56)), mat(dressing.terrace, { roughness: 0.95 })), false);
  terrace.rotation.x = -Math.PI / 2; terrace.position.y = -0.02; group.add(terrace);
  const lawn = shadowed(new THREE.Mesh(track(new THREE.RingGeometry(COURT_LAYOUT.terraceRadius - 0.05, COURT_LAYOUT.lawnOuter, 56, 1)), mat(dressing.lawn, { roughness: 1 })), false);
  lawn.rotation.x = -Math.PI / 2; lawn.position.y = -0.03; group.add(lawn);

  // ── Paving: one instanced mesh of 8×8 worn tiles with colour jitter ─────────
  const { board, tile, joint, tileHeight } = COURT_LAYOUT;
  const tileGeometry = track(new THREE.BoxGeometry(tile - joint, tileHeight, tile - joint));
  const paving = new THREE.InstancedMesh(tileGeometry, mat(dressing.stone, { roughness: 0.9 }), board * board);
  paving.name = "paving";
  shadowed(paving, false);
  const rand = seeded(0x51c0);
  const stone = new THREE.Color(dressing.stone), stoneAlt = new THREE.Color(dressing.stoneAlt), tone = new THREE.Color();
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
  const half = (board * tile) / 2 - tile / 2;
  const crackedIndex = 27; // row 3, column 3 — the tile the frost got to
  // One calm terrace with a faint checker: tone varies by ±4 % lightness only, every tile lies flat
  // and level (a tilted tile dips under the joint plane and reads as a dark triangle), joints are thin.
  quaternion.identity();
  for (let row = 0; row < board; row++) for (let col = 0; col < board; col++) {
    const index = row * board + col;
    position.set(col * tile - half, -tileHeight / 2 + 0.012, row * tile - half);
    matrix.compose(position, quaternion, scale);
    paving.setMatrixAt(index, matrix);
    tone.copy((row + col) % 2 ? stoneAlt : stone).offsetHSL(0, 0, (rand() - 0.5) * 0.08);
    paving.setColorAt(index, tone);
  }
  paving.instanceMatrix.needsUpdate = true;
  if (paving.instanceColor) paving.instanceColor.needsUpdate = true;
  group.add(paving);

  // Joints: a plane under the tiles whose colour moves from joint to moss with coverage.
  const jointMaterial = mat(dressing.joint, { roughness: 1 });
  const joints = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(board * tile + 0.05, board * tile + 0.05)), jointMaterial), false);
  joints.rotation.x = -Math.PI / 2; joints.position.y = -0.03; group.add(joints);
  // Three soft chipped corners: small rounded notches in the joint's colour, sunk into a tile's corner.
  const chipGeometry = track(new THREE.CylinderGeometry(0.07, 0.09, 0.02, 9));
  const chips = new THREE.InstancedMesh(chipGeometry, jointMaterial, 3);
  chips.name = "chips";
  [[1, 2, 1, 1], [5, 6, -1, 1], [6, 1, 1, -1]].forEach(([col, row, sx, sz], i) => {
    position.set(col! * tile - half + sx! * (tile / 2 - 0.09), 0.006, row! * tile - half + sz! * (tile / 2 - 0.09));
    scale.set(1, 1, 0.8);
    matrix.compose(position, quaternion, scale);
    chips.setMatrixAt(i, matrix);
  });
  scale.set(1, 1, 1);
  chips.instanceMatrix.needsUpdate = true;
  group.add(chips);
  // Moss pads at joint crossings: one instanced mesh, count scaled by coverage.
  const PADS = full ? 56 : 28;
  const pads = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.075, 7, 5)), mat(dressing.moss, { roughness: 1 }), PADS);
  pads.name = "moss";
  const padRand = seeded(0x3055);
  for (let i = 0; i < PADS; i++) {
    const cx = Math.floor(padRand() * (board - 1)) + 1, cz = Math.floor(padRand() * (board - 1)) + 1;
    position.set(cx * tile - half - tile / 2 + (padRand() - 0.5) * 0.12, 0.012, cz * tile - half - tile / 2 + (padRand() - 0.5) * 0.12);
    scale.set(0.8 + padRand() * 0.9, 0.22 + padRand() * 0.16, 0.8 + padRand() * 0.9);
    quaternion.identity();
    matrix.compose(position, quaternion, scale);
    pads.setMatrixAt(i, matrix);
  }
  pads.instanceMatrix.needsUpdate = true;
  scale.set(1, 1, 1);
  group.add(pads);
  // The cracked tile: a dark hairline across one tile, shown when weathered.
  const crackRow = Math.floor(crackedIndex / board), crackCol = crackedIndex % board;
  const crack = new THREE.Mesh(track(new THREE.BoxGeometry(tile * 1.1, 0.01, 0.025)), mat(dressing.joint, { roughness: 1 }));
  crack.position.set(crackCol * tile - half, 0.02, crackRow * tile - half); crack.rotation.y = 0.62; crack.visible = false; group.add(crack);

  // ── Everyday flagstone: the one big number, at her feet ─────────────────────
  const [fx, , fz] = COURT_LAYOUT.flagstone;
  const flagstone = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 0.08, 1.0)), mat(dressing.plate, { roughness: 0.8 })));
  flagstone.position.set(fx, 0.05, fz); flagstone.userData.anchor = "flagstone"; group.add(flagstone);
  contact(fx, fz, 1.15, 0.5);
  const everyday = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "large" }, 1.52, 0.84));
  everyday.mesh.rotation.x = -Math.PI / 2; everyday.mesh.position.set(fx, 0.096, fz); everyday.mesh.userData.anchor = "flagstone"; group.add(everyday.mesh);

  // ── The Queen's spot ────────────────────────────────────────────────────────
  const queenSlot = new THREE.Group(); queenSlot.name = "queen-slot"; queenSlot.position.set(...COURT_LAYOUT.queen); group.add(queenSlot);
  contact(COURT_LAYOUT.queen[0], COURT_LAYOUT.queen[2], 1.05, 0.9);

  // ── Her three, on plinths ───────────────────────────────────────────────────
  const pieces = createCourtPieces(dressing, { quality, signal: options.signal, load: options.load, loadModels: options.loadModels, onLanded: (id) => { pendingRedraw = true; options.onLanded?.(id); } });
  group.add(pieces.group);
  for (const id of PIECE_IDS) contact(COURT_PIECES[id].position[0], COURT_PIECES[id].position[2], 0.95, 0.85);

  // ── Sundial and mailbox ─────────────────────────────────────────────────────
  const sundial = track(createSundial(dressing)); sundial.group.position.set(...COURT_LAYOUT.sundial); group.add(sundial.group);
  const mailbox = track(createMailbox(dressing)); mailbox.group.position.set(...COURT_LAYOUT.mailbox); group.add(mailbox.group);
  if (!full) [sundial.group, mailbox.group].forEach((g) => g.traverse((node) => { node.castShadow = false; }));
  // A raycast resolves a court object through `userData.anchor` (scene/runtime.ts).
  sundial.group.userData.anchor = "sundial"; mailbox.group.userData.anchor = "mailbox";
  contact(COURT_LAYOUT.sundial[0], COURT_LAYOUT.sundial[2], 0.9, 0.7); contact(COURT_LAYOUT.mailbox[0], COURT_LAYOUT.mailbox[2], 0.42, 0.7);

  // ── The Cistern, beside the Knight: Protect's water against its target ──────
  const cistern = track(createCistern(dressing, options.reading));
  cistern.group.position.set(...COURT_LAYOUT.cistern);
  if (!full) cistern.group.traverse((node) => { node.castShadow = false; });
  group.add(cistern.group);
  contact(COURT_LAYOUT.cistern[0], COURT_LAYOUT.cistern[2], 0.78, 0.8);

  // ── The gate: two posts, two rails, a low arch ──────────────────────────────
  // A low garden gate: two posts, a picket leaf between them on two rails, brass only on the hinges.
  const [gx, , gz] = COURT_LAYOUT.gate;
  const gatePosts = shadowed(mergedMesh([placed(new THREE.BoxGeometry(0.16, 1.0, 0.16), gx - 0.95, 0.5, gz), placed(new THREE.BoxGeometry(0.16, 1.0, 0.16), gx + 0.95, 0.5, gz), placed(new THREE.SphereGeometry(0.1, 8, 6), gx - 0.95, 1.02, gz), placed(new THREE.SphereGeometry(0.1, 8, 6), gx + 0.95, 1.02, gz)], mat(dressing.gate.post, { roughness: 0.8 })));
  const pickets: THREE.BufferGeometry[] = [placed(new THREE.BoxGeometry(1.7, 0.05, 0.04), gx, 0.32, gz), placed(new THREE.BoxGeometry(1.7, 0.05, 0.04), gx, 0.72, gz)];
  for (let i = 0; i < 7; i++) { const x = gx - 0.72 + i * 0.24; const h = 0.78 - Math.abs(i - 3) * 0.05; pickets.push(placed(new THREE.BoxGeometry(0.05, h, 0.03), x, h / 2 + 0.06, gz + 0.01)); }
  const gateRails = shadowed(mergedMesh(pickets, mat(dressing.gate.rail, { roughness: 0.7 })));

  // ── The island walk (LITTLE_HARBOUR_v2 §1): every house standing where it
  //    lives, each one a whole room's door. The Library's hall behind the
  //    court, the Glasshouse in the garden behind the Library, the Kitchen's
  //    cottage with its chimney smoking on the west lawn. Tapping one — or
  //    walking up and tapping its twin — goes there. Each one carries **one**
  //    plate — its door sign (W5 #1) — standing on the path in front of it, so
  //    what the room holds is readable without going in. Nothing else about a
  //    building is a claim: the sign is the room's own reading and nothing more.
  const LIBRARY_SPOT: readonly [number, number] = [-4.7, -11.6];
  const libraryY = groundHeightAt(LIBRARY_SPOT[0], LIBRARY_SPOT[1]);
  {
    const hall = new THREE.Group();
    hall.name = "library-hall";
    hall.userData.anchor = "library-hall";
    const body = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(2.6, 1.5, 1.7)), mat(dressing.plinth, { roughness: 0.92 })));
    body.position.y = 0.75; hall.add(body);
    const roof = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.03, 1.55, 1.0, 4, 1)), mat(dressing.gate.post, { roughness: 0.85, flatShading: true })));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.25, 1, 0.85); roof.position.y = 2.0; hall.add(roof);
    const tall = new THREE.Mesh(track(new THREE.BoxGeometry(0.42, 0.85, 0.06)), mat(dressing.gate.accent, { roughness: 0.7 }));
    tall.position.set(0, 0.85, 0.88); hall.add(tall);
    hall.traverse((node) => { node.userData.anchor = "library-hall"; });
    hall.position.set(LIBRARY_SPOT[0], libraryY, LIBRARY_SPOT[1]);
    hall.rotation.y = Math.atan2(-LIBRARY_SPOT[0], -LIBRARY_SPOT[1]) + Math.PI;
    group.add(hall);
  }
  const SHED_SPOT: readonly [number, number] = [-8.2, -9.4];
  const shedY = groundHeightAt(SHED_SPOT[0], SHED_SPOT[1]);
  {
    const shed = new THREE.Group();
    shed.name = "glasshouse-shed";
    shed.userData.anchor = "glasshouse-shed";
    const frameRibs = mergedMesh([
      placed(new THREE.BoxGeometry(0.06, 1.0, 0.06), -0.7, 0.5, -0.5), placed(new THREE.BoxGeometry(0.06, 1.0, 0.06), 0.7, 0.5, -0.5),
      placed(new THREE.BoxGeometry(0.06, 1.0, 0.06), -0.7, 0.5, 0.5), placed(new THREE.BoxGeometry(0.06, 1.0, 0.06), 0.7, 0.5, 0.5),
      placed(new THREE.BoxGeometry(1.7, 0.07, 0.07), 0, 1.35, 0, [0, 0, 0]),
    ], mat("#f2ede1", { roughness: 0.8 }));
    shadowed(frameRibs, false, true); shed.add(frameRibs);
    const panes = new THREE.Mesh(track(new THREE.BoxGeometry(1.5, 0.85, 1.1)), track(new THREE.MeshStandardMaterial({ color: "#eef4ef", transparent: true, opacity: 0.28, roughness: 0.15 })));
    panes.position.y = 0.55; shed.add(panes);
    const shedRoof = new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 1.05, 0.55, 4, 1)), track(new THREE.MeshStandardMaterial({ color: "#e4dccb", transparent: true, opacity: 0.5, roughness: 0.2, flatShading: true })));
    shedRoof.rotation.y = Math.PI / 4; shedRoof.scale.set(1.05, 1, 0.75); shedRoof.position.y = 1.28; shed.add(shedRoof);
    shed.traverse((node) => { node.userData.anchor = "glasshouse-shed"; });
    shed.position.set(SHED_SPOT[0], shedY, SHED_SPOT[1]);
    group.add(shed);
  }
  const COTTAGE_SPOT: readonly [number, number] = [-11.2, -3.4];
  const cottageY = groundHeightAt(COTTAGE_SPOT[0], COTTAGE_SPOT[1]);
  {
    const cottage = new THREE.Group();
    cottage.name = "kitchen-cottage";
    cottage.userData.anchor = "kitchen-cottage";
    const body = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 1.05, 1.35)), mat(dressing.terrace, { roughness: 0.92 })));
    body.position.y = 0.52; cottage.add(body);
    const roof = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 1.2, 0.8, 4, 1)), mat(dressing.gate.post, { roughness: 0.85, flatShading: true })));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.0, 1, 0.72); roof.position.y = 1.42; cottage.add(roof);
    const chimney = new THREE.Mesh(track(new THREE.BoxGeometry(0.2, 0.55, 0.2)), mat(dressing.plinth, { roughness: 0.95 }));
    chimney.position.set(0.45, 1.6, -0.2); cottage.add(chimney);
    // The fire is lit: a soft puff over the chimney, the kitchen's own welcome.
    const smoke = new THREE.Mesh(track(new THREE.SphereGeometry(0.14, 8, 6)), track(new THREE.MeshStandardMaterial({ color: "#f4f0e6", transparent: true, opacity: 0.55, roughness: 1 })));
    smoke.position.set(0.45, 2.05, -0.2); smoke.scale.set(1, 0.75, 1); cottage.add(smoke);
    const warmWindow = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.3, 0.05)), track(new THREE.MeshBasicMaterial({ color: "#ffd98e" })));
    warmWindow.position.set(-0.3, 0.6, 0.68); cottage.add(warmWindow);
    cottage.traverse((node) => { node.userData.anchor = "kitchen-cottage"; });
    cottage.position.set(COTTAGE_SPOT[0], cottageY, COTTAGE_SPOT[1]);
    cottage.rotation.y = Math.atan2(-COTTAGE_SPOT[0], -COTTAGE_SPOT[1]) + Math.PI;
    group.add(cottage);
  }

  // ── Hercules's Cottage (LITTLE_HARBOUR_v2 §2, "Making"): the one building on
  //    the island that is his and not ours. Small, crooked and charming: a
  //    settled body, a roof that sags off true, a chimney leaning with it, a
  //    lit window — and, beside the person's door, a cat-sized one of his own.
  //    Unlike its older neighbours it is turned to *face* the Court, so the two
  //    doors read from the terrace.
  const HERCULES_COTTAGE: readonly [number, number] = [9.8, 5.6];
  const herculesCottageY = groundHeightAt(HERCULES_COTTAGE[0], HERCULES_COTTAGE[1]);
  {
    const cottage = new THREE.Group();
    cottage.name = "hercules-cottage";
    // Six draw calls, one per material: body, roof, the plinth stonework, the
    // two doors and the lit window. Everything that shares a material is merged.
    const body = shadowed(mergedMesh([placed(new THREE.BoxGeometry(1.5, 0.98, 1.25), 0, 0.49, 0, [0, 0, 0.018])], mat(dressing.terrace, { roughness: 0.93 })));
    track(body.geometry); cottage.add(body);
    // The roof sits a little over-square and a little off true: charming, not broken.
    const roof = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 1.15, 0.72, 4, 1)), mat(dressing.timber, { roughness: 0.86, flatShading: true })));
    roof.rotation.y = Math.PI / 4; roof.rotation.z = 0.035; roof.scale.set(1.0, 1, 0.74); roof.position.set(0.02, 1.32, 0); cottage.add(roof);
    // The leaning chimney and the doorstep are the same stone.
    const stonework = shadowed(mergedMesh([
      placed(new THREE.BoxGeometry(0.17, 0.46, 0.17), -0.42, 1.48, -0.18, [0, 0, 0.07]),
      placed(new THREE.BoxGeometry(1.0, 0.07, 0.42), 0, 0.04, 0.86),
    ], mat(dressing.plinth, { roughness: 0.94 })));
    track(stonework.geometry); cottage.add(stonework);
    // The person's door, and his own beside it — the whole point of the building.
    const door = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.74, 0.05)), mat(dressing.gate.accent, { roughness: 0.7 }));
    door.position.set(0.22, 0.37, 0.64); cottage.add(door);
    const catWay = mergedMesh([
      placed(new THREE.BoxGeometry(0.2, 0.22, 0.05), -0.34, 0.11, 0.64),
      placed(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 10, 1, false, 0, Math.PI), -0.34, 0.22, 0.64, [Math.PI / 2, 0, 0]),
    ], mat(dressing.gate.post, { roughness: 0.72 }));
    track(catWay.geometry); cottage.add(catWay);
    // The lamp is on: his window, warm, from the terrace.
    const warmWindow = new THREE.Mesh(track(new THREE.BoxGeometry(0.3, 0.28, 0.05)), track(new THREE.MeshBasicMaterial({ color: "#ffd98e" })));
    warmWindow.position.set(0.58, 0.6, 0.15); warmWindow.rotation.y = Math.PI / 2; cottage.add(warmWindow);
    cottage.traverse((node) => { node.userData.anchor = "hercules-cottage"; });
    cottage.userData.anchor = "hercules-cottage";
    cottage.position.set(HERCULES_COTTAGE[0], herculesCottageY, HERCULES_COTTAGE[1]);
    cottage.rotation.y = Math.atan2(-HERCULES_COTTAGE[0], -HERCULES_COTTAGE[1]);
    group.add(cottage);
  }

  // ── The Kiln (LITTLE_HARBOUR_v2 §2, the Making district): the pottery's own
  //    building on the east lawn — a stout brick shed with the bottle kiln's
  //    throat standing over it, smoke at the chimney because somebody is
  //    always firing something. Walking to it goes to the Studio's own room.
  const KILN_SPOT: readonly [number, number] = [10.6, -4.4];
  const kilnY = groundHeightAt(KILN_SPOT[0], KILN_SPOT[1]);
  {
    const shed = new THREE.Group();
    shed.name = "kiln-house";
    shed.userData.anchor = "kiln-house";
    const body = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.8, 1.0, 1.45)), mat(dressing.plinth, { roughness: 0.95 })));
    body.position.y = 0.5; shed.add(body);
    const roof = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 1.28, 0.7, 4, 1)), mat(dressing.timber, { roughness: 0.86, flatShading: true })));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.0, 1, 0.78); roof.position.y = 1.32; shed.add(roof);
    // The bottle kiln through the roof: the silhouette you can name from the gate.
    const bottle = mergedMesh([
      placed(new THREE.CylinderGeometry(0.34, 0.44, 0.75, 10), -0.42, 0.38, -0.2),
      placed(new THREE.CylinderGeometry(0.2, 0.34, 0.55, 10), -0.42, 1.03, -0.2),
      placed(new THREE.CylinderGeometry(0.13, 0.2, 0.62, 8), -0.42, 1.6, -0.2),
      placed(new THREE.TorusGeometry(0.15, 0.03, 5, 10), -0.42, 1.9, -0.2, [Math.PI / 2, 0, 0]),
    ], mat(dressing.terrace, { roughness: 0.94 }));
    shadowed(bottle); track(bottle.geometry); shed.add(bottle);
    const smoke = new THREE.Mesh(track(new THREE.SphereGeometry(0.15, 8, 6)), track(new THREE.MeshStandardMaterial({ color: "#f2ece0", transparent: true, opacity: 0.5, roughness: 1 })));
    smoke.position.set(-0.42, 2.24, -0.2); smoke.scale.set(1, 0.72, 1); shed.add(smoke);
    const door = new THREE.Mesh(track(new THREE.BoxGeometry(0.58, 0.82, 0.06)), mat(dressing.gate.accent, { roughness: 0.72 }));
    door.position.set(0.34, 0.41, 0.74); shed.add(door);
    const glow = new THREE.Mesh(track(new THREE.BoxGeometry(0.26, 0.24, 0.05)), track(new THREE.MeshBasicMaterial({ color: "#ffb469" })));
    glow.position.set(-0.36, 0.5, 0.74); shed.add(glow);
    shed.traverse((node) => { node.userData.anchor = "kiln-house"; });
    shed.position.set(KILN_SPOT[0], kilnY, KILN_SPOT[1]);
    // Face the door toward the Court.
    shed.rotation.y = Math.atan2(-KILN_SPOT[0], -KILN_SPOT[1]) + Math.PI;
    group.add(shed);
  }

  // ── The Boathouse (LITTLE_HARBOUR_v2 §5): Together, tucked away — one small
  //    building down on the shore with its own door. It keeps everything the
  //    common rooms hold (wishes, memories, letters, the projector, the
  //    conversation); it just stops being a quarter of the app. You go there
  //    when you want it — which is why it is small, far, and by the water.
  const BOATHOUSE: readonly [number, number] = [5.6, -10.9];
  const boathouseY = groundHeightAt(BOATHOUSE[0], BOATHOUSE[1]);
  const boathouse = new THREE.Group();
  boathouse.name = "boathouse";
  boathouse.userData.anchor = "boathouse";
  {
    const body = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.9, 1.1, 1.4)), mat(dressing.timber, { roughness: 0.86 })));
    body.position.y = 0.55; boathouse.add(body);
    const roof = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.02, 1.25, 0.85, 4, 1)), mat(dressing.gate.post, { roughness: 0.8, flatShading: true })));
    roof.rotation.y = Math.PI / 4; roof.scale.set(1.05, 1, 0.78); roof.position.y = 1.5; boathouse.add(roof);
    const door = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.86, 0.06)), mat(dressing.gate.accent, { roughness: 0.7 }));
    door.position.set(0, 0.43, 0.71); boathouse.add(door);
    // A porch deck at the door — the jetty waits for the real shore in a later slice.
    const porch = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.1, 0.08, 0.6)), mat(dressing.timber, { roughness: 0.9 })), false, true);
    porch.position.set(0, 0.06, 1.0); boathouse.add(porch);
    boathouse.traverse((node) => { node.userData.anchor = "boathouse"; });
    boathouse.position.set(BOATHOUSE[0], boathouseY, BOATHOUSE[1]);
    // Face the door toward the court.
    boathouse.rotation.y = Math.atan2(-BOATHOUSE[0], -BOATHOUSE[1]) + Math.PI;
    group.add(boathouse);
  }
  // ── The Campfire (LITTLE_HARBOUR_v2 §6): the one ritual that needs two
  //    people, down on the shore in front of the Boathouse. A ring of beach
  //    stones, the fire in it, two split logs drawn up either side, and the
  //    first stones of the path of months running away toward the water. The
  //    fire is the only warm light on the island at this distance; tapping it
  //    walks you down to the shore.
  const CAMPFIRE: readonly [number, number] = [7.2, -9.4];
  const campfireY = groundHeightAt(CAMPFIRE[0], CAMPFIRE[1]);
  {
    const fire = new THREE.Group();
    fire.name = "campfire";
    fire.userData.anchor = "campfire";
    const ring = shadowed(mergedMesh(
      Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        const stone = new THREE.DodecahedronGeometry(0.13, 0);
        stone.scale(1, 0.7, 1);
        return placed(stone, Math.cos(a) * 0.48, 0.06, Math.sin(a) * 0.48, [0, a, 0]);
      }),
      mat(dressing.plinth, { roughness: 0.95, flatShading: true }),
    ));
    track(ring.geometry); fire.add(ring);
    const logs = shadowed(mergedMesh([
      placed(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 8), -0.88, 0.12, 0.2, [0, 0.28, Math.PI / 2]),
      placed(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 8), 0.88, 0.12, -0.2, [0, -0.28, Math.PI / 2]),
    ], mat(dressing.timber, { roughness: 0.92 })));
    track(logs.geometry); fire.add(logs);
    // The flame: unlit is nothing to see, and the Court never claims a fire
    // the books have not earned — the reading below turns it on.
    const flame = new THREE.Mesh(track(new THREE.ConeGeometry(0.17, 0.46, 8)), track(new THREE.MeshBasicMaterial({ color: "#f2913c", transparent: true, opacity: 0.85, depthWrite: false })));
    flame.position.set(0, 0.26, 0); flame.renderOrder = 3; fire.add(flame);
    const tip = new THREE.Mesh(track(new THREE.ConeGeometry(0.08, 0.24, 7)), track(new THREE.MeshBasicMaterial({ color: "#ffd98e", transparent: true, opacity: 0.9, depthWrite: false })));
    tip.position.set(0, 0.38, 0); tip.renderOrder = 4; fire.add(tip);
    // The first stones of the path of months, laid away toward the water.
    const stones = mergedMesh(
      Array.from({ length: 4 }, (_, i) => {
        const stone = new THREE.DodecahedronGeometry(0.1, 0);
        stone.scale(1.25, 0.3, 1);
        return placed(stone, -0.2 + Math.sin(i * 1.21) * 0.24, 0.02, -0.95 - i * 0.38, [0, i * 0.7, 0]);
      }),
      mat(dressing.gate.post, { roughness: 0.95, flatShading: true }),
    );
    track(stones.geometry); fire.add(stones);
    fire.traverse((node) => { node.userData.anchor = "campfire"; });
    fire.position.set(CAMPFIRE[0], campfireY, CAMPFIRE[1]);
    // The path of months runs away from the Court, toward the Boathouse and the water.
    fire.rotation.y = Math.atan2(-CAMPFIRE[0], -CAMPFIRE[1]) + Math.PI;
    group.add(fire);
  }

  // ── The door signs (W5 #1) ─────────────────────────────────────────────────
  //    One plate per building, standing on the path a step in front of its
  //    door and turned to face the Court, so the walk past a building tells
  //    you what is in it. The words are the room's own pure reading
  //    (`nav/doorSigns.ts`), never its contents; the plate re-engraves itself
  //    only when those words change, and the twin reads the same line.
  const SIGN_SPOTS: Readonly<Record<string, readonly [number, number]>> = {
    "library-hall": LIBRARY_SPOT, "glasshouse-shed": SHED_SPOT, "kitchen-cottage": COTTAGE_SPOT,
    boathouse: BOATHOUSE, "hercules-cottage": HERCULES_COTTAGE, "kiln-house": KILN_SPOT, campfire: CAMPFIRE,
  };
  /** How far in front of a building its sign stands, and how high off the ground. */
  const SIGN_STEP = 1.7, SIGN_LIFT = 0.8;
  // Driven by the sign table, not by this file: a building that gains a sign
  // and no spot here simply has none, and never a plate with the wrong words.
  const signPlates = Object.keys(COURT_SIGN_PLACES).flatMap((id) => {
    const spot = SIGN_SPOTS[id];
    if (!spot) return [];
    const [px, pz] = spot;
    const length = Math.hypot(px, pz) || 1;
    const x = px - (px / length) * SIGN_STEP, z = pz - (pz / length) * SIGN_STEP;
    const plate = track(new EngravedPlate({ stone: dressing.plinth, highlight: dressing.stoneAlt, ink: "#2a221c", size: "small", width: 640, fit: true }, 1.7, 0.54));
    plate.mesh.position.set(x, groundHeightAt(x, z) + SIGN_LIFT, z);
    plate.mesh.rotation.y = Math.atan2(-x, -z);
    plate.mesh.userData.anchor = id;
    plate.mesh.name = `sign-${id}`;
    plate.set(`${SIGN_TITLES[COURT_SIGN_PLACES[id]!]}\n—`, "glazed");
    group.add(plate.mesh);
    return [{ id, plate }];
  });

  const gateArch = shadowed(mergedMesh([
    placed(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), gx - 0.84, 0.32, gz), placed(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 8), gx - 0.84, 0.72, gz),
    placed(new THREE.BoxGeometry(0.05, 0.05, 0.03), gx + 0.78, 0.55, gz + 0.03),
  ], mat(dressing.gate.accent, { roughness: 0.35, metalness: 0.6 })));
  track(gatePosts.geometry); track(gateRails.geometry); track(gateArch.geometry);
  for (const part of [gatePosts, gateRails, gateArch]) part.userData.anchor = "gate";
  group.add(gatePosts, gateRails, gateArch);

  // ── Hercules, asleep: a porcelain loaf ──────────────────────────────────────
  const hercules = new THREE.Group(); hercules.name = "hercules"; hercules.position.set(...COURT_LAYOUT.hercules); hercules.rotation.y = -0.5; hercules.userData.anchor = "hercules"; group.add(hercules);
  const porcelain = mat(dressing.porcelain, { roughness: 0.35 });
  const pink = mat(dressing.pink, { roughness: 0.6 });
  const noseTone = mat("#b9605e", { roughness: 0.5 });
  const body = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.3, 18, 12)), porcelain)); body.scale.set(1.3, 0.62, 0.92); body.position.y = 0.19; hercules.add(body);
  const head = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.19, 16, 12)), porcelain)); head.scale.set(1, 0.9, 0.95); head.position.set(0.36, 0.28, 0.04); hercules.add(head);
  // Ears: a porcelain outer cone with a pink inner, upright on the head so they read from above.
  const earOuter = shadowed(mergedMesh([placed(new THREE.ConeGeometry(0.075, 0.15, 6), 0.4, 0.46, -0.1, [0.25, 0, -0.2]), placed(new THREE.ConeGeometry(0.075, 0.15, 6), 0.4, 0.46, 0.18, [-0.25, 0, -0.2])], porcelain));
  track(earOuter.geometry); hercules.add(earOuter);
  const ears = mergedMesh([placed(new THREE.ConeGeometry(0.04, 0.09, 6), 0.42, 0.47, -0.1, [0.25, 0, -0.2]), placed(new THREE.ConeGeometry(0.04, 0.09, 6), 0.42, 0.47, 0.18, [-0.25, 0, -0.2])], pink);
  track(ears.geometry); hercules.add(ears);
  const nose = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 8, 6)), noseTone); nose.position.set(0.55, 0.25, 0.05); hercules.add(nose);
  const eyes = mergedMesh([placed(new THREE.BoxGeometry(0.05, 0.012, 0.01), 0.53, 0.31, -0.05), placed(new THREE.BoxGeometry(0.05, 0.012, 0.01), 0.53, 0.31, 0.13)], noseTone);
  track(eyes.geometry); hercules.add(eyes);
  // The tail curls around the body's flank, flat on the stone, so it is a cat's tail at a glance.
  const tailPivot = new THREE.Group(); tailPivot.position.set(-0.3, 0.07, 0.18); hercules.add(tailPivot);
  const tail = shadowed(new THREE.Mesh(track(new THREE.TorusGeometry(0.22, 0.045, 7, 16, Math.PI * 1.25)), porcelain)); tail.rotation.x = Math.PI / 2; tail.rotation.z = Math.PI * 0.55; tail.position.set(-0.05, 0, 0.12); tailPivot.add(tail);
  const tailTip = new THREE.Mesh(track(new THREE.SphereGeometry(0.048, 8, 6)), porcelain); tailTip.position.set(0.14, 0, 0.3); tailPivot.add(tailTip);
  const TAIL_REST = 0.1; tailPivot.rotation.y = TAIL_REST;
  contact(0, 0, 0.62, 0.7, hercules);

  // ── Partner marker: a small figure pin at the gate ──────────────────────────
  const partner = new THREE.Group(); partner.name = "partner"; partner.position.set(...COURT_LAYOUT.partner); partner.visible = false; group.add(partner);
  const figure = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.075, 0.1, 0.36, 12)), mat(dressing.second, { roughness: 0.6 }))); figure.position.y = 0.18; partner.add(figure);
  const figureHead = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.1, 12, 10)), porcelain)); figureHead.position.y = 0.46; partner.add(figureHead);

  // ── Potted plants in the theme's prop set ───────────────────────────────────
  const propMaterials = {
    clay: mat(dressing.accent, { roughness: 0.9 }), timber: mat(dressing.timber, { roughness: 0.85 }), metal: mat(dressing.metal, { roughness: 0.35, metalness: 0.6 }),
    paper: mat(dressing.paper, { roughness: 0.7 }), leaf: mat(dressing.leaf, { roughness: 0.95 }), bloom: mat(dressing.bloom, { roughness: 0.7 }),
    rail: mat(dressing.gate.rail, { roughness: 0.6 }), post: mat(dressing.gate.post, { roughness: 0.6 }), spine: mat(dressing.plinth, { roughness: 0.7 }),
  };
  // A thrown pot: a lathe profile (foot, belly, lip). A shrub: a cluster of icosahedra, flat-shaded.
  const potGeometry = (foot: number, belly: number, lip: number, height: number) => track(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(foot, 0), new THREE.Vector2(foot * 1.05, height * 0.08), new THREE.Vector2(belly, height * 0.55),
    new THREE.Vector2(lip * 0.94, height * 0.9), new THREE.Vector2(lip, height * 0.92), new THREE.Vector2(lip, height), new THREE.Vector2(lip * 0.86, height), new THREE.Vector2(lip * 0.84, height * 0.9),
  ], 18));
  const shrubGeometry = (radius: number) => track(mergeGeometries([
    placed(new THREE.IcosahedronGeometry(radius, 0), 0, radius * 0.9, 0), placed(new THREE.IcosahedronGeometry(radius * 0.72, 0), radius * 0.6, radius * 0.7, radius * 0.2),
    placed(new THREE.IcosahedronGeometry(radius * 0.66, 0), -radius * 0.55, radius * 0.75, -radius * 0.3), placed(new THREE.IcosahedronGeometry(radius * 0.6, 0), radius * 0.1, radius * 1.45, -radius * 0.4),
  ], false) ?? new THREE.IcosahedronGeometry(radius, 0));
  const leafMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.leaf, roughness: 0.95, flatShading: true }));
  const bloomMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.bloom, roughness: 0.75, flatShading: true }));
  const potted = (pot: THREE.BufferGeometry, potMaterial: THREE.Material, potHeight: number, crown: THREE.BufferGeometry, crownMaterial: THREE.Material): THREE.Object3D[] => {
    const crownMesh = new THREE.Mesh(crown, crownMaterial); crownMesh.position.y = potHeight - 0.04;
    return [new THREE.Mesh(pot, potMaterial), crownMesh];
  };
  const propBuilders: Record<CourtProp, () => THREE.Object3D[]> = {
    "terracotta-pot": () => potted(potGeometry(0.2, 0.3, 0.3, 0.44), propMaterials.clay, 0.44, shrubGeometry(0.26), leafMaterial),
    "herb-pot": () => potted(potGeometry(0.13, 0.2, 0.21, 0.32), propMaterials.clay, 0.32, shrubGeometry(0.19), leafMaterial),
    "brass-lantern": () => [new THREE.Mesh(track(placed(new THREE.BoxGeometry(0.26, 0.5, 0.26), 0, 0.55, 0)), propMaterials.metal), new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), 0, 0.15, 0)), propMaterials.timber)],
    "clay-urn": () => potted(potGeometry(0.16, 0.36, 0.22, 0.6), propMaterials.clay, 0.6, shrubGeometry(0.2), bloomMaterial),
    "washi-lantern": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12), 0, 0.75, 0)), propMaterials.paper), new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), 0, 0.25, 0)), propMaterials.timber)],
    "album-planter": () => [new THREE.Mesh(track(mergeGeometries([placed(new THREE.BoxGeometry(0.5, 0.42, 0.12), -0.18, 0.21, 0), placed(new THREE.BoxGeometry(0.5, 0.36, 0.12), 0, 0.18, 0.02), placed(new THREE.BoxGeometry(0.5, 0.4, 0.12), 0.18, 0.2, -0.01)], false) ?? new THREE.BoxGeometry(0.6, 0.4, 0.3)), propMaterials.spine), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.28, 12, 9), 0, 0.6, 0)), propMaterials.leaf)],
    "paper-rose": () => potted(potGeometry(0.18, 0.24, 0.25, 0.38), propMaterials.paper, 0.38, shrubGeometry(0.22), bloomMaterial),
    "heart-pot": () => potted(potGeometry(0.2, 0.27, 0.27, 0.38), propMaterials.clay, 0.38, shrubGeometry(0.2), bloomMaterial),
    "wharf-barrel": () => potted(potGeometry(0.27, 0.31, 0.28, 0.56), propMaterials.timber, 0.56, shrubGeometry(0.24), leafMaterial),
    buoy: () => [new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.3, 14, 10), 0, 0.3, 0)), propMaterials.post), new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.05, 0.05, 0.3, 8), 0, 0.72, 0)), propMaterials.rail)],
    "rope-coil": () => [new THREE.Mesh(track(placed(new THREE.TorusGeometry(0.28, 0.09, 8, 20), 0, 0.09, 0, [Math.PI / 2, 0, 0])), mat(dressing.joint, { roughness: 1 })), new THREE.Mesh(track(placed(new THREE.TorusGeometry(0.2, 0.08, 8, 18), 0, 0.24, 0, [Math.PI / 2, 0, 0])), mat(dressing.joint, { roughness: 1 }))],
    "lobster-pot": () => [new THREE.Mesh(track(placed(new THREE.BoxGeometry(0.62, 0.36, 0.42), 0, 0.18, 0)), propMaterials.timber), new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.2, 0.2, 0.44, 12), 0, 0.18, 0, [0, 0, Math.PI / 2])), propMaterials.rail)],
    "clapboard-planter": () => [new THREE.Mesh(track(placed(new THREE.BoxGeometry(0.7, 0.34, 0.3), 0, 0.17, 0)), propMaterials.rail), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.26, 12, 9), 0, 0.5, 0)), propMaterials.bloom)],
  };
  const propsGroup = new THREE.Group(); propsGroup.name = "props"; group.add(propsGroup);
  dressing.props.slice(0, COURT_LAYOUT.props.length).forEach((prop, index) => {
    const slot = COURT_LAYOUT.props[index]!;
    const holder = new THREE.Group(); holder.position.set(slot[0], slot[1], slot[2]); holder.rotation.y = index * 1.3;
    for (const part of propBuilders[prop]()) holder.add(shadowed(part));
    contact(0, 0, 0.42, 0.6, holder);
    propsGroup.add(holder);
  });

  // ── The way down: a stone stairhead beside the Bishop ───────────────────────
  // A modest rectangular opening in the paving with two steps falling into the
  // dark and a low rail on three sides. It is a door you can see from the path;
  // tapping it walks you down to `home/below` rather than opening anything.
  const [hx0, , hz0] = COURT_LAYOUT.stairhead;
  const stairhead = new THREE.Group();
  stairhead.name = "stairhead";
  stairhead.position.set(hx0, 0, hz0);
  const stairMouth = STAIRHEAD.width, stairRun = STAIRHEAD.run;
  const kerbMaterial = mat(dressing.stoneAlt, { roughness: 0.95 });
  const darkMaterial = mat(dressing.light.fog.color, { roughness: 1 });
  // The opening: a dark well, so it reads as somewhere to go rather than a slab.
  const well = new THREE.Mesh(track(new THREE.BoxGeometry(stairMouth - 0.12, STAIRHEAD.depth, stairRun - 0.12)), darkMaterial);
  well.position.y = -STAIRHEAD.depth / 2 - 0.01;
  stairhead.add(well);
  // Two steps falling in from the near edge, and the kerb around three sides — one mesh.
  const stoneParts: THREE.BufferGeometry[] = [];
  for (let step = 0; step < 2; step += 1) {
    stoneParts.push(placed(new THREE.BoxGeometry(stairMouth - 0.16, 0.07, stairRun / 3.2), 0, -0.09 - step * 0.16, stairRun / 2 - stairRun / 6.4 - step * (stairRun / 3.2)));
  }
  for (const [dx, dz, w, d] of [[0, -stairRun / 2, stairMouth, 0.14], [-stairMouth / 2, 0, 0.14, stairRun], [stairMouth / 2, 0, 0.14, stairRun]] as const) {
    stoneParts.push(placed(new THREE.BoxGeometry(w, 0.13, d), dx, 0.065, dz));
  }
  const stoneWork = shadowed(mergedMesh(stoneParts, kerbMaterial));
  track(stoneWork.geometry);
  stairhead.add(stoneWork);
  // The low rail on the far edge: two posts and a handrail, one mesh.
  const railMaterial = mat(dressing.metal, { roughness: 0.42, metalness: 0.55 });
  const railParts: THREE.BufferGeometry[] = [
    placed(new THREE.CylinderGeometry(0.03, 0.03, stairMouth - 0.16, 8), 0, 0.5, -stairRun / 2 + 0.07, [0, 0, Math.PI / 2]),
  ];
  for (const side of [-1, 1]) {
    railParts.push(placed(new THREE.CylinderGeometry(0.035, 0.04, 0.52, 8), side * (stairMouth / 2 - 0.08), 0.26, -stairRun / 2 + 0.07));
  }
  const rail = shadowed(mergedMesh(railParts, railMaterial));
  track(rail.geometry);
  stairhead.add(rail);
  contact(hx0, hz0, stairMouth * 0.7, 0.5);
  stairhead.userData.anchor = "cellar-stair";
  group.add(stairhead);

  scene.add(group);

  // ── Anchors, regions, poses ─────────────────────────────────────────────────
  const [sx, , sz] = COURT_LAYOUT.sundial, [mx, , mz] = COURT_LAYOUT.mailbox, [hx, , hz] = COURT_LAYOUT.hercules;
  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  // Labels carry the engraved words, so a twin reads what the stone says.
  /** The sign the building wears, in the twin's own words, appended to its label. */
  const signWords = (id: string): string => (signs[id] ? ` ${signs[id]!.aria}` : "");
  const anchorList = (): Anchor[] => [
    { id: "queen", position: at(0, 1.1, 0), zone: "queen", label: `The Queen — Everyday ${everyday.words}. Meet the Queen.`, door: { target: "queen" } },
    { id: "flagstone", position: at(fx, 0.1, fz), zone: "queen", label: `The Everyday flagstone — ${everyday.words}` },
    ...pieces.anchors().map((anchor) => ({ ...anchor, label: `${anchor.label} ${pieces.slots[anchor.id as PieceId].plate.words}. ${anchor.id === "rook" ? "Climb the Tower." : anchor.id === "bishop" ? "Go down to the Cellar." : "Open the cistern."}` })),
    { id: "sundial", position: at(sx, 1.0, sz), zone: "prop", label: tagWords ? `The sundial — next: ${tagWords}` : "The sundial — no dated commitment" },
    { id: "mailbox", position: at(mx, 1.2, mz), zone: "prop", label: mailbox.flagUp() ? "The mailbox, flag up — she noticed something" : "The mailbox — nothing new" },
    { id: "slip", position: at(mx + 0.55, 0.72, mz + 0.13), zone: "prop", label: slipWords.length ? `Since you were here: ${slipWords.join("; ")}` : "Since you were here — nothing yet" },
    ...cistern.anchors(),
    { id: "hercules", position: at(hx, 0.3, hz), zone: "prop", label: "Hercules, asleep", door: { target: "hercules" } },
    { id: "cellar-stair", position: at(hx0, 0.35, hz0), zone: "stair", label: "The cellar stairhead — go down to the Cellar" },
    { id: "gate", position: at(gx, 0.9, gz), zone: "gate", label: "The court gate" },
    { id: "boathouse", position: at(5.6, groundHeightAt(5.6, -10.9) + 1.0, -10.9), zone: "boathouse", label: `The Boathouse, down on the shore — the two of you. Go there when you want it.${signWords("boathouse")}` },
    { id: "library-hall", position: at(-4.7, groundHeightAt(-4.7, -11.6) + 1.3, -11.6), zone: "landmark", label: `The Library — the Standing Book's hall. Walk over and go in.${signWords("library-hall")}` },
    { id: "glasshouse-shed", position: at(-8.2, groundHeightAt(-8.2, -9.4) + 0.9, -9.4), zone: "landmark", label: `The Glasshouse, in the garden behind the Library — the planner's benches. Walk over and go in.${signWords("glasshouse-shed")}` },
    { id: "kitchen-cottage", position: at(-11.2, groundHeightAt(-11.2, -3.4) + 0.9, -3.4), zone: "landmark", label: `The Kitchen, smoke up — sit down and make a plan. Walk over and go in.${signWords("kitchen-cottage")}` },
    { id: "hercules-cottage", position: at(9.8, groundHeightAt(9.8, 5.6) + 0.9, 5.6), zone: "landmark", label: `Hercules’s Cottage, lamp on — a door for you and a smaller one for him. Walk over and go in.${signWords("hercules-cottage")}` },
    { id: "kiln-house", position: at(10.6, groundHeightAt(10.6, -4.4) + 1.0, -4.4), zone: "landmark", label: `The Kiln, the bottle stack smoking — the wheel, the bench and the shelf of fired pieces. Walk over and go in.${signWords("kiln-house")}` },
    { id: "campfire", position: at(7.2, groundHeightAt(7.2, -9.4) + 0.5, -9.4), zone: "landmark", label: `The campfire on the shore, in front of the Boathouse — where the month closes, the two of you. Walk down and sit.${signWords("campfire")}` },
  ];
  let queenRegions: (() => Region[]) | null = null;
  const regionList = (): Region[] => [
    ...(queenRegions ? queenRegions() : [{ id: "queen", group: "queen", label: "The Queen", box: box(-1.15, 0, -1.15, 1.15, 2.4, 1.15) }]),
    { id: "flagstone", group: "court", label: "The Everyday flagstone", box: box(fx - 0.85, 0, fz - 0.5, fx + 0.85, 0.12, fz + 0.5) },
    ...pieces.regions(),
    { id: "sundial", group: "court", label: "The sundial", box: box(sx - 0.7, 0, sz - 0.7, sx + 0.7, 1.5, sz + 0.7) },
    { id: "mailbox", group: "court", label: "The mailbox", box: box(mx - 0.3, 0, mz - 0.3, mx + 0.3, 1.5, mz + 0.3) },
    { id: "slip", group: "court", label: "Since you were here", box: box(mx + 0.2, 0.4, mz - 0.1, mx + 0.9, 1.0, mz + 0.3) },
    ...cistern.regions(),
    { id: "hercules", group: "court", label: "Hercules, asleep", box: box(hx - 0.7, 0, hz - 0.5, hx + 0.7, 0.55, hz + 0.5) },
    { id: "cellar-stair", group: "court", label: "The cellar stairhead", box: box(hx0 - STAIRHEAD.width / 2, 0, hz0 - STAIRHEAD.run / 2, hx0 + STAIRHEAD.width / 2, 0.55, hz0 + STAIRHEAD.run / 2) },
    { id: "gate", group: "court", label: "The court gate", box: box(gx - 1.2, 0, gz - 0.2, gx + 1.2, 1.7, gz + 0.2) },
    { id: "boathouse", group: "court", label: "The Boathouse, down on the shore", box: box(4.3, groundHeightAt(5.6, -10.9), -12.1, 6.9, groundHeightAt(5.6, -10.9) + 2.1, -9.7) },
    { id: "library-hall", group: "court", label: "The Library's hall", box: box(-6.2, groundHeightAt(-4.7, -11.6), -12.6, -3.2, groundHeightAt(-4.7, -11.6) + 2.7, -10.6) },
    { id: "glasshouse-shed", group: "court", label: "The Glasshouse in the garden", box: box(-9.2, groundHeightAt(-8.2, -9.4), -10.2, -7.2, groundHeightAt(-8.2, -9.4) + 1.8, -8.6) },
    { id: "kitchen-cottage", group: "court", label: "The Kitchen's cottage", box: box(-12.2, groundHeightAt(-11.2, -3.4), -4.3, -10.2, groundHeightAt(-11.2, -3.4) + 2.3, -2.5) },
    { id: "hercules-cottage", group: "court", label: "Hercules’s Cottage on the east lawn", box: box(8.8, groundHeightAt(9.8, 5.6), 4.6, 10.8, groundHeightAt(9.8, 5.6) + 2.1, 6.6) },
    { id: "kiln-house", group: "court", label: "The Kiln on the Making lawn", box: box(9.5, groundHeightAt(10.6, -4.4), -5.3, 11.7, groundHeightAt(10.6, -4.4) + 2.5, -3.5) },
    { id: "campfire", group: "court", label: "The campfire on the shore", box: box(6.0, groundHeightAt(7.2, -9.4), -10.6, 8.4, groundHeightAt(7.2, -9.4) + 0.9, -8.2) },
  ];

  // ── Reading → objects ───────────────────────────────────────────────────────
  let pendingRedraw = false;
  let lidK = 0;
  let coverage = MOSS_BY_CONDITION.settled;
  let tagWords: string | null = null;
  let slipWords: string[] = [];
  /** The lawn signs' words, kept so the twins read exactly what the plates say. */
  let signs: Record<string, CourtSign> = {};
  const jointColor = new THREE.Color(dressing.joint), mossColor = new THREE.Color(dressing.moss);
  function update(value: unknown): void {
    const reading = readCourtReading(value);
    const state = reading.condition?.state ?? "settled";
    const dulled = state === "wilting" || state === "weathered";
    const finish: PlateFinish = dulled && plateFinish(reading.freshness) === "glazed" ? "matte" : plateFinish(reading.freshness);
    everyday.set(engravedWords(reading.everyday), finish);
    pieces.setPlate("rook", reading.build.cents, finish);
    pieces.setPlate("bishop", reading.prepare.cents, finish);
    pieces.setPlate("knight", reading.protect.cents, finish);
    sundial.set(reading.next, finish);
    tagWords = reading.next ? reading.next.label : null;
    mailbox.setFlag(reading.noticed !== null);
    mailbox.setSlip(reading.slip, finish);
    slipWords = slipLines(reading.slip);
    coverage = MOSS_BY_CONDITION[state];
    jointMaterial.color.copy(jointColor).lerp(mossColor, Math.min(1, coverage * 0.9));
    pads.count = Math.round(PADS * coverage);
    crack.visible = state === "weathered";
    partner.visible = reading.partner?.fresh === true;
    // The door signs: one plate per building, re-engraved only when the words change.
    signs = courtSigns(value as Parameters<typeof courtSigns>[0]);
    for (const { id, plate } of signPlates) {
      const sign = signs[id];
      plate.set(sign ? sign.plate : `${SIGN_TITLES[COURT_SIGN_PLACES[id]!]}\n—`, finish);
    }
    cistern.update(value);
    pendingRedraw = true;
  }
  update(options.reading ?? EMPTY_COURT_READING);

  function animate(t: number, _dt: number): boolean {
    // Only Hercules's tail moves, and only in slow, occasional flicks. Everything else is still.
    const phase = ((t % 9) + 9) % 9;
    const flicking = phase < 2.2;
    tailPivot.rotation.y = flicking ? TAIL_REST + Math.sin(phase * 2.6) * 0.32 * (1 - phase / 2.2) : TAIL_REST;
    const redraw = pendingRedraw;
    pendingRedraw = false;
    return flicking || redraw;
  }

  return {
    group,
    update,
    animate,
    anchors: anchorList,
    poses: () => courtPoses(anchorList()),
    regions: regionList,
    attachQueen(object, regions) { queenSlot.clear(); queenSlot.add(object); queenRegions = regions ?? null; pendingRedraw = true; },
    detachQueen() { const first = queenSlot.children[0] ?? null; if (first) queenSlot.remove(first); queenRegions = null; return first; },
    pieces,
    ready: pieces.ready,
    words: () => ({ everyday: everyday.words, rook: pieces.slots.rook.plate.words, bishop: pieces.slots.bishop.plate.words, knight: pieces.slots.knight.plate.words, tag: tagWords, slip: [...slipWords], flagUp: mailbox.flagUp() }),
    signs: () => ({ ...signs }),
    mossCoverage: () => coverage,
    setLid(k) {
      const next = Math.max(0, Math.min(1, Number.isFinite(k) ? k : 0));
      if (next === lidK) return;
      lidK = next;
      group.position.y = next * STAIRHEAD.lift;
      group.visible = next < 0.999;
      pendingRedraw = true;
    },
    lid: () => lidK,
    drawCalls() {
      let count = 0;
      group.traverse((node) => { if ((node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh) && node.visible) count++; });
      return count;
    },
    dispose() {
      scene.remove(group);
      pieces.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}

/**
 * The registry entry: `PLACES.court`. Accepts writer B's `HarbourReading` and
 * any `CourtDressing`/ThemeId. Registered on import, the way the tower and the
 * cellar are, so the shell can raise it by id like any other place.
 */
export const courtPlace: Place = registerPlace({
  id: "court",
  build(scene, dressing, reading, quality, context) {
    return createCourt(scene, { dressing: courtDressingFrom(dressing), reading: readCourtReading(reading), quality, signal: context?.signal, onLanded: () => context?.invalidate() });
  },
});

export { COURT_PIECES, PIECE_IDS };
