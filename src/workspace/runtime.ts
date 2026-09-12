import { latestArtifacts, type WorkspaceProject, type WorkspaceRun } from './contracts.ts';
export const FLASH_MODEL = 'gemini-3.8-flash';
export const DEFAULT_RUN_BUDGET = { maxSteps: 24, maxTokens: 120_000, maxDurationMs: 30 * 60_000 };
export type ModelPart = { text?: string; functionCall?: { id?: string; name?: string; args?: Record<string, unknown> }; functionResponse?: { id?: string; name: string; response: Record<string, unknown> }; thoughtSignature?: string; [key: string]: unknown };
export type ModelContent = { role: string; parts: ModelPart[] };
export type ModelTurn = { content: ModelContent; inputTokens: number; outputTokens: number };
export function runCanAdvance(project: WorkspaceProject, run: WorkspaceRun, now = Date.now()): boolean {
  return project.instructionRevision === run.instructionRevision && ['queued', 'running'].includes(run.status)
    && run.step < run.budget.maxSteps && run.usage.inputTokens + run.usage.outputTokens < run.budget.maxTokens
    && now - Date.parse(run.createdAt) < run.budget.maxDurationMs;
}
/** Bounded navigation packet. Originals remain available through project_read. */
export function projectContext(project: WorkspaceProject): string {
  const bounded = <T,>(values:T[],limit:number) => {let left=limit;return values.filter(value=>{const length=JSON.stringify(value).length;if(length>left)return false;left-=length;return true;});};
  const manifest = project.messages.map(m => ({ id: m.id, role: m.role, length: m.text.length }));
  const messages=bounded([...project.messages].reverse(),65000).reverse();
  const omitted=manifest.filter(m=>!messages.some(x=>x.id===m.id));
  return JSON.stringify({ goal:project.goal.length<=4000?project.goal:{retrieve:'context',length:project.goal.length}, completionCriteria:project.completionCriteria,
    constraints:bounded(project.constraints,8000),decisions:bounded(project.decisions,8000),questions:bounded(project.questions,4000),
    tasks:bounded(project.tasks,6000),preferences:project.preferences,links:bounded(project.links,5000),
    proposals:bounded([...project.proposals].reverse(),8000), approvedPublicQueries:project.publicResearchQueries,
    artifacts:bounded(latestArtifacts(project).reverse().map(a=>({id:a.id,artifactId:a.artifactId,title:a.title,format:a.format,parentId:a.parentId,length:a.content.length,validation:a.validation.status})),8000),
    sources:bounded([...project.evidence].reverse().map(({excerpt:_excerpt,...source})=>source),8000),messages,
    conversationManifest:bounded(manifest.slice(-100),6000), omittedMessageIds:omitted.slice(-100).map(m=>m.id),omittedMessageCount:omitted.length,
    contextCounts:{constraints:project.constraints.length,decisions:project.decisions.length,questions:project.questions.length,tasks:project.tasks.length,sources:project.evidence.length,artifacts:project.artifacts.length},
    instruction:'This is a bounded navigation summary, not the whole project. Use project_read id=context for complete decisions, tasks, links and proposals; id=sources for all evidence; id=artifacts for the artifact manifest. Read omitted messages and artifact content by id or search query. Originals remain available through pagination. Old financial amounts require fresh Hearth reads.' });
}
export function adaptiveEffort(project: WorkspaceProject, run: WorkspaceRun): 'low' | 'medium' | 'high' {
  if (project.preferences.detail === 'thorough' || run.step > 5) return 'high';
  return (project.messages.at(-1)?.text.length ?? 0) < 160 && !project.artifacts.length ? 'low' : 'medium';
}
export function newWorkspaceRun(project: WorkspaceProject, id: string, grantId: string, now: string): WorkspaceRun {
  return { id, projectId: project.id, instructionRevision: project.instructionRevision, status: 'queued', grantId,
    step: 0, generation: 0, progress: 'Getting ready', createdAt: now, updatedAt: now, budget: { ...DEFAULT_RUN_BUDGET },
    usage: { inputTokens: 0, outputTokens: 0, toolCalls: 0, modelCalls: 0 }, checkpoints: [] };
}
