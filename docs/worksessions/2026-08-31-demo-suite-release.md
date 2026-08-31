# Hearth worksession — Synthetic Demo Suite release

- **Status:** OPEN — local candidate verified; independent review pending
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/trustworthy-demo-suite`
- **Release baseline:** `e19acf09c35c26bda1dba9d01e4806a315e223ab`
- **Baseline tree:** `d1e3b8b9422767d1141c97b0d6698eb0a68caac2`
- **Audited source:** `4d26fd75f1a1f3e3fd67bbe79c05622fb0258db7`
- **Source closure:** `52b6fc3b2110fa550b40bfca94c53ca18d7ea46b`
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment:** Development Worker; no schema, secret, provider, or household-data mutation

## Household outcome

The current kitchen gains the dedicated Development-only Synthetic Demo Suite without losing newer Shared Money, startup, continuity, privacy, or performance work. The existing paper desk remains the product skin. Demo generation stays hermetic, replayable, visibly synthetic, and proposal-only until the ordinary visible Confirm.

## Dual Course

- **Budget delta (5): +4.** Deterministic domain engines, replay attestation, full Hercules calculation coverage, and privacy/export canaries make the investor proof accountable.
- **Engagement delta (3): +3.** The existing More room gains a replayable showcase and Hercules Pro story without restyling Home or changing navigation.

## Scope and boundaries

- Integrate the audited Demo Suite onto exact current `main`.
- Preserve all newer main work; D-179 resolves the decision-ID collision with D-174 through D-178.
- Run focused, full, static, build, privacy, and release checks on the integrated candidate.
- Push a PR, require green hosted checks, merge, deploy through the established Cloudflare workflow, and smoke desktop plus phone.
- Do not apply schema, change secrets/providers, mutate Production household data, weaken Confirm, or clean hosted rows.

## Evidence log

- 2026-08-31: GitHub `main` re-fetched at `e19acf0`, 16 commits ahead of the audited source baseline.
- 2026-08-31: a clean local release checkout was created; the dirty primary checkout was not changed.
- 2026-08-31: current-main reconstruction produced tree `d1e3b8b9`, byte-for-byte equal to the remote main tree before integration.
- 2026-08-31: the three Demo Suite commits were replayed. The sole content conflict was `src/App.tsx`; resolution preserved the newer startup/performance structure and added the dedicated suite at the audited replacement point. D-174 demo notes were renumbered D-179.
- 2026-08-31: the audited suite intentionally replaces the two legacy stress UI buttons while retaining and improving the underlying stress/shift generator. TypeScript confirmed that restoring the obsolete guards would create unreachable variants, so the final App resolution follows the audited replacement.
- 2026-08-31: focused Demo Suite, Hercules Pro, Confirm, visibility, startup, and legacy stress checks passed. The clean reduced full suite passed 1,220 tests with 3 skipped across 475 files.
- 2026-08-31: the unreduced local run had five unchanged checkout/environment failures only: Windows `bash` unavailable; local `miniflare` package unavailable; two tests write to `/opt/cursor/artifacts`; and one unchanged Flinks baseline expectation. The candidate does not modify those five files.
- 2026-08-31: TypeScript passed with only the unavailable local Miniflare harness excluded; `pnpm ai:verify` equivalent and Vite production build passed. The standalone Hercules Pro UI build was locally blocked by the sandboxed dependency junction and remains a clean-install CI gate.
- 2026-08-31: diff check and secret-pattern scan passed; no migration, env, provider, secret, Production-data, or hosted-cleanup file is in the candidate.
- 2026-08-31: integration audit found and repaired the D-175 seam for a newly created showcase: after accepted PGlite books, App now adopts the household through `adoptAcceptedHousehold`, updating the generation-bound books-readiness token instead of leaving the valid showcase locked. Focused startup, UI, Confirm, and TypeScript checks passed after the repair.

## Release gates

- [x] Exact integrated diff reviewed; no forbidden scope.
- [x] Focused Demo/Hercules/privacy/Confirm suites green.
- [x] `pnpm test`, TypeScript, AI-surface, Vite, and Hercules Pro UI builds recorded truthfully.
- [ ] Independent books/privacy/trust review on the exact candidate.
- [ ] Remote branch and PR created from the pinned candidate.
- [ ] Required hosted checks green.
- [ ] Merge and Cloudflare deployment green.
- [ ] Live desktop and phone smoke reaches More → Where the books live → Synthetic Demo Suite.

## Rollback

Revert the merge commit and redeploy the resulting `main`. Do not delete hosted rows or change provider configuration as rollback.
