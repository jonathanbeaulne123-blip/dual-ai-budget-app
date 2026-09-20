import type { LedgerView } from '../core/types.ts';
import type { MemoryComposition } from './contracts.ts';
import { memoryKey } from './projectorComposition.ts';

export type ProjectorDraftScope = {
  environment: string;
  householdId: string;
  memberId: string;
  audience: LedgerView;
};

export type ProjectorDraftStore = Pick<Storage, 'getItem' | 'setItem'>;

type StoredProjectorDraft = {
  version: 1;
  scope: ProjectorDraftScope;
  memories: Array<{ memoryId: string; revision: number }>;
  secondsPerPage: number;
  showAmounts: boolean;
};

export type ProjectorDraftRecovery = {
  status: 'absent' | 'restored' | 'rejected';
  order: string[];
  discarded: number;
  secondsPerPage: number;
  showAmounts: boolean;
};

const defaults = (status: ProjectorDraftRecovery['status']): ProjectorDraftRecovery => ({
  status,
  order: [],
  discarded: 0,
  secondsPerPage: 5,
  showAmounts: false,
});

const scopeValue = (scope: ProjectorDraftScope) => [scope.environment, scope.householdId, scope.memberId, scope.audience] as const;

export function projectorDraftKey(scope: ProjectorDraftScope): string {
  return `hearth:projector-draft:v1:${JSON.stringify(scopeValue(scope))}`;
}

function decodeStoredProjectorDraft(input: unknown, scope: ProjectorDraftScope): StoredProjectorDraft | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const row = input as Partial<StoredProjectorDraft>;
  if (row.version !== 1 || !row.scope || typeof row.scope !== 'object' || Array.isArray(row.scope)) return null;
  if (JSON.stringify(scopeValue(row.scope as ProjectorDraftScope)) !== JSON.stringify(scopeValue(scope))) return null;
  if (!Array.isArray(row.memories) || row.memories.length > 100 || !Number.isInteger(row.secondsPerPage) || row.secondsPerPage! < 1 || row.secondsPerPage! > 30 || typeof row.showAmounts !== 'boolean') return null;
  const seen = new Set<string>();
  for (const reference of row.memories) {
    if (!reference || typeof reference !== 'object' || Array.isArray(reference)) return null;
    const { memoryId, revision } = reference as { memoryId?: unknown; revision?: unknown };
    if (typeof memoryId !== 'string' || !memoryId || memoryId.length > 180 || !Number.isInteger(revision) || (revision as number) < 1) return null;
    const key = memoryKey({ id: memoryId, revision: revision as number });
    if (seen.has(key)) return null;
    seen.add(key);
  }
  return row as StoredProjectorDraft;
}

export function readProjectorDraft(storage: ProjectorDraftStore, scope: ProjectorDraftScope, eligible: readonly MemoryComposition[]): ProjectorDraftRecovery {
  const raw = storage.getItem(projectorDraftKey(scope));
  if (raw === null) return defaults('absent');
  if (raw.length > 64 * 1024) return defaults('rejected');
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return defaults('rejected'); }
  const stored = decodeStoredProjectorDraft(parsed, scope);
  if (!stored) return defaults('rejected');
  const eligibleKeys = new Set(eligible.map(memoryKey));
  const order = stored.memories.map(reference => memoryKey({ id: reference.memoryId, revision: reference.revision })).filter(key => eligibleKeys.has(key));
  return {
    status: 'restored',
    order,
    discarded: stored.memories.length - order.length,
    secondsPerPage: stored.secondsPerPage,
    showAmounts: stored.showAmounts,
  };
}

export function writeProjectorDraft(
  storage: ProjectorDraftStore,
  scope: ProjectorDraftScope,
  memories: readonly Pick<MemoryComposition, 'id' | 'revision'>[],
  options: { secondsPerPage: number; showAmounts: boolean },
): void {
  const draft: StoredProjectorDraft = {
    version: 1,
    scope: { ...scope },
    memories: memories.map(memory => ({ memoryId: memory.id, revision: memory.revision })),
    secondsPerPage: options.secondsPerPage,
    showAmounts: options.showAmounts,
  };
  storage.setItem(projectorDraftKey(scope), JSON.stringify(draft));
}
