# CSS_COVERAGE — `worlds.css`

**Commission:** Claude production CSS, three complete Hearth worlds
**Baseline main** `6fb15c7a98f3336862bb743b836aa96a358a35b9` · branch `codex/three-visual-worlds`
**Deliverable:** `src/theme/worlds.css`, imported once, AFTER all existing static CSS
**Size:** 2,410 lines · 133.9 KB · 764 top-level rules · 7,118 declarations
**Parse check:** loaded into Chromium CSSOM — 0 dropped rules, 0 rules with zero surviving declarations.

Nothing in this return modifies TS/TSX, tokens, drawing coordinates, data, finance labels, routes, auth, Workers, migrations or package files. No file other than `worlds.css` and this document is produced.

---

## 1 · How it is scoped, and why

Every rule carries a `:root[data-theme]` (or `:root[data-theme="…"]`, `:root[data-material="…"]`, `:root[data-scene="…"]`, `:root[data-scene-lighting="…"]`, `:root[data-atmosphere="…"]`) prefix. That is a deliberate specificity floor of (0,2,1) so the file wins over lazily-loaded page CSS **by construction rather than by source order**, and it is why there is no blanket `!important`, no `section, button, svg *` sweep, and no descendant recolouring of SVG artwork.

`!important` appears **61 times, in four places only**, all of which are legitimate escape hatches:

| Where | Why |
|---|---|
| `[data-atmosphere="paused"]` and `[data-scene-visible="false"]` | must beat any animation shorthand a component sets on itself |
| `@media (prefers-reduced-motion: reduce)` | same, and non-negotiable |
| `@media (forced-colors: active)` | required to defeat authored colour |
| `@media print` | required to defeat authored colour |

Tokens from `sceneTokens()` are **consumed, never redefined**. The file adds only derived `--world-*` variables (see §3).

---

## 2 · Component coverage against the eleven-group checklist

### Group 1 — shell, entry, nav, labels, all loading/error/offline/recovery
`body` · `.app` (+ inert `::before` scene ground) · `.app-shell` · `.topbar` · `.brand` · `.brand__identity` · `.welcome` · `.welcome-card` · `.welcome-danger-zone` · `.welcome-join__status` · `.welcome-qr` · `.welcome-qr__video` · `.auth-invite-qr` · `.household-entry-card` (+ `--current`, `--highlighted`, `__name`, `__member`, `__relative`, `__exact`) · `.onboarding-card` · `.opening-truth-card` · `.invite-code` · `.join-url` · `.month-proof-code` · `.desktop-qr-note` · `.mobile-qr-action` · `.view-switch` (+ pressed) · `.nav` (+ `.active`, `[aria-current]`) · `.fab` · `.fab-dial-action` · `.fab-dial-scrim` · `.dev` `.prod` `.env` `.lab` · `.scope` · `.ledger-switcher` · `.toast` · `.command-banner` (+ `--warning`, `--danger`, `__action`) · `.command-chip--success|warning|danger|neutral` · `.command-progress__step` (+ `--active|done|failed`) · `.kitchen-notice` (+ `--warning`, `--danger`) · `.pulse-banner` · `.opinion-banner` · `.register-skeleton-rule` · `.level-skeleton` · `.placeholder` · `.empty` · `.till-empty` · `.hearth-paper-empty` · `.desk-plate-empty` · `.ms-empty-staff` · `.onboarding-noticed` · `.till-offline` · `.register-offline` · `.onboarding-ready-offline` · `.sync-freshness` and all nine `--` state variants.

The KitchenErrorBoundary fallback is covered by the shared `.card` / `.kitchen-notice--danger` surfaces; it has no dedicated class in the supplied legacy CSS. **See §8 — markup request 1.**

### Group 2 — core controls
`.card` · `.stat` · `.pill` · `.chip` · `.primary` · `.secondary` · `.outline` · `.ghost` · `.danger` · `.text-button` · `.link` · generic `button`/`.btn` · `input` · `select` (custom chevron) · `textarea` · `input[type=range]` · `input[type=checkbox]` · `input[type=radio]` · `label` · `.field` · `table`/`th`/`td`/`tbody tr:hover` · `.amount` · `details`/`summary` · `.tabs button.active` · `[role=tab][aria-selected=true]` · focus ring on `a, button, input, select, textarea, summary, [tabindex]`.

