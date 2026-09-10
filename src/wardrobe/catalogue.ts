import type { CosmeticManifestV2, LookV1 } from '../core/herculesCompanionContracts.ts';
export const WARDROBE_ASSET = '/hercules-wardrobe/hercules-cozy.v1.glb';
export const WARDROBE_COLOURS = { cream:'#d4cbb7', moss:'#7c8d72', rose:'#b98587', slate:'#6d8192', silver:'#c1c8ce', brass:'#b89a53', 'rose-gold':'#c18c79' } as const;
export const FITTING_ITEMS = [
 {id:'cozy-toque',node:'item_cozy_toque',slot:'head',name:'Pom-pom toque',detail:'Ribbed brim · softly rounded crown',variants:['cream','moss','rose','slate']},
 {id:'cozy-sweater',node:'item_cozy_sweater',slot:'body',name:'Cable-knit sweater',detail:'Raised cables · fitted sleeves',variants:['cream','moss','rose','slate']},
 {id:'cozy-glasses',node:'item_cozy_glasses',slot:'eyewear',name:'Round reading glasses',detail:'Fine metal rims · open temples',variants:['silver','brass','rose-gold']},
] as const;
export const FITTING_MANIFEST: CosmeticManifestV2 = {catalogueVersion:1,items:FITTING_ITEMS.map(item=>({version:2,id:item.id,slot:item.slot,occupies:[item.slot],variants:item.variants,hiddenBodyRegions:item.slot==='body'?['torso']:item.slot==='head'?['crown']:[],modelAssetId:WARDROBE_ASSET,thumbnailAssetId:`/hercules-wardrobe/${item.id}.svg`,poseLayerAssetIds:{loaf:item.id,sit:item.id,walk:item.id}}))};
export const COZY_LOOK: LookV1 = {version:1,id:'cozy-fitting',name:'A quiet afternoon',catalogueVersion:1,selections:{head:{itemId:'cozy-toque',variantId:'moss'},body:{itemId:'cozy-sweater',variantId:'cream'},eyewear:{itemId:'cozy-glasses',variantId:'brass'}}};
export const FITTING_REACTIONS = [
 {id:'breathe-blink',label:'Breathe & blink'}, {id:'head-tilt',label:'A curious tilt'}, {id:'ear-perk',label:'Ears up'},
 {id:'slow-blink',label:'Slow blink'}, {id:'pleased',label:'Rather pleased'}, {id:'small-strut',label:'A small strut'},
 {id:'over-shoulder',label:'Over the shoulder'}, {id:'inspect-mirror',label:'Inspect the mirror'},
 {id:'adjust-glasses',label:'Adjust glasses',requires:'eyewear'}, {id:'check-sleeve',label:'Check a sleeve',requires:'body'},
 {id:'admire-cape',label:'Admire a cape',requires:'outerwear'}, {id:'portrait-pose',label:'Portrait pose'},
] as const;
export type FittingReaction = typeof FITTING_REACTIONS[number]['id'];
export function canPlayReaction(id:string,look:LookV1){const r=FITTING_REACTIONS.find(r=>r.id===id);return Boolean(r&&(!('requires' in r)||look.selections[r.requires]));}
export function fittingColour(value:string){return WARDROBE_COLOURS[value as keyof typeof WARDROBE_COLOURS]??WARDROBE_COLOURS.cream;}
