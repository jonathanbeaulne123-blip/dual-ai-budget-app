# Sync foundation spike — 2026-09-07

## Measured findings first

| Unknown | Result |
|---|---|
| JS entry → TypeScript SQLite Durable Object | GO: Wrangler 4.125.0 bundles and Development responds HTTP 200, `sqlite: 1`. First deployment startup 9 ms. 20 sequential remote HTTP probes: p50 49.13 ms, p95 260.22 ms, max 508.04 ms (includes initial requests). Not T_partner. |
| Real Supabase token / cached JWKS | INCOMPLETE: live public JWKS has 1 ES256 P-256 key, 0 HS256 keys. No real session token verified; cached verification samples = 0. Browser connector timed out then reported debugger unattached; native console opening did not expose a console. No JWT secret requested or installed. |
| Validation cost, 5,056 transactions | Full compile n100: p50 17.06 ms / p95 62.14 ms. Trial balance + equation n100: 1.75 / 5.15 ms. Actual isolated staged PGlite cold n1: 6,860.74 ms; warm incremental n20: 843.09 / 1,878.83 ms. |

**Incremental GO for bounded postings**, with indexed reference context and an explicit affected-entry path for global edits. Local prototype compiles a single expense, validates safe integer line cents and entry balance, and updates trial/equation accumulators: p50 0.02259 ms / p95 0.09995 ms per operation, measured as 100 batch means of 100 operations. After 10,000 additions, running totals exactly equal full recomputation. This is local CPU feasibility, not live DO/SQLite, individual-operation p95, Toronto LTE, or receiver-paint proof. No asynchronous validation/auto-reversal fallback selected.

Fixture n5: p50 926.34 ms / max 1,021.80 ms, below 2 seconds. Contains 5,056 transactions, 640 shifts, 4,608 compiled entries. Duplicates the fixed 158-row demo 32 times and remaps pair/reversal/refund and shift references within each copy. Does not call or repair buildScaleFixture.

## Scope and authority

Status: investigation spike; wire freeze blocked, real-token gate incomplete. Base current origin/main `44c5931132176553a74dc6d8668356073e811b62`; branch `codex/sync-foundation-spike`. Risk **High**; isolated Development diagnostic only. Budget delta (5): **+2**, proves cheaper blocking validation is feasible and exposes money migration conflicts. Engagement delta (3): **0**, no UX changes; this prepares faster partner visibility.

User's replacement instructions supersede snapshot/CAS/Realtime/poll and isolated staging sync mechanics. They do not authorize silently changing money meaning. The vocabulary documents conflicting D-036, D-119, D-124 money removal/Undo/Restore behavior and current duplicate recognition. Those commands are not migrated. No financial behavior, Supabase schema, migration application, Production, secrets, household rows or membership rules changed. The explicitly requested Development DO `new_sqlite_classes` class migration is part of the authorized Worker deployment; no Supabase or D1 migration applied.

## Vocabulary deliverable

[OP_VOCABULARY.md](../sync/OP_VOCABULARY.md) was published before completing the remaining work. Covers 148/148 core mutation producers plus 15/15 additional receipt/acceptance families. Core classification: A16, B33, C2, NO-FIT97. Existing receipt kinds fall back to dynamic labels, so there is no finite wire-string enum. NO-FIT is an investigated finding, not a new accepted wire primitive. A closed kind union, atomic mixed-primitive envelope, mutable fact lifecycle rules and omitted state policy remain decisions before Prompts 3/4 can implement a complete protocol. No claim of a completed four-class freeze.

## Measurement method and limits

Node runtime bundled with Codex; actual repository PGlite 0.5.x and Postgres 18.3 in memory. `scripts/benchmark-sync-foundation.ts` measures actual `validateHouseholdBooksStaged` with compiled artifact, accepted audit hash, and previous household, as supplied by the current commit path. Cold includes initialization/schema and 20,216 changed rows. Warm reports `writeMode: incremental`, 7 changed rows, `ok: true`. Hash/compile artifact generation sits outside staged timing. Browser IndexedDB/worker startup and total Confirm latency are not measured.

`scripts/benchmark-sync-delta.ts` is a synthetic expense prototype, not a production operation compiler. Trial balance and booksEquation both walk data; equation calls trialBalance again. The prompt's claim that the checks themselves are not O(ledger) is incorrect. Compiler still dominates this CPU run; staged validation dominates all three. `projectedCountable` requires reversal ancestry and transfer-pair context; account kind changes affect historical openings; duplicate recognition changes existing entries. These need indexed dependency invalidation or a bounded bulk route. Running trial debit/credit totals must account for per-account sign crossings, not merely sum every debit and credit ever posted.

Host load matters: an earlier diagnostic CPU run measured compile p95 10.98 ms and trial/equation 1.60 ms; the corrected staged-artifact run above measured 62.14/5.15 ms. An initial warm-stage diagnostic lacked accepted hashes and fell back to full ingestion; it is excluded from the incremental results. Samples are not LTE physical devices. T_partner samples = 0.

Reproduce from the checkout root with its Node runtime on PATH:

```sh
node node_modules/.pnpm/vite-node@*/node_modules/vite-node/vite-node.mjs scripts/benchmark-sync-foundation.ts
node node_modules/.pnpm/vite-node@*/node_modules/vite-node/vite-node.mjs scripts/benchmark-sync-delta.ts
```

If multiple vite-node versions are installed, select the one associated with this checkout's Vitest. The measurement runner was vite-node 3.2.4; the fresh locked installation resolves Vitest 3.2.7. The scripts only construct synthetic data and memory PGlite. No credentials or actual household exports are needed. Public JWKS does not expose symmetric signing secrets, so absence of an HS256 public key alone cannot rule out legacy HS256 session issuance.

## Deployment

First live deployment: source SHA `a957c847f7723461fef9903d83ceba6aa5a9e1a1`, Worker `hearth-sync-spike-development`, version `5556301c-2eba-43e2-9346-9696a7283690`. URL: https://hearth-sync-spike-development.jonathan-beaulne123.workers.dev/sync-spike. Isolated named environment has only diagnostic DO, assets and public Supabase URL; intentionally omits existing provider/data bindings. Root household Worker is not deployed. `/sync-spike/verify` refuses missing/invalid credentials; successful verification returns only algorithm/cache/timing and a boolean that auth id was extracted. The diagnostic does not establish household membership and must not authorize money.

## Verification and remaining work

Independent code/privacy review found no blocking defect in the diagnostic; requested signed ES256, tampering, expiry, wrong issuer and disabled-environment tests were added. Initial quick-gate attempts failed on a borrowed node_modules symlink and incomplete borrowed dependencies, then on new Worker typing; installed locked local dependencies and corrected spike typing rather than changing unrelated app code. Final commands/results recorded below after completion. No exhaustive lanes run; quick evidence is not release evidence.

Net additions outside src/sync and workers/sync are intentional: this task explicitly delivers a reusable fixture, focused tests, reproducible benchmarks and knowledge documents, without deleting working transport before its replacement exists.

Next owner: Jonathan resolves money-meaning conflicts; real signed-in Development console access completes token verification. Protocol implementers may use the producer inventory now but must not treat NO-FIT rows as approved operations. Two Toronto LTE devices and actual paint instrumentation remain required for the series target.
