# Worksession — shared Home becomes three 3D worlds

**Date** 2026-09-14 · **Branch** `claude/queen-worlds` · **Base** `claude/queen-garden-cat@177d2c7`
(which sits on `origin/main@f046195`) · **Risk** Medium-High
**Budget delta (5)** +0 · **Engagement delta (3)** +3

## What Jonathan asked for

> "Turn each shared home screen into a 3d world. The lover inspired scene should
> feel like I'm in a cotton candy cloud world. The newfoundland should feel like
> st johns harbour page but for jellybean row, as well as 3d. The office page
> should be home office with a whole lot of plants and coffee inspiration."

Three decisions he made when asked:

1. The third world is **Classic Hearth's shared home** — the kitchen table
   becomes the home office, rather than the separate Office page.
2. **Ambient motion allowed.** The world moves on its own. This deliberately
   overrides "nothing moves unless touched" from the Still Queen brief, for the
   world only — she still breathes on her own 6 s loop and nothing else on the
   page moves untouched.
3. Jellybean Row carries **all three** things from the harbour page: its depth
   and layering, its palette and light, and its level of detail.

## The shape of it

Shared home resolves to exactly three scenes (`resolveThemeScene(theme, "home",
"household")`): `classic-home`, `lover`, `jellybean`. `queenSceneryKind` maps
those three and nothing else, so no other route grows a world by accident.

`src/queen/world/queenScenery.ts` builds one world at a time under three rules,
written at the top of the file: **depth is three layers, never a backdrop**;
**she is the subject**; **motion is ambient and optional**. `tick(seconds)` is a
pure function of the clock — the same second is always the same frame, which is
what makes a screenshot a screenshot and what lets the caller stop asking for
frames without the world drifting.

`queenWorld.ts` gains `setScenery(kind, paper)` and `setAmbient(on)`, and the
breath loop becomes one ambient clock that drives her breath and the world
together. A page with neither running asks for no frames at all.

`QueenSceneryFlat.tsx` is the drawn twin: the same three layers, the same
palette, the same three gestures in CSS so `prefers-reduced-motion` and a paused
atmosphere stop them exactly as they stop the 3D clock.

## Decisions worth naming

- **The world's sky ends in the page's own paper.** Each scene's `--paper` is
  passed in as the gradient's last stop, so the canvas has no visible edge.
- **A level camera cannot look down.** The near layer is therefore things that
  stand *up* from the ground close to the lens — the harbour page's pilings, as
  a kerb and two bollards — not a railing floating below the floor. The first
  attempt at a railing was invisible because it sat under the ground plane.
- **The harbour is a standing band, not a plane.** For the same reason: depth is
  bought by stacking bands behind the row rather than by tilting the world.
- **Nothing in a world may be named like one of her reserved channels.** A test
  enforces it; it caught `queen-office-vine` colliding with the mandevilla.

## Verification

`tsc` clean. `pnpm test -- --risk=medium-high --focus=test/queen-scenery.test.ts`
→ `quick-gate-passed`, 10 files / 142 tests, 92.6 s of a 300 s budget, no breach.
Eight new tests in `test/queen-scenery.test.ts`.

Browser evidence: `docs/evidence/queen-worlds/` — 21 records across
320/390/720/1100, all three worlds, 3D and no-WebGL and reduced motion.
`overflowX` and `overflowY` are 0 in all 21; 0 page errors; exactly one world on
screen in every record. Frame cost 3.4–9.9 ms steady on SwiftShader.

## Not verified / weakest

- **No phone.** SwiftShader on a container CPU is an upper bound, not a device.
  A continuous rAF is a real battery cost on a phone and it is the direct
  consequence of the ambient-motion decision; it wants a device measurement.
- The full `test/queen-world-layout.mjs` suite was not re-run end to end.
- No axe run in this pass; the worlds add no controls and no text, but the claim
  is untested here.
- The three worlds are **not** authored against Taylor's twelve eras or
  Newfoundland's twelve places — only the three shared-home scenes have worlds.
  Every other scene keeps the bare field.
- `.queen-home[data-world]` reports `flat` under a live canvas. Reproduced on an
  unmodified checkout, so it predates this work; not fixed here. The drawn world
  does not depend on it.

Local branch and patch only — not pushed, not a PR, not merged, not deployed,
not live verified.
