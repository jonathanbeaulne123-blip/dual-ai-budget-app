/**
 * The Reach and the Greenway: the marsh's planting (reach SPEC §3 and §5; the prototypes reach-v2.mjs and _marsh.mjs ported
 * onto the real kit). Zonation by the signed water edge (`WaterEdge`): reeds and cattails ring every pool and channel and
 * reach the boardwalk's rail (hand height), sedge is the wet floor (never lawn), drifts of the marsh flowers (Joe-Pye,
 * cardinal flower, swamp milkweed; iris and marsh marigold at the water; the bog set by the boardwalk — Newfoundland's
 * bakeapple and pitcher plant), lilies in the channels and pools, willow and tamarack groves on the dry hummocks with red-osier
 * dogwood, the Reed Maze's cattail walls, and wind-bent pine and spruce at the Greenway's bluff end. No palms (STYLE §2.0).
 * Deterministic: every stream is `ctx.rng(<name>)`.
 */
import type { GroundPaint, PlantRecord } from '../../types.ts';
import { FLOWER_SET } from '../../../kit/plants/sets.ts';
import { HORIZON_MANIFEST as M } from '../../../world/manifest.ts';
import { clamp, fbm, inPoly, polyDist, polyEdgeDist, smooth, type XY } from './geom.ts';
import { BOATHOUSE, DECK_PREFIXES, HERON, LOOKOUTS, MEADOW, PAGE_I, REACH_POLY, SANDS_FIELD, SPRING, type Site } from './site.ts';

/** Drawn heights (eu) at scale 1 (kit/plants/wwGeometry.ts): a reed clump ≈ 2.2, a cattail spike 2.35, sedge 0.85. */
export const UNIT_H = { reed: 2.2, cattail: 2.35, sedge: 0.85, willow: 9.5, tamarack: 9.6, dogwood: 2.4, pine: 8, spruce: 11, flowerBed: 0.7 } as const;
const TAU = Math.PI * 2;
/** How many wild drifts each part carries (each ≈ 330 / 200 triangles full / lite, all kept on lite). */
export const DRIFTS = { reach: 18, bog: 6, greenway: 6 } as const;
/** Reed Maze (D-WW66): mown rings on the ground, reed walls between them (dressing, not collision). */
export const MAZE = M.structures.greenway.places.B.maze as unknown as { c: XY; r: number; wall_r: number; rings: number[] };

export interface MarshOut { plants: PlantRecord[]; ground: GroundPaint[]; stats: Record<string, number> }

