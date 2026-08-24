# Architecture

## Runtime

Hearth is a TypeScript household ledger with a React interface. The domain lives in `src/core` and does not import React, DOM, or storage. The UI in `src/App.tsx` is an untrusted client: it may format, filter, and preview, but every write goes through a command that validates plain data and returns a new household snapshot.

The accepted target is Google-account cloud continuity (D-112): a signed-in person discovers their personal ledger and household memberships from any device; no device is the host. The cloud is the durable continuity layer, while every device uses PGlite as its validated accounting engine and offline replica. D-113 implements the first disposable-Development bridge in the following transitional stack:

1. **Command snapshot** — IndexedDB `hearth-ledger` / store `households`, plus a `localStorage` fallback. This is what commands clone, validate, and undo.
2. **Books** — a double-entry PostgreSQL database in PGlite (`idb://hearth-books-development` or `idb://hearth-books-production`). After every save the snapshot is posted as balanced `journal_entries` / `journal_lines`. Views expose trial balance, income statement, net worth, and an unbalanced-entry alarm. **PGlite is the books engine.**
3. **Development continuity bridge** — exact Google membership is discovered by scanning deliberately open Development `household_snapshots`. Signed-in writes enqueue the latest accepted full snapshot locally, retaining the earliest expected hosted revision and confirmation ids, then retry on launch/focus/reconnect. Legacy `linked`/phrase transport remains. The app does **not** fill the hosted normalized journal tables.

D-113 supplies Development Google discovery, compacting outbox replay, and automatic pull/focus/reconnect synchronization. Target completion still adds explicit personal-ledger scope, server-side membership discovery, acknowledgement/backoff, multi-household local storage, and atomic hosted CAS/journal authority. Every pulled or merged money state passes the same environment, accounting, and idempotency acceptance boundary before persistence or display. Phrases and Hearth Pass files may remain invitation, export, backup, or recovery tools; they are not normal storage authority.

Hosted RLS is still `USING (true) WITH CHECK (true)` for ALL, including DELETE. Through 2026-09-30 that open access is an explicitly disclosed disposable-Development condition. Google Auth + membership-bound RLS must close it before meaningful October data. Credentials, schema application, Production changes, and destructive cleanup are not covered by the disposable-data policy.

The website is Cloudflare Workers + Assets (`hearth-books`). Download SQL from the Books tab still loads the PGlite schema elsewhere.

Pairing today: every household has a three-word phrase, join link, and Hearth Pass. These remain useful invitation/recovery mechanisms. D-112 makes Google identity plus durable membership the normal new-device entry; the phrase is routing, not authentication or durable authority.

The in-memory command clones JSON. **It is not accepted books** until `acceptHouseholdWrite` validates cents and double-entry, ingests PGlite inside a transaction, persists the snapshot, and only then may transport a linked household. Failure at any step keeps the previous valid household readable and unpublished. Undo still restores a whole snapshot (not yet a reversal receipt). Concurrent catalog adds still merge by id on pull/push. A linked save reconciles with the hosted snapshot, then performs **one** upsert; local PGlite ingest does not push again.

Catalog rows (`Account`, `Category`, `Goal`, `BudgetPlan`, `Member`, `Activity`, `Preset`) last-write-win on required `updatedAt`. Goal progress is append-only `goalContributions`; `savedCents` is the sum. **Journal facts are not auto-merged.** A transported write states the `baseRevision` it extends; a stale hosted revision becomes a visible conflict bundle (`conflicts[]`) and does not disappear after refresh. Client CAS is GET-then-compare-then-POST until Jonathan applies a reviewed successor to `supabase/migrations/002_snapshot_cas.sql`. Audit hashes cover financial meaning, not timestamps. Demo / empty / Pass / non-member households make zero continuity REST calls; a matching signed-in Development identity may transport without `linked: true` (D-113). Claude consumes `src/claude/commandContract.ts` rather than inferring success from toasts.

## Layers

