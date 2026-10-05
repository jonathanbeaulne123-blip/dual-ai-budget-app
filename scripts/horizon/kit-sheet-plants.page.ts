// The corridor planting kit sheet (served by vite; driven by scripts/horizon/kit-sheet-plants.mjs). Four panels, each a
// road strip with one sample verge (kit/plants/sample.ts), drawn by the real `createCorridorPlanting` in one dressing,
// season and tier: A palm grove + flower-bed verge (Long Sands), B maple avenue with hedges (Harbour Avenue), C
// wind-bent pines + heath framing group (Crown Coast), D prairie drifts (the Flats).
//   /scripts/horizon/kit-sheet-plants.html?theme=classic&season=summer&tier=full[&month=7]
import * as THREE from 'three';
import { createCorridorPlanting } from '../../src/harbour/horizon/runtime/corridorPlanting.ts';
import { corridorPlantingDistricts } from '../../src/harbour/horizon/runtime/corridorPlanting.ts';
import { SAMPLE_LENGTH, SAMPLE_ORIGIN, SAMPLE_Y, STAND_ORIGIN, samplePlanting, sampleStand, type SampleStand, type SampleVerge } from '../../src/harbour/horizon/kit/plants/sample.ts';
import { mountainArtPalette } from '../../src/harbour/mountain/art/palette.ts';
import { SCENE_DRESSING } from '../../src/harbour/scene/place.ts';
import { paperGrain, CARD_CLOCK } from '../../src/harbour/art/cardScene.ts';
import { mix, shade, rgb, type RGB } from '../../src/harbour/art/cardKit.ts';
import type { Corridor } from '../../src/harbour/horizon/land/corridor/types.ts';

