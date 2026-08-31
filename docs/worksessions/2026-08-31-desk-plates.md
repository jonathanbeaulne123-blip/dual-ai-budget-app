# Hearth worksession — Desk plates on Shared and Personal Home

- **Status:** CLOSED; MERGED #260; KITCHEN PUBLISHED
- **Opened:** 2026-08-31 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Cursor (landing Claude's unbuilt third slice onto current `main`)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `main` (from `cursor/desk-plates-shared-home-021f`)
- **Baseline SHA:** `7d4e19361a455112d2532fa8f81271b26a4db349` (cut); merged through `origin/main@34c2c57` (D-186)
- **Head SHA:** `c75d72eef323f1af211c42da440090730363b6f4` (merge of #260)
- **PR or issue:** merged [#260](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/260)
- **Risk:** High presentation, then Release because Jonathan ordered merge/deploy
- **Decision owner:** Jonathan ordered push/merge/deploy 2026-08-31
- **Environment impact:** Development kitchen URL via `hearth-books` `wrangler deploy`. No Production, hosted mutation, schema apply, or secrets

## Household outcome

The six Home mosaic tiles on each wide floor become desk plates: a kicker in household words, a verdict as a sentence, one of six shared drawing primitives, and a footing that keeps the figure honest. Single click puts that plate on the stage in place of the Month Spread. Double-click and the cabinet handle open the existing instrument. Close returns to the Spread on Shared Home. Nothing here posts, settles, or moves a cent.

## Budget delta (5)

`+3` — the mosaic answers household questions from existing selectors instead of repeating the Spread at lower resolution.

## Engagement delta (3)

`+3` — the laptop open-to desk becomes a 2×3 instrument strip without restyling seals or the Kitty Banks shelf.

## If they conflicted

Books win. Plates never invent a drawing, never label Fund free-to-spend as "safe to spend", never say "kitty" on Shared, and never write `goal.savedCents`. The cabinet handle stays wherever double-click exists. Shared `cards` never names a personal-scope card.

## Verified baseline

Facts:

- Month Spread (commits 1–2 of Claude's packet) is already on `main` via #259.
- Desk-plate files from the packet were absent at the cut; rebuilt on current `main`.
- Trust review found Shared `cards` reading unscoped `booksHousehold` could name a partner-personal card. Fenced before merge.
- `origin/main` moved through D-185 and D-186 while the branch was open; both were merged in before kitchen publish.

## Scope

### In scope

- Six plate primitives, twelve plate models, OfficeWide wiring, plate CSS, focused tests.
- Partner-personal card fence.
- Merge to current `main` and D-041 kitchen deploy after Jonathan's order.

### Out of scope

- New Fund event kinds, envelopes, schema apply, or `goal.savedCents` writes.
- Restyling wax seals or Kitty Banks.
- iPhone `OfficePhone` mosaic.
- Production household mutation or secrets.

## Acceptance evidence

- [x] 21 focused plate tests plus 1 DOM interaction test green
- [x] `pnpm check` on D-185-integrated tree **1425 passed / 3 skipped**
- [x] After D-186 merge: plates + Bianca startup/rehearsal **27 passed**; `tsc --noEmit` green
- [x] Browser: single-click, double-click, handle, keyboard; 320/390/720/1100/1440
- [x] Independent UX auditor — PASS WITH NOTES; F-1/N-1/N-2 repaired
- [x] Personal-card leak fenced; canary green
- [x] Merged #260; kitchen `wrangler deploy` verified HTTP 200 with live `Office-C6krQOJZ.js`

## Evidence log

- 2026-08-31: branched `cursor/desk-plates-shared-home-021f` from `origin/main@7d4e193`.
- 2026-08-31: rebuilt Claude's unbuilt third slice. Draft then ready PR #260.
- 2026-08-31: `pnpm check` **1425 passed / 3 skipped** after D-185 merge.
- 2026-08-31: trust review FAIL on partner-personal cards; fenced `scope !== "personal"`.
- 2026-08-31: Jonathan: “push merge deploy”. Merged through D-186. Push `main@c75d72e`.
- 2026-08-31: Cloudflare Workers [`33447063786`](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/actions/runs/33447063786) success. Worker `e57b4a67-fbbb-45a2-b57c-043cda197101`. Live HTML `Cache-Control: no-store`; `index-BZnOtUHs.js` → `Office-C6krQOJZ.js` with plate kickers and the personal-scope fence.

## Decisions

- Rebuild commit 3 onto current `main`; do not `git am` the three-commit packet.
- Keep F-4 banks-below-<1200. Mosaic is 460px at that width so the 2×3 grid fits.
- Mosaic tiles `now` / `attention` / `change` leave Shared Home because they *are* the Spread's three registers.
- Shared `cards` must ignore personal-scope accounts even when the caller passes `booksHousehold`.

## Remaining uncertainty

- Forced-colors and reduced-motion CSS exist; live Chrome Rendering emulation was not completed.
- `paperHomeMosaic` still encodes the old story tile ids for Classic/helper tests; OfficeWide no longer calls it.

## Handoff

Next owner: Jonathan. Hard-refresh `https://hearth-books.jonathan-beaulne123.workers.dev/` on a wide Paper office Home. **Merged and kitchen-published.** Not Production. Do not treat a Cloudflare preview alias as the kitchen.
