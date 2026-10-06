import { HORIZON_MANIFEST as M, requireScaleFactor } from '../../world/manifest';
import type { BedCut, LandCuts, PadCut, TerrainField, WaterCut, XY, XYZ } from '../interfaces';
import { coastCharacter, signedShoreDistance } from '../coast';
import { buildWaterCuts, waterInfluence } from '../water';
import { clamp, contains, linePoint, mix, polygonCentre, polygonDistance, polylineArcs, segmentPoint, smooth } from './geometry';
import { mountainV2Height, mountainV2Rule } from '../mountainV2/ground';
import { mountainV3Height, v3Paint } from '../mountainV3/landform';
import { oreRoadGroundCeiling } from '../underground/oreRoad';
import { glasshouseScarp } from './glasshouseScarp';

export const GEOGRAPHY_REVISION = 'horizon-geo-1' as const;
/** The one walkable limit: MANIFEST `profiles.walkable.slope_max_deg` (40°, Mountain v2's body
 * limit). Bake, paint and the runtime geography all read this constant. Kept pure so baking imports no body scene. */
export const WALKABLE_DEGREES: number = M.profiles.walkable.slope_max_deg;
export const WALKABLE_SLOPE = Math.tan(WALKABLE_DEGREES * Math.PI / 180);
export const isWalkableSlope = (slope: number): boolean => Number.isFinite(slope) && slope <= WALKABLE_SLOPE;
export const TERRAIN_SURFACE_PALETTE = [
  { id: 'sand', color: '#e0cfa5', night: '#6c7282' },
  { id: 'bankedTurf', color: '#7d9a58', night: '#37453c' },
  { id: 'duff', color: '#8a6f4f', night: '#37453c' },
  { id: 'ochre', color: '#d7ac6b', night: '#5d5660' },
  { id: 'rock.crown', color: '#a3998a', night: '#6c7282', strata: 'Crown' },
  { id: 'rock.crown.ledge', color: '#c4bba9', night: '#8991a1', strata: 'Crown' },
  { id: 'rock.notch', color: '#b3a58f', night: '#6c7282', strata: 'Notch' },
  { id: 'rock.notch.ledge', color: '#d3bf99', night: '#8991a1', strata: 'Notch' },
  { id: 'rock.ochre', color: '#8f6236', night: '#5d5660', strata: 'Ochre' },
  { id: 'rock.ochre.ledge', color: '#d7ac6b', night: '#8a5f45', strata: 'Ochre' },
  { id: 'rock.sea', color: '#9a9489', night: '#6c7282', strata: 'Sea cliff' },
  { id: 'rock.sea.ledge', color: '#c4bba9', night: '#8991a1', strata: 'Sea cliff' },
  { id: 'paved', color: '#c9b891', night: '#6c7282' },
  { id: 'packedEarth', color: '#b39f78', night: '#5d5660' },
  { id: 'apron', color: '#d9d2c2', night: '#6c7282' },
  { id: 'boardwalk', color: '#b08a5e', night: '#3a2c26' },
  { id: 'cobble', color: '#bfa982', night: '#6c7282' },
  { id: 'gravel', color: '#cbbb98', night: '#6c7282' },
  { id: 'plaza', color: '#d3bf99', night: '#6c7282' },
  { id: 'snow', color: '#f1f1ec', night: '#8fa3c7' },
  { id: 'scree', color: '#b8ad98', night: '#6c7282' },
] as const;
/** One byte per terrain vertex: the ground paint (palette index, bits 0–4) and the rock
 * strata set the vertex shows where the ground is steep (bits 5–6). Rock is not baked
 * per vertex: the renderer weights it from each triangle's slope (soft 35–45°) and draws
 * the ledges from world height, so paint follows contours, never the 5 m lattice. */
export const ROCK_SETS = [
  { id: 'crown', base: 'rock.crown', ledge: 'rock.crown.ledge', spacing: 3.2 },
  { id: 'notch', base: 'rock.notch', ledge: 'rock.notch.ledge', spacing: 2.2 },
  { id: 'ochre', base: 'rock.ochre', ledge: 'rock.ochre.ledge', spacing: 4 },
  { id: 'sea', base: 'rock.sea', ledge: 'rock.sea.ledge', spacing: 3.2 },
] as const;
export const packTerrainPaint = (ground: number, rockSet: number): number => (ground & 31) | ((rockSet & 3) << 5);
export const terrainPaintGround = (byte: number): number => byte & 31;
export const terrainPaintRockSet = (byte: number): number => (byte >> 5) & 3;
/** Biome ground that the renderer blends softly between neighbours (bed paint is never blended). */
export const BIOME_GROUNDS: readonly number[] = ['sand', 'bankedTurf', 'duff', 'ochre', 'scree'].map(id => TERRAIN_SURFACE_PALETTE.findIndex(p => p.id === id));
/** Rock weight from a triangle's slope: 0 at 35°, 1 at 45°, ≥ 0.5 above the walkable limit. */
export const ROCK_BLEND_DEGREES = [35, 45] as const;
export const rockWeight = (degrees: number): number => smooth((degrees - ROCK_BLEND_DEGREES[0]) / (ROCK_BLEND_DEGREES[1] - ROCK_BLEND_DEGREES[0]));

interface Band { id: string; min: number; max: number; poly: XY[]; centre: XY; bounds: number[]; priority: number }
let model: { bands: Band[]; water: WaterCut[]; scale: number } | undefined;
function getModel(): NonNullable<typeof model> {
  if (model) return model;
  const s = requireScaleFactor();
  const ordered = ['sands', 'reach', 'harbour', 'green', 'flats', 'scholars', 'prow', 'shoulder', 'crown', 'hollow', 'stillwater'];
  const bands: Band[] = [];
  for (const f of M.landforms) if (f.poly && Array.isArray(f.h)) {
    const poly: XY[] = f.poly.map(p => [p[0]! * s, p[1]! * s]);
    bands.push({ id: f.id, min: f.h[0]! * s, max: f.h[1]! * s, poly, centre: polygonCentre(poly), priority: ordered.indexOf(f.id),
      bounds: [Math.min(...poly.map(p => p[0])), Math.min(...poly.map(p => p[1])), Math.max(...poly.map(p => p[0])), Math.max(...poly.map(p => p[1]))] });
  }
  bands.sort((a, b) => a.priority - b.priority);
  return model = { bands, water: buildWaterCuts(), scale: s };
}
/** Polygon-normalised summit. Its contours inherit the unequal shoulders and ridges
 * of the Crown polygon; this is not a radial cone or a circular district plateau. */
function crownHeight(b: Band, x: number, z: number): number {
  const s = getModel().scale, summit = M.landforms.find(f => f.id === 'crown')!;
  const sx = summit.summit![0]! * s, sz = summit.summit![1]! * s;
  const dx = x - sx, dz = z - sz, distance = Math.hypot(dx, dz);
  if (distance < 1e-8) return summit.summitH! * s;
  const ux = dx / distance, uz = dz / distance;
  let edgeDistance = Infinity;
  for (let i = 0; i < b.poly.length; i++) {
    const a = b.poly[i]!, c = b.poly[(i + 1) % b.poly.length]!, ex = c[0] - a[0], ez = c[1] - a[1];
    const ax = a[0] - sx, az = a[1] - sz, cross = ux * ez - uz * ex;
    if (Math.abs(cross) < 1e-10) continue;
    const t = (ax * ez - az * ex) / cross, u = (ax * uz - az * ux) / cross;
    if (t > 0 && u >= -1e-10 && u <= 1 + 1e-10) edgeDistance = Math.min(edgeDistance, t);
  }
  // A broad north shoulder and a long south ridge; one peak, no equal-height rings.
  const q = clamp(distance / Math.max(1, edgeDistance));
  const ridge = clamp(1 - 0.16 * dx / (260 * s) + 0.12 * dz / (260 * s), 0.75, 1.25);
  let height = mix(110 * s, summit.summitH! * s, Math.pow(1 - smooth(q), ridge));
  // The skylight opens at the manifest's northern shaft endpoint (1300,400),
  // not at the lake centre (1300,420). A small rock saddle meets its 138 m rim.
  const opening = M.underground.rooms.deep.skylight;
  const saddleDistance = Math.max(Math.abs(x / s - opening.to[0]!) - 8, Math.abs(z / s - opening.to[1]!) - 8);
  if (saddleDistance < 20) height = mix(height, opening.topH * s, 1 - smooth(saddleDistance / 20));
  return height;
}
function bandHeight(b: Band, x: number, z: number): number {
  if (b.id === 'crown') return crownHeight(b, x, z);
  const dx = (x - b.centre[0]) / (b.bounds[2]! - b.bounds[0]!), dz = (z - b.centre[1]) / (b.bounds[3]! - b.bounds[1]!);
  let fraction = 0.55 - 0.5 * dz + 0.12 * dx;
  if (b.id === 'hollow') fraction = 0.28 + 1.35 * dx * dx - 0.64 * dz + 0.12 * dz * dz;
  if (b.id === 'scholars') fraction = 0.52 + 0.46 * dx + 0.38 * dz;
  if (b.id === 'flats') fraction = 0.48 + 0.65 * dx + 0.09 * dz;
  if (b.id === 'prow') fraction = 0.52 - 0.6 * dx + 0.1 * dz;
  if (b.id === 'sands') fraction = 0.42 - 0.66 * dz + 0.08 * dx;
  if (b.id === 'harbour') fraction = 0.55 - 0.52 * dz - 0.22 * dx;
  if (b.id === 'stillwater') fraction = 0.76 - 0.08 * dz;
  return mix(b.min, b.max, clamp(fraction, 0.04, 0.96));
}
function outsideHeight(x: number, z: number, shore: number, s: number): number {
  // Authored offshore land is part of this same heightfield. The arch/Stacks are solids.
  const lamp: XY[] = [[502, 1220], [510, 1202], [533, 1190], [558, 1200], [580, 1225], [573, 1250], [543, 1268], [515, 1255]].map(p => [p[0]! * s, p[1]! * s]);
  const d = polygonDistance(lamp, x, z);
  if (d >= 0) return (0.2 + 7.8 * smooth(d / (18 * s))) * s;
  const sandbar: XY[] = [[585, 1010], [606, 990], [642, 985], [657, 996], [631, 1005], [601, 1018]].map(p => [p[0]! * s, p[1]! * s]);
  if (contains(sandbar, x, z)) return -0.22 * s;
  return -Math.max(0.1 * s, Math.min(12 * s, -shore * 0.18));
}
/** landformRule band-edge blend (m) and the scarp over which a band gap is crossed (m). */
export const BAND_BLEND = 60, BAND_STEP = 15;
/** landformRule: the terraces cut into the Shoulder, and the Crown standing on it: each
 * holds its band to its own edge, and the transition is the Shoulder's (the Cup is water). */
