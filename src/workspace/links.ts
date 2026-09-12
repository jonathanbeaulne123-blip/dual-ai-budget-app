import type { Household, LedgerView } from '../core/types.ts';
import { currentPlanVersion } from '../core/planSystem.ts';
import { householdForView } from '../core/visibility.ts';
import { projectPlan, planSelectionForVersion } from '../core/planProjection.ts';
import { monthEndKey } from '../core/calendar.ts';
import type { ProjectLink, WorkspaceProject } from './contracts.ts';
export function workspaceRecordOptions(household: Household, memberId: string): ProjectLink[] {
  const result: ProjectLink[] = [];
  for (const scope of ['personal', 'household'] as const) {
    const h = householdForView(household, memberId, scope);
    for (const p of household.planVersions ?? []) {
      if (p.scope !== scope || p.scope === 'personal' && p.ownerMemberId !== memberId || p.state === 'superseded') continue;
      for (const line of p.lines) result.push({ id: `link-${scope}-${p.monthKey}-${line.id}`, kind: 'plan-line', recordId: line.id, scope, month: p.monthKey, label: line.labelSnapshot });
    }
    for (const goal of h.goals) result.push({ id: `link-${goal.id}`, kind: 'kitty-bank', recordId: goal.id, scope, label: goal.name });
    for (const event of h.nativeEvents ?? []) if (!event.deleted) result.push({ id: `link-${event.id}`, kind: 'calendar-event', recordId: event.id, scope, label: event.title });
    for (const task of h.tasks ?? []) if (!task.deleted) result.push({ id: `link-${task.id}`, kind: 'board-task', recordId: task.id, scope, label: task.title });
  }
  return [...new Map(result.map(r => [r.id, r])).values()];
}
/** Every amount remains a projection over one accepted monthly Plan, never a project-owned total. */
export function projectMonthlyImplications(p: WorkspaceProject, h: Household, memberId: string, scope: LedgerView, month: string, today: string) {
  if (p.ownerMemberId !== memberId) return null;
  const ids = new Set(p.links.filter(l => l.kind === 'plan-line' && l.scope === scope && l.month === month).map(l => l.recordId));
  if (!ids.size) return { status: 'uncommitted' as const, contributionCents: null, backedCents: null, estimatedCents: null, next: p.tasks.find(t => !t.done)?.title ?? p.questions[0] ?? 'Keep exploring' };
  const version = currentPlanVersion(h, scope, month, scope === 'personal' ? memberId : undefined);
  if (!version) return { status: 'unavailable' as const, contributionCents: null, backedCents: null, estimatedCents: null, next: 'Review the linked monthly Plan' };
  const through = monthEndKey(month) < today ? today : monthEndKey(month);
  const projection = projectPlan(h, { memberId, scope, acceptedRevision: h.revision, asOf: today, through, selection: planSelectionForVersion(version) });
  const lines = projection.lines.filter(l => ids.has(l.line.id));
  if (projection.kind !== 'ready' || lines.length !== ids.size) return { status: 'unavailable' as const, contributionCents: null, backedCents: null, estimatedCents: null, next: 'Refresh the linked Plan evidence' };
  return { status: version.state === 'proposed' ? 'proposed' as const : 'committed' as const,
    contributionCents: lines.reduce((sum, l) => sum + l.intendedCents, 0), backedCents: lines.reduce((sum, l) => sum + l.coveredNowCents, 0),
    estimatedCents: lines.reduce((sum, l) => sum + l.expectedCoverageCents, 0), next: lines.find(l => l.line.decision?.nextStep)?.line.decision?.nextStep ?? p.tasks.find(t => !t.done)?.title ?? 'Review the monthly commitment' };
}
