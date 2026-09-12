# Four feedback items — local browser proof

Synthetic existing-books fixture in the actual App, local Chrome only. All non-local requests blocked; no real household data, OAuth, posting or remote writes.

- Household: Home, Calendar, Books, Plan, Together, Status Centre; all three themes; 320/390/720/1100/1440/1920 pixels: 108 checks.
- Personal: Home, Calendar, Books, Plan, Status Centre; all three themes and the same widths: 90 checks.
- No document overflow, clipped Calendar tab labels, title bracelet clusters, hidden Add tab stops or page errors.
- 33 WCAG A/AA automated scans at 390 pixels: zero violations after correcting Newfoundland personal event chips and Comfort descriptions.
- Month-history entry and Back focus verified in both scopes and all themes; Dates/Cash flow switching verified on each Calendar.
- Expanded Classic Calendar in both scopes: keyboard dates/month slider, appointment draft, medical log, repeating draft and cancellation; 14 additional pane-level axe scans passed. See the nested receipts.
- Independent visual review confirmed the narrow Calendar tab and Books reading-surface fixes.

Representative images are included here. Full metrics are in `household-metrics.json` and `personal-metrics.json`. Full image sets remain local. Reproduce with Vite on 127.0.0.1:5198 and `node scripts/check-feedback-four.mjs`; add `HEARTH_PROOF_SCOPE=personal` for Personal. Set `HEARTH_ARTIFACTS_DIR` outside the checkout.

These are local synthetic-browser checks, not physical-device, live Google, deployment or Production acceptance.
