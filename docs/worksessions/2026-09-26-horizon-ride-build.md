# Worksession — The Horizon, RIDE build (pass 2, M1 slice 1)

Date: 2026-09-26 · Owner: Jonathan · Orchestrator: Claude (design lead; delegates every build step to subagents) · Base: `main@0f601b5` (#548) · Branch: `claude/horizon-ride` (on top of the RIDE planning commit `cbb418a`) · Risk: **Medium** (new mover code, runtime hook, MANIFEST v1.7 data; no money, schema, sync, auth, presence wire or Worker change).

Spec: `docs/horizon/RIDE.md` (every number and rule; this file only says who builds what). Brief: `docs/horizon/passes/02-movers.md` M1/M2 and integrator duties.

## Scope of this slice

**In**: the ground kernel; the contact adapter and MANIFEST v1.7 data; the movers seam (mode, threshold offer, registry) and the runtime mover hook; the board controller riding S1–S4 with the S / A / D slide, the twist, the W pump-boost, minimal air (pop, crests, one landing rule), the bed-bound edge (pads at threshold pace, off-bed dig-in and fade back), the pace bubble, the follow camera, greybox board art; the bicycle as a profile; the ride log and situations R0–R5; tests; TEST-PLAN and HANDOFF.

**Out (next slices)**: Skate v2's tricks, grinds, wallride, manual and the Tideline park migration onto the kernel; the S1 race re-base (`race.ts`); presence (`act: 'skate'`, D46); pass 2b art; the FLIGHT patch's sky fields in v1.7 (they land when that patch is applied — the generator change here must not conflict with it).

## Tracks and ownership (one writer per file; never two agents on one file)

| Track | Owns (creates or edits only these) | Must not touch |
|---|---|---|
| **K** kernel | `src/harbour/horizon/movers/shared/ground/{types,kernel,tyre,legs,log,synthetic}.ts`; `test/groundKernel.test.ts`, `test/groundTyre.test.ts`, `test/groundSlide.test.ts`, `test/groundLegs.test.ts` | everything else |
| **C** contact + data | `src/harbour/horizon/movers/shared/ground/contact.ts`; `docs/horizon/make_manifest.py`; `src/harbour/horizon/world/MANIFEST.json`; `src/harbour/horizon/world/manifest.ts` (types only if needed); `src/harbour/horizon/runtime/geography.ts` (add `HORIZON_G = 12` export only); `test/horizonBoardPace.test.ts`; `test/horizonManifest.test.ts` (extend) | the kernel files; the runtime; beds build |
| **I** integrator seams | `src/harbour/horizon/movers/shared/{mode,threshold,registry}.ts`; `src/harbour/horizon/runtime/index.ts`; `src/harbour/horizon/HorizonStage.tsx`; `src/harbour/horizon/horizon.css`; `test/horizonModeRegistry.test.ts`, `test/horizonMoverHook.test.ts` | the kernel, contact, board |
| **B** board (after K, C, I) | `src/harbour/horizon/movers/board/**`; `src/harbour/horizon/movers/bicycle/**`; `test/horizonBoardThresholds.test.ts`, `test/horizonSkateLines.test.ts`, `test/horizonRideSituations.test.ts`, `test/horizonBoardLanding.test.ts`, `test/horizonBoardCamera.test.ts`, `test/horizonBicycleProfile.test.ts` | the kernel, contact, seams (requests go in `HANDOFF-notes/board.md`) |
| **R** reviewer | `evidence/review/REVIEW.md` only | everything |
| **O** orchestrator | this file, `HANDOFF.md`, `TEST-PLAN.md`, `HANDOFF-notes/**`, the final commit | — |

All tracks: no `src/core/**`, no `src/ledgerSync/**`, no `workers/**`, no `src/harbour/skate/**` (Skate v2 stays untouched in this slice), no `src/harbour/horizon/land/**`, no money. Fictional data only. No agent commits; the orchestrator commits.

## The kernel contract (K materialises this as `types.ts`; C, I, B code against it verbatim)

```ts
export type XYZ = [number, number, number];
export type Pace = 'fast' | 'flow' | 'slow' | 'threshold' | 'skate' | 'offbed';
export type ContactKind = 'ground' | 'air' | 'rail' | 'wall';

/** One ground sample under a point. `legal` = this mover's wheels roll here (profile.beds or a pad). */
export interface ContactSample { y: number; n: XYZ; material: string; pace: Pace; legal: boolean; roll: number; grip: number; pushGrip: number; slope: number; bedId: string | null; padId: string | null }
export interface ContactQuery {
  sample(x: number, z: number, y: number): ContactSample | null;        // null = no ground (void)
  submerged(x: number, z: number, y: number): boolean;
  blocked(x: number, z: number, y: number, radius: number, travel: [number, number]): boolean;   // a solid the wheels cannot pass (a lip taller than stepMax is decided by the kernel from samples, not here)
  nearestBedPoint(x: number, z: number): XYZ | null;                     // for the fade back (RIDE §6.5)
}

export interface GroundProfile { /* RIDE §8.1, every field, with the board's values as defaults */ }
export interface GroundInput { steer: number /* -1..1, +1 = right (D) */; push: boolean; slide: boolean; pop: boolean; sprint: boolean; crouch: number /* 0..1 */ }
export interface GroundState {
  p: XYZ; v: XYZ; heading: number; yawRate: number; grip: number; lead: 1 | -1;
  contact: { on: boolean; kind: ContactKind; n: XYZ; material: string; pace: Pace; slope: number; legal: boolean; pitch: number };
  legs: { stroke: number; crouch: number; charge: number; window: number; boost: number; cooldown: number };
  offbedFor: number; stopped: number; airborneFor: number; slideFor: number; step: number;
}
export type GroundEvent = { kind: 'slideStart' | 'slideEnd' | 'twist' | 'boostReady' | 'boost' | 'boostLost' | 'lip' | 'airborne' | 'land' | 'bail' | 'fadeBack' | 'water'; step: number; data?: Record<string, number | string> };
export const GROUND_DT = 1 / 120;
export function createGroundState(p: XYZ, heading: number): GroundState;
/** Pure. One fixed step. Reads contact through `query`. Returns events. */
export function stepGround(state: GroundState, input: GroundInput, query: ContactQuery, profile: GroundProfile, events?: GroundEvent[]): GroundEvent[];
/** Accumulator: advances by up to 0.1 s of wall time in GROUND_DT steps, latching `input` for the whole frame. */
export function advanceGround(state: GroundState, input: GroundInput, query: ContactQuery, profile: GroundProfile, dt: number, acc: { t: number }): GroundEvent[];
/** Derived, never stored. */
export function slipAngle(state: GroundState): number;   // rad, signed, lead-corrected
export function groundSpeed(state: GroundState): number; // tangent-plane speed
```

Ride log (`log.ts`): `RideLogRow = { step, input, p, v, heading, yawRate, grip, beta, s, pace, charge, event? }`, `recordRide(...)`, `replayRide(log, query, profile) → final state` (asserts identity to 1e-6). Synthetic query (`synthetic.ts`, test-only export): flat, plane at a grade, a bank, a kerb of a given height, water beyond x, a bed strip of a given width with `offbed` outside; all deterministic.

## Phase plan

1. **Phase 1 (parallel)**: K, C, I. Each runs its focused suites and `tsc` on its own files' diagnostics (errors in files it does not own are reported in `HANDOFF-notes/<track>.md`, not fixed).
2. **Phase 2**: B (board + bicycle + situations), reading K/C/I's real files.
3. **Phase 3**: R reviews from `REVIEW-BRIEF.md` (P17, P19, P24, P27 in scope; the money import fence; determinism). BLOCKER/MAJOR go back to the owning track.
4. **Gate**: `tsc` at 0 errors; every focused suite; `pnpm build`; `pnpm test -- --risk=medium --focus=test/horizonRideSituations.test.ts --focus-reason="horizon p2 M1 slice 1: ground kernel, board, slide and boost"`.

## Commands

- Focused suite: `pnpm exec vitest run test/<name>.test.ts --maxWorkers=1`
- Types: `node --max-old-space-size=5500 node_modules/typescript/bin/tsc --noEmit`
- Review harness: `HEARTH_REVIEW_PORT=4192 node scripts/serve-whole-house-review.mjs` → `http://localhost:4192/__review?seed=mountain&story=growing&run=first&member=MEM-001` (`window.__harbour` is the Horizon runtime in dev)
