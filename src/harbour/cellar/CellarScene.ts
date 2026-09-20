import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { GlbHandle } from "../assets/loadGlb.ts";
import type { GlbAsset } from "../assets/manifest.ts";
import type { CellarJarReading, CellarReadingView } from "../data/reading.ts";
import { EngravedPlate, engravedWords } from "../court/engraved.ts";
import { registerPlace, type Anchor, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import { cellarDressingFrom, cellarLightFor, shelfTrimWords, type CellarDressing } from "./dressing.ts";
import { createJar, isUmbrellaBankId, jarFootprint, type CellarJar } from "./jars.ts";
import { scrubDateWords, scrubReading, scrubStep, scrubToday } from "./scrub.ts";
import { CELLAR_WATER, createWater, dollarsToUnits, type CellarWater } from "./water.ts";

/**
 * The Cellar — the undercroft under the court's terrace (LITTLE_HARBOUR_v2 §2,
 * BUILD_PLAN_SLICE2 §3).
 *
 * A vaulted stone room whose ceiling is the court's flagstones seen from
 * below, one warm lamp, the stair back up, and a long rail along the back wall
 * with the bill jars on it. Prepare's water stands behind the rail on the
 * **same dollar scale** as the jars, and the whole rail scrubs through the
 * month: the water rises and falls, the jars ahead of the line go pale, and a
 * small engraved date plate follows.
 *
 * Nothing here posts, proposes or computes money. The scrub writes nothing;
 * tapping a jar opens the existing `QueenCellar` surface through `onOpen`.
 */

/** Layout shared with the poses. +z faces the camera; the rail runs along the back wall at −z. */
export const CELLAR_LAYOUT = {
  width: 10.4,
  /** Shallow on purpose: a deeper room puts the eye against the front wall and fills half the frame with bare floor. */
  depth: 6.8,
  /** Floor to the springing of the vault, and to the crown. */
  wallHeight: 2.15,
  vaultRise: 0.85,
  railZ: -2.15,
  railTop: 1.05,
  /** The whole month has to sit inside a desktop frame from a pose that stands in the room. */
  railLength: 7.3,
  stair: [2.35, 0, -0.55],
  lamp: [-1.15, 1.62, -3.12],
  datePlate: [0, 1.62, -2.3],
  waterline: [-2.15, 0.85, -2.75],
} as const satisfies Record<string, unknown>;

/** How many vault ribs the ceiling carries. One instanced mesh, both tiers. */
const RIBS = 7;

/** What the Cellar reads; a structural subset of the slice-2 `HarbourReading`. */
export type PhysicalCondition = "kept" | "worn" | "damaged";
export type CellarSceneReading = {
  cellar: CellarReadingView | null;
  /** Worn/damaged darkens the stone and drops the water line, like the court's moss. */
  physical: PhysicalCondition;
};

/**
 * The house's physical wear. Slice 2 names it `condition.physical`; until every
 * reading carries that word, the shipped `condition.state` stands in for it, so
 * a weathered house already reads as worn stone down here.
 */
export function physicalConditionOf(value: unknown): PhysicalCondition {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const condition = row.condition && typeof row.condition === "object" ? (row.condition as Record<string, unknown>) : null;
  const physical = condition?.physical;
  if (physical === "worn" || physical === "damaged" || physical === "kept") return physical;
  const state = condition?.state;
  if (state === "weathered") return "damaged";
  if (state === "wilting") return "worn";
  return "kept";
}

const EMPTY_VIEW: CellarReadingView = { jars: [], days: [], todayIndex: 0, prepareCents: null, scaleCents: 0 };

const STATES: readonly CellarJarReading["state"][] = ["planned", "set-aside", "paid", "short"];
const isState = (value: unknown): value is CellarJarReading["state"] => typeof value === "string" && (STATES as readonly string[]).includes(value);
const asCents = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const asSize = (value: unknown): CellarJarReading["size"] => (value === 2 || value === 3 || value === 4 || value === 5 ? value : 1);
const asDate = (value: unknown): string | null => (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

/** Narrows any reading-shaped value. Missing parts read as unknown ("—"), never as zero. */
export function readCellarView(value: unknown): CellarReadingView {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const jars = Array.isArray(row.jars) ? row.jars : [];
  const days = Array.isArray(row.days) ? row.days : [];
  return {
    jars: jars.flatMap((entry): CellarJarReading[] => {
      if (!entry || typeof entry !== "object") return [];
      const jar = entry as Record<string, unknown>;
      if (typeof jar.key !== "string" || jar.key.length === 0) return [];
      return [{
        key: jar.key,
        label: typeof jar.label === "string" ? jar.label : jar.key,
        umbrella: isUmbrellaBankId(jar.umbrella) ? jar.umbrella : null,
        amountCents: asCents(jar.amountCents) ?? 0,
        fill: typeof jar.fill === "number" && Number.isFinite(jar.fill) ? Math.max(0, Math.min(1, jar.fill)) : 0,
        state: isState(jar.state) ? jar.state : "planned",
        size: asSize(jar.size),
        due: asDate(jar.due),
        missingMark: jar.missingMark === true,
      }];
    }),
    days: days.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const day = entry as Record<string, unknown>;
      const date = asDate(day.date);
      if (!date) return [];
      return [{ date, balanceCents: asCents(day.balanceCents) ?? 0, belowBuffer: day.belowBuffer === true, today: day.today === true }];
    }),
    todayIndex: typeof row.todayIndex === "number" && Number.isFinite(row.todayIndex) ? Math.max(0, Math.trunc(row.todayIndex)) : 0,
    prepareCents: asCents(row.prepareCents),
    scaleCents: asCents(row.scaleCents) ?? 0,
  };
}

