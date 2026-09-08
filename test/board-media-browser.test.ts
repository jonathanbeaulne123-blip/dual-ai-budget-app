import { afterAll, beforeAll, expect, it } from 'vitest';
import { chromium, type Browser } from '@playwright/test';
import { build } from 'esbuild';
import { createServer, type Server } from 'node:http';
import type * as API from '../src/boardMedia';

declare global { interface Window { BoardMedia: typeof API } }
let browser: Browser;
let server: Server;
let origin: string;
beforeAll(async () => {
  const built = await build({ entryPoints: ['src/boardMedia/index.ts'], bundle: true, write: false, format: 'iife', globalName: 'BoardMedia', platform: 'browser' });
  const script = built.outputFiles[0]!.text;
  server = createServer((req, res) => {
    res.setHeader('Content-Type', req.url === '/client.js' ? 'text/javascript' : 'text/html');
    res.end(req.url === '/client.js' ? script : '<!doctype html><script src="/client.js"></script>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing local test port');
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
}, 60_000);
afterAll(async () => {
  await browser?.close();
  await new Promise<void>(resolve => server ? server.close(() => resolve()) : resolve());
});

it('real canvas handles JPEG/PNG/WebP, strips metadata, scales to 1600 and refuses unsupported/oversize sources', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const result = await page.evaluate(async () => {
      const { prepareBoardPhoto, SOURCE_MAX_BYTES } = window.BoardMedia;
      const canvas = document.createElement('canvas'); canvas.width = 3200; canvas.height = 1600;
      canvas.getContext('2d')!.fillRect(0, 0, canvas.width, canvas.height);
      const types = [];
      for (const mime of ['image/jpeg', 'image/png', 'image/webp']) {
        let source = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), mime));
        if (mime === 'image/jpeg') {
          const bytes = new Uint8Array(await source.arrayBuffer());
          const metadata = new TextEncoder().encode('Exif\0\0synthetic-private-caption');
          source = new Blob([bytes.slice(0, 2), new Uint8Array([255, 225, 0, metadata.length + 2]), metadata, bytes.slice(2)], { type: mime });
        }
        const prepared = await prepareBoardPhoto(source);
        const bytes = new Uint8Array(await prepared.blob.arrayBuffer());
        types.push({ width: prepared.width, height: prepared.height, type: prepared.blob.type, size: prepared.blob.size, hasExif: /Exif|synthetic-private-caption|ICC_PROFILE/.test(new TextDecoder().decode(bytes)) });
      }
      const fail = async (blob: Blob) => { try { await prepareBoardPhoto(blob); return 'unexpected'; } catch (e) { return (e as API.BoardMediaError).code; } };
      return { types, gif: await fail(new Blob(['GIF89a'], { type: 'image/gif' })), heic: await fail(new Blob(['heic'], { type: 'image/heic' })), tooLarge: await fail(new Blob([new Uint8Array(SOURCE_MAX_BYTES + 1)], { type: 'image/jpeg' })), spoof: await fail(new Blob(['not a png'], { type: 'image/png' })) };
    });
    expect(result.types).toHaveLength(3);
    for (const image of result.types) { expect(image).toMatchObject({ width: 1600, height: 800, type: 'image/jpeg', hasExif: false }); expect(image.size).toBeLessThanOrEqual(2 * 1024 * 1024); }
    expect(result).toMatchObject({ gif: 'UNSUPPORTED_IMAGE', heic: 'UNSUPPORTED_IMAGE', tooLarge: 'SOURCE_TOO_LARGE', spoof: 'UNSUPPORTED_IMAGE' });
  } finally { await page.close(); }
}, 60_000);

