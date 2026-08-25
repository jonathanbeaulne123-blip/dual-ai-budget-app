# Hearth UX report — Home vs Books (2026-08-25)

**Status:** rough draft for Jonathan — design direction, not an implementation packet  
**Scope:** Home / September Office (phone + wide) compared with Books  
**Evidence:** live Development demo screenshots, code audit of `OfficePhone` / `Office` / `Books` / CSS, hearth-ux-auditor pass  
**Budget delta (5):** `0` (report only; money meaning unchanged)  
**Engagement delta (3):** `+1` if Jonathan picks a Home tile language closer to Books paper

---

## One-line verdict

Home is **warm and fun**, mostly **fast**, but **crowded**: too many chrome layers, truncated glances, and furniture jargon fight the calm paper reading that Books already does well. Make Home widgets **stack like Books story/wallet tiles** — same beige paper family, softer office type, less desk theater on phone.

---

## 1. Is it fast / responsive?

**Mostly yes.**

| Signal | Finding |
|---|---|
| Breakpoint split | Clean early return: phone never runs free-move desk packing |
| Data | Dashboard facts are memoized; weather is async with sync fallback |
| Motion | Reduced-motion kills animations under `.office-phone`; Hercules keyframes respect it |
| Layout saves | Debounced localStorage; Drive push can queue if the desk is rearranged quickly |
| Bundle | No `React.lazy` for the ~25 widget modules — Home always pays for the full instrument surface |

**Live feel (Development demo):** Home paints quickly after member pick. The main “slowness” users will feel is **visual**, not CPU: chalk band + sill + stamps/rail + Hercules + due modal compete before the eye finds one number.

**Gaps / risks**

- Wide S-tiles reserve `--desk-chip-gutter: 104px`, which can clip Fraunces figures at 720–900px.
- Phone half-width tiles reserve `padding-right: 46px` for pin chrome; at 320px glance values can ellipsis.
- Open-shift Timesheet glance ticks every 1s (acceptable; keep reduced-motion aware).

---

## 2. Are labels accurate and clear?

**Mixed — Books is clearer; Home is half furniture, half finance.**

### What works

- Books hero: `Net worth`, equation subcopy, trial-balance sentence.
- Books Story tiles: kind → money (`Net worth`, `Chequing`, `Goal savings`, `Credit cards`, `Investments`).
- Phone already softened some furniture words (`Month net`, `Pad`, `Shifts`, `Jars`).

### What muddies the kitchen

| Surface | Label issue |
|---|---|
| Wide Home | Uppercase Fraunces names: `TIMESHEET`, `CALCULATOR`, `BLOTTER` — control-panel tone |
| Phone stamps | Post value shows **Milk** when nothing posted — a preset name used as a status figure |
| Truncation | Live wide Home: `If you worked, th…`, `Mastercard · $10071.72…` |
| Metaphor leak | `Drawer · N`, `Lamp`, `Pad` vs Books’ plain finance language |
| Overlay noise | Due sheet + Tim Hortons preset prompt + tip sentence can stack on first paint |

**Accuracy note:** CAD figures audited are journal-grounded (blotter, wallet, jars, cook-off, opinion). No invented money on the weather glass. Dual Course money boundary holds.

---

## 3. Is there unnecessary bloat?

**Yes on Home chrome; no on Books paper grammar.**

### Home (phone) — three controllers for one desk

1. **Chalk / weather band** (~140px) — atmosphere + notes + Save  
2. **Stamps** (Post / Due / Close) — controllers  
3. **Rail tiles** + **Drawer** — instruments  

Plus Hercules, pin chips, sill sentence, and occasional due/preset overlays. Each piece has a job; together they feel like **a dashboard wearing an office costume**.

### Home (wide) — dense instrument strip

Default packing can show ~10+ instruments at once. Material tints help identity, but uppercase names + pin gutters + sill plate **repeat** Month net / card / bill already on instruments.

### Books — denser navigation, calmer objects

- Hero + Story strip + 2×2 Assets/Liabilities/Income/Expenses is scannable paper.
- Pane pill row (Wallet → Ask) is **nav chrome**, not object bloat — acceptable for a filing cabinet.
- Hosted “Postgres … journal entries” line is transparent for Development; consider quieter production copy later.

**Keep (not bloat):** per-instrument paper tints, wax/opinion stamp, piggy fill, rain glass, Hercules loaf — these are Engagement (3) when they do not cover Confirm or clip numbers.

---

## 4. Is it fun?

**Yes — this is Hearth’s advantage.**

Live demo shows the Dual Course working as intended on Course B:

- Maine Coon loafing on Month net / Blotter  
- Chalk notes (“Leftover chili”, “Hercules gets a hat…”)  
- Warm `--paper` / `--card` / pine / copper  
- Fraunces money + Figtree labels  
- Conversational companion copy (“I never write the coffee”)

Fun fails when **decoration wins the hit-test or the first glance**. Kill criterion from living Office canon still applies: if Bianca cannot add milk because furniture is in the way, shrink the furniture.

---

## 5. Home vs Books — visual gap (why Jonathan’s note is right)

| | **Books (target grammar)** | **Home today** |
|---|---|---|
| Metaphor | Family-office paper | Desk instruments |
| Tile shape | Flat story scraps / wallet tiles | Cream cards with tilt (phone) / free-move (wide) |
| Label case | Sentence case finance words | Mix of outcome labels + furniture UPPERCASE |
| Stack | Vertical document + grid scraps | Rail wrap + stamps + band |
| Shadow | Soft paper lift | Contact shadow + expand theater |
| Job | Read the company | Act without deciding to dive |

**Recommendation:** Keep Home’s *job* (glance + one-tap + Hercules room). Borrow Books’ *tile grammar* (kind · name · one number · paper stack). Do **not** turn Home into a second Books page or a SaaS dashboard.

---

## 6. Recommended direction (rough)

### Non-negotiables

- Warm beige undertones (`--paper` `#f3eee4`, `--card` `#fffaf2`, `--line` `#d8cfc0`)
- Soft office fonts: Figtree body, Fraunces money (keep; avoid shouting uppercase display names)
- Confirm still posts; widgets never invent CAD
- Phone stays ≤ ~5 desk objects at rest

### Preferred synthesis (if only one ships)

**Draft B lean + Draft A story strip:** thin weather ribbon → one needs line → Month net hero paper → stacked/overlapping Books-like tiles (Wallet, Next bill, Shifts, Pad) → nav. Optional slim Post/Due/Close **seals** (Draft C) if stamps still earn their keep after tile stack proves itself.

### Small fixes worth doing even before a redesign

1. Phone: raise stamp label type (≥11px / rem); drawer summary ≥44px hit; `aria-hidden` on `·`  
2. Wide: sentence-case instrument names; shrink pin gutter unless editing  
3. Replace Post stamp value `Milk` with a true status (`—` / `Add`)  
4. Clamp glance strings; prefer kind→name→money over sentence glances on half tiles  
5. Suppress static tile tilt under `prefers-reduced-motion`  
6. Force-colors / high-contrast parity for `.ph-inst`

---

## 7. Rough mockup drafts

Five creative drafts (not 1:1 production). Artifacts live under `/opt/cursor/artifacts/` (and `assets/`).

| Draft | Idea | When to pick |
|---|---|---|
| **A · paper stack** | Hero Month net + 2×2 Books-like scraps | Cleanest “Home reads like Books” |
| **B · wallet stack** | Vertical overlapping paper cards, no stamps | Closest to “widgets stack like Books/wallet” |
| **C · hybrid seals** | Keep Post/Due/Close as paper seals + story strip | Preserve stamp muscle memory |
| **D · wide paper desk** | Wide free-move but sentence-case paper instruments | Desktop still an office, not Bloomberg |
| **E · books twin** | Net worth hero twin + story strip + one Add milk card | Maximum Books rhyme; least desk theater |

Jonathan’s stated preference (“Home widgets more like Books… warm beige… soft office fonts”) points strongest to **B**, with **A** or **E** as phone fallbacks and **D** for wide.

---

## 8. Evidence index

### Live (Development demo)

- Home phone: crowded chalk + overlapping prompts + rail tiles + Hercules  
- Home wide: instrument strip, sill figures, furniture names, truncation  
- Books phone: hero net worth + Story tile grid — calm paper reference  

### Auditor (code)

- Critical/high: desk chip gutter clipping; chalk delete 22×22; phone pin padding at 320px; drawer 34px; copper opinion contrast; missing `aria-controls` on expands  

### Related today’s product UX threads (context, not this report’s implementation)

- Hercules living-teacher chat bubbles / grounded figures  
- Quiet kitchen undo (less popup bloat)  
- Auth invite chrome / entry clarity  
- Shift workflow responsive polish  

---

## 9. Proposed next implementation slice (optional)

Only after Jonathan picks a draft letter:

1. Phone Home tile shell: story/wallet grammar, sentence-case, no tilt (or tilt only in play mode)  
2. Collapse stamps into seals **or** drop them if Story strip covers Post/Due/Close  
3. Shrink chalk band default height; notes stay, weather stays non-CAD  
4. Wide: rename instruments to finance words; keep material tints + Hercules perch  
5. Focused a11y + 320/390/720/1100 visual proof  

No money kernel changes. No Auth/RLS. Development demo data only.