/** Pulls the cellar view out of any reading-shaped value. */
export function readCellarReading(value: unknown): CellarSceneReading {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return {
    cellar: row.cellar === undefined || row.cellar === null ? null : readCellarView(row.cellar),
    physical: physicalConditionOf(value),
  };
}

export type CellarHandle = PlaceHandle & {
  update(value: unknown): void;
  /** Where the rail is standing, as a day index into the reading's days. */
  index(): number;
  /** Move the rail. `-1` / `+1` are the ◀ ▶ twins and the arrow keys; a drag passes `scrubIndex`'s answer. */
  scrubTo(index: number): void;
  step(delta: number): void;
  today(): void;
  /** Current words for the DOM twins and the tests. */
  words(): { date: string; water: string; rail: string; jars: { key: string; label: string; state: string; pale: boolean }[] };
  jars(): readonly CellarJar[];
  drawCalls(): number;
  /** Resolves once every umbrella bank has landed in its glass, or failed. */
  ready: Promise<void>;
};

export type CellarOptions = {
  dressing: CellarDressing;
  reading?: unknown;
  quality: "full" | "lite";
  /** No ripple, instant level, no lamp flicker. */
  reduced?: boolean;
  signal?: AbortSignal;
  onLanded?: (key: string) => void;
  load?: (asset: GlbAsset, signal?: AbortSignal) => Promise<GlbHandle>;
  loadModels?: boolean;
};

/**
 * Inside the room, below the vault: the undercroft is 2.35 to the springing and
 * 8.2 deep, so the eye has to sit under the ceiling and inside the back wall.
 */
// The eye has to stand **inside** the room: the front wall's inner face is at
// z = +3.95, so anything past it presses the camera through the masonry and the
// room stops reading as a room. These two poses put the eye at about z = 3.0,
// a little over head height, looking down the rail with the vault overhead, the
// floor under it and the water's surface — not only its face — in the frame.
const PHONE_CELLAR: Pose = { target: [-0.5, 1.26, -2.1], r: 3.3, theta: 0.55, phi: 1.335 };
const DESKTOP_CELLAR: Pose = { target: [0, 1.0, -1.9], r: 4.3, theta: 0.10, phi: 1.355 };

/**
 * Pose keys in the one convention every place is written in,
 * `<key>:<composition>`, with the bare key as the desktop fallback.
 */
function composed(poses: Record<string, Pose>, key: string, phone: Pose, desktop: Pose): void {
  poses[`${key}:phone`] = phone;
  poses[`${key}:desktop`] = desktop;
  poses[key] = desktop;
}

