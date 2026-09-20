import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { libraryDressingFrom, type LibraryDressing } from "./dressing.ts";

/**
 * The Library (LITTLE_HARBOUR_v2 §2) — one great hall for the Standing Book.
 *
 * The Book stands open on a lectern in the middle of the hall, loud and
 * proud; tall cases of ledgers line the walls; a reading balcony runs round
 * the hall with the accounts as stickies on its rail; the five Bindery
 * machines wait on their bench — Lantern Row, Low Water, Cut Bank, the
 * Glasshouse pane, the Handoff bench — and the Time Machine sits at its desk,
 * thumbing back through the leaves. The garden door at the back looks out to
 * the Glasshouse, one step behind the Library the way the vision drew it.
 *
 * Every figure lives in the Book itself: the lectern, the machines and the
 * Time Machine are all doors onto the Standing Book (`onOpen("books")`), and
 * nothing in the hall reads or writes a ledger row.
 */

export const LIBRARY_LAYOUT = {
  halfWidth: 4.4,
  halfDepth: 3.4,
  wallHeight: 3.9,
  balcony: 2.5,
  /** The lectern and the great book, centre of the hall. */
  lectern: [0, 0, -0.9] as const,
  /** The bindery bench along the left wall, five machines on it. */
  bindery: [-3.7, 0, -0.6] as const,
  /** The Time Machine's desk on the right. */
  timeMachine: [3.5, 0, -0.3] as const,
  /** The tall window behind the lectern, and the hall door back to the Court. */
  window: [0, 2.2, -3.35] as const,
  door: [1.8, 0, 3.15] as const,
  /** The garden door to the Glasshouse, back-left. */
  garden: [-2.6, 0, -3.15] as const,
} as const;

/** The five Bindery machines, in the vision's own order and words. */
export const BINDERY_MACHINES = ["Lantern Row", "Low Water", "Cut Bank", "The Glasshouse pane", "The Handoff bench"] as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Stand just inside the hall door: the lectern centre, the Bindery along the
// far-left wall, the tall window behind, the balcony above.
const PHONE_ROOM: Pose = { target: [-0.8, 1.3, -0.9], r: 5.06, theta: 0.712, phi: 1.311 };
const DESKTOP_ROOM: Pose = { target: [-0.5, 1.3, -0.9], r: 4.88, theta: 0.711, phi: 1.344 };

export function libraryPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "library:phone": PHONE_ROOM,
    "library:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.5, -0.8], r: 7.0, theta: 0, phi: 1.02 },
    "sky:desktop": { target: [0, 1.55, -0.8], r: 7.8, theta: 0.22, phi: 1.0 },
    // The door frieze: the lectern and the Book, for the band above an open tool.
    "door:phone": { target: [0, 1.15, -0.9], r: 1.9, theta: 0.02, phi: 1.28 },
    "door:desktop": { target: [0.05, 1.15, -0.9], r: 2.1, theta: 0.05, phi: 1.28 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 5) * 0.6, -0.65, 0.65);
    const close = anchor.zone === "stair" || anchor.zone === "landmark" ? 2.5 : 1.9;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.7, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.7, y), z], r: close + 0.4, theta: theta + 0.16, phi: 1.14 };
  }
  return poses;
}

