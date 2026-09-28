# Hearth worksession — Manual fall rescue

- Status: OPEN
- Opened: 2026-09-27 (America/Toronto)
- Owner and decision owner: Jonathan
- Assignee: Codex, one writer with independent read-only diagnosis
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app
- Branch: codex/character-visibility-fix
- Baseline: 4685a6d05d3069ea1c600d476d3054ccb1235f35
- Risk: Medium-High (live island movement and recovery)
- Environment impact: local implementation; no deployment

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
- Current verification pending.

## Remaining uncertainty and handoff

No live fix, merge or deployment is claimed. The user's latest request limits this repair to moving fall rescue onto Retry; it does not port the Horizon parachute into Little Harbour.
