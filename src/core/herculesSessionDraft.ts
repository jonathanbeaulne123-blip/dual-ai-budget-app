import { COMPANION_LIMITS, type CompanionIntentV1 } from './herculesCompanionContracts.ts';

/** Expire whole receipt groups; never change the contents of a retried exchange. */
export function trimCompanionPending(intents: readonly CompanionIntentV1[], now = Date.now()): CompanionIntentV1[] {
  const expiredReceipts = new Set(intents.filter(({ operation }) => operation.kind === 'conversation.append'
    && Date.parse(operation.turn.createdAt) < now - COMPANION_LIMITS.historyDays * 86_400_000).map(intent => intent.id));
  const expiredTurns = new Set(intents.flatMap(({ id, operation }) => expiredReceipts.has(id)
    && operation.kind === 'conversation.append' ? [operation.turn.id] : []));
  // Enqueue bounds the session. Truncating here could cut a user/reply pair.
  return intents.filter(({ id, operation }) => !expiredReceipts.has(id)
    && !(operation.kind === 'preference.set' && operation.origin.kind === 'conversation'
      && expiredTurns.has(operation.origin.sourceTurnId)));
}
