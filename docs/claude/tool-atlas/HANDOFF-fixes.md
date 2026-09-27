# HANDOFF: Tool Atlas fix pass (branch `claude/tool-atlas`)

- **Checkout:** `/home/claude/jonathanbeaulne123-blip/dual-ai-budget-app`.
- **Commits:** `449e5635..HEAD`, 16 commits after the reviewed head. Local only: nothing was pushed, merged or deployed.
- **Input:** `REVIEW-tool-atlas.md` (17 findings), `HANDOFF-integration.md` and `HANDOFF-wave2b.md` (both now in this folder).
- **Risk:** **High**. This pass changes the Add flow's ledger control, Bill paid's ledger, the Books month-close door and a directory move of the ritual.
- **Out of scope:** no new command, no schema, sync, RLS or hosted change. Every write still goes through an existing captured command after its Final Confirm.
- **No capture:** per Jonathan, there was no browser capture, dev server or Playwright run.

## Working tree, as found

| Commit | What |
|---|---|
| `d3527007` | The two browser-probe edits (`test/browser/tool-atlas/acceptance.test.ts`, `probe.ts`). They type-check. The spec was not run. |
| `f89760bb` | `docs/evidence/tool-atlas/`, committed as the run left it, with `INDEX.md` saying plainly that it is **PARTIAL** and listing the 59 files by name. |
| `04982c5b` | `HANDOFF-integration.md` and `HANDOFF-wave2b.md` moved here. |

**The capture run was still running.** `scripts/capture-tool-atlas-evidence.py` was active, with Chromium under Playwright, and was still writing screenshots into the checkout. This pass stopped it (the python process and its browser) because Jonathan asked to finish without capture. One more screenshot, `desk-390-taylor.png`, had landed by then and is in the committed set.

A Vite dev server on `127.0.0.1:5211`, started 2026-09-25, is **still running**. It was left alone: it does not write, and it was not started here.

## Findings

