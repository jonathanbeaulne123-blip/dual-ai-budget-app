# Hearth worksession — Claude Fund walk and widgets handoff

- **Status:** CLOSED — verified feature branch pushed; merge not requested
- **Opened:** 2026-09-03 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude implementation; Codex integration writer
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/fund-widgets-claude`
- **Claude baseline SHA:** `6f5dd56`
- **Integration baseline SHA:** `7dd1f96729fc9ec4fe6bb74a1daeacbf413b700a`
- **Independently reviewed code SHA:** `85c95c0b7f2bbe9d677c325419b84af9f328dfc1`
- **Risk:** High — Fund projection and Shared Home money presentation
- **Decision owner:** Jonathan
- **Environment impact:** source, tests, and documentation only; no schema, hosted data, secrets, Production data, merge, or deployment

## Household outcome

When the Household Fund is configured, Shared Home shows one coherent eight-plate Fund library. Every balance question reads the same month walk, settlements become visible, and Personal accounts and shift facts stay off Shared. A household without a Fund keeps the existing six-plate board.

## Dual Course deltas

- **Budget delta (5):** `+3` — the visible month walk ties Fund operating arithmetic, obligations, shortfall, and settlement presentation without creating a new posting path.
- **Engagement delta (3):** `+2` — the existing paper desk gains a more useful Fund story without replacing its interaction grammar.

## Scope

### In scope

- Integrate Claude's two supplied commits onto current `origin/main`.
- Preserve newer Till motion helpers and the current partner-personal test fence during conflict resolution.
- Verify the Fund walk, eight plates, TypeScript, AI surface, build, and repository test lanes.
- Push the reviewed branch when the gate is complete.

### Out of scope

- Merge, deployment, schema, providers, secrets, hosted rows, Production data, or new money authority.
- Later Fund rail, drawer, consequence, shape, streams, or account-detail slices described by the attached planning manuals.

## Acceptance evidence

- [x] Current `origin/main` fetched and recorded before integration.
- [x] Claude's two commits applied in order; newer main work preserved.
- [x] `fundWalk.shortfallCents` ties to the contribution register in focused proof.
- [x] A configured Fund gets eight unique plates; an unconfigured household keeps the legacy board.
- [x] All Personal accounts and shift facts remain absent from Shared Home.
- [x] Fund plate sources contain no money command call.
- [x] Focused Fund/desk tests, TypeScript, and AI-surface verification pass.
- [x] Serial books lane passes.
- [x] First independent review blockers repaired: sealed shortfall/tie, record-only motions, projected-mark semantics, Shared-only accounts, no Shared shift count, and rendered/announced verdicts.
- [x] Independent books, privacy, and UX re-reviews pass on the repaired exact candidate.
- [x] Branch pushed; remote SHA verification is recorded in the final handoff.

## Evidence log

- `pnpm exec vitest run test/fund-plates.test.ts test/fund-walk.test.ts test/desk-plates.test.ts` → 3 files, 42 tests passed.
- Post-review focused Fund/register/privacy/DOM proof → 9 files, 89 tests passed; the Fund walk now has 9 focused cases including hypothetical deferral.
- `pnpm exec tsc --noEmit` → passed.
- `pnpm ai:verify` → passed (41 required files, 2 Clerk fences).
- `pnpm test` → serial books lane passed 18 files / 154 tests with one benchmark skip; fast lane passed 230 files / 1,622 tests with two pre-existing failures.
- The same two failures reproduce on untouched `origin/main@7dd1f96`: `test/api.test.ts` cannot spawn `bash` in this Windows environment, and `test/weekly-document-stamp.test.ts` compares a fixed 2026-09-02 date against the current Toronto date.
- Independent books, privacy, and UX reviews blocked `a2bdf14`: open/Held proposals could cover the month before Confirm; the shortfall tie was fixture-only; projected and actual spark marks were visually identical; Shared admitted viewer-Personal accounts and counted Personal shifts; and the safety verdict was neither rendered nor announced. The integration repair addresses each issue without adding a command or changing the desk grammar.
- Independent books/trust, privacy, and UX/vibe/accessibility re-reviews all passed on exact code SHA `85c95c0b7f2bbe9d677c325419b84af9f328dfc1`.

## Remaining uncertainty

The full local gate is not wholly green because of the two reproduced baseline failures. Hosted CI may have `bash`, but the weekly-stamp test remains date-sensitive on 2026-09-03. Phone behavior is intentionally unchanged because these Fund widgets are desktop/tablet scope. No browser visual pass, PR check, merge, or live deployment is included in this push request.

## Handoff

Codex completed the integration and branch publication. Jonathan retains the PR, merge, and release decisions.
