import type { R2Bucket, R2ObjectBody } from '@cloudflare/workers-types';
import { authorizeRequest, type AuthEnv } from './ledgerSyncAuth';
import { BoardMediaError, DISPLAY_MAX_BYTES, assertMediaId } from '../src/boardMedia/types';
import { displayJpegDimensions } from '../src/boardMedia/image';

/** Deliberately optional until a separately authorized, dedicated Development bucket is bound. */
export type BoardMediaEnv = AuthEnv & { BOARD_MEDIA?: R2Bucket };
const headers = {
  'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; sandbox",
};
function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers });
}
async function boundedBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get('Content-Length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > DISPLAY_MAX_BYTES))
    throw new BoardMediaError('DISPLAY_TOO_LARGE', 'Upload a prepared JPEG no larger than 2 MiB.');
  if (!request.body) throw new BoardMediaError('INVALID_IMAGE', 'Photo bytes are missing.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > DISPLAY_MAX_BYTES) {
        await reader.cancel();
        throw new BoardMediaError('DISPLAY_TOO_LARGE', 'Upload a prepared JPEG no larger than 2 MiB.');
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

/** Bridge Workers stream types to the DOM Response without an unchecked BodyInit cast. */
function photoBody(object: R2ObjectBody): ReadableStream<Uint8Array<ArrayBuffer>> {
  const reader = object.body.getReader();
  return new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) { reader.releaseLock(); controller.close(); }
        else controller.enqueue(new Uint8Array(value));
      } catch (error) { reader.releaseLock(); controller.error(error); }
    },
    async cancel(reason) {
      try { await reader.cancel(reason); } finally { reader.releaseLock(); }
    },
  });
}

/** GET/PUT /api/board-media/:environment/:householdId/:mediaId. Physical DELETE is disabled. */
export async function handleBoardMedia(request: Request, env: BoardMediaEnv): Promise<Response | null> {
  const url = new URL(request.url);
  if (url.pathname !== '/api/board-media' && !url.pathname.startsWith('/api/board-media/')) return null;
  try {
    const match = /^\/api\/board-media\/([^/]+)\/(HH-[A-Za-z0-9_-]{1,96})\/([^/]+)$/.exec(url.pathname);
    if (!match || url.search) return json({ code: 'INVALID_SCOPE', message: 'Use a valid household photo path without query parameters.' }, 400);
    // These three captures are mandatory in the matched expression.
    const environment = match[1]!, householdId = match[2]!, mediaId = match[3]!;
    assertMediaId(mediaId);
    const { scope } = await authorizeRequest(request, env, environment, householdId);
    if (scope.environment !== environment || scope.householdId !== householdId ||
        request.headers.get('X-Board-Actor') !== scope.memberId ||
        request.headers.get('X-Board-Identity') !== scope.subject)
      return json({ code: 'FORBIDDEN', message: 'Sign in as the active household member and try again.' }, 403);
    if (environment !== 'development') return json({ code: 'ENVIRONMENT_DISABLED', message: 'Board photos are enabled only in Development.' }, 403);
    if (request.method === 'DELETE')
      return Response.json({ code: 'PHYSICAL_DELETE_DISABLED', message: 'Physical photo deletion is disabled. Remove the accepted board slot reference; private prior bytes remain until coordinated garbage collection is available.' }, { status: 405, headers: { ...headers, Allow: 'GET, PUT' } });
    if (!['GET', 'PUT'].includes(request.method))
      return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, PUT' } });
    if (!env.BOARD_MEDIA) return json({ code: 'BOARD_MEDIA_UNAVAILABLE', message: 'Board photo storage is not configured. Ask the operator to bind the dedicated Development BOARD_MEDIA R2 bucket.' }, 503);
    const key = `v1/${scope.environment}/${scope.householdId}/${mediaId}`;
    if (request.method === 'GET') {
      const object = await env.BOARD_MEDIA.get(key);
      if (!object || object.customMetadata?.deleted === 'true') return json({ code: 'PHOTO_NOT_FOUND', message: 'This board photo is no longer available.' }, 404);
      return new Response(photoBody(object), { headers: { ...headers, 'Content-Type': 'image/jpeg', 'Content-Length': String(object.size) } });
    }
    if (request.headers.get('Content-Type')?.toLowerCase() !== 'image/jpeg')
      return json({ code: 'UNSUPPORTED_IMAGE', message: 'Upload a prepared JPEG photo.' }, 415);
    const bytes = await boundedBody(request);
    const dimensions = displayJpegDimensions(bytes);
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    const sha256 = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
    const stored = await env.BOARD_MEDIA.put(key, bytes, {
      onlyIf: { etagDoesNotMatch: '*' },
      httpMetadata: { contentType: 'image/jpeg', cacheControl: 'private, no-store' },
      customMetadata: { sha256, width: String(dimensions.width), height: String(dimensions.height) },
    });
    if (!stored) {
      const existing = await env.BOARD_MEDIA.head(key);
      if (!existing || existing.customMetadata?.sha256 !== sha256 || existing.customMetadata?.deleted === 'true')
        return json({ code: 'MEDIA_ID_CONFLICT', message: 'This photo identifier is already used or deleted. Queue a new photo.' }, 409);
    }
    return json({ mediaId, contentType: 'image/jpeg', byteLength: bytes.byteLength, ...dimensions }, stored ? 201 : 200);
  } catch (error) {
    if (error instanceof BoardMediaError)
      return json({ code: error.code, message: error.message }, error.code === 'DISPLAY_TOO_LARGE' ? 413 : 400);
    const code = error instanceof Error ? error.message : '';
    if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') return json({ code, message: 'Sign in to an active household membership to use board photos.' }, code === 'UNAUTHENTICATED' ? 401 : 403);
    if (code === 'INVALID_SCOPE') return json({ code, message: 'Invalid household photo scope.' }, 400);
    // Never return provider bodies, keys, tokens or upstream error details.
    return json({ code: 'BOARD_MEDIA_UNAVAILABLE', message: 'Board photo storage is unavailable. Keep this photo pending and retry later.' }, 503);
  }
}
