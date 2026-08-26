# Import reconciliation engine

**Status:** REVIEWED; non-deployed PR handoff on `codex/import-reconciliation-engine` from `main@6e2baea`. Not merged or deployed.

## Outcome

Selected QFX/OFX exports and receipt images prove their arithmetic before final Confirm. Receipt evidence matches existing or staged bank transactions before proposing another expense. Optional raw-image retention uses the uploader's private Google Drive with `drive.file`; raw bytes, OAuth tokens, and Drive ids never enter the household snapshot.

## Jonathan's decisions

- Check receipt arithmetic, QFX/OFX statement arithmetic, and receipt-to-payment equality.
- Exact integer cents; no invisible tolerance.
- A statement with no opening balance skips that check without blocking and is labelled as not checked.
- Match receipts to one or more existing/staged payments before creating a new expense.
- Extract item-level amounts only, not item names. Check line sum, subtotal, discounts, tax, tip, fees, and total.
- A receipt with unreadable item amounts is cleared when its total exactly matches payment evidence.
- Google Drive consent is required when the Google household account is connected. Receipt retention remains a per-receipt choice.
- Drive target: uploader's private `Hearth Receipts/YYYY/MM`; upload failure never rejects accepted money and remains retryable; deletion is a separate explicit action.
- QFX and OFX plus receipt photos are in scope. PDF and connected bank feeds are not.

## Invariants

- OCR, QFX/OFX files, Drive, and matching are proposals/evidence only. They never post directly.
- Final Confirm and `acceptHouseholdWrite` remain the accepted-money boundary.
- A present opening and closing balance must tie exactly; a mismatch blocks final Confirm.
- Missing opening balance is `skipped`, never falsely `balanced`.
- Raw images remain memory-only until an explicit Drive upload and never enter PGlite, Supabase, logs, or household continuity.
- Drive uses only `drive.file`; Hearth cannot browse unrelated Drive files.
- Drive failure is separate from money acceptance.

## Risk and Dual Course

- **Risk:** High — financial reconciliation math plus privacy/retention and Google OAuth scope.
- **Budget delta (5): +5** — statement completeness, exact receipt arithmetic, match-first duplicate prevention, and explicit unreconciled states.
- **Engagement delta (3): +1** — one calm reconciliation summary and a cleared-receipt state reduce review work without hiding exceptions.

## Allowed and forbidden

Local branch code, tests, docs, and a non-deployed PR are allowed. No merge, deployment, OAuth-console change, secret, hosted schema/row mutation, Production action, or Drive-account write without separate explicit authorization and a user gesture.

## Proof

Golden exact/mismatch/missing-opening fixtures; receipt component and total-only cases; unique one/multi-payment matches; ambiguous/no-match cases; no-mutation staging; Drive scope/folder/dedupe/retry/delete tests; focused UI; full `pnpm test`, `pnpm build`, AI surface, and independent money/privacy review.

Current post-rebase evidence: 85 test files / 595 tests passed serially; AI surface, TypeScript, Vite production build, and the no-`_redirects` host check passed. Focused Google/Supabase scope proof also passed after adding `drive.file` to both account-connection paths. No merge, deployment, OAuth-console, schema, hosted-row, secret, Drive-account, or Production mutation occurred.

Independent review found four initial issues: staged state crossing a viewer scope, one payment clearing multiple receipts, bounded subset search silently looking unmatched, and model-controlled receipt text retaining item names. Follow-up review caught missing acceptance coverage and an A→B→A stale-completion race. The implementation now resets the full environment/household/member/view tuple and guards delayed work with a monotonic scope generation; blocks overlapping payment claims until each receipt gets an explicit choice; makes large candidate sets require human selection while retaining all candidates; and deterministically drops receipt description/reference/warning text at Worker and client boundaries. Acceptance regressions cover the ABA switch and the two-receipts/one-payment choice. Final independent review reported no remaining P0/P1/P2 findings.
