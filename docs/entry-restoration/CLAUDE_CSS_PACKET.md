# ENTRY_CSS_PACKET

**Restoring the original "I spent something" visual language across the expense, income, transfer and shift Add flows.**

Claude — visual author.
Deliverables: `entry-restoration.css` (900 declarations, 99 rule blocks) and this contract.

- Reference: `33b41412b5a1df81539d70f67f080baeaa3e07f9` — `Swipe.tsx`, `swipe.css`, `CadPad.tsx`.
- Target: `76e486a142987ed5d6fbc065367fadf4c896de26` — `AddSlideshow.tsx`, `mobile-entry-sheet.css`, `theme/worlds.css`.
- Scope: CSS only. No business logic, no copy, no financial contract, no source-of-funds work, no repository mutation.

---

## 1. What was actually lost

I did not take the loss of feel on trust. I rendered the supplied harness and measured it, then built a static replica of the current `AddSlideshow` DOM against the real current CSS chain in the real import order and measured that too. Both harnesses are reproducible offline (fonts self-hosted, zero failed requests, zero page errors).

The first finding matters for everything that follows:

> **`swipe.css` and the `styles.css` CAD-pad block are byte-identical between the two commits.** `diff` produces no output. The entry components did not change.

So the loss is not in the entry CSS. It is in two other places.

### 1a. The theme layer outranks the component — in *both* commits

`theme/worlds.css` reaches these elements at specificity (0,2,1) and (0,4,1), which beats the component's own (0,1,0) and (0,2,0) declarations *by construction*, not by source order. I confirmed each of these by walking the live CSSOM and asking `element.matches()` for every rule that touches the property:

| element | component declares | what actually renders | winning rule |
|---|---|---|---|
| `.cad-pad.is-giant .cad-pad-keys button` | `min-height: 72px` | **44px** | `:root[data-theme] :is(button, .btn):not(.text-button):not(.link)` — worlds.css |
| `.swipe-cat` | `min-height: 72px` | **44px floor** | same generic button rule |
| `.swipe-title` | `line-height: 1.14` | **1.18** | `:root[data-theme] :is(h1,h2,h3,h4,…)` — worlds.css:11139 |
| `.swipe-sheet-inner` | `background: var(--paper)`, no border, no radius | `--card` + 1px `--line` + 5px radius | worlds.css:620 |
| `.cad-pad`, `.cad-pad-display` | bare | card, then a bordered well | worlds.css:1280–1281 |
| `.swipe-error` | amber `#e6c84a` left rule | `--world-danger-*`, rounded | worlds.css:691 |
| `.add-slideshow-progress` | plain `<p>` | a progress pill whose `> *` fill matches nothing | worlds.css:643–644 |

These are my own rules from the Three Worlds commission. They are reported here so you have the list, not as a request to change `worlds.css`: **`entry-restoration.css` pins every one of these values inside the Add sheet instead**, so the entry flow can no longer drift when a generic rule is edited. That matters concretely — you already narrowed the generic phone button rule during the mobile integration.

The practical consequence for reading the supplied screenshots: **they show the already-flattened pad and tiles, not the component's declared intent.** Section 4 says exactly where I follow the screenshot and where I follow the declaration, and why.

### 1b. The clutter is object count, not decoration

This is the real answer to "avoid the current general-form visual clutter."

| | original amount step | current amount step |
|---|---|---|
| objects before the instrument | **2** — Close, the question | **6** — Back/mode + Close, question, hint, "1 of 5", More, "Switch kind" |
| all at the same visual weight? | no — one 23px display serif question | yes — five 16px body-weight blocks |
| space consumed before the pad | **122.1px** | **324.5px** |
| does the sheet scroll at 390×844? | no | **yes** (864 > 844) |

Six objects at one weight is a form. Two objects at two weights is a question. That is the whole difference, and it is what the restoration undoes.

---

## 2. The restored composition

Every Add mode — expense, income, transfer, shift — and every one of the fourteen slide ids now reads in the original's four movements:

1. **The way out.** Close (and Back from step two on), one 46px line, 18px of air beneath.
2. **The question.** 23px display serif, `-0.012em`, one line of air beneath. Nothing else at this weight.
3. **The instrument.** The cashpad, or the tile grid under its amount readout. It starts high enough to be reached with a thumb and finishes above the fold.
4. **The commit.** Enter to advance; Confirm, and only Confirm, to post.

