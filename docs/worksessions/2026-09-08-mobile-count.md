# Hearth worksession — Claude's Count

- Status: VERIFIED LOCALLY; G3 open; draft PR preparation
- Owner / decision owner: Jonathan; assignee Codex
- Branch: codex/mobile-b2-count
- Baseline:37c0cc9792df31c895ca5db0e84f4729c6e1c4d1 (B1, PR377)
- Risk: Medium-High (private shift draft and acceptance)
- Budget(5):+2; Engagement(3):+3
- Environment: fictional local Development only

## Outcome and fixed boundaries

Claude's three rails occupy the existing phone money step: worked hours, cash received and card owed, with one take-home reading and the canonical tip-out shadow. Exact typing remains in each reading. The current required sales, customers, staffing, event/weather, break, destination, attendance and source metadata stay in the same existing flow; only Confirm shift posts.

Quarter-hour snapping applies to deliberate rail edits. Imported/captured hundredth-hour values remain unchanged on opening; envelope-bound duration is locked because the accepted source contract rejects different minutes. Historical marks use listTipShifts with explicit member/job and limit8, not aggregate net tips. Contributor eligibility uses the accepted Fund custodian context even in Personal.

Draft recovery must preserve full source and form state across unmount, keep blank distinct from explicit zero, refuse stale source/settings authority and clear only the matching accepted draft revision or explicit discard. Source audit found existing callers clearing scanned drafts before acceptance and Add dropping attendance; the new recovery surface must repair those paths.

## Tap evidence boundary

Measure ordinary blank and fully populated draft scenarios separately with the same before/after fixture. Count clock-out, every selection, every keypad/native keyboard press, gestures, navigation and final Confirm. A script fill is not one tap. Blank required sales and customers cannot be omitted to manufacture an under-ten result. Local component/command counts are not physical G3 certification; that gate remains open until measured on the actual phone.

## Recovery and necessary acceptance repairs

The scoped session record carries all form fields, blank/zero distinctions, source clock/provider/camera data, warnings, source version, settings review fingerprint and private attendance. Source replacement and form saves compare stored identity/revision; a stale form must reopen. An accepted stamp cannot remove a later revision. Submission and rejection also advance revision.

Before dispatch, Confirm persists its exact command input, attendance and confirmationId and freezes editing. Retry checks the actual authenticated v2 receipt endpoint first; accepted or already queued commands do not rerun the local money calculation. The current v2 replica intentionally has no commandReceipts, so the old replica array is only a non-v2 fallback. Unknown transport/scope-close outcomes remain frozen. Only a local pre-dispatch refusal or authoritative LedgerCommandRejectedError unlocks; sameShiftDay retains its unchanged duplicate review. Acceptance/rejection reaches a remounted copy, and retirement prevents resurrection. Origin scope and async unmount checks prevent late callbacks posting on a different ledger.

App's accepted callback now runs once for ordinary Add as well as closeAdd:false. Both shift entry paths preserve scans and attendance until matching acceptance. An unrelated incoming shift no longer closes review. No posting or projection kernel changed.

## Evidence

Local before/after drivers use the same fictional Café Nola fixture, real clockOutShift and postWorkShiftWithAttendanceReview. Every keypad/key/native rail tap and navigation click counts. Blank21→14; populated4→4, with identical reviewed money and an accepted shift in each case. Count's payroll reading includes paid-break wages exactly once. No physical phone or full-App authenticated tap proof.

The first browser history run failed because the fixture posted historic shifts after clock-in, and the real command correctly ended that open shift. The fixture now loads history first and then clocks in. Final geometry/gesture matrix covers320/390/720/1100px, 200% text, large figures and eight actual own-job history rows, plus first Escape, pointer cancellation, stationary6.02h, exact typing/focus and frozen above-default rail scale. Rejected, pending, late-ACK, reload and storage-CAS states run in mounted React fixtures and actual sync-client receipt tests.

Initial independent review exposed early draft clearing, missing attendance, incomplete recovery, stale-save/late-ACK races, incorrect replica receipt authority and uncertain errors being treated as rejection. Each was repaired. The first focused fixture expectation used non-existent stored Shift field names; it now checks canonical ccTipsCents/hours.

## Acceptance / next owner

G3 is OPEN: blank entry remains14taps, while the populated path is4. The native/physical measurement remains unperformed. Codex records the required quick gate, creates a stacked draft PR with this explicit limitation and continues independent mobile slices. No merge, deployment, hosted schema, native widget or complete-Phase2 claim.


Final browser proof:18cases, sixteen width/state layouts plus two gesture suites at320/390. [Matrix](../evidence/mobile-b2/browser.json), [before taps](../evidence/mobile-b2/baseline.json), [after taps](../evidence/mobile-b2/after.json), [320px](../evidence/mobile-b2/320-normal.png), [200% text](../evidence/mobile-b2/390-large.png), [history](../evidence/mobile-b2/390-history.png). Browser and local command fixtures are synthetic; counts exclude automated scrolling and do not establish human elapsed time. The original baseline driver did not time user effort. G3 physical/manual measurement remains open.

The first quick gate failed a TypeScript narrowing in the new rejection callback; the callback is captured before the type guard. The second selected an existing attendance-refresh regression: an explicit new absence edit was still sent back to clock review. Attendance acknowledgement now tracks the current reviewed schedule separately from changed pay rules. Its existing regression passes. Earlier focused32tests and final independent28tests passed; the required gate adds broader startup/rehearsal proof.


Final Medium-High quick gate:148 assertions (107fast,41serial), TypeScript, AI surface and diff checks passed in239.180seconds; no five-minute breach. Candidate fingerprint before evidence/documentation closure: `451378abfd65ba64a72a726111ef75e4823cdb3f34d86e160ddd996b4b90fa2e`. Exact command: `pnpm test -- --risk=medium-high --base=37c0cc9792df31c895ca5db0e84f4729c6e1c4d1 --focus=test/count-recovery.test.ts --focus=test/ledger-optimistic.test.ts --focus=test/sevenshifts-scope-ui.test.ts --focus=test/shift-bible-ui.test.ts --focus=test/work-shift-scope.test.ts --focus=test/shift-duplicate-retry.test.ts --focus-reason="Preserve exact Count amounts and full private source drafts through scoped navigation, rejection, durable submission, authoritative receipt recovery and Final Confirm"`.

The final trust reviewer found no remaining blocker in recovery safeguards. Three pre-existing asynchronous WorkShiftPage fixture act warnings remain disclosed; all148assertions passed. The final attendance refresh correction is covered by the unchanged existing absence assertion and the same gate. Browser matrix was rerun with actual200% computed text sizing and passed all18cases.
