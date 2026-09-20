import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { FundPulseFreshness } from "../../core/fundPulse.ts";
import type { HouseCondition } from "../../core/houseCondition.ts";
import type { Anchor, Place, PlaceHandle, Pose, Region } from "../scene/place.ts";
import { courtDressingFrom, type CourtDressing, type CourtProp } from "./dressing.ts";
import { EngravedPlate, engravedWords, plateFinish, seeded, type PlateFinish } from "./engraved.ts";
import { createMailbox, slipLines } from "./mailbox.ts";
import { COURT_PIECES, PIECE_IDS, createCourtPieces, type CourtPieces, type CourtPiecesOptions, type PieceId } from "./pieces.ts";
import { createSundial } from "./sundial.ts";

/**
 * The Court — the first screen. A worn chessboard terrace with the Queen's spot
 * at the centre, her three at three points, the Everyday flagstone at her feet,
 * a sundial, a mailbox with the slip, a low gate, Hercules asleep, and the
 * partner's pin at the gate. Everything here is a "model village" object:
 * MeshStandardMaterial, no textures but the engraved plates.
 */

/** Layout shared with the camera poses (writer C) — +z faces the camera. */
export const COURT_LAYOUT = {
  terraceRadius: 6,
  lawnOuter: 9.5,
  board: 8,
  tile: 1.05,
  joint: 0.06,
  tileHeight: 0.12,
  queen: [0, 0, 0],
  flagstone: [0, 0, 1.6],
  sundial: [4.0, 0, 3.2],
  mailbox: [-1.2, 0, 5.4],
  gate: [0, 0, 6.2],
  hercules: [1.35, 0, 1.85],
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
  /** The Queen's spot: writer B's `queenPlace` seats her here. Replaces any previous occupant. */
  attachQueen(object: THREE.Object3D): void;
  detachQueen(): THREE.Object3D | null;
  pieces: CourtPieces;
  /** Resolves when the three pieces have landed or failed. */
  ready: Promise<void>;
  /** Current engraved words, for the DOM twins and tests. */
  words(): { everyday: string; rook: string; bishop: string; knight: string; tag: string | null; slip: string[]; flagUp: boolean };
  mossCoverage(): number;
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
    const { x, y, z } = anchor.position;
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
  const shadowed = <T extends THREE.Object3D>(object: T, cast = true, receive = true): T => { object.castShadow = full && cast; object.receiveShadow = receive; return object; };

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
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1), euler = new THREE.Euler();
  const half = (board * tile) / 2 - tile / 2;
  const crackedIndex = 27; // row 3, column 3 — the tile the frost got to
  for (let row = 0; row < board; row++) for (let col = 0; col < board; col++) {
    const index = row * board + col;
    position.set(col * tile - half + (rand() - 0.5) * 0.02, -tileHeight / 2 - rand() * 0.012, row * tile - half + (rand() - 0.5) * 0.02);
    euler.set((rand() - 0.5) * 0.012, (rand() - 0.5) * 0.02, (rand() - 0.5) * 0.012);
    quaternion.setFromEuler(euler);
    matrix.compose(position, quaternion, scale);
    paving.setMatrixAt(index, matrix);
    tone.copy((row + col) % 2 ? stoneAlt : stone).offsetHSL((rand() - 0.5) * 0.012, (rand() - 0.5) * 0.06, (rand() - 0.5) * 0.07);
    paving.setColorAt(index, tone);
  }
  paving.instanceMatrix.needsUpdate = true;
  if (paving.instanceColor) paving.instanceColor.needsUpdate = true;
  group.add(paving);

  // Joints: a plane under the tiles whose colour moves from joint to moss with coverage.
  const jointMaterial = mat(dressing.joint, { roughness: 1 });
  const joints = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(board * tile + 0.05, board * tile + 0.05)), jointMaterial), false);
  joints.rotation.x = -Math.PI / 2; joints.position.y = -0.008; group.add(joints);
  // Moss pads at joint crossings: one instanced mesh, count scaled by coverage.
  const PADS = full ? 56 : 28;
  const pads = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.075, 7, 5)), mat(dressing.moss, { roughness: 1 }), PADS);
  pads.name = "moss";
  const padRand = seeded(0x3055);
  for (let i = 0; i < PADS; i++) {
    const cx = Math.floor(padRand() * (board - 1)) + 1, cz = Math.floor(padRand() * (board - 1)) + 1;
    position.set(cx * tile - half - tile / 2 + (padRand() - 0.5) * 0.12, -0.005, cz * tile - half - tile / 2 + (padRand() - 0.5) * 0.12);
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
  crack.position.set(crackCol * tile - half, 0.004, crackRow * tile - half); crack.rotation.y = 0.62; crack.visible = false; group.add(crack);

  // ── Everyday flagstone: the one big number, at her feet ─────────────────────
  const [fx, , fz] = COURT_LAYOUT.flagstone;
  const flagstone = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.7, 0.08, 1.0)), mat(dressing.plate, { roughness: 0.8 })));
  flagstone.position.set(fx, 0.04, fz); flagstone.userData.anchor = "flagstone"; group.add(flagstone);
  const everyday = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "large" }, 1.52, 0.84));
  everyday.mesh.rotation.x = -Math.PI / 2; everyday.mesh.position.set(fx, 0.086, fz); everyday.mesh.userData.anchor = "flagstone"; group.add(everyday.mesh);

  // ── The Queen's spot ────────────────────────────────────────────────────────
  const queenSlot = new THREE.Group(); queenSlot.name = "queen-slot"; queenSlot.position.set(...COURT_LAYOUT.queen); group.add(queenSlot);

  // ── Her three, on plinths ───────────────────────────────────────────────────
  const pieces = createCourtPieces(dressing, { quality, signal: options.signal, load: options.load, loadModels: options.loadModels, onLanded: (id) => { pendingRedraw = true; options.onLanded?.(id); } });
  group.add(pieces.group);

  // ── Sundial and mailbox ─────────────────────────────────────────────────────
  const sundial = track(createSundial(dressing)); sundial.group.position.set(...COURT_LAYOUT.sundial); group.add(sundial.group);
  const mailbox = track(createMailbox(dressing)); mailbox.group.position.set(...COURT_LAYOUT.mailbox); group.add(mailbox.group);
  if (!full) [sundial.group, mailbox.group].forEach((g) => g.traverse((node) => { node.castShadow = false; }));

  // ── The gate: two posts, two rails, a low arch ──────────────────────────────
  const [gx, , gz] = COURT_LAYOUT.gate;
  const gatePosts = shadowed(mergedMesh([placed(new THREE.BoxGeometry(0.22, 1.5, 0.22), gx - 1.05, 0.75, gz), placed(new THREE.BoxGeometry(0.22, 1.5, 0.22), gx + 1.05, 0.75, gz)], mat(dressing.gate.post, { roughness: 0.8 })));
  const gateRails = shadowed(mergedMesh([placed(new THREE.BoxGeometry(1.9, 0.07, 0.06), gx, 0.5, gz), placed(new THREE.BoxGeometry(1.9, 0.07, 0.06), gx, 0.92, gz)], mat(dressing.gate.rail, { roughness: 0.7 })));
  const gateArch = shadowed(mergedMesh([
    placed(new THREE.TorusGeometry(1.05, 0.06, 8, 26, Math.PI), gx, 1.5, gz),
    placed(new THREE.SphereGeometry(0.1, 10, 8), gx - 1.05, 1.58, gz),
    placed(new THREE.SphereGeometry(0.1, 10, 8), gx + 1.05, 1.58, gz),
  ], mat(dressing.gate.accent, { roughness: 0.4, metalness: dressing.theme === "classic" ? 0.5 : 0.1 })));
  track(gatePosts.geometry); track(gateRails.geometry); track(gateArch.geometry);
  group.add(gatePosts, gateRails, gateArch);

  // ── Hercules, asleep: a porcelain loaf ──────────────────────────────────────
  const hercules = new THREE.Group(); hercules.name = "hercules"; hercules.position.set(...COURT_LAYOUT.hercules); hercules.rotation.y = -0.5; group.add(hercules);
  const porcelain = mat(dressing.porcelain, { roughness: 0.35 });
  const pink = mat(dressing.pink, { roughness: 0.6 });
  const body = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.3, 18, 12)), porcelain)); body.scale.set(1.3, 0.62, 0.92); body.position.y = 0.19; hercules.add(body);
  const head = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.19, 16, 12)), porcelain)); head.scale.set(1, 0.9, 0.95); head.position.set(0.36, 0.28, 0.04); hercules.add(head);
  const ears = shadowed(mergedMesh([placed(new THREE.ConeGeometry(0.06, 0.11, 8), 0.42, 0.45, -0.07, [0.15, 0, -0.35]), placed(new THREE.ConeGeometry(0.06, 0.11, 8), 0.42, 0.45, 0.15, [-0.15, 0, -0.35])], pink));
  track(ears.geometry); hercules.add(ears);
  const nose = new THREE.Mesh(track(new THREE.SphereGeometry(0.022, 8, 6)), pink); nose.position.set(0.55, 0.24, 0.05); hercules.add(nose);
  const tailPivot = new THREE.Group(); tailPivot.position.set(-0.36, 0.1, 0.02); hercules.add(tailPivot);
  const tail = shadowed(new THREE.Mesh(track(new THREE.TorusGeometry(0.2, 0.035, 6, 14, Math.PI * 0.85)), porcelain)); tail.rotation.x = Math.PI / 2; tail.rotation.z = Math.PI; tail.position.x = -0.2; tailPivot.add(tail);
  const TAIL_REST = 0.1; tailPivot.rotation.y = TAIL_REST;

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
  const propBuilders: Record<CourtProp, () => THREE.Object3D[]> = {
    "terracotta-pot": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.3, 0.22, 0.42, 14), 0, 0.21, 0)), propMaterials.clay), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.34, 12, 9), 0, 0.6, 0)), propMaterials.leaf)],
    "herb-pot": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.2, 0.15, 0.3, 12), 0, 0.15, 0)), propMaterials.clay), new THREE.Mesh(track(placed(new THREE.ConeGeometry(0.24, 0.5, 9), 0, 0.53, 0)), propMaterials.leaf)],
    "brass-lantern": () => [new THREE.Mesh(track(placed(new THREE.BoxGeometry(0.26, 0.5, 0.26), 0, 0.55, 0)), propMaterials.metal), new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), 0, 0.15, 0)), propMaterials.timber)],
    "clay-urn": () => [new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.32, 14, 10), 0, 0.36, 0)), propMaterials.clay), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.28, 12, 9), 0, 0.82, 0)), propMaterials.bloom)],
    "washi-lantern": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.22, 0.22, 0.5, 12), 0, 0.75, 0)), propMaterials.paper), new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), 0, 0.25, 0)), propMaterials.timber)],
    "album-planter": () => [new THREE.Mesh(track(mergeGeometries([placed(new THREE.BoxGeometry(0.5, 0.42, 0.12), -0.18, 0.21, 0), placed(new THREE.BoxGeometry(0.5, 0.36, 0.12), 0, 0.18, 0.02), placed(new THREE.BoxGeometry(0.5, 0.4, 0.12), 0.18, 0.2, -0.01)], false) ?? new THREE.BoxGeometry(0.6, 0.4, 0.3)), propMaterials.spine), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.28, 12, 9), 0, 0.6, 0)), propMaterials.leaf)],
    "paper-rose": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.24, 0.18, 0.36, 12), 0, 0.18, 0)), propMaterials.paper), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.3, 12, 9), 0, 0.6, 0)), propMaterials.bloom)],
    "heart-pot": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.26, 0.2, 0.36, 12), 0, 0.18, 0)), propMaterials.clay), new THREE.Mesh(track(mergeGeometries([placed(new THREE.SphereGeometry(0.16, 10, 8), -0.12, 0.62, 0), placed(new THREE.SphereGeometry(0.16, 10, 8), 0.12, 0.62, 0), placed(new THREE.ConeGeometry(0.26, 0.3, 4), 0, 0.42, 0, [Math.PI, Math.PI / 4, 0])], false) ?? new THREE.SphereGeometry(0.2, 10, 8)), propMaterials.bloom)],
    "wharf-barrel": () => [new THREE.Mesh(track(placed(new THREE.CylinderGeometry(0.3, 0.27, 0.56, 14), 0, 0.28, 0)), propMaterials.timber), new THREE.Mesh(track(placed(new THREE.SphereGeometry(0.3, 12, 9), 0, 0.7, 0)), propMaterials.leaf)],
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
    propsGroup.add(holder);
  });

  scene.add(group);

  // ── Anchors, regions, poses ─────────────────────────────────────────────────
  const [sx, , sz] = COURT_LAYOUT.sundial, [mx, , mz] = COURT_LAYOUT.mailbox, [hx, , hz] = COURT_LAYOUT.hercules;
  const anchorList = (): Anchor[] => [
    { id: "queen", position: new THREE.Vector3(0, 1.1, 0), zone: "queen", label: "The Queen — Everyday", target: "queen" },
    ...pieces.anchors(),
    { id: "sundial", position: new THREE.Vector3(sx, 1.0, sz), zone: "prop", label: "The sundial — next dated commitment" },
    { id: "mailbox", position: new THREE.Vector3(mx, 1.2, mz), zone: "prop", label: "The mailbox — what she noticed" },
    { id: "slip", position: new THREE.Vector3(mx + 0.55, 0.72, mz + 0.13), zone: "prop", label: "Since you were here" },
    { id: "hercules", position: new THREE.Vector3(hx, 0.3, hz), zone: "prop", label: "Hercules, asleep", target: "hercules" },
    { id: "gate", position: new THREE.Vector3(gx, 0.9, gz), zone: "gate", label: "The court gate" },
  ];
  const regionList = (): Region[] => [
    { id: "queen", box: new THREE.Box3(new THREE.Vector3(-1.15, 0, -1.15), new THREE.Vector3(1.15, 2.4, 1.15)) },
    { id: "flagstone", box: new THREE.Box3(new THREE.Vector3(fx - 0.85, 0, fz - 0.5), new THREE.Vector3(fx + 0.85, 0.12, fz + 0.5)) },
    ...pieces.regions(),
    { id: "sundial", box: new THREE.Box3(new THREE.Vector3(sx - 0.7, 0, sz - 0.7), new THREE.Vector3(sx + 0.7, 1.5, sz + 0.7)) },
    { id: "mailbox", box: new THREE.Box3(new THREE.Vector3(mx - 0.3, 0, mz - 0.3), new THREE.Vector3(mx + 0.3, 1.5, mz + 0.3)) },
    { id: "slip", box: new THREE.Box3(new THREE.Vector3(mx + 0.2, 0.4, mz - 0.1), new THREE.Vector3(mx + 0.9, 1.0, mz + 0.3)) },
    { id: "hercules", box: new THREE.Box3(new THREE.Vector3(hx - 0.7, 0, hz - 0.5), new THREE.Vector3(hx + 0.7, 0.55, hz + 0.5)) },
    { id: "gate", box: new THREE.Box3(new THREE.Vector3(gx - 1.2, 0, gz - 0.2), new THREE.Vector3(gx + 1.2, 1.7, gz + 0.2)) },
  ];

  // ── Reading → objects ───────────────────────────────────────────────────────
  let pendingRedraw = false;
  let coverage = MOSS_BY_CONDITION.settled;
  let tagWords: string | null = null;
  let slipWords: string[] = [];
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
    attachQueen(object) { queenSlot.clear(); queenSlot.add(object); pendingRedraw = true; },
    detachQueen() { const first = queenSlot.children[0] ?? null; if (first) queenSlot.remove(first); return first; },
    pieces,
    ready: pieces.ready,
    words: () => ({ everyday: everyday.words, rook: pieces.slots.rook.plate.words, bishop: pieces.slots.bishop.plate.words, knight: pieces.slots.knight.plate.words, tag: tagWords, slip: [...slipWords], flagUp: mailbox.flagUp() }),
    mossCoverage: () => coverage,
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

/** The registry entry: `PLACES.court`. Accepts writer B's `HarbourReading` and any `CourtDressing`/ThemeId. */
export const courtPlace: Place = {
  id: "court",
  build(scene, dressing, reading, quality) {
    return createCourt(scene, { dressing: courtDressingFrom(dressing), reading: readCourtReading(reading), quality });
  },
};

export { COURT_PIECES, PIECE_IDS };
