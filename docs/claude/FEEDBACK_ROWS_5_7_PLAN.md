# Feedback rows 5–7 — fix plan

*Prepared 12 September 2026 against `main` at `58cb1d75` (after #451/#452). Every claim has a file reference and I re-read the load-bearing ones myself rather than trusting the sweep. Where I contradict a row's premise or its suggested fix I say so and show the code. Suggested fixes were treated as suggestions.*

The three rows:

| Row | Page | Function | Issue | Owner | Urgency | Status |
|---|---|---|---|---|---|---|
| 5 | All | Navigation & functions | Too many options/info & buttons all at once (might not feel this way after practice) | Bianca | 10 | Not started |
| 6 | All | Language and UX | Lots of over-explaining in-app jargon overtaking valuable UX real estate | Jonathan | 9 | Not started |
| 7 | All | Colour coordination | Hard to discern what kind of info I'm looking at with the current colour schemes | Jonathan | 8 | Not started |

> **Postscript, same day.** Jonathan chose "all of it", no Simple/Everything mode, and the Why aside. Everything below was implemented on branch `claude/feedback-rows-5-7` and rebased onto main after planner #453 as D-246 (D-245 is the planner; worksession `docs/worksessions/2026-09-12-feedback-rows-5-7.md`). Two claims in this plan were corrected by the code: the Google multi-day "truncation" was not a live bug (see row 7), and the Hercules lesson lines were already one sentence, so 6.6 needed nothing. Plan's fifteen-section rail (5.6) was left as is: it already sits behind one disclosure, so it does not add to first-paint density.

**Headline:** these three rows are one complaint from three angles — *Hearth shows me everything at once, in words, and the colours don't help me sort it.* None of them touch money meaning, so the whole plan is Low/Medium risk, but each has a hidden finding that changes what to build:

- **Row 5** is mostly a *duplication* problem, not a "too many features" problem. In Our Home there are three separate routes to Calendar and three to Together before you read a single number. Two of those duplicates were already voted off in Vision v2 and just haven't been removed.
- **Row 6** is a *placement* problem, not a volume problem. 92% of the app's long explanatory text is always visible; only 8% is behind a disclosure. The right pattern already exists in the codebase and is used exactly once.
- **Row 7** has a real bug under it: the theme layer silently overrides every calendar kind colour to plain ink (`worlds.css:1190`), so the colour system Jonathan is asking for was partly written and is unreachable. Multi-day events — Hearth's and Google's — are fanned out into unconnected per-day chips with no memory of the run (an earlier draft of this line called the Google case data loss; it is not — see the correction under row 7).

---

## Row 5 — Too many options and buttons at once

**Suggested fix:** *"I agree, I don't know how to fix this one just yet."*

### What's actually true

**The chrome, before any page content, at phone width:**

| Layer | File | Controls |
|---|---|---|
| Environment pill + sync-status bar | `App.tsx:6468`, `:6484` | 2–3 |
| Our Home ↔ My Money switch | `App.tsx:6624-6639` | 2 |
| **"Household tools" secondary nav — Our Home only, every page** | `App.tsx:6669` | 3 (Calendar & bills · Work & shifts · Status Centre) |
| Bottom tab bar | `App.tsx:8523-8607`, `kitchenPrimaryNav` at `ledgerExperience.ts:66-69` | 4 (household) / 5 (personal) |
| Centred `+` (`FabSpeedDial`) | `App.tsx:8569`, `fabActions.ts:37-49` | 1 closed → **6 open** in Our Home, 4 in My Money |
| Fund Ledge grip | `App.tsx:8509-8520`, `FundLedge.tsx:159` | 1 |
| Hercules pill | `Hercules.tsx:1800` | 1–2 |

So Our Home carries **~11 persistent controls** and My Money **~8** before the page starts. Then the pages themselves:

| Surface | First-paint controls (phone) | What contributes |
|---|---|---|
| **My Money Home (`OfficePhone`)** | **~34–40** ⚠️ | `PhoneFold` mounts *everything* below the fold, visible and tabbable (`PhoneFold.tsx:61`); the "More instruments" drawer lists what is *not* on the page (`core/officePhone.ts:78-80` — corrected: not a duplicate); pin button; "Our boards" with `SharedBoards` (10 buttons + tablist) |
| **More / Status Centre** | **21 buttons, 12 sections, zero collapse** ⚠️ | `App.tsx:7100-7689`, one 590-line flat block |
| **Plan / Our Path** | ~20–30 | a **15-section** rail behind one summary (`PlanStudio.tsx:150`) + `ChapterRoom` + `KittyBanks` stacked on the same page (`App.tsx:6835-6839`) |
| **Books** | ~18–24 | 12 panes (`Books.tsx:67-81`) reached through *three* different control groups: `PaneSeals` `:327`, the tab row `:337-343`, and the "Audit office" details `:469` |
| **Calendar** | ~22–28 | 4-tab tablist + month stepper + an unbounded layer-checkbox set + **4 chips per plan row** (`Calendar.tsx:910-914`) |
| **Hercules chat, open** | ~18–24 | three unbounded chip rows stacked in one bubble (`Hercules.tsx:1750`, `:2047`, `:2056`) + two nested `<details>` inside a modal (row 12 in the sheet; noted, not in this plan) |

### The finding that makes this tractable: it's duplication

In Our Home, a user has **three ways to reach Calendar** (secondary nav `App.tsx:6669`; the `+` "Plan a cost" verb `fabActions.ts:33`; and the household tab set deliberately *doesn't* include it — `ledgerExperience.ts:67`), **three ways to reach Together** (its tab; the `+` "Decide together" verb `:34`; and the "Household tools" bar), and **two ways to reach the Status Centre** (the status bar, which Vision v2 §4.7 says is the *only* way — "reachable from the status bar and from no tab" — and the secondary nav button). The `+` in Our Home is labelled *"What can we do?"* and mixes four money verbs with two pure-navigation verbs (`FabAction.kind: "go"`), so the one control that should mean "add" also means "go somewhere."

Three of Hearth's own vocabularies disagree about what a tab even is: `LedgerTab` (7 members, `ledgerExperience.ts:16`), `KitchenPrimaryNavId` (7, `:63`) and App's runtime `Tab` (8, `App.tsx:532`), reconciled by `presenceTab()` and three inline `tab === "together" ? "more" : tab` mappings (`App.tsx:534-535`, `:6642`, `:6649`).

**Vision v2 already decided most of this and it hasn't landed:**
- `HEARTH_FUTURE_VISION_V2.md:133` — *"retire the secondary nav (Work is a Personal job; Settings moves to the Status Centre). Retire the Till door from Home."*
- `:175-181` §4.7 — Status Centre in **six groups** (Needs us · Sources · Household · Privacy · Comfort · Help), reachable from the status bar only. Today it is one flat list with the appearance picker first (`:71` names exactly this gap).
- `:102` — *"Crossing into Our Home should feel like entering a different product: the Personal shell's account density falls away."*
- D-243/D-244 (`DECISIONS.md:93-94`) — "More removal follows in the Status Centre slice."

So row 5's first step is not design work; it's finishing an accepted decision.

### The thing I'd push back on: a "beginner mode"

Bianca's disclaimer — *"might not feel this way after practice"* — invites a Simple/Advanced toggle. I'd resist it. Nothing like it exists (`grep` for `simpleMode|beginner|expertise|familiarity` in `src/` returns nothing), it means two apps to keep authored in three themes, and the closest existing levers are already the right shape: `Comfort` (device-local: quiet, celebration, motion, haptics, sound — `theme/comfort.ts:10-22`) and the per-member, synced `planCoachingPreferences.intensity: "off" | "calm" | "active"` (`core/planSystem.ts`, UI at `PlanStudio.tsx:174`). Neither reduces control count today, and I don't think they should: the *default* should be calm. If after 5.1–5.4 Bianca still wants fewer controls, the honest lever is extending Comfort's existing **Quiet** expression to hide secondary instruments — one flag, already persisted, already in the Status Centre — not a new mode.

### What I'd build

**One rule, applied everywhere:** *one way to each place; one primary action above the fold; everything else behind one named disclosure that remembers whether you opened it.*

| # | Step | Files | Risk |
|---|---|---|---|
| 5.1 | **Retire the "Household tools" secondary nav** (accepted, V2 `:133`). Calendar stays reachable from Our Home via the Calendar door on `HouseholdHome` (`HouseholdHome.tsx:81` "All dates and bills") and Work via My Money. | `App.tsx:6669`, `plan-studio.css:21` | Low |
| 5.2 | **`+` means add.** Drop the two `kind: "go"` verbs from the household set so `+` is four money verbs in both spaces; keep destination-aware ordering. Closed label becomes "Add" in both spaces (the question "What can we do?" moves to Together, which already owns "what needs us"). | `core/fabActions.ts:33-49`, `:52-54`, `FabSpeedDial.tsx` | Low |
| 5.3 | **Status Centre in six groups**, each a persisted `<details>` (open state in `localStorage`, same pattern as the calendar layer filter `Calendar.tsx:468`), Needs-us first, appearance picker under Comfort. No feature removed. | `App.tsx:7100-7689` | Medium (large mechanical move; three themes) |
| 5.4 | **My Money Home: nothing below the fold is mounted until asked.** `PhoneFold` renders the spill lazily behind the existing drawer; the drawer stops duplicating instruments already on the page. | `PhoneFold.tsx:11-61`, `core/officePhone.ts:78-80`, `OfficePhone.tsx:317-337` | Medium |
| 5.5 | **One vocabulary for tabs.** Collapse `LedgerTab` / `KitchenPrimaryNavId` / `Tab` into one union and delete the three inline `together→more` remaps. Pure refactor; makes 5.1–5.4 testable. | `ledgerExperience.ts:16,63`, `App.tsx:532-535,6642,6649` | Low |
| 5.6 | Books: one control group for panes (keep `PaneSeals`, fold the tab row and "Audit office" into it). Plan: cap the rail to the four lenses + "More" (the other eleven behind it). | `Books.tsx:327-343,469`, `PlanStudio.tsx:150-160` | Medium |

5.1, 5.2 and 5.5 together remove roughly a third of the persistent chrome in Our Home for about 60 lines of change, and every one of them is already decided.

**Acceptance:** at 390px, Our Home shows ≤ 7 persistent controls (was ~11) and My Money Home ≤ 12 controls above the fold (was ~34–40 mounted); every destination has exactly one route from the chrome; `test/app-startup-p1.test.ts` and the five-boards entry test stay green.

---

## Row 6 — Over-explaining

**Suggested fix:** *"full audit on all UX and displayed explanations. How can we convey the same message through UX or a different method without paragraphs of text?"*

### What's actually true — the audit

Measured over `src/**/*.tsx` and `src/core/**/*.ts` (comments, SQL, SVG and templates excluded):

| | Count |
|---|---|
| Rendered explanatory text blocks ≥ 60 characters | **440** |
| …behind a `<details>` disclosure | 36 (**8%**) |
| …always visible | **404 (92%)** |
| Static explainer paragraphs ≥ 100 characters | 119 |
| Files with a `hint`/`help` class | 4 |
| `Hint` / `HelperText` / `Explainer` / `Glossary` component | **none** |

The dominant pattern is `<p className="muted">…</p>` under a heading, always visible. The heaviest *screens* by always-visible prose: More/Status Centre (`App.tsx:7060-7600`, ~4,100 chars), the Development-only `MonthRehearsalPanel` (~3,500), `SevenShiftsEvidenceCenter` (five stacked paragraphs `:418-465`, ~1,800), `WorkShiftFlow`, `ChapterPanel`, `PlanStudio` (~1,650 each), then **Calendar** (`:456, :461, :590, :801, :844, :952` — ~1,600), `BatchImport`, `KittyBankRoom`, **Books** (~1,270). Single worst paragraphs: `GoogleBridge.tsx:163` (428 chars, unclassed), `BatchImport.tsx:525` and `App.tsx:7566` (243), `QuickSamplePanel.tsx:28` (241), `AccountHistorySetup.tsx:135` (228), `Calendar.tsx:801` (224), `StatementSetup.tsx:124/129/137` (three long hints in one form).

Worth noticing: **none of the top offenders are on a daily-use surface.** They are settings, setup and evidence pages, where disclosure is safe. The daily surfaces (Home, Calendar, Books, Plan) have the *density* problem — many medium paragraphs — not the giant-paragraph problem.

**The jargon count** (user-visible strings only): *posted/posting* 288 hits, never defined for the user; *snapshot* 150; *kitchen* 95 (an internal metaphor for "the app", never explained); *Development* 98 (build vocabulary leaking to the user); *PGlite* **24 hits in user copy** — a library name; *envelope* 71; *Sitdown* shipped in **three spellings** (Sitdown / Sit-down / sit-down); *Protect / Prepare / Build* explained exactly once, in a Kitty Bank room (`KittyBankRoom.tsx:1192`). There is no glossary and no `terms` module.

### Two precedents already in the repo — the plan is to generalise them

1. **`LedgerPurposeBanner.tsx:17-27`** takes a 130–180 character purpose from `ledgerExperience.ts` and puts it in `aria-description`, rendering only a kicker and a heading. Screen-reader users get the sentence; everyone else gets the heading. Used once. This is the pattern for every "what this page is" paragraph.
2. **`src/core/onboarding/copy.ts`** — 234 typed entries, median **40 characters**, and a fence test (`test/onboarding-copy.test.ts`) that forbids components from composing sentences at the call site. Onboarding is the one surface where copy is disciplined, and it's disciplined *because of that test*.

Rules the plan must keep, verbatim: *"Posting flags are authoritative"* and *"never imply a peer device is host"* (`CLAUDE_COMMAND_STATES_UX.md:16,20`); the Primary / Secondary / Action three-slot contract already defined for command states (`:78`) — which is exactly the contract to extend to the rest of the app; *"Dates remind. Mark paid writes."* — four words, already the house style exemplar; and Development-openness must stay *disclosed* (`:12`), so the Development paragraphs get moved behind a disclosure, not deleted. `look.density: "large"` (D-101) must not regress.

### What I'd build

**One primitive, one budget, one test.**

| # | Step | Files | Risk |
|---|---|---|---|
| 6.1 | **`<Whisper>` primitive** — one component for supporting text with three renderings chosen by prop: `line` (one sentence, ≤ 90 chars, visible), `aside` (a `?`/"Why" toggle that reveals the paragraph, remembered per device), `described` (text goes to `aria-description` of its parent, nothing painted). Themed once in `worlds.css` for all three worlds. | new `src/theme/Whisper.tsx`, `worlds.css` | Low |
| 6.2 | **Copy budget fence test**: no always-visible static string > 120 chars in `src/**/*.tsx` unless it is inside `<details>`, a `<Whisper mode="aside">`, or an explicit allow-list (`Charter` clauses, error bodies). Starts with today's 119 offenders on the allow-list and the list only shrinks — same mechanism as `onboarding-copy.test.ts`. | `test/copy-budget.test.ts` | Low |
| 6.3 | **Daily surfaces first**: Calendar (6 paragraphs), Books (3), Plan overview (3), Home V2, Fund panel. Each paragraph becomes a `line` or an `aside`; page purposes become `described`. | `Calendar.tsx:456,461,590,801,844,952`, `Books.tsx:285,829`, `PlanStudio.tsx:163,170,181`, `FundTrust.tsx:46-88` | Low |
| 6.4 | **Vocabulary pass** — a `src/core/terms.ts` registry with the user-facing word for each internal one, and a test that the internal words don't appear in rendered strings: *kitchen* → "Hearth" / "this phone"; *PGlite* → "this phone's books"; *snapshot* → "books"; *Development* → "test books" (with the disclosure kept); *Sitdown* → one spelling; *posted* stays but gets defined once, on the first receipt. | new `src/core/terms.ts`, `test/terms.test.ts`, ~30 call sites | Low–Medium (many files, no logic) |
| 6.5 | Settings and setup screens: More/Status Centre (folds into 5.3), `SevenShiftsEvidenceCenter`, `StatementSetup`, `BatchImport`, `GoogleBridge` — paragraphs become `aside`. | as listed | Low |
| 6.6 | Hercules `lesson` lines (`herculesTalk.ts:205`, `hercules.ts:321`) capped at one sentence; the rest becomes a "tell me more" reply chip. | `core/herculesTalk.ts`, `core/hercules.ts` | Low |

**Acceptance:** always-visible explanatory characters on Calendar, Books, Plan and Home each drop by ≥ 60% (measured by the fence test's counter, reported in the handoff); zero occurrences of *PGlite*, *kitchen*, *snapshot* in rendered strings; one spelling of Sitdown; every removed paragraph is still reachable (aside) or announced (described) — nothing is deleted.

### Where I'd push back

*"Convey the same message through UX."* For most of these paragraphs the honest answer is that the message doesn't need conveying at all on that screen — it's a caveat written for the author's peace of mind. The `aside` keeps it available for the one time in fifty it matters. The exception is anything about money outcome, host-vs-peer, or Development openness: those keep a visible `line`, always.

---

## Row 7 — Colour coordination

**Suggested fix:** *"understandable colour legend; each type of information understood at a glance through an intelligent colour-coding system."* Status note: *"every input is assigned an icon"* (rated 5). Next: *"multi-day events need to look connected without breaking the UX; needs more colour to differentiate between calendar data."*

### What's actually true

**There is no information-type colour anywhere in the token system.** `styles.css:1-39` and `theme/worlds.css:70-133` define mood and material (`--paper`, `--ink`, `--copper`, `--pine`…), *status* (`--world-good/warn/danger/info/quiet`), and four chart tokens (`--theme-chart-positive/negative/neutral/plan`, `scenes.ts:107-110`) that mean *valence*, not *kind*. `grep` for `--income|--expense|--bill|--paycheque|--subscription|--goal|--appointment` across all CSS: zero.

**The kind colours that were written are dead.** `styles.css:1734-1743` gives each calendar kind its own hue (`kind-google #243c6b`, `kind-visit #5a2d6b` …). But `worlds.css:1190` — `:root[data-theme] .cal-title { color: var(--ink) }` — has higher specificity and `ThemeProvider.tsx:56` always sets `data-theme`. **Every chip in every theme is plain ink.** What survives is a 3px left edge (`worlds.css:1195-1215`) covering 11 of 15 kinds — `other`, `event` (Hearth's own events), `potential-expense` and `shift-envelope` get nothing — with two indistinguishable pairs (`shift` = all `work-*`; `google` vs `detected` differ by dash-vs-dot at 3px). The only kind that keeps a colour is potential-expense (`calendar-boards.css:45`), and it uses `--theme-accent` — the same token as day heat (`Calendar.tsx:536`), the selected day (`page-calendar.css:24`) and the focus ring (`calendar-boards.css:78`). One colour, four meanings. That is Jonathan's complaint, stated in CSS.

**The icon system** is a glyph prefixed into the label string: `CALENDAR_KINDS` at `calendar/semantics.ts:3-19`. It is good and it's the reason the calendar is readable at all — but `other` and `event` share `○`, and `paycheck`, `work-pay`, `work-tip` all share `↓`. It renders only on calendar-family surfaces (Calendar cells `Calendar.tsx:541-544`, day lists, `CalendarDesk` widget), never on Add, Books or Register. And the glyph's `<span className="cal-kind">` has **no CSS rule anywhere**.

**Member colour is plumbed and never drawn.** `BoardItem.memberColor` is set for shifts, envelopes, settlements and Google events (`core/board.ts:197,227,244,263`) and passed at `Calendar.tsx:302`; nothing consumes it. The legend at `Calendar.tsx:456` says *"Calendar colours also reflect people"* — currently false.

**The legend** exists (`Calendar.tsx:456`) but lists 8 of 15 kinds, has no colour swatches, renders on the board pane where there are no chips, and is a `<div aria-label>` on a non-landmark, so the name isn't reliably announced. The **visibility toggles** (`calendar/visibility.ts:3-8`) are keyed by *source*, collapsed to 10 layers, while kinds are 15 — `claim` has its own glyph and edge but no toggle (it hides with Appointments). Any legend keyed to kinds won't match the toggle list.

**Multi-day events — the real defect under "make them look connected":**
- Hearth events keep a `start`/`end` (`core/nativeEvents.ts:13-15`) but `core/board.ts:303-306` fans each occurrence into **one independent `BoardItem` per day** with the full title repeated and no memory of the span. The information is there and thrown away at render.
- **Google events lose their span too.** *Correction after implementation:* the live read path (`readGoogleCalendars`, `calendar/google.ts:203-206`) already fans a multi-day Google event across its days using the exclusive `end.date`, so nothing is truncated on the real calendar — my first read of the helper `overlayFromGoogleEvent` (which only tests call) overstated this. What is true is that each day becomes an independent overlay with no memory of the run, exactly like Hearth events.
- The grid is independent `.cal-cell` divs with gaps (`styles.css:1686-1690`, `calendar-boards.css:18-21`); nothing spans.

**Rules a legend must respect:** *"Copper means scheduled cash out; ink means posted cash out"* (D-*, `DECISIONS.md:621`, `calendar-weight.css:6-8`) — yet `--copper` is *also* the bill edge (`worlds.css:1198`) and the potential-expense fallback. The certainty channel is **solid vs dashed** (`THREE_VISUAL_WORLDS.md:30`) — a kind legend must not reuse dash for type. The 2026-09-11 decision (`DECISIONS.md:23`) deliberately made *"theme colour optional for meaning"* via glyphs — so colour must be **additive to the glyph**, never a replacement, or it reverses an accepted decision. `HEARTH_UI_THEME.md:101`: extend tokens through `scenes.ts`, no second theme system. And colour-only meaning exists today in day heat (`Calendar.tsx:503,513,536`): the `.hot` class is unstyled and the `aria-label` never says a day is heavy.

### What I'd build

**Three carriers per kind — glyph, edge, hue — from one registry, per theme, with one legend that matches the toggles.**

| # | Step | Files | Risk |
|---|---|---|---|
| 7.1 | **Carry the Google span.** One `endDateFromGoogleEvent` (all-day `end.date` exclusive; timed `end.dateTime` in Toronto) shared by the live read loop and the helper; overlays gain `span {index, length}`. Test with a 3-day all-day event and a timed event crossing midnight. | `calendar/google.ts:79-99`, `core/board.ts:28-32` | Low (read path only; no money) |
| 7.2 | **One kind registry.** `calendar/semantics.ts` becomes `KIND_REGISTRY: Record<BoardKind, { glyph, label, token, layer }>` — the glyph, the user word, the colour token name and which toggle layer it belongs to. Fix the collisions: `event` gets `◆`, `work-tip` gets `✦`, `other` keeps `○`. `visibility.ts` and the legend both derive from it. | `calendar/semantics.ts`, `calendar/visibility.ts` | Low |
| 7.3 | **`--kind-*` tokens in `sceneTokens()`**, derived per scene so they sit on every Taylor and Newfoundland background including the two dark scenes (`reputation`, `george-street`), and reserved away from the posted/scheduled axis: bills stop using `--copper`. Nine hues max (bill, pay, subscription, planned, work, visit, owed, event, google/suggested muted). Contrast-checked against each scene's paper. | `theme/scenes.ts:95-131`, `worlds.css:70-133` | Low–Medium |
| 7.4 | **Three-carrier chip.** Delete the dead hexes (`styles.css:1734-1743`, `1756-1762`, `.dots` `1706-1716`), style `.cal-kind`, and let hue reach the chip at a specificity above `worlds.css:1190` — glyph in the kind hue, 3px solid edge, ink title. Solid/dashed stays reserved for certainty (Google/suggested stay dashed/dotted). Forced-colors block extended. | `worlds.css:1190-1216`, `calendar-boards.css` | Low |
| 7.5 | **Connected multi-day spans without touching the grid.** `BoardItem` gains `span?: { index, length }` from the existing fan-out; chips at index 0 keep the title and a rounded left end, middle chips are a bar with no text (title in `aria-label`), the last chip has a rounded right end; same hue across the run. Reads as one event across cells with zero grid changes, which is what "without breaking the UX we have now" asks for. | `core/board.ts:303-306`, `Calendar.tsx:541-544`, `calendar-boards.css` | Low–Medium |
| 7.6 | **One `<KindLegend>` component** from the registry: swatch + glyph + word, only the kinds present this month, rendered only on the calendar pane, as a labelled `<section>`; each swatch is also the toggle (legend *is* the filter). Reused on `CalendarDesk` (Home) and `Appointments`. Drop the "colours reflect people" sentence until 7.7 lands. | new `src/calendar/KindLegend.tsx`, `Calendar.tsx:456-467`, `ux-readability.css:1-25` | Low |
| 7.7 | **Draw the member colour that's already there** — a 6px dot at the chip's right end on shared surfaces only, from `memberColor`. Then the legend sentence becomes true. | `Calendar.tsx:302,541`, `Register.tsx:71-97` (share the swatch) | Low |
| 7.8 | **Heat gets a non-colour carrier**: style `.hot`, and the day `aria-label` says "heavy day" with the total. | `Calendar.tsx:503,513,536` | Low |

**Acceptance:** every one of the 15 kinds is distinguishable by glyph *and* edge *and* hue in all three themes on light and dark scenes (evidence at 320/390/720/1100); a 3-day Google event shows on all three days and reads as one run; the legend lists exactly the kinds on screen and toggling a swatch hides that kind; posted/scheduled ink/copper untouched (`CalendarWeight` legend unchanged); no chip depends on colour alone (glyph + edge remain); `CALENDAR_KINDS` finally has a test.

### Where I'd push back

*"Needs more colour."* Nine kinds is the ceiling before colour stops helping — beyond that people can't hold the mapping, and Taylor's scenes already spend a lot of hue on mood. So the plan differentiates by **kind**, not by category or amount, and lets the *glyph* carry the finer distinctions (pay vs tips). Colour on Add and Books can follow the same tokens later; this slice keeps it where the complaint is — the calendar and the Home calendar widget.

---

## Doing all three

**Order:** 7 → 6 → 5 for the implementation slice, which is close to the inverse of urgency and I think right: row 7 is bounded to one page, has a real bug in it, and its registry is the *thing row 6 needs* (one place where a kind's word lives) and the thing row 5's calendar-density fix needs (legend = filter collapses two control groups into one). Row 6.1–6.3 then lands on the surfaces row 7 just touched. Row 5.1/5.2/5.5 are tiny and already decided; they can ride along.

**What ties them together:** one registry of *what a thing is* (glyph, word, colour, layer) so that the calendar, its legend, its filters, its widgets and its copy all agree — instead of today's four legends, three tab vocabularies and fifteen kinds mapped to ten toggles.

**Risk:** every step is UI or a read-path fix. Nothing changes posting, sync, schema, Auth/RLS or Hercules payloads. The largest risk is 7.1 (Google end-date) — a read path, but one that changes what appears on the calendar; it gets its own focused test. Three authored themes are required for 7.3–7.6, 6.1 and 5.3 — that is the bulk of the effort, not the logic.

**Dual Course deltas** (weight 5 books / 3 engagement): Row 7 — budget +3 (the calendar becomes readable at a glance; a data-loss bug is fixed), engagement +2. Row 6 — budget +2, engagement +3 (the app stops lecturing). Row 5 — budget +2, engagement +3 (Bianca's urgency-10 item; fewer routes, fewer decisions per screen).

**Decisions I need from you** (asked alongside this plan):

1. **Row 5 — no beginner mode?** I recommend fixing the default (5.1–5.6) and, only if still needed, extending the existing *Quiet* comfort setting to hide secondary instruments. Alternative: a real Simple/Everything toggle in Comfort.
2. **Row 6 — where do explanations go?** Recommendation: the `?`/"Why" aside, remembered per device. Alternatives: `aria-description` only (nothing visible), or a single Help page in the Status Centre that all "Why" links point to.
3. **The implementation slice.** My recommendation is **Calendar clarity**: 7.1–7.6 + 6.3 (Calendar's six paragraphs) + 5.1/5.2 — one PR, one page fully done in three themes, two accepted V2 decisions landed. Alternatives are listed in the question.
