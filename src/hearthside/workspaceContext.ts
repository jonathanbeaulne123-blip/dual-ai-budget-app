import { sha256String } from '../core/synchronousHash.ts';
import type { ArtifactFormat, WorkspaceProject } from '../workspace/contracts.ts';

export type WorkspaceExperienceScope = { identity: string; environment: 'development' | 'production'; householdId: string; memberId: string };
/** Explicit minimum projection. Links, balances, private sources and participant activity never enter it. */
export type WorkspaceExperienceContext = { version: 1; id: string; revision: number; title: string; intention: string;
  state: 'dreaming' | 'preparing' | 'lived' | 'paused' | 'archived'; horizon: 'tonight' | 'season' | 'someday' };
export type WorkspaceExperienceBinding = { context: WorkspaceExperienceContext; digest: string; providerApprovalDigest: string | null };
export function exactObject(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new Error('INVALID_EXPERIENCE_CONTEXT');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(value).some(k => typeof k !== 'string' || !keys.includes(k)) || keys.some(k => !descriptors[k] || !('value' in descriptors[k]!))) throw new Error('INVALID_EXPERIENCE_CONTEXT');
  return value as Record<string, unknown>;
}
export function experienceIdentifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(value)) throw new Error('INVALID_EXPERIENCE_ID');
  return value;
}
export function boundedText(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length > max) throw new Error('INVALID_EXPERIENCE_TEXT');
  return value;
}
export function decodeWorkspaceExperienceContext(value: unknown): WorkspaceExperienceContext {
  const v = exactObject(value, ['version','id','revision','title','intention','state','horizon']);
  if (v.version !== 1 || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1 || !['dreaming','preparing','lived','paused','archived'].includes(String(v.state)) || !['tonight','season','someday'].includes(String(v.horizon))) throw new Error('INVALID_EXPERIENCE_CONTEXT');
  return {version:1,id:experienceIdentifier(v.id),revision:v.revision as number,title:boundedText(v.title,240),intention:boundedText(v.intention,4000,true),state:v.state as WorkspaceExperienceContext['state'],horizon:v.horizon as WorkspaceExperienceContext['horizon']};
}
/** Call on a validated accepted experience, never on a caller-supplied household replica at the authority. */
export function workspaceExperienceContext(experience: WorkspaceExperienceContext): WorkspaceExperienceContext {
  return decodeWorkspaceExperienceContext({version:1,id:experience.id,revision:experience.revision,title:experience.title,intention:experience.intention,state:experience.state,horizon:experience.horizon});
}
export function workspaceExperienceDigest(context: WorkspaceExperienceContext): string {
  return sha256String(JSON.stringify(decodeWorkspaceExperienceContext(context)));
}
export function workspaceExperienceKey(scope: WorkspaceExperienceScope, experienceId: string): string {
  if (!['development','production'].includes(scope.environment)) throw new Error('INVALID_EXPERIENCE_SCOPE');
  return sha256String(JSON.stringify([boundedText(scope.identity,500),scope.environment,experienceIdentifier(scope.householdId),experienceIdentifier(scope.memberId),experienceIdentifier(experienceId)]));
}
/** Project identity omits local auth identity; the service owns the authenticated member namespace. */
export function workspaceExperienceProjectId(scope: Omit<WorkspaceExperienceScope,'identity'>, experienceId: string): string {
  return 'experience_'+sha256String(JSON.stringify([scope.environment,experienceIdentifier(scope.householdId),experienceIdentifier(scope.memberId),experienceIdentifier(experienceId)]));
}
export function bindWorkspaceExperience(context: WorkspaceExperienceContext): WorkspaceExperienceBinding {
  const selected = decodeWorkspaceExperienceContext(context);
  return {context:selected,digest:workspaceExperienceDigest(selected),providerApprovalDigest:null};
}
export function decodeWorkspaceExperienceBinding(value: unknown): WorkspaceExperienceBinding {
  const v=exactObject(value,['context','digest','providerApprovalDigest']), context=decodeWorkspaceExperienceContext(v.context), digest=workspaceExperienceDigest(context);
  if(v.digest!==digest || v.providerApprovalDigest!==null && v.providerApprovalDigest!==digest)throw new Error('EXPERIENCE_CONTEXT_CHANGED');
  return {context,digest,providerApprovalDigest:v.providerApprovalDigest as string|null};
}
export function requireExperienceDisclosure(project: Pick<WorkspaceProject,'experience'>): void {
  if(!project.experience)return;
  const binding=decodeWorkspaceExperienceBinding(project.experience);
  if(binding.providerApprovalDigest!==binding.digest)throw new Error('EXPERIENCE_DISCLOSURE_REQUIRED');
}
/** Defence in depth used by the provider tool dispatcher, even when a legacy run grant lists broad reads. */
export function assertExperienceToolAccess(project: Pick<WorkspaceProject,'experience'>, tool: string): void {
  if (!project.experience) return;
  requireExperienceDisclosure(project);
  if(tool==='hearth_read')throw new Error('EXPERIENCE_SCOPE_READ_DENIED');
}
export const workspaceArtifactFormats: readonly ArtifactFormat[] = ['markdown','csv','html','python','json'];
