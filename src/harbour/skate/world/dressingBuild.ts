/** Register the dressing colliders for a field without a park scene (tests, the headless Skate Lab). */
import type {SkateSolid} from '../contract.ts';
import type {SkateWorldField} from './field.ts';
import {buildParkMeshData} from './meshes.ts';
import {skatePalette} from './palette.ts';
import {hasSkateDressing,rememberDressing,skateDressingSolids} from './dressingSolids.ts';

export function ensureSkateDressing(field:SkateWorldField):readonly SkateSolid[] {
  // Where the dressing stands does not depend on the theme or the tier (only how much detail it has).
  if(!hasSkateDressing(field))rememberDressing(field,buildParkMeshData(field,skatePalette('classic'),'lite').dressing);
  return skateDressingSolids(field);
}
