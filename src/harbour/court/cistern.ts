import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { CisternReading } from "../data/reading.ts";
import type { Anchor, Region, Vec3 } from "../scene/place.ts";
import type { CourtDressing } from "./dressing.ts";
import { EngravedPlate, engravedWords } from "./engraved.ts";

/**
 * The Cistern — Protect, in the Court (LITTLE_HARBOUR_v2 §2, BUILD_PLAN_SLICE2 §4).
 *
 * A low round stone well beside the Knight: a winch with a rope over it, water
 * inside at `protect.cents / protect.target`, a brass band at the target line,
 * and a plate with the two numbers. Under a worn or damaged house the water
 * sits low and the stone is dark down to the old line.
 *
 * Tapping it opens the Protect surface that already exists
 * (`onOpen("loft-banks", "bank/plan:protect")`). Nothing here moves money.
 */

/** Beside the Knight (−4.2, 0, −3.0), clear of the terrace prop at (−5.0, 0, −0.4) and inside the terrace. */
export const CISTERN_POSITION: Vec3 = [-5.2, 0, -1.6];

export const CISTERN = {
  /** Outer radius of the well's wall, and how thick that wall is. */
  radius: 0.62,
  wall: 0.11,
  /** How high the wall stands, and how deep the shaft reads. */
  height: 0.56,
  shaft: 0.46,
  /** The water never drains out of sight and never tops the rim. */
  minLevel: 0.06,
  maxLevel: 1,
} as const;

export type PhysicalCondition = "kept" | "worn" | "damaged";

export type CisternSceneReading = { cistern: CisternReading | null; physical: PhysicalCondition };

/** Clamps the reading's own level into the range the well can actually show. */
export function cisternLevel(reading: Pick<CisternReading, "cents" | "target" | "level"> | null): number {
  if (!reading) return CISTERN.minLevel;
  const raw = Number.isFinite(reading.level) ? reading.level
    : reading.cents !== null && Number.isFinite(reading.cents) && reading.target > 0 ? reading.cents / reading.target
      : CISTERN.minLevel;
  if (!Number.isFinite(raw)) return CISTERN.minLevel;
  return Math.max(CISTERN.minLevel, Math.min(CISTERN.maxLevel, raw));
}

/** The plate's two numbers, in words. Unknown reads "—", never "$0". */
export function cisternWords(reading: CisternReading | null): string {
  if (!reading) return "—\nof —";
  return `${engravedWords(reading.cents)}\nof ${engravedWords(reading.target > 0 ? reading.target : null)}`;
}

/** The house's physical wear, with the shipped `condition.state` standing in until every reading names it. */
export function cisternPhysical(value: unknown): PhysicalCondition {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const condition = row.condition && typeof row.condition === "object" ? (row.condition as Record<string, unknown>) : null;
  const physical = condition?.physical;
  if (physical === "worn" || physical === "damaged" || physical === "kept") return physical;
  if (condition?.state === "weathered") return "damaged";
  if (condition?.state === "wilting") return "worn";
  return "kept";
}

/** Narrows any reading-shaped value to what the Cistern needs. */
export function readCisternReading(value: unknown): CisternSceneReading {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const raw = row.cistern && typeof row.cistern === "object" ? (row.cistern as Record<string, unknown>) : null;
  const protect = row.protect && typeof row.protect === "object" ? (row.protect as Record<string, unknown>) : null;
  const cents = (source: Record<string, unknown> | null, key: string): number | null => {
    const found = source?.[key];
    return typeof found === "number" && Number.isFinite(found) ? found : null;
  };
  // A reading that has not grown its `cistern` row yet still has Protect's two numbers.
  const source = raw ?? (protect ? { cents: cents(protect, "cents"), target: cents(protect, "target") ?? 0, level: Number.NaN } : null);
  if (!source) return { cistern: null, physical: cisternPhysical(value) };
  const target = cents(source as Record<string, unknown>, "target") ?? 0;
  const own = (source as Record<string, unknown>).level;
  const level = typeof own === "number" && Number.isFinite(own) ? own
    : cents(source as Record<string, unknown>, "cents") !== null && target > 0 ? (cents(source as Record<string, unknown>, "cents") as number) / target
      : CISTERN.minLevel;
  return { cistern: { cents: cents(source as Record<string, unknown>, "cents"), target, level }, physical: cisternPhysical(value) };
}

