/**
 * The Horizon road kit (ROAD.md §4, §9): pure card-kit geometry builders for the corridor — pavement painting of the
 * corridor solids, markings, guard kits, lamps and scenic stops — in three dressings. No scene, no renderer state:
 * `runtime/corridorArt.ts` binds them to the world (per district, instanced, night), and `runtime/cards.ts` uses
 * `addCorridorSolidSteps` for the baked corridor solids.
 */
export {roadKitPalette,CORRIDOR_SURFACE,PAVEMENT_BANDS,type RoadKitPalette,type RoadTheme,type PavementBand} from './palette.ts';
export {corridorSampler,corridorIndex,sideOf,type CorridorSampler,type CorridorFrame,type CorridorIndex} from './frames.ts';
export {addCorridorSolidSteps,isCorridorSolid,pavementBands,CORRIDOR_SOLID_KINDS,PAVEMENT,type CorridorSolidKind} from './pavement.ts';
export {markingQuads,buildMarkings,MARKING,type DeckHeight} from './markings.ts';
export {buildGuardRun,buildRailPost,guardFrames,GUARD_KIT,type GuardPieces,type GuardPost,type GuardOptions} from './guards.ts';
export {drawLamp,lampPlacement,LAMP_HEAD,ROAD_LAMP,type LampPlacement} from './lamps.ts';
export {buildScenicStop,stopLayout,drawBench,STOP_KIT,type StopPieces,type StopOptions} from './stops.ts';
