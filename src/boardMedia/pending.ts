import { BoardMediaError, boardMediaScopeKey, type BoardMediaScope, type PendingBoardPhoto } from './types';

/** Stored only in the dedicated local IndexedDB database; never in ledger persistence. */
export interface PendingBoardPhotoRecord extends PendingBoardPhoto { blob: Blob; scopeKey: string }
export interface BoardPhotoStore {
  add(record: PendingBoardPhotoRecord): Promise<void>;
  get(scope: BoardMediaScope, pendingId: string): Promise<PendingBoardPhotoRecord | undefined>;
  list(scope: BoardMediaScope): Promise<PendingBoardPhotoRecord[]>;
  /** Atomic update-if-present prevents a late response from undoing discard/ack. */
  update(scope: BoardMediaScope, pendingId: string, patch: Partial<Pick<PendingBoardPhotoRecord, 'status' | 'attempts' | 'lastError'>>): Promise<PendingBoardPhotoRecord | undefined>;
  remove(scope: BoardMediaScope, pendingId: string, onlyUploaded?: boolean): Promise<void>;
}
const DB_NAME = 'hearth-board-media-v1';
const STORE = 'pending';
const MAX_PENDING = 20;
function key(scope: BoardMediaScope, pendingId: string): string[] { return [boardMediaScopeKey(scope), pendingId]; }

/** No memory/localStorage fallback: a failed durable write must visibly fail the upload. */
export class IndexedDbBoardPhotoStore implements BoardPhotoStore {
  constructor(private readonly factory: IDBFactory | undefined = globalThis.indexedDB) {}
  private open(): Promise<IDBDatabase> {
    if (!this.factory) return Promise.reject(new BoardMediaError('LOCAL_STORAGE_UNAVAILABLE', 'Enable browser storage to keep pending board photos safely.'));
    return new Promise((resolve, reject) => {
      const request = this.factory!.open(DB_NAME, 1);
      let failed = false;
      request.onupgradeneeded = () => {
        const store = request.result.createObjectStore(STORE, { keyPath: ['scopeKey', 'pendingId'] });
        store.createIndex('scope', 'scopeKey');
      };
      request.onsuccess = () => {
        if (failed) { request.result.close(); return; }
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = request.onblocked = () => {
        failed = true;
        reject(new BoardMediaError('LOCAL_STORAGE_UNAVAILABLE', 'Board photo storage is blocked or unavailable. Close other Hearth tabs and try again.'));
      };
    });
  }
  private async transaction<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore, result: (value: T) => void) => void): Promise<T> {
    const db = await this.open();
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      let value: T;
      tx.oncomplete = () => { db.close(); resolve(value); };
      tx.onerror = tx.onabort = () => {
        db.close();
        reject(new BoardMediaError('LOCAL_STORAGE_UNAVAILABLE', 'Could not save pending board photos. Free browser storage and retry.'));
      };
      try { work(tx.objectStore(STORE), result => { value = result; }); }
      catch (error) { tx.abort(); db.close(); reject(error); }
    });
  }
  async add(record: PendingBoardPhotoRecord): Promise<void> {
    await this.transaction<void>('readwrite', (store, done) => {
      const count = store.index('scope').count(record.scopeKey);
      count.onsuccess = () => {
        if (count.result >= MAX_PENDING) { store.transaction.abort(); return; }
        store.add(record); done();
      };
    });
  }
  get(scope: BoardMediaScope, pendingId: string): Promise<PendingBoardPhotoRecord | undefined> {
    return this.transaction('readonly', (store, done) => {
      const request = store.get(key(scope, pendingId));
      request.onsuccess = () => done(request.result);
    });
  }
  list(scope: BoardMediaScope): Promise<PendingBoardPhotoRecord[]> {
    return this.transaction('readonly', (store, done) => {
      const request = store.index('scope').getAll(boardMediaScopeKey(scope));
      request.onsuccess = () => done(request.result);
    });
  }
  update(scope: BoardMediaScope, pendingId: string, patch: Partial<Pick<PendingBoardPhotoRecord, 'status' | 'attempts' | 'lastError'>>): Promise<PendingBoardPhotoRecord | undefined> {
    return this.transaction('readwrite', (store, done) => {
      const request = store.get(key(scope, pendingId));
      request.onsuccess = () => {
        const current: PendingBoardPhotoRecord | undefined = request.result;
        if (!current) { done(undefined); return; }
        const next = { ...current, ...patch };
        // Another tab may already have uploaded successfully; failure must not demote it.
        if (current.status === 'uploaded') { next.status = 'uploaded'; next.lastError = undefined; }
        store.put(next); done(next);
      };
    });
  }
  remove(scope: BoardMediaScope, pendingId: string, onlyUploaded = false): Promise<void> {
    return this.transaction('readwrite', (store, done) => {
      const request = store.get(key(scope, pendingId));
      request.onsuccess = () => {
        const current: PendingBoardPhotoRecord | undefined = request.result;
        if (current && (!onlyUploaded || current.status === 'uploaded')) store.delete(key(scope, pendingId));
        done();
      };
    });
  }
}
