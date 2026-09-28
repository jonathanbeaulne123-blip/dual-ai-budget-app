/**
 * T3 Rides wiring (pass 5, D-M6): the gondola and the funicular as Horizon modes.
 *
 * - `HORIZON_MOVERS` (runtime/moverInput.ts) registers `cableMover('gondola')` and `cableMover('funicular')` at mount,
 *   like the board and the bicycle. They ride v2's own lines through the live link below.
 * - `connectCableRegion(region, mounted?, aspect?)`: the runtime (or T2's region mount) hands over the mounted
 *   Mountain v2 region so the rides read its `rides` and push the ridden cabin to its `setTransit`. Until then (and in
 *   headless tests) the rides use `fallbackCableRegion()`, the same numbers built straight from v2's modules.
 *   Returns a disconnect function.
 * - `cableThresholds(lines)` (route.ts): the per-direction boarding thresholds for the world.
 */
import type {MoverDeps} from '../shared/registry.ts';
import {createCableRide, type CableRideController, type CableRideLink} from './controller.ts';
import {fallbackCableRegion, type CableRegion, type CableTransit} from './regionAdapter.ts';
import type {CableKind} from './route.ts';

export {createCableRide, CABLE_RIDE_FOV, type CableRideController, type CableRideLink, type CableRideState} from './controller.ts';
export {fallbackCableRegion, curveLength, type CableRegion, type CableTransit, type CableFrame} from './regionAdapter.ts';
export {cableThresholds, routeForOffer, rideLabel, routeThresholdId, neighbours, defaultRoute, nearestStation, CABLE_KINDS, GONDOLA_THRESHOLD_STATIONS, type CableKind, type CableLines, type CableRoute, type CableStation} from './route.ts';
export {cableHud, cableControls, cableRidingStatus, arrivalLabel, boardingLabel, mountCableHud, type CableControl, type CableHudSource} from './hud.ts';

let live:{region:CableRegion; transit:CableTransit|null; aspect?:() => number}|null = null;
/** The link every cable ride reads at `enter`: the connected region, else v2's fallback. */
export const CABLE_LINK:CableRideLink = {
  region:() => live?.region ?? fallbackCableRegion(),
  transit:() => live?.transit ?? null,
  aspect:() => live?.aspect?.() ?? 16 / 9,
};
export function connectCableRegion(region:CableRegion, mounted:CableTransit|null = null, aspect?:() => number):() => void {
  const mine = {region, transit:mounted, ...(aspect ? {aspect} : {})};
  live = mine;
  return () => { if (live === mine) live = null; };
}

/** The `HORIZON_MOVERS` factory for a line. */
export const cableMover = (kind:CableKind) => (deps:MoverDeps):CableRideController => createCableRide(kind, deps, CABLE_LINK);
/** The active cable ride, if the registry's active controller is one (for the HUD's buttons). */
export const asCableRide = (controller:unknown):CableRideController|null =>
  controller && typeof controller === 'object' && 'kind' in controller && 'skip' in controller && ((controller as CableRideController).id === 'gondola' || (controller as CableRideController).id === 'funicular') ? controller as CableRideController : null;
