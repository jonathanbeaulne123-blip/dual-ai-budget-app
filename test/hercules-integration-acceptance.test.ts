import {describe,it,expect} from 'vitest';
import {catalogHousehold,herculesBriefing,planHerculesTurn} from '../src/core/index.ts';
import {chatHercules} from '../src/core/herculesChat.ts';
import {localHerculesChat} from '../src/core/herculesPersonality.ts';
import {trimCompanionPending} from '../src/core/herculesSessionDraft.ts';
import type {CompanionIntentV1} from '../src/core/herculesCompanionContracts.ts';
const h=catalogHousehold(),briefing=herculesBriefing(h,'home','2026-09-10'),grounded={spoken:'The current plan contains recorded entries. Upcoming bills still need review.',lesson:'Only accepted entries are in these books.'};
describe('integrated companion fallback and retention',()=>{
 it('continues three offline turns without inventing a financial action or quoting historical amounts',async()=>{
  const context:Array<{id:string;role:'user'|'hercules';text:string;createdAt:string;sourceReferences:[]}>=[];
  for(const message of ['Where is your favourite napping spot?','Why?','What about when it rains?']){
   const reply=await chatHercules({message,briefing,grounded,companion:{version:2,scope:{environment:'development',householdId:h.householdId,memberId:'MEM-001'},view:'household',conversationGeneration:0,context,preferences:[],currentFactIds:[],availableActionIds:[]}} as Parameters<typeof chatHercules>[0],{fetch:async()=>new Response('{}',{status:503})});
   expect(reply.source).toBe('local');expect(reply.text).not.toMatch(/\$|posted|saved/i);expect(reply.text).toMatch(/windowsill|warm|blanket/i);
   context.push({id:crypto.randomUUID(),role:'user',text:message,createdAt:new Date().toISOString(),sourceReferences:[]},{id:crypto.randomUUID(),role:'hercules',text:reply.text,createdAt:new Date().toISOString(),sourceReferences:[]});
  }
 });
 it('prioritizes distress over playful matches and obeys explicit presentation preferences',()=>{
  expect(localHerculesChat("I'm overwhelmed, this is ridiculous",briefing,grounded)).toMatch(/one step at a time/);
  expect(localHerculesChat('This rent is ridiculous',briefing,grounded,[],[{role:'user',text:'Show me an outfit'}])).not.toMatch(/overdressed|delighted/);
  const fund=planHerculesTurn(h,'Explain this Fund contribution.','2026-09-10','home');
  expect(fund.talk.spoken).toContain('shared contribution record');
  expect(planHerculesTurn(h,'Explain this Fund contribution.','2026-09-10','home','',{memberId:'MEM-001',view:'personal'}).talk.spoken).toContain('Switch to Shared');
  expect(localHerculesChat('What is due before payday?',briefing,grounded)).toContain('If Choose payday is available');expect(fund.talk.spoken).not.toMatch(/Fun is|\$/);
  expect(localHerculesChat('Tell me about the plan',briefing,grounded,[{key:'humour',value:'off'},{key:'explanationStyle',value:'step-by-step'}])).toMatch(/^1\..*\n2\./);
  expect(localHerculesChat('Tell me about the plan',briefing,grounded,[{key:'humour',value:'off'},{key:'answerLength',value:'detailed'}])).toContain(grounded.lesson);
 });
 it('expires old unsaved turns and dependent automatic preferences without dropping new work',()=>{
  const scope={environment:'development' as const,householdId:h.householdId,memberId:'MEM-001'},now=Date.now(),oldId='expired';
  const append=(id:string,at:number):CompanionIntentV1=>({version:1,id,scope,operation:{kind:'conversation.append',view:'household',generation:0,turn:{id,role:'user',text:'A harmless draft',createdAt:new Date(at).toISOString(),sourceReferences:[]}}});
  const pref:CompanionIntentV1={version:1,id:'pref',scope,operation:{kind:'preference.set',key:'answerLength',value:'concise',expectedRevision:0,origin:{kind:'conversation',view:'household',generation:0,rememberingRevision:0,sourceTurnId:oldId}}};
  const pairedFresh={...append('other-turn',now),id:oldId};
  expect(trimCompanionPending([append(oldId,now-31*86_400_000),pairedFresh],now)).toEqual([]);
  const crowded=Array.from({length:61},(_,i)=>append(`pending-${i}`,now));
  expect(trimCompanionPending(crowded,now)).toEqual(crowded);
  expect(trimCompanionPending([append(oldId,now-31*86_400_000),pref,append('fresh',now)],now).map(x=>x.id)).toEqual(['fresh']);
 });
});