States implemented on every control class: **hover, focus-visible, active/pressed, disabled, busy (`.busy` / `[aria-busy=true]`), invalid (`[aria-invalid=true]`)**. Primary carries face + edge + 3px depth and translates 2px into its own shadow when pressed. Minimum target height 44px, re-asserted under `@media (pointer: coarse)`.

Financial and status distinctness preserved separately from scenery: `.in/.is-in/.good/.is-posted/.tone-income`, `.out/.negative/.tone-expense`, `.is-projected/.proj/.is-estimated`, `.is-unfunded/.register-unfunded/.weekly-unfunded` (dashed **and** copper), `.is-refund/.is-credit`, `.is-warn/.attention/.is-overdue/.is-late`, `.adverse`, `.is-deficit`.

### Group 3 — sheets, dialogs, drawers
`.sheet` · `.sheet.guard` · `.sheet-inner` · `.swipe-sheet-inner` · `.purchase-sheet` · `.doc-camera-sheet` · native `dialog` + `::backdrop` · `.sheet.add-slideshow` · `.add-slideshow-inner|title|hint|progress|switch|mode|categories` (+ `.cat.sel`) · `.post-big` · `.add-confirm-summary` · `.preview` · `.preview.warn` · `.due-preview-list` · `.due-preview-row` · `.settle-rows` · `.conflict-cards` · `.swipe-strip` · `.swipe-strip-undo` · `.swipe-error` · `.account-room` · `.account-tile` · `.wallet-tile` · `.desk-sheet`.

**No rule in this file sets `position`, `z-index`, `overflow`, `inset`, `transform` or `display` on a sheet, its inner, or a backdrop.** Confirm controls cannot be covered by anything here.

### Group 4 — paper primitives
`.hearth-paper-tile` (+ `.is-warn`, `.is-active`) · `.hearth-tile-kind|name|value|figure` · `.hearth-story-strip|heading|grid` · `.hearth-wax-seal` + `tone-post`, `tone-due`, `tone-close`, `tone-tan`, `.is-pending`, `.is-pressed` · `.hearth-seal-label|value|sub` · `.hearth-pane-seal` · `.hearth-notebook` + `-head`, `-body`, `-close`, `.is-bare`, `-whisper` · `.hearth-collapse-title` · `.hearth-paper-bars|caption|bar-label|bar-track|bar-value` with `tone-pine|ink|copper` bound to `--theme-chart-positive|neutral|plan` · `.hearth-paper-spark-stem|label` · `.hearth-weather-ribbon|temp|dot`.

Chart geometry untouched — only stroke/fill tokens change. Weather carries no money token in any world.

### Group 5 — office
Phone: `.office-phone` · `.office-phone-c` · `.ph-head|sill|seals|pin|lbl|sub|name|val|value|needs|notebook-inner|chalk|chalk-body|drawer|drawer-grid|rail|stamp|inst|chip`.
Wide: `.office-wide` · `-desk` · `-hero` · `-hero-wrap` · `-hero-net` · `-stage` · `-drawer` · `-drawer-grid` · `-mosaic` · `-mosaic-wrap` · `-plates` · `-banks` · `-notebook` · `-notebook-inner` · `-seals`.
Instruments: `.instrument` + `-header|-name|-glance|-body`, `.is-warn`, `.is-active/.is-open`, and all fifteen named bodies (`-blotter -wallet -calculator -calendar -appointments -mail -timesheet -postcard -cookoff -jars -lamp -game -accounts -wardrobe -chalkboard`), `.lamp-shade`, `.jar-fill`, `.jar-lid`, `.cabinet-row`, `.cabinet-handle`.
Desk: `.desk-canvas|card|item|row|stock|stock-row|ring|sheet|customize|grid-opts|drawer-grid|toggle`, `.desk-item.is-dragging`, `.wax-stamp`.
Furniture: `.office-window` · `.office-sill` · `.sill-plate|label|value|needs` · `.office-glass` · `.glass-clear|rain|night|snow|humid`.
Slate: bound to `--theme-chalk-board` / `--theme-chalk-ink` (§4).

