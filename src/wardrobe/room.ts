/**
 * Authored dressing rooms: one physical set per theme, tinted from the live scene tokens.
 * Classic Hearth is a warm study; Taylor's Scrapbook a cottage attic; Newfoundland a harbour music room.
 * Each has a light and a dark treatment. Nothing here is a real logo, lyric, likeness or household fact.
 */
import * as T from 'three';
import { luminance, mixHex, type RoomPalette } from './roomPalette.ts';
export type RoomMaterials = { wood: T.MeshStandardMaterial; trim: T.MeshStandardMaterial; cloth: T.MeshStandardMaterial; wall: T.MeshStandardMaterial; accent: T.MeshStandardMaterial; second: T.MeshStandardMaterial; paper: T.MeshStandardMaterial };
export type Room = { group: T.Group; materials: RoomMaterials; apply: (palette: RoomPalette) => void; dispose: () => void };
const WALL_Z = -0.63, FLOOR_Y = -0.045;
export function createRoom(scene: T.Scene, palette: RoomPalette): Room {
  const group = new T.Group(); group.name = 'room'; scene.add(group);
  const standard = (colour: string, roughness = 0.82, metalness = 0) => new T.MeshStandardMaterial({ color: colour, roughness, metalness });
  const materials: RoomMaterials = {
    wood: standard(palette.wood, 0.78), trim: standard(palette.brass, 0.4, 0.55), cloth: standard(palette.card, 0.92),
    wall: standard(palette.paper, 0.9), accent: standard(palette.accent, 0.8), second: standard(palette.second, 0.8), paper: standard(palette.card, 0.95),
  };
  const glow = new T.MeshBasicMaterial({ color: '#fff4dc' });
  const lampShade = new T.MeshStandardMaterial({ color: palette.card, roughness: 0.9, emissive: '#f4c98a', emissiveIntensity: 0 });
  const disposables: (T.BufferGeometry | T.Material)[] = [materials.wood, materials.trim, materials.cloth, materials.wall, materials.accent, materials.second, materials.paper, glow, lampShade];
  function mesh(geometry: T.BufferGeometry, material: T.Material, x: number, y: number, z: number, parent: T.Object3D = group) { disposables.push(geometry); const m = new T.Mesh(geometry, material); m.position.set(x, y, z); parent.add(m); return m; }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, m: T.Material, parent?: T.Object3D) => mesh(new T.BoxGeometry(w, h, d), m, x, y, z, parent);
  const cylinder = (r: number, h: number, x: number, y: number, z: number, m: T.Material, parent?: T.Object3D) => mesh(new T.CylinderGeometry(r, r, h, 24), m, x, y, z, parent);
  // Lights: a soft sky/ground pair, a window key, a cool fill, and a warm lamp that carries dark scenes.
  const hemisphere = new T.HemisphereLight('#fff5df', '#55626d', 1.5); group.add(hemisphere);
  const sun = new T.DirectionalLight('#fff1d2', 2); sun.position.set(-0.5, 1.2, 1); group.add(sun);
  const fill = new T.DirectionalLight('#d3e7ed', 0.7); fill.position.set(1, 0.6, -0.4); group.add(fill);
  const lamp = new T.PointLight('#ffb970', 0, 2.2, 1.6); group.add(lamp);
  const stageLight = new T.SpotLight('#fff0d0', 0, 3, Math.PI / 5, 0.6, 1.2); stageLight.position.set(0.15, 1.1, 0.5); stageLight.target.position.set(0, 0.1, 0); group.add(stageLight, stageLight.target);
  // Shared shell: floor, back wall.
  box(1.65, 0.035, 1.25, 0, FLOOR_Y, -0.03, materials.wood);
  box(1.6, 0.91, 0.028, 0, 0.39, WALL_Z, materials.wall);
  // Per-theme walls, windows and set dressing.
  const windowPanes: T.Mesh[] = []; const clapboards: T.MeshStandardMaterial[] = []; const cards: T.MeshStandardMaterial[] = [];
  if (palette.theme === 'classic') {
    // Warm study: wainscot panelling, a chair rail, a tall window with soft daylight, a folded-cloth box.
    box(1.6, 0.3, 0.02, 0, 0.1, WALL_Z + 0.016, materials.wood);
    box(1.6, 0.018, 0.03, 0, 0.255, WALL_Z + 0.022, materials.trim);
    for (let i = -5; i <= 5; i++) box(0.012, 0.22, 0.012, i * 0.145, 0.1, WALL_Z + 0.03, materials.trim);
    const pane = mesh(new T.PlaneGeometry(0.3, 0.52), glow, -0.66, 0.5, WALL_Z + 0.018); windowPanes.push(pane);
    for (const x of [-0.82, -0.5]) box(0.03, 0.56, 0.04, x, 0.5, WALL_Z + 0.03, materials.wood);
    for (const y of [0.22, 0.78]) box(0.35, 0.03, 0.04, -0.66, y, WALL_Z + 0.03, materials.wood);
    box(0.012, 0.52, 0.02, -0.66, 0.5, WALL_Z + 0.03, materials.wood); box(0.3, 0.012, 0.02, -0.66, 0.5, WALL_Z + 0.03, materials.wood);
    box(0.36, 0.02, 0.09, -0.66, 0.205, WALL_Z + 0.06, materials.wood);
    box(0.14, 0.075, 0.1, -0.48, 0.23, -0.44, materials.cloth); box(0.15, 0.018, 0.11, -0.48, 0.275, -0.44, materials.trim);
    lamp.position.set(0.6, 0.62, -0.3);
    cylinder(0.011, 0.24, 0.66, 0.35, -0.5, materials.trim); mesh(new T.ConeGeometry(0.075, 0.09, 24, 1, true), lampShade, 0.66, 0.5, -0.5);
  } else if (palette.theme === 'taylor') {
    // Cottage attic: sloped pastel wall, a string of blank paper photo cards, a botanical pot, patchwork cushion, warm lamp.
    const rafter = box(1.6, 0.04, 0.05, 0, 0.83, WALL_Z + 0.04, materials.wood); rafter.rotation.x = 0.2;
    for (let i = -4; i <= 4; i++) box(0.03, 0.9, 0.012, i * 0.19, 0.39, WALL_Z + 0.02, materials.paper);
    const string = mesh(new T.CylinderGeometry(0.0022, 0.0022, 1.05, 6), materials.trim, -0.12, 0.7, WALL_Z + 0.05); string.rotation.z = Math.PI / 2; string.rotation.y = 0.05;
    for (let i = 0; i < 6; i++) { const m = new T.MeshStandardMaterial({ color: palette.card, roughness: 0.95 }); disposables.push(m); cards.push(m); const card = box(0.075, 0.09, 0.004, -0.6 + i * 0.19, 0.645 + Math.sin(i * 1.7) * 0.012, WALL_Z + 0.055, m); card.rotation.z = Math.sin(i * 2.1) * 0.08; box(0.06, 0.055, 0.005, 0, 0.008, 0.002, i % 2 ? materials.second : materials.accent, card); box(0.012, 0.02, 0.006, 0, 0.05, 0, materials.trim, card); }
    box(0.2, 0.025, 0.15, -0.5, 0.37, -0.47, materials.wood); for (let i = 0; i < 3; i++) box(0.034, 0.085, 0.07, -0.57 + i * 0.037, 0.425, -0.45, i % 2 ? materials.cloth : materials.accent);
    cylinder(0.027, 0.052, 0.6, 0.17, -0.32, materials.cloth); for (let i = 0; i < 5; i++) { const leaf = mesh(new T.SphereGeometry(0.025, 8, 6), materials.second, 0.6 + Math.sin(i) * 0.027, 0.215 + i * 0.009, -0.32); leaf.scale.set(0.5, 1.7, 0.2); leaf.rotation.z = i * 0.6; }
    const cushion = new T.Group(); cushion.position.set(-0.68, 0.0, 0.18); group.add(cushion);
    for (const [x, z, m] of [[-0.04, -0.04, materials.accent], [0.04, -0.04, materials.cloth], [-0.04, 0.04, materials.second], [0.04, 0.04, materials.accent]] as const) { const patch = box(0.078, 0.05, 0.078, x, 0.0, z, m, cushion); patch.rotation.y = 0.3; }
    lamp.position.set(0.62, 0.5, -0.36);
    cylinder(0.02, 0.008, 0.62, 0.15, -0.36, materials.trim); cylinder(0.006, 0.2, 0.62, 0.25, -0.36, materials.trim); mesh(new T.SphereGeometry(0.05, 16, 12), lampShade, 0.62, 0.4, -0.36);
  } else {
    // Harbour music room: painted clapboard in jellybean colours, rope-and-brass hook rail, three original record sleeves, a porthole, a cone lamp.
    const jellybeans = [palette.accent, palette.second, palette.brass, palette.card, palette.accent, palette.second, palette.card, palette.brass];
    for (let i = 0; i < 8; i++) { const m = new T.MeshStandardMaterial({ color: jellybeans[i]!, roughness: 0.88 }); disposables.push(m); clapboards.push(m); const board = box(1.6, 0.108, 0.014, 0, -0.01 + i * 0.112, WALL_Z + 0.022, m); board.rotation.x = 0.06; }
    const porthole = mesh(new T.TorusGeometry(0.11, 0.018, 12, 40), materials.trim, -0.6, 0.58, WALL_Z + 0.05); porthole.rotation.y = 0;
    const pane = mesh(new T.CircleGeometry(0.1, 32), glow, -0.6, 0.58, WALL_Z + 0.04); windowPanes.push(pane);
    for (let i = 0; i < 4; i++) { const bolt = mesh(new T.SphereGeometry(0.008, 8, 6), materials.trim, -0.6 + Math.cos(i * Math.PI / 2) * 0.11, 0.58 + Math.sin(i * Math.PI / 2) * 0.11, WALL_Z + 0.07); bolt.scale.z = 0.5; }
    const rope = mesh(new T.TorusGeometry(0.2, 0.006, 8, 40, Math.PI), materials.cloth, -0.2, 0.62, WALL_Z + 0.05); rope.rotation.z = Math.PI; rope.scale.y = 0.3;
    for (const x of [-0.42, -0.2, 0.02]) { box(0.03, 0.03, 0.02, x, 0.63, WALL_Z + 0.04, materials.wood); const hook = mesh(new T.TorusGeometry(0.014, 0.004, 8, 16, Math.PI * 1.4), materials.trim, x, 0.6, WALL_Z + 0.06); hook.rotation.z = Math.PI * 0.8; }
    for (let i = 0; i < 3; i++) { box(0.085, 0.085, 0.006, -0.5 + i * 0.018, 0.24 + i * 0.004, -0.37, i === 1 ? materials.second : materials.accent); const disc = mesh(new T.CylinderGeometry(0.026, 0.026, 0.003, 24), materials.wood, -0.5 + i * 0.018, 0.24 + i * 0.004, -0.362); disc.rotation.x = Math.PI / 2; }
    lamp.position.set(0.65, 0.5, -0.44);
    cylinder(0.012, 0.21, 0.65, 0.31, -0.48, materials.trim); mesh(new T.ConeGeometry(0.07, 0.1, 24, 1, true), lampShade, 0.65, 0.43, -0.48);
  }
  function apply(next: RoomPalette) {
    materials.wood.color.set(next.wood); materials.trim.color.set(next.brass); materials.cloth.color.set(next.card); materials.wall.color.set(next.paper);
    materials.accent.color.set(next.accent); materials.second.color.set(next.second); materials.paper.color.set(mixHex(next.card, next.paper, 0.4));
    lampShade.color.set(next.card);
    const dark = next.dark;
    // Dark scenes: lower ambient, a warm key lamp, the stage still lit, and legible brass on the mirror frame.
    hemisphere.intensity = dark ? 0.35 : 1.5; hemisphere.color.set(dark ? '#5f6f8c' : '#fff5df'); hemisphere.groundColor.set(dark ? '#1c1a20' : '#55626d');
    sun.intensity = dark ? 0.25 : 2; sun.color.set(dark ? '#9fb0d8' : '#fff1d2'); fill.intensity = dark ? 0.15 : 0.7;
    lamp.intensity = dark ? 2.6 : 0.35; stageLight.intensity = dark ? 4 : 0;
    lampShade.emissiveIntensity = dark ? 0.9 : 0.12;
    glow.color.set(dark ? mixHex(next.paper, '#2b3552', 0.6) : '#fff4dc');
    if (dark) materials.trim.color.set(mixHex(next.brass, '#ffe4a0', 0.3));
    materials.trim.emissive.set(dark ? mixHex(next.brass, '#000000', 0.5) : '#000000');
    scene.background = new T.Color(dark ? mixHex(next.paper, '#000000', 0.25) : mixHex(next.paper, next.second, 0.12));
    for (let i = 0; i < clapboards.length; i++) { const beans = [next.accent, next.second, next.brass, next.card, next.accent, next.second, next.card, next.brass]; clapboards[i]!.color.set(dark ? mixHex(beans[i]!, next.ink, 0.35) : beans[i]!); }
    for (const card of cards) card.color.set(dark ? mixHex(next.card, next.ink, 0.25) : next.card);
    // A very light accent on a light wall loses the room; keep trim legible against the wall either way.
    if (!dark && luminance(next.brass) > 0.7) materials.trim.color.set(mixHex(next.brass, next.ink, 0.35));
    for (const pane of windowPanes) pane.visible = true;
  }
  apply(palette);
  return { group, materials, apply, dispose() { for (const item of disposables) item.dispose(); scene.remove(group); } };
}
