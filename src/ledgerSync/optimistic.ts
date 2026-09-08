import type { Household, Transaction } from '../core/types.ts';
import { isVisibleInView } from '../core/visibility.ts';
import type { LedgerCommand } from './protocol.ts';
export type RejectedEntry = { command: LedgerCommand; preview?: PendingPreview; rejection: string };
export type PendingPreview = { commandId: string; rows: Transaction[]; submittedAt: string; acceptedSequence?: number };
/** Display-only rows. Caller validates the candidate before persisting these. */
export function previewFor(candidate: Household, accepted: Household, command: LedgerCommand, memberId: string): PendingPreview | undefined {
  const existing = new Set(accepted.transactions.map(row => row.id));
  const posted = new Set(command.steps.flatMap(step => step.previewIds));
  // Only additive previews. Editing an existing row waits for canonical acceptance.
  if ([...posted].some(id => existing.has(id))) return;
  const rows = candidate.transactions.filter(row => posted.has(row.id) && !existing.has(row.id)
    && (isVisibleInView(row, memberId, 'household') || isVisibleInView(row, memberId, 'personal')));
  return rows.length ? { commandId: command.id, rows: structuredClone(rows), submittedAt: new Date().toISOString() } : undefined;
}
export function visiblePreviews(previews: Iterable<PendingPreview>, sequence: number): PendingPreview[] {
  return [...previews].filter(item => item.acceptedSequence === undefined || item.acceptedSequence > sequence);
}
