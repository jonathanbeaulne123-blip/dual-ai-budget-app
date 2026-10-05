/**
 * The Journey board layer — public API (Horizon Clock, L3).
 *
 * The map (Horizon Clock):
 * - `createJourneyMapScene(host, options)` → `JourneyMapSceneHandle` on the shared renderer lease (scene.ts).
 * - Pure layouts: `layoutClock` (Month: 31 day slots, same date → same slot), `layoutWeek` (Week: tiles on the real Year
 *   Walk + the to-check pile), `layoutYear` (Year: twelve minis + Year-ruler stacks), `stackFor` (coin stacks from
 *   `ringsFor` only).
 * - `levels.ts`: one pull `t` 0→2 → camera (`cameraAt`), pops (`popsAt`), the chapter turn (`chapterTurn`), the eased
 *   pull (`levelTransition`); reduced motion = cuts.
 * - `placeLabels(…, { limit })` + `mapLabels(board, level, chapter, selected)` (max 3: today, next leaving, selected).
 * - `<BoardFlat board land level …>`: the SVG twin for all three levels; `flatViewBoxFor(level, land)` frames it.
 *
 * Bundling: `scene.ts` pulls three; a flat-only mount imports `./clock.ts`, `./week.ts`, `./year.ts`, `./labels.ts`,
 * `./levels.ts` and `./BoardFlat.tsx` directly (none import three).
 *
 * DEPRECATED (the v1 route board; still imported by ui/ until L4's rewrite lands, deleted by the integrator):
 * `layoutRoute`…, `createJourneyBoardScene` (routeScene.ts), `boardMarks`…, `labelRankFor`, dressings, camera tiers,
 * ribbon, layers, preview, and `<BoardFlat route=…>` (routeFlat.tsx).
 */
// --- Horizon Clock ---------------------------------------------------------------------------------------------------
export { createJourneyMapScene, BEZEL_Y, type MapSceneHandle, type MapSceneOptions, type JourneyMapSceneExtras, type JourneyLandCalm } from "./scene.ts";
export { layoutClock, slotOfDate, slotForStop, stackFor, CLOCK_NUMERAL_DAYS, MIN_STACK_DU, RING_HEIGHT_DU, SLOT_TOYS, type ClockItem, type ClockLayout, type ClockSlot, type CoinStack } from "./clock.ts";
export { layoutWeek, weekWalk, WEEK_TILE_DU, WEEK_TILE_SCALE, type WeekLayout, type WeekPile, type WeekTile, type WeekTileColour, type LayoutWeekOptions } from "./week.ts";
export { layoutYear, YEAR_MINI_ROAD, YEAR_MINI_SCALE, YEAR_RING_DU, type YearDot, type YearLayout, type YearMini, type YearStackColumn, type YearTreatment } from "./year.ts";
export {
  cameraAt, chapterTurn, fitDistance, islandYawAt, isPhone, levelOf, levelTransition, monthElevationDeg, popsAt, restOf, weekElevationDeg, weekFrame,
  CHAPTER_TURN_SECONDS, LEVEL_MIN_SECONDS, LEVEL_SECONDS_PER_UNIT, NO_INSET, PHONE_MAX_WIDTH, PINCH_T_PER_DOUBLING, WHEEL_T_PER_PX,
  type CameraPose, type CameraView, type Pops, type SafeInset, type TurnFrame, type WeekFrame,
} from "./levels.ts";
export { propKindFor, type PropKind } from "./kinds.ts";
export { BOARD_CLAY_PALETTES, BOARD_PROP_PALETTE, boardPalette } from "./palette.ts";
export { BoardFlat, flatViewBoxFor, FLAT_UNIT, type BoardFlatProps, type MapBoardFlatProps } from "./BoardFlat.tsx";
export { placeLabels, mapLabels, MAP_LABEL_LIMIT, labelRankFor, LABEL_PRIORITY, type LabelBox, type LabelCandidate, type LabelRank, type MapLabel, type MapLabelRole, type PlacedLabel, type PlaceLabelsOptions } from "./labels.ts";
export { frameFromCoast } from "./geo.ts";

// --- @deprecated: the v1 route board (ui/ still imports these; the integrator deletes them) --------------------------
export { layoutRoute, layoutBoardRoute, daySpaceFor, stretchMidpoint, ROUTE_SAMPLE_EU, STATION_CLEARANCE_EU, type BoardDaySpace, type BoardRouteSpace, type BoardRouteStretch } from "./route.ts";
export { CROSSING_CLEARANCE_EU, findCrossings } from "./crossings.ts";
export { createJourneyBoardScene, UNIT_MAX, UNIT_MIN, type BoardSceneHandle, type BoardSceneOptions, type JourneyBoardSceneExtras, type FocusTarget } from "./routeScene.ts";
export { boardMarks, boardMarkIds, isAttentionStop, skyPostIds, POST_OFFSET, SKY_POST_LIMIT, type BoardMark, type BoardMarkKind } from "./marks.ts";
export { JOURNEY_BOARD_DRESSINGS, BOARD_DRESSING_KEYS, boardDressing, type FullBoardDressing } from "./dressing.ts";
export { radiusForTier, skyFitRadius, worldPerPixel, distanceForRadius, uncoveredRect, CAMERA_MOVE_MS, NO_SAFE_AREA, type SafeArea } from "./camera.ts";
export { ribbonWidth, RIBBON_PX } from "./ribbon.ts";
export { countBoardDraws } from "./layers.ts";
export type { PreviewSelection } from "./preview.ts";
