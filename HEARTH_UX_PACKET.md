# Hearth — UX Implementation Packet
### Companion to `HEARTH_BUILD_MANUAL.md` · for Cursor

**Read this before any slice that renders a pixel.** The manual says *what to build and in what order*. This packet says *what it looks like, what it says, and how it behaves*. Where they overlap, they agree; where this packet is more specific, this packet wins.

**Visual reference:** `hearth-ux-plates.html` ships beside this file. Open it. Every screen in section 6 is drawn there at its true device width. When a description here and the plate disagree, **the plate is the intent** — read its markup, it is the closest thing to a reference implementation.

---

## 1 · Precedence

1. Jonathan's latest explicit instruction.
2. This packet and `HEARTH_BUILD_MANUAL.md`.
3. Existing code and tokens (`src/styles.css`, `src/office.css`, `src/hearth-theme.css`).
4. Your judgment — used to fill gaps, never to substitute a different idea.

**If a slice cannot be built as specified, stop and say so.** Do not ship a near-miss and describe it as done.

---

## 2 · The surface

Hearth is **paper under a desk lamp**. Warm, matte, printed. Ink on stock, not glass on black.

**There is no dark mode.** The app is a single committed light surface. `--room-dim` and `--room-cool` are evening ambience on the office scene, not a theme. **Do not add `prefers-color-scheme` handling, a theme toggle, or a dark palette to anything in these slices.**

Three rules that carry the whole aesthetic:

- **Rules, not shadows.** Structure comes from 1px `--line` rules and generous space. `--lift-1` and `--lift-2` are for things that genuinely float (a picked-up plate, the CAD pad). A card does not need a shadow to be a card.
- **Ink is the only near-black.** Never `#000`. Never pure white — `--card` is the lightest surface.
- **Colour is semantic, never decorative.** Pine, copper, brass and gold mean something specific (§3.2). If a colour isn't carrying meaning, it's `--ink`, `--muted`, or `--line`.

---

## 3 · Tokens

### 3.1 Existing — use these, do not redefine

```
--paper #f3eee4   --paper-2 #ebe4d6   --card #fffaf2
--ink #1b1712     --muted #6b6258     --line #d8cfc0
--pine #2c6a4e    --pine-2 #1f4d39    --copper #c45c26
--gold #c9a227    --felt #7b5e3b      --brass #b08d57
--danger #9b2c2c  --good #2c6a4e
--display "Fraunces", Georgia, serif
--font    "Figtree", sans-serif
--lift-0 / --lift-1 / --lift-2
--nav 76px
```

### 3.2 New semantic tokens — define once, in `src/register.css`, then reuse

```css
--reg-hers:     var(--pine);                                    /* Bianca's money */
--reg-his:      var(--copper);                                  /* Jonathan's money */
--reg-carried:  color-mix(in srgb, var(--felt) 40%, var(--line)); /* balance carried in */
--reg-unfunded: var(--copper);                                  /* used as a 1px dashed outline, never a fill */
--ask-figure:   var(--copper);
--tick:         var(--felt);                                    /* payday ticks — timing only */
```

**No hex literals in any new CSS.** Everything derives from the tokens above with `color-mix`. This is enforced by review.

### 3.3 What each colour is allowed to mean

| Token | Means | Never used for |
|---|---|---|
| `--pine` | Bianca's money · agreed · confirmed · focus ring | decoration, "success" toasts |
| `--copper` | Jonathan's money · the ask · unfunded · section numerals | error, warning, danger |
| `--felt` / `--brass` | fixed structure — payday ticks, rules, the Kitty | any member's money |
| `--gold` | a goal | a balance |
| `--danger` | a genuine destructive confirmation only | a shortfall, an unsigned line, a held motion |

**A shortfall is not an error.** Nothing about the Ask, an unfunded row, or an unsigned signature line may use `--danger`, an amber, a warning triangle, or a badge.

---

## 4 · Type and space

### 4.1 Type scale — stay on it

| Role | Family | Size / line | Weight | Notes |
|---|---|---|---|---|
| Figure | display | 44–72px / 0.94 | 600 | `font-variant-numeric: tabular-nums`, `letter-spacing:-.028em` |
| Page title | display | 27–38px / 1.12 | 600 | `text-wrap: balance` |
| Section | display | 19–21px / 1.25 | 600 | |
| Body | font | 16.5px / 1.62 | 400 | max 64ch |
| Body small | font | 14.5px / 1.5 | 400 | secondary lines, captions |
| Row label | font | 12.5–13px / 1.3 | 400/600 | register and list rows |
| Utility label | font | 10.5–11px | 500 | `letter-spacing:.13em`, uppercase, `--muted` |
| Data | font, tabular | 11–14px | 400/600 | **always `tabular-nums`** wherever digits stack |

