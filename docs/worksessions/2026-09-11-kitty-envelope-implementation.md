# Kitty Banks envelope app implementation

- Status: IMPLEMENTED LOCALLY over existing vault/Fund authority; scoped validation passed, original quick-gate failure retained; release and live acceptance pending
- Decision owner: Jonathan; explicit implementation instruction: “ok now make it happen” (2026-09-11).
- Branch: `codex/kitty-envelope-app-20260911`; isolated checkout `.codex-work/kitty-ux-design`.
- Base: `16d4710733c5e5ff1655e5a7d2bdff6c01b59ad2`; #433 and #437 are merged.
- Risk: High. Budget (5): conserved, scope-bound envelope backing and reviewed use. Engagement (3): a tangible room, personalized banks, useful rehearsal and legible themed interactions.
- Packet: [cinematic envelope app](../briefs/KITTY_BANKS_CINEMATIC_ENVELOPE_APP_2026-09-11.md).
- Scope: real room and scoped open/return, truthful shared evidence with Plan, envelope lifecycle and reviewed allocation/use/refill, original Calendar meanings and readable Hercules requirements.
- Boundaries: local implementation and synthetic verification; no hosted schema, household mutation, Production, merge or deployment. Release authorization remains separate.
- One writer: Codex. Claude supplies one bounded sculpture module in chat; independent agents inspect financial contracts and integration read-only.

## Verified baseline and decisions

#437 merged while the design was being completed. Its goal linkage, scoped dated projection and existing Plan authority are reused. The old missing-goal-entry finding is not outstanding work.

Archived visibility must not free backing. Funding status and archival are separate. Partial uses preserve exact receipts, and remaining backing must subtract accepted attributed uses, not lifetime contributions or arbitrary category matches.

Shared cash accounts can overlap Fund claims hidden in another member's private envelope. Initial account-independent Shared assignment therefore uses the Fund's existing accepted allocation authority. Personal account assignment must exclude Fund custody/source claims. No UI is permitted to guess that nominal account cash is unassigned.

## Evidence to collect

- Focused envelope/command/Plan/sync tests, required mainline canaries and quick gate.
- Build, actual room journeys across three themes and two scopes at phone/desktop widths, relevant boundaries and empty/long/recovery states.
- Independent financial/privacy and visual review, with measured results and acceptance limits.

## Execution log

- Fetched `origin/main` and #437; verified merged status through GitHub connector.
- Read current constitution, applicable repository skills, page-theme standard and current command/projection contracts.
- Reopened the existing Claude design conversation for a presentation-only Three.js sculpture implementation; preserved its model configuration and sent no private household data.

## Implemented scope and deliberate limits

The room uses the actual `KittyBanks`, `PlanStudio` and command pipeline. It includes collection navigation, create/details/glazes, open/close and rotation, DOM/SVG fallback, four folio views, exact Plan links, payday schedules, private scenario creation, contextual Hercules, contributions, reusable partial purchases, exact Fund release, history, archive and restore. The underlying Plan stays mounted. Scope changes discard the old room; a scoped session receipt marker survives reload and is checked through the existing submission reader before another reviewed money action.

Shared assignments use existing Fund authority; Personal funding records an actual Goals-vault transfer. General account-independent cash assignment, arbitrary envelope-to-envelope reallocation, credit-card reserve/payment logic, automated refill execution, authored milestones/memorabilia and bank-specific return drafts from Hercules are not implemented. Refill preference is saved intent; it does not schedule transfers. Fund release is visibly distinct from a purchase. This is a functioning room over supported authorities, not certification of every proposed future-vision contract.

Claude provided one bounded sculpture module in the existing design chat. Codex reviewed/reworked its geometry, opening, material, resource ownership and integration. No accounting was delegated to the model. The local proof uses fictional books and rejects provider POSTs.

## Independent review and fixes

