import {KITTY_STAMP_KINDS} from '../core/kittyStudio.ts';
import type {KittyStampV1} from '../core/types.ts';
/** Actual, always-available Studio wearables. The same catalogue and STAMP_ART render both surfaces. */
const wearableNames:Partial<Record<KittyStampV1['kind'],string>>={'party-hat':'Party hat','sun-hat':'Sun hat',beanie:'Beanie',crown:'Crown',glasses:'Glasses',sunglasses:'Sunglasses',bowtie:'Bow tie',scarf:'Scarf'};
export const ENCOUNTER_WARDROBE=KITTY_STAMP_KINDS.flatMap(kind=>wearableNames[kind]?[{id:kind,name:wearableNames[kind]!,stamp:{id:kind,kind,anchor:kind==='bowtie'||kind==='scarf'?'chest':'forehead',color:'#718777',trim:'#fff8ee',size:.2,rotation:0} as KittyStampV1}]:[]);
