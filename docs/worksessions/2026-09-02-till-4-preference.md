# Hearth worksession — Till Slice 4 landing preference

- **Status:** CLOSED; MERGED #306; DEVELOPMENT KITCHEN PUBLISHED; LIVE VERIFIED
- **Opened:** 2026-09-02 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/till-4-preference`
- **Baseline SHA:** `08e3a4b306533518405cdb866f13e71550447624`
- **Implementation SHA:** `d031c6c877d15185333ec9a93d1f3943a9d4c91c`
- **PR or issue:** [#306](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/306)
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** Development kitchen code only; Production continuity remains off

## Household outcome

Each member owns their default Hearth landing surface. The configured Fund custodian calmly defaults to the Till and everyone else to the desk, but either person may reverse their own choice instantly. The Till remains a default, never a permission tier, and `see everything` remains a peek back to the full desk.

## Budget delta (5)

`+1`: no amount, Fund fact, journal line, command authority, or accepted-books rule changes; the preference remains outside Shared continuity.

## Engagement delta (3)

`+2`: each person can choose the opening surface that fits how they use Hearth without assigning the other person's experience.

## Verified baseline

- Fresh `origin/main@08e3a4b306533518405cdb866f13e71550447624` in an isolated clean worktree.
- Till Slice 3 is merged as `300235628885d9f21b1680089174301aa3665141`, recorded as D-199, and is an ancestor of the baseline.
- The packet is dated planning input. Current code confirms `PersonalEnvelope` is the member-Personal continuity record; therefore `src/core/sync.ts` is a correctness-required expansion beyond the packet's file list.
- Baseline focused proof passed: `test/till.test.ts` + `test/visibility.test.ts`, 25/25.
- The first baseline attempt installed the lockfile then failed because Node was absent from shell `PATH`; the bundled workspace Node/pnpm plus Git Unix tools corrected the environment.

## Scope

### In scope

- `landingSurface: "desk" | "till"` member preference and calm defaults.
- Self-only `setLandingSurface` command with the exact cross-member refusal.
- Personal-envelope split, shape, assembly, overlay, and merge behavior.
- Proof that the existing `see everything` link does not write the preference.
- D-200 and structured handoff records.

### Out of scope

- A settings control, automatic App startup routing, or any visual/mobile redesign.
- Changes to Till, Swipe, Ask, Fund arithmetic, command rights, journal/PGlite schema, hosted schema/rows, secrets, deployment, or Production.
- Push, PR, merge, or kitchen publication.

## Acceptance evidence

- [x] Custodian defaults to Till; other members default to desk without an assigned field.
- [x] Self-set and reversal succeed; omitted-actor and cross-set calls refuse exactly and mutate nothing.
- [x] Preference is member-Personal and absent from Shared sync.
- [x] `see everything` is a peek and does not mutate preference.
- [x] Focused tests, Windows-native full `pnpm check`, TypeScript/build, and diff hygiene pass.
- [x] Independent complete-diff verification finds no P0-P2 blocker.

## Plan

- [x] Reconcile packets with current canon and code.
- [x] Establish clean exact baseline and dependency ancestry.
- [x] Implement the smallest coherent core + Personal continuity change.
- [x] Run final post-fix full verification.
- [x] Close the worksession and return a local-only handoff.

## Evidence log

- Baseline: `pnpm exec vitest run test/till.test.ts test/visibility.test.ts --maxWorkers=1` -> 2 files, 25 tests passed.
- Focused final: `pnpm exec vitest run test/surface-preference.test.ts test/sync-integrity.test.ts test/visibility.test.ts test/till.test.ts --maxWorkers=1` -> 4 files, 39 tests passed; TypeScript passed.
- Expanded: 8 core/continuity/storage files -> 99 tests passed; TypeScript passed.
- Final post-fix `pnpm check:windows`: AI surface 41 required files; 1,745 tests passed and three intentionally skipped; TypeScript and a production build of 418 transformed modules passed.
- Independent verifier initially found an optional-actor bypass and order-dependent equal-clock merge. Both were fixed with regressions; read-only re-verification passed 39/39 with no remaining findings.
- Exact-head PR/push CI and Cloudflare checks passed; `main@4992a0c` post-merge CI `33698860263` and Cloudflare `33698859862` passed.
- Worker `558f1e53-a269-4db1-8d0e-2c8062dbc6c3` serves live HTTP 200, `Cache-Control: no-store`, and `/assets/index-JsW2hVnK.js` contains `landingSurface` plus `landingSurfaceUpdatedAt`.

## Decisions

- Risk is Medium: nonfinancial member metadata crosses core command and Personal continuity code, but does not alter money or hosted schema.
- Require the trusted acting member separately in `createdBy`; never derive actor authority from the preference target. Omitted and cross-member actors receive the same exact self-ownership refusal.
- Break equal preference-clock ties by the validated surface value so convergence is deterministic in either merge order.
- Expand into `sync.ts` because storing the preference on Shared `members` would contradict the packet's member-Personal contract.

## Remaining uncertainty

- No UI act is included, as the packet names only the core preference and explicitly separates `see everything` from the preference write.

## Handoff

Slice 4 is complete, merged through #306 as `main@4992a0caa02a6e3ce725229b0d0a42ef69deada9`, and verified live in the Development kitchen. The preference is self-owned, Personal-only, deterministic under convergence, and nonfinancial. No hosted mutation or Production action occurred.
