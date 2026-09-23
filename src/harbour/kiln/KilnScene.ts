import { studioInterior } from "../interiors/studioInterior.ts";
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { EMPTY_KILN_READING, KILN_SHELF_CAP, type FiredPiece, type KilnReading } from "../data/reading.ts";
import { kilnDressingFrom, type KilnDressing } from "./dressing.ts";

/**
 * The Kiln (LITTLE_HARBOUR_v2 §2, the Making district) — pottery, full screen.
 *
 * One brick shed with a bottle kiln in the corner. **The wheel** stands in the
 * light with a lump of clay on its head; **the workbench** runs along the
 * right wall with the glaze jars and the brushes; **the kiln** itself is the
 * back corner, and when something came out of it in the last week the bricks
 * are still warm — the fire door glows, and the glow fades day by day until
 * the kiln is cold again. Along the back wall, **the shelf of fired pieces**:
 * one little piece for every kitty bank the household has already sculpted,
 * painted and fired, in that bank's own glaze and at that bank's own growth
 * step. Hercules naps where the bricks are warmest.
 *
 * The room reimplements none of the Studio. The wheel, the bench, the kiln
 * and every piece on the shelf are **doors** (`onOpen("pottery", …)`) onto the
 * app's own Kitty Bank Studio; the clay, the paint and the firing stay where
 * they already live. Nothing here writes a piece, a bank or a penny, and the
 * shelf shows counts and growth steps only — a piece somebody keeps to
 * themselves is a number on the plate and nothing else.
 */

export const KILN_LAYOUT = {
  halfWidth: 3.8,
  halfDepth: 2.9,
  wallHeight: 2.6,
  /** The bottle kiln in the back-left corner, its throat up through the rafters. */
  kiln: [-2.45, 0, -1.75] as const,
  /** The wheel, out in the light where you can walk round it. */
  wheel: [-1.0, 0, 1.1] as const,
  /** The workbench along the right wall: slate top, glaze jars, brushes. */
  bench: [2.8, 0, -0.3] as const,
  /** The shelf of fired pieces: three boards on the back wall, right of the kiln. */
  shelf: { z: -2.78, x0: 0.2, stepX: 0.8, y0: 2.02, stepY: -0.52, cols: 4 },
  /** The window on the right wall: the raking light that makes the clay read. */
  window: [3.78, 1.72, 1.15] as const,
  /** Hercules, curled where the bricks hold the heat. */
  hercules: [-1.62, 0, -0.78] as const,
  /** The door back to the Court, front-right. */
  door: [1.95, 0, 2.82] as const,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A count in words that never shames an empty shelf: "nothing yet" is a state, not a fault. */
export function firedWords(count: number, one: string, many: string): string {
  return count === 0 ? "nothing yet" : `${count} ${count === 1 ? one : many}`;
}

/** How long ago the kiln was last lit, in the room's own words. */
export function kilnHeatWords(reading: Pick<KilnReading, "sinceFiring" | "warmth">): string {
  if (reading.sinceFiring === null) return "cold, nothing fired yet";
  if (reading.sinceFiring === 0) return "still hot, fired today";
  if (reading.sinceFiring === 1) return "warm, fired yesterday";
  if (reading.warmth > 0) return `warm, fired ${reading.sinceFiring} days ago`;
  return `cold, last fired ${reading.sinceFiring} days ago`;
}

/** Where the `index`th fired piece stands on the shelf: four to a board, the top board first. */
export function shelfPin(index: number): { x: number; y: number } {
  const { x0, stepX, y0, stepY, cols } = KILN_LAYOUT.shelf;
  return { x: x0 + (index % cols) * stepX, y: y0 + Math.floor(index / cols) * stepY };
}

/** A piece's size on the shelf: its bank's own ten steps, and resting clay is still a piece. */
export function pieceScale(step: number): number {
  return 0.58 + 0.42 * clamp(step / 10, 0, 1);
}

// Stand in the front-right corner. A portrait phone holds about two metres of
// width at this distance, so its pose takes the two the room is for — the
// wheel in the foreground, the kiln standing behind it — and the shelf and the
// bench are one swipe to the right. Desktop holds the whole shed in one look.
const PHONE_ROOM: Pose = { target: [-1.05, 1.1, -0.35], r: 3.85, theta: 0.25, phi: 1.32 };
const DESKTOP_ROOM: Pose = { target: [0, 1.3, -.7], r: 4.75, theta: -0.18, phi: 1.27 };

export function kilnPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "kiln:phone": PHONE_ROOM,
    "kiln:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.2, -0.3], r: 6.2, theta: 0.1, phi: 1.04 },
    "sky:desktop": { target: [0.1, 1.25, -0.3], r: 6.8, theta: 0.25, phi: 1.02 },
    // The door frieze: the wheel with the kiln behind it, for the band above an open tool.
    "door:phone": { target: [-0.6, 0.9, -0.2], r: 2.1, theta: 0.3, phi: 1.3 },
    "door:desktop": { target: [-0.5, 0.9, -0.2], r: 2.3, theta: 0.34, phi: 1.3 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 5) * 0.6, -0.65, 0.65);
    const close = anchor.zone === "piece" ? 1.3 : anchor.zone === "stair" ? 2.5 : 2.0;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.6, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.6, y), z], r: close + 0.4, theta: theta + 0.16, phi: 1.14 };
  }
  return poses;
}