Money always renders with two decimals and a thousands separator: `$1,450.00`. Never `$1450` and never `1.45k`.

### 4.2 Spacing — 4px base

`4 · 8 · 12 · 16 · 20 · 26 · 34 · 44 · 56 · 72`. Nothing between these. Sibling groups use flex/grid `gap`, not per-element margins.

### 4.3 Radius and borders

`3px` chips and tags · `5px` cards and plates · `999px` only on a true pill. Borders are always `1px solid var(--line)`. No 2px borders. No `rounded-2xl` softness anywhere — this is printed stock.

---

## 5 · Layout kernel

**One kernel, two branches** (existing law — do not break it):

- **< 720px — the phone.** Glance plus one tap. One column. `--nav` bottom bar. Nothing important below the fold. Primary action reachable with a thumb.
- **≥ 720px — the office.** The customizable desk. Plates, stage, drawers.

**Required evidence breakpoints: 320 · 390 · 720 · ~1100.** 320 is not optional — it is where text wraps break.

**Touch targets: 44 × 44 minimum**, including the `see everything` door and every `sign` link.

**Focus:** `outline: 2px solid var(--pine); outline-offset: 2px`. Never `outline: none` without a replacement of equal or better visibility.

---

## 6 · Screens

Each screen below gives: **anatomy** (top to bottom) · **copy** (literal) · **states** · **behaviour**. Plates in `hearth-ux-plates.html`.

---

### 6.1 The founding conversation — *Charter slice 3*

**Frame:** full-screen takeover, one question per screen, no nav bar, no progress percentage.

**Anatomy**
1. Step rail — five small marks, current one filled `--ink`, rest `--line`. **No "Step 2 of 5" text, no percentage.**
2. The question — display face, page-title size, `text-wrap: balance`.
3. The sub-line — body small, `--muted`, one sentence.
4. The input — see per-question below.
5. Footer row: `decide this later` (text link, left) · `Next` (primary, right).

**Q1 — purpose.** Textarea, 3 rows, no character counter until 200 chars, then a quiet count.
> **"What is this money for?"**
> *"One or two sentences. It goes at the top of the page and it settles most arguments before they start."*

**Q2 — the split.** Three stacked cards, each with a heading and one line of body. Selected card gets a 1px `--pine` border and a pine tick — **not a fill, not a shadow**. Below the cards, a textarea labelled `in your own words` → `splitNote`.
> **"How do we decide who puts in what?"**
> · **Evenly** — *"We each put in half of what the house costs."*
> · **By what we each earn** — *"We each put in a share that matches our income."*
> · **One of us covers what's left** — *"Bianca's pay covers what it covers. Jonathan closes the rest by picking up shifts."*

**Q3 — permissions.** A list of plain sentences with an `+ add` row. One suggestion pre-filled and visibly editable:
> **"What needs both of us, and what can either of us just do?"**
> pre-filled: *"Bianca can spend from the Fund on anything we've already agreed is a household bill."*

**Q4 — cadence.** Four options: `Weekly` · `Every other week` · `Monthly` · **`We don't yet`**. If weekly or biweekly, a weekday row appears.
> **"When do we sit down?"**

**Q5 — the ceiling.** Framed as protection.
> **"How much work is too much?"**
> *"If closing a month would take more than this, Hearth stops offering shifts and offers to move a goal instead."*
> `Hours a week` [number] · `Dollars a month` [CAD pad] · `No ceiling yet`

**Closing screen**
> **"That's your charter."**
> *"You can sign it now or later. It works either way."*
> `Sign it` · `Later`

**States**
- **Skipped step** — leaves the field empty, flow continues, no warning, no red.
- **Resume** — reopening lands on the first unanswered question with prior answers intact.
- **Founded alone** — closing screen never mentions the other person's absence.

**Behaviour**
- Enter advances. Escape does nothing (no accidental exit).
- Full keyboard path, tested at 320px.
- **Not one dollar figure, chart, or balance appears anywhere in this flow.**

---

### 6.2 The charter page — *Charter slice 4*

