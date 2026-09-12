import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { decodeMemoryPublicationBinding, memoryCompositionDigest, type MemoryPublicationCandidate, type MemoryPublicationBinding } from '../src/hearthside/memoryPublication.ts';

const candidate = (): MemoryPublicationCandidate => ({ version: 1, id: 'MEMORY-ONE', revision: 1, title: 'A small moment', date: '2026-09-12', experienceId: null,
  media: [{ version: 1, contentId: 'copy-bob', revision: 1, kind: 'audio', alt: 'The sound we chose to keep' }], designs: [],
  recollections: [{ memberId: 'MEM-B', text: 'We made time for this.' }], hideAmounts: true, approvals: [], withdrawn: false });

it('binds the exact authored memory including ordering, captions, amount visibility and separately authored words', async () => {
  const memory = candidate(), digest = await memoryCompositionDigest(memory);
  for (const change of [
    { title: 'Another title' }, { date: '2026-09-13' }, { hideAmounts: false },
    { media: [{ ...memory.media[0]!, alt: 'A changed caption' }] },
    { recollections: [{ memberId: 'MEM-B', text: 'Different words' }] },
    { designs: [{ version: 1 as const, documentId: 'design', pieceId: 'piece', revision: 3 }] },
    { revision: 2 },
  ]) expect(await memoryCompositionDigest({ ...memory, ...change })).not.toBe(digest);
  expect(await memoryCompositionDigest({ ...memory, approvals: [{ memberId: 'MEM-A', revision: 1 }], withdrawn: true } as MemoryPublicationCandidate)).toBe(digest);
  const binding = { version: 1, publicationId: 'shared', publicationDigest: 'a'.repeat(64), memoryId: memory.id, memoryRevision: 1, compositionDigest: digest };
  expect(decodeMemoryPublicationBinding(binding)).toEqual(binding);
  expect(() => decodeMemoryPublicationBinding({ ...binding, sourceLetterId: 'private' })).toThrow('INVALID_INPUT');
  expect(() => decodeMemoryPublicationBinding({ ...binding, compositionDigest: 'wrong' })).toThrow('INVALID_MEMORY_BINDING');
});

