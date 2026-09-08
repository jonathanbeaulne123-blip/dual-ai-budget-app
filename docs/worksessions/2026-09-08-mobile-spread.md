# Hearth worksession — Claude's chapter spreads

- **Status:** VERIFIED LOCALLY; draft PR preparation
- **Opened:** 2026-09-08 (`America/Toronto`)
- **Owner / decision owner:** Jonathan
- **Assignee:** Codex
- **Branch:** codex/mobile-a4-spread
- **Baseline:** 9014a78e05722c24072e8264086770d7c088d742 (A3, PR#374)
- **Risk:** Medium-High (member scope)
- **Environment:** fictional local Development fixtures; no hosted mutations

## Household outcome

The existing Money in, Money out and Leftover seals open Claude's original four/four/three-page chapters. Dots and44px arrows expose the reading count; horizontal gestures turn pages while vertical scrolling belongs to the page. Rails remain outside the album. Nothing posts by swiping.

## Dual Course

Budget(5)+2, complete named reading chapters. Engagement(3)+1, existing seals become useful covers without adding Home tiles.

## Scope and verified source constraints

Existing OfficePhone widgets keep the active-view household. Only the spread receives accepted books, with visible Shared/own-tip scope labels. Shared top categories use the existing Shared books presentation. Tip history is explicitly filtered to the viewer and contributor-gated before aggregation. Confirmed contributions by member do not imply earnings ownership. Goal deferral reports the existing Ask/date consequence, without invented economic cost. Existing Ask owns any separate confirmation and is unmounted on page/scope changes.

Shape becomes Claude's words-over-band rows using the same category data; streams become month rows and member columns of actual date marks. Both remain shared stage components, with desktop forms unchanged.

## Acceptance

- [x] Original4/4/3 pages, same source readings and honest refusals.
- [x] Swipe, arrows, index, vertical scroll, cancellation, focus and scope reset.
- [x] Partner-private tips/goals never enter these pages; gestures issue zero commands.
- [x]320/390/720/1100, enlarged text, empty/busy/offline and focused quick gate.

## Evidence log

Final Medium-High quick gate passed 114 assertions (80 fast, 34 serial), TypeScript, AI surface and diff checks in 89.835 seconds; no five-minute breach. Candidate fingerprint before documentation closure: `578731db7a11ebf7fcff610e8f488d094a87a7c341c875f1c4a1ed2581e216c9`.

Exact command: `pnpm test -- --risk=medium-high --base=9014a78e05722c24072e8264086770d7c088d742 --focus=test/phone-spread.test.ts --focus=test/fund-ledge.test.ts --focus=test/ask-panel.test.ts --focus=test/office-phone.test.ts --focus=test/claude-ux-dialog.test.ts --focus=test/app-startup-p1.test.ts --focus=test/month-rehearsal-mainline.test.ts --focus-reason="Preserve chapter scope, reversed-shift exclusions, canonical chart evidence and explicit nested Confirm while paging with keyboard or pointer"`.

Chromium: initial 396 page/width/scope/state cases passed. After final visual/focus refinements, 88 final layout cases passed (all 11 pages, 320/390/720/1100px, ordinary/enlarged text, Personal contributor). Two final 320/390 gesture cases prove swipe, cancellation, offline reading, zero actions, Ledge background inertness, and focus restored to the invoking seal after its DOM node was reparented below the fold. [Final matrix](../evidence/mobile-a4/final-layout.json), [gestures](../evidence/mobile-a4/gestures.json), [Shape](../evidence/mobile-a4/390-1-0.png), [Streams](../evidence/mobile-a4/390-0-0.png). Full local drivers and intermediate matrix: `/tmp/hearth-mobile-a4-evidence`; ignored actual-component fixture: `artifacts/browser-evidence/mobile-a4`.

Independent UX recheck found no remaining actionable defect; independent money recheck found no trust/privacy blocker and independently passed 19 spread/scope assertions. Reversed shifts are excluded before tip aggregation. Nested Ask Escape closes its own confirmation first in either spread or Ledge. Existing dialog tests retain their known React act-environment warnings; all six pass. The final matrix uses actual App padding; an earlier fixture accidentally doubled that padding and was corrected rather than hiding overflow.

## Remaining limits / next owner

Codex prepares a separate stacked draft PR and continues with A5. Evidence is local fictional component Chromium and full-App jsdom startup/rehearsal canaries. Wide cases force the phone component for stress; no authenticated full-App browser, hosted, physical-device, exhaustive or release claim. No merge or deployment.
