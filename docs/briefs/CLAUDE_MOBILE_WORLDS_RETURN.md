# Codex integration record

Received from the installed Claude desktop app in the existing mobile UX conversation. Input base: `df5328e192f8e11127478eca912d33b77cc8d8f7`; no private books or real photographs shared. Original CSS SHA256: `6e6f671b92cdfc3320acceda40322322d0772b4f6f8ab2174098065c0db2a3dd`.

Codex removed the returned grip `position: fixed`: the expanded sheet deliberately owns a relative grip. The returned assumption that this declaration changed nothing was incorrect. Production geometry remains owned by the mobile components. Other review requests for appearance state and offscreen scenery hooks were already satisfied in the integrated source. Codex added explicit sentence typography for narrative tile values. The report below is Claude’s own evidence, not app-level or device certification. Final independent results are in `MOBILE_WORLDS_HANDOFF.md`.

---

# MOBILE_WORLDS_REVIEW — `mobile-worlds-refinement.css`

**Commission:** mobile worlds CSS and second opinion
**Integrated base:** mobile `bf33c87` into themes `14313c8`, main unchanged `6fb15c7`
**Deliverable:** `mobile-worlds-refinement.css`, additive, loaded **after** `worlds.css`, `mobile-canon.css` and `theme/mobile-worlds.css`
**Size:** 1,420 lines · 977 declarations · CSSOM parse in Chromium: **0 dropped rules, 0 rules that lost all declarations**
**`!important`:** 15 occurrences, all inside the pause, reduced-motion, forced-colours and print policy blocks. None in ordinary rules.

No repository was mutated. No markup was changed. No file other than this one and the stylesheet is produced.

---

## 0 · Your five integration findings, as handled

Sent mid-refinement and folded in before packaging.

| Finding | What I did |
|---|---|
| **`.appearance-panel` is the real picker hook, not `.appearance-picker`** | My file never used `.appearance-picker`. But **`mobile-worlds.css:129–130` does** — the two JAG picker frames target it, and `AppearancePicker.tsx` renders `.appearance-panel`, so those two rules match nothing today. I restated both on `.appearance-panel` (lobby: faceted 45° frame; music: brass double frame with a print mat) plus a base panel material. Delete or re-home lines 129–130 when you take this. |
| **Keep true `.shift-climate-seal` pills and instrument handle shapes; generic phone button rule narrowed** | `.shift-climate-seal` is not referenced anywhere in my file — verified by grep, 0 matches. I had restated `border-radius` on `.fund-ledge-handle`, `.shift-punch-handle` and `.count-rail-track`; **all three removed.** Those objects now take only the lit highlight and keep their authored shapes. No generic button rule is widened here — every control rule is scoped to a named surface. |
| **`.reach-ends > span` in the second decorative colour failed small-text contrast in Lover/Fearless → now `--muted`** | Right call, and I had two of the same shape: `.count-tipout` and `.shift-punch-discard` set to `--copper` on small text. **Both removed** — they keep their authored colours. This file now asserts no decorative or accent colour on any small text; the only colours it sets on text are `--muted`, `--ink` and the dark-scene apron pairings. |
| **Fold budget measures real space and may be zero; whole objects spill below** | Nothing here sets a height, a max-height, a gap or any spacing on `.ph-fold`, `.ph-fold-head` or `.ph-fold-below`. The crease `::before` is a gradient with no content assumption, so it reads correctly with an empty head. Comment added at that rule so the next editor knows. |
| **Bracelet letters enlarged in the same SVG hook; ticket first, fabric/photo below** | The bracelet rule is unchanged and hook-compatible — I only add a drop shadow and a stacking index, both independent of the SVG's internals, and both complete names stayed readable at 390 and 320. The keepsake rules are per-`figure`, keyed on `[data-keepsake]` and `[data-placeholder]`, with no dependency on grid order or column count, so the new ticket-then-fabric/photo flow needs nothing from me. My only order-sensitive rule was the corner mount, which is positioned inside each figure. |

---

## 1 · The second opinion, first

You asked for a critique of softness, not only a patch. Six things, in the order I would act on them.

**a. The pause control was a blank white square.** In both supplied Home screenshots — `taylor-shared-home` and `newfoundland-shared-home` — there is an unstyled pale rectangle at the heading corner. `mobile-worlds.css` gives it `border: 0; background: var(--card); font-size: 0`, which is correct for the target and the icon but leaves it with no material at all, sitting on top of the illustration. It is the only object on Home with no identity. It is now a small pressed paper key: same 44px, same place, same glyph size, with a lit edge, an asymmetric 0/5px corner so it reads as tucked into the heading, a real pressed state, and an accent glyph that goes `--muted` when the atmosphere is paused. That last part gives the control a visible state it did not have.

