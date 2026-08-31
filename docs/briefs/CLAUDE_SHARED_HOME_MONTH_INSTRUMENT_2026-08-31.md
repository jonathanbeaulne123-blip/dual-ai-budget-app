# Claude design packet — Shared Home month instrument (selling screenshot)

**Use this in a new Claude chat. Do not continue a Cursor implementation thread. Do not write production code in that chat.**

## Which AI, and why

**Claude** (UX / Hercules / visual / Dual Course engagement lead). Prefer the strongest available Claude with extended thinking.

Not Codex/GPT: Codex already has a merge packet that **must not restyle** the desk. This prompt is the opposite job — invent a **grander center instrument** that still belongs on that desk. Cursor will execute after Jonathan confirms.

Not a rubber-stamp review. If the answer is “Cursor’s five-card stack is enough,” it failed.

---

## How to run it

1. New Claude chat. Paste the fenced prompt below in full.
2. Attach, or paste, at least:
   - This file
   - `src/SharedLedgerStory.tsx`
   - `src/core/sharedLedgerStory.ts`
   - `src/OfficeWide.tsx` (desk + Change notebook)
   - `src/office-wide.css`
   - `src/core/sitDownInfographics.ts`
   - `src/KittyBanks.tsx` (right column — do not duplicate it)
   - `docs/HEARTH_UI_THEME.md`
   - `docs/DECISIONS.md` rows D-048, D-156, D-161, D-164, D-165
   - Jonathan’s laptop screenshot of Shared Home (seals + mosaic + Change stage + Kitty Banks) if available
3. Optional: draft PR https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244
4. Do **not** paste `.env`, Worker secrets, Google tokens, workbook exports, or real household rows. Demo/synthetic Development only.

Related: [`AI_HANDOFF.md`](../AI_HANDOFF.md) · [`HEARTH_UI_THEME.md`](../HEARTH_UI_THEME.md) · [`worksessions/2026-08-29-kitchen-desk-banks.md`](../worksessions/2026-08-29-kitchen-desk-banks.md)

## Exact git facts (packet time)

