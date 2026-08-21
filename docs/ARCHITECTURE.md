# Architecture

## Runtime

Hearth is a TypeScript household ledger with a React interface. The domain lives in `src/core` and does not import React, DOM, or storage. The UI in `src/App.tsx` is an untrusted client: it may format, filter, and preview, but every write goes through a command that validates plain data and returns a new household snapshot.

Persistence is IndexedDB database `hearth-ledger`, object store `households`, one snapshot per environment (`development` or `production`). `localStorage` holds a fallback copy of the same JSON. Export JSON is the file backup.

When a household is **linked**, Netlify Functions plus Netlify Blobs hold two envelopes for the same invite token:

1. **Shared** — catalog, plus rows whose visibility is `household` or `both`.
2. **Personal** — that member's `personal`-only rows.

Pairing does not depend on that function being live. Every household has a three-word phrase. **Share phrase and link** sends `/?join=cedar-lantern-kite`. **Hearth Pass** is a JSON file of the shared envelope only; the other phone imports it and merge-by-id still applies. Cloud publish is an accelerator, not the only door.

Each phone keeps a working copy, then merges by id on pull/push so concurrent adds do not wipe each other. Undo writes tombstones so a deleted row cannot come back from the other phone. The UI never saves the filtered view as the canonical snapshot.

The in-memory model is still the source of truth while a command runs: clone the household, validate, replace the snapshot, then write both stores. Undo restores the previous snapshot.

## Layers

1. **Catalog** — members, accounts, categories, shift settings.
2. **Commands** — `postEntry`, `postTransfer`, `postShift`, `addCategory`, budget, goals, recurrences. Each clones state, writes, refreshes duplicate flags, appends activity, and returns an undo snapshot.
3. **Projections** — `monthSummary`, `weekSummary`, `buildDashboard`, `runHealthCheck`, `sitDownPreview`.
4. **UI** — Home, Add, Plan, Ledger, More. Four tabs plus one add sheet.

## Data-model rules

- One canonical `transactions` array.
- Amounts are integer cents. Currency is CAD copied from the account.
- Dates are `YYYY-MM-DD` civil keys in `America/Toronto`. Week bounds are computed from that civil date, never from `Date#setHours(0,0,0,0)` in the runtime zone.
- `expense` and `income` affect totals. `transfer` is a paired movement between accounts and is excluded from both. `refund` subtracts from category spend.
- Ownership is a `splits` array that must sum to the amount. Joint is explicit. A split can be any percentage; the leftover cents go to the last person so the total is exact.
- Every transaction and shift has `createdBy` and `visibility` (`household` | `personal` | `both`). Home, Plan, and Ledger filter that view. Health Check still runs on the full snapshot.
- `duplicateKey` is an exact fingerprint. Posting also scores similar rows: same type, same amount, within five Toronto calendar days, plus shared notes, place, category, or source. Partner personal rows are not part of that scan. `potentialDuplicate` is derived from that. `isDuplicate` remains the reviewed financial control.
- Recurring definitions stay separate from posted rows. Posting due items uses the same `postEntry` path.
- Goals are data. Shared goals appear on Home. Personal goals are a filter only — not a privacy boundary.

## Shift boundary

`calcShiftAmounts` is the only tip/wage math. The add-shift UI previews it; `postShift` calls it again after validating the Toronto date, member, CAD account, hours, and settings fingerprint. A stale fingerprint refuses the write. Same-member same-date is a confirmable warning. Historical blank Shift IDs from the Sheets app are not migrated here; this is a new ledger.

## Trust and failure

Browser controls are usability. Commands throw `ValidationError` before mutating. Duplicate/settings/double-shift cases throw `NeedsConfirmationError` with zero writes. Undo restores the previous snapshot. A UI mutex prevents overlapping saves. Health Check is a projection, not a hidden sheet.

## Environments

Development is the default local ledger. Production is a second named snapshot on the same device. They cannot be confused by workbook title; the pill in the top bar is the environment.

A linked household on Netlify is a third surface: both phones open the same invite code. Development/production on a phone remain local keys and can each link to a different household.

## Scale

Duplicate flags are O(n). Month and week summaries are single passes. The fixture generator builds 12 months of load for tests. Commands currently clone the snapshot per write, which is honest and simple at household scale and the thing to replace with an event log if this later becomes a multi-user server.