**b. The composition is correct and hard.** Every object is a 5px rectangle, outlined by a 1px rule that runs edge to edge, lifted by a 0–3px offset shadow. That is disciplined, and it is why the pages read as *drawn* rather than *made*. Three levers move it without touching a single dimension:

- **Rules that fade at their ends** instead of hitting the box edge — the spread head and foot, the apron's Ask rule, the Confirm footer, the row reveal. A full-bleed hairline is the single most mechanical thing on these pages.
- **A wide, low, warm bloom** under every physical object, paired with (never replacing) the authored offset shadow. Paper resting on paper.
- **A lit top edge** (`--mw-lit`) so there is one light source above the page instead of none.

Plus a paper tooth fine enough to feel and too fine to read, applied only where the underlying rule paints a flat colour.

**c. `.hearth-tile-value` is a figure slot carrying sentences.** In `taylor-shared-home` the Shifts tile renders *"1 · If you worked, the tips are still in your pocket."* at 21px Fraunces — a paragraph wearing a figure's clothes, four lines deep, next to a real figure in the tile beside it. CSS cannot measure text, so I have only improved the wrapping (`text-wrap: pretty`, `hyphens: auto`) and left the size alone, because size is your geometry. **This wants a markup hook** — see §5.1. It is the most visible remaining softness problem on Home and it is not solvable from a stylesheet.

**d. Never set `overflow` on a Fold seal.** I drafted the torn lower edge with `overflow: hidden` and removed it before shipping. The seals must grow with enlarged text and long figures — that is your "long text expands" rule — and a clip there would fail silently only at large type sizes, which is exactly where nobody looks. The tear is now drawn inside the box with no clipping. Flagging it because it is an inviting mistake for the next decorative pass.

**e. `:is()` cannot contain a pseudo-element.** My first draft grouped the decorative layers as `:is(.a::after, .b::before)` in the pause, forced-colours and print blocks. `:is()` takes a forgiving list of complex selectors; pseudo-elements are invalid inside it, so all three policy blocks would have matched nothing and failed *silently* — the worst possible failure for an accessibility policy. Rewritten as explicit selector lists. Worth a grep across the theme files.

**f. The warn tile on authored-dark scenes.** `--world-warn-bg` is `gold 20% + card`. On `jag-lobby`, `reputation`, `midnights` and `george-street` that lands as a muddy khaki that reads as a different *material* rather than a warning. I did not change it: it is a semantic carrier owned by `worlds.css`, and quietly re-toning a warning is precisely the failure the raincoat rule exists to prevent. **This is yours to measure** — see §6.

---

## 2 · Exact hooks mapped, by the brief's own list

Every selector below exists in the supplied source. Nothing was invented.

### Fold
`.office-phone .ph-fold-head` · `.ph-fold-below` · `.ph-fold-line` (+ `::before` crease, `> span` label) · `.ph-fold .hearth-weather-ribbon` · `.ph-seals .hearth-wax-seal` (+ `::after` tear, `:active`, `[aria-pressed="true"]`) · `.hearth-seal-label` · `.hearth-seal-value` · `.hearth-seal-sub` · `.hearth-paper-tile` (+ `::after` turned corner, `.is-warn`) · `.hearth-tile-kind` · `.hearth-tile-name` · `.hearth-tile-value` · `.ph-drawer > summary` · `.ph-drawer[open] > summary` · `.ph-chalk > summary` · `.ph-chalk-body`.

Three seals stay outlined paper: no `border-radius`, no wax gradient and no `::before` is reintroduced. The accent top border, the pressed outline and the semantic warn carrier are untouched.

### Ledge
Outer `.fund-ledge` is explicitly re-stated as `background: transparent; border: 0; box-shadow: none` so nothing later can decorate the spacer. Decoration is on `.fund-ledge-grip` (+ `::after` lit lip, `:active`), `.fund-ledge-handle`, `.fund-ledge-sentence`, `.fund-ledge-scope`, `.fund-ledge-arrow`, `.fund-ledge-sheet`, `.fund-ledge-scrim`, `.fund-ledge-stage > section`, `.fund-ledge-arrange`, `.fund-ledge-record`, `.fund-board-slot`, `.fund-board-slot[aria-selected="true"]`.

**Not touched anywhere:** `position`, `z-index`, `bottom`, `height`, `min-height`, detents, `touch-action`, `.fund-ledge-content`, `.fund-ledge-ground` or its `> i` width. The one `position: fixed` on `.fund-ledge-grip` is a re-statement of the authored value, present only so the added `::after` has a containing block; it changes nothing.

