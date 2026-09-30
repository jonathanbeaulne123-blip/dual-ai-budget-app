/**
 * ROAD.md §3 as data: the reaches of Horizon Drive (V01) by manifest anchors, and one reach for every other road-kind
 * bed. Anchors are projected onto the bed's FINAL points at bake time (`resolveReaches`); a station's context is its
 * reach's context unless a structure owns the road at that station (`stationContext` → 'structure').
 *
 * A reach part may start or end a fixed arc distance from an anchor (`{ at, offset }`): the developed stretch of
 * Scholars' Crest runs from 50 eu before the library / Green Road junction to 40 eu past station.oct, Tideline Park's
 * developed stretch is the first 60 eu of R11.
 */
import type { BedCut, XY } from '../interfaces';
import { nearestOnPath, pathLength } from '../structures/mesh';
import type { CorridorContext, CorridorReach } from './types';

/** A reach boundary: a plan anchor on the road, optionally moved `offset` eu along the road from its projection. */
export type ReachAnchor = XY | { at: XY; offset: number };
export interface ReachPart { id: string; label: string; from: ReachAnchor; to: ReachAnchor; context: CorridorContext; note?: string }

/** Horizon Drive, anticlockwise from the Green Road junction (V01's first point), as ROAD.md §3's table. */
export const V01_REACHES: readonly ReachPart[] = Object.freeze([
  { id: 'R1', label: 'Harbour Gate', from: [1400, 1060], to: [1543.2, 1001.4], context: 'developed', note: 'kerbs; sidewalk on the town side; the Year Walk as the other footway' },
  { id: 'R2', label: 'Prow Gallery', from: [1543.2, 1001.4], to: [1599.5, 790.8], context: 'structure', note: 'the gallery owns the road; the Terraces lay-bys flush' },
  { id: 'R3', label: 'Prow Cliff Drive', from: [1599.5, 790.8], to: [1560, 500], context: 'mountain', note: 'stone parapet where the cliff drops; no kerbs' },
  { id: 'R4', label: 'Crown Coast', from: [1560, 500], to: [1120, 250], context: 'coastal', note: 'low post-and-rail on the sea side; stone parapet on the tight outer curves; Crown Lookout (plan)' },
  { id: 'R5a', label: "Scholars' Crest", from: [1120, 250], to: { at: [900, 290], offset: -50 }, context: 'open', note: 'woodland groves framing the road' },
  { id: 'R5b', label: "Scholars' Crest junction box", from: { at: [900, 290], offset: -50 }, to: { at: [790, 322], offset: 40 }, context: 'developed', note: 'the Green Road / library junction and station.oct' },
  { id: 'R5c', label: "Scholars' Crest", from: { at: [790, 322], offset: 40 }, to: [720, 300], context: 'open' },
  { id: 'R6a', label: 'West Rise', from: [720, 300], to: [560, 360], context: 'open', note: 'the trees thin' },
  { id: 'R6b', label: 'West Rise (the west sea opens)', from: [560, 360], to: [400, 470], context: 'coastal' },
  { id: 'R7', label: 'Flats Coast', from: [400, 470], to: [390, 850], context: 'coastal', note: 'prairie verges; a lamp pair at station.jul (plan)' },
  { id: 'R8', label: 'Bight Descent', from: [390, 850], to: [460, 1030], context: 'mountain', note: 'terrain-sensitive; stone parapet on the outer side' },
  { id: 'R9', label: 'Bight Bridge', from: [460, 1030], to: [660, 1170], context: 'structure', note: 'the bridge owns the road' },
  { id: 'R10', label: 'Long Sands Boulevard', from: [660, 1170], to: [1100, 1400], context: 'boulevard', note: 'the resort boulevard (palms per D-R4)' },
  { id: 'R11a', label: 'Tideline Park', from: [1100, 1400], to: { at: [1100, 1400], offset: 60 }, context: 'developed' },
  { id: 'R11b', label: 'Campfire shore', from: { at: [1100, 1400], offset: 60 }, to: [1300, 1380], context: 'coastal' },
  { id: 'R12', label: 'Quay Crossing', from: [1300, 1380], to: [1370, 1260], context: 'developed', note: 'the Quay Bridge owns the road on its deck' },
  { id: 'R13a', label: 'Harbour Avenue', from: [1370, 1260], to: [1360, 1160], context: 'boulevard', note: 'a maple avenue with planted verges' },
  { id: 'R13b', label: 'Harbour Avenue (town)', from: [1360, 1160], to: [1400, 1060], context: 'developed', note: 'the loop closes at the Green Road junction' },
] as ReachPart[]);

