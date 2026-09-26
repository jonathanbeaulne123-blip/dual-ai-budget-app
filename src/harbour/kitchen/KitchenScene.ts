import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { EngravedPlate, plateFinish, type PlateFinish } from "../court/engraved.ts";
import { createContactShadows } from "../scene/contact.ts";
import { registerPlace, type Anchor, type Composition, type Place, type PlaceHandle, type Pose, type Region, type Vec3 } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";
import { EMPTY_KITCHEN_READING, type KitchenReading, type RecipeCard } from "../data/reading.ts";
import { kitchenDressingFrom, type KitchenDressing } from "./dressing.ts";

/**
 * The Kitchen (LITTLE_HARBOUR_v2 §4) — making a plan you can understand.
 *
 * "I don't understand a thing I'm looking at" is the right complaint, and the
 * fix is a smaller object, not a better screen. **A plan is a recipe card**:
 * five lines, always the same five — what, how much, by when, from which pot,
 * who. You sit at the table; Hercules is across from you; the empty card with
 * its five ruled lines waits between you, and sitting down is a door onto the
 * Plan Studio's guided sit-down. The wall of the kitchen is the cookbook —
 * every line of the month's standing plan, as a card, each with a wax seal in
 * its pot's own colour. A proposed plan sits on the table with the second
 * chair pulled out until the other of you sits; "not now" puts it in the
 * drawer, never the bin — and the drawer with the seven tools is still there
 * for whoever wants it.
 *
 * Nothing here proposes, accepts, edits or posts a plan. Every card, the
 * empty card, the drawer and the folio are doors (`onOpen`); the paper stays
 * the paper.
 */

