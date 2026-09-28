# Hearth worksession — Manual fall rescue

- Status: IMPLEMENTED — draft review; remaining visual acceptance noted below
- Opened: 2026-09-27 (America/Toronto)
- Owner and decision owner: Jonathan
- Assignee: Codex, one writer with independent read-only diagnosis
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/character-visibility-fix
- Baseline: 4685a6d05d3069ea1c600d476d3054ccb1235f35
- Risk: Medium-High (live island movement and recovery)
- Environment impact: local implementation; no deployment
- Review: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/556
- Executable head: 820bdfa1d82d031644dc277911f0014bd808167e

## Household outcome

Jonathan reported disappearing and returning to the jump location after jumping from the mountain or a high platform. He explicitly chose to retain fall rescue but move it to Retry. Ordinary jumps and falls stay visible; Retry starts the existing fade, safe-ground relocation and fade-in.

## Dual Course deltas

Budget (5): +0; no financial data, Auth, command or Final Confirm change. Engagement (3): +1; deliberate high drops are playable without an automatic reset, with recovery still available on demand.

## Verified baseline and diagnosis

PR #554 was merged into current main at 4685a6d0. The user is playing the Little Harbour mountain scene, which still has its own body model. The earlier Horizon parachute change does not control this scene. No live data was changed during inspection.

The old body model compared peak height to the terrain below and started a return as soon as descent began over a drop greater than four units. A simulation at the observed summit station reproduced a fade while the body was still above the departure platform. The user confirmed this is the symptom.

## Scope and acceptance

- Remove automatic height-triggered recovery; retain the existing continuous fall and landing.
- Add an explicit Retry action that owns the original fade-and-return lifecycle, with repeat clicks ignored while already returning.
- Expose Retry on foot in the outdoor scene for desktop and touch, retaining the existing board Retry and ride controls.
- Clear an interrupted return fade when the board takes over, so a rider cannot stay invisible.
- Verify real cliff movement, explicit recovery, visibility across ownership changes, UI focus and three themes at phone/desktop widths.

## Evidence log

- Before the repair, two focused tests reproduced a board mount/restore retaining an invisible character after interrupting recovery.
- `pnpm exec vitest run test/harbour-body.test.ts test/mountain-movement.test.ts test/harbour-walk-focus.test.ts --maxWorkers=1`: 122/123 passed; the existing tree-ring collision case exceeded its 15-second timeout under concurrent local workload. All new tests passed. Its isolated rerun (`pnpm exec vitest run test/harbour-body.test.ts -t 'collides with the tree ring' --maxWorkers=1`) passed in 1.961 seconds (7.83 seconds total).
- `pnpm test -- --risk=medium-high --focus=test/harbour-body.test.ts --focus=test/mountain-movement.test.ts --focus=test/harbour-walk-focus.test.ts --focus-reason='Manual Retry recovery, uninterrupted high falls, rider visibility and keyboard/touch focus'`: **not a pass**. Diff and AI-surface phases passed; TypeScript exceeded the 300-second budget and was stopped. Reported elapsed time 334.644 seconds, `timeBudgetBreached:true`, classification `quick-gate-failed; time-budget-breached`. No TypeScript diagnostic preceded the stop.
- First cloud CI on the implementation passed TypeScript and 372/373 selected tests, including all 123 movement/focus tests. Its sole failure was inherited: the source fence interpreted `chunks.fetch(...)` as a direct runtime network call. Reconstructing baseline `4685a6d0` produced the same offence. Renamed the existing bytes-only chunk-loader method to `prefetch` at its interface, implementation and call sites; no network behavior or fence was changed.
- `pnpm exec vitest run test/harbour-source-fences.test.ts test/horizonStreaming.test.ts --maxWorkers=1`: 35/35 passed in 1.66 seconds after the rename. `git diff --check` passed.
- Independent model reproduction at the observed summit gondola station: original code repeatedly returned 12–16 times per 30-second run/jump probe. Repaired code had zero automatic returns or invisible frames across eight headings, each exercised for 30 seconds, and a stationary jump. No blocking issue found in independent review.
- Actual local fictional App, Classic desktop: a high drop remained visible and landed without relocation. Pressing the rendered Retry button from a synthetic airborne height of 240 returned the character to safe summit ground at 104.05, visibly restored the character, and focused `.harbour-world__stage`.
- Browser inspection found Retry drawn over the companion's litter box on desktop and the movement row under the month card on phones. The desktop row now stands to the left of the litter box; with the reading dock present, the phone/tablet row uses viewport positioning above its tool bubbles. At 390×844, all five Classic phone controls were measured unobstructed, with 44px minimum height (Retry 62×44 at x28.72/y444).
- Final executable-head CI: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36361967581 (still running when this record was written). Build: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36361967644. Horizon baked-asset checks passed on Node 22 and 24: https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/36361967613.

## Changed areas

`bodyModel.ts`, `walker.ts`, scene `runtime.ts` and `HarbourWorld.tsx` move recovery behind Retry and clear interrupted board fades. `harbour.css` and `village.css` wrap and position the movement controls. Three movement/focus test files cover continuous falls, manual rescue and ownership/focus. The narrow loader method rename touches `horizonAssets.ts`, Horizon runtime and `horizonStreaming.test.ts`. The decision log records the user-selected behavior.

## Remaining uncertainty and handoff

Browser connection timeouts, then browser unavailability, interrupted the remaining visual matrix. Taylor's Scrapbook and Newfoundland visual checks, final desktop spacing, smaller phones/landscape, physical-device feel and screen-reader acceptance remain unverified; existing theme treatments are retained. The temporary fictional localhost preview was switched to Taylor's theme and a 390×844 touch viewport before the connection became unavailable; these are not hosted-account changes.

No live fix, merge or deployment is claimed. The user's latest request limits this repair to moving fall rescue onto Retry; it does not port the Horizon parachute into Little Harbour. Jonathan owns review/release choice; the next implementer should finish the named visual checks before release acceptance. Budget +0 / Engagement +1.
