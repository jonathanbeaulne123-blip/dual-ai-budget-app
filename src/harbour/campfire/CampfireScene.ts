import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { CAMPFIRE_STONE_CAP, EMPTY_CAMPFIRE_READING, type CampfireReading, type CampfireSeat } from "../data/reading.ts";
import { campfireDressingFrom, type CampfireDressing } from "./dressing.ts";

/**
 * The Campfire (LITTLE_HARBOUR_v2 §6) — the emotional centre of the harbour,
 * down on the shore in front of the Boathouse.
 *
 * A ring of beach stones with the fire in it, two split logs facing each other
 * across the flame, Hercules between them where the heat reaches, and the path
 * of months running away toward the water — one laid stone for every Chapter
 * that has closed. This is the one ritual that needs two people: the month's
 * Chapter closes here, in the paired review, and **no chapter ever closes on
 * its own** — the fire simply keeps burning until both of you sit down.
 *
 * Everything the fire shows is a **door** (`onOpen`) onto the surface that
 * already owns it: the Plan Studio for the Sitdown and the closure, Journey
 * for the path of months, the companion's own surface for Hercules. Nothing
 * here writes, proposes, agrees or closes anything.
 *
 * The one thing that moves: the fire. It flickers on the runtime's own frame
 * policy (`animate` returns true, the shell's `invalidate` keeps the frames
 * coming, a tool open or reduced motion stops them) — never a raw rAF. An
 * **unlit** fire — a household that has never closed a Chapter — is kindling
 * standing in a cold ring, and `animate` returns false so the shore rests.
 */

export const CAMPFIRE_LAYOUT = {
  /** The ring of beach stones and the fire standing in it. */
  ring: { radius: 0.98, stones: 9 },
  /** The two split logs, drawn up on either side of the fire and turned to face it. */
  seats: [[-1.72, 0, 0.42], [1.72, 0, -0.36]] as const,
  /**
   * The path of months: stones laid away from the fire, toward the Boathouse
   * and the water, the newest nearest the ring.
   */
  path: { x: -0.25, z: -1.95, stepZ: -0.56, sway: 0.42, cols: 1 },
  /** Hercules, curled by the near log where the heat reaches. He asks the questions. */
  hercules: [1.18, 0, 1.16] as const,
  /** The footpath up the shore: the way back to the Court. */
  door: [0, 0, 3.45] as const,
  /** A wayfinding sign toward the real Boathouse across the village. */
  boathouse: [-2.9, 0, 2.7] as const,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A count in words that never shames an empty path: "none yet" is a beginning, not a fault. */
export function stoneWords(count: number): string {
  return count === 0 ? "no stones on the path yet" : `${count} ${count === 1 ? "stone" : "stones"} on the path`;
}

/** Where the month's review stands, in the shore's own words. Names, never amounts. */
export function campfireWords(reading: Pick<CampfireReading, "close" | "seats" | "seated" | "month" | "lit" | "overdue">): string {
  const waiting = reading.seats.filter((seat) => !seat.seated).map((seat) => seat.name);
  switch (reading.close) {
    case "proposed":
      return "a closing is on the table — read it, and sit down when you are ready";
    case "awaiting-partner":
      return waiting.length > 0 ? `you have sat; the fire is waiting for ${waiting.join(" and ")}` : "you have sat; the fire is waiting";
    case "sealed":
      return "the month is sealed — the newest stone is still warm";
    default:
      if (!reading.lit) return "unlit kindling, waiting for your first Sitdown";
      return reading.overdue ? "the month has ended and this Chapter is still open" : "burning quietly, nothing on the table";
  }
}

/** Where the `index`th laid month sits on the path: a single line with a gentle sway. */
export function stonePin(index: number): { x: number; z: number } {
  const { x, z, stepZ, sway } = CAMPFIRE_LAYOUT.path;
  return { x: x + Math.sin(index * 1.21) * sway, z: z + index * stepZ };
}

// Stand a little up the shore, at the fire's own height, so both logs and the
// whole path read at once: the ring fills the frame on a phone, and the path
// and the Boathouse behind it come in on desktop.
const PHONE_SHORE: Pose = { target: [0, 0.45, -0.5], r: 6.5, theta: 0.1, phi: 1.26 };
const DESKTOP_SHORE: Pose = { target: [0, 0.5, -0.7], r: 5.9, theta: 0.16, phi: 1.22 };

export function campfirePoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "campfire:phone": PHONE_SHORE,
    "campfire:desktop": DESKTOP_SHORE,
    "sky:phone": { target: [0, 0.6, -1.4], r: 6.4, theta: 0.06, phi: 1.02 },
    "sky:desktop": { target: [0, 0.6, -1.6], r: 7.0, theta: 0.2, phi: 1.0 },
    // The door frieze: the ring alone, for the band above an open tool.
    "door:phone": { target: [0, 0.5, 0], r: 2.2, theta: 0.04, phi: 1.28 },
    "door:desktop": { target: [0, 0.5, -0.1], r: 2.4, theta: 0.1, phi: 1.26 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 5.5) * 0.6, -0.6, 0.6);
    const close = anchor.zone === "stone" ? 1.8 : anchor.zone === "stair" ? 2.6 : 2.2;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.35, y), z], r: close, theta, phi: 1.24 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.35, y), z], r: close + 0.4, theta: theta + 0.14, phi: 1.18 };
  }
  return poses;
}

