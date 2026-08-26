# Cursor next packets — Hearth

**Status:** paste-ready implementation stack  
**Prepared:** 2026-08-24 (`America/Toronto`)  
**Repository:** [`jonathanbeaulne123-blip/dual-ai-budget-app`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app)  
**Audited baseline:** `main` at [`75574e4cad7a7346fdda8e97616fcf0efe09541b`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/commit/75574e4cad7a7346fdda8e97616fcf0efe09541b)  
**Purpose:** give Cursor a ranked, evidence-backed implementation stack without turning the roadmap into a ceiling.

This file is an implementation brief, not permission to merge or deploy. Cursor may inspect, challenge, split, combine, or expand a packet when doing so better satisfies Hearth's laws. It must explain any material expansion in the PR and preserve every proof gate below. The ranking reflects risk and dependency at the audited baseline; re-check repository and PR state before starting.

## Non-negotiable shared laws

Prepend this section, or link it explicitly, when handing any individual packet to Cursor.

1. **Books win.** Use the Dual Course weighting: budget/books integrity **5**, Hercules and interactables **3**. Report both deltas in the PR. When they conflict, keep the books true and say what was cut.
2. **Commands are the money trust boundary.** UI, Hercules, weather, imports, reminders, games, and widgets never post money. They may explain, stage, or preview. An explicit **Confirm** invokes an existing or newly reviewed command.
3. **Accounting law is invariant.** CAD integer cents, Toronto civil dates (`America/Toronto`), balanced double-entry, immutable posted history except through explicit reversing entries, and Development is not Production.
4. **Cloud continuity is core.** Google sign-in reveals the person's personal ledger and household memberships on any device. The cloud is durable continuity; PGlite is each device's validated accounting/offline replica. No peer device is the host.
5. **Network and disclosure must be literal.** After sign-in, synchronization is automatic and its state must be truthful. Model-bound data must be explicitly disclosed and tested at the final serialized request. Through 2026-09-30 hosted rows are disposable/open Development data, not private data.
6. **Security has a dated cutover.** Google Auth, durable personal/household membership, and closed RLS must ship before meaningful October data and still gate bank feeds, Interac, issued cards, and private hosted documents. A three-word phrase is invitation/routing, not normal authentication or storage authority.
7. **Development and Production are separate books.** Never infer safety from a UI pill alone. Enforce the environment at every ingress, persistence key, merge, publish, server predicate, and audit row.
8. **No quiet deletion.** Corrections to posted money use reversals. Tombstones and conflict resolution must preserve audit history. Never restore an old whole-household snapshot over newer partner work.
9. **No obsolete backend revival.** Do not revive Google Sheets, Apps Script, or `clasp` as Hearth storage, sync, accounting, import, or deployment infrastructure. Do not reopen Sheets-era issues as roadmap authority.
10. **No museum planning.** Do not read or use `docs/nostalgia/` or `docs/reference/` for current implementation decisions. Current authority is Jonathan's latest instruction, `docs/CLOUD_CONTINUITY.md`, `docs/STRATEGY.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, current code/tests, and an explicit new decision where needed.
11. **No unapproved production mutation.** Do not run `pnpm books:apply`, apply or alter a Supabase production schema, clean up hosted rows, migrate production data, bind production resources, change production secrets, or deploy the app/Worker without Jonathan's explicit approval. A migration proposal, disposable Development rehearsal, and rollback proof are not production approval.
12. **Do not narrow the product accidentally.** Preserve shipped behavior unless a packet explicitly changes it for truth or safety. If inspection reveals an adjacent blocker, include it when required for correctness and document why; otherwise hand it off visibly.

### Baseline verification and handoff contract