export type LibraryOptions = {
  dressing: LibraryDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createLibrary(scene: THREE.Scene, options: LibraryOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "library";
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
  const { halfWidth, halfDepth, wallHeight, balcony } = LIBRARY_LAYOUT;

  // ── The hall: stone walls with courses, a boarded floor ───────────────────
  const floor = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, halfDepth * 2)), mat(dressing.floor, { roughness: 0.96 })), false, true);
  floor.rotation.x = -Math.PI / 2; floor.name = "library-floor"; group.add(floor);
  const walls = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.26), 0, wallHeight / 2, -halfDepth),
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.26), 0, wallHeight / 2, halfDepth),
    placed(new THREE.BoxGeometry(0.26, wallHeight, halfDepth * 2), -halfWidth, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(0.26, wallHeight, halfDepth * 2), halfWidth, wallHeight / 2, 0),
  ], mat(dressing.wall, { roughness: 0.95 }));
  shadowed(walls, false, true); walls.name = "library-walls"; group.add(walls);
  const courses = merged(
    [1.2, balcony, 3.4].flatMap((y) => [
      placed(new THREE.BoxGeometry(halfWidth * 2 - 0.04, 0.05, 0.04), 0, y, -halfDepth + 0.15),
      placed(new THREE.BoxGeometry(0.04, 0.05, halfDepth * 2 - 0.04), -halfWidth + 0.15, y, 0),
      placed(new THREE.BoxGeometry(0.04, 0.05, halfDepth * 2 - 0.04), halfWidth - 0.15, y, 0),
    ]),
    mat(dressing.wallCourse, { roughness: 0.9 }),
  );
  courses.name = "library-courses"; group.add(courses);

  // ── The tall window behind the lectern, and its shaft of day ─────────────
  const [wx, wy, wz] = LIBRARY_LAYOUT.window;
  const windowFrame = merged([
    placed(new THREE.BoxGeometry(1.5, 0.1, 0.1), wx, wy + 1.05, wz + 0.16),
    placed(new THREE.BoxGeometry(1.5, 0.1, 0.1), wx, wy - 1.05, wz + 0.16),
    placed(new THREE.BoxGeometry(0.1, 2.2, 0.1), wx - 0.7, wy, wz + 0.16),
    placed(new THREE.BoxGeometry(0.1, 2.2, 0.1), wx + 0.7, wy, wz + 0.16),
    placed(new THREE.BoxGeometry(0.06, 2.1, 0.08), wx, wy, wz + 0.16),
    placed(new THREE.BoxGeometry(1.4, 0.06, 0.08), wx, wy, wz + 0.16),
  ], mat(dressing.window, { roughness: 0.7 }));
  windowFrame.name = "library-window"; group.add(windowFrame);
  const day = new THREE.Mesh(track(new THREE.PlaneGeometry(1.34, 2.04)), track(new THREE.MeshBasicMaterial({ color: dressing.day })));
  day.position.set(wx, wy, wz + 0.15); day.name = "library-day"; group.add(day);
  const shaft = new THREE.Mesh(track(new THREE.PlaneGeometry(1.5, 3.4)), track(new THREE.MeshBasicMaterial({ color: dressing.light.shaft, transparent: true, opacity: 0.06, depthWrite: false })));
  shaft.rotation.x = -Math.PI / 2; shaft.position.set(wx, 0.02, wz + 2.0); shaft.renderOrder = 2; group.add(shaft);
  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.55);
  group.add(hemi);

  // ── The cases along both side walls, spines in rows ───────────────────────
  const spineMaterials = dressing.spines.map((colour) => mat(colour, { roughness: 0.85 }));
  for (const side of [-1, 1] as const) {
    // An open case: a back panel against the wall, uprights and a top, the books proud of it.
    // The left case takes the front half of its wall (the Bindery bench has the back);
    // the right case takes the back half (the Time Machine's desk has the front).
    const backX = side * (halfWidth - 0.12);
    const rowX = side * (halfWidth - 0.4);
    const caseZ = side < 0 ? 1.7 : -1.9;
    const caseLength = 2.4;
    const bookcase = merged([
      placed(new THREE.BoxGeometry(0.1, 2.2, caseLength), backX, 1.1, caseZ),
      placed(new THREE.BoxGeometry(0.56, 2.2, 0.1), rowX, 1.1, caseZ - caseLength / 2),
      placed(new THREE.BoxGeometry(0.56, 2.2, 0.1), rowX, 1.1, caseZ + caseLength / 2),
      placed(new THREE.BoxGeometry(0.56, 0.08, caseLength), rowX, 2.2, caseZ),
    ], mat(dressing.case, { roughness: 0.88 }));
    shadowed(bookcase, false, true); bookcase.name = `library-case-${side}`; group.add(bookcase);
    const shelves = merged(
      [0.55, 1.1, 1.65].map((y) => placed(new THREE.BoxGeometry(0.52, 0.05, caseLength), rowX, y, caseZ)),
      mat(dressing.caseShelf, { roughness: 0.85 }),
    );
    shelves.name = `library-shelves-${side}`; group.add(shelves);
    // Spines: one instanced run per colour, jittered along each shelf, standing clear of the panel.
    let seed = side > 0 ? 11 : 5;
    const random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (const [index, spineMaterial] of spineMaterials.entries()) {
      const geometry = track(new THREE.BoxGeometry(0.3, 0.34, 0.09));
      const run = new THREE.InstancedMesh(geometry, spineMaterial, 14);
      const matrix = new THREE.Matrix4(); const position = new THREE.Vector3(); const quaternion = new THREE.Quaternion(); const scale = new THREE.Vector3();
      for (let i = 0; i < 14; i++) {
        const shelfY = [0.75, 1.3, 1.85][(i + index) % 3]!;
        position.set(rowX, shelfY, caseZ - (caseLength / 2 - 0.25) + random() * (caseLength - 0.5));
        quaternion.identity();
        scale.set(1, 0.85 + random() * 0.35, 1);
        run.setMatrixAt(i, matrix.compose(position, quaternion, scale));
      }
      run.instanceMatrix.needsUpdate = true;
      run.name = `library-spines-${side}-${index}`;
      group.add(run);
    }
  }

  // ── The balcony rail round the hall, stickies on it ───────────────────────
  const rail = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2 - 0.6, 0.07, 0.07), 0, balcony + 0.5, -halfDepth + 0.55),
    placed(new THREE.BoxGeometry(0.07, 0.07, halfDepth * 2 - 1.1), -halfWidth + 0.55, balcony + 0.5, 0),
    placed(new THREE.BoxGeometry(0.07, 0.07, halfDepth * 2 - 1.1), halfWidth - 0.55, balcony + 0.5, 0),
    ...Array.from({ length: 7 }, (_, i) => placed(new THREE.BoxGeometry(0.05, 0.5, 0.05), -halfWidth + 0.9 + i * ((halfWidth * 2 - 1.8) / 6), balcony + 0.25, -halfDepth + 0.55)),
  ], mat(dressing.rail, { roughness: 0.85 }));
  rail.name = "library-balcony"; rail.userData.anchor = "balcony"; group.add(rail);
  const stickyGeometry = track(new THREE.PlaneGeometry(0.16, 0.12));
  const stickies = new THREE.InstancedMesh(stickyGeometry, mat(dressing.sticky, { roughness: 0.95, side: THREE.DoubleSide }), 6);
  {
    const matrix = new THREE.Matrix4(); const position = new THREE.Vector3(); const quaternion = new THREE.Quaternion(); const scale = new THREE.Vector3(1, 1, 1);
    for (let i = 0; i < 6; i++) {
      position.set(-halfWidth + 1.2 + i * ((halfWidth * 2 - 2.4) / 5), balcony + 0.42, -halfDepth + 0.59);
      quaternion.setFromEuler(new THREE.Euler(0.1 * (i % 2 ? 1 : -1), 0, 0.06 * (i % 3 ? 1 : -1)));
      stickies.setMatrixAt(i, matrix.compose(position, quaternion, scale));
    }
    stickies.instanceMatrix.needsUpdate = true;
  }
  stickies.name = "library-stickies"; stickies.userData.anchor = "balcony"; group.add(stickies);

  // ── The lectern, and the Standing Book open on it ─────────────────────────
  const [lx, , lz] = LIBRARY_LAYOUT.lectern;
  const lectern = merged([
    placed(new THREE.BoxGeometry(0.66, 0.14, 0.5), lx, 1.12, lz, [-0.28, 0, 0]),
    placed(new THREE.CylinderGeometry(0.09, 0.13, 1.05, 8), lx, 0.55, lz),
    placed(new THREE.CylinderGeometry(0.34, 0.38, 0.1, 10), lx, 0.05, lz),
  ], mat(dressing.lectern, { roughness: 0.85 }));
  shadowed(lectern, full, true); lectern.name = "library-lectern"; lectern.userData.anchor = "book"; group.add(lectern);
  const bookGroup = new THREE.Group();
  bookGroup.name = "library-book";
  bookGroup.userData.anchor = "book";
  {
    const cover = new THREE.Mesh(track(new THREE.BoxGeometry(0.74, 0.05, 0.5)), mat(dressing.cover, { roughness: 0.8 }));
    bookGroup.add(cover);
    for (const side of [-1, 1] as const) {
      const leaf = new THREE.Mesh(track(new THREE.BoxGeometry(0.34, 0.045, 0.46)), mat(dressing.page, { roughness: 0.92 }));
      leaf.position.set(side * 0.18, 0.045, 0); leaf.rotation.z = side * 0.12; bookGroup.add(leaf);
      // Ink lines on each open page: the ledger, at reading distance.
      for (let line = 0; line < 4; line++) {
        const ink = new THREE.Mesh(track(new THREE.PlaneGeometry(0.24, 0.012)), mat(dressing.inkLine, { roughness: 1 }));
        ink.rotation.x = -Math.PI / 2; ink.rotation.y = side * 0.12;
        ink.position.set(side * 0.18, 0.07, -0.14 + line * 0.09);
        bookGroup.add(ink);
      }
    }
    bookGroup.position.set(lx, 1.2, lz);
    bookGroup.rotation.x = -0.28;
    bookGroup.traverse((node) => { node.userData.anchor = "book"; });
    group.add(bookGroup);
  }
  contacts.disc(lx, lz, 0.5, 0.6, group);

  // ── The Bindery bench: five machines, each its own small engine ───────────
  const [bx, , bz] = LIBRARY_LAYOUT.bindery;
  const binderyBench = merged([
    placed(new THREE.BoxGeometry(0.8, 0.07, 3.6), bx, 0.88, bz),
    placed(new THREE.BoxGeometry(0.09, 0.84, 0.09), bx - 0.28, 0.42, bz - 1.6),
    placed(new THREE.BoxGeometry(0.09, 0.84, 0.09), bx + 0.28, 0.42, bz - 1.6),
    placed(new THREE.BoxGeometry(0.09, 0.84, 0.09), bx - 0.28, 0.42, bz + 1.6),
    placed(new THREE.BoxGeometry(0.09, 0.84, 0.09), bx + 0.28, 0.42, bz + 1.6),
  ], mat(dressing.binderyBench, { roughness: 0.85 }));
  shadowed(binderyBench, false, true); binderyBench.name = "library-bindery"; binderyBench.userData.anchor = "bindery"; group.add(binderyBench);
  const machineBodies: THREE.BufferGeometry[] = [];
  const machineBrass: THREE.BufferGeometry[] = [];
  BINDERY_MACHINES.forEach((_, index) => {
    const z = bz - 1.4 + index * 0.7;
    machineBodies.push(placed(new THREE.BoxGeometry(0.34, 0.26 + (index % 3) * 0.07, 0.3), bx, 1.05 + ((index % 3) * 0.07) / 2, z));
    machineBrass.push(
      index % 2 === 0
        ? placed(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 10), bx, 1.3 + (index % 3) * 0.07, z, [Math.PI / 2, 0, 0])
        : placed(new THREE.CylinderGeometry(0.025, 0.025, 0.2, 6), bx + 0.12, 1.3 + (index % 3) * 0.07, z, [0, 0, 0.5]),
    );
  });
  const machines = merged(machineBodies, mat(dressing.machine, { roughness: 0.6, metalness: 0.15 }));
  machines.userData.anchor = "bindery"; machines.name = "library-machines"; group.add(machines);
  const machineFittings = merged(machineBrass, mat(dressing.brass, { roughness: 0.4, metalness: 0.5 }));
  machineFittings.userData.anchor = "bindery"; machineFittings.name = "library-machine-fittings"; group.add(machineFittings);
  contacts.disc(bx, bz, 0.7, 0.5, group);

  // ── The Time Machine at its desk, thumbing back through the leaves ────────
  const [tx, , tz] = LIBRARY_LAYOUT.timeMachine;
  const timeDesk = merged([
    placed(new THREE.BoxGeometry(0.9, 0.06, 1.1), tx, 0.8, tz),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), tx - 0.35, 0.385, tz - 0.45),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), tx + 0.35, 0.385, tz - 0.45),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), tx - 0.35, 0.385, tz + 0.45),
    placed(new THREE.BoxGeometry(0.08, 0.77, 0.08), tx + 0.35, 0.385, tz + 0.45),
  ], mat(dressing.lectern, { roughness: 0.85 }));
  shadowed(timeDesk, false, true); timeDesk.name = "library-time-desk"; timeDesk.userData.anchor = "time-machine"; group.add(timeDesk);
  const timeMachine = merged([
    placed(new THREE.BoxGeometry(0.4, 0.3, 0.3), tx, 0.98, tz),
    placed(new THREE.TorusGeometry(0.14, 0.03, 6, 16), tx - 0.24, 1.0, tz, [0, Math.PI / 2, 0]),
    placed(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 10), tx + 0.1, 1.2, tz, [0.5, 0, 0]),
  ], mat(dressing.brass, { roughness: 0.4, metalness: 0.5 }));
  timeMachine.userData.anchor = "time-machine"; timeMachine.name = "library-time-machine"; group.add(timeMachine);
  const leaves = merged([
    placed(new THREE.BoxGeometry(0.24, 0.05, 0.3), tx - 0.05, 0.86, tz + 0.32, [0, 0.2, 0.06]),
  ], mat(dressing.page, { roughness: 0.92 }));
  leaves.userData.anchor = "time-machine"; group.add(leaves);
  contacts.disc(tx, tz, 0.55, 0.5, group);

  // ── The hall door to the Court, and the garden door to the Glasshouse ─────
  const [dx, , dz] = LIBRARY_LAYOUT.door;
  const hallDoor = merged([
    placed(new THREE.BoxGeometry(0.16, 2.3, 0.16), dx - 0.6, 1.15, dz),
    placed(new THREE.BoxGeometry(0.16, 2.3, 0.16), dx + 0.6, 1.15, dz),
    placed(new THREE.BoxGeometry(1.36, 0.16, 0.16), dx, 2.34, dz),
  ], mat(dressing.case, { roughness: 0.85 }));
  hallDoor.name = "library-door"; hallDoor.userData.anchor = "court-door"; group.add(hallDoor);
  const [gx, , gz] = LIBRARY_LAYOUT.garden;
  const gardenDoor = merged([
    placed(new THREE.BoxGeometry(0.14, 1.9, 0.14), gx - 0.5, 0.95, gz),
    placed(new THREE.BoxGeometry(0.14, 1.9, 0.14), gx + 0.5, 0.95, gz),
    placed(new THREE.BoxGeometry(1.14, 0.14, 0.14), gx, 1.92, gz),
  ], mat(dressing.case, { roughness: 0.85 }));
  gardenDoor.name = "library-garden-door"; gardenDoor.userData.anchor = "glasshouse-way"; group.add(gardenDoor);
  const gardenGlimpse = new THREE.Mesh(track(new THREE.PlaneGeometry(0.95, 1.8)), track(new THREE.MeshBasicMaterial({ color: dressing.day })));
  gardenGlimpse.position.set(gx, 0.95, gz + 0.02); gardenGlimpse.userData.anchor = "glasshouse-way"; group.add(gardenGlimpse);

  // ── Plates ────────────────────────────────────────────────────────────────
  const finishNow = (): PlateFinish => plateFinish("current");
  const lecternPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 0.95, 0.15));
  lecternPlate.mesh.position.set(lx + 0.1, 0.16, lz + 0.78);
  lecternPlate.mesh.rotation.x = -1.05;
  lecternPlate.mesh.rotation.z = 0.35;
  lecternPlate.mesh.userData.anchor = "book";
  lecternPlate.set("The Standing Book — every figure has a source", finishNow());
  group.add(lecternPlate.mesh);
  const binderyPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.3, 0.2));
  binderyPlate.mesh.position.set(bx + 0.44, 1.35, bz);
  binderyPlate.mesh.rotation.y = Math.PI / 2;
  binderyPlate.mesh.userData.anchor = "bindery";
  binderyPlate.set("The Bindery — five machines, one per divider", finishNow());
  group.add(binderyPlate.mesh);
  const gardenPlate = track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, 1.25, 0.2));
  gardenPlate.mesh.position.set(gx, 2.15, gz + 0.05);
  gardenPlate.mesh.userData.anchor = "glasshouse-way";
  gardenPlate.set("The garden door — the Glasshouse behind the hall", finishNow());
  group.add(gardenPlate.mesh);

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const anchorList = (): Anchor[] => [
    { id: "book", position: at(lx, 1.25, lz), zone: "station", label: "The Standing Book, open on its lectern — every figure has a source, every page a place. Open the Standing Book.", door: { target: "books" } },
    { id: "bindery", position: at(bx, 1.15, bz), zone: "station", label: `The Bindery — ${BINDERY_MACHINES.join(", ")}. One machine per divider. Open the Standing Book.`, door: { target: "books" } },
    { id: "time-machine", position: at(tx, 1.05, tz), zone: "station", label: "The Time Machine, thumbing back through the leaves. Open the Standing Book.", door: { target: "books" } },
    { id: "balcony", position: at(0, balcony + 0.45, -halfDepth + 0.6), zone: "prop", label: "The reading balcony — the accounts as stickies on its rail. Open the Standing Book.", door: { target: "books" } },
    { id: "glasshouse-way", position: at(gx, 1.0, gz + 0.2), zone: "landmark", label: "The garden door — through to the Glasshouse." },
    { id: "court-door", position: at(dx, 1.1, dz - 0.2), zone: "stair", label: "The hall door — back to the Court." },
  ];

  const regionList = (): Region[] => [
    { id: "book", group: "library", label: "The Standing Book on its lectern", box: box(lx - 0.55, 0.4, lz - 0.5, lx + 0.55, 1.6, lz + 0.6) },
    { id: "bindery", group: "library", label: "The Bindery bench", box: box(bx - 0.55, 0.4, bz - 1.9, bx + 0.6, 1.6, bz + 1.9) },
    { id: "time-machine", group: "library", label: "The Time Machine", box: box(tx - 0.55, 0.4, tz - 0.7, tx + 0.55, 1.5, tz + 0.7) },
    { id: "balcony", group: "library", label: "The reading balcony", box: box(-halfWidth + 0.6, balcony + 0.1, -halfDepth + 0.3, halfWidth - 0.6, balcony + 0.7, -halfDepth + 0.9) },
    { id: "glasshouse-way", group: "library", label: "The garden door to the Glasshouse", box: box(gx - 0.7, 0, gz - 0.2, gx + 0.7, 2.1, gz + 0.4) },
    { id: "court-door", group: "library", label: "The hall door — back to the Court", box: box(dx - 0.8, 0, dz - 0.3, dx + 0.8, 2.5, dz + 0.2) },
  ];

  return {
    group,
    update: () => {},
    animate: () => false,
    dispose() {
      scene.remove(group);
      for (const item of disposables) item.dispose();
    },
    anchors: anchorList,
    poses: () => libraryPoses(anchorList()),
    regions: regionList,
  };
}

export const libraryPlace: Place = registerPlace({
  id: "library",
  build(scene, dressing, reading, quality, context) {
    return createLibrary(scene, {
      dressing: libraryDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
