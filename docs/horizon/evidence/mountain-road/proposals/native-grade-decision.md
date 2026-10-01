# Fixed native bridge grade feasibility

**Decision, 2026-09-30:** Jonathan selected “Retain original grades as explicit exceptions (Recommended).” Preserve the original native road and bridge elevations. Keep the measured grade findings and unchanged audit thresholds visible; the exception does not cover a lip, gap, collision, missing guard, new Stillwater grade, or any later native redesign.

**No height-only profile on the existing road XY can satisfy either pointwise 12% or the audit's 12%-over-10m rule while preserving the three native bridge decks and Foot/Summit XYZ.** This is a constraint proof, not a grade waiver. It requires no assumptions about vehicle tuning or hidden ground.

Pure-data calculation: [native-grade-proof.py](native-grade-proof.py); full measured witnesses: [native-grade-proof.json](native-grade-proof.json). Reproduce with `python3 docs/horizon/evidence/mountain-road/proposals/native-grade-proof.py . /tmp/mountain-native-grade-proof.json`. Reads exported JSON and existing audit only; no world imports, bake, runtime or native source edit.

## What the four existing audit groups overlap

Stations below are canonical chain **plan metres**, not native spatial `s`. The old audit groups consecutive windows over8%, then labels a group MAJOR if its worst10m window exceeds12%; the entire group is not necessarily above12%.

| Old audit group | Reported worst10m | Approximate worst10m stations | Fixed tagged bridge overlap |
|---|---:|---|---|
| e120,350–398 |15.26%|366–376|Harbour bridge384.375–398.000|
| e121,470–750 |14.07%|706–716|High woodland737.213–750.000|
| e122,776–976 |14.03%|816–826|High woodland776.000–794.190; Dam glass967.127–976.000|
| e123,1016–1284 |15.10%|1048–1058|Dam glass1016.000–1040.103|

The maximum window in each group is outside the tagged bridge axis. That does **not** make height-only smoothing feasible: the surrounding bridge elevations constrain the available rise/run, and the Dam bridge itself independently exceeds the ten-metre limit.

Native bridge art includes one additional source row beyond each tagged axis (`mountain/art/bridgeArt.ts:22-26`). Its true drawn bounds are:

| Bridge | Tagged source rows / chain range | Drawn source rows / chain range |
|---|---|---|
| Harbour |35–58 /384.374894–407.366597|34–59 /383.375248–408.366225|
| High woodland |388–445 /737.212621–794.189756|387–446 /736.214132–795.189441|
| Dam glass |618–691 /967.126884–1040.103206|617–692 /966.127200–1041.102790|

The infeasibility already holds using the smaller tagged bridge footprints, so it does not rely on the added art rows.

## Direct ten-metre fixed witness — no pointwise assumption

The strongest ten-metre interval wholly inside the tagged Dam glass bridge ends at its final tagged row:

- Start chain1030.103206m: H`[1336.446862,126.209850,552.680240]`.
- End chain1040.103206m: H`[1346.288234,127.527215,550.986240]`.
- Horizontal route length exactly10m; rise1.317365m; **13.173652%**; allowed rise1.2m; excess0.117365m.

The exact audit's2m station grid also contains a fixed witness, **chain1030→1040**:

- H`[1336.345615,126.197815,552.700256]` → H`[1346.185202,127.512585,550.992234]`.
- Rise1.314770838m over10m = **13.147708%**, excess0.114770838m.

Including the actual one-row rendered bridge extension gives a strongest continuous ten-metre interval of **13.409239%** at chain1031.102790→1041.102790. The two smaller bridges' tagged continuous ten-metre maxima are9.890845% (Harbour) and10.499189% (High woodland); they do not independently fail this centreline-average criterion.

These source-derived numbers are distinct from the prior audit's15.10% whole-group maximum. No claim that the prior report serialized these precise surface heights: its station table omits surfaceY. The native polyline source and bridge rows are the measured objects here.

## Long fixed pair — pointwise proof and a separate10m proof

For any pointwise12% profile on fixed route XY, each pair of fixed points must satisfy `abs(heightB-heightA) <= .12*(planStationB-planStationA)`.

The strongest tagged-anchor conflict is:

