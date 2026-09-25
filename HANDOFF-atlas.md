# HANDOFF — Track A: the Tool Atlas and the Record dial

Branch `claude/tool-atlas-atlas` (worktree `wt-atlas`), baseline `main@4e0234a3`. The work is local and committed, and it has not been pushed. Brief: `docs/briefs/tool-atlas-2026-09-25.md` §3.2, §3.3, §3.4 data, §4.2. Risk: **Medium**. No money meaning changed. No new command was added. Nothing in this track posts: every write still goes through the App's existing `run` and its existing commands.

## What I built

- **`src/core/toolAtlas.ts`** (new) is the one tool list. It has these parts:
  - `TOOL_ATLAS`: 52 rows, each with `id`, `label`, `subtitle`, `group`, `host`, `outcome`, `synonyms` (every §3.4 word plus the retired words), `target`, `spaces`, `score` and `covers` (the T-ids it absorbs).
  - `TOOL_GROUPS`, in §3.2 order: the Record chip row, the six jobs, Places, Settings, then the Hercules footer. `toolsInGroup(group, space?)` returns a group's rows (Record keeps the dial's order; every other group is ordered by score). `atlasHeadings()` returns the headings.
  - `searchAtlas(q, { householdNames, space, limit })`, which ranks name above synonym above the household's own words, returns up to 8 results with their group, and returns both meanings of an ambiguous word.
  - `householdAtlasNames(household, { space, memberId })`, which lists bills, accounts, Kitty Banks and members.
  - `RETIRED_WORDS`, the list of words §3.2 retires.

  `target` is one of: `record(mode)`, `house(target, object?)` (dispatched with `openHouseObject`, including the `fund` alias), `books(pane)` (`booksPaneRequest`), `tab`, `place` (a `HarbourPlaceId`) or `action`. The file imports types only.
- **`src/core/fabActions.ts`** and **`src/FabSpeedDial.tsx`** (plus the new `src/fab-speed-dial.css`) now hold five verbs: Purchase, Shift, Income, Bill paid, Move money.
  - `fabActionsFor(view, { memberHasJob })` hides Shift when the member has no job. A legacy tab string is still accepted and ignored.
  - `fabClosedLabel` returns "Record".
  - The `go` kind is deleted. `onGo` is still accepted, marked `@deprecated`, and ignored.
  - The verb list is `role="group"` ("What to record"). The arrow keys and Home/End move through it, Tab and Escape return focus to the bubble, and a tap outside closes it.
  - Rows are ≥48 px and right-aligned. The `mirror` prop provides "Record on the left".
  - Icons are 24-grid stroke SVGs with `<title>`.
  - While the dial is open it carries `data-camera-deadzone`. While an Add sheet is open it is `inert`.
- **Bill paid and the ledger line** (`src/addSlideshow.ts`, `src/AddSlideshow.tsx`, `src/DuePreviewSheet.tsx`, new `src/add-atlas.css`):
  - Mode `"bill"` (`AddFlowMode`) has two slides. The first shows due bills as slips (name, amount, date and pot); bills that are not due yet are listed but not offered. The second is a named Confirm, for example "Record Hydro, $142.00, paid from Prepare", which re-reads the review when pressed.
  - The first slide of every flow shows "Into: Ours / Mine" as a radio group named "Whose money", defaulted per D1 by `defaultAddLedger`.
  - The confirm summary now includes Date and Into rows. The Post button's accessible name is built by `addConfirmName`, for example "Post $12.40 purchase to Everyday, in Ours".
  - The duplicate prompt is now a `role="alertdialog"` named "This looks like a purchase you already recorded". It lists the matched fields in words, puts initial focus on "Don't record it", and treats Escape as "don't record". The secondary button changed from "Add anyway" to "Record it anyway".
