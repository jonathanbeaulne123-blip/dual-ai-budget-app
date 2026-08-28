# Hearth Household Fund — implementation and review handoff

## Status and exact baseline

- **Household outcome:** Jonathan and Bianca have a truthful virtual shared operating fund whose real money remains in Bianca's savings, with manual September clearing and an inert read-only October evidence gate.
- **Repository:** `dual-ai-budget-app`
- **Branch:** `codex/household-fund`
- **Base:** `origin/main@efbe5ed5118b0e6c2c942d318dd4e9643eb163d1`
- **Implementation SHA:** `34f3ca2dc3d4aaf71b332482c297380da6d39152`
- **Release integration SHA:** `95a403fb4b302950e9f7777914e348d0a7d3bec1` against `main@3740c5c3c78f1f874c5b7ce38c1b572a6e465d06`
- **PR:** #237; branch pushed; Jonathan approved merge and ordinary app deployment. D-162 provider activation remains blocked.
- **Risk:** High for September financial meaning; Release before provider activation or daily-use switch
- **Decision owner:** Jonathan
- **External reviewer:** Gemini Pro reviewed the complete patch for the exact implementation SHA; Jonathan retains the push/release decision

## Why now and Dual Course result

September needs a zero-opening-balance rehearsal before October bank evidence can be trusted. The Fund improves the books before adding a provider.

- **Budget delta (5): `+5`.** Confirmed operating balance, destination clearing, repeated upcoming reserves, exact deficits, private custodian reconciliation, append-only corrections, scoped replay hashes, and PGlite validation are financial facts.
- **Engagement delta (3): `+2`.** Home and Books give the household one routine: contribute, mark Fund use, transfer, reconcile, and roll safe surplus into Kitty Banks.
- If these conflict, the books win. The Fund UI cannot invent, move, or hide money.

## Implemented behavior

- `Account.scope` is `shared | personal`; legacy accounts shape as shared. Personal account metadata is carried only in its owner's Personal envelope.
- The Fund is an append-only subledger, not a chart account or bank account. Contributions, purchase/refund funding, settlements, Kitty movements, reconciliation, verification, and reversals retain immutable lineage.
- Contribution receipt, settlement, reconciliation, Kitty rollover, reversal, and connected-mode activation are custodian-only commands. Proposals and purchase funding remain available to either member.
- Funding amount and destination are independent of transaction Household/Personal visibility. Personal purchases use a separate public Fund position id, so Personal transaction ids and source accounts do not enter Shared facts.
- The projector derives operating balance, transfer due/credit, every remaining recurrence occurrence through month end, free-to-spend, top-up, target progress, and safe rollover.
- Settlement acceptance validates chronological operating balance, destination, per-position remaining cents, exact allocation sum, append-only history, and stale-device replacement attempts before PGlite or persistence.
- PGlite schema 3 adds constrained/indexed Fund projection tables and account scope. A schema-2 upgrade fixture proves existing accounts migrate as shared.
- Command receipts retain shared and Personal audit hashes. A Fund-changing Personal command emits shared Fund facts while omitting the Personal transaction; replay verifies the corresponding scoped hash.
- Home shows the Fund glance and permanent custody disclosure. Books has contribution, transfer/allocation, month plan, private Bianca reconciliation, Kitty rollover, monthly report, and audit history. Add keeps visibility and Fund use as separate controls. Repeating bills can reserve Fund amounts.
- October matching is provider-neutral and read-only. Only one unique exact match or an exact selected group can append verification evidence. Extra, competing, near, duplicate, and unmatched rows cannot create money facts. Only matched rows contribute stored digests.

## Invariant laws for review

1. Hearth never claims to hold or move the savings money.
2. Balance increases only on Bianca's confirmation; proposals do not increase it.
3. Settlements cannot exceed both confirmed operating balance and the destination's unsettled positions.
4. Historical purchases remain recordable during a deficit; new planned Fund commitments are blocked until top-up.
5. Refund before settlement reduces due; refund after settlement creates visible credit.
6. Corrections append reversals/reallocations; original events are never overwritten.
7. Bianca's account identity, bank total, Personal remainder, and Personal transaction rows stay out of Jonathan's view, Shared export, Hercules context, and shared command events.
8. Bank evidence may verify an existing Hearth event only. It never posts an expense, contribution, or settlement.

