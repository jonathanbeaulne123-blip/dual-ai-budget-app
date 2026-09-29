/**
 * The Journey board layer (T3) — public API.
 *
 * - `layoutRoute(board, land)` → `RouteSpace` (pure): the ribbon through the 12 stations, month + day spaces, crossings.
 * - `createJourneyBoardScene(host, options)` → the 3D board on the land, on the shared renderer lease.
 * - `placeLabels(candidates, stage)` (pure) + `labelRankFor(board, id, selected)`: collision-aware DOM labels.
 * - `boardMarks` / `boardMarkIds`: the one list of mark ids (3D anchors and the flat twin share it).
 * - `<BoardFlat>`: the same board on the SVG twin (inside `<JourneyLandFlat>`'s overlay).
 * - `JOURNEY_BOARD_DRESSINGS` / `boardDressing`: the three authored themes.
 *
 * Bundling: `scene.ts` pulls three; a flat-only mount can import `./route.ts`, `./marks.ts`, `./labels.ts` and
 * `./BoardFlat.tsx` directly (none of them import three).
 */
export { layoutRoute, layoutBoardRoute, daySpaceFor, stretchMidpoint, ROUTE_SAMPLE_EU, STATION_CLEARANCE_EU, type BoardDaySpace, type BoardRouteSpace, type BoardRouteStretch } from "./route.ts";
export { CROSSING_CLEARANCE_EU, findCrossings } from "./crossings.ts";
export { createJourneyBoardScene, UNIT_MAX, UNIT_MIN, type BoardSceneHandle, type BoardSceneOptions, type JourneyBoardSceneExtras, type FocusTarget } from "./scene.ts";
export { placeLabels, labelRankFor, LABEL_PRIORITY, type LabelBox, type LabelCandidate, type LabelRank, type PlacedLabel, type PlaceLabelsOptions } from "./labels.ts";
export { boardMarks, boardMarkIds, isAttentionStop, skyPostIds, POST_OFFSET, SKY_POST_LIMIT, type BoardMark, type BoardMarkKind } from "./marks.ts";
export { BoardFlat, FLAT_UNIT, type BoardFlatProps } from "./BoardFlat.tsx";
export { JOURNEY_BOARD_DRESSINGS, BOARD_DRESSING_KEYS, boardDressing, type FullBoardDressing } from "./dressing.ts";
export { radiusForTier, skyFitRadius, worldPerPixel, distanceForRadius, uncoveredRect, CAMERA_MOVE_MS, NO_SAFE_AREA, type SafeArea } from "./camera.ts";
export { ribbonWidth, RIBBON_PX } from "./ribbon.ts";
export { countBoardDraws } from "./layers.ts";
export type { PreviewSelection } from "./preview.ts";
