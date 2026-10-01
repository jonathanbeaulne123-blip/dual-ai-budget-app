# Page L disposition and proposed decision

**The original landscape acceptance debt is resolved; the four inherited portrait deficits are not.** No camera, geometry or threshold was changed by this investigation, and no exception has been approved.

The historical “3-pixel Boathouse regression” refers to the Quay abutment's landscape loss described in `test/horizonViews.test.ts:105` and `BRIDGES.md:301`. The exact available before snapshot (`324cd5f`) has11 landscape pixels; integrated main `1cf76c5` and current both have13, meeting the unchanged13-pixel rule. The bridge merge supplied that recovery with the authored camera unchanged. The current portrait Boathouse has5 of8 required pixels: a separate three-pixel shortfall, not the historical three-pixel regression. Do not conflate the two or claim the current branch lost three pixels.

| Portrait page / subject | Original324 | Integrated main | Current | Required |
|---|---:|---:|---:|---:|
| C / skate shelf | 4 | 4 | 4 | 8 |
| D / surf | 0 | 0 | 0 | 8 |
| F / L01 | 0 | 0 | 0 | 8 |
| L / Boathouse | 4 | 5 | 5 | 8 |

Current all12 landscape pages pass their baked proof. The original failing C/D/F subjects and all four cameras remain unchanged. L improved with integrated main; its current complete proof equals that baseline. These are numeric source-proof facts, not a substitute for final rendered furniture/occlusion review.

## Bounded repair study — no viable small change

- Exact original L replay:26 possible Boathouse-prefix silhouette rays,5 visible. First blockers:12terrain,7S3 surface,2Quay abutment. The original subject counts reproduce; source hashes remain stable.
- Both terrain-only candidates failed portrait visibility. Tightening the bank cut lowered29 vertices by up to2.2024m yet left5pixels. It created63 genuine town.quayLink underside gaps (worst0.7374m), increased24 already-open bridge-underdeck gaps, and worsened an existing40.2987°face to40.6036°. Rejected; unchanged walking-floor heights do not make exposed undersides acceptable.
- All three raised-eye candidates (+0.3/+0.6/+1m) remained5pixels. Rejected.
-32 nearby quay XY candidates were checked:26 passed the sampled real-floor/standing checks and were rendered numerically;6 were rejected before view testing. All26 standing proposals remained≤5Boathouse pixels. With original included,27frames were measured. Targets/FOV/threshold stayed fixed; every frame kept the horizon and Lantern Row passing. No practical local view alternative emerged.

This does not prove every imaginable view/geometry redesign impossible. It does establish that further work is a broader authored scene/view intervention, not a safe small terrain trim or a simple nearby standing-eye adjustment. Additional blind camera hunting is not warranted. The native Mountain geometry, S3 and Quay Bridge should remain unchanged in this task absent a concrete separately reviewed redesign.

## Recommended decision draft for Jonathan

“The Quay's original landscape view now passes without moving its camera. Four phone views still have the same inherited visibility problems: the skate shelf, surf, L01 and the Boathouse. I tested local bank repairs and nearby standing viewpoints; none fixed the Boathouse safely.

**Recommended: finish Mountain Road with these four explicitly recorded portrait exceptions**, keeping the existing cameras, geometry and visibility standards. They remain open defects, and final captures must show no new regression from this work.

Or **include a broader authored portrait-view redesign now**, with a separately reviewed proposal before changing camera composition or surrounding structures. That expands the remaining work; there is no proven small repair ready to apply.”

Approval is needed because the original request did not waive owed view failures. The first option is a named scope/acceptance exception, not a threshold change or a statement that all views pass. The second is authorization to prepare a broader redesign, not advance approval of unknown camera/bridge/route/native modifications. Do not quietly adopt either option.

## Evidence and preservation

`/tmp/mountain-page-L-final-evidence-manifest.json` records SHA256, source fingerprints, exact source-world comparisons, every measured variant's subject counts, and the original report paths. Copy whole observed directories (including bundle, adapter, report and root logs) into distinct durable evidence folders; retain rejected attempts. Existing detailed findings: `/tmp/mountain-page-L-investigation.md`, `/tmp/mountain-page-L-bank-disposition.md`. No additional heavy run is requested.