## Verification evidence

- Canonical example proved: $1,000 confirmed contribution, $100 Fund purchase, $60 partial settlement, then $20 refund produces $940 operating, $20 due, and $920 free before reserve.
- Focused root proof: 12 files / 75 tests passed.
- Independent trust proof: 11 files / 76 tests passed; the former settlement-order race passed 10 repeated independent runs. Root also passed it 10 repeated runs.
- Complete gate: `pnpm check` passed — AI surface verified; 156 test files passed / 1 live-only skipped; 1,049 tests passed / 2 live-only skipped; TypeScript and production build green.
- Current-main release integration: AI surface verified; 160 test files passed / 1 live-only skipped; 1,065 tests passed / 2 live-only skipped; TypeScript and production build green. The only initial failures were missing Windows Bash/Python shims, then the same tests and build passed with the bundled runtimes.
- Independent books and privacy/trust reviewers: no remaining P0/P1.
- Gemini Pro exact-SHA review: `PASS`; no P0/P1 findings. Its only P2/P3 notes were that the month-end helper correctly avoids JavaScript date overflow and that extremely deep reversal chains could add projector overhead.
- Browser proof on fictional local Development data: widths 320, 390, 720, 1100, and 1280; no horizontal overflow or console errors; Home disclosure and Fund route work; Bianca reconciliation is absent in Household view and present in Personal view; Fund form controls are labeled.
- `git diff --check` and modified-file secret-pattern scan: clean.

### Reproduction commands

From the named SHA with Node and pnpm available:

```sh
pnpm exec vitest run test/household-fund.test.ts test/household-fund-pglite.test.ts test/household-fund-continuity.test.ts test/household-fund-ui.test.ts test/continuity-command-realtime.test.ts test/continuity-command-outbox.test.ts test/materialize-snapshot-from-events.test.ts test/materialize-snapshot-pull.test.ts test/sync-integrity.test.ts test/snapshot-payload.test.ts test/visibility.test.ts test/hercules-pro-write.test.ts
pnpm check
git diff --check efbe5ed5118b0e6c2c942d318dd4e9643eb163d1..34f3ca2dc3d4aaf71b332482c297380da6d39152
```

## Continuity, data, and release disclosure

- **Identity:** existing exact Google-subject membership authority; no new identity authority.
- **Ledger scopes:** Shared receives Fund config/plans/events/allocations and scoped receipts. Each member's Personal envelope receives only their Personal accounts/transactions; only the custodian receives Fund bindings and reconciliation totals.
- **Offline/outbox:** PGlite remains the accepted local books engine. Idempotent receipts and scoped materialization facts replay after reconnect; no peer device must remain online.
- **Environment:** fictional/local Development-shaped data only.
- **Hosted mutations:** none.
- **Schema:** local PGlite schema 3 only; no public Supabase table or remote migration added.
- **Network:** local browser preview plus a sanitized exact-implementation patch sent to Gemini for review. No household data, Flinks, Supabase, deployment, or Production request was involved in that review.
- **Secrets:** none entered, printed, or committed.
- **Real household or partner-Personal data:** none used in proof.

## Explicit non-scope and remaining gates

- No live institution support check, Flinks credentials, provider smoke, remote migration, secrets, bank action, or daily-use switch occurred. Jonathan separately approved PR #237 merge and the ordinary app deployment; that approval does not activate D-162 bank connectivity.
- Gemini exact-SHA review is complete. It requires no code change before push.
- September's real two-phone weekly rehearsal and month close remain a household/device gate.
- October must first verify Bianca's institution and savings support through the existing secure Flinks boundary. If unsupported, stop and return provider options; statement import does not satisfy the live-connection promise.
- Immediately before secrets, remote migration, deployment, or Production, obtain Jonathan's explicit approval and run the Release review again.

## Expected reviewer return

Return: verdict (`PASS`, `PASS WITH NOTES`, or `FAIL`), exact SHA reviewed, P0/P1 findings with file/line evidence, financial-example result, privacy/authority result, full/focused commands run, remaining Release gates, and a clear recommendation on whether the branch is safe to push for review. Do not merge, deploy, enter secrets, contact the provider, or mutate hosted/Production state.
