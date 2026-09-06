# Hearth worksession — existing-books onboarding adoption

- **Status:** RELEASE CANDIDATE — PR #355 open; checks pending
- **Opened:** 2026-09-06 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `codex/onboarding-existing-books-adoption`
- **Baseline SHA:** `d26f1254007e009a390c28c7f8aca6ecb920e58d`
- **Implementation SHA:** `a7626d6fa1ea292487a058b1ebbf047a95b1748e`; this evidence/status closure follows
- **PR or issue:** [#355](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/355)
- **Risk:** High
- **Decision owner:** Jonathan
- **Environment impact:** Development and Production application code; local Development offer metadata exercised; no hosted or Production data/settings touched

## Household outcome

Pre-onboarding households with accepted books receive the same guided-setup invitation as a new household. Once both people activate setup, each person's device short-circuits only chapters already proved by canonical facts; the four live conversation/finale chapters remain personal actions. Completing that path restores the ordinary four-week rehearsal.

## Budget delta (5)

`+3`: restores a trustworthy route from existing books through setup to the D-183 rehearsal while preserving every financial fact and Final Confirm boundary.

## Engagement delta (3)

`+2`: removes twelve chapters of needless re-entry and gives both Home and More the same honest locked/reachable rehearsal path.

## Verified baseline

- Fresh branch from `origin/main@d26f1254007e009a390c28c7f8aca6ecb920e58d`.
- A throwaway regression test on that untouched baseline proved `catalogHousehold("development")` has accepted books, no onboarding record, and fails `householdNeedsCharterFounding`; source inspection proved the only App offer effect returned on that predicate.
- The reproduction file was removed before implementation.

## Scope

### In scope

- Offer absent/inactive onboarding after the accepted local journal is ready.
- Adopt only accepted, pre-activation evidence into the acting member's Personal progress.
- Preserve live Chapters 1, 2, 8, and 12 and exact evidence keys.
- Unify the Home/More month-rehearsal gate and show the locked explanation in both contexts.
- Replace the D-183 fake completed fixture with a household that completes through real commands.

### Out of scope

- Money writers, journal or budget formulas, migrations/schema, hosted rows, Auth/RLS, providers/models, secrets, Production settings/data, deployment, and every other onboarding-audit finding.

## Acceptance evidence

- [x] Existing-books App entry validates first and commits one offer.
- [x] Rich existing books adopt Chapters 3–7 and 9–11, then walk 1 → 2 → 8 → 12.
- [x] An empty household walks all twelve chapters.
- [x] Signed Charter evidence adopts Chapter 3 while absent recurrences keep Chapter 7 live.
- [x] Adopted rows carry exact canonical probe keys and no acknowledgement; post-activation evidence is not adopted.
- [x] Adoption leaves the financial audit hash and onboarding completion fields unchanged.
- [x] Real completion unlocks month rehearsal; incomplete setup shows one shared locked component on Home and More.
- [x] D-183's startup fixture no longer injects a fake completed record.
- [x] Final High quick gate, TypeScript, production build, AI verification, and local browser proof.

## Plan

- [x] Reproduce on untouched current main.
- [x] Implement the smallest member-scoped evidence adoption and validated startup offer.
- [x] Extract the duplicate rehearsal access gate.
- [x] Add acceptance and regression tests.
- [x] Record D-228 and this evidence.
- [x] Complete the required verification and hand off without push, merge, or deploy.

## Evidence log

- Final focused lifecycle, entry, rehearsal UI, and rehearsal mainline run: 24/24 passed, including evidence cutoff, exact keys, empty and rich chapter order, financial hash stability, real completion, and both gate surfaces.
- `test/app-startup-p1.test.ts`: 26/26 passed after automatic offer commits were made non-disruptive to an open Add flow and an unrelated schema-repair fixture received a real offered record for async isolation.
- `test/month-rehearsal-mainline.test.ts`, invitation, progress, and evidence suites passed in the adjacent run.
- High quick gate passed in 107.401 seconds, within its 300-second budget, at fingerprint `c7a96af653e4d3f5209f17b34470d0ef50c4da812a809e88dea22ceddf165f88`: diff/AI-surface/TypeScript passed, then 80/80 fast and 33/33 serial assertions across eight selected files. The gate preceded implementation commit `a7626d6` and this evidence/status closure; quick-gate evidence is not release evidence.
- `pnpm exec tsc --noEmit` passed separately. The bundled runtime has no `npx` executable, so the equivalent repository command was used and the quick gate/build independently reran TypeScript.
- `pnpm build` passed with 483 Vite modules plus Hercules Pro UI. Existing PGlite browser externalization/eval and large-chunk messages remained non-failing warnings.
- `pnpm ai:verify` passed: 48 required files, 2 Clerk fences, docs-only MCP, bounded roles, guards, and proof gate.
- Local in-app Chromium used the existing Development household on the exact candidate. After local-journal validation, Hearth showed exactly one `Start together` action and one locked rehearsal explainer. At 390×844 the explainer remained visible with no horizontal overflow; keyboard Tab reached `Start together`; the console had zero errors. This application use intentionally persisted the local Development onboarding offer only. It did not post money, mutate hosted rows, or touch Production.

## Decisions

- Reuse `NEW_MEMBER_CATCH_UP_CHAPTER_IDS` and add only the existing Ready finale constant to the always-live set.
- Evidence is eligible only when its canonical `observedAt` is no later than this run's `startedAt`; later setup actions remain ordinary live progress.
- Each device adopts only its signed-in member's Personal progress. It never writes the partner's acknowledgement or progress.
- Show the locked rehearsal card on both Home and More while setup is incomplete. Rendering nothing made one context look broken and concealed the recovery path.

## Remaining uncertainty

- This is local synthetic/application-path evidence, not an authenticated two-device or hosted-live run.
- The browser proof covered the offer/locked state, not two humans completing all four live chapters; real completion is command/component-tested.
- Quick-gate evidence is not exhaustive or release evidence.

## Handoff

Implementation commit `a7626d6` is pushed in the single PR #355. Jonathan authorized push and merge; wait for required checks and merge only the unchanged reviewed head. No manual deployment, schema application, hosted-data mutation, or Production change is authorized or performed.