const SHOULDER_RINGED = new Set(['hollow', 'stillwater', 'crown']);
/** Authored land and named hydrology, before Track B's beds, aprons and openings. */
export function baseHeight(x: number, z: number): number {
  const m = getModel(), s = m.scale, shore = signedShoreDistance(x, z);
  if (shore < 0) return bightAbutment(x, z, outsideHeight(x, z, shore, s));
  // The Water's Way (L2b, D-WW73): the Green's north scarp is a planted batter carrying the Glasshouse stair-and-ramp; it reads
  // the ground before it on the terrace and the Green either side of the face.
  const height = glasshouseScarp(x / s, z / s, landHeight(x, z, shore) / s, (qx, qz) => landHeight(qx * s, qz * s, signedShoreDistance(qx * s, qz * s)) / s) * s;
  return coveStairBench(x, z, bightAbutment(x, z, spitKnollCut(x, z, applyWaters(x, z, height, m.water))));
}
/** Authored land before the named water and the late local edits (the scarp batter, the abutments, the cove bench). */
function landHeight(x: number, z: number, shore: number): number {
  const m = getModel(), s = m.scale;
  if (shore < 0) return outsideHeight(x, z, shore, s);
  let height = (9 + 28 * clamp((1150 - z / s) / 1000) + 10 * clamp((x / s - 1050) / 650)) * s;
  // landformRule: where polygons overlap or meet, the higher band wins and its 60 m
  // blend lies INSIDE the winner, so the lower landform keeps its band to the edge.
  // Q is the proximity to lower-priority landforms (1 inside one, fading over 60 m);
  // against open ground (Q = 0) the blend stays outward as before. Where two bands
  // do not meet (a terrace cut into the Shoulder) the gap is one short scarp.
  const blend = BAND_BLEND * s, step = BAND_STEP * s, distances: number[] = [];
  for (const b of m.bands) {
    const far = x < b.bounds[0]! - blend || z < b.bounds[1]! - blend || x > b.bounds[2]! + blend || z > b.bounds[3]! + blend;
    const distance = far ? -Infinity : polygonDistance(b.poly, x, z);
    let proximity = 0;
    for (const lower of distances) if (lower > -blend) proximity = Math.max(proximity, lower >= 0 ? 1 : 1 - smooth(-lower / blend));
    distances.push(distance);
    if (distance <= -blend) continue;
    // A terrace cut INTO the Shoulder (landformRule) holds its band to its own edge and the
    // scarp is the Shoulder's wall; elsewhere the winner's own edge carries the scarp.
    const d = distance + (SHOULDER_RINGED.has(b.id) ? step * proximity : 0);
    const weight = d < 0 ? smooth(1 + d / blend) * (1 - proximity) : 1 - (1 - smooth(d / blend)) * proximity;
    height = mix(height, bandHeight(b, x, z), weight);
    // A ringed terrace holds its band fully to its own edge, whatever the neighbour (P01: Stillwater's
    // west edge against open ground held only 85 % of it at proximity 0.74); the scarp lies outside.
    if (d > 0) height = mix(height, clamp(height, b.min, b.max), SHOULDER_RINGED.has(b.id) && proximity > 0 ? smooth(d / (step * proximity)) : smooth(d / step));
  }
  height = stillwaterSill(x, z, throatButtress(x, z, height));
  // Pass 5 (D-M1/D-M2): Mountain v2 stands on the Crown summit; inside its footprint its ground (or the Foot terrace, or the
  // apron to the Horizon's own ground) replaces the bands. North of v2's summit line the Crown's north face wins where higher.
  height = mountainV2Height(x / s, z / s, height / s) * s;
  // Mountain V3 (D-M11): the Highlands and the Falls reshape the ring round v2 (Glacier Peak, the benches, the gorges, the Veil).
  height = mountainV3Height(x / s, z / s, height / s) * s;
  const character = coastCharacter(x, z), shoreWidth = character === 'southBeach' ? 44 * s : character === 'bight' ? 23 * s : 10 * s;
  height = mix(0.14 * s, height, smooth(shore / shoreWidth));
  return damWindow(x, z, notchHeight(x, z, height));
}
/**
 * D-A1 (MANIFEST v2.0 `structures.bightBridge.ends.abutments`): the Bight Bridge's west abutment is an embankment
 * 14 m along the axis × 24 m across it, from the Flats spit tip [460,1020] to the deck end (axis s 0 at [460,1030]),
 * its top at the deck (h_deck 12) under the whole deck section (−9 … +12.6, centred +1.8). Its back and sides fall
 * at 1 : 1.5 to the ground; its front stops at s −1 and falls to the sea floor by s +2.5, behind the abutment's
 * face, so no earth stands under the deck (the seabed under the deck is never raised). Raise only.
 * Integrator 3 (W5-A request): the east abutment is the same embankment mirrored on the east headland (axis s 244.1
 * at [660,1170]), so S2's banked descent leaves the deck onto ground (its first off-deck sample [659.5,1178.8], s 248.8
 * o −7.5, stood over the sea: `bed.S2.overWater`).
 */
export const BIGHT_ABUTMENT = { length: 14, width: 24, centreOffset: 1.8, frontStop: -1, frontFall: 3.5, sideSlope: 1.5 } as const;
let abutmentFrame: { w: XY; u: XY; n: XY; top: number } | undefined;
function bightAbutment(x: number, z: number, height: number): number {
  const s = getModel().scale, B = M.structures.bightBridge as { h_deck: number; ends: { west: number[]; east: number[]; axis_m: number } };
  const f = abutmentFrame ??= (() => { const w: XY = [B.ends.west[0]! * s, B.ends.west[1]! * s], dx = B.ends.east[0]! * s - w[0], dz = B.ends.east[1]! * s - w[1], l = Math.hypot(dx, dz); return { w, u: [dx / l, dz / l] as XY, n: [dz / l, -dx / l] as XY, top: B.h_deck * s }; })();
  const px = x - f.w[0], pz = z - f.w[1], axisS = px * f.u[0] + pz * f.u[1], across = px * f.n[0] + pz * f.n[1] - BIGHT_ABUTMENT.centreOffset * s, c = BIGHT_ABUTMENT;
  // The nearer end's frame: west measures back from s 0, east measures forward from the axis end (mirrored).
  const A = B.ends.axis_m * s, along = axisS <= A / 2 ? axisS : A - axisS;
  if (along > (c.frontStop + c.frontFall) * s || along < -(c.length + 30) * s || Math.abs(across) > (c.width / 2 + 30) * s) return height;
  const back = Math.max(0, -c.length * s - along), side = Math.max(0, Math.abs(across) - c.width / 2 * s), out = Math.hypot(back, side);
  let fill = f.top - out / c.sideSlope;
  if (along > c.frontStop * s) fill -= (f.top + 3 * s) * smooth((along - c.frontStop * s) / (c.frontFall * s));
  return Math.max(height, fill);
}
/**
 * D-C14 (MANIFEST v2.0 `structures.coveStair`, W5-S request 1): the cliff stair's two flights are cut into the cove's face.
 * Under each flight (and its landing) the rock is benched 3.5 wide to the flight's own height less 0.25 (the stair's
 * treads stand on rock, never buried), and the landward wall of the bench rises at 1 : 0.3 (73°, a rock face) back to the
 * cliff. Lowering only: where the face falls below a flight, the stair is the structure's (posted to the rock).
 * Flight 0 [631.2,241.9] 34.1 → [605.9,251.3] 17.55; landing ≈ [603.9,250.2] 3 × 6.5 at 17.55; flight 1 → [630,235] 1.0.
 */
