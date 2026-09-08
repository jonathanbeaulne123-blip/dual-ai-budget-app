import { afterEach, describe, expect, it, vi } from 'vitest';
import type { R2Bucket, R2Object, R2ObjectBody, R2PutOptions } from '@cloudflare/workers-types';
import { handleBoardMedia } from '../workers/boardMedia';
import { DISPLAY_MAX_BYTES } from '../src/boardMedia/types';
import { jpeg, mediaId } from './fixtures/boardMedia';

function bucket() {
  const objects = new Map<string, { bytes: Uint8Array; options?: R2PutOptions }>();
  // The integration test below uses actual workerd R2; this unit double exposes scope calls.
  const store = {
    put: vi.fn(async (key: string, value: Uint8Array, options?: R2PutOptions) => {
      if (options?.onlyIf && objects.has(key)) return null;
      objects.set(key, { bytes: value, options });
      return { size: value.length, customMetadata: options?.customMetadata } as R2Object;
    }),
    head: vi.fn(async (key: string) => {
      const v = objects.get(key);
      return v ? { size: v.bytes.length, customMetadata: v.options?.customMetadata } as R2Object : null;
    }),
    get: vi.fn(async (key: string) => {
      const v = objects.get(key);
      return v ? { size: v.bytes.length, customMetadata: v.options?.customMetadata, body: new Blob([new Uint8Array(v.bytes)]).stream() } as R2ObjectBody : null;
    }),
  };
  return { objects, store, binding: store as Pick<R2Bucket, 'put' | 'head' | 'get'> as R2Bucket };
}
vi.mock('../workers/ledgerRoom.ts', () => ({ LedgerRoom: class {} }));
const authEnv = { SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic-publishable', LEDGER_SYNC_LOCAL_AUTH: 'true' };
function req(method = 'GET', body?: Uint8Array<ArrayBuffer>, extra: Record<string,string> = {}, path = `/api/board-media/development/HH-ONE/${mediaId}`) {
  return new Request(`http://localhost${path}`, { method, headers: { Authorization: 'Bearer local:MEM-ONE', 'X-Board-Actor': 'MEM-ONE', 'X-Board-Identity': 'local:MEM-ONE', ...(body ? { 'Content-Type': 'image/jpeg' } : {}), ...extra }, body });
}
afterEach(() => vi.unstubAllGlobals());
describe('private board photo Worker', () => {
  it('does not intercept unrelated paths, and dispatches before static assets', async () => {
    expect(await handleBoardMedia(new Request('http://localhost/something'), authEnv)).toBeNull();
    const { default: site } = await import('../workers/site.js');
    const assets = { fetch: vi.fn() };
    expect((await site.fetch(req(), { ...authEnv, ASSETS: assets })).status).toBe(503);
    expect(assets.fetch).not.toHaveBeenCalled();
  });
  it('denies missing credentials, actor/identity mismatch and invalid scope before bucket access', async () => {
    const b = bucket();
    const env = { ...authEnv, BOARD_MEDIA: b.binding };
    for (const [request, status] of [
      [req('GET', undefined, { Authorization: '' }), 401],
      [req('GET', undefined, { 'X-Board-Actor': 'MEM-OTHER' }), 403],
      [req('GET', undefined, { 'X-Board-Identity': 'another-user' }), 403],
      [req('GET', undefined, {}, '/api/board-media/development/OTHER/nope'), 400],
      [req('GET', undefined, {}, `/api/board-media/development/HH-ONE/${mediaId}?token=secret`), 400],
    ] as const) expect((await handleBoardMedia(request, env))?.status).toBe(status);
    expect(b.store.get).not.toHaveBeenCalled(); expect(b.store.put).not.toHaveBeenCalled();
  });
  it('requires live membership for reads; another active household member can read, revoked member cannot', async () => {
    const b = bucket(); const env = { ...authEnv, LEDGER_SYNC_LOCAL_AUTH: 'false', BOARD_MEDIA: b.binding };
    const control = vi.fn().mockResolvedValue(Response.json({ subject: 'auth-two', memberId: 'MEM-TWO', role: 'member', members: [{ id: 'MEM-TWO' }] }));
    vi.stubGlobal('fetch', control);
    const request = () => req('GET', undefined, { Authorization: 'Bearer signed-token', 'X-Board-Actor': 'MEM-TWO', 'X-Board-Identity': 'auth-two' });
    expect((await handleBoardMedia(request(), env))?.status).toBe(404);
    expect(control.mock.calls[0]?.[0]).toBe('https://auth.example.test/rest/v1/rpc/ledger_sync_scope');
    expect(JSON.parse(control.mock.calls[0]?.[1].body)).toEqual({ p_environment: 'development', p_household_id: 'HH-ONE' });
    control.mockResolvedValueOnce(Response.json({ members: [] }));
    expect((await handleBoardMedia(request(), env))?.status).toBe(403);
    control.mockResolvedValueOnce(new Response(null, { status: 401 }));
    expect((await handleBoardMedia(request(), env))?.status).toBe(401);
    expect(b.store.get).toHaveBeenCalledTimes(1);
  });
  it('refuses Production and missing dedicated binding without touching evidence/archive buckets', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ subject: 'user', memberId: 'MEM-ONE', members: [] })));
    const prod = req('GET', undefined, { Authorization: 'Bearer jwt', 'X-Board-Identity': 'user' }, `/api/board-media/production/HH-ONE/${mediaId}`);
    expect((await handleBoardMedia(prod, authEnv))?.status).toBe(403);
    const unavailable = await handleBoardMedia(req(), { ...authEnv, ...{ EVIDENCE_RAW: bucket().binding, LEDGER_ARCHIVE: bucket().binding } });
    expect(unavailable?.status).toBe(503);
    expect(await unavailable?.text()).toContain('dedicated Development BOARD_MEDIA');
  });
  it('validates MIME, actual bytes, dimensions, metadata and both declared/actual bounds', async () => {
    const b = bucket(); const env = { ...authEnv, BOARD_MEDIA: b.binding }; const valid = await jpeg();
    const withMetadata = new Uint8Array([...valid.slice(0, 2), 255, 225, 0, 4, 1, 2, ...valid.slice(2)]);
    for (const [request, status] of [
      [req('PUT', valid, { 'Content-Type': 'image/png' }), 415],
      [req('PUT', new TextEncoder().encode('<svg/>')), 400],
      [req('PUT', await jpeg(1601, 2)), 400],
      [req('PUT', withMetadata), 400],
      [req('PUT', valid.slice(0, -2)), 400],
      [req('PUT', valid, { 'Content-Length': String(DISPLAY_MAX_BYTES + 1) }), 413],
      [req('PUT', new Uint8Array(DISPLAY_MAX_BYTES + 1), { 'Content-Length': '1' }), 413],
    ] as const) expect((await handleBoardMedia(request, env))?.status).toBe(status);
    expect(b.store.put).not.toHaveBeenCalled();
  });
  it('idempotently uploads immutable bytes, separates households, streams private reads', async () => {
    const b = bucket(); const env = { ...authEnv, BOARD_MEDIA: b.binding }; const valid = await jpeg();
    const first = await handleBoardMedia(req('PUT', valid), env);
    expect(first?.status).toBe(201);
    expect(await first?.json()).toEqual({ mediaId, contentType: 'image/jpeg', byteLength: valid.length, width: 12, height: 8 });
    expect((await handleBoardMedia(req('PUT', valid), env))?.status).toBe(200);
    expect((await handleBoardMedia(req('PUT', await jpeg(12, 8, '#000000')), env))?.status).toBe(409);
    expect((await handleBoardMedia(req('GET', undefined, {}, `/api/board-media/development/HH-TWO/${mediaId}`), env))?.status).toBe(404);
    const read = await handleBoardMedia(req('GET', undefined, { Authorization: 'Bearer local:MEM-TWO', 'X-Board-Actor': 'MEM-TWO', 'X-Board-Identity': 'local:MEM-TWO' }), env);
    expect(read?.status).toBe(200);
    expect(read?.headers.get('Cache-Control')).toBe('private, no-store');
    expect(read?.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(new Uint8Array(await read!.arrayBuffer())).toEqual(valid);
  });
  it('refuses physical DELETE without any R2 access and preserves an active photo', async () => {
    const b = bucket(); const env = { ...authEnv, BOARD_MEDIA: b.binding }; const valid = await jpeg();
    await handleBoardMedia(req('PUT', valid), env);
    for (const spy of [b.store.get, b.store.put, b.store.head]) spy.mockClear();
    for (const target of [mediaId, 'BM-00000000-0000-4000-8000-000000000000']) {
      const response = await handleBoardMedia(req('DELETE', undefined, {}, `/api/board-media/development/HH-ONE/${target}`), env);
      expect(response?.status).toBe(405);
      expect(await response?.json()).toMatchObject({ code: 'PHYSICAL_DELETE_DISABLED' });
      expect(response?.headers.get('Allow')).toBe('GET, PUT');
    }
    expect(b.store.get).not.toHaveBeenCalled();
    expect(b.store.put).not.toHaveBeenCalled();
    expect(b.store.head).not.toHaveBeenCalled();
    expect(b.objects.size).toBe(1);
    const read = await handleBoardMedia(req(), env);
    expect(read?.status).toBe(200);
    expect(new Uint8Array(await read!.arrayBuffer())).toEqual(valid);
    expect((await handleBoardMedia(req('PUT', valid), env))?.status).toBe(200);
    expect((await handleBoardMedia(req('DELETE'), authEnv))?.status).toBe(405);
  });
});
