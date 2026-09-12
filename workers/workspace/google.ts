import type { ExternalWorkspaceReview } from '../../src/workspace/external.ts';
import type { WorkspaceEnv } from './env.ts';
import { exportWorkspaceFile } from './files.ts';
import type { Scope } from '../../src/ledgerSync/protocol.ts';
export async function googleWorkspaceChange(env: WorkspaceEnv, scope: Scope, token: string, review: ExternalWorkspaceReview, checkOnly: boolean, beforeWrite: () => void) {
  if (!token || token.length > 4000) throw new Error('GOOGLE_CONNECTION_REQUIRED');
  const headers = { Authorization: `Bearer ${token}` };
  const identity = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers, signal: AbortSignal.timeout(10000) });
  if (!identity.ok) throw new Error('GOOGLE_CONNECTION_REQUIRED');
  const profile = await identity.json() as { sub?: string };
  if (!scope.identity?.subject || profile.sub !== scope.identity.subject) throw new Error('GOOGLE_ACCOUNT_MISMATCH');
  if (review.action === 'calendar-event') {
    const id = review.id.replaceAll('-', '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(id)) throw new Error('UUID_REQUIRED');
    const endpoint = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
    const previous = await fetch(`${endpoint}/${id}`, { headers, signal: AbortSignal.timeout(10000) });
    if (previous.ok) { const event = await previous.json() as { id: string; htmlLink?: string }; return { remoteId: event.id, url: event.htmlLink }; }
    if (previous.status !== 404) throw new Error('GOOGLE_RECEIPT_UNAVAILABLE');
    if (checkOnly) return null;
    beforeWrite();
    const response = await fetch(endpoint, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15000),
      body: JSON.stringify({ id, summary: review.title, description: review.content, start: { dateTime: review.start, timeZone: 'America/Toronto' }, end: { dateTime: review.end, timeZone: 'America/Toronto' } }) });
    if (!response.ok) throw new Error('GOOGLE_SUBMISSION_UNCERTAIN');
    const event = await response.json() as { id: string; htmlLink?: string };
    return { remoteId: event.id, url: event.htmlLink };
  }
  const search = new URL('https://www.googleapis.com/drive/v3/files');
  search.searchParams.set('q', `appProperties has { key='hearthWorkspaceReceipt' and value='${review.id}' } and trashed=false`);
  search.searchParams.set('fields', 'files(id,webViewLink)'); search.searchParams.set('pageSize', '2');
  const found = await fetch(search, { headers, signal: AbortSignal.timeout(10000) });
  if (!found.ok) throw new Error('GOOGLE_RECEIPT_UNAVAILABLE');
  const files = await found.json() as { files?: Array<{ id: string; webViewLink?: string }> };
  if (files.files?.length) return { remoteId: files.files[0]!.id, url: files.files[0]!.webViewLink };
  // Drive creation has no exactly-once guarantee. After ambiguity, check only;
  // absence from eventually consistent search does not authorize another POST.
  if (checkOnly) return null;
  const format = review.action === 'document' ? 'docx' : review.action === 'spreadsheet' ? 'xlsx' : 'pptx';
  const file = await exportWorkspaceFile(env, crypto.randomUUID(), { id: review.id, artifactId: review.id, title: review.title, content: review.content,
    format: review.action === 'spreadsheet' ? 'csv' : 'markdown', parentId: null, author: 'user', createdAt: new Date().toISOString(), evidenceIds: [], validation: { status: 'unchecked', details: '' } }, format);
  const boundary = `hearth_${crypto.randomUUID()}`;
  const mime = review.action === 'document' ? 'application/vnd.google-apps.document' : review.action === 'spreadsheet' ? 'application/vnd.google-apps.spreadsheet' : 'application/vnd.google-apps.presentation';
  const sourceMime = format === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : format === 'xlsx' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
  const body = new Blob([`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name: review.title, mimeType: mime, appProperties: { hearthWorkspaceReceipt: review.id } })}\r\n`,
    `--${boundary}\r\nContent-Type: ${sourceMime}\r\n\r\n`, Uint8Array.from(atob(file.base64), c => c.charCodeAt(0)), `\r\n--${boundary}--\r\n`]);
  beforeWrite();
  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink', {
    method: 'POST', headers: { ...headers, 'Content-Type': `multipart/related; boundary=${boundary}` }, body, signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error('GOOGLE_SUBMISSION_UNCERTAIN');
  const result = await response.json() as { id: string; webViewLink?: string };
  return { remoteId: result.id, url: result.webViewLink };
}
