# Hearth worksession — Hercules intelligent animation P0

- **Status:** CLOSED
- **Opened:** 2026-08-29 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App\tmp\hearth-hercules-p0`
- **Branch:** `codex/hercules-p0-cpu`
- **Baseline SHA:** `fd1b27d4d76ce78690beffc26eb7283a6cc2638c`
- **Verified implementation commit:** `c3450f7d93d7e7eae0cac222e99a5be213770ffd` (before documentation-only amend)
- **PR or issue:** none supplied
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none; local synthetic Development verification only

## Household outcome

Hercules remains autonomously alive and mood-responsive without saturating the browser main thread. After ten seconds without human interaction he may make one quick fly pounce; a geometric capture adds the fly to the existing litter-box count.

## Budget delta (5)

Add, Books, and Confirm stay responsive and battery-safe. No command, ledger, acceptance, persistence, sync, or financial meaning changes.

## Engagement delta (3)

Hercules continues breathing, blinking, moving his tail, wandering, grooming, reacting, and chasing flies through the existing rig engine rather than becoming a static decoration.

## Verified baseline

- Clean worktree from exact SHA `fd1b27d4d76ce78690beffc26eb7283a6cc2638c`.
- The primary checkout is dirty, including unrelated `src/Hercules.tsx` Hercules Pro launch edits; it will not be modified.
- Controlled diagnostic measured about 4.90 seconds of main-thread task time per five seconds with the rig running and 0.22–0.30 seconds after destroying it.
- Current rig runs an unconditional animation-frame loop, rebuilds clip tracks while sampling, and publishes React state every frame.
- Current rig context recreates control functions when state changes, so pose effects can replay on state publication.
- Existing autonomous fly, furniture, grooming, mood, and litter-box behavior is already presentation-only.

## Scope

### In scope

- Adaptive engine scheduling, stable controls, cached clip tracks, visibility/reduced-motion suspension, and unchanged-snapshot suppression.
- Mood-adaptive ambient motion plus higher-cadence bounded reactions.
- Ten-second human-idle fly pounce with geometric capture into the existing litter box.
- Focused engine/UI tests, production browser performance proof, rig docs, and a decision why-note.

### Out of scope

- Money commands, ledger/PGlite, continuity, Auth, schema, secrets, hosted data, Production, deployment, merge, or push.
- Removing Hercules, making him Home-only, or replacing the rig engine with CSS-only motion.
- Broad Office, bundle, startup, or persistence optimization.

## Acceptance evidence

- [x] Ambient engine motion remains visible without human interaction.
- [x] Reaction cadence accelerates briefly and returns to ambient cadence.
- [x] Hidden/offscreen and reduced-motion states schedule no continuing work.
- [x] Ten-second idle pounce fires once per human-idle period; only geometric capture increments litter count.
- [x] Phone and desktop settled task/script duration meet the P0 performance budget.
- [x] Focused tests and the repository check are recorded honestly.
- [x] Independent UX and Hearth verification complete.

## Plan

- [x] Refactor the rig into mood/profile-aware deadline scheduling.
- [x] Keep engine-driven snapshots smooth through compositor interpolation.
- [x] Add the autonomous idle fly-pounce flow.
- [x] Add focused lifecycle, cadence, capture, and poller tests.
- [x] Update canon, measure a fresh build, audit, and close the worksession.

## Evidence log

- `git branch --show-current` -> `codex/hercules-p0-cpu`.
- `git rev-parse HEAD` -> `fd1b27d4d76ce78690beffc26eb7283a6cc2638c`.
- `git status --short` -> clean at worksession open.
- Focused rig/UI/transport suite -> 6 files, 29 tests passed.
- `tsc --noEmit` -> passed.
- Production Vite build -> passed; Hercules Pro companion bundle -> passed.
- Fresh production-browser trace -> phone 0.530s and desktop 1.040s main-thread task time per five settled seconds, down from about 4.90s; zero dormant rig poll requests.
- Browser fly proof -> litter status changed from zero to one after the ten-second idle pounce; measured reaction settled in 666.5ms.
- Repository `pnpm check` -> AI surface passed; full suite 892/897 passed with three failures outside the packet: Windows `bash` unavailable in `api.test.ts`, a pre-existing stale source-pattern assertion in `companion-office-update.test.ts`, and an untouched Hercules Pro personal-envelope shift expectation returning empty. The gate stopped before build, so both app builds were run directly and passed.
- Independent audit found and then verified the repair for premature visible capture; independent verifier returned PASS after movement/activity/visibility cancellation coverage.

## Decisions

- Selected liveness profile: mood-adaptive.
- The rig engine remains the source of motion; the browser compositor only interpolates between engine-issued targets.
- A fly chase is one opportunity per human-idle period, not a repeating ten-second farming loop.
- Capture is based on Hercules overlapping the fly at the capture frame, not a fabricated random reward.

## Remaining uncertainty

- Real-device battery and touch feel remain a post-local-proof manual gate.
- The three repository-wide failures above remain outside this packet and prevent calling the entire repository gate green.

## Handoff

Closed locally with proof. No merge, push, deployment, hosted-data write, or Production change was performed. Jonathan owns integration and release decisions.
