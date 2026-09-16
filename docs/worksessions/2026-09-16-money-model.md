# Hearth worksession — the money model (Plan Studio v3, money track)

- **Status:** OPEN (implemented locally; waiting on trust review)
- **Opened:** 2026-09-16 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (money track of the Plan Studio v3 build)
- **Repository:** `dual-ai-budget-app`
- **Branch:** `claude/plan-v3-money` (worktree `wt-money`)
- **Baseline SHA:** `6160fb03`
- **Head SHA:** see `git log --oneline main..claude/plan-v3-money`
- **PR or issue:** none. Not pushed.
- **Risk:** High (money meaning, a synced collection, a command stamp, Hercules context)
- **Decision owner:** Jonathan. D-269 – D-273 in `docs/DECISIONS.md`.
- **Environment impact:** none. Fictional fixtures only; flag `VITE_FUND_MODEL_V2` defaults off.

## Household outcome

Every line has exactly one fund. Bills, subscriptions, loan payments and card interest live in **Prepare**, which fills first. **Protect** is only the buffer the couple agreed. Goals, investing, RRSP and tip-outs live in **Build**. The Queen's big number, **Now**, is what is left, and it reconciles to the cent. Categories sit under twelve fixed umbrellas. Chapters are calendar months that close only at the Sitdown.

## Budget delta (5)

+3. One resolver files every line. Bills get a home that fills before anything else. Goal-bank money is never shown twice or counted toward bills. What the Fund still owes back is its own line. The parts always add up to the King.

## Engagement delta (3)

+1. A 12-tile category grid. Words on the Kitty Nest, the Queen and the Plan that match the numbers. A gentle "still open from August" instead of a silent month end.

## Verified baseline

- The reviewed plan (rev. 2), the review's two rounds, the Choices log, `umbrella-categories.md` and the brief were read first.
- `main@6160fb03`: `test/onboarding-categories.test.ts` has 2 failing tests (a Chapter 9 merge through the command boundary). They fail the same way on a clean tree, and they fail the same way on this branch.
- Inference: the hosted `categories` table isn't read after the V2 cutover. No SQL migration is needed. This hasn't been verified against a hosted database.

## Scope

### In scope (built, in commit order)

1. **Rules and collection** (`src/core/fundRules.ts`):
   - The 14 umbrellas.
   - v1 and v2 name rules.
   - `fundFor` and `fundResolver`.
   - `allocateFunds`.
   - The `fundModelRows` collection, wired through sync, parity, identity, runtime, the continuity log, the legacy materializer (full-snapshot fallback) and Hercules context.
   - The `fundModelVersion` stamp (`src/ledgerSync/fundModelStamp.ts`), plus authority, client and worker hello.
   - Commands (`src/core/fundModelCommands.ts`): `migrateFundModel`, `migrateMyFundModel`, `setFundOverride`, `setCategoryHome`, and the division and refill state machines.
2. **The nest reads v2.** `projectKittyNest` resolves through `fundResolver` and splits with `allocateFunds` (pinned kitty, owed-back, fill order, refills). The nest carries `mode` and `allocation`.
3. **The umbrella lock** covers `addCategory`, `requireExpenseNamed`, `ensureWorkPostingCategory`, onboarding proposals and merges, Hercules add-category choices, and Hercules Pro write options.
4. **`src/core/fundModel.ts`**, the documented read API (below).
5. **Words and writers:**
   - `planGuide` (bills become Prepare obligations).
   - The lens workbench.
   - Legacy budget adoption.
   - Drift: shortfall on Prepare obligations, plus "buffer below agreed".
   - The rehearsal disruption.
   - `PLAN_LENS_COPY_V2` / `planLensCopy` / `planLensOrder`, and `PLAN_LESSONS_V2`.
   - Kitty Nest meanings and choices, and untyped goals shown as the nest files them.
   - The Queen's words and her lower door.
   - Hercules tool text.
6. **Chapters as months:**
   - `intendedMonth`, `chapterReminder` (at most one nudge a day), `chapterMonths`, `defaultNextChapter`, and `closeChapterAtSitdown`.
   - The `chapterVersion` stamp.
   - The drift rule `chapter-still-open`.
   - The Chapter moment's reminder line.
   - Sitdown close-and-open, for money-model households.
