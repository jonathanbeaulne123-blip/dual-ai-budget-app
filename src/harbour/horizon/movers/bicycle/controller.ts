/**
 * The bicycle (Jonathan, 2026-10-04): a skin of the one cruiser vehicle. It shares the cruiser's
 * ground sim, its 32 m/s cruise and its 48 m/s Shift boost; it keeps `id: 'bicycle'` for the
 * registry, the `wheels→feet` / `X→bicycle` thresholds and its own art, and reads "Cycling" on
 * the HUD. Before this it was the board kernel with a 6 m/s pedal cap. Nothing here reads money.
 */
import type {MoverDeps} from '../shared/registry.ts';
import {createCruiserController, type CruiserController} from '../cruiser/controller.ts';

export const BICYCLE_RIDE_LABEL = 'Cycling';

export function createBicycleController(deps: MoverDeps): CruiserController {
  return createCruiserController(deps, {id: 'bicycle', rideLabel: BICYCLE_RIDE_LABEL});
}
