import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Anchor, PlaceDressing, Region } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";

/** Authored, self-contained shells for the harbour village.  They deliberately
 * own no routes or state: callers stand these at the harbour placements. */
export type VillageBuildingKind = "home" | "bank" | "library" | "glasshouse" | "studio" | "cottage" | "boathouse";
export type VillageArt = {
  group: THREE.Group;
  anchors: () => Anchor[];
  regions: () => Region[];
  animate: (t: number, dt: number) => boolean;
  dispose: () => void;
};
export type VillageBuilding = {
  group: THREE.Group;
  /** The removable pitched roof, held apart for the village camera cutaway. */
  roof: THREE.Group;
  /** Front porch/wall pieces the camera may hide while leaving the rooms intact. */
  front: THREE.Group;
  animate: (t: number, dt: number) => boolean;
  dispose: () => void;
};

export const VILLAGE_FOOTPRINTS: Readonly<Record<VillageBuildingKind, readonly [number, number]>> = Object.freeze({
  home: [4.5, 3.5], bank: [4.6, 3.6], library: [4.4, 3.4], glasshouse: [4, 3], studio: [3.8, 2.9], cottage: [3.2, 2.6], boathouse: [3.6, 3],
});

type Palette = { stone: string; timber: string; trim: string; plaster: string; roof: string; roofAlt: string; glass: string; brass: string; brick: string; warm: string };
function palette(d: PlaceDressing): Palette {
  if (d.theme === "newfoundland") return { stone: "#71807b", timber: "#416967", trim: "#d2c49a", plaster: "#d7ded3", roof: "#315a5b", roofAlt: "#4a7772", glass: "#9ec7c1", brass: "#bf9c58", brick: "#9a6650", warm: "#f5c56e" };
  if (d.theme === "taylor") return { stone: "#82796c", timber: "#564d46", trim: "#d5c8b5", plaster: "#e4dac9", roof: "#55464a", roofAlt: "#80666b", glass: "#bfd0c8", brass: "#b89662", brick: "#a66e5a", warm: "#f2c991" };
  return { stone: d.stone, timber: "#674735", trim: "#c7a969", plaster: "#e2cfaa", roof: "#4d664b", roofAlt: "#78845c", glass: "#bad0b7", brass: "#b58b45", brick: "#9c6049", warm: "#f6cd82" };
}

class Kit {
  readonly group = new THREE.Group();
  private readonly owned = new Set<{ dispose(): void }>();
  private readonly materials = new Map<string, THREE.Material>();
  private readonly batches = new Map<string, { parent: THREE.Object3D; material: THREE.Material; parts: THREE.BufferGeometry[] }>();
  private dead = false;
  constructor(readonly quality: RenderTier) {}
  material(colour: string, opt: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.Material {
    const key = `${colour}/${JSON.stringify(opt)}`;
    const existing = this.materials.get(key); if (existing) return existing;
    const material = new THREE.MeshStandardMaterial({ color: colour, roughness: .8, ...opt });
    this.materials.set(key, material); this.owned.add(material); return material;
  }
  mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, colour: string, at: readonly [number, number, number], name: string, rotation: readonly [number, number, number] = [0, 0, 0], opt: Partial<THREE.MeshStandardMaterialParameters> = {}): THREE.Object3D {
    // Keep semantic names for tests, accessibility tooling and cutaway inspection;
    // their triangles join a single material batch below rather than each becoming a draw.
    const marker = new THREE.Object3D(); marker.name = name; marker.userData.staticArchitecture = true; marker.position.set(...at); marker.rotation.set(...rotation); parent.add(marker);
    const material = this.material(colour, opt), key = `${parent.uuid}/${material.uuid}`;
    let batch = this.batches.get(key); if (!batch) { batch = { parent, material, parts: [] }; this.batches.set(key, batch); }
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    const rotation3 = new THREE.Euler(rotation[0], rotation[1], rotation[2]);
    source.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(rotation3), new THREE.Vector3(1, 1, 1)));
    batch.parts.push(source); return marker;
  }
  box(parent: THREE.Object3D, s: readonly [number, number, number], at: readonly [number, number, number], colour: string, name: string, rot?: readonly [number, number, number]) { return this.mesh(parent, new THREE.BoxGeometry(...s), colour, at, name, rot); }
  cyl(parent: THREE.Object3D, r: number, h: number, at: readonly [number, number, number], colour: string, name: string, rot?: readonly [number, number, number]) { return this.mesh(parent, new THREE.CylinderGeometry(r, r, h, this.quality === "full" ? 12 : 8), colour, at, name, rot); }
  sphere(parent: THREE.Object3D, r: number, at: readonly [number, number, number], colour: string, name: string) { return this.mesh(parent, new THREE.SphereGeometry(r, this.quality === "full" ? 12 : 8, 8), colour, at, name); }
  finish() {
    for (const batch of this.batches.values()) {
      const merged = mergeGeometries(batch.parts, false);
      for (const part of batch.parts) part.dispose();
      if (!merged) continue;
      this.owned.add(merged);
      const mesh = new THREE.Mesh(merged, batch.material); mesh.name = "village-static-batch";
      mesh.castShadow = this.quality === "full"; mesh.receiveShadow = true; mesh.userData.staticArchitecture = true; batch.parent.add(mesh);
    }
    this.batches.clear();
  }
  dispose() { if (this.dead) return; this.dead = true; this.group.removeFromParent(); for (const batch of this.batches.values()) for (const part of batch.parts) part.dispose(); this.batches.clear(); for (const item of this.owned) item.dispose(); this.owned.clear(); this.materials.clear(); this.group.clear(); }
}

