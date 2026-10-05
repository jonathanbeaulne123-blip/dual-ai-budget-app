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
 * */
// --- Horizon Clock ---------------------------------------------------------------------------------------------------
export { createJourneyMapScene, BEZEL_Y, type MapSceneHandle, type MapSceneOptions, type JourneyMapSceneExtras } from "./scene.ts";
export { layoutClock, slotOfDate, slotForStop, stackFor, CLOCK_NUMERAL_DAYS, MIN_STACK_DU, RING_HEIGHT_DU, SLOT_TOYS, type ClockItem, type ClockLayout, type ClockSlot, type CoinStack } from "./clock.ts";
export { layoutWeek, weekWalk, WEEK_TILE_DU, WEEK_TILE_SCALE, type WeekLayout, type WeekPile, type WeekTile, type WeekTileColour, type LayoutWeekOptions } from "./week.ts";
export { layoutYear, YEAR_MINI_ROAD, YEAR_MINI_SCALE, YEAR_RING_DU, type YearDot, type YearLayout, type YearMini, type YearStackColumn, type YearTreatment } from "./year.ts";
export {
  cameraAt, chapterTurn, fitDistance, islandYawAt, isPhone, levelOf, levelTransition, monthElevationDeg, popsAt, restOf, weekElevationDeg, weekFrame,
  CHAPTER_TURN_SECONDS, LEVEL_MIN_SECONDS, LEVEL_SECONDS_PER_UNIT, NO_INSET, PHONE_MAX_WIDTH, PINCH_T_PER_DOUBLING, WHEEL_T_PER_PX,
  type CameraPose, type CameraView, type Pops, type SafeInset, type TurnFrame, type WeekFrame,
} from "./levels.ts";
export { propKindFor, type PropKind } from "./kinds.ts";
export { boardPalette, colourOf } from "./palette.ts";
export { BoardFlat, flatViewBoxFor, type BoardFlatProps } from "./BoardFlat.tsx";
export { placeLabels, mapLabels, MAP_LABEL_LIMIT, LABEL_PRIORITY, type LabelBox, type LabelCandidate, type LabelRank, type MapLabel, type MapLabelRole, type PlacedLabel, type PlaceLabelsOptions } from "./labels.ts";
export { frameFromCoast } from "./geo.ts";
export { countBoardDraws } from "./kit.ts";