- High woodland end, row445, chain794.189756m, H`[1285.303812,98.741736,567.731187]`.
- Dam glass start, row618, chain967.126884m, H`[1276.375324,122.366703,538.744678]`.
- Run172.937127580m; rise23.624967m; required average13.661015%;12% permits20.752455310m. **Fixed height difference exceeds the allowance by2.872511690m.**

No displacement of free road heights can resolve this. The unconstrained road between the bridges would need at least196.874725m plan length at12%, an additional23.937597m, merely to satisfy this pair; this is a length lower bound, not a feasible reroute proposal. Keeping actual rendered deck rows fixed strengthens the conflict to2.896265m across170.937758m.

**Do not apply the172.937m pointwise inequality directly to the10m-average rule:** a residual2.937m could carry an unrestricted height jump under that weaker rule. Instead use two fixed, audit-grid-aligned points exactly180m apart:

- Chain788m on High woodland: H`[1291.134646,98.058980,569.790874]`.
- Chain968m on Dam glass: H`[1277.165945,122.448381,539.115152]`.
- Rise24.389401232m across18 consecutive10m windows, each starting on the audit's2m grid:788,798,…,958.
- If every such window were≤12%, their signed rises could sum to at most18×1.2=21.6m. The fixed rise exceeds this by **2.789401232m**. Therefore at least one of these windows must be at least **13.549667%**. There is no endpoint remainder in this argument.

This second proof rules out passing the current discrete audit windows through height-only smoothing, independently of the Dam bridge's direct ten-metre failure.

## Additional independent pointwise conflicts

| Fixed pair | Run m | Rise m | Required grade | Rise beyond12% m |
|---|---:|---:|---:|---:|
| Foot row0 → Harbour start row35 |34.986340|4.582778|13.098764%|0.384417|
| High woodland end445 → Dam start618 |172.937128|23.624967|13.661015%|2.872512|
| Dam rows690→691 |0.999602|0.141695|14.175136%|0.021743|
| Dam end691 → Summit940 |248.880556|30.672785|12.324299%|0.807118|

The cone calculation computes every free row's lower bound `max_i(fixedHeight_i-.12*distance)` and upper bound `min_i(fixedHeight_i+.12*distance)`. Their intersection is empty; the JSON records exact owners and conflicts. Hence there is **no finite required height displacement** that solves the approved fixed-bridge/fixed-endpoint problem. Any choice promising12% must separately authorize changing protected geometry or route length, and would need new support, landing, clearance and art proofs. This report does not propose or authorize those edits.

## Source, units and limits

-941 exported source rows; native point coordinates are rounded to micrometres. Recomputed plan stations differ from higher-precision frame stations by at most0.000001213m, far below these contradictions.
- Source JSON SHA256: `418eab3afb34746b1341d6f80c16efc7d6921eb71ad301e31e249b63b46cab8f`.
- Prior joined-ground-cruiser audit SHA256: `36c9c01817c44fccb9e147d486e16b97ea0c65318c1991dcc9d8cb274c6b5969`; it names world`dd252b36…f0f35` and terrain`908a33ea…948`. The source's939.595207855m plan length matches that audit's native chain part within4.5e-10m. The new bake was not opened.
- Native source ownership: `mountain/bridges.ts:22-35` fixes grown bridge spans; `mountain/roads.ts:154-166` derives each bridge deck from actual line samples; `mountain/art/bridgeArt.ts:22-40` uses the same rows plus one end row and the actual road bands. Export ownership: `scripts/horizon/dump-mountain-v2.mjs:33-38`. Audit criterion: `scripts/horizon/road-audit.mjs:734-738`.
- Both worlds use the same XYZ geometry under translation H=native+`[1308,54,764]`; translation changes neither rise nor plan distance. All proof coordinates above are H. Native coordinates follow by subtracting that offset.
- Raw full-width source triangle gradients are included in JSON as additional data. They are not promoted here to exposed-floor failures: overlapping swept faces can hide a raw triangle. The centreline fixed-height contradictions are sufficient and do not depend on that classification.
- No route, geometry, terrain, bridge, rail, threshold, physics or severity was changed. No feasible native-edit plan, construction budget, or visual/device acceptance is inferred.
