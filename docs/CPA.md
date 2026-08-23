# CPA review (D-081)

Claude’s accountant memo, adjudicated against **current `main`**, not against `c643da4`.

This is Course A sequencing. It is **not** a license to invent CAD, open a bank feed, or claim SOC. Widgets still never `postEntry`.

## What Cursor kept

| Item | Verdict | Why |
|---|---|---|
| Void deletes the posted row | **True.** `voidPostedMoney` filters the transaction out, tombstones the id, labels the activity `Removed`. Undo restores from the prior snapshot. That is not a reversing entry. | A CPA who asks “can this number vanish?” gets “yes, with undo on this phone.” That is the real gap. Changing it to `reverseEntry` is a **money-meaning** change. It waits on Jonathan. |
| Closed month is confirm-to-restate | **True, and already product.** `requireOpenPeriod` throws `NeedsConfirmationError`; `confirmClosedMonth: true` posts. Audit Office copy already says confirm is the restatement. A hard lock (nothing posts, prior-period adjustment only) is a second money-meaning change. Same gate. | Do not silently harden the lock. |
| PGlite `writeBooks` replaces the household | **True of the local compile.** Hosted transport is still snapshot replace (D-033 / D-034). Append-only sync vs last-write-wins is an architecture program, not a widget. | Do not pretend `audit_revisions` is an immutable log of every row that ever existed. |
| Auto-coding from merchant tokens | **Keep, later.** `detectRhythms` + `duplicate` tokens are the engine. Prefill category; Confirm still writes. On-device. | Not this PR. |
| Bank feeds | **Refuse.** D-039. RLS is still `USING (true)`. | Rec surface stays **typed statement balance** / future CSV·OFX. Same UI later; different input. |
| AP mirroring AR | **Keep as a later kernel slice.** Receivable already exists (D-053). Payable + accrue-on-incur is money meaning. | Not a Home widget. |
| Tip tax sequester | **Keep the mechanic, refuse a confident CAD figure.** Transfer into savings; show the rate; let it be edited. | Invented CAD if the rate is hidden. |
| Multi-currency | **Defer.** `CURRENCY = "CAD"`. No foreign amount to post. | Enterprise cosplay until a real FX row exists. |
| `journal_lines.created_by` | **Keep, honestly.** `createdBy` on the document is a claim, not Auth. | Do not market as SOC. Schema bump when we next touch lines. |
| Who-owes-whom | **Shipped as a projection.** Personal-account expenses vs ownership splits. Settle with `postTransfer`. Not Interac. | Joint-paid rows do not create a spouse IOU. |

## What Cursor corrected

**`hashBooksSnapshot` already digests amounts, dates, splits, shifts, goals, claims, and presets.** `test/sync-integrity.test.ts` asserts two books with the same ids and different cents hash differently. Claude’s “hash is blind to ids-only” line was true of an older story, not of this tree. This pass adds **tombstones** to that digest so a Remove still changes the integrity facts after the row is gone from `transactions`.

## Pitch — do not say these to a CPA

- “Total audit readiness” while Remove deletes the row.
- “SOC-level compliance” while there is no Auth and hosted RLS is `USING (true)`.
- “Assets − Liabilities = Net Income” as *the* accounting equation. The equation is **Assets = Liabilities + Equity**. `booksEquation` is a **closing check**: net worth equals retained net income *because this household opened at zero and has no draws*. Hercules already chips `A = L + E`.

## Build order (after Jonathan’s call on Remove)

1. **Jonathan:** keep Remove + undo, or switch to reversing entries + a real period lock.
2. Auto-coding prefill (Confirm still writes).
3. AP / accrual toggle.
4. Statement-file rec (CSV/OFX), still not Plaid.
5. Line-level `createdBy`, named as a claim.
6. Tip-tax sequester with a visible rate.
7. FX when a foreign amount exists.

Desktop office (D-080) is a different surface. The Office v2 HTML prototype is a **390px sketch of desktop tools** (sizes, paper stock, personalities). It does not replace `OfficePhone`. Parked: [packets/office-v2-proto.html](packets/office-v2-proto.html).
