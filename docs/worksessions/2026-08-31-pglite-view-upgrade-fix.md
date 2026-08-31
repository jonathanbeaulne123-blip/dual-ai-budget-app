# Hearth worksession — PGlite net-worth view upgrade repair

- **Status:** CLOSED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/pglite-view-upgrade-fix`
- **Baseline SHA:** `0f03497087d98a4b1c50bd2a3a9b80b1fc64b04b`
- **Head SHA:** pre-release head `f47a2232d8e818f30562dbee347a630ac1632aeb`; the exact rebased release SHA is recorded by Git and the release handoff after commit
- **PR or issue:** none
- **Risk:** High
- **Decision owner:** Jonathan for push/deploy; Codex for the bounded local repair
- **Environment impact:** Development and Production local PGlite initialization; no hosted schema or data impact

## Household outcome

An existing device can open and validate its accepted books after the D-183 equity addition without resetting PGlite or discarding journal rows.

## Budget delta (5)

`+5` — restores fail-closed books validation while preserving the accepted on-device journal and accounting-equation proof.

## Engagement delta (3)

`0` — this is a books-first trust repair; no Hercules, kitchen, or interaction behavior changes.

## Verified baseline

- Live Development showed `cannot change name of view column "net_worth_cents" to "equity_cents"` while opening revision 19.
- `origin/main` and this baseline were exactly `0f03497087d98a4b1c50bd2a3a9b80b1fc64b04b` before branching.
- D-183 inserted `equity_cents` before the existing `net_worth_cents` and `net_income_cents` columns in `v_net_worth`.
- `migrateBooks` executes `BOOKS_SCHEMA` against each existing local PGlite database before checking migration markers.
- PostgreSQL/PGlite refuses `CREATE OR REPLACE VIEW` when an existing output column would be renamed by position.
- An independent read-only review reproduced the exact error and recommended appending the new named column instead of dropping the view.

## Scope

### In scope

- Preserve the seven legacy `v_net_worth` output columns in their original order.
- Append `equity_cents` and keep named consumers unchanged.
- Add an existing-schema regression proving journal and household rows survive the upgrade.
- Run focused and full local verification.

### Out of scope

- Resetting or deleting PGlite/IndexedDB data.
- Changing the accounting formula, opening-balance semantics, or hosted schema.
- Pushing, merging, or deploying without Jonathan's confirmation.
- Mutating Development or Production household rows.

## Acceptance evidence

- [x] Regression fails on the current baseline with the exact view-column error.
- [x] Existing-schema migration succeeds with legacy ordinals preserved and `equity_cents` appended.
- [x] Existing household and balanced journal rows remain present and queryable.
- [x] Focused books tests pass.
- [x] `pnpm test` and `pnpm check` pass with the bundled Node/Python and installed Git Bash on PATH.
- [x] Independent diff review finds no unresolved books-safety issue.

## Plan

- [x] Confirm the live error and exact source baseline.
- [x] Obtain independent read-only root-cause review.
- [x] Add the failing upgrade regression.
- [x] Reorder only the new view column and rerun the regression.
- [x] Run final independent diff review and close this worksession.

## Evidence log

- Live Chrome DOM on 2026-08-31: Development revision 19 displayed the exact PostgreSQL view-column error. No browser action or household mutation was performed.
- `git status --short` on the selected clean worktree: clean before this worksession.
- Concurrent docs-only commit `f47a2232d8e818f30562dbee347a630ac1632aeb` advanced the local branch after opening; it records the prior D-182 release and does not touch the schema or regression under review.
- Independent review: reproduced against PGlite; recommended append-only view evolution and no `DROP VIEW`.
- Failing regression on the unmodified view order: `pnpm exec vitest run test/household-fund-pglite.test.ts -t "appends equity"` -> 1 failed with the exact `net_worth_cents` to `equity_cents` error.
- Focused verification after the fix: `pnpm exec vitest run test/household-fund-pglite.test.ts test/books.test.ts` -> 2 files, 25 tests passed.
- First full `pnpm test` -> 204 files and 1,337 tests passed; the sole failure was `spawnSync bash ENOENT`. With installed Git Bash and bundled Python on PATH, `test/api.test.ts` passed 8/8.
- Exact candidate gate with bundled Node/Python and installed Git Bash on PATH: `pnpm check` -> AI surface verified; 205 files passed / 2 skipped, 1,338 tests passed / 3 skipped; TypeScript passed; Vite production build passed; Hercules Pro UI build passed; `dist/_redirects` absent.
- Expected existing build warnings remained: PGlite browser externals/eval and bundle-size notices. No new build error.
- Final independent books review: PASS after correcting the worksession's concurrent-HEAD provenance; no accounting, migration, or data-preservation defect found.
- Final independent privacy/hosted-data review: PASS with no P0-P3; no member visibility, Worker, Supabase, environment, secret, Production, or destructive-recovery change.

### Changed files

- `src/ledger/schema.ts` — append the new equity view output after the legacy columns.
- `test/household-fund-pglite.test.ts` — reproduce the legacy persisted view and prove an in-place, data-preserving upgrade.
- `docs/DECISIONS.md` — record the compatibility why-note.
- `docs/worksessions/2026-08-31-pglite-view-upgrade-fix.md` — record scope and evidence.

## Decisions

- Treat this as High risk because it gates financial validation, even though the SQL formula is unchanged.
- Prefer append-only output evolution. It preserves existing column ordinals, dependencies, grants, and device data.
- Do not add a destructive recovery path or silently reset local books.

## Remaining uncertainty

- The deployed kitchen remains unchanged until Jonathan approves push/deploy.
- Live existing-IndexedDB proof must run after the reviewed fix is deployed.

## Handoff

Jonathan authorized commit, push, and deploy on 2026-08-31. Next owner: Codex rebases the reviewed fix onto current `origin/main`, reruns the exact release gate, publishes through `main`, and reloads the existing Development kitchen to verify the banner clears without resetting PGlite. No hosted schema/data, secret, or Production mutation is authorized.
