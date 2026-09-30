# Bridge baseline audit

Source e77309efbc48a76e8328f2b427613ecc6082bb61. Local full bake; no device evidence.

Counts below are controller runs, not verified geometry defects. `incomplete-probe` needs capture correlation.

| Bridge | Mode | Forward | Reverse |
|---|---|---|---|
| highSpan | board | unverified | unverified |
| highSpan | bicycle | unverified | unverified |
| highSpan | cruiser | unverified | unverified |
| quayBridge | board | unverified | unverified |
| quayBridge | bicycle | unverified | unverified |
| quayBridge | cruiser | unverified | unverified |
| bightBridge | board | unverified | unverified |
| bightBridge | bicycle | unverified | unverified |
| bightBridge | cruiser | unverified | unverified |
| apronBridge | board | unverified | unverified |
| apronBridge | bicycle | unverified | unverified |
| apronBridge | cruiser | unverified | unverified |
| hollowBridge | board | unverified | unverified |
| hollowBridge | bicycle | unverified | unverified |
| hollowBridge | cruiser | unverified | unverified |
| reachFootbridge | board | unverified | unverified |
| reachFootbridge | bicycle | unverified | unverified |
| reachFootbridge | cruiser | unverified | unverified |
| reachBoardwalk | board | unverified | unverified |
| reachBoardwalk | bicycle | unverified | unverified |
| reachBoardwalk | cruiser | unverified | unverified |
| timberCrossing | board | unverified | unverified |
| timberCrossing | bicycle | unverified | unverified |
| timberCrossing | cruiser | unverified | unverified |
| gardenWalkBridge | board | unverified | unverified |
| gardenWalkBridge | bicycle | unverified | unverified |
| gardenWalkBridge | cruiser | unverified | unverified |
| seaStairWestLaneBridge | board | unverified | unverified |
| seaStairWestLaneBridge | bicycle | unverified | unverified |
| seaStairWestLaneBridge | cruiser | unverified | unverified |
| seaStairEastLaneBridge | board | unverified | unverified |
| seaStairEastLaneBridge | bicycle | unverified | unverified |
| seaStairEastLaneBridge | cruiser | unverified | unverified |
| mountainRoadCanalBridge | board | unverified | unverified |
| mountainRoadCanalBridge | bicycle | unverified | unverified |
| mountainRoadCanalBridge | cruiser | unverified | unverified |
| s1InflowBridge | board | unverified | unverified |
| s1InflowBridge | bicycle | unverified | unverified |
| s1InflowBridge | cruiser | unverified | unverified |
| inflowFootbridge | board | unverified | unverified |
| inflowFootbridge | bicycle | unverified | unverified |
| inflowFootbridge | cruiser | unverified | unverified |
| prowLoopFootbridge | board | unverified | unverified |
| prowLoopFootbridge | bicycle | unverified | unverified |
| prowLoopFootbridge | cruiser | unverified | unverified |
| bightSpurTrestle | board | unverified | unverified |
| bightSpurTrestle | bicycle | unverified | unverified |
| bightSpurTrestle | cruiser | unverified | unverified |

Reaching an end projection is NOT a traversal pass: falls, contacts, fades, deck height and lateral error require witness review. Per-run airSteps/events/maxLateral/start/final/progress are in audit.json.

## Unverified modes

- walk: Runtime closure: use browser simulateMotion; static body probe here is not walking simulation
- ferry: No registered controller at baseline
- rowboat: No registered controller at baseline; fleet kayak is a different craft
- plane: No registered controller at baseline
- zip: No registered controller at baseline
- glider: Implemented; authored-course bidirectional replay not yet audited
- gondola: Implemented; cable swept envelope not yet measured
- monorail: Implemented kinematic transport; swept envelope not yet measured
- skate: Board deck runs only; S2/S4 grind lines not covered
