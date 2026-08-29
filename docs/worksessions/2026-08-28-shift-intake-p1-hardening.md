# Hearth worksession — shift intake P1 hardening

- **Status:** ACCEPTANCE PROVED — ready for commit/release review
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/d169-visible-schedule-capture`
- **Baseline SHA:** `d87e2dee28113542ae07005f3907cb425566f6f9`
- **Head SHA:** working tree
- **PR or issue:** none
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** code only; no hosted or Production mutation

## Household outcome

Shift intake must fail closed when authoritative break, tip, sales, or tipped-shift covariate facts are missing; selected timesheet capture must not become background raw-page capture; fictional data must be impossible to load in Production; and OCR must preserve an unknown cash/card split instead of treating missing cash as zero.

## Budget delta (5)

`+3` — removes four paths that could erase missingness, route tips incorrectly, or replace real books with fixture data.

## Engagement delta (3)

`+2` — keeps explicit selected capture usable while making its boundaries honest and recoverable.

## Verified baseline

- Exact baseline and branch head are `d87e2dee28113542ae07005f3907cb425566f6f9`.
- The dirty tree is the uncommitted D-169/D-170 visible schedule/timesheet packet and is preserved in place.
- Independent intake review identified four open P1 boundaries: missing evidence fields becoming zero, generic My Timesheets interception, Production fixture controls, and inferred OCR card tips.

## Scope

### In scope

- Command-boundary authority requirements for evidence-backed work posts.
- Explicit-only My Timesheets projection and regression coverage.
- Development-only fixture controls in UI and core.
- Missing-preserving OCR tip split behavior.
- Focused, repository, build, and diff verification.

### Out of scope

- Hosted evidence reads or writes, deployment, secrets, migrations, provider calls, Production data, push, merge, or activation.
- Historical imports, Tip Science coworker correlations, or new capture sources.

## Acceptance evidence

- [x] Missing paid-break or required tipped-shift authority cannot post as zero.
- [x] Generic fetch/XHR capture rejects My Timesheets while the explicit selected projection still works.
- [x] Production cannot render or execute fictional ledger replacement.
- [x] OCR leaves an incomplete total-tip split blank and warns the reviewer.
- [x] Focused tests, TypeScript, AI verification, full suite, production build, and diff check are recorded.
- [x] Independent books/privacy/worker reviews report no open P0/P1/P2.

## Plan

- [x] Repair the four enforcement boundaries.
- [x] Add direct regressions at each boundary.
- [x] Run focused proof and full repository verification.
- [x] Obtain independent review and close this worksession for handoff.

## Evidence log

- Focused final closures: 60/60 passed across work evidence, automation, Evidence Worker, document scan, and deterministic POS parsing.
- Companion/UI focus plus earlier closure proof: 69/69 passed; Development stress fixture proof 9/9 passed independently.
- `pnpm exec tsc --noEmit`: passed.
- `pnpm ai:verify`: passed (41 required files).
- `pnpm test`: 1,113 passed, 2 skipped, 1 unchanged environment failure in `test/api.test.ts` because Windows cannot spawn `bash` (`ENOENT`).
- Windows-equivalent production build (`tsc`, `vite build --emptyOutDir`, Hercules Pro UI build, no `_redirects`): passed.
- `git diff --check d87e2dee28113542ae07005f3907cb425566f6f9`: passed with line-ending notices only.
- Independent books, privacy, and Worker/UI reviewers: PASS; no open P0/P1/P2.

## Decisions

- Missing values remain missing. Only an explicit authoritative zero may become zero in an evidence-backed money command; Total Tips and Merchant Owes remain comparison evidence, never a calculated card-tip source.
- My Timesheets is a user-selected fixed projection, not a background response class.
- Fixture generation is Development-only at both the product surface and the generator boundary.

## Remaining uncertainty

The repository's existing bash-spawn test cannot execute on this Windows host. Its other seven assertions pass, and the failure predates and is unrelated to this packet.

## Handoff

Local dirty D-169/D-170 implementation is acceptance-proved on baseline `d87e2dee28113542ae07005f3907cb425566f6f9`. It is ready for explicit staging and commit/release review. No push, merge, deployment, hosted mutation, or Production change occurred.