function gable(kit: Kit, parent: THREE.Group, halfX: number, halfZ: number, y: number, p: Palette, name: string, ridge = .95) {
  const shape = new THREE.Shape(); shape.moveTo(-halfX - .12, 0); shape.lineTo(halfX + .12, 0); shape.lineTo(0, ridge); shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: halfZ * 2 + .26, bevelEnabled: false }); geo.translate(0, y, -halfZ - .13);
  kit.mesh(parent, geo, p.roof, [0, 0, 0], `${name}-pitched-roof`);
  // layered shingle ribs give an actual pitch rather than a flat cap.
  const slope = Math.atan2(ridge, halfX + .12);
  for (const side of [-1, 1] as const) for (let i = 0; i < 6; i++) {
    const x = side * (halfX * .12 + i * halfX * .15);
    // Every rib sits on the actual gable plane: lower as it travels from ridge to eave.
    const yy = y + ridge * (1 - Math.abs(x) / (halfX + .12)) + .035;
    kit.box(parent, [halfX * .29, .07, halfZ * 2 + .34], [x, yy, 0], i % 2 ? p.roofAlt : p.roof, `${name}-shingle-${side}-${i}`, [0, 0, -side * slope]);
  }
}

function windowBay(kit: Kit, parent: THREE.Object3D, x: number, y: number, z: number, p: Palette, name: string, wide = 1.05) {
  kit.box(parent, [wide, 1.28, .08], [x, y, z], p.glass, `${name}-warm-window`);
  kit.box(parent, [wide + .16, .1, .13], [x, y + .69, z + .01], p.trim, `${name}-window-lintel`);
  kit.box(parent, [.1, 1.43, .13], [x - wide / 2, y, z + .01], p.trim, `${name}-window-left`);
  kit.box(parent, [.1, 1.43, .13], [x + wide / 2, y, z + .01], p.trim, `${name}-window-right`);
  kit.box(parent, [.055, 1.18, .13], [x, y, z + .025], p.trim, `${name}-mullion`);
  kit.box(parent, [wide * .84, .055, .13], [x, y, z + .025], p.trim, `${name}-transom`);
  kit.box(parent, [wide + .28, .11, .42], [x, y - .78, z + .16], p.timber, `${name}-window-sill`);
}

function doorFrame(kit: Kit, parent: THREE.Object3D, at: readonly [number, number, number], p: Palette, name: string, width = 1.18, height = 2.1, colour = p.timber) {
  const [x, y, z] = at;
  // The wall is intentionally split around this 1.18m void by every caller.
  kit.box(parent, [.14, height + .18, .18], [x - width / 2, y + height / 2, z], p.trim, `${name}-jamb-left`);
  kit.box(parent, [.14, height + .18, .18], [x + width / 2, y + height / 2, z], p.trim, `${name}-jamb-right`);
  kit.box(parent, [width + .28, .16, .2], [x, y + height + .02, z], p.trim, `${name}-lintel`);
  kit.box(parent, [width - .14, height - .16, .09], [x, y + (height - .16) / 2, z - .03], colour, `${name}-door`);
  kit.cyl(parent, .065, .05, [x + width * .28, y + height * .48, z + .04], p.brass, `${name}-brass-handle`, [Math.PI / 2, 0, 0]);
}

