# Hercules Brain v2 — Slice 1 typed read tools

**Status:** implemented on `codex/hercules-brain-v2-tools`; PR #115. Review intentionally deferred to the pre-September comprehensive pass. No deploy, schema application, hosted mutation, secret change, or Production contact.

## Outcome

Hercules can now use model judgment to choose up to four deterministic financial reads while the phone keeps custody of the books. Sixteen capabilities cover balances, transaction search, spending, income, comparison, upcoming bills, shifts, goals, money owed, cash position, budgets, categories, credit cards, net worth, audit health, and duplicate review. Results use D-132 typed provenance cards.

## Boundary

The planner receives only the question plus current page/view. It returns names and bounded arguments from a strict catalog. The Worker and phone both discard unknown tools/arguments. The phone applies the active member/view projection before every calculation. There is no generic query, SQL, code execution, write, or Confirm path.

Workers AI uses constrained JSON first. Paid OpenAI/Anthropic adapters remain for explicit future opt-in, but checked-in `HERCULES_ALLOW_PAID_PROVIDERS=false` prevents keys alone from contacting them. Gemma 4, then Llama 3.1, handles planning; Gemma also attempts selected-image vision. Deterministic tool results may receive one small grounded voice pass. If selection or voice fails, the existing local answer remains. Ordinary cat talk skips planner latency.

## Files

- `src/core/herculesTools.ts` — catalog, parsing, scoping, deterministic execution, typed results.
- `src/core/herculesPlanner.ts` — guarded planner client, timeout, financial routing, write refusal.
- `workers/site.js` — `/hercules/plan`, provider adapters, server-side sanitization.
- `src/Hercules.tsx` / `src/Books.tsx` — execution, display, source navigation.
- `test/hercules-tools.test.ts` / `test/hercules-worker.test.ts` — catalog, privacy canaries, mutation proof, endpoint/provider contract.

## Cost and remaining gate

Expected use is two people asking one or two questions daily. Cloudflare's Workers AI Free allocation is 10,000 neurons/day and Workers Free hard-stops at the allocation rather than charging. External paid providers are disabled. Independent review remains bundled into the pre-September pass; it should inspect every calculation, Personal/Household canaries, provider response shapes, transaction-versus-account source routing, and planner timeout behavior. Deployment remains a separate explicit decision.
