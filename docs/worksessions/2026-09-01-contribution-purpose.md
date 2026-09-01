# Hearth worksession — contribution purpose labels

- **Status:** CLOSED
- **Opened:** 2026-09-01 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `C:\Users\jonat\OneDrive\Documents\ChatGPT\Budget App`
- **Writer worktree:** `C:\Users\jonat\AppData\Local\Temp\hearth-register-1-obligations`
- **Branch:** `codex/register-3-purpose`
- **Baseline SHA:** `f9958758547e8d2c99733a2f0f44294c003346d5`
- **Head SHA:** local Slice 3 commit reported in the coordinator handoff
- **PR or issue:** none; local implementation only
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none

## Household outcome

A confirmed contribution can retain a short explanation of what it was for, and the contribution register can read that explanation back without creating an earmarked balance or changing which obligation any cent funds.

## Budget delta (5)

`+2` — contribution provenance becomes easier to understand while the existing one-pool FIFO arithmetic remains unchanged.

## Engagement delta (3)

`0` — this slice adds no interface or interaction.

## Verified baseline

- Clean writer worktree at `origin/main@f9958758547e8d2c99733a2f0f44294c003346d5`.
- Register Slice 2 is merged on `main`; the current contribution register allocates carried cents and confirmed contributions FIFO and fails closed on an untied obligations fold.
- D-161 keeps the Household Fund a single append-only virtual shared operating subledger; D-173 keeps Shared as one pool.
- D-177 is already assigned to PGlite/outbox durability work in current canon. This slice will use a D-161/D-173 why-note instead of reusing that number from the supplied draft manual.
- The supplied build manual and UX packet are implementation references for this requested slice, not authority to push, merge, deploy, mutate hosted data, or override current repository canon.

## Scope

### In scope

- Add a required shaped `purpose` string to Household Fund events, defaulting legacy rows to `""`, trimmed and capped at 90 characters.
- Accept an optional contribution purpose and preserve it from proposal through confirmation.
- Read the purpose back on contribution register sources.
- Prove that purposes do not alter Fund projection bytes, FIFO segments, totals, shortfalls, or tie state.
- Add a source fence against branching on purpose.
- Keep purpose durable in command/sync provenance while excluding it from financial audit identity, accepted-books receipt comparisons, and month-rehearsal financial checkpoints; preserve legacy command identity when purpose is blank.
- Add a D-161/D-173 why-note.

### Out of scope

- Purpose-based sorting, matching, prioritisation, balances, pots, accounts, arithmetic, or obligation changes.
- Register slices 4–10, UI/CSS, commands beyond contribution provenance, schema, hosted rows, Auth/RLS, providers, secrets, Production, push, merge, or deployment.

## Acceptance evidence

- [x] Legacy events shape with `purpose: ""`; supplied values trim and cap at 90 characters.
- [x] Proposed purpose is present on the matching confirmed contribution.
- [x] Canonical registers with and without purposes are deeply equal after purpose strings are blanked.
- [x] Canonical segments, totals, shortfall, and tie state are unchanged.
- [x] `projectHouseholdFund` serializes identically with and without purposes.
- [x] Whole-household and Shared-scope financial audit hashes are identical with and without purposes.
- [x] Blank purpose preserves legacy command identity; non-empty purpose is bound to command identity.
- [x] Frozen month-rehearsal financial checkpoint hashes remain unchanged.
- [x] `contributionRegister.ts` reads purpose but never branches on it.
- [x] Focused tests, TypeScript, full Windows gate, diff checks, and independent money-safety review pass.

## Authority boundary

Jonathan asked for Register Slice 3. This authorizes a bounded local implementation and verification only. No push, PR, merge, deployment, schema/hosted-data mutation, provider action, secret change, or Production action is authorized.

## Evidence log

- Worksession opened from the exact clean baseline above.
- Initial focused register/Fund gate passed `33/33`; continuity/PGlite/sync follow-up passed `34/34`; mainline startup and month-rehearsal checks passed.
- The first paired-fixture draft exposed random fixture ids; the proof was corrected to compare exact twins differing only in contribution purposes. No product arithmetic changed.
- Independent money review found that raw Fund events would make purpose alter accepted-books identity. The final implementation excludes purpose from accepted-books and rehearsal financial facts, keeps it in shared command/sync provenance, preserves legacy identity for blank purpose, and binds a supplied purpose.
- Final focused golden/startup/mainline/register/Fund gate passed `44/44`; independent money and implementation reviewers both returned PASS with no P0/P1/P2 findings.
- Exact final `pnpm check:windows` passed: AI surface verified; `219` test files passed and `2` skipped; `1,498` tests passed and `3` skipped; TypeScript, the 387-module production Vite build, Hercules Pro UI build, and no-redirect guard passed.
- Existing PGlite browser-external/eval, dynamic-import/chunk-size, and React test `act(...)` warnings remained non-failing and outside this packet.
- `git diff --check` passed. Scope inspection found no UI, CSS, schema, hosted/Auth/RLS, provider, secret, Production, deployment, workbook, archive, key, or credential change.

## Handoff

Slice 3 is complete in the clean local writer worktree. A contribution purpose is durable shared provenance, is visible on contribution register sources, and cannot change allocation, projections, accepted-books identity, or frozen rehearsal checkpoints. No push, PR, merge, deployment, schema/hosted-data mutation, provider action, secret change, or Production action occurred. Next owner: Jonathan for review and separate push authorization.
