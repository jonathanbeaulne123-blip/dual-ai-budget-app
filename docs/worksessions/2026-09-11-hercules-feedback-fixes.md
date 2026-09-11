# Hearth worksession — Hercules feedback fixes

- **Status:** PR #445 LIVE IN DEVELOPMENT — scoped review follow-up in progress
- **Opened:** 2026-09-11 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex; independent read-only reminder and planning audits
- **Repository:** dual-ai-budget-app
- **Branch:** codex/hercules-feedback-fixes
- **Baseline / head SHA:** 9abee76 (fresh origin/main; initially clean)
- **PR or issue:** none
- **Risk:** High (account settings and reviewed Plan execution)
- **Environment impact:** local Development verification only

## Household outcome
Hercules notices current bills and outstanding claims, walks through optional account details, and turns a small savings intention into an editable monthly Plan decision.

## Budget delta (5)
Ground reminders in visible accepted evidence. Reuse account and Plan commands, preserve existing Plan decisions, and retain Final Confirm, scope and receipt safeguards.

## Engagement delta (3)
Useful quiet prompts outside active conversation, sensible account-type inference, skippable guidance and a focused goal conversation.

## Verified baseline
Account creation only asks name/type. Explicit Visa creation misses the deterministic matcher. Monthly guide discards opening purpose and requires a full questionnaire. Discovery has no claim reminder; its closed invitation is a static dot.

## Scope
Implement and test the three reported local flows. Retain authored existing theme surfaces. Card provider research is assessed separately from trustworthy account terms; no guessed issuer rate or silent autofill.

Excluded: deployment, schema, secrets, Production, real household writes, external notifications and external account changes.

## Implementation
- `src/core/herculesAccountGuide.ts`, `herculesActions.ts`, `herculesTools.ts`: explicit account/card type inference, type-specific optional questions, settings validation, clearly labelled unverified defaults and scoped recorded-term answers.
- `src/core/planGuide.ts`, `src/HerculesActionPanel.tsx`, `src/HerculesPlanGuide.tsx`: focused savings conversation, existing/new Kitty choice, retained monthly decisions, dependent-answer correction and queued task pivots. Exact confirmation composes an unfunded Kitty with its linked private draft; it neither agrees a Shared Plan nor records a contribution.
- `src/core/herculesExecution.ts`: combined domain action and private-workflow consumption use captured typed authority together; retain the original undo snapshot and existing member/view guards.
- `src/core/herculesCapabilities.ts`, `herculesDiscovery.ts`, `src/Hercules.tsx`, `src/HerculesDiscovery.tsx`: current bill/claim reminders, minute-based expiry refresh, memoized selection, existing private snooze/disable and exact explanation opening even after earlier conversation.
- `src/App.tsx`, `src/Calendar.tsx`, `src/Appointments.tsx`: exact claim route/focus, including repeated navigation to the same claim.
- `src/hercules.css`, `src/styles.css`: theme-specific reminder materials, bounded captions, compact phone header and protected desktop header/composer.
- Corresponding Hercules, Plan and Calendar regression tests plus `scripts/companion/feedback-proof.mjs`; `test/swipe.test.ts` corrects an existing stale source assertion from the former single-transaction Undo variable to current plural targets. The underlying Undo code matches the baseline and is unchanged.

## Acceptance evidence
- [x] Account inference, optional details, edits, exact review and one confirmed command.
- [x] Focused goal planning, existing monthly decision preservation, unfunded semantics and review invalidation.
- [x] Current bill/claim prompts, snooze/disable, stale resolution and source navigation.
- [x] High-risk quick gate, production assets and synthetic browser checks across all three themes and both scopes.

## Verification commands
Use the bundled Node runtime on PATH. The shared installed dependencies require `npm_config_manage_package_manager_versions=false npm_config_verify_deps_before_run=never` plus the equivalent pnpm flags; plain pnpm stopped at its no-TTY module-install guard, before running tests.

