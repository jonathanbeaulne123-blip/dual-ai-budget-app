# Hearth worksession — Wide paper office

- **Status:** OPEN (reviewable draft PR; not merged)
- **Opened:** 2026-08-28 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (Grok)
- **Repository:** jonathanbeaulne123-blip/dual-ai-budget-app
- **Branch:** `cursor/wide-paper-office-560d`
- **Baseline SHA:** `54c74dcbf53fbab694b9ca5cd08f57ff4acdd9d2` (`origin/main` at branch)
- **Head SHA:** `afdff225be5b44372cfecd0105c28f02b85d1f3a`
- **PR or issue:** draft [#228](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/228)
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

- Wide Home default is now `OfficeWide` (composed paper). Phone Home is still `OfficePhone` Draft C.
- App column at ≥720px is `min(1120px, 100%)` (D-156). Warmth fence asserts that cap and refuses `1280px`.
- Layout keys already split `phone` / `wide`. Widgets never `postEntry`. Classic `packWide` remains behind Cabinets.

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

- [x] `test/office-wide.test.ts` green; phone tests still green
- [x] Warmth fence updated for ~1120, still refuses 1280
- [x] `pnpm check` → **967 passed / 2 skipped**, build green
- [x] Visual 720 and ~1100; phone 320/390 Draft C
- [x] `hearth-ux-auditor` read-only pass (Add-state CSS polish in `e16e873`)

## Plan

- [x] Open this worksession; draft D-156
- [x] Core mosaic + infographic helpers
- [x] `OfficeWide` shell + CSS
- [x] Classic desk opt-in
- [x] Wide tab CSS
- [x] Proof + handoff

## Evidence log

- `pnpm check` at `e16e873`: 967 passed / 2 skipped; `dist` built in 5.32s.
- Visual (demo kitchen, Development): 1100 two-column paper office; 720 OfficeWide; 390/320 Draft C; Classic toggle; Post pad uncovered. Demo clip `/opt/cursor/artifacts/wide_paper_office_demo.mp4` (~28s).
- UX auditor: Dual Course kill criterion not triggered. Landed freeze-hero / dim-notebook / pin focus-ring.
- Verifier: code/docs claims pass; handoff written this close.

## Decisions

D-156 — composed paper office is the default wide Home; Classic desk (packWide / Edit Desk / personalities) is opt-in.

## Remaining uncertainty

Existing wide layouts with saved x/y keep Classic so a customized desk is not silently replaced. Fresh desks open paper. Two-column breathing room is the ~1100 face; 720–899px stacks. Branch is behind later `main` Toast OCR work.

## Handoff

See `docs/AI_HANDOFF.md`. Draft PR #228. Not merged, not deployed, not live.