export type CampfireSceneReading = { campfire: CampfireReading | null; partnerName: string | null };

/** Narrows whatever the shell hands over to the shore's own rows. */
export function readCampfireReading(value: unknown): CampfireSceneReading {
  if (!value || typeof value !== "object") return { campfire: null, partnerName: null };
  const source = value as { campfire?: CampfireReading; partner?: { name?: string } | null };
  return {
    campfire: source.campfire ?? null,
    partnerName: typeof source.partner?.name === "string" && source.partner.name ? source.partner.name : null,
  };
}

export type CampfireOptions = {
  dressing: CampfireDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createCampfire(scene: THREE.Scene, options: CampfireOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "campfire";
  const disposables: { dispose(): void }[] = [];
  const track = <T extends { dispose(): void }>(item: T): T => { disposables.push(item); return item; };
  const mat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    track(new THREE.MeshStandardMaterial({ color, roughness: 0.92, metalness: 0, ...extra }));
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
  const { ring, seats, hercules: herculesSpot, door: doorSpot, boathouse: boathouseSpot } = CAMPFIRE_LAYOUT;

  // ── The shore: a swept apron of sand, the grass stopping short of the ring ─
  const apron = shadowed(new THREE.Mesh(track(new THREE.CircleGeometry(4.6, 32)), mat(dressing.shore, { roughness: 0.99 })), false, true);
  apron.rotation.x = -Math.PI / 2; apron.position.y = 0.004; apron.name = "campfire-shore"; group.add(apron);
  const sandBed = new THREE.Mesh(track(new THREE.CircleGeometry(2.05, 26)), mat(dressing.sand, { roughness: 0.99 }));
  sandBed.rotation.x = -Math.PI / 2; sandBed.position.set(0, 0.008, 0); sandBed.name = "campfire-sand"; group.add(sandBed);

  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.46);
  group.add(hemi);

  // ── The ring of beach stones ──────────────────────────────────────────────
  const ringStones = merged(
    Array.from({ length: ring.stones }, (_, i) => {
      const a = (i / ring.stones) * Math.PI * 2;
      const size = 0.15 + ((i * 7) % 5) * 0.018;
      const stone = new THREE.DodecahedronGeometry(size, 0);
      stone.scale(1, 0.72, 1);
      return placed(stone, Math.cos(a) * ring.radius, size * 0.52, Math.sin(a) * ring.radius, [0, a, 0]);
    }),
    mat(dressing.stone, { roughness: 0.96, flatShading: true }),
  );
  shadowed(ringStones, full, true); ringStones.name = "campfire-ring"; owned(ringStones, "fire"); group.add(ringStones);
  const ashBed = new THREE.Mesh(track(new THREE.CircleGeometry(ring.radius - 0.16, 20)), mat(dressing.ash, { roughness: 1 }));
  ashBed.rotation.x = -Math.PI / 2; ashBed.position.y = 0.012; ashBed.name = "campfire-ash"; owned(ashBed, "fire"); group.add(ashBed);

  // ── The wood: four sticks leant into a cone, the way a fire is actually laid ─
  const woodpile = merged([
    ...Array.from({ length: 5 }, (_, i) => {
      const a = (i / 5) * Math.PI * 2 + 0.3;
      return placed(new THREE.CylinderGeometry(0.036, 0.05, 0.66, 6), Math.cos(a) * 0.2, 0.3, Math.sin(a) * 0.2, [Math.cos(a) * 0.34, 0, -Math.sin(a) * 0.34]);
    }),
    placed(new THREE.CylinderGeometry(0.05, 0.055, 0.72, 6), 0.06, 0.05, -0.08, [Math.PI / 2, 0.5, 0]),
  ], mat(dressing.wood, { roughness: 0.93, flatShading: true }));
  shadowed(woodpile, full, true); woodpile.name = "campfire-wood"; owned(woodpile, "fire"); group.add(woodpile);

  // ── The fire itself: an ember bed, a low body, a tongue, and the light ────
  const emberMaterial = track(new THREE.MeshStandardMaterial({
    color: dressing.ember, emissive: new THREE.Color(dressing.ember), emissiveIntensity: 0, roughness: 0.8, transparent: true, opacity: 0.25,
  }));
  const emberBed = new THREE.Mesh(track(new THREE.CircleGeometry(0.46, 16)), emberMaterial);
  emberBed.rotation.x = -Math.PI / 2; emberBed.position.y = 0.02; emberBed.renderOrder = 2;
  emberBed.name = "campfire-embers"; owned(emberBed, "fire"); group.add(emberBed);
  const flameMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.flame, transparent: true, opacity: 0, depthWrite: false }));
  const flame = new THREE.Mesh(track(new THREE.ConeGeometry(0.3, 0.72, 9)), flameMaterial);
  flame.position.set(0, 0.36, 0); flame.renderOrder = 3; flame.name = "campfire-flame"; owned(flame, "fire"); group.add(flame);
  const tipMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.flameTip, transparent: true, opacity: 0, depthWrite: false }));
  const flameTip = new THREE.Mesh(track(new THREE.ConeGeometry(0.15, 0.4, 8)), tipMaterial);
  flameTip.position.set(0, 0.32, 0); flameTip.renderOrder = 4; flameTip.name = "campfire-flame-tip"; owned(flameTip, "fire"); group.add(flameTip);
  const smokeMaterial = track(new THREE.MeshBasicMaterial({ color: dressing.smoke, transparent: true, opacity: 0, depthWrite: false }));
  const smoke = merged([
    placed(new THREE.SphereGeometry(0.15, 7, 5), 0.03, 1.02, -0.02),
    placed(new THREE.SphereGeometry(0.2, 7, 5), -0.06, 1.42, 0.05),
    placed(new THREE.SphereGeometry(0.26, 7, 5), 0.08, 1.9, -0.04),
  ], smokeMaterial);
  smoke.renderOrder = 3; smoke.name = "campfire-smoke"; group.add(smoke);
  /** The one always-alive thing on the island: the fire's own warmth. */
  const warmth = new THREE.PointLight(new THREE.Color(dressing.light.fire), 0, 9, 2);
  warmth.position.set(0, 0.55, 0); warmth.name = "campfire-warmth"; group.add(warmth);
  // Unlit kindling: pale, dry sticks standing in a cold ring, waiting for the first Sitdown.
  const kindlingMaterial = track(new THREE.MeshStandardMaterial({ color: dressing.kindling, roughness: 0.97, transparent: true, opacity: 0, flatShading: true }));
  const kindling = merged([
    placed(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 5), -0.1, 0.19, 0.06, [0.22, 0, 0.3]),
    placed(new THREE.CylinderGeometry(0.02, 0.025, 0.4, 5), 0.12, 0.19, -0.04, [-0.26, 0, -0.24]),
    placed(new THREE.CylinderGeometry(0.018, 0.022, 0.34, 5), 0.02, 0.16, 0.14, [0.3, 0, -0.1]),
  ], kindlingMaterial);
  kindling.name = "campfire-kindling"; owned(kindling, "fire"); group.add(kindling);
  contacts.disc(0, 0, 1.4, 0.5, group);

  // ── The two split logs, drawn up and turned to face the fire ──────────────
  const seatGroups: THREE.Group[] = [];
  seats.forEach((spot, index) => {
    const [sx, , sz] = spot;
    const seat = new THREE.Group();
    seat.name = `campfire-seat-${index}`;
    const facing = Math.atan2(-sx, -sz);
    const log = merged([placed(new THREE.CylinderGeometry(0.21, 0.21, 1.25, 12), 0, 0.23, 0, [0, 0, Math.PI / 2])], mat(dressing.log, { roughness: 0.94 }));
    shadowed(log, full, true); seat.add(log);
    const barkRings = merged([
      placed(new THREE.TorusGeometry(0.212, 0.016, 5, 12), -0.42, 0.23, 0, [0, Math.PI / 2, 0]),
      placed(new THREE.TorusGeometry(0.212, 0.016, 5, 12), 0.42, 0.23, 0, [0, Math.PI / 2, 0]),
      // The chocks that stop it rolling.
      placed(new THREE.BoxGeometry(0.16, 0.08, 0.1), -0.34, 0.04, 0.17),
      placed(new THREE.BoxGeometry(0.16, 0.08, 0.1), 0.34, 0.04, 0.17),
    ], mat(dressing.bark, { roughness: 0.95 }));
    seat.add(barkRings);
    seat.position.set(sx, 0, sz);
    seat.rotation.y = facing;
    owned(seat, `seat:${index}`);
    group.add(seat);
    seatGroups.push(seat);
    contacts.disc(sx, sz, 0.8, 0.45, group);
  });

  // ── A signpost to the real Boathouse; never a second toy building ─
  {
    const [bx, , bz] = boathouseSpot;
    const shell = shadowed(merged([
      placed(new THREE.BoxGeometry(.09, 1.35, .09), bx, .68, bz),
      placed(new THREE.BoxGeometry(1.15, .28, .09), bx, 1.24, bz),
    ], mat(dressing.log, { roughness: 0.9 })));
    shell.name = "campfire-boathouse"; owned(shell, "boathouse"); group.add(shell);
    const sign = track(new EngravedPlate({ stone: dressing.plate, ink: dressing.ink, size: 'small', fit: true }, 1.1, .25));
    sign.set('Boathouse →'); sign.mesh.position.set(bx, 1.24, bz + .06); owned(sign.mesh, 'boathouse'); group.add(sign.mesh);
  }

  // ── Hercules, between the logs, where the heat reaches ────────────────────
  const hercules = new THREE.Group();
  hercules.name = "campfire-hercules";
  hercules.position.set(herculesSpot[0], 0.01, herculesSpot[2]);
  hercules.rotation.y = Math.PI;
  {
    const porcelain = mat(dressing.porcelain, { roughness: 0.4 });
    const pink = mat(dressing.pink, { roughness: 0.62 });
    const body = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.24, 14, 10)), porcelain));
    body.scale.set(1.28, 0.62, 0.9); body.position.y = 0.15; hercules.add(body);
    const head = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.15, 12, 9)), porcelain));
    head.scale.set(1, 0.92, 0.95); head.position.set(0.28, 0.23, 0.02); hercules.add(head);
    const ears = merged([
      placed(new THREE.ConeGeometry(0.06, 0.12, 6), 0.31, 0.38, -0.09, [0.24, 0, -0.2]),
      placed(new THREE.ConeGeometry(0.06, 0.12, 6), 0.31, 0.38, 0.13, [-0.24, 0, -0.2]),
    ], porcelain);
    hercules.add(ears);
    const earInner = merged([
      placed(new THREE.ConeGeometry(0.03, 0.07, 6), 0.33, 0.39, -0.09, [0.24, 0, -0.2]),
      placed(new THREE.ConeGeometry(0.03, 0.07, 6), 0.33, 0.39, 0.13, [-0.24, 0, -0.2]),
    ], pink);
    hercules.add(earInner);
    const tail = shadowed(new THREE.Mesh(track(new THREE.TorusGeometry(0.17, 0.037, 6, 12, Math.PI * 1.2)), porcelain));
    tail.rotation.x = Math.PI / 2; tail.rotation.z = Math.PI * 0.55; tail.position.set(-0.27, 0.06, 0.18); hercules.add(tail);
    owned(hercules, "hercules");
    group.add(hercules);
  }
  contacts.disc(herculesSpot[0], herculesSpot[2], 0.42, 0.4, group);

  // ── The footpath up the shore, back to the Court ──────────────────────────
  const footpath = merged(
    Array.from({ length: 4 }, (_, i) => placed(new THREE.CircleGeometry(0.28 - i * 0.02, 10), (i % 2 ? 0.2 : -0.2), 0.01, doorSpot[2] - 0.9 + i * 0.44, [-Math.PI / 2, 0, 0])),
    mat(dressing.laid, { roughness: 0.97 }),
  );
  footpath.name = "campfire-footpath"; owned(footpath, "court-door"); group.add(footpath);

  // ── Plates: the fire, the path, and the seat that is waiting ──────────────
  const finishNow = (): PlateFinish => plateFinish("current");
  const plateFor = (width: number, height: number): EngravedPlate =>
    track(new EngravedPlate({ stone: dressing.plate, highlight: dressing.plateHighlight, ink: dressing.ink, size: "small" }, width, height));
  const firePlate = plateFor(1.55, 0.2);
  firePlate.mesh.position.set(0, 0.03, 2.2); firePlate.mesh.rotation.x = -Math.PI / 2;
  owned(firePlate.mesh, "fire"); group.add(firePlate.mesh);
  const pathPlate = plateFor(1.3, 0.18);
  pathPlate.mesh.position.set(CAMPFIRE_LAYOUT.path.x + 1.15, 0.03, CAMPFIRE_LAYOUT.path.z + 0.2); pathPlate.mesh.rotation.x = -Math.PI / 2;
  owned(pathPlate.mesh, "stones"); group.add(pathPlate.mesh);

  // ── What the reading stands: the stones, the figures, the fire's own heat ─
  let stood: THREE.Object3D[] = [];
  let view: CampfireReading = EMPTY_CAMPFIRE_READING;

  const clearStood = (): void => {
    for (const row of stood) row.removeFromParent();
    stood = [];
  };

  const seatOf = (index: number): CampfireSeat | null => view.seats[index] ?? null;

  const layOut = (): void => {
    clearStood();

    // The path of months: one laid stone per Chapter that has closed. The
    // newest is nearest the ring, and it keeps its own glow while the seal
    // is fresh — never a stone the books have not already earned.
    const laid = Math.min(CAMPFIRE_STONE_CAP, view.stones);
    const fresh = view.seal > 0 && laid > 0 ? 1 : 0;
    if (laid - fresh > 0) {
      const stones = merged(
        Array.from({ length: laid - fresh }, (_, i) => {
          const pin = stonePin(i + fresh);
          const size = 0.16 + ((i * 5) % 4) * 0.012;
          const stone = new THREE.DodecahedronGeometry(size, 0);
          stone.scale(1.25, 0.34, 1);
          return placed(stone, pin.x, size * 0.2, pin.z, [0, i * 0.7, 0]);
        }),
        mat(dressing.laid, { roughness: 0.95, flatShading: true }),
      );
      shadowed(stones, false, true); stones.name = "campfire-stones"; owned(stones, "stones");
      group.add(stones); stood.push(stones);
    }
    if (fresh > 0) {
      const pin = stonePin(0);
      const sealed = new THREE.Mesh(
        track(new THREE.DodecahedronGeometry(0.19, 0)),
        track(new THREE.MeshStandardMaterial({
          color: dressing.fresh, emissive: new THREE.Color(dressing.ember),
          emissiveIntensity: 0.9 * view.seal, roughness: 0.7, flatShading: true,
        })),
      );
      sealed.scale.set(1.25, 0.34, 1); sealed.position.set(pin.x, 0.04, pin.z);
      sealed.name = "campfire-stone-sealed"; owned(sealed, "stones");
      group.add(sealed); stood.push(sealed);
    }

    // Who has sat. A figure is a coat and a head, and nothing else — the fire
    // never draws anybody's face. An empty seat stays empty.
    seats.forEach((spot, index) => {
      const seat = seatOf(index);
      if (!seat?.seated) return;
      const [sx, , sz] = spot;
      const facing = Math.atan2(-sx, -sz);
      const figure = merged([
        placed(new THREE.CylinderGeometry(0.17, 0.24, 0.52, 9), 0, 0.72, -0.05),
        placed(new THREE.SphereGeometry(0.12, 10, 8), 0, 1.06, -0.05),
        // Knees, drawn up toward the fire.
        placed(new THREE.CylinderGeometry(0.08, 0.09, 0.34, 7), 0.11, 0.3, 0.16, [1.15, 0, 0]),
        placed(new THREE.CylinderGeometry(0.08, 0.09, 0.34, 7), -0.11, 0.3, 0.16, [1.15, 0, 0]),
      ], mat(dressing.figure, { roughness: 0.9 }));
      shadowed(figure, full, true);
      figure.position.set(sx, 0, sz);
      figure.rotation.y = facing;
      figure.name = `campfire-figure-${index}`;
      owned(figure, `seat:${index}`);
      group.add(figure); stood.push(figure);
    });

    // The fire's own heat, from the data and nothing else.
    const alive = view.lit || view.close === "proposed" || view.close === "awaiting-partner";
    const lift = alive ? 1 : 0;
    flameMaterial.opacity = 0.82 * lift;
    tipMaterial.opacity = 0.9 * lift;
    smokeMaterial.opacity = 0.1 * lift;
    emberMaterial.emissiveIntensity = (0.5 + 0.9 * view.seal) * lift;
    emberMaterial.opacity = (0.3 + 0.55 * view.seal) * lift;
    kindlingMaterial.opacity = alive ? 0 : 0.95;
    warmth.intensity = dressing.light.fireIntensity * (0.55 + 0.45 * view.seal) * lift;
    flame.visible = flameTip.visible = smoke.visible = lift > 0;
    kindling.visible = lift === 0;
    smoke.position.y = 0;
    smoke.scale.setScalar(1);

    const month = view.month ?? "this month";
    firePlate.set(`The fire · ${month} — ${campfireWords(view)}`, finishNow());
    pathPlate.set(`The path of months — ${stoneWords(view.stones)}`, finishNow());
  };

  const signatureOf = (reading: CampfireReading): string => [
    reading.month, reading.title, reading.close, reading.seated, reading.stones, reading.lit,
    reading.lastClosedOn, reading.sinceClose, reading.seal, reading.overdue,
    reading.seats.map((seat) => `${seat.memberId}:${seat.name}:${seat.seated ? 1 : 0}`).join(","),
  ].join("§");
  let signature = "";
  let partnerName: string | null = null;

  function update(value: unknown): void {
    const narrowed = readCampfireReading(value);
    const reading = narrowed.campfire ?? EMPTY_CAMPFIRE_READING;
    partnerName = narrowed.partnerName;
    const next = `${signatureOf(reading)}§${partnerName ?? ""}`;
    if (next === signature) return;
    view = reading; signature = next;
    layOut();
  }
  update(options.reading ?? null);

  scene.add(group);

  /**
   * The flicker. Two sines at unrelated rates and a third on the light give a
   * fire that never repeats on the eye; everything is derived from `t`, so a
   * frame the policy skips costs nothing and a frame it runs lands in the
   * right place. Returns true while the fire is alive, which is what keeps the
   * runtime scheduling frames; an unlit ring returns false and rests.
   */
  function animate(t: number): boolean {
    if (!flame.visible) return false;
    const beat = Math.sin(t * 5.3) * 0.5 + Math.sin(t * 8.7 + 1.1) * 0.3 + Math.sin(t * 2.1 + 0.4) * 0.2;
    flame.scale.set(1 + beat * 0.08, 1 + beat * 0.17, 1 + beat * 0.08);
    flame.position.set(Math.sin(t * 1.7) * 0.014, 0.36 + beat * 0.02, Math.cos(t * 2.3) * 0.012);
    flameTip.scale.set(1 - beat * 0.1, 1 + beat * 0.24, 1 - beat * 0.1);
    flameTip.position.set(Math.sin(t * 2.9 + 0.8) * 0.02, 0.58 + beat * 0.05, Math.cos(t * 2.1 + 0.3) * 0.016);
    warmth.intensity = dressing.light.fireIntensity * (0.55 + 0.45 * view.seal) * (0.88 + beat * 0.12);
    // The seal's embers: they rise only while a close is actually fresh.
    if (view.seal > 0) {
      const rise = (t * 0.32) % 1;
      smoke.position.y = rise * 0.5;
      smokeMaterial.opacity = 0.1 + 0.22 * view.seal * (1 - rise);
      smoke.scale.setScalar(0.8 + rise * 0.5);
    }
    return true;
  }

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const seatLabel = (index: number): string => {
    const seat = seatOf(index);
    if (!seat) return "A log drawn up to the fire, nobody on it yet. Pull out the Plan Studio.";
    return seat.seated
      ? `${seat.name}’s log — ${seat.name} has sat down for ${view.month ?? "this month"}. Read the closing in the Plan Studio.`
      : `${seat.name}’s log, still empty — the Chapter closes when ${seat.name} sits too. Read the closing in the Plan Studio.`;
  };

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = [
      {
        id: "fire",
        position: at(0, 0.5, 0),
        zone: "station",
        label: `The fire${view.title ? ` · “${view.title}”` : ""} — ${campfireWords(view)}. Pull out the Plan Studio.`,
        door: { target: "plan-studio" },
      },
      {
        id: "stones",
        position: at(CAMPFIRE_LAYOUT.path.x, 0.14, CAMPFIRE_LAYOUT.path.z - 0.6),
        zone: "stone",
        label: `The path of months — ${stoneWords(view.stones)}${view.seal > 0 ? ", the newest still warm" : ""}. Step into Journey.`,
        door: { target: "journey" },
      },
    ];
    seats.forEach((spot, index) => {
      if (!seatOf(index)) return;
      rows.push({ id: `seat:${index}`, position: at(spot[0], 0.55, spot[2]), zone: "station", label: seatLabel(index), door: { target: "plan-studio" } });
    });
    rows.push({ id: "hercules", position: at(herculesSpot[0], 0.4, herculesSpot[2]), zone: "prop", label: `Hercules by the fire — he asks one question at a time${partnerName ? `, and waits for ${partnerName}` : ""}. Talk with Hercules.`, door: { target: "hercules" } });
    rows.push({ id: "boathouse", position: at(boathouseSpot[0], 1.24, boathouseSpot[2]), zone: "landmark", label: "The Boathouse — follow the path across the village." });
    rows.push({ id: "court-door", position: at(doorSpot[0], 0.35, doorSpot[2] - 0.5), zone: "stair", label: "The footpath up the shore — back to the Court." });
    return rows;
  };

  const regionList = (): Region[] => {
    const rows: Region[] = [
      { id: "fire", group: "campfire", label: "The fire", box: box(-1.25, 0, -1.25, 1.25, 1.3, 1.25) },
      { id: "stones", group: "campfire", label: "The path of months", box: box(CAMPFIRE_LAYOUT.path.x - 0.9, 0, CAMPFIRE_LAYOUT.path.z + 7 * CAMPFIRE_LAYOUT.path.stepZ, CAMPFIRE_LAYOUT.path.x + 0.9, 0.3, CAMPFIRE_LAYOUT.path.z + 0.4) },
      { id: "hercules", group: "campfire", label: "Hercules by the fire", box: box(herculesSpot[0] - 0.4, 0, herculesSpot[2] - 0.4, herculesSpot[0] + 0.4, 0.5, herculesSpot[2] + 0.4) },
      { id: "boathouse", group: "campfire", label: "The Boathouse signpost", box: box(boathouseSpot[0] - .6, 0, boathouseSpot[2] - .1, boathouseSpot[0] + .6, 1.5, boathouseSpot[2] + .1) },
      { id: "court-door", group: "campfire", label: "The footpath — back to the Court", box: box(doorSpot[0] - 0.7, 0, doorSpot[2] - 1.1, doorSpot[0] + 0.7, 0.4, doorSpot[2] + 0.2) },
    ];
    seats.forEach((spot, index) => {
      if (!seatOf(index)) return;
      rows.push({ id: `seat:${index}`, group: "campfire", label: `${seatOf(index)!.name}'s log`, box: box(spot[0] - 0.7, 0, spot[2] - 0.5, spot[0] + 0.7, 1.25, spot[2] + 0.5) });
    });
    return rows;
  };

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
    poses: () => campfirePoses(anchorList()),
    regions: regionList,
  };
}

export const campfirePlace: Place = registerPlace({
  id: "campfire",
  build(scene, dressing, reading, quality, context) {
    return createCampfire(scene, {
      dressing: campfireDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