```sh
export PATH=/Users/jonathanbeaulne/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH
export npm_config_manage_package_manager_versions=false
export npm_config_verify_deps_before_run=never
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never test -- --risk=high --focus=test/hercules-execution.test.ts --focus=test/plan-guide-ui.test.ts --focus=test/hercules-action-ui.test.ts --focus=test/hercules-calendar-integration.test.ts --focus-reason='Hercules feedback flows, phone and desktop review layout, reminder reopening and existing Swipe Undo source contract'
pnpm --config.manage-package-manager-versions=false --config.verify-deps-before-run=never build
node scripts/companion/feedback-proof.mjs
```

The browser runner expects local Vite on `127.0.0.1:5199`, with Hercules actions/chat/discovery and Plan V2 enabled. The local server must allow the real path of the linked `node_modules` for PGlite WASM. It uses a fresh synthetic demo and aborts nonlocal requests, non-GET requests and model routes. It exercises review/cancel, not real money writes. Synthetic command tests exercise actual confirmation and server replay.

## Evidence log
- Initial direct runs found missing guide explanation, an obsolete broad-invalidation expectation and unstable new-goal preview identity. All corrected; subsequent focused Plan/account/tool runs passed.
- A quick gate exposed free-text `Make room for rest` being treated as steering. Narrowed the matcher; then **35 files / 477 tests passed**, all six phases green, **190.972 seconds**, no five-minute breach (`/tmp/hercules-feedback-quick4.log`).
- `pnpm build` passed, with existing PGlite/browser externalization and large-chunk warnings. No deploy command was run.
- Real browser iteration caught the reminder explanation collapsing after chat history; corrected and **16/16 private-chat UI tests passed** on phone/desktop, including focus trapping/restoration and resolved evidence (`/tmp/hercules-feedback-final-ui.log`).
- Nine browser cases initially passed across all three themes at 320/390/1440px with no horizontal action overflow or page errors. Visual review then exposed phone portrait overlap and desktop header overlap; corrected and expanded verification to both ledger scopes and breakpoint widths.
- Styles selected the existing Swipe source-contract suite. The subsequent gate failed only its stale `Boolean(fundedTransactionId)` assertion, confirmed against baseline `App.tsx`; updated to the unchanged `fundedTransactionIds.length > 0` behavior. Failed gate: **174.335 seconds**, no time-budget breach (`/tmp/hercules-feedback-quick5.log`).
- Independent read-only planning and reminder reviews identified/fixed scope, identity, dependency, unique-action, memoization and repeated-navigation defects. Independent screenshot review found the desktop header obstruction; closure is recorded below.
- Final High-risk quick gate: **37 files / 518 tests passed** (390 fast + 128 serial), TypeScript/diff/AI-surface checks passed, **271.127 seconds**, no time-budget breach (`/tmp/hercules-feedback-quick6.log`, fingerprint `e1f95355c4f03350dd7611f8c1b269b2e24a655f147c1351adabbd0349fcc985`). The final portrait-container CSS sizing and proof-runner refinements followed this fingerprint; they are covered by the browser check and final asset build rather than claimed as that exact gate input.
- Independent screenshot re-review confirms the desktop header obstruction is closed. The real browser successfully clicks Expand and Compact with the review visible. The portrait container is explicitly bounded to 44px on desktop and 64px on phone.
- Final browser matrix: **48/48 cases passed**, Classic/Taylor/Newfoundland × Household/Personal × 320/390/719/720/721/1100/1440/1920px. Account type inference, skippable detail review, unfunded focused-goal start, cancel, reminders, disclosure reopening, header geometry and real Expand/Compact clicks passed. No action horizontal overflow or browser page errors. Evidence: `.artifacts/hercules-feedback/report.json` and the adjacent synthetic account/goal screenshots. Reduced motion enabled; this is Chromium viewport evidence, not physical-device certification.
- Final current-source Vite asset build passed in **30.72 seconds**, followed by `node scripts/build-hercules-pro-ui.mjs` and the no-redirects check. The earlier complete `pnpm build` and the final gate both typechecked the TS/TSX changes. Final bundle log: `.artifacts/hercules-feedback/hercules-feedback-final-bundle2.log`.

