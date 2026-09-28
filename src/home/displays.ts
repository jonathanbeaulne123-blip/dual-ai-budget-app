import type {VillageDisplayContent} from '../harbour/village/displays.ts';
/** Two instances may intentionally show different accepted revisions of one original. */
export type HomeDisplayContent=VillageDisplayContent&{revision:number};