export const COVE_STAIR_BENCH = { half: 1.75, tread: .25, wall: .3, flights: [[[631.2, 34.1, 241.9], [605.9, 17.55, 251.3]], [[605.9, 17.55, 251.3], [603.9, 17.55, 250.2]], [[603.9, 17.55, 250.2], [630, 1, 235]]] as const } as const;
function coveStairBench(x: number, z: number, height: number): number {
  const s = getModel().scale, c = COVE_STAIR_BENCH;
  if (x < 590 * s || x > 645 * s || z < 225 * s || z > 265 * s) return height;
  const original = height, under: number[] = [];
  for (const flight of c.flights) {
    const line: XYZ[] = flight.map(p => [p[0] * s, p[1] * s, p[2] * s]), q = linePoint(line, x, z), d = Math.max(0, q.distance - c.half * s);
    if (d <= 0) under.push(q.height - c.tread * s);
    const bench = q.height - c.tread * s + d / c.wall;
    if (bench < height) height = bench;
  }
  // The flights double back 4–5 m apart: one flight's bench wall never undercuts the other flight's own bench (the
  // 5 m lattice cannot carry two stacked benches; the lower flight is then carried on its posts, seaward of the upper).
  for (const h of under) height = Math.max(height, Math.min(original, h));
  return height;
}
/**
 * D-A1 (MANIFEST v2.0 `skate.S2.westRamp`): S2's west ramp comes down the Wash at one even 5 % grade and passes the
 * spit knoll [480–492, 950–1010] in a cutting of at most 4 eu. The knoll's east flank (the Flats' shoulder, 28–37 on the
 * ramp's line with no bed over it) is lowered into a saddle: the ground at the ramp's shoulder (3.5 m from its centreline)
 * stands at the ramp; it rises 4 over the next 6 m (the cutting's face, 34°), then climbs back to the knoll at 1 : 0.8
 * (39°, inside the 40° walkable limit: a steep bank, not a rock wall). Candidate 3's S2 bed already held this flank at
 * 17–21 (a 56° scarp up to the Flats at 36–38); the saddle keeps that scarp's footprint within ≈ 10 m. The saddle holds only over the ramp's knoll stretch (z 945–1015, feathered over 12 m along the ramp) and only
 * lowers ground. The cut depth at the cutting's crest (ground − ramp) is therefore ≤ 4 wherever the saddle holds.
 */
export const SPIT_KNOLL_CUT = { shoulder: 3.5, face: 6, depth: 4, flank: .8, z: [945, 1015], feather: 12 } as const;
let rampLine: XYZ[] | undefined;
export function s2WestRamp(): XYZ[] {
  if (rampLine) return rampLine;
  const s = getModel().scale, S2 = M.skate.S2 as { pts: number[][]; westRamp?: { from: number[]; to: number[]; from_h: number; to_h: number } }, r = S2.westRamp;
  if (!r) return rampLine = [];
  const same = (p: number[], q: number[]) => Math.abs(p[0]! - q[0]!) < 1e-6 && Math.abs(p[1]! - q[1]!) < 1e-6, i0 = S2.pts.findIndex(p => same(p, r.from)), i1 = S2.pts.findIndex(p => same(p, r.to));
  if (i0 < 0 || i1 <= i0) return rampLine = [];
  const pts = S2.pts.slice(i0, i1 + 1), arcs = [0];
  for (let i = 1; i < pts.length; i++) arcs.push(arcs[i - 1]! + Math.hypot(pts[i]![0]! - pts[i - 1]![0]!, pts[i]![1]! - pts[i - 1]![1]!));
  return rampLine = pts.map((p, i) => [p[0]! * s, mix(r.from_h, r.to_h, arcs[i]! / arcs.at(-1)!) * s, p[1]! * s]);
}
function spitKnollCut(x: number, z: number, height: number): number {
  const s = getModel().scale, c = SPIT_KNOLL_CUT, line = s2WestRamp();
  if (line.length < 2 || z < (c.z[0] - 80) * s || z > (c.z[1] + 80) * s || x < 400 * s || x > 560 * s) return height;
  const q = linePoint(line, x, z), stretch = smooth((q.z - (c.z[0] - c.feather) * s) / (c.feather * s)) * (1 - smooth((q.z - c.z[1] * s) / (c.feather * s)));
  if (stretch <= 0) return height;
  const d = Math.max(0, q.distance - c.shoulder * s), target = q.height + Math.min(c.depth * s, d * c.depth / c.face) + Math.max(0, d - c.face * s) * c.flank;
  return target >= height ? height : mix(height, target, stretch);
}
/**
 * The Throat is cut into a north-facing buttress, not into an exposed low edge: its surveyed 110 m
 * floor plus 18 m aperture has real rock above it (≥ 131 over the mouth, rising south). Applied after
 * the band blend: since the landformRule blend moved inside the winning polygon (Stage A), the Crown's
 * own band no longer reached the mouth 13 m inside its north edge, the ground there fell to 115–123
 * and the P25 Throat samples (y 111–127, z 300–310) stood in open air, sunlit 8–17 of 75.
 */
function throatButtress(x: number, z: number, height: number): number {
  const s = getModel().scale, tx = Math.abs(x / s - 1300), north = smooth((z / s - 268) / 24), south = 1 - smooth((z / s - 345) / 65);
  const buttress = smooth(1 - Math.max(0, tx - 18) / 72) * north * south;
  return buttress <= 0 ? height : mix(height, Math.max(height, (131 + 5 * clamp((z / s - 300) / 60)) * s), buttress);
}
/**
 * The Throat's mouth is an opening in the buttress's north face: its jambs (5 m either side of the mouth
 * outline, fading over 5 m more, from 6 m in front of it to its back) stay rock at the buttress height whatever a route's blend
 * does below them, so the low June sun from the NE never reaches into the mouth (LIGHT §2, P25). A bed's
 * carriageway and shoulder are never raised (the jamb fades in over 4 m from a bed's edge).
 */
function throatJambs(x: number, z: number, height: number, cuts: LandCuts, edgeGap: number): number {
  const s = getModel().scale, mouth = cuts.mouths.find(m => m.id === 'throat'); if (!mouth) return height;
  const xs = mouth.outline.map(p => p[0]), zs = mouth.outline.map(p => p[1]), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const beside = Math.max(x0 - x, x - x1), front = z0 - 6 * s - z;
  if (beside <= 0 || beside > 10 * s || front > 0 || z > z1) return height;
  const jamb = (131 + 5 * clamp((z / s - 300) / 60)) * s;
  return Math.max(height, mix(height, jamb, (1 - smooth((beside - 5 * s) / (5 * s))) * smooth(edgeGap / (4 * s))));
}
/** The Notch's east rim near the High Span: under page A's square→deck-line sight line (22.3) less 0.8. */
export const HIGH_SPAN_EAST_RIM = 21.5;
/** The High Span's surveyed station on the lower river (water 9.2, bed 8). */
const HIGH_SPAN_STATION: XY = [1236.875, 1105];
/** The Notch's own line: the lower river from its v2.5 head at the old dam foot [1140,905] (v2.6 prepends the sill's lip in
 * the lake, D-M3; the gorge's walls keep their v2.5 progress so nothing below the sill moves). */
let notchLine: XYZ[] | undefined;
function notchPoints(): XYZ[] {
  if (notchLine) return notchLine;
  const s = getModel().scale, points = getModel().water.find(w => w.id === 'water.river.lower')!.points;
  const head = points.findIndex(p => Math.abs(p[0] - NOTCH_HEAD[0] * s) < 1e-6 && Math.abs(p[2] - NOTCH_HEAD[1] * s) < 1e-6);
  return notchLine = head > 0 ? points.slice(head) : points;
}
function notchHeight(x: number, z: number, height: number): number {
  const m = getModel(), s = m.scale, river = m.water.find(w => w.id === 'water.river.lower')!;
  const q = linePoint(notchPoints(), x, z);
  // The gorge opens progressively to the Reach; it is never a uniform trench.
  if (q.z > 1170 * s || q.z < 906 * s) return height;
  // Under the High Span the floor is a shelf at the water, ≥ 40 m across between the
  // walls (the flight gate's aperture): 28 m on the east (Green-rim) side, 16 m west.
  const span = 1 - smooth((Math.hypot(q.x - HIGH_SPAN_STATION[0] * s, q.z - HIGH_SPAN_STATION[1] * s) - 40 * s) / (40 * s));
  const east = q.tangent[0] * (z - q.z) - q.tangent[1] * (x - q.x) < 0;
  const floor = mix(river.width / 2, (east ? 28 : 16) * s, span), wall = (22 + 11 * q.progress) * s - river.width / 2;
  const half = floor + wall, run = NOTCH_RIM_RUN * s;
  if (q.distance >= half + run) return height;
  // Page A frames the High Span's deck line (23–29) from the square (eye 13.6): the east rim near the bridge
  // stays under that sight line along its whole length, easing back to the gorge's rim over 50 m, instead
  // of a knife-edge spine at 30–35 that a sight window would notch into two striped spires.
  const fromSpan = Math.hypot(q.x - HIGH_SPAN_STATION[0] * s, q.z - HIGH_SPAN_STATION[1] * s);
  const gorgeRim = q.height + (32 - 7 * q.progress) * s;
  // South of the High Span S1 leaves its shelf and runs down INSIDE the west wall (x 1222–1240): the west rim
  // beyond it is S1's cut bank, never a free-standing rim at 25–30 between S1's cut and the Green (a striped
  // fin at [1205–1220, 1150–1175] on pages A/F). It stands at the Green's own ground, at most WEST_BANK.
  const westBank = east ? 0 : smooth((q.z - 1110 * s) / (20 * s));
  const rim = Math.max(height, east ? mix(Math.min(gorgeRim, HIGH_SPAN_EAST_RIM * s), gorgeRim, smooth((fromSpan - 70 * s) / (50 * s)))
    : mix(gorgeRim, Math.min(gorgeRim, Math.max(height, NOTCH_WEST_BANK * s)), westBank));
  // The gorge floor meets the river at its surface; applyWaters carves the wet bed.
  if (q.distance <= floor) return q.height;
  if (q.distance <= half) { const t = smooth((q.distance - floor) / Math.max(1, wall)); return mix(q.height, rim, t * t); }
  return mix(rim, height, smooth((q.distance - half) / run));
}
/** The Notch's west bank south of the High Span, where S1 runs inside the west wall (eu): S1 at 11–12 plus 4. */
export const NOTCH_WEST_BANK = 16;
/**
 * South of Stillwater (x 1175–1285, z 895–940) the ground falls to the dam and the Green: the Shoulder's
 * outward blend, which passes the terrace's south-east corner, never stands above the terrace's own top (55).
 * It left a 10 m striped fin at 60–67 over S1's cut at [1235–1260, 905–915] (pages A, F).
 */
