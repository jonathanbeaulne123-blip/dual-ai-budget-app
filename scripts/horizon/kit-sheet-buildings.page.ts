// The building grammar kit sheet (served by vite; driven by scripts/horizon/kit-sheet-buildings.mjs). One panel per
// fixture record of a neighbourhood group (kit/buildings/fixture.ts), drawn by the real `drawBuilding` into a real
// `CardBuilder`, in one dressing, tier and time of day, on the fixture's synthetic slope.
//   /scripts/horizon/kit-sheet-buildings.html?group=harbour&theme=classic&tod=day&tier=full
import * as THREE from 'three';
import { CardBuilder, paperGrain } from '../../src/harbour/art/cardScene.ts';
import { rgb, mix, type RGB } from '../../src/harbour/art/cardKit.ts';
import { drawBuilding, buildingJourneyShape, buildingPalette, buildingCollision, collisionPartMesh } from '../../src/harbour/horizon/kit/buildings/index.ts';
import { buildingFixtures, fixtureGround } from '../../src/harbour/horizon/kit/buildings/fixture.ts';
import { SCENE_DRESSING } from '../../src/harbour/scene/place.ts';
import { mountainArtPalette } from '../../src/harbour/mountain/art/palette.ts';
import type { BuildingRecord, DressingTheme } from '../../src/harbour/horizon/neighbourhoods/types.ts';