Board stocks are re-toned outside Classic through the world/material blocks only; **density, padding, gap, column counts and layout are never set here.**

### Group 6 — Fund, plates, Level, register, ledger story
`.desk-plate` + `-kicker|-figure|-detail|-caption|-footing|-verdict|-well|-fill|-spark|-mark|-threshold|-tick|-pair-up|-pair-down|-handle|-rail`, `.is-active`, `.is-warn`, `.is-copper`.
`.level` + `-actual|-projected|-zero|-axis|-band|-buffer|-buffer-label|-label|-mark|-mark.is-estimated|-today-line|-today-dot|-dry-mark|-dry-label|-payday-tick|-figure|-headline|-secondary|-status|-skeleton`.
Fund: `.fund-stage-heading|figure`, `.fund-plate-stage`, `.fund-rail-list`, `.fund-rail-arrange`, `.fund-drawer` + `-card|-card-name|-card-line|-card-tag|-slot|-slot-number|-slot-pinned|-intro|-slots-lede`, `.fund-motion-card|status`, `.household-fund-glance`, `.household-fund-panel .card`.
Stages: `.next-out-bar|-bar-fill|-table|-break`, `.week-day|-name|-number|.is-today`, `.week-chip.is-due|is-posted|is-payday|is-shift|is-sitdown`, `.week-range`, `.shape-card|-name|-verdict`, `.shape-band`, `.shape-dot`, `.streams-baseline|-mark|-lane-label|-legend-row|-swatch`, `.accounts-stage-row|-open|-balance|-badge|-gauge|-gauge-fill|.is-chosen`, `.settle-row|-direction-head`, `.waiting-stage-kicker|-decision`, `.waiting-consequence`.
Register / story: `.register` + `-rule|-list-head|-list-item|-title|-date|-list-meta|-legend-label|-value|-total|-total-strong|-status`, `.ledger-story-room|-sheet`, `.ledger-folio-room`, `.books-story-tile`, `.ledger-purpose-banner|-kicker`, `.ledger-flow-node`, `.ledger-action-item`, `.ledger-week-ribbon`.
Month spread: `.ms-axis|-axis-strong|-baseline|-operating-line|-operating-area|-future-line|-future-area|-kitty-line|-kitty-area|-future-kitty|-payday-tick|-claim|-today|-today-dot|-label|-label-copper|-label-pine|-label-kitty|-hatch-line|-slip|-slip-amount|-slip-why|-slip-who|-stamp|-readout|-hit`.
Ask: `.ask-figure` (copper, **never `--danger`**) `-sentence|-caveat|-payday|-ceiling|-rule|-mark|-mark-label|-bar-clear|-bar-short|-whisker-clear|-whisker-short|-route-status-clear|-route-status-short|-door|-raise|-refusal`.

Actual/projected/estimated/threshold distinctions preserved: solid ink vs dashed copper on `.level-actual`/`.level-projected` and `.ms-operating-line`/`.ms-future-line`, dashed `--brass` on `.level-buffer` and `.desk-plate-threshold`, hollow stroke on `.level-mark.is-estimated`.

### Group 7 — calendar
`.calendar-card` · `.calendar-stage` · `.cal-desk-grid` · `.cal-weekdays` · `.weekday` · `.cal-day` / `.cal-desk-cell` + `.today/.is-today`, `.selected/.is-selected/[aria-selected]`, `.outside`, `.is-hidden-phone` · `.cal-title` · `.cal-titles` · `.kind-pill` · all twelve `.kind-*` (bill, paycheck, shift, visit, claim, subscription, google, detected, work-pay, work-tip, work-tipout) · `.dots` · `.calendar-hero-actions .primary` · `.rhythm-card` · `.repeating-form` · `.visit-card` (+ `.is-due`) · `.visit-form` · `.visit-disclosure` · `.visit-cadence-nth` · `.calendar-week-net` · `.claim`.