export const STILLWATER_SILL = { top: 55, x: [1175, 1190, 1265, 1285], z: [895, 925, 940] } as const;
function stillwaterSill(x: number, z: number, height: number): number {
  const s = getModel().scale, c = STILLWATER_SILL, top = c.top * s;
  if (height <= top || z < c.z[0] * s || z > c.z[2] * s || x < c.x[0] * s || x > c.x[3] * s) return height;
  const wx = smooth((x - c.x[0] * s) / ((c.x[1] - c.x[0]) * s)) * (1 - smooth((x - c.x[2] * s) / ((c.x[3] - c.x[2]) * s)));
  const wz = 1 - smooth((z - c.z[1] * s) / ((c.z[2] - c.z[1]) * s));
  return mix(height, top, wx * wz);
}
/** How far the Notch's rim shoulder runs back before meeting the surrounding ground (m). */
export const NOTCH_RIM_RUN = 20;
/** The square→dam window (page A, F): in front of the dam face nothing between the
 * square and the dam stands above 18 eu, and no bank shades the face at 09:00/15:00.
 * The dam's own abutments stay; the river's channel and banks are applied after this. */
export const DAM_WINDOW = { cap: 18, feather: 20, halfWidth: 30, forecourt: 70 } as const;
/** The dam's crest (m): the lake at 50 is held by a wall topped at 49.3–50. v2.6 (D-M3): no dam; the same tie holds the
 * natural sill's shoulders at the lake level either side of the lip. */
const DAM_CREST = 50;
/** v2.6 (D-M3): the Notch head (the v2.5 dam line, MANIFEST retired_v2_6 structures.dam.xy): the sill and its forecourt window. */
export const NOTCH_HEAD = [1140, 905] as const;
/** v2.6: the square→Notch-head window keeps its v2.5 eye (page A v2_5): the ground it shaped outside Mountain v2 does not move. */
const WINDOW_EYE = [1470, 1186] as const;
function damWindow(x: number, z: number, height: number): number {
  const s = getModel().scale, dam = NOTCH_HEAD, view = WINDOW_EYE;
  const dx = dam[0]! * s, dz = dam[1]! * s;
  // The abutments tie into the ground at crest height (the lake terrace), no higher.
  if (z > dz - 12 * s && z < dz + 16 * s && Math.abs(x - dx) < 90 * s) height = Math.min(height, mix(height, DAM_CREST * s, 1 - smooth((Math.abs(x - dx) - 60 * s) / (30 * s))));
  if (z < dz + 4 * s || height <= DAM_WINDOW.cap * s) return height;
  // A corridor as wide as the wall (±22 m) plus margin from the dam toward the square,
  // and the forecourt in front of the face.
  const ax = view[0]! * s - dx, az = view[1]! * s - dz, length = Math.hypot(ax, az), ux = ax / length, uz = az / length;
  const along = (x - dx) * ux + (z - dz) * uz, across = Math.abs(-(x - dx) * uz + (z - dz) * ux);
  const corridor = along < 0 || along > length - 40 * s ? Infinity : across - DAM_WINDOW.halfWidth * s;
  const outside = Math.min(corridor, Math.hypot(x - dx, z - dz) - DAM_WINDOW.forecourt * s);
  const weight = (1 - smooth(outside / (DAM_WINDOW.feather * s))) * smooth((z - dz - 4 * s) / (6 * s));
  return mix(height, DAM_WINDOW.cap * s, weight);
}
/**
 * Sketchbook sight windows (MANIFEST views, the P27 proof). Where a page's subject stands low behind
 * open ground its eye cannot see over, that ground is held under the sight plane from the eye to the
 * subject's line, less a margin: the plan triangle eye→A→B, feathered over `feather` m outside it,
 * never within `near` m of the eye, and never on a bed (its carriageway and shoulder keep their
 * grade; the trim fades in over `bedFade` m from a bed's edge so no bed is left on a causeway).
 * `eyeH` is the pose's measured eye (floor + 1.6) on the Stage A bake; a test holds it to the bake.
 * - (A · the High Span from the square is held by the Notch's east rim cap, HIGH_SPAN_EAST_RIM: a window
 *   notched the 35 eu rim spine at [1288–1311, 1115–1131] into two striped spires.)
 * - A · the dam's glass face: the gallery flights' embankment at [1169–1176, 916–918] (40–47) and
 *   V01's embankment toe at [1382–1389, 1110–1119] (17–19) cut the face's east half.
 * - C · the skate shelf: since S1 rides the shelf deck (v1.9, W3-A A2) the ground where its at-grade
 *   carriageway ran, [1207–1222, 1081–1135] at 10.4–12.7, stood between the overlook and the shelf
 *   (11–12.3): 2 px at 16:9. The window from the eye [1268,1145] h 11.6 to the shelf line clears it (40 px).
 * - D · surf (W5, R2-14): the eye [1185,1445] (2.65) stands behind the Long Sands' dune humps (1.8–3.3); the sea beyond the beach
 *   west-south-west read 7 px at 1440 × 900. The window from the eye to the shoreline [1000–1100, 1490–1500] holds the sand
 *   under the line to the surf (probe on the W5 bake: 55 px). The zipline landing's stair still covers the surf on the phone.
 * Every window lies outside the band polygons or inside the Notch walls' exclusion, or trims a band
 * only within its own range (harbour 0–18): P01 is untouched by construction.
 */
export interface SightWindow { page: string; subject: string; eyeH: number; a: XYZ; b: XYZ; margin: number; near: number; feather: number; bedFade: number }
export const SIGHT_WINDOWS: readonly SightWindow[] = [
  { page: 'A', subject: 'the sill falls (v2.5: the dam\'s glass face)', eyeH: 13.6, a: [1121, 38, 909], b: [1160, 38, 909], margin: 1, near: 40, feather: 8, bedFade: 6 },
  { page: 'C', subject: 'the skate shelf', eyeH: 11.6, a: [1206, 11.6, 1078], b: [1206, 11.6, 1136], margin: 1.1, near: 12, feather: 6, bedFade: 4 },
  { page: 'D', subject: 'surf', eyeH: 2.65, a: [1000, 0.9, 1500], b: [1100, 0.9, 1490], margin: .3, near: 10, feather: 6, bedFade: 4 },
];
interface PreparedWindow { eye: XYZ; a: XYZ; b: XYZ; tri: XY[]; det: number; w: SightWindow; box: number[] }
let preparedWindows: PreparedWindow[] | undefined;
function windowsPrepared(): PreparedWindow[] {
  if (preparedWindows) return preparedWindows;
  const s = getModel().scale;
  return preparedWindows = SIGHT_WINDOWS.map(w => {
    const xy = M.views.find(v => v.id === w.page)!.xy, eye: XYZ = [xy[0]! * s, w.eyeH * s, xy[1]! * s];
    const a: XYZ = [w.a[0] * s, w.a[1] * s, w.a[2] * s], b: XYZ = [w.b[0] * s, w.b[1] * s, w.b[2] * s];
    const tri: XY[] = [[eye[0], eye[2]], [a[0], a[2]], [b[0], b[2]]], f = w.feather * s;
    const det = (a[0] - eye[0]) * (b[2] - eye[2]) - (b[0] - eye[0]) * (a[2] - eye[2]);
    return { eye, a, b, tri, det, w, box: [Math.min(...tri.map(p => p[0])) - f, Math.min(...tri.map(p => p[1])) - f, Math.max(...tri.map(p => p[0])) + f, Math.max(...tri.map(p => p[1])) + f] };
  });
}
/** Ground height under the sight windows: `height` trimmed toward each window's plane (never below the land floor). */
export function sightWindows(x: number, z: number, height: number, edgeGap = Infinity): number {
  const s = getModel().scale;
  for (const p of windowsPrepared()) {
    if (x < p.box[0]! || z < p.box[1]! || x > p.box[2]! || z > p.box[3]!) continue;
    const inside = polygonDistance(p.tri, x, z), w = p.w;
    const weight = (inside >= 0 ? 1 : 1 - smooth(-inside / (w.feather * s)))
      * smooth((Math.hypot(x - p.eye[0], z - p.eye[2]) - w.near * s) / (w.feather * s)) * smooth(edgeGap / (w.bedFade * s));
    if (weight <= 0) continue;
    // The plane through the eye, A and B, evaluated in plan (barycentric in the eye→A→B triangle).
    const dx = x - p.eye[0], dz = z - p.eye[2];
    const alpha = (dx * (p.b[2] - p.eye[2]) - (p.b[0] - p.eye[0]) * dz) / p.det, beta = ((p.a[0] - p.eye[0]) * dz - dx * (p.a[2] - p.eye[2])) / p.det;
    const plane = Math.max(LAND_FLOOR * s, p.eye[1] + alpha * (p.a[1] - p.eye[1]) + beta * (p.b[1] - p.eye[1]) - w.margin * s);
    if (height > plane) height = mix(height, plane, weight);
  }
  return height;
}
/** Depth of the bed within one lattice diagonal of a water edge (eu): the water card sits on it. */
export const WET_EDGE_DEPTH = .03;
const waterBounds = new WeakMap<WaterCut, readonly [number, number, number, number]>();
/** Named water in its bed. The raster guard (one lattice diagonal outside the true
 * edge) holds the bank AT the water level, never below it: a triangle straddling the
 * edge stays under a level pool, and the bank meets the surface where it is drawn. */
