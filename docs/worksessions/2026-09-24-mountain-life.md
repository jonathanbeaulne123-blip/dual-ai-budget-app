# Hearth Mountain living details and observed recovery

- Status: implemented and focused-tested, local branch only; integration pending
- Owner / decision owner: Jonathan; integration owner: Codex parent task
- Branch: `codex/hearth-mountain-life`
- Base: `a81e43ad034bdec64ebbf6b834add234a68fd64e`
- Risk: Medium-High presentation and local persistence; programme remains High
- Environment impact: device-local presentation only

## Household outcome

Benches, gates, bells, overlooks and quiet wildlife give the mountain small reasons to
pause. Repairs remember supported condition transitions this device actually saw.
The existing seven/thirty-day condition selector remains the sole wear authority.

Budget delta (5): preserved financial meaning, no new writer or command. Engagement
delta (3): tactile exploration and persistent, honest visual continuity across themes.

## Scope and invariants

Own `mountain/life.ts`, scene helpers, `recovery.ts`, focused tests and narrow
landscape animation/recovery hooks. Parent owns React, runtime and Court wrappers;
art agent owns district architecture and transport. No navigation/collision damage,
new history reconstruction, punishment for balance/spending/inactivity, hosted data,
schema, release, package installation, or browser use.

## Evidence and handoff

Baseline was clean at the named base. Skills: hearth-worksession and
hearth-implementation-packet. Focused verification will be coordinated with the parent
because of host memory pressure. Heavy typecheck/build and broad gate are deferred to
integration; no earlier gate is claimed for these edits. Visual, screen-reader,
audio-listening and physical-device acceptance remain with the integration task.

## Integration contract

Target: parent Codex integration on the same mountain base. Cherry-pick this branch's
scoped commit; integrate once, then verify current source. Required reviewers remain
the programme's trust/UX reviewers and Jonathan for play feel.

- `createMountainRecovery({environment,householdId})` lives outside scene/theme
  rebuilds. `observe(reading)` receives the existing Harbour read model. Deliver its
  result to `landscape.setRecovery(view)` on supported and unsupported updates alike.
  `snapshot()` gives the held device observation before the first current read.
- The record stores only Fund identity, accepted revision/day, wear band, at most
  four observed recoveries and supported shared-task day count. It does not derive
  historical daily states. Unknown, stale, backwards or conflicting evidence freezes;
  a replacement Fund starts a new observation sequence. Storage failures preserve
  current-session observations. No record claims cross-device shared history.
- `MOUNTAIN_INTERACTIONS` exposes labels, kinds, districts, positions and words.
  `activateMountainInteraction(id,state,theme,quiet)` is the shared action model for
  anchors and accessible native controls. It returns new state, words, optional bell
  cue and position. Apply state with `landscape.setInteraction(state)`; prime each
  rebuilt scene once with current state so old bell rings do not replay.
- Parent owns runtime movement/rest framing and React controls. Only bench,
  overlook and wildlife visits may need navigation; gate and bell actions act in
  place. Bench copy says Rest / Leave; there is no seated character animation in
  this slice. Gates are peripheral props and never acquire collision authority.
- `WorldAmbience.bell()` uses the existing opt-in Sound context and master level.
  Quiet, paused, hidden, suspended and disposed contexts refuse new tones. A short
  rate limit prevents overlapping rings; pause/disposal disconnect active tones.
- `setCalm` plus system reduced-motion state suppress all new motion and wear.
  Wildlife remains visibly resting. Flower bending is transient, altitude-aware,
  and erased by quiet mode. Authored themed backrests, wickets, bell frames and
  resting wildlife use the current dressing; all owned resources dispose once.

## Verification scope

`test/mountain-life.test.ts` covers supported-observation persistence, scope isolation,
replacement Funds, stale/unknown/conflicting evidence, storage failure, no
balance-derived damage, reversible text-first interactions for all themes,
quiet wildlife, disposal and audio lifecycle. This is focused model/scene evidence,
not proof of final React wiring, human seating, visual composition or listening.

Measured 2026-09-24: `pnpm exec vitest run test/mountain-life.test.ts --maxWorkers=1`
with the bundled Node path and `pnpm_config_verify_deps_before_run=false`: **15 / 15
passed**, 554 ms total, 43 ms test time. `git diff --check` passed. The focused suite
ran after the art worker released the shared low-memory test slot. TypeScript, build
and the risk-based quick gate remain deferred to coordinated integration and are not
claimed here. The check covers the changed source included in this scoped commit.

Next owner: parent Codex for Court/runtime/React integration, central decision-log
entry and coordinated current-source verification. No hosted mutation, network
disclosure, secret access, push, deployment or schema operation was performed.
