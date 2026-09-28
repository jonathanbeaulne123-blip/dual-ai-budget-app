# Pass 5 · blind review 5 (28 Sep 2026) and the integrator's answers

Reviewer: a Claude subagent that had not seen the builders' conversation, per `docs/horizon/REVIEW-BRIEF.md`, on `3bd8309`. Verdict there: **NO-GO until R5-01, then GO for a dev-gated merge with R5-02…R5-07 carried openly.** The integrator fixed R5-01 and R5-02 in `dcd0ff7`; the rest are carried below with their state.

Counts at review time: BLOCKER 1 · MAJOR 7 · MINOR 9 · NIT 4.

| Id | Sev | Finding (reviewer) | State after `dcd0ff7` |
|---|---|---|---|
| R5-01 | BLOCKER (merge) | Page F re-posed and re-baked without re-running the suites: Views, Wave4 and WalkOut red at HEAD | **Fixed.** Expectations follow the promenade eye (`v2.6b` notes); F passes at 1440×900, L01 open in portrait like C/D/L |
| R5-02 | MAJOR | The funicular could not be boarded and the gondola offered no ride down (`gondolaTop` was `cable→feet` only; no `funicular.*` thresholds in the world) | **Fixed.** Six funicular boarding thresholds (one per platform per direction) and `gondolaTop` `feet→cable`; a cable platform on v2 land stands on the region's own platform (no floating slab); re-bake 132 conflicts |
| R5-03 | MAJOR | Region triangles 478,969 full / 216,519 lite against CONTRACT §6's 150k / 60k per district; no fps measured | **Open, for Jonathan (E-5-3).** The region is its own residency unit (T2). A lite LOD (drop outline shells −69k, lite planting beyond 150 m, coarser lattice outside the core) is the next segment's first job; a §6 line needs his approval; fps on a device is unmeasured |
| R5-04 | MAJOR | v2's crest h 163.24 at [1297,452] is 5.2 above `crown.summitH` 158; P04 relaxed; NOT-THIS unamended | **Open, for Jonathan (E-5-1).** Recommended: move `crown.summit`/`summitH` to v2's crest and amend D-M1 |
| R5-05 | MAJOR | Page A from the square shows neither v2 nor its dam (fog; A's subjects dropped the dam face) | **Open, for Jonathan (E-5-2; D-M10 is his by eye).** Page E holds the mountain; a re-aim or a longer fog for the Crown card is the alternative |
| R5-06 | MAJOR | The seam test was moved to lattice points 10 m inside the edge; at the drawn edge T1 measured 3.30 / 2.65 m on v2's steep shoreline; SEAMFOOT shows overdraw at the Foot | **Open (land, segment 2).** A region skirt, or region ground yielding under Horizon beds and decks. The test comment says what it measures and why |
| R5-07 | MAJOR (trust/docs) | `HorizonWorld.tsx` now derives a `BasinReading` (same read-only `buildBasinReading`/`createBasinView` as the old world) for v2's dam; CONTRACT §2.2 wording still names only L01; no trust review recorded | **Open (Codex trust note before PIN-1).** No write path, dev-gated; §2.2 to be amended so the dam's reservoir is named as part of L01's picture |
| R5-08 | MINOR | `captures.json` held one record after a partial run; no portrait or Taylor/Newfoundland captures | **Partly fixed.** The full set was re-captured at `dcd0ff7` (10 records). Portrait and the two other dressings are still owed (device evidence, CONTRACT §2.21) |
| R5-09 | MINOR | Skip/Sit are keyboard-only (`mountCableHud` never mounted); `gondolaBase` offer text | **Partly fixed.** Offer text is human ("Ride the gondola ↑ Summit Commons"); the HUD buttons are still to mount in `HorizonStage.tsx` |
| R5-10 | MINOR | Region collision answers while the region is not yet drawn; build steps ≈250 ms each | Open (segment 2): answer decks only while drawn; split the large builders |
| R5-11 | MINOR | The Horizon may still draw its own `G1.cable` beside v2's ropes | Open, unproven in captures (the Foot view shows one rope pair) |
| R5-12 | MINOR | v2's reservoir and river are not Horizon water (a walker can stand under the drawn water) | Open: a region `waterLevel` hook |
| R5-13 | MINOR | `library-balcony` support solid in S1's clearance (rider bails at 614 m); S1 slabs 10/11 drawn in the wrong material | Open (pinned in `horizonBoardPace`) |
| R5-14 | MINOR | Loose bounds in Landforms/Beds; v2's road grades up to 14 % against NOT-THIS's 12 % with no waiver | Open: record the v2-road grade waiver in DECISIONS; pin measured values |
| R5-15 | MINOR | Design losses pinned as measured: R1 Downhill carve has no home; the Crown launch runs off one way; Crown→Lamp in wind −1.2 m; Dam Run gate still named `damArch` | **For Jonathan (E-5-4)** |
| R5-16 | MINOR | Three `stepsPortage` "proposed" conflicts at ≈133 eu of rock separation inside the footprint | Open: register as `over` |
| R5-17 | MINOR | `HANDOFF-notes/land.md` §0 claims were stale at HEAD | Fixed by the re-runs below; the note now says where it was measured |
| N1–N4 | NIT | Stale `OPEN_VOIDS`; `CARD_CLOCK` also animates the Horizon's water sheen; v2's 1.2 MB ground is a static import (already true on main via `audio.ts`); the `v2:town:north` join is 20.7 m | Open |

## What the reviewer could not confirm, and what the integrator then ran on `dcd0ff7`

- `tsc --noEmit`: 0 errors.
- `pnpm horizon:check`: byte-exact.
- `pnpm build`: exit 0 (on `3bd8309`; the later commit changed a land rule and the manifest — re-run before merge, see the worksession).
- The reconciled suites (`Views`, `Wave4`, `WalkOut`, `Thresholds`, `Gondola`, `Manifest`, `Crossings`, `Beds`, `MountainRegion`, `BoardThresholds`, `ModeRegistry`, `Structures`): 223 / 223.
- Still unconfirmed by anyone: a body walking square → V03 → summit (only the walk-plan graph is proven); the gondola's reveal and the cabin moving on screen (only the headless ride test); fps, first-interactive and mount time on a real device; Taylor and Newfoundland by eye; anything at 390 × 844.

## For Jonathan (E-5, one line each)

- **E-5-1 Summit.** v2's crest is 5 m higher than the Crown summit, 22 m away. Accept v2's crest as the island's top (recommended) or lower it.
- **E-5-2 Page A.** Re-aim so v2 shows from the square, or accept that page E holds the mountain.
- **E-5-3 Weight.** The mountain is ≈3× a district (≈3.6× on phones). Approve a lighter phone version and its own line in CONTRACT §6.
- **E-5-4 Losses with v2's course.** R1 Downhill carve has no home; the Crown launch runs off one way; the Dam Run threads a `damArch` gate that no longer exists; Crown→Lamp in the shipped wind is −1.2 m.
- **E-5-5 Fund picture.** Confirm the dam's reservoir level is the Fund picture (D-M3) and ask Codex for the trust note.
- **D-M6b** The Little Harbour → v2-quay lower gondola leg: build it, or the town reaches the mountain by V03 and the Foot.
