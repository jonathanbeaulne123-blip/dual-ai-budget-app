# Architecture

## Runtime

Hearth is a TypeScript household ledger with a React interface. The domain lives in `src/core` and does not import React, DOM, or storage. The UI in `src/App.tsx` is an untrusted client: it may format, filter, and preview, but every write goes through a command that validates plain data and returns a new household snapshot.

Persistence is two layers:

1. **Command snapshot** — IndexedDB `hearth-ledger` / store `households`, plus a `localStorage` fallback. This is what commands clone, validate, and undo.
2. **Books** — a double-entry PostgreSQL database in PGlite (`idb://hearth-books-development` or `idb://hearth-books-production`). After every save the snapshot is posted as balanced `journal_entries` / `journal_lines`. Views expose trial balance, income statement, net worth, and an unbalanced-entry alarm.

The website is Cloudflare Workers + Assets (`hearth-books`). Hosted books are the household Supabase Postgres project. Download SQL from the Books tab still loads the same schema elsewhere.

Pairing: every household has a three-word phrase. **Share phrase and link** sends `/?join=cedar-lantern-kite`. **Hearth Pass** is a JSON file of the shared envelope only. Cloud publish is an accelerator, not the only door.

Each phone keeps a working copy, then merges by id on pull/push so concurrent adds do not wipe each other. Undo writes tombstones so a deleted row cannot come back from the other phone. The UI never saves the filtered view as the canonical snapshot.

The in-memory model is still the source of truth while a command runs: clone the household, validate, replace the snapshot, then write both stores. Undo restores the previous snapshot.

## Layers

1. **Catalog** — members, accounts, categories, shift settings.
2. **Commands** — `postEntry`, `postTransfer`, `postShift`, `addCategory`, budget, goals, recurrences (`addRecurrence`, `adoptRhythm`, `postOneRecurrence`, `postDueRecurrences`), cosmetic `scribbleChalk` / `equipCosmetic` (D-042, D-044), and Google-bridge `linkGoogleIdentity` / `setGoogleServices` (D-043). Each clones state, writes, refreshes duplicate flags, appends activity, and returns an undo snapshot. Cosmetics and Google never post money.
3. **Books** — `compileHousehold` turns each money document into balanced debit/credit lines. PGlite stores them. Health Check refuses a household whose trial balance or accounting equation is off.
4. **Projections** — `monthSummary`, `weekSummary`, `buildDashboard`, `runHealthCheck`, `sitDownPreview`, `trialBalance`, `detectRhythms`, `buildMonthBoard`, `askBooks` / `askHercules`, `describeCompanion`, `herculesBriefing`.
5. **Google engine** — `withGoogle` is a call-when-needed bridge (identity, Calendar, optional suite). Tokens stay on the phone. The shared snapshot only stores who is linked. Sensitive household actions can step-up through Google after a member is linked.
6. **Kitchen Worker** — Cloudflare Workers + Assets (`hearth-books`). HTML is `Cache-Control: no-store`. `POST /hercules/chat` binds Workers AI so Hercules can talk (D-045). The model cannot post money. Local Vite falls back to `localHerculesChat`.
7. **UI** — Home (chalkboard, net, pulse), Calendar, Add, Plan, Books, More. Hercules wanders as a borderless cat with a compact following chat. He loafs during Add.

## Data-model rules

- One canonical `transactions` array is the command document. The books compile each document into balanced `journal_entries` / `journal_lines`. A Visa payment is one journal entry: debit the card, credit chequing.
- Amounts are integer cents. Currency is CAD copied from the account.
- Dates are `YYYY-MM-DD` civil keys in `America/Toronto`. Week bounds are computed from that civil date, never from `Date#setHours(0,0,0,0)` in the runtime zone.
- `expense` and `income` affect totals. `transfer` is a paired movement between accounts and is excluded from both. `refund` subtracts from category spend.
- Ownership is a `splits` array that must sum to the amount. Joint is explicit. A split can be any percentage; the leftover cents go to the last person so the total is exact.
- Every transaction and shift has `createdBy` and `visibility` (`household` | `personal` | `both`). Home, Plan, and Ledger filter that view. Health Check still runs on the full snapshot.
- `duplicateKey` is an exact fingerprint. Posting also scores similar rows: same type, same amount, within five Toronto calendar days, plus shared notes, place, category, or source. Partner personal rows are not part of that scan. `potentialDuplicate` is derived from that. `isDuplicate` remains the reviewed financial control.
- Recurring definitions stay separate from posted rows. The Calendar tab projects them onto a Toronto month, spots repeating ledger rows (`detectRhythms`), and can write reminders to Google or an `.ics` file. Posting due items still uses the same `postEntry` path after confirm. Google and ICS never write the books.
- Goals are data. Shared goals appear on Home. Personal goals are a filter only — not a privacy boundary.
- Kitchen cosmetics (`kitchen.chalkboard`, Hercules) are shared household data. They merge and tombstone like recurrences. They are not journal lines.
- Google links (`google.links`) are shared household data: who is signed in, not the token. Tokens live in `localStorage` per environment and member. Extra Google services are household-wide opt-ins.

## Shift boundary

`calcShiftAmounts` is the only tip/wage math. The add-shift UI previews it; `postShift` calls it again after validating the Toronto date, member, CAD account, hours, and settings fingerprint. A stale fingerprint refuses the write. Same-member same-date is a confirmable warning.

## Trust and failure

Browser controls are usability. Commands throw `ValidationError` before mutating. Duplicate/settings/double-shift cases throw `NeedsConfirmationError` with zero writes. Undo restores the previous snapshot and tombstones posted ids so a deleted row cannot return from the other phone. A write queue prevents overlapping saves and undos. Health Check is a projection, not a hidden sheet.

## Environments

Development is the default local ledger. Production is a second named snapshot on the same device. They cannot be confused by workbook title; the pill in the top bar is the environment and asks before switching.

Development/production on a phone remain local keys. The books are PostgreSQL in the app (PGlite) and the same schema on the household Supabase project. The website is Cloudflare Workers.

## Scale

Commands currently clone the snapshot per write, which is honest and simple at household scale. The SQL journal is the queryable, constraint-backed record of those writes. Replace the snapshot clone with an event log only if household scale stops being household scale.

Sheets-era architecture: [reference/sheets-era/ARCHITECTURE.md](reference/sheets-era/ARCHITECTURE.md).
