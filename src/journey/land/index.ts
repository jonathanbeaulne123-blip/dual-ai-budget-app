/**
 * The Journey land (T2; Horizon Clock L2) — public API. The clay diorama island derived from the real baked Horizon
 * land (index + the 20 m `journey` terrain LOD): `buildJourneyLand` (clay, diorama units, `dioramaFrame` from the
 * coastline), its SVG twin and the three clay palettes. The route board's flat land (`buildJourneyRouteLand`, the
 * dressings) stays deprecated until the integrator deletes the route board.
 *
 * Bundling note: `build.ts` (three + home art) and `JourneyLandFlat.tsx` (React, no three) are separate entries so a
 * flat-only mount can import `./flat.ts` + `./JourneyLandFlat.tsx` without three.
 */
export { loadJourneyLand, journeyLandTimings, resetJourneyLandCacheForTests, type JourneyLandTimings } from "./load.ts";
export { JOURNEY_LAND_SLIM_URL, JOURNEY_LAND_SLIM_FORMAT, encodeJourneyLandSlim, decodeJourneyLandSlim, parseJourneyLandSlim, type JourneyLandSlim, type JourneyLandSlimSource } from "./slim.ts";
export { extractJourneyLand, isMinorLine, LINE_TOLERANCE } from "./extract.ts";
export { buildJourneyLand, createClayLights, setJourneyLandCalm, placeClayScenery, CALM, CLAY_LAND_LOD, CLAY_LAND_NAME, CLAY_NAMES, type ClayLandHandle, type JourneyLandCalm } from "./clay.ts";
export { dioramaFrame, enclosingCircle, createClaySurface, clayLift, smoothRing, offsetRing, resampleLine, distanceToLine, CLAY, type ClaySurface } from "./diorama.ts";
export { JOURNEY_CLAY_PALETTES, JOURNEY_PROP_PALETTE, CLAPBOARD, CLAY_COLOUR_KEYS, PROP_COLOUR_KEYS, clayPalette } from "./clayPalette.ts";
export { countDraws } from "./clayKit.ts";
/** @deprecated Horizon Clock: the route board's land and its view controls; deleted with the route board. */
export { buildJourneyRouteLand, setJourneyLandTier, setJourneyLandView, JOURNEY_LAND_BUDGET, JOURNEY_LAND_GROUP_NAME } from "./build.ts";
export { planRoad, planBridges, type RoadPlan, type RoadRun, type RoadVertex, type BridgePlan } from "./road.ts";
export { buildBridges, BRIDGES_NAME } from "./bridges.ts";
export { DECK_LINES_NAME, MAJOR_LINES_NAME, MINOR_LINES_NAME } from "./lines.ts";
export { createLandSurface, createTerrainSampler, type LandSurface } from "./surface.ts";
export { journeyLandFlatData, landformBand } from "./flat.ts";
export { JourneyLandFlat, type JourneyLandFlatProps } from "./JourneyLandFlat.tsx";
export { JOURNEY_LAND_DRESSINGS, JOURNEY_LAND_EXTRAS, LAND_DRESSING_KEYS, LAND_EXTRA_KEYS, LINE_DRESSING_KEY, landDressing, landExtras, type JourneyLandExtras } from "./dressing.ts";
export { DISTRICT_NAMES, HOST_NAMES, STATION_NAMES, districtName, hostName, reserveName } from "./names.ts";