### Chapters
`.phone-spread` (+ `::after` stitched binding) · `.spread-head` (+ `::after` fading rule) · `.spread-heading` · `.spread-page` (untouched — its scroll, `max-height`, `overscroll-behavior` and `touch-action` are yours) · `.spread-foot` (+ `::after`) · `.spread-foot > button` (+ `:active`) · `.spread-dots [aria-selected="true"] i` · `.spread-contributions li` · `.spread-deferrals li`. Scope and page key are never hidden or restyled out.

### Work
`.apron-card` · `.apron-header` · `.apron-facts dt` / `dd` · `.apron-timing` · `.apron-ask` (+ `::after`) · `.apron-ask strong` · `.count-draft` · `.count-rail-head` · `.count-rail-track` · `.count-history` (left alone — see §4) · `.count-note` · `.count-total` · `.count-tipout` · `.count-exact` / `.count-value` (numerics only) · `.cut-card` · `.cut-handle` · `.cut-line` · `.cut-name` · `.cut-remainder` · `.cut-reading.is-0` / `.is-1` (bloom only; the authored tints stay) · `.shift-punch-instrument` · `.shift-punch-grip` · `.shift-punch-handle` · `.shift-punch-line` · `.shift-punch-reading` · `.shift-punch-buttons > button` · `.shift-punch-discard` · `.shift-punch-kicker`.

### Instruments
`.weight` `.weight-base` `.weight-item` `.weight-head` `.weight-legend` `.weight-note` · `.reach` `.reach-row` `.reach-row.on` `.reach-pill` `.reach-line` `.reach-kicker` · `.fund-trust` `.trust-stop` `.trust-stop[aria-pressed]` `.trust-title` `.trust-note` · `.goal-fill` `.fill-glass` `.fill-paperbox` `.fill-caption` `.fill-reading` · `.date-turn` `.turn-focus-boundary:focus-visible` · `.duplicate-prise` `.prise-card` `.prise-part-handle` `.prise-card-heading` `.prise-kicker` `.prise-help`.

Hatching, dashed and solid strokes, `--theme-chart-*`, `.is-projected`, `.due`, `.is-over` and every semantic colour are the components'. Nothing here repaints a financial mark.

### Confirm
`.sheet.guard.phone-danger .sheet-inner` · `.phone-danger h1` · `.phone-danger .confirm-copy p` · `.phone-danger .confirm-footer` (+ `::before` fading rule) · `.confirm-footer > button` (+ `:active`) · `.danger-reveal` · `.danger-reveal label` · both range thumb pseudo-elements · `.phone-danger .danger` · `.row-reveal` · `.row-reveal-actions` (+ `::before`) · `.due-preview-inline`.

Anchored/scrolling layout, Cancel-first order, the reveal's separation from posting, every 44px target, and the absence of motion are all preserved. The footer gains a short gradient so scrolling copy fades under it instead of ending on a hard line; it adds no height and no scroll.

### Keepsakes
`.theme-memorabilia` · `.keepsake-heading > span` / `> small` · `.keepsake-mounts > figure` (+ `::after` corner mount) · `> figure::before` (the tape — torn ends and translucency only) · `.theme-memorabilia img` · `figcaption` · `[data-keepsake="ticket"|"fabric"|"portrait"]` · **`figure[data-placeholder]`**.

The grid is yours: ticket first across the width, fabric and photograph beside each other. Only tape, mount, paper and shadow are tuned.

### Also
`.theme-scene-heading` (+ `::after` vignette) · `.theme-scene-copy` · `.theme-scene-title` · `.theme-scene-caption` · `.theme-scene-kicker` · `.theme-atmosphere-toggle` · `.friendship-bracelets` · `.nav` · `.nav button.active` · `.appearance-option` (+ `[aria-pressed]`) · `.appearance-eyebrow` · `.appearance-option-description` · `.hearth-paper-empty` · `.desk-plate-empty`.

---

## 3 · Scenes and materials

**All 24 named scenes have authored detail**, plus Classic: `lover` `red` `fearless` `reputation` `evermore` `1989` `showgirl` `midnights` `speak-now` `poets` `debut` `folklore` · `jellybean` `rain` `trail` `harbour` `jag-lobby` `water-street` `quidi-vidi` `cape-spear` `george-street` `battery` `summit` `jag-music`.

Every scene rule targets a surface `mobile-worlds.css` does **not** already claim, so nothing here overrides your authored scene lines. You own the spread border colours, calendar tops, ledger rules, tab underlines and picker frames; I took the heading vignette, the seals, the tiles, the ledge grip lip and the spread binding.

