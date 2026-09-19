import type {Scope} from '../ledgerSync/protocol.ts';
import { applyWorkspaceCommand, createWorkspaceProject, type WorkspaceCommand, type WorkspaceProject } from '../workspace/contracts.ts';
import { bindWorkspaceExperience, decodeWorkspaceExperienceContext, workspaceExperienceDigest, workspaceExperienceProjectId, type WorkspaceExperienceContext, type WorkspaceExperienceReference } from './workspaceContext.ts';
import { decodePreparedExperienceArtifact, type ArtifactPublication, type ArtifactPublicationReceipt, type PreparedExperienceArtifact, type ArtifactPublicationScope } from './workspacePublication.ts';
/** Authority supplies acceptedContext after its authenticated household membership check. */
export function createExperienceWorkspaceProject(scope:ArtifactPublicationScope,id:string,input:WorkspaceExperienceContext,confirmDigest:string,acceptedContext:WorkspaceExperienceContext,now:string):WorkspaceProject {
  const context=decodeWorkspaceExperienceContext(input), accepted=decodeWorkspaceExperienceContext(acceptedContext);
  if(context.version===2&&context.ownerMemberId!==scope.memberId)throw new Error('EXPERIENCE_PROJECT_SCOPE_MISMATCH');
  if(workspaceExperienceProjectId(scope,context.id,context.version===2?'personal':'household')!==id)throw new Error('EXPERIENCE_PROJECT_SCOPE_MISMATCH');
  if(workspaceExperienceDigest(context)!==confirmDigest || workspaceExperienceDigest(accepted)!==confirmDigest)throw new Error('EXPERIENCE_CONTEXT_CHANGED');
  const project=createWorkspaceProject(id,context.title.slice(0,180),scope.memberId,now);project.experience=bindWorkspaceExperience(context);return project;
}
export function assertAcceptedWorkspaceExperience(project:WorkspaceProject,accepted:WorkspaceExperienceContext):void {
  if(!project.experience || workspaceExperienceDigest(accepted)!==project.experience.digest)throw new Error('EXPERIENCE_CONTEXT_CHANGED');
}
export function experienceCommandNeedsFreshContext(command:WorkspaceCommand):boolean {
  return command.type==='refresh-experience' || command.type==='approve-experience-disclosure' || command.type==='message' || command.type==='follow-up' && !!command.at || command.type==='control' && command.action==='resume';
}

export interface WorkspaceHearthsideAuthority {
  workspaceExperience(scope:Scope,reference:WorkspaceExperienceReference):Promise<WorkspaceExperienceContext>;
  workspaceAcceptArtifact(scope:Scope,publication:ArtifactPublication):Promise<ArtifactPublicationReceipt>;
  workspaceWithdrawArtifact(scope:Scope,publication:ArtifactPublication):Promise<ArtifactPublicationReceipt>;
}
export function adoptReviewedExperienceCopy(project:WorkspaceProject,copy:PreparedExperienceArtifact,command:Extract<WorkspaceCommand,{type:'adopt-experience-copy'}>,expectedRevision:number,now:string):WorkspaceProject {
  const selected=decodePreparedExperienceArtifact(copy);
  if(!project.experience || project.experience.context.version===2 || selected.experienceId!==project.experience.context.id || selected.state!=='active')throw new Error('ARTIFACT_SOURCE_FORBIDDEN');
  if(command.copyId!==selected.id || command.contentDigest!==selected.contentDigest)throw new Error('DISCLOSURE_REVIEW_CHANGED');
  const result=applyWorkspaceCommand(project,{type:'create-artifact',id:command.id,title:selected.title,format:selected.format,content:selected.content},expectedRevision,now);
  result.evidence.push({id:command.id,origin:'user-estimate',scope:'household',title:'Reviewed shared copy: '+selected.title,source:'shared-artifact:'+selected.id,sourceVersion:selected.contentDigest,observedAt:now});
  result.artifacts.at(-1)!.evidenceIds=[command.id];return result;
}
