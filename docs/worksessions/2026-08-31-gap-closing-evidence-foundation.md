# Hearth worksession — gap-closing evidence foundation

- **Status:** REVIEW — independent review passed; clean exact-SHA verification pending
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Codex
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `codex/gap-closing-foundation`
- **Baseline SHA:** `b44396912823b62c4f6bde025f7e0699651f330d`
- **Head SHA:** record at close
- **PR or issue:** Gap-closing Program 0; no PR created
- **Risk:** Release
- **Decision owner:** Jonathan
- **Environment impact:** local Development verification only

## Household outcome

Jonathan and Bianca can distinguish passing code from a feature that was actually completed, recovered, exercised at household widths, checked for accessibility/runtime failures, and tied to one exact Production build. The first packet makes that evidence repeatable without changing money, sync, Auth, hosted data, or Production.

## Budget delta (5)

`+3` — release truth fails closed when money, privacy, recovery, environment, or evidence claims are missing or stale.

## Engagement delta (3)

`+2` — real-browser task and recovery journeys cover keyboard, focus, responsive layout, zoom, and reduced motion instead of inferring the household experience from jsdom.

## Verified baseline

Facts:

- Fresh fetch resolved `origin/main@1650910ebe9c9a8343b580116f69807a0d42c9f4`.
- The isolated branch was created clean from that SHA; the dirty `codex/roadmap-site` worktree is untouched.
- Local `codex/p0-03-5of5-gate@a557e5d1c4c30005c8cc802a39847993f5c99fdb` contains the runner-neutral five-dimension evaluator and synthetic tests but is not on `main`.
- Current `main` has no Playwright or axe dependency/configuration.
- The public roadmap tab implementation handles arrow/Home/End keys but not Enter/Space activation; prior hands-on evidence recorded Enter failure at every width.

Inference:

- The smallest coherent first packet is to reconcile P0-03 onto current main, add a real-browser collector, fix the keyboard defect, and make Windows verification reproducible.

## Scope

### In scope

- Reconcile the P0-03 evaluator and evidence contracts onto current `main`.
- Add real-browser task/recovery collection at 320/390/430/720/1100 px with axe, screenshots, console/network/timeout, overflow, keyboard/focus, zoom, and reduced-motion evidence.
- Repair roadmap tab Enter/Space activation and retain arrow-key behavior.
- Add a Windows-safe verification entry point using repository-local tooling discovery.
- Update living canon and tests for the evidence behavior.

### Out of scope

- Money meaning, posting, PGlite, continuity, Auth/RLS, migrations, Supabase, secrets, provider settings, hosted rows, real household data, Production, push, merge, deploy, four-week/14-day elapsed evidence, or design-partner invitations.

## Acceptance evidence

- [x] Five-of-five evaluator and red/green fixtures pass on current main.
- [x] Browser collector completes task and recovery journeys at all five widths.
- [x] Roadmap tabs activate with Enter and Space and retain arrow/Home/End behavior.
- [x] Axe, console, failed-request, timeout, overflow, focus, zoom, and reduced-motion channels are explicit and fail closed.
- [x] Windows verification uses the installed Bash/Python runtimes without weakening tests.
- [x] Focused tests and `pnpm check` pass for the candidate content; clean exact-SHA rerun follows review and commit.
- [x] Independent review and verification report no open P0/P1 findings.

## Plan

- [x] Refresh exact main, isolate one clean writer, inspect canon/code/tests, and bound Program 0.
- [x] Reconcile P0-03 onto current main and resolve canon/package conflicts.
- [x] Implement browser collection, keyboard repair, and Windows verification.
- [ ] Run focused proof, browser proof, full checks, and independent review.
- [ ] Close with exact SHA, changed files, residual risks, and the next gated owner action.

## Evidence log

- 2026-08-31: `git fetch origin --prune`; `origin/main` resolved to `1650910ebe9c9a8343b580116f69807a0d42c9f4`.
- 2026-08-31: worktree `C:/Users/jonat/OneDrive/Documents/ChatGPT/Budget App - Gap Closing Foundation` created on `codex/gap-closing-foundation`.
- 2026-08-31: fetched and rebased onto the advanced `origin/main@32843ed620662a2e15abad543598fa37bd202915`; original dirty worktree remained untouched.
- 2026-08-31: fetched again and rebased onto `origin/main@b44396912823b62c4f6bde025f7e0699651f330d`; the Month/PGlite mainline work was preserved and the original dirty worktree remained untouched.
- 2026-08-31: focused evaluator/collector/roadmap proof passed 3 files / 27 tests; standalone production build passed 380 modules plus Hercules Pro UI.
- 2026-08-31: local Playwright + axe collection passed 10/10 public-roadmap task/recovery runs over 320/390/430/720/1100 px with no failed automated evidence channel. Report is ignored and explicitly `claimable: false`.
- 2026-08-31: first aggregate Windows run passed 1,362 tests and exposed one real wrapper defect: the Microsoft Store Python alias was not executable from Git Bash. The wrapper now prefers the bundled Python runtime; the exact sanitizer regression passed 1 file / 8 tests.
- 2026-08-31: repaired `pnpm check:windows` passed AI verification, 208 passed / 2 skipped files and 1,363 passed / 3 skipped tests, TypeScript, 380-module Vite production build, Hercules Pro UI, and redirect guard.
- 2026-08-31: independent UX, trust, and verifier audits reported no P0 and identified evidence-quality P1s: incomplete cross-origin network capture, unsafe generic private-manifest artifacts, asserted rather than observed focus order, shallow text-resize/motion checks, and fragile failed-page reporting.
- 2026-08-31: the P1 repair records all-origin failures with redacted diagnostics, refuses non-public/cross-origin journeys, traverses and records the actual Tab path plus tab-panel semantics, persists full axe violations, measures text growth/key bounds and motion behavior, and emits a failed report even when page evaluation or screenshots fail. Focused proof passed 3 files / 30 tests; repaired real-browser proof passed 10/10 runs.
- 2026-08-31: independent UX/accessibility, trust/release, and verifier re-reviews found no remaining P0, P1, or P2 issue; all recommend closure after the clean exact-SHA aggregate rerun.

## Decisions

- Program 0 changes evidence and accessibility only; the larger roadmap stays gated by human elapsed-time and action-time approval.
- A browser fixture or local run proves the collector, never Production feature readiness.

## Remaining uncertainty

- Clean exact-SHA verification and independent re-review remain before closure.
- Production evidence and named-human acceptance cannot be generated by this implementation packet.

## Handoff

Open. Next owner remains Codex until implementation and independent verification are complete.
