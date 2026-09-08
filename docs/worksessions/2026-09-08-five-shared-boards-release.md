# Five shared boards — authorized Development release

Jonathan explicitly instructed “push merge and deploy” after the local implementation handoff. This authorizes the Development release and its dedicated private photo-storage dependency. Production activation, schema application and destructive cleanup are outside this release.

Risk: High / Release. Budget (5): faster entry with explicit account intent and clearer accepted household balances. Engagement (3): five useful shared boards with authored Classic Hearth, Taylor's Scrapbook and Newfoundland treatments.

Candidate before release preparation: `e868652e826b6c075ba88bd78a8adaeb4b20d870`, clean, on `codex/hearth-five-boards`. Remote main rechecked at `5778a8d32389e3db194cdb4d602025581f953539`; subsequent main changes must be preserved. Product acceptance and independent review evidence are in [the implementation receipt](2026-09-08-five-shared-boards.md).

## Storage and rollout

Created dedicated R2 bucket `hearth-board-media-development` in the configured Hearth account, then verified public r2.dev access is disabled and no custom domains are attached. The only deployment configuration addition binds this bucket as `BOARD_MEDIA`. Existing secrets, Production bindings, flags, databases, schedules and Durable Object migrations are unchanged. Client and Worker ship together through the existing main-branch Cloudflare Workers workflow.

Photo reads and uploads require the existing authenticated household authorization. Removal clears the accepted slot reference; physical deletion remains disabled to protect concurrent attachments. Prior bytes remain private until a separate authority-aware retention implementation. No household data or test photos were written during provisioning.

Pre-release active Worker version: `684d8d27-26b9-4fbd-9513-d364bd6fe9fa` (100%), created 2026-09-08T19:07:41.518Z. Before new board data is accepted this is the rollback reference; after board commands are accepted, preserve command/data compatibility and prefer a forward repair. Never delete the bucket to roll back presentation.

Release checks: generated binding types, Worker dry run, focused High quick gate for media authorization/R2 and startup/rehearsal; PR CI and build before merge; main CI and Cloudflare deployment after merge; fresh live asset and unauthenticated media-boundary checks. Results and exact PR/merge/deployment identifiers are recorded with the release handoff. Hosted authenticated two-device, physical iOS/Android/Safari and real Google-return proof remain distinct from local browser evidence.

## Pre-push receipt

Release PR: [#409 — Make daily entry quicker and add five themed shared boards](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/409). The PR contains the final hosted check and deployment receipt.

At clean `1193f6b87d44ff5f769d97236ce9110b065fdea8`, the focused High release gate passed **79 tests across five files in 52.779 seconds**, including 65 startup cases, real R2/browser media checks and month rehearsal. TypeScript, AI surface and diff checks passed. No time-budget breach. Base `e868652`; fingerprint `5bf60f1de250fbca58e09d72f0c2e17411d732279c16ff42b46952f4029d403a`. Subsequent release-receipt edits are documentation only.

Command: `pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --base=e868652 --focus=test/board-media-worker.test.ts --focus=test/board-media-r2.test.ts --focus=test/board-media-browser.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Authorized Development release: private BOARD_MEDIA binding, media authorization and immutable R2 operations, startup and rehearsal regression'`.

Installed Wrangler 4.125.0 generated types with `BOARD_MEDIA: R2Bucket` and passed `deploy --dry-run`, reporting the intended dedicated bucket. Logs and generated types are ignored under `.artifacts/five-boards/release-*`. No application source changed after the previously reviewed integration acceptance.

## Hosted runner repair

PR CI run `34278009762` exposed missing Chromium on the Linux runner and a nondeterministic reconciliation test comparing household commit timestamps from consecutive commands. The workflow now installs the locked Playwright Chromium headless shell and system dependencies. The reconciliation fixture gives local/remote inputs explicitly distinct timestamps; the expected personal payload is unchanged while the assembled envelope must carry the later accepted household timestamp. The old assertion failed locally with that deterministic fixture before correction. No product behavior or money assertion was changed, and no browser test was skipped.

After correction, reconciliation, real-browser continuity and media tests passed **16/16 across three files in 11.87 seconds** with `node node_modules/vitest/vitest.mjs run test/shared-boards-reconcile.test.ts test/shared-boards-continuity.test.ts test/board-media-browser.test.ts --maxWorkers=1`. The hosted rerun validates installation on Linux. The PR's automatic security review reported a usage limit; completed independent implementation reviews remain the scoped evidence.

The next hosted run `34278574395` passed the browser and reconciliation checks, then the lane-policy canary caught the new mounted App entry test missing from the serial PGlite manifest. Added it to `test:books`, excluded it from `test:fast`, and registered its detected runtime import in the lane-policy assertion. No test was removed or skipped. Lane policy, verification policy and all 13 mounted App entry tests passed **32/32 across three files in 13.37 seconds** with serial execution. The quick gate derives its serial set from this same package manifest.

## Review closure and final integrated acceptance

CI `34278903996` passed 283 tests, and its matching build passed. Before merge, the PR code review identified two valid Notes duplicate-submission findings. Both were reproduced and repaired in independently reviewed `6ee85f75aa8cde54eca4ecf2f18e39834297bda6`, integrated as `a6096d76ce1f24dbc5215d04c4e895e627d6f6a4` with an identical tree. [Notes receipt](2026-09-08-notes-receipt-repair.md) records the explicit no-write/retryability contract and author proof. Both PR review threads are resolved.

At clean `a6096d7`, the integrated **High gate passed 161 tests across eight files in 72.139 seconds**: 71 fast and 90 serial, including 70 startup cases, 13 real entry cases, seven accounting proof cases and month rehearsal. TypeScript, AI surface and diff checks passed; no time-budget breach. Base `6bc71f8`, fingerprint `b7315535dcc7b25f729470fd2f1e4cc128d007a262b0b033f00ee26aca2bf2a5`. Hosted CI `34280796674` also passed on this candidate.

Real-CSS browser proof then passed **60 Notes states** (waiting typed/drawn, definite rejection, retried acceptance with newer draft retained) across all three themes at 320/390/719/1100/1440. Screenshot review found the enabled Save button inherited pale scene text over board paper; axe reproduced **1.08:1** contrast. The final CSS pairs white primary labels with each authored board accent. The full 60 cases and **15 enabled-button axe contrast checks** passed after correction, with no runtime errors. All three corrected 320px screenshots were inspected. This is the only product change after the integrated High gate; final PR/main CI and build verify the release candidate.

Ignored browser script and reports: `.artifacts/five-boards/release/notes-layout.mjs`, `notes-layout-report.json`, `notes-contrast-before.log`, `notes-layout.log`, and three `notes-*.png` screenshots. The initial axe wrapper needed an explicit Playwright browser context; it was corrected before the recorded contrast failure/pass. Final hosted release identifiers and smoke receipt live in PR #409.

Independent CSS review also identified a more-specific scene hover rule. The board primary rule now covers enabled hover explicitly, keeping the same authored foreground/background pair in both states. Final acceptance includes 15 default plus 15 hovered enabled-button contrast checks; the first Classic hover probe already passed contrast, so no separate hover contrast failure is claimed.
