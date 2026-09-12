import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';

it('runs private drafts, recipient letters, immutable R2 upload and revocation through actual SQLite DO RPC', async () => {
  const bundle = await build({ stdin: { resolveDir: process.cwd(), contents: `
    import {HearthsideVault,handleHearthsideVault} from './workers/hearthsideVault.ts';
    export class TestVault extends HearthsideVault {
      constructor(ctx,env) { super(ctx,{...env,HEARTHSIDE_VAULT_AUTHORITY:{
        policy:async(scope,input)=>({recipients:input.recipientMemberIds.map(memberId=>({memberId,subject:'local:'+memberId})),approvers:[{memberId:scope.memberId,subject:scope.subject}]}),
        accept:async(scope,reference)=>({...reference,receiptId:'receipt-'+reference.publicationId,acceptedAt:1000}),
        isReferenced:async()=>false
      }}); }
    }
    export default {fetch:handleHearthsideVault};
  ` }, bundle: true, write: false, platform: 'browser', external: ['cloudflare:*', 'node:*'], format: 'esm', target: 'es2022' });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0]!.text,
    // Match the repository's pinned local workerd ceiling; this is not deployment config.
    compatibilityDate: '2026-08-27', compatibilityFlags: ['nodejs_compat'],
    durableObjects: { HEARTHSIDE_VAULTS: { className: 'TestVault', useSQLite: true } }, r2Buckets: ['HEARTHSIDE_VAULT_MEDIA'],
    bindings: { HEARTHSIDE_VAULT_ENABLED: 'true', HEARTHSIDE_VAULT_PUBLICATION: 'true',
      LEDGER_SYNC_LOCAL_AUTH: 'true', SUPABASE_URL: 'http://127.0.0.1:1', SUPABASE_PUBLISHABLE_KEY: 'synthetic' },
  }));
  const path = 'http://localhost/api/hearthside-vault/development/HH-VAULT';
  const headers = (memberId: string) => ({ Authorization: `Bearer local:${memberId}`, 'X-Vault-Actor': memberId, 'X-Vault-Identity': `local:${memberId}`, 'Content-Type': 'application/json' });
  const command = (input: unknown, actor = 'MEM-A') => mf.dispatchFetch(path, { method: 'POST', headers: headers(actor), body: JSON.stringify(input) });
  try {
    const bytes = new TextEncoder().encode('OggSsynthetic-audio');
    const sha256 = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
    expect((await command({ operation: 'prepare-media', input: { id: 'voice', byteLength: bytes.byteLength, sha256, contentType: 'audio/ogg' } })).status).toBe(200);
    const upload = () => mf.dispatchFetch(path + '/media/voice', { method: 'PUT', headers: { ...headers('MEM-A'), 'Content-Type': 'audio/ogg' }, body: bytes });
    const uploaded = await Promise.all([upload(), upload()]);
    expect(uploaded.map(r => r.status)).toEqual([200, 200]);
    expect((await mf.dispatchFetch(path + '/media/voice', { headers: headers('MEM-B') })).status).toBe(404);
    expect((await command({ operation: 'save-draft', input: { id: 'draft', expectedRevision: 0, content: { title: 'Evening', text: 'Private words', mediaIds: ['voice'] } } })).status).toBe(200);
    const otherSnapshot = await mf.dispatchFetch(path, { headers: headers('MEM-B') });
    expect(await otherSnapshot.json()).toEqual({ version: 1, drafts: [], publications: [], mail: [], serverTime: expect.any(Number) });
    const prepared = await command({ operation: 'prepare-publication', input: { id: 'letter', draftId: 'draft', draftRevision: 1, kind: 'letter', recipientMemberIds: ['MEM-B'], releaseAt: null } });
    expect(prepared.status).toBe(200);
    const review = await prepared.json() as { digest: string };
    expect((await command({ operation: 'read-publication', id: 'letter' }, 'MEM-B')).status).toBe(404);
    expect((await command({ operation: 'approve', id: 'letter', digest: review.digest })).status).toBe(200);
    const activation = await command({ operation: 'activate', id: 'letter' });
    expect(activation.status, await activation.text()).toBe(200);
    expect((await command({ operation: 'read-publication', id: 'letter' }, 'MEM-C')).status).toBe(404);
    const read = await command({ operation: 'read-publication', id: 'letter' }, 'MEM-B');
    expect(read.status).toBe(200); expect(await read.text()).toContain('Private words');
    const sharedAudio = await mf.dispatchFetch(path + '/media/voice', { headers: { ...headers('MEM-B'), 'X-Vault-Publication': 'letter' } });
    expect(new Uint8Array(await sharedAudio.arrayBuffer())).toEqual(bytes);
    expect(sharedAudio.headers.get('cache-control')).toBe('private, no-store');
    expect((await command({ operation: 'withdraw', id: 'letter' })).status).toBe(200);
    expect((await mf.dispatchFetch(path + '/media/voice', { headers: { ...headers('MEM-B'), 'X-Vault-Publication': 'letter' } })).status).toBe(404);
    expect((await command({ operation: 'activate', id: 'letter' })).status).toBe(409);
    const bucket = await mf.getR2Bucket('HEARTHSIDE_VAULT_MEDIA');
    expect((await bucket.head('vault-v1/development/HH-VAULT/voice'))?.size).toBe(bytes.byteLength);
  } finally { await mf.dispose(); }
}, 60_000);
