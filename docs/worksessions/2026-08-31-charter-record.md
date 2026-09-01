# Hearth worksession — Charter record

- **Status:** CLOSED; PR OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `charter/1-record`
- **Baseline SHA:** `87acccd4f358286693f7a65172aec39d6ca4adbc`
- **Head SHA:** `2bbe03c75e5428789e209bf6489df83177574a57` (verified implementation including release-review repairs; later closure metadata is docs-only)
- **PR or issue:** [#267](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/267)
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
- [x] Branch pushed and PR opened, not merged.

## Plan

- [x] Reconcile the dated packet with current canon and reserve D-189.
- [x] Add the pure charter record, current snapshot plumbing, and focused tests.
- [x] Run focused and full verification.
- [x] Complete independent review and handoff.
- [x] Commit, push, and open the PR.

## Evidence log

- Baseline: `git fetch origin main --prune`; `origin/main` resolved to `87acccd4f358286693f7a65172aec39d6ca4adbc`.
- Focused after release-review repair: bundled pnpm `exec vitest run test/month-rehearsal-golden.test.ts test/charter-record.test.ts test/hosted-cas-two-client.test.ts` — 3 files, 24 tests passed.
- TypeScript: bundled pnpm `exec tsc --noEmit` — passed with no output.
- Full Windows gate after the final repair: `scripts/verify-windows.ps1 check` — AI surface passed; 215 test files passed / 2 skipped; 1,459 tests passed / 3 skipped; TypeScript and both production builds passed. Existing React `act(...)`, PGlite bundling, and chunk-size warnings remained non-fatal.
- GitHub code review found two P2 release blockers: charter-only shared edits were absent from the hosted CAS identity, and malformed signature rows could overstate completeness. Repair `2bbe03c75e5428789e209bf6489df83177574a57` includes a present Charter in the shared snapshot identity while preserving legacy hashes for households without one and excluding it from Personal-scope hashes; contextual shaping now emits one line per real member and forces duplicates unsigned.
- Independent targeted re-review after both repair rounds: no P0–P3 findings. The reviewer confirmed member/Fund custody, Shared round-trip preservation, shared-only CAS identity, and fail-closed signature normalization.
- UI viewport evidence: not applicable; this slice adds no UI.
- Delivery: implementation `1cb08bd732c8e31fa71897867e9da2924675968f` plus release repair `2bbe03c75e5428789e209bf6489df83177574a57` prepared on `charter/1-record`; PR #267 remains the merge vehicle.

## Decisions

- Use D-189 instead of the manual's stale D-174; no feature scope changed.
- The one-argument shaper remains available. An optional pure household context closes the member/Fund-custodian invariant without introducing slice-2 commands.

## Remaining uncertainty

- Charter creation still has no command or UI by design; those remain later slices.
- The structural one-argument shaper cannot know household membership by itself. Every current household acceptance and Shared-envelope boundary supplies the shaped members and Fund context and fails closed on mismatch.

## Handoff

Next owner is Jonathan for PR review. Local synthetic/code-only proof is complete. Nothing is merged, deployed, hosted, or manually verified against household data. No network data, secrets, schema, Supabase rows, Production state, or household records were read or changed.