function wallWithDoor(kit: Kit, parent: THREE.Object3D, halfX: number, halfZ: number, wallY: number, wallH: number, p: Palette, name: string, doorW = 1.18, doorX = 0) {
  const left = doorX - doorW / 2 + halfX, right = halfX - (doorX + doorW / 2);
  kit.box(parent, [left, wallH, .22], [-halfX + left / 2, wallY, halfZ], p.plaster, `${name}-front-wall-left`);
  kit.box(parent, [right, wallH, .22], [halfX - right / 2, wallY, halfZ], p.plaster, `${name}-front-wall-right`);
  kit.box(parent, [halfX * 2, wallH - 2.1, .22], [0, wallY + (wallH + 2.1) / 2, halfZ], p.plaster, `${name}-front-wall-over-door`);
  doorFrame(kit, parent, [doorX, wallY - wallH / 2, halfZ + .03], p, name, doorW);
}

function foundation(kit: Kit, parent: THREE.Object3D, hx: number, hz: number, p: Palette, name: string) {
  // A thin plinth is safe under an inherited room floor; it never fills the walk volume.
  kit.box(parent, [hx * 2 + .28, .04, hz * 2 + .28], [0, 0, 0], p.stone, `${name}-stone-foundation`);
  for (let i = 0; i < 9; i++) kit.box(parent, [hx * 2 / 9 - .035, .045, .025], [-hx + (i + .5) * hx * 2 / 9, .035, hz + .16], i % 2 ? p.stone : p.trim, `${name}-front-course-${i}`);
}

/** Three walls, deliberately no floor, ceiling, or facade: active rooms stay truly open. */
function shellSidesBack(kit: Kit, parent: THREE.Object3D, hx: number, hz: number, y: number, wallH: number, colour: string, name: string) {
  kit.box(parent, [hx * 2, wallH, .22], [0, y, -hz], colour, `${name}-back-wall`);
  kit.box(parent, [.22, wallH, hz * 2], [-hx, y, 0], colour, `${name}-left-wall`);
  kit.box(parent, [.22, wallH, hz * 2], [hx, y, 0], colour, `${name}-right-wall`);
}

