# Hearth worksession — Held Audit Office truth

- **Status:** VERIFIED; MERGE AUTHORIZED; PR #290 OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/held-audit-office-truth`
- **Baseline SHA:** `a4e399275121b4ca357c683b6bc42e9ae944104d`
- **Head SHA:** `0df5a9418c1d5af9c2f81ed308ce2588541589f0` before this receipt-only closeout commit
- **PR or issue:** [#290](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/290), follow-up to merged PR [#286](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/286)
- **Risk:** High (Audit Office money presentation beside Confirm authority)
- **Decision owner:** Jonathan; merge explicitly authorized in chat
- **Environment impact:** code and docs only; no deploy, hosted row, schema, secret, or Production action

## Household outcome

A withdrawn Fund contribution no longer appears as money awaiting confirmation. Audit Office keeps proposed, Held, released, and withdrawn motions as readable lineage records without printing their amounts as posted CAD.

## Dual Course deltas

- **Budget delta (5):** `+2` — Audit Office uses the sealed D-193 motion fold and no longer misstates withdrawn or record-only motion facts.
- **Engagement delta (3):** `+1` — calm human labels replace raw internal event kinds while preserving the exact Held conversation copy.
- **If they conflict:** books win; record-only lineage never looks posted.

## Scope

- Route Audit Office pending counts and confirm actions through `householdFundContributionMotions`.
- Give Held/released/withdrawn weekly records calm labels, attribute the actual holder/releaser/proposer, and render all four contribution-motion lineage kinds as `record only`.
- Add focused regressions for open, Held, released, and withdrawn states.
- Correct stale #286 status docs to merged-on-main while leaving kitchen live unproven.

## Non-scope

- Fund commands, journal, PGlite, continuity, Auth/RLS, schema, workers, secrets, Production, deployment, Register #285/#288.
- Any new writer, balance, allocation, or money formula.

## Acceptance evidence

- [x] Open and Held proposals remain in Audit Office's confirm queue and pending count.
- [x] Withdrawn proposals leave the queue and pending count.
- [x] Proposed/Held/released/withdrawn weekly rows use human labels and `record only`, never CAD.
- [x] Confirmed contribution and other money events continue to print CAD.
- [x] #286 docs state merged at `e7d98389be1a4ad831d4d83204061a68955df232`; kitchen live remains unproven.
- [x] Focused tests, `pnpm check:windows`, diff hygiene, independent books/privacy audits, and final release review pass.

## Evidence log

- 2026-09-01: clean branch created from current `origin/main@a4e399275121b4ca357c683b6bc42e9ae944104d`; the user's unrelated primary checkout was not modified.
- 2026-09-01: focused Held/Audit Office regression lane passed, 5 files and 36 tests; TypeScript and `git diff --check` passed. One initial test-only assertion expected an unescaped apostrophe in server-rendered HTML; the expectation was corrected and the product code did not change for that failure.
- 2026-09-01: `pnpm check:windows` passed: fast lane 217 files/1,484 tests passed with 1 file/2 tests skipped; serial books lane 18 files/145 tests passed with 1 file/1 test skipped; TypeScript, 400-module production build, Hercules Pro UI build, and redirect guard passed. Existing PGlite browser-build and chunk-size warnings remained non-blocking.
- 2026-09-01: independent books and privacy/trust follow-up audits both returned PASS with no P0-P2 findings. The privacy reviewer found one stale active-looking review prompt; it was explicitly marked historical and the re-review passed.
- 2026-09-01: final release review passed for code/docs merge only. No deploy, Production, hosted data, schema, secret, or kitchen-live claim is authorized or implied.
- 2026-09-01: implementation/evidence commit `0df5a9418c1d5af9c2f81ed308ce2588541589f0` pushed and PR [#290](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/290) opened against unchanged `origin/main@a4e399275121b4ca357c683b6bc42e9ae944104d`.

## Handoff

Implementation, local verification, push, and PR are complete. Exact-head CI and the authorized merge remain. Do not deploy; kitchen live remains unproven.
