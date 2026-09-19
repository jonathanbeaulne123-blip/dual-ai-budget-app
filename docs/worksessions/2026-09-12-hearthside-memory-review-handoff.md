# Hearth worksession — memory review handoff

- **Status:** Scoped browser repair complete; root integrated gate pending.
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner / decision owner:** Jonathan; Codex root integrates and reviews.
- **Assignee:** Codex, `shared_life_inventory`.
- **Repository:** `dual-ai-budget-app`.
- **Branch:** `codex/hearthside-entry-gate-repair`.
- **Baseline:** `4ae12f866062a225ab22dfbfef65b15a36ec650a`.
- **Risk:** Medium-High: asynchronous shared-memory review controls; no authority or storage schema change.
- **Environment impact:** Local synthetic browser fixtures only.

## Household outcome

Sharing a reviewed encounter card reaches the separate memory review after its exact shared composition has been accepted. Either person can then choose Keep. A reply for an older revision cannot replace the current memory review.

## Dual Course deltas

- **Budget (5):** No money, Plans, Tasks, or financial writer change. Exact publication identity and canonical approval checks remain in force.
- **Engagement (3):** The reviewed encounter-to-memory transition completes reliably and focuses the available review heading. Stale replies produce changed-content feedback.

## Verified baseline and cause

The root High run on `4ae12f8` failed the first Encounter Entry browser case while waiting for `We each choose this whole composition`. An isolated rerun passed, so the failure was not declared fixed.

A deterministic reproduction held the fixture's actual compose HTTP request until the automatic Vault review returned. The observed sequence was `prepare-memory=200`, `review-memory=409 MEMORY_CHANGED`, `compose=200`. `MemoryPublication` cleared its temporary review while calculating the new binding, then marked the proposal accepted without restoring the review. The page showed both changed-audience and ready notices with no Keep controls. The real Vault correctly denied the premature review.

## Scope and decisions

- Pause automatic review while prepare/compose is in flight. Restart it when compose settles, including when the candidate object/binding identity stays the same. Only a fresh authoritative review enables Keep.
- Check the current live candidate's exact binding and digest after asynchronous prepare, compose and manual refresh work; reject a changed or withdrawn candidate. Fence the digest await against another candidate replacement.
- Focus the actual heading after the accepted review renders; do not announce readiness before that read succeeds.
- Exercise the current integrated Vault in Entry proof. Remove the obsolete conditional source-patching fallback.
- No authority relaxation, fixture acceptance bypass, new publication identity, dependency change, hosted action, flags, schema application, or external communication.

## Acceptance evidence

Runtime prefix for the commands below:

```sh
PATH='/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':"$PATH"
```

1. Isolated original Entry suite passed all 3 tests in **13.85 s**. This exposed intermittence; it was not closure evidence.
2. Holding compose until premature authoritative rejection reproduced the failure: **1 failed, 2 passed, 20.04 s**. Log: `/tmp/hearthside-entry-forced-race.log`.
3. Repaired Entry plus memory browser tests passed **7 tests in 19.18 s**:

```sh
node node_modules/vitest/vitest.mjs run test/hearthside-encounter-entry-browser.test.ts test/hearthside-memory-browser.test.ts --maxWorkers=1
```

The Entry test holds the actual compose request and checks that no automatic review/Keep appears before acceptance, then proves the successful review response follows the accepted compose response. Existing two-member Keep/activation, exact encounter link, lost upload/command acknowledgement, three themes, required widths, keyboard, axe, source-change and private-reveal checks remain.

The additional memory browser regression holds either a compose acknowledgement or manual review response, changes the same memory to another revision, and releases the stale reply. It requires changed-content feedback, no stale Keep/readiness and no approval/activation request. This surface test uses its documented injected client; Entry uses the actual Vault plus the existing synthetic canonical adapter.

The new stale-candidate regression was also run against the original `4ae12f8` component: it failed in **6.48 s**, waiting for changed-content feedback after the obsolete compose acknowledgement. The repaired component was restored byte-for-byte, and the same targeted regression passed. Logs: `/tmp/hearthside-entry-stale-original.log` and `/tmp/hearthside-entry-stale-final.log`.

## Remaining uncertainty and handoff

Root owns integrated TypeScript, the combined risk gate, actual LedgerRoom assembly proof and full App/authenticated acceptance. No compiler, full build, release gate, deployment, physical device or hosted sign-in was run in this bounded repair. A pre-existing esbuild warning remains in Entry's IIFE fixture because the route label reads `import.meta`; it does not alter the production bundle.

Cherry-pick this branch's repair commit onto the root integration checkout, inspect the four changed files, then include both browser suites in the next exact-head integrated gate. This is local scoped evidence, not release or activation approval.
