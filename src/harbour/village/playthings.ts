import * as THREE from "three";
import type { Anchor, PlaceDressing, Region } from "../scene/place.ts";
import type { RenderTier } from "../scene/quality.ts";

export type PlaythingRoom = "kitchen" | "tower" | "cellar" | "atlas" | "bank" | "library" | "glasshouse" | "kiln" | "cottage" | "boathouse";
export type RoomPlaything = { group: THREE.Group; anchors: () => Anchor[]; regions: () => Region[]; interact: (id: string) => string | null; animate: (t: number, dt: number) => boolean; dispose: () => void };

type Maker = { add(geometry: THREE.BufferGeometry, color: string, name: string, at: readonly [number, number, number], rotation?: readonly [number, number, number]): THREE.Mesh; group: THREE.Group; dispose(): void };
function maker(name: string, tier: RenderTier): Maker {
  const group = new THREE.Group(); group.name = `plaything-${name}`;
  const owned = new Set<{ dispose(): void }>(); let dead = false;
  return {
    group,
    add(geometry, color, part, at, rotation = [0, 0, 0]) { const material = new THREE.MeshStandardMaterial({ color, roughness: .75, metalness: /brass|metal|bell|coin/.test(part) ? .58 : 0 }); owned.add(geometry); owned.add(material); const mesh = new THREE.Mesh(geometry, material); mesh.name = `${name}-${part}`; mesh.position.set(...at); mesh.rotation.set(...rotation); mesh.castShadow = tier === "full"; mesh.receiveShadow = true; group.add(mesh); return mesh; },
    dispose() { if (dead) return; dead = true; group.removeFromParent(); for (const item of owned) item.dispose(); owned.clear(); group.clear(); },
  };
}
function box(m: Maker, s: readonly [number, number, number], color: string, name: string, at: readonly [number, number, number], rotation?: readonly [number, number, number]) { return m.add(new THREE.BoxGeometry(...s), color, name, at, rotation); }
function cyl(m: Maker, r: number, h: number, color: string, name: string, at: readonly [number, number, number], rotation?: readonly [number, number, number]) { return m.add(new THREE.CylinderGeometry(r, r, h, 10), color, name, at, rotation); }
function torus(m: Maker, radius: number, tube: number, color: string, name: string, at: readonly [number, number, number], rotation?: readonly [number, number, number]) { return m.add(new THREE.TorusGeometry(radius, tube, 6, 14), color, name, at, rotation); }

