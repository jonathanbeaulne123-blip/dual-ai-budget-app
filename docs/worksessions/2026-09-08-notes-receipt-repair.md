# Notes receipt repair — PR 409

- Owner/decision owner: Jonathan; bounded implementation by Codex, release by parent coordinator.
- Branch: `codex/notes-receipt-repair`; exact baseline `6bc71f879b37d4b11ff13f41b2ccc1c6fe2fff6d`.
- Worktree: `.codex-work/notes-receipt-repair`; sole writer.
- Risk: High, release blocker repair. Environment impact: local source/tests only.
- Budget delta (5): unchanged financial payloads and authority. Engagement delta (3): Notes retain drafts without duplicate submissions while queued.

## Outcome and decisions

Each typed/drawn note has an immediate local submission latch. Null, void, rejected promises, queued transport and uncertain recovery keep that latch until a matching accepted note appears. Retry requires definite no-write and explicit retryability. Permanent validation/business rejection permits editing for review rather than blindly resubmitting the same payload. Late responses are bound to the mounted scope and attempt. Acceptance removes only submitted strokes and preserves newer text/strokes.

The existing Office callback chain now returns the original `runKitchen` result and forwards its optional definitive-rejection signal. Missing v2 client and unopened books gate are known pre-dispatch refusals marked retryable; household mismatch and command construction/business rejection require review. No inference from generic exceptions or null was added. Global transport recovery remains responsible for ambiguous receipts.

Drawing receipt feedback sits below the canvas, inherits each authored theme's readable board colors, and uses existing 44px controls. Board/theme switches retain the latch and drafts; scope retirement invalidates callbacks. No storage, core command payload, photo or release change.

## Evidence

Pre-fix direct Vitest run of `test/shared-boards-ui.test.ts`: 12 passed, 2 failed. Three typed submit events produced three commands, and Retry drawing appeared before any rejection.

Post-fix evidence (bundled Node `/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node`):

- `node_modules/vitest/vitest.mjs run test/notes-submission-ui.test.ts test/shared-boards-ui.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1`: 40/40 passed, 17.54s.
- `node_modules/vitest/vitest.mjs run test/app-startup-p1.test.ts --maxWorkers=1`: 70/70 passed, 31.03s, including the full-App Bianca regression and five new real-App outcome/boundary cases.
- `node_modules/typescript/bin/tsc --noEmit`: passed.
- `git diff --check`: passed.

The 110 tests cover repeat submit/retry before ACK, definite failure and unchanged retry, permanent review, null/void/rejected promise/uncertain recovery, accepted receipt before props, newer text and active/finished strokes without duplicate originals, A-B-A retirement, and mounted SharedBoards draft/latch retention in all three themes. No new browser or hosted proof is claimed for this bounded repair. Parent owns final integrated High/release validation and push/merge/deploy. No install or exhaustive gate ran.
