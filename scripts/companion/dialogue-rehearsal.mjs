/** Synthetic text rehearsal only: no provider, cloud, browser, or human score. */
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
const out='.artifacts/hercules-slice-6';await mkdir(out,{recursive:true});
await build({stdin:{contents:`export {COMPANION_DIALOGUE_SCENARIOS} from './test/fixtures/hercules-companion.ts'; export {catalogHousehold,herculesBriefing,planHerculesTurn,composeHerculesChatRequest} from './src/core/index.ts'; export {chatHercules} from './src/core/herculesChat.ts';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:`${out}/dialogue-module.mjs`});
const {COMPANION_DIALOGUE_SCENARIOS,catalogHousehold,herculesBriefing,planHerculesTurn,composeHerculesChatRequest,chatHercules}=await import(pathToFileURL(resolve(`${out}/dialogue-module.mjs`)));
const records=[];
for(const scenario of COMPANION_DIALOGUE_SCENARIOS){
 const h=catalogHousehold(),before=JSON.stringify(h),context=[],exchanges=[];let topic='';
 for(const message of scenario.turns){
  const plan=planHerculesTurn(h,message,'2026-09-10','home',topic,{memberId:'MEM-001',view:'household'});
  const req=composeHerculesChatRequest(h,message,herculesBriefing(h,'home','2026-09-10'),'2026-09-10','MEM-001',topic,{view:'household'});req.companion.context=context;
  const reply=plan.skipModel?{text:plan.talk.spoken,source:'local-planner'}:await chatHercules({...req,grounded:plan.talk},{fetch:async()=>new Response('{}',{status:503})});
  exchanges.push({user:message,hercules:reply.text,source:reply.source,offeredDraft:plan.draft?.kind??null,sourceCards:plan.talk.facts??[]});
  for(const [role,text] of [['user',message],['hercules',reply.text]])context.push({id:crypto.randomUUID(),role,text,createdAt:new Date().toISOString(),sourceReferences:[]});topic=plan.talk.topic;
 }
 if(JSON.stringify(h)!==before)throw Error(`Rehearsal mutated books: ${scenario.id}`);
 records.push({...scenario,exchanges,automated:{noHouseholdMutation:true,localOnly:true},humanScores:null});
}
await writeFile(`${out}/dialogue-report.json`,JSON.stringify({kind:'local-text-rehearsal',fixture:'Empty synthetic catalogue; scenario state descriptions are target trial setups, not all instantiated here. UI memory, routing and stateful acceptance are separate tests.',liveProvider:false,records},null,2));
await writeFile(`${out}/dialogue-transcript.md`,'# Hercules local text rehearsal\n\nSynthetic empty catalogue, provider unavailable. This is a review transcript, not a pass of every scenario setup or the human voice rubric. No books were mutated.\n\n'+records.map(r=>`## ${r.id}\n\nTarget setup: ${r.state}\n\n${r.exchanges.map(x=>`**You:** ${x.user}\n\n**Hercules (${x.source}):** ${x.hercules}`).join('\n\n')}\n\nReview: ${r.must.join('; ')}. Human scores: pending.`).join('\n\n'));
console.log(JSON.stringify({scenarios:records.length,turns:records.reduce((n,r)=>n+r.exchanges.length,0),noMutation:true,liveProvider:false,humanScores:'pending'}));