**Anatomy**
1. **Purpose** — display face, 27–38px, at the top, no label above it. It is the masthead.
2. `— · —` rule.
3. **The custodian line** — body: *"{Name} holds the money."*
4. **The split** — the rule's name in display 19px, then `splitNote` in body italic, quoted.
5. **What either of us can do** — permissions as plain sentences, each with a quiet `revoke` visible only to its granter.
6. **The ceiling** — one line, `charterCeilingLabel()`.
7. **When we sit down** — one line.
8. **Clauses** — heading + body pairs.
9. **The signature block** — see below.
10. **Amendments** — newest first, each: who raised it, what changed, who confirmed or held, when.

**The signature block — the most carefully designed thing on this page**

```
  ______________________________          ______________________________
  Bianca · 24 Aug 2026                    Jonathan
```

- Both lines are **identical**: same 260px `--line` rule, same gap, same 12px name below.
- A signed line adds the date after the name, in `--muted`.
- An unsigned line adds **nothing**. No badge. No amber. No "pending". No "awaiting signature". No count in the nav.
- If the viewer is the unsigned member, one quiet 13px `--pine` text link `sign` sits to the right of their own line. **If the viewer is the other member, there is nothing at all.**

**Forbidden on this page:** any badge, dot, count, warning colour, "action required", nudge, reminder, or notification tied to an unsigned line. This restraint is the feature.

---

### 6.3 The register — *Register & Ask slice 8*

**Anatomy** (the drawing, `REGISTER_VIEW` geometry from the manual)

| Column | x | Content |
|---|---|---|
| label | 0 | obligation name, 12.5px `--ink` |
| date | 152 | `04 sep`, utility label, `--muted` |
| bar | 250 → 810 | segments, 13px tall |
| amount | → 890 | tabular, right-aligned |

- **One shared scale across every row.** A $128 bar and a $1,450 bar are comparable. This is the whole point of the drawing.
- Segments in **arrival order**: `--reg-carried`, then `--reg-hers` / `--reg-his` interleaved by date.
- **Unfunded**: no fill, 1px `--reg-unfunded` dashed outline, `stroke-dasharray: 3 2`.
- Legend, top right: four swatches — `carried` · `Bianca` · `Jonathan` · `not yet`.
- Below a `--line` rule: **the month owes** (bold, tabular), then each member's total, then carried in. Each with its swatch.

**Absolutely forbidden:** any percentage, any ratio, any "you covered X%", any member-vs-member bar, any pie chart, any leaderboard. `%` may not appear in a data-bearing string on this screen.

**States**
- `tiesToProjection === false` → render an **empty staff** — the rules and columns with no bars — plus: *"These rows don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing."*
- Empty month → the staff plus *"Nothing owed this month yet."*
- Mobile (< 720): the drawing scrolls horizontally **inside its own container**; the page body never scrolls sideways. Below it, the same data repeats as a plain list so the phone is never dependent on the drawing.

---

### 6.4 The Ask panel — *Register & Ask slice 9*

**Placement: Jonathan's desk only.** This panel must never render on the custodian's default surface.

**Anatomy**
1. **The figure** — `$340.00`, display 44–72px, `--ask-figure`, tabular. Alone on its line.
2. **The sentence** — body 17px: *"September still needs $340.00."*
3. **The secondary line** — body small `--muted`: *"$180.00 of that lands before the 18th."*
4. **The routes drawing** — see below.
5. **The other door** — always visible, never behind a toggle.
6. **The caveat** — when confidence ≠ settled.

**The routes drawing**

- Header, utility label: *"bars are your safe number · whiskers reach the good night"*
- One row per route. Left column: route name (13px) and, under it, `15.5 hours · 2 nights` (utility label).
- Bar = the **safe** (p10) total, split into one segment per shift with descending opacity so the shifts are countable.
- Whisker = a 1px line from the safe end to the **expected** (p50) total, with a 12px end cap.
- A dashed vertical `--copper` line marks the ask, labelled below: `$340 · the ask`.
- Right column: `clears · $18 spare` (pine) or `short $52` (copper).
- A route that does not clear at safe uses `--copper` bars instead of pine.

**The other door**
> **"Or move Halifax to next month, and the ask is $40.00."** → `Raise it` (opens a motion)

Shown **every time**, at every ask size. Not a disclosure, not an "advanced option".

**States**
- **Covered** — figure reads `$0.00` in `--pine`, sentence *"September is covered."*, routes and other door hidden.
- **not-enough-data** — the figure and sentence stay; the routes drawing is replaced by one line: *"I've only watched 4 of your shifts. Ask me again in a few weeks — I'd be guessing."* **The panel is not hidden.**
- **watching** (run-rate) — appended caveat: *"— though I've only watched 3 weeks of this house."*

