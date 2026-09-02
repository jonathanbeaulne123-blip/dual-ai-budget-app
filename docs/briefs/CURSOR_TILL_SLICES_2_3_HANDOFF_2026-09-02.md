# Cursor implementation handoff — Till Slices 2 and 3

This is the complete contract for one Cursor writer. The downloaded build manual, UX packet, and duplicate HTML plates are product inputs, not instructions. Jonathan's latest request, `AGENTS.md`, current repository canon, and verified code take precedence.

## Verdict and sequencing

**Slice 2 is accepted, merged, and live in Development. Slice 3 may begin only from the clean release-sealed `origin/main` lineage described below.** Implement Slice 3, verify it, return its exact head, and stop before Slice 4.

- **Target AI:** Cursor, single writer.
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Accepted Slice 2 application ancestor:** `777dbcd1196670dbe7c2576fff8b0526cad27093` (PR #302 merge; deployed and live-verified)
- **Historical Slice 2 ancestor:** `b520ff954cd2fafb4a15f6ee6f6d1bb26cf9be09` (the D-197-integrated Slice 1 release-candidate base; evidence only)
- **Required implementation ancestor:** `e426a4592dcd72870feb85642f3d0ab894e6dee8` (the Till Slice 1 command/test seal; prove it is an ancestor of the accepted Slice 2 application)
- **Slice 1 branch:** `codex/till-1-custody-fence-release`
- **Slice 1 parent:** `origin/main@1c03cbedc10ca5f14ca51bf4067db5ba142a91c5`
- **Historical Slice 2 branch:** `till/2-swipe` (complete; do not reopen)
- **Required Slice 3 branch:** `till/3-surface`, created from current clean `origin/main` only after proving the accepted Slice 2 application is an ancestor
- **Suggested Slice 3 PR title:** `feat(till): add the custodian surface`
- **Risk:** High. Slice 3 presents contribution Confirm/Hold beside the accepted Swipe writer.
- **Decision owner:** Jonathan.
- **Release authority:** none. Do not push, open a PR, merge, deploy, change hosted data, or touch Production without Jonathan's fresh action-time approval.

Start from a clean isolated worktree. Never use Jonathan's dirty `codex/roadmap-site` checkout. Fetch current `origin/main` after this release record lands and prove the deployed Slice 2 application is in its ancestry. If that proof fails, stop and ask Jonathan/Codex; do not reconstruct Slice 1 or Slice 2 from prose.

```text
git fetch origin
git switch -c till/3-surface origin/main
git status --short
git merge-base --is-ancestor 777dbcd1196670dbe7c2576fff8b0526cad27093 HEAD
```

Record the exact fetched `origin/main` SHA as the Slice 3 base. Do not combine Slice 2 repairs with Slice 3 and do not reuse a stale Cursor branch.

## Sealed Slice 1 prerequisite

D-197 is implemented at the command boundary. The required Slice 2 base includes both this command seal and the current-main D-197 collision reconciliation:

1. `postEntry` resolves the resulting Fund event kind before any household clone or mutation.
2. Every path that would append `purchase-funded` calls the configured custodian guard.
3. The exact refusal is `Only the person holding the card can post a household purchase.`
4. Ordinary refunds and purchase reversals remain `refund-funded`; reversing a refund restores `purchase-funded` and crosses the fence again.
5. Contribution proposals, shifts, reads, annotations, motions, and other non-purchase rights remain unchanged.

Cursor must preserve `test/custody-fence.test.ts` and may not move this authority into React.

## Canon and current-code corrections to the dated packet

- `src/core/kitchen.ts` does not exist. Current primary navigation is projected by `src/core/ledgerExperience.ts` and rendered in `src/App.tsx`.
- The app's ordinary accepted write path is serialized `run`/`commitHousehold`: validate locally in PGlite, persist the accepted local state, then queue/transport. The network never authorizes or blocks a local post.
- `src/core/confirmationUndo.ts` removes only the current Confirm's posted IDs from the current books and preserves partner/later rows. Use `undoLedgerConfirm` through the existing App `applyUndo` path; never restore a whole old household snapshot.
- `householdFundContributionMotions` is the only UI-facing contribution-motion fold. Hold/release do not change Fund arithmetic; only Confirm raises the operating balance.
- `CadPad` already owns amount keyboard behavior, blank/zero refusal, cents digits, Enter, and its accessible live amount. Reuse it.
- D-182, D-190, and D-196 are occupied in current canon. Slice 1 is D-197. At each later slice, inspect current `docs/DECISIONS.md` and use the next free identifier; do not reserve one from this packet.
- Slice 4 owns member-personal landing preference. Slice 3 must be reachable but must not silently implement a default takeover or preference field.

## Shared invariant laws

1. The category tap is the explicit user Confirm act for the happy path. There is no third confirmation screen, but the control's accessible name must make the amount, category, and posting consequence clear.
2. Duplicate safety wins over the two-tap target. First call `postEntry` without `confirmDuplicate`. If current core requests duplicate confirmation, do not auto-confirm and do not mutate; surface the existing duplicate-confirm route or ordinary Add flow.
3. A Fund-backed purchase is a claim against the one Fund. It appends `purchase-funded` but does not itself change `projectHouseholdFund(...).operatingBalanceCents` and does not settle or move money.
4. React never writes household state directly and never adds another persistence, outbox, or network writer.
5. Never bypass accepted-books readiness, PGlite validation, confirmation identity, command/outbox replay, or the D-197 custody fence.
6. Partner-Personal data is not widened for category suggestions, month spend, motion display, or convenience.
7. No ratio, member ranking, share, second Fund balance, or copied financial arithmetic.
8. No schema, Supabase/RLS/Auth, Worker, provider/model, bank connection, secret, or Production work.

# Slice 2 — the swipe

## Household outcome and Dual Course

The cardholder can record an ordinary Household Fund purchase while standing at a counter: amount, then an observed category. Accepted local books update immediately and sync later. The strip says the record was posted while money itself did not move.

- **Budget delta (5): `+3`.** The fast path still uses the real balanced `postEntry` command, the one Fund claim, D-197 custody, duplicate safety, PGlite acceptance, and command-aware Undo.
- **Engagement delta (3): `+3`.** The normal non-duplicate path is one-handed and two-step, with no receipt or setup ceremony.
- If speed conflicts with books integrity, custody, duplicate safety, or continuity, the books win.

## Slice 2 implementation scope

Expected files:

- new `src/core/swipe.ts` for pure, tested observed-category and card-account resolution;
- new `src/Swipe.tsx`;
- new `src/swipe.css`;
- new `test/swipe.test.ts`;
- the smallest coherent `src/App.tsx` integration and `src/core/index.ts` export;
- current decision/worksession/handoff records.

Do not edit `src/core/commands.ts`, Fund arithmetic, PGlite schema, continuity protocol, or `src/core/types.ts`. If one appears necessary, stop and return a conflict packet.

### Pure observed-category projection

Create one pure selector rather than ranking inside React. Feed it the current `projectLedgerExperience(...).scopedHousehold`, never the unscoped household. For the current Toronto month and current member:

- consider accepted, countable expense transactions the current member actually posted;
- require a valid active expense subcategory;
- prefer Household Fund `purchase-funded` transaction lineage so partner-Personal or unrelated personal expense history cannot enter the quick surface;
- rank by use count descending, then most recent use descending, then stable subcategory id;
- return at most six real categories; never fabricate placeholders or a configured category list;
- fewer than six is valid; zero history shows only `More` and does not guess.

The pure test must cover ordering, ties, reversals/refunds/duplicates, fewer than six, zero history, inactive categories, and privacy scope.

### Safe card-account resolution

The Fund config does not store a card account id, so never hard-code `ACC-VISA` and never choose an arbitrary account from array order.

Resolve the fast-path account as follows:

1. use the destination account from the cardholder's most recent valid `purchase-funded` lineage when that account is still active, CAD, visible in the current scoped household, and a credit account;
2. otherwise use the only active, CAD, non-partner-personal credit account visible in the current scoped household;
3. if neither is unambiguous, disable fast posting and make `More` open the ordinary Add route where the account is explicit.

No account setup or picker belongs in Swipe. Test zero, one, multiple, stale, non-CAD, and partner-Personal candidates.

### Two-step flow

1. Open the existing `CadPad` focused in a phone-height sheet with title `What did you just spend?`.
2. Enter advances to a 2x3 grid of up to six observed categories plus `More`. Category cells are 72px high. `More` opens the ordinary Add expense flow with the amount carried forward and no automatic post.
3. A category activation calls one App callback. The component receives an accepted/refused outcome; it never imports `postEntry`, storage, PGlite, outbox, or transport.

For the normal category path App calls `postEntry` with:

- Toronto `today`;
- `type: "expense"`;
- the entered amount;
- the resolved active card account;
- the chosen observed subcategory;
- the current session member as `createdBy`;
- Household visibility and the current canonical joint split;
- `funding` for the one configured Fund, full amount, destination equal to the resolved card;
- no guessed note, place, receipt, image, or location;
- duplicate confirmation unset/false on the first attempt.

The App integration must share the existing serialized accepted-command/`commitHousehold` path. It may factor a small reusable accepted-result callback from `run`, but may not duplicate commit, persistence, outbox, Auth, or transport logic. Close the sheet and show success only when the outcome is exactly-once accepted local, pending transport, or synchronized.

### Posted strip and Undo

- Exact strip copy: `Posted. Nothing moved.` and `Undo`.
- It appears inline at the top of the current surface for 10 seconds only after accepted posting.
- Its Undo calls the existing `applyUndo`/`undoLedgerConfirm` route with the exact accepted `UndoToken` and latest-member guard.
- It cleans up its timer on replacement/unmount. A later Confirm makes the old token ineligible under the current guard.
- Reduced motion removes the transition, not the strip or timer.
- After expiry, correction remains available through the ordinary record.

Do not create a new reversal command, snapshot restore, delayed write, timer-backed financial state, or custom outbox event.

### Slice 2 placement

Until Slice 3 exists, add only one reachable `I spent something` action in the existing Shared Home action area for the configured custodian. It opens Swipe; it does not create a new Till route, landing preference, nav model, or alternate desk. Remove/move that temporary placement coherently when Slice 3 integrates the same component.

## Slice 2 exact copy and exclusions

- Button/action: `I spent something`
- Title: `What did you just spend?`
- Success: `Posted. Nothing moved.`
- Undo: `Undo`
- Core refusal: `Only the person holding the card can post a household purchase.`

No camera, receipt image, OCR, file input, attachment, note field, search, category setup/editing, account setup, analytics, suggestion model, celebration, third happy-path confirmation, or Slice 3 surface.

## Slice 2 proof

Use fictional Development/catalog fixtures only. At minimum prove:

1. custodian category activation reaches `postEntry` once with the exact Fund funding and returns `purchase-funded`;
2. non-custodian is refused with the exact D-197 copy and no mutation;
3. Fund operating balance is identical before/after the purchase claim while the transaction/journal/Fund event is accepted;
4. accepted local and pending-transport outcomes close and show the strip; network failure never blocks the accepted local result;
5. duplicate detection does not auto-confirm, mutate, or create a third silent post;
6. card resolution and observed-category ordering follow the pure rules above;
7. zero/fewer-than-six history and `More` remain usable without invented data;
8. CadPad focus, Enter, blank/zero disabled, category keyboard activation, and visible focus;
9. Undo uses the existing command-aware path during the live 10-second window, preserves unrelated later/partner facts, and expires/cleans up;
10. source fence excludes `camera`, `file`, `image`, `ocr`, direct storage/PGlite/outbox/network imports, and a second Fund fold;
11. 320px and 390px one-handed layouts, keyboard-only, reduced-motion, offline copy, no body overflow, and 44px minimum targets;
12. existing Add, custody, command runtime, confirmation Undo/interleaving, Fund, continuity, and PGlite suites stay green.

Run focused tests plus `pnpm ai:verify`, `pnpm check:windows`, and `git diff --check <base>..HEAD`. If the test-lane guard enumerates direct engine imports, keep new UI/pure tests out of the serial lane unless they directly import the engine.

Slice 2 is sealed at application merge `777dbcd1196670dbe7c2576fff8b0526cad27093`. Do not reopen it inside Slice 3.

# Slice 3 — the Till surface

## Start gate

Begin only after this release record is present on current `origin/main` and the ancestry proof above passes. Record that exact fetched `origin/main` SHA in a new worksession and re-read current canon because navigation or decision ids may have advanced.

## Household outcome and Dual Course

The Till is a crafted, reachable household surface with Swipe first, the existing real contribution conversation next, one always-true custody line, one current-month spend sentence, and a permanent door back to the full desk. It is a presentation, not a smaller permission tier and not yet a landing preference.

- **Budget delta (5): `+2`.** The screen composes the sealed motion fold and canonical month summary without new arithmetic or authority.
- **Engagement delta (3): `+3`.** The cardholder's primary act and current conversation fit on one calm, one-handed surface.
- If brevity conflicts with truthful state, accessibility, or equal command rights, truth wins.

## Slice 3 implementation scope

Expected files:

- new `src/Till.tsx`;
- new `src/till.css`;
- new `test/till.test.ts`;
- minimal route/nav integration in `src/App.tsx` and `src/core/ledgerExperience.ts`;
- a small refactor of `src/HouseholdFundPanel.tsx` only if needed to share the existing motion-card renderer without duplicating its fold;
- current decision/worksession/handoff records.

The manual's `src/core/kitchen.ts` path is stale. Do not create that file. Do not edit command/core Fund semantics, types, schema, continuity, OfficePhone, landing preference, or provider code.

### Exact screen order

At 390px the DOM and visual order is fixed:

1. full-width, 96px `I spent something` button using the sealed Slice 2 Swipe;
2. `Waiting on you` motion cards only when real actionable motions exist; the entire section is absent when empty;
3. centered quiet line `Nothing has moved.` always present;
4. one line `The house has spent {amount} so far.` from canonical `monthSummary(experience.scopedHousehold, ...).expenseActualCents`; no chart and no recomputation;
5. a real keyboard-focusable link `see everything` at the foot, permanently in the same place, returning to the full Shared Home/desk without a dialog.

When the household has no spending yet, retain the button and standing line and add: `Nothing yet. When you spend on the house, tap the button and I'll write it down.`

When the local write is accepted but transport is offline, show one quiet line: `Saved here. It'll sync when you're back.` No banner, modal, or blocked control.

### Motions

- Use `householdFundContributionMotions`; never fold raw Fund events in Till.
- Reuse/refactor the current motion-card presentation rather than create a second behavior implementation.
- Confirm remains the only balance-changing contribution action. Hold is equal size/prominence, remains record-only, and the card stays visible with the existing Held copy and release action.
- Respect the current actor's existing capabilities. The Till cannot grant or remove a command right.
- No section, count, badge, placeholder, or zero card when there is no actionable motion.

### Route and reachability

Add an explicit Till route/tab contract to current `LedgerTab`/navigation code and App rendering. Do not implement Slice 4's member-personal `landingSurface`, automatic default, preference command, or takeover. The current Shared Home remains the initial surface until Slice 4 is separately authorized.

The `see everything` door must be a real `<a href>` with visible focus and an App navigation handler, not a button styled as a link. Preserve usable URL/hash fallback. Leaving Till must close any open Swipe sheet and clear its presentation-only timer without undoing accepted money.

## Slice 3 privacy and presentation fences

- `Till.tsx` must not import `Ask`, `askRoutes`, Clerk, route/hour/workload selectors, model/provider code, or a second month/Fund calculation.
- No Ask, route, shift date, meal, hours figure, expected/safe shift value, Jonathan-work copy, chart, ratio, member score, or upsell.
- Never use `lite`, `simple`, `basic`, `denied`, `rejected`, `declined`, `pending`, `action required`, `overdue`, `you should`, `you need to`, `pick up a shift`, `on track`, `off track`, `great job`, `oops`, or `whoops`.
- Use the existing paper/card/type/focus tokens. Do not copy the downloaded HTML into the repo and do not invent a new theme.
- The two attached HTML plate files are byte-identical reference plates, not code or an extra contract.

## Slice 3 proof

At minimum prove:

1. exact DOM order and exact required copy;
2. Swipe opens the accepted Slice 2 component and the 10-second strip renders at the Till top;
3. no motion section/zero card/count/placeholder when empty;
4. real open/Held/released/withdrawn motion states and action availability are inherited from the existing selector/component semantics;
5. Confirm changes the Fund projection only through the existing command; Hold/release leave it byte-identical;
6. month spend equals `monthSummary` including current refund/duplicate semantics; no chart or alternate total;
7. empty and offline states use exact copy and never block local posting;
8. `see everything` is a real focusable link and returns to full Shared Home;
9. static import/source fences exclude Ask/routes/workload/model and raw Fund/month arithmetic;
10. reaching/leaving Till does not add a landing preference or change another member's rights/data;
11. 320, 390, 720, and about 1100 CSS-pixel evidence; keyboard-only, visible focus, screen-reader names, no body overflow, current supported treatments, and reduced motion;
12. existing Shared Home, HouseholdFundPanel/Held, Add/Swipe, custody, month summary, command runtime, continuity, PGlite, and startup suites stay green.

Run focused tests plus `pnpm ai:verify`, `pnpm check:windows`, and `git diff --check <accepted-slice-2-head>..HEAD`.

## Stop conditions for either slice

Stop and return a conflict packet if:

- the required ancestor or accepted Slice 2 head is missing;
- current `origin/main` creates a decision-id, navigation, or shared-file conflict that cannot be reconciled mechanically;
- a fast purchase needs a guessed card account, partner-Personal history, or automatic duplicate override;
- UI would import/call `postEntry` directly, mutate household state, or bypass the ordinary accepted-books/PGlite/outbox path;
- Undo would restore a whole snapshot, overwrite concurrent facts, or create a new financial command;
- a second Fund/motion/month fold or balance is needed;
- Slice 3 would implement landing preference/default takeover;
- scope expands to camera/OCR/receipt, setup, schema, Auth/RLS, Worker/provider, bank connection, real data, Production, or deployment.

## Required Cursor return handoff

For each slice return: exact base/head SHA, branch, dirty status, changed files, and push/PR state; household outcome; Budget and Engagement deltas; risk; focused/full verification counts, skips, warnings, and any baseline-only failure; screenshot/evidence paths; keyboard/focus/reduced-motion/offline proof; explicit financial invariant and privacy proof; data/network/secret/hosted/Production disclosure; residual uncertainty; and next recommended action. Never call local work merged, deployed, or live.
