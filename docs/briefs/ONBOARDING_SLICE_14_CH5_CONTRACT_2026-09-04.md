# Onboarding Slice 14 contract — Chapter 5 · bring the books to today

## Authority

Jonathan authorized Slice 14 on 2026-09-04 and clarified that chapter times
are guidance, not limits. The current onboarding manual's Chapter 5 contract
and the newer `_1` UX packet/plates govern the journey. D-183 remains the
opening-truth authority; this slice must reuse it byte-for-byte.

## Household outcome

Bianca enters the current balances for every active Shared account, reviews
the balance-sheet effect, and confirms one opening batch. Jonathan witnesses
the same household receipt. The chapter completes only when the accepted
receipt is tied to one current Toronto civil date and its live opening rows
cover the complete Shared account set established in Chapter 4.

## Modify

- `src/core/onboarding/evidence.ts`, `src/core/commands.ts` — project a
  receipt-tied complete Shared opening and re-check that evidence before an
  acknowledgement can advance.
- `src/core/onboarding/copy.ts`, `src/core/onboarding/registry.ts`,
  `src/OnboardingChat.tsx` — add the six-minute guidance, between-account
  pause, honest task/partial/stale copy, and specific entry/correction actions.
- `src/OpeningTruthCard.tsx`, `src/opening-truth.css` — reuse the existing
  command card in Shared-only mode with coverage status, review focus,
  44-pixel controls, pause, and exact confirmation identity handoff.
- `src/Hercules.tsx`, `src/App.tsx`, `src/Books.tsx`,
  `src/MonthRehearsalPanel.tsx` — route to the existing Books form or existing
  activity/reversal surface while preserving the accepted receipt identity.
- Focused onboarding/opening tests plus living decision, roadmap,
  worksession, and handoff records.

## Create

- `test/onboarding-opening.test.ts`
- `docs/worksessions/2026-09-04-onboarding-opening.md`

## Probe and recovery

- No opening batch: pending; **Enter opening balances** opens Shared Books.
- A receipt-tied opening that omits any active Shared account: pending;
  **Review opening entries** routes to the existing whole-batch reversal path.
- Ordinary accepted money with no live opening and history beyond a fully
  reversed opening: blocked stale; copy names the conflict and routes to
  activity review. It never offers Next.
- A live complete opening without its accepted receipt, or rows split across
  source/date identities: blocked untied.
- A fully reversed opening-only history returns to pending so the existing
  command can accept one corrected batch.

## Evidence and authority

The household evidence cites the accepted confirmation, every live opening
row, covered Shared account names, the Toronto civil date, and derived Opening
equity. The command boundary remains `postOpeningBalances` followed by the
ordinary accepted-household write. Its confirmation id is passed through the
UI to persistence so the command receipt and opening rows share one identity.
Visiting Books, reviewing values, or clicking an onboarding action never
completes the chapter.

## UX and accessibility

- The task distinguishes existing balances from income and spending before
  any number is entered.
- The form shows coverage progress and allows a pause between accounts.
- Review names assets, card debt, Opening equity, the atomic row count, and
  whole-batch correction behavior before Confirm.
- Focus lands on the routed heading, moves to the review summary, and returns
  to the first account on Change. Inputs and actions are at least 44 CSS px,
  content reflows without horizontal scrolling, and Personal accounts never
  appear in the Shared form.

## Acceptance

- Tests cover partial pending, stale ordinary-money refusal and copy, complete
  receipt evidence, the current-evidence acknowledgement fence, Shared-only
  UI, exact receipt identity, Toronto date, balanced equity, and a byte-exact
  hash of `src/core/openingTruth.ts`.
- The quick gate and production build pass on the exact final tree.
- Live browser proof covers task, entry, review/change, partial, and stale
  states at phone, desktop, and 200%-equivalent reflow widths.

## Do not

- Do not modify or weaken `src/core/openingTruth.ts`.
- Do not reconstruct history, fabricate income/spending, post a second
  opening, accept a partial batch, or complete from a route/review click.
- Do not create a second opening form, command, correction model, schema,
  hosted row, provider, secret, Auth/RLS change, Production change, push,
  merge, or deployment.
