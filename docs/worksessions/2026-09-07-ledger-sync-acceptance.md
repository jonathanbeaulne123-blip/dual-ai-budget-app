# Hearth worksession — measured ledger replacement

Migration command: **none in this slice; do not apply hosted schema.** Any later migration handoff must name its exact command for Jonathan to run.

- Status: OPEN; commission incomplete.
- Owner and decision owner: Jonathan. Assignee: Codex.
- Repository: jonathanbeaulne123-blip/dual-ai-budget-app.
- Branch: codex/ledger-sync-acceptance.
- Baseline and starting HEAD: 5cd1f1818c0ef12eaa1a362c3e6a30d4ba59db1b, fetched current main, initially clean.
- Prior release: PR #365; Worker 4fa86b8c-6d72-46be-9877-02711e918ca3.
- Risk: High. Budget delta (5): +5, measured correctness and usable accepted books. Engagement delta (3): +3, responsive opening and posting.
- Scope: one ledger runtime; startup, change-sized processing, importer parity, calibrated deployed and physical-device measurement. Development deployment authorized. No Production deployment, new schema application, destructive SQL, or legacy deletion before G4.

## Acceptance gates

| Gate | Current proof |
| --- | --- |
| G1 concurrency decision | Documented before new runtime edits in the contract addendum: unrelated postings execute against current server state without household CAS. observedSequence is a resume hint. Stable UUID/hash/subject retries return the original receipt. |
| G2 harness and baseline | OPEN. Existing local harness lacks all requested metrics, 5,000 rows, deployed clock calibration and failure on latency. Current hosted startup reproduces an indefinite database recovery loop. |
| G3 importer parity | OPEN. Prior synthetic tests are not proof on the actual household shape. Compare balances, trial balance/equation, receipts, complete read model and Personal isolation. |
| G4 physical Toronto LTE | OPEN. Requires two physical devices, calibrated warm/cold trials and 5,000 transactions. Browser emulation cannot pass this gate. |

## Baseline facts

The prior local release-compilation run had 100 edit-to-receiver samples: median 164.6 ms, p95 329.4 ms, maximum 1723.2 ms. It did not measure cold startup, author paint, acknowledgement or physical LTE.

On 2026-09-07, read-only inspection of the affected deployed Chrome tab found the expected release asset, v2 ticket requests, cached shell commit at 212.4 ms, first books open/migration at 4362.1 ms and an ingest at 7492.5 ms. Subsequent opening attempts repeatedly took approximately 14–22 seconds, with no usable ledger after about 20 minutes. The UI displayed a books transaction timeout while retaining the validating banner. Only one Hearth tab was exposed in the current browser inventory. A competing user tab is not a confirmed cause.

## Plan

1. Record G1 and explicit current release limitations.
2. Build truthful measurement and 5,000-row fixture, recording failed startup as a failed baseline rather than dropping it.
3. Reproduce and repair the startup blocker; validate through the ordinary App.
4. Prove importer and incremental invariant equivalence before changing acceptance semantics.
5. Collect deployed browser measurements, then physical LTE proof. Keep G4 open until real samples exist.
6. Delete superseded mechanics only after G4; never roll a previously fenced household back into legacy writes.

## Remaining uncertainty

Neither the 500 ms cold-open budget nor the 16/120/250 ms posting budgets are established. No existing baseline permits a real-money readiness claim. The latest commission supersedes mechanics in older canon, but preserves cents, balanced entries, Personal isolation, receipt uniqueness and environment isolation.

## Startup repair evidence (local, before release)

The v2 mounted-App regression failed with a never-resolving SQL ingest before the repair and passed afterward. Canonical scope validation and the full accounting guard run before persisted replica publication. No financial acceptance rule was relaxed. 52 focused startup, accounts, obligations, Office and Bianca Month tests passed; this is not exhaustive evidence. The 500-case duplicate-flag equivalence test compares the old pair algorithm exactly.

Complete wallet and monthly-obligation JSON matched byte-for-byte in 12 comparisons (158/5056 rows, three dates). Node diagnostics at 5056 rows: wallet 224–269 ms before, 15–20 ms after; obligations 106–118 ms before, 5–6 ms after. These are per-calculation timings, not user-facing latency percentiles.

One local Vite/fresh headless Chrome profile per revision: first sync ticket 28.506 s before, 6.160 s after; first ledger WebSocket 9.433 s after. This is not cold interactive proof. That old cloned-row fixture also had 248 copied funded rows without matching immutable Fund events; it is invalid for acceptance. The corrected load fixture retains the original Fund graph and makes additional copies ordinary unallocated entries, validated by both full accounting and Fund integrity checks.

Jonathan selected **onboarding test Household** for actual-data importer parity. G3 remains open; neither another member's Personal data nor missing historical receipt identities may be inferred. Receipt migration work is separate from this startup release: full history requires retained command-event identities, including compacted commands, beyond the snapshot's 200-receipt ring.
