# Hearth worksession — Shared Ledger story handoff

- **Status:** CLOSED — audit and Cursor packet ready; no UI implementation
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/shared-ledger-story-handoff`
- **Baseline SHA:** `341756d56bb465c5ada585b01be54561696a5a89`
- **Head SHA:** local documentation commit recorded in the final handoff
- **PR or issue:** none
- **Risk:** High review gate (ledger-mode privacy and financial presentation)
- **Decision owner:** Jonathan
- **Environment impact:** none; read-only live Development audit plus local documentation

## Household outcome

Define a Cursor-ready architecture in which Shared Ledger tells the household’s coordinated money story, Personal Ledger becomes a distinct private folio, desktop and iPad share one responsive story system, and iPhone keeps its current OfficePhone style and structure.

## Budget delta (5)

`+4` planned — mode-safe projections, clear Fund flow/authority, reconciliation freshness, and route-wide Personal denial make existing financial truth legible without adding money meaning.

## Engagement delta (3)

`+3` planned — the household gets a cooperative weekly/monthly narrative with paper infographics and actions instead of disconnected forms.

## Verified baseline

- `origin/main` and this clean worktree start at exact SHA `341756d56bb465c5ada585b01be54561696a5a89`.
- The original Budget App checkout was not used as the writer because unrelated work exists there.
- Household Fund D-161 is merged and live; D-162 provider activation remains separately gated.
- `App.tsx` builds the headline dashboard from `householdForView`, but passes `displayHousehold` to Office and Books; in Personal mode that value is the accepted `household`, not the same `visible` projection.
- Calendar and Shift receive `household` without a `view` prop. Plan is partially mode-aware. The top ledger switch is therefore more complete than the route contracts beneath it.
- Home renders the configured Fund as a generic card before `Office`; it does not participate in OfficeWide/OfficePhone storytelling.
- `HouseholdFundPanel` is financially truthful but form-first. `test/household-fund-ui.test.ts` currently fences the Fund out of the Office instrument model.
- `>=720px` chooses OfficeWide. Below 900px, the wide composition becomes one column. OfficePhone stays below 720px.

## Scope

### In scope

- Read-only audit of current Shared/Personal experience in code and the live kitchen.
- D-164 product protocol: ledger purpose first, device composition second.
- Cursor implementation packet with scope, non-scope, functions, route contracts, slices, acceptance, tests, and release boundaries.
- Additive decision and roadmap entries.

### Out of scope

- UI implementation, command changes, Fund formula changes, schema, provider, secrets, hosted mutation, Production data, push, PR, merge, or deployment.
- iPhone structural redesign.

## Acceptance evidence

- [x] Exact clean baseline recorded.
- [x] Current code paths inspected rather than inferred from the previous Fund handoff.
- [x] Shared and Personal live Home compared read-only.
- [x] Shared and Personal live Books compared read-only.
- [x] Desktop, portrait iPad, and iPhone shells audited.
- [x] Route-wide failure pattern and privacy risks separated from visual preferences.
- [x] Cursor packet includes two-layer protocol, pure function boundaries, page map, device fences, tests, and release boundaries.
- [x] Canon updated additively; no roadmap work removed.

## Evidence log

- 2026-08-28: created clean worktree `Budget App-shared-ledger-handoff` from fetched `origin/main@341756d56bb465c5ada585b01be54561696a5a89`.
- 2026-08-28: read current constitution, cloud continuity, AI operating/handoff rules, strategy, architecture, decisions through D-163, roadmap, UI theme, Office, desktop/mobile shell records, Audit Office, Accounts Floor, and D-161 handoff.
- 2026-08-28: live read-only Development audit. Shared and Personal Home retained the same Office objects, hierarchy, and actions while some scoped figures changed.
- 2026-08-28: live read-only Books comparison retained the same hero, account story, pane structure, net-worth/account figures, and Wallet in both modes.
- 2026-08-28: 768×1024 selected OfficeWide as intended, but the under-900 one-column collapse and active Hercules/preset overlays interrupted content. 1280×900 used two columns but the same overlay collision remained. 390×844 kept the strong OfficePhone grammar.
- 2026-08-28: no Confirm, local household write, provider call, secret, hosted row, schema, Production, deploy, or push action occurred.

## Decisions

- D-164: ledger purpose is Layer 1; device composition is Layer 2.
- Shared coordinates the household; Personal manages the member’s private position.
- Desktop and iPad share the same component system at `>=720px` with an intentional portrait-tablet composition.
- iPhone remains OfficePhone and receives audit/suggestions only unless a semantic correction is necessary and explicitly bounded.
- New shared “functions” are deterministic projectors, route contracts, and infographics over existing facts. No new money command is authorized.

## Remaining uncertainty

- A real Fund-configured, multi-week September household has not yet been visually audited; the packet includes synthetic fixtures for every necessary Fund state.
- The exact implementation branch/base may advance after this handoff; Cursor must fresh-fetch and record its own exact baseline.
- Whether Personal retains the current Office atmosphere or receives a separate folio root is an implementation/design decision only after mode-safe projectors land. It may not be settled by raw-household rendering.

## Verification

- `pnpm ai:verify` passed: 41 required files, documentation-only MCP, bounded roles, guards, and proof gate.
- The corrected Windows test run passed 1,071 tests and skipped 2. The sole failure was the pre-existing `test/hercules-rig.test.ts` walk-timing assertion; 10 focused reruns split 5 failures / 5 passes with no source changes, confirming nondeterministic baseline timing unrelated to this documentation packet.
- `test/api.test.ts` passed 8/8 when the bundled Python executable was exposed under the `python3` name expected by the test helper.
- `git diff --check` passed before final commit.

## Handoff

Next owner: Cursor, as the single implementation writer, using [`../briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md`](../briefs/CURSOR_SHARED_LEDGER_STORY_HANDOFF_2026-08-28.md). Claude reviews visual/iPad/iPhone/a11y behavior; an independent trust reviewer verifies scope and Fund meaning. Jonathan decides push, merge, deployment, provider, secrets, schema, and Production.
