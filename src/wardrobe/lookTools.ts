import {COMPANION_SLOTS,decodeLook,type LookV1,type CompanionSlot,type CosmeticSelection} from '../core/herculesCompanionContracts.ts';
import {FITTING_ITEMS} from './catalogue.ts';
export function fitSelection(look:LookV1,slot:CompanionSlot,selection:CosmeticSelection|null){
 const next=decodeLook(look),replaced:string[]=[];
 const item=selection?FITTING_ITEMS.find(p=>p.id===selection.itemId):undefined;
 if(item)for(const [other,value] of Object.entries(next.selections)){const worn=FITTING_ITEMS.find(p=>p.id===value.itemId);if(other!==slot&&worn?.occupies.some(s=>item.occupies.includes(s))){replaced.push(worn.name);delete next.selections[other as CompanionSlot];}}
 if(selection)next.selections[slot]=selection;else delete next.selections[slot];return {look:next,replaced};
}
export function sameOutfit(a:LookV1|null|undefined,b:LookV1|null|undefined){return JSON.stringify(Object.entries(a?.selections??{}).sort())===JSON.stringify(Object.entries(b?.selections??{}).sort());}
export function shuffleLook(look:LookV1,locked:readonly CompanionSlot[],random:()=>number=Math.random){
 let next=decodeLook(look);const available=FITTING_ITEMS.filter(p=>!p.legacy);
 for(const slot of COMPANION_SLOTS){if(locked.includes(slot))continue;
 const candidates=available.filter(p=>p.slot===slot&&!Object.entries(next.selections).some(([s,value])=>locked.includes(s as CompanionSlot)&&FITTING_ITEMS.find(q=>q.id===value.itemId)?.occupies.some(x=>p.occupies.includes(x))));
 if(!candidates.length)continue;const item=candidates[Math.floor(random()*candidates.length)%candidates.length]!;next=fitSelection(next,slot,{itemId:item.id,variantId:item.variants[Math.floor(random()*item.variants.length)%item.variants.length]!}).look;
 }return next;
}
