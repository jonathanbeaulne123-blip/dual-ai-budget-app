# Hearth worksession — Clerk Slice 3 enforceable fences

- **Status:** OPEN
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Branch:** `clerk/3-fences`
- **Baseline SHA:** `origin/main@8fb0a5f11a11a4b251bef0eb031940d9c201997b` plus draft Slice 2 head `44426f68e8aea60c5615ae255ad5e7b607735907`
- **Head SHA:** local uncommitted implementation over merge `1116e5bac730fafe4174baf5272881250698a191`
- **PR or issue:** depends on draft PR #287; no Slice 3 PR
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

The Clerk's promise to quote the record without proposing money or work becomes a failing build rule, not optional copy discipline.

## Budget delta (5)

`+1` — a future Clerk change cannot silently add advice, work instructions, or a money-writing dependency without breaking verification.

## Engagement delta (3)

`0` — this slice adds no visible interaction; it protects the trustworthiness of Slice 2's citation experience.

## Verified baseline

Facts:

- `origin/main@8fb0a5f` contains the released Slice 1 cited reader.
- Cursor's draft PR #287 head is `44426f68e8aea60c5615ae255ad5e7b607735907` and adds only Slice 2 UI, CSS, tests, and its worksession.
- A local merge of those exact lineages passed the Slice 1 + Slice 2 focused suite: 2 files / 12 tests.
- Slice 3 owns new `test/clerk-fences.test.ts` and a modification to `scripts/verify-ai-surface.mjs`; it does not share an implementation file with Cursor.

Inference to prove:

- A filename-scoped source scan plus command-driven output tests can enforce the Slice 3 boundary without changing Slice 1 or Slice 2 behavior.

## Scope

### In scope

- Build-level Clerk advice, work-instruction, and money-writer fences in `scripts/verify-ai-surface.mjs`.
- Command-driven readings across several synthetic household states.
- Static source proof over every `src/**/clerk*.ts(x)` file.

### Out of scope

- Any edit to Cursor's Slice 2 component, CSS, or tests.
- Clerk UI placement, weekly scheduling, model/provider work, new calculations, commands, persistence, network, schema, hosted data, secrets, Production, push, PR, merge, or deploy.
- Repairing the unrelated date-sensitive Demo Suite assertion currently red on `main` CI.

## Acceptance evidence

- [ ] Every sentence across the synthetic spread remains cited.
- [ ] No output sentence matches proposal/recommendation or work-instruction language.
- [ ] Every Clerk-owned source file is scanned by `pnpm ai:verify`.
- [ ] Clerk-owned sources import or invoke no money-writing path.
- [ ] Slice 1, Slice 2, and Slice 3 focused tests pass together.
- [ ] `pnpm ai:verify`, TypeScript, build, and diff hygiene pass.
- [ ] Cursor PR #287 head is re-fetched before close; any drift is reconciled and reverified.

## Plan

- [x] Establish a separate stacked branch and exact two-slice baseline.
- [ ] Implement the build and runtime-output fences.
- [ ] Run focused and aggregate verification.
- [ ] Re-fetch Cursor's dependency and close with exact evidence.

## Evidence log

- 2026-09-01: Created `clerk/3-fences` from `origin/main@8fb0a5f`, merged draft Slice 2 head `44426f6`, and committed the stack at `1116e5b`.
- 2026-09-01: Baseline `test/clerk-reading.test.ts test/clerk-citations.test.ts` passed 12/12.

## Decisions

No new product decision. This slice enforces D-194 and the accepted Slice 1 contract.

## Remaining uncertainty

Cursor may advance PR #287 while this branch is open. Slice 3 cannot close until the final dependency head is reconciled and the combined focused proof is rerun.

## Handoff

Local stacked branch only. No push, PR, merge, deploy, hosted action, schema, secret, Production action, or household-data mutation.
