# Hearth worksession — Little Harbour slice 2: the Rook's Tower, the Cellar, the Cistern

- **Status:** OPEN — local branch candidate, ready for Jonathan's eye and a PR
- **Opened:** 2026-09-20 (`America/Toronto`)
- **Owner:** Jonathan
- **Assignee or AI:** Claude (architect + integrator; writers S, T, C merged by the coordinator)
- **Repository:** `dual-ai-budget-app`
- **Branch:** `claude/little-harbour` (continues slice 1)
- **Baseline SHA:** slice 1's head on the same branch
- **Head SHA:** the last "Little Harbour" commit on the branch (`git log -1`); the handoff bundle in `hearth/handoff/` names it
- **PR or issue:** none yet — not pushed (the session's git proxy refuses this repo)
- **Risk:** Medium (presentation only; no money meaning, writer, schema, sync, Auth/RLS or Hercules payload change)
- **Decision owner:** Jonathan
- **Environment impact:** Development only, behind `VITE_HEARTH_HARBOUR` (which requires `VITE_HEARTH_HOUSE_WORLD`)

## Household outcome

The house has an upstairs and a downstairs again, and both of them are rooms you stand in.

Tap the **Rook** in the Court and you climb into **the Tower**: a round stone room with a rack of kitty banks on the landing, each bank's height its target and its fill its progress, an engraved plate naming the shelf's share and its mark, a lamp, a window, and a bare shelf that says "nothing on the shelf yet" rather than pretending. Tap a bank and the Loft opens in front of you with the jug, the gun and Confirm exactly as they are today.

Tap the **Bishop** — or the stairhead beside him — and you go down to **the Cellar**: a vaulted room with a rail of glass jars along the back wall, one per bill this month, frosted when planned, solid when set aside, cleanly shattered when paid, hairline-cracked only under a confirmed shortfall. Walk the rail with the arrow keys or by dragging it and the month moves: the date plate follows, the jars ahead go pale. Prepare's buffer stands beside them as a **great glass cistern on a stone plinth**, measured with the same ruler the jars are, with a brass rule to read the level against. Tap a jar and the Cellar's own bill surface opens.

Back in the Court, the **Cistern** now stands beside the Knight and opens Protect.

"← Back to the Court" and Escape come back up. Nothing in any of it posts, proposes or computes a cent.

## Budget delta (5)

**+0.** `src/harbour/**` still reads existing selectors only (`queenShelf`, `rackSettled`, `kittyBankBackingStep`, `projectHouseholdFund`, `cellarJars`, `cellarDays(fundWalk(…))`, `missingSubscriptions`, `fundSnapshot`) through the supported-interpretation freeze, and still opens existing doors through `onOpen(target, object)`. The jug, the money gun, the rack's controls, the jars' actions and every Confirm stay in `src/queen/QueenLoft.tsx` and `src/queen/QueenCellar.tsx`. `test/harbour-source-fences.test.ts` holds the line: no `core/commands`, no `kitchenCommand`, no `ledger/`, no `storage`, no `continuity`, no `api`; `import.meta.env` only in `flag.ts`.

## Engagement delta (3)

**+2.** Jonathan asked for the Loft's and the Cellar's actual functionality back, and for the house to be the app rather than a set of small screens. Both rooms are now full-screen places with their own light, their own camera and their own reading edition, and the way between them is a journey rather than a page swap.

## What is in the branch

| Area | Files |
| --- | --- |
| Places | `src/harbour/tower/{TowerScene,banks,landing,dressing}.ts`, `src/harbour/cellar/{CellarScene,jars,water,scrub,dressing}.ts`, `src/harbour/court/cistern.ts` |
| Travel | `src/harbour/scene/travel.ts` (pure), `scene/runtime.ts` (`enter`, `settle`, `pull`) |
| Routing | `src/harbour/flag.ts` — `HARBOUR_ROOMS` by room **and level**, `HARBOUR_WAYS`, `harbourWayFor` |
| Reading | `src/harbour/data/reading.ts` — `tower`, `cellar`, `cistern` |
| Shell | `src/harbour/HarbourWorld.tsx` (`activate` checks the way **before** the door), `court/CourtTwins.tsx` → `HarbourTwins`, `flat/PlaceFlat.tsx` |
| Tests | `test/harbour-{tower,cellar,travel,reading,camera-poses,dressing,source-fences}.test.ts` |
| Evidence | `scripts/capture-little-harbour-evidence.py --slice2`, `docs/evidence/little-harbour-slice2/` |

### Enter, then Open

The rule that makes the house a house: an anchor is either a **way** into another place of the room or a **door** onto an HTML surface, and the way is checked first. The Rook and the stairhead are ways; a bank and a jar are doors. A place may add a stair without amending the table — any anchor whose zone is `stair` comes back to the Court.

### Travel

`travelPlan(from, to, reduced)` is pure and tabled: Court → Tower lifts the tower's roof over 900 ms and rises; Court → Cellar lifts the Court's floor away as a lid over 900 ms and descends; back is 700 ms and frames the piece you came from (the Rook, the Bishop). Reduced motion is a cut — the roof is simply absent or present. Both places stand for the length of a journey; the one you left is disposed when it ends.

## The art pass, and what looking at it changed

The first browser captures of the two new places showed that neither of them was a room. This is worth recording, because nothing in the tests said so.

**The Tower** was a cut-open model standing on a lawn, its roof hanging detached in the middle of the frame, the island's sea and trees around it. The camera sat eleven units back, above the wall's top course. Fixed by standing the eye **inside** the tower, on the landing in the wall's open side, so the round stone wraps the background and the floor above is the ceiling. Three things followed:

- floor-to-floor 1.55 → **1.92**, because at 1.55 the ceiling sat fifteen centimetres over the eye;
- the ceiling takes the roof's soffit colour, because it faces down and only the hemisphere's ground colour touches it — a beam-dark underside read as a black lid;
- mortar courses on the **inside** face as well as the outside, because from a landing the wall is the whole background and a bare cylinder there is a gradient, not masonry.

Banks now stand a step apart from the middle outward rather than stretched to the ends of the shelf, which had left a hole where the shelf's story should be. A portrait phone cannot hold the rack's width at any distance the tower allows, so the phone composition closes the rack up to its own step — the repository's distinct phone/desktop composition rule, applied inside a room.

**The Cellar** was a shelf of invisible jar rims in front of a flat teal band, read from a camera standing inside the front wall. Three changes:

1. **The room's ruler is now logarithmic**, as the Tower's banks already were. A household's buffer is routinely twenty times its largest bill; on a straight scale that put every jar at the floor height and the room said nothing. The ruler still promises the **ordering** — more money is always more height, on the water and on the glass alike — and no longer promises **proportion**, which the plates carry anyway. `CELLAR_SCALE_ANCHOR_CENTS` ($25) anchors the low end.
2. **Prepare's water is a great glass jar on a stone plinth**, not a slab across the back wall. The same glass as the bills on the rail, at the room's own scale — which is the actual argument for putting them in one room: you can see the buffer standing beside the bills it is there to cover. Brass rim, brass foot, a five-tick rule on a post, and a tide mark that rides with the level.
3. The room is shallower and lower, the rail is shorter and higher, the eye stands inside it, the lamp is on the back wall where it lights the cistern, and the stair shows in the near corner. The phone looks **along** the rail instead of across it, because a portrait frame holds about 1.3 world units across at that distance and a straight-on view showed one jar.

`COURT_BOUNDS.minR` went 3 → **2**: a room six units across has to be able to bring one bank or one jar close. No Court pose changes.

**The evidence script was also wrong**, and that is the finding with the longest reach: `wait_place` waited on `data-harbour-place`, which flips the moment a journey *starts*. Every "cellar" capture in the first run was actually a photograph of the Court, taken from a camera already aimed at the cellar's pose. It now waits for a twin only the arrived place has.

## Verification

- `pnpm exec vitest run test/harbour-*.test.ts test/house-*.test.ts` — **24 files, 254 tests, 0 failures**
- `pnpm exec vitest run test/app-startup-p1.test.ts` — **83 tests, 0 failures** (the full App with every flag unset)
- `pnpm exec tsc --noEmit` — clean
- `VITE_HEARTH_HOUSE_WORLD=1 VITE_HEARTH_HARBOUR=1 pnpm exec vite build` — built
- Evidence: `docs/evidence/little-harbour-slice2/` — three themes × five widths (320, 390, 720, 1100, 1440), each with the Court, the Tower, a bank open, the Cellar, the rail walked back seven days, a jar open, both reading editions reached by their own buttons, and a frame caught part-way through each journey.

**Known failure, unchanged from slice 1:** the serial browser lane breaches its five-minute budget on this container and three browser files fail — `hearthside-actual-app-browser` times out identically on `origin/main@10e05ed` here, and two others want `chromium_headless_shell-1234` where the box has 1194. That lane needs Jonathan's machine.

## Uncertainty and open questions

- **The Tower stands the Build ledge.** `queenShelf` is what `QueenLoft` actually holds, so under `seedDemoHousehold` the rack reads empty while the Court's door sign counts every open goal bank. The sign now counts what is on the rack so the door and the room agree, and the evidence uses `?seed=demo`, whose habitat has banks on the shelf. **Open:** should the Loft's ledge hold every goal bank, not only those filed under Build? Money model untouched either way.
- **The log ruler is a judgement call.** It is honest about ordering and silent about proportion. If you would rather the cellar promised proportion and accepted that small bills read as stubs, say so and it is one function.
- **The cistern as a glass jar** is my art direction, not your instruction. It replaced "a body of water behind the rail" from LITTLE_HARBOUR_v2 §2 because the body of water read as paint on the plaster and drowned the jars.

## Not started, from your notes

The Glasshouse (the Master Planner's visual and UX redesign), the Kitchen's recipe-card plan, the Boathouse (Together, and the couples features moved into a small corner), the island and its walking, the Library, the Kiln, Hercules's Cottage.

## Next owner

Jonathan — look at the 1440 and 390 captures for the Tower and the Cellar, and say whether the cistern and the log ruler stand. Then a PR, and the Glasshouse.
