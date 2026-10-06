/**
 * Long Sands, Direction B "the California boardwalk" (STORY place 5, late afternoon → sunset; STYLE §2.5 amended; the
 * prototype protos/long-sands, ported onto the land PR 2 built: the promenade and the Strand, the pier, the Tideline bowl).
 * Solvers in placement order (STYLE §1.4.1 rule 1, clearings first): the kept clearings (site.ts) → buildings (the Boathouse
 * re-dress, the wheel, the shack, the pier gate, the storefronts, the lifeguard towers) → planting (promenade and sentinel
 * fan palms, Canary palms at the pier plaza, wind-bent pines behind the dunes, ice plant, marram, beach rose and thrift) →
 * ground paint (the kelp line, footprints) → props and pastime fixtures → lights in night order → life → the landmark.
 * Deterministic: `ctx.rng(<stream>)` only.
 */
import type { Point2, Point3 } from '../../../world/definition.ts';
import type { LightAnchor } from '../../../world/definition.ts';
import { FLOWER_SET } from '../../../kit/plants/sets.ts';
import type { BuildingRecord, DressingContext, GroundPaint, LifeSpawn, PlantRecord, PropRecord } from '../../types.ts';
import { between, onFrame, pickOf, q3, q3p, rectSamples, shoreZ, slopeAt, type Frame } from './frame.ts';
import { Claims, palmCountry, SANDS, segDist, siteOf, type Site } from './site.ts';

export type SandsParts = {
  buildings: BuildingRecord[]; plants: PlantRecord[]; props: PropRecord[]; ground: GroundPaint[]; lights: LightAnchor[]; life: LifeSpawn[];
  /** Diagnostics for the tests and the handoff (counts, skipped spots); not baked. */
  notes: Record<string, number | string>;
};
const STYLE = 'landing.boardwalk';
const P3 = (x: number, y: number, z: number): Point3 => q3p([x, y, z]) as Point3;

/** Is (x, z) clear of every bed, pad, water and baked solid by `margin`, and of this module's own claims by `r`? */
function clear(ctx: DressingContext, claims: Claims, x: number, z: number, margin: number, r = margin): boolean {
  return !ctx.occupied(x, z, margin) && claims.free(x, z, r);
}
/** Every sample of a rectangle clear of beds, pads, water and solids (margin) and of the module's claims. */
function rectClear(ctx: DressingContext, claims: Claims, cx: number, cz: number, hx: number, hz: number, yaw: number, margin: number): boolean {
  return rectSamples(cx, cz, hx, hz, yaw, 1).every(([x, z]) => !ctx.occupied(x, z, margin) && claims.free(x, z, 0.2));
}