1. **Catalog** — members, accounts (chequing / savings / credit / investment / other / receivable), categories, shift settings, appointments, claims, presets.
2. **Commands** — `postEntry`, `postTransfer`, `postShift`, `addCategory`, budget, goals, recurrences (`addRecurrence`, `adoptRhythm`, `postOneRecurrence`, `postDueRecurrences`), appointments / claims `addAppointment` / `postVisit` / `openClaim` / `settleClaim` / `writeOffClaim` / `submitClaim` / `acceptVisitGoal` (D-053; settle is a transfer, never income; Hercules proposes jars and does not `addGoal` unprompted), presets `addPreset` / `acceptPresetNotice` / `archivePreset` / `dismissNotice` (D-058; never post money), account floor `addAccount` / `updateAccount` / `archiveAccount` / `markInvestmentValue` / `postCardInterest` / `postCardRewards` / `postSavingsInterest` (D-047; marks never post; interest/rewards still `postEntry`), cosmetic `scribbleChalk` / `equipCosmetic` (D-042, D-044), Hercules desk `recordHerculesTalk` / `forgetHerculesMemory` / `wipeHerculesChat` (D-049; never post money), Audit Office `recordReconciliation` / `closeBooksMonth` / `reopenBooksMonth` (D-046 / D-084; close is a hard lock; reopen is explicit; never post money), sit-down `applySitDown` / `saveSitDownSession` / `executeSitDownMoves` / `reversePostedMoney` (D-083–D-085; leftover plan then transfers; reverse instead of delete), and Google-bridge `linkGoogleIdentity` / `setGoogleServices` (D-043) plus Drive create-only month workbook (D-087). Each clones state, writes, refreshes duplicate flags, appends activity, and returns an undo snapshot. Cosmetics, rec, close, marks, Hercules talk, presets, and Google never post money. Sit-down Confirm moves leftover through `postTransfer`.
3. **Books** — `compileHousehold` turns each money document into balanced debit/credit lines. PGlite stores them. Health Check refuses a household whose trial balance or accounting equation is off.
4. **Projections** — `monthSummary`, `weekSummary`, `buildDashboard`, `runHealthCheck`, `sitDownPreview`, `leftoverProjection`, `sitDownFacts`, `trialBalance`, `detectRhythms`, `detectHabits`, `composeNotices`, `buildMonthBoard`, `askBooks` / `askHercules`, `describeCompanion`, `herculesBriefing`, `composeHerculesChatRequest`, `householdWallet` / `creditCardView`, `auditOpinion`, `balanceSheet`, `incomeStatement`, `cashFlowStatement`, `statementOfChangesInEquity`, `liquidityWatch`, `notesToFinancialStatements`.
5. **Google engine** — Google identity is Development account entry, ledger discovery, and recovery (D-113). Calendar, Drive, Contacts, Gmail, and Sheets remain separate opt-in integrations; they never `postEntry`, and Drive/Sheets are not the ledger. Tokens and hosted sessions never enter ledger snapshots, the outbox, or Git.
6. **Kitchen Worker** — Cloudflare Workers + Assets (`hearth-books`). HTML is `Cache-Control: no-store`. `POST /hercules/chat` uses OpenAI or Anthropic when those **Worker secrets** are set, then Cloudflare Workers AI (D-045, D-059). Third-party keys are allowed; they must never be `VITE_` or household rows. The model cannot post money, invent notice keys, or treat ledger text as instruction. Local Vite falls back to `localHerculesChat`.
7. **UI** — Home is the September Office (D-051 / D-079 / D-080 / D-082): **mobile** (`< 720px`) is `OfficePhone` (glance + one-tap, three stamps, five or fewer objects); **wide** is the `.desk-wide` canvas with sizes, Edit Desk, and personalities, packed so cards do not clip, still cream paper and Fraunces names. Same commands, colours, fonts, and bubble chrome. Weather window, paper sill, movable widgets, Hercules on furniture. Hercules is Claude's ink-on-paper SVG (D-061). He loafs during Add. Spectacles from a tied rec. Green ink from a closed month. A decorative fly never carries CAD. The chalkboard is drawable; letter detection stays on the phone (D-065). Desk games never post. Layout keys split `phone` / `wide`.

## Dual Course coupling

Family-office accounting (weight **5**) and Hercules / interactables (weight **3**) share this kernel. There is no second ledger for the cat.

- Course A writes through commands, then `compileHousehold` into PGlite. Health, statements, wallet, rec, and close are projections.
- Course B **reads** those projections (`describeCompanion`, `herculesBriefing`, `auditOpinion`, `householdWallet`, `talkHercules`, `planHerculesTurn`, `composeNotices`). Cosmetics and Hercules desk writes (`scribbleChalk`, `equipCosmetic`, `recordHerculesTalk`, `addPreset`, `acceptPresetNotice`) clone the snapshot and never put money ids in `postedIds` except the preset catalog id. Journal questions skip the model.
- A new accounting surface must expose at least one companion line, unlock, chalkboard, wallet tile, or ceremony.
- A new companion behavior must be grounded in a posted fact or a Health / rec / close / wallet projection.
- If they conflict, Course A wins. Product law: [STRATEGY.md](STRATEGY.md), D-048.

## Data-model rules