Two read-only audits checked the financial foundation and room integration. Findings fixed: exact vault/owner receipts, linked refund/reversal graphs, per-receipt overrefund protection, append-only partial-purchase Undo with actual authority replay, Fund release coverage after reversal, dated Fund folds and vault allocation reads, backdated use against future accepted vault activity, private dependency filtering, stale detail/glaze saves, failed/unknown outcome handling, persistent recovery IDs, errors within the active dialog, Plan callbacks, source-focus handling, and partial WebGL initialization/context-loss cleanup. Both closure reviews reported no blockers in the reviewed scope.

## Browser evidence

Actual source components via `scripts/serve-plan-life-proof.mjs`, local port 5190; fictional data only. Evidence directory outside Git: `.codex-artifacts/kitty-room` under the parent workspace.

- Classic, Taylor and Newfoundland, each Shared/Personal: 390 and 1440 screenshots; 320/719/720/1100/1920 additional geometry checks. All 42 combinations fit without horizontal overflow.
- Partial purchase $40 against $300: accepted fictional receipt, bank stays open at $260, focus returns to the bank. Archive retains $260.
- Private scenario $225 saves inside the room; Plan retains its scenario selection. Hercules receives a prefilled contextual composer without sending automatically.
- A long bank name and purpose save, render without overflow, and retain controls in simple view with the canvas removed. Second fictional member sees an empty private room and no first-member name.
- Native accessibility snapshot exposes the active room, with background inert. Both room and nested Confirm use the existing keyboard/focus trap. Automated keyboard proof is recorded with the final test results.
- Actual keyboard closure pass found that the archive disclosure was skipped by the existing focus selector. Added explicit `tabIndex=0` to this summary. Browser recheck: Shift+Tab from Back reaches the disclosure; Enter opens it; Tab reaches Review archive; Enter opens nested review focused on Cancel; Escape closes only the review and restores Review archive, leaving the bank and its $300 unchanged.
- Successful detail save now focuses the selected bank before the edit form is removed. Final browser check confirmed `document.activeElement` carries the selected `data-goal-id`, remains inside the room, and the saved notice is visible.
- Six normal Hercules text/background pairs were inspected; all are opaque and legible. Easy read produces `rgb(37,35,31)` on `rgb(255,250,240)` at 17px in every theme/scope.
- Measured normal Hercules text contrast is at least 7.05:1; Easy read is 15.08:1. These are the inspected chat surfaces, not a whole-app accessibility certificate.
- Actual Calendar source: all six theme/scope combinations at 390/1440 have no horizontal overflow; the legend and in-cell bill symbol have type labels. Twelve geometry records are in `calendar-proof.json`. A fresh 390×1000 Newfoundland phone capture verifies the stacked legend/grid; immediate post-resize thumbnail captures are not phone visual evidence. Google remained disconnected and disabled.
- Reduced-motion CSS disables transitions/animation, and the sculpture renders only on changes (no idle animation loop). Physical reduced-motion/VoiceOver, WebGL failure on a real device, authenticated cross-device persistence and live provider replies are not certified by this local proof.

## Verification chronology