it('real IndexedDB survives reload/offline, partitions all four scope fields, retains intent until accepted and never stores tokens', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const pendingId = await page.evaluate(async () => {
      const { createBoardMediaClient } = window.BoardMedia;
      const scope = { environment: 'development' as const, householdId: 'HH-ONE', actorId: 'MEM-ONE', authIdentity: 'auth-one', accessToken: 'never-persist-me', unknown: { refreshToken: 'never-persist-me' } };
      const client = createBoardMediaClient({ scope, isCurrent: () => true, getSession: async () => ({ ...scope, accessToken: 'never-persist-me' }), fetch: async () => { throw new Error('offline'); } });
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 8;
      const file = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
      const intent = { slot: 2 as const, caption: 'A synthetic memory', crop: { x: .5, y: .5, zoom: 1, accessToken: 'never-persist-me' }, expectedVersion: 4, accessToken: 'never-persist-me', unknown: { refreshToken: 'never-persist-me' } };
      try { await client.uploadBoardPhoto(file, intent); }
      catch (e) { if ((e as API.BoardMediaError).code !== 'NETWORK_UNAVAILABLE') throw e; }
      const pending = await client.listPendingBoardPhotos();
      if (pending.length !== 1 || pending[0]!.status !== 'queued' || pending[0]!.lastError !== 'NETWORK_UNAVAILABLE') throw new Error('Offline queue lost');
      return pending[0]!.pendingId;
    });
    await page.reload();
    const result = await page.evaluate(async (id) => {
      const { createBoardMediaClient, IndexedDbBoardPhotoStore } = window.BoardMedia;
      const scope = { environment: 'development' as const, householdId: 'HH-ONE', actorId: 'MEM-ONE', authIdentity: 'auth-one' };
      const store = new IndexedDbBoardPhotoStore();
      let uploads = 0;
      const client = createBoardMediaClient({ scope, isCurrent: () => true, getSession: async () => ({ ...scope, accessToken: 'refreshed-token' }), fetch: async (_url, init) => {
        uploads++;
        const pending = (await store.get(scope, id))!;
        if (new Headers(init!.headers).get('Authorization') !== 'Bearer refreshed-token') throw new Error('stale token');
        return Response.json({ mediaId: pending.mediaId, contentType: pending.contentType, width: pending.width, height: pending.height, byteLength: pending.byteLength });
      } });
      const recovered = (await client.listPendingBoardPhotos())[0]!;
      const deniedCounts = await Promise.all([
        { ...scope, environment: 'production' as const }, { ...scope, householdId: 'HH-TWO' }, { ...scope, actorId: 'MEM-TWO' }, { ...scope, authIdentity: 'auth-two' },
      ].map(s => store.list(s).then(rows => rows.length)));
      const raw = await store.get(scope, id);
      const rawKeys = Object.keys(raw!).sort();
      const concurrent = await Promise.all([client.retryPendingBoardPhoto(id), client.retryPendingBoardPhoto(id)]);
      const stillPending = await client.listPendingBoardPhotos();
      await client.retryPendingBoardPhoto(id);
      await client.acknowledgeBoardPhoto(id);
      const afterAck = await client.listPendingBoardPhotos();
      return { intent: recovered.intent, scope: raw!.scope, deniedCounts, rawKeys, persistedSecret: JSON.stringify(raw).includes('never-persist-me'), uploads, sameRefs: concurrent[0]!.mediaId === concurrent[1]!.mediaId, status: stillPending[0]!.status, afterAck: afterAck.length };
    }, pendingId);
    expect(result).toMatchObject({ intent: { slot: 2, caption: 'A synthetic memory', crop: { x: .5, y: .5, zoom: 1 }, expectedVersion: 4 }, deniedCounts: [0,0,0,0], persistedSecret: false, uploads: 1, sameRefs: true, status: 'uploaded', afterAck: 0 });
    expect(result.rawKeys).not.toContain('accessToken');
    expect(result.scope).toEqual({ environment: 'development', householdId: 'HH-ONE', actorId: 'MEM-ONE', authIdentity: 'auth-one' });
    expect(result.intent).toEqual({ slot: 2, caption: 'A synthetic memory', crop: { x: .5, y: .5, zoom: 1 }, expectedVersion: 4 });
  } finally { await page.close(); }
}, 60_000);

it('discard and room/auth changes fence late network outcomes; discard persists and a queued image cannot be acknowledged early', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const results = await page.evaluate(async () => {
      const { createBoardMediaClient, IndexedDbBoardPhotoStore } = window.BoardMedia;
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 8;
      const file = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
      const results = [];
      for (const scenario of ['discard', 'other-tab-discard', 'room', 'auth', 'dispose-aba']) {
        const scope = { environment: 'development' as const, householdId: `HH-${scenario}`, actorId: 'MEM-ONE', authIdentity: 'auth-one' };
        let current = true; let identity = scope.authIdentity;
        let finish!: (value: Response) => void, started!: () => void;
        const waiting = new Promise<void>(resolve => { started = resolve; });
        const client = createBoardMediaClient({ scope, isCurrent: () => current, getSession: async () => ({ ...scope, authIdentity: identity, accessToken: 'token' }), fetch: async () => { started(); return new Promise<Response>(resolve => { finish = resolve; }); } });
        const p = await client.queueBoardPhoto(file);
        await client.acknowledgeBoardPhoto(p.pendingId);
        if ((await client.listPendingBoardPhotos()).length !== 1) throw new Error('Premature ack lost draft');
        const outcome = client.retryPendingBoardPhoto(p.pendingId).then(() => 'leaked', (e: API.BoardMediaError) => e.code);
        await waiting;
        if (scenario === 'discard') await client.discardPendingBoardPhoto(p.pendingId);
        if (scenario === 'other-tab-discard') await new IndexedDbBoardPhotoStore().remove(scope, p.pendingId);
        if (scenario === 'room') current = false;
        if (scenario === 'auth') identity = 'auth-two';
        if (scenario === 'dispose-aba') { client.dispose(); current = true; }
        finish(Response.json({ mediaId: p.mediaId, contentType: p.contentType, width: p.width, height: p.height, byteLength: p.byteLength }));
        const code = await outcome;
        const stored = await new IndexedDbBoardPhotoStore().get(scope, p.pendingId);
        results.push({ scenario, code, status: stored?.status ?? 'absent' });
      }
      return results;
    });
    expect(results).toEqual([
      { scenario: 'discard', code: 'PENDING_NOT_FOUND', status: 'absent' },
      { scenario: 'other-tab-discard', code: 'PENDING_NOT_FOUND', status: 'absent' },
      { scenario: 'room', code: 'STALE_SCOPE', status: 'queued' },
      { scenario: 'auth', code: 'AUTH_CHANGED', status: 'queued' },
      { scenario: 'dispose-aba', code: 'STALE_SCOPE', status: 'queued' },
    ]);
    await page.reload();
    const count = await page.evaluate(async () => (await new window.BoardMedia.IndexedDbBoardPhotoStore().list({ environment: 'development', householdId: 'HH-discard', actorId: 'MEM-ONE', authIdentity: 'auth-one' })).length);
    expect(count).toBe(0);
  } finally { await page.close(); }
}, 60_000);

