/** Workspace data is deliberately outside Household, Plan digests and ledger hashes. */
export const WORKSPACE_VERSION = 1;
export const WORKSPACE_INPUT_LIMIT = 32_000;
export const WORKSPACE_ARTIFACT_LIMIT = 500_000;
export type WorkspaceScope = 'personal' | 'household';
export type EvidenceOrigin = 'ledger' | 'projection' | 'user-estimate' | 'external' | 'hypothetical';
export type WorkspaceEvidence = {
  id: string; origin: EvidenceOrigin; scope: WorkspaceScope | 'public'; title: string;
  source: string; sourceVersion: string; observedAt: string; expiresAt?: string; excerpt?: string;
};
export type ProjectLink = {
  id: string; kind: 'plan-line' | 'kitty-bank' | 'calendar-event' | 'board-task' | 'record';
  recordId: string; scope: WorkspaceScope; month?: string; label: string;
};
export type WorkspaceMessage = { id: string; role: 'user' | 'assistant'; text: string; createdAt: string; runId?: string; evidenceIds?: string[] };
export type ArtifactFormat = 'markdown' | 'csv' | 'html' | 'python' | 'json';
export type ArtifactVersion = {
  id: string; artifactId: string; title: string; format: ArtifactFormat; content: string;
  parentId: string | null; createdAt: string; author: 'user' | 'hercules';
  evidenceIds: string[]; validation: { status: 'unchecked' | 'passed' | 'failed'; details: string };
};
export type WorkspaceProposal = {
  id: string; revision: number; artifactVersionId: string | null; scope: WorkspaceScope;
  target: 'hearth' | 'google'; actionId: string; values: Record<string, string>;
  status: 'draft' | 'reviewed' | 'submitting' | 'accepted' | 'uncertain' | 'stale';
  receiptId: string | null; reviewedRevision: number | null;
};
export type RunStatus = 'queued' | 'running' | 'paused' | 'waiting' | 'complete' | 'cancelled' | 'superseded' | 'failed';
export type WorkspaceRun = {
  id: string; projectId: string; instructionRevision: number; status: RunStatus;
  grantId: string; scheduledFor?: string; continuationOf?: string; step: number; generation: number; progress: string; createdAt: string; updatedAt: string;
  budget: { maxSteps: number; maxTokens: number; maxDurationMs: number };
  usage: { inputTokens: number; outputTokens: number; toolCalls: number; modelCalls: number };
  checkpoints: Array<{ step: number; tool: string; status: string; at: string }>;
};
export type WorkspaceProject = {
  version: 1; id: string; ownerMemberId: string; visibility: 'private'; title: string;
  goal: string; completionCriteria: string; revision: number; instructionRevision: number;
  createdAt: string; updatedAt: string; decisions: string[]; constraints: string[];
  questions: string[]; tasks: Array<{ id: string; title: string; done: boolean }>;
  publicResearchQueries: string[]; proposedResearchQueries: string[];
  messages: WorkspaceMessage[]; artifacts: ArtifactVersion[]; evidence: WorkspaceEvidence[];
  links: ProjectLink[]; proposals: WorkspaceProposal[]; runs: WorkspaceRun[];
  preferences: { assistance: 'hints' | 'worked-examples' | 'complete'; detail: 'concise' | 'thorough' };
  followUp: { at: string; instruction: string } | null;
};
export type WorkspaceSnapshot = { externalReviews?: Array<{review:import('./external.ts').ExternalWorkspaceReview;receipt:import('./external.ts').ExternalWorkspaceReceipt}>; version: 1; sequence: number; projects: WorkspaceProject[]; executionEnabled: boolean };
export type WorkspaceCommand =
  | { type: 'create'; id: string; title: string }
  | { type: 'message'; text: string; id: string }
  | { type: 'attach'; id: string; filename: string; base64: string }
  | { type: 'research-queries'; queries: string[] }
  | { type: 'edit-artifact'; artifactId: string; parentId: string; content: string; id: string }
  | { type: 'control'; runId: string; action: 'pause' | 'cancel' | 'resume' }
  | { type: 'context'; title: string; goal: string; completionCriteria: string; decisions: string[]; constraints: string[]; questions: string[]; preferences: WorkspaceProject['preferences'] }
  | { type: 'link'; link: ProjectLink; remove?: boolean }
  | { type: 'follow-up'; at: string | null; instruction: string }
  | { type: 'proposal-state'; id: string; status: WorkspaceProposal['status']; receiptId?: string };

