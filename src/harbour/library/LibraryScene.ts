import { libraryInterior } from "../interiors/libraryInterior.ts";
import * as THREE from "three";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { libraryDressingFrom, type LibraryDressing } from "./dressing.ts";
import { BINDERY_MACHINES, binderyDoorObject } from "../../house/bindery.ts";

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
 * nothing in the hall reads or writes a ledger row. Each Bindery machine goes
 * one step further and names its own division of the book
 * (`onOpen("books", "bindery/<id>")`, `house/bindery.ts`), so the hall's own
 * plate — "one machine per divider" — is true when you touch it.
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

/** The five Bindery machines, in the vision's own order and words, each with the division it opens. */
export { BINDERY_MACHINES } from "../../house/bindery.ts";

/** Where the `index`th machine stands along the Bindery bench. */
export function machineSpot(index: number): number {
  return LIBRARY_LAYOUT.bindery[2] - 1.4 + index * 0.7;
}

/** A machine's height above the bench top: three sizes, repeating down the row. */
export function machineRise(index: number): number {
  return (index % 3) * 0.07;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// Stand just inside the hall door: the lectern centre, the Bindery along the
// far-left wall, the tall window behind, the balcony above.
const PHONE_ROOM: Pose = { target: [-0.15, 1.5, -1.55], r: 4.7, theta: 0.12, phi: 1.27 };
const DESKTOP_ROOM: Pose = { target: [-0.3, 1.5, -1.25], r: 5.15, theta: 0.4, phi: 1.28 };

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
  const group = new THREE.Group(); group.name = "library";
  const interior = libraryInterior(group, dressing);
  const { balcony } = LIBRARY_LAYOUT;
  const [lx,,lz] = LIBRARY_LAYOUT.lectern, [bx,,bz] = LIBRARY_LAYOUT.bindery;
  const [tx,,tz] = LIBRARY_LAYOUT.timeMachine, [dx,,dz] = LIBRARY_LAYOUT.door, [gx,,gz] = LIBRARY_LAYOUT.garden;
  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const anchorList = (): Anchor[] => [
    { id: "book", position: at(lx, 1.25, lz), zone: "station", label: "The Standing Book, open on its lectern — every figure has a source, every page a place. Open the Standing Book.", door: { target: "books" } },
    { id: "bindery", position: at(bx, 1.15, bz), zone: "station", label: `The Bindery — ${BINDERY_MACHINES.map((machine) => machine.name).join(", ")}. One machine per divider. Open the Standing Book.`, door: { target: "books" } },
    // One machine, one divider: the door carries the machine and the book arrives at its division.
    ...BINDERY_MACHINES.map((machine, index): Anchor => ({
      id: `bindery:${machine.id}`,
      position: at(bx, 1.2 + machineRise(index), machineSpot(index)),
      zone: "machine",
      label: `${machine.name} — ${machine.line}. Open the Standing Book at ${machine.division}.`,
      door: { target: "books", object: binderyDoorObject(machine.id) },
    })),
    { id: "time-machine", position: at(tx, 1.05, tz), zone: "station", label: "The Time Machine, thumbing back through the leaves. Open the Standing Book.", door: { target: "books", object: "chapter/record" } },
    { id: "balcony", position: at(2.6, balcony + 0.45, -2.5), zone: "prop", label: "The reading balcony — the accounts as stickies on its rail. Open the Standing Book.", door: { target: "books", object: "bindery/cut-bank" } },
    { id: "glasshouse-way", position: at(gx, 1.0, gz + 0.2), zone: "landmark", label: "The garden door — through to the Glasshouse." },
    { id: "court-door", position: at(dx, 1.1, dz - 0.2), zone: "stair", label: "The hall door — back to the Court." },
  ];

  const regionList = (): Region[] => [
    { id: "book", group: "library", label: "The Standing Book on its lectern", box: box(lx - 1.04, 0.1, lz - 0.62, lx + 1.04, 1.6, lz + 0.62) },
    { id: "bindery", group: "library", label: "The Bindery bench", box: box(bx - 0.55, 0.4, bz - 1.9, bx + 0.6, 0.95, bz + 1.9) },
    ...BINDERY_MACHINES.map((machine, index): Region => ({
      id: `bindery:${machine.id}`, group: "library", label: `${machine.name} — the Standing Book at ${machine.division}`,
      box: box(bx - 0.2, 0.95, machineSpot(index) - 0.17, bx + 0.22, 1.42 + machineRise(index), machineSpot(index) + 0.17),
    })),
    { id: "time-machine", group: "library", label: "The Time Machine", box: box(tx - 0.55, 0.4, tz - 0.7, tx + 0.55, 1.5, tz + 0.7) },
    { id: "balcony", group: "library", label: "The reading balcony", box: box(1.1, balcony + 0.1, -2.6, 4.1, balcony + 0.7, -2.4) },
    { id: "glasshouse-way", group: "library", label: "The garden door to the Glasshouse", box: box(gx - 0.7, 0, gz - 0.2, gx + 0.7, 2.1, gz + 0.4) },
    { id: "court-door", group: "library", label: "The hall door — back to the Court", box: box(dx - 0.8, 0, dz - 0.3, dx + 0.8, 2.5, dz + 0.2) },
  ];

  return {
    group,
    update: () => {},
    animate: () => false,
    dispose() {
      scene.remove(group);
      interior.dispose();
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
