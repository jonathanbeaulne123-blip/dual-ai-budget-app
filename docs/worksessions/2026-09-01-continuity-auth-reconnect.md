# Hearth worksession — continuity Auth reconnect

- **Status:** RELEASE AUTHORIZED — exact Clerk-integrated candidate verified; replacement push/merge/Development deploy pending
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/auth-reconnect-repair`
- **Baseline SHA:** opened at `4e0515069c14bba6ed31f640735fa48986f6f569`; final rebase base `8fb0a5f11a11a4b251bef0eb031940d9c201997b`
- **Head SHA:** application `a7bd6b8`; tooling `0520c1e`; schedule repair `72bba7d`; final docs commit pending
- **PR or issue:** PR #284
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
- [x] One full combined release-gate run exits green on the exact Clerk-integrated tree.

## Plan

- [x] Reproduce and classify the diagnostic.
- [x] Open a clean isolated exact-baseline worktree.
- [x] Implement the Auth-required state and reconnect action.
- [x] Add lifecycle/status/UI/OAuth regressions.
- [x] Run focused verification and aggregate full-suite evidence.
- [x] Obtain a green combined release-gate exit before release consideration.
- [x] Update D-195, AI handoff, and this evidence log.
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
- Final Clerk-integrated base is `origin/main@8fb0a5f`; Clerk remains D-194 and this Auth repair is reconciled to D-195. Focused Clerk/Auth/schedule/lane interaction proof passed 38/38.
- Exact rebased release tree through schedule-preservation repair `72bba7d`, retaining Auth application `a7bd6b8` and lane correction `0520c1e`, passed `pnpm check:windows`. Fast lane: 214 files passed / 1 skipped, 1,456 tests passed / 2 skipped. Serial books lane: 18 files passed / 1 skipped, 145 tests passed / 1 skipped. Total: 1,601 passed / 3 skipped. AI surface, deployment sanitizer, TypeScript, Vite production build (400 modules), Hercules Pro UI, and no `dist/_redirects`: pass.
- The first exact remote CI run exposed a real D-172 schedule merge defect: refreshing one member discarded another member's Personal shift envelope, and status aging used wall clock instead of the authenticated observation time. Repair `72bba7d` preserves untouched members and passes the observation time into status derivation; its regression and the formerly failing demo assertion pass.

## Decisions

- Use the existing Supabase Google OAuth path; do not make the direct Google Bridge button silently stand in for Supabase Auth.
- Require a human click and Google account chooser; never launch OAuth from a timer, focus event, or background reconnect.
- Keep Auth recovery independent of transport selection; polling-only continuity needs the same secure-session door as Realtime.
- Preserve local books and fail closed at the existing Auth membership/PGlite boundaries.

## Remaining uncertainty

- Local unit/integration proof cannot prove the user's real Google account completes OAuth or that the deployed two-device latency meets the historical `<=500 ms p95` gate.

## Handoff

Jonathan authorized push, merge, and Development deployment. The exact Clerk-integrated candidate is green; replacement push/merge/deploy are pending. Signed-in account-chooser smoke and fresh two-device timing remain separate live acceptance proof.
