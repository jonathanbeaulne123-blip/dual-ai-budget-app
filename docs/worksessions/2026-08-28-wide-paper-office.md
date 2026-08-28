# Hearth worksession — Wide paper office

- **Status:** OPEN
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (Grok)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/wide-paper-office-560d`
- **Baseline SHA:** `54c74dcbf53fbab694b9ca5cd08f57ff4acdd9d2` (`origin/main`)
- **Head SHA:** (in progress)
- **PR or issue:** draft PR this branch
- **Risk:** Medium
- **Decision owner:** Jonathan
- **Environment impact:** none (UI cosmetics; layout localStorage only; no hosted schema, no Production)

## Household outcome

On a laptop, Home feels like the phone kitchen — wax seals, paper stories, cream/pine/copper, Fraunces money — but it is a two-column room, not a stretched 2×2. A large month-net blotter and a few journal-true infographics use the extra space. Milk/Confirm stay uncovered. Phone `<720px` stays Draft C. Free-move Edit Desk remains as opt-in Classic desk (D-080 not silently dropped).

## Budget delta (5)

`+2` — month net, wallet, bills, and Health become glanceable on a laptop without a new figure.

## Engagement delta (3)

`+2` — the kitchen feels special at width; Hercules still wanders the room.

## Verified baseline

**Facts**

- Wide Home is `.desk-wide` free-move canvas in `src/Office.tsx`. Phone Home is `OfficePhone` Draft C.
- App column at ≥720px is `min(900px, 100%)` (D-082). Warmth fence test asserts that cap and refuses `1280px`.
- Layout keys already split `phone` / `wide`. Widgets never `postEntry`.

**Inferences**

- Jonathan’s latest instruction (port phone vibe to desktop, not 1:1, more infographics) outranks D-079/D-082’s free-move-as-default. D-156 records that reshape.

## Scope

### In scope

- Composed wide Home (`OfficeWide`) as default at ≥720px
- Paper infographics from existing `monthSummary` / wallet / `tipWeather`
- App column ~1120px; refuse 1280 lobby
- Classic desk opt-in via Cabinets
- Light two-column CSS for Shift, Books wallet, Calendar board, Plan
- D-156 + living theme/office/architecture/handoff

### Out of scope

- Phone `<720px` layout or Hercules focus overlay
- Commands, Confirm, PGlite, Auth/RLS, hosted schema, deploy
- Invented CAD, Chart.js, second theme

## Acceptance evidence

- [ ] `test/office-wide.test.ts` green; phone tests still green
- [ ] Warmth fence updated for ~1120, still refuses 1280
- [ ] `pnpm check` green
- [ ] Visual 720 and ~1100; phone 320/390 unchanged
- [ ] `hearth-ux-auditor` read-only pass

## Plan

- [x] Open this worksession; draft D-156
- [ ] Core mosaic + infographic helpers
- [ ] `OfficeWide` shell + CSS
- [ ] Classic desk opt-in
- [ ] Wide tab CSS
- [ ] Proof + handoff

## Evidence log

Record exact commands, results, visual widths, links, and current SHAs.

## Decisions

D-156 — composed paper office is the default wide Home; Classic desk (packWide / Edit Desk / personalities) is opt-in.

## Remaining uncertainty

Existing wide layouts with saved x/y keep Classic so a customized desk is not silently replaced. Fresh desks open paper.

## Handoff

See `docs/AI_HANDOFF.md` when the branch is reviewable. Not merged, not deployed, not live.
