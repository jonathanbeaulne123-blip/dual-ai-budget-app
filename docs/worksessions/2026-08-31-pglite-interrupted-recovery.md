# Hearth worksession — PGlite interrupted recovery

- **Status:** CLOSED — LOCAL VERIFIED; RELEASE PENDING
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/pglite-interrupted-recovery`
- **Baseline SHA:** `87acccd4f358286693f7a65172aec39d6ca4adbc`
- **Head SHA:** local release-candidate commit; exact SHA in the final handoff
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development and Production local PGlite startup; no hosted mutation

## Household outcome

An accepted saved household can reopen after its local PGlite projection is absent or interrupted, without weakening the block on altered, unbalanced, or genuinely mismatched books. Development reset controls tell the truth and remain available as a deliberate escape hatch while validation is blocked.

## Budget delta (5)

`+4` — restores the validated local books projection from an exact accepted financial receipt and keeps Confirm closed until the rebuilt journal passes hash and balance inspection.

## Engagement delta (3)

`0` — this is books recovery infrastructure. Dual Course holds because truthful recovery and a non-lying reset state take priority over new companion behavior.

## Verified baseline

- Freshly fetched `origin/main@87acccd4f358286693f7a65172aec39d6ca4adbc`; clean worktree before edits.
- Live kitchen showed `The snapshot has journal facts that PGlite does not` while the reset button falsely read `Starting over…`.
- Startup repaired only missing/incomplete schema; `interrupted-transaction` Retry repeated inspection without rebuilding.
- The global validation gate was reused as the reset button's progress state.

## Scope

### In scope

- Require a self-consistent `booksAcceptedHash` before interrupted-projection rebuild.
- Rebuild transactionally through the existing full PGlite ingest and re-inspect the exact hash.
- Keep mismatch, altered receipt, invalid journal, and unbalanced books blocked.
- Separate reset progress copy and availability from the books validation gate.
- Add focused startup regressions and update living canon.

### Out of scope

- Cloud reset, household mutation, hosted schema, secrets, Production continuity, deploy, merge, or push.
- Automatic recovery from a missing or mismatched accepted-books receipt.
- Any accounting formula, journal compiler, sync conflict, or Hercules behavior change.

## Acceptance evidence

- [x] Accepted receipt plus interrupted local projection rebuilds once and reaches ready.
- [x] Altered or missing receipt performs zero rebuild and remains blocked.
- [x] Projection mismatch and invalid/unbalanced paths remain fail closed.
- [x] Reset shows `Starting over…` only during a real reset and is reachable while books are blocked.
- [x] Focused tests and the full gate components pass on the final working tree.
- [x] Independent books/trust review finds no High-risk regression.

## Plan

- [x] Trace the deployed warning, startup validation, reset state, and current tests.
- [x] Create a clean fix branch from freshly fetched current main.
- [x] Implement receipt-gated rebuild and truthful reset state.
- [x] Run focused and full verification.
- [x] Record the exact diff, evidence, residual risk, and next owner.

## Evidence log

- Baseline focused tests before edits: `pnpm exec vitest run test/app-startup-p1.test.ts test/reset-development-local.test.ts` — 5 passed.
- Focused implementation run: startup/readiness/reset plus real PGlite suites — 33 passed.
- Final startup/readiness/reset rerun — 12 passed, including exact non-incremental/expected-hash options and the Retry-validation path.
- Complete exact-final-tree suite with the repository's Git Unix tools and bundled Python on `PATH`: 214 files passed, 2 skipped; 1,453 tests passed, 3 skipped, 0 failed.
- `pnpm ai:verify`, TypeScript, production Vite build, Hercules Pro UI build, and `git diff --check` passed.
- Build retained the repository's existing Vite PGlite externalization/eval and large-chunk warnings; no new build failure.
- Independent books/trust audit: PASS WITH NOTES, no P0/P1 blocker. Receipt matching, full transaction, reinspection, mismatch/invalid blocking, and no cloud/scope changes verified. P2 noted that the canonical receipt covers posted-money facts rather than every catalog byte; P3 exact option assertions were added.
- Independent recovery/UX verification: PASS WITH NOTES, no P0/P1 blocker; independently reran 11 focused tests. The direct Retry-validation regression and exact option assertions were added afterward and passed in the final 12-test focused run and full suite.

## Decisions

- Only `interrupted-transaction` gains receipt-gated self-heal. `projection-mismatch` and `invalid-stored-data` never auto-rebuild.
- The existing full transactional ingest is the recovery writer; no second journal path is introduced.

## Remaining uncertainty

- Live browser recovery requires a separately approved deployment and signed-in Development verification.
- The pre-existing `booksAcceptedHash` contract covers canonical posted-money facts, not a byte-for-byte snapshot. Account/catalog hash expansion would require a separately designed receipt-version migration; D-189 does not silently broaden that contract.

## Handoff

Local implementation and full automated verification are complete. Jonathan remains the release decision owner; no push, merge, or deploy was performed.
