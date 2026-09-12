import { sha256String } from '../core/synchronousHash.ts';
import type { ArtifactFormat, WorkspaceProject } from '../workspace/contracts.ts';
import { latestArtifacts, workspaceId } from '../workspace/contracts.ts';
import { boundedText, exactObject, experienceIdentifier, workspaceArtifactFormats, type WorkspaceExperienceContext } from './workspaceContext.ts';

export type ExperienceArtifactReview = { version:1; id:string; projectId:string; artifactVersionId:string; experienceId:string; experienceRevision:number; title:string; format:ArtifactFormat; content:string };
/** This is the ONLY shared authority projection. Never add the private project/version IDs here. */
export type ArtifactPublication = { version:1; id:string; revision:1; experienceId:string; experienceRevision:number; title:string; format:ArtifactFormat; contentDigest:string; sharedBy:string; state:'accepted'|'active'|'withdrawn' };
export type ArtifactPublicationReceipt = {version:1;id:string;publication:ArtifactPublication;acceptedSequence:number};
export type PreparedExperienceArtifact = {version:1;id:string;experienceId:string;experienceRevision:number;title:string;format:ArtifactFormat;content:string;contentDigest:string;sharedBy:string;state:'prepared'|'active'|'withdrawn'};
export type ArtifactPublicationScope = {environment:'development'|'production';householdId:string;memberId:string};
export function decodeExperienceArtifactReview(value:unknown):ExperienceArtifactReview {
  const v=exactObject(value,['version','id','projectId','artifactVersionId','experienceId','experienceRevision','title','format','content']);
  if(v.version!==1 || !Number.isSafeInteger(v.experienceRevision) || (v.experienceRevision as number)<1 || !workspaceArtifactFormats.includes(v.format as ArtifactFormat))throw new Error('INVALID_ARTIFACT_REVIEW');
  return {version:1,id:workspaceId(v.id),projectId:workspaceId(v.projectId),artifactVersionId:workspaceId(v.artifactVersionId),experienceId:experienceIdentifier(v.experienceId),experienceRevision:v.experienceRevision as number,title:boundedText(v.title,180),format:v.format as ArtifactFormat,content:boundedText(v.content,500000)};
}
export function experienceArtifactReviewDigest(review:ExperienceArtifactReview):string{return sha256String(JSON.stringify(decodeExperienceArtifactReview(review)));}
export function artifactContentDigest(value:Pick<PreparedExperienceArtifact,'id'|'experienceId'|'experienceRevision'|'title'|'format'|'content'|'sharedBy'>):string {
  return sha256String(JSON.stringify([value.id,value.experienceId,value.experienceRevision,value.title,value.format,value.content,value.sharedBy]));
}
export function preparedExperienceArtifact(review:ExperienceArtifactReview,memberId:string):PreparedExperienceArtifact {
  const r=decodeExperienceArtifactReview(review);
  const copy={version:1 as const,id:r.id,experienceId:r.experienceId,experienceRevision:r.experienceRevision,title:r.title,format:r.format,content:r.content,sharedBy:experienceIdentifier(memberId),state:'prepared' as const};
  return {...copy,contentDigest:artifactContentDigest(copy)};
}
export function decodePreparedExperienceArtifact(value:unknown):PreparedExperienceArtifact {
  const v=exactObject(value,['version','id','experienceId','experienceRevision','title','format','content','contentDigest','sharedBy','state']);
  if(v.version!==1 || !Number.isSafeInteger(v.experienceRevision) || (v.experienceRevision as number)<1 || !workspaceArtifactFormats.includes(v.format as ArtifactFormat) || !['prepared','active','withdrawn'].includes(String(v.state)))throw new Error('INVALID_ARTIFACT_COPY');
  const copy:PreparedExperienceArtifact={version:1,id:workspaceId(v.id),experienceId:experienceIdentifier(v.experienceId),experienceRevision:v.experienceRevision as number,title:boundedText(v.title,180),format:v.format as ArtifactFormat,content:boundedText(v.content,500000),contentDigest:String(v.contentDigest),sharedBy:experienceIdentifier(v.sharedBy),state:v.state as PreparedExperienceArtifact['state']};
  if(copy.contentDigest!==artifactContentDigest(copy))throw new Error('ARTIFACT_COPY_CHANGED');return copy;
}
export function artifactPublication(copy:PreparedExperienceArtifact,state:ArtifactPublication['state']='accepted'):ArtifactPublication {
  const c=decodePreparedExperienceArtifact(copy);
  return {version:1,id:c.id,revision:1,experienceId:c.experienceId,experienceRevision:c.experienceRevision,title:c.title,format:c.format,contentDigest:c.contentDigest,sharedBy:c.sharedBy,state};
}
export function decodeArtifactPublication(value:unknown):ArtifactPublication {
  const v=exactObject(value,['version','id','revision','experienceId','experienceRevision','title','format','contentDigest','sharedBy','state']);
  if(v.version!==1 || v.revision!==1 || !Number.isSafeInteger(v.experienceRevision) || (v.experienceRevision as number)<1 || !workspaceArtifactFormats.includes(v.format as ArtifactFormat) || !/^[a-f0-9]{64}$/.test(String(v.contentDigest)) || !['accepted','active','withdrawn'].includes(String(v.state)))throw new Error('INVALID_ARTIFACT_PUBLICATION');
  return {version:1,id:workspaceId(v.id),revision:1,experienceId:experienceIdentifier(v.experienceId),experienceRevision:v.experienceRevision as number,title:boundedText(v.title,180),format:v.format as ArtifactFormat,contentDigest:v.contentDigest as string,sharedBy:experienceIdentifier(v.sharedBy),state:v.state as ArtifactPublication['state']};
}
export function assertArtifactPublicationReceipt(value:unknown,expected:ArtifactPublication):ArtifactPublicationReceipt {
  const v=exactObject(value,['version','id','publication','acceptedSequence']), p=decodeArtifactPublication(v.publication);
  if(v.version!==1 || v.id!==expected.id || !Number.isSafeInteger(v.acceptedSequence) || (v.acceptedSequence as number)<1 || JSON.stringify(p)!==JSON.stringify(decodeArtifactPublication(expected)))throw new Error('ARTIFACT_RECEIPT_MISMATCH');
  return {version:1,id:p.id,publication:p,acceptedSequence:v.acceptedSequence as number};
}
export function validateArtifactSource(project:WorkspaceProject,context:WorkspaceExperienceContext,review:ExperienceArtifactReview,actor:string):void {
  const r=decodeExperienceArtifactReview(review), version=project.artifacts.find(a=>a.id===r.artifactVersionId);
  if(project.ownerMemberId!==actor || project.id!==r.projectId || project.experience?.context.id!==r.experienceId)throw new Error('ARTIFACT_SOURCE_FORBIDDEN');
  if(context.id!==r.experienceId || context.revision!==r.experienceRevision)throw new Error('EXPERIENCE_CONTEXT_CHANGED');
  if(!version || latestArtifacts(project).find(a=>a.artifactId===version.artifactId)?.id!==version.id || version.format!==r.format)throw new Error('ARTIFACT_CHANGED');
}
/** Trusted server ports; never pass client-produced receipts into accept/activate. */
export type ExperiencePublicationPorts = {
  assertCurrent:()=>void;
  claimReview:(id:string,reviewDigest:string)=>Promise<void>;
  prepared:(id:string)=>Promise<PreparedExperienceArtifact|null>;
  validateSource:(review:ExperienceArtifactReview)=>Promise<void>;
  prepare:(copy:PreparedExperienceArtifact)=>Promise<PreparedExperienceArtifact>;
  accept:(publication:ArtifactPublication)=>Promise<ArtifactPublicationReceipt>;
  activate:(id:string,receipt:ArtifactPublicationReceipt)=>Promise<void>;
  revoke:(id:string)=>Promise<PreparedExperienceArtifact>;
  withdraw:(publication:ArtifactPublication)=>Promise<ArtifactPublicationReceipt>;
};
export async function publishExperienceArtifact(ports:ExperiencePublicationPorts,scope:ArtifactPublicationScope,input:ExperienceArtifactReview,confirmDigest:string):Promise<ArtifactPublicationReceipt>{
  ports.assertCurrent();const review=decodeExperienceArtifactReview(input);
  if(experienceArtifactReviewDigest(review)!==confirmDigest)throw new Error('DISCLOSURE_REVIEW_CHANGED');
  await ports.claimReview(review.id,confirmDigest);ports.assertCurrent();
  const expected=preparedExperienceArtifact(review,scope.memberId);
  let prepared=await ports.prepared(review.id);ports.assertCurrent();
  if(prepared){prepared=decodePreparedExperienceArtifact(prepared);if(prepared.contentDigest!==expected.contentDigest)throw new Error('DISCLOSURE_ID_REUSED');}
  else{await ports.validateSource(review);ports.assertCurrent();prepared=decodePreparedExperienceArtifact(await ports.prepare(expected));ports.assertCurrent();if(prepared.contentDigest!==expected.contentDigest)throw new Error('ARTIFACT_COPY_CHANGED');}
  if(prepared.state==='withdrawn')throw new Error('ARTIFACT_WITHDRAWN');
  const publication=artifactPublication(prepared), receipt=assertArtifactPublicationReceipt(await ports.accept(publication),publication);ports.assertCurrent();
  await ports.activate(prepared.id,receipt);ports.assertCurrent();return receipt;
}
export async function withdrawExperienceArtifact(ports:ExperiencePublicationPorts,scope:ArtifactPublicationScope,id:string):Promise<ArtifactPublicationReceipt>{
  ports.assertCurrent();const original=await ports.prepared(workspaceId(id));ports.assertCurrent();
  if(!original || original.sharedBy!==scope.memberId)throw new Error('ARTIFACT_WITHDRAWAL_FORBIDDEN');
  const revoked=decodePreparedExperienceArtifact(await ports.revoke(id));ports.assertCurrent();
  if(revoked.contentDigest!==original.contentDigest || revoked.state!=='withdrawn')throw new Error('ARTIFACT_COPY_CHANGED');
  const publication=artifactPublication(revoked,'withdrawn');const receipt=await ports.withdraw(publication);ports.assertCurrent();return assertArtifactPublicationReceipt(receipt,publication);
}
