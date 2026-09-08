# Hearth worksession — paired Fund scenario paths

- Status: LOCALLY VERIFIED
- Owner / decision owner: Jonathan; assignee Codex
- Branch: codex/mobile-sc5-paired-scenario
- Base:78b5f5e8b9b8d8c5aeaeb8663ab44af6163220e3 (SC04, draft PR382)
- Origin/main last refreshed:6fb15c7a98f3336862bb743b836aa96a358a35b9
- Risk: High; Budget(5)+3; Engagement(3)+2
- Environment: fictional local command fixtures, no hosted state

# SC05 implementation notes
Root is sole writer. Base SC04 after its verification closure. High risk. Budget(5)+3, Engagement(3)+2. Pure fictional local model; no UI/network/commands/storage. Claude Reach consumer follows with independent G4 review.

Public composition clones accepted household, marker, request and source assumptions before first await. Re-review source/horizon and exact request basis, resolve cash and optional forecast assumptions afresh. Never accept caller-supplied availability arrays. No forecast assumptions means no requirement for forecast history. Explicit route consent still is not contribution intent.

Fixed elections must fit BOTH path residuals of tranche and capacity group. Up-to elections consume each path independently in deterministic date/id, allocation-id order; do not assume residual expected remains >=lower. Zero resolved contributions cannot remove observed estimates. Account/forecast capacities merge only with distinct IDs.

Review replacement options from current baseline: own future estimated positive contribution with canonical estimate:member:date identity, exact SHA256 of version+basis+movement. Resolve references again during composition, once each. Never remove actual, found/confirmed, obligation, partner or absent sources. A smaller or later replacement may worsen baseline.

Share ordered accumulation with existing fold; default comparator/fold unchanged. Scenario union sorted on structural contribution-before-obligation using max path delta, preserving zero slots. Accumulate both paths in one shared source order. Validate whole safe cents and lower balance <=expected at every source slot. Exact zero request retains baseline future byte/deep equal.

Return accepted monthly walk and canonical current Ask separately from horizon anchor/baseline/paired future, terminal deficit and dated under-buffer readings. Under-buffer uses daily ending balances and each month's own buffer; daily order never promises intraday funds. Consumers position core amounts only.

Tests: real1685 anchor and2236 dated claims including Oct1;0 baseline -551 and46 explicit cash -505; exact monthly/Ask/input unchanged; caps and shared capacity; replacement smaller/larger/moved date/stale/duplicated/wrong owner/confirmed/actual/obligation; zero conditional replacement refused; same-day zero slot and later decreasing width; scope/auth/revision/metadata stale; overflow; no writes/network/UUID; permutation deterministic; unsupported source no partial cone.

## Implemented result and independent proof

The public projector re-resolves explicit cash and optional forecast assumptions from one captured accepted household. Fixed allocations check both residual paths; optional up-to elections consume each path independently without assuming residual bound order. Only exact reviewed own future observed contribution estimates can be removed. Effective-zero choices cannot remove them. Paired paths share source slots including zero placeholders and one core accumulation engine. The original default Fund fold and accepted monthly output remain unchanged. Current Ask, horizon baseline and its terminal deficit are returned separately from hypothetical paths and their terminal deficits. Each month's buffer supplies daily under-buffer dates without being silently subtracted from the terminal deficit.

The real-command fixture conserves168500 +4600 -223600 = -50500 cents, including October1 obligations. Zero is exactly baseline -55100. Fixed cash bounds coincide. A smaller dated replacement can worsen the baseline without changing accepted facts. Forecast fixture helpers were extracted unchanged from SC04 tests so the public model is also exercised through coherent actual attendance/posting receipts, rather than invented availability arrays.

Independent source review found no remaining financial/source blocker and reran16/16 scenario cases. Its final requested baseline-deficit field was added and covered by the final gate. Two controlled mutations were killed and restored: removing expected residual checks incorrectly returned allocated; re-sorting paths separately incorrectly refused the legitimate zero-slot case. Null acceptance and malformed cash choices return typed refusals. The source collision regression also passes.

## Final quick gate

`pnpm test -- --risk=high --base=78b5f5e8b9b8d8c5aeaeb8663ab44af6163220e3 --focus=test/scenario-projection.test.ts --focus=test/scenario-cash.test.ts --focus=test/fund-horizon.test.ts --focus-reason="Conserve explicitly elected cash and forecast contributions across paired source capacities, exact estimate replacements and one canonical cross-month fold while preserving current Ask and zero baseline identity"`.

Passed106 assertions (99fast+7serial), TypeScript, AI surface and diff checks in546.457seconds. Five-minute breach during TypeScript (443.164seconds). Fingerprint before doc closure:`9c4bb3a6440500d4e1fd6cf3726b9226ff05a429ea1c3552045235ec172da893`. Earlier focused46/46 passed in29.49seconds. No exhaustive lanes or browser test because this slice has no UI surface.

Fictional local fixtures only. No accepted write, command UUID, storage/network operation, hosted/schema, merge, deployment or physical-device proof. Source-model review is complete for this slice; G4 final consumer review remains open. Next: separate SC06 App acceptance/readiness adapter, then Reach in Claude's original composition. Phase2 remains in progress.
