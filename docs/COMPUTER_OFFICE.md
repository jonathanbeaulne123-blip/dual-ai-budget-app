# Computer office — gated program (D-151 / D-152)

The computer Home must look and function like the **photoreal stills**. This file is the program. Each slice is a Jonathan continue/revert gate. Phone stays Draft C unless Jonathan unfreezes it; tablet scales that board; computer is the room.

**Pixel canon (D-152):** the six JPGs under [`docs/ux/computer-office/`](ux/computer-office/) named `hearth-canon-*.jpg`. Earlier `hearth-desk-layout-*.png` files are a superseded generation. The CSS cabin on this branch is plumbing, not the look.

**Studio kit:** [`ux/computer-office/STUDIO_KIT.md`](ux/computer-office/STUDIO_KIT.md). **Job map:** [`ux/computer-office/STUDIO_PIPELINE.md`](ux/computer-office/STUDIO_PIPELINE.md). **Beginner checklist (Jonathan):** [`ux/computer-office/STUDIO_SETUP_CHECKLIST.md`](ux/computer-office/STUDIO_SETUP_CHECKLIST.md).

AIs use that bench when computer Home visuals warrant it. If Jonathan must click Blender, fSpy, Krita, Affinity, Resolve, Comfy, PureRef, or ffmpeg, the AI gives numbered/checkbox steps with exact menu names. He has no DCC experience.

Paste-ready slices: [`docs/briefs/office/`](briefs/office/README.md). Decisions **D-151**, **D-152**. Worksession [`docs/worksessions/2026-08-27-desktop-room-overhaul.md`](worksessions/2026-08-27-desktop-room-overhaul.md).

## Every slice

- Phone `< 720` Draft C stays **mostly untouched**. Do not restyle [`src/OfficePhone.tsx`](../src/OfficePhone.tsx) except additive tablet CSS. If a desktop UX change would port cleanly to mobile, **stop and ask Jonathan** before touching phone.
- Tablet `720–1279` is scaled phone, never the cabin, until Jonathan says otherwise.
- Computer `≥ 1280` is the cabin. Default cut 1280 (12.9" iPad landscape is a named edge).
- Confirm is the money writer. Widgets do not `postEntry`. Well-integrated command work is allowed when Jonathan gates it; do not invent a second writer.
- No CAD on weather glass. Fraunces money, Figtree labels. Hercules coat: cream Maine Coon until Section 11 picks against the stills.
- Visual medium is a **locked-camera plate compositor** (empty room + object plates + HTML hits), not cream CSS cards, not Spline-as-the-room, not Unreal pixel streaming. `three.js` may overlay later; never dump `hercules.source.glb` on Add.
- D-082 warmth stays as type/colour kernel; the 900px column and “wide ≥720 is the office” stay superseded.
- Kill: if milk is a hunt or Post is covered, shrink furniture. Games never block Add.

## Three views

| View | Width | Shell | Layout key |
|---|---|---|---|
| Phone | `< 720` | `OfficePhone` Draft C | `hearth.office.<env>.phone` |
| Tablet | `720–1279` | same `OfficePhone`, scaled CSS | **reuses phone** |
| Computer | `≥ 1280` | night-cabin room | `hearth.office.<env>.computer` (soft-migrate `.wide`) |

Hercules `desktopFly` / wander is **computer-only** (`>=1280`). Tablet keeps the phone pill.

## Tiers

- **T0 Law fence** — docs + three-view plumbing; computer may still show the old packed office until T1; tablet is no longer a blank sticker sheet. Revert if 390 regresses.
- **T1 Empty room** — full-bleed night cabin + empty wood desk, nav on the front edge of the wood, no live widgets required at the visual gate. Revert if dashboard/wallpaper.
- **T2 Living desk** — Household objects that work; pad posts 1250→$12.50. Revert if SaaS cards.
- **T3 Personalities** — Tracker/CPA/Edit Desk auto-size. Revert if personality restyles the cabin.
- **T4 Play + games** — crayons, blotter+calendar, Kitchen Fleet / Sill Four / Pane Boxes. Revert if games post or block milk.
- **T5** — shelves as cabinets, Hercules sofa nest, other tabs inherit room chrome. Revert = keep Home cabin only.

Widget auto-size (computer desk): 1–4 visible → L; 5–8 → M; 9+ → S. Calculator cannot hide and never below M **except Play**, which parks the pad; milk stays on nav Add.

New games (D-077 extension): kitchen cosmetics, empty `postedIds`, inert during Add, `turnMemberId` no-op if not your turn, household-safe names, never quiet appointment titles. State in `household.kitchen.games` (syncs with kitchen snapshot). Keep ttt + hangman.

1. **Kitchen Fleet** — Battleship 8×8; ships Milk(5) Visa(4) Hydro(3) Jar(3) Pad(2).
2. **Sill Four** — Connect Four 7×6, pine vs copper.
3. **Pane Boxes** — Dots and Boxes 5×4 dots, window-mullion metaphor.

New projection instruments (never post): `opinion`, `leftover`, `nextDue`, `sync`.

## Dual Course (program)

- **Budget (5):** At every gate, milk still posts; blotter/calendar/accounts remain true projections; Confirm is the only writer.
- **Engagement (3):** Computer Home becomes the night cabin you sit in; personalities and play earn their keep by making that desk a habit.
- **Stop-ship:** Post covered, invented CAD on glass, phone regression, games that post.

## What Codex must never do in any slice

- Bank feeds, agentic auto-post, inventing safe-to-spend
- Restyling phone Draft C
- Putting the cabin on tablet
- Glassmorphism / Bloomberg 10px / live tickers
- Games that use quiet appointment titles or partner-personal money
- Layout blobs in `splitForSync`
- Calling the work shipped or merging without Jonathan gate