| # | Sev | Status | Commit | What was done / why not |
|---|---|---|---|---|
| 1 | Major | **Fixed** | `53efeb33` | Bill paid defaults to **Ours in both spaces** (`defaultAddLedger`, `BILL_LEDGER`). From Mine, `openRecordFlow("bill")` switches to Ours first, the way Shift switches to Mine. The first slide reads "Into: Ours · bills are shared", with no radios and no Mine option. The confirm row reads the same. The status line names Ours only. A bill flow shown while Mine is open offers no bill. Tests in `atlas-add-flow`. **Jonathan to confirm:** this narrows his D1 wording ("Bill paid defaults to the space the card shows") to what the books can post. D-302 says so. |
| 2 | Major | **Fixed** | `dbc3b95b` | The "Save to: Shared / Personal / Both" chips are gone. **Both is kept as a third option on the Into line** (Ours · Mine · Both), because it is D-030's accepted `both` visibility and is in real use: seeded rows, presets, the folio's "shared choices" and shared shifts in the income jars. Ours / Mine is the open space; changing it switches the space. Both keeps the space and posts `both`, read back as "Ours and Mine" on the line, the confirm row and the button's name. `submit()` posts `visibilityForInto(addIntoFor(view, form.visibility))`, so a stale draft visibility cannot contradict the line, and `onAddPost` refuses a payload whose Into differs. A planned expense states its own visibility on the line, with no choice. |
| 3 | Major | **Fixed** | `8c229424`, `e002dc61` | Books has no `closeBooksMonth`. The Close pack's "Close {month}" is now the `CampfireDoor` ("The month closes at the Campfire, at Settle, with both of you"). It opens through `openHouseObject("campfire-ritual","settle")`, which switches Mine to Ours. Mine's "Close month" seal is now "Close pack" and leads to the same door. **`reopenBooksMonth` stays in Books**, because a forgotten receipt needs it. It sits inside the same Close pack behind its own review: a "Reopen a closed month" disclosure that says it is one person's act, then a named "Reopen {month}" or "Keep it closed". It is still single-actor at the command. New `test/books-close-door.test.ts` covers both spaces, the reopen review, and a fence: outside core and the sync registry, only the ritual's Settle names `closeBooksMonth`. D-302's D3 sentence was rewritten to match HEAD. |
| 4 | Major | **Fixed** | `e8cf5731` | The App passes `onArrange` only when `view==="household"`. `HarbourWorld` also drops it in Mine, for both the HUD action and the decorator's commit. Asserted in `mine-layer-ui`. |
| 5 | Major | **Not fixed** | `f89760bb` | Jonathan said to finish without capture. The committed evidence is partial and says so. Still owed: four widths × three dressings, keyboard/focus and reduced-motion passes, the browser suites, and A2/A8/A10/A18/A21/A28/A29. |
| 6 | Minor | **Fixed** | `250f8dd5`, `761d019b` | The own-files test was retitled. New tests name every captured command reached through the reused controls: `SitDownLeftover`, `ChapterTaskControls` and `ChapterPanel › RitualForm`. They prove from source that the only money writer in that reach is `executeSitDownMoves`: it is called once, inside the button named "Confirm moves of {amount}", through `send` → `onCommand`, which Settle wires to `relay`, the App's run. They also drive the ritual to show that press is the one money command run receives. |
| 7 | Minor | **Fixed** | `defbe02c` | The long-press guard now applies only to the bubble itself. With a hosted dial that means `.fab` only, never a `[data-fab-action]` row. The new test holds a verb for 750 ms and expects it to record; it fails on the old Bubble. |
| 8 | Minor | **Fixed** | `bea07a43` | The return-record effect captures the identity at setup, and its cleanup and `pagehide` save under that slot. `rememberWorld(slot)` takes the slot it is given. The scene effect's unmount save still reads the ref, because a flip does not re-run it. There is a static test in `mine-layer-ui`; no WebGL run. |
| 9 | Minor | Not fixed | — | This was outside the list this pass was given. `pendingRecord` / `campfire` can linger when `changeHouseView` does not change the view, and a restored draft still silently wins over a carried amount. |
| 10 | Minor | Not fixed | — | Not in scope. A canvas tap within 44 px of a bubble still does nothing. The fix is a runtime gesture change that needs a device check. |
| 11 | Minor | **Fixed** | `56a422c0` | The guard is restored on `RecordBubble`, which now hosts the dial in both editions. Record tells the App it shut when it leaves while open, or when `fab` is withdrawn. The "has shut" test is back in `harbour-compass-ui` and fails without the guard. The 44 px assertion is back as a stylesheet assertion, because jsdom cannot lay out: every `--glass-size` is at least 44 px, the bubbles and the Record circle take it as their minimum, and the verbs are 48 px. |
| 12 | Minor | Not fixed | — | Not in scope. `outcomeRefusal(undefined)` still counts as accepted. |
| 13 | Minor | Not fixed | — | Not in scope. `atlasHouseholdWords` still reads `displayHousehold`. |
| 14 | Minor | Not fixed | — | Not in scope. ⌘K / Ctrl+K still opens All tools over another modal. |
| 15 | Minor | **Fixed** | `65cd2d59` | The five committed track handoffs moved here. Two source comments now name the new paths. |
| 16 | Minor | Not fixed | — | Not in scope. The vocabulary ratchet still counts per file and word. |
| 17 | Note | Not fixed | — | This pass added a few lines to App.tsx. No `useToolAtlasWiring()` extraction. |

### Review §2 item 1: the ritual's location (`761d019b`)

The shape fix was done. `src/harbour/campfire/ritual/` is now `src/campfire/` (nine files, relative paths only, no behaviour change). The `src/harbour/campfire/` scene files stay where they were.

- **`test/harbour-source-fences.test.ts`** has no exemption. It newly forbids `src/harbour` from importing:
  - any name exported as `captureCommand(…)` from any core module. The `core/chapters` selectors stay readable.
  - the App-level writers: `ChapterTaskControls`, `ChapterPanel`, `SitDownGuide`, `PlanStudio`, `Books`, `AddSlideshow`, and the ritual itself.
- **`test/campfire-source-fence.test.ts`** is the ritual's own fence. It allows only:
  - imports of react, core, `useDialog`, its own files and the three reused controls;
  - no kitchen, ledger, sync, storage, network or harbour;
  - exactly ten captured commands, each called on the household that run hands it;
  - every write through `useCampfireWrite` → `onCommand`.
- **D-302 trust-review item 1** now describes this shape.

## Needs Jonathan's decision: hard-lock residuals (review §3, verbatim)

