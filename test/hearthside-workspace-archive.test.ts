import { beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { artifactPublication, preparedExperienceArtifact, type PreparedExperienceArtifact } from '../src/hearthside/workspacePublication.ts';

let script = '';
const prefix = 'hearthside-shared-workspace-archive-v1/development/HH-ARCHIVE/';
const copy = (id: string, content = 'Reviewed words'): PreparedExperienceArtifact => preparedExperienceArtifact({ version: 1, id, projectId: 'private-project', artifactVersionId: 'private-version', experienceId: 'experience:home', experienceRevision: 1, title: 'Our plan', format: 'markdown', content }, 'MEM-A');
const receipt = (value: PreparedExperienceArtifact) => ({ version: 1, id: value.id, publication: artifactPublication(value), acceptedSequence: 1 });

beforeAll(async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {getAgentByName} from 'agents';
    import {HerculesSharedWorkspace} from './workers/workspace/shared.ts';
    import {consumeWorkspaceRpc} from './src/hearthside/workspaceRpc.ts';
    export class TestShared extends HerculesSharedWorkspace {
      constructor(ctx,env){
        const fault={mode:''},bucket=env.HERCULES_FILES;
        super(ctx,{HERCULES_FILES:{get:async key=>{if(fault.mode==='offline')throw Error('private-provider-detail');return bucket.get(key);},put:async(key,value,options)=>{
          if(fault.mode==='offline')throw Error('private-provider-detail');
          if(key.endsWith('/head.json')&&fault.mode==='before-head'){fault.mode='';throw Error('head interrupted');}
          const saved=await bucket.put(key,value,options);
          if(key.endsWith('/head.json')&&fault.mode==='after-head'){fault.mode='';throw Error('head acknowledgement lost');}return saved;
        }}});this.fault=fault;
      }
      setFault(value){this.fault.mode=value;return true;}
      setOwnerFault(enabled){if(enabled)this.sql\`CREATE TRIGGER fail_shared_owner BEFORE INSERT ON shared_workspace_owner BEGIN SELECT RAISE(ABORT,'synthetic owner failure'); END\`;else this.sql\`DROP TRIGGER fail_shared_owner\`;return true;}
      setSqlFault(enabled){if(enabled)this.sql\`CREATE TRIGGER fail_shared_outbox BEFORE INSERT ON shared_archive_outbox BEGIN SELECT RAISE(ABORT,'synthetic outbox failure'); END\`;else this.sql\`DROP TRIGGER fail_shared_outbox\`;return true;}
      seedLegacy(scope,owner=true){if(owner)this.sql\`INSERT INTO shared_workspace_owner VALUES (\${scope.environment+'/'+scope.householdId})\`;this.sql\`INSERT INTO shared_workspace_artifacts VALUES ('legacy',\${JSON.stringify({id:'legacy',title:'Earlier shared note',format:'markdown',content:'Already shared before archive migration',sharedBy:'MEM-A',sharedAt:'2026-09-12T00:00:00.000Z'})})\`;return true;}
      audit(){return{owner:this.sql\`SELECT id FROM shared_workspace_owner\`,outbox:this.sql\`SELECT sequence FROM shared_archive_outbox\`,meta:this.sql\`SELECT data FROM shared_archive_state WHERE key='meta'\`,copies:this.sql\`SELECT id FROM shared_experience_artifacts\`};}
    }
    export class UnboundShared extends HerculesSharedWorkspace {constructor(ctx){super(ctx,{});}}
    export default {async fetch(request,env){try{
      const body=await request.json(),member=request.headers.get('X-Member')||'MEM-A',household=request.headers.get('X-Household')||'HH-ARCHIVE';
      const scope={environment:'development',householdId:household,memberId:member,subject:'local:'+member,role:'owner',aclEpoch:1,expires:Date.now()+60000};
      const agent=await getAgentByName(body.unbound?env.UNBOUND:env.SHARED,body.instance||'first');let result;
      if(body.action==='legacy-seed')result=await agent.seedLegacy(scope,body.owner!==false);
      else if(body.action==='fault')result=await agent.setFault(body.mode);
      else if(body.action==='owner-fault')result=await agent.setOwnerFault(body.enabled);
      else if(body.action==='sql-fault')result=await agent.setSqlFault(body.enabled);
      else if(body.action==='audit')result=await agent.audit();
      else if(body.action==='prepare')result=await agent.prepareExperience(scope,body.copy);
      else if(body.action==='prepared')result=await agent.preparedExperienceFor(scope,body.id);
      else if(body.action==='activate')result=await agent.activateExperience(scope,body.id,body.receipt);
      else if(body.action==='revoke')result=await agent.revokeExperience(scope,body.id);
      else if(body.action==='restore')result=await agent.restoreSharedCopiesFromArchive(scope,body.limit||3);
      else if(body.action==='legacy')result=await agent.listFor(scope);
      else result=await agent.experienceCopyFor(scope,'experience:home',body.id);
      return Response.json(consumeWorkspaceRpc(result??null));
    }catch(error){return Response.json({error:error.message},{status:409});}}};
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:*', 'node:*'], alias: { path: 'node:path' } });
  script = bundle.outputFiles[0]!.text;
}, 60000);

function runtime(persist?: string) {
  return new Miniflare(convertV4MiniflareOptions({ modules: true, script, compatibilityDate: '2026-08-27', compatibilityFlags: ['nodejs_compat'], resourcePersistencePath: persist,
    durableObjects: { SHARED: { className: 'TestShared', useSQLite: true }, UNBOUND: { className: 'UnboundShared', useSQLite: true } }, r2Buckets: ['HERCULES_FILES'] }));
}
function ports(get: () => Miniflare) {
  const call = (body: Record<string, unknown>, member = 'MEM-A', household = 'HH-ARCHIVE') => get().dispatchFetch('http://localhost/test', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Member': member, 'X-Household': household }, body: JSON.stringify(body) });
  const ok = async (body: Record<string, unknown>, member = 'MEM-A') => { const r = await call(body, member); expect(r.status, await r.clone().text()).toBe(200); return r.json() as Promise<any>; };
  const restore = async (instance: string) => { let progress; do { progress = await ok({ instance, action: 'restore' }); } while (!progress.complete); return progress; };
  return { call, ok, restore };
}

it('archives exact multibyte shared copies, migrates legacy data and recovers withdrawal through a real Agent restart and empty SQLite namespace', async () => {
  const path = await mkdtemp(join(tmpdir(), 'hearth-shared-archive-')); let mf = runtime(path); const { call, ok, restore } = ports(() => mf);
  try {
    await ok({ action: 'legacy-seed' }); expect(await ok({ action: 'legacy' })).toHaveLength(1);
    await ok({ action: 'sql-fault', enabled: true }); expect((await call({ action: 'prepare', copy: copy('rolled-back') })).status).toBe(409);
    const rolledBack = await ok({ action: 'audit' }); expect(rolledBack.copies).toEqual([]); expect(rolledBack.outbox).toEqual([]); await ok({ action: 'sql-fault', enabled: false });
    const large = copy('large', '愛'.repeat(500000));
    await ok({ action: 'fault', mode: 'after-head' }); expect(await (await call({ action: 'prepare', copy: large })).json()).toEqual({ error: 'SHARED_ARCHIVE_UNAVAILABLE' });
    expect((await ok({ action: 'audit' })).outbox).toHaveLength(1);
    const bucket = await mf.getR2Bucket('HERCULES_FILES'), acceptedHead = await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number };
    expect(await ok({ action: 'prepare', copy: large })).toEqual(large);
    expect(await ok({ action: 'read', id: large.id }, 'MEM-B')).toBeNull();
    expect((await call({ action: 'prepare', copy: copy('large', 'Changed exact content') })).status).toBe(409);
    expect((await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number }).sequence).toBe(acceptedHead.sequence);
    await ok({ action: 'activate', id: large.id, receipt: receipt(large) });
    expect((await ok({ action: 'read', id: large.id }, 'MEM-B')).content).toBe(large.content);
    await bucket.put('development/HH-ARCHIVE/MEM-A/private-project/original', 'private source');
    await bucket.delete('development/HH-ARCHIVE/MEM-A/private-project/original');
    expect((await ok({ action: 'read', id: large.id }, 'MEM-B')).content.length).toBe(500000);
    const escaped = copy('escaped', '\u0000'.repeat(500000));
    expect((await ok({ action: 'prepare', copy: escaped })).content.length).toBe(500000);
    const blobs = await bucket.list({ prefix: prefix + 'chunks/' }); expect(blobs.objects.length).toBeGreaterThan(5); expect(blobs.objects.every(o => o.size <= 256 * 1024)).toBe(true);
    // Finish the process and reopen its real persisted SQLite/R2 data.
    await mf.dispose(); mf = runtime(path);
    expect((await ok({ action: 'read', id: large.id }, 'MEM-B')).content).toBe(large.content);
    const currentBucket = await mf.getR2Bucket('HERCULES_FILES');
    // Force a checkpoint with ordinary distinct immutable copies.
    for (let n = 0; n < 29; n++) await ok({ action: 'prepare', copy: copy('earlier-' + n) });
    const before = await (await currentBucket.get(prefix + 'head.json'))!.text(); expect(JSON.parse(before).checkpoint).not.toBeNull();
    expect((await call({ action: 'revoke', id: large.id }, 'MEM-B')).status).toBe(409);
    await ok({ action: 'fault', mode: 'before-head' }); expect((await call({ action: 'revoke', id: large.id })).status).toBe(409);
    // A retry is the same terminal copy and drains its SQL outbox.
    expect((await ok({ action: 'revoke', id: large.id })).state).toBe('withdrawn');
    const audit = await ok({ action: 'audit' }); expect(audit.outbox).toEqual([]);
    expect(await ok({ action: 'read', id: large.id }, 'MEM-B')).toBeNull();
    await currentBucket.put(prefix + 'head.json', before);
    expect(await (await call({ instance: 'empty', action: 'legacy' })).json()).toEqual({ error: 'SHARED_RESTORE_REQUIRED' });
    const progress = await restore('empty'); expect(progress.sequence).toBeGreaterThan(JSON.parse(before).sequence);
    expect(await ok({ instance: 'empty', action: 'legacy' })).toHaveLength(1);
    expect((await ok({ instance: 'empty', action: 'prepared', id: large.id })).state).toBe('withdrawn');
    expect(await ok({ instance: 'empty', action: 'read', id: large.id }, 'MEM-B')).toBeNull();
    expect((await call({ instance: 'empty', action: 'activate', id: large.id, receipt: receipt(large) })).status).toBe(409);
    expect(await (await call({ instance: 'empty', action: 'restore' })).json()).toEqual({ error: 'SHARED_RESTORE_NOT_EMPTY' });
    expect((await call({ instance: 'empty', action: 'legacy' }, 'MEM-A', 'HH-OTHER')).status).toBe(409);
  } finally { await mf.dispose(); await rm(path, { recursive: true, force: true }); }
}, 120000);

it('recovers an immutable tail after uncertain head publication and refuses content corruption or offline disclosure', async () => {
  const mf = runtime(); const { call, ok, restore } = ports(() => mf);
  try {
    expect(await (await call({ unbound: true, action: 'legacy' })).json()).toEqual({ error: 'SHARED_ARCHIVE_UNAVAILABLE' });
    await ok({ action: 'legacy' }); const value = copy('tail-copy', '海'.repeat(200000));
    await ok({ action: 'fault', mode: 'before-head' }); expect((await call({ action: 'prepare', copy: value })).status).toBe(409);
    await restore('tail'); expect(await ok({ instance: 'tail', action: 'prepared', id: value.id })).toEqual(value);
    await ok({ instance: 'tail', action: 'activate', id: value.id, receipt: receipt(value) });
    await ok({ instance: 'tail', action: 'fault', mode: 'offline' });
    expect(await (await call({ instance: 'tail', action: 'read', id: value.id }, 'MEM-B')).json()).toEqual({ error: 'SHARED_ARCHIVE_UNAVAILABLE' });
    await ok({ instance: 'tail', action: 'fault', mode: '' });
    const bucket = await mf.getR2Bucket('HERCULES_FILES'), head = await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number };
    const latest = await (await bucket.get(prefix + 'journal/' + String(head.sequence).padStart(16, '0') + '.json'))!.json() as { journal: { row: { chunks: string[] } } };
    const key = prefix + 'chunks/' + latest.journal.row.chunks[0] + '.bin'; await bucket.put(key, 'corrupt');
    expect(await (await call({ instance: 'corrupt-empty', action: 'restore', limit: 128 })).json()).toEqual({ error: 'SHARED_ARCHIVE_CORRUPT' });
    expect(await (await call({ instance: 'corrupt-empty', action: 'read', id: value.id }, 'MEM-B')).json()).toEqual({ error: 'SHARED_RESTORE_REQUIRED' });
    expect((await ok({ instance: 'corrupt-empty', action: 'audit' })).copies).toEqual([]);
  } finally { await mf.dispose(); }
}, 60000);

it.each([false, true])('rolls back first-owner initialization atomically and restores exact copies after retry (adopting legacy: %s)', async (adoptingLegacy) => {
  const mf = runtime(); const { call, ok, restore } = ports(() => mf);
  try {
    if (adoptingLegacy) await ok({ action: 'legacy-seed', owner: false });
    await ok({ action: 'owner-fault', enabled: true });
    expect((await call({ action: 'prepare', copy: copy('owner-retry') })).status).toBe(409);
    expect(await ok({ action: 'audit' })).toEqual({ owner: [], outbox: [], meta: [], copies: [] });
    const bucket = await mf.getR2Bucket('HERCULES_FILES');
    expect(await bucket.get(prefix + 'head.json')).toBeNull();
    await ok({ action: 'owner-fault', enabled: false });
    const expected = copy('owner-retry');
    expect(await ok({ action: 'prepare', copy: expected })).toEqual(expected);
    expect((await ok({ action: 'audit' })).owner).toEqual([{ id: 'development/HH-ARCHIVE' }]);
    expect((await restore('owner-recovered')).complete).toBe(true);
    expect(await ok({ instance: 'owner-recovered', action: 'prepared', id: expected.id })).toEqual(expected);
    const legacy = await ok({ instance: 'owner-recovered', action: 'legacy' });
    expect(legacy).toHaveLength(adoptingLegacy ? 1 : 0);
    if (adoptingLegacy) expect(legacy[0].content).toBe('Already shared before archive migration');
    expect((await call({ instance: 'owner-recovered', action: 'prepared', id: expected.id }, 'MEM-A', 'HH-OTHER')).status).toBe(409);
  } finally { await mf.dispose(); }
}, 60000);

it('discovers a tail beyond 128 entries and catches a newer withdrawal while paged restore is staged', async () => {
  const mf = runtime(); const { call, ok } = ports(() => mf);
  try {
    const value = copy('late-withdrawal');
    await ok({ action: 'prepare', copy: value });
    await ok({ action: 'activate', id: value.id, receipt: receipt(value) });
    const bucket = await mf.getR2Bucket('HERCULES_FILES'), earlierHead = await (await bucket.get(prefix + 'head.json'))!.text();
    for (let i = 0; i < 130; i++) await ok({ action: 'prepare', copy: copy('tail-' + i) });
    await bucket.put(prefix + 'head.json', earlierHead);
    let progress: {complete:boolean;sequence:number;target:number} = {complete:false,sequence:0,target:0}, discoveryCalls = 0;
    while (progress.sequence === 0 && discoveryCalls < 10) {
      progress = await ok({ instance: 'paged', action: 'restore', limit: 32 }); discoveryCalls++;
    }
    expect(discoveryCalls).toBeGreaterThanOrEqual(5);
    expect(progress.sequence).toBeGreaterThan(0); expect(progress.complete).toBe(false);
    expect((await call({ instance: 'paged', action: 'read', id: value.id }, 'MEM-B')).status).toBe(409);
    // Even a newer tip arriving between recovery pages must be replayed before exposure.
    await ok({ action: 'revoke', id: value.id });
    for (let i = 0; !progress.complete && i < 20; i++) progress = await ok({ instance: 'paged', action: 'restore', limit: 32 });
    expect(progress.complete).toBe(true);
    expect((await ok({ instance: 'paged', action: 'prepared', id: value.id })).state).toBe('withdrawn');
    expect(await ok({ instance: 'paged', action: 'read', id: value.id }, 'MEM-B')).toBeNull();
    expect((await call({ instance: 'paged', action: 'activate', id: value.id, receipt: receipt(value) })).status).toBe(409);
  } finally { await mf.dispose(); }
}, 90000);
