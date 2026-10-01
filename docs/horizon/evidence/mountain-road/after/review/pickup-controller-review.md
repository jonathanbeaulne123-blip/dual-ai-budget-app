# Pickup hold review

Scope: source-only review of `/tmp/mountain-pickup-controller.patch`, the current board controller, contact/kernel input seams, bicycle profile, runtime input mapping, RIDE §6.5, and the existing threshold regression. No checkout changes, tests, runtime imports, or world builds performed.

## Finding addressed by root

The original patch released the hold only for `abs(input.steer) > PUSH_FORWARD` (0.3). That introduces an unrelated steering deadzone: runtime/moverInput.ts:33 and controller `axes()` preserve smaller finite analog steering, and shared/ground/tyre.ts `commandedYaw()` pivots at low speed for any nonzero steering. A 0.1 steering input would animate the rider's roll but never begin the steering physics. Root reports its proposal now uses sanitized `input.steer !== 0`; this addresses the finding without changing input policy. Proposed tests include ±0.1.

## Contract and lifecycle assessment

This is a controller handover hold, not a kernel/profile retune. RIDE §6.5:227 promises pickup stopped and facing along the bed; the existing threshold test additionally requires zero speed after an idle update. Holding only the initial legal-ground handover restores that tested expectation on the true graded source surface without flattening it. It does change idle behavior at all board/bicycle pickups, so describe that scope explicitly; do not describe it as a summit-only terrain fix. Neither ordinary coasting nor a stopped rider after deliberate motion should acquire this hold.

The proposed lifecycle is coherent: `reset` clears it; only `enter` arms it when contact is on and legal; `place` goes through reset and stays unheld; successful `resumeAt` explicitly clears it; rejected resumes leave the previous state alone; dispose clears it. Pausing Look/Island does not recreate the controller, and thus preserves whichever initial-hold state already existed. No kernel time is accumulated while waiting. Camera/HUD/pose continue updating. Push/slide reaches the first normal physics step with its original edge. Space can charge before release; a board pop releases the hold, while bicycle's no-pop profile does not. No profile, gravity, resistance, slope, pace, or bail constants change.

The arm condition correctly excludes illegal/off-bed and airborne pickup states. It caches the entry contact, which is suitable for the fixed authored pickup surfaces examined here. This review does not establish behavior for a pickup surface removed or newly flooded while held; the proposal does not poll changing support or submergence during the hold. No specific current moving/flooded pickup witness was found, so this is a coverage limit rather than a claimed regression.

## Focused test proposal

`/tmp/mountain-pickup-focused-tests.patch` appends parameterized board and bicycle lifecycle cases to `test/horizonBoardThresholds.test.ts`. It reuses that suite's existing loaded dependencies, but injects the existing `syntheticQuery` plane at 4.8% grade. Thus lifecycle assertions do not depend on a duplicate slab or accidental terrain flattening; the original summit test remains the real-world pickup proof.

Tests cover:
- Two seconds idle with look input: exact fixed position/zero speed/no kernel steps.
- First push after waiting: exactly 12 normal steps over 0.1 s, same position/velocity as an ordinary placed controller receiving the same push; next idle update continues normally.
- ±0.1 steering and slide: release immediately, keep stepping afterward; small steering changes heading.
- Illegal and airborne entry: never frozen.
- Place and physical resume at zero speed: normal gravity resumes (positive speed on the plane).
- Space charge/release: board emits airborne and rises; bicycle remains held and emits no airborne event.

No tests were executed, respecting root's serialized test slot. The proposal should be applied after the controller fix and typechecked/run by root. The synthetic cases do not replace the baked summit fixture or full movement audits.