function exterior(kind: VillageBuildingKind, dressing: PlaceDressing, quality: RenderTier): VillageBuilding {
  const kit = new Kit(quality), p = palette(dressing), [hx, hz] = VILLAGE_FOOTPRINTS[kind];
  const root = kit.group, roof = new THREE.Group(), front = new THREE.Group(); root.name = `village-${kind}`; roof.name = `${kind}-roof-cutaway`; front.name = `${kind}-front-cutaway`; root.add(roof, front);
  const wallH = kind === "home" ? 6.2 : kind === "bank" ? 3.5 : 3.05;
  foundation(kit, root, hx, hz, p, kind);
  if (kind === "home") {
    // Three real levels: the cellar has its own stone skirt, kitchen below the loft.
    shellSidesBack(kit, root, hx, hz, 1.48, 2.2, p.plaster, "home-kitchen-shell");
    // The whole upper story belongs with the removable roof, not the room volume.
    shellSidesBack(kit, roof, hx, hz, 4.0, 2.7, p.plaster, "home-timber-loft-shell");
    wallWithDoor(kit, front, hx, hz, 1.48, 2.2, p, "home", 1.34, 1.6);
    kit.box(front, [hx * 2, .34, 1.15], [0, .5, hz + .52], p.timber, "home-shingled-veranda");
    for (const x of [-1.85, 1.85]) { kit.cyl(front, .11, 2.2, [x, 1.58, hz + .96], p.trim, "home-porch-post"); kit.box(front, [.26, .15, .9], [x, 2.58, hz + .57], p.trim, "home-porch-bracket"); }
    windowBay(kit, front, -2.35, 1.72, hz + .13, p, "home-kitchen", 1.1); windowBay(kit, front, 2.45, 4.45, hz + .13, p, "home-loft", 1.0);
    // A projecting bay on the coastal side, with three leaded panes.
    kit.box(root, [1.55, 1.45, .72], [-hx - .25, 2.0, -.55], p.plaster, "home-bay-window-body");
    windowBay(kit, root, -hx - .64, 2.04, -.55, p, "home-bay-window", 1.02);
    kit.box(root, [.78, 4.7, .92], [hx - .7, 3.2, -hz + .55], p.brick, "home-stone-chimney");
    for (let y = .65; y < 5.6; y += .42) kit.box(root, [.84, .045, .98], [hx - .7, y, -hz + .55], p.stone, `home-chimney-course-${y}`);
    shellSidesBack(kit, root, hx + .16, hz + .12, -.68, 1.38, p.stone, "home-stone-cellar");
    gable(kit, roof, hx, hz, 6.2, p, "home", 1.38);
  } else if (kind === "bank") {
    shellSidesBack(kit, root, hx, hz, wallH / 2, wallH, p.brick, "bank-warm-brick-shell");
    wallWithDoor(kit, front, hx, hz, wallH / 2, wallH, { ...p, plaster: p.brick, timber: p.brass }, "bank", 1.6, 0);
    for (const x of [-2.75, 2.75]) { kit.cyl(front, .24, 2.65, [x, 1.75, hz + .28], p.stone, "bank-stone-column"); kit.cyl(front, .3, .16, [x, 3.08, hz + .28], p.trim, "bank-column-cap"); }
    windowBay(kit, front, -2.25, 1.95, hz + .13, p, "bank-left", 1.0); windowBay(kit, front, 2.25, 1.95, hz + .13, p, "bank-right", 1.0);
    kit.box(front, [3.3, .32, .4], [0, 3.35, hz + .31], p.stone, "bank-queen-hall-pediment");
    // Bank slate and brick cues stay distinct from the colourful village roofs.
    gable(kit, roof, hx, hz, wallH, { ...p, roof: p.stone, roofAlt: p.brick }, "bank", 1.05);
  } else if (kind === "glasshouse") {
    // Glass stays visibly separate from its green iron frame.
    for (const x of [-hx, -hx / 2, hx / 2, hx]) kit.box(root, [.12, 3.0, .12], [x, 1.85, 0], p.timber, "glasshouse-upright");
    for (const z of [-hz, 0, hz]) kit.box(root, [hx * 2, .1, .1], [0, 1.9, z], p.timber, "glasshouse-rail");
    kit.box(root, [hx * 2 - .2, 2.75, .055], [0, 1.78, -hz], p.glass, "glasshouse-rear-glazing");
    kit.box(root, [.055, 2.75, hz * 2], [-hx, 1.78, 0], p.glass, "glasshouse-left-glazing");
    kit.box(root, [.055, 2.75, hz * 2], [hx, 1.78, 0], p.glass, "glasshouse-right-glazing");
    wallWithDoor(kit, front, hx, hz, 1.78, 2.75, { ...p, plaster: p.glass }, "glasshouse", 1.1, 1.7);
    gable(kit, roof, hx, hz, 3.25, { ...p, roof: p.glass, roofAlt: p.timber }, "glasshouse", .92);
    for (let x = -2.8; x <= 2.8; x += 1.4) { kit.box(root, [1.0, .68, .52], [x, .78, -.82], p.timber, "glasshouse-growing-bench"); kit.sphere(root, .23, [x, 1.26, -.82], p.roofAlt, "glasshouse-plant"); }
  } else {
    const base = kind === "studio" ? p.brick : kind === "boathouse" ? p.timber : kind === "library" ? p.plaster : p.plaster;
    shellSidesBack(kit, root, hx, hz, wallH / 2, wallH, base, `${kind}-shell`);
    const doorX = kind === "library" ? 1.8 : kind === "studio" ? 1.95 : kind === "cottage" ? 1.75 : kind === "boathouse" ? 1.5 : 0;
    wallWithDoor(kit, front, hx, hz, wallH / 2, wallH, { ...p, plaster: base }, kind, kind === "boathouse" ? 1.45 : 1.16, doorX);
    for (const x of [-hx + .72, hx - .72]) windowBay(kit, front, x, 1.88, hz + .13, p, kind, .82);
    gable(kit, roof, hx, hz, wallH, p, kind, kind === "library" ? 1.2 : .9);
    if (kind === "library") { kit.box(root, [hx * 2 + .22, .32, .55], [0, 3.82, -hz], p.timber, "library-cornice"); for (const x of [-2.8, 0, 2.8]) kit.box(root, [.35, 2.2, .48], [x, 1.52, -hz + .22], p.timber, "library-reading-bay"); }
    if (kind === "studio") { kit.box(root, [1.55, 2.45, .2], [-hx + .13, 1.85, -.35], p.glass, "studio-north-light"); kit.cyl(root, .58, 1.2, [hx - .7, 1.0, -hz + .7], p.brick, "studio-kiln-chimney"); }
    if (kind === "cottage") { kit.box(root, [1.9, .18, 1.0], [0, .62, hz + .5], p.timber, "cottage-cat-veranda"); kit.box(root, [.66, .75, .18], [-1.15, .72, hz + .11], p.trim, "cottage-cat-door"); }
    if (kind === "boathouse") { for (const x of [-2.45, 2.45]) kit.cyl(root, .15, 3.1, [x, 1.9, -hz + .18], p.stone, "boathouse-piling"); kit.box(root, [hx * 2 + .55, .18, 1.0], [0, .42, -hz - .45], p.timber, "boathouse-dock"); }
  }
  const lantern = new THREE.PointLight(p.warm, quality === "full" ? .55 : .32, 5); lantern.position.set(0, 2.35, hz + .72); lantern.name = `${kind}-porch-lantern`; root.add(lantern);
  kit.finish();
  return { group: root, roof, front, animate: (t) => { lantern.intensity = (quality === "full" ? .5 : .28) + Math.sin(t * 2.1) * .035; return quality === "full"; }, dispose: () => kit.dispose() };
}