**Forbidden copy anywhere on this panel:** `you should`, `you need to`, `pick up a shift`, `required`, `target`, `goal met`, any imperative verb aimed at the reader, any progress ring, any streak, any celebration.

---

### 6.5 The Till — *Till slice 3*

**Bianca's surface. Craft here must be at least as good as the desk's. It must never read as a smaller app.**

**Anatomy at 390px, in this exact order**

1. **The swipe button** — full width, 96px tall, `--card` on `--paper`, 1px `--line`, `--lift-1`. Label in display 21px: **"I spent something"**. It is the largest thing on the screen and it is above everything else.
2. **Waiting on you** — motion cards, only when there are any. **When empty this section does not exist** — no zero-state card, no "0 items", no placeholder.
3. **The standing line** — 14.5px `--muted`, centred: *"Nothing has moved."* Always present.
4. **This month** — one line, no chart: *"The house has spent $2,735.00 so far."*
5. **The door** — at the foot, 13px `--pine` text link, underlined on hover/focus: **`see everything`**. Permanent, always in the same place, no icon, no chevron, no settings screen, no confirm dialog.

**The motion card** (used here and on the desk)

```
┌────────────────────────────────────────┐
│ Jonathan · contribution      $310.00   │  ← name/kind left, figure right, tabular
│ 06 sep · "for the rent"                │  ← date + note, 13px --muted
│                                        │
│ [ Confirm ]        [ Hold ]            │  ← pine solid · outline, both 44px tall
└────────────────────────────────────────┘
```

- `Confirm` is `--pine` filled. `Hold` is a `--line` outline button, **equal size and equal prominence**. Hold is never smaller, never a text link, never behind an overflow menu.
- After holding: the card stays, and gains one line — *"Held — let's talk about this."* — with a `release` link. **The card does not disappear and does not turn red.**

**States**
- **Empty household** — the swipe button, the standing line, and: *"Nothing yet. When you spend on the house, tap the button and I'll write it down."* Closeable in four seconds.
- **Offline** — a single 13px `--muted` line under the standing line: *"Saved here. It'll sync when you're back."* No banner, no modal, no blocking.

**Forbidden on the Till:** the Ask, any route, any hours figure, anything about Jonathan's workload, any chart, any "lite"/"simple"/"basic" wording, any upsell to the full app. `Till.tsx` must not import `Ask` or `askRoutes`.

---

### 6.6 The swipe — *Till slice 2*

**Two taps. Ten seconds. Standing at a counter. One hand.**

**Step 1 — amount.** The existing CAD pad, opened focused, full-height on phone.
> title: **"What did you just spend?"**

**Step 2 — where.** A 2×3 grid of the six categories she has actually used most this month, drawn from real history, plus a seventh `More` cell. Cells are 72px tall, 1px `--line`, `--card`. Tapping a cell **posts immediately** — there is no third confirm step.

**After posting**
- The sheet closes to a 10-second inline strip at the top of the Till: **"Posted. Nothing moved."** with `Undo`.
- The strip fades out after 10s. Reduced-motion: it appears and disappears without transition.

**Rules**
- **No camera, no receipt image, no OCR, no attachment.** Out of scope; do not add an affordance for it "for later".
- Categories are **observed, never configured.** No setup screen, no editing.
- The whole flow works one-handed at 390px and completes at 320px.

---

### 6.7 The weekly — *Clerk slice 4*

A **document that fills in over hours**, not a meeting. Reuse the existing `SitDownSession` acts machinery — do not build a parallel ritual system.

**Anatomy**
- **Act 0 · The reading** — 3–4 sentences, body 16.5px. Each sentence is a focusable control; activating it reveals its rows inline beneath (never a modal on phone). Affordance: a 1px dotted `--line` underline, and on focus/hover a 13px `--muted` label: *"the rows this came from"*.
- **Act 1 · The month so far** — the register.
- **Act 2 · The ask** — **only for the member whose ask it is.** For the other member, Act 2 shows the number and any motions raised, and **no route and no hours figure**.
- **Act 3 · What we're doing** — motions raised here.

**It completes unsigned.** One person reads, places and stamps; the other's line stays blank. Never blocked, never nagged, no reminder.

If the charter's cadence is `none`, **no weekly is offered at all.** Do not prompt for one.

---