const q = new URLSearchParams(location.search);
const theme = (q.get('theme') ?? 'classic') as 'classic' | 'taylor' | 'newfoundland', season = (q.get('season') ?? 'summer') as 'spring' | 'summer' | 'autumn' | 'winter', tier = (q.get('tier') ?? 'full') as 'full' | 'lite';
const month = q.get('month') ? Number(q.get('month')) : undefined;
const W = Number(q.get('w') ?? 1600), H = Number(q.get('h') ?? 1000);
const pal = mountainArtPalette(SCENE_DRESSING[theme]), dressing = SCENE_DRESSING[theme];
const host = document.getElementById('sheet')!; host.style.width = `${W}px`; host.style.height = `${H}px`;
const renderer = new THREE.WebGLRenderer({ antialias: tier === 'full', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.25; renderer.setScissorTest(true);
host.appendChild(renderer.domElement);
CARD_CLOCK.value = 3.1;

const winter = season === 'winter';
const col = (c: RGB) => new THREE.Color(c[0], c[1], c[2]);
/** A flat-shaded card mesh from quads (vertex colour), with the paper grain, as the card kit draws ground and road. */
function card(quads: { p: [number, number, number][]; c: RGB }[]): THREE.Mesh {
  const pos: number[] = [], cs: number[] = [], uv: number[] = [];
  for (const { p, c } of quads) for (const i of [0, 1, 2, 0, 2, 3]) { pos.push(...p[i]!); cs.push(...c); uv.push(p[i]![0] / 2.5, p[i]![2] / 2.5); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, map: paperGrain(), side: THREE.DoubleSide })); m.receiveShadow = true; return m;
}
type Panel = { verge: string; label: string; scene: THREE.Scene; camera: THREE.PerspectiveCamera; sun: THREE.DirectionalLight; planting: ReturnType<typeof createCorridorPlanting>; resident: Set<string> };
const LABELS: Record<SampleVerge, string> = { palms: 'Long Sands — palm grove + flower-bed verge', avenue: 'Harbour Avenue — maple avenue, hedges, meadow beds', pines: 'Crown Coast — wind-bent pines + heath (sea side open)', prairie: 'The Flats — prairie drifts, bluestem, gaps at the views' };
function panel(verge: SampleVerge): Panel {
  const scene = new THREE.Scene(), [ox, oz] = SAMPLE_ORIGIN[verge], y = SAMPLE_Y;
  const skyDay = theme === 'taylor' ? '#f2e3ea' : theme === 'newfoundland' ? '#dfe9ec' : '#e8dcc4';
  scene.background = col(mix(rgb(skyDay), rgb(winter ? '#b9c9d8' : '#8fbde0'), 0.72));
  scene.fog = new THREE.Fog(col(rgb(skyDay)), 140, 520);
  const lawn = rgb(verge === 'prairie' ? '#a9a86c' : dressing.lawn), ground = winter ? mix(lawn, rgb('#b9b39a'), 0.45) : lawn, sand = rgb(theme === 'newfoundland' ? '#b3aa9a' : '#e0cfa5');
  const L = 400, x0 = ox - 150, x1 = ox + 250, quads: { p: [number, number, number][]; c: RGB }[] = [];
  // Ground either side; the sea side of the coastal panels is sand then water.
  const seaSide = verge === 'palms' ? -1 : verge === 'pines' ? 1 : 0;
  for (const side of [1, -1]) {
    const near = side * 5, far = side * 220, isSea = side === seaSide;
    if (isSea) { quads.push({ p: [[x0, y - 0.02, oz + near], [x1, y - 0.02, oz + near], [x1, y - 0.3, oz + side * 26], [x0, y - 0.3, oz + side * 26]], c: verge === 'pines' ? shade(ground, 0.95) : sand }); }
    else quads.push({ p: [[x0, y - 0.02, oz + near], [x1, y - 0.02, oz + near], [x1, y - 0.02, oz + far], [x0, y - 0.02, oz + far]], c: ground });
  }
  // The road: v2's swept bands (edge darker toward the verge, paler crown), a centre dash.
  const road = pal.road, band = (a: number, b: number, c: RGB) => quads.push({ p: [[x0, y, oz + a], [x1, y, oz + a], [x1, y, oz + b], [x0, y, oz + b]], c });
  band(-5, -4.45, mix(road, pal.verge, 0.45)); band(-4.45, -0.45, road); band(-0.45, 0.45, mix(road, pal.chalk, 0.12)); band(0.45, 4.45, road); band(4.45, 5, mix(road, pal.verge, 0.45));
  for (let a = -150; a < 250; a += 9) quads.push({ p: [[ox + a, y + 0.01, oz - 0.06], [ox + a + 3, y + 0.01, oz - 0.06], [ox + a + 3, y + 0.01, oz + 0.06], [ox + a, y + 0.01, oz + 0.06]], c: rgb('#efe7d2') });
  scene.add(card(quads));
  if (seaSide) { const sea = new THREE.Mesh(new THREE.PlaneGeometry(L, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: dressing.sea, roughness: 0.5 })); sea.position.set(ox + 50, y - 0.25, oz + seaSide * (26 + 150)); scene.add(sea); }
  // Light: the runtime's hemisphere + one sun with a shadow box over the verge.
  scene.add(new THREE.HemisphereLight('#d9e7e8', '#786b57', 1.2));
  const sun = new THREE.DirectionalLight('#fff0d5', winter ? 1.7 : 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = c.bottom = -70; c.right = c.top = 70; c.near = 1; c.far = 400; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.05;
  const elev = winter ? 0.42 : 0.95; sun.position.set(ox + 30 - 120 * Math.cos(elev) * 0.6, y + 160 * Math.sin(elev), oz + 150 * Math.cos(elev)); sun.target.position.set(ox + 30, y, oz); scene.add(sun, sun.target);
  // The planting: the real runtime module over a one-corridor world carrying this verge.
  const corridor: Corridor = { id: 'SHEET', closed: false, step: 2, stations: [], reaches: [], markings: [], guards: [], lamps: [], planting: samplePlanting(verge), stops: [] };
  const world = { corridors: [corridor] }, planting = createCorridorPlanting(world, { tier, theme, season, month });
  scene.add(planting.group);
  // Pose: the activity camera's height (2.6 over the rider), in the lane, looking along the verge.
  const camera = new THREE.PerspectiveCamera(50, (W / 2) / (H / 2), 0.3, 900);
  const poses: Record<SampleVerge, [number, number, number, number, number, number]> = {
    palms: [-10, -2.6, 3.4, 28, 8, 3.2], avenue: [-6, 2, 3.2, 40, 1.5, 3.4], pines: [-6, 2.2, 3.4, 24, -10, 3], prairie: [-8, 2, 3.2, 36, 3, 1.4],
  };
  // `view=close`: a near look at the verge (for judging the cards against v2's at 10–20 eu).
  const close: Record<SampleVerge, [number, number, number, number, number, number]> = {
    palms: [2, 3.2, 2.6, 16, 12, 2.6], avenue: [-6, 3, 2.6, 10, 8, 2], pines: [4, -3.5, 2.6, 18, -12, 2.4], prairie: [-2, 3.5, 2.4, 12, 8, 0.6],
  };
  const [ea, eo, ey, ta, to, ty] = (q.get('view') === 'close' ? close : poses)[verge]; camera.position.set(ox + ea, y + ey, oz + eo); camera.lookAt(ox + ta, y + ty, oz + to);
  return { verge, label: LABELS[verge], scene, camera, sun, planting, resident: corridorPlantingDistricts(world) };
}
// `set=ww`: the Water's Way stands (marsh, woods, warm coast, prairie + orchard); `set=oak`: the Old Oak far and near.
const STAND_LABELS: Record<SampleStand, string> = { marsh: 'The Reach — pool, lilies, reeds/cattails, sedge, willow, tamarack, dogwood', woods: "Scholars' Edge — ferns, spruce/balsam/cedar/tamarack, woodland cards behind", coast: 'Warm coast — fan + canary palms, olive, cypress, stone pine, lemons, bougainvillea, iceplant', prairie: 'The Flats & the Hollow — tallgrass, juniper/cedar clump, apple orchard', oak: 'The Old Oak' };
function standPanel(stand: SampleStand, view: 'far' | 'near' = 'far'): Panel {
  const scene = new THREE.Scene(), [ox, oz] = STAND_ORIGIN[stand], y = SAMPLE_Y;
  const skyDay = theme === 'taylor' ? '#f2e3ea' : theme === 'newfoundland' ? '#dfe9ec' : '#e8dcc4';
  scene.background = col(mix(rgb(skyDay), rgb(winter ? '#b9c9d8' : '#8fbde0'), 0.72)); scene.fog = new THREE.Fog(col(rgb(skyDay)), 160, 700);
  const lawn = rgb(stand === 'prairie' ? '#a9a86c' : stand === 'marsh' ? '#8a9258' : stand === 'woods' ? '#6d7f4f' : stand === 'coast' ? '#c9b98f' : dressing.lawn), ground = winter ? mix(lawn, rgb('#e6e6df'), 0.55) : lawn;
  const quads: { p: [number, number, number][]; c: RGB }[] = [{ p: [[ox - 300, y - 0.02, oz - 300], [ox + 300, y - 0.02, oz - 300], [ox + 300, y - 0.02, oz + 300], [ox - 300, y - 0.02, oz + 300]], c: ground }];
  if (stand === 'marsh') quads.push({ p: [[ox + 5, y + 0.01, oz - 4.5], [ox + 19, y + 0.01, oz - 4.5], [ox + 19, y + 0.01, oz + 6.5], [ox + 5, y + 0.01, oz + 6.5]], c: rgb(theme === 'taylor' ? '#a9c9dd' : theme === 'newfoundland' ? '#4f98aa' : '#6aa2ab') });
  if (stand === 'coast') { const wall = rgb(theme === 'newfoundland' ? '#c8453a' : theme === 'taylor' ? '#f1d6de' : '#e6b39a');
    quads.push({ p: [[ox + 20, y, oz - 6], [ox + 32, y, oz - 6], [ox + 32, y + 4.6, oz - 6], [ox + 20, y + 4.6, oz - 6]], c: wall }, { p: [[ox - 20, y - 0.01, oz + 2], [ox + 70, y - 0.01, oz + 2], [ox + 70, y - 0.01, oz + 12], [ox - 20, y - 0.01, oz + 12]], c: rgb('#e0cfa5') }); }
  scene.add(card(quads));
  scene.add(new THREE.HemisphereLight('#d9e7e8', '#786b57', 1.2));
  const sun = new THREE.DirectionalLight('#fff0d5', winter ? 1.7 : 2.2); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const big = stand === 'oak' ? 60 : 55, c = sun.shadow.camera; c.left = c.bottom = -big; c.right = c.top = big; c.near = 1; c.far = 500; sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.05;
  const cx = ox + (stand === 'oak' ? 0 : 20), cz = oz - (stand === 'oak' ? 0 : 12);
  sun.position.set(cx - 70, y + 150, cz + 110); sun.target.position.set(cx, y, cz); scene.add(sun, sun.target);
  const corridor: Corridor = { id: 'SHEET', closed: false, step: 2, stations: [], reaches: [], markings: [], guards: [], lamps: [], planting: sampleStand(stand), stops: [] };
  const world = { corridors: [corridor] }, planting = createCorridorPlanting(world, { tier, theme, season, month });
  scene.add(planting.group);
  if (stand === 'oak') { const person = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.7, 8), new THREE.MeshStandardMaterial({ color: '#c8453a' })); person.position.set(ox + 3, y + 0.85, oz + 16); scene.add(person); }
  const camera = new THREE.PerspectiveCamera(stand === 'oak' && view === 'near' ? 62 : 50, (W / (stand === 'oak' ? 2 : 2)) / (H / (stand === 'oak' ? 1 : 2)), 0.3, 1200);
  const poses: Record<SampleStand, [number, number, number, number, number, number]> = { marsh: [-2, 22, 12, 13, -6, 0.5], woods: [-6, 16, 4, 22, -18, 5], coast: [-8, 24, 4, 26, -8, 6], prairie: [-8, 14, 3.4, 26, -16, 2], oak: [-20, 95, 8, 0, 0, 16] };
  const near: [number, number, number, number, number, number] = [6, 22, 1.7, -4, -2, 9];
  // `view=close`: a near look (10–25 eu) to judge the cards against v2's.
  const closePose: Record<SampleStand, [number, number, number, number, number, number]> = { marsh: [20, 8, 3.2, 30, -6, 3], woods: [8, 2, 2.2, 14, -14, 4], coast: [10, 4, 2.4, 20, -10, 8], prairie: [26, -10, 2.4, 32, -30, 2.2], oak: near };
  const [ex, ez, ey, tx, tz, ty] = stand === 'oak' && view === 'near' ? near : q.get('view') === 'close' ? closePose[stand] : poses[stand]; camera.position.set(ox + ex, y + ey, oz + ez); camera.lookAt(ox + tx, y + ty, oz + tz);
  return { verge: `${stand}${stand === 'oak' ? `-${view}` : ''}`, label: `${STAND_LABELS[stand]}${stand === 'oak' ? (view === 'near' ? ' — under the crown' : ' — from 95 eu') : ''}`, scene, camera, sun, planting, resident: corridorPlantingDistricts(world) };
}
const set = q.get('set') ?? 'road';
const panels = set === 'ww' ? (['marsh', 'woods', 'coast', 'prairie'] as SampleStand[]).map(s => standPanel(s)) : set === 'oak' ? [standPanel('oak', 'far'), standPanel('oak', 'near')] : (['palms', 'avenue', 'pines', 'prairie'] as SampleVerge[]).map(panel);
const tall = set === 'oak';
const stats: Record<string, unknown> = {};
for (const [i, p] of panels.entries()) {
  const x = (i % 2) * (W / 2), yTop = tall ? 0 : Math.floor(i / 2) * (H / 2);
  p.planting.update(p.camera, p.resident);
  const ph = tall ? H : H / 2; renderer.setScissor(x, H - yTop - ph, W / 2, ph); renderer.setViewport(x, H - yTop - ph, W / 2, ph);
  renderer.shadowMap.needsUpdate = true; renderer.info.reset(); renderer.info.autoReset = false;
  renderer.render(p.scene, p.camera);
  stats[p.verge] = { planting: p.planting.stats(), render: { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles } };
  const tag = document.createElement('div'); tag.className = 'tag'; tag.style.left = `${x + 10}px`; tag.style.top = `${yTop + 8}px`; tag.textContent = `${'ABCD'[i]}  ${p.label}`; host.appendChild(tag);
}
const head = document.createElement('div'); head.className = 'head'; head.textContent = `Corridor planting · ${theme} · ${season}${month ? ` (month ${month})` : ''} · ${tier}`; host.appendChild(head);
(window as unknown as { __sheet: unknown }).__sheet = { ready: true, stats };
