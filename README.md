# Hearth

A household budget for Jonathan and Bianca.

This branch is a ground-up rebuild of the Sheets/Apps Script app on `main`. It keeps the financial rules that were already right — Toronto time, CAD, untrusted input, cent rounding, duplicate fingerprints versus reviewed exclusions, shift preview = post — and replaces the spreadsheet runtime with a portable TypeScript ledger plus a phone-first interface.

Open it:

```text
pnpm install
pnpm test
pnpm dev
```

Then visit `http://localhost:5173`. Choose **Open the demo kitchen table** to load a fictional six-month household. Nothing here is live production data.

## Why this exists

The Sheets app became a trustworthy write kernel trapped in a 3,300-line `Code.gs`, a 15-item operator menu, and a dashboard that was a rebuilt spreadsheet. Bianca cannot live there. This rebuild is the comparison: same household, same money rules, a product she can open on a phone.

## What you can do today

- Add spend, income, a shift, or a transfer from one `+` button
- Split a purchase joint / one person / 50–50, with cents that always add up
- See a shift receipt before it posts — floor, bar, CC tip-out, wages — using the same function the tests use
- Get stopped on a duplicate, then add anyway if it was a real second coffee
- Undo the last save for a few seconds
- Read Home as one net number, a pulse sentence, this week versus last week, and shared goals
- Run a monthly sit-down that copies last month and trims overspent categories
- Keep development and production as two named local ledgers, not two lookalike workbooks
- Export JSON; run Health and get a clean bill or a specific finding

Transfers never count as income or expense. Refunds reverse category spend. Shift tip math is the verified cent-rounded household rules, including negative net tips.

## Architecture in one page

```text
UI (React, untrusted)
   |
   v
Pure commands (validate → clone → commit → refresh flags)
   |
   v
Household snapshot (JSON)
   |
   +-- Home / Plan / Health are projections of that snapshot
```

There is no Google login, no Sheet, no formula range that can freeze at row 33. A failed command throws before the snapshot is replaced, so there is nothing to roll back except Undo, which restores the previous snapshot.

## Tests

`pnpm test` covers Toronto week bounds, shift math against the original vectors, duplicate flags, exact splits, atomic posts, transfer exclusion, shift undo, category commits, a health-clean demo household, and a 12 × 200 transaction fixture.

## Compare with `main`

```text
git diff main --stat
```

`docs/COMPARISON.md` maps every issue from the review onto this rebuild.

## Out of scope here

- Live Google Sheets writes
- Bank import adapters
- Real privacy for personal goals (a hidden screen is still visible; personal goals are a Home filter only)
- Hosted sync — this version lives on the device, with JSON export as the backup
