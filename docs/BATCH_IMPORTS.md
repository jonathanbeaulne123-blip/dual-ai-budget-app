# Batch imports

## Outcome

Books → Import accepts selected QFX/OFX bank exports and selected JPEG, PNG, or WebP images of receipts, bills, bank statements, and card statements. Every detected row is a proposal in a review inbox. Nothing reaches the books until the person presses the final **Confirm**.

This is selected-file intake, not a connected bank feed. No bank credentials or continuous account access are involved.

## Flow

1. Choose one or more `.qfx` / `.ofx` files, take a document photo, or choose existing document images.
2. Hearth parses bank files on the device. A selected image is sent once to `POST /documents/scan` for structured detection. The Worker tries OpenAI, Anthropic, then its bound Workers AI vision model.
3. Hearth maps exact statement account last-four values, then uses on-device description context to propose transaction coding before applying the existing duplicate confidence scorer. An unambiguous category name can choose that category. For internal transfers, an exact other-account last-four, an unambiguous account name, or a repeated transfer pattern from the visible ledger can fill the other account. A description such as `ONLINE PAYMENT TO VISA 4412` can therefore become a chequing → Visa transfer without a manual field choice.
4. The review popup separates rows into:
   - **Confident:** confidence `> 90`; the imported row starts cancelled.
   - **Not sure:** confidence `50–90`; the person must choose before Confirm.
   - **Probably not a duplicate:** confidence `< 50`; the imported row starts kept and otherwise untouched.
   Complete rows at `20%` or below are auto-kept but omitted from the visual review; they still enter only after the final Confirm. A low-score row that lacks a required account, type, category, or transfer destination remains visible for that missing accounting detail.
   Counts for unresolved duplicate choices and missing transaction details are actionable links. Selecting either centers and focuses the immediate decision or missing field, then advances to the next required issue—even if an edit changes that row's confidence tab—until final Confirm is ready. Choosing **Keep imported / Keep both** also advances this queue.
5. Each candidate shows the imported row next to the likely existing Hearth row or earlier batch row. The person may cancel the import, keep both, keep the import and exclude the old posted row, or keep one of two batch rows.
6. One final Confirm posts every kept row through ordinary `postEntry` / `postTransfer`, then through `acceptHouseholdWrite` (PGlite acceptance, local persistence, and eligible continuity transport). Cancel changes nothing.

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

## Camera/document detection

- The image is submitted only after the person takes or chooses it.
- Supported image types: JPEG, PNG, WebP. Limit: 10 MB per image.
- The Worker tries OpenAI vision, then Anthropic image input, then the bound Cloudflare Workers AI vision model. Keys remain Worker secrets and never enter Vite or the household.
- Printed instructions, QR text, and URLs inside a document are untrusted data. The extraction prompt tells the provider to ignore them.
- The Worker returns document kind, currency, account last four, rows, and per-row extraction confidence. It never returns or stores full account/card numbers.
- Raw image bytes are not written into the household, PGlite, Supabase, or app logs by this feature. The client keeps only a SHA-256 source digest (with a deterministic fallback) and normalized row provenance.
- Receipt and bill detection returns one total/due row. Statement detection may return up to 250 clearly visible rows per image.
- Detection output is always editable and can never post directly.

The current batch-review build at commit `fd70869` was deployed to the Development kitchen on 2026-08-25 through GitHub Actions run `32893244966`, with Jonathan's explicit approval. Cloudflare reported Worker version `f49569d8-412d-428e-acd3-e5d07da968df`, and the live bundle exposed the low-confidence auto-keep and guided-review markers. An earlier post-deploy synthetic receipt still failed closed with `503 Document detection is unavailable`; receipt work remains deferred.

## Failure and recovery

- Malformed/empty bank files, invalid dates/amounts, non-CAD rows, unknown transaction types, missing account/category choices, and unresolved Not sure rows fail closed.
- A failed image provider says detection is unavailable and that the image was not saved.
- If final book acceptance fails, the review remains open and the previous household stays authoritative.
- Closing the current review discards staged UI state. Re-importing the same source is safe: exact provenance scores 100 and starts cancelled.

## Proofs

- Golden OFX 1.x and QFX/XML fixtures, credit-card payments as transfers, malformed inputs, stable provenance, and a 1,500-row history.
- Exact `>90`, `50–90`, and `<50` boundary tests, within-batch duplicates, and Personal-view isolation.
- No-mutation staging, balanced command posting, transfer provenance, audit-preserving replacement, one final Confirm, and undo coverage.
- Worker origin/MIME checks, OpenAI structured vision, Anthropic fallback, no-provider honesty, and client single-submit behavior.
- Responsive popup/UI test plus a local Books → Import desktop walkthrough.

## Remaining release actions

1. Review and merge the context-coding follow-up separately from the already-merged batch repair.
2. Keep receipt-provider diagnosis deferred until it becomes a priority again.
3. Include batch intake in the comprehensive pre-September audit. PDF ingestion, statement closing-balance completeness, persistent draft inboxes, and connected bank feeds remain separate work.
