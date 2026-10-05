// The prop kit sheet (served by vite; driven by scripts/horizon/kit-sheet-props.mjs). Four panels of every PropKind drawn
// by the real `drawProp` in one dressing and tier on a gently rolling fixture ground, labelled in the sheet's HTML (no
// world text): A lookout and seating, B rural, lines and signals, C water and shore, D beach, town and library.
//   /scripts/horizon/kit-sheet-props.html?theme=classic&tier=full[&night=1][&view=close]
import * as THREE from 'three';
import { CardBuilder, paperGrain, CARD_CLOCK } from '../../src/harbour/art/cardScene.ts';
import { mix, rgb, shade, type RGB } from '../../src/harbour/art/cardKit.ts';
import { drawProp } from '../../src/harbour/horizon/kit/props/index.ts';
import { propPalette } from '../../src/harbour/horizon/kit/props/kit.ts';
import type { PropKind, PropRecord } from '../../src/harbour/horizon/neighbourhoods/types.ts';
import { SCENE_DRESSING } from '../../src/harbour/scene/place.ts';

const q = new URLSearchParams(location.search);
const theme = (q.get('theme') ?? 'classic') as 'classic' | 'taylor' | 'newfoundland', tier = (q.get('tier') ?? 'full') as 'full' | 'lite', night = q.get('night') === '1', close = q.get('view') === 'close';
const W = 1600, H = 1000, dressing = SCENE_DRESSING[theme], pal = propPalette(theme);
const host = document.getElementById('sheet')!; host.style.width = `${W}px`; host.style.height = `${H}px`;
const renderer = new THREE.WebGLRenderer({ antialias: tier === 'full', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2; renderer.setScissorTest(true);
host.appendChild(renderer.domElement); CARD_CLOCK.value = 3.1;
const col = (c: RGB) => new THREE.Color(c[0], c[1], c[2]);
const ground = (x: number, z: number) => 10 + Math.sin(x * 0.05) * 0.35 + Math.cos(z * 0.07) * 0.25;

type Item = { kind: PropKind; x: number; z: number; yaw?: number; scale?: number; variant?: number; line?: [number, number, number][]; label?: string; water?: boolean };
const g3 = (x: number, z: number, dy = 0): [number, number, number] => [x, ground(x, z) + dy, z];
type Panel = { id: string; label: string; o: [number, number]; items: Item[]; eye: [number, number, number]; look: [number, number, number]; water?: boolean };
const BACK = Math.PI; // props face +z; the camera stands at +z looking back at their fronts
// Page 1: lookout & seating, lights, rural, lines. Page 2: water, shore, beach, town & library (+ the geoglyph and the osprey pole).
const PAGES: Panel[][] = [[
  { id: 'A', label: 'Lookout & seating', o: [0, 0], eye: [4.5, 3.2, 8.5], look: [4.5, 0.7, 0], items: [
    { kind: 'viewer', x: 0, z: 0 }, { kind: 'viewerSeated', x: 1.2, z: 0 }, { kind: 'bench', x: 3.4, z: 0 }, { kind: 'panel', x: 5.6, z: 0, variant: 0 }, { kind: 'panel', x: 6.8, z: 0, variant: 2, label: 'panel (wave)' },
    { kind: 'picnicTable', x: 9, z: -1.5, yaw: 0.3 }, { kind: 'railOpen', x: 0, z: -2.5, line: [g3(-1.5, -2.6), g3(4, -2.6), g3(8, -2.2)], label: 'railOpen' }] },
  { id: 'B', label: 'Lights & stones', o: [100, 0], eye: [4, 2.8, 7.5], look: [4, 1.0, 0], items: [
    { kind: 'lantern', x: 0, z: 0 }, { kind: 'lanternLow', x: 1.4, z: 0 }, { kind: 'bollard', x: 2.6, z: 0 }, { kind: 'monthStone', x: 3.8, z: 0, variant: 0 }, { kind: 'monthStone', x: 4.8, z: 0, variant: 7 },
    { kind: 'sundial', x: 6.2, z: 0 }, { kind: 'birdFeeder', x: 7.6, z: 0 }, { kind: 'mapBoard', x: 9.4, z: -0.6 }] },
  { id: 'C', label: 'Ring bench, swing, steel rail, bell', o: [200, 0], eye: [3, 3.6, 10], look: [3, 1.2, -1], items: [
    { kind: 'ringBench', x: -1, z: -2, scale: 0.42 }, { kind: 'swing', x: 3.2, z: 0, scale: 2.4 }, { kind: 'bell', x: 5.4, z: -0.5 }, { kind: 'bell', x: 7.2, z: 0, variant: 1, label: "bell (ship's)" },
    { kind: 'railOpen', x: 0, z: -4.5, variant: 1, line: [g3(-3, -4.6), g3(8, -4.6)], label: 'railOpen (steel)' }] },
  { id: 'D', label: 'Rural & lines', o: [300, 0], eye: [4, 4.2, 11], look: [4, 0.8, -1], items: [
    { kind: 'hive', x: -1, z: 0.5, variant: 0 }, { kind: 'hive', x: 0, z: 0.2, variant: 2 }, { kind: 'hayBale', x: 2, z: 0 }, { kind: 'cairn', x: 4.4, z: 0 },
    { kind: 'fence', x: 0, z: 3, line: [g3(-3, 3.2), g3(1, 3.2), g3(2.5, 2.6)] }, { kind: 'drystoneWall', x: 6, z: -1, line: [g3(5.5, -0.5), g3(10, -1), g3(13, 0.5)] },
    { kind: 'sheepFank', x: 0, z: -4, line: [g3(-4, -3), g3(1, -3), g3(1.5, -7), g3(-3.5, -7.5), g3(-4, -3)] }] },
], [
  { id: 'E', label: 'Boats & quay', o: [400, 0], eye: [4, 3.4, 9], look: [4, 0.4, 0], items: [
    { kind: 'kayak', x: -1, z: 0, yaw: 1.4 }, { kind: 'rowboat', x: 1.6, z: 0, yaw: 1.3 }, { kind: 'gozzo', x: 5, z: 0, yaw: 1.5, variant: 1 },
    { kind: 'bollardQuay', x: 7.6, z: 1 }, { kind: 'net', x: 9, z: 0 }, { kind: 'crate', x: 10.6, z: 1, variant: 1 }] },
  { id: 'F', label: 'Shore & marsh', o: [500, 0], eye: [4, 3.4, 10], look: [4, 1.6, -1], water: true, items: [
    { kind: 'lifeRing', x: -1, z: 1 }, { kind: 'rodHolder', x: 0.6, z: 1, yaw: Math.PI }, { kind: 'duckBox', x: 2.2, z: 1 }, { kind: 'buoy', x: 4, z: -3, variant: 0, water: true },
    { kind: 'buoy', x: 5.6, z: -3.5, variant: 1, water: true }, { kind: 'buoy', x: 7.2, z: -3, variant: 2, water: true }, { kind: 'snag', x: 9.5, z: -2 }] },
  { id: 'G', label: 'Beach & play', o: [600, 0], eye: [5, 4.5, 12], look: [5, 0.6, -1.5], items: [
    { kind: 'umbrella', x: -1, z: 0, variant: 1 }, { kind: 'towel', x: 0.6, z: 1.6, yaw: 0.3, variant: 1 }, { kind: 'fireRing', x: 3.4, z: 0.5 }, { kind: 'volleyNet', x: 9, z: -3, scale: 0.6 },
    { kind: 'bocceCourt', x: 3, z: -4, scale: 0.6 }, { kind: 'skateBowl', x: 10, z: 1.5, scale: 0.35 }, { kind: 'kite', x: 6, z: 0, line: [g3(6, 0), [12, ground(612, -6) + 7, -6]] }] },
  { id: 'H', label: 'Town & library', o: [700, 0], eye: [4.5, 4.6, 12], look: [4.5, 1.0, -1.5], items: [
    { kind: 'stall', x: -1, z: -1.5 }, { kind: 'fountain', x: 4.2, z: -2.5, scale: 0.6 }, { kind: 'cafeTable', x: 7.4, z: 0.4, variant: 1 }, { kind: 'cafeTable', x: 9.4, z: 1.2 },
    { kind: 'planter', x: 0.5, z: 2 }, { kind: 'bikeRack', x: 3.5, z: 2.4 }, { kind: 'readingTable', x: 7.5, z: -3 }, { kind: 'bookCart', x: 10.4, z: -2.5 },
    { kind: 'laundryLine', x: 2, z: -6, line: [g3(-1, -6.5), g3(6, -6.5)] }, { kind: 'festoon', x: 0, z: -4, line: [g3(-2, -4.5, 3.6), g3(5, -5, 3.6), g3(11, -4.5, 3.6)] }] },
]];
const page = Number(q.get('page') ?? 1), focusKinds = q.get('focus')?.split(','), PANELS = focusKinds ? [0, 1, 2, 3].map(i => PAGES.flat().find(p => p.items.some(t => t.kind === focusKinds[i % focusKinds.length]))!) : PAGES[page === 2 ? 1 : 0]!;
void BACK;
const sky = mix(rgb(theme === 'taylor' ? '#f2e3ea' : theme === 'newfoundland' ? '#dfe9ec' : '#e8dcc4'), rgb('#8fbde0'), 0.7);
const stats: Record<string, unknown> = {};
PANELS.forEach((P, i) => {
  const scene = new THREE.Scene(); scene.background = col(night ? [0.06, 0.08, 0.14] : sky); scene.fog = new THREE.Fog(col(night ? [0.06, 0.08, 0.14] : sky), 90, 400);
  // the ground: a rolling card plane
  const N = 60, size = 140, [ox, oz] = P.o, gpos: number[] = [], gcol: number[] = [], lawn = rgb(dressing.lawn);
  for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) { const x0 = ox - size / 2 + (a / N) * size, x1 = ox - size / 2 + ((a + 1) / N) * size, z0 = oz - size / 2 + (b / N) * size, z1 = oz - size / 2 + ((b + 1) / N) * size;
    for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z0], [x1, z1], [x0, z1]] as const) { gpos.push(x, ground(x, z) - 0.01, z); const c = shade(P.id === 'D' ? mix(lawn, rgb('#e0cfa5'), 0.5) : lawn, 0.97 + ((a + b) % 2) * 0.03); gcol.push(...c); } }
  const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3)); gg.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3)); gg.computeVertexNormals();
  const gm = new THREE.Mesh(gg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, map: paperGrain(), side: THREE.DoubleSide })); gm.receiveShadow = true; scene.add(gm);
  if (P.water) { const w = new THREE.Mesh(new THREE.PlaneGeometry(60, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: dressing.sea, roughness: 0.4 })); w.position.set(ox + 4, 10.05, oz - 2 - 20); w.receiveShadow = true; scene.add(w); }
  const b = new CardBuilder(`Props ${P.id}`, tier, { ink: pal.ink });
  const tags: { at: THREE.Vector3; text: string }[] = [];
  for (const it of P.items) {
    const x = ox + it.x, z = oz + it.z, y = it.water ? 10.05 : ground(x, z);
    const rec: PropRecord = { kind: it.kind, at: [x, y, z], yaw: it.yaw ?? 0, ...(it.scale !== undefined ? { scale: it.scale } : {}), ...(it.variant !== undefined ? { variant: it.variant } : {}), ...(it.line ? { line: it.line.map(p => [p[0] + ox, p[1], p[2] + oz] as [number, number, number]) } : {}) };
    drawProp(b, rec, theme, ground, tier); tags.push({ at: new THREE.Vector3(x, y + 0.2, z + 0.6), text: it.label ?? it.kind });
  }
  const built = b.finish({ waterColor: dressing.sea }); scene.add(built.group);
  built.group.traverse(o => { if ((o as THREE.Mesh).isMesh) { (o as THREE.Mesh).castShadow = true; (o as THREE.Mesh).receiveShadow = true; } });
  scene.add(new THREE.HemisphereLight(night ? '#334466' : '#d9e7e8', night ? '#151515' : '#786b57', night ? 0.35 : 1.2));
  const sun = new THREE.DirectionalLight(night ? '#8899cc' : '#fff0d5', night ? 0.25 : 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -40; sc.right = sc.top = 40; sc.near = 1; sc.far = 400; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.04;
  sun.position.set(ox - 50, 140, oz + 80); sun.target.position.set(ox + 10, 10, oz); scene.add(sun, sun.target);
  const camera = new THREE.PerspectiveCamera(close ? 30 : 46, (W / 2) / (H / 2), 0.2, 800);
  const [ex, ey, ez] = close ? [P.eye[0] * 0.5 + 6, P.eye[1] * 0.5, P.eye[2] * 0.45] : P.eye; camera.position.set(ox + ex, 10 + ey, oz + ez); camera.lookAt(ox + P.look[0], 10 + P.look[1], oz + P.look[2]);
  // `focus=<kind>[,<kind>…]`: panel i looks closely at the i-th named kind on this page (front three-quarter, then behind).
  const focus = q.get('focus')?.split(',');
  if (focus) { const want = focus[i % focus.length]!, it = PAGES.flat().flatMap(p2 => p2.items).find(t => t.kind === want); if (it) { const fx = (PAGES.flat().find(p2 => p2.items.includes(it))!).o[0] + it.x, fz = it.z, fy = ground(fx, fz), r = Number(q.get('r') ?? 2.6), behind = i >= focus.length;
    camera.fov = 40; camera.updateProjectionMatrix(); camera.position.set(fx + r * (behind ? -0.6 : 0.7), fy + r * 0.55, fz + r * (behind ? -0.9 : 0.85)); camera.lookAt(fx, fy + Number(q.get('ty') ?? 0.8), fz); } }
  const x = (i % 2) * (W / 2), yTop = Math.floor(i / 2) * (H / 2);
  renderer.setScissor(x, H / 2 - yTop, W / 2, H / 2); renderer.setViewport(x, H / 2 - yTop, W / 2, H / 2);
  renderer.shadowMap.needsUpdate = true; renderer.info.reset(); renderer.info.autoReset = false; renderer.render(scene, camera);
  stats[P.id] = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
  const tag = document.createElement('div'); tag.className = 'tag'; tag.style.left = `${x + 10}px`; tag.style.top = `${yTop + 8}px`; tag.textContent = `${P.id}  ${P.label}`; host.appendChild(tag);
  for (const t of tags) { const p = t.at.clone().project(camera); if (p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) continue; const d = document.createElement('div'); d.className = 'tag';
    d.style.cssText = `left:${x + (p.x * 0.5 + 0.5) * (W / 2)}px;top:${yTop + (-p.y * 0.5 + 0.5) * (H / 2)}px;font:500 10px system-ui;padding:1px 3px;transform:translate(-50%,0);opacity:.85`; d.textContent = t.text; host.appendChild(d); }
});
const head = document.createElement('div'); head.className = 'head'; head.textContent = `Prop kit ${page === 2 ? 2 : 1}/2 · ${theme} · ${tier}${night ? ' · night' : ''}`; host.appendChild(head);
(window as unknown as { __sheet: unknown }).__sheet = { ready: true, stats };
