# Hearth worksession — First Numbers / opening truth

- **Status:** PROPOSED — product locks required before implementation
- **Opened:** 2026-08-25 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** new `codex/` branch after PR #100 disposition
- **Baseline:** current `main` at start
- **PR or issue:** none
- **Risk:** High (opening assets, liabilities, and equity)
- **Environment impact:** local command/UI/tests only; no hosted schema, migration, Auth/RLS, secrets, Production data, or deployment

## Household outcome

A new household can tell Hearth what is actually in each bank, cash, savings, investment, credit, and receivable account on one Toronto as-of date. The review visibly balances every opening asset/debt against dedicated Opening equity. One Confirm creates the starting books without pretending the money was earned, spent, transferred, or received inside Hearth.

## Budget delta (5)

`+5` — statements, budgets, reconciliation, and leftover begin from real balances instead of zero or fabricated history.

## Engagement delta (3)

`+1` — Hercules may explain “these are your starting numbers” after Confirm, but never judges the balance or writes it.

## Proposed implementation

1. Add a pure opening-balance draft/projection: Toronto as-of date, selected existing accounts, signed CAD cents, ownership/visibility, and a balancing Opening equity line.
2. Add one `postOpeningBalances` command through the existing atomic acceptance/idempotency boundary. Source is explicitly `opening`; it affects balance sheet/equity only, never P&L, ordinary cash flow, budgets, duplicates, recurrences, or work income.
3. Add a short phone flow and a denser desktop review: choose date → enter assets/debts → review balanced entry → Confirm. Zero remains skipped. Back/edit is always available before Confirm.
4. Add Health, statements, sync/hash, reversal/repost, fresh-household, and accessibility proofs. Existing continuity JSON carries the new source; no hosted table or migration is needed.

## Product locks required

1. **Entry point:** recommend showing setup automatically while a household has no accepted money, plus a permanent Accounts/More entry for later use.
2. **Account scope:** recommend using existing accounts in the first slice, with a clear Add account link that returns to setup; do not build a second account editor inside the wizard.
3. **Personal scope:** recommend one session may enter shared plus the current member’s Personal accounts; another member enters their own Personal opening truth from their account.

## Frozen accounting behavior

- Opening values use integer CAD cents and one Toronto civil as-of date.
- Positive asset balances debit the asset; credit/debt balances credit the liability; Opening equity is the exact balancing side.
- No opening row counts as income, expense, transfer activity, budget actual, work income, or a recurring event.
- Confirm is the only write. A rejected or duplicate confirmation changes nothing.
- Posted opening truth is never silently edited or deleted. Correction follows the current environment’s explicit restore/reversal law.
- Cloud continuity may carry the accepted snapshot/outbox, but this worksession does not touch migration or hosted schema files.

## Acceptance evidence

- [ ] Accounting equation and trial balance hold for assets-only, debt-only, and mixed openings.
- [ ] Income statement, ordinary cash flow, budget actuals, and work reports remain unchanged by opening rows.
- [ ] Personal/shared visibility and member projection preserve the right lines across device replicas.
- [ ] Repeated Confirm posts exactly once; any validation/ingest/persist failure leaves the previous household readable.
- [ ] Phone and desktop show the complete as-of date, account, signed amount, and equity impact before Confirm.
- [ ] Full tests, AI verification, TypeScript, build, and local responsive QA pass.

## Handoff

Jonathan: lock the three product choices. Codex can then implement this lane without touching Cursor’s migration work.
