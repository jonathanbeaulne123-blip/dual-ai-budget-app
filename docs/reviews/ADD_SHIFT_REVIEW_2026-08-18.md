# Add Shift Independent Review — 2026-08-18

## Decision

- **Candidate:** v0.0.31 on `issue-2-add-shift-e2e`, draft PR #16.
- **Risk:** High — shared financial calculation plus a multi-sheet write boundary.
- **Gemini verdict:** APPROVE WITH NON-BLOCKING NOTES.
- **Claude review:** Explicitly waived by Jonathan for Issue #2 on 2026-08-18.
- **Codex reconciliation:** Both useful Gemini notes were accepted and implemented. No disagreement requires Jonathan to arbitrate.
- **Development status:** Repository gates pass. A development-only source push still requires Jonathan's separate explicit approval.

## Confirmed strengths

Gemini independently confirmed that the candidate:

- uses the same settings-driven calculation for preview and posting;
- applies deterministic cent rounding and preserves the documented negative-net-tip behavior;
- uses a settings fingerprint to prevent posting an obsolete preview;
- assigns one stable Shift ID and exact Wages/Tips source-to-ledger cardinality;
- protects the multi-sheet commit with a document lock, verified rollback, and recovery escalation; and
- provides a responsive, touch-friendly Add Shift dialog.

Gemini did not have a live backend connection during the review. Its approval therefore covers the submitted source, tests, and user-flow evidence; it does not replace the documented development-Sheet verification.

## Reconciled findings

### AS-01 — First-use setup concurrency

- **Review severity:** P3, non-blocking.
- **Finding:** Opening Add Shift can create the Tip Tracker structure and missing Wages/Tips subcategories. Two simultaneous first-time opens could previously complete overlapping check/create sequences.
- **Decision:** Accept and correct before the development push gate because the fix is small and improves clean-deployment reliability.
- **Correction:** `ensureShiftInfrastructure_()` now holds one document lock across Tip Tracker setup plus both authoritative category check/create operations. Lock contention aborts before setup begins.
- **Evidence:** Automated tests verify setup order, one shared lock, release behavior, and a zero-setup contention path.

### AS-02 — Settings change while confirming a duplicate warning

- **Review severity:** Missing targeted test, non-blocking.
- **Finding:** The code should return a fresh settings preview if rules change after a duplicate warning but before the user confirms; the submitted suite did not exercise that exact intersection.
- **Decision:** Add the test without changing the already-correct runtime ordering.
- **Evidence:** The new test first receives a same-member/same-date duplicate warning, changes the hourly-rate setting, then resubmits with confirmation. It proves the response is `settingsChanged`, the refreshed wage preview uses the new rate, and no second commit-state read or write path is reached.

## Final repository gate

The complete repository suite passes after reconciliation, including syntax/version checks, migrations, duplicate scaling and locking, Transaction Input validation and atomicity, plus the Add Shift calculation, setup, validation, rollback, drift, duplicate, mobile-wiring, and health checks.

The remaining pre-deployment control is Jonathan's exact development-only approval. Production remains out of scope.
