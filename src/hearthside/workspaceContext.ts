import { sha256String } from '../core/synchronousHash.ts';
import type { ArtifactFormat, WorkspaceProject } from '../workspace/contracts.ts';
import type { PersonalLifeExperience } from './personalLifeContracts.ts';

export type WorkspaceExperienceScope = { identity: string; environment: 'development' | 'production'; householdId: string; memberId: string };
/** Explicit minimum projection. Links, balances, private sources and participant activity never enter it. */
export type WorkspaceExperienceContext =
  | { version: 1; id: string; revision: number; title: string; intention: string;
      state: 'dreaming' | 'preparing' | 'lived' | 'paused' | 'archived'; horizon: 'tonight' | 'season' | 'someday' }
  | { version: 2; audience: 'personal'; ownerMemberId: string; id: string; revision: number; title: string; intention: string;
      state: 'dreaming' | 'preparing' | 'lived' | 'paused' | 'archived'; horizon: 'tonight' | 'season' | 'someday'; livedOn: string | null };
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
  const base=['version','id','revision','title','intention','state','horizon'];
  const v = exactObject(value, value&&typeof value==='object'&&(value as {version?:unknown}).version===2?[...base,'audience','ownerMemberId','livedOn']:base);
  if (![1,2].includes(v.version as number) || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1 || !['dreaming','preparing','lived','paused','archived'].includes(String(v.state)) || !['tonight','season','someday'].includes(String(v.horizon))) throw new Error('INVALID_EXPERIENCE_CONTEXT');
  const common={id:experienceIdentifier(v.id),revision:v.revision as number,title:boundedText(v.title,240),intention:boundedText(v.intention,4000,true),state:v.state as 'dreaming'|'preparing'|'lived'|'paused'|'archived',horizon:v.horizon as 'tonight'|'season'|'someday'};
  if(v.version===1)return {version:1,...common};
  const livedOn=v.livedOn;
  if(v.audience!=='personal' || livedOn!==null && (typeof livedOn!=='string'||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(livedOn)||!Number.isFinite(Date.parse(livedOn+'T12:00:00Z'))||new Date(livedOn+'T12:00:00Z').toISOString().slice(0,10)!==livedOn))throw new Error('INVALID_EXPERIENCE_CONTEXT');
  return {version:2,audience:'personal',ownerMemberId:experienceIdentifier(v.ownerMemberId),...common,livedOn:v.livedOn as string|null};
}
/** Call on a validated accepted experience, never on a caller-supplied household replica at the authority. */
export function workspaceExperienceContext(experience: WorkspaceExperienceContext): WorkspaceExperienceContext {
  return decodeWorkspaceExperienceContext(experience.version===2?experience:{version:1,id:experience.id,revision:experience.revision,title:experience.title,intention:experience.intention,state:experience.state,horizon:experience.horizon});
}
export function personalWorkspaceExperienceContext(experience: PersonalLifeExperience, ownerMemberId: string): WorkspaceExperienceContext {
  if(experience.createdBy!==ownerMemberId)throw new Error('EXPERIENCE_CONTEXT_OWNER_MISMATCH');
  return decodeWorkspaceExperienceContext({version:2,audience:'personal',ownerMemberId,id:experience.id,revision:experience.revision,title:experience.title,intention:experience.intention,state:experience.state,horizon:experience.horizon,livedOn:experience.livedOn});
}
export function workspaceExperienceDigest(context: WorkspaceExperienceContext): string {
  return sha256String(JSON.stringify(decodeWorkspaceExperienceContext(context)));
}
export function workspaceExperienceKey(scope: WorkspaceExperienceScope, experienceId: string, audience: 'household'|'personal'='household'): string {
  if (!['development','production'].includes(scope.environment)) throw new Error('INVALID_EXPERIENCE_SCOPE');
  const values=audience==='personal'
    ? [boundedText(scope.identity,500),scope.environment,experienceIdentifier(scope.householdId),experienceIdentifier(scope.memberId),'personal',experienceIdentifier(experienceId)]
    : [boundedText(scope.identity,500),scope.environment,experienceIdentifier(scope.householdId),experienceIdentifier(scope.memberId),experienceIdentifier(experienceId)];
  return sha256String(JSON.stringify(values));
}
/** Project identity omits local auth identity; the service owns the authenticated member namespace. */
export function workspaceExperienceProjectId(scope: Omit<WorkspaceExperienceScope,'identity'>, experienceId: string, audience: 'household'|'personal'='household'): string {
  const values=audience==='personal'
    ? [scope.environment,experienceIdentifier(scope.householdId),experienceIdentifier(scope.memberId),'personal',experienceIdentifier(experienceId)]
    : [scope.environment,experienceIdentifier(scope.householdId),experienceIdentifier(scope.memberId),experienceIdentifier(experienceId)];
  return 'experience_'+sha256String(JSON.stringify(values));
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
