# Baseline controller results

Current controllers, unchanged. Reached destinations and projected endpoints are not full passage acceptance. Walking paths need deck/body-envelope review; board/bike fades remain visible in ground JSON.

| Structure | Walking (+ / −) | Ground statuses (board/bike/cruiser × both directions) |
|---|---|---|
| highSpan | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 4 end-reached-unverified |
| quayBridge | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 4 end-reached-unverified |
| bightBridge | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 4 end-reached-unverified |
| apronBridge | no-route / no-route | 4 incomplete-probe; 2 not-applicable |
| hollowBridge | destination-reached-review-path / destination-reached-review-path | 3 incomplete-probe; 1 end-reached-unverified; 2 not-applicable |
| reachFootbridge | no-route / no-route | 4 incomplete-probe; 2 not-applicable |
| reachBoardwalk | destination-reached-review-path / destination-reached-review-path | 2 end-reached-unverified; 2 incomplete-probe; 2 not-applicable |
| timberCrossing | incomplete-runtime-replay / incomplete-runtime-replay | 4 incomplete-probe; 2 not-applicable |
| gardenWalkBridge | destination-reached-review-path / destination-reached-review-path | 4 incomplete-probe; 2 not-applicable |
| seaStairWestLaneBridge | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 2 end-reached-unverified; 2 not-applicable |
| seaStairEastLaneBridge | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 2 end-reached-unverified; 2 not-applicable |
| mountainRoadCanalBridge | destination-reached-review-path / destination-reached-review-path | 5 end-reached-unverified; 1 incomplete-probe |
| s1InflowBridge | destination-reached-review-path / destination-reached-review-path | 3 end-reached-unverified; 1 incomplete-probe; 2 not-applicable |
| inflowFootbridge | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 2 end-reached-unverified; 2 not-applicable |
| prowLoopFootbridge | destination-reached-review-path / destination-reached-review-path | 3 incomplete-probe; 1 end-reached-unverified; 2 not-applicable |
| bightSpurTrestle | destination-reached-review-path / destination-reached-review-path | 2 incomplete-probe; 4 end-reached-unverified |

Walking:32 runs,26 destination-reached-review-path,4 no-route (Apron and Reach Footbridge, both ways),2 incomplete-runtime-replay (Timber Crossing, both ways). Ground:96 rows,34 end-reached-unverified,40 incomplete-probe,22 cruiser not-applicable.

`walk/trace-review.json` is an explicitly partial9-run correlation snapshot. Its six High Span/Quay/Bight traces remain within0.025eu of the carried centreline and0.032eu of bed height; this does not establish body clearance. The complete32 raw walking traces are in `walk/audit.json`.
