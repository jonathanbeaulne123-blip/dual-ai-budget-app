# Five shared boards and clearer mobile navigation

Status: implementation in progress. Jonathan approved the complete plan in this task on 2026-09-08.

Base: origin/main 5778a8d32389e3db194cdb4d602025581f953539, verified against remote. Integration branch codex/hearth-five-boards; isolated worktrees each have one writer. Calendar, Books, entry, media and shared-board UI are bounded delegated patches; coordinator owns board commands, continuity integration, Office placement and final verification.

Risk: High. Budget (5): clearer entry, account navigation and protected accepted-book projections. Engagement (3): five useful shared boards authored for Classic Hearth, Taylor's Scrapbook and Newfoundland. Decision owner: Jonathan.

Scope: four mobile Add modes with existing shift order; traditional calendar default alongside Month; Categories below plan summary; household overview/navigation; Notes/Photos/To-do/Goals/Shift Ask looping boards. Shared media uses a dedicated authenticated object service; bytes stay outside snapshots. New commands use scoped identity, stable ids, reviewed item versions and existing continuity. Savings stays derived from accepted goals.

Acceptance: entry cancellation/More/confirm/retry/scope guards; calendar routing and integration placement; all Books tools reachable; board gesture ownership, draft retention and scope resets; photo failure/replace, concurrent tasks/milestones, deletion/reconnect; three themes at 320/390/719/1100/1440, zoom/focus/reduced motion. Focused High quick gate and independent money/continuity plus UX reviews. Browser simulation and synthetic client proof are distinguished from physical devices and authenticated hosted proof.

Release boundary: local implementation and verification only. No deploy, storage provisioning, hosted schema, Production, or household cleanup. Record exact commands/results and remaining deployment dependencies before handoff.

## Verified integration candidate

Product candidate: `a45d6a83da9007d8397b2a853b59f92463fff1c5` (same product source as `26eee66`; follow-up changes only calendar proof copy and browser navigation timeout). Remote main rechecked during final verification: still `5778a8d32389e3db194cdb4d602025581f953539`. No subsequent changes were discarded.

High quick gate passed on a clean tree in **160.646 seconds**, within the 300-second target. **255 tests across 25 files passed** (183 fast, 72 serial), including all 65 startup tests, the seven accounting proof-matrix tests and the mainline month rehearsal. TypeScript, AI surface and all diff checks passed. Fingerprint: `b1388017a46c6749ac484375dc1e83517585b8efc83d5807dba3493acdb7dab6`. This is the focused High gate, not an exhaustive gate.

Build: Vite production bundle passed in 18.64 seconds; Hercules Pro UI build passed. Existing PGlite browser-external/eval and bundle-size warnings remain. No deployment was performed.

Runtime path: `/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin` prepended to PATH. Reproduce the quick gate with:

```sh
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --base=5778a8d \
  --focus=test/shared-boards.test.ts --focus=test/shared-boards-continuity.test.ts \
  --focus=test/shared-boards-reconcile.test.ts --focus=test/shared-boards-ui.test.ts \
  --focus=test/shared-board-intent.test.ts --focus=test/board-photos-ui.test.ts \
  --focus=test/board-rejected-draft.test.ts --focus=test/board-media-worker.test.ts \
  --focus=test/board-media-browser.test.ts --focus=test/board-media-r2.test.ts \
  --focus=test/five-boards-entry-app.test.ts --focus=test/mobile-entry-sheet.test.ts \
  --focus=test/calendar-boards.test.ts --focus=test/books-household.test.ts \
  --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts \
  --focus-reason='Approved five-board integration: account intent and posting lifecycle, calendar and Books routing, item authority and offline recovery, photo isolation and retries, Notes acceptance, startup and rehearsal regressions'
node test/five-boards-layout.mjs
node node_modules/vite/bin/vite.js build
node scripts/build-hercules-pro-ui.mjs
```

## Independent review and reproduced repairs

- Financial entry review: internal Close could accidentally preserve submitted drafts; More could bypass an ambiguous account choice. Reproduced before repair. Accepted and queued entries now reopen empty with distinct confirmation IDs; explicit UI dismissal alone pauses. Expense/income More and duplicate review require deliberate account intent, including after resize. Independent seven-test recheck passed; no new material financial findings.
- Continuity review: per-item actor/version commands, offline IndexedDB reload and local SQLite authority, removal/edit races, wrong scopes and lost ACK were exercised. Five real local transport tests pass. Three legacy public-reconciler failures reproduced before the boards-only recovery merge; six reconciliation regressions pass. Canonical/v2 adoption still excludes unaccepted local rows.
- Media review: uncoordinated DELETE could erase an attached object, and spreading input objects could persist unexpected credential fields. Four before-fix failures reproduced. Physical DELETE is disabled without touching storage; persisted scope/intent/crop are allowlisted. Thirteen media tests pass, including real Chromium image processing/IndexedDB and local workerd/R2.
- UX review: pending drawing cleared prematurely and a successful photo retry falsely reported conflict. Five failures reproduced before repair. Twenty-five UI tests pass. Independent Chromium recheck confirms the canvas survives a delayed/rejected save, new strokes survive earlier acceptance without duplication, and photo retry closes only the matching editor while preserving newer caption/crop/file edits. Both findings closed.
- Navigation review: deferred Ask opens with blocked session storage; closing/reopening on mobile works repeatedly. Independent React lifecycle probes passed all four storage/mount combinations, twelve close/reopen cycles, scope isolation and listener cleanup. Twenty-three board/intent/Reach tests passed.
- Additional independent UX evidence: 75 local browser observations across three themes, retained drafts, photo dialog focus, reduced motion and 200%/400% CSS zoom. This is not physical device or native browser-chrome zoom proof.

Earlier failed runs are not hidden: the initial startup helper expected legacy account tiles (two failures, repaired without changing posting-lock assertions); the first final quick gate had four obsolete Google-copy assertions (corrected, then the complete 255-test gate passed). A concurrent build/test/browser pass timed out during local navigation; the browser proof was rerun with a bounded 90-second navigation allowance. Initial test setup/type errors were corrected before the clean final gate.

## Release and acceptance limits

Dedicated Development photo bucket provisioning, hosted membership/OAuth return, physical iOS/Android/Safari and authenticated two-device acceptance remain separate release steps. Existing sync latency gates are unchanged. Photo removal clears the accepted slot; obsolete private bytes remain until coordinated authority-aware garbage collection. No physical erasure claim is made. Recovery retains rejected board text for manual review/reapplication; it never auto-replays a stale edit.

The [durable handoff](../briefs/FIVE_SHARED_BOARDS_HANDOFF.md) describes interfaces, data boundaries, release dependencies and compatibility-safe rollback. Local screenshots/logs contain fictional data and remain ignored under `.artifacts/`.