Everything the original did not have — the step counter, More, "Switch kind", the step sentence — is still present, still in DOM order, still keyboard-reachable, still a 44px target. It is demoted to a single caption line at 12.5px `--muted`, laid out as one row rather than four stacked blocks. **Nothing is hidden.** The sentence carrying the consequence ("Confirm still posts") keeps its words.

### How one row happens without touching the markup

The four chrome elements are consecutive siblings of `.sheet-inner`. The sheet-inner becomes `flex-flow: row wrap`; every child is `flex: 0 0 100%` except those four, which are `flex: 0 1 auto`. They flow onto one line **in DOM order**; the next element starts a new line.

I deliberately did **not** use CSS `order` or `row-reverse` to move chrome, because focus order follows DOM order, not CSS order (WCAG 2.4.3 Focus Order, 1.3.2 Meaningful Sequence). Nothing in this file changes the sequence a screen reader or a Tab key sees.

---

## 3. Markup contract

### 3.1 Hooks this CSS relies on — all of which already exist

| hook | where | used for |
|---|---|---|
| `.sheet.add-slideshow` | root | the whole scope; every selector in the file contains it |
| `.mobile-entry-sheet` | root, when `mobile` | the phone branch (106 of 120 selectors require it) |
| `data-add-slideshow="expense\|income\|shift\|transfer"` | root | shift-only field rhythm |
| `data-add-slide="…\|full-form"` | root | review-mode section rules |
| `.sheet-inner.add-slideshow-inner` | inner | the sheet body and the chrome row |
| `.topbar` + its `button.ghost` | inner | Close / Back line |
| `.add-slideshow-mode` | inner | the mode word, demoted |
| `.add-slideshow-title` | inner | the question |
| `.add-slideshow-hint`, `.add-slideshow-progress` | inner | caption tier |
| `.add-slideshow-switch` + `summary` + `.tabs` | inner | "Switch kind", demoted |
| direct-child `button.ghost` labelled More | inner | the escape hatch |
| `.swipe-amount` | inner | amount readout on choice steps |
| `.entry-sheet-fields` (the `<fieldset>`) | inner | busy state, spacing |
| `[data-entry-section]`, `.entry-full-section` + `h2` | sections | review rhythm |
| `.cad-pad`, `.is-giant`, `-label`, `-display`, `-keys`, `-enter`, `.cad-pad-back` | instrument | pad geometry |
| `.swipe-grid`, `.swipe-cat`, `.swipe-cat.more`, `.swipe-cat small`, `[aria-pressed]` | instrument | tile grid |
| `.entry-step-continue` | steps | stays hidden on the phone |
| `.kitchen-notice`(`--warning`/`--danger`, `__content`, `__primary`, `__action`, `__close`) | inner | notice band |
| `.preview.warn` + `.row` | inner | duplicate warning |
| `[data-add-account-intent]`, `[data-ledger-confirm-purpose]`, `[data-add-confirm]` | inner | the commit block |

**Nothing above needs to be added. The restoration works as-is with zero markup change.**

### 3.2 One optional wrapper — the only markup I am requesting

```diff
+ <div className="entry-chrome">
    <p className="muted add-slideshow-hint">…</p>
    {!expanded && <p className="muted add-slideshow-progress" aria-live="polite">…</p>}
    {mobile && … && <button type="button" className="ghost" …>More</button>}
    {slide !== "confirm" && <details className="add-slideshow-switch">…</details>}
+ </div>
```

- **Order of the four children is unchanged**, so focus order and reading order are unchanged.
- No attributes move; `aria-live` stays on the counter.
- The wrapper is presentational; give it no role.

**What it buys:** determinism, not height. Measured at 390 both tiers produce an identical sheet (amount step 722.53px, category step 534.13px). Tier A reaches that by letting flex wrapping settle the row, which depends on the copy length and the user's text-size setting; Tier B pins it. **Recommendation: ship Tier A now.** Adopt the wrapper only if longer copy or a large-text setting makes the band wrap unpredictably. `entry-restoration.css` already carries both, and the Tier B rules are inert until the wrapper exists.

### 3.3 Things I am *not* asking for, and why

- **No reordering of Close and Back.** The reference puts Close alone on the left; the current sheet puts Back left and Close right. That is the better pattern once there is a Back, and reversing the visual order of a two-item row against the DOM is the exact WCAG problem above. **This is a deliberate, visible difference from the reference.**
- **No `<small>` caption on the tiles.** The reference tiles carry "Household suggestion" as a second line; the current `MobileEntryChoices` renders the name only. That is a content decision, not a CSS one, and it is yours. The CSS styles `.swipe-cat small` correctly either way.
- **No new state attributes.** Busy is read from the existing `fieldset[disabled]`; selection from the existing `aria-pressed`; review from the existing `data-add-slide="full-form"`.