7. **Category UI:**
   - `AddCategoryForm` gets the 12-tile grid and a three-fund choice.
   - `OnboardingCategories` lists the umbrellas.
   - Household activity filters by umbrella and "our own".
8. **Adopt on patch.** `src/fundModelBoot.ts` handles the snapshot, the household step and the personal step. The App effect runs the boot step once per session, and the App shows a reload banner.
9. **The island.** The Home label never grows a cottage on its own. A household vet bill is named on the weather (accepted, M1).
10. **Notice and hue:** `fundModelNotice` and `umbrellaHueForCategory`.

### Out of scope, or stopped with a reason

- **Revert (`revertFundModel`)** isn't built. The receipt in the marker has every change needed for an exact inverse. The review (M5) and Q-D need Jonathan's call before a Production undo is worth building. Development can restore the local snapshot.
- **Slice 9** (cellar income jars, contribution jars, missing subscriptions) belongs to the cellar track. The published pay figure needs its privacy review and a per-member switch (R2-M5, **Q-E defaulted: shown**). It also needs a model-context exclusion.
- **Slice 11** (world pieces per umbrella) waits on the journey plan review.
- **A fourth Queen door.** Q3 (which figure Prepare gets, and where the Knight lives) is open, so the drawing is unchanged. Only the words and the cellar's bank key moved.
- **The demo suite still writes Protect bill lines** (R2-L1). The plan guard therefore refuses to migrate a demo habitat generated before N+1. The server-side `regenerateDemoSuite` has no client flag, so it was left as-is. Regenerate it after deciding. The real-SQLite worker fixture was updated.
- **UI for division, refill, Needs a home and "check these"** belongs to the Studio track (`src/plan-v3/**`). It reads the selectors below.

## `src/core/fundModel.ts` API

```ts
fundSnapshot(household, { memberId, view, today }): FundSnapshot
// { mode, kingCents, now, owedBackCents, undividedContributions,
//   prepare: { amountCents, targetCents, coveredThrough, shortOn?, bills },
//   protect: { amountCents, targetCents, refills },
//   build:   { amountCents, targetCents, goals },
//   everyday:{ amountCents }, flow: FlowItem[], needsHome, checks }
undividedContributions(h, { view, today }); divisionFor(h, eventId); proposedDivision(h, eventId, { memberId, today })
openRefills(h, monthKey); cardPaymentChecks(h, { memberId, view }); needsHomeCategories(h)
umbrellaChoices(h); categoryFilterOptions(h, { memberId, view }); umbrellaHueForCategory(h, categoryId)
fundModelNotice(h, { memberId })
// commands (fundModelCommands.ts): proposeFundDivision / agreeFundDivision / declineFundDivision,
// proposeProtectRefill / agreeProtectRefill / declineProtectRefill, withdrawFundProposal,
// setFundOverride, setCategoryHome, migrateFundModel, migrateMyFundModel
// chapters.ts: chapterReminder, chapterMonths, closeChapterAtSitdown, defaultNextChapter
```

## Acceptance evidence