Start from a fresh branch whose ancestry is stated in the PR. Do not assume an open PR is on `main`. Unless a packet supplies a stronger suite, collect:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm exec tsc --noEmit
pnpm build
```

Use focused tests as well when relevant:

```text
pnpm exec vitest run test/books.test.ts test/ledger.test.ts test/write-safety.test.ts test/sync-integrity.test.ts test/supabase.test.ts test/hercules-worker.test.ts test/api.test.ts
```

Never treat a green test count copied from an old PR as new proof. Each handoff must state: branch and exact base/head SHAs; packet goal; files changed; decision IDs added or changed; tests and commands actually run with results; manual or integration evidence; Development/Production impact; Dual Course deltas; residual risks; rollback; and the recommended next packet. No deploy is part of the default handoff.

## Audited branch and PR topology

Observed 2026-08-24. Re-fetch before acting.

| Work | Exact topology | Canon consequence | Recommended treatment |
|---|---|---|---|
| `main` | `75574e4cad7a7346fdda8e97616fcf0efe09541b`; living decisions end at **D-106** | This is the only shipped baseline for this stack. | Branch from this SHA after fetching, unless Packet 1 deliberately establishes a newer reviewed base. |
| [PR #63 — Allow Git main chat host and IP-limit without KV](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/63) | Open, non-draft, mergeable; base `main@75574e4`; head `cursor/hercules-chat-host-limiter-46a3@80b7421300a05cb67f058a9619db619bdd34eb19`; one commit, seven files. | Adds **D-107** for the `main-` Worker alias and a 60/IP/day limiter. Its unbound fallback is per-isolate memory, and KV `get` + `put` is not an atomic global counter, so “the limit holds without config” overstates the guarantee. | Preserve the origin-alias fix. Make limiter claims and tests match real guarantees, or add an approved persistent/atomic design. Do not deploy from this packet. |
| [PR #61 — Due-on-open preview for due recurrences (D-107)](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/61) | Open, **draft**, mergeable; stacked base `cursor/hercules-memory-kinds-a57d@af525e55cffd7a6276949a40ea0be3560d8be4c0`; head `cursor/due-preview-on-open-a57d@77604bef9e92be7baa1b8b24fd85c0ab11075827`; three commits, nine files. | Adds a different **D-107** for due-on-open. It is not based directly on current `main` and now also contains the budget edit merged through PR #62. | Split or rebase onto the reviewed main lineage, then prove due-preview and budget-edit independently. Nothing in this PR is shipped merely because a stacked child merged. |
| [PR #62 — Books budget edit (D-108)](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/62) | GitHub says merged, but it merged into PR #61's branch, not `main`; head `35789a17bf53cc1ebf0506429dfcafc408093641`; merge commit on #61 is `77604bef9e92be7baa1b8b24fd85c0ab11075827`. | Its **D-108** depends on #61's competing D-107 numbering and is absent from `main`. | Treat as unshipped branch content. Extract/rebase if retained; do not cite “merged” as production truth. |

**D-107 collision:** `main` ends at D-106, while both #63 and #61 independently claim D-107; #62 then claims D-108 on top of #61. The recommended sequence is to retain D-107 for the reviewed #63 concept if its claims are corrected, then renumber due-on-open to D-108 and budget edit to D-109 while rebasing them into clean PRs. That is a recommendation, not authority to rewrite history: if Jonathan chooses a different merge order, allocate numbers in that order. Never merge either branch with duplicate decision IDs and never silently overwrite a decision row.

Seven older open PRs and five open Sheets-era issues were also observed as stale or superseded. Propose a triage list with links and reasons; do not close external work without Jonathan's approval, and do not treat it as active roadmap scope.

## Evidence that sets the ranking

| Finding at `main@75574e4` | Exact evidence | Consequence |
|---|---|---|
| Unlinked/demo/local households are silently uploaded. | `src/ledger/engine.ts:320-349` always calls `pushSupabaseHousehold({ ...household, linked: true })`; `src/App.tsx:220-248` calls books sync on boot for every local household and `src/App.tsx:332-343` calls it after every commit. `src/ledger/supabase.ts:18-25` carries the default live Supabase endpoint and publishable key. That config helper returns null under Vitest unless `VITE_SUPABASE_LIVE=1`, so the ordinary test environment masks this call path. | Stop-ship network/mode truth bug. Linked commits can also push once in `App.tsx:314-330` and again through the engine. Tests need injectable transport/config or production-default-enabled spies, not a mock that disables the path. |
| A pass can cross the selected environment. | `src/core/pass.ts` preserves the pass environment; `src/Pairing.tsx` applies and persists it without comparing the current pill. `src/storage.ts:81-87` keys storage by payload environment. Supabase pull filters row metadata but returns `payload` without validating payload household/environment. | The pill can say Development while imported data is Production; current server separation is only a column/query in one project. |
| D-105 filtering is incomplete at the final model payload. | `src/core/herculesPrivacy.ts:123-137` filters recent rows by viewer, but `:139-148` derives category totals from a full-household `monthSummary`. `composeHerculesChatRequest` receives the full household. `test/hercules.test.ts` proves only that one personal note is absent from recent rows. | Partner-personal amounts or aggregates can still reach the model. |
| Money snapshots commit before books acceptance. | Commands return cloned JSON (`src/core/commands.ts:116-134`). `src/App.tsx:302-347` saves JSON and updates UI before books sync. `src/ledger/engine.ts:310-317` can return `{ ok: false }` after the PGlite write transaction instead of throwing and rolling back. | PGlite failure or imbalance is a soft status, not a command gate. |
| “First Numbers” is not an opening-balance primitive. | `JournalEntry.source` admits `"opening"` in `src/core/journal.ts:37`, but the compiler at `:205-261` emits transaction/reversal sources and no command creates opening entries. Strategy still lists opening balances as north-star work. | A household starts at zero or must fake history; statements lack an explicit starting point. |
| Reversal exists; generic undo is session-local and unsafe when stale. | `reversePostedMoney` is in `src/core/commands.ts:1647-1719`. React history starts empty at `src/App.tsx:160`; the UI says it is “on this phone.” `UndoToken` at `src/core/commands.ts:1722-1752` restores a whole old snapshot and tombstones current rows absent from it; `src/App.tsx:369-379` checks only the latest in-memory token, not revision/hash. | Reload loses undo, while a stale token after sync can tombstone a partner's newly merged work. |
| Two-phone writes have no atomic compare-and-swap or durable outbox. | Reconcile pulls once in `src/api.ts:68-75`; `src/ledger/supabase.ts:138-170` performs household and snapshot upserts as two requests. `src/core/sync.ts` merges in memory, then plain upsert can last-writer-drop both clients' new work. | “Merge exists” is not convergence proof under concurrent network interleavings. |
| Hosted rows are open to anonymous reads/writes. | `supabase/migrations/001_hearth_books.sql:292-319` grants anon/authenticated SELECT/INSERT/UPDATE/DELETE with `USING (true)` / `WITH CHECK (true)`. `docs/sql/rls_auth_ready.sql` is illustrative, non-runnable, and refers to a missing `members.auth_user_id`. | Auth + real membership RLS is still a hard gate. The example SQL must not be applied. |
| Environment identity is structurally inconsistent. | `households.id` is the sole primary key (`supabase/migrations/001_hearth_books.sql:8-19`); `household_snapshots.household_id` is the sole primary key (`:179-184`); only a separate unique index covers `(invite_phrase, environment)` (`:200`). Client upserts conflict on `id` / `household_id` (`src/ledger/supabase.ts:138-170`) while pulls filter environment. | The same household ID in both modes can overwrite the other environment despite the filter. This requires a reviewed v2 tenant key or separate-project/schema design, not a query-only patch. |
| Hosted normalized-book IDs are not tenant-safe for future use. | `members.id`, `categories.id`, `journal_entries.id`, and other normalized tables in `supabase/migrations/001_hearth_books.sql:20+` use global primary keys rather than `(household_id, id)`. The browser currently publishes metadata plus JSON snapshot, not those normalized PGlite books. | Do not claim a hosted GL ships and do not begin populating these tables. Redesign tenant-scoped/composite or UUID identity before any such future migration. |
| CI and deploy are not a single gate. | `.github/workflows/ci.yml` runs tests/typecheck only for `main` and `cursor/**`; `.github/workflows/pages.yml` independently deploys after build without depending on test CI. Repository metadata showed unprotected `main` with no required contexts. `package.json` has no lint, coverage, E2E, a11y, or dependency-audit gate. | A direct failing commit can reach the deploy path; `codex/**` work can miss push CI. |
| Reconciliation is manual; import does not ship. | `recordReconciliation` exists at `src/core/commands.ts:1796+`; `src/Books.tsx:298-328` records a typed statement balance/history. Hercules says “I compare. I don't import the bank” at `src/core/hercules.ts:479-487`. | Build import later as an inbox-to-confirm adapter, never as a second ledger. |

---

## Packet 1 — P0 governance: reconcile branches and canon before feature work

### Goal

Establish one reviewable main lineage, preserve useful work from #63/#61/#62 without silently merging unrelated commits, and make every decision ID unique. Produce the clean base that all later packets can name exactly.

### Why now / evidence

- The audited shipped base is `main@75574e4`; #61 is stacked on `af525e5`, not directly on `main`.
- #62 is “merged” only into #61's branch.
- #63 and #61 both add D-107; #62 adds D-108 on the assumption that #61's D-107 wins.
- #63's origin fix is useful, but its per-isolate fallback is not a hard distributed limit.

### Allowed scope

Inspect full diffs, ancestry, tests, and living docs. Rebase, cherry-pick, or split the three active changes into independently reviewable PRs. Update `docs/DECISIONS.md`, `docs/STRATEGY.md`, `docs/ARCHITECTURE.md`, related tests, and PR descriptions as required for truth. Prefer one behavioral concern per PR. This list is an expected surface, not a prohibition on adjacent changes needed to keep tests or canon coherent.

Do not change accounting semantics merely to make a rebase easy. Do not merge, close PRs/issues, mutate schemas, or deploy without Jonathan's approval.

### Acceptance / proof

- Fetch and record the then-current `origin/main` SHA and each PR's base/head before rewriting anything.
- Produce a commit map showing where every retained commit from #63/#61/#62 went; explicitly list anything intentionally dropped and why.
- No resulting PR contains duplicate decision IDs. Decision prose distinguishes shipped `main`, active branch work, and future proposals.
- Due-on-open remains a preview: no auto-post; per-item and post-all still reach existing Confirm guards.
- Budget editing still changes plans only, never actuals or journal rows.
- The `main-` chat alias is covered without widening arbitrary `*.workers.dev` origins. Limiter copy/tests say “best effort” unless an atomic shared limiter is actually proved.
- Run the shared verification suite plus relevant Hercules, recurrence, and budget tests. Include `git range-diff` or an equivalent before/after proof in the PR.

### Risk / gate

Risk is accidental loss, duplicate canon, or bundling. Stop if a branch contains unreviewed household data, secrets, schema application, or behavior beyond its PR description. Jonathan chooses merge order and authorizes merges. If the decision-number recommendation changes, document the chosen allocation before code lands.

### Handoff

Hand off a base/head map, clean PR links, decision-number map, dropped/retained commit table, test output, and recommended merge order. Name the exact SHA from which Packet 2 should branch. The next implementation packet is the network/mode stop-ship fix, whether or not lower-risk UI PRs are ready.

---

## Packet 2 — P0 stop-ship: Google-account cloud continuity

### Goal

Make Google sign-in discover the person's personal ledger and household memberships, then synchronize accepted commands automatically. No device is the host. Keep PGlite ingestion and hosted transport as separate failure domains, but do not require `linked`, a phrase, Pass file, or explicit publish for ordinary access.

### Why now / evidence

The audited client couples local ingestion and hosted upload, while later D-110 work moved toward explicit opt-in publishing. Both models miss the clarified product: a new Google-signed-in device must work without the old device online, and both personal and household scopes must follow the identity. Current boot reconciliation also needs accounting/hash acceptance rather than trusting entry-count equality.

### Allowed scope

Refactor identity/membership discovery, engine/API/App orchestration, naming, status types, and tests. Split “compile/accept local books” from “synchronize hosted continuity,” add a durable outbox, and make personal versus household scope explicit. Clarify UI so local acceptance, pending continuity, conflict, and synchronized are independent truths.

Do not delete already uploaded rows, rotate production credentials, alter the live schema, or deploy. Produce a separate cleanup inventory/runbook if orphan/demo rows may exist; execution requires Jonathan.

### Acceptance / proof

- A fresh device signs into Google and discovers the correct personal and household ledgers while the original device is offline.
- An accepted command synchronizes once through a durable idempotent outbox; offline/cloud failure preserves local acceptance without claiming synchronized.
- Personal and household scopes are distinct and selected by identity/membership, not a client-only visibility filter.
- Pulled snapshots with the same entry count but changed financial content are rejected or reconciled before persistence/display.
- Phrase, Pass, and legacy `linked` households migrate without becoming the normal access gate.
- Tests use disposable Development fixtures and label the temporary open hosted boundary honestly.
- Run shared verification and focused API/Supabase/books tests, including injected fetch failures.

### Risk / gate

This is continuity and money-integrity work. Temporary open read/write access is accepted through 2026-09-30, but schema application, hosted-row cleanup, key changes, Production, and deployment still require Jonathan's explicit approval.

### Handoff

Provide a before/after call graph for boot and commit, fetch-spy evidence, a list of any likely previously uploaded demo/unlinked rows without their contents, exact mode semantics, and the residual path to Packet 3. State plainly whether any network can still happen before a household opts in and why.

---

## Packet 3 — P0 containment: enforce environment boundaries and one member-scoped AI disclosure projection

### Goal

Make Development/Production separation a checked invariant at every ingress and create one auditable, member-scoped projection for all model-bound Hercules content. Users must be able to tell when a model is used and what class of household data leaves the phone; partner-personal amounts, notes, aggregates, claims, and derived figures must not escape through a side channel.

### Why now / evidence

- A Hearth Pass keeps its embedded environment, but `src/Pairing.tsx` applies it without comparing the selected pill; `src/storage.ts:81-87` then persists under the payload's environment.
- Supabase pull filters row metadata but does not validate returned payload identity/environment.
- Development and Production share one Supabase project and current isolation is a column/query, while the snapshot primary key is only `household_id`.
- `src/core/herculesPrivacy.ts:123-137` filters recent rows, but `:139-148` calculates category aggregates from full-household `monthSummary`; the request composer still receives the full household. Existing tests do not place canary partner amounts in every serialized field.

### Allowed scope

Introduce a central environment assertion and apply it to pass import, join, demo/start, local load, merge, publish, and model calls. A cross-environment pass must be rejected with a clear choice or require an explicit environment switch before any persistence; never switch invisibly.

Create one typed model projection for the active member. Derive briefing, notices, memory labels, claims, figures, category summaries, and the D-105 capped recent ledger excerpt from that projection. Minimize duplicate representations such as sending both a broad ledger object and `ledgerLines`. Keep provider secrets Worker-side. Add disclosure/mode UI consistent with accepted model-first behavior; if the change would revise D-104 or D-105 semantics, write a proposed decision and obtain Jonathan's approval rather than quietly reversing canon.

Schema changes are proposal/rehearsal scope only here. Do not apply them to Production.

### Acceptance / proof

- Table-driven tests cover environment mismatch at pass, join, local load, merge, publish, snapshot response, and AI request boundaries. Each rejects or explicitly switches before persistence/network.
- Supabase responses validate row `household_id`, `invite_phrase`, and `environment` against the payload; corrupt or mismatched rows fail closed with a useful diagnostic.
- The UI pill, storage key, envelope, PGlite namespace, hosted predicate, and audit row agree after every supported transition.
- Final serialized model-request tests seed unique canary notes **and amounts** in partner-personal transactions, category totals, notices, memories, claims, figures, and recent rows; none appear for the other member.
- D-105's 18-row cap and safety/on-device bypasses remain tested. The model never receives a whole `Household` object past the projection boundary.
- User-facing copy distinguishes on-device Hercules from a remote model and names the data class sent without claiming Auth-grade privacy.
- Run shared verification plus Hercules/privacy/API/pass/storage tests. Include a sample redacted final payload made only from synthetic data.

### Risk / gate

Environment mixing can corrupt real books; AI leakage is a disclosure failure. No permissive fallback is acceptable. A new composite hosted identity or RLS policy must be designed with Packets 7–8 and rehearsed in disposable Development before any live migration. Jonathan approves changes to accepted AI disclosure policy and any production schema/data action.

### Handoff

Provide an ingress invariant matrix, synthetic canary test results, before/after model payload schema, UI disclosure screenshots or recordings, proposed schema implications, and all unresolved policy choices. Hand Packet 4 the exact accepted local envelope and projection contracts.

---

## Packet 4 — P0 money integrity: make PGlite acceptance fail closed and crash recoverable

### Goal

A money command becomes visible only after the proposed household compiles into valid, balanced PGlite books. A compile, transaction, validation, persistence, or crash failure must leave one recoverable state; automatic hosted continuity happens only after local acceptance through Packet 2's outbox.

### Why now / evidence

Commands clone and return JSON (`src/core/commands.ts:116-134`). `src/App.tsx:302-347` saves the snapshot and updates React before calling books sync. `src/ledger/engine.ts:310-317` can commit the PGlite write, then return `{ ok: false }` for imbalance/equation failure rather than throw and roll back. Current failure is a soft `booksStatus`, not a command rejection.

### Allowed scope

Design a write coordinator around the command boundary. Validate/compile before acceptance, use a PGlite transaction that throws on invalid books, and add a staged envelope/commit marker or equivalent crash-recovery protocol so merely reordering JSON and PGlite writes does not create the opposite split-brain. Classify which non-money settings may remain available if books are unhealthy; all money-changing commands must fail closed. Preserve command purity and Confirm semantics.

Refactor storage/engine/App status and recovery UI as needed. Do not make Supabase the commit arbiter and do not publish a candidate that local books rejected.

### Acceptance / proof

- Fault-injection tests fail at command validation, compile, PGlite begin/write/validate/commit, JSON/IDB persistence, UI handoff, refresh during each phase, and hosted transport. At every point, recovery yields either the complete prior state or the complete accepted next state—never a half state.
- An imbalanced trial balance or failed accounting equation throws inside the books transaction and cannot update React, JSON, IDB, audit hash, outbox, or cloud.
- A PGlite-unavailable device cannot post, reverse, transfer, receive, shift, or execute another money command. The UI explains how to recover without implying the write happened.
- A cloud outage after a valid local commit does not roll back the books; it creates the explicit continuity/outbox state without lying about synchronization.
- Existing balanced command and statement tests remain green. Add restart/recovery and idempotent replay coverage.
- Run shared verification plus books/ledger/write-safety/storage tests and document the durable state machine.

### Risk / gate

Highest accounting risk. Do not accept “the next boot will probably repair it” without a deterministic recovery marker and test. Do not change journal meaning, rounding, signs, Toronto dates, or closed-month policy as incidental refactoring. Accounting-semantic changes require Jonathan review.

### Handoff

Deliver the write-state diagram, failure matrix, recovery procedure, proof that no rejected candidate escaped to transport, and any command categories deliberately excluded. Packet 5 must build opening balances only through this accepted write path.

---

## Packet 5 — P1 foundation: First Numbers and explicit opening balances

### Goal

Give Jonathan and Bianca a guided, truthful starting point: choose an as-of Toronto date, enter real account and debt balances in CAD, review the balanced opening entry, and Confirm once. Post opening balances against a dedicated opening-equity account/source—never fake historical income, expense, or cash flow.

### Why now / evidence

The journal type permits `source: "opening"` at `src/core/journal.ts:37`, but the compiler at `:205-261` and current commands create no opening entry. New households catalog accounts and otherwise begin at zero. `docs/STRATEGY.md` still names opening balances in the north-star loop.

### Allowed scope

Define and document the accounting decision, then implement an explicit opening-balance draft/command, compiler path, opening equity account, onboarding/re-entry UX, statements, audit trail, export, and Hercules explanation. Support assets, liabilities, and zero/unknown choices without coercing estimates. Allow review and correction through reversal/replacement rather than destructive rewrite after posting.

Existing households must not receive invented backfill. Offer an opt-in migration path or leave them untouched. Hercules may teach, summarize, and prepare the draft, but only the member's Confirm posts it.

### Acceptance / proof

- Property/table tests cover asset debit balances, liability credit balances, mixed accounts, zeros, cents, negative/invalid input, duplicate confirmation, Toronto date edges, refresh, and both environments.
- Every opening set balances exactly to opening equity; trial balance and accounting equation hold. Opening entries do not appear as period income/expense and statements explain beginning equity/cash correctly.
- The command is idempotent for the same confirmation key. A second opening set is blocked or handled through an explicit reviewed adjustment policy.
- Existing households and demos retain their current numbers until a person opts in; no automatic migration fabricates history.
- The preview shows each account, debit/credit effect in understandable language, total opening equity, as-of date, and the fact that Confirm writes the books.
- Reversal/correction produces an audit trail and respects closed months. PGlite fail-closed tests from Packet 4 cover the new command.
- Run shared verification plus journal/statement/command/onboarding tests and capture a synthetic end-to-end First Numbers walkthrough.

### Risk / gate

Opening equity, cash-flow presentation, liability signs, and adjustment semantics change financial meaning. Jonathan must approve the decision and UX language before merge. Do not infer balances from bank data, a spreadsheet, or existing incomplete transactions.

### Handoff

Provide the accounting memo/decision ID, example journal lines, statement before/after fixtures, migration behavior for existing households, walkthrough evidence, and known exclusions. Hand Packet 6 the durable command receipt needed to correct an opening set safely.

---

## Packet 6 — P1 trust: corrections and durable, concurrency-safe undo

### Goal

Make correction promises truthful across refresh and two phones. Posted Production money is corrected through reversing entries (and, when appropriate, a confirmed replacement). Limited undo for eligible recent commands must be durable, tamper-evident, bound to an expected revision/hash, and expressed as an inverse command—not by restoring an old whole-household snapshot.

### Why now / evidence

`reversePostedMoney` already ships (`src/core/commands.ts:1647-1719`) and closed-month/reopen rules exist. Generic history starts empty in React (`src/App.tsx:160`) and is advertised as “on this phone.” Worse, `UndoToken` (`src/core/commands.ts:1722-1752`) restores the prior full snapshot and tombstones every current transaction/shift absent there. The App checks only the most recent session token (`src/App.tsx:369-379`), so a stale post-sync undo can tombstone a partner's new rows.

### Allowed scope

Audit every command and classify it as: posted-money reversal; safe inverse command; settings/plan rollback; or non-undoable with an explicit correction route. Introduce durable command receipts/events with command ID, actor, environment, base revision/hash, affected record IDs, inverse intent, expiry/policy, and audit result. Replace misleading copy and recent-history UI. Integrate with fail-closed writes and prepare receipts for Packet 7's CAS/outbox.

Cursor may temporarily reject all stale generic undo if that is the safest bridge. Never persist and later replay a full prior household snapshot over merged state.

### Acceptance / proof

- Reload tests prove eligible undo/correction remains discoverable and produces the same reviewed inverse behavior.
- Two-phone tests prove a receipt created at revision N cannot erase or tombstone partner work merged at N+1. Stale receipts reject with a useful route to a fresh correction.
- Posted transactions are never deleted. Reversal lines reference the original, balance, respect Toronto dates, and keep the audit trail. Closed-period correction requires the accepted reopen/next-period policy.
- Duplicate undo/reversal requests are idempotent. Tampered, expired, wrong-member, wrong-household, and wrong-environment receipts fail closed.
- UI copy distinguishes “undo this eligible local change,” “reverse posted money,” and “correct with replacement.” No promise depends on a still-open React session.
- Tests cover First Numbers, transfers, recurrences, shifts, receivables, plans, goals, personal rows, tombstones, refresh, and merge interleavings.
- Run shared verification plus write-safety/sync-integrity/command tests and include a command classification table.

### Risk / gate

High money-integrity risk. Do not expand undo convenience at the cost of the audit trail. Production correction policy and closed-month behavior require Jonathan approval. If CAS is not yet available, reject stale cross-device undo rather than simulate safety.

### Handoff

Deliver the command classification, receipt schema, stale-token behavior, reversal examples, concurrency tests, UI truth changes, and exact dependency on Packet 7. Call out any legacy snapshot tokens still accepted and their containment/removal plan.

---

## Packet 7 — P1 push-native sync (D-149; supersedes prior CAS/outbox-only framing)

**Canonical plan:** [`docs/SYNC_ARCHITECTURE.md`](../SYNC_ARCHITECTURE.md) and slice prompts [`docs/briefs/sync/README.md`](sync/README.md).

### Goal

**Tier 1:** Migration 012 atomic Shared+Personal SQL + Supabase Realtime for **100–500 ms** partner visibility (4 s poll fallback only). **Tier 2:** command-log primary, materialized snapshots, confirmation-scoped undo. Execute slices T1-S1 through T1-S6 before Tier 2.

### Why now / evidence

Live pull uses 4 s REST poll (`src/continuityLivePull.ts`). Personal+Shared can be two trips; D-147 treats partial failure as pending. Whole-snapshot transport remains heavy at month scale (D-145 slimmed local outbox only).

### Handoff

Use per-slice prompts in `docs/briefs/sync/`. Do not re-litigate D-122 CAS client or D-145 outbox — extend them. Packet 7 acceptance = Tier 1 gates G1–G6 in SYNC_ARCHITECTURE.md.

---

## Packet 7 (archived text) — P1 convergence: atomic multi-device CAS and a durable idempotent outbox

*The following remains historical context; implementation follows D-148 tiers above.*

### Goal

Make every signed-in device converge without last-writer loss or peer-device dependency. A hosted write must atomically compare the expected ledger/environment revision and hash, accept exactly once or return a conflict, then pull/merge/validate/retry through a durable ordered outbox. Personal-ledger and household-ledger writes need explicit scopes.

### Why now / evidence

Current reconcile pulls once (`src/api.ts:68-75`), pure-merges in `src/core/sync.ts`, then issues plain PostgREST upserts for household and snapshot (`src/ledger/supabase.ts:138-170`). Two phones can both pull S, produce S+A and S+B, and last-writer-drop A or B. There is no durable offline retry queue. The snapshot primary key also conflicts with Development/Production identity.

### Allowed scope

Design a v2 contract around `(ledger_scope, ledger_id, environment, actor_id, expected_revision, expected_hash, idempotency_key)`. Use a server-side RPC, Worker/edge boundary, or database transaction capable of atomic CAS; never expose a service-role credential to the browser. Add a durable outbox with explicit states, bounded conflict loop, pull/merge/PGlite-validate/CAS retry, backoff, and actionable dead-letter state.

Co-design identity/membership with Packet 8. PGlite remains each device's books engine/offline replica and the hosted service supplies durable continuity. Code and disposable Development read/write rehearsal are allowed; Production schema/data changes are not.

### Acceptance / proof

- A deterministic two-client harness exercises: simultaneous new transactions, same-record edits, deletes/tombstones, reversal vs edit, personal rows, goal contributions, opening entries, offline replay, duplicate delivery, reordered delivery, process restart, and network failure between each server step.
- Server CAS accepts one expected revision/hash atomically; the loser receives conflict, pulls, pure-merges, validates in PGlite, and retries. Final state contains all non-conflicting work and the documented winner for true conflicts.
- Each command/idempotency key has one audit outcome under retries. Household/snapshot/audit cannot partially commit.
- Outbox survives reload, preserves ledger scope, environment, actor, and Google-account mapping, exposes stuck state, and cannot bypass Confirm or the command boundary.
- Composite environment identity is enforced in app and server contract. Cross-household/environment writes fail before merge.
- Property tests demonstrate convergence, associativity/idempotency where claimed, and tombstone non-resurrection. An integration test uses a disposable Development database or faithful transactional harness.
- Provide migration, backfill, verification, rollback, and row-count/checksum plans without executing Production changes.

### Risk / gate

This is a protocol and schema change. A client-only “revision check” followed by an upsert is not CAS. A PostgREST pair of requests is not atomic. Do not use a privileged key in Vite/browser code. Jonathan must approve Development schema application and separately approve any Production migration/deploy.

### Handoff

Deliver the protocol spec, state machine, database/RPC proposal, interleaving test report, migration/rollback dry run, threat notes, and performance envelope. State exactly which guarantees await Packet 8 authentication and do not label the transport production-safe until those gates pass.

---

## Packet 8 — dated late-September security cutover: Google Auth, ledger membership, and deny-by-default RLS

### Goal

Before 2026-10-01, replace temporary open Development access with Google-authenticated identity, durable personal-ledger and household/environment membership, controlled invitation redemption, and deny-by-default row policies. Jonathan and Bianca must retain seamless new-device recovery.

### Why now / evidence

`supabase/migrations/001_hearth_books.sql:292-319` grants anon/authenticated read/write/delete with unconditional policies. The browser bundles a publishable key. `docs/sql/rls_auth_ready.sql` is only illustrative, refers to `members.auth_user_id` that current schema lacks, and is not a safe migration. There is no Supabase Auth client/dependency. D-020 GitHub 2FA also remains an explicit operational security decision.

### Allowed scope

Write a fresh Auth/RLS v2 design: Google identity/session flow, user-to-personal-ledger mapping, household/environment membership, invitation issue/redeem/revoke/expire, owner/member recovery, audit attribution, least-privilege RLS, and integration with the CAS boundary. Preserve the three-word phrase only as a non-secret invitation aid if useful.

Build migrations and tests for a disposable Development project, plus backup/export/restore and rollback plans. Update UI/onboarding and living decisions. Do not apply `docs/sql/rls_auth_ready.sql`, do not expose service-role secrets, and do not enable gated bank/card/private-document features merely because Auth code exists.

### Acceptance / proof

- Automated policy matrix proves: anonymous denied; unaffiliated authenticated user denied; member allowed only for their household and selected environment; revoked member denied; Production membership does not imply Development access (or vice versa) unless explicitly designed and approved; service boundary has only required privileges.
- Invite tests cover one-time use, expiry, replay, wrong household/environment, revocation, collision, recovery, and two existing phones.
- CAS/outbox writes are attributed to an authenticated member and remain idempotent. No browser request can enumerate all households or overwrite another household by changing an ID.
- Development migration starts from the real v1 schema, passes checksums/counts, can roll back or restore, and has a rehearsed cutover plan for existing household rows.
- Session expiry/offline behavior is understandable and does not strand accepted local books; after re-authentication, continuity resumes without requiring another device.
- Security documentation accurately states what Auth/RLS protects and what AI vendors still receive under disclosed model use.
- Run shared verification, Supabase policy/integration tests, secret scanning, and a manual two-user Development walkthrough.

### Risk / gate

Critical dated access-control and migration work. Temporary openness may accelerate disposable Development testing through 2026-09-30, but meaningful October data is blocked until the policy tests and reviewed cutover pass. Jonathan separately authorizes Production migration. Bank feeds, Interac, cards, and private hosted sources remain gated.

### Handoff

Provide the threat model, entity/policy matrix, fresh migration files, Development rehearsal evidence, invite/recovery walkthrough, rollback/export package, and list of still-gated destinations. Hand Packet 9 the exact required checks and protected environments.

---

## Packet 9 — P0 parallel guardrail: CI, branch protection, preview truth, and deploy guards

### Goal

Make a passing reviewed commit—not a branch name or direct push—the only path toward Production. All PRs and active branch prefixes get test/typecheck/build proof; deployment depends on verified CI, has one authority, uses an approval-protected Production environment, and emits post-deploy truth evidence.

### Why now / evidence

`.github/workflows/ci.yml` covers `main` and `cursor/**` but not this roadmap's `codex/**` push branch. `.github/workflows/pages.yml` independently builds/deploys without depending on test CI. Repository metadata showed `main` unprotected with zero required contexts. Cloudflare Git integration can also create previews, so workflow and provider authority must be audited together. At current `main`, `wrangler.jsonc` has no KV binding; #63's fallback counter is per-isolate and its KV `get`/`put` approach is not atomic.

### Allowed scope

Unify or explicitly sequence CI and deployment. Run install/test/typecheck/build for every PR targeting main and for relevant pushes including `cursor/**` and `codex/**`; add focused integrity/security tests as required. Configure or document branch protection, required reviews/statuses, GitHub Production environment approval, concurrency/cancellation, artifact provenance, and one deploy authority across GitHub and Cloudflare integration. Add post-deploy smoke checks for HTML `no-store`, build marker/SHA, SPA route, environment label, and `/hercules/chat` origin/rate guard.

Add lint, coverage thresholds, E2E/a11y, dependency/security scanning, and migration dry-run incrementally where signal is real; do not create noisy gates that teams learn to ignore. Repository workflow changes are allowed. Actual provider/admin setting changes and deployments require Jonathan.

### Acceptance / proof

- A PR cannot reach the Production job unless install, unit/integration tests, `tsc --noEmit`, and `pnpm build` passed for that exact SHA. Artifacts/deploy inputs are pinned to it.
- CI triggers are proven for PRs plus `main`, `cursor/**`, and `codex/**` pushes. Fork/secret behavior is safe.
- Branch-protection checklist requires PR review and named contexts on `main`; direct-push and force-push policy is explicit. If settings cannot be applied in code, provide exact admin steps and screenshots/evidence after Jonathan applies them.
- Production deploy has a manual environment approval, concurrency lock, rollback artifact, and one declared authority. Preview deploys are labeled non-Production and cannot mutate Production books/schema.
- Post-deploy smoke fails on wrong build SHA, cache policy, route, or chat-origin guard. No smoke test sends real household data or calls a paid model unnecessarily.
- The limiter is described as best effort unless an atomic cross-isolate resource is bound and tested. Missing rate infrastructure cannot be hidden by a green unit test.
- Add forbidden-file/secret checks and ensure neither household snapshots nor provider keys enter artifacts/logs.
- Demonstrate the pipeline on a non-production PR/preview; do not run the Production job.

### Risk / gate

Workflows can deploy or consume secrets. Keep permissions least-privilege, pin third-party actions, and avoid `pull_request_target` with untrusted code. Jonathan approves branch-protection/admin settings, Cloudflare integration changes, resource bindings, secrets, and every Production deploy.

### Handoff

Deliver workflow diffs, trigger matrix, branch/environment settings checklist, preview run links, artifact/SHA proof, rollback steps, and a clear “Production not deployed” statement. Name the readiness gates that remain before Packet 10 can accept sensitive import formats.

---

## Packet 10 — P2 books loop: reconciliation inbox and confirmed import adapters

### Goal

Extend the shipped manual reconciliation into a local-first statement/CSV inbox: parse an explicitly selected source, preserve provenance, propose deterministic matches, and let the member review each create/match/split/transfer/ignore action. Only Confirmed existing commands may change books. Imported files and rows never become an alternate ledger.

### Why now / evidence

`recordReconciliation` (`src/core/commands.ts:1796+`) and the Books reconciliation form/history (`src/Books.tsx:298-328`) ship, but they record a manually typed statement figure. Hercules correctly says “I compare. I don't import the bank” (`src/core/hercules.ts:479-487`). No inbox, parser, or match-to-command path exists.

### Allowed scope

Begin with local CSV/text adapters for a deliberately small, documented set of statement shapes. Normalize dates/amounts/descriptions locally, hash the source for provenance and duplicate detection, keep raw files off hosted snapshots, and stage immutable inbox items. Build deterministic candidate matching by account, signed amount, Toronto date window, merchant/reference, transfer pair, and already-imported provenance. Provide review, bulk-confirm only when every row is visible, reconciliation difference, and audit history.

Use existing commands or add reviewed commands at Confirm. Hercules may explain uncertain matches but cannot author or post them. No Google Sheets, Apps Script, `clasp`, bank feed, mailbox scraping, or silent OCR in this packet. A future user-selected file adapter must still obey the inbox boundary; bank APIs, receipt clouds, and private hosted documents remain gated by Auth/RLS and separate approval.

### Acceptance / proof

- Parser fixtures cover headers, quoting, decimal cents, debit/credit conventions, negative/refund values, Toronto date boundaries, duplicate files/rows, transfers, fees, malformed rows, huge files, formula injection, encoding, and personally identifying descriptions.
- Selecting/parsing/previewing a file changes no household, JSON snapshot, PGlite row, outbox, or cloud request. Network-spy tests prove local processing.
- Every proposed action displays source row, account, amount, date, category/match, confidence/reason, and resulting command. Confirm invokes the command boundary; cancel leaves books byte-for-byte unchanged.
- Duplicate import is idempotent. Partial review survives reload without putting raw private source data in hosted snapshots. Deleting an inbox file does not delete posted books or audit provenance.
- Matching never auto-merges two money events. Transfers balance; splits sum exactly in cents; ambiguous candidates remain unconfirmed.
- Reconciliation shows statement ending balance, books balance, cleared/uncleared items, and difference without claiming a bank connection.
- Fault injection through Packet 4 and replay through Packet 7 prove confirmed rows cannot half-post or duplicate.
- Run shared verification plus parser fuzz/property tests, command/reconciliation tests, accessibility/phone walkthrough, and a synthetic end-to-end import fixture.

### Risk / gate

Imports amplify errors quickly and carry private descriptions. Keep raw parsing local, sanitize spreadsheet formulas even though Sheets is not supported, cap resources, and require review. Jonathan approves supported formats, provenance retention, and any future hosted/OCR/bank scope. Auth + RLS must be complete before a private source crosses the device boundary.

### Handoff

Provide supported-format contracts, fixture corpus, privacy/data-flow diagram, match rules and false-positive report, Confirm-to-command map, reconciliation walkthrough, and explicit unsupported/gated sources. Close with Dual Course deltas and the next unbounded opportunities discovered—do not imply this packet completes Hearth's roadmap.

## Stack order and parallelism

The safest default is:

1. Packet 1 creates a clean, uniquely numbered base.
2. Packet 9 begins in parallel: require verified PR checks and stop unchecked Production delivery first; mature preview, provenance, and rollback guards alongside the architecture packets.
3. Packet 2 establishes Google-account cloud continuity and removes `linked`/explicit-publish as the normal access model.
4. Packets 3 and 4 close disclosure/environment and local-books acceptance gaps before new money primitives.
5. Packet 5 adds First Numbers on the fail-closed path.
6. Packet 6 replaces unsafe snapshot undo with explicit correction semantics.
7. Packets 7 and 8 should be co-designed; CAS and continuity can use disposable open Development rows now, while the Auth/RLS cutover must complete before meaningful October data.
8. Packet 10 builds import on top of commands, fail-closed books, durable receipts, and safe sync.

Parallel work is welcome when branches have crisp contracts: UI copy/fixtures can proceed alongside protocol design; Auth policy tests can proceed alongside CAS harnesses; CI can add non-deploy checks early. Do not parallelize two edits to the same decision IDs, migration chain, or write coordinator without an integration owner.

## Final instruction to Cursor

Treat these packets as a launch stack, not a boundary on judgment. Inspect the repository, state what changed since `75574e4`, and surface a better sequence if evidence demands it. Keep the laws and proof gates. Do not revive Sheets/Apps Script/`clasp`. Do not read museum planning folders. Do not mutate Production data or schema and do not deploy without Jonathan's explicit approval.
