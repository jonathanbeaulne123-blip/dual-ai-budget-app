# Hearth worksession — measured ledger replacement

Migration 020 was **applied to Development on 2026-09-07 after Jonathan explicitly replied “you can apply them.”** The CLI equivalent is `pnpm exec node scripts/apply-supabase-migration.mjs 020`; this host had no configured database credentials, so the exact reviewed 6,076-character SQL was applied through the signed-in Supabase editor for project `tykhocwacaxwquhynkok`. No credentials were extracted. Hosted verification: migration/RPC present; anon and authenticated direct table reads denied; anon RPC denied; authenticated RPC granted. Production application and destructive SQL remain unauthorized.

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
| G2 harness and baseline | OPEN. Existing local harness lacks all requested metrics, 5,000 rows, deployed clock calibration and failure on latency. The deployed startup hang is repaired, but complete deployed 5,000-row measurements remain open. |
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

## Release and follow-on evidence

- Startup PR #366 merged as `27fdec0db192925fb225c825f9df0cadb2b199d5`; Development Worker `8e751f5d-4936-4e54-8248-125b5eeb7865`, served asset `index-CNhoaEOK.js`. Clean High quick gate: 116 tests, TypeScript, AI surface and diff check, 173.283 seconds. PR and main CI/deployment succeeded. Live selected household reaches **Live rev 13** without the validation banner. Two canonical-adoption marks: **1540.2 / 1860.3 ms**; neither establishes the 500 ms interactive target.
- Activity PR #367: exact head `7a1768efa58ff0bba29170adcf5f6b3e2d7d28bb`. High quick gate **103 tests / 13 files**, TypeScript, AI surface and diff check, **75.367 seconds**, within budget. Independent read-only review found no release blocker. Merged as `d07c18b7ec81c31e1024c77ced1c5e837da8cb06`, Development deploy run `34138677910`, Worker `244f8214-bf70-4449-9884-65b756505acf`, served asset `index-Bb6UW40R.js`.
- Local scale fixture: **5,056 rows**, original Fund graph preserved; extra copies have no unmatched Fund allocation. Latest N=1 construction **470.28 ms**, full guard **29.91 ms**, audit hash **36.65 ms**, Shared projection **9.84 ms**, Shared JSON **2,977,010 bytes**. Node diagnostics, not end-to-end latency.
- Local ordinary-App trial `proof-fad923c1`: three confirmations, two simultaneous and one serial. ACKs **4728.2 / 1504.7 / 647.6 ms**; author paint upper bounds **7589.1 / 5102.7 / 2945.8 ms**; acknowledgement toast **7587.2 / 5056.2 / 2945.9 ms**. Two partner paints observed (**7403.8 / 2515.2 ms**, clock corrected); one missing. Two fresh-document cached-replica interactive readings **5924.6 / 6267.5 ms**. No accepted trial row lost or duplicated; both members' canonical trial amounts matched. The trial exited nonzero. N=3 is diagnostic only, local Vite/headless Chrome, not a percentile certification or G2 baseline. Two-frame visible hit testing is a conservative paint bound. No 100-sample / physical-LTE claim.
- The measurement evaluator now retains partial timing evidence while failing missing samples/paint, requires distinct authenticated participants, validates receipt stability, counts all trial-marked canonical rows (including different-ID duplicates), and checks the observed concurrent pair with bounded clock uncertainty/drift. Its scope-marker/recipient privacy metric is narrower than a complete adversarial canary proof. Cold idle with active presence is not proof of a cold LTE radio.
- Receipt reservation patch: **37 focused tests passed** in **7.66 seconds**, including real local SQLite/R2 Worker faults/recovery, 603 retained identities across the legacy ring and retained/compacted event history, incomplete-manifest refusal, authority/member isolation, full guard and strict evaluator tests. TypeScript passed. The initial local-only state was superseded by Jonathan's explicit apply authorization and the verified hosted application recorded above.

The full accounting guard is the explicit fallback. No incremental guard equivalence proof exists, and the measured browser result is slower than the suggested 300–330 ms fallback; do not substitute that estimate for these measurements. Author optimism, deployed 5,000-row baseline, both-member actual-data parity, physical Toronto LTE, and legacy deletion remain unfinished. Real money remains untrusted until these correctness/recovery and acceptance gates are independently established.

Reservation release candidate `4f449b44b3991894be82afa8036fe968f8bf753b` passed the clean High quick gate: **100 tests / 11 files**, TypeScript, AI surface and diff check, **43.729 seconds**, no budget breach. Later documentation changes record the new schema authorization and application; they do not change the tested SQL function body.