Selected notes:

- **Lover** — a tape strip laid diagonally across the heading, and a dotted lip on the ledge grip, so the paired bracelets sit on something.
- **Showgirl** — orange sparkle as a satin sheen across the heading and the seals; mint carries the ledge handle and the album binding. Two colours, each doing one job.
- **reputation** and **poets** — bloom and turned corners are *removed*, not softened. Newsprint and manuscript should feel printed and flat; softness here would be the wrong note.
- **1989** — a white photo border around the tiles instead of a corner fold.
- **rain** — the slicker appears on the ledge handle, the pressed seal and the `:active` face of buttons, always against dark ink, and the rain falls along the fold crease. **No warning token is recoloured anywhere in this scene.**
- **trail** and **summit** — the long coastal approach is a slow 114° contour across the heading and the tiles, and the summit is the palest, thinnest-shadowed surface in the whole set with the air lifting at the top of the heading. Neither depicts a trip, and no caption claims one.
- **jag-lobby** and **jag-music** — the faceted diamond wall rhythm at 45°/−45°, dark trim, and inset double frames on the seals and tiles; the music room swaps to a brass mat and a warm print-hanging mood. Content panels stay smooth: no pattern is drawn under running text.
- **battery** / **clapboard**, **harbour** / **dock ledger**, **quidi-vidi** / **berry cloth**, **cape-spear** / **open horizon**, **water-street** / **perforated receipt foot** — each gets one material at the edges.

---

## 4 · What was deliberately left alone

- **`.count-history`** — the last-shifts distribution keeps `mobile-worlds.css`'s fill and gains no label, axis, target or average line. It is context for the value being set, and giving it a scale would make it read as a goal.
- **`.fund-ledge-ground > i`** — the ground bar width is a financial reading. Untouched, in every world.
- **`.spread-page`, `.fund-ledge-content`, `.phone-danger .confirm-copy`** — scroll bodies. No `overflow`, `max-height`, `overscroll-behavior` or `touch-action` anywhere in this file.
- **Every `--theme-chart-*`, `.is-projected`, `.due`, `.is-over`, `.filled`, `.posted`, `.proj`** and the dashed/solid source-versus-forecast distinction.
- **All financial copy, labels, digits, tabular numerics and Fraunces figures.** The only type properties this file sets are `text-wrap`, `hyphens`, `letter-spacing` on two decorative kickers, and `text-shadow` on small mono labels.
- **`--world-warn-bg` and the whole status set** — see §1f.

---

## 5 · Markup requests

1. **`data-value-kind` on the paper tile.** `.hearth-tile-value` currently carries both `−$3,541.78` and *"1 · If you worked, the tips are still in your pocket."* at the same 21px display size. A `data-value-kind="figure"` / `"sentence"` attribute on `.hearth-paper-tile` (or on the value span) would let the sentence set at body size and line-height while the figure keeps Fraunces and tabular digits. This is the single highest-value change on Home and it cannot be done in CSS.
2. **`data-status` on `.appearance-status`.** Requested in the previous return and still absent; the picker's error, pending and local states are text-only, so the state is carried by wording alone. I style `[data-status="error"|"pending"|"local"]` already.
3. **`data-preview-pending` on `.appearance-option`.** Also from the previous return. `aria-pressed` currently means both "previewing" and "applied"; a dashed outline is waiting for the attribute.
4. **Confirm which `data-keepsake` values are final.** I style `ticket`, `fabric` and `portrait` — the three `Memorabilia.tsx` emits today. If more kinds arrive, tell me the vocabulary rather than letting them fall through to the generic mount.
5. **`mobile-worlds.css:129–130` target `.appearance-picker`, which is never rendered.** Restated on `.appearance-panel` in this file; the originals are dead and can go.
6. **Consider a `data-scene-visible` on the phone Home heading.** It exists in the desktop integration; the mobile heading in this packet does not carry it. Nothing here animates, so it is not load-bearing for this file — but the scene artwork does animate, and the off-screen pause would be free.

---

## 6 · Things for you to measure, that I could not