- **`src/core/terms.ts`**:
  - `COPY_TABLE_FILES` extends the Sit-down fence to `.ts` copy.
  - "Sit-down" is now "Sitdown" in `helpDesk.ts`, `naming.ts` and `officeLayout.ts`. The chip routing accepts both spellings.
  - `RETIRED_WORDS` is re-exported.
  - "the kitchen table" is now allowed (it is the deck's word).

## Wiring App.tsx needs (the integrator)

1. **Both dials** (`harbourBarFab` at App.tsx:7036 and `<FabSpeedDial>` at App.tsx:9260):
   - Pass `actions={fabActionsFor(view,{memberHasJob:household.workJobs.some(j=>j.active&&j.memberId===actorId)})}` and `onBillPaid={openBillPaid}`.
   - Drop `onGo`.
   - The harbour track must add `onBillPaid?` to `CompassFab` and forward it in `BarFab`. Until that happens, Bill paid stays hidden and the dial shows four verbs.
   - `test/harbour-one-bar.test.ts:194` pins the App source text, so update it together with this change.
2. **`openBillPaid`**: call `openAddFor(null,"expense")`, then set a new `billFlow` flag, then `setAddSlide(0)`. Render `<AddSlideshow mode={billFlow?"bill":mode} …>` and clear the flag in `closeAdd` and after acceptance. App's `mode` stays `AddMode`, because widening it breaks `postEntry`'s `type` (App.tsx:6841).
3. **New `<AddSlideshow>` props**: `view={view}`, `memberId={actorId}` and `onLedgerChange={(next)=>{ if(next!==view) /* switch space */ }}`. When the flow opens, if `defaultAddLedger(mode,view)!==view` (Shift opened from Ours), either switch the space or pass `ledger`.
4. **`onPost={(p)=>{…}}`**:
   - If `p?.ledger && p.ledger!==view`, refuse with a notice rather than post into the wrong books.
   - If `p?.kind==="bill"`, run the body of App.tsx:8723 with `p.review`: re-check `dueOccurrenceReview(current,p.review.request)`'s basis, then call `postOneRecurrence(current,p.recurrenceId,p.review.request.today,{createdBy:actorId,dueReview:p.review.request})`.
   - Otherwise call `submit()`.
   - After acceptance, show `addPostedStatus({mode,form,household,accounts:pickerAccounts,ledger})` in a `role="status"`.
5. **All tools, the Desk drawer and the host panels** (other tracks) should read `TOOL_GROUPS`, `toolsInGroup`, `searchAtlas` and `householdAtlasNames` rather than `TARGET_NAMES` and `quickSheetGroups`.

## Tests and checks

- **Typecheck:** `tsc --noEmit` exits 0, run twice on the final tree.
- **New tests:**
  - `tool-atlas.test.ts` (13 tests): every name and synonym is in the top 3, every §3.4 word is in its group, Hydro is found as a household word, the group order is right, ids are unique, and toolAtlas imports nothing that writes (A12).
  - `atlas-add-flow.test.ts` (11 tests).
  - `atlas-vocabulary-fence.test.ts` (4 tests). Its `PENDING` list is a ratchet: 43 files that other tracks own still carry retired words, a new hit fails the test, and a row that has already been cleaned also fails, so each track deletes its own rows.
  - `rendered-strings.ts`, a helper shared with `terms.test.ts`.
- **Updated tests:** `fab-speed-dial`, `vision-v2-slice-1`, `navigation-one-route`, `harbour-compass-ui`, `harbour-one-bar`, `time-machine-ui`, `app-startup-p1` (dial names only), `five-boards-entry-app`, `add-slideshow-ui`, `mobile-entry-sheet`, and `hearthside-actual-app-v2-browser` (selectors only; not run).
- **Results:**
  - A 17-file focused run passed 134 of 134.
  - `app-startup-p1` (the Bianca regression) passed 83 of 83.
  - `month-rehearsal-mainline` passed.
  - `five-boards-entry-app` has one failure, "quick samples 51 ≤ 48", which also fails on `main` at baseline.
- **Pre-existing failures:**
  - `ledger-story-ui` ("Kitty Banks" text) fails on baseline too.
  - `terms.test` was already red on `main`. I fixed it by rewording three strings (TheatreProjector, ExperienceBankEntry, QueenHome) and by teaching the helper to skip `import()` paths and `hearth:` storage keys.
- **Not run:** the full gate, and browser evidence at 320, 390, 720 and 1100 px.

## Three dressings

- `src/fab-speed-dial.css` has three dressings on a solid paper column: Classic (chalk edge), Taylor (vellum `#fff8f4` with a washi corner) and Newfoundland (white frame, Figtree 800 caps). It also has fallbacks for `forced-colors`, `prefers-contrast`, `data-quiet` and `prefers-reduced-transparency`, and a two-tone focus ring drawn with `outline`.
- `src/add-atlas.css` gives the bill slips and the ledger line the same treatment for all three dressings.

## Deviations and uncertainty

- **`FabAddMode` stays at four modes, and a new `FabVerbMode` adds `"bill"`.** Putting "bill" into `FabAddMode` itself breaks App.tsx:7036 through Compass's `CompassFab.onPick`, and I may not edit either file.
- **The ledger line sits on the first slide, not as an extra slide,** so the purchase path in A1b gains no tap. It appears only when `view` is passed.
- **Two table choices of mine:**
  - Shifts (T06) sits in Books, because §3.2 gives it no group.
  - The weekly Sitdown targets the Calendar.
- **Switching the space in the middle of an Add flow may pause the draft** (`pausedAddScope`). The integrator must verify this.
- **Not built here:**
  - A11: the label pill that shows until a person has used the bubble five times.
  - A30: `aria-invalid` on the amount and Retry after a failed post (CadPad and KitchenNotice are not my files).
  - The Paper trail rename (HouseBooks, booksModel and InteriorDesk are not my files).
  - Hercules's "Sit-down?" chips in `herculesPage.ts` and `herculesTalk.ts`. These are planner inputs and are not fenced.
- **Commit trailers** use this session's attribution (Claude Opus 5.5), not the brief's "Claude Fable 5.1".

## Deltas

- **Budget (5):** Bill paid is one tap from the dial and posts through the reviewed `postOneRecurrence`. Every flow now names its ledger. The confirm step names the amount and destination. The duplicate prompt defaults to the safe choice.
- **Engagement (3):** one vocabulary, and search that finds every old word.
