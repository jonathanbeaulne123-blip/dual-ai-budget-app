/** Synthetic-only comparison. Explicit --live, local key and supplied prices required to spend provider tokens. */
import{writeFile,readFile}from'node:fs/promises';
import{callFlash}from'../workers/workspace/provider.ts';
import{executeWorkspaceTool}from'../workers/workspace/tools.ts';
import{createWorkspaceProject,latestArtifacts}from'../src/workspace/contracts.ts';
import{FLASH_MODEL,projectContext,type ModelContent}from'../src/workspace/runtime.ts';
const cases=[
 {id:'pivot',goal:'Plan this month. Actually, change direction: save for a date with Sam. Keep our earlier decision to leave Saturday free. Create an itinerary, compare Friday and Sunday, and leave all money as hypothetical estimates.'},
 {id:'career',goal:'Create a one-page interview preparation document for a fictional library assistant. Include three practice questions and one worked STAR example. This is a hypothetical learning example; do not invent real experience.'},
 {id:'learning',goal:'Teach a beginner to add fractions. Create a lesson with two worked examples, three practice questions, and a separate answer key. Verify the arithmetic with the calculator.'},
 {id:'research',goal:'Compare the provided synthetic museum sources and produce a sourced decision document. Both sources are test data, not current real-world venues or prices. Research queries "synthetic museum options" are approved.'},
];
if(!process.argv.includes('--live')){console.log(JSON.stringify({model:FLASH_MODEL,cases,usage:'Run with --live only after provider evaluation authorization. GEMINI_API_KEY required. Optional EVAL_INPUT_USD_PER_MILLION and EVAL_OUTPUT_USD_PER_MILLION provide dated contracted prices. EVAL_REVIEWS is a JSON array of {caseId,runner,accepted,corrections,evidenceScore} reviewed by a person.'},null,2));process.exit(0);}
if(!process.env.GEMINI_API_KEY)throw Error('GEMINI_API_KEY is required; no automatic provider fallback.');
const env={GEMINI_API_KEY:process.env.GEMINI_API_KEY,HERCULES_WORKSPACE_EXECUTION:'true',HERCULES_WORKSPACE_MODEL:FLASH_MODEL,HERCULES_WORKSPACE_DATA:'synthetic'};
const prices=[process.env.EVAL_INPUT_USD_PER_MILLION,process.env.EVAL_OUTPUT_USD_PER_MILLION].map(x=>x===undefined?null:Number(x));
if(prices.some(x=>x!==null&&(!Number.isFinite(x)||x<0)))throw Error('Invalid contracted price');
const reviews=process.env.EVAL_REVIEWS?JSON.parse(await readFile(process.env.EVAL_REVIEWS,'utf8')):[];
const results=[];
for(const fixture of cases)for(const runner of ['basic-chat','workspace'] as const){
 const now=new Date().toISOString(),p=createWorkspaceProject(crypto.randomUUID(),fixture.id,'MEM-FICTIONAL',now);p.goal=fixture.goal;p.decisions=['Keep Saturday free'];p.publicResearchQueries=['synthetic museum options'];p.messages=[{id:crypto.randomUUID(),role:'user',text:fixture.goal,createdAt:now}];
 const contents:ModelContent[]=[{role:'user',parts:[{text:projectContext(p)}]}];let inputTokens=0,outputTokens=0,modelCalls=0,toolCalls=0,complete=false,error='';const started=Date.now();
 try{for(let step=0;step<(runner==='basic-chat'?2:12);step++){
  if(inputTokens+outputTokens>=120000||Date.now()-started>1800000)throw Error('Evaluation budget reached');
  const reply=await callFlash(env,contents,runner==='workspace'&&step>4?'high':'medium',Math.min(8192,120000-inputTokens-outputTokens));inputTokens+=reply.inputTokens;outputTokens+=reply.outputTokens;modelCalls++;contents.push(reply.content);
  const calls=reply.content.parts.flatMap(p=>p.functionCall?[p.functionCall]:[]);if(!calls.length){complete=true;break;}
  const responses=[];for(const call of calls.slice(0,8)){toolCalls++;const id=crypto.randomUUID();let result;
   try{const output=await executeWorkspaceTool(call.name!,call.args??{},{project:p,id,now:new Date().toISOString(),read:async()=>({error:'No actual financial facts exist in this synthetic nonfinancial evaluation'}),search:async()=>[{title:'Synthetic museum A',url:'https://example.com/synthetic-a',description:'Fictional: Friday 18:00, example price CAD 20'},{title:'Synthetic museum B',url:'https://example.com/synthetic-b',description:'Fictional: Sunday 14:00, example price CAD 15'}],readWeb:async url=>({url,text:'Synthetic source only. Verify dates before a real decision.',truncated:false}),execute:async()=>({error:'Execution fixture unavailable equally in both runners; use deterministic calculator'})});result=output.result;
    if(output.effect?.artifact)p.artifacts.push(output.effect.artifact);if(output.effect?.evidence)p.evidence.push(...output.effect.evidence);if(output.effect?.proposal)p.proposals.push(output.effect.proposal);if(output.effect?.memory)Object.assign(p,output.effect.memory);
   }catch(e){result={error:String(e)}}responses.push({functionResponse:{id:call.id,name:call.name!,response:result}});
  }contents.push({role:'user',parts:responses});
 }}catch(e){error=String(e)}
 const review=reviews.find((r:any)=>r.caseId===fixture.id&&r.runner===runner),cost=prices.every(x=>x!==null)?(inputTokens*prices[0]!+outputTokens*prices[1]!)/1e6:null;
 results.push({caseId:fixture.id,runner,model:FLASH_MODEL,completedTurn:complete,accepted:review?.accepted??null,correctionEffort:review?.corrections??null,evidenceScore:review?.evidenceScore??null,latencyMs:Date.now()-started,inputTokens,outputTokens,modelCalls,toolCalls,costUSD:cost,costPerAcceptedResultUSD:review?.accepted?cost:null,artifacts:latestArtifacts(p),sources:p.evidence,transcript:contents,error});
}
const path=process.env.EVAL_OUTPUT??'/tmp/hercules-flash-evaluation.json';await writeFile(path,JSON.stringify({at:new Date().toISOString(),model:FLASH_MODEL,synthetic:true,pricesPerMillion:prices,results},null,2));console.log(path);
