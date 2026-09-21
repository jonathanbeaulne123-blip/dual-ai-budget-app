import * as THREE from "three";
import type { TowerBank, TowerReading, TowerShelf } from "../data/reading.ts";
import { EngravedPlate, engravedWords, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { bankHeight, createBankSculpture, squash, SQUASH_SECONDS, type BankSculpture } from "./banks.ts";
import { createLanding, LANDING_LAYOUT, type Landing } from "./landing.ts";
import { towerDressingFrom, type TowerDressing } from "./dressing.ts";

/**
 * The Rook's Tower — the Loft as a place (BUILD_PLAN_SLICE2 §2).
 *
 * A round stone tower, open on the camera's side, with one timber floor per
 * rack shelf (the bottom shelf is the landing), a spiral stair up the inside
 * wall, a window letting the day in, and the roof lifted off and hanging
 * overhead so you can see down into it. Each bank on a floor is the studio's
 * own sculpted cat, **sized to its goal** and **filled to its backing step**.
 *
 * Nothing here moves money. The jug, the money gun, the rack's controls and
 * Confirm all stay in `src/queen/QueenLoft.tsx`; the tower's anchors are doors
 * that open it. The shelf marks (share, cutoff, full) are read and shown,
 * never edited.
 */

export const TOWER_LAYOUT = {
  /** Interior radius of the round wall, and how thick the stone is. */
  radius: 3.0,
  wall: 0.34,
  /** The wall is open toward the camera (+z); the gap is this wide, in radians. */
  gap: 1.55,
  /** Floor-to-floor. The landing is floor 0 at y = 0. Tall enough that an eye standing on a floor has a room over its head and not a lid. */
  floorHeight: 1.92,
  /** Headroom above the top floor before the wall's top course. */
  headroom: 1.25,
  /** At least a landing and one floor above it; never more than four. */
  minFloors: 2,
  maxFloors: 4,
  /** Banks stand in a line across each floor, this far forward of its centre. */
  bankZ: 0.25,
  bankSpread: 1.95,
  /** Banks stand a step apart from the middle outward; the spread is only the limit. */
  bankStep: 0.92,
  /** A portrait phone holds about 1.4 world units across at the tower's own distance, so its rack closes up. */
  phoneBankStep: 0.58,
  phoneBankSpread: 1.15,
  /** The rack's post, and the brass end-plate at the other end of each shelf. */
  post: [2.5, 0, 0.9] as const,
  endPlate: [-2.45, 0, 0.9] as const,
  /** The stair's foot, in radians from +z, winding away from the open side. */
  stairFoot: 1.05,
  stairTurn: 1.55,
  /** The window sits in the back wall, on the top floor. */
  windowAngle: Math.PI,
} as const;

/** Zones whose anchors are props or routes rather than doors into a surface. */
export const TOWER_PROP_ZONES: readonly string[] = ["stair", "shelf", "prop"];

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const asNumber = (value: unknown, fallback = 0): number => (typeof value === "number" && Number.isFinite(value) ? value : fallback);
const asText = (value: unknown, fallback = ""): string => (typeof value === "string" ? value : fallback);
const CATEGORIES: readonly string[] = ["protect", "everyday", "build", "prepare"];

/** Narrows a bank row; a missing figure reads as nothing rather than as a guess. */
function readBank(value: unknown, index: number): TowerBank {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const key = asText(row.key) || `bank-${index}`;
  const category = CATEGORIES.includes(asText(row.category)) ? (asText(row.category) as TowerBank["category"]) : "build";
  return {
    key,
    goalId: typeof row.goalId === "string" && row.goalId ? row.goalId : null,
    name: asText(row.name) || "A bank",
    cents: asNumber(row.cents),
    targetCents: asNumber(row.targetCents),
    step: clamp(Math.round(asNumber(row.step)), 0, 10),
    category,
    sculptSeed: asText(row.sculptSeed) || key,
  };
}

function readShelf(value: unknown, index: number): TowerShelf {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    id: asText(row.id) || `shelf-${index + 1}`,
    share: clamp(Math.round(asNumber(row.share, 1)), 1, 10),
    cutoff: clamp(Math.round(asNumber(row.cutoff, 20)), 0, 20),
    full: row.full === true,
    banks: Array.isArray(row.banks) ? row.banks.map(readBank) : [],
  };
}

export const EMPTY_TOWER_READING: TowerReading = {
  shelves: [],
  jug: { safeCents: 0, custodian: false, holder: null },
  gun: { available: false },
  largestTargetCents: 0,
  smallestTargetCents: 0,
};

/**
 * Accepts the whole `HarbourReading` (reads `.tower` off it), a bare
 * `TowerReading`, or anything else — an unreadable reading gives an empty
 * tower with bare shelves, which is a real state, not an error.
 */
export function readTowerReading(value: unknown): TowerReading {
  const outer = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const source = (outer.tower && typeof outer.tower === "object" ? outer.tower : outer) as Record<string, unknown>;
  const shelves = Array.isArray(source.shelves) ? source.shelves.map(readShelf) : [];
  const jugRow = (source.jug && typeof source.jug === "object" ? source.jug : {}) as Record<string, unknown>;
  const gunRow = (source.gun && typeof source.gun === "object" ? source.gun : {}) as Record<string, unknown>;
  const targets = shelves.flatMap((shelf) => shelf.banks.map((bank) => bank.targetCents)).filter((cents) => cents > 0);
  return {
    shelves,
    jug: {
      safeCents: asNumber(jugRow.safeCents),
      custodian: jugRow.custodian === true,
      holder: typeof jugRow.holder === "string" && jugRow.holder ? jugRow.holder : null,
    },
    gun: { available: gunRow.available === true },
    largestTargetCents: asNumber(source.largestTargetCents) || (targets.length ? Math.max(...targets) : 0),
    smallestTargetCents: asNumber(source.smallestTargetCents) || (targets.length ? Math.min(...targets) : 0),
  };
}