export function workspaceText(value: unknown, max = WORKSPACE_INPUT_LIMIT): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new Error(`TEXT_REQUIRED_MAX_${max}`);
  return value;
}
export function workspaceId(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new Error('INVALID_ID');
  return value;
}
export function createWorkspaceProject(id: string, title: string, memberId: string, now: string): WorkspaceProject {
  return { version: 1, id: workspaceId(id), ownerMemberId: memberId, visibility: 'private',
    title: workspaceText(title, 180), goal: '', completionCriteria: '', revision: 0, instructionRevision: 0,
    createdAt: now, updatedAt: now, decisions: [], constraints: [], questions: [], tasks: [], messages: [], publicResearchQueries: [], proposedResearchQueries: [],
    artifacts: [], evidence: [], links: [], proposals: [], runs: [], followUp: null,
    preferences: { assistance: 'complete', detail: 'concise' } };
}
export function latestArtifacts(project: WorkspaceProject): ArtifactVersion[] {
  return [...new Map(project.artifacts.map(a => [a.artifactId, a])).values()];
}
/** Optimistic concurrency is mandatory. Retries reuse command identity at storage layer. */
export function applyWorkspaceCommand(original: WorkspaceProject, command: WorkspaceCommand, expected: number, now: string): WorkspaceProject {
  if (original.version !== 1) throw new Error('WORKSPACE_UPGRADE_REQUIRED');
  if (original.revision !== expected) throw new Error('WORKSPACE_CHANGED');
  const p = structuredClone(original);
  const steer = () => {
    p.instructionRevision++;
    for (const run of p.runs) if (['running', 'queued', 'waiting', 'paused'].includes(run.status)) run.status = 'superseded';
    for (const proposal of p.proposals) if (['draft', 'reviewed', 'submitting', 'uncertain'].includes(proposal.status)) { proposal.status = 'stale'; proposal.reviewedRevision = null; }
  };
  switch (command.type) {
    case 'message':
      if (p.messages.some(m => m.id === command.id) || p.runs.some(r => r.id === command.id)) throw new Error('MESSAGE_EXISTS');
      steer();
      p.messages.push({ id: workspaceId(command.id), role: 'user', text: workspaceText(command.text), createdAt: now });
      if (!p.goal) p.goal = command.text;
      break;
    case 'edit-artifact': {
      if (p.artifacts.some(a => a.id === command.id)) throw new Error('ARTIFACT_EXISTS');
      const latest = latestArtifacts(p).find(a => a.artifactId === command.artifactId);
      if (!latest || latest.id !== command.parentId) throw new Error('ARTIFACT_CHANGED');
      steer();
      p.artifacts.push({ ...latest, id: workspaceId(command.id), parentId: latest.id,
        content: workspaceText(command.content, WORKSPACE_ARTIFACT_LIMIT), author: 'user', createdAt: now,
        validation: { status: 'unchecked', details: 'Manually edited; verify before relying on this version.' } });
      break;
    }
    case 'context':
      steer();
      p.title = workspaceText(command.title, 180);
      for (const key of ['goal', 'completionCriteria'] as const) p[key] = workspaceText(command[key] || 'Not yet decided', 4000);
      for (const key of ['decisions', 'constraints', 'questions'] as const) {
        if (!Array.isArray(command[key]) || command[key].length > 100) throw new Error('CONTEXT_LIMIT');
        p[key] = command[key].map(v => workspaceText(v, 4000));
      }
      if (!['hints', 'worked-examples', 'complete'].includes(command.preferences.assistance) || !['concise', 'thorough'].includes(command.preferences.detail)) throw new Error('INVALID_PREFERENCE');
      p.preferences = command.preferences;
      break;
    case 'research-queries':
      if (!Array.isArray(command.queries) || command.queries.length > 24) throw new Error('QUERY_LIMIT');
      p.publicResearchQueries = command.queries.map(q => workspaceText(q, 500));
      p.proposedResearchQueries = [];
      break;
    case 'control': {
      const run = p.runs.find(r => r.id === command.runId);
      if (!run || run.instructionRevision !== p.instructionRevision || ['complete', 'cancelled', 'superseded'].includes(run.status)) throw new Error('RUN_CHANGED');
      run.status = command.action === 'cancel' ? 'cancelled' : command.action === 'pause' ? 'paused' : 'queued';
      run.generation++;
      run.updatedAt = now;
      break;
    }
    case 'link':
      if (!['plan-line', 'kitty-bank', 'calendar-event', 'board-task', 'record'].includes(command.link.kind) || !['personal', 'household'].includes(command.link.scope)) throw new Error('INVALID_LINK');
      workspaceId(command.link.recordId); workspaceId(command.link.id); workspaceText(command.link.label, 180);
      if (command.link.month && !/^\d{4}-\d{2}$/.test(command.link.month)) throw new Error('INVALID_MONTH');
      p.links = p.links.filter(l => l.id !== command.link.id);
      if (!command.remove) p.links.push(command.link);
      break;
    case 'follow-up':
      for(const run of p.runs)if(run.scheduledFor && run.scheduledFor===p.followUp?.at && ['queued','running','paused','waiting'].includes(run.status)){run.status='cancelled';run.generation++;}
      if (command.at !== null && (!Number.isFinite(Date.parse(command.at)) || Date.parse(command.at) <= Date.parse(now))) throw new Error('FUTURE_DATE_REQUIRED');
      p.followUp = command.at === null ? null : { at: command.at, instruction: workspaceText(command.instruction) };
      break;
    case 'proposal-state': {
      const proposal = p.proposals.find(v => v.id === command.id);
      if (!proposal) throw new Error('PROPOSAL_MISSING');
      // A browser acknowledgement is a display hint only; never authoritative proof.
      if (!['reviewed', 'submitting', 'uncertain'].includes(command.status)) throw new Error('RECEIPT_REQUIRED');
      if (proposal.status === 'stale') throw new Error('PROPOSAL_CHANGED');
      proposal.status = command.status;
      proposal.reviewedRevision = proposal.revision;
      if (command.receiptId && command.receiptId !== proposal.receiptId) throw new Error('RECEIPT_ID_IMMUTABLE');
      break;
    }
    default: throw new Error('INVALID_COMMAND');
  }
  p.revision++; p.updatedAt = now;
  return p;
}

/** Sharing is a new, reviewed copy with no private provenance, graph or history. */
export function disclosedArtifact(version: ArtifactVersion, content: string, title: string) {
  return { title: workspaceText(title, 180), format: version.format, content: workspaceText(content, WORKSPACE_ARTIFACT_LIMIT) };
}
