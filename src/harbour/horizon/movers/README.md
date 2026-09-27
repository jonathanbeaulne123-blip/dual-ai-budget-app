Pass 2 movers (`docs/horizon/passes/02-movers.md`, `docs/horizon/FLIGHT.md`).

- `shared/` is the integrator's seam: `mode.ts` (ModeId, ModeInput, ModeController), `threshold.ts` (ThresholdOffer, offersAt, carried thresholds), `vehicleArt.ts` (fixed dimensions and anchors, greybox proxies), `wind.ts` (WindSource; the constant south wind until pass 2b's wind clock).
- `registry.ts` keeps exactly one active mode; a mode starts only by accepting a valid ThresholdOffer; `flag()` holds a mode back from a build.
- Each track writes only inside its own folder (`glider/`, `plane/`, …) and registers its controller with `runtime.movers.register(id, factory)`; the runtime's mover hook (`runtime/moverHook.ts`) drives it.
