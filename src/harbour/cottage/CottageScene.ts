import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { EMPTY_COTTAGE_READING, type CottageReading } from "../data/reading.ts";
import { cottageDressingFrom, type CottageDressing } from "./dressing.ts";

/**
 * Hercules's Cottage (LITTLE_HARBOUR_v2 §2, "Making") — his room, given a
 * house of its own.
 *
 * One crooked room on the lawn, full screen and loud and proud: the armoire
 * against the left wall with its doors a hand's breadth open and the rail of
 * hangers inside; the cheval glass beside it, swung to catch the window; the
 * cabinet of wonders glazed along the right wall with the kept looks and the
 * keepsakes on its shelves; the bay window at the back with the cushion he
 * sleeps on; and the bell on its bracket by the door, which is how you ask
 * him to come.
 *
 * Every station is a **door** (`onOpen`) onto the room that already owns it —
 * the dressing room for the wardrobe, the glass and the cabinet, the
 * companion's own surface for the bell and for him. The cottage reimplements
 * none of them, and it **writes nothing**: the shelves stand counts, never
 * contents, so a look nobody shared does not render here.
 */

export const COTTAGE_LAYOUT = {
  halfWidth: 3.2,
  halfDepth: 2.6,
  wallHeight: 2.3,
  ridge: 3.15,
  /** The rail the wainscot stops at, and the picture rail above it. */
  chair: 0.95,
  picture: 1.85,
  /** The armoire and the cheval glass, along the left wall. */
  wardrobe: [-2.55, 0, -0.55] as const,
  mirror: [-1.85, 0, 1.35] as const,
  /** The cabinet of wonders, along the right wall. */
  cabinet: [2.7, 0, -0.35] as const,
  /** The bay window at the back, and the seat under it. */
  seat: [0.15, 0, -2.2] as const,
  /** The cottage door, front-right, with the cat flap cut in it; the bell on its bracket beside. */
  door: [1.75, 0, 2.45] as const,
  bell: [0.75, 1.55, 2.5] as const,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The shelves he can actually stand things on: the cabinet holds five kept looks and four keepsakes. */
export const CABINET_LOOKS = 5;
export const CABINET_KEEPSAKES = 4;

/** A count in words that never shames an empty shelf: "nothing yet" is a state, not a fault. */
export function kept(count: number, one: string, many: string): string {
  return count === 0 ? "nothing yet" : `${count} ${count === 1 ? one : many}`;
}

/** What he has on, in words. Slots, never pieces — the cottage never says which. */
export function wearingWords(worn: number, name: string): string {
  if (worn <= 0) return `${name} is in his own fur today`;
  return `${name} is wearing ${worn} ${worn === 1 ? "piece" : "pieces"}`;
}

// Stand just inside the cottage door: the armoire and the glass down the left
// wall, the cabinet on the right, the window seat and the cat straight ahead.
const PHONE_ROOM: Pose = { target: [-0.15, 1.0, -0.6], r: 3.5, theta: 0.1, phi: 1.3 };
const DESKTOP_ROOM: Pose = { target: [0, 1.0, -0.5], r: 3.8, theta: 0.28, phi: 1.29 };

export function cottagePoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "cottage:phone": PHONE_ROOM,
    "cottage:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.2, -0.5], r: 5.6, theta: 0, phi: 1.04 },
    "sky:desktop": { target: [0, 1.25, -0.5], r: 6.1, theta: 0.2, phi: 1.02 },
    // The door frieze: the window seat and the cat, for the band above an open tool.
    "door:phone": { target: [0.15, 0.95, -1.9], r: 1.9, theta: 0.02, phi: 1.3 },
    "door:desktop": { target: [0.2, 0.95, -1.9], r: 2.1, theta: 0.06, phi: 1.3 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 4.2) * 0.6, -0.65, 0.65);
    const close = anchor.zone === "stair" ? 2.3 : 1.7;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.6, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.6, y), z], r: close + 0.4, theta: theta + 0.16, phi: 1.14 };
  }
  return poses;
}

export type CottageSceneReading = { cottage: CottageReading | null };

/** Narrows whatever the shell hands over to the cottage's own counts. */
export function readCottageReading(value: unknown): CottageSceneReading {
  if (!value || typeof value !== "object") return { cottage: null };
  const source = value as { cottage?: CottageReading };
  return { cottage: source.cottage ?? null };
}