---

## 4. Geometry contract — reference vs shipped

Measured at 390×844, Classic Hearth, device scale 1, reduced motion, fonts loaded. "reference" is the supplied harness rendered and measured, not read off an image.

| property | reference | before | **after** | Δ |
|---|---|---|---|---|
| scrim | `ink 28%` | `ink 38%` | **`ink 28%`** | — |
| sheet width | 390 | 390 (`min(440px,100%)`) | **390** | — |
| sheet padding | `22 20 26` | `18 20 26` | **`22 20 max(26, safe-area)`** | — |
| sheet radius | 5px | 5px | **5px** | — |
| sheet top edge | 1px `--line` | **3px `--pine`** | **1px `--line`** | — |
| question size / line | 23px / 27.14px | 25px / 29.5px | **23px / 27.14px** | — |
| question face | Fraunces | Fraunces | **Fraunces** | — |
| first object, from sheet top | +23.0 | +19 | **+23.0** | — |
| **instrument top, from sheet top** | **+122.1** | **+324.5** | **+182.1** | **+60** |
| pad height | 386.41 | 498.41 | **498.41** | +112 |
| display size | `clamp(56,16vw,88)` → 62.4px | 62.4px | **62.4px** | — |
| key gap / grid | 10px / 3×`minmax(0,1fr)` | same | **same** | — |
| **key height** | **44** | 72 | **72** | **+28** |
| Enter height / radius | 54 / 3px | 54 / 3px | **54 / 3px** | — |
| amount readout | 44px, `-0.028em`, `14px 0 0` | same | **same** | — |
| tile grid gap / margin-top | 10px / 18px | same | **same** | — |
| tile width | 169 | 169 | **169** | — |
| **tile height** | **58.14** | 72 | **58** | **−0.14** |
| More height | 44 | 72 | **44** | — |
| tile grid height | 248.42 | 318 | **248** | −0.42 |
| **amount step scrolls at 390×844** | **no** | **yes** | **no** | — |

### The three deliberate deviations

Each is one custom property. Change the value, get the reference.

**1 — `--entry-key-min: 72px` (reference measures 44px).**
The reference's 44px is the flattened value, not the design: `styles.css` declares `min-height: 72px` for the giant pad and the generic `worlds.css` button rule outranks it. Your integrated mobile overhaul at `bf33c87` restored 72px on purpose. Shipping 44px here would shrink the primary instrument's touch targets to satisfy an artefact. It accounts for the entire +112px pad-height delta above (4 rows × 28px). Set `--entry-key-min: 44px` to match the screenshots exactly.

**2 — `--entry-tile-min: 58px` (reference measures a 44px floor with 58.14px intrinsic height).**
The reference tiles are 58.14px tall because they carry a second caption line. The current tiles are single-line, so a 58px floor reproduces the same block — grid height 248 against the reference's 248.42 — while staying above the 44px target floor. Today's 72px reads as a much taller, emptier grid. `--entry-tile-min: 44px` for the literal floor; `72px` for today's.

**3 — `--entry-wide-col: 560px` / `--entry-wide-col-xl: 620px` (reference keeps 390px at 1100 and 1440).**
Above 719px the component is no longer `mobile`: it renders preset chips, `AddAccountTiles` and the inline category form, which do not fit a 390px column. The column is capped rather than fixed. Set both to `390px` to match the reference literally.

The remaining **+60px** on the instrument's start position is not a deviation but the cost of the brief: the step counter, More and "Switch kind" occupy one 44px row that the original did not have, plus a 12px gap. Removing them would mean removing function.

---

## 5. Responsive

| width | branch | what changes |
|---|---|---|
| **320** | phone | key 56px, tile 56px, question 22px, side padding 16px; tile labels wrap and the box grows rather than clips |
| **390** | phone | the specification above |
| **719** | phone | unchanged from 390 — the sheet is fixed at 390 and centred; `--entry-display-size` still reads `16vw`, matching the reference's 88px |
| **719.02–1099** | wide | column capped at 560px and centred; question 28px; pad display sizes to the **column** (`22cqw`) instead of the window |
| **1100 / 1440** | wide | column 620px; everything else as above |

