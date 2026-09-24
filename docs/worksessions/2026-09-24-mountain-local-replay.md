# Hearth worksession — device-local mountain replay

- Status: implemented locally; integration and visual/device acceptance remain open.
- Opened: 2026-09-24 (America/Toronto).
- Owner and decision owner: Jonathan. Implementer: Codex mountain-race track; integration owner: parent Codex.
- Repository: dual-ai-budget-app; branch `codex/hearth-mountain-race`.
- Verified base: `a81e43ad034bdec64ebbf6b834add234a68fd64e`; isolated, initially clean checkout `.codex-work/hearth-mountain-race`.
- Risk: Medium-High within the High-risk mountain programme. No deployment, schema, hosted data, ledger or Production change.
- Budget delta (5): +0; recreation has no financial authority and never enters ledger synchronization.
- Engagement delta (3): replay a completed descent and optionally race a best-run ghost on the same device.

## Implementation and limits

The existing identity-scoped skate save carries at most one valid best completed gated-course recording. Recording uses the ordinary race clock, samples at approximately five per second, preserves both sides of required gate crossings, and retains no more than 2,000 samples or five minutes. The complete save is capped at 256,000 characters. Read validation checks finite/bounded positions, increasing timestamps, continuity, start location, all ordered directional 3D gates and the final timestamp. Unrecognized properties are discarded. A course signature includes gates, road and optional-branch geometry, so older course times and ghosts are discarded on read. Ordinary v1/v2 discovery, goal and settings migration remains intact.

A partial, bailed/recovering, restarted, dismounted or restored partial run cannot manufacture a recording. Restoring a paused checkpoint keeps its ordinary race state, but deliberately lacks recording evidence from before the restore. Existing best-time timing/medals and v2 physics remain unchanged. Recording failures do not stop skating; save failures continue to use the existing session-only notice. A slower complete recording never replaces the stored faster valid recording. Ghost sharing, multiplayer and leaderboards are absent.

Playback freezes simulation/scoring and uses only the existing shared frame step; it never publishes a body, banks progress, moves the rider or changes the camera. The driver returns an optional decorative pose with `mode: 'race' | 'replay'`. Pause, dismount and reduced motion suppress the pose; restart/respawn/restore cancel playback. Moving playback is explicitly user-started. The HUD shows device-local copy, a course map, playback time, stop control and a ghost toggle, using the existing authored Classic/Taylor/Newfoundland paper and ink tokens. A visible 44px Restart race control makes route restart available to touch and keyboard users.

Optional-route tests substitute each authored branch into the complete course, prove matching entry/rejoin positions and heights, and cross every mandatory gate in order. Every gate rejects reverse and below-deck crossings. Existing full-width surface and ordinary input-driven simulation tests are unchanged. These geometric checks are not manual optional-route acceptance.

## Evidence

Serial focused run, with the runtime Node bin on PATH and `pnpm_config_verify_deps_before_run=false`:

`pnpm exec vitest run test/skate-race-replay.test.ts test/skate-show-session.test.ts test/skate-show-hud.test.ts --maxWorkers=1`

Final result: **33 tests / 3 files passed in 2.66 seconds**. New replay/route suite: 10; session: 10; HUD: 13. Initial run passed 31/32, with the older oversized-save fixture still sized against the former 32k cap; the fixture now derives its length from the exported bound. `git diff --check` passed.

No typecheck, build or broad gate ran in this track: parent explicitly serialized focused verification because of severe host memory pressure. Parent owns the integrated required gate and runtime/HarbourWorld wiring. No browser was used concurrently with parent. Theme inheritance and reduced-motion controls have source/component evidence, not new three-theme browser or screen-reader proof. Physical-phone sustained frame time and manual keyboard/touch/controller races remain open.

## Exact integration hooks

- `SkateControls.ghost(): GhostPose | null` returns `{x,y,z,yaw,mode:'race'|'replay'}`. Parent should draw a separate decorative marker from the shared frame; never replace the rider or publish this pose to presence. Dispose marker resources with the scene.
- `SkateControls.replay(action: ReplayAction): void`, actions `play`, `stop`, `toggle-ghost`.
- `SkateHUDProps.onReplay?: (action: ReplayAction) => void`; parent forwards to runtime and wakes the existing frame owner. It must also forward the new control methods from runtime to the driver.
- `SkateDriverOptions.reducedMotion?: () => boolean` reads runtime's current reduced-motion policy. The driver also defaults to the OS preference when no callback is supplied and honours the saved skate reduced-effects preference.
- `SkateHudModel.replay` includes availability, duration, active time, ghost toggle, reduced-motion state, decorative pose and bounded map path. Parent does not need to build this model.

Next owner: parent Codex integrates, reviews the diff and runs the measured integrated gate. Jonathan owns human control feel and visual acceptance. No push, merge or deploy was authorized by this track.