export type CottageOptions = {
  dressing: CottageDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createCottage(scene: THREE.Scene, options: CottageOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "cottage";
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
  /** Everything a station is made of answers to the station's own name when a ray lands on it. */
  const owned = (object: THREE.Object3D, anchor: string): THREE.Object3D => {
    object.userData.anchor = anchor;
    object.traverse((node) => { node.userData.anchor = anchor; });
    return object;
  };

  const contacts = track(createContactShadows({ ink: dressing.ink }));
  const { halfWidth, halfDepth, wallHeight, ridge, chair, picture } = COTTAGE_LAYOUT;

  // ── The shell: wide boards underfoot, plaster over wainscot, a crooked roof ─
  const floor = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, halfDepth * 2)), mat(dressing.floor, { roughness: 0.96 })), false, true);
  floor.rotation.x = -Math.PI / 2; floor.name = "cottage-floor"; group.add(floor);
  // The board seams: thin dark lines, so the floor reads as boards and not as paint.
  const seams = merged(
    Array.from({ length: 7 }, (_, i) => placed(new THREE.BoxGeometry(0.015, 0.006, halfDepth * 2), -halfWidth + (i + 1) * (halfWidth * 2 / 8), 0.004, 0)),
    mat(dressing.rail, { roughness: 0.95 }),
  );
  seams.name = "cottage-seams"; group.add(seams);
  const walls = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.2), 0, wallHeight / 2, -halfDepth),
    placed(new THREE.BoxGeometry(0.2, wallHeight, halfDepth * 2), -halfWidth, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(0.2, wallHeight, halfDepth * 2), halfWidth, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.2), 0, wallHeight / 2, halfDepth),
  ], mat(dressing.plaster, { roughness: 0.95 }));
  shadowed(walls, false, true); walls.name = "cottage-walls"; group.add(walls);
  // The wainscot: painted boards up to the chair rail, a beaded rail on top of them.
  const wainscot = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2 - 0.04, chair, 0.04), 0, chair / 2, -halfDepth + 0.12),
    placed(new THREE.BoxGeometry(0.04, chair, halfDepth * 2 - 0.04), -halfWidth + 0.12, chair / 2, 0),
    placed(new THREE.BoxGeometry(0.04, chair, halfDepth * 2 - 0.04), halfWidth - 0.12, chair / 2, 0),
  ], mat(dressing.wainscot, { roughness: 0.92 }));
  wainscot.name = "cottage-wainscot"; group.add(wainscot);
  // Two rails at two weights: the chair rail heavy, the picture rail light.
  const rails = merged([
    ...[[chair, 0.055], [picture, 0.03]].flatMap(([y, thickness]) => [
      placed(new THREE.BoxGeometry(halfWidth * 2 - 0.02, thickness!, thickness! * 1.4), 0, y!, -halfDepth + 0.13),
      placed(new THREE.BoxGeometry(thickness! * 1.4, thickness!, halfDepth * 2 - 0.02), -halfWidth + 0.13, y!, 0),
      placed(new THREE.BoxGeometry(thickness! * 1.4, thickness!, halfDepth * 2 - 0.02), halfWidth - 0.13, y!, 0),
    ]),
  ], mat(dressing.rail, { roughness: 0.85 }));
  rails.name = "cottage-rails"; group.add(rails);
  // The roof is crooked on purpose: the ridge sits off centre and the tie beams sag a hair.
  const ridgeX = 0.35;
  const beams: THREE.BufferGeometry[] = [];
  for (const side of [-1, 1] as const) {
    const foot = side * halfWidth;
    const run = Math.hypot(foot - ridgeX, ridge - wallHeight);
    const pitch = Math.atan2(Math.abs(foot - ridgeX), ridge - wallHeight);
    for (const z of [-halfDepth + 0.5, 0, halfDepth - 0.5]) {
      beams.push(placed(new THREE.BoxGeometry(0.075, run, 0.075), (foot + ridgeX) / 2, (wallHeight + ridge) / 2, z, [0, 0, side * pitch]));
    }
  }
  beams.push(placed(new THREE.BoxGeometry(0.09, 0.11, halfDepth * 2), ridgeX, ridge, 0));
  for (const z of [-halfDepth + 0.5, halfDepth - 0.5]) beams.push(placed(new THREE.BoxGeometry(halfWidth * 2, 0.07, 0.07), 0, wallHeight + 0.14, z, [0, 0, 0.012]));
  const roofFrame = merged(beams, mat(dressing.beam, { roughness: 0.88 }));
  roofFrame.name = "cottage-beams"; group.add(roofFrame);

  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.52);
  group.add(hemi);

  // ── The bay window at the back, and the seat he sleeps on ─────────────────
  const [sx, , sz] = COTTAGE_LAYOUT.seat;
  const bayFrame = merged([
    placed(new THREE.BoxGeometry(2.0, 0.1, 0.1), sx, 2.02, sz - 0.28),
    placed(new THREE.BoxGeometry(2.0, 0.1, 0.1), sx, 0.94, sz - 0.28),
    placed(new THREE.BoxGeometry(0.1, 1.2, 0.1), sx - 0.95, 1.48, sz - 0.28),
    placed(new THREE.BoxGeometry(0.1, 1.2, 0.1), sx + 0.95, 1.48, sz - 0.28),
    placed(new THREE.BoxGeometry(0.055, 1.12, 0.08), sx, 1.48, sz - 0.28),
    placed(new THREE.BoxGeometry(1.9, 0.055, 0.08), sx, 1.48, sz - 0.28),
  ], mat(dressing.window, { roughness: 0.7 }));
  bayFrame.name = "cottage-bay"; group.add(bayFrame);
  const day = new THREE.Mesh(track(new THREE.PlaneGeometry(1.84, 1.04)), track(new THREE.MeshBasicMaterial({ color: dressing.day })));
  day.position.set(sx, 1.48, sz - 0.3); day.name = "cottage-day"; group.add(day);
  // The raking light the window lays across the boards, and the warmer pool on the cushion.
  const rake = new THREE.Mesh(track(new THREE.PlaneGeometry(1.9, 2.4)), track(new THREE.MeshBasicMaterial({ color: dressing.light.lamp, transparent: true, opacity: 0.07, depthWrite: false })));
  rake.rotation.x = -Math.PI / 2; rake.position.set(sx - 0.1, 0.02, sz + 1.5); rake.renderOrder = 2; group.add(rake);
  const seat = merged([
    placed(new THREE.BoxGeometry(2.1, 0.12, 0.62), sx, 0.44, sz + 0.06),
    placed(new THREE.BoxGeometry(0.14, 0.38, 0.6), sx - 0.98, 0.19, sz + 0.06),
    placed(new THREE.BoxGeometry(0.14, 0.38, 0.6), sx + 0.98, 0.19, sz + 0.06),
    placed(new THREE.BoxGeometry(1.86, 0.36, 0.08), sx, 0.18, sz + 0.33),
  ], mat(dressing.wainscot, { roughness: 0.9 }));
  shadowed(seat, false, true); seat.name = "cottage-seat"; owned(seat, "window-seat"); group.add(seat);
  const cushion = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(1.94, 0.14, 0.54)), mat(dressing.cushion, { roughness: 0.95 })), false, true);
  cushion.position.set(sx, 0.56, sz + 0.06); owned(cushion, "window-seat"); group.add(cushion);
  contacts.disc(sx, sz + 0.4, 1.05, 0.45, group);

  // ── Hercules, asleep on the cushion: a porcelain loaf, the Court's own cat ─
  const hercules = new THREE.Group();
  hercules.name = "cottage-hercules";
  hercules.position.set(sx - 0.45, 0.63, sz + 0.06);
  hercules.rotation.y = 0.85;
  {
    const porcelain = mat(dressing.porcelain, { roughness: 0.35 });
    const pink = mat(dressing.pink, { roughness: 0.6 });
    const ink = mat(dressing.whisker, { roughness: 0.5 });
    const body = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.26, 16, 12)), porcelain));
    body.scale.set(1.3, 0.62, 0.92); body.position.y = 0.16; hercules.add(body);
    const head = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.165, 14, 10)), porcelain));
    head.scale.set(1, 0.9, 0.95); head.position.set(0.31, 0.24, 0.03); hercules.add(head);
    const earOuter = merged([
      placed(new THREE.ConeGeometry(0.065, 0.13, 6), 0.35, 0.4, -0.09, [0.25, 0, -0.2]),
      placed(new THREE.ConeGeometry(0.065, 0.13, 6), 0.35, 0.4, 0.15, [-0.25, 0, -0.2]),
    ], porcelain);
    hercules.add(earOuter);
    const earInner = merged([
      placed(new THREE.ConeGeometry(0.034, 0.08, 6), 0.37, 0.41, -0.09, [0.25, 0, -0.2]),
      placed(new THREE.ConeGeometry(0.034, 0.08, 6), 0.37, 0.41, 0.15, [-0.25, 0, -0.2]),
    ], pink);
    hercules.add(earInner);
    const face = merged([
      // Two closed eyes and a nose: asleep, and unmistakably him.
      placed(new THREE.BoxGeometry(0.045, 0.011, 0.01), 0.45, 0.27, -0.04),
      placed(new THREE.BoxGeometry(0.045, 0.011, 0.01), 0.45, 0.27, 0.11),
      placed(new THREE.SphereGeometry(0.026, 8, 6), 0.47, 0.22, 0.04),
    ], ink);
    hercules.add(face);
    // The tail curls round his flank and hangs a little over the edge of the seat.
    const tail = shadowed(new THREE.Mesh(track(new THREE.TorusGeometry(0.19, 0.04, 7, 14, Math.PI * 1.2)), porcelain));
    tail.rotation.x = Math.PI / 2; tail.rotation.z = Math.PI * 0.55; tail.position.set(-0.3, 0.07, 0.2); hercules.add(tail);
    owned(hercules, "window-seat");
    group.add(hercules);
  }

  // ── The armoire: doors a hand's breadth open, the rail of hangers inside ───
  const [wx, , wz] = COTTAGE_LAYOUT.wardrobe;
  const armoire = merged([
    // The carcase: two sides, a back, a top and a plinth, hollow so the rail shows.
    placed(new THREE.BoxGeometry(0.62, 2.0, 0.06), wx - 0.02, 1.02, wz - 0.72),
    placed(new THREE.BoxGeometry(0.62, 2.0, 0.06), wx - 0.02, 1.02, wz + 0.72),
    placed(new THREE.BoxGeometry(0.06, 2.0, 1.5), wx - 0.3, 1.02, wz),
    placed(new THREE.BoxGeometry(0.72, 0.09, 1.62), wx - 0.02, 2.06, wz),
    placed(new THREE.BoxGeometry(0.72, 0.14, 1.62), wx - 0.02, 0.07, wz),
    // A little pediment, out of true: the cottage's one flourish.
    placed(new THREE.BoxGeometry(0.5, 0.11, 1.4), wx + 0.02, 2.18, wz, [0, 0, 0.02]),
  ], mat(dressing.wardrobe, { roughness: 0.86 }));
  shadowed(armoire, full, true); armoire.name = "cottage-armoire"; owned(armoire, "wardrobe"); group.add(armoire);
  const armoireDoors = merged([
    // Hinged at the outer edges and swung open toward the room.
    placed(new THREE.BoxGeometry(0.05, 1.86, 0.7), wx + 0.46, 1.02, wz - 0.56, [0, -0.42, 0]),
    placed(new THREE.BoxGeometry(0.05, 1.86, 0.7), wx + 0.46, 1.02, wz + 0.56, [0, 0.42, 0]),
  ], mat(dressing.wardrobeDoor, { roughness: 0.82 }));
  shadowed(armoireDoors, false, true); armoireDoors.name = "cottage-armoire-doors"; owned(armoireDoors, "wardrobe"); group.add(armoireDoors);
  const hangers = merged([
    placed(new THREE.CylinderGeometry(0.022, 0.022, 1.36, 8), wx, 1.72, wz, [Math.PI / 2, 0, 0]),
    ...Array.from({ length: 6 }, (_, i) => placed(new THREE.TorusGeometry(0.035, 0.008, 5, 10), wx, 1.72, wz - 0.55 + i * 0.22, [0, Math.PI / 2, 0])),
    ...Array.from({ length: 6 }, (_, i) => placed(new THREE.BoxGeometry(0.26, 0.02, 0.02), wx, 1.6, wz - 0.55 + i * 0.22, [0, 0, (i % 2 ? 1 : -1) * 0.06])),
  ], mat(dressing.hanger, { roughness: 0.42, metalness: 0.5 }));
  hangers.name = "cottage-hangers"; owned(hangers, "wardrobe"); group.add(hangers);
  const knobs = merged([
    placed(new THREE.SphereGeometry(0.035, 8, 6), wx + 0.62, 1.05, wz - 0.3),
    placed(new THREE.SphereGeometry(0.035, 8, 6), wx + 0.62, 1.05, wz + 0.3),
  ], mat(dressing.brass, { roughness: 0.35, metalness: 0.62 }));
  knobs.name = "cottage-knobs"; owned(knobs, "wardrobe"); group.add(knobs);
  contacts.disc(wx, wz, 0.85, 0.6, group);

  // ── The cheval glass, swung to catch the window ───────────────────────────
  const [mx, , mz] = COTTAGE_LAYOUT.mirror;
  const cheval = new THREE.Group();
  cheval.name = "cottage-mirror";
  {
    const stand = merged([
      placed(new THREE.BoxGeometry(0.07, 1.25, 0.07), 0, 0.63, -0.42),
      placed(new THREE.BoxGeometry(0.07, 1.25, 0.07), 0, 0.63, 0.42),
      placed(new THREE.BoxGeometry(0.1, 0.07, 1.06), 0, 0.045, 0),
      placed(new THREE.BoxGeometry(0.34, 0.06, 0.09), 0, 0.045, -0.5, [0, 0, 0]),
      placed(new THREE.BoxGeometry(0.34, 0.06, 0.09), 0, 0.045, 0.5, [0, 0, 0]),
    ], mat(dressing.mirrorFrame, { roughness: 0.84 }));
    shadowed(stand, false, true); cheval.add(stand);
    // The glass swings in its yoke: tilted back a little, the way a glass is left.
    const swing = new THREE.Group();
    swing.position.y = 1.18; swing.rotation.x = -0.16;
    const frame = merged([
      placed(new THREE.BoxGeometry(0.07, 1.32, 0.07), 0, 0, -0.4),
      placed(new THREE.BoxGeometry(0.07, 1.32, 0.07), 0, 0, 0.4),
      placed(new THREE.BoxGeometry(0.07, 0.07, 0.87), 0, 0.63, 0),
      placed(new THREE.BoxGeometry(0.07, 0.07, 0.87), 0, -0.63, 0),
    ], mat(dressing.mirrorFrame, { roughness: 0.8 }));
    swing.add(frame);
    // A cold pane, not a reflection: the mirror in `src/wardrobe/scene.ts` is the real glass,
    // and this room never asks the renderer for a second pass.
    const pane = new THREE.Mesh(track(new THREE.PlaneGeometry(0.8, 1.26)), track(new THREE.MeshStandardMaterial({ color: dressing.glass, roughness: 0.14, metalness: 0.35 })));
    pane.rotation.y = Math.PI / 2; pane.position.x = 0.034; swing.add(pane);
    const glint = new THREE.Mesh(track(new THREE.PlaneGeometry(0.2, 1.0)), track(new THREE.MeshBasicMaterial({ color: dressing.day, transparent: true, opacity: 0.22, depthWrite: false })));
    glint.rotation.y = Math.PI / 2; glint.rotation.z = 0.14; glint.position.set(0.04, 0.1, -0.16); glint.renderOrder = 3; swing.add(glint);
    cheval.add(swing);
    cheval.position.set(mx, 0, mz);
    cheval.rotation.y = 0.62;
    owned(cheval, "mirror");
    group.add(cheval);
  }
  contacts.disc(mx, mz, 0.6, 0.55, group);

  // ── The cabinet of wonders, glazed, along the right wall ──────────────────
  const [cx, , cz] = COTTAGE_LAYOUT.cabinet;
  const cabinet = merged([
    placed(new THREE.BoxGeometry(0.06, 1.85, 2.0), cx + 0.28, 0.98, cz),
    placed(new THREE.BoxGeometry(0.58, 1.85, 0.07), cx, 0.98, cz - 0.97),
    placed(new THREE.BoxGeometry(0.58, 1.85, 0.07), cx, 0.98, cz + 0.97),
    placed(new THREE.BoxGeometry(0.66, 0.08, 2.1), cx, 1.93, cz),
    placed(new THREE.BoxGeometry(0.66, 0.12, 2.1), cx, 0.08, cz),
    placed(new THREE.BoxGeometry(0.62, 0.07, 0.07), cx - 0.02, 1.36, cz),
  ], mat(dressing.cabinet, { roughness: 0.86 }));
  shadowed(cabinet, full, true); cabinet.name = "cottage-cabinet"; owned(cabinet, "cabinet"); group.add(cabinet);
  const CABINET_SHELVES = [0.58, 1.02, 1.46] as const;
  const cabinetShelves = merged(
    CABINET_SHELVES.map((y) => placed(new THREE.BoxGeometry(0.5, 0.04, 1.88), cx, y, cz)),
    mat(dressing.cabinetShelf, { roughness: 0.85 }),
  );
  cabinetShelves.name = "cottage-cabinet-shelves"; owned(cabinetShelves, "cabinet"); group.add(cabinetShelves);
  const glazing = new THREE.Mesh(track(new THREE.PlaneGeometry(1.86, 1.72)), track(new THREE.MeshStandardMaterial({ color: dressing.glazing, transparent: true, opacity: 0.2, roughness: 0.12, metalness: 0.2, side: THREE.DoubleSide })));
  glazing.rotation.y = -Math.PI / 2; glazing.position.set(cx - 0.3, 1.0, cz); glazing.renderOrder = 3;
  glazing.name = "cottage-glazing"; owned(glazing, "cabinet"); group.add(glazing);
  const astragals = merged([
    placed(new THREE.BoxGeometry(0.03, 1.74, 0.03), cx - 0.3, 1.0, cz),
    placed(new THREE.BoxGeometry(0.03, 0.03, 1.88), cx - 0.3, 1.0, cz),
  ], mat(dressing.brass, { roughness: 0.38, metalness: 0.55 }));
  astragals.name = "cottage-astragals"; owned(astragals, "cabinet"); group.add(astragals);
  contacts.disc(cx, cz, 0.85, 0.55, group);

  // ── The cottage door, its cat flap, and the bell on its bracket ───────────
  const [dx, , dz] = COTTAGE_LAYOUT.door;
  const doorCase = merged([
    placed(new THREE.BoxGeometry(0.14, 2.05, 0.16), dx - 0.52, 1.02, dz),
    placed(new THREE.BoxGeometry(0.14, 2.05, 0.16), dx + 0.52, 1.02, dz),
    placed(new THREE.BoxGeometry(1.18, 0.14, 0.16), dx, 2.06, dz),
    // The cat's own door beside the person's: a small arch cut through the jamb.
    placed(new THREE.BoxGeometry(0.06, 0.42, 0.14), dx - 1.02, 0.21, dz),
    placed(new THREE.BoxGeometry(0.06, 0.42, 0.14), dx - 1.5, 0.21, dz),
    placed(new THREE.BoxGeometry(0.54, 0.06, 0.14), dx - 1.26, 0.45, dz),
  ], mat(dressing.rail, { roughness: 0.85 }));
  doorCase.name = "cottage-door"; owned(doorCase, "court-door"); group.add(doorCase);
  const doorLight = new THREE.Mesh(track(new THREE.PlaneGeometry(0.88, 1.9)), track(new THREE.MeshBasicMaterial({ color: dressing.day, transparent: true, opacity: 0.5, depthWrite: false })));
  doorLight.position.set(dx, 0.98, dz - 0.09); doorLight.rotation.y = Math.PI; owned(doorLight, "court-door"); group.add(doorLight);
  const flapLight = new THREE.Mesh(track(new THREE.PlaneGeometry(0.42, 0.4)), track(new THREE.MeshBasicMaterial({ color: dressing.day, transparent: true, opacity: 0.42, depthWrite: false })));
  flapLight.position.set(dx - 1.26, 0.21, dz - 0.08); flapLight.rotation.y = Math.PI; owned(flapLight, "court-door"); group.add(flapLight);

  const [bx, by, bz] = COTTAGE_LAYOUT.bell;
  const bell = new THREE.Group();
  bell.name = "cottage-bell";
  {
    const bracket = merged([
      placed(new THREE.BoxGeometry(0.04, 0.26, 0.04), 0, 0.13, 0),
      placed(new THREE.BoxGeometry(0.04, 0.04, 0.24), 0, 0.26, -0.1),
      placed(new THREE.BoxGeometry(0.03, 0.18, 0.03), 0, 0.17, -0.2, [0.7, 0, 0]),
    ], mat(dressing.brass, { roughness: 0.36, metalness: 0.6 }));
    bell.add(bracket);
    const body = shadowed(new THREE.Mesh(track(new THREE.CylinderGeometry(0.045, 0.1, 0.15, 12, 1, true)), track(new THREE.MeshStandardMaterial({ color: dressing.bell, roughness: 0.3, metalness: 0.66, side: THREE.DoubleSide }))));
    body.position.set(0, 0.16, -0.22); bell.add(body);
    const clapper = new THREE.Mesh(track(new THREE.SphereGeometry(0.026, 8, 6)), mat(dressing.brass, { roughness: 0.34, metalness: 0.6 }));
    clapper.position.set(0, 0.075, -0.22); bell.add(clapper);
    const cord = new THREE.Mesh(track(new THREE.CylinderGeometry(0.009, 0.009, 0.64, 5)), mat(dressing.cord, { roughness: 0.92 }));
    cord.position.set(0, -0.24, -0.22); bell.add(cord);
    const tassel = new THREE.Mesh(track(new THREE.ConeGeometry(0.035, 0.1, 8)), mat(dressing.cord, { roughness: 0.94 }));
    tassel.position.set(0, -0.59, -0.22); tassel.rotation.z = Math.PI; bell.add(tassel);
    bell.position.set(bx, by, bz);
    owned(bell, "bell");
    group.add(bell);
  }

  // ── Plates: the three stations that carry a count ─────────────────────────
  const finishNow = (): PlateFinish => plateFinish("current");
  const plateFor = (width: number, height: number): EngravedPlate =>
    track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, width, height));
  const wardrobePlate = plateFor(1.05, 0.18);
  wardrobePlate.mesh.position.set(wx + 0.12, 2.28, wz);
  wardrobePlate.mesh.rotation.y = Math.PI / 2;
  owned(wardrobePlate.mesh, "wardrobe"); group.add(wardrobePlate.mesh);
  const cabinetPlate = plateFor(1.15, 0.18);
  cabinetPlate.mesh.position.set(cx - 0.33, 2.06, cz);
  cabinetPlate.mesh.rotation.y = -Math.PI / 2;
  owned(cabinetPlate.mesh, "cabinet"); group.add(cabinetPlate.mesh);
  const seatPlate = plateFor(1.15, 0.18);
  seatPlate.mesh.position.set(sx, 2.18, sz - 0.24);
  owned(seatPlate.mesh, "window-seat"); group.add(seatPlate.mesh);

  // ── What the reading stands: the kept looks and the keepsakes on the shelves ─
  let curios: THREE.Object3D[] = [];
  let view: CottageReading = EMPTY_COTTAGE_READING;

  const clearStood = (): void => {
    for (const row of curios) row.removeFromParent();
    curios = [];
  };

  const layOut = (): void => {
    clearStood();
    // A kept look is a small dressed form on the shelf; a keepsake is a rounder thing beside it.
    const looks = Math.min(CABINET_LOOKS, view.looks);
    for (let i = 0; i < looks; i++) {
      const form = new THREE.Group();
      const shelfY = CABINET_SHELVES[i % 3]!;
      const post = new THREE.Mesh(track(new THREE.CylinderGeometry(0.018, 0.03, 0.14, 7)), mat(dressing.curio, { roughness: 0.7 }));
      post.position.y = 0.07; form.add(post);
      const bust = new THREE.Mesh(track(new THREE.SphereGeometry(0.055, 9, 7)), mat(dressing.curio, { roughness: 0.62 }));
      bust.scale.set(1, 0.85, 0.8); bust.position.y = 0.18; form.add(bust);
      form.position.set(cx - 0.04, shelfY + 0.02, cz - 0.7 + Math.floor(i / 3) * 0.44 + (i % 3) * 0.12);
      form.rotation.y = -0.3 + (i % 3) * 0.24;
      owned(form, "cabinet");
      group.add(form); curios.push(form);
    }
    const keepsakes = Math.min(CABINET_KEEPSAKES, view.keepsakes);
    for (let i = 0; i < keepsakes; i++) {
      const shelfY = CABINET_SHELVES[(i + 1) % 3]!;
      const thing = new THREE.Mesh(
        track(i % 2 === 0 ? new THREE.IcosahedronGeometry(0.052, 0) : new THREE.TorusGeometry(0.045, 0.018, 6, 10)),
        mat(dressing.curioSecond, { roughness: 0.68 }),
      );
      thing.position.set(cx - 0.06, shelfY + 0.07, cz + 0.28 + i * 0.16);
      thing.rotation.set(i % 2 ? Math.PI / 2 : 0.3, i * 0.5, 0);
      owned(thing, "cabinet");
      group.add(thing); curios.push(thing);
    }
    wardrobePlate.set(`The armoire — ${view.name}’s rail`, finishNow());
    cabinetPlate.set(`The cabinet — ${kept(view.looks, "look kept", "looks kept")}`, finishNow());
    seatPlate.set(`The window seat — ${wearingWords(view.worn, view.name)}`, finishNow());
  };

  const signatureOf = (reading: CottageReading): string => [reading.name, reading.worn, reading.looks, reading.keepsakes].join("§");
  let signature = "";

  function update(value: unknown): void {
    const reading = readCottageReading(value).cottage ?? EMPTY_COTTAGE_READING;
    const next = signatureOf(reading);
    if (next === signature) return;
    view = reading; signature = next;
    layOut();
  }
  update(options.reading ?? null);

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const anchorList = (): Anchor[] => [
    { id: "wardrobe", position: at(wx + 0.3, 1.3, wz), zone: "station", label: `The armoire, its doors a hand open — ${view.name}’s rail of pieces. Open the dressing room.`, door: { target: "wardrobe" } },
    { id: "mirror", position: at(mx, 1.2, mz), zone: "station", label: `The cheval glass, swung to the window — see how a piece sits before he wears it. Open the dressing room at the glass.`, door: { target: "wardrobe", object: "mirror" } },
    { id: "cabinet", position: at(cx - 0.35, 1.15, cz), zone: "station", label: `The cabinet of wonders — ${kept(view.looks, "look kept", "looks kept")}, ${kept(view.keepsakes, "keepsake on the shelf", "keepsakes on the shelves")}. Open the dressing room at the kept looks.`, door: { target: "wardrobe", object: "looks" } },
    { id: "window-seat", position: at(sx - 0.45, 0.78, sz + 0.06), zone: "station", label: `${view.name} asleep on the window seat — ${wearingWords(view.worn, view.name)}. Talk with ${view.name}.`, door: { target: "hercules" } },
    { id: "bell", position: at(bx, by - 0.1, bz - 0.22), zone: "prop", label: `The bell by the door — ring it and ${view.name} comes. Talk with ${view.name}.`, door: { target: "hercules" } },
    { id: "court-door", position: at(dx, 1.0, dz - 0.25), zone: "stair", label: "The cottage door, with his own cut beside it — back to the Court." },
  ];

  const regionList = (): Region[] => [
    { id: "wardrobe", group: "cottage", label: "The armoire", box: box(wx - 0.4, 0, wz - 0.85, wx + 0.75, 2.3, wz + 0.85) },
    { id: "mirror", group: "cottage", label: "The cheval glass", box: box(mx - 0.55, 0, mz - 0.6, mx + 0.55, 1.9, mz + 0.6) },
    { id: "cabinet", group: "cottage", label: "The cabinet of wonders", box: box(cx - 0.45, 0, cz - 1.05, cx + 0.35, 2.0, cz + 1.05) },
    { id: "window-seat", group: "cottage", label: "The window seat", box: box(sx - 1.1, 0.3, sz - 0.3, sx + 1.1, 1.05, sz + 0.45) },
    { id: "bell", group: "cottage", label: "The bell by the door", box: box(bx - 0.2, by - 0.7, bz - 0.4, bx + 0.2, by + 0.35, bz + 0.1) },
    { id: "court-door", group: "cottage", label: "The cottage door — back to the Court", box: box(dx - 1.6, 0, dz - 0.3, dx + 0.7, 2.2, dz + 0.2) },
  ];

  return {
    group,
    update,
    animate: () => false,
    dispose() {
      scene.remove(group);
      clearStood();
      for (const item of disposables) item.dispose();
    },
    anchors: anchorList,
    poses: () => cottagePoses(anchorList()),
    regions: regionList,
  };
}

export const cottagePlace: Place = registerPlace({
  id: "cottage",
  build(scene, dressing, reading, quality, context) {
    return createCottage(scene, {
      dressing: cottageDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
