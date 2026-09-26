/**
 * The bicycle (RIDE §8.1, D45): the board's controller over the same kernel with the bicycle's
 * profile — roads, spurs and trails; brakes at any speed; a ≤ 20° skid; no boost, no pop.
 * The bell and the rider's seated pose are pass 2b's; nothing here reads money.
 */
import type {MoverDeps} from '../shared/registry.ts';
import {createBoardController, type BoardController, type BoardControllerOptions} from '../board/controller.ts';
import {BICYCLE_PROFILE} from './profile.ts';

export function createBicycleController(deps: MoverDeps, options: Omit<BoardControllerOptions, 'id'> = {}): BoardController {
  return createBoardController(deps, BICYCLE_PROFILE, {...options, id: 'bicycle'});
}
