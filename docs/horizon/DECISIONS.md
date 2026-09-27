The live Horizon decision register is [docs/DECISIONS.md](../DECISIONS.md#the-horizon--decisions-d1d33-pass-0-reconciliation-2026-09-25).

## Stage A rulings (Jonathan, 2026-09-27)

Jonathan answered the Stage A `DECISIONS.md` on 27 September 2026 (01:30 America/Toronto). Group A was answered item by item; groups B and C "recommended on all". The data is in MANIFEST v2.0 (`README.md` → "v2.0 (Wave 5, Jonathan's rulings 2026-09-27)").

Decided by Jonathan, 2026-09-27:

| Id | Decision |
|---|---|
| D-A1 | Bight Bridge option 1: 245 m, one 36 m steel-arch navigable opening over the ferry lane, timber viaduct kept, abutments on the headlands to the ground; upgraded: a lookout bay at the arch crown, S2 a continuous skate ribbon on the deck with a banked east descent and a ramp from the Wash, ≥ 2 trick spots on the bridge, every deck edge railed, no pad on the deck, ferry beam 8 m. |
| D-A2 | ZIP × G1 option A: the zip passes under the gondola (30.45 m); nothing moves. |
| D-A3 | Gondola top station option 2: [1335,535], deck 150 at grade; towers re-solved, no 300 clamp; summit journey target 205 s. |
| D-A4 | Prow Tunnel candidate A at ≈ [1590,890], built as a covered gallery; cover reported honestly; headroom ≥ 5. |
| D-A5 | Dam face stays due south; at golden hour the glass is lit from inside (a light card); LIGHT §2 and P25 re-worded. |
| D-A6 | All eleven v1.7 Sketchbook poses accepted (K re-posed under D-B2). |
| D-A7 | VG × walk garden: a named footbridge; #34, #17, S4 × walk garden, S1 × dam portage: flush at-grade thresholds. |
| D-A8 | Keep five moved Year Walk stations; November back onto solid ground on the Prow top. |
| D-C11 | Market stair: stairs only; the ramp twin retired; the 295 eu detour is the recorded step-free route. |

Recommended, accepted 2026-09-27 (Jonathan: "recommended on all"):

| Id | Decision |
|---|---|
| D-B1 | The Crown stays off page A (page E holds it). |
| D-B2 | Page K re-posed so the Glasshouse is in the 16:9 frame. |
| D-B3 | Page H's best hour → golden hour. |
| D-B4 | Walking speed 2.4 m/s stays until Jonathan walks it on a device. |
| D-B5 … D-B13 | Kept as made (the Throat dark, the register from the bake, the lower route kept open, the Bight trail as VBS's footway, the Inlet Footbridge at 55, the two fins, the hangar bay 11 × 18, the Year Walk pad heights, the working quay). |
| D-C1 | The Notch: the gorge starts ~70 m below the dam with the forecourt open (page A wins). |
| D-C2 | Page A phone: a railed (open) parapet on the dam-gallery stairwell. |
| D-C3 | Keep the Throat collar; the passage's aperture is the built 10.8, the 18 m is the mouth's. |
| D-C4 | P29 measured on terrain + structures with the plaza slab checked; correctly unlit walls accepted. |
| D-C5 | "The Reach water" includes the river where it crosses the Reach. |
| D-C6 | L01 ≈ 1 m east onto solid slab. |
| D-C7 | The turning circle: one lane re-routed (the Crown walk joins the Year Walk lane). |
| D-C8 | Plot bight.1 moved south-west off the June lane and S4 (25 m on the bake; the ≈ 12 m estimate did not clear). |
| D-C9 | VBS beside/over S4: a named trestle. |
| D-C10 | The Hollow neck stays reserved. |
| D-C12 | The 40 m rock cut at Horizon Drive's north-east corner accepted. |
| D-C13 | The Lakeside switchback accepted for the greybox. |
| D-C14 | The cove walk comes down by a cliff stair. |
| D-C15 | S1's self-crossing: a named skate flyover. |

## Design-lead calls in the Wave 5 integration (MANIFEST v2.1, 2026-09-27)

Made by the design lead (integrator 3) on the merged Wave 5 bake, inside Jonathan's rulings; each is reversible and keeps its v2.0 value in the manifest (`v2_0_*`). Numbers: `README.md` → "v2.1".

| Id | Call | Why | Reverse by |
|---|---|---|---|
| D-A1 (opening) | The Bight Bridge's navigable opening is **40 m at s 103–143** (Jonathan ruled 36 m). | An 8 m ferry hull cleared the east arch pier by −3.99 eu at 36 m (s 98–134); 40 m gives +1.37 past both piers. The best 36 m (s 105–141) clears by only +0.15. | `structures.bightBridge.opening.v2_0` (or 36 m re-centred to s 105–141, or a local bend of the FERRY line). **For Jonathan.** |
| D-C8 (distance) | Plot bight.1 sits **25 m** west-south-west, not the ≈ 12 m he accepted. | ≈ 12 m still leaves 12 + 55 Year Walk samples in the plot; [814,919] is the nearest clean spot (W5-DATA). | `reserves.bightShore.plots[0]`. **For Jonathan.** |
| D-C11 (step-free way) | The step-free way between the square and the upper street is the **square walk** (94 eu at ≤ 8 %), not the 295 eu detour. The stair stays stairs only. | W5-A narrowed the upper-street terrace (x 1463–1480) so the square walk climbs beside it. | Restore `TOWN_TIERS` (land/town/build.ts) and `marketStair.v2_0_stepFree`. **For Jonathan.** |
| page A (bank) | The Fund bank's greybox is 20 × 18 (was 26 × 18), its east wall and door side kept. | Its south wall hid 36 of the Shoulder's rays from the square: 8 → 33 px at 1440 × 900. | `hosts[bank].v2_0_footprint_m` / `v2_0_xy`. |
| page D (Lamp) | The Lamp leaves Pass 1's frames for page D; a Pass 2b subject. | 670 eu from the eye and 9 px of 13 by size alone. | `views.D.v2_0_subjects`. |
| page H (portrait) | The portrait eye stands 12 m west on the strip ([428,760]). | West sea 1 → 14 px at 390 × 844. | delete `views.H.portrait.xy`. |
| Year Walk (Feb) | The lake-rim trail takes the Year Walk's section (5.2 m + 1.2 m shoulders). | The Year Walk shares it at offset 0; its edge stood outboard of the trail's rails for ≈ 118 m. | delete `walks.lakerim.surface_m` / `shoulder_m`. |
| D-C9 (length) | The VBS trestle runs 12 m further south, to [886.7,916.0] (56 m). | VBS hung 7.0 → 3.1 eu over the ground there. | `structures.bightSpurTrestle.v2_0_to`. |
