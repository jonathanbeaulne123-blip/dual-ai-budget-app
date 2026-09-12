# Hearth worksession — Hercules audit and capability expansion

- **Status:** LOCAL IMPLEMENTATION COMPLETE — release review CONDITIONAL
- **Opened:** 2026-09-12 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex, integrating Claude's supplied journey audit and repairs
- **Branch:** `codex/hercules-audit-expansion`
- **Baseline SHA:** `1686ccc4a569c99b5a2d92ae8b311b83873e211d`
- **Risk:** High
- **Environment impact:** none; local implementation and verification

## Household outcome

Hercules can retain an intention while answering questions, explain current work facts, discover the actions actually available in the current books, and complete reviewed job and task workflows.

## Budget delta (5)

Keep unknown take-home distinct from accepted earnings. Resolve scoped action inputs from current authoritative facts and retain separate reviews, confirmation identities and receipts.

## Engagement delta (3)

Remove swallowed questions, lost pause state and overlapping conversations. Make useful actions discoverable and support follow-through beyond their creation.

## Verified baseline

Claude supplied a patch and three audit documents against `a0d76e99`. His bundle ends at `2c7601e`; current main is `1686ccc4`. The source patch applies cleanly, but historical live observations and test results are not current validation. Raw interview documents remain local-only. Computer control cannot click the open Claude app, so no new interview message was delivered.

## Scope

Integrate and correct Claude's Kitty Bank, take-home and navigation repairs. Repair private conversation lifecycle, scoped action discovery, job setup, modern task lifecycle and current shift answers. Preserve existing adapters, grants, free-provider quotas and Final Confirm. No hosted data, schema, secret or deployment changes are included.

## Acceptance evidence

- [x] Questions and pause survive an active guided draft and reload without losing work.
- [x] Workspace and compact conversation have one visible owner; failed authentication terminates loading.
- [x] Dynamic action inputs and choices agree with execution scope and exclude private records of other members.
- [x] Job setup and shift posting remain separate reviewed actions; unknown take-home is explicit.
- [x] Modern to-dos can be edited, completed, reopened and removed while legacy drafts remain compatible.
- [x] Kitty Banks retain optional dates and create no money or backing.
- [x] Focused High gate, build and relevant theme/width checks recorded here; live evidence reported separately.

## Evidence log

At start, `git status` was clean at the baseline before applying the nine source/test files from Claude's patch. Audit claim reproduction identified routing fallthrough, absent pause persistence, action catalogue divergence, missing job adapter and modern/legacy task mismatch. Parallel agents use separate worktrees for conversation and tool-contract changes.

## Remaining uncertainty

Claude's older activation failure is not evidence that current flags are disabled. Live model, signed-in continuity, physical devices and October Production readiness require distinct evidence. No new release is implied by this worksession.

## Final candidate and measured results

Verified implementation/test SHA: `5fe8f1558f29945bcdfe84828271b85f8bcf45aa`. Product source is unchanged from `fd5da2b500cf4d5ac204fa82c6d204b944259867`; the intervening commits complete typed test fixtures and replace an old automatic-resume assertion with the approved explicit-resume behavior. Subsequent handoff updates are documentation only.

- Focused High quick gate: **PASS**, 472 tests across 43 files, plus TypeScript, AI-surface and diff checks. **99.444 seconds**, below the 300-second budget; no time-budget breach. Clean tree, fingerprint `8cabd939a6ba11c28fd01ad02624cad2fcde974c0821f7fedf4d0634157b4af9`.
- Production build: **PASS**, including application TypeScript, separate Workspace Worker TypeScript, Vite assets and Hercules Pro UI. Existing PGlite browser-external/eval and large-chunk warnings remain nonfatal; this change does not alter those dependencies.
- Actual App: **24/24** cases, all three themes × both scopes × 320/390/720/1440. Ask during Add, compact-to-room, earlier-conversation handoff, one mounted Workspace, usable composer width, retained unsent text and restored $12.50 Add draft. No page errors.
- Easy Read: **36/36** cases, all themes/scopes × 320/390/720/1100/1440/1920, including 500-pixel phone height. Toggle remains clickable after scrolling to the end; composer remains visible. No page errors.
- Workspace artifacts: **36/36** layout cases at the same six widths, all themes/scopes, plus editing, offline draft and compact expansion checks. No overflow, failed cases or page errors.
- Real local Agent/Workflow/R2/SQLite runtime with a mocked model: **13/13** cases. Restart, stale result, duplicate delivery, member isolation, proposal invalidation, grant expiry and continuation cancellation pass. No live Gemini requests, hosted data changes or external app writes.
- Independent bounded reviews checked action authority, privacy, financial task evidence and conversation lifecycle. Review findings were fixed: matching financial evidence, owned both-view payments, custom paid-break exception, caller-private Plan preparation, quiet text/identifier bypass and consumed-versus-unsent composer retention.

