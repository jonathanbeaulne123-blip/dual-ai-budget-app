import type { Household, LedgerView, CommitResult } from './types.ts';
import { ValidationError } from './types.ts';
import { captureCommand } from '../ledgerSync/capture.ts';
import { canonical } from '../ledgerSync/patch.ts';
import type { CompanionWorkflow } from './herculesCompanionContracts.ts';
import { companionFor } from './herculesCompanion.ts';
import { executeReviewedAction, type ActionReview } from './herculesActions.ts';
type Claim = {
    memberId: string;
    view: LedgerView;
    submissionId: string;
};
function claimed(h: Household, input: Claim) {
    const profile = companionFor(h, input.memberId);
    const resource = profile.workflows?.find(r => r.id === `task-${input.view}`);
    if (!resource?.value?.submission || resource.value.submission.id !== input.submissionId)
        throw new ValidationError('This confirmation is no longer pending. Check its original receipt.');
    return { profile, resource, draft: resource.value };
}
export function nextHerculesTask(draft: CompanionWorkflow): CompanionWorkflow | null {
    const [next, ...queue] = draft.queue ?? [];
    return next ? { ...draft, actionId: next.actionId, values: next.values, workspaceConfirmationId: next.workspaceConfirmationId, queue, submission: null, updatedAt: new Date().toISOString() } : null;
}
function release(h: Household, input: Claim, newJobId?: string): CommitResult {
    const { profile, resource } = claimed(h, input);
    const resumed = nextHerculesTask(resource.value!);
    if (resumed?.actionId === 'worked-shift' && !resumed.values.jobId && !resumed.values.roleId && newJobId) {
        const job = h.workJobs?.find(j => j.id === newJobId && j.memberId === input.memberId && j.active);
        const roles = job?.roles.filter(r => r.active) ?? [];
        if (job && roles.length === 1) resumed.values = { ...resumed.values, jobId: job.id, roleId: roles[0]!.id };
    }
    const next = { ...h, companionProfile: { ...profile, workflows: profile.workflows!.map(r => r.id === resource.id ? { ...r, revision: r.revision + 1, value: resumed } : r) } };
    return { household: next, warnings: [], postedIds: [], persistenceScope: 'member-personal', personalMemberId: input.memberId,
        undo: { id: crypto.randomUUID(), label: 'Resolve Hercules request', snapshot: h, postedIds: [], commandKind: 'hercules-companion-personal' } };
}
/** Authority rechecks the exact private claim and accepted source facts, then consumes it with the domain change. */
export const executeHerculesAction = captureCommand('executeHerculesAction', (h: Household, input: Claim & {
    today: string;
    review: ActionReview;
}): CommitResult => {
    const { draft } = claimed(h, input);
    if (canonical(JSON.parse(draft.submission!.review)) !== canonical(input.review)
        || draft.actionId !== input.review.actionId || canonical(draft.values) !== canonical(input.review.values))
        throw new ValidationError('This action no longer matches the review you confirmed.');
    const result = executeReviewedAction({ household: h, memberId: input.memberId, view: input.view, today: input.today }, input.review, input.submissionId);
    const newJobs = input.review.actionId === 'add-job' ? result.household.workJobs.filter(j => !h.workJobs.some(old => old.id === j.id)) : [];
    const released = release(result.household, input, newJobs.length === 1 ? newJobs[0]!.id : undefined);
    // The confirmed operation also consumes its workflow. A narrow Plan-only or profile-only
    // persistence guard cannot describe that combined change; use ordinary typed-command admission.
    const {persistenceScope:_scope,personalMemberId:_member,...combined}=result;
    return { ...combined, household: released.household, undo:{...result.undo,snapshot:h,commandKind:'executeHerculesAction'} };
});
/** Cancellation races safely with execution on the same private claim. A cancelled identity cannot later execute. */
export const cancelHerculesSubmission = captureCommand('cancelHerculesSubmission', (h: Household, input: Claim): CommitResult => release(h, input));
