# SF-04 — Opening truth

**Target AI:** ledger/onboarding implementer with independent books review  
**Baseline:** accepted SF-03 head  
**Risk:** Release  
**Deltas:** budget `+5`; engagement `+1`

## Outcome

Jonathan and Bianca can establish truthful opening cash, credit, debt, receivable, and ownership positions once, review the balanced journal effect, confirm explicitly, and recover safely on every device.

## Tasks

1. Define an idempotent opening-position command using CAD integer cents and `America/Toronto` civil dates.
2. Reuse current account editing; collect statement date, balance, balance type, ownership/visibility, and evidence status. Do not invent institution balances.
3. Preview balanced journal lines and equity/opening-offset treatment before Confirm.
4. Support correction by append-only adjustment/reversal, never silent history rewrite.
5. Scope progress and drafts to the authenticated member; accepted Shared results synchronize to both co-owners.
6. Gate all balance-based alerts, forecasts, buffers, and “available” claims on opening-truth completeness and freshness.

## Invariants

Assets, liabilities, and credit signs cannot collapse into one convention. Transfers are not income/expense. Private accounts remain private. A linked/imported account is not reconciled merely because it has a balance. Confirm remains the writer.

## Acceptance scenarios

- Positive chequing, negative/owed credit card, loan, receivable, and zero-balance account each produce balanced expected lines.
- Refresh/retry cannot duplicate the opening entry.
- Partner cannot see or infer a private opening balance.
- Correction preserves the original and provides a clear audit trail.
- Incomplete opening truth suppresses risky alerts and labels forecasts provisional.

## Verification

Domain/property tests for balanced entries and signs; idempotency/reversal/privacy tests; fresh-device replay; accessible 390/720/1100 px flow; independent books and privacy review; `pnpm check`. Synthetic Development fixtures only.

## Stop conditions

Unbalanced journal, duplicate opening, sign ambiguity, private leak, destructive edit, invented provider truth, or automatic posting blocks completion.

## Forbidden actions

No Production mutation, remote migration, provider connection, real household data, deployment, merge, or push. Stop for Jonathan's explicit approval if any becomes necessary.
