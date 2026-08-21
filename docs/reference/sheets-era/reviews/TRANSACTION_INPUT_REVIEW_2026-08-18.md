> **Reference only — not a bible.** Snapshot of the Google Sheets / Apps Script era (`v0.0.31`, git `f2db836`, tag `sheets-v0.0.31`).
>
> Jonathan’s latest instruction, the live files in `docs/` (outside this folder), and the TypeScript app are current. Read this to see how the project moved, not as today’s product law.
>
> Apps Script source is not in the working tree. Recover it with `git show sheets-v0.0.31:Code.gs`.

# Transaction Input Review — 2026-08-18

## Status

- Static code and development-workbook structure review: complete.
- Live development-sheet tests: pending.
- Production changes: none.
- Tracking issue: [#1 Transaction Input end-to-end](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/1)

## Review goal

Confirm that Jonathan and Bianca can add accurate transactions quickly, that each submission produces one complete ledger record, and that ordinary configuration changes do not require code edits.

The review is risk based. Financial-record integrity and the stated load of approximately 500 transactions per month take priority over cosmetic improvements.

## What is already working well

- The dialog offers explicit Income/Expense selection, filters subcategories by type, supports Joint/Shared ownership, and prevents another click while one submission is in flight.
- The server resolves category metadata from the authoritative Categories table instead of trusting names sent by the browser.
- Dates are parsed in the spreadsheet timezone.
- Raw and normalized records are written by header name rather than fixed column position.
- The development workbook currently has one active account, and its currency matches the currency already used by Transactions and Raw Transactions.
- A successful transaction requests an immediate Budget/Dashboard/Income History refresh.

## Confirmed findings

| ID | Priority | Finding | Evidence and impact | Recommended direction |
|---|---|---|---|---|
| TXN-01 | High | A submission is not an atomic operation. | `getOrCreateManualBatch_()` increments `Record_Count` before the date is parsed. The raw row, normalized row, four helper formulas, change log, and summary refresh then happen as separate writes. An exception between them can leave an incorrect batch count, a raw-only record, or a transaction missing formulas. | Validate the complete request before the first write. Execute the commit under a document lock and implement a narrowly scoped rollback or repair path for rows created by the failed attempt. |
| TXN-02 | High | ID allocation and row placement are not concurrency safe. | `nextSequence_()` scans for `max + 1` without a lock, and the target Transactions row is calculated separately with `getLastRow() + 1`. Two users or two open dialogs can select the same IDs/row. The disabled button only prevents repeat clicks inside one browser dialog. | Hold one document lock around validation, ID allocation, batch update, and both ledger writes. Recheck all assumptions after acquiring the lock. |
| TXN-03 | High | Duplicate detection stops at row 5,000. | `Potential_Duplicate_Flag` uses a fixed `COUNTIF(...$5:$5000...)` range. At 500 transactions per month this covers roughly ten months, below the 12–24 month stress-test target. Later duplicate keys can be missed. The same formula exists in Add Shift. | Remove the fixed cap. Prefer script-side duplicate evaluation against the real data extent or a bounded indexed data structure that can be tested without Sheets. |
| TXN-04 | Medium | Server validation trusts several browser-controlled values. | The server does not restrict `type` to Income/Expense, verify that the selected subcategory belongs to that type, validate a nonblank member against active members, or enforce whole-cent precision. A stale or altered client can write inconsistent records. | Add a pure validation/normalization function with deterministic tests. Reject mismatched type/category/member combinations and amounts that cannot be represented safely as currency cents. |
| TXN-05 | Medium | Manual account selection does not scale beyond today's single active account. | `getActiveAccountId_()` silently selects the first active account. The shared manual batch stores one `Account_ID`, so its metadata becomes misleading when entries can target multiple accounts. | Add account choice before enabling multiple active accounts. Define whether manual batches are per account, per session/import, or intentionally account-neutral. |

## Product and usability observations

- The UI reports success even if the summary refresh fails because `refreshBudgetSummarySilently_()` suppresses the error. The transaction itself may be valid, but the user should receive a nonblocking “saved, dashboard refresh pending” warning.
- The form marks a manually entered row `Is_Duplicate = No` before its duplicate formula is evaluated. A second deliberate submission can therefore affect totals until reviewed. A pre-write warning with an explicit “add anyway” path would be safer.
- The browser supplies the default date from the device clock, while the server interprets it in Toronto time. The server-generated Toronto date should be rendered into the form to avoid a near-midnight/device-timezone mismatch.
- The dialog has a fixed 420 × 480 size. Mobile/interface expansion is now deferred, so this is a known constraint rather than a current release gate; backend transaction services must still remain independent of this modal implementation.
- The source and current development workbook consistently label values `USD`, but Jonathan confirmed on 2026-08-18 that every current account and transaction is actually CAD. Correct the labels/configuration without converting amounts through [#10 Make CAD the authoritative transaction currency](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/issues/10), kept separate from the transaction-safety work.

## Missing automated coverage

The repository checks syntax and maintenance functions, but it does not test Transaction Input validation, ID allocation, duplicate handling, or write-failure recovery. Pure validation and write-plan functions should be extracted and tested before the high-risk changes are released.

## Live development test matrix

Run these only on the development spreadsheet with a recorded baseline of the relevant row counts and batch count.

1. Add one valid Expense and verify exactly one Raw Transactions row, one Transactions row, four live helper formulas, the correct ownership/category/account links, one batch-count increment, and refreshed summaries.
2. Add one valid Income and repeat the same verification.
3. Try blank, zero, negative, excessive-decimal, malformed-date, stale-category, type/category mismatch, and invalid-member inputs. Verify that none changes any sheet or batch count.
4. Submit the same transaction twice and verify the warning/review behavior and that totals follow the chosen duplicate policy.
5. Submit from two open sessions at nearly the same time and verify unique IDs, two complete row pairs, correct formulas, and an exact batch count.
6. Force or simulate a failure after each write boundary and verify that no partial record remains.
7. Verify the retained Sheets dialog workflow for accurate submission and feedback; mobile/interface expansion remains deferred.

## Recommended implementation order

1. TXN-01 and TXN-02 together: preflight validation, document lock, guarded commit, and recovery.
2. TXN-04: pure server validation/normalization plus automated tests.
3. TXN-03: remove the row-5,000 limit in both Transaction Input and Add Shift.
4. Apply the accepted CAD and account-selection decisions through separately reviewed work; keep non-code interface expansion deferred.
5. Execute the retained development-sheet integrity matrix; defer responsive/interface design.

No production deployment should occur until the high-priority findings pass automated and development-sheet verification.
