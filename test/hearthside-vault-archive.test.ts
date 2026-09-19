import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

it('recovers acknowledged private state, lost acknowledgements, media, sealed capsules and withdrawal from an empty SQLite DO', async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {HearthsideVault} from './workers/hearthsideVault.ts';
    const subjects={'MEM-A':'11111111-1111-4111-a111-111111111111','MEM-B':'22222222-2222-4222-a222-222222222222'};
    export class TestVault extends HearthsideVault {
      constructor(ctx,env) {
        const fault={mode:''}; const bucket=env.MEDIA;
        super(ctx,{HEARTHSIDE_VAULT_MEDIA:bucket,HEARTHSIDE_VAULT_ARCHIVE:{get:key=>bucket.get(key),put:async(key,value,options)=>{
          if(key.endsWith('head.json')&&fault.mode==='before-head'){fault.mode='';throw Error('Simulated private archive outage');}
          const result=await bucket.put(key,value,options);
          if(key.endsWith('head.json')&&fault.mode==='after-head'){fault.mode='';throw Error('Simulated lost acknowledgement');}
          return result;
        }},HEARTHSIDE_VAULT_AUTHORITY:{policy:async(scope,input)=>({recipients:input.recipientMemberIds.map(memberId=>({memberId,subject:subjects[memberId]})),approvers:[{memberId:scope.memberId,subject:scope.subject}]}),
          accept:async(scope,ref)=>{if(fault.mode==='pause-accept'){fault.started=true;fault.startedWaiter?.();await new Promise(resolve=>fault.finish=resolve);}return {...ref,receiptId:'accepted-'+ref.publicationId,acceptedAt:1000};},isReferenced:async()=>false}});
        this.fault=fault;
      }
      setFault(mode){this.fault.mode=mode;return {ok:true};}
      waitForAccept(){return this.fault.started?true:new Promise(resolve=>this.fault.startedWaiter=()=>resolve(true));}
      finishAccept(){this.fault.mode='';this.fault.finish?.();return true;}
    }
    export default {async fetch(request,env){
      const [instance,action]=new URL(request.url).pathname.slice(1).split('/');
      const memberId=request.headers.get('X-Test-Member')||'MEM-A';
      const scope={environment:'development',householdId:'HH-RECOVERY',memberId,subject:subjects[memberId],role:'owner',aclEpoch:1,expires:Date.now()+60000};
      const room=env.ROOMS.get(env.ROOMS.idFromName(instance));
      try {
        if(action==='snapshot')return Response.json(await room.snapshotFor(scope));
        if(action==='command')return Response.json(await room.commandFor(scope,await request.json(),true,'request-only-token'));
        if(action==='restore')return Response.json(await room.restoreFromArchive(scope,2));
        if(action==='fault')return Response.json(await room.setFault(await request.text()));
        if(action==='wait-accept')return Response.json(await room.waitForAccept());
        if(action==='finish-accept')return Response.json(await room.finishAccept());
        if(action==='upload')return Response.json(await room.uploadFor(scope,'voice',new Uint8Array(await request.arrayBuffer()),'audio/ogg'));
        if(action==='media')return await room.mediaFor(scope,'voice',null);
        return new Response('',{status:404});
      }catch(error){return Response.json({code:error.message},{status:409});}
    }};
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:*', 'node:*'] });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-08-27', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { ROOMS: { className: 'TestVault', useSQLite: true } }, r2Buckets: ['MEDIA'] }));
  const command = (instance: string, body: unknown, member = 'MEM-A') => mf.dispatchFetch(`http://localhost/${instance}/command`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Test-Member': member }, body: JSON.stringify(body),
  });
  const call = (instance: string, action: string) => mf.dispatchFetch(`http://localhost/${instance}/${action}`);
  const fault = (mode: string) => mf.dispatchFetch('http://localhost/first/fault', { method: 'POST', body: mode });
  const save = (revision: number, text: string) => ({ operation: 'save-draft', input: { id: 'draft', expectedRevision: revision, content: { title: 'Private letter', text, mediaIds: [] } } });
  const prefix = 'hearthside-vault-archive-v1/development/HH-RECOVERY/';
  try {
    expect((await call('first', 'snapshot')).status).toBe(200);
    await fault('before-head');
    expect((await command('first', save(0, 'First private words'))).status).toBe(409);
    const recovered = await command('first', save(0, 'First private words'));
    expect(await recovered.json()).toMatchObject({ revision: 1, content: { text: 'First private words' } });
    const bucket = await mf.getR2Bucket('MEDIA');
    const firstHead = await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number };
    await fault('after-head'); expect((await command('first', save(1, 'Words kept after an uncertain reply'))).status).toBe(409);
    const second = await command('first', save(1, 'Words kept after an uncertain reply'));
    expect(await second.json()).toMatchObject({ revision: 2 });
    const headAfterRetry = await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number };
    expect(headAfterRetry.sequence).toBe(firstHead.sequence + 1);

    const bytes = new TextEncoder().encode('OggSsynthetic-private-voice');
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    expect((await command('first', { operation: 'prepare-media', input: { id: 'voice', sha256: digest, byteLength: bytes.length, contentType: 'audio/ogg' } })).status).toBe(200);
    expect((await mf.dispatchFetch('http://localhost/first/upload', { method: 'POST', body: bytes })).status).toBe(200);
    const publish = async (id: string, releaseAt: number | null) => {
      const prepared = await command('first', { operation: 'prepare-publication', input: { id, draftId: 'draft', draftRevision: 2,
        kind: releaseAt ? 'capsule' : 'letter', recipientMemberIds: ['MEM-B'], releaseAt } });
      const review = await prepared.json() as { digest: string };
      expect((await command('first', { operation: 'approve', id, digest: review.digest })).status).toBe(200);
      expect((await command('first', { operation: 'activate', id })).status).toBe(200);
    };
    await publish('letter', null); await publish('capsule', Date.now() + 86400000);
    const racing = await (await command('first', { operation: 'prepare-publication', input: { id: 'racing-letter', draftId: 'draft', draftRevision: 2,
      kind: 'letter', recipientMemberIds: ['MEM-B'], releaseAt: null } })).json() as { digest: string };
    await command('first', { operation: 'approve', id: 'racing-letter', digest: racing.digest });
    await fault('pause-accept');
    const pendingAcceptance = command('first', { operation: 'activate', id: 'racing-letter' });
    await call('first', 'wait-accept');
    expect((await command('first', { operation: 'withdraw', id: 'racing-letter' })).status).toBe(200);
    await call('first', 'finish-accept');
    expect(await (await pendingAcceptance).json()).toEqual({ code: 'PUBLICATION_REVOKED' });
    const beforeWithdrawal = await (await bucket.get(prefix + 'head.json'))!.text();
    expect((await command('first', { operation: 'withdraw', id: 'letter' })).status).toBe(200);
    expect((await command('first', { operation: 'delete-draft', input: { id: 'draft', expectedRevision: 2 } })).status).toBe(200);
    const acknowledgedHead = await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number };

    // A stale restored head must not erase the later durable withdrawal/delete journal.
    await bucket.put(prefix + 'head.json', beforeWithdrawal);
    expect(await (await call('empty', 'snapshot')).json()).toEqual({ code: 'VAULT_RESTORE_REQUIRED' });
    let progress: { complete: boolean; sequence: number; target: number };
    let pages = 0;
    do {
      const response = await call('empty', 'restore'); expect(response.status, await response.clone().text()).toBe(200);
      progress = await response.json() as typeof progress;
      if (!progress.complete) expect(await (await call('empty', 'snapshot')).json()).toEqual({ code: 'VAULT_RESTORE_REQUIRED' });
      expect(++pages).toBeLessThan(30);
    } while (!progress.complete);
    expect(progress.sequence).toBe(acknowledgedHead.sequence);
    expect((await call('empty', 'media')).status).toBe(200);
    expect(new Uint8Array(await (await call('empty', 'media')).arrayBuffer())).toEqual(bytes);
    expect(await (await command('empty', { operation: 'read-publication', id: 'letter' }, 'MEM-B')).json()).toEqual({ code: 'NOT_FOUND' });
    expect(await (await command('empty', { operation: 'read-publication', id: 'capsule' }, 'MEM-B')).json()).toEqual({ code: 'SEALED' });
    expect(await (await command('empty', { operation: 'read-draft', id: 'draft' })).json()).toEqual({ code: 'NOT_FOUND' });
    expect(await (await call('empty', 'restore')).json()).toEqual({ code: 'VAULT_RESTORE_NOT_EMPTY' });

    await mf.dispatchFetch('http://localhost/empty/fault', { method: 'POST', body: 'before-head' });
    expect((await command('empty', { operation: 'cleanup-media', id: 'voice' })).status).toBe(409);
    // A failed tombstone flush must leave bytes intact, while access is denied.
    const mediaKey = 'vault-v1/development/HH-RECOVERY/voice';
    expect(await bucket.head(mediaKey)).not.toBeNull();
    expect(await (await call('empty', 'media')).json()).toEqual({ code: 'MEDIA_UNAVAILABLE' });
    expect((await command('empty', { operation: 'cleanup-media', id: 'voice' })).status).toBe(200);
    expect(await bucket.head(mediaKey)).toBeNull();

    for (let revision = 0; revision < 36; revision++) {
      const response = await command('empty', { operation: 'save-draft', input: { id: 'checkpoint-draft', expectedRevision: revision,
        content: { title: 'A continuing thought', text: `Revision ${revision}`, mediaIds: [] } } }); expect(response.status).toBe(200);
    }
    const checkpointHead = await (await bucket.get(prefix + 'head.json'))!.json() as { sequence: number; checkpoint: { sequence: number } };
    expect(checkpointHead.checkpoint.sequence).toBeGreaterThan(0);
    pages = 0;
    do { progress = await (await call('checkpoint-copy', 'restore')).json() as typeof progress; expect(++pages).toBeLessThan(20); } while (!progress.complete);
    expect(await (await command('checkpoint-copy', { operation: 'read-draft', id: 'checkpoint-draft' })).json()).toMatchObject({ revision: 36, content: { text: 'Revision 35' } });
    expect(await (await command('checkpoint-copy', { operation: 'read-publication', id: 'letter' }, 'MEM-B')).json()).toEqual({ code: 'NOT_FOUND' });
    expect(await (await call('checkpoint-copy', 'media')).json()).toEqual({ code: 'MEDIA_UNAVAILABLE' });
    const lastKey = prefix + `journal/${String(checkpointHead.sequence).padStart(16, '0')}.json`;
    const last = await (await bucket.get(lastKey))!.json() as { checksum: string };
    await bucket.put(lastKey, JSON.stringify({ ...last, checksum: '0'.repeat(64) }));
    let corrupt: { code?: string; complete?: boolean } = {};
    for (let page = 0; page < 20 && !corrupt.code; page++) corrupt = await (await call('corrupt-copy', 'restore')).json() as typeof corrupt;
    expect(corrupt.code).toBe('VAULT_ARCHIVE_CORRUPT');
    expect(await (await call('corrupt-copy', 'snapshot')).json()).toEqual({ code: 'VAULT_RESTORE_REQUIRED' });
    const objects = await bucket.list({ prefix });
    for (const object of objects.objects) expect(await (await bucket.get(object.key))!.text()).not.toContain('request-only-token');
  } finally { await mf.dispose(); }
}, 90_000);