Category identity uses **three carriers**: a left edge (solid / dashed / dotted per kind), a label, and a dot. Never colour alone. No money renders on the weather layer.

### Group 8 — shift, work, evidence, incoming mobile surfaces
`.shift-page` · `.work-shift-flow` · `.work-jobs-card|job-row|cadence-card|shift-review|shift-step|shift-draft-banner|shift-progress|shift-metrics|report-metrics|history-money|check` · `.timesheet-status|conflict|never-mind` · `.shift-kicker|owed|climate-seal|earn-bubble|earn-bubble-label|lamp-row|preview-caption|emergency` · `.doc-camera-sheet|stage|frame|hint|meter|meter-fill` · `.seven-shifts-panel|inbox|status` · `.duplicate-contrast` · `.contrast-pair` · `.contrast-side` · `.cad-pad|-display|-keys button|-enter`.
Incoming: `.apron-card` (+ inner `.k/.h/.big/.act`) · `.cut-motion|.cut-side.a|.cut-side.b|.cut-handle` · `.count-rail|-head|-note|.count-hist rect` · `.ph-fold` and `.ph-fold-line` · `.phone-spread` · `.spread-page` (+ dots) · `.fund-ledge|-grip|-bar|-sub` · `.fund-board-slot` (+ `.on`).

**Colour, border and type only.** No `height`, `min-height`, `padding`, `margin`, `gap`, `position`, `inset`, `transform`, `touch-action`, `overflow` or `scroll-*` is set on any incoming surface, so gesture geometry, hitboxes and fixed bounds are entirely theirs. Nothing is added inside `.ph-fold`'s four-object composition.

### Group 9 — books, import, audit
`.books-floor|audit-office|scroll|table|pane-blurb` · `.journal-head` · `.statement-note` · `.power-sql` · `.sql-input` · `.wallet-strip|tile|tile-kind|tile-money|wallet-hot|tab[aria-selected]|group-label` · `.sheet.import-review .sheet-inner` · `.import-pair` + `--undecided` (dashed), `--attention` (warn), `--cancel-import` (danger) · `.import-edit-side` · `.contrast-cols > .contrast-side:first-child` (source: recessed, dashed) vs `:last-child` (accepted: card, solid, lifted) · `.import-check--balanced|--mismatch` · `.confidence.useful-green|yellow|red` (solid / dashed / dotted underline, so confidence is never colour-only) · `.import-footer` · `.import-tabs button[aria-selected]` · `.import-receipt-numbers` · `.import-reconciliation`.

### Group 10 — More, charter, onboarding, Hercules, games, wardrobe
`.more` · `.charter-page|-page-inner|-founding-inner|-quote|-rule|-hr|-sig|-sigblock|-num|-revoke` · `.onboarding-shell|card|ready|rail|rail-mark|noticed|card-provenance|ready-error|estimate-error|stop-link|return-bar|return-dot` · `.guided-preview__shell` · `.month-card|opening-card|friction-card|return-card|playtest-card|stopped|proof-pill` · `.hercules-pill|-name|-note` · `.hercules-bubble|focus-shell|focus-body|chat-log|turn|typing|grounded-fact|fact|source|dismiss` · `.hercules-useful.useful-green|yellow|red` · `.ttt-grid|cell` · `.hangman-word|letters` · `.wardrobe|-still` · `.device-list` · `.soft-presence|-opt-out` · `.storage` · `.health`.

**Hercules' rig is not recoloured.** `.herc-root` receives `color: inherit` and nothing else; no rule in this file touches `.herc-body`, `.herc-coat`, `.herc-dress`, any `.herc-pose-*`, or any safe-area offset.

### Group 11 — Appearance picker and atmosphere control
`.appearance-panel` (+ `> header`, `h2`) · `.appearance-eyebrow` · `.appearance-options` · `.appearance-option` (+ hover, `[aria-pressed=true]`, `[data-preview-pending=true]` → dashed outline) · `.appearance-option-name|-description` · `.appearance-miniatures` · `.appearance-miniature` (+ `.is-shared`, `.is-personal`, `i`, `i:first-child`) for all three `[data-preview-theme]` values · `.appearance-actions` · `.appearance-status` (+ `[data-status=error|pending|local]`) · `.theme-atmosphere-toggle` (+ `[aria-pressed]`, and the absolutely-positioned variant inside the scene heading).

