import { FEEDBACK_HEADERS, FEEDBACK_SHEET_ID, FEEDBACK_TAB_ID, FEEDBACK_URL, normalizeFeedback, type FeedbackReview } from '../../src/workspace/feedback.ts';
import type { WorkspaceEnv } from './env.ts';
import { hashText } from './grants.ts';

const endpoint = `https://sheets.googleapis.com/v4/spreadsheets/${FEEDBACK_SHEET_ID}`;
const metadataKey = 'hearthFeedbackReceiptV1';
async function boundedJson(response: Response): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('FEEDBACK_CONNECTION_FAILED');
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const next = await reader.read(); if (next.done) break;
    size += next.value.length;
    if (size > 128_000) { await reader.cancel(); throw new Error('FEEDBACK_RESPONSE_LIMIT'); }
    chunks.push(next.value);
  }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return JSON.parse(new TextDecoder().decode(bytes));
}
function base64url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', ''); }
/** Dedicated service identity; no browser Google token, broad command dispatch or model credential access. */
export async function feedbackAccessToken(env: WorkspaceEnv): Promise<string> {
  if (!env.HERCULES_FEEDBACK_SERVICE_ACCOUNT) throw new Error('FEEDBACK_NOT_CONNECTED');
  const account = JSON.parse(env.HERCULES_FEEDBACK_SERVICE_ACCOUNT) as { client_email?: string; private_key?: string; type?: string };
  if (account.type !== 'service_account' || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(account.client_email ?? '') || !account.private_key) throw new Error('FEEDBACK_NOT_CONNECTED');
  const now = Math.floor(Date.now() / 1000);
  const encode = (v: unknown) => base64url(new TextEncoder().encode(JSON.stringify(v)));
  const assertion = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 600 })}`;
  const der = Uint8Array.from(atob(account.private_key.replace(/-----[^-]+-----|\s/g, '')), c => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(assertion)));
  const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${assertion}.${base64url(signature)}` }) });
  if (!response.ok) throw new Error('FEEDBACK_NOT_CONNECTED');
  const value = await boundedJson(response);
  if (typeof value.access_token !== 'string' || value.access_token.length > 8192) throw new Error('FEEDBACK_NOT_CONNECTED');
  return value.access_token;
}
type Cell = { userEnteredFormat?: Record<string, unknown>; userEnteredValue?: { stringValue?: string }; dataValidation?: { condition?: { type?: string; values?: Array<{ userEnteredValue?: string }> }; strict?: boolean } };
export function feedbackRow(review: FeedbackReview, headers: string[]): Array<{ userEnteredValue: { stringValue: string } | { boolValue: boolean } | { numberValue: number } }> {
  const d = normalizeFeedback(review.draft);
  const example = [`Expected: ${d.expected}`, `Steps: ${d.steps}`, d.example && `Example: ${d.example}`,
    Object.keys(d.context).length && `App context (reported):\n${Object.entries(d.context).map(([k, v]) => `${k}: ${v}`).join('\n')}`].filter(Boolean).join('\n\n');
  const values: Record<string, string | boolean | number> = { ID: `H-${review.id}`, 'Main Page': d.page, Function: d.feature, 'Issue/Suggestion': d.issue, Example: example, Owner: d.owner, 'Suggested Fix': d.suggestedFix, 'Urgency (1-10)': Number(d.urgency), Status: 'Not started', Done: false, 'Source tab': 'Hearth app' };
  // ExtendedValue.stringValue is literal, even for =IMPORTXML, +, - and @. No formula evaluation.
  return headers.map(h => ({ userEnteredValue: typeof values[h] === 'boolean' ? { boolValue: values[h] as boolean } : typeof values[h] === 'number' ? { numberValue: values[h] as number } : { stringValue: String(values[h] ?? '') } }));
}
/** One atomic row + unique metadata receipt. An uncertain dispatch only performs receipt reads. */
export async function submitFeedbackSheet(env: WorkspaceEnv, review: FeedbackReview, digest: string, principal: string, checkOnly: boolean, beforeWrite: () => void) {
  const token = await feedbackAccessToken(env), headers = { Authorization: `Bearer ${token}` };
  const receiptHash = await hashText(`${principal}\n${digest}`);
  const metadataId = (Number.parseInt((await hashText(`${principal}/${review.id}`)).slice(0, 8), 16) & 0x7fffffff) || 1;
  const metadata = await fetch(`${endpoint}/developerMetadata/${metadataId}`, { headers, signal: AbortSignal.timeout(10_000) });
  if (metadata.ok) {
    const value = await boundedJson(metadata);
    if (value.metadataKey !== metadataKey || value.metadataValue !== receiptHash || value.location?.sheetId !== FEEDBACK_TAB_ID) throw new Error('FEEDBACK_RECEIPT_COLLISION');
    return { reportId: `H-${review.id}`, url: FEEDBACK_URL };
  }
  if (metadata.status !== 404) throw new Error('FEEDBACK_CONNECTION_FAILED');
  if (checkOnly) return null;
  // Separate field masks keep existing report text out of the template response.
  const metaResponse = await fetch(`${endpoint}?fields=sheets.properties`, { headers, signal: AbortSignal.timeout(10_000) });
  if (!metaResponse.ok) throw new Error('FEEDBACK_CONNECTION_FAILED');
  const meta = await boundedJson(metaResponse);
  const tab = meta.sheets?.find((s: { properties: { sheetId: number } }) => s.properties.sheetId === FEEDBACK_TAB_ID)?.properties;
  if (!tab?.title || tab.gridProperties?.columnCount < FEEDBACK_HEADERS.length) throw new Error('FEEDBACK_SCHEMA_CHANGED');
  const tabRange = `'${String(tab.title).replaceAll("'", "''")}'!`;
  const [headerResponse, templateResponse] = await Promise.all([
    fetch(`${endpoint}?ranges=${encodeURIComponent(tabRange + 'A1:Z1')}&fields=sheets.data.rowData.values(userEnteredValue)`, { headers, signal: AbortSignal.timeout(10_000) }),
    fetch(`${endpoint}?ranges=${encodeURIComponent(tabRange + 'A2:Z2')}&fields=sheets.data.rowData.values(dataValidation,userEnteredFormat)`, { headers, signal: AbortSignal.timeout(10_000) }),
  ]);
  if (!headerResponse.ok || !templateResponse.ok) throw new Error('FEEDBACK_CONNECTION_FAILED');
  const [headerData, templateData] = await Promise.all([boundedJson(headerResponse), boundedJson(templateResponse)]);
  const headerCells = (headerData.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values ?? []) as Cell[];
  const templateCells = (templateData.sheets?.[0]?.data?.[0]?.rowData?.[0]?.values ?? []) as Cell[];
  const names = headerCells.map(c => c.userEnteredValue?.stringValue ?? '');
  if (FEEDBACK_HEADERS.some(h => names.filter(n => n === h).length !== 1) || names.some(n => n && !(FEEDBACK_HEADERS as readonly string[]).includes(n))) throw new Error('FEEDBACK_SCHEMA_CHANGED');
  const d = normalizeFeedback(review.draft);
  for (const [name, value] of [['Main Page', d.page], ['Owner', d.owner], ['Urgency (1-10)', d.urgency], ['Status', 'Not started'], ['Done', 'FALSE']]) {
    const validation = templateCells[names.indexOf(name!)]?.dataValidation;
    if (name === 'Done' && validation?.condition?.type === 'BOOLEAN' && !validation.condition.values?.length) continue;
    if (validation?.strict && (validation.condition?.type !== 'ONE_OF_LIST' || !validation.condition.values?.some(v => v.userEnteredValue === value))) throw new Error('FEEDBACK_SCHEMA_CHANGED');
  }
  beforeWrite();
  const result = await fetch(`${endpoint}:batchUpdate`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000),
    body: JSON.stringify({ requests: [
      { createDeveloperMetadata: { developerMetadata: { metadataId, metadataKey, metadataValue: receiptHash, location: { sheetId: FEEDBACK_TAB_ID }, visibility: 'DOCUMENT' } } },
      { appendCells: { sheetId: FEEDBACK_TAB_ID, rows: [{ values: feedbackRow(review, names).map((cell, i) => ({ ...cell, ...(templateCells[i]?.dataValidation ? { dataValidation: templateCells[i]!.dataValidation } : {}), ...(templateCells[i]?.userEnteredFormat ? { userEnteredFormat: templateCells[i]!.userEnteredFormat } : {}) })) }], fields: 'userEnteredValue,dataValidation,userEnteredFormat' } },
    ] }) });
  if (!result.ok) throw new Error([400, 401, 403, 404, 429].includes(result.status) ? 'FEEDBACK_SUBMISSION_REJECTED' : 'FEEDBACK_SUBMISSION_UNCERTAIN');
  // No response content or existing sheet data is returned to the model.
  return { reportId: `H-${review.id}`, url: FEEDBACK_URL };
}

/** Retire only this exact temporary marker, after its permanent Agent receipt is accepted. */
export async function retireFeedbackMetadata(env: WorkspaceEnv, review: FeedbackReview, digest: string, principal: string) {
  const token = await feedbackAccessToken(env);
  const metadataValue = await hashText(`${principal}\n${digest}`);
  const metadataId = (Number.parseInt((await hashText(`${principal}/${review.id}`)).slice(0, 8), 16) & 0x7fffffff) || 1;
  const response = await fetch(`${endpoint}:batchUpdate`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10_000),
    body: JSON.stringify({ requests: [{ deleteDeveloperMetadata: { dataFilter: { developerMetadataLookup: { metadataId, metadataKey, metadataValue } } } }] }) });
  if (!response.ok) throw new Error('FEEDBACK_METADATA_RETIRE_FAILED');
}