- [x] v1 byte-equal to the old `nestCategoryFor` on a 200-name corpus. v2 never defaults to Protect. The sorting-test key (#24, #25, #30) holds.
- [x] Precedence runs override > goal purchase > design > type > subscription > category default > bill > name. Personal overrides apply only to their owner.
- [x] Conservation fuzz (500 cases): `owedBack + Σ amounts === King`. The fill order holds.
- [x] Rent, a loan and hydro sit in Prepare, and each jar fills from its own fund. In a short month the goal money stays in Build (Q-A), and no leaf appears twice. The audit hash doesn't change.
- [x] Migration:
  - Builds the 14 locked rows and re-homes every seed child.
  - Retires Life and Debt; they aren't deleted.
  - The card child still posts, and posted rows are untouched.
  - Needs a home stays posting-safe, then retires.
  - Is idempotent.
  - The plan guard refuses when bills are still planned in Protect.
  - No personal id reaches the shared envelope, the marker or Hercules. The personal step writes the Personal envelope only.
- [x] Stamp matrix:
  - Before migration, N writes are accepted and N's migration is refused. N+1 migrates.
  - After migration, N is refused, a stampless (rollback) command is refused, and N+1 is accepted.
  - A racing second migration is refused. An unknown stamp is invalid.
  - The detector prompts N.
- [x] Group lock covers new groups, Moving money, Protect default, income and fund proposals.
- [x] Words move with the numbers. None of the new copy says "moved" or "transferred".
- [x] Guided draft and adoption write Prepare obligations. Drift reports "protected-shortfall" on Prepare, plus "buffer-below-agreed".
- [x] Division needs both partners and never posts. Refill is custodian then partner, is capped at the buffer, and writes no Fund event.
- [x] Chapters:
  - Carry their month. Legacy rows read as the month they opened.
  - Never auto-close. The reminder nudges at most once a day.
  - Close and open in one command, and Rituals retire only on the chosen outcome.
  - Skipped months read "none" or "still-open".
  - The month survives sync.
  - Drift flags an open Chapter once the household is sorted.
  - The stamp guard works.
- [x] Category UI in jsdom: 12 tiles, three funds, the proposed fund, the saved umbrella and fund.
- [x] Bianca gates: `app-startup-p1` and `month-rehearsal-mainline` are green.
- [ ] Visual evidence at 320/390/720/1100 in Classic, Taylor and Newfoundland for the category grid, the reload banner and the Chapter reminder. **Not captured in this session**; the Studio track's evidence run should include them.
- [ ] Codex trust review (stamp, collection, migration, Hercules context).
- [ ] Jonathan's answers to the defaulted questions (listed in D-269 – D-273).

## Evidence log

- `npx tsc --noEmit -p .` is clean at every commit (about 2 minutes on this machine).
- Focused suites:
  - `test/fund-model.test.ts` 15
  - `test/fund-model-migration.test.ts` 13
  - `test/fund-model-selectors.test.ts` 10
  - `test/fund-model-words.test.ts` 6
  - `test/fund-model-chapters.test.ts` 5
  - `test/fund-model-category-ui.test.ts` 2
- Regression sets, all passing except the pre-existing onboarding pair:
  - Every `plan-*`, `queen*`, `kitty*`, `path-*` and `hercules-*` suite: 48 files, 477 tests.
  - Ledger sync, Chapters, Our Path, sitdown, `app-startup-p1` and `month-rehearsal-mainline`: 11 files, 191 tests.
  - `ledger-import-parity`, `category-*`, `queen-model`, `queen-world`: all passing.
  - `onboarding-categories`: 2 failures, identical on `main`.
- Quick gate (High): see the handoff in `docs/AI_HANDOFF.md` for the recorded result.

## Decisions

D-269 – D-273. Every defaulted answer is marked "defaulted, confirm":

- Q-A: goal money is never counted toward bills.
- Q-B: Now drops only for Fund-paid spending.
- Q-C: the open Chapter stays open; the new Chapter belongs to the Sitdown's month.
- Q-D: a local snapshot, no in-app undo.
- Q-E: pay is shown by default (cellar track).
- Q-F: untyped goals are frozen.
- Q-G: card-payment bills are flagged, never converted.
- Q4: a refill posts nothing.
- Reminders: at most one nudge a day.
- Precedence: subscription and bill steps sit around the category default.
- F4 ("Looks right" only advances) is the Studio track's to implement.
- Missing-subscription grace (3 days) belongs to the cellar track.

## Remaining uncertainty

- The stamp makes every pre-branch client fail closed once a household is sorted, or once any Chapter carries a month (the latter as soon as this branch opens a Chapter). That is intended, but it means the release must reach both phones before either sorts.
- `closeChapterAtSitdown` is used only for money-model households. v1 households keep the old two-step close.
- The Hercules context now carries the bare household marker and household overrides. The trust review should confirm this is acceptable.
- The legacy incremental path always falls back to the full snapshot for fund-model commands. That is correct but heavier.
- No screen reader or real phone was used.

## Handoff

Next owner: **Codex** (trust review of D-269 – D-273), then **Jonathan** (answer the defaulted questions and approve turning the flag on in Development). After that comes the Studio track: rebase `src/plan-v3/model.ts` onto `fundModel.ts`. State: local branch only. Not pushed, not a PR, not merged, not deployed, not live-verified.