- One canonical `transactions` array is the command document. The books compile each document into balanced `journal_entries` / `journal_lines`. A Visa payment is one journal entry: debit the card, credit chequing. A TFSA contribution is debit investment, credit chequing (cash-flow investing out).
- Amounts are integer cents. Currency is CAD copied from the account.
- Dates are `YYYY-MM-DD` civil keys in `America/Toronto`. Week bounds are computed from that civil date, never from `Date#setHours(0,0,0,0)` in the runtime zone.
- `expense` and `income` affect totals. `transfer` is a paired movement between accounts and is excluded from both. `refund` subtracts from category spend.
- Ownership is a `splits` array that must sum to the amount. Joint is explicit. A split can be any percentage; the leftover cents go to the last person so the total is exact.
- Every transaction and shift has `createdBy` and `visibility` (`household` | `personal` | `both`). Home, Plan, and Ledger filter that view. Health Check still runs on the full snapshot.
- `duplicateKey` is an exact fingerprint. Posting also scores similar rows: same type, same amount, within five Toronto calendar days, plus shared notes, place, category, or source. Partner personal rows are not part of that scan. `potentialDuplicate` is derived from that. `isDuplicate` remains the reviewed financial control.
- Recurring definitions stay separate from posted rows. Appointments are a separate catalog (D-053) projected onto the same month board as `visit` items, and Calendar → Appointments is the destination for history, itemized bills, claims aging, and the METC log (D-056). Presets are a separate catalog (D-058) for one-tap Add; they never post by themselves. Posting a visit uses `postVisit`; posting a bill still uses `postEntry` after confirm. Google and ICS never write the books.
- Claims (`Claim`) are shared household facts with `updatedAt`. Merge is last-write-wins like recurrences. Audit `snapshot_hash` includes expected / received / written-off cents.
- Goals are data. Shared goals appear on Home. Personal goals are a filter only — not a privacy boundary. Progress is append-only contribution rows; `savedCents` is derived. Ask and Plan can name who put money in.
- Kitchen cosmetics (`kitchen.chalkboard` including optional `ink`, Hercules companion + `kitchen.hercules` chat/memories, `kitchen.openShift`, `kitchen.games`) are shared household data. They merge and tombstone like recurrences. They are not journal lines. `kitchen.books` (recs and closed months) is the Audit Office desk: also shared, also never journal lines. Reopen tombstones `CLOSE-YYYY-MM`.
- Google links (`google.links`) are shared household data: who is signed in, not the token. Tokens live in `localStorage` per environment and member. Extra Google services are household-wide opt-ins.

## Shift boundary

`calcShiftAmounts` is the only tip/wage math. Clock-in writes `kitchen.openShift` with zero `postedIds` (D-062). The sign-out / already-off UI previews one field at a time; hours are a live preview until Confirm. `postShift` calls the same math after validating the Toronto date, member, CAD account, hours, and settings fingerprint. A stale fingerprint refuses the write. Same-member same-date is a confirmable warning. Hercules’s shift streak reads `household.shifts`, never visit sparks, never an open punch.

## Trust and failure

Browser controls are usability. Commands throw `ValidationError` before mutating. Duplicate/settings/double-shift cases throw `NeedsConfirmationError` with zero writes. Undo restores the previous snapshot and tombstones posted ids so a deleted row cannot return from the other phone. A write queue prevents overlapping saves and undos. Health Check is a projection, not a hidden sheet.

## Environments

Development is the default local ledger. Production is a second named snapshot on the same device. They cannot be confused by workbook title; the pill in the top bar is the environment and asks before switching.

Current Supabase code supports legacy **linked** transport plus D-113 automatic Development transport for an exact signed-in Google member. Demo, empty, Pass, and non-member households make zero continuity REST calls. The localStorage outbox retries accepted snapshots; client CAS remains GET-then-compare-then-POST and stale writes become visible conflicts. Production discovery is off. `supabase/migrations/002_snapshot_cas.sql` and `docs/sql/rls_auth_ready.sql` remain readiness packets. **Do not apply them.** Treat hosted rows as openly readable/writable disposable Development data through 2026-09-30; complete the reviewed Auth/RLS cutover before meaningful October data.

## Scale

Commands currently clone the snapshot per write, which is honest and simple at household scale. The SQL journal is the queryable, constraint-backed record of those writes. Replace the snapshot clone with an event log only if household scale stops being household scale.

Sheets-era architecture (museum): [reference/sheets-era/ARCHITECTURE.md](reference/sheets-era/ARCHITECTURE.md). Retired Cursor roadmaps: [nostalgia/](nostalgia/).
