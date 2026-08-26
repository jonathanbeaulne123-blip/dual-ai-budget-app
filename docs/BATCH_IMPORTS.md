# Batch imports

## Outcome

Books → Import accepts selected QFX/OFX bank exports and selected JPEG, PNG, or WebP images of receipts, bills, bank statements, and card statements. Every detected row is a proposal in a review inbox. Nothing reaches the books until the person presses the final **Confirm**.

This is selected-file intake, not a connected bank feed. No bank credentials or continuous account access are involved.

## Flow

1. Choose one or more `.qfx` / `.ofx` files, take a document photo, or choose existing document images.
2. Hearth parses bank files on the device. A selected image is sent once to `POST /documents/scan` for structured detection. The Worker tries its bound Workers AI vision model first; paid OpenAI/Anthropic fallbacks run only when the paid-provider flag is explicitly enabled.
3. Hearth maps exact statement account last-four values, then uses on-device description context to propose transaction coding before applying the existing duplicate confidence scorer. An unambiguous category name can choose that category. For internal transfers, an exact other-account last-four, an unambiguous account name, or a repeated transfer pattern from the visible ledger can fill the other account. A description such as `ONLINE PAYMENT TO VISA 4412` can therefore become a chequing → Visa transfer without a manual field choice.
4. The same open review appends later QFX/OFX and receipt selections, so receipt evidence can match a payment imported earlier or later in the batch.
5. Before duplicate choices, the totals panel checks available statement equations and receipt arithmetic. An available mismatch blocks final Confirm. A missing statement opening balance is labelled skipped and does not block.
6. The review popup separates rows into:
   - **Confident:** confidence `> 90`; the imported row starts cancelled.
   - **Not sure:** confidence `50–90`; the person must choose before Confirm.
   - **Probably not a duplicate:** confidence `< 50`; the imported row starts kept and otherwise untouched.
   Complete rows at `20%` or below are auto-kept but omitted from the visual review; they still enter only after the final Confirm. A low-score row that lacks a required account, type, category, or transfer destination remains visible for that missing accounting detail.
   Counts for unresolved duplicate choices and missing transaction details are actionable links. Selecting either centers and focuses the immediate decision or missing field, then advances to the next required issue—even if an edit changes that row's confidence tab—until final Confirm is ready. Choosing **Keep imported / Keep both** also advances this queue.
7. Each candidate shows the imported row next to the likely existing Hearth row or earlier batch row. The person may cancel the import, keep both, keep the import and exclude the old posted row, or keep one of two batch rows.
8. One final Confirm posts every kept row through ordinary `postEntry` / `postTransfer`, then through `acceptHouseholdWrite` (PGlite acceptance, local persistence, and eligible continuity transport). Cancel changes nothing.

Excluding an old posted row sets its reviewed duplicate flag. It is never physically deleted. One batch produces one undo snapshot.

## File behavior

- OFX 1.x SGML and OFX 2.x XML/QFX bank and credit-card statement blocks are supported.
- FITID plus the source account reference becomes stable provenance. Files without FITID receive a deterministic row fingerprint.
- Multiple files and long histories are accepted. A single file has a 50 MB safety limit; split a larger export into date ranges and select all parts together.
- Currency must be CAD before Confirm. Investment-statement trades are not imported.
- Hearth maps the statement account only on exact last-four match, or when there is exactly one eligible account. It never silently guesses among several accounts.
- A transfer keeps the statement account plus an editable direction and other-account choice. The other account may be proposed from an exact last-four, an unambiguous Hearth account name, a uniquely matching active account kind, or at least two matching visible-ledger transfer examples. Thus `transfer from chequing` resolves when the known statement account is not chequing and exactly one other active chequing account exists. Institution-only and account-kind wording stays unresolved when it could mean more than one account or merely repeats the statement account's own kind.
- External e-transfer wording never uses an account-kind shortcut or learned transfer history. Only an exact internal account name or last-four may override that external-rail guard.
- Context coding runs on the phone. It uses only transactions visible to the signed-in member in the active Household or Personal view; it does not send statement descriptions or ledger rows to Hercules or another model.

## Exact reconciliation

- When a QFX/OFX account includes both opening and closing balances, Hearth proves `opening + signed imported transactions = closing` in integer cents. A one-cent difference blocks final Confirm. If either balance is unavailable, the check is `skipped`, never falsely labelled balanced.
- Receipt detection returns item amounts only, never item names. Hearth checks item sum against subtotal and checks `subtotal - discounts + tax + tip + fees = total`; the detected transaction row must carry that same total.
- Before proposing another expense, a receipt searches staged expense debits and posted expenses visible to the signed-in member in the active view within two calendar days. Transfers and refunds are never treated as receipt payments. One unique exact subset of up to four payments is selected; ambiguous subsets are left for the person.
- An exact one- or multi-payment selection clears the receipt without posting a second expense. A balanced receipt with no payment match can remain a new expense proposal. If item amounts are unreadable, an exact payment total is required.
- One payment may clear only one receipt. Competing automatic suggestions are removed, and competing manual selections block Confirm until the person chooses which receipt owns that evidence.
- Subset search is bounded at household scale. When more than 18 nearby candidates make uniqueness expensive to prove, Hearth shows the full candidate list and requires a human exact selection instead of treating the receipt as unmatched and posting another expense.
- Receipt/payment matching is evidence resolution, not duplicate scoring. The existing `>90`, `50–90`, `<50`, and hidden `≤20` duplicate defaults remain unchanged for ordinary transaction rows.

