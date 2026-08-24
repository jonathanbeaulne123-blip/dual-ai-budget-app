# Hercules main-host and meter salvage

**Status:** Implemented for review from stale PR #63. No deployment, Worker secret, KV binding, hosted row, schema, or Production ledger data changed.

## Outcome

- Hercules chat accepts the exact Git production alias `main-hearth-books.jonathan-beaulne123.workers.dev`.
- Arbitrary named Worker aliases and unrelated `workers.dev` hosts remain denied.
- The chat meter keys on Cloudflare's client IP instead of client-supplied household data.
- Missing KV uses bounded per-isolate memory instead of disabling the meter.
- Missing IP metadata shares an `unknown` bucket instead of bypassing the meter.

## Boundary

The in-memory fallback resets with Worker isolates and is not a globally consistent production counter. Bind `HERCULES_RATE` KV for durable enforcement. This slice does not change Hercules prompts, models, journal disclosure, command authority, UI, budgets, or ledger semantics.

## Verification

- Focused Worker guard suite: **7 tests passed**, covering the live host, Git main alias, preview host, rejected lookalikes, KV-backed IP buckets, bounded memory buckets, missing-IP behavior, and the real Worker call site.
- Full serial repository suite with a wider local timeout: **51 files, 374 tests passed**. Three unrelated five-second timeouts from an earlier slower run also passed when rerun alone (**45 tests**).
- TypeScript `--noEmit`: passed.
- Production Vite build: passed with the existing PGlite browser-external/eval and chunk-size warnings.

## Dual Course

- **Budget delta (5): `0`.** No financial calculation, command, or journal meaning changed.
- **Engagement delta (3): `+1`.** Hercules can answer on the Git production alias the household actually opens while the model-billing guard stays active.
- **Why Dual Course holds:** this is bounded companion transport with no route into money writes; the existing Confirm and journal boundaries are untouched.
