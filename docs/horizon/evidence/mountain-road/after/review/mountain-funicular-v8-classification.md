# Independent v8 saved-data classification

Read-only Python arithmetic on saved JSON; no source imports, tests, renderer, or checkout edits. Full indexed boundary records: `/tmp/mountain-funicular-v8-classification.json` (reproduce with `/tmp/mountain-funicular-v8-classify.py`); positive-area face inventory: `/tmp/mountain-funicular-v8-top-faces.json`; exact art triangles: `/tmp/mountain-funicular-v8-art-witnesses.json`. v5 evidence remains unchanged.

## Result and comparison

**Not physically accepted:**8 ordinary walks and16 continuous sweeps finish clean, but35 new apron top triangles exceed40°, with max63.318741827044825°. Their total projected area is0.4007399911771849m² (actual3D area0.597294294045981m²). These are real faces, not microscopic degenerate residue. Universal top limit remains40°.

V5 and v8 use identical saved world/terrain/native-data hashes. V8 samples a larger perimeter:1,027 edges/21,567 samples versus608/12,768 in v5, so aggregate count improvement is not a point-for-point replay. Boundary failures fall1,108→800; newly steep over recorded walkable baseline841→33, new>6cm steps129→**0**. V8's41 remaining step failures are36 reduced old steps and5 equal old steps. New-apron self-contacts4→0. V8's remaining684 contacts identify existing station posts:607 post0,77 post2; the newly expanded perimeter samples much more of post0. Baseline contact queries were not saved, so these are not automatically “inherited passes.”517 retain exactly the same station/slab selected floor;167 select the new apron. All27 sampled post-base supports (3posts×9) have exactly0m before/after physical change.

## Remaining slope and step witnesses

- **Worst apron face6230:** vertices `[1285.219388995677,55.11950279641703,726.7724000667467]`, `[1285.1298827556482,55.086037237993736,726.7307542736385]`, `[1285.2005189326394,55.06342530559651,726.7936069469403]`.63.318741827°, projected area0.001342003425035m². West flank contains27 steep faces,0.130109783158m² projected total.
- Expanded north flank has3 steep faces, max59.251907037°,0.035077682637m². Example face1614 centroid `[1289.4232057512743,55.38215373302132,732.103935986378]`; this area was beyond v5's boundary extent.
- South corner has5 steep faces, max44.459816939°,0.235552525382m². These remain new geometry even where underlying old terrain was already steep.
- Boundary slope failures75 =29 new-apron samples over formerly≤40° support +4 newly steep **terrain** samples +33 changed-apron samples over already-steep terrain +8 changed-terrain samples over already-steep terrain +1 exactly retained terrain sample. Merely retaining floor ID `terrain` does not retain its height/normal.
- New surrounding-ground defect: `[1289.6660770391006,54.992346958910595,721.627886175159]`,52.11020154° versus old4.13390490°, floor lowered0.066256162523m. Another `[1289.679371990017,55.032346958910665,721.6129448137708]` is53.45498899° versus4.13684963°. At `[1289.649499356128,55.416004309571285,732.2420457987091]`, height itself is unchanged but finite-difference surface normal becomes41.89309219° versus9.39935276° because surrounding field changed.
- The greatest selected-floor slope is changed surrounding terrain,65.376942705° at `[1289.569749837759,54.89270822431915,721.5154020868567]`, versus old45.638722923°/55.048438127401475m. This is distinct from the63.318741827° maximum apron face.
- Max recorded boundary step0.16862021336535093m at `[1285.3249930913405,54.76859721336535,717.7940241334543]` selects native road. Recorded baseline is0.16862021336534383m with identical road floor; the7e−15 difference is arithmetic equality labeling, not a tolerance waiver. The old station0.461299587m step is reduced; no claim all historical native steps are repaired.

## Art: two genuine clearance failures, not submerged paint

All6 tier/theme combinations report exactly2 failing samples,0 hover. They are above the physical station floor55.65085412364115m but below the existing0.035m minimum paint clearance:

- `[1289.6736197774426,55.6809202836479,724.5626118661993]`: gap0.03006616000674711m (shortfall0.00493383999325289m). Full/classic ribbon triangle145, projected area0.01849435376755995m².
- `[1289.7683652530468,55.68527704344994,724.5297099445258]`: gap0.0344229198087902m (shortfall0.0005770801912098m). Triangle148, area0.024455938113361657m².

These are positive-area triangles at station's southern end. Unlike v3's numerical fan debris, neither can be discarded as degenerate. The reported `buried` label means “gap<.035,” not negative gap. No tolerance change proposed.

## Expanded footprint: actual effects and limits

Impact bounds H X1281.1555291604095–1298/Z714–736. Full ground:59 changed lattice vertices,366 affected before/after triangles, largest vertex cut0.107476145029068m. Lite:35 vertices,222 triangles, largest cut0.3749780058860779m. Sampled ground is below the apron in both tiers (0 proud witnesses), but this does not prove its exterior slopes or unrelated path paint.

Two native routes are affected:

1. `path:station:funicular:town~road:foot` (the intended repair):117 impact samples, max selected-floor raise0.7377003756390863m; max lower0.003763946749131719m. Ground-only samples outside apron also change:9full/29lite, maximum cuts0.003204992382/0.035310221340m.
2. **`path:town:north~station:funicular:town` (adjacent existing route):**116 impact samples, max selected-floor raise0.31486883176058456m at `[1293.3243969586906,55.47653455997068,725.549037502939]` (oldterrain55.3180223 → apron55.6328911). This route is not among8 movement attempts.37full/78lite ground-only samples are cut despite no apron above them. Strongest lite witness `[1294.078938036659,55.49824927925436,728.6840903071474]`: physical query unchanged, actual drawn ground55.59266709502407→55.37883690654408, **−0.2138301884799887m**, apron:null. This is a genuine new rendered-ground cut, not baseline mismatch. Existing town-path gravel is not exercised by the single-path art proof; exact burial/hover of that unchanged ribbon is therefore unproven, and needs explicit art/support and movement checks before accepting the expanded footprint.

Scenery inventory finds no native trees and only3 authored tuft roots in impact bounds; no shrubs/flowers/props. Two full roots at Y53.23 are already~1.96/2.00m below both old/new drawn ground, unchanged. Lite root `[1297.2306795461025,53.23,723.4544299285994]` has ground55.230748822976125→55.2275781296696 (−0.00317069330652231m); it remains buried by1.9975781296696m, but that burial is overwhelmingly baseline and the new cut slightly reduces it. No new root hover/burial demonstrated by these saved samples. This origin inventory is not all emitted plant vertices or GPU appearance proof.
