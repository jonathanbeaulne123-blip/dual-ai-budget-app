/**
 * T3 Rides (pass 5, D-M6): the cable lines as the Horizon offers them — which station a threshold stands at,
 * where a ride from it goes, and the offer's words ("Ride the gondola ↑ Summit Commons").
 *
 * Pure: no three, no DOM, no v2 import. Stations arrive in HORIZON space from the region
 * (`region.rides.lines`, or the fallback in `regionAdapter.ts`); both lines are indexed bottom → top,
 * so a higher index is uphill (↑).
 */
import type {Threshold} from '../../world/definition.ts';

export type CableKind = 'gondola'|'funicular';
export const CABLE_KINDS:readonly CableKind[] = ['gondola', 'funicular'];
/** One boarding point, Horizon space: `at` is where the rider stands on the platform, `yaw` the platform's facing. */
export interface CableStation { id:string; name:string; at:readonly [number,number,number]; yaw:number }
export type CableLines = Record<CableKind, {stations:readonly CableStation[]}>;
/** A trip: a line and two station indices along it. */
export interface CableRoute { kind:CableKind; from:number; to:number }

/**
 * The legacy threshold ids that name a platform without a direction (MANIFEST `gondolaBase` / `gondolaTop`,
 * T1's `funicular.<station>`). They ride to the next station uphill, or downhill from the top.
 */
export const GONDOLA_THRESHOLD_STATIONS:Readonly<Record<string, string>> = {gondolaBase:'quay', gondolaTop:'summit'};

/** `<kind>.<from>.to.<to>`: the per-direction threshold ids `cableThresholds` writes (e.g. `funicular.hearth.to.library`). */
export const routeThresholdId = (kind:CableKind, from:string, to:string) => `${kind}.${from}.to.${to}`;

const lineName = (kind:CableKind) => kind === 'gondola' ? 'gondola' : 'funicular';
/** The offer's words: "Ride the gondola ↑ Summit Commons" (↑ uphill, ↓ downhill). */
export function rideLabel(lines:CableLines, route:CableRoute):string {
  const to = lines[route.kind].stations[route.to];
  return `Ride the ${lineName(route.kind)} ${route.to > route.from ? '↑' : '↓'} ${to?.name ?? 'the next station'}`;
}
/** The adjacent stations a platform offers (the old world's station arrows: previous and next). */
export function neighbours(lines:CableLines, kind:CableKind, from:number):number[] {
  const n = lines[kind].stations.length;
  return [from + 1, from - 1].filter(to => to >= 0 && to < n);
}
/** The default trip from a station named without a direction: uphill, or down from the top. */
export function defaultRoute(lines:CableLines, kind:CableKind, from:number):CableRoute|null {
  const n = lines[kind].stations.length;
  if (n < 2 || from < 0 || from >= n) return null;
  return {kind, from, to:from < n - 1 ? from + 1 : from - 1};
}
const stationIndex = (lines:CableLines, kind:CableKind, id:string) => lines[kind].stations.findIndex(s => s.id === id);

/** The station nearest a Horizon point on a line (horizontal distance, then height). */
export function nearestStation(lines:CableLines, kind:CableKind, at:readonly [number,number,number]):number {
  let best = -1, d = Infinity;
  lines[kind].stations.forEach((s, i) => {
    const e = Math.hypot(s.at[0] - at[0], s.at[2] - at[2]) + Math.abs(s.at[1] - at[1]) * .5;
    if (e < d) { d = e; best = i; }
  });
  return best;
}

/**
 * The trip an accepted offer means for a controller of `kind`:
 *   1. `<kind>.<from>.to.<to>` (the per-direction rows),
 *   2. a legacy platform id (`gondolaBase`, `gondolaTop`, `funicular.<station>`) → `defaultRoute`,
 *   3. else the station nearest the offer's point → `defaultRoute`.
 * Null only when the line has fewer than two stations.
 */
export function routeForOffer(lines:CableLines, kind:CableKind, offer:{thresholdId:string; at:readonly [number,number,number]}):CableRoute|null {
  const parts = offer.thresholdId.split('.');
  if (parts.length === 4 && parts[0] === kind && parts[2] === 'to') {
    const from = stationIndex(lines, kind, parts[1]!), to = stationIndex(lines, kind, parts[3]!);
    if (from >= 0 && to >= 0 && from !== to) return {kind, from, to};
  }
  const legacy = kind === 'gondola' ? GONDOLA_THRESHOLD_STATIONS[offer.thresholdId] : parts.length === 2 && parts[0] === 'funicular' ? parts[1] : undefined;
  if (legacy !== undefined) {
    const from = stationIndex(lines, kind, legacy);
    if (from >= 0) return defaultRoute(lines, kind, from);
  }
  return defaultRoute(lines, kind, nearestStation(lines, kind, offer.at));
}

/**
 * The boarding thresholds the cable lines imply, one per platform and direction (next and previous station),
 * Horizon space, `height` = the platform. Each is a plain `feet→<kind>` offer whose `action` is the offer's words,
 * so the Horizon's offer row reads "Ride the funicular ↑ Reservoir Heights" with no UI change. The integrator
 * (or T1's manifest) adds them to `world.thresholds`; the controller reads the direction from the id.
 */
export function cableThresholds(lines:CableLines):Threshold[] {
  const out:Threshold[] = [];
  for (const kind of CABLE_KINDS) {
    const stations = lines[kind].stations;
    stations.forEach((station, from) => {
      for (const to of neighbours(lines, kind, from)) {
        out.push({id:routeThresholdId(kind, station.id, stations[to]!.id), at:[station.at[0], station.at[2]], height:station.at[1], modes:[`feet→${kind}`], action:rideLabel(lines, {kind, from, to})});
      }
    });
  }
  return out;
}
