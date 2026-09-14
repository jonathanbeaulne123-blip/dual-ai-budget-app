# Worksession — the cellar and the loft become 3D rooms

**Date** 2026-09-14 · **Branch** `claude/queen-rooms` · **Base** `origin/main@4155bcf` (#475)
**Risk** High (a field is added to a synced household row) · **Budget delta (5)** +0 ·
**Engagement delta (3)** +3

## What Jonathan asked for

> "Now we need to give the cellar and the loft the same 3d treatment."

With two prototypes as the brief: *The Queen's Ribbon* for the cellar and
*The Hearth Shelf* for the loft. Asked, he chose **to include reordering in
this pass** and, on shared authorship, **"right now just make it so last edit
wins. no proposing or confirming."**

That second answer settles a question that has been open for five rounds, and
it removes the prototype's whole propose/agree/ledger apparatus. It is not
built here, deliberately.

## What changed

- **`queenRoomWorld.ts`** — the Home world's pattern applied to a room: one
  renderer, one scene, one still camera, sculptures placed where the DOM keeps
  their controls. A stone cellar with a barrel vault, a bulb over the gate and
  a shelf of bottles; a loft with a dormer, rafters, a light beam and a wooden
  ledge. Dust is the only ambient motion and reduced motion never starts it.
- **The cellar** now runs its ribbon past a **fixed gate**: drag it, scrub it,
  or use the arrow keys, and whatever stands in the gate is what the line
  beneath is about. Sprocket holes, month labels, the outlier stepped out with
  a dotted hole behind it.
- **The loft** now carries **arrangement as data**: left is fed first. Drag a
  bank, or Shift with an arrow key, and the shelf's order is saved. Picking a
  bank up puts it *in hand*, which is the only place a figure appears.
- **`queenPresentation.ts`** — jars gained a `swell` and a `fill`, banks gained
  `fullness`, a `size` band and `parts`. All are clamped **and quantised to a
  twentieth**, so a shape cannot be read back as a dollar figure.
- **`kittyNestDesigns.ts`** — `order?: string[]` on a plan bank's design row.

## Decisions worth naming

- **The order lives on one row, not on each bank.** A goal bank has no design
  row of its own (`goal:<id>` is not an allowed `bankKey`, and goals keep their
  look on the goal envelope), so per-bank ranks would have needed the allowlist
  widened — and a goal with a design row would start taking its *name* and
  *category* from that row, which is a real bug waiting. One list on
  `plan:build` avoids all of it, and makes one rearrangement one save.
- **Pick-up is a click, not a pointerup.** The first cut handled it on
  pointerup, which meant Enter and Space did nothing — a keyboard user could
  not pick a bank up at all. Pointer events now carry the drag only.
- **Nesting is deliberately not built.** The shelf prototype lets you drop a
  goal inside a goal. That changes what a goal contains, which is money
  structure, not arrangement. Flagged, not built.

## Verification

`tsc` clean. `pnpm test -- --risk=high --focus=test/queen-rooms.test.ts` →
`quick-gate-passed`: 14 files, 186 tests (13 fast files / 179, 1 serial / 7),
141 s of a 300 s budget, no breach — including `command-contract`,
`command-runtime` and `proof-matrix`, which is what a synced-row change needs.
The Bianca regression AGENTS.md requires for household-shape changes
(`app-startup-p1` + `month-rehearsal-mainline`) is green at 83/83.

Six new tests in `test/queen-rooms.test.ts`. Browser evidence:
`docs/evidence/queen-rooms/` — 14 records, both rooms, every width, 3D and
no-WebGL and reduced motion; 0 scroll and 0 page errors in all 14; no figure on
the ribbon or the ledge in any of them.

## Not verified / weakest

- **This is a High-risk change and it has not had the independent trust review
  AGENTS.md asks for.** A field was added to a synced household row. It is
  optional, fail-closed in the shaper, allowed only on a plan bank's row, and
  carries no money — but the review is still owed before merge.
- No phone; SwiftShader only. Two 3D rooms on top of Home's world is more WebGL
  than this app has ever asked a device for, and nobody has measured it on one.
- No axe run in this pass.
- Nesting is not built (above). Neither is reordering **Protect** — the cellar
  is a ribbon, not a shelf, so there is nothing there to reorder yet.
- With last-write-wins, one person's rearrangement silently changes the ledge
  for both. That is what was chosen; it is worth knowing it is what happens.

Local branch and patch only — not pushed, not a PR, not merged, not deployed,
not live verified.