### 6.8 The metronome — *Register & Ask slice 10*

On the Month Spread's Course axis: a **3px vertical rule in `--tick`**, below the axis line, at each of the custodian's projected pay dates. Only the first is labelled, utility label: `payday`.

- **Ticks carry no amount, no height, no value.** Her contribution amount varies; the drawing must not imply a constant.
- Contribution marks keep their existing treatment. The contrast — regular tick versus irregular mark — *is* the information.
- Do not touch `courseScale`, `courseTop`, `courseBottom`, or any existing month-spread assertion.

---

## 7 · States — every screen ships all of these

| State | Rule |
|---|---|
| **Empty** | Designed, never a spinner or a blank. Says what will fill it, in one line. |
| **Loading** | Skeleton rules at the real geometry. Never a spinner over a full page. |
| **Error** | What went wrong and what to do. No apology, no stack, no `--danger` unless something was genuinely destroyed. |
| **Offline** | One quiet line. Never blocks a write. Everything queues and replays. |
| **Doesn't tie** | Shows nothing rather than something wrong, and says which. |
| **Not enough data** | Names how much was watched and declines. Never guesses. |
| **Reduced motion** | All transitions removed, all content still reachable. |

---

## 8 · Motion

- Default transition: `160ms` `cubic-bezier(.2,.6,.2,1)`. Nothing longer than `240ms`.
- Movable things (plates, the pad) may use `--lift-1` → `--lift-2` on pick-up. Nothing else animates elevation.
- **No** parallax, spring, confetti, count-up numbers, progress-ring fill, or celebration of any kind. A covered month is a quiet `$0.00`, not a party.
- `@media (prefers-reduced-motion: reduce)` removes every transition and animation. Test it.

---

## 9 · Accessibility — non-negotiable

- Full keyboard path through every flow, verified at 320px.
- Visible focus everywhere: `2px solid var(--pine)`, offset 2.
- Every drawing has a text equivalent. The register repeats as a list on phone. The routes drawing has a `role="img"` with an `aria-label` naming the ask and the top route.
- Colour is never the only carrier: unfunded is **dashed**, not just copper; the selected split card has a **tick**, not just a border.
- Contrast ≥ 4.5:1 for body, ≥ 3:1 for large text and UI edges. Check `--muted` on `--paper-2`.
- Buttons are `<button>`, links are `<a>`, and the `see everything` door is a real link.

---

## 10 · Copy deck — use these strings verbatim

| Where | String |
|---|---|
| Founding Q1 | `What is this money for?` |
| Founding Q2 | `How do we decide who puts in what?` |
| Founding Q2c | `One of us covers what's left` |
| Founding Q3 | `What needs both of us, and what can either of us just do?` |
| Founding Q4 | `When do we sit down?` |
| Founding Q5 | `How much work is too much?` |
| Founding close | `That's your charter.` |
| Charter sign link | `sign` |
| Amendment refusal | `An amendment needs the other person to agree.` |
| Sign refusal | `You can only sign your own line.` |
| Permission refusal | `You can only give away your own confirm.` |
| Custody refusal | `Custody moves through the Fund, not the charter.` |
| Hold button | `Hold` |
| After hold | `Held — let's talk about this.` |
| Hold note placeholder | `What would you want to know first?` |
| Hold in record | `{Name} held this on {date}.` |
| Register doesn't tie | `These rows don't tie to the ledger yet. I'd rather show you nothing than show you the wrong thing.` |
| Ask | `September still needs {amount}.` |
| Ask secondary | `{amount} of that lands before the {n}th.` |
| Ask covered | `September is covered.` |
| Ask watching | `September still needs {amount} — though I've only watched {n} weeks of this house.` |
| Routes header | `bars are your safe number · whiskers reach the good night` |
| Route clears | `clears · {amount} spare` |
| Route short | `short {amount}` |
| Routes refusal | `I've only watched {n} of your shifts. Ask me again in a few weeks — I'd be guessing.` |
| Other door | `Or move {goal} to next month, and the ask is {amount}.` |
| Run rate watching | `Three weeks in, I'll have a first read on what the house costs. Right now I've watched {n}.` |
| Run rate provisional | `On {n} weeks, the house looks like about {mid} a month — somewhere between {low} and {high}. Ask me again at the end of the month.` |
| Run rate settled | `The house has run about {mid} a month across {n} weeks.` |
| Purchase refusal | `Only the person holding the card can post a household purchase.` |
| Swipe title | `What did you just spend?` |
| Swipe posted | `Posted. Nothing moved.` |
| Swipe undo | `Undo` |
| Till standing line | `Nothing has moved.` |
| Till door | `see everything` |
| Till empty | `Nothing yet. When you spend on the house, tap the button and I'll write it down.` |
| Offline | `Saved here. It'll sync when you're back.` |
| Surface refusal | `Only you can choose where you land.` |
| Clerk citation | `the rows this came from` |