/** Floors follow the rack: one per shelf, never fewer than two or more than four. */
export function towerFloorCount(shelves: readonly TowerShelf[]): number {
  return clamp(shelves.length || TOWER_LAYOUT.minFloors, TOWER_LAYOUT.minFloors, TOWER_LAYOUT.maxFloors);
}

/**
 * Floor 0 is the landing, and the rack hangs top-shelf-highest: the rack's
 * **last** shelf is the landing's, its first is the top floor's. Returns null
 * for a floor with no shelf (an empty rack's upper floor).
 */
export function shelfOnFloor(shelves: readonly TowerShelf[], floor: number): TowerShelf | null {
  const floors = towerFloorCount(shelves);
  const index = shelves.length - 1 - floor;
  return floor < floors && index >= 0 && index < shelves.length ? shelves[index]! : null;
}

/** Where a bank stands on its floor: a line across the room, left to right. */
export function bankSpot(index: number, count: number, composition: Composition = "desktop"): { x: number; z: number } {
  if (count <= 1) return { x: 0, z: TOWER_LAYOUT.bankZ };
  // A step apart, centred. Stretching two banks to the ends of the shelf leaves a
  // hole where the shelf's whole story should be; the spread is the limit, not the gap.
  const phone = composition === "phone";
  const widest = phone ? TOWER_LAYOUT.phoneBankSpread : TOWER_LAYOUT.bankSpread;
  const step = Math.min(phone ? TOWER_LAYOUT.phoneBankStep : TOWER_LAYOUT.bankStep, (widest * 2) / (count - 1));
  return { x: -(step * (count - 1)) / 2 + index * step, z: TOWER_LAYOUT.bankZ + (index % 2 ? -0.22 : 0.22) };
}

/** Words for a shelf's plate and twin: shares are parts of the rack, never money. */
export function shelfWords(shelf: TowerShelf | null, total: number, floor: number, floors: number): string {
  if (!shelf) return "An empty floor — nothing on the shelf yet";
  const place = floor === floors - 1 ? "Top shelf" : floor === 0 ? "The landing shelf" : `Shelf ${floors - floor}`;
  const parts = `${shelf.share} ${shelf.share === 1 ? "part" : "parts"} of ${total}`;
  const mark = shelf.full ? "at its mark" : `mark at ${Math.round((shelf.cutoff / 20) * 100)}%`;
  return `${place} — ${parts}, ${mark}`;
}

export type TowerHandle = PlaceHandle & {
  update(value: unknown): void;
  /** The roof: 0 seated on the wall, 1 lifted off and hanging above. The shell eases it on arrival. */
  setRoof(k: number): void;
  roof(): number;
  /** The jug's tilt, 0 upright to 1 pouring. Shown, never done: the pour lives in the Loft. */
  setPour(k: number): void;
  /** Reduced motion: no squash, no roof lift — the roof is simply already off. */
  setReduced(reduced: boolean): void;
  /** Bank keys on the floors, bottom floor first. */
  banks(): string[];
  /** How many times the floors have been rebuilt from a changed rack. */
  rebuilds(): number;
  words(): { shelves: string[]; banks: string[]; jug: string; gun: string; empty: boolean };
  /** Meshes drawn for the tower itself — the sculptures are counted separately. */
  drawCalls(): number;
  sculptureCount(): number;
  landing: Landing;
};

export type TowerOptions = {
  dressing: TowerDressing;
  reading?: unknown;
  quality: RenderTier;
  /** Left undefined, the place asks the page; tests and the shell pass it. */
  reducedMotion?: boolean;
  /** A frame is wanted (a sculpture started moving). */
  onAnimate?: () => void;
  /** Which frame the tower is being composed for; a portrait phone closes the rack up. */
  composition?: Composition;
};

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== "undefined" && typeof window.matchMedia === "function"
      && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch { return false; }
}

/**
 * The camera stands below the lifted roof and looks in, not down on it: the
 * Court's own tilt limit (`COURT_BOUNDS.maxPhi`) is the binding constraint, so
 * the target sits low and the distance carries the height instead.
 */
/**
 * Where you stand in the Tower. Not outside it: at r = 11 the eye clears the
 * wall's top course and the tower reads as a cut-open model on a lawn, with
 * the lifted roof hanging in the middle of the frame and the island's sea
 * around it. These two poses bring the eye in through the wall's open side to
 * just beyond the sill — about z = +5 — at a person's height on the landing,
 * so the round wall wraps the whole background, the floor above crops the top
 * of the frame, and the rack of banks is the thing you are looking at.
 */
// The eye sits `r·cos(phi)` **above** the target, so a low eye needs a low
// target and a tilt close to the horizon. Desktop stands on the landing at
// about 1.4 high and 2.5 forward of the middle — inside the wall, so the round
// stone wraps the background and the floor above is the ceiling. A portrait
// phone cannot hold the rack's width at any distance the tower allows (it
// would need r ≈ 9, well outside the wall), so the phone takes the tower the
// way a tower wants to be taken in a portrait frame: up the well, the landing
// under the eye and the floors above it stacked.
const PHONE_TOWER: Pose = { target: [0, 0.74, 0.25], r: 2.7, theta: 0.02, phi: 1.37 };
const DESKTOP_TOWER: Pose = { target: [0, 0.5, 0.25], r: 3.25, theta: 0.10, phi: 1.375 };

