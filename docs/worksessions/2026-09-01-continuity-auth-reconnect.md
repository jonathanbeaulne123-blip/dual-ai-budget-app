# Hearth worksession — continuity Auth reconnect

- **Status:** IMPLEMENTED — focused verification passed; combined release gate pending
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/auth-reconnect-repair`
- **Baseline SHA:** `4e0515069c14bba6ed31f640735fa48986f6f569` (`origin/main` at open)
- **Head SHA:** uncommitted work over the baseline
- **PR or issue:** none
- **Risk:** High — Development Auth and Realtime availability/status; no financial meaning change
- **Decision owner:** Jonathan
- **Environment impact:** Development client only

## Household outcome

When a locally open Development household has lost its secure Supabase/Google cloud session, Hearth says that Google sign-in is needed instead of claiming it is checking every four seconds. The freshness row offers one deliberate Google reconnect. Local accepted books stay available, no outbox item is discarded, and Realtime resumes through the existing authenticated membership and PGlite gates after OAuth returns.

## Budget delta (5)

`+4` — restores honest, authenticated two-device continuity for accepted household books without adding a writer or weakening PGlite acceptance.

## Engagement delta (3)

`+1` — replaces an indefinite and misleading fallback label with one calm, visible recovery action.

## Verified baseline

Facts:

- Exact isolated baseline is clean `origin/main@4e0515069c14bba6ed31f640735fa48986f6f569`.
- The live privacy-safe diagnostic showed `realtimeStatus: null`, `freshnessMode: poll`, repeated `auth-blocked` / `poll-fallback`, and no Realtime subscribe lifecycle.
- Current `App.tsx` can return before starting continuity when both the stored Supabase session and phone-local Google session are absent.
- Current freshness copy maps null/non-subscribed Realtime to `Checking every 4 s`, even when no authenticated cloud request can run.
- `startSupabaseGoogleSignIn` already provides the explicit Google OAuth door and `consumeSupabaseAuthRedirect` saves the returned Supabase session.

Inference:

- The stuck label is an Auth-loss presentation/recovery defect, not evidence of lost local books or a financial-posting failure.
- An explicit account chooser is safer for reconnect than a background redirect because membership remains bound to the selected Google identity.

## Scope

### In scope

- Distinguish missing/expired Supabase Auth from a transient Realtime transport fallback.
- Show an honest Auth-required freshness state with a visible Google reconnect action.
- Trigger OAuth only from the user's click; preserve existing membership, environment, and PGlite acceptance checks.
- Ensure OAuth return can re-enter the existing continuity lifecycle.
- Add focused regression tests and update living release records.

### Out of scope

- Push, merge, deploy, hosted queries or row changes.
- Supabase schema, migrations, RLS, secrets, provider settings, or Production continuity.
- Changes to Google Workspace scopes, direct Google Bridge identity confirmation, command meaning, money arithmetic, journal materialization, conflict policy, or the outbox.
- A new live latency claim; signed-in two-device 100-sample proof remains separate.

## Acceptance evidence

- [x] Missing cloud session yields `Google sign-in needed`, not `Checking every 4 s`.
- [x] The freshness row exposes a visible, accessible `Continue with Google` action.
- [x] The action starts one environment-bound Google OAuth redirect with account selection only after a click.
- [x] No Auth-required action appears for local-only, Production-disabled, offline, or healthy subscribed states.
- [x] Polling/outbox/local accepted books remain unchanged while Auth is unavailable.
- [x] Focused tests, TypeScript/build, diff hygiene, and independent repair review pass.
- [ ] One full combined release-gate run exits green; the latest run had only the unrelated demo timeout recorded below.

## Plan

- [x] Reproduce and classify the diagnostic.
- [x] Open a clean isolated exact-baseline worktree.
- [x] Implement the Auth-required state and reconnect action.
- [x] Add lifecycle/status/UI/OAuth regressions.
- [x] Run focused verification and aggregate full-suite evidence.
- [ ] Obtain a green combined release-gate exit before release consideration.
- [x] Update D-193, AI handoff, and this evidence log.
- [x] Run independent books/trust and continuity reviews.

## Evidence log

- `git fetch origin --prune`; `origin/main` resolved to `4e0515069c14bba6ed31f640735fa48986f6f569`.
- Official Supabase changelog and Monitoring/Debugging guidance reviewed on 2026-09-01. No hosted Auth/Realtime change requires a schema or server alteration for this client repair.
- Focused Auth/status/App/Realtime/diagnostic proof passed 75/75; App-shell proof covers completely missing and refresh-refused sessions plus cross-tab storage loss/restoration.
- `pnpm exec tsc --noEmit`: pass.
- Exact final combined run: 224 files passed / 2 skipped; 1,560 assertions passed / 3 skipped. One unrelated demo replay hit its explicit 60-second timeout at 60.18 seconds; that exact assertion then passed alone in 45 seconds, yielding 225 passed / 2 skipped files and 1,561 passed / 3 skipped tests in aggregate.
- The deployment sanitizer passed inside the combined run with bundled Git Bash and Python on `PATH`.
- AI-surface verification, TypeScript, Vite production build with 397 modules, Hercules Pro UI, and no `dist/_redirects`: pass.
- Earlier combined-gate attempts exposed fixed-duration test/tooling limits only: startup, blocked-books, and receipt-recovery waits now follow actual readiness/ingest conditions, and the default 60-second demo ceiling was insufficient under transient machine load.
- Independent books/trust review: pass; no money, privacy, OAuth-scope, schema, hosted-data, or Production boundary regression. Independent continuity review's polling-only Auth finding was fixed and covered before final proof.
- `git diff --check`: clean except expected non-mutating CRLF notices.

## Decisions

- Use the existing Supabase Google OAuth path; do not make the direct Google Bridge button silently stand in for Supabase Auth.
- Require a human click and Google account chooser; never launch OAuth from a timer, focus event, or background reconnect.
- Keep Auth recovery independent of transport selection; polling-only continuity needs the same secure-session door as Realtime.
- Preserve local books and fail closed at the existing Auth membership/PGlite boundaries.

## Remaining uncertainty

- Local unit/integration proof cannot prove the user's real Google account completes OAuth or that the deployed two-device latency meets the historical `<=500 ms p95` gate.

## Handoff

Local implementation only. The combined release gate remains pending because of the recorded unrelated demo timeout. Jonathan remains the next owner for any later release decision and signed-in two-device timing run.
