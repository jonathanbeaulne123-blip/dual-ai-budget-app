# Pass 02d — The kitchen table and the day ledger

Runs after pass 0, in parallel with 02/02b/02c; it does not need the land. Claude subagents: one per track, an integrator, a reviewer who has not seen the work. Read `TIME.md` (whole), `SCALES.md` §3–§7, `CONTRACT.md` rules 1, 9, 16, and the repo facts cited in `TIME.md` §1.1 and §2.1.

## Purpose
Make the day the unit of time (one `dayLedger` read model feeding the stones, the strip, the Calendar, Leaving and the camp card), and make the Plan Studio the kitchen table: "One Pull Raises It" as the front door, one card with four views, Direction C's objects as the drawer, one five-beat ritual at the Campfire.

## Base SHA rule
Branch from the pass-0 pin. `src/core/**` additions are pure read models only (`dayLedger.ts`); no new commands; any change to an existing command's semantics is a Codex trust review.

## Tracks
| Track | Owns | Must not touch |
|---|---|---|
| **A · Day ledger** | `src/core/dayLedger.ts` (new, pure): per-day marks from `agenda()`, `monthObligations`, `prepareFundInflows`, the Fund horizon, rituals (`heldOn`), plan steps (`Task.planReference`), plan cards' slips and stakes, Chapter events; kinds, owner, status (done needs receipt evidence), amount, links, provenance. Content-keyed memo. | `commands.ts` |
| **B · Strip and stones data** | `src/path/mini/miniJourneyModel.ts` re-based on the ledger (the strip's read model); `journeyFocus` gains `year`; keyboard map (←/→ day, ⇧ week, PgUp/PgDn month, Home today); the "covered through" ribbon. Stones' *rendering* belongs to 02c; this track supplies their data. | `pathWorld3d.ts` |
| **C · Calendar, Leaving, camp card on the ledger** | `src/calendar/*` reads the ledger as a grid (semantics kept: glyph/hue/edge, ownership and status separate, stable lanes, D-1248ff); `src/harbour/desk/leavingModel.ts` and `todayModel.ts` read the ledger; drag-to-move a planned cost stays `movePotentialExpense`; moving a single bill occurrence remains not-a-feature unless a command exists. | command semantics |
| **D · The table** | `src/PlanStudio.tsx`, `src/plan-wizard/**`, `src/plan-v3/**` → the table: "One Pull Raises It" as the entry (D28); the card writes itself (`savePlanDraft` on each answer); the wall shows the camp's month; cards "every month" / "once" (D32) with the activation job kept; the back of the card (steps = Glasshouse tasks, evidence, reopen-when stake); two chairs (K3); the drawer as Direction C's objects with v3's seven tools re-bodied (past sheets, tracing paper, letter tray, chairs, recipe box, kitty, lamp, sticky notes, the note under the corner); Classic sections retired as screens with every command still reachable through an object; `VITE_PLAN_STUDIO_V3` removed (D27). | Kitty/Fund/entry commands |
| **E · The four views of a card** | overlay hooks (with 02c): a card → stake on the Year Walk (dated: its stone; monthly: each stretch's first stone), slip(s) on stones for scheduled payments/contributions, the cat in the Loft when it saves; change propagation is derivation, never sync. | world geometry |
| **F · One ritual** | `ChapterPanel.tsx`, `src/plan-v3/CheckIn.tsx`, the Classic Sitdown section → the five-beat Campfire ritual (Arrive · Look back · Settle · Look ahead · Seal) using `appendPlanSitdownTurn` checkpoints, `acknowledgeHouseholdPlan`, `closeChapter` (the seal), `closeBooksMonth` in Settle if not yet closed; the weekly "two chairs" at the flagstone (no digest, no close); reduced-motion cuts; the Campfire scene's seats open beat 1. | Chapter/era rules (D-268, D-273) |
| **Integrator** | wiring, focus continuity, the fictional household's wall of four cards for the harness, HANDOFF. | — |
| **Reviewer** | `REVIEW-BRIEF.md` method: purity, money boundary, one-truth-per-day, the four views agreeing. | — |

## Must produce
- The same day shows the same marks on the strip, on the Calendar grid, on the Desk's Leaving page and in the camp card, from one ledger (a test compares them for 90 fictional days).
- A plan made in five questions appears on the wall, on the Walk as a stake, on its stones as slips, and in the Loft as a cat if it saves; editing the card changes all four; taking it down files it.
- An abandoned card is on the table on reload.
- The month you look at is the month the camp is on; past walls read-only.
- One monthly ritual with five beats seals the Chapter, edges the bed (via the overlay), and moves the camp; a weekly two-chairs at the flagstone does not seal anything.
- No Classic screen reachable; every Classic command reachable through a drawer object; `VITE_PLAN_STUDIO_V3` gone.

## Must not
- Post money from the table, the wizard, the strip or the ritual (only draft/propose/lock/acknowledge/Sitdown turns/close).
- Auto-close a Chapter or a month; invent a Chapter for a skipped month.
- Suggest Protect as a pot.
- Store any derived state (ledger, stones, stakes).

## Tests to add
- `test/day-ledger.test.ts`: purity; one truth per day across the four surfaces; receipt-evidence rule for "done"; reversal re-attribution moves the mark to the original day.
- `test/kitchen-table.test.ts`: the five questions → one `PlanLine` per the wizard mapping; draft saved per answer; monthly vs once lifecycle; two chairs; drawer objects call the existing commands; no Classic route.
- `test/card-views.test.ts`: stake, slips, cat derive from one line; edit propagates; filing removes all four.
- `test/campfire-ritual.test.ts`: five beats; seal requires both acknowledgements on the digest; weekly chairs write nothing but a turn.
- Static: no command import in `dayLedger.ts` or the overlay.

## Evidence
- Captures (1440 × 900, 390 × 844, three dressings): the table with a card mid-pull; the wall with four cards, one face-down; the drawer open; the back of a card; the five beats at the Campfire; the strip, the Calendar and Leaving side by side on the same day.
- A recording: five questions → pin → the stake appears on the map → step in → the stake by the stone.

## Gate
Jonathan (this is the everyday tool); Claude's reviewer on the money boundary and one-truth-per-day; Codex trust review if any command semantics change (they must not).

## Delivery
Bundle + patches + HANDOFF + FINISH-PROMPT + TEST-PLAN + evidence to `~/Downloads/horizon-02d-kitchen-table/`. `docs/DECISIONS.md` entries for D27–D33 as answered.
