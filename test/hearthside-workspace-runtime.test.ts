import {it,expect} from 'vitest';
import {build} from 'esbuild';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import {workspaceExperienceDigest,workspaceExperienceProjectId,type WorkspaceExperienceContext} from '../src/hearthside/workspaceContext.ts';
import {experienceArtifactReviewDigest,type ExperienceArtifactReview} from '../src/hearthside/workspacePublication.ts';
import type {WorkspaceSnapshot} from '../src/workspace/contracts.ts';
it('persists private source deletion and reviewed shared copies in actual separate SQLite Agents with authoritative receipt validation',async()=>{
 const experience:WorkspaceExperienceContext={version:1,id:'experience:evening',revision:1,title:'At home',intention:'A quiet free evening',state:'dreaming',horizon:'tonight'},scope={environment:'development' as const,householdId:'HH-SQL',memberId:'MEM-A'};
 const bundle=await build({stdin:{resolveDir:process.cwd(),contents:`
  import {consumeWorkspaceRpc} from './src/hearthside/workspaceRpc.ts';
  import {DurableObject} from 'cloudflare:workers';
  import {getAgentByName} from 'agents';
  import {HerculesWorkspace} from './workers/workspace/service.ts';
  import {HerculesSharedWorkspace} from './workers/workspace/shared.ts';
  import {artifactPublication} from './src/hearthside/workspacePublication.ts';
  import {applyWorkspaceCommand} from './src/workspace/contracts.ts';
  export {HerculesSharedWorkspace};
  export class TestWorkspace extends HerculesWorkspace {
    async seedUploadedSource(scope,projectId){this.authenticate(scope);let p=this.getProject(projectId);p=applyWorkspaceCommand(p,{type:'create-artifact',id:'upload',title:'Original',format:'markdown',content:'Private uploaded original'},p.revision,new Date().toISOString());p.evidence.push({id:'upload',origin:'external',scope:'personal',title:'Original',source:'attachment:upload',sourceVersion:'hash',observedAt:new Date().toISOString()});await this.env.HERCULES_FILES.put(scope.environment+'/'+scope.householdId+'/'+scope.memberId+'/'+projectId+'/original-upload-hash','Private bytes');this.saveProject(p);return this.snapshotFor(scope);}
  }
  export class TestAuthority extends DurableObject {
    async workspaceExperience(scope,id){if(id!==${JSON.stringify(experience.id)}||!['MEM-A','MEM-B'].includes(scope.memberId))throw new Error('FORBIDDEN');return ${JSON.stringify(experience)};}
    async workspaceAcceptArtifact(scope,pub){const shared=await getAgentByName(this.env.HERCULES_SHARED_WORKSPACES,scope.environment+'/'+scope.householdId);const prepared=consumeWorkspaceRpc(await shared.preparedExperienceFor(scope,pub.id));if(!prepared||prepared.state==='withdrawn'||JSON.stringify(artifactPublication(prepared))!==JSON.stringify(pub))throw new Error('PREPARED_COPY_REQUIRED');const old=await this.ctx.storage.get(pub.id);if(old){if(old.publication.state==='withdrawn')throw new Error('ARTIFACT_WITHDRAWN');if(old.publication.contentDigest!==pub.contentDigest)throw new Error('REUSED');return old;}const receipt={version:1,id:pub.id,publication:pub,acceptedSequence:1};await this.ctx.storage.put(pub.id,receipt);return receipt;}
    async workspaceWithdrawArtifact(scope,pub){const shared=await getAgentByName(this.env.HERCULES_SHARED_WORKSPACES,scope.environment+'/'+scope.householdId),copy=consumeWorkspaceRpc(await shared.preparedExperienceFor(scope,pub.id));if(!copy||copy.state!=='withdrawn'||copy.sharedBy!==scope.memberId)throw new Error('REVOKE_FIRST');const receipt={version:1,id:pub.id,publication:pub,acceptedSequence:2};await this.ctx.storage.put(pub.id,receipt);return receipt;}
  }
  export default {async fetch(request,env){try{const b=await request.json(),memberId=request.headers.get('X-Member')||'MEM-A',scope={environment:'development',householdId:'HH-SQL',memberId,subject:'local:'+memberId,role:'owner',aclEpoch:1,expires:Date.now()+60000};const target=request.headers.get('X-Target')||memberId,privateAgent=await getAgentByName(env.HERCULES_WORKSPACES,'development/HH-SQL/'+target);let result;
    if(b.operation==='snapshot')result=await privateAgent.snapshotFor(scope);
    else if(b.operation==='seed-upload')result=await privateAgent.seedUploadedSource(scope,b.projectId);
    else if(b.operation==='publish')result=await privateAgent.shareExperienceFor(scope,b.review,b.digest);
    else if(b.operation==='withdraw')result=await privateAgent.withdrawExperienceFor(scope,b.id);
    else if(b.operation==='copies'){const shared=await getAgentByName(env.HERCULES_SHARED_WORKSPACES,'development/HH-SQL');result=await shared.experienceCopiesFor(scope,${JSON.stringify(experience.id)});}
    else result=await privateAgent.command(scope,'synthetic-local',b);
    return Response.json(result);
  }catch(error){return Response.json({error:error.message},{status:400});}}};
 `},bundle:true,write:false,platform:'browser',external:['cloudflare:*','node:*'],alias:{path:'node:path'},format:'esm',target:'es2022'});
 const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:bundle.outputFiles[0]!.text,compatibilityDate:'2026-08-27',compatibilityFlags:['nodejs_compat'],durableObjects:{HERCULES_WORKSPACES:{className:'TestWorkspace',useSQLite:true},HERCULES_SHARED_WORKSPACES:{className:'HerculesSharedWorkspace',useSQLite:true},LEDGER_ROOMS:{className:'TestAuthority',useSQLite:true}},r2Buckets:['HERCULES_FILES'],bindings:{HERCULES_WORKSPACE_EXECUTION:'false',LEDGER_SYNC_LOCAL_AUTH:'true'}}));
 const call=(body:unknown,member='MEM-A',target=member)=>mf.dispatchFetch('http://localhost/test',{method:'POST',headers:{'Content-Type':'application/json','X-Member':member,'X-Target':target},body:JSON.stringify(body)});
 const command=(projectId:string,expectedRevision:number,value:unknown,id:string=crypto.randomUUID())=>call({commandId:id,projectId,expectedRevision,command:value});
 try{
  const projectId=workspaceExperienceProjectId(scope,experience.id);
  const create=()=>command(projectId,0,{type:'create-experience',id:projectId,context:experience,confirmDigest:workspaceExperienceDigest(experience)},'create-exact');const creates=await Promise.all([create(),create()]);for(const result of creates)expect(result.status,await result.clone().text()).toBe(200);let response=creates[0]!;
  response=await command(projectId,0,{type:'create-artifact',id:'artifact',title:'At home',format:'markdown',content:'Private source text'});expect(response.status,await response.clone().text()).toBe(200);
  expect((await call({operation:'snapshot'},'MEM-B','MEM-A')).status).toBe(400);
  expect((await (await call({operation:'snapshot'},'MEM-B')).json() as WorkspaceSnapshot).projects).toEqual([]);
  const review:ExperienceArtifactReview={version:1,id:'copy-sql',projectId,artifactVersionId:'artifact',experienceId:experience.id,experienceRevision:1,title:'Shared plan',format:'markdown',content:'Only reviewed words'};
  const publish=()=>call({operation:'publish',review,digest:experienceArtifactReviewDigest(review)});
  const receipts=await Promise.all([publish(),publish()]);for(const result of receipts)expect(result.status,await result.clone().text()).toBe(200);
  expect(await receipts[0]!.json()).toEqual(await receipts[1]!.json());
  const visible=await (await call({operation:'copies'},'MEM-B')).json() as Array<{id:string;content:string}>;expect(visible).toHaveLength(1);expect(visible[0]?.content).toBe('Only reviewed words');expect(JSON.stringify(visible)).not.toContain(projectId);
  response=await command(projectId,1,{type:'delete-artifact',artifactId:'artifact',versionId:'artifact'});expect(response.status,await response.clone().text()).toBe(200);
  expect((await (await call({operation:'snapshot'})).json()as WorkspaceSnapshot).projects[0]?.artifacts).toEqual([]);
  expect((await (await call({operation:'copies'},'MEM-B')).json()as unknown[])).toHaveLength(1);
  expect((await publish()).status).toBe(200);
  const upload=await call({operation:'seed-upload',projectId});expect(upload.status,await upload.clone().text()).toBe(200);const seeded=await upload.json()as WorkspaceSnapshot;
  const bucket=await mf.getR2Bucket('HERCULES_FILES'),key='development/HH-SQL/MEM-A/'+projectId+'/original-upload-hash';expect(await bucket.head(key)).not.toBeNull();
  response=await command(projectId,seeded.projects[0]!.revision,{type:'delete-artifact',artifactId:'upload',versionId:'upload'});expect(response.status,await response.clone().text()).toBe(200);expect(await bucket.head(key)).toBeNull();
  expect((await (await call({operation:'snapshot'})).json()as WorkspaceSnapshot).projects[0]?.artifacts).toEqual([]);
  expect((await call({operation:'withdraw',id:review.id},'MEM-B')).status).toBe(400);expect((await call({operation:'withdraw',id:review.id})).status).toBe(200);expect(await (await call({operation:'copies'},'MEM-B')).json()).toEqual([]);expect((await publish()).status).toBe(400);
 }finally{await mf.dispose();}
},60000);
