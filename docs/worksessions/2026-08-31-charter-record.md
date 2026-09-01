# Hearth worksession — Charter record

- **Status:** READY FOR PR
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `charter/1-record`
- **Baseline SHA:** `87acccd4f358286693f7a65172aec39d6ca4adbc`
- **Head SHA:** pending final commit
- **PR or issue:** pending
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

Hearth can preserve the household's founding agreement as one typed, defensive record before any founding, signing, amendment, or page behavior exists.

## Budget delta (5)

`+2`: the record names custody, the household's own split rule, and a work ceiling without creating or projecting money.

## Engagement delta (3)

`+1`: the future founding document and ritual gain a stable source, while this slice deliberately adds no UI or Hercules behavior.

## Verified baseline

- `origin/main@87acccd4f358286693f7a65172aec39d6ca4adbc` was fetched on 2026-08-31.
- The user's primary checkout is dirty on `codex/roadmap-site`; this isolated worktree preserves those edits untouched.
- `D-174` through `D-188` are already assigned on current `main`. Jonathan authorized reconciling the dated build manual, so this slice uses the next free id, `D-189`.
- `Household` has an optional Household Fund record but no charter record on the baseline.

## Scope

### In scope

- Charter types and optional `Household.charter` record.
- Pure defensive shaping and read helpers.
- Relational custody checks at household and Shared-envelope shaping boundaries.
- Pure Shared-envelope round-trip preservation required by the current snapshot architecture.
- Focused record and source-fence tests.
- Decision D-189.

### Out of scope

- UI, commands, migrations, storage or sync behavior, hosted data, Production, and later charter slices.

## Acceptance evidence

- [x] Focused charter tests pass.
- [x] `pnpm test` passes with only documented skips.
- [x] `pnpm build` passes.
- [x] Independent targeted review passes.
- [ ] Branch pushed and PR opened, not merged.

## Plan

- [x] Reconcile the dated packet with current canon and reserve D-189.
- [x] Add the pure charter record, current snapshot plumbing, and focused tests.
- [x] Run focused and full verification.
- [x] Complete independent review and handoff.
- [ ] Commit, push, and open the PR.

## Evidence log

- Baseline: `git fetch origin main --prune`; `origin/main` resolved to `87acccd4f358286693f7a65172aec39d6ca4adbc`.
- Focused: bundled pnpm `exec vitest run test/charter-record.test.ts` — 1 file, 8 tests passed.
- TypeScript: bundled pnpm `exec tsc --noEmit` — passed with no output.
- Full Windows gate: `scripts/verify-windows.ps1 check` — AI surface passed; 215 test files passed / 2 skipped; 1,457 tests passed / 3 skipped; TypeScript and both production builds passed. Existing React `act(...)`, PGlite bundling, and chunk-size warnings remained non-fatal.
- Independent targeted re-review after snapshot-plumbing repairs: no P0–P3 findings. The reviewer confirmed the actual household boundaries enforce member/Fund custody and retain the charter through Shared split, assembly, and merge.
- UI viewport evidence: not applicable; this slice adds no UI.

## Decisions

- Use D-189 instead of the manual's stale D-174; no feature scope changed.
- The one-argument shaper remains available. An optional pure household context closes the member/Fund-custodian invariant without introducing slice-2 commands.

## Remaining uncertainty

- Charter creation still has no command or UI by design; those remain later slices.
- The structural one-argument shaper cannot know household membership by itself. Every current household acceptance and Shared-envelope boundary supplies the shaped members and Fund context and fails closed on mismatch.

## Handoff

Next owner is Jonathan for PR review. Local synthetic/code-only proof is complete. Nothing is merged, deployed, hosted, or manually verified against household data. No network data, secrets, schema, Supabase rows, Production state, or household records were read or changed.
