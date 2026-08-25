# Hercules Brain v2 — Slice 1 typed read tools

**Status:** implemented locally on `codex/hercules-brain-v2-tools`; review required. No deploy, schema application, hosted mutation, secret change, or Production contact.

## Outcome

Hercules can now use model judgment to choose up to four deterministic financial reads while the phone keeps custody of the books. Ten capabilities cover balances, transaction search, spending, income, comparison, upcoming bills, shifts, goals, money owed, and cash position. Results use D-132 typed provenance cards.

## Boundary

The planner receives only the question plus current page/view. It returns names and bounded arguments from a strict catalog. The Worker and phone both discard unknown tools/arguments. The phone applies the active member/view projection before every calculation. There is no generic query, SQL, code execution, write, or Confirm path.

OpenAI uses Responses strict function tools with storage disabled; Anthropic uses tool schemas; Workers AI uses constrained JSON. If selection fails, the existing Hercules chat/local fallback answers. Ordinary cat talk skips planner latency.

## Files

- `src/core/herculesTools.ts` — catalog, parsing, scoping, deterministic execution, typed results.
- `src/core/herculesPlanner.ts` — guarded planner client, timeout, financial routing, write refusal.
- `workers/site.js` — `/hercules/plan`, provider adapters, server-side sanitization.
- `src/Hercules.tsx` / `src/Books.tsx` — execution, display, source navigation.
- `test/hercules-tools.test.ts` / `test/hercules-worker.test.ts` — catalog, privacy canaries, mutation proof, endpoint/provider contract.

## Remaining gate

Independent review should inspect every calculation, Personal/Household canaries, provider response shapes, transaction-versus-account source routing, and planner timeout behavior. Deployment remains a separate explicit decision.
