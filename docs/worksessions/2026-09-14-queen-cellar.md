# Hearth worksession — The cellar's bill rail (bills as jars, the hammer, the crack, the shard)

- **Status:** OPEN — local branch and patch; not pushed, not a PR, not merged, not deployed, not live verified
- **Opened:** 2026-09-14 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (UX, accessibility, visual quality)
- **Repository:** `jonathanbeaulne123-blip/dual-ai-budget-app`
- **Branch:** `claude/cellar-bill-banks`
- **Baseline SHA:** `b462df06f9d56b5b8daf25ba862bf240ccf028f0` (`origin/main`, #477 — the 3D rooms and the ledge order)
- **Head SHA:** see the commit on the branch / `cellar-bill-banks.patch`
- **PR or issue:** none — deliverable is a `git format-patch` file
- **Risk:** Medium-High (a new door onto an existing money command, behind `VITE_QUEENS_NEST`, behind the app's Final Confirm; no new command, no schema, no sync change)
- **Decision owner:** Jonathan (D-256)
- **Environment impact:** none — fictional fixtures only

## Household outcome

The cellar opens on this month's bills. Time runs along the rail, one cell a day; every bill stands on its due day as a jar whose shape says what it is (a house bill, a subscription, a recurring payment, a planned expense, an appointment) and whose water says how much its bank has saved. Behind the rail the Fund's own walk is the water in the cellar, day by day, with the buffer as a tidemark. Nothing on the rail is a number; the line beneath the gate says the rest — how much is saved, how much is left to be safe, and where the water stands after.

The rule is Jonathan's, exactly: when a bill's day comes and its jar is full, **the hammer leans on the rail** — and it is always by hand. Breaking the bank posts the bill in the books through the app's existing Final Confirm; the jar stays on its day as a shard. A bill that is due but not full gets **a crack instead of a hammer**: you can still pay it (that is real life), and the sheet says the rest comes from the Fund's water, which the walk beneath then shows. A bill paid anywhere else in the app is already **a shard** — no hammer. A jar that is full but not yet due shows nothing to strike: the water just sits there, ready. Lifting a jar out is a rehearsal: the water on its day rises, nothing is written, and it sets back.

## Budget delta (5)

+0. No new command. The hammer calls `postDueRecurrences(household, today, [recurrenceId], { createdBy })` — the same command the Fund already posts due recurrences with — after the app's `ConfirmSheet`, and only for a recurring bill; a planned expense or an appointment is paid where it is paid today (*Open it in the banks*). No bank money moves: the jar's water is the nest's own `amountCents` read through `projectKittyNest`, and the walk behind the rail is `fundWalkWith` unchanged. `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `fundWalk.ts`, `allocateNestTotal`, the four categories, the tiers and `test/kitty-nest.test.ts` are untouched. No schema, Auth/RLS, sync, hosted-state, financial-hash or Hercules payload change. The rehearsal is `deferObligationIds`, the walk's existing hypothetical.

## Engagement delta (3)

+3. The cellar is the whole bill picture at a glance — what is coming, what is ready, what is short, what is paid — and the one act it offers is the real one, by hand, with its boundary said out loud.

## Verified baseline

Facts: `origin/main@b462df0` (#477); `tsc --noEmit` clean; `test/goal-fill-ui.test.ts` red on `main` (6 of 7), untouched; `fundWalkWith`, `projectKittyNest`, `postDueRecurrences`, `ConfirmSheet` and `QueenRoomWorld` read and consumed as they are. The bank ids the nest already mints (`recurrence:<id>:<date>`, `potential:<id>`, `appointment:<id>:<date>`) are the jar ids, prefixed `cellar:`.

## Scope

### In scope

- `src/core/queenCellar.ts` — pure: `cellarJarType` (from the recurrence's `kind` or the bank's source), `cellarStrike` (hammer / crack / shard / none, with `payable` for what the cellar can post), `cellarJars` (open bill banks and this month's broken ones, this month only, date order), `cellarDays` (the walk day by day), `cellarReading` (the whole room, with the rehearsal hypothetical), `cellarGateWords`.
- `src/queen/QueenCellarRail.tsx` — the rail: the water band and tidemark, the fixed gate, the day track hung from the gate (44px a day), jar buttons with `data-room-vessel` so the 3D room stands sculptures behind them, drag / arrow keys / Home / End; the jar glyphs (roof, loop, lid, dotted ghost, crack, shard).
- `src/queen/QueenCellar.tsx` — the bills view (default when Home passes the household), the months view as one step in for the jar in the gate, the gate line, the acts (hammer, crack, lift out / set back, open in the banks), the Confirm sheet and the notice. Both rails now capture the pointer only once a drag has begun, so a tap on a jar reaches the jar (the months ribbon's jars were unclickable in a real browser before — the capture swallowed the click).
- `src/queen/queen-cellar.css` — the rail, water, ticks, jars, hammer, short-frame and forced-colour rules; scoped under `.queen-room--cellar` because this sheet loads before `queen-home.css`.
- `src/queen/QueenHome.tsx` — one line: the cellar receives `household`, `memberId`, `today`, `busy`, `onCommand`.
- `scripts/serve-household-home-proof.mjs` — `bills=1` seeds a paid subscription, a house bill and a planned expense; `today=` now reaches the Home render too.
- Tests: `test/queen-cellar.test.ts` (12), `test/queen-cellar-ui.test.ts` (9), `test/queens-nest-ui.test.ts` (+3 lines: the room now opens on the rail; its months are one click away), `test/queen-cellar-layout.mjs` (23 records), the focus-map mapping (appended last).
- Docs: D-256, roadmap line, this worksession, the handoff entry, `docs/evidence/queen-cellar/`.

### Out of scope

- Posting a planned expense, an appointment, a task or a plan line from the cellar (no such single command exists for them; the door to the banks is kept).
- Any change to `kittyNest.ts`, `householdFund.ts`, `fundPulse.ts`, `fundWalk.ts`, `commands.ts`, the categories, tiers or their tests; the loft (`QueenLoft.tsx`, `queenRoomWorld.ts`, `queenPresentation.ts` are untouched so the loft patch in flight merges beside this one); 3D vessel forms for the strike (the crack, the hammer and the ghost are drawn in the flat layer over the sculpture).

## Acceptance evidence

- [x] Hammer only when due and full; crack when due and not full; shard when paid; none when early; no hammer where the cellar cannot post (test).
- [x] A jar's type from its source; only this month's bills on the rail, in date order, the paid one kept as a shard; fill is saved over target and left is the rest, read from the nest's own bank (test).
- [x] A bill paid by hand somewhere else in the app becomes a shard and the hammer is gone (test).
- [x] The walk's days come from its own points and its own buffer/dry readings; the crest never sits below the buffer (test).
- [x] Lifting a jar out defers that obligation in the walk and leaves the household byte-identical (test, browser).
- [x] Pressing the hammer opens the Confirm sheet and writes nothing; confirming calls `onCommand` once with `postDueRecurrences` for that one recurrence as this member, dated on the bill's own day; the notice says the shard stays (test, browser on the proof page's in-memory books).
- [x] The crack's act is named as paying from the water and its sheet says the rest comes from the Fund (test, browser).
- [x] No figure on the rail; every jar carries a `cellar:` vessel id for the 3D room; keyboard scrubs the gate and the slider follows; the months view is one step in and back (test, browser).
- [x] No page scroll at 320×568, 320×700, 390×844, 720×900, 1100×800 in 3D, flat and no-WebGL; reduced motion leaves no transition; 0 serious/critical axe hits; 0 page errors (browser).

## Plan

- [x] Read the walk, the nest's bill banks, the post command and the Confirm sheet.
- [x] Selectors; the rail; the room; Home wiring; the proof seeding.
- [x] Mapping tests; jsdom tests; browser evidence in 3D, flat and no-WebGL.
- [x] Quick gate; build; docs; patch.

## Evidence log

All commands from the branch root in the cloud container, Node 22.22.2, pnpm 10.14.0.

- `node_modules/.bin/tsc --noEmit` — clean.
- `vitest run test/queen-cellar-ui.test.ts test/queen-cellar.test.ts test/queens-nest-ui.test.ts test/queen-rooms.test.ts` — 4 files, 50/50.
- `pnpm check` (Medium, no focus, as CI runs it) — `quick-gate-passed`: diff-check, ai-surface, typescript (56.2s), test-discovery (23 selected: 17 fast / 6 serial), vitest-fast 17 files / 204 tests, vitest-serial 6 files / 117 tests; 193.6s of the 300s budget, no breach; `uiProofRequired: true`, satisfied by the browser run below.
- `vite build` — built in 18.7s. `pnpm build` in full (including the workspace Worker type-check) was not run.
- `vitest run test/goal-fill-ui.test.ts` — 6 failed / 1 passed exactly as on `main`, untouched.
- `HEARTH_CHROMIUM=… node test/queen-cellar-layout.mjs` — `23 records, 0 serious/critical axe rule hits, 0 page errors`. PNGs and `records.json` in `docs/evidence/queen-cellar/`.

## Decisions and interpretations

- **Bills is the room; a bill's months are one step in.** The cellar opens on the rail. The months ribbon (#477) is kept whole behind a pill that reads *<bill> · its months* for the jar in the gate, or *Its months* for the first ribbon when nothing is in the gate. The existing test that walked into the cellar and counted twelve jar seats now clicks that pill first — three lines changed in `queens-nest-ui.test.ts`, fourteen lines above where the loft assertions begin.
- **The hammer only where the cellar can post.** `postDueRecurrences` posts a recurrence; there is no equivalent single command for a planned expense, an appointment or a plan line, and inventing one is money structure. Those jars fill, crack and shard like the rest, but their act is *Open it in the banks*.
- **The posted date is the bill's day, not today.** That is what `postDueRecurrences` does; the Confirm sheet says *dated Sep 15, its day* rather than pretending otherwise, and the shard lands where the jar stood.
- **The jar's water is the nest's number, not the walk's.** Saved is the bill bank's `amountCents` as `projectKittyNest` allocates it; the rail never sums money into a new figure.
- **Pointer capture waits for a drag.** In a real browser a captured pointer retargets the click, so a tap on a jar never reached it; both rails now capture only after 6px of movement. jsdom never showed this.
- **Merge safety with the loft patch in flight:** all code is new files or the cellar's own; `QueenHome.tsx` changes one line; the focus-map mapping is appended at the end of the array; the D-256 row, the handoff entry and the roadmap line are inserted below the top entries, not at the top. `QueenLoft.tsx`, `queenRoomWorld.ts`, `queenPresentation.ts` and `queens-nest-ui.test.ts`'s loft assertions are untouched. If the loft chat also takes D-256, renumber this one.

## Remaining uncertainty

- **The strike is not modelled in 3D.** The room's sculptures know fill and hollowness; the crack, the hammer and the shard's break are drawn in the flat layer over them. A cracked sculpture is future form work in `queenRoomWorld.ts`, which this patch leaves alone for the loft patch's sake.
- **The fixture's buffer is $0**, so the tidemark sits on the floor in every screenshot; the under-the-mark (copper) and dry (dashed) waters are covered by the day selectors and the CSS, not by a browser still.
- **320×568 with the chrome stand-ins** is the compromised frame the rooms' evidence already shows: the slider and sub-line give way there and the line beneath the gate is hidden by the existing short-frame rule; 320×700 is the honest 320.
- SwiftShader only, no phone; a third WebGL room on top of Home's world.
- Data/environment: fictional fixtures only; no hosted, schema, Production or real-household writes.

## Handoff

Local branch `claude/cellar-bill-banks` and `cellar-bill-banks.patch` only. Not pushed, not a PR, not merged, not deployed, not live verified. Next owner: Jonathan to push both this and the loft patch and to decide whether planned expenses deserve a posting door of their own; Codex for an independent read of the hammer's path (`QueenCellar.tsx` → `ConfirmSheet` → `postDueRecurrences`), since it is a new door onto a money command; a phone measurement of the third room.
