# Local bridge build — look and limits

The Suspension Bridge now has cable-and-hanger architecture, a guarded tower stair and balcony, and Gateway Terrace at deck level. The other nine landmark forms are built in the same source model, but their signature experiences are unfinished; see the per-bridge table in `docs/CODEX_HORIZON_BRIDGES_1.md`.

These images are headless Chrome/SwiftShader captures. They are not phone or physical Mac evidence. The current checkout is local and uncommitted; nothing has been deployed.

## What to look at

- `bight-themes/`: first day/night matrix, three themes and two poses. The day images show the built architecture. Its night images precede the correction that removed floating cable-light pools over water, so use `night-final/` for the final lighting.
- `night-final/`: final-bake night air pose in all three themes. High cable beads remain emissive; only supported deck lamps project pools. All three final images completed with no pending districts or browser errors; their recorded full-scene air-view calls are 50/139/58 (Classic/Taylor/Newfoundland).
- `map-320/`, `map-390/`, `map-720/`, `map-1100/`: real Journey Region/Stop scenes with the actual name/glyph overlay in each theme. All 24 captures show an unclipped Bight label. These are fictional household fixtures. Each isolated-map browser run logged one resource 404; the capture report retains that warning. The flat edition uses the same label component; these screenshots exercise the 3D map only.
- `flight/audit.json`: four bounded glider replays through the complete Bight/High Span bridge widths. These are not complete authored courses.
- `ground/audit.json`: all 96 general ground-controller runs retained, including incomplete probes. Bight board-on-V01 fades are inapplicable route/profile checks; its S2 flyover still needs a dedicated skate replay.
- `budget/bight.json`: actual isolated bridge batches, including theme detail and the corresponding full/lite baseline. Whole-scene peaks remain separate.

## Rough areas

The overview does not prove the stair's body clearance; the input-driven ascent/descent replay does. The central towers and S2 crossbeams make the central opening visually busy. A 200m approach matrix and 64px blind silhouette comparison are still owed. The new high necklace lights do not create floor pools beneath themselves.

The first full-scene capture matrix reached 457 draw calls. Bridge-only counts fit their targets, but this is not acceptance of the total scene. Quay's deck is fixed, Ribbon has no pumpable wave yet, and several water/cable/rail passages are unverified or have no registered mode. No physics was changed to conceal these gaps.

Authored cameras remain unchanged. Page L's landscape Boathouse count improves from 11 to 13 pixels; its phone proof remains 5 pixels and is still unaccepted. Four existing portrait view failures remain.

## Next owner

Codex owns remaining implementation, controller proofs, full per-PR tests and performance acceptance. Jonathan owns the requested exemplar look and optional phone ride before proceeding to the remaining per-bridge/pair release work. This is a local review checkpoint, not a complete-cast or release claim.