function applyWaters(x: number, z: number, original: number, waters: WaterCut[], rasterMargin = 0): number {
  const s = getModel().scale;
  let h = original, wetBedCeiling = Infinity, lakeLip = -Infinity;
  for (const water of waters) {
    if (water.underground || water.kind === 'sea' || water.kind === 'lagoon') continue;
    const guard = water.kind === 'dry' ? 0 : rasterMargin;
    const bankWidth = water.points.length ? 4 * s : 8 * s, outer = (water.points.length ? 12 * s : 24 * s) + guard;
    let bounds = waterBounds.get(water);
    if (!bounds) {
      bounds = water.points.length ? [Math.min(...water.points.map(p => p[0])) - water.width / 2, Math.min(...water.points.map(p => p[2])) - water.width / 2, Math.max(...water.points.map(p => p[0])) + water.width / 2, Math.max(...water.points.map(p => p[2])) + water.width / 2] :
        [Math.min(...water.outline.map(p => p[0])), Math.min(...water.outline.map(p => p[1])), Math.max(...water.outline.map(p => p[0])), Math.max(...water.outline.map(p => p[1]))];
      waterBounds.set(water, bounds);
    }
    if (x < bounds[0] - outer || z < bounds[1] - outer || x > bounds[2] + outer || z > bounds[3] + outer) continue;
    const { distance, level, grade } = waterInfluence(water, x, z);
    if (distance > outer) continue;
    if (distance <= 0) {
      // Within one lattice diagonal of the edge the bed sits just under the surface, so a
      // triangle from here to the bank's foot never dips below the water outside the ribbon;
      // the bed deepens only beyond it. A weir's short run keeps its straddling vertices below it.
      const reach = water.points.length ? water.width / 2 : 14 * s, inner = Math.max(0, -distance - guard);
      const depth = WET_EDGE_DEPTH * s + (water.depth - WET_EDGE_DEPTH * s) * smooth(inner / Math.max(1 * s, reach - Math.min(guard, reach / 2))) + Math.min(grade * guard, 1.5 * s);
      // A channel never floats: where the ground falls away under it, its bed and banks
      // are raised to carry it (a perched reach reads as a raised stream, not a floating ribbon).
      // A basin (lake, tarn) does the same within one lattice diagonal of its edge: a triangle from its
      // edge to the bank never dips under the surface where the ground outside the terrace is lower (P06).
      const raise = water.kind !== 'dry' && (water.points.length ? !raiseForbidden(x, z) : guard > 0 && -distance <= guard);
      h = raise ? level - depth : Math.min(h, level - depth);
      wetBedCeiling = Math.min(wetBedCeiling, level - depth);
      continue;
    }
    // v2.6 (D-M3): no dam holds Stillwater; its bank is raised all round (the natural sill at the Notch head), and within its
    // bank's width no other water's bank (the outlet's fall beside the lip) pulls the ground under the lake's level: the lip holds
    // the lake; only the outlet's own wet channel cuts it (the wet-bed ceiling below).
    if (water.id === 'water.stillwater' && distance <= guard + bankWidth && Math.abs(x - NOTCH_HEAD[0] * s) < 90 * s && z > (NOTCH_HEAD[1] - 25) * s) lakeLip = Math.max(lakeLip, water.level);
    // The guard band IS the bank's foot: exactly at the water level (raised or cut to it); where a
    // stream meets the sea at level 0 the foot on land stays at the land floor (P05: ground > 0 inland).
    const foot = level < LAND_FLOOR * s && signedShoreDistance(x, z) > 0 ? LAND_FLOOR * s : level;
    if (distance <= guard) { h = foot; wetBedCeiling = Math.min(wetBedCeiling, foot); continue; }
    const d = distance - guard;
    if (d < bankWidth) h = mix(guard > 0 ? foot : Math.min(h, foot), Math.max(h, level + water.bank), smooth(d / bankWidth));
    else h = Math.max(h, mix(level + water.bank, h, smooth((d - bankWidth) / (outer - bankWidth))));
  }
  return Math.min(Math.max(h, lakeLip), wetBedCeiling);
}
const padFrames = new WeakMap<PadCut, { cos: number; sin: number; xReach: number; zReach: number }>();
function padDistance(p: PadCut, x: number, z: number): number {
  let frame = padFrames.get(p);
  if (!frame) {
    const r = p.rotationDegrees * Math.PI / 180, cos = Math.cos(r), sin = Math.sin(r), a = p.size[0] / 2 + p.margin, b = p.size[1] / 2 + p.margin;
    frame = { cos, sin, xReach: Math.abs(cos) * a + Math.abs(sin) * b + p.blend, zReach: Math.abs(sin) * a + Math.abs(cos) * b + p.blend }; padFrames.set(p, frame);
  }
  const dx = x - p.centre[0], dz = z - p.centre[2], beyond = Math.max(Math.abs(dx) - frame.xReach, Math.abs(dz) - frame.zReach);
  if (beyond > 0) return p.blend + beyond;
  const a = Math.abs(dx * frame.cos + dz * frame.sin) - p.size[0] / 2 - p.margin;
  const b = Math.abs(-dx * frame.sin + dz * frame.cos) - p.size[1] / 2 - p.margin;
  return Math.hypot(Math.max(0, a), Math.max(0, b)) + Math.min(0, Math.max(a, b));
}
interface PreparedSegment { bed: BedCut; a: XYZ; b: XYZ; arc: number; length: number; total: number }
interface PreparedBeds { bins: Map<string, PreparedSegment[]>; cell: number }
const preparedBedCache = new WeakMap<BedCut[], Map<number, PreparedBeds>>();
const cellKey = (x: number, z: number, cell: number): string => `${Math.floor(x / cell)},${Math.floor(z / cell)}`;
const cutsTerrain = (bed: BedCut) => bed.terrainCut && !['cave', 'rail', 'cable'].includes(bed.kind);
function prepareBeds(beds: BedCut[], rasterMargin = 0): PreparedBeds {
  const cache = preparedBedCache.get(beds), cached = cache?.get(rasterMargin); if (cached) return cached;
  const cell = 64 * getModel().scale, bins = new Map<string, PreparedSegment[]>();
  // Every potentially influencing segment is inserted; order remains bed order,
  // then segment order. Closed routes spanning the island no longer scan globally.
  for (const bed of beds) {
    if (!cutsTerrain(bed) || bed.points.length < 2) continue;
    const reach = bed.width / 2 + bed.shoulder + Math.max(bed.blend, 15 * getModel().scale, rasterMargin);
    const { lengths, total } = polylineArcs(bed.points); let arc = 0;
    for (let i = 0; i < bed.points.length - 1; i++) {
      const a = bed.points[i]!, b = bed.points[i + 1]!, length = lengths[i]!;
      const segment = { bed, a, b, length, arc, total }; arc += length;
      const minX = Math.floor((Math.min(a[0], b[0]) - reach) / cell), maxX = Math.floor((Math.max(a[0], b[0]) + reach) / cell);
      const minZ = Math.floor((Math.min(a[2], b[2]) - reach) / cell), maxZ = Math.floor((Math.max(a[2], b[2]) + reach) / cell);
      for (let j = minZ; j <= maxZ; j++) for (let k = minX; k <= maxX; k++) {
        const key = `${k},${j}`, bin = bins.get(key); if (bin) bin.push(segment); else bins.set(key, [segment]);
      }
    }
  }
  const prepared = { bins, cell }, next = cache ?? new Map<number, PreparedBeds>();
  next.set(rasterMargin, prepared); preparedBedCache.set(beds, next); return prepared;
}
/** Ground that no bed or pad may raise: the sea floor outside the surveyed
 * shoreline and the floor of every open basin (the Bight lagoon, the lakes). */
