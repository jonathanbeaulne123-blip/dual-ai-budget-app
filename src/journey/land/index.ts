/**
 * The Journey land (T2; Horizon Clock L2) — public API. The clay diorama island derived from the real baked Horizon
 * land (index + the 20 m `journey` terrain LOD): `buildJourneyLand` (clay, diorama units, `dioramaFrame` from the
 * coastline), its SVG twin and the three clay palettes.
 *
 * Bundling note: `clay.ts` (three + home art) and `JourneyLandFlat.tsx` (React, no three) are separate entries so a
 * flat-only mount can import `./flat.ts` + `./JourneyLandFlat.tsx` without three.
 */
export { loadJourneyLand, journeyLandTimings, resetJourneyLandCacheForTests, type JourneyLandTimings } from "./load.ts";
export { JOURNEY_LAND_SLIM_URL, JOURNEY_LAND_SLIM_FORMAT, encodeJourneyLandSlim, decodeJourneyLandSlim, parseJourneyLandSlim, type JourneyLandSlim, type JourneyLandSlimSource } from "./slim.ts";
export { extractJourneyLand, isMinorLine, LINE_TOLERANCE } from "./extract.ts";
export { buildJourneyLand, createClayLights, setJourneyLandCalm, placeClayScenery, CALM, CLAY_LAND_LOD, JOURNEY_LAND_BUDGET, CLAY_LAND_NAME, CLAY_NAMES, type ClayLandHandle, type JourneyLandCalm } from "./clay.ts";
export { dioramaFrame, enclosingCircle, createClaySurface, clayLift, smoothRing, offsetRing, resampleLine, distanceToLine, CLAY, type ClaySurface } from "./diorama.ts";
export { JOURNEY_CLAY_PALETTES, JOURNEY_PROP_PALETTE, CLAPBOARD, CLAY_COLOUR_KEYS, PROP_COLOUR_KEYS, clayPalette } from "./clayPalette.ts";
export { countDraws } from "./clayKit.ts";
export { planBridges, bridgeDrawIndices, locateOnBridge, BRIDGE_DRAW_ERROR, RAMP_EU, type BridgePlan } from "./road.ts";
export { createLandSurface, createTerrainSampler, type LandSurface } from "./surface.ts";
export { journeyLandFlatData, landformBand } from "./flat.ts";
export { JourneyLandFlat, type JourneyLandFlatProps } from "./JourneyLandFlat.tsx";
export { DISTRICT_NAMES, HOST_NAMES, STATION_NAMES, districtName, hostName, reserveName } from "./names.ts";
