# Current bridge inventory — measured bake queries

Base e77309efbc48a76e8328f2b427613ecc6082bb61. 16 structure records; 103 identified solids; 40,772 baked structure triangles. Counts exclude runtime dressing, terrain, corridor and placed-region geometry. They are not runtime draw-call budgets.

Span/width are source inputs except trestle length, which is the current carried arc. Headroom is a centreline geography query over deck plus6eu approaches at0.5eu intervals. It is not a swept passage envelope. `open-sky` means the sampled vertical query found no ceiling; it does not prove unobstructed airspace.

| Structure | Span × width eu | Surface samples | Missing surface | Max bed/surface mismatch eu | Query minimum headroom | Structure triangles |
|---|---:|---:|---:|---:|---|---:|
| highSpan | 104.000 × 10 | 233 | 0 | 0.0335 | open-sky | 6104 |
| quayBridge | 90.000 × 16 | 205 | 0 | 0.0112 | open-sky | 3296 |
| bightBridge | 245.000 × 21.6 | 515 | 0 | 0.0083 | 5.000eu | 15524 |
| apronBridge | 45.000 × 4 | 115 | 0 | 0.0092 | 1.000eu | 1124 |
| hollowBridge | 32.000 × 8 | 89 | 0 | 0.0164 | 3.524eu | 840 |
| reachFootbridge | 48.000 × 3 | 121 | 0 | 0.1099 | 1.000eu | 1324 |
| reachBoardwalk | 112.000 × 4 | 249 | 0 | 0.0157 | 1.000eu | 2932 |
| timberCrossing | 20.000 × 3 | 65 | 0 | 0.3554 | 1.000eu | 568 |
| gardenWalkBridge | 40.000 × 3.2 | 105 | 0 | 0.0026 | open-sky | 1964 |
| seaStairWestLaneBridge | 14.000 × 5.4 | 53 | 0 | 0.0172 | open-sky | 888 |
| seaStairEastLaneBridge | 16.000 × 5.4 | 57 | 0 | 0.0004 | open-sky | 896 |
| mountainRoadCanalBridge | 18.000 × 17 | 61 | 0 | 0.0062 | open-sky | 580 |
| s1InflowBridge | 12.000 × 5 | 49 | 0 | 0.0109 | open-sky | 560 |
| inflowFootbridge | 10.000 × 3.2 | 45 | 0 | 0.0008 | open-sky | 528 |
| prowLoopFootbridge | 29.000 × 6 | 83 | 0 | 0.0104 | open-sky | 1156 |
| bightSpurTrestle | 69.511 × 5 | 164 | 0 | 0.0130 | open-sky | 2488 |

The1eu queries at Apron, Reach and Timber Crossing are review witnesses, not yet proven clearance defects. Bight’s sampled5.0eu agrees with its S2 flyover diagnostic. Hollow’s3.524eu sample includes its approach and is lower than the3.65eu nominal interior clearance. See static-probes/audit.json for coordinates and source surface IDs.

Bight spur authored span68eu versus measured carried arc69.5108eu: do not assume the two definitions are interchangeable. Prow uses the Year Walk, not a nonexistent `walk prow` bed.

Controller report: [AUDIT.md](before/AUDIT.md). Full passage acceptance remains open.