const q = new URLSearchParams(location.search);
const theme = (q.get('theme') ?? 'classic') as DressingTheme, tier = (q.get('tier') ?? 'full') as 'full' | 'lite', night = q.get('tod') === 'night', group = q.get('group') ?? 'harbour';
const only = q.get('only')?.split(',') ?? null, close = q.get('view') === 'close';
const W = Number(q.get('w') ?? 1600), H = Number(q.get('h') ?? 1000);
const GROUPS: Record<string, string[]> = {
  harbour: ['row.a', 'row.b', 'row.c', 'home', 'bank', 'campanile', 'loggia', 'kiosk'],
  crown: ['croft.big', 'croft.small', 'westwatch', 'longhouse', 'barn', 'shieling', 'lift.station', 'lift.tower'],
  hollow: ['kiln', 'cottage', 'studio', 'hollow.bridge'],
  scholars: ['library'],
  landing: ['boathouse', 'store.a', 'store.b', 'guard', 'shack', 'wheel'],
  flats: ['hangar', 'elevator', 'station', 'observatory', 'arch', 'hoodoo'],
  shared: ['pavilion', 'hide', 'deck', 'platform', 'windpump', 'shed', 'gate', 'wall'],
  row: ['row.a', 'row.b', 'row.c'],
};
const ids = only ?? GROUPS[group] ?? GROUPS.harbour!;
let recs = buildingFixtures((i) => [i * 120 + 60, 60]).filter((r) => ids.includes(r.id)).sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
// `group=street`: a packed row of Ligurian row houses stepping down the slope, as the solver lays them (one panel).
const street = group === 'street';
if (street) {
  const base = buildingFixtures().find((r) => r.id === 'row.a')!, widths = [8, 7, 6.2, 8, 5.5, 8, 7, 6.2, 8, 7], out: BuildingRecord[] = [];
  let x = 0;
  widths.forEach((w, i) => {
    const storeys = [3, 4, 3, 2, 3, 4, 3, 3, 2, 4][i]!, h = 3.7 + (storeys - 1) * 3 + ((i * 37) % 10) / 25, cx = x + w / 2, cz = 60;
    let floor = -Infinity; for (const u of [-1, 0, 1]) for (const v of [-1, 0, 1]) floor = Math.max(floor, fixtureGround(cx + u * w / 2, cz + v * 4.5));
    out.push({ ...base, id: `street.${i}`, size: { w, d: 9, h }, storeys, paint: i * 7 + 2, at: [cx, Math.round((floor + 0.2) * 4) / 4, cz], params: { altana: (i + 5) % 6 === 4 } });
    x += w + 0.25;
  });
  recs = out;
}
const host = document.getElementById('sheet')!; host.style.width = `${W}px`; host.style.height = `${H}px`;
const renderer = new THREE.WebGLRenderer({ antialias: tier === 'full', preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H); renderer.shadowMap.enabled = !night; renderer.shadowMap.type = THREE.PCFShadowMap; renderer.shadowMap.autoUpdate = false;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = night ? 1.15 : 1.2; renderer.setScissorTest(true);
host.appendChild(renderer.domElement);
const dressing = SCENE_DRESSING[theme], m = mountainArtPalette(dressing);
const col = (c: RGB) => new THREE.Color(c[0], c[1], c[2]);
const scene = new THREE.Scene();
const skyDay = rgb(theme === 'taylor' ? '#f2e3ea' : theme === 'newfoundland' ? '#dfe9ec' : '#e8dcc4');
scene.background = col(night ? rgb('#16233a') : mix(skyDay, rgb('#9cc3e0'), 0.6));
scene.fog = new THREE.Fog(col(night ? rgb('#18243a') : skyDay), 220, 700);
// Ground: one card mesh per record, on the fixture slope, lawn with a gravel apron.
const lawn = rgb(dressing.lawn), gravel = m.gravel;
for (const r of street ? [recs[Math.floor(recs.length / 2)]!] : recs) {
  const n = 48, S = street ? 160 : 110, pos: number[] = [], cs: number[] = [], uv: number[] = [];
  const P = (i: number, j: number) => { const x = r.at[0] - S / 2 + S * i / n, z = r.at[2] - S / 2 + S * j / n; return [x, fixtureGround(x, z), z] as const; };
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const a = P(i, j), b = P(i + 1, j), c = P(i + 1, j + 1), d = P(i, j + 1), mx = (a[0] + c[0]) / 2 - r.at[0], mz = (a[2] + c[2]) / 2 - r.at[2];
    const k = Math.abs(mz - r.size.d / 2 - 3) < 2.2 && Math.abs(mx) < r.size.w / 2 + 6 ? gravel : mix(lawn, rgb('#a9a86c'), 0.25 + 0.2 * Math.sin(i * 1.7 + j * 2.3));
    for (const p of [a, b, c, a, c, d]) { pos.push(...p); cs.push(...k); uv.push(p[0] / 2.5, p[2] / 2.5); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
  const mesh = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: true, map: paperGrain(), side: THREE.DoubleSide })); mesh.receiveShadow = true; scene.add(mesh);
}
const pal = buildingPalette(theme, 'shared');
const b = new CardBuilder(`sheet ${group}`, tier, { ink: night ? '#1a1a24' : (theme === 'taylor' ? '#523349' : theme === 'newfoundland' ? '#283f50' : '#30251f') });
for (const r of recs) drawBuilding(b, r, theme, fixtureGround, tier);
const build = b.finish({ glassOpacity: 0.3 });
scene.add(build.group);
// `collide=1`: the collision parts as wireframe over the drawing (walkable green, rails blue, the rest red).
if (q.get('collide') === '1') for (const r of recs) for (const part of buildingCollision(r, fixtureGround)) {
  const m = collisionPartMesh(part), g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(m.positions, 3)); g.setIndex(m.indices);
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(g, 1), new THREE.LineBasicMaterial({ color: part.walkable ? '#19c24a' : part.role === 'rail' ? '#2a6cff' : '#ff2a2a', depthTest: false, transparent: true, opacity: 0.85 }));
  lines.renderOrder = 10; scene.add(lines);
}
const glow = build.materials.glow as THREE.MeshBasicMaterial | undefined;
if (glow) { glow.transparent = true; glow.opacity = night ? 1 : 0.12; }
// STYLE §1.3.3: ink at night goes to #1a1a24 at 0.8 of its day opacity (the runtime's night ramp owns this; mirrored here).
const ink = build.materials.ink as THREE.LineBasicMaterial | undefined;
if (ink && night) { ink.color.setRGB(0.22, 0.22, 0.28); ink.opacity *= 0.8; }
// Contact shade is an unlit fixed dark: at night it must dim with the scene or it reads lighter than the ground.
const shadeMat = build.materials.shade as THREE.MeshBasicMaterial | undefined;
if (shadeMat && night) shadeMat.color.setScalar(0.2);
scene.add(new THREE.HemisphereLight(night ? '#40527a' : '#d9e7e8', night ? '#141010' : '#786b57', night ? 0.55 : 1.15));
const sun = new THREE.DirectionalLight(night ? '#9fb4d8' : '#fff0d5', night ? 0.45 : 2.3); sun.castShadow = !night; sun.shadow.mapSize.set(2048, 2048);
const sc = sun.shadow.camera; sc.near = 1; sc.far = 500; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.05; scene.add(sun, sun.target);
const n = street ? 1 : recs.length, cols = Math.min(n, Math.ceil(Math.sqrt(n * W / H))), rows = Math.ceil(n / cols), pw = Math.floor(W / cols), ph = Math.floor(H / rows);
const stats: Record<string, unknown> = {};
(street ? [recs[Math.floor(recs.length / 2)]!] : recs).forEach((r0: BuildingRecord, i) => {
  const r = street ? { ...r0, size: { w: 72, d: 14, h: 14 } } : r0;
  const s = buildingJourneyShape(r), top = s.roofHeight, rad = 0.5 * Math.hypot(r.size.w, r.size.d, top) + 1;
  const c = Math.cos(r.yaw), sn = Math.sin(r.yaw), dir = close ? [0.25, 0.18, 1] : [0.62, 0.42, 0.78];
  const lx = dir[0]!, lz = dir[2]!, wx = lx * c + lz * sn, wz = lz * c - lx * sn, L = Math.hypot(wx, dir[1]!, wz);
  const half = Math.atan(Math.tan(21 * Math.PI / 180) * Math.min(1, pw / ph)), dist = (close ? 0.55 : 1.02) * rad / Math.sin(half);
  const tgt = new THREE.Vector3(r.at[0], r.at[1] + top * (close ? 0.3 : 0.45), r.at[2]);
  const cam = new THREE.PerspectiveCamera(42, pw / ph, 0.3, 1200); cam.position.set(tgt.x + wx / L * dist, tgt.y + dir[1]! / L * dist, tgt.z + wz / L * dist); cam.lookAt(tgt);
  sun.position.set(r.at[0] - 60, r.at[1] + 90, r.at[2] + 70); sun.target.position.set(r.at[0], r.at[1], r.at[2]); sun.target.updateMatrixWorld();
  sc.left = sc.bottom = -rad * 1.6; sc.right = sc.top = rad * 1.6; sc.updateProjectionMatrix();
  const x = (i % cols) * pw, y = Math.floor(i / cols) * ph;
  renderer.setScissor(x, H - y - ph, pw, ph); renderer.setViewport(x, H - y - ph, pw, ph);
  renderer.shadowMap.needsUpdate = true; renderer.info.reset(); renderer.info.autoReset = false; renderer.render(scene, cam);
  stats[r.id] = { calls: renderer.info.render.calls };
  const tag = document.createElement('div'); tag.className = 'tag'; tag.style.left = `${x + 6}px`; tag.style.top = `${y + 6}px`; tag.textContent = street ? 'rowHouse × 10 · a packed street on the slope' : `${r.kind} · ${r.id}`; host.appendChild(tag);
});
const head = document.createElement('div'); head.className = 'head'; head.textContent = `kit/buildings · ${group} · ${theme} · ${night ? 'night' : 'day'} · ${tier} · SwiftShader, not device evidence`; host.appendChild(head);
void pal;
(window as unknown as { __sheet: unknown }).__sheet = { ready: true, stats };
