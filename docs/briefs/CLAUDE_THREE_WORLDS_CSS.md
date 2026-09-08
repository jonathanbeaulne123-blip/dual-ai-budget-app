# Claude production CSS commission — three complete Hearth worlds

Owner: Jonathan. Design/code/integration: Codex. Your assignment: production CSS implementing the supplied Codex references, not new design decisions. Baseline main `6fb15c7a98f3336862bb743b836aa96a358a35b9`; implementation branch `codex/three-visual-worlds`. Work from this packet, not the stale main checkout or earlier theme conversation. Risk: Medium presentation. Budget delta 0; engagement delta +3 intended. No financial behavior, identity, posting, scope, or copy changes.

## Accepted direction supersedes previous theme discussions

Exactly three global worlds. Classic is a richer uniform cream/pine/terracotta kitchen. Taylor is an intimate scrapbook across all 12 eras. SHARED HOME = LOVER, PERSONAL HOME = THE LIFE OF A SHOWGIRL. Both Home spreads have two separate Jonathan/Bianca bracelets. Newfoundland has 12 distinct places including the 2+ hour coastal approach to Signal Hill, summit, JAG metallic patterned lobby/music corner, Jellybean Row, raincoat yellow, Quidi Vidi, Cape Spear, Water Street, George Street, harbour and Battery. There are NO light/dark variants; scenes have authored lighting. Rich ambient motion with pause/reduced-motion. Themes belong to the signed-in person across devices. Personal photo derivatives will be public assets, but those photographs are not yet supplied and must not be fabricated.

## Deliverables

Return downloadable `worlds.css` and `CSS_COVERAGE.md`, preferably in `hearth-three-worlds-css.zip`. The integration target is `src/theme/worlds.css`, imported once AFTER existing static CSS. Do not modify TS/TSX, tokens, drawing coordinates, data, finance labels, App routes, auth, any Worker, migrations, or package files. The input ZIP contains only code, design references and synthetic screenshots; no user ledger data or secrets. Do not use connectors or visit unrelated sources.

This is a complete production stylesheet assignment: cover the actual application selectors listed below, not just the studio. Return unresolved required markup hooks to Codex separately. Do not claim pixel fidelity without comparing against attached references. All files supplied for legacy visual rules are implementation evidence; Jonathan's latest approved three-world direction supersedes the old uniform-paper/no-dark constraints.

## Sources and exact contract

- `src/theme/scenes.ts`: FINAL era/place assignment, palettes, semantic token names, material/motif IDs. Do not change these. Runtime root is `html[data-theme][data-scene][data-material][data-scene-lighting][data-atmosphere]`. Lighting: `light|dark`. Atmosphere: `playing|paused`.
- `src/theme/SceneArtwork.tsx`: actual original SVG scene drawings and bracelet markup. Its geometry stays. Decor layers are inert; never blanket recolour SVG descendants.
- `src/theme/theme-reference.css`: Codex's reference rules for the synthetic studio. Translate shared rules into production selectors, and scope studio-only layout rules to `.theme-studio`. Keep reference screenshots reproducible with production CSS loaded last.
- `src/theme/ThemeStudio.tsx` and `src/theme/PaperTheme.tsx`: actual production primitives and specimen structure. Studio is DEV only, with no loaded household, auth or money writes.
- `references/`: deterministic 390/1100 screenshots from ten significant scene/page combinations. `reference-index.json` says these are design references, not full-App verification.
- `legacy-css/`: existing application styles, plus selector coverage notes below. Lazy page CSS can load later; use a root `[data-theme]` scoping prefix to win deliberately, not indiscriminate `!important` or `section,button,svg *` overrides.

## Composition and typography

Figtree body/controls; Fraunces readable numeric figures; scene headings use `--theme-display` (bold Figtree for reputation/1989; IBM Plex Mono for poets). Body line-height 1.5; financial digits tabular. Follow reference tokens/colours exactly. Preserve existing layout outside new named theme elements. Primary control min-height 44px, deliberate face/edge/pressed depth; secondary framed, ghost quiet; distinct hover/focus/active/disabled/busy/invalid states. No font sizes below 12px for essential labels. Decorative scene kickers can be 10px.

App `.theme-scene-heading`: desktop 160px, phone 130px; studio retains reference 218px desktop/235px phone. The 130px phone Home header has title left, bracelets right (about 150x78px), caption under title, atmosphere button bottom left. At 320px compact title to 21px and bracelets to 128px wide. Avoid financial control displacement by tall scenery. Existing mobile fold/ledge geometry must remain intact; for incoming `.ph-fold`, do not add spacing inside its four-object composition. Scenery changes no root fixed heights or overflow.

Classic: 18px card corners, warm raised paper, terracotta/pine highlights; subtle scene-specific heading art. Taylor: paper faces and mounted cards with material-specific borders/textures. Vellum translucent tape; cloth stitched wine red; gold-thread fine gold rules; newsprint angular silver and dark paper; plaid rust woven edges; instant-photo crisp white framing/sky blue; satin mint/orange sparkle; midnight-paper navy and silver; ribbon violet flourishes; manuscript ruled/archival; botanical blue-green; linen forest pencil. Every material must visibly affect controls/cards/tabs/widget framing, not only the scene header.