export function buildVillageBuilding(kind: VillageBuildingKind, dressing: PlaceDressing, quality: RenderTier): VillageBuilding { return exterior(kind, dressing, quality); }

function artBase(name: string, quality: RenderTier) { const kit = new Kit(quality); kit.group.name = name; return kit; }

/** Bank hall occupies one existing first-floor room. Queen herself remains owned by the Court. */
export function buildBankHall(dressing: PlaceDressing, quality: RenderTier): VillageArt {
  const kit = artBase("bank-hall", quality), p = palette(dressing), group = kit.group;
  kit.box(group, [8.8, .12, 6.7], [0, 0, 0], p.stone, "bank-hall-stone-floor");
  kit.box(group, [8.8, 3.15, .16], [0, 1.58, -3.35], p.brick, "bank-hall-back-wall");
  for (const x of [-3.65, 3.65]) kit.box(group, [.16, 3.15, 6.7], [x, 1.58, 0], p.brick, "bank-hall-side-wall");
  // Back wall is broken into two door bays: desk toward the Queen and vault beyond.
  for (const x of [-2.25, 2.25]) { doorFrame(kit, group, [x, .05, -3.25], p, x < 0 ? "bank-queen-door" : "bank-vault-door", 1.15, 2.15, x < 0 ? p.brass : p.timber); }
  // The Queen's central plinth stays clear; teller work occupies the rear wall.
  kit.cyl(group, .74, .18, [0, .09, .8], p.stone, "bank-queen-plinth");
  kit.box(group, [5.1, 1.05, .72], [0, .57, -2.0], p.timber, "bank-teller-counter");
  kit.box(group, [5.38, .14, .9], [0, 1.17, -2.0], p.trim, "bank-teller-countertop");
  for (const x of [-2.15, 2.15]) kit.cyl(group, .12, 1.05, [x, .55, -2.0], p.brass, "bank-counter-leg");
  kit.box(group, [1.8, .9, 1.02], [-2.25, .48, 1.3], p.timber, "bank-consultation-desk"); kit.box(group, [2.02, .12, 1.2], [-2.25, .98, 1.3], p.trim, "bank-consultation-top");
  kit.cyl(group, 1.08, .15, [2.42, 1.2, -3.0], p.brass, "bank-vault-round-door", [Math.PI / 2, 0, 0]); kit.cyl(group, .18, .1, [2.42, 1.2, -2.89], p.stone, "bank-vault-wheel", [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 6; i++) kit.box(group, [.06, .58, .06], [2.42, 1.2, -2.84], p.brass, `bank-vault-spoke-${i}`, [0, 0, i * Math.PI / 3]);
  const lamp = new THREE.PointLight(p.warm, quality === "full" ? .95 : .55, 5); lamp.position.set(0, 2.55, .3); group.add(lamp);
  const anchors = (): Anchor[] => [
    { id: "queen", position: [0, .78, .8], zone: "queen", label: "The Queen — at the heart of the household Fund", door: { target: "queen" } },
    { id: "books", position: [0, 1.2, -1.6], zone: "teller", label: "The rear teller counter — open the books", door: { target: "books" } },
    { id: "vault", position: [2.42, 1.2, -2.82], zone: "vault", label: "The upright brass vault door — open the books", door: { target: "books" } },
    { id: "consultation", position: [-2.25, 1.08, 1.3], zone: "desk", label: "The consultation desk — open the books", door: { target: "books" } },
  ];
  kit.finish();
  return { group, anchors, regions: () => anchors().map(a => ({ id: a.id, group: "bank", label: a.label, box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...a.position), new THREE.Vector3(1.1, 1.3, .9)) })), animate: t => { lamp.intensity = (quality === "full" ? .92 : .5) + Math.sin(t * 2) * .04; return quality === "full"; }, dispose: () => kit.dispose() };
}

