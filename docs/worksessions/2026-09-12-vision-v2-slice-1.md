# Hearth worksession — Vision v2 slice 1: names, the Fund tab, the adaptive +, the Fund pulse

- **Status:** OPEN — local branch, quick gate recorded below
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, presentation, pure projection)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `claude/vision-v2-slice-1`
- **Baseline SHA:** `ecf936ac` (main, Claude/kitty studio #447)
- **Head SHA:** see git log on the branch
- **PR or issue:** none yet — this session's git proxy had no push credential for the repository
- **Risk:** Medium (labels, navigation copy, an additive prop on the speed dial, a pure projector; no command or schema change)
- **Decision owner:** Jonathan — Vision v2 Decisions 1, 2, 3 accepted 2026-09-12
- **Environment impact:** none (Development only once deployed)

## Household outcome

Bianca and Jonathan open a product whose two spaces are named like places (My Money, Our Home) rather than accounting scopes, whose household truth tab carries the Fund's own name, and whose + says what the couple can do here instead of offering the same four money verbs everywhere. The Fund pulse exists as a tested pure projector ready for the Household Home recomposition (slice 2).

## Budget delta (5)

Neutral to positive. No posting path changed. Every money verb on the + still opens Add and ends at Final Confirm. The pulse reads accepted books and existing projections, never writes, and refuses confidence over stale, offline or untied evidence ("Checking" precedes every other state).

## Engagement delta (3)

Positive. The threshold names the space; the Fund tab uses the couple's name for their money; the + asks "What can we do?" in Our Home and leads with the destination's own verb (Decide together on Together, Plan a cost on Our Path, Record an expense on the Fund).

## Verified baseline

Facts (read from code at `ecf936ac`): `kitchenPrimaryNav` returned `home/ledger/plan/together` for household and `home/calendar/shift/ledger/plan/more` for personal; the household ledger tab was labelled "Our Money"; personal tabs were "Cal" and "Shift"; `FAB_ADD_ACTIONS` was a constant of four modes rendered identically in every view; `shapeLedgerNames` defaults were "Household Ledger" / "{Name}'s Personal Ledger"; no pulse or composed state existed.

Inference: the `five-boards-entry-app`, `app-startup-p1` and `month-rehearsal-mainline` suites are the Bianca mainline regressions AGENTS.md requires green for App/Add changes.

## Scope

### In scope

- `src/core/spaceNames.ts` — `spaceLabel()` and `fundDisplayName()`; presentation-only mapping of legacy default names.
- `src/core/fabActions.ts` — `fabActionsFor(view, tab)` and `fabClosedLabel(view)`.
- `src/core/fundPulse.ts` — `fundPulse()` and `deriveFundPulseInput()`.
- `src/FabSpeedDial.tsx` — optional `actions`, `closedLabel`, `onGo`; `FAB_ADD_ACTIONS` derived from the personal set.
- `src/App.tsx` — switcher labels, Fund tab label, Calendar/Work labels, adaptive + wiring.
- `src/styles.css` — `.tone-go` treatment for navigation-only verbs.
- Tests: `test/vision-v2-slice-1.test.ts` (new); label updates in `five-boards-entry-app`, `ledger-story-ui`, `app-startup-p1`.
- Docs: D-243, this worksession, `docs/briefs/HEARTH_FUTURE_VISION_V2.md`.

### Out of scope (later slices)

Status Centre replacing More (A2); Household Home recomposition (A3); presence strip UI (A4 UI); Sitdown consolidation (A6); Chapter objects (A7); Our Path recomposition (A8); lessons (A9); comfort controls (A10); Hercules mode label (A11). Stored ledger names are not rewritten. `HOUSEHOLD_FUND_NAME` is unchanged.

## Acceptance evidence

- [x] TypeScript `tsc --noEmit` clean.
- [x] `vision-v2-slice-1`, `fab-speed-dial`, `ledger-names`, `ledger-story-ui`, `ledger-story-dom` — 23 tests pass.
- [x] `app-startup-p1` (81), `five-boards-entry-app`, `month-rehearsal-mainline` — 98 tests pass serially (`--maxWorkers=1`).
- [x] Quick gate passed (Medium, 141 s, no breach) — recorded in the evidence log.
- [ ] Visual evidence at 320/390/720/~1100 in all three themes for the + menu with six household verbs (the dashed `.tone-go` rows) — not captured in this session (no browser evidence run).
- [ ] Jonathan's product review of the labels in the live Development kitchen.

## Plan

- [x] Names and Fund tab.
- [x] Adaptive + with navigation verbs.
- [x] Fund pulse projector + derivation.
- [ ] Slice 2: Household Home recomposition consuming `fundPulse()` (theme-neutral behind the Plan V2 flag family, then three themes).
- [ ] Slice 3: Status Centre replaces More; Personal bar becomes Home · Calendar · Work · Books · Plan with the + centred — Jonathan to choose the arrangement (see Remaining uncertainty).

## Evidence log

- `npx tsc --noEmit` → clean.
- `npx vitest run test/vision-v2-slice-1.test.ts test/fab-speed-dial.test.ts test/ledger-names.test.ts test/ledger-story-ui.test.ts test/ledger-story-dom.test.ts` → 5 files, 23 tests passed (7.4 s).
- `npx vitest run test/app-startup-p1.test.ts test/five-boards-entry-app.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1 --testTimeout=60000` → 3 files, 98 tests passed (67.9 s).
- `pnpm test -- --risk=medium --focus=test/vision-v2-slice-1.test.ts --focus-reason="…"` → **quick-gate-passed**, 141.4 s of the 300 s budget, no breach. Phases: diff-check, ai-surface, typescript (44.1 s), test-discovery, vitest-fast (15.3 s), vitest-serial (74.0 s, 6 files / 116 tests). 16 selected files including `app-startup-p1`, `five-boards-entry-app`, `proof-matrix`, `command-contract`, `command-runtime`, `plan-worlds`, `mobile-entry-sheet`, `swipe`. Base `ecf936ac…`, head `4630ef8b…`, working tree clean, change fingerprint `e9f83d2e…c432`. The gate flags `uiProofRequired: true` — browser evidence remains open (see Acceptance evidence).

## Decisions

- D-243 (this slice). Vision v2 Decisions 1, 2, 3 accepted by Jonathan 2026-09-12; Decision 2 carries his added constraint that the Personal bar keeps a centred +.
- Shift stays available on the household + (last) because shared income is often shift income; removing it would have changed behaviour the mainline regression relies on.
- Household + aria names for money verbs stay "Add expense / Add income / Add transfer / Add shift" (familiar to assistive users and tests); visible labels are verb-first.

## Remaining uncertainty

- Personal bar geometry: five destinations plus a centred + cannot be symmetric (3 | + | 2). Options for Jonathan: (a) 3 | + | 2 with the + visually centred over the bar, (b) fold Calendar into Home/Plan as the time layer to reach 2 | + | 2, (c) raise the + above the bar so five tabs sit evenly beneath it. Slice 3 waits on this.
- `fundPulse()` is not yet rendered anywhere; slice 2 is its first consumer. Its precedence and copy should be reviewed on real Development data.
- No browser evidence was captured for the six-row household dial at 320 px; row height and nowrap labels should be checked.
- This session could not push: the git proxy reported the repository is not in the session's authorized source set.

## Handoff

Local only on branch `claude/vision-v2-slice-1` — not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan (authorize push/PR and decide the Personal bar arrangement); Codex for the audit of the D-243 row and the slice-2 Household Home plan.
