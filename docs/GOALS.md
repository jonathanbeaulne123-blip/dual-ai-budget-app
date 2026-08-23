# Goals vault

Leftover is still **cash-like − outgoing bills next 30 days − credit minimums**, floored at zero (D-083). Month net is not leftover.

When leftover is positive and sit-down Confirm moves jar lines, cash transfers into a dedicated **Goals vault** savings account (`purpose: "goals"`, seed `ACC-GOALS`). Everyday high-interest savings stays general HIS. Pigs on the desk are envelopes on that vault — YNAB sinking funds in one account, not twenty-four bank logins.

Laws: [DECISIONS.md](DECISIONS.md) D-016 / D-052 / D-055 / D-073 / D-083 / D-085 / D-088 / D-089.

## Research taken

- **YNAB** — one HYSA, virtual envelopes. The pig fills; the bank account is the vault.
- **Monzo / Copilot pots** — named pockets without a second ledger.
- **Apple Fitness rings** — progress you can see, not shame when a ring is empty.
- **Duolingo / Finch** — retirement home is a trophy shelf, not a streak death.

## Research refused

- Mint safe-to-spend.
- Deleting contribution rows or the original pig when you buy the rug (D-085 / D-052).
- Hercules posting the purchase.
- An 18th Home widget for accomplished goals. Retirement home is a shelf inside Jars and Plan.

## Purchase

When a pig is full, **Purchased?** asks how much it actually cost (optional itemized lines). Confirm runs `purchaseGoal`:

1. Posts expense(s) from the Goals vault.
2. Appends a `GoalPurchase` receipt (the vault’s itemized ledger).
3. Sets `goal.status = "retired"`. Contributions stay.

If they spent less than the envelope, the remainder stays in the vault as unallocated. If they would raid another open pig, the command refuses — transfer extra in first.

## Dual Course

Course A: leftover parking destination, purchase as a real expense, append-only receipt. Course B: pigs fill, Purchased? pops, retirement home. The books win if they conflict.
