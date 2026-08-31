# Hearth worksession — Google auth containment release

- **Status:** READY — local release review PASS; hosted checks pending
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/reconciliation-salvage-audit`
- **Baseline SHA:** `3e48bcc3ca3919d8663c2f1ab1dfbd5a5cfda7cf`
- **Head SHA:** `ab64ca198c3278efe05ccff3210060165f8c5f3e` (locally reviewed code/test candidate; exact merge SHA pending)
- **PR or issue:** pending
- **Risk:** Release (Google/Auth identity and kitchen deployment; no money semantics)
- **Decision owner:** Jonathan — explicitly authorized push, merge, and deployment
- **Environment impact:** Cloudflare kitchen Worker and static assets; no hosted ledger/schema/data mutation

## Household outcome

Background refresh, startup, Calendar, Drive, desk, and delayed UI work cannot unexpectedly open Google account UI, revive a signed-out credential, or land after the person, household, environment, view, or component has changed. Current `main`'s synthetic demo suite and Supabase session-revocation contract remain intact.

## Budget delta (5)

`+2` — identity-bound continuity and proposal surfaces are less likely to expose or apply stale cross-context state. Money commands, CAD arithmetic, splits, journal compilation, reconciliation, and Confirm authority are unchanged.

## Engagement delta (3)

`0` — no new interaction is added. The release removes surprise Google prompts and stale delayed UI behavior; this trust repair intentionally does not add companion or office chrome.

## Verified baseline

- `origin/main@3e48bcc3ca3919d8663c2f1ab1dfbd5a5cfda7cf` includes the trustworthy synthetic demo suite from PR #253.
- The three salvage commits rebased onto that baseline without changing the new demo suite; the one `src/App.tsx` overlap was resolved in favour of `createOrReplayDemoSuite` plus the current startup design.
- The branch is three commits ahead of `origin/main` before this release record and has no unrelated working-tree changes.
- Prior current-main evidence: Google/Auth focus passed 64 tests; import/reconciliation/privacy focus passed 39 tests; TypeScript and production build passed. The prior full suite reached 1,264 passed / 3 failed / 3 skipped; the failures were two hard-coded `/opt/cursor/artifacts` permission errors and one existing stress timeout that passed in isolation.

## Scope

### In scope

- Revalidate the rebased Google/Supabase prompt, token, session, and delayed-scope containment.
- Inspect the complete `origin/main...HEAD` diff and release-sensitive paths.
- Push the branch, obtain hosted CI and Cloudflare PR-build evidence, merge the reviewed SHA, observe the `main` CI/deployment, and smoke the live kitchen.
- Record exact branch, PR, merge, workflow, Worker version, and live-route evidence.

### Out of scope

- Hosted migrations, `books:apply`, D1 migration application, secret changes, provider activation, feature-flag changes, or household-data mutation.
- Production ledger content, partner-personal data, bank/provider calls, Google mailbox/Drive contents, or real evidence capture.
- Financial behavior, synthetic demo behavior, office redesign, or removal of another user-facing feature.

## Acceptance evidence

- [x] Complete diff and affected execution paths reviewed against current canon.
- [x] Focused Auth/Google/delayed-scope tests pass on the rebased exact SHA.
- [x] `git diff --check`, TypeScript, production build, and Wrangler dry-run pass.
- [x] `pnpm check` passes: 1,282 tests passed, 3 skipped, then the production build passed.
- [x] No secret, `.env`, workbook, chat export, private artifact, or household payload is tracked.
- [ ] Branch CI and pull-request Cloudflare build pass for the exact release SHA.
- [ ] Reviewed commit merges to `main`; `main` CI and Cloudflare deployment pass.
- [ ] Live kitchen and non-mutating status routes return expected responses without enabling providers or touching household data.

## Plan

- [x] Rebase the salvage branch onto current `origin/main` and preserve the synthetic demo suite.
- [x] Run the Hearth release review gate and close any finding.
- [ ] Push, open the PR, wait for hosted checks, and merge.
- [ ] Observe the production Worker deploy and smoke the live app.
- [ ] Close this worksession with exact evidence and rollback.

## Evidence log

- 2026-08-31: rebased onto `origin/main@3e48bcc`; resolved the sole App overlap by keeping the new D-179 demo suite. Rebased commits are `fbd11f2`, `3695aa7`, and `f64a9cb` before this release record.
- 2026-08-31: local Wrangler `4.125.0` is authenticated to Cloudflare account `7dfdfbba3053d8b857cbc359e0761c00`; repository workflow `.github/workflows/pages.yml` builds PRs and deploys only pushes to `main` with `wrangler deploy --assets=./dist`.
- 2026-08-31: complete diff review found no money-command, synthetic-demo, provider, schema, secret, or household-data change. Added-secret and private-artifact path scans returned no match; `git diff --check` passed.
- 2026-08-31: focused Auth/Google/delayed-scope run passed 62 tests across 7 files; TypeScript passed; production build passed with only the repository's existing PGlite externalization/eval and chunk-size warnings; Wrangler dry-run packaged 62 asset files and exited without deploying.
- 2026-08-31: the first full gate passed 1,280 tests and exposed only two test-only writes to hard-coded `/opt/cursor/artifacts`. Replaced that environment-specific destination with `HEARTH_ARTIFACTS_DIR` when supplied, otherwise an OS temporary directory. The two affected files then passed 26 tests in isolation.
- 2026-08-31: repaired `pnpm check` passed end to end: AI surface verification; 1,282 tests passed / 3 skipped across 195 files; and the production build completed. Existing React test `act(...)` and PGlite/chunk warnings remain non-failing.
- 2026-08-31: Hearth release review result is **PASS for push and hosted review**. Merge remains contingent on the exact pushed SHA passing branch CI and the pull-request Cloudflare build.

## Decisions

- The D-179 synthetic demo suite is current product and stays. Older stress-reload UI from the stale checkout remains superseded.
- The release uses the repository's D-041 GitHub-to-Cloudflare path. A local Wrangler deployment is fallback only if the reviewed merged-main workflow cannot publish and the cause is understood.
- No schema/data/secret/provider action is required for this code-only release.
- Test proof output defaults to an OS temporary directory so local and GitHub runners can execute the same gate. `HEARTH_ARTIFACTS_DIR=/opt/cursor/artifacts` retains the previous visual-proof destination where that directory is available.

## Remaining uncertainty

- Hosted CI and deployment state do not exist until the branch is pushed and merged.
- Live signed-in Google behavior needs a person with an existing Google session; this release can non-destructively verify route/build health and containment tests, but it will not inspect Google or household content.

## Handoff

Codex owns the bounded release through live smoke under Jonathan's explicit approval. Jonathan remains the decision owner for any newly discovered action that would change schema, secrets, provider flags, or household data.