/** Every other road-kind bed is one reach. */
export function singleReach(bed: BedCut): Omit<CorridorReach, 'from' | 'to'> {
  if (bed.id === 'V03') return { id: 'V03', label: 'Mountain Road', context: 'mountain', note: 'stone parapets; the tunnel and the canal bridge own the road on their decks' };
  if (bed.id === 'VG') return { id: 'VG', label: 'Green Road', context: 'open', note: "the High Span owns the road on its deck; nothing taller than 0.85 inside the Green's protected centre" };
  if (bed.id === 'VBS') return { id: 'VBS', label: 'Bight Shore spur', context: 'open', note: 'entrance spur: flush joins, guard gaps' };
  if (bed.id.startsWith('spur ')) return { id: bed.id.replace(/^spur /, 'spur.'), label: `${bed.id.slice(5)} spur`, context: 'open', note: 'entrance spur: flush joins, dropped kerbs, guard gaps' };
  return { id: 'service', label: `${bed.id} (service road)`, context: 'open', note: 'plot service road: stations only, no dressing (the reserve stays in construction)' };
}

function anchorArc(bed: BedCut, a: ReachAnchor, total: number, atEnd: boolean): number {
  const at = Array.isArray(a) ? a as XY : (a as { at: XY }).at, offset = Array.isArray(a) ? 0 : (a as { offset: number }).offset;
  // A closed loop's first point is also its last: the reach that ends there ends at the loop's length.
  const first = bed.points[0]!, onStart = Math.hypot(at[0] - first[0], at[1] - first[2]) < 1e-6;
  const arc = onStart ? (atEnd ? total : 0) : nearestOnPath(at, bed.points).along;
  return Math.max(0, Math.min(total, arc + offset));
}

/** The reaches of one road bed resolved to arc lengths on its final points. V01 by `V01_REACHES`; others one reach. */
export function resolveReaches(bed: BedCut): { reaches: CorridorReach[]; problems: string[] } {
  const total = pathLength(bed.points), problems: string[] = [];
  if (bed.id !== 'V01') return { reaches: [{ ...singleReach(bed), from: 0, to: round3(total) }], problems };
  const reaches: CorridorReach[] = [];
  let last = 0;
  for (const part of V01_REACHES) {
    let from = anchorArc(bed, part.from, total, false), to = anchorArc(bed, part.to, total, true);
    // Contiguity: each reach starts where the previous ended (anchors project to the same arc, rounding aside).
    if (Math.abs(from - last) > 1) problems.push(`${part.id} starts at ${from.toFixed(1)} eu, the previous reach ended at ${last.toFixed(1)} eu`);
    from = last; if (to < from) { problems.push(`${part.id} ends before it starts (${to.toFixed(1)} < ${from.toFixed(1)})`); to = from; }
    reaches.push({ id: part.id, label: part.label, from: round3(from), to: round3(to), context: part.context, ...(part.note ? { note: part.note } : {}) });
    last = to;
  }
  if (reaches.length) reaches[reaches.length - 1]!.to = round3(total);
  return { reaches, problems };
}
/** A reach whose context is 'structure' (the Prow Gallery, the Bight Bridge) also covers its approaches: a station there that
 * no structure owns takes this context instead (the gallery's approaches are cliff road, the bridge's the shore). */
export const STRUCTURE_REACH_APPROACH: Readonly<Record<string, CorridorContext>> = Object.freeze({ R2: 'mountain', R9: 'coastal' });
/** The corridor's road beds (ROAD.md §2.1): Horizon Drive, Green Road, the Mountain Road, the Bight Shore spur, the six
 * spurs and the plot service roads. Not the structures' own beds, the runway (`strip`), Mountain v2's region-carried road,
 * or any other road-kind bed (a synthetic test road keeps the land's own edge emitters). */
export const CORRIDOR_ROAD = /^(V01|VG|V03|VBS|spur [A-Za-z]+|plot\.[A-Za-z]+\.\d+\.service)$/;
export function isCorridorRoad(b: Pick<BedCut, 'id' | 'kind' | 'terrainCut'>): boolean {
  return b.kind === 'road' && b.terrainCut && CORRIDOR_ROAD.test(b.id);
}
/** Plot service roads get stations and a deck but no dressing (ROAD.md §3). */
export const isServiceRoad = (id: string): boolean => /^plot\..+\.service$/.test(id);
/** The reach holding arc `s` (the last reach whose `from` ≤ s). */
export function reachAt(reaches: readonly CorridorReach[], s: number): CorridorReach {
  let found = reaches[0]!;
  for (const r of reaches) if (r.from <= s + 1e-9) found = r; else break;
  return found;
}
/** A station's context: its reach's, or 'structure' where a structure owns the road at the station. */
export function stationContext(reach: CorridorReach, structureId: string | undefined): CorridorContext {
  if (structureId) return 'structure';
  return reach.context === 'structure' ? STRUCTURE_REACH_APPROACH[reach.id] ?? 'open' : reach.context;
}
export const round3 = (v: number): number => { const r = Math.round(v * 1000) / 1000; return r === 0 ? 0 : r; };