/**
 * Camera poses in the one convention every place is written in:
 * `<key>:<composition>` — `tower:phone`, `object:<anchor>:desktop` — which
 * `scene/place.ts`'s `poseFor` resolves.
 */
export function towerPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "tower:phone": PHONE_TOWER,
    "tower:desktop": DESKTOP_TOWER,
    "sky:phone": { target: [0, 2.2, 0], r: 17, theta: 0, phi: 0.6 },
    "sky:desktop": { target: [0, 2.4, 0], r: 19, theta: 0.28, phi: 0.66 },
    // The door frieze: what the band above an open tool shows — the rack close,
    // level, filling a wide short frame (harbour.css `--harbour-band`).
    "door:phone": { target: [0, 0.55, 0.25], r: 2.2, theta: 0.02, phi: 1.3 },
    "door:desktop": { target: [0, 0.55, 0.25], r: 2.4, theta: 0.06, phi: 1.3 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 6) * 0.7, -0.7, 0.7);
    // Closer than the room's own pose, always: looking at a thing is stepping toward it.
    const close = anchor.zone === "bank" ? 1.75 : anchor.zone === "shelf" ? 2.35 : 2.15;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.5, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.5, y), z], r: close + 0.45, theta: theta + 0.22, phi: 1.14 };
  }
  return poses;
}