**Words that must never appear in the UI:** `governance`, `lite`, `simple mode`, `basic`, `denied`, `rejected`, `declined`, `pending`, `action required`, `overdue`, `you should`, `you need to`, `pick up a shift`, `budget variance`, `on track`, `off track`, `great job`, `oops`, `whoops`.

---

## 11 · Anti-patterns — the mistakes to expect

These are the specific wrong instincts this design will trigger. Each one has broken a version of this product already.

1. **Badging the unsigned signature line.** A dot, a count, an amber tint, "awaiting Bianca". No. It is blank and true, and that restraint is the feature.
2. **Turning the shortfall red.** The Ask is `--copper`, never `--danger`. A shortfall is a work order, not a failure.
3. **Computing a percentage.** "You covered 62% this month" will feel like an obvious addition. It is the single thing this product must never do.
4. **Making the Ask an instruction.** "Work 2 more shifts" instead of "Friday and Saturday clears it." Routes are options laid beside a number.
5. **Making the Till smaller.** Fewer features, thinner type, muted styling, a "switch to full app" upsell. The Till is the *correct* surface for the custodian, not a lesser one.
6. **Adding a third tap to the swipe.** A confirm step, a note field, a category picker with search. Two taps, then it's posted.
7. **Building an earmark as a pot.** A `purpose` that changes which obligation a dollar funds, or creates a second balance. It is a label. Nothing else.
8. **Inventing a dark mode.** There isn't one.
9. **Celebrating.** Confetti, a streak, a count-up, "you did it!". A covered month is a quiet `$0.00`.
10. **Showing Jonathan's hours to Bianca.** Anywhere. Ever.

---

## 12 · Acceptance evidence — attach to every UI PR

- [ ] Screenshots at **320 · 390 · 720 · ~1100**
- [ ] Empty, loading, error, offline, and the slice's refusal state
- [ ] Keyboard-only pass, focus visible in every shot
- [ ] `prefers-reduced-motion: reduce` pass
- [ ] Contrast check on the smallest `--muted` text on `--paper-2`
- [ ] Grep proof: no hex literal in new CSS; no `%` in a data-bearing string on the register; none of §10's forbidden words present
- [ ] `pnpm test` and `pnpm build` green, pre-existing 3 unchanged

---

*Companion to `HEARTH_BUILD_MANUAL.md`. Visual reference: `hearth-ux-plates.html`. Design source: `claude/hearth-two-incomes-2026-09-01.md` and `claude/hearth-charter-month-plan-2026-08-31.md`. All figures synthetic.*

---

## 13 · Onboarding surfaces

*Added 2026-09-02, after the audit. Plates 9–14 in `hearth-ux-plates.html` draw all of these. Where prose and a plate disagree, the plate is the intent.*

### 13.1 The governing idea

**The Hercules chat is not a chatbot and must not look like one.** It is a page Hercules is writing, one chapter at a time — his voice in the display face, the record in the body face.

The single decision that carries it: **Hercules speaks in Fraunces 600 at 22px, and never gets a bubble or an avatar.** Everything else follows. If a reviewer looks at the screen and thinks "messaging app," the implementation is wrong regardless of what the code does.

### 13.2 The shell — exact geometry

All of it becomes exported constants in `src/core/onboarding/shellView.ts`, the way `SWIPE_ACTION_HEIGHT_PX` and `REGISTER_VIEW` already do. **Do not hard-code these in a component.**

```ts
export const SHELL_VIEW = {
  padTop: 22, padSide: 20,
  railMarkWidth: 26, railMarkHeight: 3, railGap: 6,
  railToTurn: 22, turnToHerc: 10, hercToCard: 18,
  cardToAction: 20, actionToFoot: 26,
  navButtonHeight: 48, returnBarHeight: 44, minTouch: 44,
  hercMaxEm: 24,
} as const;
```

Top to bottom: **sitting rail** (3 × 26 × 3px, gap 6, `--line`, current filled `--ink`) · **turn line** (11px, `.13em`, uppercase, `--muted`) · **Hercules line** (display 600, 22px/1.3, max 24em, one or two sentences) · **one card** · **action row** · **foot** (1px rule, then the stop link).

