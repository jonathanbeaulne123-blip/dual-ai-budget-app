# Hearth worksession — Cancel a stuck PGlite opener during explicit cloud repair

- **Status:** OPEN — LOCAL RELEASE REVIEW CONDITIONAL; PR CI AND LIVE WITNESS PENDING
- **Opened:** 2026-09-05 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/pglite-explicit-repair-cancel`
- **Baseline SHA:** `146dc1a7160d163ea911321aa2034cf4324c44d8`
- **Head SHA:** runtime implementation `4dfde475809efa072531961ec8d1287d01e1e76a`; documentation closeout may follow without changing runtime
- **PR or issue:** none yet
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** Development

## Household outcome

When the Mac's one browser PGlite opener cannot finish, the already explicit authenticated **Restore from cloud copy** action can close that exact client and transactionally replace its local books from the stable Shared plus member-Personal cloud pair. Routine startup and Retry still keep one bounded opener and never clear local books automatically; repair does not delete IndexedDB.

## Budget delta (5)

`+5` — restores the accepted-books gate needed for a cloud-committed Shared command to become valid and visible on the receiving device.

## Engagement delta (3)

`+1` — removes a dead-end recovery loop so the partner's confirmed write can return to the kitchen without browser-storage surgery.

## Verified baseline

Facts:

- Development serves merge `6056cce` with the Auth/Realtime/command-log flags on and Production continuity off.
- Jonathan's phone committed a Shared `postEntry` as hosted revision 26 at `2026-09-05T06:15:15.57714Z`.
- The Mac stayed on revision 25. Clean diagnostic run `21480ae53273254c` recorded zero command candidates.
- A closed-and-new Mac tab reproduced the twelve-second PGlite open timeout.
- The fresh page had one election lock, one client tab-close lock, and the leader's two expected waits on that client while worker-side `PGlite.create` never completed.
- The IndexedDB database itself opened at version 21 and exposed its `FILE_DATA` store; this is an unfinished PGlite initialization, not proof of IndexedDB corruption.

Inference:

- PR #341 correctly stopped replacement-worker multiplication, but the explicit cloud-repair path cannot currently close the retained pending client because `PGliteWorker.create` does not expose its handle until readiness.

## Scope

### In scope

- Construct and retain the browser worker client before awaiting readiness.
- Bind typed cancellation state and the exact handle to the one same-environment opening, including late-arriving handles.
- Let only explicit accepted-cloud repair cancel and await that handle before transactional local projection replacement.
- Exclude routine open/ingest/inspection through one environment repair barrier and serialize app adoption behind the write queue with fresh scope/outbox/conflict guards.
- Keep ordinary startup/Retry timeout behavior unchanged.
- Add deterministic regression proof for close-before-rebuild and single replacement.

### Out of scope

- Financial command meaning, journal formulas, cloud transport, Realtime, RLS, schema, hosted-row cleanup, secrets, provider settings, and Production continuity.
- Automatic timeout-driven deletion or replacement.
- Treating the unfinished open as corruption.
- Claiming sub-one-second sync until a fresh deployed phone-to-Mac sample paints through PGlite.

## Acceptance evidence

- [x] Focused regressions prove close-before-replacement, late-handle disposal, typed busy classification, routine exclusion, repair coalescing, and reset cancellation.
- [x] Full `test/books.test.ts` passes 43/43.
- [x] Change-focused Release quick gate passes on the settled diff.
- [x] TypeScript and production build pass.
- [x] Independent money/latency review finds no blocker.
- [ ] Jonathan separately authorizes PR merge and Development deployment.
- [ ] Live Mac Restore succeeds, revision 26 appears, and Web Locks show no leaked replacement clients.
- [ ] A fresh phone-to-Mac Shared write is accepted and painted in under one second.

## Plan

- [x] Capture the failed hosted revision, command event, Mac trace, and Web Locks.
- [x] Implement exact cancellable opening ownership and an environment repair barrier for explicit repair only.
- [x] Serialize authenticated restore adoption and add scope/outbox/conflict rechecks.
- [x] Add focused regression coverage.
- [x] Run current-tree verification and independent review.
- [ ] Open a PR and request the bounded release decision.
- [ ] If authorized, deploy only to Development and repeat the witnessed latency run.

## Evidence log

- `git diff --check` — pass.
- Expanded focused repair regressions — 4/4 pass in 4.92 s.
- `test/books.test.ts` — 43/43 pass in 84.69 s.
- Authenticated restore regression — pass, including failed repair with zero save and repair-before-save ordering.
- TypeScript — pass.
- Release quick gate — **pass with five-minute soft-budget breach**: 10 selected files, 76/76 fast and 85/85 serial tests; AI surface, TypeScript, discovery, and diff hygiene passed in 325.9 s. The slow serial lane, not a failed assertion, caused the budget classification.
- Production build — pass: TypeScript, 473 Vite modules, Hercules Pro UI, and redirect guard; existing PGlite browser-external/eval and large-chunk warnings remain non-failing.
- Independent first review found two P1 cancellation/exclusion races and P2 scope/deletion gaps; the design was replaced with tracked late-handle disposal, a typed environment barrier, queued app guards, and no IndexedDB deletion. Independent re-review: **PASS, no remaining P1/P2 release blocker**.
- Live cloud read used the signed-in Bianca session and returned only revision/command metadata; no token or ledger payload was printed or changed.

## Decisions

- Preserve PR #341's one-opener rule for routine timeouts.
- Treat authenticated Restore as the already explicit local-replacement boundary that may cancel the retained opener; close must settle before one replacement opens.
- Keep reset/ordinary wipe behavior unchanged and do not call `deleteDatabase` from authenticated repair.

## Remaining uncertainty

- Local mocks prove lifecycle order but cannot prove Chrome releases the real PGlite worker lock; that requires the deployed Mac recovery.
- Revision 26 is durable in Development cloud, but the Mac has not accepted or painted it.
- The repository's full exhaustive gate was not run because Jonathan did not explicitly request it for this exact SHA. Release review is therefore conditional on PR CI plus the required live Development proof.

## Handoff

Codex owns implementation, verification, PR preparation, and the live Development retest. Jonathan owns merge/deploy authorization for this new change. Production stays off.