- Repo: `jonathanbeaulne123-blip/dual-ai-budget-app`
- Branch: `cursor/shared-ledger-story-aef7`
- Head: `2daa114de057594509618ffef3a61edef194891d`
- UX implementation: `ed708dc` (kitchen desk). Docs packet after that.
- Draft PR [#244](https://github.com/jonathanbeaulne123-blip/dual-ai-budget-app/pull/244) — **not merged, not deployed, not live**
- Risk: **High** presentation; **no** new Fund math
- Decision owner: Jonathan
- Next implementer: Cursor, only after Jonathan confirms the design

---

Paste everything inside the fence:

```text
You are Claude, Hearth’s UX / Hercules / visual design lead. You are NOT the implementer. Return a grander design that Cursor can execute. Do not write a patch. Do not merge, deploy, apply schema, change secrets, or rebase.

Think bigger than a card pager. Jonathan said Cursor’s swipe-stack idea is OK but we need MORE. If you only polish the eight $0.00 tiles into five swipe cards with paper bars, you failed the brief.

# Product (one paragraph)

Hearth is Dual Course: family-office books weigh 5; Hercules and interactables weigh 3. When they conflict, the books win. CAD is integer cents. Books civil dates stay America/Toronto. Only visible Confirm posts money. Widgets, weather, cosmetics, and Hercules never postEntry. The Household Fund (D-161) is a virtual shared operating subledger over Bianca’s savings; Hearth cannot move the money. Persistent custody sentence: “The money remains in Bianca’s savings. Hearth cannot move it.” Shared Ledger is the household table. Personal Ledger is a private folio, not Shared with a filter (D-164). Shared is one pool; Kitty Banks are sub-accounts of that pool, existing shared goals, not a new envelope (kitchen-desk law on this branch). Home seals are posted Money in, posted expenses Money out, leftover spend (in − out). Sit-down leftover (leftoverProjection) is a different number. Fund free-to-spend is a third number. Never share labels.

# Authority (in order)

1. Jonathan’s latest explicit instruction (this prompt + the selling Home screenshot).
2. AGENTS.md, docs/DECISIONS.md (D-048, D-156, D-161, D-164, kitchen-desk D-165 on this branch), docs/HEARTH_UI_THEME.md, docs/STRATEGY.md.
3. Current code on cursor/shared-ledger-story-aef7 @ 2daa114 — not docs/nostalgia/ or docs/reference/.

# Jonathan’s words (do not omit)

Shared Home at laptop width is “the money maker” and “the foundation for the screenshot that will sell the app.” Still super rough.

The selected center object is article.ledger-story-sheet.ledger-story-month — kicker NEXT, title This month, eight equal stats: Opening operating, Confirmed contributions, Purchases, Refunds, Clearing, Safe rollover, Closing operating, Kitty — all $0.00 in the empty demo. Aria: “This month’s household arc.”

He wants this widget to become a fun tracking widget. The middle stage should be a SMART STACK that is SWIPABLE (Draft B paper-stack swipe), not a long vertical scroll. Infographics instead of just numbers. Fully expand the idea. Cursor asked questions; he then said think bigger with you.

Open-to feeling: this kind of information is what the app should open onto.

# Exact git facts

- Branch: cursor/shared-ledger-story-aef7 @ 2daa114
- Draft PR #244 — not merged, not deployed, not live
- Desk: three columns at >=900px (seals / mosaic / stage / banks). 720–899 stacks. Do not “fix” the breakpoint.
- iPhone OfficePhone mosaic structure is fenced. Seal labels already match. Do not port this instrument onto the phone unless you explicitly argue Dual Course and Jonathan still has to confirm.

# What is already on the desk (do not replace the room)

LEFT mosaic — Today’s stories: Now/Kitty Banks, Attention, Change, Wallet, Mail, Claims.
CENTER stage — Change notebook: “This week” empty line + the eight-tile month sheet. Hercules loafs on the furniture with a grocery bag and a ! badge.
RIGHT — Kitty Banks copy + empty shelf + Customize on Plan. Fat SVG PaperBank lives here when banks exist.
TOP — wax seals: Money in, Money out, Leftover spend.
BOTTOM — Home · Cal · + · Plan · More. + must stay uncovered.

Existing projectors you MUST reuse, not reinvent:
- sharedMonthlyArc / fundFlowDiagram / sharedWeeklyStory / sharedActionQueue in src/core/sharedLedgerStory.ts
- projectHouseholdFund (D-161). Conservation: operating + kitty. Connectors are arithmetic direction; they do not move banks.
- sitDownInfographicDeck paper bars (already used on Plan). Do not fork a Chart.js dashboard.
- kittyBanksInView / kittyBankStep (right column). Do not build a second pig shelf in the center.

# Cursor’s floor idea (keep, reshape, or refuse — do not stop here)

Cursor proposed a smart paper stack in the Change stage:
- Mechanic: Draft B swipe, one sheet facing, rest peeking, snap, dots/edge, keyboard + reduced-motion Previous/Next.
- Smart top card: waiting ticket > this-week stamps > month river > empty ghost river.
- Cards: This week stamps; This month river (the eight facts as ONE blotter, not eight boxes); Target bar; Waiting (one ticket); Trust footer.
- Empty month must photograph (ghost river, not eight zeros).
- Taps glance or open Fund/Confirm; widgets never post.
- Do not duplicate seals or Kitty Banks. Do not mix leftover spend into the Fund river.

Jonathan: that idea is OK. We need MORE. Your job is the MORE: a center instrument worthy of the selling screenshot — tactile, memorable, household, slightly magical — still paper Hearth, still true books.

# Feel lock (do not leave this kitchen)

Warm Toronto kitchen-table office: cream paper, pine and copper, rain on the glass, Maine Coon on the furniture. Figtree body, Fraunces money/titles, sentence-case finance words. Wax seals, paper tiles, notebook, fat banks.

Forbidden: glassmorphism, neon fintech, SaaS dashboard widget grid, Bloomberg terminal, game HUD, shame meter, hunger bar, partner ranking, streak-as-money, invented CAD, second theme, covering +.

Rivals to steal ROOM energy from, never money meaning from: Finch / Tamagotchi / Pokémon Sleep (companion presence without pay-to-live); Apple Wallet / Draft B (stack you touch); Copilot Money / Monzo (objects not spreadsheets); Notion / Linear only for calm density — not their chrome. Mint/YNAB reports are what this must NOT become.

# Think grander along these axes (you may add more)

1. PHYSICAL METAPHOR. The eight numbers are one conservation story. Make it a thing on the desk: blotter, ink well, stamp album, recipe-card box, monthly letter, household almanac. Name it. Cursor’s “river” is one metaphor, not the only one.

2. TIME YOU CAN TOUCH. Week stamps, month arc, maybe last month vs this month as another sheet in the same stack. Calendar overlay stays outlook; this stack is Fund events + projections already in sharedLedgerStory.

3. TRACKING THAT FEELS ALIVE. Fill, pour, stamp, perch — motion that teaches conservation. Reduced motion: static paper, no FOMO animation. Empty must still look like a product.

4. HERCULES AS SCENERY ON THIS INSTRUMENT. He already sits on Money out with a bag. Give him perch rects on the facing sheet (shortfall, kitty pour, waiting ticket). He never posts, never blocks +.

5. HOUSEHOLD, NOT DASHBOARD. Two people at one table. Do not rank Jonathan vs Bianca with competing bars. Actor labels on stamps are OK. Attention is “who needs to do what,” not a score.

6. OPEN-TO DEFAULT. What faces you when Shared Home loads at ~1100px? Argue it. Cursor guessed Change/month as the selling default.

7. DEPTH WITHOUT BLOAT. One instrument, several sheets. Not six new mosaic tiles. Not a widget store.

8. PERSONAL. This instrument is Shared. Say what Personal Home’s center does instead (Books floor already exists). Do not clone the Fund album onto Personal.

# Laws you may not break

- No new Fund formulas. No leftover spend inside this widget. No calling Fund free-to-spend “safe to spend” globally.
- Confirm still posts. D-172 collection cannot write money (out of scope here).
- Partner-personal never appears. Coworker names never appear. Evidence/Shift envelopes never appear on Home.
- Do not dump household journal into scopedHousehold.
- Do not restyle seals, mosaic tile grammar, Kitty Banks shelf, Drawer gold, weather-in-glass, or OfficePhone.
- Wide 3-column only at >=900px.

# Return shape (mandatory)

Write for Cursor. No hidden chat context.

1. Household outcome in one paragraph (what Jonathan and Bianca feel when Shared Home opens).
2. Keep / reshape / refuse of Cursor’s smart stack, with Dual Course why.
3. Name the instrument. One sentence selling it.
4. The grander design: physical metaphor, open-to default, every sheet in the stack (job, CAD source from EXISTING projectors, empty state, tap). If you add a sheet, name the exact function it reads.
5. Selling-frame mock at ~1100px (ASCII or structured layout). Include seals, mosaic, facing sheet, peeking stack, Kitty Banks, Hercules, +.
6. Empty-month selling state (must photograph).
7. Mid-month state with fictional Development Fund events (invented demo cents OK in the mock; implementation must use projectors).
8. Motion: swipe, snap, keyboard, reduced motion, focus. 44px targets.
9. Hercules perch rules.
10. Dual Course: Budget delta (5), Engagement delta (3), what you would cut if they conflict.
11. Kill criteria (when the design has gone too far).
12. Out of scope list.
13. Cursor execution slices (small, ordered). Slice 1 must be possible without new math.
14. Questions for Jonathan ONLY if they change money, privacy, or Auth. Design questions: settle them yourself and write the why.

If you are tempted to add a chart library, a fourth Home column, a phone redesign, or a new envelope: refuse it in public and choose the paper object instead.
```