Each preview shows a Shared **and** a Personal miniature, which is why both scopes are represented in one card. **No behaviour is added in CSS.**

---

## 3 · Derived variables added (none duplicate a palette literal)

Paired status foreground / background / border, as the brief requires:
`--world-good-bg|fg|edge` · `--world-warn-bg|fg|edge` · `--world-danger-bg|fg|edge` · `--world-info-bg|fg|edge` · `--world-quiet-bg|fg|edge`.

Structure and depth: `--world-on-second` · `--world-sunk` · `--world-raised` · `--world-veil` · `--world-hairline` · `--world-edge-strong` · `--world-lift-0|1|2` · `--world-inset-hi` · `--world-press` · `--world-face|face-ink|face-edge|face-depth` · `--world-focus|focus-halo` · `--world-r-card|control|chip|sheet` (all derived from `--theme-radius`) · `--world-scene-tint` · `--world-scene-weave` · `--world-room` · `--world-mount` (Taylor) · `--world-trim` (Newfoundland) · `--world-motion-slow|mid|fast` · `--world-ease` · `--keepsake-ratio`.

Every one of these is `color-mix()`/`clamp()` over an authored token. **The only two literal colours the file introduces** are:

| Literal | Where | Why |
|---|---|---|
| `--world-slicker: #f2c230`, `--world-slicker-ink: #2b2415` | `:root[data-theme="newfoundland"]` | The brief requires raincoat yellow for controls and seam details. No token in `scenes.ts` carries it — `rain`'s accent `#816318` is a dark gold, not oilskin. **Request: move these into `sceneTokens()` if you want them authored.** |
| `#eadac3 #fff9ed #ab583b #eed5e5 #b2608a #bcdfce #c96030 #b65950 #559395 #d9b656 #b8d3c5 #526b63` | `.appearance-miniature` and its `[data-preview-theme]` variants | Copied **verbatim** from `theme-reference.css` so the supplied picker screenshots reproduce. These are miniature swatches, not palette tokens. |
| `#fdfefb` | `instant-photo` frame | The white photo border; deliberately not `--card`, which is tinted per era. |

`--muted` is consumed as authored. The earlier draft re-mixed it toward `--ink`; that rule was **removed** when you said Codex is darkening the token to ≥4.6:1, because re-mixing would double-darken the corrected value.

---

## 4 · Your integration additions, as implemented

| Addition | Implementation |
|---|---|
| `data-scene-visible=true/false` | `:root[data-theme] .theme-scene-heading[data-scene-visible="false"] *` pauses every descendant animation with `animation-play-state: paused`. Nothing unmounts, so the composition is complete and still the instant it returns. |
| `--theme-chalk-ink` / `--theme-chalk-board` | Fourteen slate surfaces bound to the pair and to nothing else: `.office-chalk-band`, `.office-chalk-body`, `.chalkboard`, `.chalkboard-surface`, `.chalkboard-stage`, `.chalkboard-live-board`, `.chalk-slate`, `.chalk-slate--thumb`, `.chalk-canvas`, `.chalk-glass`, `.ph-chalk`, `.ph-chalk-body`, `.chalk-thumb`, `.chalk-stamp-canvas`. Chalk text, rails, prompts, input, save/eraser and their focus ring all derive from `--theme-chalk-ink`. |
| `.theme-memorabilia > figure[data-keepsake] > img` | §11b. `max-width:100%`, `width:100%`, `height:auto`, intrinsic ratio reserved via `--keepsake-ratio` (16/7 ticket, 3/4 portrait) so nothing reflows on load. Desktop maxima 360px ticket / 240px portrait at ≥720. Mounted paper style per world: scrapbook mount and slight rotation in Taylor, white photo border under `instant-photo`, brass frame in Newfoundland and `gallery`, inset metal frame under `metallic`. `figcaption` styled. `.theme-memorabilia:empty { display: none }` — **no missing-asset placeholder is rendered, and no keepsake artwork is fabricated.** Also handled in forced-colors and print. |
| `scene-forest`, `scene-butterflies` | New `world-forest` (a slow rooted sway from the base) and `world-butterflies` (a drifting arc) keyframes, both `transform`-only, both in the pause and reduced-motion sets. |
| Distinct summit composition | `:root[data-scene="summit"]` retimes fog (26s), clouds (22s), grass (7.4s) and the flag (3.6s) — the air moves further and slower at the summit than at the harbour. |

