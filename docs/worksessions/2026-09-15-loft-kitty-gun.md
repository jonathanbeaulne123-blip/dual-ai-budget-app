# Hearth worksession: the loft's studio cats and money gun, held saves, outside-click close, shelf-tool cards, cellar water

- **Status:** OPEN. Local branch and patch only: not pushed, not a PR, not merged, not deployed, not live verified.
- **Opened:** 2026-09-15 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/loft-kitty-gun`
- **Baseline SHA:** `fe0cb3b` (`origin/main`, #489)
- **Risk:** Medium. The main risk is a room-side door (the gun) to the existing money command `allocateHouseholdFundSurplus`, which was already reachable from the jug. The app-wide outside-click close also touches the shared `useDialog`.
- **Decision owner:** Jonathan (D-264)
- **Environment impact:** none. Fictional fixtures only.

## Household outcome

Jonathan's asks (2026-09-15):

- The kitty banks in the loft must be the 3D models made in the studio.
- To stop the stutter, save once when all the edits are made, not on every touch.
- Clicking off a pop-up closes it, everywhere.
- A tap on a shelf tool opens a non-obstructive pop-up that explains the tool and has sliders, and the old drag still works.
- The cellar's water should be more apparent.
- A money gun takes money from the household Fund and throws cash into the chosen kitty banks, and you can watch them grow.
- Banks are scaled to their goal size.

He answered the two clarifying questions with "both 1 and 2":

- Saves are sent when you leave, and there is also a Done button.
- The gun follows the jug's money rules (custodian only, capped at the safe surplus, one Confirm per round) and stands beside the jug.
- The pop-up question read as the whole app, because he said "everywhere".

## Budget delta (5)

+0. There is no new money writer, schema, sync or payload change. The gun posts through the same rollover as the jug. Both the gun and the jug now read the command's outcome and never say money moved when the books refused it (before this change, the jug's notice appeared on any resolve).

## Engagement delta (3)

+3. You throw real money at the bank you chose and watch the cat you painted swell. Every tool explains itself.

## What changed

**Core (pure).**
- `src/core/queenGun.ts`: `gunFire` trims each shot to the bank's room and to the safe surplus, and has a `why`. Also `gunStep`, `gunWords` and `GUN_BILLS`.
- `src/core/queenPresentation.ts`: `loftBankScale`, plus `scale` and `step` on `QueenShelfItem`.
- `src/core/queenRack.ts`: `rackSetSplit`.

**The loft.**
- `src/queen/world/queenRoomWorld.ts`: a vessel may carry `studio: { piece, fired, step }`. It is stood as `createKittySculpture`, measured at full growth, with a frame pump while a sculpture animates. It is disposed with the room.
- `src/queen/QueenLoft.tsx`:
  - The rack shows studio pieces, flat and in 3D, sized by `--bank-scale`, and the tide is read on the seat.
  - Shelf-tool cards (weight, pin, divider) have sliders, ×, Escape and outside close.
  - The money gun: trigger, bill sizes, targets, flying bills in their own layer, Send and Take back, and a Confirm.
  - A Done button with a *not saved yet* mark.
  - `postedOk` reads the command outcome for both the jug and the gun.

**Held saves.** `src/queen/useHeldSave.ts` is new. `src/queen/QueenHome.tsx` holds the rack and the charms, and flushes them on leaving the loft, putting a charm down, closing the panel or leaving Home, and on `pagehide`, a hidden page or unmount. `QueenCharmTool` gains Done.

**Outside close.** `src/useOutsideClose.ts` is new: a tap, with 10 px slop, outside every inside element, plus a `keep` selector.
- `useDialog` closes only the topmost sheet, and only when it can close. A full-screen opaque sheet has no outside; over a see-through veil, only its panel counts as inside.
- Also applied to the Queen's panel, the cellar jar card, `RowReveal`, `ShiftPunch` and the ledger source slot.

**The cellar's water.**
- `QueenCellarRail.tsx`: a body, two waves and the water's name. The level is drawn at 90 % so the surface always shows, and the tidemark is scaled the same way.
- `queen-cellar.css`: a water per world (Classic, Taylor, Newfoundland). Reduced motion stops the waves, and forced colours are handled.

**Tests.**
- New: `test/queen-gun.test.ts` (6), `test/queen-held-save.test.ts` (2) and `test/queen-loft-gun-ui.test.ts` (7).
- Updated `test/queens-nest-ui.test.ts`: charms are now held until Done, not kept after 700 ms.
- Updated `test/queen-loft-rack-ui.test.ts`: divider label.
- New browser proof: `test/queen-loft-gun-layout.mjs`.

## Verification

- `tsc` is clean.
- `pnpm test -- --risk=medium --focus=test/queen-loft-gun-ui.test.ts --focus=test/queen-gun.test.ts --focus=test/queen-held-save.test.ts` → `quick-gate-passed`: 23 files, 251 tests, 109 s of 300 s.
- `app-startup-p1`: 82/82.
- Dialog-adjacent suites (confirm, dialog, row, shift punch, ledger, mobile entry, rehearsal mainline): 65/66. The one failure, `ledger-story-ui` "replaces Plan Goals with Kitty Banks", fails identically on untouched `main`.
- Browser: `queen-loft-gun-layout.mjs`, 16 records across Classic, Taylor and Newfoundland at 320 to 1100 px. It found 0 page errors, no page scroll and axe clean in the loft. See `docs/evidence/queen-loft-gun/`.
- The existing proofs were re-run and pass: `queen-loft-layout.mjs` (18 records) and `queen-cellar-layout.mjs` (26 records), both with 0 serious or critical axe hits and 0 page errors. Their evidence was regenerated.
- On phone and tablet widths the gun trigger shows only its icon (its accessible name is kept), and the held-rack *Done* rides in the loft's title chip, so two shelves still fit without the rack scrolling.

## Uncertainty

- The gun's reach is the safe surplus. Going beyond it is a money-meaning call for Jonathan and was not built.
- The goal-size scale makes a target's order of magnitude readable from the shelf. That is by request, but it relaxes the old "no amount leaks from a shape" rule for the loft.
- The studio cat has no lid, so a lidded bank reads by its lean, its words and the refusal.
- The 3D path was verified in SwiftShader only. Each loft bank now owns the studio's six paint canvases, which may cost memory on a phone with many banks.
- Outside-click close now applies to every `useDialog` sheet over a veil. Add-entry and Hercules full-screen sheets are opaque, so they do not close this way, but a partially transparent sheet with a draft would close (its own close path keeps drafts as before).

## Next owner

Codex: trust review of the gun's door to `allocateHouseholdFundSurplus` and of the `useDialog` change. Then Jonathan's bot opens the PR.
