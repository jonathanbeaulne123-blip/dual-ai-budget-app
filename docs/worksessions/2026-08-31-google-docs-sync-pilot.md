# Hearth worksession — ledger-native Google Docs feel pilot

- **Status:** DEVELOPMENT DEPLOYED; LIVE MATRIX AND 14-DAY REHEARSAL PENDING
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App-sync-pilot`
- **Branch:** `codex/google-docs-sync-pilot` (implementation); `codex/google-docs-sync-pilot-evidence` (release record)
- **Baseline SHA:** `2a984fd3346dc0b57d0e7b6a17702c18b82596d3`
- **Implementation SHA:** `c228464c4f4636afc8c39bde5949d6c0650a548a`
- **PR or issue:** [#256](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/256)
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

Jonathan and Bianca can rehearse ordinary shared and Personal ledger work on two signed-in devices with live updates, durable offline recovery, honest sync state, and privacy-safe pilot evidence. No peer device is the host. Production continuity remains off.

## Budget delta (5)

`+2 x 5 = +10` — accepted commands must survive offline, concurrent, and replacement-device use without silent loss, duplicate posting, or invalid books.

## Engagement delta (3)

`+2 x 3 = +6` — partner activity appears quickly with calm Live, Sharing, fallback, offline, and recovery states.

## Verified baseline

- A clean worktree was opened from freshly fetched current main and rebased as `main` advanced during verification; the final exact base is `2a984fd3346dc0b57d0e7b6a17702c18b82596d3`. The original dirty `codex/roadmap-site` checkout remains untouched.
- Current main already contains atomic Migration 012 transport, Migration 013 command events, Development Realtime 014, T1-S6 freshness UI, member-keyed open shifts, and Migration 017 session/device access controls.
- Canon records Development migration 017 applied and a rolled-back two-principal authority smoke.
- Before this packet, the Pages workflow baked `VITE_PRODUCTION_CONTINUITY=1`; D-180 changes the proposed pilot artifact to `0`.
- Supabase current guidance confirms Postgres Changes respects subscriber permissions and JWT `session_id` can be checked against `auth.sessions`. Broadcast is the scale-preferred path, but a Realtime rewrite is out of scope for this two-person pilot.

## Scope

### In scope

- Bake Google Auth, Development Realtime, and command-log transport on for the kitchen build while baking Production continuity off.
- Add a Development-only, local privacy-safe diagnostic trace and Copy action for latency/recovery evidence.
- Add regression tests for the build boundary, trace redaction/retention/p95 summary, sync honesty, command convergence, member-keyed shifts, additive joining, and local preservation on pull failure.
- Add the exact live two-device matrix and fourteen-day rehearsal runbook.
- Update current canon and handoff truth.

### Out of scope

- Production continuity or Realtime, schema/migration changes, provider/secret changes, hosted row changes, literal field-level co-editing, Broadcast migration, bank feeds, automatic money posting, or daily-use activation.

### Release authorization extension

- After the local packet and independent reviews passed, Jonathan explicitly approved the previously requested GitHub push, merge, and Development deployment on 2026-08-31.
- This approval does not authorize Production, schema, secrets, hosted household mutations, or the “Docs-like Development sync proven” claim.

## Acceptance evidence

- [x] Workflow bakes Auth/Realtime/command log on and Production continuity off.
- [x] Diagnostic records only sanitized Development metadata, stores at most 500 local events (enough for a multi-phase 100-event run), and exports p50/p95/max without money, notes, emails, tokens, or raw ids.
- [x] Distinct command events converge; duplicates/out-of-order delivery stay exactly-once; same-id divergent money preserves both versions for human review.
- [x] Shared and Personal scope tests remain closed; both members may hold independent open shifts.
- [x] New-device/join storage and failed-persistence proof preserve the last accepted local household; live failed-fetch/recovery remains in the two-device matrix.
- [x] Focused tests, `pnpm test`, `pnpm ai:verify`, typecheck/build, and `git diff --check` are recorded.
- [x] Independent books/trust reviews and final Hearth verification/release review complete; no open P0–P2.
- [x] Push the exact reviewed branch, merge through GitHub, and verify the deployed SHA and baked Development-only flags.
- [ ] Live two-device matrix and 14-day rehearsal remain explicitly pending until Jonathan runs them after an approved deploy.

## Plan

- [x] Implement and test the Development-only build boundary.
- [x] Implement and test local pilot diagnostics and Copy action.
- [x] Close automated recovery/convergence proof gaps while restoring explicit human resolution for true same-fact divergence.
- [x] Add the pilot runbook and update canon/handoff.
- [x] Run focused/full proof and independent reviews.

## Evidence log

- Final `git fetch origin --prune`; `origin/main` resolved to `2a984fd3346dc0b57d0e7b6a17702c18b82596d3`. The only last-step delta was the Google Auth containment worksession evidence; the runtime Auth release had already passed the rebased gate.
- Clean worktree created at `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App-sync-pilot` on `codex/google-docs-sync-pilot`.
- Read-only GitHub Actions inspection found successful main deployment run `33371466781` at exact SHA `2a984fd3346dc0b57d0e7b6a17702c18b82596d3`.
- Read-only Supabase dashboard inspection found migrations 001–017 and `continuity_command_events`, `continuity_personal_snapshots`, and `household_snapshots` in `supabase_realtime`.
- Pre-change focused continuity baseline: 22 files / 186 tests passed. An intermediate focused command/conflict/diagnostic proof passed 8 files / 71 tests.
- Final current-diff sync/Auth/recovery/books/UI gate: **30 files / 265 tests passed**.
- Exact current-main `pnpm test`: **194 files passed / 2 skipped; 1,289 tests passed / 3 skipped**. The first aggregate run found the repository sanitizer's Windows `python3` command assumption; the helper now selects a working `python3` or `python`, `test/api.test.ts` passed, and the exact full suite rerun is green.
- `pnpm ai:verify`: **41 required AI files verified**. `pnpm exec tsc --noEmit`, pilot-flagged `pnpm build` (**368 modules** plus Hercules Pro UI), and `git diff --check` passed. Existing PGlite externalization/eval and large-chunk build warnings remain warnings, not new failures.
- Semantic Pairing/access proof passed at **320 / 390 / 720 / 1100 px** and exercised Copy sync diagnostic/status at each width. A local browser spot-check expanded Advanced recovery and successfully copied a zero-sample sanitized Development bundle; no hosted request or provider mutation was required.
- Final repair proof: Production/privacy gate **10 files / 86 tests**; representative genuine-remote-hash conflict/realtime gate **5 files / 47 tests**. A forged remote hash still fails closed.
- Current-main Google Auth containment integration proof: **15 files / 137 tests**, including Auth session, Google GIS scope, invite/discovery, Production denial, diagnostics, freshness, two-browser, Realtime, materialization, and command runtime.
- Independent books review **PASS**, trust review **PASS** (independent 5 files / 28 tests), and release code re-review **PASS** (independent 5 files / 39 tests); no open P0–P2. Release review's sole evidence-count note is corrected above.
- Jonathan explicitly authorized push, merge, and Development deployment after the verified local handoff. The live matrix and daily-use decision remain separately gated.
- Reviewed head `0f54fa28e59db6997fa7c96bceb8a51f242c51d3` was pushed, PR [#256](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/256) passed CI run `33373555450` and Cloudflare run `33373555453`, and merged to `main` as `e9c5127594a9fd4e6d8b203f19db57cc4b31390a`.
- Main CI run [`33403561215`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561215) completed successfully at the exact merge SHA.
- Main Cloudflare run [`33403561188`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33403561188) succeeded at the exact merge SHA. Its Build and Deploy steps passed.
- Live origin inspection found main asset `/assets/index-H4g5wOkC.js`, Pairing asset `/assets/Pairing-BXhqncC_.js`, and Realtime asset `/assets/continuityRealtime-BLxMTAyn.js`. The reachable asset graph contains the Copy diagnostic, `command-realtime`, diagnostic kind, Production-continuity refusal, and cached-offline-data warning.
- No schema apply, hosted household row or provider-setting mutation, household-data mutation, Production action, secret change, or daily-use activation was performed. The only external mutations were the approved GitHub push/merge and Development deployment.

## Decisions

- This packet uses existing Postgres Changes and command-event transport. It does not introduce Broadcast or a new hosted schema.
- Pilot diagnostics are local, Development-only, bounded, redacted, and user-copied; they are never synchronized or sent automatically.
- The pilot release claim, if later earned, is “Docs-like Development sync proven for Jonathan and Bianca,” never Production-ready or literal collaborative editing.

## Remaining uncertainty

- The exact pilot runtime is deployed, but two real devices, two Google principals, 100 receiving-device latency samples, and the 14-day rehearsal cannot be completed by local automation.
- Deployment is not daily-use approval and does not earn the “Docs-like Development sync proven for Jonathan and Bianca” claim.

## Handoff

Jonathan owns hosted household access, the live two-device matrix, the fourteen-day disposable rehearsal, and the later daily-use decision. Codex may assist with the runbook and interpret the sanitized diagnostic without receiving household financial facts.
