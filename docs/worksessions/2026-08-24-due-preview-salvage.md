# Due-on-open preview salvage

**Status:** Implemented for review from stale PR #61. No merge, deploy, hosted schema, cloud row, or ledger data was changed.

## Outcome

- The app offers one accessible due-recurrence preview per environment + household + Toronto day.
- The projection includes only active items whose `nextDate` is due and sorts them deterministically.
- Dismissing one household does not silence another household, environment, or day.
- Reviewing one row or all rows opens the existing Confirm guard. The reminder itself cannot post or advance money.
- An unresolved cloud conflict takes priority over this reminder.

## Boundary

This slice adds no recurrence editor, automatic posting, journal mutation, hosted transport, notification service, or background schedule. “Not now” is phone-local. The date is the app's existing Toronto day key.

## Verification

- Focused recurrence-preview suite: **3 tests passed**.
- Full serial repository suite: **52 files, 377 tests passed**.
- TypeScript `--noEmit`: passed.
- Production Vite build: passed with the existing PGlite browser-external/eval and chunk-size warnings.

## Dual Course

- **Budget delta (5): `+1`.** Due items become visible at the moment they need review, but still enter the books only through Confirm.
- **Engagement delta (3): `+1`.** A once-per-household daily “kettle whistle” provides a small, dismissible return cue.
- **Why Dual Course holds:** the cue is useful and warm while remaining a pure projection outside the financial write boundary.
