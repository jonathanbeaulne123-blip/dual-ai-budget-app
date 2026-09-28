import type {Household} from '../core/types.ts';
import {dateKeyInZone} from '../core/calendar.ts';
import {BLUEPRINTS,FURNITURE,FINISHES} from './catalogue.ts';
import {decodeHome,decodeLayout,allowedFamilies,clone,type HomeState} from './model.ts';
import {grantHomeMilestones} from './progression.ts';
export type HomeSave={layout:unknown;future:unknown;pinned:string|null;arrangements:HomeState['arrangements'];selectedGoalId?:string};
/** Called only inside the ordinary scoped creative command/CAS boundary. */
export function acceptHome(h:Household,actor:string,current:HomeState|undefined,expected:number,value:unknown):HomeState{
 const old=decodeHome(current);if(old.revision!==expected)throw Error('HOME_CHANGED: Another edit was saved. Your draft is kept; compare before saving again.');
 if(!value||typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).some(k=>typeof k!=='string'||!['layout','future','pinned','arrangements','selectedGoalId'].includes(k)||!('value' in Object.getOwnPropertyDescriptor(value,k)!)))throw Error('HOME_INVALID_SAVE');
 const input=value as HomeSave,today=dateKeyInZone(new Date(),h.timezone);
 const earned=grantHomeMilestones(h,actor,old,today,input.selectedGoalId),families=allowedFamilies(earned);
 const candidate=decodeHome({...earned,layout:decodeLayout(input.layout),future:input.future===null?null:decodeLayout(input.future),pinned:input.pinned,arrangements:input.arrangements,revision:expected+1});
 for(const r of candidate.layout.rooms){if(!families.has(BLUEPRINTS.find(b=>b.id===r.blueprintId)!.family)||!families.has(FINISHES.find(f=>f.id===r.finish)!.family)||(['hip','flat'].includes(r.roof)&&!families.has('architecture')))throw Error('HOME_BLUEPRINT_LOCKED: Keep this choice in your future-home blueprint.');}
 for(const o of candidate.layout.objects)if(!families.has(FURNITURE.find(f=>f.id===o.catalogueId)!.family)||!families.has(FINISHES.find(f=>f.id===o.variant)!.family))throw Error('HOME_FURNISHING_LOCKED');
 // Identity and contents survive replacements. Removal is storage, never deletion.
 for(const r of old.layout.rooms)if(!candidate.layout.rooms.some(n=>n.id===r.id))throw Error('HOME_STORE_ROOM: Store this room to preserve its contents.');
 for(const o of old.layout.objects)if(!candidate.layout.objects.some(n=>n.id===o.id))throw Error('HOME_STORE_OBJECT: Store this object to keep it recoverable.');
 const own=h.personalLife?.ownerMemberId===actor?h.personalLife:undefined;
 const priorReferences=[...old.layout.objects,...(old.future?.objects??[]),...old.arrangements.flatMap(a=>a.objects)].flatMap(o=>o.display?[JSON.stringify(o.display)]:[]);
 for(const o of [...candidate.layout.objects,...(candidate.future?.objects??[]),...candidate.arrangements.flatMap(a=>a.objects)]){if(!o.display)continue;if(priorReferences.includes(JSON.stringify(o.display)))continue;
  const d=o.display;if(d.kind==='piece'){if(![...(h.hearthside?.designs??[]),...(own?.designs??[])].some(p=>p.designId===d.designId&&p.revision>=d.revision&&p.pieceIds.includes(d.id)))throw Error('HOME_PIECE_UNAVAILABLE');}
  else{const privateMemory=own?.memories.find(m=>m.id===d.id&&m.revision===d.revision&&!m.withdrawn&&m.keptRevision===m.revision&&(!m.experienceId||own.experiences.some(e=>e.id===m.experienceId&&e.state==='lived')));const memory=h.hearthside?.memories.find(m=>m.id===d.id&&m.revision===d.revision&&!m.withdrawn);if(!privateMemory&&(!memory||!h.members.filter(m=>m.active).every(m=>memory.approvals.some(a=>a.memberId===m.id&&a.revision===memory.revision))||memory.experienceId&&!h.hearthside?.experiences.some(e=>e.id===memory.experienceId&&e.state==='lived')))throw Error('HOME_MEMORY_UNAVAILABLE');}
 }
 const changed=JSON.stringify(candidate.layout)!==JSON.stringify(old.layout);
 candidate.history=changed?[...old.history,{revision:old.revision,at:today,layout:clone(old.layout)}].slice(-12):old.history;
 return candidate;
}
