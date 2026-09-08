import { prepareBoardPhoto, displayJpegDimensions, type PreparedBoardPhoto } from './image';
import { IndexedDbBoardPhotoStore, type BoardPhotoStore, type PendingBoardPhotoRecord } from './pending';
import { BoardMediaError, DISPLAY_MAX_BYTES, assertMediaId, assertScope, boardMediaScopeKey, type BoardPhotoIntent, type BoardMediaScope, type BoardMediaSession, type BoardPhotoReference, type PendingBoardPhoto } from './types';

export interface BoardMediaClientOptions {
  scope: BoardMediaScope;
  /** Resolve current auth at every network boundary. Never read a token from pending storage. */
  getSession: () => Promise<BoardMediaSession | null>;
  /** Capture the parent's room/auth generation, not just equality of the current household id. */
  isCurrent: () => boolean;
  /** Defaults are the browser fetch, durable IndexedDB and canvas. Injection is for local tests. */
  fetch?: typeof globalThis.fetch;
  store?: BoardPhotoStore;
  prepare?: (file: Blob) => Promise<PreparedBoardPhoto>;
}
function publicPending(record: PendingBoardPhotoRecord): PendingBoardPhoto {
  const { blob: _blob, scopeKey: _key, ...metadata } = record;
  return structuredClone(metadata);
}
function reference(record: PendingBoardPhoto): BoardPhotoReference {
  return { pendingId: record.pendingId, mediaId: record.mediaId, contentType: record.contentType, byteLength: record.byteLength, width: record.width, height: record.height };
}
export function createBoardMediaClient(options: BoardMediaClientOptions) {
  // Runtime callers can pass structurally wider objects, including auth sessions.
  const scope = Object.freeze({
    environment: options.scope.environment, householdId: options.scope.householdId,
    actorId: options.scope.actorId, authIdentity: options.scope.authIdentity,
  });
  assertScope(scope);
  const store = options.store ?? new IndexedDbBoardPhotoStore();
  const fetcher = options.fetch ?? globalThis.fetch.bind(globalThis);
  const prepare = options.prepare ?? prepareBoardPhoto;
  const controller = new AbortController();
  const inFlight = new Map<string, Promise<BoardPhotoReference>>();
  const discarded = new Set<string>();
  let disposed = false;
  function current() {
    if (disposed || !options.isCurrent()) {
      disposed = true; controller.abort();
      throw new BoardMediaError('STALE_SCOPE', 'This photo belongs to a household or sign-in you have left.');
    }
  }
  async function session(): Promise<BoardMediaSession> {
    current();
    const auth = await options.getSession();
    current();
    if (!auth || auth.actorId !== scope.actorId || auth.authIdentity !== scope.authIdentity || !auth.accessToken) {
      // Latch retirement: a later A→B→A transition cannot revive this client.
      disposed = true; controller.abort();
      throw new BoardMediaError('AUTH_CHANGED', 'Sign in as the person who queued this photo to retry it.');
    }
    return auth;
  }
  async function request(mediaId: string, method: 'GET' | 'PUT', blob?: Blob): Promise<Response> {
    assertMediaId(mediaId);
    const auth = await session();
    if (scope.environment !== 'development') throw new BoardMediaError('ENVIRONMENT_DISABLED', 'Board photos are enabled only in Development.');
    let response: Response;
    try {
      response = await fetcher(`/api/board-media/${scope.environment}/${scope.householdId}/${mediaId}`, {
        method, headers: { Authorization: `Bearer ${auth.accessToken}`, 'X-Board-Actor': scope.actorId, 'X-Board-Identity': scope.authIdentity, ...(blob ? { 'Content-Type': 'image/jpeg' } : {}) },
        body: blob, signal: controller.signal, cache: 'no-store', credentials: 'omit', redirect: 'error',
      });
    } catch {
      current();
      throw new BoardMediaError('NETWORK_UNAVAILABLE', 'Photo remains pending. Reconnect and retry.');
    }
    await session();
    if (!response.ok) {
      // Fixed local messages keep unexpected upstream responses out of durable storage/UI.
      const errors: Record<number, [string, string]> = {
        401: ['UNAUTHENTICATED', 'Sign in again to retry this photo.'],
        403: ['FORBIDDEN', 'Your current membership cannot access this photo.'],
        404: ['PHOTO_NOT_FOUND', 'This board photo is no longer available.'],
        409: ['MEDIA_ID_CONFLICT', 'This photo identifier is used or deleted. Discard it and choose the photo again.'],
        413: ['DISPLAY_TOO_LARGE', 'Prepared photo is too large. Choose another photo.'],
        415: ['UNSUPPORTED_IMAGE', 'Choose a JPEG, PNG or WebP photo.'],
        503: ['BOARD_MEDIA_UNAVAILABLE', 'Board photo storage is unavailable. The operator must bind the dedicated Development BOARD_MEDIA bucket if it is not configured. Retry later.'],
      };
      const [code, message] = errors[response.status] ?? ['UPLOAD_REJECTED', 'The photo service rejected this request. Choose the photo again.'];
      throw new BoardMediaError(code, message);
    }
    return response;
  }
  async function queueBoardPhoto(file: Blob, intent?: BoardPhotoIntent): Promise<PendingBoardPhoto> {
    // Capture user intent before any async work; later edits must not retarget this upload.
    // Allowlist both levels: cloning/spreading can retain injected credentials.
    const capturedIntent = intent ? {
      slot: intent.slot, caption: intent.caption, expectedVersion: intent.expectedVersion,
      crop: intent.crop ? { x: intent.crop.x, y: intent.crop.y, zoom: intent.crop.zoom } : undefined,
    } : undefined;
    if (capturedIntent && (![1, 2, 3].includes(capturedIntent.slot) ||
      typeof capturedIntent.caption !== 'string' || capturedIntent.caption.length > 1000 ||
      !Number.isSafeInteger(capturedIntent.expectedVersion) || capturedIntent.expectedVersion < 0 ||
      !capturedIntent.crop || ![capturedIntent.crop.x, capturedIntent.crop.y, capturedIntent.crop.zoom].every(Number.isFinite) || capturedIntent.crop.zoom <= 0))
      throw new BoardMediaError('INVALID_INTENT', 'Choose a valid board slot and photo placement.');
    await session();
    if (scope.environment !== 'development') throw new BoardMediaError('ENVIRONMENT_DISABLED', 'Board photos are enabled only in Development.');
    const prepared = await prepare(file);
    await session();
    const dimensions = displayJpegDimensions(new Uint8Array(await prepared.blob.arrayBuffer()));
    current();
    if (prepared.blob.type !== 'image/jpeg' || dimensions.width !== prepared.width || dimensions.height !== prepared.height)
      throw new BoardMediaError('INVALID_IMAGE', 'Could not prepare this photo. Choose it again.');
    const id = crypto.randomUUID();
    const record: PendingBoardPhotoRecord = {
      pendingId: id, mediaId: `BM-${id}`, scope,
      intent: capturedIntent ? { ...capturedIntent, crop: capturedIntent.crop! } : undefined,
      scopeKey: boardMediaScopeKey(scope),
      contentType: 'image/jpeg', byteLength: prepared.blob.size, ...dimensions,
      createdAt: new Date().toISOString(), status: 'queued', attempts: 0, blob: prepared.blob,
    };
    await store.add(record);
    await session();
    return publicPending(record);
  }
  async function retry(pendingId: string): Promise<BoardPhotoReference> {
    await session();
    const record = await store.get(scope, pendingId);
    current();
    if (!record || discarded.has(pendingId)) throw new BoardMediaError('PENDING_NOT_FOUND', 'This pending photo was discarded or already accepted.', pendingId);
    try {
      if (record.status === 'uploaded') return reference(record);
      const response = await request(record.mediaId, 'PUT', record.blob);
      const value = await response.json();
      await session();
      if (!value || value.mediaId !== record.mediaId || value.contentType !== 'image/jpeg' || value.byteLength !== record.byteLength || value.width !== record.width || value.height !== record.height)
        throw new BoardMediaError('INVALID_RESPONSE', 'Photo service returned an unexpected reference. Keep this photo pending and retry.');
      if (discarded.has(pendingId)) throw new BoardMediaError('PENDING_NOT_FOUND', 'This pending photo was discarded.');
      const saved = await store.update(scope, pendingId, { status: 'uploaded', attempts: record.attempts + 1, lastError: undefined });
      await session();
      if (!saved || discarded.has(pendingId)) throw new BoardMediaError('PENDING_NOT_FOUND', 'This pending photo was discarded or already accepted.');
      return reference(saved);
    } catch (error) {
      const failure = error instanceof BoardMediaError ? error : new BoardMediaError('UPLOAD_FAILED', 'Photo remains pending. Retry when ready.');
      if (!disposed && options.isCurrent() && !discarded.has(pendingId))
        await store.update(scope, pendingId, { attempts: record.attempts + 1, lastError: failure.code });
      throw new BoardMediaError(failure.code, failure.message, pendingId);
    }
  }
  function retryPendingBoardPhoto(pendingId: string): Promise<BoardPhotoReference> {
    current();
    const existing = inFlight.get(pendingId);
    if (existing) return existing;
    const task = retry(pendingId).finally(() => { inFlight.delete(pendingId); });
    inFlight.set(pendingId, task);
    return task;
  }
  return {
    /** Blob only. UI creates/revokes its object URL and retires it on scope change. */
    async getBoardPhoto(mediaId: string): Promise<Blob> {
      const response = await request(mediaId, 'GET');
      const declared = response.headers.get('Content-Length');
      if ((declared !== null && (!/^\d+$/.test(declared) || Number(declared) > DISPLAY_MAX_BYTES)) || !response.body)
        throw new BoardMediaError('INVALID_RESPONSE', 'Photo service returned an invalid photo size.');
      const reader = response.body.getReader();
      const chunks: Uint8Array<ArrayBuffer>[] = [];
      let size = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.byteLength;
          if (size > DISPLAY_MAX_BYTES) {
            await reader.cancel();
            throw new BoardMediaError('INVALID_RESPONSE', 'Photo service returned an oversized photo.');
          }
          current();
          chunks.push(new Uint8Array(value));
        }
      } finally { reader.releaseLock(); }
      const blob = new Blob(chunks, { type: response.headers.get('Content-Type') ?? '' });
      await session();
      if (blob.type !== 'image/jpeg') throw new BoardMediaError('INVALID_RESPONSE', 'Photo service returned an invalid photo.');
      displayJpegDimensions(new Uint8Array(await blob.arrayBuffer()));
      await session();
      return blob;
    },
    /** Durable local queue first; does not accept metadata, erase old photos, or mutate a ledger. */
    async uploadBoardPhoto(file: Blob, intent?: BoardPhotoIntent): Promise<BoardPhotoReference> {
      const pending = await queueBoardPhoto(file, intent);
      return retryPendingBoardPhoto(pending.pendingId);
    },
    /** Disabled until accepted-authority coordinated GC exists. Remove only the accepted slot reference. */
    async deleteBoardPhoto(_mediaId: string): Promise<void> {
      throw new BoardMediaError('PHYSICAL_DELETE_DISABLED', 'Physical photo deletion is disabled. Remove the accepted board slot reference; private prior bytes remain until coordinated garbage collection is available.');
    },
    queueBoardPhoto,
    async listPendingBoardPhotos(): Promise<PendingBoardPhoto[]> {
      await session();
      const records = await store.list(scope);
      await session();
      return records.map(publicPending).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    },
    retryPendingBoardPhoto,
    /** Local discard only, never deletes an accepted image. Late uploads may leave an unreferenced object. */
    async discardPendingBoardPhoto(pendingId: string): Promise<void> {
      await session(); discarded.add(pendingId);
      await store.remove(scope, pendingId);
      current();
    },
    /** Call only after the accepted household slot matches this mediaId in the initiating scope. */
    async acknowledgeBoardPhoto(pendingId: string): Promise<void> {
      await session();
      await store.remove(scope, pendingId, true);
      current();
    },
    dispose(): void { disposed = true; controller.abort(); },
  };
}
export type BoardMediaClient = ReturnType<typeof createBoardMediaClient>;