export const KITCHEN_LAYOUT = {
  halfWidth: 4.0,
  halfDepth: 3.0,
  wallHeight: 2.7,
  /** The table in the middle of the room, and its top's height. */
  table: { x: 0, z: -0.3, width: 2.7, depth: 1.25, top: 0.92 },
  /** Your chair (+z, toward the eye) and Hercules' across (−z). */
  chairNear: [0.35, 0, 0.85] as const,
  chairFar: [-0.25, 0, -1.45] as const,
  /** The cookbook wall: cards pin on the back wall, left of the window. */
  cardWall: { z: -2.86, x0: -3.25, stepX: 1.05, y0: 2.25, stepY: 0.52 },
  cardCols: 3,
  /** The hearth on the left wall, the window on the back wall. */
  hearth: [-3.6, 0, -0.9] as const,
  window: [0.9, 1.5, -2.95] as const,
  /** The door back to the Court, behind the eye. */
  door: [1.6, 0, 2.85] as const,
} as const;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Whole dollars for a card's words: 124000 → "$1,240". Never a bare unexplained zero. */
export function cardDollars(cents: number): string {
  const dollars = Math.round(Math.abs(cents) / 100);
  return `${cents < 0 && dollars > 0 ? "-" : ""}$${String(dollars).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
const shortDate = (date: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return date;
  const month = MONTHS[Number(match[2]) - 1];
  return month ? `${month} ${Number(match[3])}` : date;
};

const POT_WORDS = { everyday: "Everyday", prepare: "Prepare", protect: "Protect", build: "Build" } as const;
const WHO_WORDS = { both: "both of you", mine: "yours", partner: "the partner's" } as const;

/** One card's words, in the card's own order: what — how much · by when · pot · who. */
export function cardWords(card: RecipeCard): string {
  const parts = [cardDollars(card.amountCents)];
  if (card.when) parts.push(`by ${shortDate(card.when)}`);
  parts.push(POT_WORDS[card.pot] ?? card.pot);
  if (card.who) parts.push(WHO_WORDS[card.who]);
  return `${card.what} — ${parts.join(" · ")}`;
}

/** Where the `index`th card pins on the cookbook wall: a grid, top row first. */
export function cardPin(index: number): { x: number; y: number } {
  const col = index % KITCHEN_LAYOUT.cardCols;
  const row = Math.floor(index / KITCHEN_LAYOUT.cardCols);
  return {
    x: KITCHEN_LAYOUT.cardWall.x0 + col * KITCHEN_LAYOUT.cardWall.stepX,
    y: KITCHEN_LAYOUT.cardWall.y0 - KITCHEN_LAYOUT.cardWall.stepY * Math.min(row, 3),
  };
}

// Stand in the doorway corner: the table in front, the hearth on the left
// wall, the window beyond — the whole cottage in one look.
const PHONE_ROOM: Pose = { target: [-0.8, 0.95, -0.6], r: 4.44, theta: 0.775, phi: 1.332 };
const DESKTOP_ROOM: Pose = { target: [-0.4, 0.95, -0.5], r: 4.28, theta: 0.802, phi: 1.347 };

export function kitchenPoses(anchors: readonly Anchor[]): Record<string, Pose> {
  const poses: Record<string, Pose> = {
    "kitchen:phone": PHONE_ROOM,
    "kitchen:desktop": DESKTOP_ROOM,
    "sky:phone": { target: [0, 1.1, -0.4], r: 6.6, theta: 0, phi: 1.05 },
    "sky:desktop": { target: [0, 1.15, -0.4], r: 7.2, theta: 0.22, phi: 1.02 },
    // The door frieze: the table with the empty card, for the band above an open tool.
    "door:phone": { target: [0, 0.95, -0.3], r: 2.0, theta: 0.03, phi: 1.3 },
    "door:desktop": { target: [0.1, 0.95, -0.3], r: 2.2, theta: 0.06, phi: 1.3 },
  };
  for (const anchor of anchors) {
    const [x, y, z] = anchor.position;
    const theta = clamp(Math.atan2(x, z + 5) * 0.6, -0.65, 0.65);
    const close = anchor.zone === "card" ? 1.5 : anchor.zone === "stair" ? 2.5 : 2.0;
    poses[`object:${anchor.id}:phone`] = { target: [x, Math.max(0.6, y), z], r: close, theta, phi: 1.2 };
    poses[`object:${anchor.id}:desktop`] = { target: [x, Math.max(0.6, y), z], r: close + 0.4, theta: theta + 0.16, phi: 1.14 };
  }
  return poses;
}

export type KitchenSceneReading = { kitchen: KitchenReading | null; partnerName: string | null };

/** Narrows whatever the shell hands over to the kitchen's own rows. */
export function readKitchenReading(value: unknown): KitchenSceneReading {
  if (!value || typeof value !== "object") return { kitchen: null, partnerName: null };
  const source = value as { kitchen?: KitchenReading; partner?: { name?: string } | null };
  return { kitchen: source.kitchen ?? null, partnerName: source.partner?.name ?? null };
}

export type KitchenOptions = {
  dressing: KitchenDressing;
  reading?: unknown;
  quality: RenderTier;
  composition?: Composition;
  onAnimate?: () => void;
};

export function createKitchen(scene: THREE.Scene, options: KitchenOptions): PlaceHandle {
  const { dressing } = options;
  const full = options.quality === "full";

  const group = new THREE.Group();
  group.name = "kitchen";
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
  const { halfWidth, halfDepth, wallHeight } = KITCHEN_LAYOUT;

  // ── The room: boarded floor, plastered walls with a timber frame ──────────
  const floor = shadowed(new THREE.Mesh(track(new THREE.PlaneGeometry(halfWidth * 2, halfDepth * 2)), mat(dressing.floor, { roughness: 0.96 })), false, true);
  floor.rotation.x = -Math.PI / 2; floor.name = "kitchen-floor"; group.add(floor);
  const boardGeometry = track(new THREE.PlaneGeometry(halfWidth * 2, 0.02));
  const boards = new THREE.InstancedMesh(boardGeometry, mat(dressing.floorAlt, { roughness: 1 }), 9);
  boards.rotation.x = -Math.PI / 2; boards.position.y = 0.004; boards.name = "kitchen-board-joints";
  {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 9; i++) {
      matrix.makeTranslation(0, -halfDepth + ((i + 0.5) / 9) * halfDepth * 2, 0);
      boards.setMatrixAt(i, matrix);
    }
    boards.instanceMatrix.needsUpdate = true;
  }
  group.add(boards);

  const walls = merged([
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.24), 0, wallHeight / 2, -halfDepth),
    placed(new THREE.BoxGeometry(halfWidth * 2, wallHeight, 0.24), 0, wallHeight / 2, halfDepth),
    placed(new THREE.BoxGeometry(0.24, wallHeight, halfDepth * 2), -halfWidth, wallHeight / 2, 0),
    placed(new THREE.BoxGeometry(0.24, wallHeight, halfDepth * 2), halfWidth, wallHeight / 2, 0),
  ], mat(dressing.plaster, { roughness: 0.96 }));
  shadowed(walls, false, true); walls.name = "kitchen-walls"; group.add(walls);
  const frame = merged([
    // Corner posts and a head beam on each wall face the room.
    placed(new THREE.BoxGeometry(0.14, wallHeight, 0.14), -halfWidth + 0.16, wallHeight / 2, -halfDepth + 0.16),
    placed(new THREE.BoxGeometry(0.14, wallHeight, 0.14), halfWidth - 0.16, wallHeight / 2, -halfDepth + 0.16),
    placed(new THREE.BoxGeometry(0.14, wallHeight, 0.14), -halfWidth + 0.16, wallHeight / 2, halfDepth - 0.16),
    placed(new THREE.BoxGeometry(0.14, wallHeight, 0.14), halfWidth - 0.16, wallHeight / 2, halfDepth - 0.16),
    placed(new THREE.BoxGeometry(halfWidth * 2 - 0.2, 0.14, 0.1), 0, wallHeight - 0.1, -halfDepth + 0.18),
    placed(new THREE.BoxGeometry(0.1, 0.14, halfDepth * 2 - 0.2), halfWidth - 0.18, wallHeight - 0.1, 0),
  ], mat(dressing.frame, { roughness: 0.85 }));
  frame.name = "kitchen-frame"; group.add(frame);
  // The ceiling: joists overhead, lit by the fire's bounce.
  const joistGeometry = track(new THREE.BoxGeometry(halfWidth * 2, 0.12, 0.12));
  const joists = new THREE.InstancedMesh(joistGeometry, mat(dressing.frame, { roughness: 0.85 }), 5);
  joists.name = "kitchen-joists";
  {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 5; i++) {
      matrix.makeTranslation(0, wallHeight + 0.05, -halfDepth + 0.6 + i * ((halfDepth * 2 - 1.2) / 4));
      joists.setMatrixAt(i, matrix);
    }
    joists.instanceMatrix.needsUpdate = true;
  }
  group.add(joists);

  // ── The window in the back wall, day through it ───────────────────────────
  const [wx, wy, wz] = KITCHEN_LAYOUT.window;
  const windowFrame = merged([
    placed(new THREE.BoxGeometry(1.1, 0.09, 0.1), wx, wy + 0.62, wz + 0.14),
    placed(new THREE.BoxGeometry(1.1, 0.09, 0.1), wx, wy - 0.62, wz + 0.14),
    placed(new THREE.BoxGeometry(0.09, 1.32, 0.1), wx - 0.5, wy, wz + 0.14),
    placed(new THREE.BoxGeometry(0.09, 1.32, 0.1), wx + 0.5, wy, wz + 0.14),
    placed(new THREE.BoxGeometry(0.05, 1.2, 0.08), wx, wy, wz + 0.14),
  ], mat(dressing.window, { roughness: 0.7 }));
  windowFrame.name = "kitchen-window"; group.add(windowFrame);
  const day = new THREE.Mesh(track(new THREE.PlaneGeometry(0.95, 1.2)), track(new THREE.MeshBasicMaterial({ color: dressing.day })));
  day.position.set(wx, wy, wz + 0.13); day.name = "kitchen-day"; group.add(day);

  // ── The hearth on the left wall: stone, the stove, the kettle, a warm fire ─
  const [hx, , hz] = KITCHEN_LAYOUT.hearth;
  const hearth = merged([
    placed(new THREE.BoxGeometry(0.6, 1.7, 1.9), hx, 0.85, hz),
    placed(new THREE.BoxGeometry(0.75, 0.14, 2.1), hx + 0.05, 1.78, hz),
  ], mat(dressing.hearthStone, { roughness: 0.95 }));
  shadowed(hearth, full, true); hearth.name = "kitchen-hearth"; hearth.userData.anchor = "hearth"; group.add(hearth);
  const stove = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.5, 0.62, 1.0)), mat(dressing.stove, { roughness: 0.6, metalness: 0.2 })));
  stove.position.set(hx + 0.28, 0.31, hz); stove.userData.anchor = "hearth"; group.add(stove);
  const fireGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(0.42, 0.3)), track(new THREE.MeshBasicMaterial({ color: dressing.fire })));
  fireGlow.position.set(hx + 0.54, 0.3, hz); fireGlow.rotation.y = Math.PI / 2; fireGlow.name = "kitchen-fire"; group.add(fireGlow);
  const kettle = merged([
    placed(new THREE.SphereGeometry(0.13, 10, 8), hx + 0.3, 0.72, hz - 0.25),
    placed(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 6), hx + 0.3, 0.85, hz - 0.25),
  ], mat(dressing.kettle, { roughness: 0.4, metalness: 0.5 }));
  kettle.name = "kitchen-kettle"; group.add(kettle);
  const fire = new THREE.PointLight(new THREE.Color(dressing.light.fire), dressing.light.fireIntensity, 6, 2);
  fire.position.set(hx + 0.6, 0.6, hz); group.add(fire);
  const hemi = new THREE.HemisphereLight(new THREE.Color(dressing.light.hemiSky), new THREE.Color(dressing.light.hemiGround), 0.5);
  group.add(hemi);

  // ── The table, the drawer, the two chairs ────────────────────────────────
  const { table } = KITCHEN_LAYOUT;
  const tableTop = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(table.width, 0.09, table.depth)), mat(dressing.table, { roughness: 0.8 })));
  tableTop.position.set(table.x, table.top - 0.045, table.z); tableTop.name = "kitchen-table"; group.add(tableTop);
  const legs = merged([
    placed(new THREE.BoxGeometry(0.11, table.top - 0.09, 0.11), table.x - table.width / 2 + 0.18, (table.top - 0.09) / 2, table.z - table.depth / 2 + 0.18),
    placed(new THREE.BoxGeometry(0.11, table.top - 0.09, 0.11), table.x + table.width / 2 - 0.18, (table.top - 0.09) / 2, table.z - table.depth / 2 + 0.18),
    placed(new THREE.BoxGeometry(0.11, table.top - 0.09, 0.11), table.x - table.width / 2 + 0.18, (table.top - 0.09) / 2, table.z + table.depth / 2 - 0.18),
    placed(new THREE.BoxGeometry(0.11, table.top - 0.09, 0.11), table.x + table.width / 2 - 0.18, (table.top - 0.09) / 2, table.z + table.depth / 2 - 0.18),
  ], mat(dressing.tableLeg, { roughness: 0.85 }));
  shadowed(legs, false, true); legs.name = "kitchen-table-legs"; group.add(legs);
  contacts.disc(table.x, table.z, table.width * 0.42, 0.55, group);
  // The drawer with the seven tools: a front, a brass pull, and a door onto the studio.
  const drawer = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.72, 0.16, 0.05)), mat(dressing.drawer, { roughness: 0.8 })), false, true);
  drawer.position.set(table.x + 0.6, table.top - 0.18, table.z + table.depth / 2 + 0.02);
  drawer.name = "kitchen-drawer"; drawer.userData.anchor = "drawer"; group.add(drawer);
  const pull = new THREE.Mesh(track(new THREE.SphereGeometry(0.03, 8, 6)), mat(dressing.brass, { roughness: 0.4, metalness: 0.5 }));
  pull.position.set(table.x + 0.6, table.top - 0.18, table.z + table.depth / 2 + 0.06); pull.userData.anchor = "drawer"; group.add(pull);

  const buildChair = (position: readonly [number, number, number], turned: number): THREE.Mesh => {
    const [cx, , cz] = position;
    const chair = merged([
      placed(new THREE.BoxGeometry(0.5, 0.06, 0.5), 0, 0.48, 0),
      placed(new THREE.BoxGeometry(0.06, 0.46, 0.06), -0.2, 0.24, -0.2), placed(new THREE.BoxGeometry(0.06, 0.46, 0.06), 0.2, 0.24, -0.2),
      placed(new THREE.BoxGeometry(0.06, 0.46, 0.06), -0.2, 0.24, 0.2), placed(new THREE.BoxGeometry(0.06, 0.46, 0.06), 0.2, 0.24, 0.2),
      placed(new THREE.BoxGeometry(0.5, 0.52, 0.05), 0, 0.85, -0.23),
    ], mat(dressing.chair, { roughness: 0.85 }));
    shadowed(chair, false, true);
    chair.position.set(cx, 0, cz); chair.rotation.y = turned;
    group.add(chair);
    contacts.disc(cx, cz, 0.34, 0.5, group);
    return chair;
  };
  buildChair(KITCHEN_LAYOUT.chairNear, Math.PI);
  const farChair = buildChair(KITCHEN_LAYOUT.chairFar, 0.12);
  farChair.userData.anchor = "hercules-chair";

  // ── Hercules, seated across from you ─────────────────────────────────────
  const hercules = new THREE.Group();
  hercules.name = "kitchen-hercules";
  hercules.userData.anchor = "hercules-chair";
  {
    const body = shadowed(new THREE.Mesh(track(new THREE.SphereGeometry(0.21, 12, 10)), mat(dressing.cat, { roughness: 0.9 })));
    body.scale.set(1, 1.25, 0.9); body.position.y = 0.76; hercules.add(body);
    const head = new THREE.Mesh(track(new THREE.SphereGeometry(0.13, 12, 10)), mat(dressing.cat, { roughness: 0.9 }));
    head.position.y = 1.06; hercules.add(head);
    for (const side of [-1, 1] as const) {
      const ear = new THREE.Mesh(track(new THREE.ConeGeometry(0.045, 0.09, 5)), mat(dressing.catEar, { roughness: 0.9 }));
      ear.position.set(side * 0.07, 1.18, 0); hercules.add(ear);
    }
    const tail = new THREE.Mesh(track(new THREE.TorusGeometry(0.14, 0.028, 6, 12, Math.PI * 0.8)), mat(dressing.catEar, { roughness: 0.9 }));
    tail.position.set(0.18, 0.62, -0.05); tail.rotation.z = 0.7; hercules.add(tail);
    hercules.position.set(KITCHEN_LAYOUT.chairFar[0], 0.02, KITCHEN_LAYOUT.chairFar[2]);
    hercules.traverse((node) => { node.userData.anchor = "hercules-chair"; });
    group.add(hercules);
  }

  // ── The empty card on the table: five ruled lines, waiting ────────────────
  const emptyCard = new THREE.Group();
  emptyCard.name = "kitchen-empty-card";
  emptyCard.userData.anchor = "empty-card";
  {
    const paper = new THREE.Mesh(track(new THREE.BoxGeometry(0.62, 0.012, 0.42)), mat(dressing.card, { roughness: 0.85 }));
    emptyCard.add(paper);
    const ruleGeometry = track(new THREE.BoxGeometry(0.5, 0.004, 0.018));
    const rules = new THREE.InstancedMesh(ruleGeometry, mat(dressing.cardRule, { roughness: 1 }), 5);
    const matrix = new THREE.Matrix4();
    for (let line = 0; line < 5; line++) {
      matrix.makeTranslation(0, 0.009, -0.13 + line * 0.065);
      rules.setMatrixAt(line, matrix);
    }
    rules.instanceMatrix.needsUpdate = true;
    emptyCard.add(rules);
    emptyCard.position.set(table.x - 0.15, table.top + 0.01, table.z + 0.08);
    emptyCard.rotation.y = 0.12;
    emptyCard.traverse((node) => { node.userData.anchor = "empty-card"; });
    group.add(emptyCard);
  }
  // The folio on the table's corner: One Conversation.
  const folio = shadowed(new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.05, 0.3)), mat(dressing.folio, { roughness: 0.7 })), false, true);
  folio.position.set(table.x - 1.0, table.top + 0.025, table.z - 0.35); folio.rotation.y = -0.2;
  folio.name = "kitchen-folio"; folio.userData.anchor = "folio"; group.add(folio);

  // The waiting card, propped by the far chair while the other of you has not sat.
  const waitingCard = new THREE.Mesh(track(new THREE.BoxGeometry(0.4, 0.28, 0.012)), mat(dressing.card, { roughness: 0.85 }));
  waitingCard.position.set(table.x + 0.55, table.top + 0.15, table.z - 0.4);
  waitingCard.rotation.set(-0.4, -0.3, 0);
  waitingCard.name = "kitchen-waiting-card"; waitingCard.userData.anchor = "waiting-card"; waitingCard.visible = false;
  group.add(waitingCard);

  // ── The door back to the Court ────────────────────────────────────────────
  const [dx, , dz] = KITCHEN_LAYOUT.door;
  const doorFrame = merged([
    placed(new THREE.BoxGeometry(0.14, 2.0, 0.14), dx - 0.5, 1.0, dz),
    placed(new THREE.BoxGeometry(0.14, 2.0, 0.14), dx + 0.5, 1.0, dz),
    placed(new THREE.BoxGeometry(1.14, 0.14, 0.14), dx, 2.02, dz),
  ], mat(dressing.frame, { roughness: 0.85 }));
  doorFrame.name = "kitchen-door"; doorFrame.userData.anchor = "court-door"; group.add(doorFrame);

  // ── The cookbook wall: plates rebuilt from the reading ────────────────────
  const finishNow = (): PlateFinish => plateFinish("current");
  type WallCard = { card: RecipeCard; plate: EngravedPlate; seal: THREE.Mesh; dispose(): void };
  let wall: WallCard[] = [];
  let view: KitchenReading = EMPTY_KITCHEN_READING;
  let partnerName: string | null = null;

  const tablePlate = track(new EngravedPlate({ stone: dressing.card, highlight: dressing.plateHighlight, ink: dressing.ink, paper: true, size: "small" }, 1.15, 0.2));
  tablePlate.mesh.position.set(table.x - 0.15, table.top + 0.02, table.z + 0.45);
  tablePlate.mesh.rotation.x = -Math.PI / 2.15;
  // Spun on the tabletop so the words read from the doorway corner the room pose stands in.
  tablePlate.mesh.rotation.z = 0.8;
  tablePlate.mesh.userData.anchor = "empty-card";
  group.add(tablePlate.mesh);

  const sealColour = (pot: RecipeCard["pot"]): string =>
    pot === "everyday" ? dressing.sealEveryday : pot === "prepare" ? dressing.sealPrepare : pot === "protect" ? dressing.sealProtect : dressing.sealBuild;

  const clearWall = (): void => { for (const row of wall) row.dispose(); wall = []; };

  const layOutWall = (): void => {
    clearWall();
    view.cards.forEach((card, index) => {
      const pin = cardPin(index);
      const plate = new EngravedPlate({ stone: dressing.card, highlight: dressing.plateHighlight, ink: dressing.ink, paper: true, size: "small" }, 0.92, 0.3);
      plate.set(cardWords(card), finishNow());
      plate.mesh.position.set(pin.x, pin.y, KITCHEN_LAYOUT.cardWall.z);
      plate.mesh.userData.anchor = `card:${card.key}`;
      group.add(plate.mesh);
      const seal = new THREE.Mesh(track(new THREE.CylinderGeometry(0.035, 0.035, 0.012, 10)), mat(sealColour(card.pot), { roughness: 0.6 }));
      seal.rotation.x = Math.PI / 2;
      seal.position.set(pin.x - 0.36, pin.y + 0.11, KITCHEN_LAYOUT.cardWall.z + 0.01);
      seal.userData.anchor = `card:${card.key}`;
      group.add(seal);
      wall.push({ card, plate, seal, dispose() { plate.mesh.removeFromParent(); plate.dispose(); seal.removeFromParent(); } });
    });
    waitingCard.visible = view.waiting && view.cards.length > 0;
    const month = view.monthKey ?? "";
    tablePlate.set(
      view.cards.length === 0
        ? "The empty card — sit down: five questions, one card"
        : view.waiting
          ? `${month} — on the table until ${partnerName ?? "the other of you"} sits`
          : `${month} — ${view.cards.length} ${view.cards.length === 1 ? "card" : "cards"} on the wall`,
      finishNow(),
    );
  };

  const signatureOf = (reading: KitchenReading, partner: string | null): string =>
    [reading.monthKey, reading.state, reading.waiting, reading.overflow, partner, reading.cards.map((card) => `${card.key}:${card.what}:${card.amountCents}:${card.when}:${card.pot}:${card.who}`).join("|")].join("§");
  let signature = "";

  function update(value: unknown): void {
    const next = readKitchenReading(value);
    const reading = next.kitchen ?? EMPTY_KITCHEN_READING;
    const nextSignature = signatureOf(reading, next.partnerName);
    if (nextSignature === signature) return;
    view = reading; partnerName = next.partnerName; signature = nextSignature;
    layOutWall();
  }
  update(options.reading ?? null);

  scene.add(group);

  const at = (x: number, y: number, z: number): Vec3 => [x, y, z];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) =>
    new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));

  const anchorList = (): Anchor[] => {
    const rows: Anchor[] = wall.map(({ card, plate }) => ({
      id: `card:${card.key}`,
      position: at(plate.mesh.position.x, plate.mesh.position.y, plate.mesh.position.z),
      zone: "card",
      label: `${cardWords(card)}. Turn it over in the Plan Studio.`,
      door: { target: "plan-studio", object: card.key },
    }));
    rows.push({
      id: "empty-card", position: at(emptyCard.position.x, KITCHEN_LAYOUT.table.top + 0.1, emptyCard.position.z), zone: "card",
      label: view.cards.length === 0
        ? "The empty recipe card — sit down and make a plan: five questions, one card. Open the kitchen table."
        : "A fresh card — sit down: five questions, one card. Open the kitchen table.",
      door: { target: "plan-studio" },
    });
    if (waitingCard.visible) rows.push({
      id: "waiting-card", position: at(waitingCard.position.x, waitingCard.position.y, waitingCard.position.z), zone: "card",
      label: `The card on the table — waiting until ${partnerName ?? "the other of you"} sits. Not now is a valid answer. Pull out the Plan Studio.`,
      door: { target: "plan-studio" },
    });
    rows.push({ id: "drawer", position: at(drawer.position.x, drawer.position.y, drawer.position.z + 0.1), zone: "prop", label: "The drawer — the seven tools, for whoever wants them. Pull out the Plan Studio.", door: { target: "plan-studio" } });
    rows.push({ id: "folio", position: at(folio.position.x, table.top + 0.1, folio.position.z), zone: "prop", label: "The folio — one intention, a private note, room to think. Open the conversation folio.", door: { target: "conversation" } });
    rows.push({ id: "hercules-chair", position: at(hercules.position.x, 1.0, hercules.position.z), zone: "prop", label: "Hercules, across the table. He asks one question at a time. Pull out the Plan Studio.", door: { target: "plan-studio" } });
    rows.push({ id: "atlas", position: at(-2.6, 1.1, 2.4), zone: "landmark", label: "The atlas up the stair — step into Journey." });
    rows.push({ id: "court-door", position: at(dx, 1.0, dz - 0.15), zone: "stair", label: "The kitchen door — back to the Court." });
    return rows;
  };

  const regionList = (): Region[] => {
    const rows: Region[] = wall.map(({ card, plate }) => ({
      id: `card:${card.key}`, group: "kitchen", label: cardWords(card),
      box: box(plate.mesh.position.x - 0.5, plate.mesh.position.y - 0.2, KITCHEN_LAYOUT.cardWall.z - 0.14, plate.mesh.position.x + 0.5, plate.mesh.position.y + 0.2, KITCHEN_LAYOUT.cardWall.z + 0.3),
    }));
    rows.push({ id: "empty-card", group: "kitchen", label: "The empty recipe card", box: box(table.x - 0.5, table.top - 0.05, table.z - 0.2, table.x + 0.2, table.top + 0.2, table.z + 0.6) });
    rows.push({ id: "drawer", group: "kitchen", label: "The drawer", box: box(table.x + 0.2, table.top - 0.3, table.z + table.depth / 2 - 0.1, table.x + 1.0, table.top - 0.05, table.z + table.depth / 2 + 0.2) });
    rows.push({ id: "folio", group: "kitchen", label: "The conversation folio", box: box(table.x - 1.25, table.top - 0.05, table.z - 0.55, table.x - 0.75, table.top + 0.2, table.z - 0.15) });
    rows.push({ id: "hercules-chair", group: "kitchen", label: "Hercules, across the table", box: box(KITCHEN_LAYOUT.chairFar[0] - 0.4, 0, KITCHEN_LAYOUT.chairFar[2] - 0.4, KITCHEN_LAYOUT.chairFar[0] + 0.4, 1.35, KITCHEN_LAYOUT.chairFar[2] + 0.4) });
    if (waitingCard.visible) rows.push({ id: "waiting-card", group: "kitchen", label: "The card waiting on the table", box: box(waitingCard.position.x - 0.3, waitingCard.position.y - 0.2, waitingCard.position.z - 0.2, waitingCard.position.x + 0.3, waitingCard.position.y + 0.2, waitingCard.position.z + 0.2) });
    rows.push({ id: "court-door", group: "kitchen", label: "The kitchen door — back to the Court", box: box(dx - 0.7, 0, dz - 0.3, dx + 0.7, 2.1, dz + 0.2) });
    return rows;
  };

  return {
    group,
    update,
    animate: () => false,
    dispose() {
      scene.remove(group);
      clearWall();
      for (const item of disposables) item.dispose();
    },
    anchors: anchorList,
    poses: () => kitchenPoses(anchorList()),
    regions: regionList,
  };
}

export const kitchenPlace: Place = registerPlace({
  id: "kitchen",
  build(scene, dressing, reading, quality, context) {
    return createKitchen(scene, {
      dressing: kitchenDressingFrom(typeof dressing === "object" && dressing ? dressing.theme : dressing),
      reading,
      quality,
      ...(context?.composition ? { composition: context.composition } : {}),
      ...(context?.invalidate ? { onAnimate: context.invalidate } : {}),
    });
  },
});