The actual App browser proof exposed a duplicate React sibling key that component fixtures missed. Prefixing the Workspace key prevents orphaned compact DOM on room expansion. Screenshot inspection then exposed composer squeezing from the handoff button; secondary controls now have their own row, and the proof enforces minimum composer width. Representative Classic, Taylor Personal desktop and Newfoundland phone screenshots were inspected.

## Exact commands

Use the bundled Node runtime in PATH when this machine's ordinary shell lacks Node:

```sh
export PATH='/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin':$PATH
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/hercules-job-task-journeys.test.ts --focus=test/hercules-journey-expansion.test.ts --focus=test/hercules-action-ui.test.ts --focus=test/hercules-private-chat-ui.test.ts --focus=test/hercules-conversation-deadlines.test.ts --focus=test/workspace-action-options.test.ts --focus=test/workspace-action-options-authority.test.ts --focus=test/workspace-ui.test.ts --focus=test/hercules-tools.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Claude audit repairs, current scoped action inputs, reviewed jobs and task lifecycle, earnings truth, private conversation recovery and App handoff'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
node scripts/verify-workspace-runtime.mjs "$PWD" /tmp/hercules-audit-runtime
```

Browser servers (run in separate terminals, with the same PATH):

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vite --host 127.0.0.1 --port 5191 --strictPort
VITE_HERCULES_WORKSPACE=1 pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never exec vite --host 127.0.0.1 --port 5192 --strictPort
```

```sh
node scripts/verify-hercules-audit-app.mjs
PROOF_VIEW=household node scripts/prove-hercules-easy-read.mjs
PROOF_VIEW=personal node scripts/prove-hercules-easy-read.mjs
node scripts/verify-workspace-browser.mjs
```

Local logs/reports: `/tmp/hercules-audit-final-gate-r3.log`, `/tmp/hercules-audit-build.log`, `/tmp/hercules-audit-app/report.json`, `/tmp/hercules-audit-easy-read/hercules-easy-read-household.json`, `/tmp/hercules-audit-easy-read/hercules-easy-read-personal.json`, `/tmp/hearth-workspace-browser/report.json`, `/tmp/hercules-audit-runtime/results.json`. Screenshots live beside browser reports. Re-running the runtime proof should use a fresh output directory so its persisted synthetic state does not contaminate a later run.

## Earlier failures and closure

The initial uncommitted gate stopped at test-fixture TypeScript errors (294.364 seconds, no budget breach). The first clean candidate gate caught missing test callbacks (62.451 seconds); the second reached 354 passing fast tests but failed an old Plan test that expected automatic resume (53.746 seconds). These were corrected; the exact final clean candidate passes. Early targeted tests also exposed invalid test account scope/capture setup, corrected before the final gate. Failed browser iterations are retained as diagnosis; only the final measured matrices above count as passing evidence.

## Release decision and remaining acceptance

**CONDITIONAL for release; local implementation complete.** No push, merge, deployment, hosted schema, secret, quota setting or account data change occurred. The existing free-Gemini routing and Financial Final Confirm remain in force.

Live Flash tool-use quality, cost/latency comparison, signed-in member-label diagnosis, authenticated cross-device continuity, physical phone/keyboard/VoiceOver and October Production readiness are not established by this local evidence. No exhaustive suite was requested or run. A future Development release and its live checks remain Jonathan's decision. The [durable handoff](../briefs/HERCULES_AUDIT_EXPANSION_HANDOFF.md) gives the implementation and compatibility boundaries.
