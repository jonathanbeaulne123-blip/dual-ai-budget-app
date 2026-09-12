import type { CosmeticManifestV2, LookV1 } from '../core/herculesCompanionContracts.ts';
import {PIECES,COLLECTIONS} from './pieces.ts';
export {COLLECTIONS};
export const WARDROBE_ASSET='/hercules-wardrobe/hercules-cozy.v1.glb';
export const WARDROBE_COLOURS={cream:'#d4cbb7',moss:'#7c8d72',rose:'#b98587',slate:'#6d8192',silver:'#c1c8ce',brass:'#b89a53','rose-gold':'#c18c79',ink:'#35434e',oat:'#c5b99c',claret:'#824851',sage:'#91a388',yellow:'#d8ad37',navy:'#3d526c',seafoam:'#82aaa4',coral:'#c67860',plum:'#79486c',midnight:'#414661',ruby:'#a84f5d',ivory:'#e4dcc8',terracotta:'#ae7155',blue:'#769eb7',lavender:'#9b8bb4',frost:'#dfe6ea',cherry:'#9d2f3b',pine:'#3f5e4c'} as const;
const baseIds=new Set(['cozy-sweater','cozy-toque','cozy-glasses']);
export const FITTING_ITEMS=PIECES.map(item=>({...item,node:`item_${item.id.replaceAll('-','_')}`,asset:baseIds.has(item.id)?WARDROBE_ASSET:`/hercules-wardrobe/${item.collection}.v1.glb`,occupies:item.coversBody?[item.slot,'body']:[item.slot],hiddenBodyRegions:item.slot==='body'||item.coversBody?['torso']:['toque','watchcap','chef','bakercap','souwester','nightcap','earflap','strawhat'].includes(item.shape)?['crown']:[]}));
export const FITTING_MANIFEST:CosmeticManifestV2={catalogueVersion:1,items:FITTING_ITEMS.map(item=>({version:2,id:item.id,slot:item.slot,occupies:item.occupies as typeof item.slot[],variants:item.variants,hiddenBodyRegions:item.hiddenBodyRegions,modelAssetId:item.asset,thumbnailAssetId:`/hercules-wardrobe/${item.id}.svg`,poseLayerAssetIds:{loaf:item.id,sit:item.id,walk:item.id}}))};
export const COZY_LOOK:LookV1={version:1,id:'cozy-fitting',name:'A quiet afternoon',catalogueVersion:1,selections:{head:{itemId:'cozy-toque',variantId:'moss'},body:{itemId:'cozy-sweater',variantId:'cream'},eyewear:{itemId:'cozy-glasses',variantId:'brass'}}};
export const COLLECTION_LOOKS:Record<string,LookV1>={};
for(const collection of COLLECTIONS){const selections:LookV1['selections']={},occupied=new Set<string>();for(const item of FITTING_ITEMS.filter(p=>p.collection===collection.id)){if(item.occupies.some(slot=>occupied.has(slot)))continue;item.occupies.forEach(s=>occupied.add(s));selections[item.slot]={itemId:item.id,variantId:item.variants[0]!};}COLLECTION_LOOKS[collection.id]={version:1,id:`${collection.id}-recommended`,name:collection.name,catalogueVersion:1,selections};}
COLLECTION_LOOKS.cozy=COZY_LOOK;
export const FITTING_REACTIONS = [
 {id:'breathe-blink',label:'Breathe & blink'}, {id:'head-tilt',label:'A curious tilt'}, {id:'ear-perk',label:'Ears up'},
 {id:'slow-blink',label:'Slow blink'}, {id:'pleased',label:'Rather pleased'}, {id:'small-strut',label:'A small strut'},
 {id:'over-shoulder',label:'Over the shoulder'}, {id:'inspect-mirror',label:'Inspect the mirror'},
 {id:'adjust-glasses',label:'Adjust glasses',requires:'eyewear'}, {id:'check-sleeve',label:'Check a sleeve',requires:'body'},
 {id:'admire-cape',label:'Admire a cape',requires:'outerwear'}, {id:'portrait-pose',label:'Portrait pose'},
] as const;
export type FittingReaction = typeof FITTING_REACTIONS[number]['id'];
export function canPlayReaction(id:string,look:LookV1){
 const r=FITTING_REACTIONS.find(r=>r.id===id);if(!r)return false;
 const pieces=Object.values(look.selections).map(s=>FITTING_ITEMS.find(p=>p.id===s.itemId));
 if(id==='admire-cape')return pieces.some(p=>p?.shape==='cape');
 if(id==='check-sleeve')return pieces.some(p=>p&&['cable','cardigan','pinstripe','raincoat','fisherman','sequin','tunic','tailcoat','pyjama','robe','smock','waxed','fleece'].includes(p.shape));
 return !('requires' in r)||Boolean(look.selections[r.requires]);
}
export function fittingColour(value:string,itemId?:string){if(value==='legacy-original')return itemId==='copper'?'#b27745':itemId==='gold'?'#b89a53':itemId==='ink'?'#50755c':'#b8a782';return WARDROBE_COLOURS[value as keyof typeof WARDROBE_COLOURS]??WARDROBE_COLOURS.cream;}