- Existing goal funding, Plan projection and purchase UI: 34/34 tests passed before integration fixes.
- Initial focused envelope/recovery tests found and drove the documented fixes; final counts below supersede intermediate runs.
- High quick gate: diff, AI surface and TypeScript passed; 296/297 fast tests passed. One environment-isolation test timed out under four workers. Total 309.766 seconds, five-minute budget breached; serial lane did not run. Log `quick-gate.log`. This gate is **not green**.
- Serial recovery passed all 17 environment-isolation tests; the failing test took 1.063 seconds. The first recovery command omitted the repository's 30-second serial timeout and was interrupted after cascading React act warnings. It is not acceptance evidence for startup.
- Standalone startup: **81/81 passed** with `--maxWorkers=1 --testTimeout=30000 --reporter=verbose --bail=1`; 605.23 seconds. This includes the full-App Bianca Month, draft, receipt-recovery, scope, Count/Swipe/Claim/Due and continuity regressions. Log `startup-canary.log`.
- Final focused serial selection: **87/88 passed**, 9/10 files; 356.69 seconds. All Kitty Bank (14 authority, 3 UI recovery, 3 existing), Hercules tools/private chat, Plan system, proof matrix, Month rehearsal and keyboard-dialog tests passed. Demo-entry navigation in `onboarding-entry-integration` failed its internal five-second wait. Standalone retry reproduced it and a subsequent test observed the late demo write; investigation below. Logs `final-focused.log`, `onboarding-standalone.log`.
- Demo-entry comparison: unchanged baseline `16d4710` passed **6/6** in 20.73 seconds, with Demo→Home in 3.016 seconds. Immediate unchanged candidate rerun passed **6/6** in 17.21 seconds, with Demo→Home in 3.320 seconds. No timeout or assertion was weakened. The earlier candidate run's transform/collection took 95 seconds versus 10.49 seconds in the passing run; its late demo completion contaminated the following assertion. Logs `onboarding-baseline.log` and `onboarding-after-baseline.log`. All selected files now have passing scoped serial evidence; the original quick-gate failure and SLA breach remain.
- `pnpm build`: **PASS**, exit 0. TypeScript, Vite (709 modules) and Hercules Pro UI build completed. Sculpture is a lazy 3.14 kB module (1.50 kB gzip), with Three in separate chunks. Vite warns about large existing application chunks; no bundle-performance certification is inferred. Log `build.log`.
- After the final focus corrections, `node node_modules/vitest/vitest.mjs run test/kitty-envelope-ui.test.ts test/claude-ux-dialog.test.ts --maxWorkers=1 --testTimeout=30000`: **10/10 passed**, 2 files, 9.64 seconds. Log `focus-closure.log`.
- Final `git diff --check` and proof-runner syntax check passed. Temporary comparison checkout and Calendar server were removed/stopped; the fictional Kitty/Plan preview remains on port 5190. Browser viewport override was reset.

## Review and release handoff

Reproduce the scoped checks with the bundled Node directory on `PATH` and the checkout's existing dependencies (do not reinstall shared worktree dependencies):

```sh
pnpm test -- --risk=high --focus=test/kitty-envelope.test.ts --focus=test/kitty-envelope-ui.test.ts --focus=test/plan-projection.test.ts --focus=test/plan-life-contract.test.ts --focus=test/goal-funding-scope.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason='Reusable envelope purchases and exact correction receipts, scoped Plan integration and startup regression'
node node_modules/vitest/vitest.mjs run test/app-startup-p1.test.ts --maxWorkers=1 --testTimeout=30000 --reporter=verbose --bail=1
node node_modules/vitest/vitest.mjs run test/hercules-private-chat-ui.test.ts test/onboarding-entry-integration.test.ts test/plan-system.test.ts test/proof-matrix.test.ts test/kitty-envelope.test.ts test/kitty-envelope-ui.test.ts test/kitty-banks.test.ts test/hercules-tools.test.ts test/claude-ux-dialog.test.ts test/month-rehearsal-mainline.test.ts --maxWorkers=1 --testTimeout=30000
node node_modules/vitest/vitest.mjs run test/onboarding-entry-integration.test.ts --maxWorkers=1 --testTimeout=30000 --reporter=verbose
pnpm build
```

The first quick-gate fingerprint was `444f221a00679cde097be33d095e6476d95eb27781f681eabe276dec2ebdf6bb`; later source changes were legacy bank type inference, Hercules backing-versus-lifetime summaries, Calendar proof routing and the two focus corrections. Final focused/browser/build evidence covers those changes. No exhaustive gate was invoked.

The local candidate is reviewable in the retained fictional preview and `review-preview.png` under the evidence directory. Source/tests/docs are committed together on the branch above; the exact resulting commit is the task's delivery receipt. No push, PR, merge, deployment, schema, provider activation or real-household mutation was performed.

Next: Jonathan's product review, then independently authorized release preparation against current main. Preserve the original failed concurrent quick gate, require a compatible authority before new clients, and retain new data readers/validators in rollback. Full allocation/credit semantics and physical/authenticated product acceptance remain the named limitations above.