it('authenticated reads return only bounded current-scope blobs; unavailable storage prevents any upload', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const result = await page.evaluate(async () => {
      const { createBoardMediaClient, prepareBoardPhoto, IndexedDbBoardPhotoStore, DISPLAY_MAX_BYTES } = window.BoardMedia;
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 8;
      const source = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), 'image/png'));
      const { blob } = await prepareBoardPhoto(source);
      const scope = { environment: 'development' as const, householdId: 'HH-READ', actorId: 'MEM-ONE', authIdentity: 'auth-one' };
      const mediaId = 'BM-a3b6c16d-73a1-4d2e-9c15-e6af8485d39e';
      const attempts = [];
      for (const scenario of ['valid', 'oversize', 'wrong-mime', 'late', 'production']) {
        let current = true;
        let requests = 0;
        const client = createBoardMediaClient({ scope: scenario === 'production' ? { ...scope, environment: 'production' } : scope, getSession: async () => ({ ...scope, accessToken: 'current-token' }), isCurrent: () => current, fetch: async (url, init) => {
          requests++;
          if (url !== `/api/board-media/development/HH-READ/${mediaId}` || new Headers(init?.headers).get('X-Board-Identity') !== scope.authIdentity) throw new Error('wrong read scope');
          if (scenario === 'late') current = false;
          if (scenario === 'oversize') return new Response(new Uint8Array(DISPLAY_MAX_BYTES + 1), { headers: { 'Content-Type': 'image/jpeg' } });
          return new Response(blob, { headers: { 'Content-Type': scenario === 'wrong-mime' ? 'text/html' : 'image/jpeg' } });
        } });
        const outcome = await client.getBoardPhoto(mediaId).then(photo => photo.type, (error: API.BoardMediaError) => error.code);
        attempts.push({ scenario, outcome, requests });
      }
      let uploaded = false;
      Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: undefined });
      const client = createBoardMediaClient({ scope, getSession: async () => ({ ...scope, accessToken: 'token' }), isCurrent: () => true, store: new IndexedDbBoardPhotoStore(), fetch: async () => { uploaded = true; return new Response(); } });
      const storageFailure = await client.uploadBoardPhoto(source).then(() => 'leaked', (error: API.BoardMediaError) => error.code);
      return { attempts, uploaded, storageFailure };
    });
    expect(result.attempts).toEqual([
      { scenario: 'valid', outcome: 'image/jpeg', requests: 1 },
      { scenario: 'oversize', outcome: 'INVALID_RESPONSE', requests: 1 },
      { scenario: 'wrong-mime', outcome: 'INVALID_RESPONSE', requests: 1 },
      { scenario: 'late', outcome: 'STALE_SCOPE', requests: 1 },
      { scenario: 'production', outcome: 'ENVIRONMENT_DISABLED', requests: 0 },
    ]);
    expect(result).toMatchObject({ uploaded: false, storageFailure: 'LOCAL_STORAGE_UNAVAILABLE' });
  } finally { await page.close(); }
}, 60_000);

it('client physical deletion explicitly rejects without auth or network', async () => {
  const page = await browser.newPage();
  try {
    await page.goto(origin);
    const result = await page.evaluate(async () => {
      let authCalls = 0; let requests = 0;
      const scope = { environment: 'development' as const, householdId: 'HH-DELETE', actorId: 'MEM-ONE', authIdentity: 'auth-one' };
      const client = window.BoardMedia.createBoardMediaClient({ scope, isCurrent: () => true,
        getSession: async () => { authCalls++; return { ...scope, accessToken: 'token' }; },
        fetch: async () => { requests++; return new Response(null, { status: 204 }); },
      });
      const code = await client.deleteBoardPhoto('BM-00000000-0000-4000-8000-000000000000').then(() => 'unexpected', (error: API.BoardMediaError) => error.code);
      return { code, authCalls, requests };
    });
    expect(result).toEqual({ code: 'PHYSICAL_DELETE_DISABLED', authCalls: 0, requests: 0 });
  } finally { await page.close(); }
});
