# Claude assignment — September Office UX

> **Superseded for the current build.** Paste [CLAUDE_DESKTOP_OFFICE.md](CLAUDE_DESKTOP_OFFICE.md). Mobile Home shipped as `OfficePhone` ([CLAUDE_MOBILE_SHELL.md](CLAUDE_MOBILE_SHELL.md)). This file is the historical spec that produced the phone settings list. Keep its *feeling* on desktop; do not re-apply it as seventeen phone rows. Its optional-Supabase/device-local language is also superseded by [Google-account cloud continuity](CLOUD_CONTINUITY.md).

Paste this file into Claude first. Then attach `docs/packets/CLAUDE-OFFICE-UX-SOURCE.txt` (regenerate with `node scripts/pack-claude-ux.mjs` from `main`). Do not plan from `docs/nostalgia/` or `docs/reference/`. Those folders are history, not this brief.

You are **Claude**: independent architect and design lead for this update. You are **not** the implementer. Cursor Grok implements in the private GitHub repo after you spec.

---

## 0. Who, what, when

| | |
|---|---|
| **Product** | **Hearth** — household general ledger + companion kitchen for **Jonathan** and **Bianca** (Toronto, CAD). |
| **Repo** | `jonathanbeaulne123-blip/dual-ai-budget-app` (private). Kitchen site: https://hearth-books.jonathan-beaulne123.workers.dev/ |
| **Product owner** | Jonathan. Tie-breaker. Approves production money meaning. |
| **You** | Design the **final UX** going into **September testing**. Think of every surface. Leave nothing *in the room* half-specified. |
| **Cursor Grok** | Implements Dual Course slices from your packets. Does not clasp. Defaults to the Development snapshot. Runs `pnpm test`. |
| **Canon** | `docs/STRATEGY.md`, `docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, plus Jonathan’s latest instruction (this document). |

**One sentence:** Home becomes a comfy Toronto office with an open window on a rainy day — weather on the glass, movable instruments on the desk, a Maine Coon who lives on the furniture — while the books stay the company.

---

## 1. Feeling (non-negotiable atmosphere)

Design as if the user sat down in a **small lived-in office** that happens to also be a kitchen table:

- Wood, paper, copper, pine, rain. Not glassmorphism fintech. Not a SaaS dashboard. Not a game HUD.
- An **open window**: Toronto weather, time of day, season (patio summer / ruff winter already exist as wardrobe). Rain should be *heard in the eye* — streaks, puddle light, a darker sill — not a stock photo wallpaper that hides numbers.
- The desk is **used**. Widgets have weight. They stack, overlap a little, leave rings. They are not a widget store grid.
- Quiet enough to post milk in ten seconds. Rich enough that you do not *need* Calendar or Books unless you want to dive.
- Hercules is a **physical actor in the room**, not a sticker in the corner.

Steal the *feeling* (not the poison) from: Animal Crossing rain on the window; Neko walking on real chrome; a messy architect’s desk; a banker’s blotter; Cash App’s giant pad as a desk calculator; Bloomberg as “instruments,” refused as cold terminal chrome.

Refuse: Clippy, Duolingo guilt death, Mint chore, YNAB fake Visa cash, Notion infinite canvas as the ledger, a second game database, weather that invents CAD.

---

## 2. Dual Course law (if it conflicts, books win)

Hearth is **one product, two courses** (D-048):

| | Course A — Family office | Course B — Companion & room |
|---|---|---|
| **Weight** | **5** | **3** |
| **Job** | True books | Presence that makes posting, rec, and sit-down the thing you *do* |
| **Trust** | `postEntry` / `postTransfer` / `postShift` and kin | Cosmetics, talk, layout, weather. **Never** `postEntry` |

Every idea in your spec must name:

1. **Budget delta (5)** — posting, rec, sit-down, account literacy, split honesty, Health, or statements.
2. **Engagement delta (3)** — Hercules, window, widget, chalkboard, wallet, ceremony, Ask chip.

A prettier rain that hides the grocery pad is a defect. Shrink the furniture.

### Laws that do not move

Commands are the money trust boundary. UI is untrusted (D-025 / D-026).

- Expense leaves purchasing power; income enters; **transfer moves**; refund reduces category spend. **Card paydown is a transfer** (D-016 / D-008).
- Splits must sum. Joint is explicit (D-009).
- CAD only. Integer cents (D-021).
- Dates are `YYYY-MM-DD` civil keys in `America/Toronto` (D-007).
- Development and Production are two **phone snapshots**, not Cloudflare prod vs preview (D-002). Default the design to Development.
- Double-entry. Health refuses imbalance. **If a statement disagrees with the journal, the journal wins** (D-033 / D-046).
- Hercules, chalkboard, wardrobe, visit sparks, rec, close, marks, Google, Hercules desk, **widgets, weather, office layout** never post money (D-042–D-051).
- Hercules never names who spent more. No fake fees. No pay-to-keep-alive. No hunger-meter death (D-044). Vacation does not kill him. Shift streak is **posted shift dates**, not opens (D-050).
- Bank feeds, Interac, issued cards: **blocked until Auth + RLS** (D-039). Do not spec a live bank ticker.
- Accounts are financial accounts (chequing, savings, credit, investment, other), not categories (D-047).
- Personal rows are a **filter**, not privacy, until Auth (D-015).
- Hosted RLS is still `USING (true)` (D-034). Do not pretend the door latched.
- Third-party **model** keys are allowed only as Cloudflare Worker secrets, never `VITE_` (D-045). Weather may use a **no-key** public forecast (e.g. Open-Meteo for Toronto). If fetch fails, fall back to `hourInToronto` + `kitchenSeason`. Never block Add on weather.
- **Kill criterion:** if Bianca will not add a grocery because Hercules or a widget is in the way, shrink it. Drag. Pin. Minimize.

You may be revolutionary **in the room**. You may not be revolutionary **in money meaning**.

---

## 3. What already shipped (do not re-litigate)

Phone-first tabs: **Home, Calendar, Add (FAB), Plan, Books, More**.

- Command kernel: spend, income, shift, transfer, category, budget, goals, recurrences, undo, confirm, duplicates.
- PGlite journal + optional Supabase; trial balance; Audit Office (opinion, statements, rec, close pack).
- Accounts Floor: wallet tiles → account room → Add defaults to the focused account.
- **Kitchen habit (D-050):** Cash App–style CAD pad (digits are cents: 1-2-5-0 → `$12.50`; mouse-wheel blocked); Home **Milk / Shift / Pay card**; Plan sit-down is Look → trims → Apply via `applySitDown` (`postedIds: []`); Hercules shift streak from posted shifts; “Log shift” opens Add; **Confirm still posts**.
- Hercules: borderless wander, loaf on Add, drag, pin (long-press / context menu), journal-true chips, unmatched talk via Worker, chat/memories in `kitchen.hercules` (D-049).
- Chalkboard, wardrobe unlocks from posted facts, cook-off, pulses, Google overlay (never posts).

**Current problem this design kills:** Home is still a **scroll of cards**. Add is a **full-screen sheet**. Hercules wanders in a **random perch** that does not know the furniture. The room does not feel lived in. Deep work (statements, rec, close, pairing) is fine as cabinets — daily life should not require them.

---

## 4. Current map (so you spec against code, not a fantasy app)

| Surface | What it is today | Office destiny |
|---|---|---|
| Home | Hero net, quick acts, wallet strip, 2 pulses, week movers, money dates, goals, Daily Hearth chalkboard | **The office.** Default place. Widgets. Window. Cat. |
| Add | Full-screen sheet, CAD pad, Milk/Coffee, shift field tabs, details collapsed, huge Post | **Desk calculator** that expands in place or as a sheet that does not exile the room. Confirm still posts. Hercules loafs, never covers Post. |
| Plan | Category bars + 3-step sit-down + goals | Sit-down **postcard widget** on the desk; Plan remains for the long list. |
| Calendar | Month board, bills, Google | **3-day strip widget** on the desk; Calendar remains for the month. |
| Books | Wallet, statements, rec, close pack, journal | **Filing cabinet.** Open from expanded wallet / opinion stamp. |
| More | Health, undo, pairing, Google, storage, add category | **Drawer.** Health lamp on the desk if findings exist. |
| Hercules | Absolute-position cat, random `safePerch`, poses, compact chat | Physics vs widgets: perch, bump, lick, pounce/attack. Still not Clippy. Still not a dock. |

**Key files (in the source pack):** `src/App.tsx`, `src/Hercules.tsx`, `src/DailyHearth.tsx`, `src/Accounts.tsx`, `src/CadPad.tsx`, `src/SitDownGuide.tsx`, `src/Calendar.tsx`, `src/Books.tsx`, `src/styles.css`, `src/core/herculesTalk.ts`, `src/core/companion.ts`, `src/core/hercules.ts`, `src/core/insights.ts`, `src/core/cadPad.ts`, `src/core/shiftStreak.ts`, `src/core/kitchen.ts`. Domain in `src/core` does not import React. **Do not rewrite `postEntry` / `postShift` / `applySitDown` / journal compile.**

**CSS tokens already in the house:** `--paper`, `--paper-2`, `--ink`, `--muted`, `--line`, `--pine`, `--copper`, `--gold`, `--danger`, `--card`, `--display` (Fraunces), `--font` (Figtree). Extend; do not invent a second theme system.

**Hercules poses today:** loaf, walk, jump, stretch, wash, sleep, hide, pace, celebrate, pounce. Add perch / lick / bump / attack as **directed motion toward furniture**, not a new personality that ignores the journal.

**Data you may read (projections):** `buildDashboard`, `householdWallet`, `creditCardView`, `auditOpinion`, `describeCompanion`, `herculesIdle` / `talkHercules`, `sitDownPreview` / `sitDownPostcard`, `shiftPostingStreak`, `cookOffScore`, `runHealthCheck`, `buildMonthBoard`, `kettlePhase`, `hourInToronto`, `kitchenSeason`.

**Writes that are allowed from a widget:** open Add with defaults; `scribbleChalk` / wipe; `equipCosmetic`; `recordHerculesTalk`; sit-down Apply still `applySitDown`; mark paid / pay card still go through existing confirm + commands. **No new money verbs.**

---

## 5. Scope — “leave nothing outside”

You are specifying the **entire September testing face**. If a household act exists today, say where it lives in the office **or** which cabinet you open.

Specify at design-complete level (not “TBD later”) for:

1. **Information architecture** — What lives on Home at glance / expand / deep. When does the nav still matter?
2. **The window** — Weather, time, season, reduced-motion fallback, fetch failure, night vs rain vs snow vs humid August. No CAD in the sky.
3. **The desk canvas** — Phone-first (thumb, one column that can still *feel* like a desk), what happens at tablet width, snap vs free move, overlap rules, z-index vs Hercules vs Add vs nav (`--nav: 76px`).
4. **Every widget** — See §6. Expand, minimize, move, empty state, warn state, Hercules interaction, projection source, command (if any), Dual Course deltas.
5. **Hercules physics** — §7.
6. **Add / CAD pad** in the room — how Milk happens without losing the window.
7. **Sit-down, rec, close, opinion** as desk objects vs cabinets.
8. **Pairing, Google, Health, undo** — lamp / drawer, not a lecture.
9. **Motion, sound, haptics** — clink already exists (`playClink`). Rain is visual first. No guilt owl.
10. **Accessibility** — contrast on rain, hit targets ≥ 44px, `prefers-reduced-motion`, screen reader names, don’t require hover.
11. **Persistence** — widget layout: **this phone + this environment** (like visit sparks), not the shared snapshot. Widget *data* is household. So Bianca’s pile is not Jonathan’s; the Visa balance is.
12. **States matrix** — at least: `kettlePhase` (morning / after-shift / sunday / evening) × weather × companion mood × `adding` × Health findings. Hercules and window change; CAD meaning does not.
13. **September test script** — numbered taps a spouse can follow on Development demo data. App/website, then tab, then taps (project law).
14. **Cut list** — what you considered and refused, with Dual Course why.
15. **Implementation slices** — §9, for Cursor Grok.

Out of **engineering** scope for this design (name them as cabinets / later, do not fake them): Auth+RLS, Flinks, Interac, issued cards, lock-screen widgets with amounts, safe-to-spend if the math does not exist yet, `VITE_` model keys.

Out of **feeling** scope: nothing. If the office needs a lamp, a sill, a plant that is actually the cook-off, a stamp that is the opinion — specify it.

---

## 6. Widget law

A widget is an **instrument on the desk**, not a shortcut tile that only routes.

| Must | Must not |
|---|---|
| Expand in place (or a sheet that keeps the room) | Be the only way to post (Add/Confirm remain) |
| Minimize to a named object Hercules can sit on | Auto-post, auto-pay, auto-sit-down |
| Move with pointer; survive reload on this phone | Sync layout through the household snapshot |
| Show journal-true CAD or an honest empty | Invent runway, APR as a fee, or “you broke your streak” |
| Teach one budget primitive when expanded | Duplicate Books’ full statements on Home |
| Have a Hercules verb (perch, bump, lick, pounce) | Trap the cat in a hit-test hell that blocks Milk |

**Minimum catalog you must spec (add more if the room needs them):**

| Working name | Primitive it teaches | Expand shows | Minimize is | Deep link |
|---|---|---|---|---|
| Window | Time is Toronto | Forecast sentence, season | Sill only | — |
| Blotter (net + opinion) | Month net is the company | Opinion + 1 Health lamp | Stamp | Books → statements |
| Wallet tray | Account is the object | Tiles; one card room summary | One hottest card | Books → wallet |
| Calculator | Posting | CAD pad + Milk/Coffee/Shift | Tiny pad or + | Add sheet |
| Chalk | Cosmetics ≠ money | Notes + bought → Add | Board | — |
| Mail | Bills remind, mark paid writes | Next 3 money dates | Envelope | Calendar |
| Timesheet | Shifts are posted | Streak + Log shift | Punch clock | Add shift |
| Postcard | Sit-down | 3-step guide | Card | Plan |
| Cook-off | Groceries vs coffee, no names | Week scores | Kettle | — |
| Jars | Goals | Contribute (existing command) | One jar | Plan goals |
| Lamp | Health | Finding list | Glow/dark | More |
| Cabinet handle | Dive | — | Label | Books / Calendar / More |

Empty, loading, warn, and “Hercules hiding” treatments are required for each.

---

## 7. Hercules in the furniture

He is already a borderless 96px actor (`Hercules.tsx`). Today `safePerch` is random and avoids the FAB.

Specify:

- **Perch** — prefers the top edge of a minimized or expanded widget (window sill, wallet, chalkboard). Loaf/sleep there. Adding: still loaf in a corner, **never** on the Post button.
- **Bump** — walk path intersects a widget: small nudge of the widget or he detours; one sentence max if chat is closed (“mrrp”). Do not throw CAD.
- **Lick** — idle on chalkboard or wallet while glowing/content: wash/lick animation, no modal.
- **Attack / pounce** — only on **honest** warn objects: overdue mail, waiting shift (D-050), Health lamp when hiding. Not on the user. Not a rage comic. Not “you missed a day.”
- **Drag / pin** — keep. Pin means he stays; widgets may still move under him.
- **Chat** — compact bubble, 2–3 chips. Chips may target widgets (“Pay the card?” opens wallet expand + transfer Add). Typed money stays `talkHercules` / `askHercules`. He still never posts.
- **Kill criterion** — if hit-testing makes Milk impossible, widgets become inert under the cat or he shrinks.

Map each pose you add to a journal or Health fact. A lick is not a hunger meter.

---

## 8. What to deliver (your reply shape)

Do **not** dump unsolicited React for the whole app. Do **not** rewrite commands. Design is the job. Light CSS/token sketches and ASCII layouts are encouraged.

### A. Office Spec (canonical)

Feeling, IA, canvas rules, persistence, a11y, states matrix, cut list.

### B. Widget catalog

One subsection per widget: glance / expand / minimize / move; data (projection name); write path (or none); Hercules verb; Dual Course deltas; empty/warn; September test taps.

### C. Hercules physics

Targeting, collisions, z-index, Add/loaf exception, new poses, what stays random.

### D. Visual system

How rain, night, and paper coexist with readable CAD. Token extensions. Reduced motion. Phone vs wide.

### E. September test script

Numbered, spouse-followable, Development demo.

### F. Implementation packets for Cursor Grok

Ordered slices. Each slice is a PR-shaped card:

```text
SLICE: <short name>
USER-VISIBLE: <one household sentence>
BUDGET DELTA (5):
ENGAGEMENT DELTA (3):
IF THEY CONFLICT, CUT:
RISK: Low | Medium | High
TOUCH: <files>
DO NOT TOUCH: postEntry, postShift, applySitDown, journal compile, RLS, Interac, …
READ: <projections>
WRITE: <commands or none>
TESTS: <cases>
ACCEPTANCE: <taps>
```

First slices should ship **room chrome + window + desk canvas** without breaking Add. Then bind existing projections into widgets. Then Hercules physics. Then persistence. Deep Books stay last.

### G. Handoff footer (always)

Status / What I examined / Verified findings vs assumptions / Open questions for **Jonathan only if they change money or privacy** / Recommended next slice for Cursor Grok.

---

## 9. How to communicate with Cursor Grok (implementer)

Grok is already in the repo, Dual Course fluent, and will implement **your packets**, not a vibe.

1. **One spec thread.** Put the Office Spec in a form Grok can paste into `docs/OFFICE.md` later. Do not hide rules in prose-only poetry.
2. **Slices are contracts.** If Grok must invent a widget you did not spec, your spec failed — go back and specify, don’t shrug “make it nice.”
3. **File names from this tree.** Prefer `src/Office.tsx`, `src/widgets/*`, `src/core/officeLayout.ts`, CSS in `src/styles.css` or `src/office.css`. Grok may rename if evidence supports it; you should still propose.
4. **No secret second ledger.** Widget layout = `localStorage` per environment. Household snapshot stays commands + kitchen cosmetics that already merge.
5. **When you disagree with Grok’s later PR:** argue Dual Course (weight 5 vs 3), kill criterion, and a reversible alternative. Jonathan breaks ties.
6. **Do not ask Grok to clasp, touch production Sheets, or commit workbooks.**
7. **Weather:** specify Open-Meteo (or equal, no key) for Toronto; timeout; cache on phone; fallback to clock/season. Never a `VITE_` weather key unless Jonathan says so.
8. **If you must show code:** a widget shell and a collision helper are OK. Full `App.tsx` rewrites are not.

Grok will: read this file + your packet, implement the next slice, run `pnpm test`, update D-051 why-notes if behavior lands, open a PR.

---

## 10. First message back

Start with the **feeling in one paragraph**, then the **IA diagram**, then the **widget catalog table**, then slice 1 in the packet format. Do not wait for another prompt to be complete. This is the design update. Fill the room.
