import type { KitchenCommand } from './kitchenCommand.ts';
import type { CommandOutcome } from './core/commandOutcome.ts';
import type { ActionContext, ActionReview } from './core/herculesActions.ts';
import { executeHerculesAction } from './core/herculesExecution.ts';
export type SubmissionStatus = 'accepted' | 'pending' | 'rejected' | 'missing';
export type HerculesCommandService = {
    execute: KitchenCommand;
    readSubmission: (id: string) => Promise<SubmissionStatus>;
};
export type HerculesActionOutcome = {
    state: 'accepted' | 'rejected' | 'unknown';
    message: string;
    outcome?: CommandOutcome;
};
export async function submitHerculesReview(service: HerculesCommandService, context: Omit<ActionContext, 'household'>, review: ActionReview, confirmationId: string, isCurrent: () => boolean): Promise<HerculesActionOutcome> {
    if (!isCurrent())
        return { state: 'rejected', message: 'Open the current conversation and review this again.' };
    let rejected = false, error = '';
    try {
        const outcome = await service.execute(current => {
            try {
                if (!isCurrent())
                    throw Error('This conversation changed. Review the action again.');
                return executeHerculesAction(current, { ...context, review, submissionId: confirmationId });
            }
            catch (e) {
                error = e instanceof Error ? e.message : String(e);
                throw e;
            }
        }, { confirmationId, onDefinitiveRejected: () => { rejected = true; } });
        if (outcome && outcome.confirmationId === confirmationId && outcome.ok && outcome.postedExactlyOnce) {
            const message = outcome.kind === 'synchronized' ? 'Saved.' : outcome.kind === 'accepted-local' ? 'Saved on this device.' : outcome.kind === 'pending-transport' ? 'Saved on this device. Sharing is still pending.' : 'The action is still being checked.';
            if (['synchronized', 'accepted-local', 'pending-transport'].includes(outcome.kind))
                return { state: 'accepted', message, outcome };
        }
        if (rejected || (outcome?.postedNothing && !outcome.postedExactlyOnce && !outcome.ok))
            return { state: 'rejected', message: error || outcome?.userMessage || 'Nothing changed. Review the details before trying again.' };
    }
    catch { /* A transport failure cannot establish that nothing happened. */ }
    return { state: 'unknown', message: 'I’m still checking whether this saved. Keep this review while we check its status.' };
}