export function createTower(scene: THREE.Scene, options: TowerOptions): TowerHandle {
  const { dressing } = options;
  const full = options.quality === "full";
  let reduced = options.reducedMotion ?? prefersReducedMotion();

  const group = new THREE.Group();
  group.name = "tower";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0, ...extra }));

  const stoneMaterial = mat(dressing.stone, { roughness: 0.94, side: THREE.DoubleSide });
  const courseMaterial = mat(dressing.stoneAlt, { roughness: 0.92 });
  const mortarMaterial = mat(dressing.mortar, { roughness: 1 });
  const timberMaterial = mat(dressing.timber, { roughness: 0.82 });
  const boardMaterial = mat(dressing.floorboard, { roughness: 0.78 });
  const beamMaterial = mat(dressing.beam, { roughness: 0.85 });
  // The ceiling of the floor you stand on. It faces down, so the sun never touches it and
  // only the hemisphere's ground colour does: a beam-dark underside reads as a black lid.
  const ceilingMaterial = mat(dressing.roofUnder, { roughness: 0.92 });
  const brassMaterial = mat(dressing.brass, { roughness: 0.34, metalness: 0.62 });
  const ropeMaterial = mat(dressing.rope, { roughness: 0.95 });
  const lampMaterial = mat(dressing.lamp, { roughness: 0.4, metalness: 0.5 });
  const glowMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.lampGlow, transparent: true, opacity: 0.85 }));
  const daylightMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.windowLight, transparent: true, opacity: 0.085, depthWrite: false, side: THREE.DoubleSide }));
  const glassMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.windowLight, transparent: true, opacity: 0.6 }));
  const frameMaterial = mat(dressing.windowFrame, { roughness: 0.7 });
  const roofMaterial = mat(dressing.roof, { roughness: 0.88, side: THREE.DoubleSide });
  const roofTrimMaterial = mat(dressing.roofTrim, { roughness: 0.4, metalness: 0.5 });
  const roofUnderMaterial = mat(dressing.roofUnder, { roughness: 0.95 });

  const shadowed = <T extends THREE.Object3D>(object: T, cast = true, receive = true): T => {
    object.castShadow = cast && full; object.receiveShadow = receive; return object;
  };

  // ── The landing's furniture (built once; what stands on it changes) ─────────
  const landing = createLanding(dressing);
  disposables.push(landing);
  group.add(landing.group);

  // ── Shell: everything whose size follows the number of floors ──────────────
  type Shell = { group: THREE.Group; roof: THREE.Group; wallTop: number; dispose(): void };
  let shell: Shell | null = null;
  let shellFloors = -1;

  function buildShell(floors: number): Shell {
    const host = new THREE.Group();
    host.name = "tower-shell";
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(item: T): T => { own.push(item); return item; };
    const contacts = keep(createContactShadows({ ink: dressing.mortar }));
    const { radius, wall, gap, floorHeight, headroom } = TOWER_LAYOUT;
    const wallTop = (floors - 1) * floorHeight + headroom;

    // The round wall, open toward the camera. One open-ended cylinder, drawn both sides.
    const wallMesh = shadowed(new THREE.Mesh(
      keep(new THREE.CylinderGeometry(radius + wall, radius + wall, wallTop, 40, 1, true, gap / 2, Math.PI * 2 - gap)),
      stoneMaterial,
    ), true, true);
    wallMesh.position.y = wallTop / 2;
    wallMesh.userData.anchor = "wall";
    host.add(wallMesh);

    // A base course at the foot and a coping course at the top: the tower sits and is finished.
    const base = shadowed(new THREE.Mesh(keep(new THREE.CylinderGeometry(radius + wall + 0.16, radius + wall + 0.22, 0.26, 40, 1, true, gap / 2, Math.PI * 2 - gap)), courseMaterial));
    base.position.y = 0.13; host.add(base);
    const coping = shadowed(new THREE.Mesh(keep(new THREE.CylinderGeometry(radius + wall + 0.14, radius + wall + 0.14, 0.2, 40, 1, true, gap / 2, Math.PI * 2 - gap)), courseMaterial));
    coping.position.y = wallTop - 0.1; host.add(coping);

    // ── The floors: an underside disc, the boards on top, a rim at the edge ──
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);

    // A mortar course runs round the wall at every floor line, so the storeys read from
    // outside. Cut like the wall itself, so its gap is the wall's gap exactly.
    const courseGeometry = keep(new THREE.CylinderGeometry(radius + wall + 0.05, radius + wall + 0.05, 0.11, 40, 1, true, gap / 2, Math.PI * 2 - gap));
    const courses = new THREE.InstancedMesh(courseGeometry, mortarMaterial, floors);
    courses.name = "floor-courses";
    shadowed(courses, false, true);
    for (let i = 0; i < floors; i++) {
      position.set(0, i * floorHeight, 0);
      quaternion.identity();
      scale.set(1, 1, 1);
      courses.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    courses.instanceMatrix.needsUpdate = true;
    host.add(courses);
    // The same course on the inside face: from a landing the wall is the whole background,
    // and a bare cylinder there is a gradient, not masonry.
    const innerGeometry = keep(new THREE.CylinderGeometry(radius - 0.015, radius - 0.015, 0.09, 40, 1, true, gap / 2, Math.PI * 2 - gap));
    const inner = new THREE.InstancedMesh(innerGeometry, mortarMaterial, floors * 2);
    inner.name = "inner-courses";
    shadowed(inner, false, true);
    for (let i = 0; i < floors * 2; i++) {
      position.set(0, (i / 2) * floorHeight + (i % 2 ? floorHeight / 2 : 0.02), 0);
      quaternion.identity(); scale.set(1, 1, 1);
      inner.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    inner.instanceMatrix.needsUpdate = true;
    host.add(inner);
    const underGeometry = keep(new THREE.CylinderGeometry(radius, radius, 0.1, 32));
    const unders = new THREE.InstancedMesh(underGeometry, ceilingMaterial, floors);
    unders.name = "floor-undersides";
    shadowed(unders, false, true);
    for (let i = 0; i < floors; i++) {
      position.set(0, i * floorHeight - 0.06, 0);
      quaternion.identity(); scale.set(1, 1, 1);
      unders.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    unders.instanceMatrix.needsUpdate = true;
    host.add(unders);

    const BOARDS = 11;
    const boardGeometry = keep(new THREE.BoxGeometry(1, 0.055, radius * 2 / BOARDS - 0.03));
    const boards = new THREE.InstancedMesh(boardGeometry, boardMaterial, floors * BOARDS);
    boards.name = "floorboards";
    shadowed(boards, false, true);
    let at = 0;
    for (let i = 0; i < floors; i++) {
      for (let b = 0; b < BOARDS; b++) {
        const z = -radius + (b + 0.5) * (radius * 2 / BOARDS);
        const halfChord = Math.sqrt(Math.max(0.01, radius * radius - z * z));
        position.set(0, i * floorHeight + 0.01, z);
        quaternion.identity();
        scale.set(halfChord * 2, 1, 1);
        boards.setMatrixAt(at++, matrix.compose(position, quaternion, scale));
      }
    }
    boards.instanceMatrix.needsUpdate = true;
    host.add(boards);

    const rimGeometry = keep(new THREE.TorusGeometry(radius - 0.02, 0.05, 6, 36));
    const rims = new THREE.InstancedMesh(rimGeometry, timberMaterial, floors);
    rims.name = "floor-rims";
    shadowed(rims, false, true);
    quaternion.setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
    for (let i = 0; i < floors; i++) {
      position.set(0, i * floorHeight + 0.04, 0);
      scale.set(1, 1, 1);
      rims.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    rims.instanceMatrix.needsUpdate = true;
    host.add(rims);
    quaternion.identity();

    // ── The spiral stair: steps up the inside wall, with a rope to hold ──────
    const rise = Math.max(floorHeight, (floors - 1) * floorHeight);
    const steps = Math.max(8, Math.round(rise / 0.22));
    const turn = TOWER_LAYOUT.stairTurn * Math.max(1, floors - 1) * Math.PI;
    const stairRadius = radius - 0.55;
    const angleAt = (k: number) => TOWER_LAYOUT.stairFoot + k * turn;
    const stepGeometry = keep(new THREE.BoxGeometry(0.86, 0.07, 0.36));
    const stepMesh = new THREE.InstancedMesh(stepGeometry, timberMaterial, steps);
    stepMesh.name = "stair-steps";
    shadowed(stepMesh, true, true);
    for (let i = 0; i < steps; i++) {
      const k = i / (steps - 1);
      const angle = angleAt(k);
      position.set(Math.sin(angle) * stairRadius, 0.2 + k * rise, Math.cos(angle) * stairRadius);
      quaternion.setFromEuler(new THREE.Euler(0, angle, 0));
      scale.set(1, 1, 1);
      stepMesh.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    stepMesh.instanceMatrix.needsUpdate = true;
    stepMesh.userData.anchor = "stair";
    host.add(stepMesh);

    const ropePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const angle = angleAt(k);
      ropePoints.push(new THREE.Vector3(Math.sin(angle) * (stairRadius + 0.3), 0.95 + k * rise, Math.cos(angle) * (stairRadius + 0.3)));
    }
    const rope = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ropePoints), Math.max(12, steps), 0.032, 6, false)), ropeMaterial);
    rope.name = "stair-rope";
    shadowed(rope, true, false);
    host.add(rope);

    // The doorway at the stair's foot: the way back down to the Court.
    const doorAngle = TOWER_LAYOUT.stairFoot;
    const doorX = Math.sin(doorAngle) * (radius + wall / 2), doorZ = Math.cos(doorAngle) * (radius + wall / 2);
    const doorway = new THREE.Group();
    doorway.name = "doorway";
    doorway.position.set(doorX, 0, doorZ);
    doorway.rotation.y = doorAngle;
    doorway.userData.anchor = "stair";
    host.add(doorway);
    const jamb = shadowed(new THREE.Mesh(keep(new THREE.BoxGeometry(1.0, 1.7, wall + 0.06)), timberMaterial));
    jamb.position.y = 0.85; doorway.add(jamb);
    const opening = new THREE.Mesh(keep(new THREE.BoxGeometry(0.76, 1.5, wall + 0.12)), beamMaterial);
    opening.position.y = 0.75; doorway.add(opening);
    contacts.disc(doorX * 0.8, doorZ * 0.8, 0.6, 0.5, host);

    // ── The window, in the back wall on the top floor ────────────────────────
    const windowY = (floors - 1) * floorHeight + 0.85;
    const windowAngle = TOWER_LAYOUT.windowAngle;
    const windowGroup = new THREE.Group();
    windowGroup.name = "window";
    windowGroup.position.set(Math.sin(windowAngle) * (radius + wall / 2), windowY, Math.cos(windowAngle) * (radius + wall / 2));
    windowGroup.rotation.y = windowAngle;
    windowGroup.userData.anchor = "window";
    host.add(windowGroup);
    const frame = shadowed(new THREE.Mesh(keep(new THREE.BoxGeometry(0.82, 1.06, wall + 0.08)), frameMaterial), false, true);
    windowGroup.add(frame);
    const pane = new THREE.Mesh(keep(new THREE.PlaneGeometry(0.62, 0.86)), glassMaterial);
    pane.position.z = wall / 2 + 0.06; pane.rotation.y = Math.PI;
    windowGroup.add(pane);
    // The day falling through it: a soft wedge of light down onto the floor.
    const shaft = new THREE.Mesh(keep(new THREE.CylinderGeometry(0.38, 0.9, 2.1, 12, 1, true)), daylightMaterial);
    shaft.position.set(Math.sin(windowAngle) * (radius - 1.0), windowY - 1.0, Math.cos(windowAngle) * (radius - 1.0));
    shaft.rotation.z = -0.22;
    shaft.renderOrder = 3;
    host.add(shaft);

    // ── The lamp on the landing ──────────────────────────────────────────────
    const lamp = new THREE.Group();
    lamp.name = "lamp";
    lamp.position.set(-1.05, 1.42, -0.35);
    lamp.userData.anchor = "lamp";
    host.add(lamp);
    const lampBody = shadowed(new THREE.Mesh(keep(new THREE.CylinderGeometry(0.11, 0.15, 0.24, 10)), lampMaterial), true, false);
    lamp.add(lampBody);
    const lampGlow = new THREE.Mesh(keep(new THREE.SphereGeometry(0.1, 10, 8)), glowMaterial);
    lampGlow.position.y = -0.04; lamp.add(lampGlow);
    if (full) {
      const light = new THREE.PointLight(new THREE.Color(dressing.lampGlow), 1.1, 6.5, 2);
      light.position.copy(lamp.position);
      host.add(light);
      own.push({ dispose: () => { light.removeFromParent(); light.dispose(); } });
    }

    // ── The rack's post, floor to ceiling ────────────────────────────────────
    const [postX, , postZ] = TOWER_LAYOUT.post;
    const post = shadowed(new THREE.Mesh(keep(new THREE.BoxGeometry(0.13, wallTop - 0.2, 0.13)), timberMaterial));
    post.position.set(postX, (wallTop - 0.2) / 2, postZ);
    host.add(post);

    // ── The roof, lifted off and hanging ─────────────────────────────────────
    const roof = new THREE.Group();
    roof.name = "roof";
    roof.position.y = wallTop;
    host.add(roof);
    const cone = shadowed(new THREE.Mesh(keep(new THREE.ConeGeometry(radius + wall + 0.35, 1.25, 28, 1, true)), roofMaterial), true, false);
    cone.position.y = 0.62; roof.add(cone);
    const trim = shadowed(new THREE.Mesh(keep(new THREE.TorusGeometry(radius + wall + 0.3, 0.07, 6, 30)), roofTrimMaterial), true, false);
    trim.rotation.x = Math.PI / 2; roof.add(trim);
    const under = new THREE.Mesh(keep(new THREE.CircleGeometry(radius + wall + 0.3, 28)), roofUnderMaterial);
    under.rotation.x = Math.PI / 2; under.position.y = 0.02; roof.add(under);

    host.userData.wallTop = wallTop;
    group.add(host);
    return {
      group: host,
      roof,
      wallTop,
      dispose() {
        host.removeFromParent();
        for (const item of own) item.dispose();
      },
    };
  }

  // ── Rack: the floors' shelves, their marks, and the banks standing on them ─
  type BankSlot = { bank: TowerBank; sculpture: BankSculpture; floor: number; spot: { x: number; z: number }; step: number; squashStart: number | null; pending: boolean };
  type Rack = { group: THREE.Group; slots: BankSlot[]; plates: EngravedPlate[]; tags: EngravedPlate[]; setMarks(shelves: readonly TowerShelf[], total: number, finish: PlateFinish): void; dispose(): void };
  let rack: Rack | null = null;
  let rackKey = "";
  let rebuildCount = 0;

  function buildRack(reading: TowerReading, finish: PlateFinish): Rack {
    const host = new THREE.Group();
    host.name = "tower-rack";
    const own: { dispose(): void }[] = [];
    const keep = <T extends { dispose(): void }>(item: T): T => { own.push(item); return item; };
    const contacts = keep(createContactShadows({ ink: dressing.beam }));
    const floors = towerFloorCount(reading.shelves);
    const { floorHeight } = TOWER_LAYOUT;
    const total = reading.shelves.reduce((sum, shelf) => sum + shelf.share, 0) || 1;
    const slots: BankSlot[] = [];
    const plates: EngravedPlate[] = [];
    const tags: EngravedPlate[] = [];

    // The brass end-plate and the pin on the post, one per floor, instanced.
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(1, 1, 1);
    const [plateX, , plateZ] = TOWER_LAYOUT.endPlate;
    const [postX, , postZ] = TOWER_LAYOUT.post;
    const endGeometry = keep(new THREE.BoxGeometry(1, 0.1, 0.22));
    const ends = new THREE.InstancedMesh(endGeometry, brassMaterial, floors);
    ends.name = "shelf-end-plates";
    ends.castShadow = full;
    host.add(ends);
    const pinGeometry = keep(new THREE.CylinderGeometry(0.035, 0.035, 0.2, 8));
    const pins = new THREE.InstancedMesh(pinGeometry, brassMaterial, floors);
    pins.name = "shelf-pins";
    host.add(pins);
    const markGeometry = keep(new THREE.TorusGeometry(0.1, 0.022, 6, 14));
    const marks = new THREE.InstancedMesh(markGeometry, brassMaterial, floors);
    marks.name = "shelf-full-marks";
    host.add(marks);

    const setMarks = (shelves: readonly TowerShelf[], shareTotal: number, plateFinishNow: PlateFinish): void => {
      let reached = 0;
      for (let floor = 0; floor < floors; floor++) {
        const shelf = shelfOnFloor(shelves, floor);
        const y = floor * floorHeight;
        // The end-plate's width is the shelf's share of the rack: a heavier shelf has a wider brass.
        const width = shelf ? 0.3 + (shelf.share / 10) * 0.9 : 0.3;
        position.set(plateX + width / 2, y + 0.1, plateZ);
        quaternion.identity();
        scale.set(width, 1, 1);
        ends.setMatrixAt(floor, matrix.compose(position, quaternion, scale));
        // The pin sits on the post at the shelf's cutoff, in twentieths of full.
        const pinY = y + 0.15 + ((shelf?.cutoff ?? 20) / 20) * (floorHeight - 0.5);
        position.set(postX - 0.1, pinY, postZ);
        scale.set(1, 1, 1);
        quaternion.setFromEuler(new THREE.Euler(0, 0, Math.PI / 2));
        pins.setMatrixAt(floor, matrix.compose(position, quaternion, scale));
        // A collar around the pin says this shelf has reached its mark.
        if (shelf?.full) {
          position.set(postX - 0.1, pinY, postZ);
          quaternion.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0));
          scale.set(1, 1, 1);
          marks.setMatrixAt(reached++, matrix.compose(position, quaternion, scale));
        }
        const plate = plates[floor];
        if (plate) plate.set(shelfWords(shelf, shareTotal, floor, floors), plateFinishNow);
      }
      marks.count = reached;
      ends.instanceMatrix.needsUpdate = true;
      pins.instanceMatrix.needsUpdate = true;
      marks.instanceMatrix.needsUpdate = true;
      quaternion.identity();
    };

    for (let floor = 0; floor < floors; floor++) {
      const shelf = shelfOnFloor(reading.shelves, floor);
      const y = floor * floorHeight;
      // The shelf's own plate, standing against the post's side of the room.
      const plate = new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.05, 0.26);
      plate.mesh.position.set(0, y + 0.13, TOWER_LAYOUT.bankZ + 0.92);
      plate.mesh.rotation.x = -Math.PI / 2.2;
      plate.mesh.userData.anchor = `shelf:${shelf?.id ?? `floor-${floor}`}`;
      host.add(plate.mesh);
      plates.push(plate);
      own.push(plate);

      const banks = shelf?.banks ?? [];
      if (!banks.length) {
        // A paper tag on a bare shelf: cosy, not broken.
        const tag = new EngravedPlate({ stone: dressing.paper, highlight: dressing.paper, ink: dressing.paperInk, paper: true, size: "small", align: "left" }, 0.84, 0.3);
        tag.mesh.position.set(-0.3, y + 0.34, TOWER_LAYOUT.bankZ + 0.1);
        tag.mesh.rotation.x = -0.24;
        tag.mesh.userData.anchor = `shelf:${shelf?.id ?? `floor-${floor}`}`;
        tag.set("nothing on the shelf yet", finish);
        host.add(tag.mesh);
        tags.push(tag);
        own.push(tag);
        continue;
      }
      banks.forEach((bank, index) => {
        const spot = bankSpot(index, banks.length, options.composition ?? "desktop");
        const sculpture = createBankSculpture(bank, {
          brass: dressing.brass,
          wood: dressing.wood,
          reducedMotion: reduced,
          ...(options.onAnimate ? { onAnimate: options.onAnimate } : {}),
        });
        const height = bankHeight(bank.targetCents, reading.smallestTargetCents, reading.largestTargetCents);
        sculpture.setScale(height);
        sculpture.setFill(bank.step, false);
        sculpture.group.position.set(spot.x, y + 0.06, spot.z);
        // The raycast and the draw-call count both need to know this is a sculpture.
        sculpture.group.userData.anchor = `bank:${bank.key}`;
        sculpture.group.userData.sculpture = true;
        sculpture.group.traverse((node) => { node.userData.anchor = `bank:${bank.key}`; });
        host.add(sculpture.group);
        contacts.disc(spot.x, spot.z, Math.max(0.18, height * 0.42), 0.7, host, y + 0.07);
        slots.push({ bank, sculpture, floor, spot, step: bank.step, squashStart: null, pending: false });
        own.push(sculpture);
      });
    }

    setMarks(reading.shelves, total, finish);
    group.add(host);
    return {
      group: host,
      slots,
      plates,
      tags,
      setMarks,
      dispose() {
        host.removeFromParent();
        for (const item of own) item.dispose();
      },
    };
  }

  // ── Reading → objects ──────────────────────────────────────────────────────
  let current: TowerReading = EMPTY_TOWER_READING;
  let roofLift = reduced ? 1 : 0;
  let pendingRedraw = false;
  let firstUpdate = true;

  const structureKeyOf = (reading: TowerReading): string =>
    reading.shelves.map((shelf) => `${shelf.id}[${shelf.banks.map((bank) => bank.key).join(",")}]`).join("|");

  function applyRoof(): void {
    if (!shell) return;
    const k = clamp(roofLift, 0, 1);
    shell.roof.position.y = shell.wallTop + k * 1.05;
    shell.roof.rotation.z = k * 0.1;
    shell.roof.rotation.x = k * 0.05;
  }

  function update(value: unknown): void {
    const reading = readTowerReading(value);
    // Stale books dull the plates exactly as they do in the Court: a frozen
    // figure never looks freshly cut.
    const row = (value && typeof value === "object" ? value : {}) as { freshness?: unknown };
    const freshness = row.freshness === "stale" || row.freshness === "offline" ? row.freshness : "current";
    const finish: PlateFinish = plateFinish(freshness);
    const floors = towerFloorCount(reading.shelves);
    if (!shell || floors !== shellFloors) {
      shell?.dispose();
      shell = buildShell(floors);
      shellFloors = floors;
      applyRoof();
    }
    const key = structureKeyOf(reading);
    if (!rack || key !== rackKey) {
      rack?.dispose();
      rack = buildRack(reading, finish);
      rackKey = key;
      rebuildCount += 1;
    } else {
      // Same banks, new figures: the shelf marks move and each bank grows in place.
      const total = reading.shelves.reduce((sum, shelf) => sum + shelf.share, 0) || 1;
      rack.setMarks(reading.shelves, total, finish);
      const byKey = new Map(reading.shelves.flatMap((shelf) => shelf.banks).map((bank) => [bank.key, bank]));
      for (const slot of rack.slots) {
        const next = byKey.get(slot.bank.key);
        if (!next) continue;
        slot.sculpture.setScale(bankHeight(next.targetCents, reading.smallestTargetCents, reading.largestTargetCents));
        const grew = next.step > slot.step && !firstUpdate;
        slot.sculpture.setFill(next.step, grew);
        if (grew && !reduced) { slot.pending = true; slot.squashStart = null; }
        slot.step = next.step;
        slot.bank = next;
      }
    }
    landing.set(reading.jug, reading.gun);
    current = reading;
    firstUpdate = false;
    pendingRedraw = true;
  }

  update(options.reading ?? EMPTY_TOWER_READING);
  scene.add(group);

  // ── Anchors, regions, poses ────────────────────────────────────────────────
  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  function bankAnchors(): Anchor[] {
    if (!rack) return [];
    return rack.slots.map((slot) => {
      const height = bankHeight(slot.bank.targetCents, current.smallestTargetCents, current.largestTargetCents);
      const y = slot.floor * TOWER_LAYOUT.floorHeight + height * 0.6;
      const words = `${slot.bank.name} — ${engravedWords(slot.bank.cents)} of ${engravedWords(slot.bank.targetCents)}. Open the Loft.`;
      return {
        id: `bank:${slot.bank.key}`,
        position: at(slot.spot.x, y, slot.spot.z),
        zone: "bank",
        label: words,
        door: { target: "loft-banks", object: `bank/plan:${slot.bank.goalId ?? slot.bank.key}` },
      };
    });
  }

  function shelfAnchors(): Anchor[] {
    const floors = towerFloorCount(current.shelves);
    const total = current.shelves.reduce((sum, shelf) => sum + shelf.share, 0) || 1;
    const out: Anchor[] = [];
    for (let floor = 0; floor < floors; floor++) {
      const shelf = shelfOnFloor(current.shelves, floor);
      out.push({
        id: `shelf:${shelf?.id ?? `floor-${floor}`}`,
        position: at(1.35, floor * TOWER_LAYOUT.floorHeight + 0.3, TOWER_LAYOUT.bankZ + 0.95),
        zone: "shelf",
        label: shelfWords(shelf, total, floor, floors),
      });
    }
    return out;
  }

  function anchorList(): Anchor[] {
    const words = landing.words();
    const [sx, , sz] = LANDING_LAYOUT.stand;
    const [px, py, pz] = LANDING_LAYOUT.peg;
    const stairAngle = TOWER_LAYOUT.stairFoot;
    const stairX = Math.sin(stairAngle) * (TOWER_LAYOUT.radius - 0.5), stairZ = Math.cos(stairAngle) * (TOWER_LAYOUT.radius - 0.5);
    const floors = towerFloorCount(current.shelves);
    return [
      // The stair is a route, not a door: the shell takes you back down to the Court.
      { id: "stair", position: at(stairX, 0.65, stairZ), zone: "stair", label: "The stair — back down to the Court" },
      { id: "jug", position: at(sx, LANDING_LAYOUT.standHeight + LANDING_LAYOUT.jugHeight * 0.6, sz), zone: "landing", label: words.jug, door: { target: "loft-banks", object: "pour" } },
      { id: "gun", position: at(px, py - 0.05, pz + 0.18), zone: "landing", label: words.gun, door: { target: "loft-banks", object: "gun" } },
      ...shelfAnchors(),
      ...bankAnchors(),
      { id: "window", position: at(Math.sin(TOWER_LAYOUT.windowAngle) * (TOWER_LAYOUT.radius + 0.1), (floors - 1) * TOWER_LAYOUT.floorHeight + 0.85, Math.cos(TOWER_LAYOUT.windowAngle) * (TOWER_LAYOUT.radius + 0.1)), zone: "prop", label: "The window — the day coming in" },
      { id: "lamp", position: at(-1.05, 1.42, -0.35), zone: "prop", label: "The lamp on the landing" },
    ];
  }

  function regionList(): Region[] {
    const anchors = anchorList();
    return anchors.map((anchor) => {
      const [x, y, z] = anchor.position;
      const half = anchor.zone === "bank" ? 0.45 : anchor.zone === "shelf" ? 0.7 : 0.55;
      const tall = anchor.zone === "stair" ? 1.1 : 0.6;
      return {
        id: anchor.id,
        group: "tower",
        label: anchor.label,
        box: box(x - half, Math.max(0, y - tall), z - half, x + half, y + tall, z + half),
      };
    });
  }

  // ── Animation: the squash on a deposit, and the sculptures' own frames ─────
  function animate(t: number, _dt: number): boolean {
    let busy = false;
    const nowMs = t * 1000;
    if (rack) {
      for (const slot of rack.slots) {
        if (slot.pending) { slot.squashStart = t; slot.pending = false; }
        if (slot.squashStart !== null) {
          const elapsed = t - slot.squashStart;
          if (elapsed >= SQUASH_SECONDS) {
            // The frame that settles it still has to be painted, then the tower is still.
            slot.squashStart = null;
            slot.sculpture.setSquash({ sx: 1, sy: 1 });
            busy = true;
          } else {
            slot.sculpture.setSquash(squash(elapsed));
            busy = true;
          }
        }
        if (slot.sculpture.update(nowMs)) busy = true;
      }
    }
    const redraw = pendingRedraw;
    pendingRedraw = false;
    return busy || redraw;
  }

  function countDrawCalls(node: THREE.Object3D, skipSculptures: boolean): number {
    if (!node.visible) return 0;
    if (skipSculptures && node.userData.sculpture === true) return 0;
    let count = node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh ? 1 : 0;
    for (const child of node.children) count += countDrawCalls(child, skipSculptures);
    return count;
  }

  return {
    group,
    update,
    animate,
    anchors: anchorList,
    poses: () => towerPoses(anchorList()),
    regions: regionList,
    setRoof(k) { roofLift = reduced ? 1 : clamp(Number.isFinite(k) ? k : 0, 0, 1); applyRoof(); pendingRedraw = true; },
    roof: () => roofLift,
    setPour(k) { landing.setPour(k); pendingRedraw = true; },
    setReduced(next) {
      reduced = next;
      if (reduced) { roofLift = 1; applyRoof(); if (rack) for (const slot of rack.slots) { slot.pending = false; slot.squashStart = null; slot.sculpture.setSquash({ sx: 1, sy: 1 }); } }
      pendingRedraw = true;
    },
    banks: () => (rack ? rack.slots.map((slot) => slot.bank.key) : []),
    rebuilds: () => rebuildCount,
    words() {
      const floors = towerFloorCount(current.shelves);
      const total = current.shelves.reduce((sum, shelf) => sum + shelf.share, 0) || 1;
      const landingWords = landing.words();
      return {
        shelves: Array.from({ length: floors }, (_row, floor) => shelfWords(shelfOnFloor(current.shelves, floor), total, floor, floors)),
        banks: rack ? rack.slots.map((slot) => `${slot.bank.name} — ${engravedWords(slot.bank.cents)} of ${engravedWords(slot.bank.targetCents)}`) : [],
        jug: landingWords.jug,
        gun: landingWords.gun,
        empty: current.shelves.every((shelf) => shelf.banks.length === 0),
      };
    },
    drawCalls: () => countDrawCalls(group, true),
    sculptureCount: () => (rack ? rack.slots.length : 0),
    landing,
    dispose() {
      scene.remove(group);
      rack?.dispose();
      shell?.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}

/** The registry entry: `PLACES.tower`. Accepts the harbour reading and any dressing or theme id. */
export const towerPlace: Place = registerPlace({
  id: "tower",
  build(scene, dressing, reading, quality, context) {
    return createTower(scene, {
      dressing: towerDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