**Three rail marks for three sittings — never twelve for twelve chapters.** Twelve marks read as a progress bar, which is the thing this design refuses to be.

### 13.3 The card — two kinds, one shape

**Task card:** a cap label, one sentence of what needs doing, and a provenance-slot line carrying the honest length (`Four questions · about eight minutes`).

**Evidence card:** a cap label, label/value rows (label 12.5px `--muted` left, value 13px tabular right), and **a provenance line at the foot — not optional.** `From the charter record`. Every evidence card cites where it came from.

### 13.4 The noticed strip

`role="status"`, `aria-live="polite"`, 3px `--pine` left edge, radius `0 5px 5px 0`. Sits **above** the Hercules line. Announces without moving focus. **Never appears twice for the same event** — dedupe on `probeEvidenceKey`.

### 13.5 The return bar

44px, pinned above the nav, `--paper-2`, 1px `--line` top and bottom, a 7px `--copper` dot, 13px text: `Finish here, then open Hercules.`

**It is furniture, not an alert.** No X, no dismiss, no timeout. Only a passing completion probe removes it.

### 13.6 The witness screen

Same shell. Turn line names the partner. **No action row at all** — a witness has nothing to press but the stop link, and a control that would write the conductor's state must not exist. Rows carry a plain status word (`opened`, `waiting`, `submitted`) — never a checkmark, which implies a score. Provenance says what scope is shown (`Shared accounts only`).

### 13.7 The invitation

A card on Home, not a takeover. Home still renders; nothing is blocked and nothing is modal. The honest length is in the card *before* anyone commits. Dismissed with `Not now` it does not return that session.

### 13.8 The handshake

Two devices. The proposer sees who they are waiting for and that nothing has started. The confirmer sees the same explanation, the three sittings with their lengths, and what it costs the other person — before saying yes. **Expiry is a sentence** (`Good for fifteen minutes`), never a clock.

### 13.9 Forbidden in every onboarding surface

- Message bubbles, per-line avatars, timestamps, a typing indicator, a scrollback thread
- A progress percentage, a countdown, a step counter, or twelve rail marks
- Auto-advancing on a probe, a route change, or a timer
- A modal that blocks the app, or hiding the bottom nav
- A badge, dot, or count aimed at the partner
- Any sentence composed at a call site instead of taken from the copy deck

---

## 14 · The Fund at the centre

*Added 2026-09-02. The drawings live in the workshop artifact "The Fund at the Centre" (`claude/hearth-fund-workshop-2026-09-02.html`). Build slices are `HEARTH_BUILD_MANUAL.md` Part 5. Where prose and a drawing disagree, the drawing is the intent.*

### 14.1 The governing idea

A balance says where you are. Standing in a shop with the household card, the question is **"are we okay?"** — which is about **pace**. So the Fund's face is a pace instrument: the month's balance walked forward against the bills already known.

**One rule carries the whole thing: actual is solid, projected is dashed.** Fact and forecast never share a stroke. Every other honesty property of this feature follows from that one.

### 14.2 The Level — geometry

Exported from `src/core/levelView.ts`. **Do not hard-code any of it in a component.**

```ts
export const LEVEL_VIEW = {
  width: 700, height: 236,
  left: 40, right: 660, top: 30, axisY: 214, labelY: 234,
  actualStroke: 2.25, projectedStroke: 1.75,
  projectedDash: "5 4", projectedOpacity: 0.72,
  bandOpacity: 0.07, todayOpacity: 0.32, markRadius: 4,
} as const;
```

- **Steps, never a curve.** Money arrives and leaves in lumps; a smoothed line misrepresents how a household works.
- **The band fills the space *below* the buffer**, only on the days the line is down there — so shaded width is literally days at risk. Never above.
- **Estimated inflow marks are hollow; confirmed ones are filled.** A member must see which numbers were found and which were observed.
- Payday ticks reuse `paydayTicks()` — 3px `--tick`, below the axis, **timing only, no amount**.
- Colours: `--pine` line, `--copper` buffer / band / dry mark, `--felt` ticks. **`--danger` never appears** — a shortfall is not an error.
- **SVG label sizing:** a 700-unit viewBox rendered into ~320px on a phone scales text by ~0.45. Labels must be **≥18 user units** or they are unreadable at the size they actually ship at. This has been got wrong twice on this project.

### 14.3 The headline ladder

