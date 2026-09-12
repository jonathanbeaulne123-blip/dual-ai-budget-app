# Authored Hearthside rooms

`RoomScene.tsx` is a presentation component for the Common room, Studio, Conservatory and Theatre in Classic Hearth, Taylor’s Scrapbook and Newfoundland. It accepts an already authorized shared-life projection; it has no ledger, identity, transport, storage, money or command imports. The twelve environments use original SVG architecture and working furniture. Six depth layers separate the view, architecture, thresholds, furniture, actual objects and foreground light.

## Host integration

Import `RoomScene` and pass `room: 'common' | 'studio' | 'conservatory' | 'theatre'`, the existing `ThemeId`, and `objects: RoomSceneObject[]`. The module imports its own scoped `roomScene.css`. No dependencies or package changes are needed.

Each object has a stable unique `id`, `kind: 'experience' | 'note' | 'memory' | 'piece'`, full `label`, optional `detail`, optional normalized `x`/`y`, and `onActivate()`. Optional `surfaceLabel` gives the scene a short label without shortening the full native control name or object index. Optional `preview: ReactNode` places the host's canonical picture or authored Kitty render inside the object art frame. The default mark identifies an object kind; it is not a rendering of the chosen pottery design. A Kitty host must provide that canonical preview to show the selected design.

- Supply objects only after the host's ordinary shared-room visibility checks. Do not pass vault/private letter records, personal accounting, guest source graphs, balances or unapproved partner presence. The component does not implement or replace that boundary.
- `onActivate` opens the existing object/detail route. It never directly posts money.
- `onArrange(id, x, y)` receives an explicitly saved request, clamped to the canonical 0.08–0.92 range and rounded to three decimals. The host executes its existing shared arrangement command, handles rejected/pending state, and passes accepted positions back. The component's status says “Position requested”; it does not assert persistence.
- `onNavigate(room)` activates the native connected-room door controls. With no callback, navigation controls are omitted.
- `intention: {label, objectIds}` renders a shared caption, marks actual linked objects and draws short local connections only where linked objects are nearby. Supply verified existing links; the component does not infer relationships or synthesize an intention.
- `paused` and `illustrated` stop ambient motion. The component also pauses while a control has focus and while the illustrated stage is offscreen. OS reduced motion removes animation and transitions. No WebGL or animation loop is required.

The first eight objects appear in the illustrated room. Every object remains in the complete, wrapping native object index. Phone scenes use separate semantic anchor slots; repeated kinds use distinct two-column rows. Desktop uses spaced two-row defaults for denser/repeated collections. The stored coordinate is preserved across themes and viewport changes. Rendering leaves safety margins around the title and room edges so an extreme accepted coordinate does not hide or clip its control. The arranger offers two native ranges, Save, Cancel and Escape; closing restores focus. A room change cancels an unsaved arrangement; changing themes keeps it.

## Verification

Run the repository's focused quick gate with `test/hearthside-room-scene.test.ts`. Run `node scripts/hearthside/rooms-proof.mjs` from the repository root for the deterministic synthetic browser harness. It requires the existing Vite, React, Playwright, axe packages and locally installed Chrome. Its Vite cache stays in ignored `scripts/tmp/node_modules/.room-scene-vite`; it does not modify the application, dependencies, household state or external services.

The proof first compiles a production ES component bundle in memory. It records the full matrix at widths 320, 390, 719, 720, 1100, 1440 and 1920, all four rooms and all three themes. It checks overflow, six layers, a conservative 2,500-node/120KB gzipped SVG ceiling and minimum 44px controls, and runs axe at 390 and 1440. Additional cases cover long/full labels, sparse rooms, eight repeated objects at 320 and 1440 in all three themes, text enlargement, real activation/navigation, keyboard arrangement, all four placement extremes at three widths, cancel/focus return, the open arranger, offscreen/pause/focus/illustrated/reduced-motion behavior and browser errors. Synthetic screenshots and `evidence.json` live in `docs/evidence/hearthside-rooms`.

This is component-in-host-harness evidence. Root integration must still prove the actual App, canonical Kitty previews and shared-object routes, authentication/scope filtering, acknowledged arrangement persistence across devices, global fixed navigation/Household Fund clearance, WebKit/mobile devices and any program-level release gates. No actual household memorabilia is fabricated by these illustrations or fixtures.
