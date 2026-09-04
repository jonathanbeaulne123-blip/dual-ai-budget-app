# Hearth worksession — Readiness 5 preflight repair

- **Status:** LOCAL RELEASE REVIEW PASS; PR/deploy/two-device witness pending
- **Opened:** 2026-09-04 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/readiness-5-preflight-repair`
- **Baseline SHA:** `46ec498` (`origin/main`, after onboarding Chapter 4 / PR #332)
- **Head SHA:** `587f14cee4cdf045e2be798c9c0e075195bb9fd5` (exact tested code head; release-record follow-up is docs-only)
- **PR or issue:** pending
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

An extra Hearth tab cannot leave the laptop indefinitely claiming that local books are still validating. The opening attempt retires after a bounded wait, preserves the accepted snapshot and local database, and offers ordinary retry/recovery. Each signed-in Development device can also copy a privacy-safe authenticated cloud-clock calibration for the exact two-device sync proof.

## Budget delta (5)

`+3`: bounded local-books recovery and calibrated timing evidence protect accepted-book truth and make the readiness run auditable. No financial formula, command, amount, or posting authority changes.

## Engagement delta (3)

`0`: this is trust and release infrastructure, not a new household interaction loop.

## Verified baseline

- `origin/main@46ec498` is the refreshed clean isolated baseline. It superseded the initial `eb479f9` snapshot while this repair was in progress; the branch was rebased and the D-number advanced from 211 to 212 to avoid Chapter 4's accepted D-211.
- On the Development laptop, one current tab remained at `hearth:books:open-migrate:start:1` with no completion mark while another older Hearth tab was open.
- Closing the older tab and refreshing advanced the current tab to an honest projection mismatch; explicit **Restore from shared copy** recovered it to Live revision 17.
- The transaction was visible on the phone and the restored laptop. No loss or duplicate was observed in that recovery check.
- Inference: same-browser PGlite worker/IndexedDB leadership contention can leave the open/migrate promise pending indefinitely. The exact lower-level PGlite cause is not yet proven.
- The readiness proof contract requires authenticated cloud-clock calibration before and after the run on both devices, but current main has an evaluator only and no ordinary runtime producer.

## Scope

### In scope

- Bound and retire a stalled browser-books open/migrate attempt without clearing or overwriting local books.
- Keep recovery explicit and fail closed.
- Add an authenticated, Development-only clock endpoint and a privacy-safe in-app calibration/copy action.
- Focused unit, Worker, books, privacy, type, build, release, and live Development checks.
- Fresh Development release anchor and a clean two-device rerun with Jonathan operating the physical phone.

### Out of scope

- Production continuity or Production data.
- Supabase schema, migration, RLS, hosted household-row cleanup, secret, provider, or bank changes.
- Automatic local-books deletion, replacement, or silent replay.
- Real household facts in diagnostics, proof files, source, screenshots, or support notes.
- Claiming Readiness 5 or the fourteen-day rehearsal complete from this repair.

## Acceptance evidence

- [x] A never-settling browser-books opening rejects within the configured bound and retires its worker/handle.
- [x] Retry can start a fresh opening; no automatic IDB deletion, snapshot overwrite, or hosted mutation occurs.
- [x] Authenticated Development members can copy an allowlisted clock calibration with hashed device identity.
- [x] Anonymous, wrong-origin, wrong-scope, and Production clock requests fail closed.
- [x] Clock uncertainty over 50 ms is refused; the lowest-RTT valid sample is used.
- [x] Focused and release gates pass on the exact candidate SHA.
- [ ] PR checks, merge, Development deploy, live HTTP, and exact asset anchor pass.
- [ ] Laptop and phone complete a clean recovery/calibration rerun without loss, duplicate, invalid books, or false Synced state.

## Plan

- [x] Preserve the existing checkout and open an isolated clean current-main worktree.
- [x] Reproduce/observe the laptop failure and recover through the existing explicit shared-copy action.
- [x] Implement bounded books opening and deterministic tests.
- [x] Implement authenticated cloud-clock calibration and privacy/authority tests.
- [x] Update only the affected continuity/proof canon.
- [ ] Run focused gates, release review, PR/merge/deploy checks, and live Development verification. (Local review is complete; remote and live steps remain.)
- [ ] Guide the two physical devices through the clean rerun and record only privacy-safe results.

## Evidence log

- 2026-09-04 Toronto — clean branch from `origin/main@eb479f9e8abb67d8b49eb8b8b0e520eafc5d276d`.
- 2026-09-04 Toronto — browser performance marks stopped at `hearth:books:open-migrate:start:1`; no matching completion/error mark and no console error.
- 2026-09-04 Toronto — explicit shared-copy restore produced Live revision 17 on the laptop; the phone already showed the accepted transaction.
- 2026-09-04 Toronto — new focused deadline/clock suite: 3 files / 10 tests passed; TypeScript passed.
- 2026-09-04 Toronto — first expanded serial run passed 68/69 and timed out one existing restore UI wait under combined load; isolated rerun passed all 22 startup tests. The exact Release quick gate subsequently passed that startup file in the protected serial lane.
- 2026-09-04 Toronto — Release quick gate: `quick-gate-passed`, 15 files / 137 tests, TypeScript, AI surface, and diff hygiene; 200.654 s, no five-minute budget breach. Candidate was still dirty/uncommitted, so an exact clean-SHA rerun remains required.
- 2026-09-04 Toronto — `pnpm build` passed: 459 modules plus Hercules Pro UI; no `dist/_redirects`.
- 2026-09-04 Toronto — semantic Pairing UI at 320/390/720/1100 px passed 4/4 with the new proof-clock control, explicit Development/privacy copy, keyboard-native button type, and live status result. Combined final focused set passed 15/15.
- 2026-09-04 Toronto — fetched new `origin/main@46ec498` (Onboarding Chapter 4 / PR #332), rebased the isolated candidate, preserved both current handoff/roadmap records, and renumbered this decision to D-212.
- 2026-09-04 Toronto — exact clean code head `587f14cee4cdf045e2be798c9c0e075195bb9fd5` over `origin/main@46ec4982fa5214aabdc69decc2adcf65cc1fe7c0`: Release quick gate passed 16 files / 141 tests, TypeScript, AI-surface, and diff hygiene in 163.463 s; no time-budget breach.
- 2026-09-04 Toronto — exact current-main `pnpm build` passed TypeScript, Vite 459 modules, Hercules Pro UI, and redirect sanitizer. Only existing PGlite/chunk warnings appeared.
- 2026-09-04 Toronto — local Release review PASS: current main is the ancestor; scope contains no migration/schema, credential, hosted household mutation, Production flag, automatic clearing, or financial command/formula change. Rollback is the source commit; a deployed rollback still requires a separate approved Development deployment.

## Decisions

- Preserve the existing local replica on timeout. A timeout changes readiness state only; it is not proof of corruption.
- Cloud-clock authority must require the same authenticated exact household/member scope as continuity and return no identity or ledger facts.
- The UI copies only an allowlisted calibration row with a one-way device hash.

## Remaining uncertainty

- Whether the stalled underlying PGlite worker reports a delayed leader-change error after the observed wait.
- Exact two-device behavior remains to be rerun against the deployed candidate.

## Handoff

Codex owns the authorized PR, merge, Development deployment, and live-origin checks. Jonathan owns physical-phone actions and the operator witness. Current state is local branch/review only: not pushed, in a PR, merged, deployed, or physically rerun yet.
