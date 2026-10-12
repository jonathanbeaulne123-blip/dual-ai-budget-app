/**
 * The Reach and the Greenway: what stands on the land (reach SPEC §1–§5; D-WW60…69 as built). The six lookouts' Lookout kit
 * (standing and seated viewers with the free lever, a bench, a panel; the land built their open rails), the Channel Hide and
 * the Marsh Hide blinds (the `hide` kind drawn on the PR 2 floors, enclosing the baked blind, no second collider), the osprey
 * pole (the landmark), nest boxes and snags, the Reach Gate (gateway, map board, bike racks, a drinking fountain), the Reed
 * Maze's sundial and the dipping platform's panel and net box, the Twin Crossing bays' benches, the Arch Pier's rod holders,
 * cleaning table and life ring, the Paddle Dock's kayaks, the Sunset Balcony and Bluff End (the pavilion) with their viewers,
 * the twelve floating reed rafts tethered to the Greenway's bents, and the island lantern along the boardwalk and the
 * Greenway with their night anchors (emissive cards only, LIGHT §3: the High Span's lights → the boardwalk → the Greenway).
 */
import type { BuildingRecord, Landmark, Lookout, PropRecord } from '../../types.ts';
import type { LightAnchor, Point3 } from '../../../world/definition.ts';
import { greenwayGaps } from '../../../land/structures/greenway.ts';
import { HORIZON_MANIFEST as M } from '../../../world/manifest.ts';
import { storyEye, storyLandmark } from '../../../world/story.ts';
import { frame, segDist, yawTo, type WaterEdge, type XY, type XYZ } from './geom.ts';
import { LOOKOUTS, OSPREY, lookoutFrame, type Site } from './site.ts';

/** The style the Reach's timber pieces draw in: the island's base materials (an unknown sheet falls back to them). */
export const REACH_STYLE = 'reach.marsh';
/** One run of night anchors (LIGHT §3): the boardwalk's lanterns first, then the Greenway's from the Gate outward. */
export const NIGHT_LINE = 'landing.reach:night';
/** The island lantern's head over its foot (kit/props lantern: the road kit's 2.6 eu post, head ≈ 2.83). */
const LANTERN_HEAD = 2.75;
/** The Greenway's open-water stretch (s, m): the deck on piles over the Bight (reach SPEC §4: 340 m over the sea). */
export const OPEN_WATER = [612, 955] as const;
const GP = M.structures.greenway.places as unknown as Record<string, Record<string, unknown>>;

/** The bridges' meeting bays (land/bridges: a flat 3 × 3 m standing area kept clear) that carry a lookout. */
const MEETINGS: Record<string, { bed: string; route: string }> = {
  springBay: { bed: 'structure.reachBoardwalk.meeting', route: 'structure.reachBoardwalk' },
  harbourBellLanding: { bed: 'structure.quayBridge.meeting', route: 'structure.quayBridge' },
};
/** The meeting square's frame: centre (its meeting bed's end), d along the bridge, p across it toward the lookout's view. */
function meetingSquare(site: Site, m: { bed: string; route: string }, facing: XY) {
  const bed = site.ctx.beds.find(b => b.id === m.bed), route = site.ctx.beds.find(b => b.id === m.route);
  if (!bed || !route) return null;
  const end = bed.points.at(-1)!, c: XY = [end[0], end[2]];
  let best = { d: Infinity, i: 1 }; for (let i = 1; i < route.points.length; i++) { const q = segDist(c[0], c[1], [route.points[i - 1]![0], route.points[i - 1]![2]], [route.points[i]![0], route.points[i]![2]]); if (q.d < best.d) best = { d: q.d, i }; }
  const a = route.points[best.i - 1]!, b = route.points[best.i]!, l = Math.hypot(b[0] - a[0], b[2] - a[2]) || 1, d: XY = [(b[0] - a[0]) / l, (b[2] - a[2]) / l];
  let p: XY = [d[1], -d[0]]; if (p[0] * facing[0] + p[1] * facing[1] < 0) p = [-p[0], -p[1]];
  // `lat`: which way along d is the viewer's right; `south`: the d direction whose end stands further south (the decks'
  // open sides face the boardwalk west and the bridge north).
  const lat = Math.sign(d[0] * Math.cos(Math.atan2(facing[0], facing[1])) - d[1] * Math.sin(Math.atan2(facing[0], facing[1]))) || 1;
  return { c, d, p, lat, south: d[1] >= 0 ? 1 : -1 };
}

