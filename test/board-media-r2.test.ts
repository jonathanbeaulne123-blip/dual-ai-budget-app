import { expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { jpeg, mediaId } from './fixtures/boardMedia';

it('actual local R2 conditional upload is immutable/idempotent and deletion cannot resurrect it', async () => {
  const bundle = await build({ stdin: { contents: "import {handleBoardMedia} from './workers/boardMedia'; export default {fetch:handleBoardMedia}", resolveDir: process.cwd() }, bundle: true, write: false, platform: 'browser', external: ['node:*'], format: 'esm', target: 'es2022' });
  const mf = new Miniflare(convertV4MiniflareOptions({ modules: true, script: bundle.outputFiles[0]!.text, compatibilityDate: '2026-08-21', r2Buckets: ['BOARD_MEDIA'], bindings: { SUPABASE_URL: 'https://unused.invalid', SUPABASE_PUBLISHABLE_KEY: 'synthetic', LEDGER_SYNC_LOCAL_AUTH: 'true' } }));
  try {
    const url = `http://localhost/api/board-media/development/HH-TEST/${mediaId}`;
    const headers = { Authorization: 'Bearer local:MEM-ONE', 'X-Board-Actor': 'MEM-ONE', 'X-Board-Identity': 'local:MEM-ONE', 'Content-Type': 'image/jpeg' };
    const body = await jpeg();
    const outcomes = await Promise.all([1, 2].map(() => mf.dispatchFetch(url, { method: 'PUT', headers, body })));
    expect(outcomes.map(r => r.status).sort()).toEqual([200, 201]);
    expect((await mf.dispatchFetch(url, { method: 'PUT', headers, body: await jpeg(12, 8, '#ff0000') })).status).toBe(409);
    const read = await mf.dispatchFetch(url, { headers });
    expect(new Uint8Array(await read.arrayBuffer())).toEqual(body);
    expect((await mf.dispatchFetch(url, { headers, method: 'DELETE' })).status).toBe(204);
    expect((await mf.dispatchFetch(url, { headers, method: 'PUT', body })).status).toBe(409);
    expect((await mf.dispatchFetch(url, { headers })).status).toBe(404);
    const bucket = await mf.getR2Bucket('BOARD_MEDIA');
    expect((await bucket.head(`v1/development/HH-TEST/${mediaId}`))?.size).toBe(0);
  } finally { await mf.dispose(); }
}, 60_000);