export function raiseForbidden(x: number, z: number): boolean {
  if (signedShoreDistance(x, z) < 0) return true;
  return getModel().water.some(w => !w.underground && !w.points.length && w.kind !== 'sea' && contains(w.outline, x, z));
}
/** Two beds whose decks overlap in plan within this height are one level (at grade). */
export const BED_LEVEL_TOLERANCE = .5;
/** Exact local segment lookup, exported for equivalence probes against brute force. */
export function createBedSampler(beds: BedCut[]): (x: number, z: number, original: number) => { height: number; surface: number | null; edgeGap: number; roadFloor: number } {
  const prepared = prepareBeds(beds), s = getModel().scale;
  return (x, z, original) => {
    let height = original, surface: number | null = null, active: BedCut | null = null;
    let distance = Infinity, target = 0, progress = 0, excluded = false;
    let footprintHeight = Infinity, footprintSurface: number | null = null, footprintCore = false;
    let deckHeight = -Infinity, deckSurface: number | null = null, edgeGap = Infinity, roadFloor = -Infinity;
    const apply = () => {
      if (!active || excluded) return;
      const edge = active.width / 2 + active.shoulder, blend = Math.max(active.blend, 15 * s);
      edgeGap = Math.min(edgeGap, distance - edge);
      // road (L1): a road stands on ground (its embankment), never on a pad's pull: within ROAD_BATTER_REACH of its edge the
      // ground may fall no lower than the deck's underside and then ROAD_BATTER (1 : 1.5) away from it (cutHeight applies it).
      if (active.kind === 'road' && !active.id.startsWith('structure.') && distance - edge <= ROAD_BATTER_REACH) roadFloor = Math.max(roadFloor, target - BED_TERRAIN_CLEARANCE - Math.max(0, distance - edge - ROAD_BERM) * ROAD_BATTER);
      const weight = 1 - smooth((distance - edge) / blend);
      if (weight <= 0) return;
      height = mix(height, target, weight);
      if (distance <= active.width / 2) {
        const material = active.surfaceSegments?.find(segment => progress >= segment.from && progress <= segment.to)?.surface ?? active.surface;
        surface = Math.max(0, TERRAIN_SURFACE_PALETTE.findIndex(p => p.id === material));
        // The highest deck over this point: a lower route's cut may never excavate under it.
        if (target > deckHeight) { deckHeight = target; deckSurface = surface; }
      }
      // A neighbouring route's soft bank cannot bury a visible bed. At an at-grade
      // crossing the lowest eligible bed needs clearance; solids own each deck.
      if (distance <= edge && target < footprintHeight) {
        footprintHeight = target; footprintSurface = surface; footprintCore = distance <= active.width / 2;
      }
    };
    for (const segment of prepared.bins.get(cellKey(x, z, prepared.cell)) ?? []) {
      if (segment.bed !== active) {
        apply(); active = segment.bed; distance = Infinity;
        excluded = !!active.terrainExclusions?.some(e => Math.hypot(x - (e.terrainAt ?? e.at)[0], z - (e.terrainAt ?? e.at)[1]) < (e.terrainRadius ?? e.radius));
      }
      if (excluded) continue;
      const { a, b } = segment, q = segmentPoint(x, z, [a[0], a[2]], [b[0], b[2]]);
      if (q.distance < distance) { distance = q.distance; target = mix(a[1], b[1], q.t); progress = (segment.arc + segment.length * q.t) / (segment.total || 1); }
    }
    apply();
    let result = Number.isFinite(footprintHeight) ? footprintHeight : height, paint = footprintSurface ?? surface;
    // An upper deck fills over a lower route's shoulder, never over its carriageway: a route is never
    // buried under another's embankment (VG under the Garden Walk at [969,766]); the upper stretch then
    // needs its named structure and is reported as an unsupported run until it has one.
    if (deckHeight > result + BED_LEVEL_TOLERANCE && !footprintCore) { result = deckHeight; paint = deckSurface; }
    // No bed raises the sea floor or a basin floor: offshore decks stand on piers.
    if (result > original && raiseForbidden(x, z)) result = original;
    // No route or deck builds ground above the Crown's summit (it stays the island's highest point).
    if (result > original) result = Math.min(result, Math.max(original, crownSummitHeight() - 1 * s));
    return { height: result, surface: paint, edgeGap, roadFloor };
  };
}
/** road (L1): a road's embankment: the ground beside a road falls at most 1 : 1.5 from the deck's underside at its edge, over
 * ROAD_BATTER_REACH, whatever a pad's blend or margin would pull it to (plot terraces.1's pad blend dug 6 eu under V03's edge). */
export const ROAD_BATTER = 1 / 1.5, ROAD_BATTER_REACH = 12;
/** road (L1): a level verge (eu) beyond the paved edge before the batter starts: half a 5 eu lattice cell, so the lattice triangle
 * that straddles the edge does not start falling at the edge itself (a 0.6 step off the shoulder at the Tideline park). */
export const ROAD_BERM = 2.5;
/** road (L1): no embankment is built deeper than this over the natural ground (a cliff drive keeps its cliff; its edge is L2's guard). */
export const ROAD_EMBANKMENT_MAX_FILL = 8;
/** Five centimetres survives centimetre encoding without terrain sharing the road's top face. */
export const BED_TERRAIN_CLEARANCE = .05;

/** Each supporting grid vertex is below the extended plane of every nearby bed
 * segment. Linear interpolation then stays below that same rendered deck plane.
 * The diagonal margin covers every vertex of a triangle touching the footprint.
 * Open spans cap intruding ground without filling their channels; tunnel roofs stay intact. */
export function createBedClearanceSampler(beds: BedCut[], rasterMargin = 0): (x: number, z: number) => number {
  // A bridge exclusion prevents raising the channel to the road, but must not
  // preserve a bank poking through its deck. Cap ground under named open spans
  // without raising it or cutting any tunnel/cave roof.
  const isSpan=(b:BedCut)=>b.id.startsWith('structure.')&&b.structureIds.length>0;
  const clearanceBeds=beds.map(b=>isSpan(b)?{...b,terrainCut:true,terrainExclusions:[]}:b);
  const prepared = prepareBeds(clearanceBeds, rasterMargin), s = getModel().scale;
  const floor = LAND_FLOOR * s, oreCeiling = oreRoadGroundCeiling(beds, rasterMargin);
  return (x, z) => {
    let ceiling = Infinity;
    const candidates: { value: number; plane: number; core: boolean; bed: BedCut }[] = [];
    const decks = new Map<BedCut, number>(), near = new Map<BedCut, number>();
    for (const {bed, a, b, length} of prepared.bins.get(cellKey(x, z, prepared.cell)) ?? []) {
      const exclusions=bed.terrainExclusions?.filter(e=>Math.hypot(x-(e.terrainAt??e.at)[0],z-(e.terrainAt??e.at)[1])<(e.terrainRadius??e.radius)+rasterMargin)??[];
      if (length < 1e-8 || exclusions.some(e=>!e.openSpan)) continue;
      const hit = segmentPoint(x, z, [a[0], a[2]], [b[0], b[2]]);
      if (hit.distance > bed.width / 2 + bed.shoulder + rasterMargin) continue;
      const dx = b[0] - a[0], dz = b[2] - a[2], open = isSpan(bed)||exclusions.some(e=>e.openSpan);
      // The extended deck plane keeps a triangle straddling a grade break below both
      // segments, but only across one raster diagonal: never a pit metres past the end.
      const reach = rasterMargin / length, t = clamp(((x - a[0]) * dx + (z - a[2]) * dz) / (length * length), -reach, 1 + reach);
      const clearance = open ? .65 : BED_TERRAIN_CLEARANCE, plane = mix(a[1], b[1], hit.t);
      // Extrapolation may not dig below the land floor unless the deck itself is lower, nor
      // more than a 25 % grade's drop over that diagonal below the deck it extends (no pits).
      const value = Math.max(mix(a[1], b[1], t) - clearance, Math.min(plane - clearance, floor), plane - clearance - MAX_EXTRAPOLATED_GRADE * rasterMargin);
      const core = hit.distance <= bed.width / 2 + bed.shoulder;
      candidates.push({ value, plane, core, bed });
      if (!open && hit.distance <= bed.width / 2) decks.set(bed, Math.max(decks.get(bed) ?? -Infinity, plane));
      if (!open) near.set(bed, Math.max(near.get(bed) ?? -Infinity, plane));
    }
    // A lower route's cut never excavates under ANOTHER route's upper deck it passes beneath,
    // and its conservative raster margin never digs a pit into another upper route's footprint.
    // R2-08: a route more than OVERPASS_SEPARATION above is an over/under crossing (its deck, not earth, owns the gap):
    // a narrow lower route (≤ OVERPASS_NARROW wide: its core holds no 5 m lattice node) keeps its raster margin there, or
    // lattice nodes poke through it. A wider route still yields (the runway's end kept its fill over the Year Walk).
    const terraceless = (map: Map<BedCut, number>, c: { plane: number }) => new Map([...map].filter(([, plane]) => plane < c.plane + SKATE_TERRACE));
    const above = (map: Map<BedCut, number>, c: { plane: number; bed: BedCut }) => { for (const [bed, plane] of map) if (bed !== c.bed && plane > c.plane + BED_LEVEL_TOLERANCE && (plane < c.plane + OVERPASS_SEPARATION || c.bed.width > OVERPASS_NARROW)) return true; return false; };
    for (const c of candidates) {
      // Within its own carriageway and shoulder a lower route always keeps its clearance (it is never
      // buried); only its raster margin yields to an upper route's footprint (no pits beside it).
      // Wave 7 (RECONCILE item 1): a SKATE lane's margin does not yield to a parallel route's margin on a TERRACE
      // (≥ SKATE_TERRACE above; the upper route owns that step with its edge): the lattice triangle between the two rose
      // through the lane (S4 at 206–221 m, [915.5, 669]: ground 0.3 → 2.5 eu over the deck, the rider stopped at 204 m;
      // walk garden 7.3 eu higher, 10 eu beside). A near-level neighbour (VBS, walk bight, the bight.1 service at 1.5–2 eu,
      // 3.5–4.5 eu beside at [870, 948]) still wins its margin, or it would hang 1.4–1.5 eu over a pit (A1.1).
      // road (L1): a ROAD's margin does not yield to a route on a terrace either: the Glasshouse steps (16 eu over the Glasshouse
      // spur's end, 4–5 eu beside it) held their lattice vertices at 50 and the face between buried the spur's carriageway
      // 11.7 eu; the steps' prisms are grounded to the cut instead (groundTerrainBeds), a retaining mass.
      // A road's margin yields only to another ROAD's footprint (a walk's blend 1 eu over the Drive, 6 eu beside it, lifted the
      // lattice vertex between them into the Drive's carriageway at 3200: terrain 0.25 over the deck).
      const road = c.bed.kind === 'road' && !c.bed.id.startsWith('structure.');
      const neighbours = road ? new Map([...terraceless(near, c)].filter(([b]) => b.kind === 'road')) : c.bed.kind === 'skate' ? terraceless(near, c) : near;
      if (!c.core && (above(decks, c) || above(neighbours, c))) continue;
      ceiling = Math.min(ceiling, c.value);
    }
    return Math.min(ceiling, oreCeiling(x, z));
  };
}
/** R2-08: height (eu) above which another route's deck no longer shields a lower route's raster margin (an overpass). */
export const OVERPASS_SEPARATION = 12, OVERPASS_NARROW = 3;
/** Wave 7: a route at least this far above a skate lane's deck stands on a terrace; the lane keeps its raster margin. */
export const SKATE_TERRACE = 4;
/** Steepest grade a deck plane is extended at past its segment's end (a raster diagonal at most). */
export const MAX_EXTRAPOLATED_GRADE = .25;
/** Lowest open ground on land outside named water: sea level plus 0.1 eu. */
export const LAND_FLOOR = .1;

