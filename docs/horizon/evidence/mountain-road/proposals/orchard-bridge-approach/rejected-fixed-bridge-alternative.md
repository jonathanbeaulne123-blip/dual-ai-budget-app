# Orchard junction — unapplied options, 2026-10-01

No native/Horizon road, terrain, bridge, guard, or route source has been edited by this study. This is not an implementation approval or a passing controller proof.

## Fixed-plan alternative (not recommended as the comfortable-road default)

The real new drive lip is −0.179m, reverse/right+2, H[1325.47,69.61,671.24], from Orchard to main. Exact source is /tmp/mountain-native-route-source.json, source SHA86fe249963667423a4b9f8c5360f271f6ada0ef1a0bbe9a4a6a1ffb88387d91f.

The exact clipped/refined mesh in /tmp/mountain-orchard-fitted-mesh.json replaces only original Orchard rows0–8 (station0–8.0147167547m, horizontal centre distance7.9721644891m), preserving plan footprint and all widths. **The visible b0 approach starts at row8**, because bridgeArt.deckFrames includes i0−1; using the first classified bridge sample9 would silently alter b0. The entire row8 cross-section and everything beyond it remain fixed.

Current conforming mesh:823 vertices,1581 triangles replacing80 (+1501); SHA29267f67561bcf38c9c5ba1845dd430eac8096a88b2d14d48e73f5701eb478dd. Maximum fitted facet25.0000023%; Y movements−0.4507262953 to+0.3051364423m. Every main overlap vertex is fixed to its actual main triangle plane. Main XYZ is unchanged. 103 original vertex-on-edge mismatches were split before fitting; final topology audit has zero T junctions. A six-column-only patch was rejected because interiors differed by12.3754cm. An independently fitted, unsealed clipped mesh was also rejected because it left an8.6567cm height crack.

Exact longitudinal triangle-intersection results (both directions share magnitudes):

| Offset in native normal frame | Candidate max longitudinal | Fixed main-to-b0 minimum required |
| --- | ---: | ---: |
| −2m |24.993756%|21.785557%|
| centre |24.985052%|22.905803%|
| +2m |24.941811%|21.800072%|

Centre fixed witness: main exit native[15.7686559082,15.9470758958,−98.2220453507] to unchanged b0 starting centre[13.7135280533,16.6140199181,−100.2846501117]. Height rise0.6669440223m across2.9116814907m horizontal route length requires22.905803%. Therefore this option cannot meet pointwise12% while preserving original plan, main geometry, and complete drawn b0. It is NOT covered by D-MR17's inherited main-road exception. User would have to choose this new steep approach explicitly; current work instead prioritizes a modest tie-in relocation.

## Ground/support discriminator

The superseded row9 attempt's existing-bundle ground probe is preserved at /tmp/mountain-orchard-support-superseded-row9.json; deterministic old mesh reproduction at /tmp/mountain-orchard-fitted-mesh-superseded-row9.json. Its33,997 ≤0.1m samples found541 points with terrain above painted top and162 where native floor would reject buried deck. Worst native ground exceeded deck by0.2247359411m at[16.0536284687,15.7577607895,−95.0022409089]. This is a real local ground-cut requirement, not permission to weaken the native burial rule. Raw maximum deck-above-ground4.37186m is NOT a new bridge claim; it was near the old candidate's b0 approach and must be compared to existing supporting construction.

The revised row8 mesh still needs the parent-run /tmp/mountain-orchard-support-probe.mjs; runner verifies exact prepared source lines before sampling. A pointwise groundHeightAt cut is insufficient visible proof: native groundPaint.buildLattice draws1.25–3m cells whose triangle interiors can remain above a narrow cut. Both-world drawn lattice/road triangle-intersection clearance must be verified. No proposed ground cut has been applied or silently assumed.

## Implementation requirements, if an option is chosen

1. One pure native source-owned indexed junction mesh, generated from exact main/Orchard rows, with input version proof. No Horizon import into native source.
2. Replace original Orchard prefix triangles, not overlay a lower floor beneath old raised art. Exact overlap can remain drawn by the main road; avoid coplanar duplicate paving.
3. Use the same mesh in native worldDeckAt and Horizon exact road floor/contact/ceiling. Old prefix triangles must not continue to win the highest-floor selector. Native remainder and b0 remain untouched.
4. Resample local Orchard parapet bases/ink/cut sides AND EDGE_SOLIDS to that mesh, keeping guard plan/width and bridge row8+ fixed. Don't merely alter road top while leaving airborne rail bases.
5. A measured bounded terrain cut, shared drawing/query, if still required. Retain native ground burial and all support limits.
6. Regression: true main-plane overlap at triangle intersections; conforming topology; original row8+ XYZ/width/normal/bridge identities; candidate centre/±2m exact gradients; actual rendered ground clearance; forward/reverse real movement, zero resets and retained failures. No acceptance cap changes.

The mesh/fitting scripts and numeric witnesses remain proposal evidence. There is no ready-to-apply source integration patch yet because the fixed-plan option fails the comfortable-road goal and its terrain/render support work is not proven.