## Assessment of issuer research
The recorded account model supports APR, cashback, limits, statement/due dates, savings rates and investment type, so those can be safely gathered and reviewed now. Product names alone do not establish current issuer terms or an individual's promotional rate. An automatic research extension would need cited issuer evidence, a freshness date, unresolved-field handling and explicit review of proposed values before accepting them. This patch deliberately does not present Hearth defaults as researched terms or activate that extension.

## Remaining uncertainty
Automatic issuer research/autofill is not implemented. General natural-language steering beyond explicit corrections and recognized goal pivots still uses the existing bounded model/proposal path; live Gemini quality has not been proved. Reminders are in-app, not operating-system or email notifications. The synthetic demo cannot acknowledge private conversation saves without connection; the expected unsaved-state notice remains visible. Authenticated writes, Safari, physical devices, external notifications and cross-device restoration are not established by this browser matrix. No exhaustive gate was requested or run.

## Handoff
At implementation handoff, no push, PR, merge, deployment, hosted schema change, provider activation, secrets or real household mutation had occurred.

## Authorized Development release
Jonathan explicitly requested "push merge deploy" after receiving the implementation results and limits. This authorizes this scoped Development code release, superseding the earlier local-only boundary; it does not authorize Production activation, schema, secrets, real-household writes or the exhaustive gate. The release-review skill supplies the review checklist; Jonathan's current explicit release instruction supplies execution authority.

Release assessment: **CONDITIONAL** for Development code availability, subject to current-main integration, current candidate checks, PR CI/build and deployment verification. The 518-test quick gate, 48-case browser matrix, independent reviews and builds support the bounded changes. Authenticated/physical acceptance and issuer research remain the limits stated above. Compatible rollback retains the private command/profile protocol; presentation may be disabled through the existing Hercules flags without erasing accepted records.

Fetched main advanced to `0837f9a4e0da068104428579d72a15629fb7b5b4` (#444). Preserve its scrolling Easy Read placement during integration. Release receipts and the final live result will be recorded after execution.

## Release receipt and review follow-up

PR [#445](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/445) merged as `5f437f5b56d1297cfbd5fbbb0f73ff525423f090`. Main CI and confirmed-action checks passed. Cloudflare [run 34655164776](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/34655164776) deployed Worker version `d1b2ee83-de8f-41a5-aa77-906ca2004f4c`. Fresh live synthetic checks passed 12/12 across three themes, both scopes and phone/desktop, with HTTP 200 and the new asset markers verified. Production continuity remained disabled.

The exact local release gate passed 518 tests and all phases in 301.818 seconds, **1.818 seconds over the five-minute target**. PR CI passed 568 tests in 134.042 seconds; this does not erase the local time-budget breach. Rebased-source browser checks passed 48/48 after disabling hot reload during proof.

Automated review returned after deployment. Branch `codex/hercules-feedback-review-fixes`, based on the merge above, corrects independent savings provenance labels, missing account aliases and focused planning scope normalization. The alleged hidden confirmed write was not reproduced: the review adapter already filters inactive fields. The related confirmation dead end and raw preview inconsistency were reproduced. New regressions cover mode switching, restored drafts, saved assumptions/lines, review stability, one linked unfunded goal and unchanged money records in both scopes. Initial focused tests: 3 files / 56 passed. Risk remains High; Budget delta (5) is accurate review and preserved decisions; Engagement delta (3) is reliable scope changes and account language. Jonathan's existing scoped Development release authorization applies to this corrective follow-up.