/** Furniture-only extensions for existing House scenes; all are inside their inherited room bounds. */
export function buildHomeFittings(room: "kitchen" | "tower" | "cellar" | "atlas", dressing: PlaceDressing, quality: RenderTier): VillageArt {
  const kit = artBase(`home-${room}-fittings`, quality), p = palette(dressing), group = kit.group;
  const anchors: Anchor[] = [];
  if (room === "kitchen") {
    kit.box(group, [2.0, .9, .62], [-2.5, .48, -2.42], p.timber, "home-kitchen-cupboard"); kit.box(group, [2.18, .12, .8], [-2.5, .98, -2.42], p.trim, "home-kitchen-counter");
    kit.box(group, [1.35, .82, .86], [1.85, .44, -1.75], p.timber, "home-kitchen-island"); kit.box(group, [1.55, .13, 1.04], [1.85, .92, -1.75], p.trim, "home-kitchen-island-top");
    kit.cyl(group, .24, .34, [1.85, 1.16, -1.75], p.brass, "home-kitchen-pot"); anchors.push({ id: "kitchen-books", position: [1.85, 1.2, -1.75], zone: "kitchen", label: "The kitchen table — open the books", door: { target: "books" } });
  } else if (room === "tower") {
    kit.box(group, [1.5, .14, .72], [-1.35, 1.08, 1.18], p.timber, "home-loft-writing-table"); for (const x of [-1.92, -.78]) for (const z of [.9, 1.46]) kit.cyl(group, .06, 1.02, [x, .55, z], p.timber, "home-loft-table-leg");
    kit.box(group, [1.35, .45, .38], [1.72, .43, -1.78], p.timber, "home-loft-window-seat"); kit.box(group, [1.52, .14, .55], [1.72, .72, -1.78], p.trim, "home-loft-cushion"); anchors.push({ id: "loft-books", position: [-1.35, 1.2, 1.18], zone: "tower", label: "Kitty Banks writing table — open the books", door: { target: "books" } });
  } else if (room === "cellar") {
    kit.box(group, [2.3, .16, .74], [-2.6, .7, -2.2], p.timber, "home-cellar-pantry-shelf"); for (let i = 0; i < 5; i++) kit.cyl(group, .16, .38, [-3.32 + i * .36, .97, -2.2], p.roofAlt, "home-cellar-jar");
    kit.box(group, [1.55, .12, .65], [1.8, .62, -2.15], p.timber, "home-cellar-map-chest"); anchors.push({ id: "cellar-books", position: [1.8, .86, -2.15], zone: "cellar", label: "The cellar map chest — open the books", door: { target: "books" } });
  } else {
    kit.box(group, [2.35, .13, 1.38], [0, .72, .45], p.timber, "home-atlas-map-table"); kit.box(group, [2.12, .025, 1.16], [0, .8, .45], p.plaster, "home-atlas-chart");
    kit.cyl(group, .24, .5, [-1.62, .31, .45], p.timber, "home-atlas-table-leg"); kit.cyl(group, .24, .5, [1.62, .31, .45], p.timber, "home-atlas-table-leg"); anchors.push({ id: "atlas-books", position: [0, .95, .45], zone: "atlas", label: "The Atlas map nook — open the books", door: { target: "books" } });
  }
  kit.finish();
  return { group, anchors: () => anchors, regions: () => anchors.map(a => ({ id: a.id, group: room, label: a.label, box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...a.position), new THREE.Vector3(1.15, .8, .9)) })), animate: () => false, dispose: () => kit.dispose() };
}
