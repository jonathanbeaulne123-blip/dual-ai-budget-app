import {it,expect} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {mkdtemp,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
it('recovers selected-experience executions without broad reads from old granted tools',async()=>{
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
 import {DurableObject} from 'cloudflare:workers';import {getAgentByName} from 'agents';
 import {HerculesWorkspace} from './workers/workspace/service.ts';
 import {createWorkspaceProject} from './src/workspace/contracts.ts';
 import {bindWorkspaceExperience} from './src/hearthside/workspaceContext.ts';
 import {newWorkspaceRun} from './src/workspace/runtime.ts';
 import {pendingGrant} from './workers/workspace/grants.ts';
 import {HERCULES_READ_TOOL_NAMES} from './src/core/herculesTools.ts';
 const context={version:1,id:'experience:review',revision:1,title:'Selected intention',intention:'Our evening',state:'dreaming',horizon:'tonight'};
 export class ReviewWorkspace extends HerculesWorkspace {
  async seed(scope,id,tool){this.authenticate(scope);const p=createWorkspaceProject(id,'Selected intention',scope.memberId,new Date().toISOString());p.experience=bindWorkspaceExperience(context);p.experience.providerApprovalDigest=p.experience.digest;
   const run=newWorkspaceRun(p,id+'-run','',new Date().toISOString());p.runs.push(run);this.saveProject(p);
   const grant={...pendingGrant(run.id,id),id:run.id,localScope:scope,localPermittedReads:[...HERCULES_READ_TOOL_NAMES]};
   this.saveExecution(run.id,{grant,contents:[{role:'model',parts:[{functionCall:{id:'call',name:tool,args:tool==='hearth_read'?{name:'ledger_context',scope:'personal',argsJson:'{}'}:tool==='hearth_action_options'?{actionId:'expense',scope:'personal',valuesJson:'{}'}:tool==='prepare_action'?{target:'hearth',actionId:'expense',scope:'personal',valuesJson:'{"amount":"1"}'}:{scope:'personal'}}}]}],pending:1,reservedTokens:0,activeAttempt:'review'});
  }
  async proof(scope,id){this.authenticate(scope);return {project:this.getProject(id),execution:this.execution(id+'-run'),receipts:this.sql\`SELECT data FROM workspace_tool_receipts\`.map(row=>JSON.parse(row.data))};}
 }
 export class ReviewAuthority extends DurableObject {
  async workspaceExperience(){return {...context,revision:(await this.ctx.storage.get('revision'))??1};}
  async workspaceQuery(){await this.ctx.storage.put('queries',1+((await this.ctx.storage.get('queries'))??0));return {PRIVATE_LEDGER_CANARY:true};}
  async revise(){await this.ctx.storage.put('revision',2);}
  async queries(){return (await this.ctx.storage.get('queries'))??0;}
 }
 export default {async fetch(request,env){try{const body=await request.json(),scope={environment:'development',householdId:'HH-review',memberId:'MEM-001',subject:'local:MEM-001',role:'owner',aclEpoch:1,expires:Date.now()+60000},agent=await getAgentByName(env.HERCULES_WORKSPACES,'development/HH-review/MEM-001'),authority=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-review'));let value;
  if(body.op==='seed')value=await agent.seed(scope,body.id,body.tool);else if(body.op==='advance')value=await agent.advance(body.id,body.id+'-run','review-'+body.id);else if(body.op==='proof')value=await agent.proof(scope,body.id);else if(body.op==='revise')value=await authority.revise();else value=await authority.queries();return Response.json(value??null);
 }catch(error){return Response.json({error:error.message},{status:400});}}};
 `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],alias:{path:'node:path'},format:'esm',target:'es2022'});
 const path=await mkdtemp(join(tmpdir(),'workspace-merge-review-'));
 const make=()=>new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],resourcePersistencePath:path,durableObjects:{HERCULES_WORKSPACES:{className:'ReviewWorkspace',useSQLite:true},LEDGER_ROOMS:{className:'ReviewAuthority',useSQLite:true}},r2Buckets:['HERCULES_FILES'],bindings:{LEDGER_SYNC_LOCAL_AUTH:'true',HERCULES_WORKSPACE_EXECUTION:'true'}}));
 let mf=make();const call=async(body:unknown)=>{const r=await mf.dispatchFetch('http://localhost/review',{method:'POST',body:JSON.stringify(body)});expect(r.status,await r.clone().text()).toBe(200);return await r.json() as any;};
 try{
  for(const [id,tool]of [['read','hearth_read'],['options','hearth_action_options'],['discover','discover_tools'],['changed','discover_tools'],['proposal','prepare_action'],['execute','executeHerculesAction']])await call({op:'seed',id,tool});
  await mf.dispose();mf=make();
  for(const id of ['read','options','discover','proposal','execute']){await call({op:'advance',id});const p=await call({op:'proof',id});expect(JSON.stringify(p)).not.toContain('PRIVATE_LEDGER_CANARY');}
  const discovered=await call({op:'proof',id:'discover'});expect(discovered.receipts.some((r:any)=>r.error==='EXPERIENCE_SCOPE_READ_DENIED')).toBe(true);expect(discovered.receipts.find((r:any)=>Array.isArray(r.actions))?.reads).toEqual([]);expect(discovered.project.runs[0].usage.toolCalls).toBe(1);
  const proposal=await call({op:'proof',id:'proposal'});expect(proposal.project.proposals[0]).toMatchObject({target:'hearth',actionId:'expense',status:'draft',receiptId:null});expect(proposal.receipts.some((r:any)=>r.error==='UNKNOWN_TOOL')).toBe(true);
  expect(await call({op:'queries'})).toBe(0);
  await call({op:'revise'});expect(await call({op:'advance',id:'changed'})).toEqual({continue:false});const changed=await call({op:'proof',id:'changed'});expect(changed.project.runs[0].usage.toolCalls).toBe(0);expect(changed.project.runs[0].status).toBe('paused');expect(await call({op:'queries'})).toBe(0);
 }finally{await mf.dispose();await rm(path,{recursive:true,force:true});}
},30000);