export type KilnSceneReading = { kiln: KilnReading | null; partnerName: string | null };

/** Narrows whatever the shell hands over to the kiln's own rows. */
export function readKilnReading(value: unknown): KilnSceneReading {
  if (!value || typeof value !== "object") return { kiln: null, partnerName: null };
  const source = value as { kiln?: KilnReading; partner?: { name?: string } | null };
  return { kiln: source.kiln ?? null, partnerName: source.partner?.name ?? null };
}

export type KilnOptions = {
  dressing: KilnDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createKiln(scene: THREE.Scene, options: KilnOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "kiln";
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
  const tagged = <T extends THREE.Object3D>(object: T, anchor: string): T => {
    object.userData.anchor = anchor;
    object.traverse((node) => { node.userData.anchor = anchor; });
    return object;
  };

  const contacts = track(createContactShadows({ ink: dressing.ink }));
  const { halfWidth, halfDepth } = KILN_LAYOUT;

  track(studioInterior(group, dressing));

  // ── The kiln itself: a bottle kiln, iron-banded, its throat up through the
  //    rafters. The fire door is where the reading lands — the glow is the
  //    heat left in the bricks, and it fades day by day.
  const [kx, , kz] = KILN_LAYOUT.kiln;
  const bottle = merged([
    placed(new THREE.CylinderGeometry(0.78, 0.9, 1.15, 14), kx, 0.575, kz),
    placed(new THREE.CylinderGeometry(0.52, 0.78, 0.7, 14), kx, 1.5, kz),
    placed(new THREE.CylinderGeometry(0.3, 0.52, 0.62, 12), kx, 2.16, kz),
    placed(new THREE.CylinderGeometry(0.26, 0.3, 0.9, 12), kx, 2.9, kz),
    placed(new THREE.TorusGeometry(0.3, 0.05, 6, 14), kx, 3.33, kz, [Math.PI / 2, 0, 0]),
  ], mat(dressing.kilnBody, { roughness: 0.94 }));
  shadowed(bottle, full, true); bottle.name = "kiln-bottle"; tagged(bottle, "kiln"); group.add(bottle);
  const bands = merged([
    placed(new THREE.TorusGeometry(0.85, 0.035, 6, 16), kx, 0.32, kz, [Math.PI / 2, 0, 0]),
    placed(new THREE.TorusGeometry(0.8, 0.035, 6, 16), kx, 0.95, kz, [Math.PI / 2, 0, 0]),
    placed(new THREE.TorusGeometry(0.63, 0.032, 6, 16), kx, 1.45, kz, [Math.PI / 2, 0, 0]),
    placed(new THREE.TorusGeometry(0.42, 0.03, 6, 14), kx, 2.1, kz, [Math.PI / 2, 0, 0]),
  ], mat(dressing.kilnBand, { roughness: 0.55, metalness: 0.45 }));
  bands.name = "kiln-bands"; tagged(bands, "kiln"); group.add(bands);
  // The fire door on the room side, its arch, and the heat behind it.
  const fireDoor = merged([
    placed(new THREE.BoxGeometry(0.5, 0.56, 0.1), kx + 0.1, 0.42, kz + 0.84),
    placed(new THREE.CylinderGeometry(0.28, 0.28, 0.1, 12, 1, false, 0, Math.PI), kx + 0.1, 0.7, kz + 0.84, [Math.PI / 2, 0, 0]),
  ], mat(dressing.kilnDoor, { roughness: 0.72, metalness: 0.25 }));
  fireDoor.name = "kiln-fire-door"; tagged(fireDoor, "kiln"); group.add(fireDoor);
  const emberMaterial = track(new THREE.MeshStandardMaterial({
    color: dressing.ember, emissive: new THREE.Color(dressing.emberGlow), emissiveIntensity: 0, roughness: 0.6, transparent: true, opacity: 0.2,
  }));
  const ember = new THREE.Mesh(track(new THREE.PlaneGeometry(0.34, 0.4)), emberMaterial);
  ember.position.set(kx + 0.1, 0.42, kz + 0.9); ember.name = "kiln-ember"; tagged(ember, "kiln"); group.add(ember);
  // A breath of heat standing off the bricks; invisible when the kiln is cold.
  const hazeMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.emberGlow, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  const haze = new THREE.Mesh(track(new THREE.CylinderGeometry(0.62, 1.0, 1.5, 12, 1, true)), hazeMaterial);
  haze.position.set(kx, 1.25, kz); haze.renderOrder = 3; haze.name = "kiln-haze"; group.add(haze);
  const fire = new THREE.PointLight(new THREE.Color(dressing.light.fire), 0, 7, 2);
  fire.position.set(kx + 0.45, 0.6, kz + 1.0); group.add(fire);
  contacts.disc(kx, kz, 1.05, 0.7, group);

  // ── The wheel: a stone head on a painted frame, clay standing on it ───────
  const [whx, , whz] = KILN_LAYOUT.wheel;
  // The stool you sit on, and the bucket of slip beside it.
  const stool = merged([
    placed(new THREE.CylinderGeometry(0.19, 0.19, 0.05, 12), whx + 0.02, 0.44, whz + 0.82),
    placed(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 8), whx - 0.1, 0.21, whz + 0.74),
    placed(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 8), whx + 0.14, 0.21, whz + 0.74),
    placed(new THREE.CylinderGeometry(0.035, 0.045, 0.42, 8), whx + 0.02, 0.21, whz + 0.94),
  ], mat(dressing.wheelFrame, { roughness: 0.88 }));
  shadowed(stool, false, true); stool.name = "kiln-stool"; group.add(stool);
  const bucket = merged([
    placed(new THREE.CylinderGeometry(0.18, 0.15, 0.3, 12, 1, true), whx - 0.72, 0.15, whz + 0.2),
    placed(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 12), whx - 0.72, 0.02, whz + 0.2),
  ], track(new THREE.MeshStandardMaterial({ color: dressing.jar, roughness: 0.9, side: THREE.DoubleSide })));
  bucket.name = "kiln-slip"; group.add(bucket);
  contacts.disc(whx, whz, 0.55, 0.6, group);
  contacts.disc(whx + 0.02, whz + 0.82, 0.24, 0.45, group);

  // ── The workbench: slate top, glaze jars, brushes in a pot ───────────────
  const [bx, , bz] = KILN_LAYOUT.bench;
  // The five glaze jars, one per name in the studio's palette, each in its own glaze.
  const jarGeometry = track(new THREE.CylinderGeometry(0.075, 0.085, 0.16, 10));
  const jars = new THREE.InstancedMesh(jarGeometry, mat(dressing.jar, { roughness: 0.55 }), 5);
  jars.name = "kiln-glaze-jars";
  {
    const matrix = new THREE.Matrix4(), tone = new THREE.Color();
    const names = ["cream", "sea-glass", "terracotta", "midnight", "rose"] as const;
    names.forEach((name, i) => {
      matrix.makeTranslation(bx - 0.14 + (i % 2) * 0.24, 0.99, bz - 0.92 + i * 0.28);
      jars.setMatrixAt(i, matrix);
      jars.setColorAt(i, tone.set(dressing.glaze[name]));
    });
    jars.instanceMatrix.needsUpdate = true;
    if (jars.instanceColor) jars.instanceColor.needsUpdate = true;
  }
  tagged(jars, "bench"); group.add(jars);
  const brushes = merged([
    placed(new THREE.CylinderGeometry(0.075, 0.065, 0.14, 10), bx + 0.06, 0.98, bz + 0.62),
    placed(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 5), bx + 0.03, 1.12, bz + 0.6, [0.12, 0, 0.1]),
    placed(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 5), bx + 0.09, 1.13, bz + 0.64, [-0.1, 0, -0.14]),
    placed(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 5), bx + 0.06, 1.11, bz + 0.68, [0.06, 0, -0.04]),
  ], mat(dressing.brass, { roughness: 0.45, metalness: 0.4 }));
  brushes.name = "kiln-brushes"; tagged(brushes, "bench"); group.add(brushes);
  contacts.disc(bx, bz, 0.6, 0.5, group);

  // ── The shelf of fired pieces: three boards on the back wall ─────────────
  const { shelf } = KILN_LAYOUT;
  const boardSpan = shelf.stepX * shelf.cols;
  const boardCentre = shelf.x0 + boardSpan / 2 - shelf.stepX / 2;
  const boards = merged([0, 1, 2].map((row) =>
    placed(new THREE.BoxGeometry(boardSpan + 0.2, 0.05, 0.34), boardCentre, shelf.y0 + row * shelf.stepY - 0.02, shelf.z + 0.28)), mat(dressing.shelf, { roughness: 0.82 }));
  shadowed(boards, false, true); boards.name = "kiln-shelf-boards"; tagged(boards, "shelf"); group.add(boards);
  const brackets = merged([0, 1, 2].flatMap((row) => [-1, 1].map((side) =>
    placed(new THREE.BoxGeometry(0.05, 0.18, 0.3), boardCentre + side * (boardSpan / 2 - 0.05), shelf.y0 + row * shelf.stepY - 0.13, shelf.z + 0.28))), mat(dressing.bracket, { roughness: 0.85 }));
  brackets.name = "kiln-shelf-brackets"; tagged(brackets, "shelf"); group.add(brackets);

  // The pieces themselves: three instanced bodies for every bank that has been
  // fired — a belly, a head and two ears, each in its bank's own glaze and at
  // its bank's own growth step. Twelve cats, three draw calls.
  const pieceBody = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.1, 10, 8)), mat("#ffffff", { roughness: 0.42 }), KILN_SHELF_CAP);
  const pieceHead = new THREE.InstancedMesh(track(new THREE.SphereGeometry(0.066, 10, 8)), mat("#ffffff", { roughness: 0.42 }), KILN_SHELF_CAP);
  const pieceEars = new THREE.InstancedMesh(track(new THREE.ConeGeometry(0.03, 0.055, 5)), mat("#ffffff", { roughness: 0.42 }), KILN_SHELF_CAP * 2);
  for (const mesh of [pieceBody, pieceHead, pieceEars]) { mesh.count = 0; mesh.castShadow = full; mesh.receiveShadow = true; tagged(mesh, "shelf"); group.add(mesh); }
  pieceBody.name = "kiln-pieces"; pieceHead.name = "kiln-piece-heads"; pieceEars.name = "kiln-piece-ears";

  // The drying rack: what is still clay, waiting for the kiln. Counts only.
  const dryingGeometry = track(new THREE.CylinderGeometry(0.07, 0.09, 0.14, 9));
  const drying = new THREE.InstancedMesh(dryingGeometry, mat(dressing.clay, { roughness: 0.96 }), 4);
  drying.count = 0; drying.name = "kiln-drying"; tagged(drying, "wheel"); group.add(drying);

  // ── Hercules, asleep where the bricks hold the heat ──────────────────────
  const hercules = new THREE.Group();
  hercules.name = "kiln-hercules";
  {
    const coat = mat(dressing.cat, { roughness: 0.42 });
    const loaf = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.21, 14, 10)), coat));
    loaf.scale.set(1.35, 0.66, 0.95); loaf.position.y = 0.14; hercules.add(loaf);
    const head = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 12, 10)), coat));
    head.scale.set(1, 0.92, 0.95); head.position.set(0.25, 0.2, 0.03); hercules.add(head);
    const ears = merged([
      placed(new THREE.ConeGeometry(0.05, 0.1, 5), 0.27, 0.33, -0.07, [0.2, 0, -0.18]),
      placed(new THREE.ConeGeometry(0.05, 0.1, 5), 0.27, 0.33, 0.13, [-0.2, 0, -0.18]),
    ], mat(dressing.catEar, { roughness: 0.55 }));
    hercules.add(ears);
    const tail = new THREE.Mesh(track(new THREE.TorusGeometry(0.13, 0.026, 6, 12, Math.PI * 0.85)), coat);
    tail.position.set(-0.24, 0.1, 0.1); tail.rotation.set(Math.PI / 2, 0, 0.5); hercules.add(tail);
    hercules.position.set(KILN_LAYOUT.hercules[0], 0, KILN_LAYOUT.hercules[2]);
    hercules.rotation.y = -0.6;
    tagged(hercules, "hercules");
    group.add(hercules);
    contacts.disc(KILN_LAYOUT.hercules[0], KILN_LAYOUT.hercules[2], 0.34, 0.5, group);
  }

  // ── The door back to the Court ───────────────────────────────────────────
  const [dx, , dz] = KILN_LAYOUT.door;
  const doorFrame = merged([
    placed(new THREE.BoxGeometry(0.1, 2.05, 0.14), dx - 0.48, 1.02, dz - 0.04),
    placed(new THREE.BoxGeometry(0.1, 2.05, 0.14), dx + 0.48, 1.02, dz - 0.04),
    placed(new THREE.BoxGeometry(1.06, 0.12, 0.14), dx, 2.1, dz - 0.04),
  ], mat(dressing.beam, { roughness: 0.84 }));
  doorFrame.name = "kiln-door-frame"; tagged(doorFrame, "court-door"); group.add(doorFrame);
  const doorLeaf = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.88, 1.96, 0.06)), mat(dressing.beam, { roughness: 0.9 })), false, true);
  doorLeaf.position.set(dx, 0.98, dz - 0.12); doorLeaf.name = "kiln-door"; tagged(doorLeaf, "court-door"); group.add(doorLeaf);

  // ── The plates ───────────────────────────────────────────────────────────
  const finishNow = (): PlateFinish => plateFinish("current");
  const plateFor = (width: number, height: number): EngravedPlate =>
    track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, width, height));
  const kilnPlate = plateFor(1.15, 0.2);
  kilnPlate.mesh.position.set(kx + 0.1, 1.08, kz + 0.93); tagged(kilnPlate.mesh, "kiln"); group.add(kilnPlate.mesh);
  const shelfPlate = plateFor(1.5, 0.2);
  shelfPlate.mesh.position.set(boardCentre, shelf.y0 + 0.28, shelf.z + 0.13); tagged(shelfPlate.mesh, "shelf"); group.add(shelfPlate.mesh); shelfPlate.mesh.scale.setScalar(.75);
  const wheelPlate = plateFor(1.0, 0.18);
  wheelPlate.mesh.position.set(whx, 0.12, whz - 0.55); wheelPlate.mesh.rotation.x = -Math.PI / 2;
  tagged(wheelPlate.mesh, "wheel"); group.add(wheelPlate.mesh);

  // ── What the reading stands ──────────────────────────────────────────────
  let view: KilnReading = EMPTY_KILN_READING;
  let partnerName: string | null = null;
  const coldEmber = new THREE.Color(dressing.kilnDoor);
  const hotEmber = new THREE.Color(dressing.ember);

  const layOut = (): void => {
    const standing = view.pieces.slice(0, KILN_SHELF_CAP);
    const matrix = new THREE.Matrix4(), position = new THREE.Vector3(), quaternion = new THREE.Quaternion(), scale = new THREE.Vector3(), tone = new THREE.Color();
    standing.forEach((piece, index) => {
      const pin = shelfPin(index);
      const size = pieceScale(piece.step);
      const turn = ((index % 3) - 1) * 0.28;
      quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), turn);
      tone.set(dressing.glaze[piece.glaze] ?? dressing.glaze.cream);
      position.set(pin.x, pin.y + 0.1 * size, shelf.z + 0.28);
      scale.set(size, size * 0.86, size);
      matrix.compose(position, quaternion, scale); pieceBody.setMatrixAt(index, matrix); pieceBody.setColorAt(index, tone);
      position.set(pin.x, pin.y + 0.2 * size, shelf.z + 0.3);
      scale.set(size, size, size);
      matrix.compose(position, quaternion, scale); pieceHead.setMatrixAt(index, matrix); pieceHead.setColorAt(index, tone);
      for (const side of [0, 1]) {
        position.set(pin.x + (side ? 0.045 : -0.045) * size, pin.y + 0.26 * size, shelf.z + 0.3);
        matrix.compose(position, quaternion, scale);
        pieceEars.setMatrixAt(index * 2 + side, matrix); pieceEars.setColorAt(index * 2 + side, tone);
      }
    });
    pieceBody.count = standing.length; pieceHead.count = standing.length; pieceEars.count = standing.length * 2;
    for (const mesh of [pieceBody, pieceHead, pieceEars]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }

    const waiting = Math.min(4, view.onTheWheel);
    for (let i = 0; i < waiting; i++) {
      matrix.makeTranslation(whx + 0.5 + (i % 2) * 0.24, 0.79, whz - 0.16 + Math.floor(i / 2) * 0.24);
      drying.setMatrixAt(i, matrix);
    }
    drying.count = waiting;
    drying.instanceMatrix.needsUpdate = true;

    // The heat: the fire door glows and the bricks breathe while the kiln is warm.
    emberMaterial.color.copy(coldEmber).lerp(hotEmber, view.warmth);
    emberMaterial.emissiveIntensity = 1.15 * view.warmth;
    emberMaterial.opacity = 0.18 + 0.8 * view.warmth;
    emberMaterial.needsUpdate = true;
    hazeMaterial.opacity = 0.09 * view.warmth;
    fire.intensity = dressing.light.fireIntensity * view.warmth;

    kilnPlate.set("The kiln · review your piece", finishNow());
    const privately = view.keptPrivate > 0 ? ` · ${view.keptPrivate} kept privately` : "";
    const more = view.overflow > 0 ? ` · ${view.overflow} more in the Studio` : "";
    shelfPlate.set(`Bank pottery — ${firedWords(view.fired, "piece fired", "pieces fired")}${privately}${more}`, finishNow());
    wheelPlate.set(view.onTheWheel > 0 ? `The wheel — ${firedWords(view.onTheWheel, "piece still clay", "pieces still clay")}` : "The wheel — sit down and throw one", finishNow());
  };

  const signatureOf = (reading: KilnReading, partner: string | null): string =>
    [reading.fired, reading.keptPrivate, reading.onTheWheel, reading.lastFiredOn, reading.sinceFiring, reading.warmth, reading.overflow, partner,
      reading.pieces.map((piece) => `${piece.key}:${piece.glaze}:${piece.step}:${piece.firings}`).join("|")].join("§");
  let signature = "";

  function update(value: unknown): void {
    const next = readKilnReading(value);
    const reading = next.kiln ?? EMPTY_KILN_READING;
    const nextSignature = signatureOf(reading, next.partnerName);
    if (nextSignature === signature) return;
    view = reading; partnerName = next.partnerName; signature = nextSignature;
    layOut();
  }
  update(options.reading ?? null);

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  /** How a piece on the shelf says itself: its bank, its glaze, its step — never a figure. */
  const pieceWords = (piece: FiredPiece): string => {
    const step = piece.step <= 0 ? "resting clay" : piece.step >= 10 ? "grown full" : `${piece.step * 10}% of the way`;
    const again = piece.firings > 1 ? `, fired ${piece.firings} times` : "";
    return `${piece.name} — ${piece.glaze} glaze, ${step}${again}. Open it in the Studio.`;
  };

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = [
      { id: "wheel", position: at(whx, 0.95, whz), zone: "station", label: view.onTheWheel > 0 ? `The wheel — ${firedWords(view.onTheWheel, "piece still clay", "pieces still clay")}. Sit down and throw one.` : "The wheel, clay on its head — sit down and throw one.", door: { target: "pottery", object: "wheel" } },
      { id: "bench", position: at(bx - 0.3, 1.0, bz), zone: "station", label: "The workbench — the five glazes and the brushes. Paint a piece.", door: { target: "pottery", object: "paint" } },
      { id: "kiln", position: at(kx + 0.2, 0.8, kz + 1.0), zone: "station", label: "The kiln. Review the selected piece in the Studio.", door: { target: "pottery", object: "kiln" } },
      { id: "shelf", position: at(boardCentre, shelf.y0 + 0.24, shelf.z + 0.4), zone: "station", label: `Bank pottery — ${firedWords(view.fired, "piece fired", "pieces fired")}${view.keptPrivate > 0 ? `, and ${view.keptPrivate} kept privately` : ""}. Open the Studio.`, door: { target: "pottery" } },
    ];
    view.pieces.slice(0, KILN_SHELF_CAP).forEach((piece, index) => {
      const pin = shelfPin(index);
      rows.push({ id: `piece:${piece.key}`, position: at(pin.x, pin.y + 0.16, shelf.z + 0.3), zone: "piece", label: pieceWords(piece), door: { target: "pottery", object: piece.key } });
    });
    rows.push({ id: "hercules", position: at(KILN_LAYOUT.hercules[0], 0.45, KILN_LAYOUT.hercules[2]), zone: "prop", label: `Hercules, asleep where the bricks are warm${partnerName ? `, waiting for you and ${partnerName}` : ""}. Talk with Hercules.`, door: { target: "hercules" } });
    rows.push({ id: "boathouse", position: at(-halfWidth + 0.5, 1.1, halfDepth - 0.6), zone: "landmark", label: "The shore path — down to the Boathouse." });
    rows.push({ id: "court-door", position: at(dx, 1.0, dz - 0.2), zone: "stair", label: "The kiln door — back to the Court." });
    return rows;
  };

  const regionList = (): Region[] => {
    const rows: Region[] = [
      { id: "wheel", group: "kiln", label: "The wheel", box: box(whx - 0.69, 0, whz - 0.46, whx + 0.69, 1.08, whz + 0.46) },
      { id: "bench", group: "kiln", label: "The workbench", box: box(bx - 0.55, 0, bz - 1.2, bx + 0.5, 1.25, bz + 1.2) },
      { id: "kiln", group: "kiln", label: "The kiln", box: box(kx - 0.95, 0, kz - 0.95, kx + 0.95, 2.6, kz + 1.0) },
      { id: "shelf", group: "kiln", label: "The shelf of fired pieces", box: box(boardCentre - boardSpan / 2 - 0.2, shelf.y0 + shelf.stepY * 2 - 0.25, shelf.z, boardCentre + boardSpan / 2 + 0.2, shelf.y0 + 0.4, shelf.z + 0.5) },
      { id: "hercules", group: "kiln", label: "Hercules, asleep by the kiln", box: box(KILN_LAYOUT.hercules[0] - 0.4, 0, KILN_LAYOUT.hercules[2] - 0.4, KILN_LAYOUT.hercules[0] + 0.4, 0.5, KILN_LAYOUT.hercules[2] + 0.4) },
      { id: "court-door", group: "kiln", label: "The kiln door — back to the Court", box: box(dx - 0.6, 0, dz - 0.35, dx + 0.6, 2.15, dz + 0.2) },
    ];
    view.pieces.slice(0, KILN_SHELF_CAP).forEach((piece, index) => {
      const pin = shelfPin(index);
      rows.push({ id: `piece:${piece.key}`, group: "kiln", label: piece.name, box: box(pin.x - 0.18, pin.y - 0.04, shelf.z + 0.12, pin.x + 0.18, pin.y + 0.34, shelf.z + 0.46) });
    });
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
    poses: () => kilnPoses(anchorList()),
    regions: regionList,
  };
}

export const kilnPlace: Place = registerPlace({
  id: "kiln",
  build(scene, dressing, reading, quality, context) {
    return createKiln(scene, {
      dressing: kilnDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
