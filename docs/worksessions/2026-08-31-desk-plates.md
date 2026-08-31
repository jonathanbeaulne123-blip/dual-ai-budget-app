# Hearth worksession — Desk plates on Shared and Personal Home

- **Status:** OPEN
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (landing Claude's unbuilt third slice onto current `main`)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `cursor/desk-plates-shared-home-021f`
- **Baseline SHA:** `7d4e19361a455112d2532fa8f81271b26a4db349` (`origin/main`)
- **Head SHA:** (in progress)
- **PR or issue:** (draft after first commit)
- **Risk:** High (presentation of Home mosaic; no new Fund math)
- **Decision owner:** Jonathan
- **Environment impact:** none — fictional Development demo for proof; no Production, hosted mutation, schema, or secrets

## Household outcome

The six Home mosaic tiles on each wide floor become desk plates: a kicker in household words, a verdict as a sentence, one of six shared drawing primitives, and a footing that keeps the figure honest. Single click puts that plate on the stage in place of the Month Spread. Double-click and the cabinet handle open the existing instrument. Close returns to the Spread on Shared Home. Nothing here posts, settles, or moves a cent.

## Budget delta (5)

`+3` — the mosaic answers household questions from existing selectors instead of repeating the Spread at lower resolution.

## Engagement delta (3)

`+3` — the laptop open-to desk becomes a 2×3 instrument strip without restyling seals or the Kitty Banks shelf.

## If they conflicted

Books win. Plates never invent a drawing, never label Fund free-to-spend as "safe to spend", never say "kitty" on Shared, and never write `goal.savedCents`. The cabinet handle stays wherever double-click exists.

## Verified baseline

Facts:

- Month Spread (commits 1–2 of Claude's packet) is already on `main` via #259. `src/core/monthSpread.ts`, `src/MonthSpread.tsx`, and `test/month-spread.test.ts` are present.
- Desk-plate files from the packet are absent: no `plates.ts`, `deskPlates.ts`, `DeskPlates.tsx`, `desk-plates.css`, or `test/desk-plates.test.ts`.
- Wide Shared Home mosaic is still `now` / `attention` / `change` plus three instruments via `paperHomeMosaic`.
- Packet patch `~/Downloads/month-spread.patch` is not in this environment. Rebuild to spec on current `main`.
- F-4 already drops the Kitty shelf under the stage below 1200px so 1100px does not inner-scroll the Course.

Inferences:

- Applying Claude's three-commit patch onto `cursor/shared-ledger-story-aef7` would replay shipped work onto a stale base. Rebuild slice 3 only.
- Keep F-4 (banks below <1200). Give the mosaic the packet's 460px so a 2×3 plate grid fits. At ≥1200 use the packet's `1.15fr | 1.75fr | 0.72fr`.

## Scope

### In scope

- Six plate primitives in `src/core/plates.ts`.
- Twelve plate models in `src/core/deskPlates.ts` over existing selectors.
- `DeskPlates.tsx` + `desk-plates.css` (no hex literals).
- OfficeWide mosaic wiring: click / double-click / handle; Spread remains Shared default.
- Focused tests in `test/desk-plates.test.ts`.
- `is-shared-home` mosaic column width for the 2×3 grid.

### Out of scope

- New Fund event kinds, envelopes, schema, or `goal.savedCents` writes.
- Restyling wax seals or Kitty Banks words/styling.
- Giving the Course a second Kitty scale.
- Reopening F-2/F-3.
- iPhone `OfficePhone` mosaic.
- Merge, deploy, Production, hosted mutation, secrets.

## Acceptance evidence

- [ ] 19 focused plate tests green
- [ ] `pnpm check` green on this HEAD
- [ ] Browser: single-click, double-click, handle, keyboard; 320/390/720/1100
- [ ] Independent UX auditor
- [ ] Draft PR targeting `main`; not merged, not deployed, not live

## Plan

- [x] Record baseline from `origin/main`.
- [ ] Implement primitives, models, UI, CSS, tests.
- [ ] Wire OfficeWide; keep Spread, seals, Kitty.
- [ ] Focused tests, then `pnpm check`.
- [ ] Draft PR, then browser proof.
- [ ] UX auditor + handoff.

## Evidence log

- 2026-08-31: branched `cursor/desk-plates-shared-home-021f` from `origin/main@7d4e193`.

## Decisions

- Rebuild commit 3 onto current `main`; do not `git am` the three-commit packet.
- Keep F-4 banks-below-<1200 so the Course stays readable at 1100px. Mosaic becomes 460px for the 2×3 plate grid. This is the only layout expansion; explained in the handoff.
- Mosaic tiles `now` / `attention` / `change` leave Shared Home because they *are* the Spread's three registers. `SharedLedgerStory.tsx` stays in the tree for existing tests; OfficeWide Home no longer opens those panels from the mosaic.

## Remaining uncertainty

- Forced-colors and reduced-motion still need a live DevTools pass.
- Jonathan still owns whether Kitty banks should ever *hold* rolled surplus (F-1 product).

## Handoff

In progress. Local branch only until the first commit is pushed.
