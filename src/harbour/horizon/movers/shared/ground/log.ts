/**
 * The ride log (RIDE §9): one row per fixed step — the input that step used and the state
 * it left — and its replay. Row 0 is the start row (`step` of a fresh state, neutral input):
 * replay rebuilds the start from it with `createGroundState` and re-runs every later row,
 * asserting identity to 1e-6.
 */
import type {ContactQuery, GroundEvent, GroundInput, GroundProfile, GroundState, Pace, XYZ} from './types.ts';
import {createGroundState, groundSpeed, slipAngle, stepGround} from './kernel.ts';

export interface RideLogRow {
  step: number; input: GroundInput; p: XYZ; v: XYZ; heading: number; yawRate: number; grip: number;
  beta: number; s: number; pace: Pace; charge: number; lead: 1 | -1; event?: string[];
}

const TOL = 1e-6;

/** One row for the step just taken (or the start row, before any step). */
export function recordRide(state: GroundState, input: GroundInput, events: readonly GroundEvent[]): RideLogRow {
  const row: RideLogRow = {
    step: state.step, input: {...input}, p: [...state.p], v: [...state.v], heading: state.heading, yawRate: state.yawRate, grip: state.grip,
    beta: slipAngle(state), s: groundSpeed(state), pace: state.contact.pace, charge: state.legs.charge, lead: state.lead,
  };
  const kinds = events.filter((e) => e.step === state.step).map((e) => e.kind);
  if (kinds.length) row.event = kinds;
  return row;
}

/** Replays `rows` from the start row; throws on the first step that differs by more than 1e-6. Returns the final state. */
export function replayRide(rows: readonly RideLogRow[], query: ContactQuery, profile: GroundProfile): GroundState {
  const start = rows[0];
  if (!start) throw new Error('replayRide: empty log');
  const state = createGroundState(start.p, start.heading);
  state.v = [...start.v]; state.yawRate = start.yawRate; state.grip = start.grip; state.lead = start.lead; state.step = start.step;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i]!;
    stepGround(state, row.input, query, profile);
    const d = Math.max(
      ...state.p.map((x, k) => Math.abs(x - row.p[k]!)), ...state.v.map((x, k) => Math.abs(x - row.v[k]!)),
      Math.abs(state.heading - row.heading), Math.abs(state.grip - row.grip),
    );
    if (!(d <= TOL) || state.step !== row.step) throw new Error(`replayRide: step ${row.step} differs by ${d}`);
  }
  return state;
}