/** Tiny authored objects for a room's existing table. They are play, never commands or money. */
export function buildRoomPlaything(room: PlaythingRoom, dressing: PlaceDressing, tier: RenderTier): RoomPlaything {
  const m = maker(room, tier), dark = dressing.timber, brass = dressing.metal, paper = "#e7d9b6", warm = dressing.theme === "newfoundland" ? "#efa85c" : "#e8b35e";
  const anchor: Anchor = { id: `${room}-plaything`, position: [-2, .9, .8], zone: "plaything", label: "" };
  // A single stable table makes the neutral coordinate useful in every inherited room.
  box(m, [1.5, .12, 1.08], dark, "play-tabletop", [-2, .64, .8]);
  for (const x of [-2.58, -1.42]) for (const z of [.4, 1.2]) cyl(m, .045, .62, dark, "play-table-leg", [x, .31, z]);
  let motion = (_t: number) => {}, reset = () => {};
  let activeFor = 0;
  let words = "";
  if (room === "kitchen") {
    cyl(m, .32, .5, "#b56e4e", "kettle-body", [-2, .9, .8]); torus(m, .34, .045, dark, "kettle-handle", [-2, 1.16, .8], [Math.PI / 2, 0, 0]); cyl(m, .13, .06, brass, "kettle-lid", [-2, 1.18, .8]);
    const steam = m.add(new THREE.ConeGeometry(.08, .55, 5), "#f4e8ce", "kettle-steam", [-2, 1.5, .8]); motion = t => { steam.position.y = 1.42 + Math.sin(t * 2.5) * .08; steam.rotation.y = t * .4; }; reset = () => { steam.position.y = 1.5; steam.rotation.y = 0; }; words = "Steam curls from the kettle lid.";
  } else if (room === "tower") {
    cyl(m, .42, .12, brass, "music-box-base", [-2, .8, .8]); cyl(m, .25, .24, dark, "music-box-drum", [-2, .98, .8], [0, 0, Math.PI / 2]);
    const coin = cyl(m, .16, .035, "#d9b85d", "coin-token", [-1.72, 1.11, .8], [Math.PI / 2, 0, 0]); motion = t => { coin.rotation.y = t * 2.2; }; reset = () => { coin.rotation.y = 0; }; words = "The little music mechanism turns its token.";
  } else if (room === "cellar") {
    cyl(m, .19, .42, brass, "lantern-body", [-2, .88, .8]); torus(m, .2, .025, brass, "lantern-bail", [-2, 1.15, .8], [Math.PI / 2, 0, 0]); const glow = m.add(new THREE.SphereGeometry(.13, 10, 7), warm, "lantern-glow", [-2, .92, .8]); motion = t => { glow.scale.setScalar(.9 + Math.sin(t * 3) * .08); }; reset = () => glow.scale.setScalar(1); words = "The cellar lantern brightens the table.";
  } else if (room === "atlas") {
    cyl(m, .34, .055, brass, "globe-stand", [-2, .72, .8]); const globe = m.add(new THREE.SphereGeometry(.29, 12, 8), dressing.sea, "atlas-globe", [-2, 1.05, .8]); torus(m, .31, .022, brass, "globe-meridian", [-2, 1.05, .8], [0, Math.PI / 2, .28]); motion = t => { globe.rotation.y = t * .45; }; reset = () => { globe.rotation.y = 0; }; words = "The Atlas globe turns toward another shore.";
  } else if (room === "bank") {
    cyl(m, .14, .6, dark, "bell-stem", [-2, .8, .8]); const bell = m.add(new THREE.SphereGeometry(.31, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), brass, "brass-bell", [-2, 1.1, .8]); motion = t => { bell.rotation.z = Math.sin(t * 2.8) * .1; }; reset = () => { bell.rotation.z = 0; }; words = "The little brass bell rocks on its stem.";
  } else if (room === "library") {
    box(m, [.62, .1, .46], dark, "book-cover", [-2, .8, .8]); const leaf = box(m, [.53, .016, .39], paper, "book-page", [-2, .86, .8]); const ribbon = box(m, [.04, .02, .62], "#934d45", "book-ribbon", [-2, .88, .8]); motion = t => { leaf.rotation.z = Math.sin(t * 1.4) * .28; ribbon.position.z = .8 + Math.sin(t * 1.4) * .08; }; reset = () => { leaf.rotation.z = 0; ribbon.position.z = .8; }; words = "A book leaf lifts and settles.";
  } else if (room === "glasshouse") {
    cyl(m, .17, .34, "#6f8e7a", "watering-can-body", [-2, .9, .8]); torus(m, .18, .025, dark, "watering-can-handle", [-2, 1.03, .8], [Math.PI / 2, 0, 0]); const spout = cyl(m, .06, .36, brass, "watering-can-spout", [-1.76, .95, .8], [0, 0, Math.PI / 3]); motion = t => { spout.rotation.z = Math.PI / 3 + Math.sin(t * 1.1) * .1; }; reset = () => { spout.rotation.z = Math.PI / 3; }; words = "The watering can tips toward a seedling.";
  } else if (room === "kiln") {
    cyl(m, .38, .12, dark, "pottery-wheel", [-2, .8, .8]); const clay = m.add(new THREE.CylinderGeometry(.16, .23, .3, 12), "#b87558", "pottery-clay", [-2, 1.01, .8]); motion = t => { clay.rotation.y = t * 3; clay.scale.y = 1 + Math.sin(t * 2) * .05; }; reset = () => { clay.rotation.y = 0; clay.scale.y = 1; }; words = "The clay vessel turns on the wheel.";
  } else if (room === "cottage") {
    const feather = m.add(new THREE.ConeGeometry(.12, .62, 5), "#d5b26a", "feather-toy", [-2, 1.08, .8], [0, 0, Math.PI / 2]); cyl(m, .045, .5, dark, "feather-wand", [-2.28, .84, .8], [0, 0, Math.PI / 2]); motion = t => { feather.rotation.z = Math.PI / 2 + Math.sin(t * 4) * .32; }; reset = () => { feather.rotation.z = Math.PI / 2; }; words = "The feather toy swishes in a playful arc.";
  } else {
    box(m, [.62, .12, .48], dark, "projector-base", [-2, .82, .8]); cyl(m, .19, .35, brass, "projector-lens", [-1.7, .92, .8], [0, 0, Math.PI / 2]); const reel = cyl(m, .18, .05, dark, "projector-reel", [-2.22, 1.1, .8], [Math.PI / 2, 0, 0]); const beam = m.add(new THREE.ConeGeometry(.42, 1.25, 10, 1, true), "#eadcad", "projector-visible-cone", [-1.06, .92, .8], [0, 0, -Math.PI / 2]); beam.visible = false; motion = t => { reel.rotation.y = t * 3.2; beam.visible = true; }; reset = () => { reel.rotation.y = 0; beam.visible = false; }; words = "A soft visible cone opens from the projector lens.";
  }
  const action = ({ kitchen: "Kettle", tower: "Music box", cellar: "Lantern", atlas: "Globe", bank: "Bell", library: "Book", glasshouse: "Watering can", kiln: "Pottery wheel", cottage: "Feather toy", boathouse: "Projector" } as const)[room];
  anchor.label = `${action} — play for a moment`;
  m.group.traverse(node => { if ((node as THREE.Mesh).isMesh) node.userData.anchor = anchor.id; });
  return { group: m.group, anchors: () => [anchor], regions: () => [{ id: anchor.id, group: room, label: anchor.label, box: new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...anchor.position), new THREE.Vector3(1.15, 1.0, 1.0)) }], interact: id => { if (id !== anchor.id) return null; activeFor = 2.5; return words; }, animate: (t, dt) => { if (activeFor <= 0) return false; activeFor = Math.max(0, activeFor - Math.max(0, dt)); motion(t); if (activeFor === 0) reset(); return true; }, dispose: () => m.dispose() };
}
