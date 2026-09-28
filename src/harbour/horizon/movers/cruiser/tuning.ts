import {GROUND_DT} from '../shared/ground/types.ts';
import {HORIZON_G} from '../../runtime/geography.ts';

/** One physical vehicle. Skins never enter this configuration or the simulation.
 * Island roads span hundreds of metres: 16 m/s is twice cart cruise and above
 * board travel (7 m/s). Full braking stops in 8 m; a 5 m/s village stop takes .8 m.
 */
export const CRUISER = Object.freeze({
  dt: GROUND_DT, speed: 16, reverseSpeed: 2.5, acceleration: 7.5,
  brake: 16, coast: 2.2, grip: 22, radius: .46, height: 1.55, wheelbase: 1.12,
  stepHeight: .48, groundSnap: .55, maxSlope: 40, gravity: HORIZON_G,
  jumpSpeed: 4.8, steerLow: 2.4, steerHigh: 1.05, cornerSpeed: 8,
  cameraDistance: 5.4, cameraHeight: 2.6, cameraFov: 58,
});
export type CruiserSkin = 'vespa' | 'harley';
export const CRUISER_SKINS = {vespa: 'Vespa-style scooter', harley: 'Harley-Davidson-style motorcycle'} as const;
export function cruiserPreferenceKey(environment:string, householdId:string, memberId:string) {
  return `hearth:horizon-cruiser:v1:${JSON.stringify([environment,householdId,memberId])}`;
}
export function readCruiserSkin(storage:Pick<Storage,'getItem'>, key:string):CruiserSkin {
  try { return storage.getItem(key)==='harley'?'harley':'vespa'; } catch { return 'vespa'; }
}
export function saveCruiserSkin(storage:Pick<Storage,'setItem'>,key:string,skin:CruiserSkin):boolean {
  try { storage.setItem(key,skin); return true; } catch { return false; }
}
