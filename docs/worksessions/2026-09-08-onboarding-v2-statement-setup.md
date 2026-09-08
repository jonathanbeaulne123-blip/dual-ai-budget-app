# Onboarding repair, curriculum v2, and statement-assisted setup

- Status: LOCAL IMPLEMENTATION VERIFIED — draft review; not released or ready for household use
- Opened: 2026-09-08 (America/Toronto)
- Owner: Jonathan
- Coordinator: Codex
- Branch: `codex/onboarding-v2-statement-setup`
- Base: `a1215b2d49331c311ddd39402cfba0237d909cbd` (origin/main rechecked)
- Risk: High — progress authority, openings, historical imports, and recovery
- Environment: local Development; no deployment, hosted schema application, or Production action
- Authority: Jonathan's explicit implementation plan in this task, CLOUD_CONTINUITY.md, AGENTS.md

## Household outcome

Five visible stages replace mandatory Fund/card, recurrence and work setup: People and agreement, Starting books, Our first plan, Using Hearth day to day, Ready together. Both members independently learn expense/correction in discarded Practice and approve the current accepted facts. Deferred lessons remain unfinished. Statement-assisted setup reviews evidence before existing financial authority posts anything.

Budget delta (5): correct per-account opening coverage including signed and zero balances, reconciled reviewed history, authoritative deduplication, safe atomic rebasing, and current shared completion evidence without exposing Personal lessons.

Engagement delta (3): preparation, short resumable stages, sharing clarity and editable suggestions, authored for Classic Hearth, Taylor's Scrapbook and Newfoundland on mobile and desktop.

## Baseline reproductions

Command: `VITE_LEDGER_SYNC_V2=1 node node_modules/vitest/vitest.mjs run test/onboarding-audit-flow-repro.test.ts test/onboarding-audit-invite-repro.test.ts --maxWorkers=1 --testTimeout=30000`

Result: one file failed, one passed; 1 failing and 5 passing tests, 16.48 seconds. The cached-replica invitation regression failed while fresh entry passed. Four legacy reproductions deliberately asserted the defective progression behavior, confirming observer blockage, peer proof loss, obsolete acknowledgement and early Ready approval. They must be converted to positive regressions before acceptance.

## Dependency order

1. Shared attestations, explicit v2 requirements, compatible migration and four progression repairs.
2. Invitation entry, cancellation and stale asynchronous-result guards.
3. Per-account opening lineage and reviewed atomic history/rebase authority.
4. Normalized resumable statement drafts, bounded PDF/OFX/image intake and reviewed suggestions; five-stage teaching UI.
5. Integrate and independently review accounting/privacy and UI; run focused High gate and required acceptance matrix.

Each implementer has a separate checkout. No competing writes to this integration checkout.

## Acceptance evidence

- [x] All five positive regressions, mounted App with Development v2 enabled
- [x] Two principals/replicas through required journey without Fund/card/bills/work
- [x] Complete/incomplete v1 migration; no old Ready approval reuse; incompatible writes refused
- [x] Signed/zero multi-account openings; history reconciliation and backfill checkpoint preservation
- [x] Duplicate/identical activity, transfers, partial legacy batches, closed periods, concurrency and retries
- [x] PDF/image/OFX intake bounds, scanned pages, uncertainty, reload and Personal isolation
- [ ] Three themes at 390/1440 and boundaries 320/719/1100, keyboard/large text/motion/focus
- [x] Focused High gate, TypeScript/build, startup and Bianca rehearsal regressions
- [ ] Real two-account/two-device Development run with interruption/offline/reopen

No unexecuted path, theme or device check can be represented as passing. Full exhaustive gates and release are separate from the requested focused validation. Physical device results require actual device observations.

## Boundaries

Existing agreements, independent proposal formula/consent, Final Confirm and accepted write authority remain authoritative. No bank feeds, new sharing permissions, invented partner estimates, balancing income/expense, raw statement persistence, or independent financial writer. New receipts and opening lineage survive rollback; incompatible writers must refuse mutation.

## Integrated implementation and review

All five original failures now have positive regressions. The command-level v2 journey uses separate serialized member replicas and runs every required command, real discarded Practice, both independent Ready approvals and changed-evidence recovery without requiring Fund, credit card, recurring bills or work setup. Opening evidence now follows accepted per-account lineage and explicit zero checkpoints rather than requiring one legacy batch or transient transport receipt.