it('keeps private-source copies, exact paired review and canonical acceptance separate through real two-DO RPC', async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {DurableObject} from 'cloudflare:workers';
    import {HearthsideVault} from './workers/hearthsideVault.ts';
    import {decodeMemory} from './src/hearthside/contracts.ts';
    import {decodeMemoryPublicationBinding,memoryCompositionDigest} from './src/hearthside/memoryPublication.ts';
    const principals=[{memberId:'MEM-A',subject:'11111111-1111-4111-a111-111111111111'},{memberId:'MEM-B',subject:'22222222-2222-4222-a222-222222222222'}];
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    // Canonical-shaped reference authority fixture. Real LedgerRoom admission is
    // an integration gate; this verifies Vault's actual RPC has no callback cycle.
    export class ReferenceRoom extends DurableObject {
      constructor(ctx,env){super(ctx,env);this.tail=Promise.resolve();this.members=structuredClone(principals);this.memory=null;this.receipts=new Map();}
      serial(action){const result=this.tail.then(action);this.tail=result.catch(()=>{});return result;}
      check(scope){if(!this.members.some(p=>p.memberId===scope.memberId&&p.subject===scope.subject))throw Error('FORBIDDEN');}
      roster(){return this.members;}
      async validateVaultMemoryCandidate(scope,raw,expectedRevision){return this.serial(async()=>{
        this.check(scope);const {publication,...plain}=raw;const value=decodeMemory(plain);
        if((this.memory?.revision??0)!==expectedRevision||value.revision!==expectedRevision+1||value.approvals.length||value.withdrawn)throw Error('MEMORY_CHANGED');
        const other=rows=>rows.filter(r=>r.memberId!==scope.memberId);
        if(!same(other(value.recollections),other(this.memory?.recollections??[])))throw Error('FORBIDDEN');
        return {candidate:value,compositionDigest:await memoryCompositionDigest(value)};
      });}
      async compose(scope,candidate){return this.serial(async()=>{
        this.check(scope);const {publication,...plain}=candidate;const value=decodeMemory(plain);
        const binding=decodeMemoryPublicationBinding(publication);
        // Deliberately hold this writer while checking Vault evidence. Any Vault
        // callback to this serial lane here would deadlock this real runtime test.
        await this.env.VAULTS.get(this.env.VAULTS.idFromName('development/HH-MEMORY')).checkMemoryPublicationFor(scope,binding,value,'compose');
        if((this.memory?.revision??0)!==value.revision-1||value.approvals.length||value.withdrawn)throw Error('MEMORY_CHANGED');
        this.memory={...value,publication:binding};return this.memory;
      });}
      async keep(scope){return this.serial(async()=>{
        this.check(scope);if(!this.memory)throw Error('NOT_FOUND');
        await this.env.VAULTS.get(this.env.VAULTS.idFromName('development/HH-MEMORY')).checkMemoryPublicationFor(scope,this.memory.publication,this.memory,'keep');
        this.memory.approvals=[...this.memory.approvals.filter(a=>a.memberId!==scope.memberId),{memberId:scope.memberId,revision:this.memory.revision}];return this.memory;
      });}
      async access(scope,binding,mediaId){
        this.check(scope);const m=this.memory;
        const current=Boolean(m&&!m.withdrawn&&same(m.publication,binding)&&m.revision===binding.memoryRevision&&await memoryCompositionDigest(m)===binding.compositionDigest&&(mediaId===null||m.media.some(media=>media.contentId===mediaId)));
        return {current,kept:current&&this.members.length>=2&&this.members.every(p=>m.approvals.some(a=>a.memberId===p.memberId&&a.revision===m.revision))};
      }
      vaultMemoryAccess(scope,binding,mediaId){return this.serial(()=>this.access(scope,binding,mediaId));}
      async acceptVaultPublication(scope,ref){return this.serial(async()=>{
        this.check(scope);if(ref.memory){const access=await this.access(scope,ref.memory,null);if(!access.current||!access.kept)throw Error('MEMORY_CHANGED');}
        let receipt=this.receipts.get(ref.publicationId);if(receipt){if(!same({...receipt,receiptId:undefined,acceptedAt:undefined},{...ref,receiptId:undefined,acceptedAt:undefined}))throw Error('ACCEPTANCE_CHANGED');return receipt;}
        receipt={...ref,receiptId:'canonical-'+ref.publicationId,acceptedAt:1000};this.receipts.set(ref.publicationId,receipt);
        if(ref.memory&&this.loseAcceptance){this.loseAcceptance=false;throw Error('Lost canonical acknowledgement');}return receipt;
      });}
      vaultMediaReferenced(scope,id){this.check(scope);return Boolean(this.memory&&!this.memory.withdrawn&&this.memory.media.some(m=>m.contentId===id));}
      control(mode){if(mode==='lose-acceptance')this.loseAcceptance=true;if(mode==='caption'){this.memory.title='Changed after keeping';this.memory.revision++;this.memory.approvals=[];}if(mode==='replace-alice')this.members[0]={memberId:'MEM-A',subject:'33333333-3333-4333-a333-333333333333'};return true;}
      shared(){return this.memory;}
      receiptCount(){return [...this.receipts.values()].filter(r=>r.memory).length;}
    }
    export class TestVault extends HearthsideVault {
      constructor(ctx,env){const gate={};const b=env.MEDIA,room=()=>env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-MEMORY'));
        super(ctx,{LEDGER_ROOMS:env.LEDGER_ROOMS,HEARTHSIDE_VAULT_MEDIA:{get:key=>b.get(key),head:key=>b.head(key),delete:key=>b.delete(key),put:async(key,value,options)=>{
          const result=await b.put(key,value,options);if(key.endsWith('/copy-late')){gate.started=true;gate.notify?.();await new Promise(resolve=>gate.finish=resolve);}return result;
        }},HEARTHSIDE_VAULT_AUTHORITY:{
          policy:async(scope,input)=>{const roster=await room().roster();const author=roster.find(p=>p.memberId===scope.memberId&&p.subject===scope.subject);if(!author)throw Error('FORBIDDEN');
            return {recipients:input.recipientMemberIds.map(id=>roster.find(p=>p.memberId===id)),approvers:input.kind==='shared-memory'?roster:[author]};},
          accept:(scope,ref)=>room().acceptVaultPublication(scope,ref),isReferenced:(scope,id)=>room().vaultMediaReferenced(scope,id)}});this.gate=gate;
      }
      waitForCopy(){return this.gate.started?true:new Promise(resolve=>this.gate.notify=()=>resolve(true));}
      finishCopy(){this.gate.finish?.();return true;}
    }
    export default {async fetch(request,env){
      const [target,action]=new URL(request.url).pathname.slice(1).split('/');const memberId=request.headers.get('X-Member')||'MEM-A';
      const scope={environment:'development',householdId:'HH-MEMORY',memberId,subject:request.headers.get('X-Subject')||principals.find(p=>p.memberId===memberId).subject,role:'owner',aclEpoch:1,expires:Date.now()+60000};
      const vault=env.VAULTS.get(env.VAULTS.idFromName('development/HH-MEMORY')),root=env.LEDGER_ROOMS.get(env.LEDGER_ROOMS.idFromName('development/HH-MEMORY'));
      try{
        if(target==='root'){const value=await request.json();if(action==='compose')return Response.json(await root.compose(scope,value));if(action==='keep')return Response.json(await root.keep(scope));if(action==='control')return Response.json(await root.control(value));if(action==='shared')return Response.json(await root.shared());if(action==='count')return Response.json(await root.receiptCount());}
        if(action==='command')return Response.json(await vault.commandFor(scope,await request.json(),true,'transient-memory-token'));
        if(action==='upload')return Response.json(await vault.uploadFor(scope,'voice',new Uint8Array(await request.arrayBuffer()),'audio/ogg'));
        if(action==='media'){const value=await request.json();return await vault.mediaFor(scope,value.id,value.publicationId??null,value.mode??'active');}
        if(action==='wait')return Response.json(await vault.waitForCopy());if(action==='finish')return Response.json(await vault.finishCopy());
        return new Response('',{status:404});
      }catch(error){return Response.json({code:error.message},{status:409});}
    }};
  ` }, bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', external: ['cloudflare:*', 'node:*'] });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-08-27', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { VAULTS: { className: 'TestVault', useSQLite: true }, LEDGER_ROOMS: { className: 'ReferenceRoom', useSQLite: true } }, r2Buckets: ['MEDIA'] }));
  const call = (path: string, body: unknown, member = 'MEM-A', subject?: string) => mf.dispatchFetch(`http://localhost/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Member': member, ...(subject ? { 'X-Subject': subject } : {}) }, body: JSON.stringify(body),
  });
  const command = (body: unknown, member = 'MEM-A') => call('vault/command', body, member);
  const bytes = new TextEncoder().encode('OggSprivate-voice-for-an-explicit-copy');
  try {
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    expect((await command({ operation: 'prepare-media', input: { id: 'voice', sha256, byteLength: bytes.length, contentType: 'audio/ogg' } })).status).toBe(200);
    expect((await mf.dispatchFetch('http://localhost/vault/upload', { method: 'POST', body: bytes })).status).toBe(200);
    await command({ operation: 'save-draft', input: { id: 'private-draft', expectedRevision: 0, content: { title: 'For you', text: 'Private source words', mediaIds: ['voice'] } } });
    const letter = async (id: string) => {
      const review = await (await command({ operation: 'prepare-publication', input: { id, draftId: 'private-draft', draftRevision: 1, kind: 'letter', releaseAt: null, recipientMemberIds: ['MEM-B'] } })).json() as { digest: string };
      expect((await command({ operation: 'approve', id, digest: review.digest })).status).toBe(200);
      expect((await command({ operation: 'activate', id })).status).toBe(200);
    };
    await letter('source-letter'); await letter('late-letter');
    expect((await command({ operation: 'copy-media', input: { id: 'copy-bob', sourceMediaId: 'voice', sourcePublicationId: 'source-letter' } }, 'MEM-B')).status).toBe(200);
    const copying = command({ operation: 'copy-media', input: { id: 'copy-late', sourceMediaId: 'voice', sourcePublicationId: 'late-letter' } }, 'MEM-B');
    await call('vault/wait', null);
    expect((await command({ operation: 'withdraw', id: 'late-letter' })).status).toBe(200);
    await call('vault/finish', null);
    expect(await (await copying).json()).toEqual({ code: 'NOT_FOUND' });
    expect(await (await call('vault/media', { id: 'copy-late' }, 'MEM-B')).json()).toEqual({ code: 'MEDIA_UNAVAILABLE' });
    await command({ operation: 'withdraw', id: 'source-letter' });
    await command({ operation: 'delete-draft', input: { id: 'private-draft', expectedRevision: 1 } });
    expect((await command({ operation: 'copy-media', input: { id: 'copy-bob', sourceMediaId: 'voice', sourcePublicationId: 'source-letter' } }, 'MEM-B')).status).toBe(200);
    expect((await call('vault/media', { id: 'copy-bob' }, 'MEM-A')).status).toBe(409);

    const memory = candidate();
    const prepared = await command({ operation: 'prepare-memory', input: { id: 'shared-copy', expectedRevision: 0, candidate: memory, recipientMemberIds: ['MEM-A', 'MEM-B'] } }, 'MEM-B');
    expect(prepared.status, await prepared.clone().text()).toBe(200);
    const review = await prepared.json() as { digest: string; binding: MemoryPublicationBinding };
    expect(await (await command({ operation: 'review-memory', id: 'shared-copy' }, 'MEM-A')).json()).toEqual({ code: 'MEMORY_CHANGED' });
    expect(await (await call('root/compose', { ...memory, title: 'Spoofed caption', publication: review.binding }, 'MEM-B')).json()).toEqual({ code: 'COMPOSITION_CHANGED' });
    expect((await call('root/compose', { ...memory, publication: review.binding }, 'MEM-B')).status).toBe(200);
    const anotherRecollection = { ...memory, revision: 2, recollections: [...memory.recollections, { memberId: 'MEM-A', text: 'These words are mine to add.' }] };
    const pendingRevision = await command({ operation: 'prepare-memory', input: { id: 'next-shared-copy', expectedRevision: 1,
      candidate: anotherRecollection, recipientMemberIds: ['MEM-A', 'MEM-B'], sourcePublicationId: 'shared-copy' } }, 'MEM-A');
    expect(pendingRevision.status, await pendingRevision.clone().text()).toBe(200);
    expect((await call('vault/media', { id: 'copy-bob' }, 'MEM-A')).status).toBe(409); // no private-copy grant
    expect(await (await call('root/keep', null, 'MEM-A')).json()).toEqual({ code: 'APPROVAL_REQUIRED' });
    expect((await call('vault/media', { id: 'copy-bob', publicationId: 'shared-copy', mode: 'review' }, 'MEM-A')).status).toBe(200);
    expect((await call('vault/media', { id: 'copy-bob', publicationId: 'shared-copy' }, 'MEM-A')).status).toBe(409);
    for (const member of ['MEM-A', 'MEM-B']) {
      const exact = await command({ operation: 'review-memory', id: 'shared-copy' }, member);
      expect(exact.status).toBe(200); expect(await exact.text()).not.toContain('source-letter');
      expect((await command({ operation: 'approve', id: 'shared-copy', digest: review.digest }, member)).status).toBe(200);
      expect((await call('root/keep', null, member)).status).toBe(200);
    }
    await call('root/control', 'lose-acceptance');
    expect((await command({ operation: 'activate', id: 'shared-copy' }, 'MEM-B')).status).toBe(409);
    const activated = await command({ operation: 'activate', id: 'shared-copy' }, 'MEM-B');
    expect(await activated.json()).toMatchObject({ state: 'active', acceptedReceiptId: 'canonical-shared-copy' });
    expect(await (await call('root/count', null)).json()).toBe(1);
    expect(new Uint8Array(await (await call('vault/media', { id: 'copy-bob', publicationId: 'shared-copy' }, 'MEM-A')).arrayBuffer())).toEqual(bytes);
    const shared = await (await call('root/shared', null)).text();
    expect(shared).not.toContain('source-letter'); expect(shared).not.toContain('11111111-1111'); expect(shared).not.toContain('Private source words');

    await call('root/control', 'caption');
    expect(await (await call('vault/media', { id: 'copy-bob', publicationId: 'shared-copy' }, 'MEM-A')).json()).toEqual({ code: 'MEMORY_CHANGED' });
    expect(await (await command({ operation: 'review-memory', id: 'shared-copy' }, 'MEM-A')).json()).toEqual({ code: 'MEMORY_CHANGED' });
    await call('root/control', 'replace-alice');
    expect(await (await command({ operation: 'activate', id: 'shared-copy' }, 'MEM-B')).json()).toEqual({ code: 'AUDIENCE_CHANGED' });
    expect((await call('vault/media', { id: 'copy-bob', publicationId: 'shared-copy' }, 'MEM-A', '33333333-3333-4333-a333-333333333333')).status).toBe(409);
    expect((await command({ operation: 'withdraw', id: 'shared-copy' }, 'MEM-B')).status).toBe(200);
    expect(await (await command({ operation: 'review-memory', id: 'shared-copy' }, 'MEM-B')).json()).toEqual({ code: 'NOT_FOUND' });
    expect((await call('vault/media', { id: 'copy-bob' }, 'MEM-B')).status).toBe(200);
  } finally { await mf.dispose(); }
}, 90_000);