**Breakpoint tiling.** `MobileEntryChoices.MOBILE_ENTRY_QUERY` is `(max-width: 719px)`, which is false at a fractional width such as 719.5px — so the component renders the wide DOM there. A plain `min-width: 720px` would leave that sliver with neither branch. The phone block is `(max-width: 719px)` and the wide block is `(min-width: 719.02px)`, which tiles the axis exactly as the JS does. Wide rules additionally carry `:not(.mobile-entry-sheet)` so the two branches can never both apply if the class lags a resize.

---

## 6. Themes

All three keep the same composition; identity comes from material and one lit edge, at the reference's weight rather than a 3px slab.

| | Classic Hearth | Taylor's Scrapbook | Newfoundland |
|---|---|---|---|
| sheet edge | 1px `--line`, pine inner hairline | 1px `--line`, `--theme-second` inner hairline | 1px `--line`, 2px painted stile on the inline start |
| question | plain | 1px accent rule beneath, like a page tipped into an album | plain |
| accents | `--theme-accent` on the chosen tile and Enter | as left | as left |

No palette literals: every colour is `color-mix()` of a token `scenes.ts` already publishes (`--theme-accent`, `--theme-second`, `--pine`, `--line`). Dark scenes follow automatically because the tokens do. Verified at 320/390/719 in all three worlds.

---

## 7. States

| state | treatment |
|---|---|
| **busy** | The component disables `fieldset.entry-sheet-fields`; it dims to 0.55 with `cursor: progress`, while the amount readout and pad display stay at full opacity so the figure is never obscured. **Close and Back sit outside the fieldset and stay live** — the brief's "keep Close/Back reachable" holds by structure, not by styling. Confirm dims to 0.5. |
| **error / notice** | `KitchenNotice` takes the original `.swipe-error` grammar: square, a 3px `currentColor` rule on the inline start, `10px 12px`, 14px/1.35, 4px between the headline and its steps. It keeps its own `--warning` / `--danger` tones. Action and dismiss stay 44×44. |
| **duplicate** | `.preview.warn` takes the same band grammar so the two never compete, with the matched rows in tabular numerals. |
| **More** | A 12.5px underlined text button in the caption row, still a 44px target. In the tile grid, `.swipe-cat.more` spans both columns at 44px in `--muted`. |
| **review / full form** | `data-add-slide="full-form"`: sections separated by a 1px `--line` rule with 16px block padding, first section without a rule; `h2` at 17px display serif so it sits under, not beside, the 23px question. |
| **account intent** | `[data-add-account-intent]` reads as the original `.swipe-note`: 14.5px `--muted`, directly above the button it governs. |

**Notice-aware relief.** When a notice or duplicate panel is present at ≥390px, `--entry-key-min` drops to 64px via `:has()`, so notice, question, instrument and commit all stay on screen without scrolling and without hiding guidance. 64px is still well above the 44px floor. Where `:has()` is unsupported the sheet simply scrolls — no broken layout.

---

## 8. Safe areas, keyboard, motion

- **Safe areas.** `padding: 22px max(20px, env(safe-area-inset-right)) max(26px, env(safe-area-inset-bottom)) max(20px, env(safe-area-inset-left))`. The sheet is bottom-anchored, so the bottom inset is the one that matters and the Confirm button never sits under a home indicator.
- **Keyboard.** `max-height: 100dvh` already tracks the software keyboard. Fields carry `scroll-margin-block: 24px 96px` and controls `16px 24px`, so a focused field scrolls clear of the commit row rather than under it. Every typed field is `max(16px, 1rem)` — below 16px iOS zooms the page and breaks the 390px column.
- **Focus.** A 2px `--pine` ring at 2px offset on every button, summary and field inside the sheet, in all three worlds.
- **Reduced motion.** Animation, transition and `scroll-behavior` are neutralised for the sheet and its subtree under `prefers-reduced-motion: reduce`, and again under the house `:root[data-atmosphere="paused"]` switch.
- **Forced colours.** Sheet, pad, display, keys, tiles and both notice bands fall back to `Canvas`/`CanvasText` with a 1px border and no shadow; the chosen tile is marked with a `Highlight` outline rather than a colour.
- **Print.** The Add sheet is `display: none`.

`!important` appears eleven times, only inside those four policy blocks. Nowhere else in the file.

---

## 9. Verification

**What I ran.**