---

## 5 · Scene and material differences

**Classic (1 material — `paper`).** 18px corners, a warm raised-paper gradient on every card, `--world-inset-hi` lamp edge, terracotta-biased card rule, terracotta→pine gradient on the primary reading surface, warm radial room ground, terracotta tab underline.

**Taylor (12 materials).** Base: every card mounted on a 5px paper mount, asymmetric heading corners, asymmetric overview corners, accent tab underline.

| Material | Scene | What visibly changes beyond the header |
|---|---|---|
| `vellum` | Lover | Translucent card faces with `backdrop-filter`, a tape strip on `.card::after`, fully pilled controls, accent-depth primary |
| `cloth` | Red | 1.5px wine border + dashed stitch outline inset on cards, dashed inner stitch on primary/secondary, dashed chips, doubled tab underline |
| `gold-thread` | Fearless | Fine gold rules: card border, inset hairline, `th` rule, primary border, chip ring, seal ring |
| `newsprint` | reputation | 2px radius everywhere including inputs, Figtree 700 headings, 3px accent rule on top of cards, `.18em` uppercase heads, 2px tab rule |
| `plaid` | evermore | Woven header, 1.5px rust border, woven 4px cap on `.card::before`, rust chips |
| `instant-photo` | 1989 | 9px white frame + 1px sky-blue mount, 3px radius, extra bottom padding, Figtree headings, sky-blue primary depth |
| `satin` | Showgirl | Diagonal sheen on card faces and the primary, mint chip ring, circular seals |
| `midnight-paper` | Midnights | Navy/silver: accent border, silver inset top rule, silver `th`, radial navy header |
| `ribbon` | Speak Now | A violet ribbon tail on `.card::after`, fully pilled controls, 4px tab underline |
| `manuscript` | Poets | Ruled 29/30px card ground, IBM Plex Mono headings and fund stage headings, 4–5px radii, 6px seals |
| `botanical` | debut | Blue-green border, 3px inset growing edge, second-colour chip ring and primary border |
| `linen` | folklore | Woven 3/4px cross-hatch on card faces, forest-pencil kickers and `th`, forest primary depth, dashed ghost |

**Newfoundland (12 materials).** Base: 1.5px ink-biased border, painted 5px colour cap on the primary reading surface, 12px seals, 4px tab underline, trim-coloured primary depth.

| Material | Place | What visibly changes |
|---|---|---|
| `painted-wood` | Jellybean Row | 15/16px clapboard grain on cards, 5px accent left trim, 5px second-colour tile cap, 4px phone-pin cap |
| `raincoat` | Rainy St. John's | Slicker border + inset seam, 4px slicker bottom seam, **slicker primary with dark ink**, slicker selected chips and stamps, warning still uses its own token |
| `trail-paper` | The coastal way up | 112° contour hatch on cards, second-colour border, 3px inset paper margin, dashed ghost |
| `dock-ledger` | The harbour | 27/28px ledger ruling, navy border, 2px navy `th` rule, brass primary depth and chip ring |
| `metallic` | Back at JAG | CSS repeating 45°/−45° diamond lattice on the room **and** the header (from the SVG diamonds), 4px radius, `inset 0 0 0 5px card / 6px line` gold frame, **smooth un-patterned content panels**, 3px control radius |
| `receipt` | Water Street | Perforated top edge via `mask-image`, 3px radii, monospaced figures and table cells |
| `kitchen` | Quidi Vidi | Berry cloth 5px dashed cap on `.card::before`, second-colour border, berry primary depth, 10px seals |
| `horizon` | Cape Spear | Open sky gradient card face, faint border, near-flat elevation, wider heading radius |
| `venue` | George Street | Amber halo ring on cards, glowing amber primary, glowing tab underline |
| `clapboard` | The Battery | 13/14px stepped grain, 5px second-colour bottom trim, alternating accent/second tile caps |
| `sky` | At the summit | Palest gradient faces, translucent borders, lightest elevation in the set |
| `gallery` | JAG after hours | 2px brass frame with an 8px paper mat, 4px radii, matted seals |