Independent review reproduced and repaired retained-transfer provenance loss: both bank legs are now bound atomically, with reciprocal-pair and authority-level identity checks. It also reproduced and repaired Personal opening/reversal rows influencing Shared coverage, a leaf-import initialization cycle, editable source drafts under an old Confirm, and inaccessible Starting books after reaching Ready. Published Shared rebase proposals preserve both approvals of the exact review; accepted draft cleanup cannot turn a successful financial result into a failed financial result.

Normalized owner-scoped drafts retain review decisions across reloads; the financial review stores one UUID and retries it after an ambiguous acknowledgement. Accepted exact statement inputs are cleared from draft storage; newer edits in another tab are retained. Raw statements are not stored. Rollback must preserve all new accepted receipts, correction groups and opening checkpoints. Legacy event replay cannot safely carry the new metadata; incompatible legacy transport must refuse these writes before staging instead of dropping or reinterpreting lineage.

### Local visual and interaction evidence

The synthetic local gallery mounted the real Journey, history review, Ready, category, estimate, proposal and preparation components with no hosted writes. History review retained the signed -$200 amount through all 15 theme/width combinations (Classic, Taylor, Newfoundland; 320/390/719/1100/1440). There was no horizontal overflow. The five teaching surfaces were checked at 390/1440 in all themes; one asynchronous viewport sample was rechecked at its actual requested size. All six surfaces also had no overflow at 320 with 200% root text and reduced motion enabled.

Desktop and mobile screenshots were inspected. Keyboard focus moved into review, reached Final Confirm and returned to Review opening balance after Close. Ready approval rendered a named waiting status for Jonathan and survived landscape resizing (844×390). The intake review separately exercised selected multipage PDF rendering with the bundled worker and mocked scanner, reload, owner isolation and hash reattachment. These are synthetic browser results, not OAuth, physical-device, actual screen-reader speech or real scanning-service certification. Physical keyboard, mobile virtual-keyboard, rotation and assistive-technology use remain in the real-device gate.

### Real Development rehearsal gate (not executed)

Use two separate Google principals on two physical devices, including a previously used browser and a fresh browser. Check invitation precedence and cancellation, complete the five stages with at least two Shared accounts, interrupt during intake and after Confirm, reconnect offline drafts, reopen with the other device powered off, and complete staggered Ready approval. Exercise a fresh history import and a Shared two-approval rebase using disposable Development data. Record device/browser versions and actual acceptance receipts. No deployment or hosted migration was performed by this implementation task.

## Final local verification

Code head: `3d4e88cfbc3998398bd19dfc2027e1bcc852f46c`; clean tree, base `a1215b2d49331c311ddd39402cfba0237d909cbd` rechecked against remote main. Focused High gate passed **543 tests in 45 files** (441 fast + 102 serial), **185.173 seconds**, within its five-minute budget. TypeScript, diff checks and AI-surface checks passed. This includes mounted invitation cancellation/identity shielding, all five audit regressions, the real captured-command two-principal journey, legacy compatibility refusal, real PGlite history/proof matrix, startup and Bianca rehearsal. The prior broad discovery run exposed integration failures which were repaired; the final gate is the acceptance result.

Command: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/onboarding-v2-authority-journey.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus=test/month-rehearsal-golden.test.ts --focus=test/month-rehearsal-preflight-ui.test.ts --focus=test/month-rehearsal-ui.test.ts --focus-reason="Onboarding v2 authority, migration, invitation recovery, reviewed statement history and Bianca startup rehearsal"`

The full production build passed; after the final runtime guard, Vite and the Hercules UI bundle were rebuilt successfully. Its source tree `9013f319098efe08935b1e918d095e672f1d29af` is identical to the final gate head. Bundled PDF worker assets are present; existing large-chunk/PGlite eval warnings remain. New direct PGlite tests run serially. No exhaustive full gate was run. Verification logs are `/tmp/onboarding-v2-high-gate2.log`, `/tmp/onboarding-v2-final-build2.log` and `/tmp/onboarding-v2-final-bundle.log` on this host.

### Release and rollback handoff

This is a local implementation result and a draft integration PR, not tonight's device certification. Release is a separately authorized step. After any new accepted history exists, never deploy the unmodified old writer against those records. A rollback must keep the compatible receipt/lineage decoder and authority, or disable mutations while preserving records; use a forward correction for accepted financial changes. Do not reset the household, erase receipts, reverse only part of a correction group, or use legacy sync as fallback. Finish the real Development and physical accessibility gates above before marking this patch ready.
