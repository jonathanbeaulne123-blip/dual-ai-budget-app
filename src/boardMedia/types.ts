/** Shared by Classic, Taylor and Newfoundland; never persist photo bytes in a household. */
export interface BoardMediaScope {
  environment: 'development' | 'production';
  householdId: string;
  actorId: string;
  /** Supabase Auth userId (ledgerSync Scope.subject), not email or a bearer token. */
  authIdentity: string;
}
export interface BoardMediaSession {
  accessToken: string;
  actorId: string;
  authIdentity: string;
}
export interface BoardPhotoMetadata {
  mediaId: string;
  contentType: 'image/jpeg';
  byteLength: number;
  width: number;
  height: number;
}
/** Durable local slot intent; the parent command validates/accepts it against current metadata. */
export interface BoardPhotoIntent {
  slot: 1 | 2 | 3;
  caption: string;
  crop: { x: number; y: number; zoom: number };
  expectedVersion: number;
}
/** pendingId is local bookkeeping. Persist only mediaId/image metadata in the board. */
export interface BoardPhotoReference extends BoardPhotoMetadata { pendingId: string }
export interface PendingBoardPhoto extends BoardPhotoReference {
  scope: BoardMediaScope;
  intent?: BoardPhotoIntent;
  createdAt: string;
  status: 'queued' | 'uploaded';
  attempts: number;
  lastError?: string;
}
export class BoardMediaError extends Error {
  constructor(public readonly code: string, message: string, public readonly pendingId?: string) {
    super(message);
    this.name = 'BoardMediaError';
  }
}
export const SOURCE_MAX_BYTES = 10 * 1024 * 1024;
export const DISPLAY_MAX_BYTES = 2 * 1024 * 1024;
export const DISPLAY_MAX_DIMENSION = 1600;
export const MEDIA_ID_PATTERN = /^BM-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export function assertMediaId(id: string): void {
  if (!MEDIA_ID_PATTERN.test(id)) throw new BoardMediaError('INVALID_MEDIA_ID', 'Invalid board photo identifier.');
}
export function assertScope(scope: BoardMediaScope): void {
  if (!['development', 'production'].includes(scope.environment) ||
    !/^HH-[A-Za-z0-9_-]{1,96}$/.test(scope.householdId) ||
    !/^MEM-[A-Za-z0-9_-]{1,96}$/.test(scope.actorId) ||
    !scope.authIdentity || scope.authIdentity.length > 256 || /[\x00-\x20\x7f]/.test(scope.authIdentity)) {
    throw new BoardMediaError('INVALID_SCOPE', 'Open a signed-in household before using board photos.');
  }
}
export function boardMediaScopeKey(scope: BoardMediaScope): string {
  assertScope(scope);
  return JSON.stringify([scope.environment, scope.householdId, scope.actorId, scope.authIdentity]);
}
