# Mountain audit independent source review

Two actionable audit correctness findings. Proposed patch: `/tmp/mountain-audit-independent-fixes.patch`. No checkout edits, tests, world imports, builds, browser or simulation were run. Findings below are source-derived witnesses, not claims that an existing actual attempt was falsely green.

## P2 — completion can combine two different poses

`scripts/horizon/mountain-native-audit.mjs:38-39` stores `d = max(d, pr.d)` and then checks `d >= length - 0.5 && pr.off < 1`. The same pattern is in `scripts/horizon/mountain-modes-audit.mjs:67-69`.

For a 100m route, an observed pose at station99.7/off1.2 does not pass. If the rider then rolls back to station97/off0.2, the retained high-water value99.7 combines with the later lateral value0.2 and incorrectly passes, although the current pose is3m short of the endpoint. Such rollback matters especially in the new no-brake scenario. The error is inherited from the earlier native/modes loops, not introduced by telemetry arithmetic, but it remains part of the audit's endpoint verdict.

Minimal correction: decide completion from current `pr.d` and current `pr.off`. Keep monotone `d`, completedDistanceM, stall tracking, all geometry, and the existing half-metre/one-metre acceptance thresholds unchanged. The patch adds one pure helper shared by native and modes audits, and tests the missed-finish/rollback sequence plus genuine current finish and exact lateral boundary. It also hashes that helper in modes provenance.

## P2 — unknown legacy off-bed observations become a green zero

`scripts/horizon/summarize-mountain-hairpins.mjs:108-111` maps absent legacy cruiser `offBed` to `false`. `hairpinObservation` then counts zero off-bed samples, even when the source report never measured this field. The native conversion similarly coerces a missing lateral measurement to false through comparison with undefined.

Minimal correction: retain missing flags as null, return offBedSamples:null when no interior samples have a measured flag, and publish measured/unknown sample counts when evidence is partial. An explicitly measured all-false trace still returns zero. The patch includes pure checks for unknown, measured-clear and mixed observations. This affects report interpretation only.

## Other reviewed behavior

- Native spatial-to-chain plan station mapping uses actual matched point coordinates and cumulative horizontal length. The known23micrometre shared Foot row allowance is confined to its named exact-plan witness; other rows retain the original position tolerance.
- Reverse native samples subtract their travel station from the local reach length before adding that reach's chain offset. The new chainRange derives from the actual selected baked rows. Stillwater lacks a canonical chain part and is explicitly ignored by the hairpin reducer instead of being mapped onto an unrelated route.
- Post-step native telemetry copies the mutable presenter before stepping and stores a copy afterward; the cruiser kernel returns a new state. Heading/velocity derivative calculations therefore use distinct states.
- The natural cruiser policy uses zero brake and recovery throttle below1.5m/s, forbids audit restarts and exact-start searches, and labels its absent grounded gravity. It does not pretend to measure a finite physical grip reserve. Native natural attempts stop at bail/recovery. No timeout was newly converted to completion by this patch.
- Hairpin entry interpolation requires same segment, plausible station/time delta and no discontinuity. Direct interior observations are explicitly described as reach, not a clean completed passage. Legacy radius is not silently substituted for measured curvature.
- The reducer requires the same baked-world hash and consistent terrain hashes. It keeps paced and natural scenario identities and rejects overwriting cross-scenario raw output.

## Limits

The review did not independently run the13 existing tests or the2 proposed regressions. Apply and run the lightweight telemetry test before using updated reports. No actual failure/success metrics were remeasured; the historical completedDistanceM remains a high-water diagnostic, not a current-position value. The cruiser intentionally retains its pre-existing1.5m finish margin and half-metre sample tracking; this review does not promote that to exact-endpoint acceptance. Full trace cadence and sampled exposure remain measurement limitations. Physical grip, streamed readiness, visual lighting and device behavior remain outside these scripts.

Reviewed pre-patch SHA-256:

- road-audit.mjs: ee7388f7f6ceb10a9b4323031864f5e53d09b33ba6595936461379a6a0e6b31f
- mountain-native-audit.mjs: 1b8f17ee2af32e14e7224a71ad8dc7aee54206239235f56d264b55df21545838
- mountain-audit-telemetry.mjs: 23a61bc7a84a52b72afb824245da715e15eee3985a70660a8f98a52a14111b96
- summarize-mountain-hairpins.mjs: f9ea4585a224046fdb651137e09b8d96ec5f22e3d9349a98cbab6c835a3d86cd
- mountain-audit-telemetry.test.mjs: eb271f2892609e66d74cdffdefee77e59f9a94f726d996169eb02e2e89b0e5d6