Newfoundland: painted-wood architectural trims; raincoat yellow controls/seam details; trail-paper contour edges; dock-ledger navy/brass; metallic geometric-patterned JAG with inset gold frames; receipt warm shop-counter/perforated sheets; kitchen painted wood/berry cloth; horizon Cape Spear open sky; venue dark George Street amber; clapboard Battery stepped trims; sky summit open pale surfaces; gallery JAG warm music frames. For JAG use CSS repeating geometric patterns inspired by the existing SVG diamonds; dark smooth content panels, no busy patterns under text. Raincoat primary yellow needs DARK text. Preserve semantic warning meaning separately.

## Full component coverage checklist

1. `body`, `.app`, `.app-shell`, `.welcome`, `.welcome-card`, entry/membership/invitation/QR and KitchenErrorBoundary fallback, `.view-switch`, `.nav`, FAB/scrim, title/header, scope/member/environment labels. All loading/error/offline/recovery surfaces and skeletons.
2. `.card`, `.stat`, `.pill`, `.chip`, `.primary`, `.ghost`, `.danger`, regular buttons/inputs/selects/textarea/range/checkbox, tables, details/summary, active tabs, focus rings. Keep financial/status signs and categories distinct.
3. `.sheet`, `.sheet-inner`, `.sheet.guard`, native dialog/backdrop, `.sheet.add-slideshow`, `.add-slideshow-*`, `.post-big`, `.add-confirm-summary`, `.preview`, `.preview.warn`, payment/account drawers and due/correction/Undo sheets. Never change position/z-index/overflow or cover Confirm.
4. `.hearth-paper-tile`, `.hearth-wax-seal` and tones, `.hearth-notebook` including bare/whisper, story grids, `.hearth-pane-seal`, `.hearth-paper-bars`/sparks. Charts use stable positive/negative/neutral/plan tokens and exact geometry.
5. Phone `.office-phone`, `.ph-pin/.ph-chip/.ph-notebook-inner/.ph-chalk-body`; wide `.office-wide-stage/.office-wide-drawer`; movable Office `.instrument-*` (blotter/wallet/calculator/calendar/appointments/mail/timesheet/postcard/cookoff/jars/lamp/game/accounts/wardrobe), `.wax-stamp`, furniture/window/sill/glass, desk-sheet/options. Three app themes override board stocks only outside Classic; density and layout stay.
6. Fund rail/stage/Level/Next Out/Week/Waiting/Settle/Shape/Streams/Accounts/drawers; `.desk-plate*`, `.level*`, ledger-story and register classes. Preserve actual/projected/estimated/threshold distinctions and sign labels.
7. Calendar `.calendar-card`, `.cal-day` today/selected/outside, `.cal-title.kind-*`, `.kind-pill`, dot categories, appointment/recurrence/Google wrappers. Finance categories retain distinguishable text/icon/colour, no money on weather.
8. Shift/job/timesheet/evidence/report/camera, wage/tip charts, duplicate/correction, incoming `.apron-card`, `.cut-*`, `.count-*`. Incoming `.ph-fold*`, `.phone-spread/.spread-page`, `.fund-ledge*`, `.fund-board-slot` keep fixed gesture/hitbox/scroll geometry.
9. Books wallet/accounts/Fund/register/import/Audit/statements/reconciliation/close, `.sheet.import-review`, `.import-pair--*`, `.contrast-side`, `.confidence.useful-*`, `.import-check--*`, `.import-footer`; source vs accepted panels remain distinct.
10. More/Charter/onboarding/rehearsal, recent changes/recovery/Pairing, integrations/permissions/timezone/location/export. Danger states must stay unmistakable. All Hercules chat/focus/pill/bubbles and games/wardrobe; preserve current rig/coat and safe-area offsets.
11. `AppearancePicker` and `AtmosphereControl`: exact markup in packet; three previews represent BOTH scopes. Selected, preview, apply, cancel, pending, failure/retry states. No added behaviour in CSS.

## Semantic and technical requirements

Use existing `--paper/--paper-2/--card/--ink/--muted/--line/--pine/--pine-2/--copper/--gold/--good/--danger` aliases and `--theme-accent/--theme-second/--theme-on-accent/--theme-radius/--theme-display/--theme-chart-*`. Add paired CSS variables for semantic status foreground/background/border where required. No surface assumes pine is dark: some authored dark scenes have light accent tokens. Never blanket set white text on primary/state backgrounds. Ensure AA normal text (4.5:1), large text/UI boundaries (3:1).

Decorative animations only transform/opacity where possible; rain/fog/waves/sparkle/ribbon/steam/glow/beacon/grass/gulls/metal-light receive distinct loops. Pause all scene effects when root data-atmosphere=paused; reduced-motion still composition; stop only decor, never work timers or data progress. No flashing, moving amounts or blocking page transitions. Keyframe prefixes `world-`. No new soundtrack.

Forced-colours media rules LAST, use Canvas/CanvasText/Highlight and remove decorative images. Print LAST with white background, dark text, clear tables, no scenery/navigation/picker. Keep document zoom functional. Full viewport checks: 320,390,720,1100,1440. Do not change breakpoint 720, fixed ledge/nav bounds, pointer hitboxes, auth/provider iframe internals.

## Return evidence

CSS_COVERAGE.md: list selectors implemented for every checklist group, scene/material differences, reference comparisons, accessibility issues found/fixed, remaining markup requirements, and tests actually run. State what has NOT been visually verified. A generic theme override or partial era set is not an acceptable complete return.

Codex integrates the returned file, audits source and candidate screenshots, runs focused component/account/whole-App tests and build, then prepares a reviewable candidate. No merge/deploy/schema or Production action is part of this CSS assignment.