## Camera/document detection

- The image is submitted only after the person takes or chooses it.
- Supported image types: JPEG, PNG, WebP. Limit: 10 MB per image.
- The Worker tries the bound Cloudflare Workers AI vision model first. OpenAI vision and Anthropic image input are disabled unless `HERCULES_ALLOW_PAID_PROVIDERS=true`. Keys remain Worker secrets and never enter Vite or the household.
- Printed instructions, QR text, and URLs inside a document are untrusted data. The extraction prompt tells the provider to ignore them.
- The Worker returns document kind, currency, account last four, rows, and per-row extraction confidence. It never returns or stores full account/card numbers. For receipts, deterministic sanitization retains the merchant and numeric fields but replaces model description text with `Receipt total`, drops the reference, and drops model warnings so item names cannot leak through those fields.
- Raw image bytes are not written into the household, PGlite, Supabase, or app logs by this feature. The client keeps only a SHA-256 source digest (with a deterministic fallback) and normalized row provenance.
- Receipt detection returns one total row plus numeric item/subtotal/discount/tax/tip/fee fields; item names are neither requested nor retained. Bill detection returns one due row. Statement detection may return up to 250 clearly visible rows per image.
- Detection output is always editable and can never post directly.

### Optional private Drive evidence

- Google account connection always requests the narrow `drive.file` scope. Hearth can access only files it creates or the person explicitly opens with it, not unrelated Drive contents.
- Keeping an original receipt remains a per-receipt checkbox. Selected files go to the uploader's private `Hearth Receipts/YYYY/MM` path and are deduplicated by the local source digest.
- Drive upload occurs only after the books accept the batch. A Drive failure does not roll back accepted money; the in-memory original remains available for a retry during that session.
- Drive deletion is a separate explicit action and never deletes or reverses ledger money. OAuth tokens, Drive ids, raw image bytes, and receipt arithmetic never enter the household continuity snapshot.

The earlier batch-review build at commit `fd70869` was deployed to the Development kitchen on 2026-08-25 through GitHub Actions run `32893244966`, with Jonathan's explicit approval. Cloudflare reported Worker version `f49569d8-412d-428e-acd3-e5d07da968df`. D-137 reconciliation and receipt-number extraction are local branch work and are **not deployed**.

## Failure and recovery

- Malformed/empty bank files, invalid dates/amounts, non-CAD rows, unknown transaction types, missing account/category choices, and unresolved Not sure rows fail closed.
- A failed image provider says detection is unavailable and that the image was not saved.
- Available statement or receipt arithmetic mismatches keep the review staged. Missing statement opening data follows the explicit skip rule.
- A Drive evidence failure is reported separately with Retry; it never changes the already accepted bookkeeping outcome.
- If final book acceptance fails, the review remains open, the previous household stays authoritative, and the review shows the underlying books/storage reason instead of replacing it with a generic rejection.
- Large combined histories may exceed the browser's small `localStorage` backup quota. The accepted full snapshot can live in IndexedDB; compact Undo history stores confirmation metadata and posted ids rather than duplicating full household snapshots. If both durable device stores fail, nothing changes.
- Closing the current review discards staged UI state. Re-importing the same source is safe: exact provenance scores 100 and starts cancelled.
- Changing environment, household, member, or Household/Personal view discards the entire staged review, raw in-memory receipt files, matches, and Drive-result UI. Delayed scans and Drive callbacks are scope-guarded and cannot repopulate the new ledger.

## Proofs

- Golden OFX 1.x and QFX/XML fixtures, credit-card payments as transfers, malformed inputs, stable provenance, and a 1,500-row history.
- Exact `>90`, `50–90`, and `<50` boundary tests, within-batch duplicates, and Personal-view isolation.
- No-mutation staging, balanced command posting, transfer provenance, audit-preserving replacement, one final Confirm, and undo coverage.
- Worker origin/MIME checks, Workers AI structured vision, paid-provider gating/fallback, no-provider honesty, receipt-number sanitization, and client single-submit behavior.
- Exact/mismatch/skipped statement equations; receipt components; unique one/multi-payment matches; ambiguous subsets; total-only clearance; Drive folder/upload/dedupe/retry/delete behavior.
- Responsive popup/UI test plus a local Books → Import desktop walkthrough.

## Remaining release actions

1. Open the reviewed D-137 reconciliation PR, await CI, and merge only after review; deployment still requires separate authorization.
2. Include batch intake in the comprehensive pre-September audit. PDF ingestion, persistent draft inboxes, and connected bank feeds remain separate work.
