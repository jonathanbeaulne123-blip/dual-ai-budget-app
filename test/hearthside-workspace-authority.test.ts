import {expect,it} from 'vitest';
import {hearthsideAuthorityHarness} from './fixtures/hearthsideAuthorityHarness.ts';
import {preparedExperienceArtifact,artifactPublication} from '../src/hearthside/workspacePublication.ts';
import {financialAuditHash} from '../src/core/commandIdentity.ts';
it('links only a verified shared copy through actual LedgerRoom, with original receipt recovery and revoke-before-withdraw',async()=>{
 const app=await hearthsideAuthorityHarness('HH-workspace-authority',{workspaceCopies:true});
 try{
  const money=await financialAuditHash(await app.household());
  const experience={version:1 as const,id:'EXP-worktable',revision:1,title:'Our picnic',intention:'Find a little time outside',state:'dreaming' as const,horizon:'season' as const,createdBy:'MEM-001',references:[]};
  expect(await app.submit({kind:'experience.save',expectedRevision:0,value:experience})).toMatchObject({type:'ack'});
  const copy=preparedExperienceArtifact({version:1,id:'shared-picnic',projectId:'PRIVATE-PROJECT-CANARY',artifactVersionId:'PRIVATE-VERSION-CANARY',experienceId:experience.id,experienceRevision:1,title:'A picnic with what we have',format:'markdown',content:'SHARED-BODY-CANARY\nBread, a blanket, the nearby park.'},'MEM-001');
  const publication=artifactPublication(copy),call=(body:object,actor='MEM-001')=>app.post('workspace-copy-test',body,actor);
  expect((await call({kind:'accept',publication})).status).toBe(409);
  expect((await call({kind:'prepare',copy})).status).toBe(200);
  expect((await call({kind:'accept',publication:{...publication,title:'Changed after preparation'}})).status).toBe(409);
  expect((await call({kind:'accept',publication},'MEM-002')).status).toBe(409);
  const accepted=await call({kind:'accept',publication});expect(accepted.status,await accepted.clone().text()).toBe(200);const receipt=await accepted.json();
  expect(await (await call({kind:'accept',publication})).json()).toEqual(receipt);
  const h=await app.household('MEM-002'),linked=h.hearthside!.experiences[0]!;
  expect(linked.references).toEqual([{kind:'artifact',id:copy.id,revision:1}]);expect(linked.revision).toBe(2);
  expect(h.hearthside!.artifactPublications).toEqual([publication]);expect(JSON.stringify(h)).not.toMatch(/PRIVATE-PROJECT-CANARY|PRIVATE-VERSION-CANARY|SHARED-BODY-CANARY/);
  expect(await (await call({kind:'list',experienceId:experience.id},'MEM-002')).json()).toEqual([]);
  expect((await call({kind:'activate',id:copy.id,receipt})).status).toBe(200);
  expect(await (await call({kind:'list',experienceId:experience.id},'MEM-002')).json()).toMatchObject([{id:copy.id,state:'active'}]);
  expect(await app.submit({kind:'experience.save',expectedRevision:2,value:{...linked,title:'Picnic next Sunday',revision:3}})).toMatchObject({type:'ack'});
  expect(await (await call({kind:'accept',publication})).json()).toEqual(receipt);
  const withdrawal={...publication,state:'withdrawn' as const};expect((await call({kind:'withdraw',publication:withdrawal})).status).toBe(409);
  expect((await call({kind:'revoke',id:copy.id})).status).toBe(200);
  const withdrawn=await call({kind:'withdraw',publication:withdrawal});expect(withdrawn.status,await withdrawn.clone().text()).toBe(200);
  expect(await (await call({kind:'withdraw',publication:withdrawal})).json()).toEqual(await withdrawn.json());
  expect((await call({kind:'accept',publication})).status).toBe(409);expect((await app.household()).hearthside!.experiences[0]!.references).toEqual([]);
  expect(await (await call({kind:'list',experienceId:experience.id},'MEM-002')).json()).toEqual([]);
  expect(await financialAuditHash(await app.household())).toBe(money);
 }finally{await app.dispose();}
},60_000);