One sentence, two at most. Highest true statement wins, in this exact order:

| # | Fires when | Copy |
|---|---|---|
| 1 | a dry date exists | `At this pace the Fund runs dry on the {ordinal}.` |
| 2 | a below-buffer run of ≥3 days | `Under the buffer from the {a} to the {b} — {n} days on {low}.` |
| 3 | spoken-for exceeds the pool | `{claimed} of the {pool} in the pool is spoken for before the {ordinal}.` |
| 4 | no confirmed contribution yet | `This is only the bills you've told me about. Nothing has actually happened yet.` |
| 5 | otherwise | `{Month} is covered.` |

**The covered case never manufactures a worry to fill the slot.** A warning that is always on becomes wallpaper.

### 14.4 Insight rules

Always a number and a date · never an instruction · never between the two of them · refuse below a sample · one line, not a feed.

### 14.5 The rail and the stage

- **Rail: eight slots on desk, six on phone** — `slots.slice(0, 6)`, no separate phone arrangement. **It never scrolls.**
- **The Level is pinned to slot 1** and is the stage's resting state. There is no empty stage and no "select a widget" prompt.
- **Single click stages.** No double-click gesture on the shared floor.
- Rail is a **tablist**, stage a **tabpanel**: arrow keys, Enter, `aria-current`, focus to the panel heading.
- The selected plate takes a **3px `--pine` inset edge** — quiet, never a fill.
- **Stage memory: `sessionStorage`, keyed by member and civil date.** Same day, same place; new day, back to the Level.
- **One view spec, two presentations.** Desk fills the stage; phone pushes the same view full-screen. Two implementations of "Next out" will drift, and the one nobody looks at will be the wrong one.
- **The glance is a true summary of its stage, never a teaser.** If the plate says *$186 Thursday*, the stage's first row is $186 Thursday. A tile that under-reports to earn a click is a dark pattern.

### 14.6 Plate anatomy

Fund plates produce the existing `DeskPlateModel` and use the existing six primitives in `src/core/plates.ts` — `track`, `pair`, `fill`, `spark`, `tally`, `gauge`. **No new drawing engine.** 220px wide, ~118px min height, kicker → figure → sub → primitive.

The one action plate on a board (`I spent something`, or `I'll put in`) is the only tinted plate: `color-mix(in srgb, var(--pine) 13%, var(--card))` with a `--pine` 46% border. It reads first because it is the member's own act.

### 14.7 The drawer

**The drawer is itself a stage** — no new surface, no settings screen. Reached by a quiet *Arrange* control at the foot of the rail on desk, long-press a plate on phone. Fourteen cards, eight marked *on the rail*. **Two taps to swap** — widget, then slot. **No drag-and-drop:** unusable on a touchpad, impossible one-handed. First line: *Nothing here is locked and nothing is earned — the library is identical for both of you.*

### 14.8 Default rails

| Slot | Custodian | Contributor |
|---|---|---|
| 1 | The Level *(pinned)* | The Level *(pinned)* |
| 2 | I spent something | I'll put in |
| 3 | Waiting on you | Waiting on you |
| 4 | Next out | The Ask |
| 5 | Spoken for | Next out |
| 6 | This week | The two streams |
| 7 | The shape | The shape |
| 8 | The record | This week |

**Where they agree is as deliberate as where they differ.** Both get the Level, Waiting on you, Next out, the shape and the week, because those are facts about the household — and two people looking at different facts is how an argument starts. Only the *act* at slot two and the instrument serving each person's job differ.

### 14.9 Day one

All dash, no solid. One filled dot at today. Headline #4, which names the drawing's own ingredients — not a disclaimer and not a warning triangle. **No dry date until a contribution has actually been confirmed**, because a Fund that starts empty running dry is meaningless. It upgrades silently: first confirmed contribution starts the solid stroke, three weeks unlocks the run-rate sentences. **Nothing announces a level-up.**

### 14.10 Forbidden on every Fund surface

- A ratio, percentage split, or ranking between the two members — **especially in the two streams**
- A total combining their contributions into a scoreboard
- `--danger` for a shortfall; a streak, score or badge attached to a person
- A projection in the same stroke as history; a smoothed or averaged balance curve
- Pending money coloured like confirmed money
- A glance that says less than its stage to earn the click
- **A second balance computed anywhere outside `fundWalk`**
- **A contribution amount inferred from a pay cadence** — the cadence gives a date, never an amount
- A countdown, timer, or progress percentage; anything tickable on the week
