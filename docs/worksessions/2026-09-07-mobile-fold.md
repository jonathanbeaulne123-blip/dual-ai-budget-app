# Hearth worksession — Claude's mobile fold

- **Status:** VERIFIED LOCALLY; PR preparation
- **Opened:** 2026-09-07 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** codex/mobile-a1-fold
- **Baseline SHA:** 6fb15c7a98f3336862bb743b836aa96a358a35b9
- **Head SHA:** baseline plus working changes
- **PR:** pending
- **Risk:** Medium (responsive layout and focus)
- **Environment impact:** none; local synthetic verification only

## Household outcome

Claude's paper crease admits at most four visible objects. The person's active/confirming shift, integrity warning and overdue bill take priority over ordinary stories. Everything displaced stays immediately below; there is no member setting and no new financial action.

## Budget delta (5)

0. Accepted books and command paths are unchanged.

## Engagement delta (3)

+2. Today's relevant objects appear first without losing the rest of the desk.

## Verified baseline and authority

The original handoff's phoneDeskKey location was stale; it lives in core/officePhone.ts. Existing StoryStrip limited tiles only, leaving weather, needs and three seals outside the limit. Latest user instruction retains Claude's exact vision and style and rejects competing Codex compositions. Original source plates and amended packet are under Jonathan's Downloads. At-most-four in packet §16.3 takes precedence over the handoff's exactly-four acceptance sentence. The seal trio consumes three slots and remains indivisible; each paper tile, weather ribbon and needs sentence consumes one. Fewer is correct when height or the intact seal row cannot fit. No filler is invented.

## Scope

A1 only: pure priority/packing, measured responsive fold, existing Home glance components and actions, scoped crease styling, tests and visual evidence. No sheet, new money model, posting, Auth, schema, hosted writes, deployment or Production changes in this branch.

## Acceptance evidence

- [x] Five eligible objects cannot all appear above the crease.
- [x] Current worker evidence outranks ordinary stories; no promotion from another person's shift.
- [x] Whole objects remain reachable at 320/390 and enlarged text.
- [x] Existing actions remain explicit; ranking and resizing post nothing.
- [x] Focused Medium quick gate and actual-component browser evidence.

## Decisions

2026-09-07: Jonathan explicitly requests phase 2 with Claude's vision and style taking precedence over Codex alternatives. Later reply 'just build it' waives the fortnight build gate for the full Ledge; this does not authorize deployment or financial/schema changes. His prior new scenario model, separately labelled current Ask in receipt, and Shared/Personal scope labels remain.

## Evidence log

`pnpm test -- --risk=medium --focus=test/office-phone.test.ts --focus=test/phone-fold-ui.test.ts --focus-reason="Bound four visible Home objects, preserve whole-object reachability and keyboard focus when own-shift priority changes"` passed: 51 fast and 7 serial assertions, TypeScript and AI surface, 32.645 seconds; no five-minute breach. Change fingerprint `94553880f9400f2087fc3b1e25eba5f846cc04aaf4012fe9d48ee0b35388f22b` before this documentation closure.

Actual OfficePhone and child components in isolated Chromium: 28 cases at 320/390/720/1100, empty/urgent/loading/error/offline/enlarged-text/fictional-figures. Zero fifth-object, duplicate, document-overflow, fold-clipping or page-error failures. Each screenshot includes keyboard focus. At 720/1100 this deliberately forces OfficePhone for component stress; Office.tsx retains its existing wide breakpoint. All use reduced motion. Error/loading/offline are component input/transport conditions, not authenticated App recovery proof. The enlarged-text fixture doubles computed class font sizes with persistent stylesheet rules so React reparenting cannot reset the simulation. The seals reflow as an intact group at enlarged text; whole figures remain visible.

Evidence: [machine report](../evidence/mobile-a1/browser.json), [390 fictional figures](../evidence/mobile-a1/390.png), [320 enlarged text](../evidence/mobile-a1/320-large.png). Full 28 screenshots, harness and exact commands remain in local `/tmp/hearth-mobile-a1-evidence` and ignored `artifacts/browser-evidence/mobile-a1`. No external financial endpoint was used. The displayed $3,380/$4,105/-$725 seal fixture is fictional; other catalog readings remain zero and are not a reconciled full-month household.

Independent UX review found loss of Add inertness and focus loss during same-count priority changes. Both were repaired; a mounted regression proves focus remains on the moved seal and reordering fires no action. The reviewer rechecked both repairs with no remaining concrete blocker. Small muted text uses the existing #6b6258 on #ebe4d6 tokens (measured contrast 4.72:1). New CSS has no hex literals. No instrument handle exists in A1, so rail value transcripts/projection-edge evidence do not apply.

## Remaining uncertainty

No physical phone or authenticated household proof. This slice alone is not completion of the mobile program.

## Handoff

Codex completes A1 verification and its separate branch/PR, then builds the Ledge in dependency order.