- **Warn-tile contrast on the four authored-dark scenes** (`jag-lobby`, `reputation`, `midnights`, `george-street`): `--world-warn-fg` on `--world-warn-bg`. My eye says it is legible and the *material* is wrong, not the ratio, but that is a measurement, not an opinion.
- **`.friendship-bracelets` at 320.** The memorabilia note specifies 128px wide at 320. The authored rule sets `width: 130px; max-width: 130px`, which is the layout width — but the element also carries `transform: rotate(-7deg)`, so its **visual** bounding box measured **137px** at both 390 and 320 in my harness. If 128px is a visual budget rather than a layout width, the rotation needs to be in the arithmetic. Both complete names remained readable at both widths.
- **Enlarged text / 200% zoom on the seals.** The seals grow rather than clip by construction, and I removed the one rule that would have broken that — but I did not test at enlarged type sizes.
- **Safari.** Not tested, not claimed. `mask-image` (used on the crease and the tape) and `background-blend-mode` carry `-webkit-` prefixes where relevant; `text-wrap: pretty` degrades to normal wrapping and costs nothing if unsupported.

---

## 7 · Evidence — what I actually rendered

I built a static harness reproducing the integrated Home DOM (`.office-phone` → `.ph-fold-head` / `.ph-fold-line` / `.ph-fold-below`, the three-seal group, tiles, `.apron-card`, `.phone-spread`, `.theme-memorabilia--phone-desk`, `.fund-ledge-grip`) with the real class names from `PhoneFold.tsx`, `PaperTheme.tsx`, `Memorabilia.tsx` and `FundLedge.tsx`, applied `sceneTokens()` output inline on `<html>` with all five data attributes, and loaded the real chain in the real order:

`styles.css` → `office-phone.css` → `apron-card.css` → `phone-spread.css` → `fund-ledge.css` → `confirm-mobile.css` → `row-reveal.css` → `worlds.css` → `mobile-canon.css` → `theme/mobile-worlds.css` → **`mobile-worlds-refinement.css`**

Rendered in Chromium at **390px**: `lover`, `showgirl`, `jellybean`, `jag-lobby`, `classic-home`. At **320px**: `lover`. Zero page errors in all six.

**Measured, not eyeballed:**

| Check | Result |
|---|---|
| Heading height, non-Classic | **112px** (`lover`, `jellybean`, `jag-lobby`) — the authored minimum, exactly |
| Heading height, Classic | **90px** — the authored minimum, exactly |
| Heading height, `showgirl` @390 | **128px** — expanded by the 17px Taylor caption and a long title. Within "long text expands"; it is the tallest heading in the set |
| Heading height, `lover` @320 | **152px** — expanded, not clipped |
| Scene title size | **22px** in all six renders |
| Pause target | **44 × 44** in all six renders |
| Fold seal height | **85px** — above the 62px floor, in all six |
| Outer `.fund-ledge` | `background-color: rgba(0,0,0,0)`, `border-top-width: 0px`, `box-shadow: none` — **still a bare wrapper** |
| Horizontal overflow | `documentElement.scrollWidth === window.innerWidth` at **both 390 and 320**, all scenes. No clipping, nothing spills sideways |
| Stylesheet parse | 944 declarations, **0 dropped rules** |

**Seen in the renders:** the vellum tape on Lover's heading; the satin sheen on Showgirl; the faceted diamond wall and gold inset frames on JAG with every reading paired to its own surface; the torn seal foot; the turned tile corner; the fading crease under the fold rule with the label intact; the ledge grip's lit lip; and at 320, the keepsake mounts with the ticket first across the width, fabric and photograph beside it, dashed placeholder edges, and full alt text readable and unclipped.

---

## 8 · What has NOT been verified

Stated plainly.

- **The real application was never rendered.** No checkout, no build, no React. Section 7 is a static harness of the integrated DOM, not the App.
- **19 of the 24 scenes** were never rendered in any form. Their rules are written against the same token contract as the five checked and are unproven visually.
- **Only Home was rendered.** Calendar, Plan, Books, More, Till and Shift pages, the Ledge sheet at any detent, the Fund board, Confirm, the danger reveal, the row reveal, and every instrument (Weight, Reach, Trust, Fill, Turn, Prise, Count, Cut, Punch) are covered by selector and reasoning only.
- **Secondary states are unverified** — hover, focus-visible, disabled, busy, invalid, empty, loading, offline, error, and the pressed state of anything except the Fold seal.
- **Pause, reduced motion, forced colours and print were not rendered.** All four blocks are written and parse; none has been seen. This file adds no animation, so the pause block exists only to keep the layers it adds inert.
- **No contrast ratio was computed.** Every colour here is `color-mix()` over an authored token, and the two Newfoundland slicker literals already live in `worlds.css` — but nothing was measured.
- **No Safari, no device, no axe run, no zoom test.**
- **No claim of pixel fidelity** for any scene, including the five rendered. The comparison against your screenshots is structural and material, judged by eye.

Selector coverage is not completeness. Nineteen scenes and every page but Home remain **unverified**, not done.