/** Largest earth fill a threshold or landing pad may make; a higher deck is a structure. */
export const PAD_FILL_MAX = 3;
const crownSummitHeight = (): number => M.landforms.find(f => f.id === 'crown')!.summitH! * getModel().scale;

function cutHeight(x: number, z: number, cuts: LandCuts, sampleBeds: ReturnType<typeof createBedSampler>, rasterMargin: number, bedCeiling: (x: number, z: number) => number): { height: number; surface: number | null } {
  const bedded = sampleBeds(x, z, baseHeight(x, z));
  let { height, surface } = bedded;
  // Sketchbook sight windows trim open ground (never a bed's carriageway or shoulder).
  height = sightWindows(x, z, height, bedded.edgeGap);
  height = throatJambs(x, z, height, cuts, bedded.edgeGap);
  const ground = height, s = getModel().scale;
  for (const p of cuts.pads) {
    // A deck pad (PadCut.deck) is carried by its structure or sits flush on graded beds: never earth.
    if (p.underground || p.deck) continue;
    const distance = padDistance(p, x, z);
    if (distance > p.blend) continue;
    height = mix(height, p.centre[1], 1 - smooth(distance / Math.max(p.blend, 0.01)));
    if (distance <= 0) surface = p.kind === 'reserve' ? 13 : 14;
  }
  // road (L1): a road stands on its embankment: the ground beside it is at least bedded.roadFloor (flush with the deck at the
  // paved edge, then falling 1 : 1.5), whatever a pad, another bed's blend or the natural ground would leave there (the Drive
  // stood 0.7–2.6 over the ground at the upper street and the Tideline park; its edges hung over the dunes by the culvert).
  // Never over the sea floor or a basin (raiseForbidden), never above another bed's deck (the bed ceiling below).
  // The fill is measured against the ground the beds gave (before pads): a pad's blend or margin may not dig under a road's
  // embankment (the plot terraces.1 pad pulled the ground 6.3 under V03's south lane), but a pad's own footprint (not its margin) is its floor —
  // a reserve plot's too (integration: plot terraces.1 carries a personal home, #560; V03's edge over its corner stands on the
  // corridor's fill wall instead of an embankment heaped 3.6 eu into the home's footprint).
  if (height < bedded.roadFloor && !raiseForbidden(x, z) && bedded.roadFloor - ground <= ROAD_EMBANKMENT_MAX_FILL && !cuts.pads.some(p => !p.underground && !p.deck && p.centre[1] < bedded.roadFloor - .5 && padDistance(p, x, z) <= (p.kind === 'reserve' ? 0 : -p.margin))) height = bedded.roadFloor;
  // A threshold or landing is a mark on the ground or a structure's deck, never
  // an earth mound: its fill is capped, and no pad raises the sea floor or tops the summit.
  if (height > ground) {
    const fillCap = cuts.pads.some(p => !p.underground && !p.deck && (p.kind === 'threshold' || p.kind === 'landing') && p.centre[1] > ground + PAD_FILL_MAX * s && padDistance(p, x, z) <= p.blend) ? PAD_FILL_MAX * s : Infinity;
    height = Math.min(height, ground + fillCap, Math.max(ground, crownSummitHeight() - 1 * s));
    if (raiseForbidden(x, z)) height = ground;
  }
  // Mouths are topology masks read by terrainIndices(), not pits through a heightfield.
  // A cave's floor and ceiling remain independent surfaces under this continuous roof.
  height = applyWaters(x, z, height, cuts.waters.length ? cuts.waters : getModel().water, rasterMargin);
  // Apply after pads and water too: no later blend may raise the terrain
  // through a ground-level road. This changes the visible mesh, not collision.
  height = Math.min(height, bedCeiling(x, z));
  return { height, surface };
}
/** Vertices of every grid triangle touching a water footprint are capped below
 * its graded surface. This prevents coarse LOD interpolation bridging over a brook.
 * The bank begins outside that conservative raster footprint; water width stays fixed. */
export function createTerrainCutSampler(cuts: LandCuts, step: number): (x: number, z: number) => { height: number; surface: number | null } {
  const beds = createBedSampler(cuts.beds), rasterMargin = step * Math.SQRT2;
  const bedCeiling = createBedClearanceSampler(cuts.beds, rasterMargin);
  return (x, z) => cutHeight(x, z, cuts, beds, rasterMargin, bedCeiling);
}
/** Reapply the same road clearance to each retained LOD lattice. Decimation
 * alone can reconnect high vertices across a narrow road even if full was safe. */
export function conserveBedFootprint(field: TerrainField, beds: BedCut[]): void {
  const ceiling = createBedClearanceSampler(beds, field.step * Math.SQRT2);
  for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
    const n = j * field.columns + i;
    field.heights[n] = Math.min(field.heights[n]!, ceiling(i * field.step, j * field.step));
  }
  // Paint does not depend on slope (the renderer weights rock per triangle), so no repaint.
}
/** Conservative lower-LOD approximation of this same lattice. Only vertices that
 * support a named wet footprint or its bank transition may move downward; dry
 * districts, route data and the authored water plane/width remain the same. */
export function conserveWaterFootprint(field: TerrainField, waters: WaterCut[]): void {
  const margin = field.step * Math.SQRT2;
  for (let j = 0; j < field.rows; j++) for (let i = 0; i < field.columns; i++) {
    const n = j * field.columns + i, original = field.heights[n]!;
    field.heights[n] = Math.min(original, applyWaters(i * field.step, j * field.step, original, waters, margin));
  }
}
/** R2-25 / R2-21: a lattice vertex standing more than SPIKE_RISE over ALL eight neighbours is a cut-edge remnant (a bed,
 * pad or water cut lowered its neighbours and missed it), not a landform: it is capped to its highest neighbour +
 * SPIKE_KEEP. Land only (never the sea floor); it only lowers; two passes. Run on each retained LOD after the bed and water
 * footprints (they lower neighbours and can leave a new spike). A vertex held at a bed's clearance plane is never capped
 * (it carries the bed: the runway's end lost 12.6 eu of fill when it was). Returns the number of vertices capped. */
