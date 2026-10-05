import {GROUND_DT} from '../shared/ground/types.ts';
import {HORIZON_G} from '../../runtime/geography.ts';

/** One physical vehicle. Skins never enter this configuration or the simulation.
 * Jonathan, 2026-10-04: cruise at twice the old 16 m/s (32 m/s, 115 km/h) and boost to
 * three times it (48 m/s, 173 km/h) while Shift or the touch Boost toggle is held. The
 * bicycle is a skin of this same vehicle and shares every number here.
 * Full braking stops from 32 m/s in 21 m and from 48 m/s in 48 m; a 5 m/s village stop
 * takes .5 m. Boost ramps the cap up over .6 s and back down over .8 s; the speed then
 * follows at the ordinary acceleration, so neither pressing nor releasing Shift is a jolt.
 */
export const CRUISER = Object.freeze({
  dt: GROUND_DT, speed: 32, boostSpeed: 48, boostRampUp: .6, boostRampDown: .8,
  reverseSpeed: 2.5, acceleration: 12,
  brake: 24, coast: 3, grip: 26, radius: .46, height: 1.55, wheelbase: 1.12,
  stepHeight: .48, groundSnap: .55, maxSlope: 40, gravity: HORIZON_G,
  jumpSpeed: 4.8, steerLow: 2.4, steerHigh: 1.05, cornerSpeed: 10,
  cameraDistance: 5.4, cameraPull: 1.4, cameraLead: 3, cameraHeight: 2.6, cameraFov: 58,
});
/** The Ride vehicle's three styles. 'bicycle' rides as the `bicycle` mode, the same sim and speeds (Jonathan 2026-10-04). */
export type CruiserSkin = 'vespa' | 'harley' | 'bicycle';
export const CRUISER_SKINS = {vespa: 'Vespa-style scooter', harley: 'Harley-Davidson-style motorcycle', bicycle: 'Bicycle'} as const;
/** Which registry mode a style rides as. */
export const rideModeFor = (skin:CruiserSkin):'cruiser'|'bicycle' => skin === 'bicycle' ? 'bicycle' : 'cruiser';
export function cruiserPreferenceKey(environment:string, householdId:string, memberId:string) {
  return `hearth:horizon-cruiser:v1:${JSON.stringify([environment,householdId,memberId])}`;
}
export function readCruiserSkin(storage:Pick<Storage,'getItem'>, key:string):CruiserSkin {
  try { const v=storage.getItem(key); return v==='harley'||v==='bicycle'?v:'vespa'; } catch { return 'vespa'; }
}
export function saveCruiserSkin(storage:Pick<Storage,'setItem'>,key:string,skin:CruiserSkin):boolean {
  try { storage.setItem(key,skin); return true; } catch { return false; }
}
