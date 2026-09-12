import { expect, it, vi } from 'vitest';
import { HearthsideVaultClient, type VaultClientScope, type VaultPendingUpload, type VaultUploadQueue } from '../src/hearthside/vaultClient.ts';
const scope: VaultClientScope = { environment: 'development', householdId: 'HH-VAULT', memberId: 'MEM-A', subject: 'google-a' };
function queue() {
  const items = new Map<string, VaultPendingUpload>();
  const storage: VaultUploadQueue = { put: async item => { items.set(item.key, item); }, list: async () => [...items.values()], remove: async key => { items.delete(key); } };
  return { storage, items };
}
it('persists bytes before network, retains uncertain upload and reuses its identity on retry', async () => {
  const q = queue(), manifest = { id: 'audio', sha256: 'a'.repeat(64), byteLength: 4, contentType: 'audio/ogg' as const };
  let attempts = 0;
  const request = vi.fn<typeof fetch>(async (_url, init) => {
    if (init?.method === 'POST') return Response.json({ id: 'audio', status: 'pending' });
    if (++attempts === 1) throw new Error('Connection lost');
    return Response.json({ ...manifest, status: 'uploaded' });
  });
  const client = new HearthsideVaultClient(scope, async () => 'private-token', q.storage, request);
  await client.queueMedia(manifest, new Blob(['OggS'], { type: 'audio/ogg' }));
  expect(request).not.toHaveBeenCalled(); expect(q.items.size).toBe(1);
  await expect(client.resumeUploads()).rejects.toThrow('Connection lost'); expect(q.items.size).toBe(1);
  expect(await client.resumeUploads()).toEqual(['audio']); expect(q.items.size).toBe(0);
  expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT').map(([url]) => url)).toEqual([
    '/api/hearthside-vault/development/HH-VAULT/media/audio', '/api/hearthside-vault/development/HH-VAULT/media/audio']);
});
it('cancels an old A scope after A -> B -> A even if token acquisition finishes late', async () => {
  const q = queue(); let release!: (token: string) => void;
  const request = vi.fn<typeof fetch>();
  const client = new HearthsideVaultClient(scope, () => new Promise(resolve => { release = resolve; }), q.storage, request);
  const response = client.snapshot(); client.dispose(); release('new-token');
  await expect(response).rejects.toThrow('SCOPE_CHANGED'); expect(request).not.toHaveBeenCalled();
});
it('never starts upload when durable local storage fails', async () => {
  const request = vi.fn<typeof fetch>(), q = queue();
  q.storage.put = async () => { throw new Error('Quota exceeded'); };
  const client = new HearthsideVaultClient(scope, async () => 'token', q.storage, request);
  await expect(client.queueMedia({ id: 'audio', sha256: 'a'.repeat(64), byteLength: 4, contentType: 'audio/ogg' }, new Blob(['OggS'], { type: 'audio/ogg' }))).rejects.toThrow('Quota exceeded');
  expect(request).not.toHaveBeenCalled();
});
it('keeps queued bytes after invalid upload receipts and rejects another identity queue', async () => {
  const q = queue();
  const client = new HearthsideVaultClient(scope, async () => 'token', q.storage, async () => Response.json({ id: 'wrong', status: 'uploaded' }));
  await client.queueMedia({ id: 'audio', sha256: 'a'.repeat(64), byteLength: 4, contentType: 'audio/ogg' }, new Blob(['OggS'], { type: 'audio/ogg' }));
  await expect(client.resumeUploads()).rejects.toThrow('INVALID_UPLOAD_RECEIPT'); expect(q.items.size).toBe(1);
  const other = new HearthsideVaultClient({ ...scope, subject: 'other-identity' }, async () => 'token', q.storage);
  await expect(other.resumeUploads()).rejects.toThrow('SCOPE_CHANGED');
});
it('uploads only the selected draft attachments and removes discarded private queued bytes', async () => {
  const q = queue(), request = vi.fn<typeof fetch>(async (url, init) => Response.json(init?.method === 'PUT' ? { id: String(url).split('/').at(-1), sha256: 'a'.repeat(64), status: 'uploaded' } : {}));
  const client = new HearthsideVaultClient(scope, async () => 'token', q.storage, request);
  for (const id of ['one', 'two']) await client.queueMedia({ id, sha256: 'a'.repeat(64), byteLength: 4, contentType: 'audio/ogg' }, new Blob(['OggS'], { type: 'audio/ogg' }));
  expect(await client.resumeUploads(['one'])).toEqual(['one']); expect(q.items.size).toBe(1);
  await client.removeQueuedMedia(['two']); expect(q.items.size).toBe(0);
  expect(request.mock.calls.filter(([, init]) => init?.method === 'PUT')).toHaveLength(1);
});
