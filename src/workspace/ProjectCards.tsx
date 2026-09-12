import type { Household, LedgerView } from '../core/types.ts';
import { formatCad } from '../core/money.ts';
import { projectMonthlyImplications } from './links.ts';
import type { WorkspaceProject } from './contracts.ts';
export function WorkspaceProjectCards({ projects, household, memberId, scope, month, today, onOpen }: { projects: WorkspaceProject[]; household: Household; memberId: string; scope: LedgerView; month: string; today: string; onOpen: (id: string) => void }) {
  return <section className="hw-plan-projects" aria-label="Life projects"><h3>Life around this Plan</h3><p>Your private projects, with this month’s financial consequences.</p>{projects.filter(p => p.ownerMemberId === memberId).map(p => {
    const info = projectMonthlyImplications(p, household, memberId, scope, month, today)!;
    return <article key={p.id}><h4>{p.title}</h4><p>{p.goal || 'An intention taking shape'}</p><dl><div><dt>This month · {info.status}</dt><dd>{info.contributionCents === null ? 'No verified commitment linked' : formatCad(info.contributionCents)}</dd></div><div><dt>Covered by current resources</dt><dd>{info.backedCents === null ? 'Not yet established' : formatCad(info.backedCents)}</dd></div><div><dt>Depends on expected money</dt><dd>{info.estimatedCents === null ? 'Still undecided' : formatCad(info.estimatedCents)}</dd></div></dl><p>{info.next}</p><button onClick={() => onOpen(p.id)}>Continue project</button></article>;
  })}</section>;
}
