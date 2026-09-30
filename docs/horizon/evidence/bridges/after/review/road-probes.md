# Road probe corrections

The original auditor measured the baseline as 0 BLOCKER / 23 MAJOR / 85 MINOR and the new bake as 0 / 23 / 88, both with zero restarts. Investigation found four new classifications and one removed scenery finding.

Three new VBS findings came from fixed +3m lateral scans outside its 5m carriageway. The lip tracker fell onto terrain before reaching the bridge and continued following that lower surface. At the reported witness [920.59,22.57,872.49], a query at expected road height 27.526335838 finds the meeting deck at 27.548186290; a query at the reported lower height finds terrain at 22.569239704. The actual connector starts within 0.001204m of its authored bed and meets the flat bay exactly.

The new Prow finding associated a pedestrian bay endpoint with V01 simply because it was within 12m. That endpoint is 11.31046336m from the road and has no longitudinal road connection. It is not a road transition.

The auditor now keeps longitudinal samples within each road's width with 0.3m body clearance. Independent edge/drop auditing remains. A structure must own the road and have an endpoint within its carriageway before it is treated as a longitudinal transition; side-bay crossings retain their separate junction check. No source geometry or severity threshold was changed to suppress these findings.

Both baseline and current assets are replayed through this identical corrected auditor. Its reports record the asset revision, current code HEAD and auditor hash. This is a bounded comparison under current unchanged controller/geography code, not a recreation of a historical runtime installation. The original reports remain alongside the corrected reports; compare added/removed event identities as well as totals.

Independent read-only review confirmed the width correction and recommended the ownership and provenance checks now included.

## Corrected baseline review

The corrected baseline is 0 BLOCKER / 13 MAJOR / 83 MINOR. All 12 actual road transition endpoints remain: High Span, Quay, Bight main deck, Mountain Canal, Prow Tunnel and Bight Spur Trestle, both ends. Only six S2 ramp/flyover endpoint comparisons against nearby V01 were removed by ownership filtering.

The ten fewer MAJOR classifications come from the width-aware scans. Five disappear (Library/Year Walk, Studio/approach, VBS/S4, VBS/Year Walk and Trestle end); five become MINOR (Cottage/Garden Walk, Library/Cove Walk and three service-road/Year Walk junctions). Every former worst witness was at offset ±3 outside a 5m carriageway. Trestle's endpoint is still audited; its former worst witness was on the S4 verge 13.6m beyond the endpoint. This is corrected classification, not a claim that geometry repaired ten defects.

## Corrected before/after result

Identical auditor hashes: baseline 0/13/83, current 0/13/82, zero restarts in each. No new finding location or severity appears. Garden Bridge's old support-near-road warning disappears. The existing Quay right-edge drop at V01 station 3548 measures 0.92m before and 0.93m after, both MINOR; that edge remains owed. `after/road-corrected/comparison.json` preserves raw event differences and separates changed measurements from new locations.
