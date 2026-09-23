import type { KitchenCommand } from '../kitchenCommand.ts';
import { commitHearthside, type HearthsideOperation } from './commands.ts';

type ArrangementOperation = Extract<HearthsideOperation, { kind: 'village-arrangement.save' | 'village-arrangement.revert-latest' }>;

/** Keep a rejected revision visible even when the shared command boundary reports null. */
export async function commitVillageArrangement(run: KitchenCommand, memberId: string, operation: ArrangementOperation): Promise<void> {
  const id = crypto.randomUUID();
  let commandError: unknown;
  const outcome = await run(current => {
    try {
      return commitHearthside(current, { version: 1, id, scope: { environment: current.environment, householdId: current.householdId, memberId }, operation });
    } catch (error) {
      commandError = error;
      throw error;
    }
  }, { confirmationId: id });
  if (commandError) throw commandError;
  if (!outcome?.ok) throw Error('Shared arrangement was not saved.');
}
