import { VAULT_MEDIA_LIMIT, vaultAssert, vaultId, type VaultMedia, type VaultPrincipal, type VaultScope } from './vaultContracts.ts';

export type VaultClientScope = Pick<VaultScope, 'environment' | 'householdId'> & VaultPrincipal;
export type VaultPendingUpload = { key: string; scope: VaultClientScope; manifest: Pick<VaultMedia, 'id' | 'sha256' | 'byteLength' | 'contentType'>; bytes: Blob };
export interface VaultUploadQueue {
  put(upload: VaultPendingUpload): Promise<void>;
  list(scope: VaultClientScope): Promise<VaultPendingUpload[]>;
  remove(key: string): Promise<void>;
}
const scopeKey = (scope: VaultClientScope) => JSON.stringify([scope.environment, scope.householdId, scope.memberId, scope.subject]);

/** One instance per navigation/auth generation, including A -> B -> A switches. */
export class HearthsideVaultClient {
  private readonly abort = new AbortController();
  constructor(private readonly scope: VaultClientScope, private readonly token: () => Promise<string>,
    private readonly queue: VaultUploadQueue, private readonly request: typeof fetch = fetch) {}
  dispose(): void { this.abort.abort(); }
  private live(): void { vaultAssert(!this.abort.signal.aborted, 'SCOPE_CHANGED'); }
  private async send(path: string, method: string, body?: BodyInit, extra: Record<string, string> = {}): Promise<Response> {
    this.live();
    const token = await this.token(); this.live();
    vaultAssert(!!token && !/\s/.test(token), 'UNAUTHENTICATED');
    const request = this.request;
    const response = await request(`/api/hearthside-vault/${this.scope.environment}/${this.scope.householdId}${path}`, {
      method, headers: { Authorization: `Bearer ${token}`, 'X-Vault-Actor': this.scope.memberId,
        'X-Vault-Identity': this.scope.subject, ...extra }, body, signal: this.abort.signal, cache: 'no-store', credentials: 'same-origin',
    });
    this.live();
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null); this.live();
      const code = data && typeof data === 'object' && 'code' in data && typeof data.code === 'string' ? data.code : 'VAULT_UNAVAILABLE';
      throw new Error(code);
    }
    return response;
  }
  async command(input: unknown): Promise<unknown> {
    const response = await this.send('', 'POST', JSON.stringify(input), { 'Content-Type': 'application/json' });
    const result: unknown = await response.json(); this.live(); return result;
  }
  async snapshot(): Promise<unknown> {
    const response = await this.send('', 'GET'); const result: unknown = await response.json(); this.live(); return result;
  }
  async media(id: string, publicationId?: string, mode:'active'|'review'='active'): Promise<Blob> {
    vaultAssert(mode==='active'||mode==='review','MEDIA_MODE_INVALID');
    const response = await this.send(`/media/${vaultId(id)}`, 'GET', undefined,
      {...(publicationId ? { 'X-Vault-Publication': vaultId(publicationId) } : {}),...(mode==='review'?{'X-Vault-Media-Mode':'review'}:{})});
    const blob = await response.blob(); this.live(); return blob;
  }
  async queueMedia(manifest: VaultPendingUpload['manifest'], bytes: Blob): Promise<void> {
    this.live(); vaultId(manifest.id);
    vaultAssert(bytes.size > 0 && bytes.size <= VAULT_MEDIA_LIMIT, 'MEDIA_TOO_LARGE');
    vaultAssert(bytes.size === manifest.byteLength && bytes.type === manifest.contentType, 'MEDIA_BYTES_CHANGED');
    // Persist before network. IndexedDB failure is visible and never falls back to volatile memory.
    await this.queue.put({ key: `${scopeKey(this.scope)}/${manifest.id}`, scope: this.scope, manifest, bytes }); this.live();
  }
  async resumeUploads(mediaIds?: string[]): Promise<string[]> {
    this.live();
    const pending = await this.queue.list(this.scope); this.live();
    const completed: string[] = [];
    for (const item of pending) {
      this.live(); vaultAssert(scopeKey(item.scope) === scopeKey(this.scope), 'SCOPE_CHANGED');
      if (mediaIds && !mediaIds.includes(item.manifest.id)) continue;
      await this.command({ operation: 'prepare-media', input: item.manifest });
      const response = await this.send(`/media/${vaultId(item.manifest.id)}`, 'PUT', item.bytes, { 'Content-Type': item.manifest.contentType });
      const receipt = await response.json() as Partial<VaultMedia>; this.live();
      vaultAssert(receipt.id === item.manifest.id && receipt.sha256 === item.manifest.sha256 && receipt.status === 'uploaded', 'INVALID_UPLOAD_RECEIPT');
      await this.queue.remove(item.key); this.live(); completed.push(item.manifest.id);
    }
    return completed;
  }
  async removeQueuedMedia(mediaIds: string[]): Promise<void> {
    this.live(); mediaIds.forEach(vaultId);
    const pending = await this.queue.list(this.scope); this.live();
    for (const item of pending) {
      vaultAssert(scopeKey(item.scope) === scopeKey(this.scope), 'SCOPE_CHANGED');
      if (mediaIds.includes(item.manifest.id)) { await this.queue.remove(item.key); this.live(); }
    }
  }
}

/** Device-private media queue; no tokens or capability URLs are persisted. */
export class IndexedDbVaultUploadQueue implements VaultUploadQueue {
  private readonly db: Promise<IDBDatabase>;
  private closed=false;
  constructor(factory: IDBFactory = indexedDB) {
    this.db = new Promise((resolve, reject) => {
      const open = factory.open('hearth-vault-upload-v1', 1);
      open.onupgradeneeded = () => open.result.createObjectStore('uploads', { keyPath: 'key' });
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
      open.onblocked = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
    void this.db.catch(()=>undefined);
  }
  close():void{this.closed=true;void this.db.then(db=>db.close()).catch(()=>undefined);}
  private async database(){vaultAssert(!this.closed,'SCOPE_CHANGED');const db=await this.db;vaultAssert(!this.closed,'SCOPE_CHANGED');return db;}
  async put(upload: VaultPendingUpload): Promise<void> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('uploads', 'readwrite'), store = tx.objectStore('uploads');
      const count = store.count();
      count.onsuccess = () => {
        const existing = store.get(upload.key);
        existing.onsuccess = () => {
          const previous = existing.result as VaultPendingUpload | undefined;
          if ((count.result >= 20 && !previous) || (previous && JSON.stringify(previous.manifest) !== JSON.stringify(upload.manifest))) { tx.abort(); return; }
          store.put(upload);
        };
      };
      tx.oncomplete = () => resolve();
      tx.onerror = tx.onabort = () => reject(new Error('PRIVATE_UPLOAD_QUEUE_UNAVAILABLE'));
    });
  }
  async list(scope: VaultClientScope): Promise<VaultPendingUpload[]> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const request = db.transaction('uploads', 'readonly').objectStore('uploads').getAll();
      request.onsuccess = () => resolve((request.result as VaultPendingUpload[]).filter(item => scopeKey(item.scope) === scopeKey(scope)));
      request.onerror = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
  async remove(key: string): Promise<void> {
    const db = await this.database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('uploads', 'readwrite'); tx.objectStore('uploads').delete(key);
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
}