export const SPIKE_RISE = 1, SPIKE_KEEP = .25;
export function despikeTerrain(field: TerrainField, beds: BedCut[] = []): number {
  const { columns: C, rows: R, step, heights: H } = field; let capped = 0;
  // A vertex held at a bed's clearance plane carries that bed (a runway end on its fill): never a spike to cap.
  const ceiling = beds.length ? createBedClearanceSampler(beds, step * Math.SQRT2) : () => Infinity;
  for (let pass = 0; pass < 2; pass++) {
    const next = Float32Array.from(H);
    for (let j = 1; j < R - 1; j++) for (let i = 1; i < C - 1; i++) {
      const n = j * C + i, h = H[n]!; let top = -Infinity;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) if (di || dj) top = Math.max(top, H[n + dj * C + di]!);
      if (h - top <= SPIKE_RISE || signedShoreDistance(i * step, j * step) <= 0 || h >= ceiling(i * step, j * step) - .02) continue;
      // v2.6: Mountain v2's own ground is authored (its abutments, benches and rocks), never a cut-edge remnant.
      if (mountainV2Rule(i * step / getModel().scale, j * step / getModel().scale).kind === 'land') continue;
      next[n] = top + SPIKE_KEEP; capped++;
    }
    H.set(next);
  }
  return capped;
}
/** Offline-only solve. Importing this module allocates no heightfield. */
export function buildTerrain(cuts: LandCuts, options: { step?: number } = {}): TerrainField {
  const step = options.step ?? 2.5 * requireScaleFactor(), width = M.extent.w * requireScaleFactor(), depth = M.extent.h * requireScaleFactor();
  if (!(step > 0) || width % step !== 0 || depth % step !== 0) throw new Error('Terrain step must divide the scaled extent');
  const columns = width / step + 1, rows = depth / step + 1;
  const field: TerrainField = { revision: GEOGRAPHY_REVISION, width, depth, step, columns, rows, heights: new Float32Array(columns * rows), surfaces: new Uint8Array(columns * rows) };
  const sample = createTerrainCutSampler(cuts, step), painted = new Int16Array(columns * rows).fill(-1);
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const p = sample(i * step, j * step), n = j * columns + i;
    field.heights[n] = p.height; painted[n] = p.surface ?? -1;
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < columns; i++) {
    const n = j * columns + i, x = i * step, z = j * step;
    field.surfaces[n] = packTerrainPaint(painted[n]! >= 0 ? painted[n]! : biomeGround(x, z, field.heights[n]!), rockSetAt(x, z));
  }
  return field;
}
/** Landform-polygon biomes (no x/z/h rulers): beach sand by the shore, the Flats' ochre
 * dust, needles in Scholars' Edge and the Hollow, scree on the Crown, turf elsewhere. */
export function biomeGround(x: number, z: number, height: number): number {
  const m = getModel(), s = m.scale, shore = signedShoreDistance(x, z), inside = (id: string) => { const b = m.bands.find(f => f.id === id); return !!b && contains(b.poly, x, z); };
  const beach = coastCharacter(x, z) === 'southBeach' ? 30 * s : coastCharacter(x, z) === 'bight' ? 12 * s : 4 * s;
  if (height < 1 * s || shore < beach || inside('sands')) return PAINT.sand;
  // Mountain V3: the glacier is snow, its moraine scree.
  const v3 = v3Paint(x / s, z / s, height / s); if (v3) return PAINT[v3];
  if (inside('crown') && height >= 120 * s) return PAINT.scree;
  if (inside('flats')) return PAINT.ochre;
  if (inside('scholars') || inside('hollow')) return PAINT.duff;
  return PAINT.bankedTurf;
}
/** The strata set a face shows: the Notch walls, the Flats/Wash ochre, the Prow and east
 * sea cliffs, and the Crown's grey everywhere else (STYLE §3.3). */
export function rockSetAt(x: number, z: number): number {
  const m = getModel(), s = m.scale;
  const notch = linePoint(m.water.find(w => w.id === 'water.river.lower')!.points, x, z);
  if (notch.distance < 48 * s && z < 1190 * s && z > 905 * s) return 1;
  const near = (id: string, reach: number) => { const b = m.bands.find(f => f.id === id); return !!b && polygonDistance(b.poly, x, z) > -reach * s; };
  const wash = m.water.find(w => w.id === 'water.wash');
  if (near('flats', 40) || (wash && waterInfluence(wash, x, z).distance < 30 * s)) return 2;
  if (near('prow', 40) || (coastCharacter(x, z) === 'eastCliff' && signedShoreDistance(x, z) < 80 * s)) return 3;
  return 0;
}
const PAINT = Object.fromEntries(TERRAIN_SURFACE_PALETTE.map((p, i) => [p.id, i])) as Record<(typeof TERRAIN_SURFACE_PALETTE)[number]['id'], number>;
/** The dominant palette id at a vertex: its strata set's rock (base or ledge by height)
 * where the slope is over the walkable limit, else its ground. For probes and tests;
 * the renderer blends rock by per-triangle weight and draws ledges per pixel. */
export function terrainSurface(x: number, z: number, height: number, slope: number): number {
  if (!isWalkableSlope(slope)) {
    const set = ROCK_SETS[rockSetAt(x, z)]!, ledge = ((height / set.spacing) % 1 + 1) % 1 < 0.34;
    return PAINT[ledge ? set.ledge : set.base];
  }
  return biomeGround(x, z, height);
}
export function sampleTerrain(field: TerrainField, x: number, z: number): number {
  const gx = clamp(x / field.step, 0, field.columns - 1), gz = clamp(z / field.step, 0, field.rows - 1);
  const i = Math.min(field.columns - 2, Math.floor(gx)), j = Math.min(field.rows - 2, Math.floor(gz));
  const tx = gx - i, tz = gz - j, n = j * field.columns + i;
  const nw = field.heights[n]!, ne = field.heights[n + 1]!, sw = field.heights[n + field.columns]!, se = field.heights[n + field.columns + 1]!;
  return tx + tz <= 1 ? nw + tx * (ne - nw) + tz * (sw - nw) : se + (1 - tx) * (sw - se) + (1 - tz) * (ne - se);
}
export function terrainNormal(field: TerrainField, x: number, z: number): XYZ {
  const gx = clamp(x / field.step, 0, field.columns - 1), gz = clamp(z / field.step, 0, field.rows - 1);
  const i = Math.min(field.columns - 2, Math.floor(gx)), j = Math.min(field.rows - 2, Math.floor(gz)), n = j * field.columns + i;
  const nw = field.heights[n]!, ne = field.heights[n + 1]!, sw = field.heights[n + field.columns]!, se = field.heights[n + field.columns + 1]!;
  const first = gx - i + gz - j <= 1;
  const dx = (first ? ne - nw : se - sw) / field.step, dz = (first ? sw - nw : se - ne) / field.step;
  const length = Math.hypot(dx, 1, dz);
  return [-dx / length, 1 / length, -dz / length];
}
/** Named portals/skylights are the only holes. Render and collision share this mask. */
export function terrainTriangleVisible(x: number, z: number, cuts: Pick<LandCuts, 'mouths'>): boolean {
  return !cuts.mouths.some(m => contains(m.outline, x, z));
}
/** Probe exclusions are explicit precedence rules, never silently counted as passing. */
export function bandProbeEligibility(id: string, x: number, z: number, cuts?: LandCuts): string | null {
  const m = getModel(), b = m.bands.find(f => f.id === id);
  if (!b || !contains(b.poly, x, z)) return 'outside-polygon';
  // v2.6 (D-M1/D-M2): inside Mountain v2's reach the ground is v2's (its land, the Foot terrace and plain, the apron), not a band.
  if (mountainV2Rule(x / m.scale, z / m.scale).kind !== 'outside') return 'mountain-v2';
  if (signedShoreDistance(x, z) <= 12 * m.scale) return 'shore-clipping-and-stroke';
  // Owner rule: only ground inside a higher band's polygon belongs to it; the blend ring is counted.
  for (const higher of m.bands) if (higher.priority > b.priority && contains(higher.poly, x, z)) return 'higher-band';
  for (const w of m.water) if (!w.underground && !['sea', 'lagoon'].includes(w.kind) && waterInfluence(w, x, z).distance < 24 * m.scale) return 'named-water-and-banks';
  const notch = linePoint(m.water.find(w => w.id === 'water.river.lower')!.points, x, z);
  if (notch.distance < 50 * m.scale && z > 905 * m.scale && z < 1170 * m.scale) return 'notch-walls';
  if (cuts) {
    for (const p of cuts.pads) if (!p.underground && !p.deck && padDistance(p, x, z) < p.blend) return 'graded-pad';
    const prepared = prepareBeds(cuts.beds);
    for (const segment of prepared.bins.get(cellKey(x, z, prepared.cell)) ?? []) {
      const b = segment.bed;
      if (b.terrainExclusions?.some(e => Math.hypot(x - e.at[0], z - e.at[1]) < e.radius)) continue;
      if (segmentPoint(x, z, [segment.a[0], segment.a[2]], [segment.b[0], segment.b[2]]).distance < b.width / 2 + b.shoulder + Math.max(15 * m.scale, b.blend)) return 'bed-and-15m-blend';
    }
    if (!terrainTriangleVisible(x, z, cuts)) return 'named-mouth';
  }
  return null;
}