---

## 6 · Reference comparison — what was actually checked

I built a static specimen (`spec-<scene>.html`, not shipped) that reproduces the `ThemeStudio` DOM, applies `sceneTokens()` output as inline custom properties on `<html>` with all five data attributes, loads `theme-reference.css` and then `worlds.css` last, and rendered it in Chromium.

**Compared against the supplied references:**

| Rendered | Against | Result |
|---|---|---|
| `lover` @1100 | `taylor-household-home-1100.png` | Matches on structure and material: mounted cards, vellum translucency, accent→second gradient on the overview, circular wax seals in post/second/gold tones, bracelets top-right, 218px studio heading. |
| `jag-lobby` @1100 | `newfoundland-household-more-1100.png` | Matches: dark ground, gold diamond lattice in the header, gold-framed square cards with the inset double frame, painted top trim on the overview, rounded-rect seals, gold accents. |
| `reputation` @1100 | `taylor-household-ledger-1100.png` | Rendered and inspected; newsprint squaring, Figtree headings and dark palette resolve as authored. |
| `jellybean` @390 | `newfoundland-household-home-390.png` | Rendered at phone width; heading, painted trims and tile caps resolve. |

**A finding from this pass, worth having:** my first harness put the data attributes on a wrapper `<div>` instead of `<html>` and **not a single rule applied**. That is the intended behaviour — the file is strictly root-scoped — and it is also the fastest smoke test you have: if `worlds.css` appears to do nothing, check that both `data-theme` and the scene attributes are on `document.documentElement`.

**Two known differences between my specimen and the references are harness artifacts, not CSS defects:** my replica's `.hearth-wax-seals` uses `flex: 1` so the seals render wide rather than circular, and web fonts did not load in the sandbox so type renders in fallback faces.

---

## 7 · Accessibility — found and fixed

- **`--theme-on-accent` is authored dark on dark scenes.** Nothing in this file sets white on a primary or state background. `.primary`, `.post-big`, `.fab`, `.cad-pad-enter` all take `--world-face-ink`; `.hearth-wax-seal` takes `--world-on-second`, which is defined as the same authored pairing so **no surface assumes pine is dark**.
- **Oilskin yellow.** `--world-slicker` is a mark colour. Anywhere it is a face — `raincoat` primary, selected chip, `.wax-stamp`, `.ph-stamp`, `[data-slicker]` — the text is forced to `--world-slicker-ink` (`#2b2415`, ≈ 11.9:1 on `#f2c230`). It is never a text colour on paper.
- **Warning meaning preserved separately.** Under `raincoat`, where yellow is decorative, `.command-banner--warning`, `.kitchen-notice--warning` and `.preview.warn` are re-asserted on `--world-warn-*` so a warning never dissolves into the theme.
- **No colour-only state.** Unfunded is dashed as well as copper; confidence is solid/dashed/dotted; import source is dashed and recessed while accepted is solid and lifted; today is a 2px inset ring plus weight; selected chips gain weight and an inner ring; calendar kinds carry a left edge whose *style* varies by kind.
- **Focus** is a 2px accent outline, offset 2, plus a 4px halo so it survives a patterned scene. Never removed.
- **Type floor.** No essential label is set below 12px anywhere in this file; `.theme-scene-kicker` is the single 10px rule and it is decorative.
- **Busy states** do not move an amount: the spinner replaces the control's own label, and no financial figure animates anywhere.
- **Legibility over pattern.** `metallic`, `plaid`, `venue` and `newsprint` get a feathered radial scrim behind `.theme-scene-copy` (a `::before`, `z-index:-1`) rather than a drawn panel.
- **Zoom** stays functional: no viewport-unit font floor, no clipping container, `overflow-wrap: anywhere` on scene copy.
- **Forced colours**: decorative imagery removed, Canvas/CanvasText/Highlight throughout, `background-image: none`, and every non-colour carrier (dashed/dotted/outline) retained.