export function cellarPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {};
  composed(poses, "cellar", PHONE_CELLAR, DESKTOP_CELLAR);
  composed(poses, "court", PHONE_CELLAR, DESKTOP_CELLAR);
  composed(poses, "sky", { target: [0, 1.0, -1.0], r: 9.2, theta: 0, phi: 1.0 }, { target: [0, 1.0, -1.0], r: 10.2, theta: 0.3, phi: 0.98 });
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = Math.atan2(x, z + 6) * 0.5;
    const close = anchor.zone === "jar" ? 1.5 : anchor.zone === "stair" ? 3.2 : 2.6;
    composed(poses, `object:${anchor.id}`,
      { target: [x, Math.max(0.55, y), z], r: close, theta, phi: 1.24 },
      { target: [x, Math.max(0.55, y), z], r: close + 0.7, theta: theta + 0.18, phi: 1.16 });
  }
  return poses;
}

function placed<T extends THREE.BufferGeometry>(geometry: T, x: number, y: number, z: number, rotation?: [number, number, number]): T {
  if (rotation) geometry.rotateX(rotation[0]).rotateY(rotation[1]).rotateZ(rotation[2]);
  geometry.translate(x, y, z);
  return geometry;
}

function merged(geometries: THREE.BufferGeometry[], material: THREE.Material): THREE.Mesh {
  const joined = geometries.length === 1 ? geometries[0]! : mergeGeometries(geometries, false);
  if (joined && geometries.length > 1) for (const g of geometries) g.dispose();
  return new THREE.Mesh(joined ?? geometries[0]!, material);
}