export interface FixturesOut { buildings: BuildingRecord[]; props: PropRecord[]; landmarks: Landmark[]; lookouts: Lookout[]; lights: LightAnchor[]; stats: Record<string, number> }
const r3 = (v: number) => Math.round(v * 1000) / 1000;
const P3 = (x: number, y: number, z: number): Point3 => [r3(x), r3(y), r3(z)];

export function buildFixtures(site: Site, pools: ReturnType<WaterEdge['bodies']>): FixturesOut {
  const { ctx, L, bw } = site, buildings: BuildingRecord[] = [], props: PropRecord[] = [], landmarks: Landmark[] = [], lookouts: Lookout[] = [], lights: LightAnchor[] = [], stats: Record<string, number> = {};
  const prop = (id: string, kind: PropRecord['kind'], x: number, y: number, z: number, yaw: number, o: Partial<PropRecord> = {}) => { props.push({ id, kind, at: P3(x, y, z), yaw: r3(yaw), ...o }); stats[kind] = (stats[kind] ?? 0) + 1; };
  /** The baked floor under a point near `y` (a deck, a pad), else `y`. */
  const floor = (x: number, z: number, y: number, w = 0.8) => ctx.floorAt?.(x, z, y, w) ?? y;

  /* ---------------------------------------------------------------- the six lookouts (the Lookout kit) */
  for (const l of LOOKOUTS) {
    const F = lookoutFrame(l), at = (u: number, v: number): XYZ => { const q = F.W(u, v); return [q[0], floor(q[0], q[1], l.floor), q[1]]; };
    const eyeId = l.id;
    const meet = MEETINGS[l.id] ? meetingSquare(site, MEETINGS[l.id]!, F.f) : null;
    if (meet) {
      // A bridge's meeting bay (Spring Bay on the boardwalk, Harbour Bell Landing on the drawbridge): its flat 3 × 3 m standing
      // area stays clear (land/bridges/measure.ts meetingEnvelope); the kit stands in the ring round it, inside the rail.
      const P = (a: number, b: number): XYZ => { const x = meet.c[0] + meet.d[0] * a + meet.p[0] * b, z = meet.c[1] + meet.d[1] * a + meet.p[1] * b; return [x, floor(x, z, l.floor), z]; };
      const yawOf = (v: XY) => Math.atan2(v[0], v[1]), side = meet.south;
      prop(`reach.${eyeId}.viewer`, 'viewer', ...P(-0.7 * meet.lat, 2.45), F.yaw, { collide: true, variant: l.n % 4 });
      prop(`reach.${eyeId}.viewerSeated`, 'viewerSeated', ...P(0.7 * meet.lat, 2.45), F.yaw, { collide: true, variant: l.n % 4 });
      prop(`reach.${eyeId}.panel`, 'panel', ...P(side * 2.45, 0.9), yawOf([meet.d[0] * side, meet.d[1] * side]), { collide: true, variant: l.subject === 'heron' ? 0 : l.subject === 'lamp' ? 2 : 1 });
      // Harbour Bell's ring (r 3.65) seats a bench behind the square, facing the view; Spring Bay's (r 3.05) has no room.
      if (l.id === 'harbourBellLanding') prop(`reach.${eyeId}.bench`, 'bench', ...P(0, -2.55), yawOf(meet.p), { collide: true });
    } else if (l.kind !== 'hide') {
      const st = at(-0.7, l.front), se = at(0.7, l.front);
      prop(`reach.${eyeId}.viewer`, 'viewer', ...st, F.yaw, { collide: true, variant: l.n % 4 });
      prop(`reach.${eyeId}.viewerSeated`, 'viewerSeated', ...se, F.yaw, { collide: true, variant: l.n % 4 });
      const bench = l.kind === 'pad' ? at(0, -0.9) : l.id === 'springBay' ? at(0, -0.6) : at(0, -0.9);
      prop(`reach.${eyeId}.bench`, 'bench', ...bench, F.yaw, { collide: true });
      const panel = l.kind === 'pad' ? at(-2.6, 1.2) : l.id === 'springBay' ? at(-1.9, 1.15) : at(-2.4, 1.1);
      prop(`reach.${eyeId}.panel`, 'panel', ...panel, F.yaw, { collide: true, variant: l.subject === 'heron' ? 0 : l.subject === 'lamp' ? 2 : 1 });
    }
    // Story records: the registry's eye (STORY_EYES); the Channel Hide's is the seated eye at its south-west slot (no viewer).
    let eye: Point3;
    if (l.kind === 'hide') { const q = site.bw.at(56.2 + 0.6, -5.0); eye = P3(q[0], l.floor + 1.0, q[1]); }
    else { const reg = storyEye(l.id); eye = [reg.at[0], reg.y!, reg.at[1]]; }
    const targets = l.id === 'harbourBellLanding' ? ['lamp', 'osprey'] : l.id === 'springBay' ? ['campanile', 'osprey', 'lamp', 'heron'] : ['osprey', 'lamp', ...(l.subject !== 'osprey' && l.subject !== 'lamp' ? [l.subject] : [])];
    lookouts.push({ id: l.id, label: l.label, eye, facing: r3(F.yaw), targets, viewer: l.kind === 'hide' ? 'slots' : 'both', bestHour: l.hour });
  }

  /* ---------------------------------------------------------------- the Channel Hide: the blind on its PR 2 floor */
  { // The land's frame (land/structures/reach.ts hideFrame): the bay's centre 4.3 west of the deck at s 56.2; the blind
    // spans west −0.7…2.5 (3.2 deep), the floor 4.6 along. The grammar's hide encloses the baked walls by 1 cm each side
    // and its roof stands 4 cm over the baked roof (the baked blind keeps the collision: `collide: false`).
    const s = 56.2, west = (w: number) => bw.at(s, -4.3 - w), c = west(0.9), y = bw.y;
    const front: XY = [-bw.n[0], -bw.n[1]], yaw = Math.atan2(front[0], front[1]);
    buildings.push({ id: 'reach.channelHide', districtId: '', kind: 'hide', style: REACH_STYLE, at: P3(c[0], y + 0.01, c[1]), yaw: r3(yaw), size: { w: 4.62, d: 3.22, h: 2.36 }, roof: { form: 'shed', pitch: 7, overhang: 0.25, material: 'shingle' }, params: { slots: 'front,right', open: 'back', piles: true, allowOnBed: true }, collide: false });
    // A bench inside, facing the west slot.
    const b = west(1.55); prop('reach.channelHide.bench', 'bench', b[0], floor(b[0], b[1], y), b[1], yaw, { collide: true }); }

  /* ---------------------------------------------------------------- the boardwalk's trailheads (reach SPEC §1, v3) */
  // A plain timber gateway at each end of the boardwalk on S1's line (posts outside its tread, 2.6 headroom under the beam).
  for (const [i, s] of [[0, -3.2], [1, bw.len + 3.0]] as const) {
    const c = bw.rail(s, 1, 0), e = bw.rail(s, 1, 1), across: XY = [e[0] - c[0], e[1] - c[1]], y = floor(c[0], c[1], bw.y, 1.2);
    buildings.push({ id: `reach.trailhead.${i}`, districtId: '', kind: 'gate', style: REACH_STYLE, at: P3(c[0], y, c[1]), yaw: r3(Math.atan2(-across[1], across[0])), size: { w: 5.0, d: 0.44, h: 3.0 }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'timber' }, params: { gateStyle: 'timber' }, collide: true });
  }

  /* ---------------------------------------------------------------- the osprey pole: the landmark every lookout finds */
  { const [x, z] = OSPREY, g = ctx.heightAt(x, z), l = storyLandmark('osprey');
    prop('reach.ospreyPole', 'ospreyPole', x, g, z, 0.7, { collide: true });
    landmarks.push({ id: 'osprey', label: l.label, neighbourhood: 'landing', at: P3(x, g, z), top: P3(x, g + 11.5, z), ...(l.relayOrder ? { relayOrder: l.relayOrder } : {}) }); }

  /* ---------------------------------------------------------------- nest boxes and snags */
  { let k = 0;
    // Wood duck boxes (1.9 posts) at the Reach channels and tree swallow boxes (0.8) in its wet meadow (reach SPEC §3).
    for (const [x, z] of [[1229, 1281], [1233, 1266], [1314, 1262], [1323, 1301], [1298, 1238], [1229, 1310]] as XY[]) if (site.plantOk(x, z, 0.5, 0.2, { aquatic: true })) prop(`reach.duckBox.${k++}`, 'duckBox', x, ctx.heightAt(x, z), z, yawTo([x, z], [1260, 1250]), { scale: 1.15 });
    for (const [x, z] of [[1205, 1235], [1215, 1258], [1206, 1290], [1335, 1300], [1345, 1272], [1214, 1200]] as XY[]) if (site.plantOk(x, z, 0.5, 0.2, {})) prop(`reach.swallowBox.${k++}`, 'duckBox', x, ctx.heightAt(x, z), z, yawTo([x, z], [1260, 1250]), { scale: 0.8 });
    // The Greenway's pools (largest first along the line): seven wood duck boxes in them, four snags on their rims.
    const gw = pools.filter(p => p.cells < 600 && p.level > 1 && site.gw(p.c[0], p.c[1]).d < 60).sort((a, b) => site.gw(a.c[0], a.c[1]).s - site.gw(b.c[0], b.c[1]).s);
    let boxes = 0; gw.forEach((p, i) => { if (boxes >= 7 || i % 3 === 2) return; const a = i * 2.1, x = p.c[0] + Math.cos(a) * p.r * 0.45, z = p.c[1] + Math.sin(a) * p.r * 0.45;
      if (ctx.waterLevelAt(x, z) === null || ctx.bedClearance(x, z) < 1.5) return; prop(`greenway.duckBox.${boxes++}`, 'duckBox', x, ctx.heightAt(x, z), z, yawTo([x, z], p.c) + Math.PI, { scale: 1.15 }); });
    let snags = 0; for (const p of [...gw].filter(q => q.r > 5.5).sort((a, b) => b.r - a.r)) { if (snags >= 4) break;
      for (let t = 0; t < 16; t++) { const a = t / 16 * Math.PI * 2 + 0.4, x = p.c[0] + Math.cos(a) * (p.r + 1.0), z = p.c[1] + Math.sin(a) * (p.r + 1.0), e = site.edge.at(x, z);
        if (e < 0.3 || e > 1.6 || ctx.waterLevelAt(x, z) !== null || !site.plantOk(x, z, 7.5, 1.5, { tree: true })) continue;
        prop(`greenway.snag.${snags++}`, 'snag', x, ctx.heightAt(x, z), z, a, { collide: true }); break; } }
    // Tree swallow boxes along the Greenway's marsh stretch (reach SPEC §5): every 52 m from s 40 to 600, alternating sides,
    // 8–13 m off the centreline, on dry ground off every bed.
    { const rnd = ctx.rng('greenway.swallowBoxes'); let n = 0;
      for (let s = 40, k = 0; s <= 600; s += 52, k++) { const q = L.at(s), sd = k % 2 ? 1 : -1;
        for (let t = 0; t < 6; t++) { const w = q.W(sd * (8 + rnd() * 5), 0, (rnd() - 0.5) * 6), x = w[0], z = w[2];
          if (ctx.waterLevelAt(x, z) !== null || ctx.bedClearance(x, z) < 1.5 || !site.plantOk(x, z, 0.5, 0.2, {})) continue;
          prop(`greenway.swallowBox.${n++}`, 'duckBox', x, ctx.heightAt(x, z), z, yawTo([x, z], [q.p[0], q.p[2]]), { scale: 0.8 }); break; } }
      stats.greenwaySwallowBoxes = n; }
    stats.greenwayPools = gw.length; }

  /* ---------------------------------------------------------------- muskrat lodges in the Reach channels (reach SPEC §3) */
  // The Channel Hide's slot finds the first ([1236, 1292], its binocular subject); the others sit in the east channel's reeds.
  // A lodge stands in a channel's shallow water (its base 0.3 under the water), ≥ 7 m off the River Run's line (the canoe's).
  { const river = (M.water.river.lower as unknown as XY[]); let n = 0;
    const riverD = (x: number, z: number) => { let d = Infinity; for (let i = 1; i < river.length; i++) d = Math.min(d, segDist(x, z, river[i - 1]!, river[i]!).d); return d; };
    for (const [x0, z0, sc] of [[1236, 1292, 1.0], [1321, 1305, 0.85], [1314, 1268, 0.7]] as const) {
      let at: XY | null = null;
      for (let t = 0; t < 25 && !at; t++) { const a = t * 2.4, r = t === 0 ? 0 : 0.6 + t * 0.35, x = x0 + Math.cos(a) * r, z = z0 + Math.sin(a) * r, lvl = ctx.waterLevelAt(x, z);
        if (lvl === null || lvl < 0.6 || lvl - ctx.heightAt(x, z) > 1.0 || riverD(x, z) < 7 || ctx.bedClearance(x, z) < 2.2 * sc) continue;
        at = [x, z]; }
      if (!at) continue;
      const lvl = ctx.waterLevelAt(at[0], at[1])!;
      prop(`reach.lodge.${n++}`, 'lodge', at[0], lvl - 0.3, at[1], (x0 + z0) % 6.28, { scale: sc, collide: true }); }
    stats.lodges = n; }

  /* ---------------------------------------------------------------- the island lantern: the boardwalk, then the Greenway */
  let order = 0;
  const lantern = (id: string, x: number, y: number, z: number) => {
    prop(id, 'lantern', x, y, z, 0, { collide: true });
    lights.push({ id: `${id}.light`, at: P3(x, y + LANTERN_HEAD, z), kind: 'islandLantern', pool: P3(x, y, z), poolRadius: 2.6, line: NIGHT_LINE, order: order++ });
  };
  // The boardwalk: every 9 m from s 6, alternating, east first, on the rail line (±1.88) — the "Reach posts" (SPEC §1).
  for (let k = 0; k < 12; k++) { const s = 6 + 9 * k, q = bw.rail(s, k % 2 ? -1 : 1); lantern(`reach.boardwalk.lantern.${k}`, q[0], floor(q[0], q[1], bw.y), q[1]); }
  // The Greenway: every 12 m from s 6, alternating sides (left first), on the rail line (±3.05), never in a rail gap.
  { const gaps = { [-1]: greenwayGaps(-1), [1]: greenwayGaps(1) } as Record<number, number[][]>;
    for (let s = 6, k = 0; s < L.length - 2; s += 12, k++) { const sd = k % 2 ? 1 : -1;
      if (gaps[sd]!.some(g => s > g[0]! - 1 && s < g[1]! + 1)) continue;
      // Over a bridged crossing the rail line stands above another route's tread: no lantern there (plan rules are 2-D).
      const q = L.at(s).W(sd * 3.05); if (ctx.bedClearance(q[0], q[2]) < -0.4) continue;
      // Over the open water (s 612–955, the Bight crossing on piles) the lamp rides the rail post (the prototype's form):
      // an emissive card at the post top, no post of its own (the Bight's district budget, D-WW126).
      // So does every lamp in the Bight district (its land alone holds 145k / 59k of the 150k / 60k cap, D-WW129).
      if ((s > OPEN_WATER[0] && s < OPEN_WATER[1]) || ctx.districtAt(q[0], q[2]) === 'bight') { const top = L.at(s).W(sd * 3.05, 1.15); lights.push({ id: `greenway.railLamp.${k}.light`, at: P3(...top), kind: 'railLamp', pool: P3(q[0], q[1], q[2]), poolRadius: 2.2, line: NIGHT_LINE, order: order++ }); continue; }
      lantern(`greenway.lantern.${k}`, q[0], q[1], q[2]); } }

  /* ---------------------------------------------------------------- the far threshold (greenwayBluff): a bike rack at the deck's edge */
  { const t = (M.thresholds as unknown as { id: string; xy: XY }[]).find(q => q.id === 'greenwayBluff')!.xy;
    let best = { s: 0, d: Infinity }; for (let s = L.length - 80; s < L.length; s += 0.5) { const p = L.at(s).p, d = Math.hypot(p[0] - t[0], p[2] - t[1]); if (d < best.d) best = { s, d }; }
    const q = L.at(best.s - 5.5), w = q.W(2.66); prop('greenway.bluff.bikes', 'bikeRack', w[0], q.p[1], w[2], Math.atan2(-q.f[1], q.f[0]), { collide: true }); }

  /* ---------------------------------------------------------------- A · the Reach Gate */
  { const q = L.at(0), y = q.p[1], T = (off: number, fwd: number): XYZ => { const w = q.W(off, 0, fwd); return [w[0], floor(w[0], w[2], y), w[2]]; };
    const across: XY = [q.r[0], q.r[1]], gyaw = Math.atan2(-across[1], across[0]), g = T(0, 1.5);
    buildings.push({ id: 'greenway.reachGate', districtId: '', kind: 'gate', style: REACH_STYLE, at: P3(g[0], y, g[2]), yaw: r3(gyaw), size: { w: 6.9, d: 0.64, h: 4.3 }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'timber' }, params: { gateStyle: 'timber' }, collide: true });
    const back = Math.atan2(-q.f[0], -q.f[1]);
    prop('greenway.reachGate.map', 'mapBoard', ...T(-4.4, -9.5), back, { collide: true });
    for (const [i, fwd] of [[0, -5.6], [1, -8.4]] as const) prop(`greenway.reachGate.bikes.${i}`, 'bikeRack', ...T(4.7, fwd), Math.atan2(-q.f[1], q.f[0]), { collide: true });
    prop('greenway.reachGate.bench.0', 'bench', ...T(-4.6, -3.4), Math.atan2(q.r[0], q.r[1]), { collide: true });
    prop('greenway.reachGate.bench.1', 'bench', ...T(4.4, -11.5), Math.atan2(-q.r[0], -q.r[1]), { collide: true });
    prop('greenway.reachGate.fountain', 'fountain', ...T(-4.8, -12.6), back, { collide: true, scale: 0.4 }); }

  /* ---------------------------------------------------------------- B · the Reed Maze's sundial, the Dune Overlook, the dipping platform */
  { const B = GP.B as { maze: { c: XY }; overlook: { c: XY; face: XY } }, mc = B.maze.c;
    prop('greenway.maze.sundial', 'sundial', mc[0], ctx.heightAt(mc[0], mc[1]), mc[1], 0, { collide: true });
    // The Dune Overlook: viewers W(∓0.8, 2.0) toward the osprey pole (the prototype's frame), a bench, a panel.
    const O = B.overlook, F = frame(O.c, yawTo(O.c, O.face)), top = (() => { let m = -Infinity; for (let u = -3.5; u <= 3.5; u += 1) for (let v = -2.8; v <= 2.8; v += 1) { const w = F.W(u, v); m = Math.max(m, ctx.heightAt(w[0], w[1])); } return m + 0.55; })();
    const at = (u: number, v: number): XYZ => { const w = F.W(u, v); return [w[0], floor(w[0], w[1], top, 0.6), w[1]]; };
    prop('greenway.duneOverlook.viewer', 'viewer', ...at(-0.8, 2.0), F.yaw, { collide: true, variant: 1 });
    prop('greenway.duneOverlook.viewerSeated', 'viewerSeated', ...at(0.8, 2.0), F.yaw, { collide: true, variant: 1 });
    prop('greenway.duneOverlook.bench', 'bench', ...at(0, -1.0), F.yaw, { collide: true });
    prop('greenway.duneOverlook.panel', 'panel', ...at(-2.6, 1.3), F.yaw, { collide: true, variant: 0 });
    const v = at(-0.8, 2.0); lookouts.push({ id: 'duneOverlook', label: 'the Dune Overlook', eye: P3(v[0] + F.f[0] * 0.3, v[1] + 1.3, v[2] + F.f[1] * 0.3), facing: r3(F.yaw), targets: ['osprey', 'lamp'], viewer: 'both', bestHour: 'golden hour' });
    // The dipping platform (land/water/marsh.ts buildDippingPlatform: a deck 4.2 × 3.2 at its pool's level + 0.4).
    const pool = pools.find(p => Math.hypot(p.c[0] - 1066, p.c[1] - 1329) < 4);
    // The pool's generator centre is the land's (not this grid's centroid): find the platform's south edge on the baked deck.
    if (pool) { const y = pool.level + 0.4, guess = pool.c[1] + pool.r * 0.62; let south = guess + 1.0;
      if (ctx.floorAt) { let last: number | null = null; for (let z = guess - 4; z <= guess + 5; z += 0.05) if (ctx.floorAt(1066.6, z, y, 0.15) !== null) last = z; if (last !== null) south = last; }
      const c: XY = [1066.6, south - 1.0], Wd = (u: number, v2: number): XYZ => { const x = c[0] + u, z = c[1] - v2; return [x, floor(x, z, y, 0.5), z]; };
      prop('greenway.dip.panel', 'panel', ...Wd(1.25, 1.4), Math.PI, { collide: true, variant: 0 });
      prop('greenway.dip.netBox', 'crate', ...Wd(-1.3, 1.6), 0.3, { collide: true }); } }

  /* ---------------------------------------------------------------- C · the Twin Crossing bays: benches facing out, a panel each */
  for (const sd of [-1, 1]) {
    for (const s of [243.5, 250.5]) { const q = L.at(s), w = q.W(sd * 4.3); prop(`greenway.twinCrossing.bench.${sd < 0 ? 'l' : 'r'}${s}`, 'bench', w[0], floor(w[0], w[2], q.p[1]), w[2], Math.atan2(q.r[0] * sd, q.r[1] * sd), { collide: true }); }
    const q = L.at(241.4), w = q.W(sd * 5.4); prop(`greenway.twinCrossing.panel.${sd < 0 ? 'l' : 'r'}`, 'panel', w[0], floor(w[0], w[2], q.p[1]), w[2], Math.atan2(q.r[0] * sd, q.r[1] * sd), { collide: true, variant: 3 });
  }

  /* ---------------------------------------------------------------- the Marsh Hide (s 400, left): its blind and a bench */
  { const H = GP.hide as { s: number; o: number }, q = L.at(H.s), y = q.p[1], Wh = (off: number, fwd: number): XY => { const w = q.W(off, 0, fwd); return [w[0], w[2]]; };
    // Blind: off −3.25 (posts) … −8.76, fwd ±3.11 (enclosing the baked walls at −3.4…−8.7, ±3.05); front = outward (−r).
    const c = Wh(-6.005, 0), front: XY = [-q.r[0], -q.r[1]], yaw = Math.atan2(front[0], front[1]);
    buildings.push({ id: 'greenway.marshHide', districtId: '', kind: 'hide', style: REACH_STYLE, at: P3(c[0], y + 0.01, c[1]), yaw: r3(yaw), size: { w: 6.22, d: 5.51, h: 2.42 }, roof: { form: 'shed', pitch: 7, overhang: 0.25, material: 'shingle' }, params: { slots: 'front,right', open: 'back', piles: true, allowOnBed: true }, collide: false });
    const b = Wh(-7.6, 0); prop('greenway.marshHide.bench', 'bench', b[0], floor(b[0], b[1], y), b[1], yaw, { collide: true });
    const e = Wh(-7.9, 0.4); lookouts.push({ id: 'marshHide', label: 'the Marsh Hide', eye: P3(e[0], y + 1.0, e[1]), facing: r3(yaw), targets: ['heron', 'osprey', 'lamp'], viewer: 'slots', bestHour: 'dawn' }); }

  /* ---------------------------------------------------------------- E · the Arch Pier's T-head */
  { const E = GP.E as { path: XY[]; end_h: number; head_m: [number, number] }, c = E.path.at(-1)!, pr = E.path.at(-2)!, yaw = Math.atan2(c[0] - pr[0], c[1] - pr[1]), f: XY = [Math.sin(yaw), Math.cos(yaw)], r: XY = [-f[1], f[0]];
    const y = E.end_h, Wt = (u: number, v: number): XYZ => { const x = c[0] + r[0] * u + f[0] * v, z = c[1] + r[1] * u + f[1] * v; return [x, floor(x, z, y, 0.5), z]; }, hd = E.head_m[1];
    [-4.5, -1.5, 1.5, 4.5].forEach((u, i) => prop(`greenway.archPier.rod.${i}`, 'rodHolder', ...Wt(u, hd - 0.1), yaw));
    prop('greenway.archPier.table', 'picnicTable', ...Wt(-4.2, 2.6), yaw + Math.PI / 2, { collide: true });
    prop('greenway.archPier.bench.0', 'bench', ...Wt(-1.9, 1.2), yaw, { collide: true });
    prop('greenway.archPier.bench.1', 'bench', ...Wt(2.6, 1.2), yaw, { collide: true });
    prop('greenway.archPier.lifeRing', 'lifeRing', ...Wt(5.75, 2.4), yaw - Math.PI / 2, { collide: true }); }

  /* ---------------------------------------------------------------- F · the Paddle Dock: kayaks on the floating dock, a bench */
  { const F = GP.F as { s: number; dock_o: number; dock_h: number }, q = L.at(F.s), D = (off: number, fwd: number): XYZ => { const w = q.W(off, 0, fwd); return [w[0], floor(w[0], w[2], F.dock_h, 0.4), w[2]]; }, along = Math.atan2(q.f[0], q.f[1]);
    // Three kayaks in the dressing's hull colours and a fourth (the prototype's upturned green) beside them.
    ([[-F.dock_o - 0.75, -5.5, 0], [-F.dock_o + 0.15, -1.8, 1], [-F.dock_o - 0.75, 1.9, 2], [-F.dock_o + 0.15, 5.2, 3]] as const).forEach(([o, fw, v], i) => prop(`greenway.paddleDock.kayak.${i}`, 'kayak', ...D(o, fw), along + (i % 2 ? Math.PI : 0), { variant: v, collide: true }));
    prop('greenway.paddleDock.bench', 'bench', ...D(-F.dock_o - 1.2, -7.2 + 0.3), Math.atan2(-q.r[0], -q.r[1]), { collide: true }); }

  /* ---------------------------------------------------------------- G · the Sunset Balcony: viewers to the Lamp and the Bight Bridge arch */
  { const G = GP.G as { s: number }, q = L.at(G.s), grade = (L.at(G.s + 1).p[1] - L.at(G.s - 1).p[1]) / 2, Wg = (out: number, along: number): XYZ => { const w = q.W(-3.0 - out, along * grade, along); return [w[0], floor(w[0], w[2], w[1], 0.5), w[2]]; };
    const toLamp = (p: XYZ) => yawTo([p[0], p[2]], [540, 1195]);
    const st = Wg(4.2, -0.9), se = Wg(4.2, 0.9), th = Wg(3.4, -3.8);
    prop('greenway.sunsetBalcony.viewer', 'viewer', ...st, toLamp(st), { collide: true, variant: 2 });
    prop('greenway.sunsetBalcony.viewerSeated', 'viewerSeated', ...se, toLamp(se), { collide: true, variant: 2 });
    prop('greenway.sunsetBalcony.viewerBridge', 'viewer', ...th, yawTo([th[0], th[2]], [545, 1097]), { collide: true, variant: 2 });
    const out = Math.atan2(-q.r[0], -q.r[1]);
    prop('greenway.sunsetBalcony.bench.0', 'bench', ...Wg(1.3, 3.3), out - 0.45, { collide: true });
    prop('greenway.sunsetBalcony.bench.1', 'bench', ...Wg(1.3, -3.3), out + 0.45, { collide: true });
    prop('greenway.sunsetBalcony.panel', 'panel', ...Wg(2.6, 2.4), toLamp(Wg(2.6, 2.4)), { collide: true, variant: 2 });
    lookouts.push({ id: 'sunsetBalcony', label: 'the Sunset Balcony', eye: P3(st[0], st[1] + 1.3, st[2]), facing: r3(toLamp(st)), targets: ['lamp', 'bightBridge'], viewer: 'both', bestHour: 'golden hour' }); }

  /* ---------------------------------------------------------------- H · Bluff End: the pavilion, its benches, viewers to the Lamp */
  { const H = GP.H as { centre: XY; r_m: number }, c = H.centre, endP = L.at(L.length).p, y = endP[1], lampYaw = yawTo(c, [540, 1195]), inYaw = yawTo(c, [endP[0], endP[2]]);
    // The pavilion's open bay faces the deck's end (the walk arrives through it: the Bluff End bed runs from the deck's end to
    // the centre); its six benches face out round the ring, none across the walk's line.
    buildings.push({ id: 'greenway.bluffEnd.pavilion', districtId: '', kind: 'pavilion', style: REACH_STYLE, at: P3(c[0], y, c[1]), yaw: r3(inYaw), size: { w: 6.4, d: 6.4, h: 2.6 }, roof: { form: 'cone', pitch: 0, overhang: 1, material: 'slate' }, door: { face: 'front', u: 0 }, params: { rise: 1.6, allowOnBed: true }, collide: true });
    const inA = Math.atan2(endP[2] - c[1], endP[0] - c[0]);
    for (let k = 0; k < 6; k++) { const a = inA + ((k + 0.5) / 6) * Math.PI * 2, x = c[0] + Math.cos(a) * 2.2, z = c[1] + Math.sin(a) * 2.2;
      if (Math.abs(Math.atan2(Math.sin(a - inA), Math.cos(a - inA))) < 0.9) continue;
      prop(`greenway.bluffEnd.bench.${k}`, 'bench', x, floor(x, z, y), z, Math.atan2(Math.cos(a), Math.sin(a)), { collide: true }); }
    const F = frame(c, lampYaw), at = (u: number, v: number): XYZ => { const w = F.W(u, v); return [w[0], floor(w[0], w[1], y), w[1]]; };
    const st = at(-0.8, 6.4), se = at(0.8, 6.4);
    prop('greenway.bluffEnd.viewer', 'viewer', ...st, lampYaw, { collide: true, variant: 2 });
    prop('greenway.bluffEnd.viewerSeated', 'viewerSeated', ...se, lampYaw, { collide: true, variant: 2 });
    lookouts.push({ id: 'bluffEnd', label: 'Bluff End', eye: P3(st[0], st[1] + 1.3, st[2]), facing: r3(lampYaw), targets: ['lamp'], viewer: 'both', bestHour: 'golden hour' }); }

  /* ---------------------------------------------------------------- the floating reed rafts over the Bight (12) */
  { const rnd = ctx.rng('greenway.rafts'); let n = 0;
    for (let s = 630, k = 0; s < 948 && n < 12; s += 15 + rnd() * 10, k++) {
      const sd = k % 3 === 1 ? 1 : -1, q = L.at(s), off = sd * (6.2 + rnd() * 2.5), sc = 0.82 + rnd() * 0.4, tw = (rnd() - 0.5) * 0.4;
      if (sd < 0 && (Math.abs(s - 790) < 16 || Math.abs(s - 690) < 14 || Math.abs(s - 962) < 14)) continue;
      const w = q.W(off), x = w[0], z = w[2], lvl = ctx.waterLevelAt(x, z);
      if (lvl === null || ctx.heightAt(x, z) > lvl - 0.6) continue;
      // Clear of the deck's own places (the piers' and the dock's footprints).
      if (ctx.bedClearance(x, z) < 2 * sc + 0.4) continue;
      const top = lvl + 0.27, yaw = Math.atan2(q.f[0], q.f[1]) + tw, inner = q.W(sd * (Math.abs(off) - 2.0 * sc)), pile = q.W(sd * 2.55, -0.72);
      prop(`greenway.raft.${n++}`, 'raft', x, top, z, yaw, { scale: r3(sc), line: [P3(inner[0], top + 0.05, inner[2]), P3(pile[0], pile[1], pile[2])] });
    }
    stats.rafts = n; }

  void segDist;
  return { buildings, props, landmarks, lookouts, lights, stats };
}
