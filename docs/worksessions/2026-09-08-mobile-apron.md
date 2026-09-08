# Hearth worksession — Claude's apron receipt

- Status: VERIFIED LOCALLY; draft PR preparation
- Owner / decision owner: Jonathan; assignee Codex
- Branch: codex/mobile-a5-apron
- Baseline: c249f378aa5ed2acad7cfff7a2cc5af389bc3b47 (A4, PR375)
- Risk: Medium-High (own shift privacy and receipt truth)
- Budget(5): +1; Engagement(3): +2
- Environment: local fictional Development only

## Household outcome

An accepted own contributor shift becomes Claude's one-slot felt card at Home's head for six hours from createdAt. Four facts retain the original hierarchy: hours, cash, card and tip-out. Jonathan's explicit copy decision replaces the causal Ask change with a separately labelled Current Shared Ask. No posting button appears on an already posted receipt.

## Source and style contract

The accepted shift stores historic receipt facts. Card owed is the amount after withholding at posting, not a current per-shift receivable allocation. Cash received is gross at posting; the separate tip-out line names paid-from-cash, withheld and deferred amounts. Legacy shifts explicitly lack receipt timing; they never infer cash/owed status. Reversal removes eligibility, updates and settlement do not renew expiry, and future/invalid dates refuse. The active contributor filter runs before selection. Existing active-view widgets retain their original household; only this card uses the accepted books source.

The original 160-degree felt gradient, 13px padding, 7px gaps, 27px Fraunces headline and 15px fact values are retained using existing pine/ink/paper tokens. Canonical 5px corners and 10.5px minimum labels supersede old HTML values. The original four-fact row remains at 320px; labels wrap and enlarged text spills the whole card below the crease if necessary. No hex literals or new posting authority.

## Acceptance

- [x] Own/partner/custodian/inactive/legacy/reversal/settlement boundary proof.
- [x] Exact six-hour expiry, suspended-tab wake and scope changes.
- [x] One fold slot and no financial action on rendering or expiry.
- [x] Narrow/large-text browser proof and focused quick gate.
- [x] Independent UX and money rechecks.

## Evidence

Medium-High quick gate passed 112 assertions (78 fast, 34 serial), TypeScript, AI and diff checks in 139.958 seconds; no five-minute breach. Fingerprint at gate: `0f75b9cf5b4a4413ce52db807f6c8247e7c0c490d952d567642c0b7bc5f2d6ca`. Exact command: `pnpm test -- --risk=medium-high --base=c249f378aa5ed2acad7cfff7a2cc5af389bc3b47 --focus=test/apron-receipt.test.ts --focus=test/office-phone.test.ts --focus=test/phone-spread.test.ts --focus=test/work-jobs.test.ts --focus=test/app-startup-p1.test.ts --focus-reason="Preserve accepted receipt timing, reversal and payout truth, own-member privacy, six-hour lifecycle and measured fold placement"`.

The final browser pass follows one CSS-only refinement after the gate: remove the invented two-column narrow layout and retain Claude's four-fact row. The normal 320px card measures 270.906px and fits above the 288px crease limit. Enlarged text moves the whole card below the crease without clipping. Final layout matrix: 48 actual-component Chromium cases across 320/390/720/1100, Shared/Personal/custodian, ordinary/enlarged/empty/expired. No page or card overflow, errors, excess head slots or actions. [Matrix](../evidence/mobile-a5/browser.json), [320px receipt](../evidence/mobile-a5/320-normal.png), [390px receipt](../evidence/mobile-a5/390-normal.png). Local driver and fixture: `/tmp/hearth-mobile-a5-evidence`, ignored `artifacts/browser-evidence/mobile-a5`. An additional 24 busy/offline cases passed across the same widths and scopes ([state matrix](../evidence/mobile-a5/states.json)); accepted receipts remained readable and emitted zero actions. Earlier legacy-only browser proof is separate from the final job-receipt matrix.

Independent trust review identified a valid negative card-after-withholding receipt that the first timing guard incorrectly treated as legacy. The repaired guard accepts signed card balances, retains deferred tip-out, and uses accurate historical wording. A real posted regression covers all three timings and a payout after the receipt. Independent rerun passed 7/7 tests with no remaining blocker. Source/style recheck found no material blocker; its worked-hours label correction is included. Expiry, resumed-tab refresh, member changes and reversal are exercised without posting. No native lock-screen implementation is implied by this web card.

## Handoff and limits

Codex verifies, opens a separate stacked draft PR and continues the authorized mobile program. No merge, deployment, hosted schema, physical device or native lock-screen/Live Activity claim.
