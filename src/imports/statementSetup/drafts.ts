import type { StatementDraftScope, StatementSetupDraft, StatementSuggestion } from './types.ts';
const DATABASE = 'hearth-statement-setup-v1';
const STORE = 'drafts';
export function statementScopeKey(scope: StatementDraftScope): string {
  if (!scope.authUserId || !scope.memberId || !scope.householdId) throw new Error('Sign in before saving a statement draft.');
  return JSON.stringify([scope.environment, scope.householdId, scope.memberId, scope.authUserId, scope.view]);
}
export function emptyStatementDraft(scope: StatementDraftScope): StatementSetupDraft {
  return { version: 1, id: crypto.randomUUID(), scope: { ...scope }, updatedAt: new Date().toISOString(), sources: [], rows: [], accounts: [] };
}
export function validateStoredStatementDraft(value: unknown, scope: StatementDraftScope): StatementSetupDraft | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as StatementSetupDraft;
  try {
    if (row.version !== 1 || statementScopeKey(row.scope) !== statementScopeKey(scope) || typeof row.id !== 'string'
      || !Array.isArray(row.sources) || !Array.isArray(row.rows) || !Array.isArray(row.accounts)) return null;
    // Raw source files never belong in persistence. Only normalized, owner-scoped fields are retained.
    if (row.sources.some(source => !/^[a-f0-9]{64}$/.test(source.hash) || !Array.isArray(source.pages))) return null;
    return row;
  } catch { return null; }
}
async function database(): Promise<IDBDatabase> {
  if (!globalThis.indexedDB) throw new Error('This browser cannot save the statement draft. Keep this page open or enable local storage before continuing.');
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 2);
    request.onupgradeneeded = () => { for (const name of [STORE, 'suggestions']) if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('The local statement draft could not open. Your accepted books are unchanged.'));
    request.onblocked = () => reject(new Error('Close the other statement setup tab and try again.'));
  });
}
async function transact<T>(scope: StatementDraftScope, write: boolean, perform: (store: IDBObjectStore, key: string) => IDBRequest<T>, storeName = STORE): Promise<T> {
  const key = statementScopeKey(scope);
  const db = await database();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, write ? 'readwrite' : 'readonly');
      const request = perform(transaction.objectStore(storeName), key);
      transaction.oncomplete = () => resolve(request.result);
      transaction.onerror = () => reject(new Error('The statement draft could not be saved locally. Free space and try again; this page still has your review.'));
      transaction.onabort = () => reject(new Error('The local statement save was interrupted. Try again.'));
    });
  } finally { db.close(); }
}
export async function loadStatementDraft(scope: StatementDraftScope): Promise<StatementSetupDraft | null> {
  return validateStoredStatementDraft(await transact(scope, false, (store, key) => store.get(key)), scope);
}
export async function saveStatementDraft(draft: StatementSetupDraft): Promise<void> {
  if (!validateStoredStatementDraft(draft, draft.scope)) throw new Error('This statement draft no longer matches its owner.');
  await transact(draft.scope, true, (store, key) => store.put(draft, key));
}
export async function discardStatementDraft(scope: StatementDraftScope): Promise<void> {
  await transact(scope, true, (store, key) => store.delete(key));
}

/** Reviewed handoffs are local to this exact Google owner and book scope, independent of raw-source drafts. */
export async function saveStatementSuggestionHandoff(scope: StatementDraftScope, suggestions: StatementSuggestion[]): Promise<void> {
  await transact(scope,true,(store,key)=>store.put({ scope, suggestions, reviewedAt: new Date().toISOString() },key),'suggestions');
}
export async function loadStatementSuggestionHandoff(scope: StatementDraftScope): Promise<StatementSuggestion[]> {
  const value = await transact(scope,false,(store,key)=>store.get(key),'suggestions');
  if (!value || typeof value !== 'object' || !('scope' in value) || !('suggestions' in value)) return [];
  const record = value as {scope:StatementDraftScope;suggestions:StatementSuggestion[]};
  try { if (statementScopeKey(record.scope)!==statementScopeKey(scope) || !Array.isArray(record.suggestions)) return []; return record.suggestions; } catch { return []; }
}
export async function clearStatementSuggestionHandoff(scope: StatementDraftScope): Promise<void> {
  await transact(scope,true,(store,key)=>store.delete(key),'suggestions');
}
