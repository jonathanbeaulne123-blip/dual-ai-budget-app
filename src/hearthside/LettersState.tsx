import type { VaultClientScope } from './vaultClient.ts';
import type { VaultContent, VaultPublicationInput } from './vaultContracts.ts';
import type { LetterAttachment } from './lettersMedia.ts';
export type LettersReview = { id: string; digest: string; content: VaultContent; kind: 'letter' | 'capsule'; recipientMemberIds: string[]; releaseAt: number | null };
export type LettersDraft = {
  id: string; revision: number; content: VaultContent; attachments: LetterAttachment[];
  recipientMemberIds: string[]; kind: 'letter' | 'capsule'; releaseLocal: string;
  publication: { input: VaultPublicationInput; review: LettersReview | null; phase: 'preparing' | 'review' | 'publishing' | 'active' } | null;
  savedAt: number;
};
export interface LettersDraftStorage {
  list(scope: VaultClientScope): Promise<LettersDraft[]>;
  put(scope: VaultClientScope, draft: LettersDraft): Promise<void>;
  remove(scope: VaultClientScope, id: string): Promise<void>;
  close?(): Promise<void>;
}
export const lettersScopeKey = (scope: VaultClientScope) => JSON.stringify([scope.environment, scope.householdId, scope.memberId, scope.subject]);
export const newLettersDraft = (): LettersDraft => ({ id: `letter-draft-${crypto.randomUUID()}`, revision: 0,
  content: { title: '', text: '', mediaIds: [] }, attachments: [], recipientMemberIds: [], kind: 'letter', releaseLocal: '', publication: null, savedAt: Date.now() });
/** Device-private storage for unsent text, recipient choice and stable publication identity. */
export class IndexedDbLettersDraftStorage implements LettersDraftStorage {
  private db: Promise<IDBDatabase> | null = null;
  constructor(private readonly factory: IDBFactory = indexedDB) {}
  private open(): Promise<IDBDatabase> {
    return this.db ??= new Promise((resolve, reject) => {
      let failed = false;
      const request = this.factory.open('hearth-private-letters-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('drafts', { keyPath: 'key' });
      request.onsuccess = () => { if (failed) request.result.close(); else resolve(request.result); };
      request.onerror = request.onblocked = () => { failed = true; reject(new Error('PRIVATE_STORAGE_UNAVAILABLE')); };
    });
  }
  async list(scope: VaultClientScope): Promise<LettersDraft[]> {
    const db = await this.open(), prefix = lettersScopeKey(scope);
    return new Promise((resolve, reject) => {
      const request = db.transaction('drafts', 'readonly').objectStore('drafts').getAll();
      request.onsuccess = () => resolve((request.result as { scope: string; draft: LettersDraft }[]).filter(item => item.scope === prefix).map(item => item.draft));
      request.onerror = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
  async put(scope: VaultClientScope, draft: LettersDraft): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite'), store = tx.objectStore('drafts'), key = `${lettersScopeKey(scope)}/${draft.id}`;
      const count = store.count();
      count.onsuccess = () => {
        const prior = store.get(key);
        prior.onsuccess = () => { if (count.result >= 100 && !prior.result) { tx.abort(); return; } store.put({ key, scope: lettersScopeKey(scope), draft }); };
      };
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
  async remove(scope: VaultClientScope, id: string): Promise<void> {
    const db = await this.open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('drafts', 'readwrite'); tx.objectStore('drafts').delete(`${lettersScopeKey(scope)}/${id}`);
      tx.oncomplete = () => resolve(); tx.onerror = tx.onabort = () => reject(new Error('PRIVATE_STORAGE_UNAVAILABLE'));
    });
  }
  async close(): Promise<void> { try { (await this.db)?.close(); } catch { /* No connection was opened. */ } }
}
