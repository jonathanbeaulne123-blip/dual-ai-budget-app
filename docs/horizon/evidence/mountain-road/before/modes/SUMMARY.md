# Multi-mode baseline results

54 attempts: 14 completed, 40 did not complete. No uninterrupted full-chain attempt completed (0/6). Forward is V03 outer end toward summit; reverse is summit toward V03 outer end.

| Mode | Forward completed / attempted m | Stop | Reverse completed / attempted m | Stop |
|---|---:|---|---:|---|
| bicycle | 326.53 / 1287.68 | stalled-no-progress-5s | 617.07 / 1287.68 | bail |
| Horizon registry board | 4.56 / 1287.68 | automatic-fadeBack-reset | 71.22 / 1287.68 | automatic-fadeBack-reset |
| walking | 351.86 / 1287.68 | walking-airborne-handoff | 774.72 / 1287.68 | walking-airborne-handoff |

Independent reaches: V03 bicycle/walking both directions completed; course lane Horizon registry board/walking both completed; Mountain road no mode/direction completed. Crown footway walking both completed. Year Walk mountain reach 2 bicycle/walking both completed. No other footway attempt completed. These independently placed attempts never combine into a continuous ride.

One timeout: bicycle reverse course lane, 4.79 / 21.51 m in 82.00 simulated seconds. Limit is min(1500, path length / 1.0 + 60) seconds. Its slow positive creep repeatedly exceeds 0.2 m per 5 seconds, avoiding the stall threshold while never reaching the end. Timeout is inconclusive, not a pass.

## Critical limits

- `board` in results.json means Horizon registry board, NOT the everyday shell native skate. The shell native driver is separately probed in native-results.json.
- Walking executes exact extracted runtime move() but hard-codes gateOpen true, assumes all chunks and Mountain region ready, and stops at first unsupported/airborne handoff. It does not execute parachute continuation, rendering, camera or UI.
- Bicycle/registry-board body kernels and profiles are unchanged. Camera collision callback omitted for performance; all body collision queries are intact.
- Scripted pure pursuit/braking is only a baseline; tight bends, braking slides and low-speed creep may be probe-driver limitations. Do not label every stop a world defect. Registry board accepts skate/park/pad; bicycle accepts road/trail/pad. Illegal beds and automatic fadeBack can be expected mode restrictions.
- Reported distance omits 0.5 m at start; completion tolerates final 0.5 m. Initial y is surface-resolved once; there are no subsequent injected snaps/restarts.

## Native everyday shell skate driver

18 route/direction starts assessed; 12 were outside the shell canStart radius and were not ridden. Six admitted attempts: course lane completed both directions (~21.04/21.05 of 21.51 m); V03 reverse bailed at 105.13/326.87 m; Mountain road forward reached 679.19/938.29 m at the explicit 180 s time budget (inconclusive, not blocked); Year Walk reach 1 reverse stalled at 45.49/271.38 m and reach 3 forward stalled at 153.08/269.37 m. Native whole-chain starts at both endpoints are outside the shell start radius, so no native whole-chain attempt occurred.

This is the exact headless driver instantiated by createNativeSkate({obstacles:[]}), not the rendered adapter or UI. It uses native Mountain skateField/collision and native ground, not Horizon baked body collision. The adapter only translates positions and provides Horizon blocking to its camera. Its native field/shore can therefore diverge from visible Horizon roads. Ordinary intent hook supplies steer/push/brake only; no resets after mount, no commands/race-route starts or rescue. Native timeouts are preserved rather than rerun with expanded thresholds.
