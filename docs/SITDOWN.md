# Sit-down — the kitchen table

This is the monthly conversation the app was started for. Plan tab, both shells. The postcard is a glance, not a fourth stamp on the phone. Hercules reads act 1 out loud and **never posts**.

Laws: [DECISIONS.md](DECISIONS.md) D-083–D-087. Dual Course: leftover, lock, reverse, and transfers are Course A (weight 5). The three-act ceremony and Hercules lines are Course B (weight 3).

## Research taken

- **YNAB leftover-as-job** — leftover is money that still needs a job after bills and card mins. Not Mint “safe to spend.”
- **Typeform one-question** — three acts, not a daily quiz. Pause/resume is a household session row.
- **Linear cycle review** — a sit-down record you can look back at.
- **Ramp correction loop** — a recode teaches the next merchant guess (`dismissedRhythmKeys` already had the shape; frequency voting is the teacher).
- **Duolingo lesson shape** without streak death or shame. Act 1 is specific true things, not a grade.
- **QuickBooks/Xero close pack** — journal, trial, plan-vs-actual, claims, then lock and export.

## Research refused

- Guilt, hunger meters, streak death.
- Bank feeds / auto-post / LLM coding (D-039, D-057).
- Editing an existing household Sheet (would need a new scope).
- Auto-lock when you tap Confirm moves (traps milk if today is still in that month).
- Killing `reopenBooksMonth` (a forgotten receipt must not be a trap).
- Rebuilding sync as append-only streams this pass (architecture program; lock + reverse are the money-meaning slice).
- A new 18th Home widget. Phone stays five objects. Sit-down lives on Plan.

## Leftover (D-083)

Visible in the UI:

`cash-like − outgoing bills next 30 days − credit minimums = leftover` (floor zero)

Cash-like is chequing + savings + other (D-047). Bills use the same outgoing filter as D-076 (never paychecks). Minimums come from `creditCardView.minPaymentCents`. Month net can be high while chequing is low — it is **not** leftover.

If leftover is zero, sit-down still runs. Act 3 says why. It does not invent CAD.

## Plan, then one Confirm

1. **Act 1 — positives.** Posted-shift streaks, days posted, categories under plan, claims that landed. Tap a figure for the rows.
2. **Act 2 — information.** Leftover arithmetic, trial tick, category movement, forecast, anomalies (hydro 40% over its own history). CPA and kid, same view.
3. **Act 3 — leftover jobs.** Weights, percents, and fixed amounts, mixable. Last-party remainder is the same rule as `percentSplits`. Mixing percent with weight treats the percent number as a weight and labels it “% as weight.” Over-allocation is obvious and refuses to move. Confirm runs transfers. Copy jobs still seeds `budgetPlans` (`applySitDown`). Lock last month is optional. Download always works; Drive is create-only.

Jar line: transfer leftover source → savings **and** `contributeToGoal` so the pig matches the parking lot. If there is no separate savings account, the jar tracks and cash stays put — the warning says so.

## Spouse script (Development demo)

Use **Development**. Do not touch Production.

1. Open the demo kitchen. Tab **Plan**. Sit-down is three acts.
2. Act 1: read the positives. Tap one. You should see posted rows, not a score.
3. Act 2: read leftover math. Cash-like minus bills minus card mins. Tap an anomaly or a category. Trial should tick if Health is clean.
4. Act 3: leave Hearth’s proposed weights, or type Jonathan’s example shape (vacation 5 / investment 1 / new car 2 — demo jars/cards will differ; the engine is the same). If leftover is positive, Confirm moves. If leftover is zero, read why — do not invent CAD. On Development you may post extra income first if you want to watch a transfer. Books → ledger: those rows are **transfers**, never income.
5. Copy jobs if next month has no plan yet. That still posts nothing.
6. Download workbook. If Google Drive is linked and Drive is enabled, Save to Drive. Failure is a quiet line; download still worked. The snapshot must not grow a spreadsheet body.
7. Lock **last** month from sit-down or Books → Close pack. Try Add milk dated in that closed month — it must refuse until you Reopen.
8. On an **open** month row, Ledger → **Reverse**. Original stays. A reversing entry appears dated today. Undo from the toast restores the pre-reverse snapshot.
9. Add a grocery with note `No Frills`. If the demo has enough No Frills history, category may prefill. Confirm still writes. Change the category if it is wrong — that is the correction loop.

Kill criterion: posting milk on an open day must stay one Confirm. Sit-down is monthly, never a daily gate.

## Auto-coding uses wired

1. Add form prefill from merchant tokens.
2. Sit-down act 2 anomalies + forecast (same engine).
3. Books close pack: likely-miscoded list + split guess on Add. Never auto-posts.
