# Ledger optimistic rows, incremental books and import parity

- Status: IMPLEMENTED; release and actual-data proof in progress; owner/decision owner Jonathan; implementer Codex.
- Baseline: main `94e8c6f` (includes new-person QR invite PR #369).
- Branch: `codex/ledger-optimistic-incremental-parity`; clean at start.
- Risk: High. Budget delta (5): +5; Engagement delta (3): +3.
- Target: Development. Push, merge, Development deploy and schema application are explicitly authorized in this task. No Production or legacy deletion.

Outcome: a validated pending row appears while its durable command awaits server acceptance; common appends avoid compiling unchanged journal entries; all imported fields and derived books have an auditable comparison.

Acceptance: at least 500 deterministic incremental/full guard comparisons, including deliberately corrupt inputs and error classes; pending rows survive unrelated events/reconnect and disappear atomically with canonical rows, with definitive rejection and IDB failure coverage; complete synthetic Shared and both-member Personal import parity plus scoped actual-data evidence for the selected onboarding test Household.

Canonical balances, exports and money actions use accepted state. Pending is never Saved. Personal data stays member-scoped. Full validation remains the fallback for any unproven incremental shape. Existing physical LTE gate and prohibition on legacy deletion remain.

Evidence and remaining limits will be recorded here before release.

## Implementation and local evidence

- Added separate durable Pending previews, author-only event correlation, atomic canonical suppression, full-scope render gating, newer-draft protection, snapshot receipt recovery, definitive-reservation quarantine and retained rejected-entry UI.
- Moved the unchanged full journal guard to core/booksValidation; V2 client and per-member Worker caches compile only proven independent appends. Full fallback remains for all edits/reference-sensitive cases. The existing mutable command model still requires an O(n) eligibility scan.
- Added exhaustive field policy, complete books/read-model hashes, exact receipt relocation/reservation checks, normalized-source loss reporting, row-ID collision refusal and per-member SQLite import proof archives with durable upload retries. Fixed cross-member Personal transaction/shift selection at splitForSync.
- Independent reviews found and drove fixes for non-finite signature collisions, stale-scope rendering, newer draft erasure, rejected-entry retention, legacy UUID quarantine, import-proof retry and normalization losses.
- 640 generated differential cases passed plus consecutive cache generations/non-finite corruption and a 5,056-row append. One local isolated append check including result projections took 12.0–16.8 ms across diagnostic runs; under parallel quick-gate load 18.9 ms. These are not UI/LTE measurements.
- Real local Worker: 6 tests passed, including source → SQLite reread → scoped archive parity and actual snapshot cross-member absence for both synthetic members (10.05 seconds latest run).
- Real Chromium + IndexedDB + Worker recovery script passed offline queue, network-partition reload, retained definitive refusal, exactly-once reconnection and explicit dismissal.
- Ordinary-App N=5 local diagnostic `proof-2f7530a4`: Pending paint median 207.6 ms / max 270 ms; ACK median 723.6 ms / max 1591.2 ms; Saved median 2506.6 ms / max 4314 ms; partner median 2268.7 ms / max 4316.7 ms; cold interactive max 5453.3 ms. All latency gates remain failed. Two-frame paint is a conservative bound. No physical LTE evidence.
- First High gate failed four existing App refusal-copy assertions: the new callback did not publish the original refusal message. Restored that message; all four pre-fix failures pass (4.57 seconds). Final High gate follows this correction.

Actual target remains onboarding test Household. Jonathan selected it and is opening Bianca's session for her own scoped proof. No financial rows have been added to that hosted household by this work.

## Release review

High quick gate passed in 58.06 seconds: 101 fast and 34 serial tests, TypeScript, AI surface and diff hygiene; no five-minute budget breach. Six real SQLite Worker tests passed in 5.56 seconds, including second-member import after a Shared edit. The updated visibility regression now requires each member's own Personal envelope; its previous expectation allowed both members' private rows in one envelope. Final independent read-only accounting, optimistic and importer reviews found no remaining concrete blocker. This is focused evidence, not exhaustive or physical-device certification.

Review disposition: GO for authorized Development publication of the three features. NO-GO for a 16 ms/250 ms latency claim, complete physical-device acceptance, Production activation or legacy deletion. Remaining profile work includes full command cloning/hashing, read-model projection and compatibility-cache persistence. Bianca's own authenticated parity remains required for both-member actual-data certification.