export function plantMarsh(site: Site): MarshOut {
  const { ctx, edge, bw, L } = site, plants: PlantRecord[] = [], stats: Record<string, number> = {};
  const count = (k: string) => { stats[k] = (stats[k] ?? 0) + 1; };
  const add = (species: PlantRecord['species'], x: number, z: number, scale: number, yaw: number, extra: Partial<PlantRecord> = {}, y = ctx.heightAt(x, z)) => {
    // Baked numbers stay short and exact (the bake serialises to 9 decimals; a rebuild must equal the bake's records).
    const e: Partial<PlantRecord> = { ...extra, ...(extra.tint !== undefined ? { tint: r3(extra.tint) } : {}), ...(extra.lean !== undefined ? { lean: r3(extra.lean) } : {}) };
    plants.push({ species, at: [r3(x), r3(y), r3(z)], scale: r3(scale), yaw: r3(yaw), ...e }); count(species);
  };
  const eyes: XY[] = [[PAGE_I.eye[0], PAGE_I.eye[2]], ...LOOKOUTS.map(l => l.at)];
  const heroD = (x: number, z: number) => Math.min(...eyes.map(e => Math.hypot(x - e[0], z - e[1])));
  const inReach = (x: number, z: number) => inPoly(x, z, REACH_POLY) || polyEdgeDist(x, z, REACH_POLY) < 14;
  const bwd = (x: number, z: number) => bw.dist(x, z);
  const inMaze = (x: number, z: number, m = 0) => Math.hypot(x - MAZE.c[0], z - MAZE.c[1]) < MAZE.wall_r + 0.6 + m;
  const keepB = (x: number, z: number) => inMaze(x, z, 0.5) || Math.hypot(x - 1049, z - 1356) < 9;

  /* ---------------------------------------------------------------- the Reach: reeds and cattails (v2) */
  { const rnd = ctx.rng('reach.reeds');
    for (let gx = 1146; gx < 1384; gx += 1.3) for (let gz = 1166; gz < 1374; gz += 1.3) {
      const x = gx + (rnd() - 0.5) * 1.15, z = gz + (rnd() - 0.5) * 1.15, roll = rnd(), hr = rnd(), kind = rnd(), yaw = rnd() * TAU, tint = rnd();
      if (!inReach(x, z)) continue;
      const g = ctx.heightAt(x, z); if (g > 6.2 || g < 0.6) continue;
      const we = edge.at(x, z), d = bwd(x, z);
      let p = we < -0.9 ? 0 : we < 0 ? 0.7 : we < 4 ? 0.95 : 0.95 + (0.22 - 0.95) * clamp((we - 4) / 5, 0, 1);
      if (we > 9) p = g < 4.6 ? 0.06 : 0;
      if (d < 6 && g < 5) p = Math.max(p, 0.9);
      if (Math.hypot(x - PAGE_I.eye[0], z - PAGE_I.eye[2]) < 16 && g < 5.4) p = Math.max(p, 0.8);
      p *= smooth(-0.5, 0.05, fbm(x * 0.055 + 3, z * 0.055 - 7));
      if (roll > p) continue;
      // Beside the deck the tops reach the rail line (deck + 1.05 + 0.35): reeds at hand height (STYLE page I).
      let H = 1.9 + hr * 0.75; if (d < 4.5) H = clamp(Math.max(H, bw.y + 1.4 - g), 1.9, 2.9);
      const sp = kind < 0.32 ? 'cattail' : 'reed';
      if (!site.plantOk(x, z, H, 0.45, { aquatic: true })) continue;
      add(sp, x, z, H / UNIT_H[sp], yaw, { tint });
    } }

  /* ---------------------------------------------------------------- the Reach: sedge tussocks, the wet floor */
  { const rnd = ctx.rng('reach.sedge');
    for (let gx = 1165; gx < 1380; gx += 1.7) for (let gz = 1170; gz < 1370; gz += 1.7) {
      const x = gx + (rnd() - 0.5) * 1.5, z = gz + (rnd() - 0.5) * 1.5, roll = rnd(), s = 0.75 + rnd() * 0.55, yaw = rnd() * TAU, tint = rnd();
      if (!inPoly(x, z, REACH_POLY)) continue;
      const we = edge.at(x, z); if (we < 3 || we > 34 || ctx.heightAt(x, z) > 6.5) continue;
      if (roll > 0.55 * smooth(-0.6, 0.2, fbm(x * 0.07 - 2, z * 0.07 + 5))) continue;
      if (!site.plantOk(x, z, UNIT_H.sedge * s, 0.3, { aquatic: true })) continue;
      add('sedge', x, z, s, yaw, { tint });
    } }

  /* ---------------------------------------------------------------- lilies: the Reach channels' pools */
  { const rnd = ctx.rng('reach.lilies'), chans = (M.water.reachChannels as unknown as XY[][]);
    for (const ch of chans) for (let k = 0; k < 90; k++) {
      const seg = rnd() < 0.5 ? 0 : 1, t = 0.12 + rnd() * 0.84, a = ch[seg]!, b = ch[seg + 1]!, x = a[0] + (b[0] - a[0]) * t + (rnd() - 0.5) * 5, z = a[1] + (b[1] - a[1]) * t + (rnd() - 0.5) * 5, yaw = rnd() * TAU, s = 0.8 + rnd() * 0.5, tint = rnd();
      if (edge.at(x, z) > -0.8 || fbm(x * 0.12, z * 0.12) < -0.05) continue;
      const lvl = ctx.waterLevelAt(x, z); if (lvl === null || lvl < 0.6) continue;
      if (!site.plantOk(x, z, 0.05, 0.6, { aquatic: true })) continue;
      add('lily', x, z, s, yaw, { tint }, lvl);
    } }

  /* ---------------------------------------------------------------- the spring's lip: fern and heath round the source rock */
  // Sixteen low plants on the ring just outside the spring's open water (reach SPEC §3 "spring lip"); none over 0.85, so the
  // page I view of the source rock stays open (the corridor's own rule still applies).
  { const rnd = ctx.rng('reach.springLip'); let n = 0;
    for (let k = 0; k < 80 && n < 16; k++) {
      const a = rnd() * TAU, f = 1.25 + rnd() * 0.5, x = SPRING.c[0] + Math.cos(a) * SPRING.r[0] * f, z = SPRING.c[1] + Math.sin(a) * SPRING.r[1] * f, fern = rnd() < 0.6, sc = 0.9 + rnd() * 0.4, yaw = rnd() * TAU, tint = rnd();
      const sp = fern ? 'fern' : 'heath', h = (fern ? 0.6 : 0.5) * sc;
      if (ctx.waterLevelAt(x, z) !== null || !site.plantOk(x, z, h, 0.5, {})) continue;
      add(sp, x, z, sc, yaw, { tint }); n++;
    }
    stats.springLip = n; }

  /* ---------------------------------------------------------------- groves on the dry hummocks: willow, tamarack, dogwood */
  const trees: XY[] = [];
  const grove = (ax: number, az: number, kind: 'willow' | 'tamarack', n: number, sp: number, rnd: () => number) => {
    for (let k = 0; k < n; k++) {
      const a = rnd() * TAU, r = Math.sqrt(rnd()) * sp * 1.5, x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r, s = 0.85 + rnd() * 0.35, yaw = rnd() * TAU, tint = rnd(), lean = (rnd() - 0.5) * 0.2;
      if (edge.at(x, z) < 1.5 || heroD(x, z) < 20 || trees.some(t => Math.hypot(t[0] - x, t[1] - z) < 3.2)) continue;
      if (!site.plantOk(x, z, UNIT_H[kind] * s, kind === 'willow' ? 4.2 * s : 2.2 * s, { tree: true })) continue;
      trees.push([x, z]); add(kind, x, z, s, yaw, { tint, ...(kind === 'willow' ? { lean } : {}) });
    }
    for (let k = 0; k < 3; k++) {
      const a = rnd() * TAU, r = sp * 1.6 + rnd() * 4, x = ax + Math.cos(a) * r, z = az + Math.sin(a) * r, s = 0.8 + rnd() * 0.4, yaw = rnd() * TAU, tint = rnd();
      if (edge.at(x, z) < 0.5 || !site.plantOk(x, z, UNIT_H.dogwood * s, 1.1, {})) continue;
      add('dogwood', x, z, s, yaw, { tint });
    }
  };
  { const rnd = ctx.rng('reach.groves'), anchors: [number, number, 'willow' | 'tamarack'][] = [];
    for (let t = 0; t < 1400 && anchors.length < 10; t++) {
      const x = 1165 + rnd() * 215, z = 1170 + rnd() * 200;
      if (!inPoly(x, z, REACH_POLY)) continue;
      const we = edge.at(x, z); if (we < 4 || we > 26) continue;
      if (heroD(x, z) < 24 || Math.hypot(x - SPRING.c[0], z - SPRING.c[1]) < 16 || anchors.some(a => Math.hypot(a[0] - x, a[1] - z) < 40)) continue;
      if (!site.plantOk(x, z, 10, 3, { tree: true })) continue;
      anchors.push([x, z, we < 11 ? 'willow' : 'tamarack']);
    }
    for (const [x, z, kind] of anchors) grove(x, z, kind, 5 + Math.floor(rnd() * 4), kind === 'willow' ? 4.8 : 3.4, rnd);
    stats.groves = anchors.length; }

  /* ---------------------------------------------------------------- drifts: the marsh set, the water's edge, the bog margin */
  const drift = (x: number, z: number, set: number, scale: number, yaw: number, tint: number) => {
    if (!site.plantOk(x, z, UNIT_H.flowerBed * scale, 2 * scale, {})) return false;
    add('flowerBed', x, z, scale, yaw, { tint: set + Math.min(tint, 0.998) }); return true;
  };
  // A drift is the kit's wild bed (≈ 330 / 200 triangles full / lite, all kept on lite): few and large, where they read.
  { const rnd = ctx.rng('reach.drifts'); let wet = 0, edgeN = 0, bog = 0;
    for (let k = 0; k < 120 && wet + edgeN < DRIFTS.reach; k++) {
      const x = 1170 + rnd() * 200, z = 1180 + rnd() * 180, yaw = rnd() * Math.PI, s = rnd(), tint = rnd();
      if (!inPoly(x, z, REACH_POLY)) continue;
      const we = edge.at(x, z);
      if (we >= 5 && we <= 30 && wet < DRIFTS.reach * 0.6) { if (drift(x, z, FLOWER_SET.marsh, 1.5 + s * 0.6, yaw, tint)) wet++; }
      else if (we >= 0.8 && we < 5 && edgeN < DRIFTS.reach * 0.4) { if (drift(x, z, FLOWER_SET.marshEdge, 1.0 + s * 0.4, yaw, tint)) edgeN++; }
    }
    // The bog margin beside the boardwalk (3.4–8.6 off), the drift running along the deck.
    for (let k = 0; k < 60 && bog < DRIFTS.bog; k++) {
      const s = 4 + rnd() * (bw.len - 8), side = rnd() < 0.5 ? 1 : -1, off = side * (3.4 + rnd() * 5.2), q = bw.at(s, off), sc = rnd(), tint = rnd();
      if (edge.at(q[0], q[1]) < 0.4) continue;
      if (drift(q[0], q[1], FLOWER_SET.bog, 0.9 + sc * 0.3, Math.atan2(-bw.dir[1], bw.dir[0]), tint)) bog++;
    } }

  /* ---------------------------------------------------------------- the Greenway's marsh (s 0–612 and the bluff stretch) */
  const reedAt = (x: number, z: number, H: number, cat: number, roll: number, yaw: number, tint: number) => {
    const sp = roll < cat ? 'cattail' : 'reed';
    if (!site.plantOk(x, z, H, 0.45, { aquatic: true })) return;
    add(sp, x, z, H / UNIT_H[sp], yaw, { tint });
  };
  { const rnd = ctx.rng('greenway.marsh');
    for (const [s0, s1] of [[0, 612], [955, L.length]] as const) for (let s = s0; s < s1; s += 1.25) {
      const q = L.at(s), tries = s < 62 ? 4 : 2;
      for (const sd of [-1, 1]) for (let n = 0; n < tries; n++) {
        const off = sd * (3.6 + Math.pow(rnd(), 1.9) * 46), x = q.p[0] + q.r[0] * off + (rnd() - 0.5) * 1.4, z = q.p[2] + q.r[1] * off + (rnd() - 0.5) * 1.4;
        const k = rnd(), h = rnd(), yaw = rnd() * TAU, tint = rnd(), pick = rnd(), lily = rnd();
        if ((x > 1150 && inReach(x, z)) || keepB(x, z)) continue;
        const d = edge.at(x, z), dd = Math.abs(off), patch = 0.5 + 0.5 * fbm(x * 0.06 + 11, z * 0.06 - 4), g = ctx.heightAt(x, z);
        if (d < -1.2) {
          if (lily < 0.05) { const lvl = ctx.waterLevelAt(x, z); if (lvl !== null && lvl > 0.6 && site.plantOk(x, z, 0.05, 0.6, { aquatic: true })) add('lily', x, z, 0.8 + h * 0.5, yaw, { tint }, lvl); }
          continue;
        }
        if (g < 0.6 || d > 1e5) continue;
        if (d < 3.2) { if (k < 0.85) reedAt(x, z, 1.9 + h * 0.7, 0.45, pick, yaw, tint); continue; }
        // Reeds at hand height along the rails (the deck stands ≈ 0.6–2 over the marsh).
        if (dd < 7 && k < 0.5 * patch + 0.12) { reedAt(x, z, clamp(q.p[1] + 1.3 - g, 1.6, 2.6) * (0.9 + h * 0.2), 0.35, pick, yaw, tint); continue; }
        if (d < 11) {
          if (k < 0.4) { if (site.plantOk(x, z, UNIT_H.sedge, 0.3, { aquatic: true })) add('sedge', x, z, 0.8 + h * 0.4, yaw, { tint }); }
          else if (k < 0.52) reedAt(x, z, 1.5 + h * 0.5, 0.3, pick, yaw, tint);
          continue;
        }
        if (k < 0.16 * (0.6 + patch)) { if (site.plantOk(x, z, UNIT_H.sedge, 0.3, {})) add('sedge', x, z, 0.75 + h * 0.4, yaw, { tint }); }
        else if (k < 0.22) reedAt(x, z, 1.3 + h * 0.6, 0.3, pick, yaw, tint);
        else if (k < 0.228 && dd > 9 && site.plantOk(x, z, UNIT_H.dogwood, 1.1, {})) add('dogwood', x, z, 0.8 + h * 0.4, yaw, { tint });
      }
    } }

  // The Greenway's drifts: a few large wild beds on the marsh stretch (iris and marigold at a pool's edge, Joe-Pye, cardinal
  // flower and milkweed in the wet meadow), none over the Bight; beside the Reed Maze the milkweed the monarchs come to.
  { const rnd = ctx.rng('greenway.drifts'); let n = 0;
    for (let k = 0; k < 400 && n < DRIFTS.greenway; k++) {
      const s = 12 + rnd() * 395, sd = rnd() < 0.5 ? -1 : 1, q = L.at(s), off = sd * (6 + rnd() * 28), x = q.p[0] + q.r[0] * off, z = q.p[2] + q.r[1] * off, sc = rnd(), yaw = rnd() * Math.PI, tint = rnd();
      if ((x > 1150 && inReach(x, z)) || keepB(x, z)) continue;
      const d = edge.at(x, z);
      if (d >= 0.8 && d < 5) { if (drift(x, z, FLOWER_SET.marshEdge, 1.0 + sc * 0.4, yaw, tint)) n++; }
      else if (d >= 5 && d < 24) { if (drift(x, z, FLOWER_SET.marsh, 1.4 + sc * 0.6, yaw, tint)) n++; }
    }
    for (const [dx, dz, yaw] of [[-17.5, -6, 0.4], [16.5, 9, 1.9]] as const) { const x = MAZE.c[0] + dx, z = MAZE.c[1] + dz; drift(x, z, FLOWER_SET.marsh, 1.6, yaw, 0.35); } }

  /* ---------------------------------------------------------------- Greenway groves: tamarack and willow on the hummocks */
  { const rnd = ctx.rng('greenway.groves'), anchors: [number, number, 'willow' | 'tamarack'][] = [];
    for (let t = 0; t < 1500 && anchors.length < 16; t++) {
      const s = rnd() * 600, sd = rnd() < 0.5 ? -1 : 1, q = L.at(s), off = sd * (12 + rnd() * 34), x = q.p[0] + q.r[0] * off, z = q.p[2] + q.r[1] * off, d = edge.at(x, z);
      if (d < 4 || d > 24 || keepB(x, z) || (x > 1150 && inReach(x, z)) || anchors.some(a => Math.hypot(a[0] - x, a[1] - z) < 34)) continue;
      if (!site.plantOk(x, z, 10, 3, { tree: true })) continue;
      anchors.push([x, z, d < 9 ? 'willow' : 'tamarack']);
    }
    for (const [x, z, kind] of anchors) grove(x, z, kind, kind === 'willow' ? 3 + Math.floor(rnd() * 2) : 5 + Math.floor(rnd() * 4), kind === 'willow' ? 3.4 : 2.4, rnd);
    stats.greenwayGroves = anchors.length; }

  /* ---------------------------------------------------------------- the bluff end: wind-bent pine and spruce (never palms) */
  { const rnd = ctx.rng('greenway.bluff'), bluff: XY[] = [];
    for (let s = 965; s < L.length - 4; s += 3.2) for (let n = 0; n < 2; n++) {
      const q = L.at(s), sd = rnd() < 0.7 ? 1 : -1, off = sd * (6 + rnd() * 26), x = q.p[0] + q.r[0] * off, z = q.p[2] + q.r[1] * off, roll = rnd(), kind = rnd(), s2 = rnd(), lean = 0.12 + rnd() * 0.12, yaw = (rnd() - 0.5) * 0.5, tint = rnd();
      if (roll < 0.35 || bluff.some(t => Math.hypot(t[0] - x, t[1] - z) < 5)) continue;
      const pine = kind < 0.65, sp = pine ? 'pine' : 'spruce', sc = pine ? 0.65 + s2 * 0.4 : 0.6 + s2 * 0.35, H = (pine ? UNIT_H.pine : UNIT_H.spruce) * sc;
      if (ctx.heightAt(x, z) < 2 || !site.plantOk(x, z, H, 2.4 * sc, { tree: true })) continue;
      bluff.push([x, z]); add(sp, x, z, sc, yaw, { tint, ...(pine ? { lean } : {}) });
    }
    stats.bluffTrees = bluff.length; }

  /* ---------------------------------------------------------------- the Reed Maze: cattail walls between mown rings */
  const ground: GroundPaint[] = [];
  { const rnd = ctx.rng('greenway.maze'), [cx, cz] = MAZE.c, rings = MAZE.rings, walls = [...rings.slice(0, -1).map((r, i) => (r + rings[i + 1]!) / 2), MAZE.wall_r];
    walls.forEach((R, i) => {
      // Gates alternate ±90° (the outer wall's at −90°: north); a 1.5 m gap.
      const gate = (i === walls.length - 1 ? -Math.PI / 2 : (i % 2 ? Math.PI / 2 : -Math.PI / 2)), n = Math.max(8, Math.round(TAU * R / 0.8));
      for (let k = 0; k < n; k++) {
        const a = (k / n) * TAU + (rnd() - 0.5) * 0.04, gap = Math.abs(Math.atan2(Math.sin(a - gate), Math.cos(a - gate))) * R, h = rnd(), yaw = rnd() * TAU, tint = rnd(), cat = rnd();
        if (gap < 0.75) continue;
        const x = cx + Math.cos(a) * R, z = cz + Math.sin(a) * R, H = 2.05 + h * 0.4, sp = cat < 0.6 ? 'cattail' : 'reed';
        if (site.ctx.waterLevelAt(x, z) !== null || site.ctx.bedClearance(x, z) < 0.3) continue;
        add(sp, x, z, H / UNIT_H[sp], yaw, { tint });
      }
    });
    // The mown sedge paths: one annulus per ring, 1.25 wide (a slit polygon: outer circle, then the inner back).
    for (const r of rings) { const n = Math.max(12, Math.round(TAU * r / 3.2)), o: [number, number][] = [], inn: [number, number][] = [];
      for (let k = 0; k <= n; k++) { const a = (k / n) * TAU; o.push([r3(cx + Math.cos(a) * (r + 0.625)), r3(cz + Math.sin(a) * (r + 0.625))]); inn.push([r3(cx + Math.cos(a) * Math.max(0.2, r - 0.625)), r3(cz + Math.sin(a) * Math.max(0.2, r - 0.625))]); }
      ground.push({ polygon: [...o, ...inn.reverse()], surface: 'mown', tone: 0.62 }); }
    // The heart (round the sundial) mown too.
    { const n = 14, o: [number, number][] = []; for (let k = 0; k < n; k++) { const a = (k / n) * TAU; o.push([r3(cx + Math.cos(a) * 1.9), r3(cz + Math.sin(a) * 1.9)]); } ground.push({ polygon: o, surface: 'mown', tone: 0.62 }); } }

  /* ---------------------------------------------------------------- the marsh floor: sedge and mud paint (never lawn) */
  // From any distance past the planting's reach the floor itself must read as marsh: the wet floor painted sedge, a mud rim
  // within 1.6 m of the water, over the Reach and the Greenway's pool margins. Rows 4 m deep, cells 2 m wide; a run of one
  // class is one quad (run ends against lawn pulled in by up to 0.8 m of noise, so the edge is ragged, not stepped). Never over
  // a path (2.3 m off every bed that is not an open deck on piles; under a deck the paint is hidden), a pad, the meadow, the
  // Sands glider field, the Boathouse or the Reed Maze (it has its own mown rings).
  // S1 (the skate line) is a deck only where it rides the boardwalk; elsewhere it is a ground bed like any path.
  { const decks = DECK_PREFIXES.filter(d => d !== 'S1'), nonDeck = [...new Set(ctx.beds.map(q => q.id).filter(id => !decks.some(d => id.startsWith(d)) && !id.startsWith('S1')))];
    const clear = (x: number, z: number) => ctx.bedClearance(x, z, nonDeck) >= 2.3 && (bw.dist(x, z) < 3 || ctx.bedClearance(x, z, ['S1']) >= 2.3) && !ctx.onPad?.(x, z, 2.3);
    const cls = (x: number, z: number): 'sedge' | 'mud' | null => {
      const g = ctx.heightAt(x, z), we = edge.at(x, z);
      if (we > 1e5 || g > 6.5 || keepB(x, z) || Math.hypot(x - MEADOW.c[0], z - MEADOW.c[1]) < MEADOW.r + 3 || Math.hypot(x - SANDS_FIELD.c[0], z - SANDS_FIELD.c[1]) < SANDS_FIELD.r + 2) return null;
      if (inPoly(x, z, BOATHOUSE) || polyEdgeDist(x, z, BOATHOUSE) < 4) return null;
      const reach = inPoly(x, z, REACH_POLY) || polyEdgeDist(x, z, REACH_POLY) < 5;
      if (!reach) { if (x > 1150 && inReach(x, z)) return null; const q = site.gw(x, z); if (q.d > 45 || q.s > 612 || we > 7) return null; }
      else if (we > 9) return null; // the wet margin only (paint drapes at ≤ 2.5 eu edges: the lite budget)
      if (!clear(x, z)) return null;
      return we < 1.6 ? 'mud' : 'sedge';
    };
    let quads = 0;
    for (let z0 = 1100; z0 < 1392; z0 += 4) {
      let run: { c: 'sedge' | 'mud'; x0: number; prev: 'sedge' | 'mud' | null } | null = null;
      const close = (x1: number, next: 'sedge' | 'mud' | null) => {
        if (!run) return;
        const j0 = run.prev ? 0 : 0.8 * (0.5 + 0.5 * fbm(run.x0 * 0.3, z0 * 0.3)), j1 = next ? 0 : 0.8 * (0.5 + 0.5 * fbm(x1 * 0.3 + 5, z0 * 0.3 - 3));
        const a = run.x0 + j0, b = x1 - j1;
        if (b - a > 0.6) { ground.push({ polygon: [[r3(a), z0], [r3(b), z0], [r3(b), z0 + 4], [r3(a), z0 + 4]], surface: run.c, tone: run.c === 'mud' ? 0.5 : 0.42 }); quads++; }
      };
      let last: 'sedge' | 'mud' | null = null;
      for (let x0 = 640; x0 < 1392; x0 += 2) {
        const c = (z0 < 1166 && x0 > 1150) || (x0 < 1150 && z0 < 1100) ? null : cls(x0 + 1, z0 + 2);
        if (c !== last) { close(x0, c); run = c ? { c, x0, prev: last } : null; last = c; }
      }
      close(1392, null);
    }
    stats.paintQuads = quads; }

  void HERON; void polyDist;
  return { plants, ground, stats };
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;