export function createCellar(scene: THREE.Scene, options: CellarOptions): CellarHandle {
  const { dressing } = options;
  const full = options.quality === "full";
  const reduced = options.reduced === true;
  const light = cellarLightFor(dressing);
  const { width, depth, wallHeight, vaultRise, railZ, railTop, railLength } = CELLAR_LAYOUT;

  const group = new THREE.Group();
  group.name = "cellar";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra }));

  // Contact shadows: a radial-gradient disc so anything that stands touches the floor.
  // (Kept tiny on purpose; it folds into `scene/contact.ts` the moment that exists.)
  let contactTexture: THREE.CanvasTexture | null = null;
  const contactMaterial = (): THREE.MeshBasicMaterial | null => {
    if (!contactTexture) {
      try {
        const canvas = document.createElement("canvas"); canvas.width = 128; canvas.height = 128;
        const ctx = canvas.getContext("2d"); if (!ctx) return null;
        const gradient = ctx.createRadialGradient(64, 64, 8, 64, 64, 64);
        gradient.addColorStop(0, "rgba(14,11,7,0.5)"); gradient.addColorStop(0.55, "rgba(14,11,7,0.2)"); gradient.addColorStop(1, "rgba(14,11,7,0)");
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, 128, 128);
        contactTexture = track(new THREE.CanvasTexture(canvas)); contactTexture.colorSpace = THREE.SRGBColorSpace;
      } catch { return null; }
    }
    return track(new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false }));
  };
  const contact = (x: number, y: number, z: number, radius: number, opacity: number, parent: THREE.Object3D): void => {
    const material = contactMaterial(); if (!material) return;
    material.opacity = opacity;
    const disc = new THREE.Mesh(track(new THREE.PlaneGeometry(radius * 2, radius * 2)), material);
    disc.rotation.x = -Math.PI / 2; disc.position.set(x, y, z); disc.renderOrder = 2; disc.name = "contact";
    parent.add(disc);
  };

  // ── The room: floor, four walls, the vault and the court's flagstones above ──
  const stoneMaterial = mat(dressing.stone);
  const floor = new THREE.Mesh(track(new THREE.PlaneGeometry(width, depth)), mat(dressing.floor, { roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.name = "cellar-floor"; group.add(floor);

  const halfW = width / 2, halfD = depth / 2;
  const walls = merged([
    placed(new THREE.BoxGeometry(width, wallHeight, 0.3), 0, wallHeight / 2, -halfD),
    placed(new THREE.BoxGeometry(0.3, wallHeight, depth), -halfW, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(0.3, wallHeight, depth), halfW, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(width, wallHeight, 0.3), 0, wallHeight / 2, halfD),
  ], stoneMaterial);
  track(walls.geometry); walls.receiveShadow = true; walls.name = "cellar-walls"; group.add(walls);

  // Mortar courses: one thin band per course, merged into a single mesh.
  const courses: THREE.BufferGeometry[] = [];
  for (let i = 1; i <= 4; i++) courses.push(placed(new THREE.BoxGeometry(width - 0.02, 0.025, 0.02), 0, (wallHeight / 5) * i, -halfD + 0.16));
  const mortar = merged(courses, mat(dressing.mortar, { roughness: 1 }));
  track(mortar.geometry); mortar.name = "cellar-mortar"; group.add(mortar);

  // The vault's underside IS the court's flagstones, seen from below.
  const soffit = new THREE.Mesh(track(new THREE.PlaneGeometry(width, depth)), mat(dressing.flagstoneUnderside, { roughness: 0.95 }));
  soffit.rotation.x = Math.PI / 2; soffit.position.y = wallHeight + vaultRise * 0.2; soffit.name = "cellar-soffit"; group.add(soffit);

  // The ribs: one instanced half-torus arch, repeated across the room.
  const ribGeometry = track(new THREE.TorusGeometry(halfW * 0.92, 0.09, 6, 14, Math.PI));
  const ribs = new THREE.InstancedMesh(ribGeometry, mat(dressing.vaultRib, { roughness: 0.88 }), RIBS);
  ribs.name = "cellar-ribs";
  const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(1, vaultRise / (halfW * 0.92), 1);
  quaternion.setFromEuler(new THREE.Euler(0, 0, 0));
  for (let i = 0; i < RIBS; i++) {
    position.set(0, wallHeight, -halfD + 0.4 + (i / (RIBS - 1)) * (depth - 0.8));
    matrix.compose(position, quaternion, scale);
    ribs.setMatrixAt(i, matrix);
  }
  ribs.instanceMatrix.needsUpdate = true;
  group.add(ribs);

  // The plaster webbing between the ribs.
  const webbing = new THREE.Mesh(track(new THREE.CylinderGeometry(halfW * 0.92, halfW * 0.92, depth - 0.6, 14, 1, true, 0, Math.PI)), mat(dressing.vault, { roughness: 0.96, side: THREE.BackSide }));
  webbing.rotation.set(Math.PI / 2, 0, 0); webbing.position.y = wallHeight; webbing.scale.y = 1; webbing.name = "cellar-vault"; group.add(webbing);

  // ── The stair up to the court ───────────────────────────────────────────────
  const [stx, , stz] = CELLAR_LAYOUT.stair;
  const treads: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 6; i++) treads.push(placed(new THREE.BoxGeometry(1.5, 0.16, 0.42), stx, 0.08 + i * 0.28, stz + i * 0.4));
  const stair = merged(treads, mat(dressing.stairStone, { roughness: 0.9 }));
  track(stair.geometry); stair.receiveShadow = true; stair.castShadow = full; stair.name = "cellar-stair";
  stair.userData.anchor = "stair"; group.add(stair);
  const handrail = merged([
    placed(new THREE.BoxGeometry(0.07, 0.07, 2.6), stx - 0.72, 1.05, stz + 1.0, [-0.61, 0, 0]),
    placed(new THREE.CylinderGeometry(0.05, 0.05, 0.9, 8), stx - 0.72, 0.45, stz),
  ], mat(dressing.stairRail, { roughness: 0.8 }));
  track(handrail.geometry); handrail.userData.anchor = "stair"; handrail.name = "cellar-handrail"; group.add(handrail);

  // ── The lamp: the only light the cellar has of its own ──────────────────────
  const [lx, ly, lz] = CELLAR_LAYOUT.lamp;
  const lampBody = merged([
    placed(new THREE.CylinderGeometry(0.11, 0.14, 0.24, 8), lx, ly, lz),
    placed(new THREE.CylinderGeometry(0.02, 0.02, 0.32, 6), lx, ly + 0.28, lz),
  ], mat(dressing.brass, { roughness: 0.36, metalness: 0.66 }));
  track(lampBody.geometry); lampBody.name = "cellar-lamp"; group.add(lampBody);
  const glow = new THREE.Mesh(track(new THREE.SphereGeometry(0.085, 10, 8)), track(new THREE.MeshBasicMaterial({ color: light.lamp })));
  glow.position.set(lx, ly, lz); glow.name = "cellar-lamp-glow"; group.add(glow);
  // Decay 2 and a short reach: on a pale wall (Taylor's) a 14-unit lamp at decay 1.6
  // blew a white hole where the light should have been a warm pool.
  const lamp = new THREE.PointLight(new THREE.Color(light.lamp), light.lampIntensity, 6.5, 2);
  lamp.position.set(lx, ly, lz); lamp.castShadow = full; group.add(lamp);
  const ambient = new THREE.HemisphereLight(new THREE.Color(light.hemiSky), new THREE.Color(light.hemiGround), light.ambient);
  group.add(ambient);

  // ── Prepare's water behind the rail ─────────────────────────────────────────
  let scaleCents = 0;
  let water: CellarWater = createWater({ dressing, scaleCents, reduced });
  group.add(water.group);

  // The cistern's plinth, and the brass rule beside it. The glass itself is the water's
  // own (`water.ts`): what the room owns is what it stands on and what you read it against.
  const cisternX = CELLAR_WATER.centerX, cisternZ = CELLAR_WATER.centerZ;
  const cisternPlinth = merged([
    placed(new THREE.BoxGeometry(CELLAR_WATER.radius * 2 + 0.46, CELLAR_WATER.plinth, CELLAR_WATER.radius * 2 + 0.46), cisternX, CELLAR_WATER.plinth / 2, cisternZ),
    placed(new THREE.BoxGeometry(CELLAR_WATER.radius * 2 + 0.62, 0.06, CELLAR_WATER.radius * 2 + 0.62), cisternX, 0.03, cisternZ),
  ], mat(dressing.stairStone, { roughness: 0.9 }));
  track(cisternPlinth.geometry); cisternPlinth.receiveShadow = true; cisternPlinth.castShadow = full; cisternPlinth.name = "cellar-cistern-plinth"; group.add(cisternPlinth);

  // A brass rule on a post beside the glass: five ticks, so the level is read against something.
  const rulePost = CELLAR_WATER.radius + 0.24;
  const ruleParts: THREE.BufferGeometry[] = [
    placed(new THREE.CylinderGeometry(0.022, 0.022, CELLAR_WATER.glassTop, 8), cisternX - rulePost, CELLAR_WATER.plinth + CELLAR_WATER.glassTop / 2, cisternZ + 0.1),
  ];
  for (let i = 1; i <= 5; i++) {
    ruleParts.push(placed(new THREE.BoxGeometry(0.13, 0.02, 0.026), cisternX - rulePost + 0.06, CELLAR_WATER.plinth + (CELLAR_WATER.glassTop / 6) * i, cisternZ + 0.1));
  }
  const rule = merged(ruleParts, mat(dressing.brass, { roughness: 0.34, metalness: 0.66 }));
  track(rule.geometry); rule.name = "cellar-cistern-rule"; group.add(rule);

  // Where the water used to stand: a faint collar on the glass, dropped and darkened when worn.
  const oldMark = new THREE.Mesh(
    track(new THREE.CylinderGeometry(CELLAR_WATER.radius + 0.045, CELLAR_WATER.radius + 0.045, 0.028, 24, 1, true)),
    mat(dressing.stain, { roughness: 1, transparent: true, opacity: 0.45, side: THREE.DoubleSide }),
  );
  oldMark.position.set(cisternX, CELLAR_WATER.plinth + 0.7, cisternZ); oldMark.name = "cellar-old-mark"; oldMark.userData.anchor = "waterline"; group.add(oldMark);

  // The month's crest: a brass collar at the highest the water stands all month. On the
  // room's ruler a month's spending is a small part of a buffer, so the surface moves
  // only a little as you walk the rail — the collar is what that little is measured from.
  const crest = new THREE.Mesh(
    track(new THREE.CylinderGeometry(CELLAR_WATER.radius + 0.05, CELLAR_WATER.radius + 0.05, 0.02, 24, 1, true)),
    mat(dressing.brass, { roughness: 0.34, metalness: 0.66, side: THREE.DoubleSide }),
  );
  crest.name = "cellar-crest"; crest.userData.anchor = "waterline"; crest.visible = false; group.add(crest);
  const setCrest = (cents: number | null): void => {
    if (cents === null || !Number.isFinite(cents) || cents <= 0 || scaleCents <= 0) { crest.visible = false; return; }
    crest.visible = true;
    crest.position.set(cisternX, CELLAR_WATER.plinth + CELLAR_WATER.floor + dollarsToUnits(cents, scaleCents), cisternZ);
  };

  // ── The rail along the back wall ────────────────────────────────────────────
  const railGroup = new THREE.Group(); railGroup.name = "cellar-rail"; railGroup.userData.anchor = "rail"; group.add(railGroup);
  const shelf = new THREE.Mesh(track(new THREE.BoxGeometry(railLength, 0.08, 0.46)), mat(dressing.railShelf, { roughness: 0.82 }));
  shelf.position.set(0, railTop - 0.04, railZ); shelf.receiveShadow = true; shelf.castShadow = full; shelf.name = "rail-shelf"; railGroup.add(shelf);
  const LEGS = 5;
  const legGeometry = track(new THREE.BoxGeometry(0.12, railTop - 0.08, 0.12));
  const legs = new THREE.InstancedMesh(legGeometry, mat(dressing.railTimber, { roughness: 0.85 }), LEGS);
  legs.name = "rail-legs";
  for (let i = 0; i < LEGS; i++) {
    position.set(-railLength / 2 + 0.2 + (i / (LEGS - 1)) * (railLength - 0.4), (railTop - 0.08) / 2, railZ);
    quaternion.identity(); scale.set(1, 1, 1);
    matrix.compose(position, quaternion, scale);
    legs.setMatrixAt(i, matrix);
  }
  legs.instanceMatrix.needsUpdate = true; railGroup.add(legs);
  const endPlates = merged([
    placed(new THREE.BoxGeometry(0.09, 0.2, 0.5), -railLength / 2 - 0.03, railTop - 0.1, railZ),
    placed(new THREE.BoxGeometry(0.09, 0.2, 0.5), railLength / 2 + 0.03, railTop - 0.1, railZ),
  ], mat(dressing.brass, { roughness: 0.38, metalness: 0.6 }));
  track(endPlates.geometry); endPlates.name = "rail-ends"; railGroup.add(endPlates);

  // The day marker that follows the scrub, and the engraved date plate above it.
  const marker = new THREE.Mesh(track(new THREE.BoxGeometry(0.035, 0.26, 0.5)), mat(dressing.brass, { roughness: 0.32, metalness: 0.7 }));
  marker.position.set(0, railTop + 0.1, railZ); marker.name = "rail-marker"; railGroup.add(marker);
  const [dpx, dpy, dpz] = CELLAR_LAYOUT.datePlate;
  const datePlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 0.62, 0.26));
  datePlate.mesh.position.set(dpx, dpy, dpz); datePlate.mesh.name = "cellar-date"; group.add(datePlate.mesh);

  scene.add(group);

  // ── Jars on the rail ────────────────────────────────────────────────────────
  const jarsGroup = new THREE.Group(); jarsGroup.name = "cellar-jars"; group.add(jarsGroup);
  let jars: CellarJar[] = [];
  let view: CellarReadingView = EMPTY_VIEW;
  let index = 0;
  let pendingRedraw = true;
  let dateWords = "—";
  let landed: Promise<void> = Promise.resolve();
  let disposed = false;

  const clearJars = (): void => {
    for (const jar of jars) jar.dispose();
    jars = [];
    jarsGroup.clear();
  };

  const layOutJars = (): void => {
    clearJars();
    if (view.jars.length === 0) return;
    const spans = view.jars.map((jar) => jarFootprint(jar.size));
    const total = spans.reduce((sum, span) => sum + span, 0);
    const usable = railLength - 0.5;
    const gap = view.jars.length > 1 ? Math.max(0, (usable - total) / (view.jars.length - 1)) : 0;
    let cursor = -usable / 2;
    const built: Promise<void>[] = [];
    view.jars.forEach((reading, i) => {
      const span = spans[i]!;
      const jar = createJar({
        reading, dressing, scaleCents: view.scaleCents,
        quality: options.quality, ...(options.signal ? { signal: options.signal } : {}),
        onLanded: (key) => { pendingRedraw = true; options.onLanded?.(key); },
        ...(options.load ? { load: options.load } : {}),
        ...(options.loadModels === undefined ? {} : { loadModels: options.loadModels }),
      });
      jar.group.position.set(cursor + span / 2, railTop, railZ);
      contact(0, 0.004, 0, jar.radius * 1.5, 0.75, jar.group);
      jarsGroup.add(jar.group);
      jars.push(jar);
      built.push(jar.ready);
      cursor += span + gap;
    });
    landed = Promise.all(built).then(() => undefined);
  };

  const applyScrub = (): void => {
    if (view.days.length === 0) {
      water.setLevel(view.prepareCents, false);
      dateWords = "—";
      datePlate.set("—", "matte");
      marker.visible = false;
      for (const jar of jars) jar.setPale(false);
      pendingRedraw = true;
      return;
    }
    marker.visible = true;
    const scrubbed = scrubReading(view, index);
    const atToday = index === scrubToday(view);
    water.setLevel(scrubbed.levelCents, !reduced);
    dateWords = `${scrubDateWords(scrubbed.date)}${atToday ? " · today" : ""}`;
    datePlate.set(dateWords, "glazed");
    marker.position.x = -railLength / 2 + 0.25 + ((index + 0.5) / view.days.length) * (railLength - 0.5);
    for (const jar of jars) {
      const state = scrubbed.jarStates[jar.key];
      if (state === "ahead") { jar.setPale(true); continue; }
      jar.setPale(false);
      if (state) jar.setState(state);
    }
    pendingRedraw = true;
  };

  function update(value: unknown): void {
    const next = readCellarReading(value);
    const incoming = next.cellar ?? EMPTY_VIEW;
    const worn = next.physical !== "kept";
    const sameShape = incoming.jars.length === view.jars.length
      && incoming.jars.every((jar, i) => view.jars[i]?.key === jar.key && view.jars[i]?.size === jar.size && view.jars[i]?.amountCents === jar.amountCents && view.jars[i]?.umbrella === jar.umbrella)
      && incoming.scaleCents === view.scaleCents;
    view = incoming;
    if (incoming.scaleCents !== scaleCents) {
      scaleCents = incoming.scaleCents;
      group.remove(water.group);
      water.dispose();
      water = createWater({ dressing, scaleCents, reduced });
      group.add(water.group);
    }
    if (!sameShape) { layOutJars(); index = scrubToday(incoming); }
    else index = Math.max(0, Math.min(Math.max(0, incoming.days.length - 1), index));
    for (const jar of jars) {
      const reading = incoming.jars.find((row) => row.key === jar.key);
      if (reading) { jar.setState(reading.state); jar.setFill(reading.fill); }
    }
    // Worn or damaged: the stone darkens to the old line and the water sits low.
    oldMark.visible = worn;
    stoneMaterial.color.set(worn ? dressing.stoneAlt : dressing.stone);
    setCrest(incoming.days.length ? Math.max(...incoming.days.map((day) => day.balanceCents)) : incoming.prepareCents);
    applyScrub();
  }
  update(options.reading ?? null);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  const trimWords = shelfTrimWords(dressing.shelfTrim);

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = [
      { id: "stair", position: at(stx, 0.9, stz + 1.0), zone: "stair", label: "The stair up to the court" },
      { id: "rail", position: at(0, railTop + 0.2, railZ), zone: "rail", label: view.jars.length ? `The bill rail, ${trimWords} — ${view.jars.length} ${view.jars.length === 1 ? "jar" : "jars"} on ${dateWords}` : "The bill rail — no bills on the rail yet" },
      { id: "waterline", position: at(CELLAR_LAYOUT.waterline[0], CELLAR_LAYOUT.waterline[1], CELLAR_LAYOUT.waterline[2]), zone: "water", label: `${water.words()} on ${dateWords}` },
      { id: "date", position: at(dpx, dpy, dpz), zone: "rail", label: `The day on the rail — ${dateWords}` },
      { id: "scrub-back", position: at(-railLength / 2 - 0.35, railTop + 0.16, railZ), zone: "rail", label: "A day earlier on the rail" },
      { id: "scrub-forward", position: at(railLength / 2 + 0.35, railTop + 0.16, railZ), zone: "rail", label: "A day later on the rail" },
      { id: "today", position: at(0, railTop + 0.42, railZ), zone: "rail", label: "Back to today on the rail" },
    ];
    for (const jar of jars) {
      const reading = view.jars.find((row) => row.key === jar.key);
      const amount = reading ? engravedWords(reading.amountCents) : "—";
      const words = jar.pale() ? "not its day yet" : jar.visual() === "frosted" ? "planned" : jar.visual() === "solid" ? "set aside" : jar.visual() === "shattered" ? "paid" : "short — a crack";
      rows.push({
        id: `jar:${jar.key}`,
        position: at(jar.group.position.x, railTop + jar.height, railZ),
        zone: "jar",
        label: `${jar.label} — ${amount}, ${words}${reading?.missingMark ? ", label missing this cycle" : ""}. Open the jar.`,
        door: { target: "cellar-bills", object: jar.key },
      });
    }
    return rows;
  };

  const regionList = (): Region[] => {
    const rows: Region[] = [
      { id: "stair", group: "cellar", label: "The stair up to the court", box: box(stx - 0.9, 0, stz - 0.3, stx + 0.9, 1.6, stz + 2.5) },
      { id: "rail", group: "cellar", label: "The bill rail", box: box(-railLength / 2, railTop - 0.2, railZ - 0.3, railLength / 2, railTop + 0.3, railZ + 0.3) },
      { id: "waterline", group: "cellar", label: "Prepare's water line", box: box(CELLAR_WATER.centerX - CELLAR_WATER.radius - 0.3, 0, CELLAR_WATER.centerZ - CELLAR_WATER.radius - 0.3, CELLAR_WATER.centerX + CELLAR_WATER.radius + 0.3, CELLAR_WATER.plinth + CELLAR_WATER.glassTop + 0.1, CELLAR_WATER.centerZ + CELLAR_WATER.radius + 0.3) },
      { id: "date", group: "cellar", label: "The day on the rail", box: box(dpx - 0.35, dpy - 0.18, dpz - 0.1, dpx + 0.35, dpy + 0.18, dpz + 0.1) },
      { id: "scrub-back", group: "cellar", label: "A day earlier", box: box(-railLength / 2 - 0.6, railTop - 0.1, railZ - 0.3, -railLength / 2 - 0.1, railTop + 0.42, railZ + 0.3) },
      { id: "scrub-forward", group: "cellar", label: "A day later", box: box(railLength / 2 + 0.1, railTop - 0.1, railZ - 0.3, railLength / 2 + 0.6, railTop + 0.42, railZ + 0.3) },
      { id: "today", group: "cellar", label: "Back to today", box: box(-0.4, railTop + 0.3, railZ - 0.25, 0.4, railTop + 0.62, railZ + 0.25) },
    ];
    for (const jar of jars) {
      const x = jar.group.position.x;
      rows.push({ id: `jar:${jar.key}`, group: "cellar", label: jar.label, box: box(x - jar.radius - 0.03, railTop, railZ - jar.radius - 0.03, x + jar.radius + 0.03, railTop + jar.height, railZ + jar.radius + 0.03) });
    }
    return rows;
  };

  function animate(t: number, dt: number): boolean {
    const moving = water.tick(t, dt);
    const redraw = pendingRedraw;
    pendingRedraw = false;
    return moving || redraw;
  }

  return {
    group,
    update,
    animate,
    anchors: anchorList,
    poses: () => cellarPoses(anchorList()),
    regions: regionList,
    index: () => index,
    scrubTo(next) {
      const clamped = scrubStep(view, next, 0);
      if (clamped === index) return;
      index = clamped;
      applyScrub();
    },
    step(delta) {
      const next = scrubStep(view, index, delta);
      if (next === index) return;
      index = next;
      applyScrub();
    },
    today() {
      const next = scrubToday(view);
      if (next === index) return;
      index = next;
      applyScrub();
    },
    words: () => ({
      date: dateWords,
      water: water.words(),
      rail: view.jars.length ? `${view.jars.length} ${view.jars.length === 1 ? "jar" : "jars"} on the rail` : "no bills on the rail yet",
      jars: jars.map((jar) => ({ key: jar.key, label: jar.label, state: jar.visual(), pale: jar.pale() })),
    }),
    jars: () => jars,
    get ready() { return landed; },
    drawCalls() {
      let count = 0;
      group.traverse((node) => { if ((node instanceof THREE.Mesh || node instanceof THREE.InstancedMesh) && node.visible) count++; });
      return count;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      scene.remove(group);
      clearJars();
      water.dispose();
      datePlate.dispose();
      lamp.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}

/** The registry entry: `PLACES.cellar`. */
export const cellarPlace: Place = registerPlace({
  id: "cellar",
  build(scene, dressing, reading, quality, context) {
    return createCellar(scene, {
      dressing: cellarDressingFrom(dressing),
      reading,
      quality,
      // The place reads the person's motion preference the way the Tower does,
      // so an arriving cellar cuts its water into place instead of easing it.
      reduced: typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
      ...(context?.signal ? { signal: context.signal } : {}),
      onLanded: () => context?.invalidate(),
    });
  },
});