it('assembles the configured audience adapter and trusted LedgerRoom RPCs without an injected authority', async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {DurableObject} from 'cloudflare:workers';
    import {HearthsideVault} from './workers/hearthsideVault.ts'; export {HearthsideVault};
    export class ReferenceRoom extends DurableObject {
      async acceptVaultPublication(scope,ref){
        if(ref.environment!==scope.environment||ref.householdId!==scope.householdId)throw Error('FORBIDDEN');
        const prior=await this.ctx.storage.get(ref.publicationId);if(prior)return prior;
        const receipt={...ref,receiptId:'canonical-'+ref.publicationId,acceptedAt:1000};
        await this.ctx.storage.put(ref.publicationId,receipt);return receipt;
      }
      async vaultMediaReferenced(){return false;}
    }
    export default {async fetch(request,env){
      const scope={environment:'development',householdId:'HH-ASSEMBLY',memberId:'MEM-A',subject:'11111111-1111-4111-a111-111111111111',role:'owner',aclEpoch:1,expires:Date.now()+60000};
      try{return Response.json(await env.VAULTS.get(env.VAULTS.idFromName('development/HH-ASSEMBLY')).commandFor(scope,await request.json(),true,'assembly-request-only'));}
      catch(error){return Response.json({code:error.message},{status:409});}
    }};
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:*', 'node:*'] });
  const mf = new Miniflare(convertV4MiniflareOptions({ workers: [{ name: 'app', modules: true, script: bundle.outputFiles[0]!.text,
    compatibilityDate: '2026-08-27', compatibilityFlags: ['nodejs_compat'], outboundService: 'control-plane',
    durableObjects: { VAULTS: { className: 'HearthsideVault', useSQLite: true }, LEDGER_ROOMS: { className: 'ReferenceRoom', useSQLite: true } },
    r2Buckets: ['HEARTHSIDE_VAULT_MEDIA'], bindings: { SUPABASE_URL: 'https://synthetic.supabase.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic',
      HEARTHSIDE_VAULT_AUTHORITY_KEY_ID: 'synthetic-key', HEARTHSIDE_VAULT_AUTHORITY_KEY: '56'.repeat(32) },
  }, { name: 'control-plane', modules: true, compatibilityDate: '2026-08-27', script: `
    export default {async fetch(request){const value=await request.json();
      if(new URL(request.url).pathname!=='/rest/v1/rpc/hearthside_vault_audience'||request.headers.get('Authorization')!=='Bearer assembly-request-only'||!value.p_signature||value.p_key_id!=='synthetic-key')return new Response('',{status:403});
      return Response.json({version:1,environment:value.p_environment,householdId:value.p_household_id,memberId:value.p_member_id,subject:value.p_subject,checkedAt:Date.now(),principals:[{memberId:'MEM-A',subject:'11111111-1111-4111-a111-111111111111'},{memberId:'MEM-B',subject:'22222222-2222-4222-a222-222222222222'}]});
    }};
  ` }] }));
  const command = (body: unknown) => mf.dispatchFetch('http://localhost/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  try {
    expect(await (await command({ operation: 'restoreFromArchive' })).json()).toEqual({ code: 'INVALID_OPERATION' });
    expect((await command({ operation: 'save-draft', input: { id: 'draft', expectedRevision: 0, content: { title: 'Configured', text: 'Private', mediaIds: [] } } })).status).toBe(200);
    const prepared = await command({ operation: 'prepare-publication', input: { id: 'letter', draftId: 'draft', draftRevision: 1, kind: 'letter', recipientMemberIds: ['MEM-B'], releaseAt: null } });
    expect(prepared.status, await prepared.clone().text()).toBe(200);
    const review = await prepared.json() as { digest: string };
    expect((await command({ operation: 'approve', id: 'letter', digest: review.digest })).status).toBe(200);
    const active = await command({ operation: 'activate', id: 'letter' });
    expect(await active.json()).toMatchObject({ state: 'active', acceptedReceiptId: 'canonical-letter' });
    const bucket = await mf.getR2Bucket('HEARTHSIDE_VAULT_MEDIA');
    for (const object of (await bucket.list()).objects) expect(await (await bucket.get(object.key))!.text()).not.toContain('assembly-request-only');
  } finally { await mf.dispose(); }
}, 60_000);