> If Jonathan wants "the books cannot close while one of you is away" to be true, these remain at HEAD:
> 1. **Books › Close pack** (`Books.tsx:697`): one member, either space (Ours: Tools & audit › Close pack; Mine: "Close month" seal at `:359`). There is no chair and no Campfire. *This one must go before merge (finding 3).*
> 2. **`closeBooksMonth` is single-actor at the command.** Any command-capable client (another build, a replayed outbox, a dev console) can close alone. A hard lock needs a command-level both-present guard. One shape: `closeBooksMonth` requires a fresh `CAMPFIRE-<month>` session in which every `requiredPlanMemberIds` member has a turn, checked in the command and on the server replay. That is a schema-free rule change, but it is money-meaning, so it needs a decision entry plus a Codex review.
> 3. **The chairs gate is asynchronous.** Someone who sat on the 3rd satisfies it for a close on the 28th by the other person alone. That is "both have come to the fire this month", not "both present".
> 4. **`reopenBooksMonth`** (`Books.tsx:749`) is single-actor and ungated.
> 5. **plan-v3 `ChapterClose`** (`plan-v3/CheckIn.tsx:270/274`, flag-off `VITE_PLAN_STUDIO_V3`) still reaches `closeChapter`. The command's consent holds for two members. For a one-member household the command accepts an audience of one, and only the Campfire UI refuses ("one person alone never seals").
> 6. **`SitDownGuide` shim** (the flags-off Plan page and `widgets/Postcard.tsx`) still carries `SitDownLeftover` with `legacyRun`. It moves money, but it does not close.

Status at HEAD after this pass:

| # | Status |
|---|---|
| 1 | Done (finding 3). |
| 4 | Now gated in the UI behind the Close pack and its own named review. It is still single-actor at the command. |
| 2, 3, 5, 6 | Unchanged. |

## Verification

**Typecheck.** `pnpm typecheck` exits 0 with 0 errors at `65cd2d59`. It was also run after each code commit.

**The requested suites.** This run was at `761d019b`: 84 files covering `app-startup-p1`, `month-rehearsal-mainline`, `campfire-*`, `harbour-*`, `glass-*`, `wave2b-*`, `terms`, `atlas-*`, `mine-*`, `books-*`, `desk-*`, `fab*`, `tool-atlas`, `ledger-story-ui`, `add-slideshow-ui`, `mobile-entry-sheet`, `personal-books-privacy`, `five-boards-entry-app`, `copy-budget`, `kitchen` and `hearthside-chapter*` (the browser suite was excluded).

- **Result:** 1147 passed and 27 failed. The 27 failures are exactly `HANDOFF-wave2b.md`'s pre-existing list:
  - `harbour-reduced-motion`: 12
  - `harbour-open-world`: 3
  - `harbour-skate-model`: 2
  - `harbour-skate-presence`: 1
  - `harbour-hercules`: 2
  - `desk-plates`: 2
  - `copy-budget`: 2
  - `kitchen`: 1
  - `ledger-story-ui`: 1
  - `five-boards-entry-app`: 1
- **The Bianca regression** (`app-startup-p1` and `month-rehearsal-mainline`) passed.
- **Copy budget.** The `copy-budget` offenders at HEAD are a subset of those at baseline.

**A wider sweep.** There are 38 more suites that import App or a touched module. They ran 320 passed and 12 failed:

| Suite | Failures |
|---|---|
| `onboarding-invitation` | 4 |
| `shift-glance` | 2 |
| `month-rehearsal-ui` | 2 |
| `app-kitchen-boot` | 1 |
| `first-entry` | 1 |
| `hercules-pro-permissions-ui` | 1 |
| `shared-money-membership` | 1 |

**Comparison with the baseline.** All 17 files that fail at HEAD were re-run in `../wt-baseline` (`4e0234a3`). The same 39 test names fail there, with none failing only at HEAD. **No new failures.**

**Re-runs after the last two commits.** `e002dc61` shortened one sentence; `books-close-door` passed after it and `copy-budget` showed only its 2 known failures. `65cd2d59` changed comments only.

**Not run:** the full gate, any browser or visual pass, and any screen reader.

## Uncertainty

- **Finding 1 changes Jonathan's D1 wording for Bill paid.** It is recorded in D-302 as "Jonathan to confirm".
- **Finding 2 kept Both as a third option.** Jonathan may prefer to retire `both` from Add altogether.
- **Findings 8 and 11 are proven only by static or jsdom tests.** Neither was seen on a device.
- **The Books door in Mine shows `campfireState`'s household line** (Chapter and seal status). It is shared data, not a partner's private rows.

## Deltas

**Budget delta (5): +2.**
- Every Record now posts to exactly the ledger its one Into line names.
- Bill paid can no longer claim Mine.
- The month closes only at the Campfire, and reopening is a named, reviewed act.

**Engagement delta (3): +0.**
- There is one fewer control on the Add flow.
- A slow press on a Record verb now works.

**Data and environment.** Fictional catalog, demo and test data only. No Development or Production data was touched.

**Next owner:**
1. Jonathan decides on the §3 hard lock, finding 1's D1 narrowing, and Both on the Into line.
2. Codex runs the trust review (D-302 items 1–4, with item 1 reshaped).
3. The browser and visual pass is still owed (finding 5), then the remaining minors (9, 10, 12, 13, 14, 16).