1. **Reference baseline.** Served `harness/dist` and measured `.swipe-sheet`, `.swipe-sheet-inner`, `.swipe-close`, `.swipe-title`, `.swipe-amount`, `.cad-pad*`, `.swipe-grid`, `.swipe-cat` and `.swipe-cat.more` with `getBoundingClientRect` and `getComputedStyle`, at 320/390/719/1100/1440 × three themes, in both steps, after entering 4500 through the real keypad. Reproduces the packet's documented figures exactly: **390×551.53 amount, 390×577.13 at ≥550, 487.55 category, dialog 390 at every width.**
2. **Fonts.** Self-hosted the four families the app loads; both harnesses render with 27 faces registered and **zero failed requests**, so the reference and the replica are measured under identical text metrics. Re-running the reference sweep with local fonts reproduced the network-font sweep byte for byte.
3. **Cascade attribution.** For each contested property, walked every attached stylesheet and asked `element.matches(rule.selectorText)`, to name the winning rule rather than infer it. That produced the table in §1a.
4. **Current replica.** Built a static transcription of the current `AddSlideshow` DOM — 20 states across all four modes, the tile steps, the note and confirm steps, error, busy, duplicate, the full form, and both wide-branch and chrome-wrapper variants — loading the exact current CSS chain in `main.tsx` module order with the real `sceneTokens()` written to `documentElement.style`, as `ThemeProvider` does.
5. **Before / after sweeps.** 126 before-records and 144 after-records: 16 states × 3 themes × 3 widths, plus the wide branch at 719/1100/1440.
6. **CSSOM parse.** Re-parsed the file through a `CSSStyleSheet` in Chromium: **99 rule blocks, 900 declarations, zero blocks with all declarations dropped, zero dropped at-rules.** (This is the check that catches a `:is()` containing a pseudo-element, which fails silently.)
7. **Scope audit.** Parenthesis-aware split of all 120 selector parts: **every one contains `.add-slideshow`**; 106 also require `.mobile-entry-sheet`. Nothing in this file can reach anything outside the Add sheet.

**Results.**

| check | before | after |
|---|---|---|
| page errors | 0 | **0** |
| horizontal overflow past the viewport | 0 | **0** |
| interactive targets under 44px | 0 | **0** |
| step states that scroll at their viewport height | **27 of 117** | **4 of 135** |
| instrument start, amount step, 390 | +324.5 | **+182.1** (reference +122.1) |
| tile / More height, 390 | 72 / 72 | **58 / 44** (reference 58.14 / 44) |

The four remaining scrolls are all the error state: 320-wide in Classic, Taylor and Newfoundland (11–18px), and Taylor at 719 (3px). A sheet is a scroller and Close stays at the top of it, so this is correct behaviour rather than a defect; with `--entry-key-min: 44px` it does not occur at all.

**What I did *not* verify — please read this before treating any of it as proven.**

- **No real application run.** Everything above is a synthetic harness plus a static DOM replica. `core/index.ts` is not in the supplied snapshot, so the real `AddSlideshow` cannot be compiled here.
- **No physical device.** No iOS or Android, no real software keyboard, no real safe-area inset, no real `100dvh` behaviour under a collapsing URL bar. The safe-area and keyboard rules are written from the spec; they are unmeasured.
- **No screen-reader or assistive-technology pass.** I reasoned about focus and reading order from the DOM and avoided anything that would change them; I did not run VoiceOver or TalkBack.
- **Chromium only.** Not tested in Safari or Firefox. `:has()`, `dvh`, `color-mix()` and `cqw` all have Safari support, but their interaction here is untested.
- **My replica's shift copy is a placeholder** (`addSlideCopy` for the shift slides was not transcribed); shift geometry was measured, shift wording was not.
- **The category tiles in my replica are single-line**, matching the current component, not the reference's two-line tiles. §4 deviation 2 depends on that staying true.
- I have not seen the integrated result. **Send the real renders and I will compare them against these numbers independently.**

---

## 10. Integration

1. `src/entry-restoration.css` — the file.
2. `src/main.tsx` — add as the **last** CSS import, after `theme/mobile-worlds-refinement.css`.
3. Nothing else. No component, no copy, no token, no `worlds.css` edit is required.
4. Optional, later: the `.entry-chrome` wrapper in §3.2.
5. To match the supplied screenshots literally, set the three knobs in §4 to their `ref` values — all in `§1 GEOMETRY KNOBS` at the top of the file.

**Explicitly preserved and untouched by this packet:** explicit account selection, every required field, split review and `splitReading`, draft recovery, scope, and the rule that only Confirm posts. `.entry-step-continue` stays hidden on the phone precisely so that Enter and a tile tap advance while Confirm alone commits. No source-of-funds work, no authority change, no finance copy edited.
