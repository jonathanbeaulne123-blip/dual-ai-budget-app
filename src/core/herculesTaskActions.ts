import type { ActionContext, ActionDefinition, ActionField, ActionValues } from './herculesActions.ts';
import { ValidationError } from './types.ts';
import { acknowledgeTask, completeTask, reopenTask, saveTask, taskInView, taskIsFinancial, type TaskEvidence } from './tasks.ts';
import { removeBoardTask, saveBoardTask } from './commands.ts';
import { householdForView } from './visibility.ts';
import { evidenceForTask, suggestedEvidence } from './agenda.ts';
import { formatCad } from './money.ts';

const modernTasks = (c: ActionContext) => (c.household.tasks ?? []).filter(t => !t.deleted && taskInView(t, c.memberId, c.view));
const adoptedId = (id: string) => `TASK-board-${id.replace(/^BOARD-TASK-/, '')}`;
const legacyTasks = (c: ActionContext) => c.view === 'household' ? (c.household.kitchen.boards?.tasks ?? []).filter(t =>
  !c.household.tasks?.some(row => row.id === adoptedId(t.id)) && !c.household.tombstones.some(row => row.id === t.id)) : [];

function receipts(c: ActionContext, taskId: string | undefined): { value: string; label: string; evidence: TaskEvidence }[] {
  const task = modernTasks(c).find(t => t.id === taskId);
  if (!task) return [];
  const visible = householdForView(c.household, c.memberId, c.view);
  const h = { ...visible,
    transactions: visible.transactions.filter(t => !t.isDuplicate && !t.reversalOfId && !visible.transactions.some(r => r.reversalOfId === t.id)
      && (c.view === 'personal' ? t.visibility !== 'household' && t.createdBy === c.memberId : t.visibility !== 'personal')),
    goalContributions: (visible.goalContributions ?? []).filter(t => visible.goals.some(g => g.id === t.goalId && (c.view === 'household' ? g.shared : !g.shared && g.ownerMemberId === c.memberId))),
  };
  const linked = task.moneyLink ? evidenceForTask(h, task) : null;
  const evidence = task.moneyLink ? linked ? [linked] : [] : suggestedEvidence(h, c.memberId, task, c.today);
  return evidence.map(e => ({
    value: e.kind === 'transaction' ? `transaction:${e.transactionId}` : `contribution:${e.contributionId}`,
    label: `${e.date} · ${e.kind === 'transaction' ? h.transactions.find(t => t.id === e.transactionId)?.note || 'Payment' : 'Kitty Bank contribution'} · ${formatCad(e.amountCents)}`,
    evidence: e,
  }));
}

/** Exact responsibility facts appear in the same reviewed action that acknowledges them. */
export function taskAcceptanceReviewRows(c: ActionContext, id: string, v: ActionValues) {
  if (id !== 'accept-task') return [];
  const task = modernTasks(c).find(t => t.id === v.id);
  if (!task) return [];
  const claiming = task.visibility === 'household' && task.assigneeId === null;
  const nextBackup = claiming && task.backupId === c.memberId ? null : task.backupId;
  const name = (memberId: string | null) => c.household.members.find(m => m.id === memberId)?.name ?? 'Unassigned';
  return [
    { label: 'Task details', value: task.notes || 'No additional notes' },
    { label: 'Plan to do', value: task.doDate ?? 'No date chosen' },
    { label: 'Deadline', value: task.dueDate ?? 'No deadline' },
    { label: 'Repeat and cue', value: `${task.repeat} · ${task.cue}` },
    { label: 'Responsibility', value: `${claiming ? `${name(c.memberId)} is taking this unassigned task` : name(task.assigneeId)} · backup: ${nextBackup ? name(nextBackup) : 'None'}` },
    { label: 'Your acceptance', value: name(c.memberId) },
    { label: 'Expected cost', value: task.expectedAmountCents === null ? 'No amount chosen' : formatCad(task.expectedAmountCents) },
    { label: 'Completion', value: taskIsFinancial(task) ? 'Requires matching accepted financial evidence' : 'Recorded by an accepted responsible member' },
  ];
}