---

## 8 · Remaining markup requirements for Codex

1. **KitchenErrorBoundary fallback needs a class.** There is no dedicated selector in the supplied legacy CSS, so it currently inherits `.card`. Suggest `.kitchen-error-fallback` and I will treat it as a designed error surface rather than a generic card.
2. **`.appearance-option` preview-vs-applied.** The picker uses `aria-pressed` for both "previewing" and "applied". I style `[data-preview-pending="true"]` as a dashed outline so the two are not colour-only — that attribute does not exist yet. Add it to the option button while `preview !== null`.
3. **`.appearance-status` state hook.** I style `[data-status="error|pending|local"]`; today the status is text-only. Add `data-status` to the `<p class="appearance-status">`.
4. **Keepsake kinds.** I key desktop maxima off `figure[data-keepsake="ticket"]` and `="portrait"`. Confirm those two literal values, or send me the vocabulary you intend.
5. **`--world-slicker` should probably be authored.** Raincoat yellow is a design decision, not a derived value; moving it into `sceneTokens()` would keep every literal in one place. Until then it lives in the `newfoundland` block.
6. **Slicker opt-in hook.** `[data-slicker]` / `.is-slicker` are provided for any element you want painted in oilskin yellow with guaranteed dark ink. Nothing sets them yet.
7. **`.ph-fold` composition.** I style only its rule colour and the `::after` label. If the fold's four objects need per-object theming, they need per-object classes; I did not invent any.
8. **Chalk toolbar buttons.** `.chalk-actions button` is styled generically. If those buttons carry `.ghost`, tell me and I will drop the generic rule.

---

## 9 · Tests actually run

- **CSSOM parse in Chromium** — 764 top-level rules, 7,118 declarations, **0 dropped rules**, **0 rules that lost all declarations**. Re-run after every edit including the final scrim change.
- **Brace balance** — 0, verified by scan.
- **`!important` audit** — 61 occurrences, all inside the four blocks named in §1.
- **Keyframe audit** — 19 `@keyframes`, every one `world-` prefixed, every one transform/opacity only except the four that also fade opacity (`world-fog`, `world-rain`, `world-steam`, `world-metal`), which is permitted.
- **Static specimen render** — four scenes across two worlds and both lightings, at 1100 and 390, in Chromium, compared against the supplied references (§6).
- **Root-scoping check** — attributes on a non-root element produce zero applied rules, confirming the scoping contract.

---

## 10 · What has NOT been visually verified

State this plainly, because it matters:

- **The real application has not been rendered at all.** I have no repository checkout, no build, no React runtime. Everything in §6 is a static specimen of the studio DOM, not the App.
- **21 of the 25 scenes** have never been rendered in any form. Their material rules are written against the same token contract as the four checked, but they are unproven visually.
- **No page other than a Home-shaped studio layout has been seen.** Calendar, Plan, Ledger, More, Till, Shift, Books, Import, Onboarding, Charter, Hercules and every sheet are covered by selector and reasoning only.
- **1440 and 320 were not rendered.** Their rules are written; only 390 and 1100 were photographed.
- **Contrast ratios were reasoned from the token definitions, not measured** with a contrast tool against rendered pixels — except the slicker pair, which I computed. The eighteen `--muted`-on-`--paper-2` style pairings across 25 scenes need a real computed check; your `--muted` darkening pass may already have settled them.
- **Print and forced-colors output was not rendered.** Both blocks are written and parse; neither has been seen.
- **Reduced-motion and paused states were not photographed**, only authored.
- **No claim of pixel fidelity is made** for any scene, including the four rendered. The two matches in §6 are structural and material, judged by eye against the references.
- **Keepsake styling is untested against real assets** because none were supplied. Nothing was fabricated to stand in for them.