export function buildSandsParts(ctx: DressingContext): SandsParts {
  const site = siteOf(ctx), claims = new Claims(), notes: SandsParts['notes'] = {};
  const out: SandsParts = { buildings: [], plants: [], props: [], ground: [], lights: [], life: [], notes };
  const { prom } = site;
  const shoreAt = (x: number) => shoreZ(ctx, x, prom.zAt(Math.max(prom.x0, Math.min(prom.x1, x))) + 8);

  /* ------------------------------------------------------------------ clearings (claimed first) */
  claims.add(SANDS.pageD.eye[0], SANDS.pageD.eye[1], SANDS.pageD.clear, 'pageD');
  claims.add(SANDS.glider.at[0], SANDS.glider.at[1], SANDS.glider.r + SANDS.glider.keep, 'glider');
  claims.add(SANDS.bowl.at[0], SANDS.bowl.at[1], SANDS.bowl.coping + 2.5, 'bowl');
  claims.add(SANDS.campfire[0], SANDS.campfire[1], 6.5, 'campfire');

  /* ------------------------------------------------------------------ buildings */
  // The Boathouse (host re-dress, RULINGS 8): white walls and a terracotta gable on its baked footprint and height; the
  // gable over the boat doors (east, page L's face) carries the lantern. No collider: the host's baked shell stays.
  // The baked shell (eave = the walls' top) when the bake's context offers it (neighbourhoods/bake.ts `hostShell`); the
  // contract's host entry carries the floor only. The bake's validation (rule 3) proves the match either way.
  const shell = (ctx as DressingContext & { hostShell?: (id: string) => { footprint: readonly Point2[]; floor: number; wallTop: number } | null }).hostShell?.(SANDS.boathouse);
  const host = ctx.hosts.find(h => h.id === SANDS.boathouse);
  if (host?.footprint && host.footprint.length === 4) {
    const xs = host.footprint.map(p => p[0]), zs = host.footprint.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs), floor = shell?.floor ?? host.height ?? 3, eave = shell?.wallTop ?? floor + 6.65;
    out.buildings.push({ id: 'sands.boathouse', districtId: '', kind: 'boathouse', style: STYLE, at: P3((x0 + x1) / 2, floor, (z0 + z1) / 2), yaw: 0,
      size: { w: x1 - x0, d: z1 - z0, h: q3(eave - floor) }, roof: { form: 'gable', pitch: 22, overhang: 0.45, material: 'terracotta' },
      door: { face: 'right', u: 0 }, params: { boatFace: 'right' }, collide: false, hostId: SANDS.boathouse });
    notes.boathouse = `${x0}–${x1} × ${z0}–${z1}, floor ${floor}, eave ${eave}`;
  }
  // The Ferris wheel on the pier platform (story landmark `wheel`): faces NE (its axle along NE–SW), hub 19.6.
  const W = SANDS.wheel, deck = SANDS.pier.deck;
  out.buildings.push({ id: 'sands.wheel', districtId: '', kind: 'ferrisWheel', style: STYLE, at: P3(W.hub[0], deck, W.hub[2]), yaw: q3(W.yaw),
    size: { w: 2 * W.r + 2, d: 6, h: q3(W.hub[1] - deck) }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'steel' },
    params: { radius: W.r, hubH: q3(W.hub[1] - deck), gondolas: W.gondolas, allowOnBed: true }, collide: true, landmarkId: 'wheel' });
  // The seafood shack on the platform's east side, its door to the pier walk (west), clear of the wheel's sweep.
  const P = SANDS.pier.platform;
  out.buildings.push({ id: 'sands.shack', districtId: '', kind: 'shack', style: STYLE, at: P3(P.x1 - 4.6, deck, P.z0 + 14), yaw: -Math.PI / 2,
    size: { w: 10, d: 7, h: 3.4 }, roof: { form: 'gable', pitch: 12, overhang: 0.35, material: 'tile' }, door: { face: 'front', u: -2.5 }, paint: 6,
    params: { allowOnBed: true }, collide: true });
  // The pier's entrance gate where the ramp meets the deck (no lettering; a beam on two posts outside the rails).
  out.buildings.push({ id: 'sands.pierGate', districtId: '', kind: 'gate', style: STYLE, at: P3(SANDS.pier.x, 3.3, SANDS.pier.rampTo - 1), yaw: 0,
    size: { w: 2 * SANDS.pier.half + 1, d: 0.9, h: 5.9 }, roof: { form: 'none', pitch: 0, overhang: 0, material: 'timber' }, params: { gateStyle: 'timber' }, collide: true });

  // Storefronts (protos §5; approved: collidable facades with shallow porches, not hosts): walk the promenade west → east
  // where the verge is deep, each front facing the sea with its porch 1.4 behind the inland palm row.
  const S = SANDS.store, rs = ctx.rng('sands.storefronts');
  let stores = 0, x = SANDS.x0 + 8;
  while (x < 1000) {
    const w = pickOf(rs, S.widths), high = rs() < S.highShare, h = high ? S.high : S.low, f = prom.frameAt(x);
    const back = S.front - S.depth, centreOff = (S.front + back) / 2, [cx, cz] = onFrame(f, 0, centreOff), [px, pz] = onFrame(f, 0, S.front + S.porch);
    const porchFront = rectSamples(px, pz, w / 2 - 0.5, 0.01, f.yaw, 1);
    const floor = Math.max(...porchFront.map(([a, b]) => ctx.heightAt(a, b))) + 0.05;
    const under = rectSamples(cx, cz, w / 2, S.depth / 2, f.yaw, 1.5).map(([a, b]) => ctx.heightAt(a, b));
    const fits = rectClear(ctx, claims, cx, cz, w / 2, S.depth / 2, f.yaw, 1.5)
      && rectClear(ctx, claims, ...onFrame(f, 0, S.front + S.porch / 2), w / 2 - 0.4, S.porch / 2, f.yaw, 0.6)
      && ctx.bedClearance(...onFrame(f, 0, back - 0.5), [SANDS.beds.drive]) >= S.minDriveGap
      && ctx.districtAt(cx, cz) === 'landing' && Math.max(...under) - floor <= 2.4 && floor - Math.min(...under) <= 1.2;
    if (!fits) { x += S.step; continue; }
    const paint = Math.floor(rs() * 7), stripe = Math.floor(rs() * 4);
    out.buildings.push({ id: `sands.store.${stores}`, districtId: '', kind: 'storefront', style: STYLE, at: P3(cx, floor, cz), yaw: q3(f.yaw),
      size: { w, d: S.depth, h }, roof: { form: 'flat', pitch: 0, overhang: 0, material: 'parapet' }, storeys: high ? 2 : 1, door: { face: 'front', u: w / 2 - 1.3 },
      paint, params: { awningStripe: stripe, porch: S.porch }, collide: true });
    claims.addPoints(rectSamples(cx, cz, w / 2, S.depth / 2 + S.porch / 2 + 0.5, f.yaw, 2), 1, 'store');
    // the porch lamp's glow (night order: with the storefront windows)
    const [lx, lz] = onFrame(f, w / 2 - 0.4, S.front + 0.15), [qx, qz] = onFrame(f, w / 2 - 0.4, S.front + S.porch + 1);
    out.lights.push({ id: `landing.sands.store.${stores}.lamp`, at: P3(lx, floor, lz), kind: 'porchLamp', head: P3(lx, floor + 2.6, lz), pool: P3(qx, ctx.heightAt(qx, qz), qz), poolRadius: 3.2, bestHour: 'night' });
    stores++; x += w + (stores % 3 === 0 ? S.gapEvery3 : 0) + 0.6;
  }
  notes.storefronts = stores;

  // Lifeguard towers on stilts (protos §6; x 1170 dropped for page D): 21 eu above the wet line, facing the sea, the ramp
  // to the land; slid along the beach until the tower and its ramp clear the dune walk and every bed by 1 eu.
  const rg = ctx.rng('sands.towers');
  let towers = 0;
  for (const tx of [830, 905, 975, 1062]) {
    let placed = false;
    for (const dx of [0, 3, -3, 6, -6, 9, -9, 12, -12]) {
      const xx = tx + dx, f = prom.frameAt(Math.min(prom.x1, xx)), sz = shoreAt(xx) - 21, z0 = sz;
      for (const dz of [0, -3, 3, -6]) {
        const zz = z0 + dz, yaw = f.yaw;
        const ramp = rectSamples(...onFrame({ ...f, x: xx, z: zz }, 0, -5.0), 0.8, 3.4, yaw, 1);
        if (!rectClear(ctx, claims, xx, zz, 2.2, 2.1, yaw, 1) || ramp.some(([a, b]) => ctx.occupied(a, b, 1)) || ctx.districtAt(xx, zz) !== 'landing') continue;
        out.buildings.push({ id: `sands.tower.${towers}`, districtId: '', kind: 'lifeguardTower', style: STYLE, at: P3(xx, ctx.heightAt(xx, zz), zz), yaw: q3(yaw),
          size: { w: 3.4, d: 3.2, h: 2.3 }, roof: { form: 'flat', pitch: 0, overhang: 0.1, material: 'timber' }, paint: Math.floor(rg() * 7), collide: true });
        claims.add(xx, zz, 7, 'tower'); claims.addPoints(ramp, 1, 'towerRamp');
        const [wx, wz] = onFrame({ ...f, x: xx, z: zz }, 0, 1.2), gy = ctx.heightAt(xx, zz);
        out.lights.push({ id: `landing.sands.tower.${towers}.window`, at: P3(xx, gy, zz), kind: 'window', head: P3(wx, gy + 2.3 + 1.5, wz), bestHour: 'night' });
        placed = true; towers++; break;
      }
      if (placed) break;
    }
  }
  notes.towers = towers;

  /* ------------------------------------------------------------------ pastime fixtures that clear ground before planting */
  // Volleyball: three courts on the wide west beach (protos §6), nets across local x, the 9 × 16 court along the normal.
  let courts = 0;
  for (const cxx of [846, 868, 890]) {
    let ok = false;
    for (const dx of [0, -4, 4, -8, 8, -12, 12, -16, 16, -20, 20, -24, 24, -28]) {
      const xx = cxx + dx, f = prom.frameAt(xx), zz = Math.max(prom.zAt(xx) + 17, shoreAt(xx) - 42);
      for (const dz of [0, 4, 8, -4]) {
        const z2 = zz + dz;
        if (!rectClear(ctx, claims, xx, z2, 5.6, 9, f.yaw, 0.8)) continue;
        out.props.push({ id: `sands.volley.${courts}`, kind: 'volleyNet', at: P3(xx, ctx.heightAt(xx, z2), z2), yaw: q3(f.yaw), collide: true, fixture: 'volleyball' });
        claims.addPoints(rectSamples(xx, z2, 5.5, 9, f.yaw, 3), 1.5, 'court'); courts++; ok = true; break;
      }
      if (ok) break;
    }
  }
  notes.courts = courts;

  /* ------------------------------------------------------------------ palms (settles D-R4; never in the Reach) */
  const rp = ctx.rng('sands.palms'), palms: { x: number; z: number; y: number; side: 'in' | 'sea'; h: number; rec: PlantRecord }[] = [];
  const fanTint = (h: number) => Math.max(0, Math.min(0.999, (h / 19 - 0.92) / 0.34));
  let side = 0;
  for (let px = 799; px <= SANDS.x1; px += 7, side ^= 1) {
    const h = between(rp, 17, 24), yaw = rp() * Math.PI * 2, lean = (rp() - 0.5) * 0.1;
    if (Math.abs(px - SANDS.pier.x) < SANDS.plaza) continue;
    const f = prom.frameAt(px), off = side ? SANDS.palmSeaward : SANDS.palmInland, [x0, z0] = onFrame(f, 0, off);
    if (!palmCountry(ctx, x0, z0) || ctx.occupied(x0, z0, 1.0) || ctx.bedClearance(x0, z0) < 1.0 || !claims.free(x0, z0, 0.8, t => t === 'pageD' || t === 'glider')) continue;
    if (slopeAt(ctx, x0, z0) > 0.6) continue;
    const y = ctx.heightAt(x0, z0);
    // Lite keeps the fan palm's share (kit/plants/archetypes 0.75) except where a festoon is strung (set below).
    const rec: PlantRecord = { species: 'fanPalm', at: P3(x0, y, z0), scale: 1, yaw: q3(yaw), tint: q3(fanTint(h)), lean: q3(lean) };
    out.plants.push(rec); palms.push({ x: x0, z: z0, y, side: side ? 'sea' : 'in', h, rec }); claims.add(x0, z0, 1.2, 'palm');
  }
  notes.promenadePalms = palms.length;
  // Sentinel palms on the Drive's inland verge (protos §4: every 21 eu, 8.5 north of the Drive's centre line).
  let sentinels = 0;
  for (let sx = 1260; sx > 780; sx -= 21) {
    const h = between(rp, 19, 25), yaw = rp() * Math.PI * 2;
    const f = site.drive.frameAt(sx), [x0, z0] = onFrame(f, 0, -8.5);
    if (!palmCountry(ctx, x0, z0) || ctx.occupied(x0, z0, 1.5) || slopeAt(ctx, x0, z0) >= 0.6 || !claims.free(x0, z0, 1)) continue;
    out.plants.push({ species: 'fanPalm', at: P3(x0, ctx.heightAt(x0, z0), z0), scale: 1, yaw: q3(yaw), tint: q3(fanTint(Math.min(24.4, h))), lean: 0.04 });
    claims.add(x0, z0, 1.2, 'palm'); sentinels++;
  }
  notes.sentinelPalms = sentinels;
  // Canary Island date palms at the pier plaza (protos §4): four, framing the pier mouth, off the Tideline slab.
  let canaries = 0;
  const plazaSpots: Point2[] = [[1031.5, 1453], [986.5, 1440], [986.5, 1426], [1055, 1447], [1008.5, 1470], [1032, 1468]];
  for (const [cx, cz] of plazaSpots) {
    if (canaries >= 4) break;
    if (!palmCountry(ctx, cx, cz) || ctx.occupied(cx, cz, 1.6) || !claims.free(cx, cz, 1.5)) continue;
    out.plants.push({ species: 'canaryPalm', at: P3(cx, ctx.heightAt(cx, cz), cz), scale: 1, yaw: q3(rp() * 6.283), tint: q3(rp()), keep: true });
    claims.add(cx, cz, 3, 'canary'); canaries++;
  }
  notes.canaryPalms = canaries;
  // Wind-bent pines behind the dunes east of the pier (STYLE §2.5: the handshake with the Reach), between the promenade and
  // Town Weave's dune crest, leaning away from the sea wind (NE), clear of the zip cable and page D's foreground.
  let pines = 0;
  for (const [gx, n] of [[1062, 4], [1098, 5], [1172, 3]] as const) {
    for (let k = 0; k < n; k++) {
      const xx = gx + k * 4.2 + (rp() - 0.5) * 1.5, f = prom.frameAt(xx), [x0, z0] = onFrame(f, (rp() - 0.5) * 2, 3.75 + 2.0 + 3.2 + 1.8 + rp() * 2.5);
      if (!palmCountry(ctx, x0, z0) || ctx.occupied(x0, z0, 1.2) || !claims.free(x0, z0, 1.6) || segDist(x0, z0, [1130, 1440], [1313.8, 1133.7]) < 8) continue;
      out.plants.push({ species: 'pine', at: P3(x0, ctx.heightAt(x0, z0), z0), scale: q3(between(rp, 0.75, 1.05)), yaw: q3(-Math.PI * 0.75), lean: q3(between(rp, 0.12, 0.2)), tint: q3(rp()) });
      claims.add(x0, z0, 1.6, 'pine'); pines++;
    }
  }
  notes.pines = pines;

  /* ------------------------------------------------------------------ ground cover */
  // Ice plant on the verges (STYLE §2.5): drifts of mats between the promenade's inland edge and the Drive, and on the
  // storefronts' flanks; clumps of 3–6 mats along the verge, gaps between (rule 4: one species per drift).
  const ri = ctx.rng('sands.iceplant');
  let ice = 0;
  for (let ix = SANDS.x0 + 6; ix < 1205; ix += between(ri, 9, 16)) {
    const f = prom.frameAt(ix), n = 3 + Math.floor(ri() * 4), depthMax = Math.max(0, prom.zAt(ix) - site.drive.zAt(ix) - 12);
    for (let k = 0; k < n; k++) {
      const [x0, z0] = onFrame(f, (k - n / 2) * 1.9 + (ri() - 0.5), -(5.0 + 1.6 + ri() * Math.min(10, depthMax)));
      if (!palmCountry(ctx, x0, z0) && ctx.districtAt(x0, z0) !== 'landing') continue;
      if (ctx.occupied(x0, z0, 0.6) || !claims.free(x0, z0, 0.9, t => t === 'pageD' || t === 'glider')) continue;
      out.plants.push({ species: 'iceplant', at: P3(x0, ctx.heightAt(x0, z0), z0), scale: q3(between(ri, 1.4, 2.2)), yaw: q3(ri() * 6.283), tint: q3(ri()) });
      ice++;
    }
  }
  notes.iceplant = ice;
  // Marram on the dune crest east of the pier (STYLE §2.5 planting; the beach rose and thrift drifts are the corridor's
  // Tideline flower beds: a flowerBed card here costs ~450 triangles, which the shared landing budget cannot spare).
  const rm = ctx.rng('sands.dunes');
  let marram = 0;
  for (let mx = 1046; mx < 1196; mx += between(rm, 5, 9)) {
    const f = prom.frameAt(mx), [x0, z0] = onFrame(f, 0, between(rm, 11, 17));
    if (ctx.districtAt(x0, z0) !== 'landing' || ctx.occupied(x0, z0, 0.6) || !claims.free(x0, z0, 0.6, t => t === 'pageD')) continue;
    const kind = 'grassTuft' as const;
    for (let k = 0; k < 3; k++) {
      const a = x0 + (rm() - 0.5) * 3, b = z0 + (rm() - 0.5) * 2;
      if (ctx.occupied(a, b, 0.5)) continue;
      out.plants.push({ species: kind, at: P3(a, ctx.heightAt(a, b), b), scale: q3(between(rm, 0.8, 1.2)), yaw: q3(rm() * 6.283), tint: q3(FLOWER_SET.shore + 0.15 + 0.7 * rm()) });
      marram++;
    }
  }
  notes.marram = marram;

  /* ------------------------------------------------------------------ ground paint: the kelp line and footprints */
  // A sparse kelp (wrack) line at high water: segments 6–16 eu every 30–70 eu along the 0.25 contour (protos §6).
  const rk = ctx.rng('sands.kelp');
  let kelp = 0;
  for (let kx = 812; kx < 1200; kx += between(rk, 30, 70)) {
    const len = between(rk, 6, 16), pts: Point2[] = [];
    for (let t = 0; t <= len; t += 2) { const xx = kx + t, z0 = shoreZ(ctx, xx, prom.zAt(Math.min(prom.x1, xx)) + 8, 0.25); pts.push([xx, z0 + (rk() - 0.5) * 0.4]); }
    if (pts.some(([a, b]) => ctx.districtAt(a, b) !== 'landing' || Math.abs(a - SANDS.pier.x) < 8)) continue;
    const poly = [...pts.map(([a, b]) => [q3(a), q3(b - 0.4)] as Point2), ...[...pts].reverse().map(([a, b]) => [q3(a), q3(b + 0.4)] as Point2)];
    out.ground.push({ polygon: poly, surface: 'duff', tone: 0.3 }); kelp++;
  }
  notes.kelp = kelp;
  // Footprints: four wandering tracks of darker sand from the Strand toward the water (STYLE §2.5 "no clean empty beach").
  const rf = ctx.rng('sands.prints');
  let prints = 0;
  for (const fx of [858, 936, 1088, 1158]) {
    const f = prom.frameAt(fx), sz = shoreAt(fx), from = prom.zAt(fx) + 9.5, pts: Point2[] = [];
    let xx = fx;
    for (let zz = from; zz < sz - 2; zz += 3) { xx += (rf() - 0.5) * 2.2; pts.push([xx, zz]); }
    if (pts.length < 3 || pts.some(([a, b]) => ctx.districtAt(a, b) !== 'landing' || ctx.waterLevelAt(a, b) !== null || (ctx.occupied(a, b) && ctx.bedClearance(a, b) > 0))) continue;
    const poly = [...pts.map(([a, b]) => [q3(a - 0.3), q3(b)] as Point2), ...[...pts].reverse().map(([a, b]) => [q3(a + 0.3), q3(b)] as Point2)];
    out.ground.push({ polygon: poly, surface: 'sand', tone: 0.1 }); prints++;
  }
  notes.footprints = prints;

  /* ------------------------------------------------------------------ props */
  // Benches on the promenade's seaward edge every 32 eu facing the sea (inside 0.5 of the tread's edge: the contract's rule).
  let benches = 0;
  for (let bx = 810; bx < 1205; bx += 48) {
    if (Math.abs(bx - SANDS.pier.x) < 14) continue;
    const f = prom.frameAt(bx), [x0, z0] = onFrame(f, 0, site.promHalf - 0.35), [gx, gz] = onFrame(f, 0, (site.promHalf + site.strandOffset - site.strandHalf) / 2);
    // off the beds' crossings, and the gap between the promenade and the Strand is open ground (not the Tideline slab)
    if (ctx.districtAt(x0, z0) !== 'landing' || ctx.bedClearance(x0, z0, ['yearWalk', 'S2', 'S3', 'S4', 'walk tidelineBeach']) < 3 || ctx.occupied(gx, gz)) continue;
    out.props.push({ id: `sands.bench.${benches}`, kind: 'bench', at: P3(x0, ctx.heightAt(x0, z0), z0), yaw: q3(f.yaw), collide: true }); benches++;
  }
  // Page D's bench (MANIFEST views D deferred "a bench"): east of the eye, facing the sunset along the beach.
  for (const [bx, bz] of [[1168, 1452], [1164, 1456], [1172, 1449]] as Point2[]) {
    if (ctx.occupied(bx, bz, 0.8)) continue;
    out.props.push({ id: 'sands.bench.pageD', kind: 'bench', at: P3(bx, ctx.heightAt(bx, bz), bz), yaw: q3(Math.atan2(-1, 0.12)), collide: true }); benches++; break;
  }
  notes.benches = benches;
  // The Tideline bowl's rim (RULINGS 9; PR 5 rides it): the concrete deck ring on the apron round the baked coping, and
  // two benches and a bike rack beside it on the sand.
  out.props.push({ id: 'sands.bowl.rim', kind: 'skateBowl', at: P3(SANDS.bowl.at[0], SANDS.bowl.rim, SANDS.bowl.at[1]), yaw: 0, scale: 1.2, fixture: 'tidelineBowl' });
  for (const [k, bx, bz, yaw] of [[0, 986.5, 1456, Math.PI / 2]] as const) {
    if (ctx.occupied(bx, bz, 0.6)) continue;
    out.props.push({ id: `sands.bowl.bench.${k}`, kind: 'bench', at: P3(bx, ctx.heightAt(bx, bz), bz), yaw, collide: true });
  }
  for (const [bx, bz] of [[986.5, 1432], [1055, 1440], [1061, 1442]] as Point2[]) {
    if (ctx.occupied(bx, bz, 1.4)) continue;
    out.props.push({ id: 'sands.bikeRack', kind: 'bikeRack', at: P3(bx, ctx.heightAt(bx, bz), bz), yaw: 0, collide: true }); break;
  }
  // The pier's island lanterns (brass, 2.6 eu post): three pairs along the deck just inside its rails, and two on the
  // platform's landward corners; none over open water (the platform beyond is the wheel's and the shack's).
  let lamps = 0;
  for (const z of [1452, 1470, 1488]) for (const sx of [-1, 1]) {
    const lx = SANDS.pier.x + sx * (SANDS.pier.half - 0.45);
    out.props.push({ id: `sands.pier.lamp.${lamps}`, kind: 'lantern', at: P3(lx, deck, z), yaw: sx > 0 ? -Math.PI / 2 : Math.PI / 2, collide: true });
    out.lights.push({ id: `landing.sands.pier.lamp.${lamps}`, at: P3(lx, deck, z), kind: 'pierLantern', head: P3(lx, deck + 2.75, z), pool: P3(lx - sx * 1.5, deck, z), poolRadius: 4.5, bestHour: 'night' });
    lamps++;
  }
  for (const [lx, lz] of [[P.x0 + 1.4, P.z0 + 3.6], [P.x1 - 1.4, P.z0 + 3.6]] as Point2[]) {
    if (ctx.waterLevelAt(lx, lz) !== null || segDist(lx, lz, [W.hub[0] - 10, W.hub[2] - 10], [W.hub[0] + 10, W.hub[2] + 10]) < 4) continue;
    out.props.push({ id: `sands.pier.lamp.${lamps}`, kind: 'lantern', at: P3(lx, deck, lz), yaw: 0, collide: true });
    out.lights.push({ id: `landing.sands.pier.lamp.${lamps}`, at: P3(lx, deck, lz), kind: 'pierLantern', head: P3(lx, deck + 2.75, lz), pool: P3(lx, deck, lz + 1.5), poolRadius: 4.5, bestHour: 'night' });
    lamps++;
  }
  notes.pierLamps = lamps;
  // Umbrellas and towels (protos §6): clustered by a low-frequency field, between the seawall line and the wet sand.
  const ru = ctx.rng('sands.umbrellas'), field = (x: number) => Math.sin(x * 0.045) + 0.6 * Math.sin(x * 0.11 + 1.3);
  let umbrellas = 0, tries = 0;
  while (umbrellas < 50 && tries++ < 900) {
    const ux = between(ru, 815, 1205), f = prom.frameAt(ux), z0 = prom.zAt(ux) + 12, z1 = shoreAt(ux) - 9;
    if (z1 - z0 < 4 || field(ux) < -0.35) continue;
    const uz = between(ru, z0, z1), variant = Math.floor(ru() * 4), yaw = ru() * 6.283;
    if (Math.abs(ux - SANDS.pier.x) < 9 || ctx.districtAt(ux, uz) !== 'landing' || ctx.occupied(ux, uz, 2) || !claims.free(ux, uz, 2.4)) continue;
    out.props.push({ kind: 'umbrella', at: P3(ux, ctx.heightAt(ux, uz), uz), yaw: q3(yaw), variant });
    const [tx, tz] = onFrame({ ...f, x: ux, z: uz }, 0.4, 1.2);
    if (!ctx.occupied(tx, tz, 0.3)) out.props.push({ kind: 'towel', at: P3(tx, ctx.heightAt(tx, tz), tz), yaw: q3(f.yaw + (ru() - 0.5) * 0.6), variant: (variant + 1) % 4 });
    claims.add(ux, uz, 1.6, 'umbrella'); umbrellas++;
  }
  notes.umbrellas = umbrellas;

  // Boats drawn up above the wet line either side of the pier (STYLE §2.5: Newfoundland's jellybean dories; Classic a plank
  // hull, Taylor a pastel one): bows to the sea, set dressing (full only).
  const rb = ctx.rng('sands.boats');
  let boats = 0;
  for (const bx of [944, 952, 1052, 1060, 1112, 1120]) {
    if (boats >= 3) break;
    const zz = shoreAt(bx) - 5 - rb() * 2, f = prom.frameAt(bx);
    if (ctx.districtAt(bx, zz) !== 'landing' || ctx.occupied(bx, zz, 1.5) || !claims.free(bx, zz, 2)) continue;
    out.props.push({ id: `sands.boat.${boats}`, kind: 'rowboat', at: P3(bx, ctx.heightAt(bx, zz), zz), yaw: q3(f.yaw + (rb() - 0.5) * 0.5), variant: boats + 1 });
    claims.add(bx, zz, 2.5, 'boat'); boats++;
  }
  notes.boats = boats;
  // Kites over the west beach (the kite field, a Long Sands pastime: placed and still, PR 5 flies them).
  let kites = 0;
  for (const kx of [842, 884]) {
    const zz = shoreAt(kx) - 14;
    if (ctx.occupied(kx, zz, 1) || !claims.free(kx, zz, 1)) continue;
    out.props.push({ id: `sands.kite.${kites}`, kind: 'kite', at: P3(kx, ctx.heightAt(kx, zz), zz), yaw: q3(prom.frameAt(kx).yaw + Math.PI), variant: kites, fixture: 'kiteField' }); kites++;
  }

  // Fire rings on the beach (protos §9) and the Campfire's log ring (the monthly Chapter's ring, drawn as before: a ring
  // of log seats round the fire on its slab; non-colliding props on the place's pad).
  let fires = 0;
  for (const fx of [860, 1100, 1160]) {
    const zz = shoreAt(fx) - 26;
    if (ctx.districtAt(fx, zz) !== 'landing' || ctx.occupied(fx, zz, 2) || !claims.free(fx, zz, 2.5)) continue;
    out.props.push({ id: `sands.fire.${fires}`, kind: 'fireRing', at: P3(fx, ctx.heightAt(fx, zz), zz), yaw: 0, fixture: 'fireRing' });
    out.lights.push({ id: `landing.sands.fire.${fires}`, at: P3(fx, ctx.heightAt(fx, zz), zz), kind: 'fire', head: P3(fx, ctx.heightAt(fx, zz) + 0.6, zz), pool: P3(fx, ctx.heightAt(fx, zz), zz), poolRadius: 4, bestHour: 'night' });
    claims.add(fx, zz, 3, 'fire'); fires++;
  }
  notes.fireRings = fires;
  const [cfx, cfz] = SANDS.campfire, cfy = 2.0;
  out.props.push({ id: 'sands.campfire.fire', kind: 'fireRing', at: P3(cfx, cfy, cfz), yaw: 0, fixture: 'campfire' });
  out.props.push({ id: 'sands.campfire.logs', kind: 'ringBench', at: P3(cfx, cfy, cfz), yaw: 0, scale: 0.55 });

  // Festoon lights strung between palms across the promenade (protos §9): consecutive palms, one inland and the next
  // seaward within 16 eu, endpoints 5.2 up the trunks; only between the first storefront and the zip landing.
  palms.sort((a, b) => a.x - b.x);
  let festoons = 0;
  for (let i = 1; i < palms.length; i++) {
    const a = palms[i - 1]!, b = palms[i]!;
    if (a.side === b.side || b.x - a.x > 16 || a.x < 850 || b.x > 1150) continue;
    const ya = a.y + 5.2, yb = b.y + 5.2, line: Point3[] = [P3(a.x, ya, a.z), P3(b.x, yb, b.z)];
    out.props.push({ id: `sands.festoon.${festoons}`, kind: 'festoon', at: P3((a.x + b.x) / 2, Math.min(ya, yb), (a.z + b.z) / 2), yaw: 0, line }); festoons++;
    a.rec.keep = true; b.rec.keep = true; // a festoon (essential on lite) never hangs from a palm lite dropped
  }
  notes.festoons = festoons;

  // The Wreck on its reef (MANIFEST offshore wreck; the offshore pass draws only the reef rock): a grounded plank hull
  // (the rowboat's lines at wreck scale) and a fouled net; reached only by the Ferry, which slows here.
  out.props.push({ id: 'sands.wreck.hull', kind: 'rowboat', at: P3(SANDS.wreck[0], 0.55, SANDS.wreck[1]), yaw: 0.62, scale: 3.6, variant: 3 });
  out.props.push({ id: 'sands.wreck.net', kind: 'net', at: P3(SANDS.wreck[0] + 6, 0.9, SANDS.wreck[1] + 3), yaw: 1.9, scale: 1.4 });

  /* ------------------------------------------------------------------ lights, in night order (one run, LIGHT §3) */
  // Brief order: the Boathouse window and its gable lantern (page L) → [the Lamp's beam, offshore's own] → the Campfire →
  // storefront glow, festoons, the pier lamps, the beach fires → the wheel's ring (relay sixth, STORY §4.4) → fireflies.
  const bh = out.buildings.find(b => b.id === 'sands.boathouse');
  if (bh) {
    const gx = bh.at[0] + bh.size.w / 2 + 0.3, gy = bh.at[1] + bh.size.h + 1.1, gz = bh.at[2];
    out.lights.unshift({ id: 'landing.sands.boathouse.lantern', at: P3(gx, bh.at[1], gz), kind: 'gableLantern', head: P3(gx, gy, gz), pool: P3(gx + 2.5, bh.at[1], gz), poolRadius: 6, bestHour: 'night' });
  }
  out.lights.push({ id: 'landing.sands.campfire', at: P3(cfx, cfy, cfz), kind: 'campfire', head: P3(cfx, cfy + 0.8, cfz), pool: P3(cfx, cfy, cfz), poolRadius: 6, bestHour: 'night' });
  out.lights.push({ id: 'landing.sands.wheel', at: P3(W.hub[0], deck, W.hub[2]), kind: 'wheelRing', head: P3(W.hub[0], W.hub[1], W.hub[2]), pool: P3(W.hub[0] + 6, deck, W.hub[2] - 6), poolRadius: 7, bestHour: 'sunset' });
  const rank = (id: string) => NIGHT_ORDER.findIndex(re => re.test(id));
  out.lights.sort((a, b) => rank(a.id) - rank(b.id) || (a.at[0] - b.at[0]) || (a.at[2] - b.at[2]));
  out.lights.forEach((l, i) => { l.line = 'landing:sands'; l.order = i; });

  /* ------------------------------------------------------------------ life (data; PR 5 animates; lite keeps the first 10) */
  out.life.push(
    { kind: 'gull', at: P3(1050, 14, 1500), radius: 160, count: 8 },
    { kind: 'firefly', at: P3(cfx, cfy + 1, cfz), radius: 14, count: 10, months: [6, 7, 8], hours: [21, 1] },
    { kind: 'swallow', at: P3(980, 8, 1430), radius: 60, count: 4, months: [5, 6, 7, 8] },
  );
  return out;
}

/** The night order (brief, Long Sands): each light's group by id, earliest first. */
export const NIGHT_ORDER: readonly RegExp[] = [/\.boathouse\./, /\.campfire$/, /\.store\.\d+\.lamp$/, /\.tower\.\d+\.window$/, /\.pier\.lamp\./, /\.fire\.\d+$/, /\.wheel$/];

/** Frames for tests: the promenade's frame at x. */
export function sandsSite(ctx: DressingContext): Site { return siteOf(ctx); }
export type { Frame };