/** Existing IDs keep old private drafts readable; adopted board identities require fresh selection. */
export const herculesTaskActions: ActionDefinition[] = (['accept', 'edit', 'complete', 'reopen', 'remove'] as const).map(operation => {
  const verb = { accept: 'Accept', edit: 'Edit', complete: 'Finish', reopen: 'Reopen', remove: 'Remove' }[operation];
  const fields: ActionField[] = [{ key: 'id', label: 'To-do', question: 'Which to-do?', choices: c => [
    ...modernTasks(c).filter(t => operation === 'accept' ? !t.completedAt && !t.acknowledgedBy.includes(c.memberId) && !t.participation?.some(p => p.memberId === c.memberId && p.paused) && (t.visibility === 'personal' || t.assigneeId === null || t.assigneeId === c.memberId || t.backupId === c.memberId) : operation === 'complete' ? !t.completedAt : operation === 'reopen' ? !!t.completedAt : true).map(t => ({ value: t.id, label: t.title })),
    ...(operation === 'accept' ? [] : legacyTasks(c)).filter(t => operation === 'complete' ? !t.completed : operation === 'reopen' ? t.completed : true).map(t => ({ value: t.id, label: `${t.title} · board` })),
  ] }];
  if (operation === 'edit') fields.push(
    { key: 'title', label: 'Title', question: 'What should it say?', maxLength: 240 },
    { key: 'dueDate', label: 'Due date', question: 'Enter a new due date, or leave it blank to keep the current date.', kind: 'date', optional: true },
    { key: 'clearDueDate', label: 'Remove deadline', question: 'Should I remove the current deadline?', optional: true, choices: () => [{ value: 'yes', label: 'Remove the deadline' }] },
  );
  return {
    id: `${operation}-task`, title: `${verb} a to-do`, example: `${verb} a to-do`,
    match: new RegExp(`\\b${operation === 'accept' ? '(?:accept|take)' : operation === 'complete' ? '(?:complete|finish)' : operation === 'edit' ? '(?:edit|change|update)' : operation === 'remove' ? '(?:remove|delete)' : 'reopen'} (?:a |the |my |our )?(?:task|to.do)\\b`, 'i'),
    views: ['household', 'personal'], fields,
    dynamicFields: (c, v) => operation === 'complete' && modernTasks(c).some(t => t.id === v.id && taskIsFinancial(t)) ? [{
      key: 'evidence', label: 'Accepted completion evidence', question: 'Which accepted payment or contribution completed this task?', choices: () => receipts(c, v.id),
    }] : [],
    consequence: operation === 'accept' ? 'Accept this exact task for yourself. Its work, dates and responsibility are shown in this review. This does not complete it or move money.'
      : operation === 'complete' ? 'Complete this to-do using its existing rules. A money task needs an accepted receipt; no money is posted.'
      : operation === 'reopen' ? 'Reopen this occurrence. Its later repeating tasks and accepted money stay in place.'
      : operation === 'remove' ? 'Remove this to-do from the planner, preserving its accepted money and linked records.'
      : 'Update the supplied task details, preserving its owner, links and other work.',
    dependencies: (c, v) => ({ task: modernTasks(c).find(t => t.id === v.id), legacy: legacyTasks(c).find(t => t.id === v.id),
      evidence: v.evidence ? receipts(c, v.id).find(r => r.value === v.evidence) : undefined }),
    execute: (c: ActionContext, v: ActionValues) => {
      const task = modernTasks(c).find(t => t.id === v.id);
      if (task) {
        const base = { memberId: c.memberId, id: task.id, expectedRevision: task.revision };
        if (operation === 'accept') return acknowledgeTask(c.household, base);
        if (operation === 'complete') {
          const evidence = v.evidence ? receipts(c, v.id).find(r => r.value === v.evidence)?.evidence : undefined;
          if (v.evidence && !evidence) throw new ValidationError('Choose current completion evidence in these books.');
          return completeTask(c.household, { ...base, evidence });
        }
        if (operation === 'reopen') return reopenTask(c.household, base);
        const { version: _version, id: _id, revision: _revision, createdBy: _createdBy, createdAt: _createdAt, updatedAt: _updatedAt, ...value } = task;
        return saveTask(c.household, { ...base, task: { ...value, ...(operation === 'remove' ? { deleted: true } : {
          title: v.title!, dueDate: v.clearDueDate === 'yes' ? null : v.dueDate || task.dueDate,
        }) } });
      }
      const old = legacyTasks(c).find(t => t.id === v.id);
      if (!old || operation === 'accept') throw new ValidationError('This to-do changed or moved into the planner. Select its current version and review again.');
      const base = { memberId: c.memberId, id: old.id, expectedVersion: old.version };
      if (operation === 'remove') return removeBoardTask(c.household, base);
      return saveBoardTask(c.household, { ...base, title: operation === 'edit' ? v.title! : old.title,
        dueDate: operation === 'edit' ? v.clearDueDate === 'yes' ? null : v.dueDate || old.dueDate : old.dueDate,
        assigneeId: old.assigneeId, completed: operation === 'complete' ? true : operation === 'reopen' ? false : old.completed });
    },
  };
});