export type CisternHandle = {
  group: THREE.Group;
  /** Accepts any reading-shaped value (`readCisternReading` narrows it). */
  update(reading: unknown): void;
  anchors(): Anchor[];
  regions(): Region[];
  /** The level the water currently stands at, 0.06–1. */
  level(): number;
  /** Current plate words, for the twins and the tests. */
  words(): string;
  dispose(): void;
};

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

/**
 * Builds the well. The caller sets `group.position` (the court uses
 * `CISTERN_POSITION`) and adds it to the court's own group.
 */
export function createCistern(dressing: CourtDressing, reading?: unknown): CisternHandle {
  const { radius, wall, height, shaft } = CISTERN;
  const group = new THREE.Group();
  group.name = "cistern";
  group.userData.anchor = "cistern";

  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => track(new THREE.MeshStandardMaterial({ color, roughness: 0.88, metalness: 0, ...extra }));

  const stoneMaterial = mat(dressing.stone, { roughness: 0.92 });

  // The round wall with its coping ring, as one mesh: the well is stone all the way up.
  const well = merged([
    placed(new THREE.CylinderGeometry(radius, radius * 1.04, height, 22, 1, true), 0, height / 2, 0),
    placed(new THREE.TorusGeometry(radius - wall / 2, wall / 2, 6, 22), 0, height, 0, [Math.PI / 2, 0, 0]),
  ], stoneMaterial);
  track(well.geometry);
  well.castShadow = true; well.receiveShadow = true;
  well.name = "cistern-wall";
  well.userData.anchor = "cistern";
  group.add(well);

  // The shaft below the rim: a dark inner cylinder so the well reads as a hole, not a tub.
  const inner = new THREE.Mesh(track(new THREE.CylinderGeometry(radius - wall, radius - wall, shaft, 20, 1, true)), mat(dressing.joint, { roughness: 1, side: THREE.BackSide }));
  inner.position.y = height - shaft / 2;
  inner.name = "cistern-shaft";
  group.add(inner);

  // The water inside: a disc that rides up and down the shaft.
  const water = new THREE.Mesh(track(new THREE.CircleGeometry(radius - wall - 0.01, 20)), mat(dressing.sea, { roughness: 0.15, metalness: 0.1 }));
  water.rotation.x = -Math.PI / 2;
  water.name = "cistern-water";
  group.add(water);

  // The old line: how dark the stone is above where the water used to stand.
  const oldLine = new THREE.Mesh(track(new THREE.CylinderGeometry(radius - wall + 0.002, radius - wall + 0.002, 0.04, 20, 1, true)), mat(dressing.joint, { roughness: 1, transparent: true, opacity: 0.7, side: THREE.BackSide }));
  oldLine.name = "cistern-old-line"; oldLine.visible = false;
  group.add(oldLine);

  // The winch: two posts, a crossbeam, a barrel, a crank and a rope with a bucket.
  const posts = merged([
    placed(new THREE.BoxGeometry(0.07, 0.86, 0.07), -radius + 0.06, 0.43 + height * 0.3, 0),
    placed(new THREE.BoxGeometry(0.07, 0.86, 0.07), radius - 0.06, 0.43 + height * 0.3, 0),
    placed(new THREE.BoxGeometry(radius * 2 - 0.04, 0.07, 0.07), 0, 0.86 + height * 0.3, 0),
  ], mat(dressing.timber, { roughness: 0.8 }));
  track(posts.geometry); posts.castShadow = true; posts.name = "cistern-winch"; posts.userData.anchor = "cistern";
  group.add(posts);

  // The winch barrel and crank, and the brass band at the target line — where the
  // water stands when Protect is whole. One brass mesh for all of it.
  const barrel = merged([
    placed(new THREE.CylinderGeometry(0.055, 0.055, radius * 1.5, 10), 0, 0.76 + height * 0.3, 0, [0, 0, Math.PI / 2]),
    placed(new THREE.TorusGeometry(0.07, 0.014, 5, 12), radius - 0.12, 0.76 + height * 0.3, 0, [0, Math.PI / 2, 0]),
    placed(new THREE.BoxGeometry(0.12, 0.02, 0.02), radius - 0.05, 0.83 + height * 0.3, 0),
    placed(new THREE.TorusGeometry(radius - wall + 0.006, 0.012, 5, 20), 0, height - 0.02, 0, [Math.PI / 2, 0, 0]),
  ], mat(dressing.metal, { roughness: 0.34, metalness: 0.64 }));
  track(barrel.geometry); barrel.name = "cistern-band"; barrel.userData.anchor = "cistern";
  group.add(barrel);

  const rope = new THREE.Mesh(track(new THREE.CylinderGeometry(0.008, 0.008, 1, 6)), mat(dressing.gate.rail, { roughness: 1 }));
  rope.name = "cistern-rope";
  group.add(rope);

  // The plate with the two numbers, leaning on the well's face toward the court.
  const plate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 0.52, 0.3));
  plate.mesh.position.set(0, height * 0.55, radius + 0.015);
  plate.mesh.rotation.x = -0.12;
  plate.mesh.userData.anchor = "cistern";
  plate.mesh.name = "cistern-plate";
  group.add(plate.mesh);

  let current: number = CISTERN.minLevel;
  let words = "—\nof —";
  const stone = new THREE.Color(dressing.stone);
  const dark = new THREE.Color(dressing.joint);

  function update(value: unknown): void {
    const next = readCisternReading(value);
    current = cisternLevel(next.cistern);
    words = cisternWords(next.cistern);
    plate.set(words, next.physical === "kept" ? "glazed" : "matte");
    // The water rides the shaft between the floor of the well and the brass band.
    const top = height - 0.03;
    const bottom = height - shaft + 0.02;
    const worn = next.physical !== "kept";
    // Worn or damaged: the water sits low whatever the books say, and the old line shows.
    const shown = worn ? Math.min(current, next.physical === "damaged" ? 0.32 : 0.55) : current;
    water.position.y = bottom + (top - bottom) * shown;
    oldLine.visible = worn;
    oldLine.position.y = bottom + (top - bottom) * Math.max(shown, current) + 0.02;
    stoneMaterial.color.copy(stone).lerp(dark, worn ? (next.physical === "damaged" ? 0.5 : 0.28) : 0);
    // The rope hangs from the barrel to a hand's width above the water.
    const barrelY = 0.76 + height * 0.3;
    const length = Math.max(0.08, barrelY - water.position.y - 0.12);
    rope.scale.y = length;
    rope.position.set(0, barrelY - length / 2, 0);
  }
  update(reading ?? null);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const [cx, , cz] = CISTERN_POSITION;

  return {
    group,
    update,
    level: () => current,
    words: () => words,
    anchors: () => [{
      id: "cistern",
      position: at(cx, height + 0.3, cz),
      zone: "court",
      label: `The cistern — Protect ${words.replace("\n", " ")}. Open Protect.`,
      door: { target: "loft-banks", object: "bank/plan:protect" },
    }],
    regions: () => [{
      id: "cistern",
      group: "court",
      label: "The cistern — Protect",
      box: new THREE.Box3(new THREE.Vector3(cx - radius - 0.1, 0, cz - radius - 0.1), new THREE.Vector3(cx + radius + 0.1, 1.3, cz + radius + 0.1)),
    }],
    dispose() {
      group.removeFromParent();
      plate.dispose();
      for (const item of disposables) item.dispose();
    },
  };
}
