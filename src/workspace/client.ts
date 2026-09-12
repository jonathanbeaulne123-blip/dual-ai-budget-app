import type { ExperienceArtifactReview, ArtifactPublicationReceipt, PreparedExperienceArtifact } from '../hearthside/workspacePublication.ts';
import type { WorkspaceCommand, WorkspaceSnapshot } from './contracts.ts';
import type { ArtifactDisclosureReview } from './disclosure.ts';
import type { ExternalWorkspaceReview, ExternalWorkspaceReceipt } from './external.ts';
export type WorkspaceRequest = { commandId: string; projectId: string; expectedRevision: number; command: WorkspaceCommand };
export class WorkspaceClient {
  private cached: WorkspaceSnapshot | null = null;
  private generation=0;
  private requests=new Set<AbortController>();
  cancelRequests(){this.generation++;for(const request of this.requests)request.abort();this.requests.clear();}
  constructor(private endpoint: string, private token: () => Promise<string>, private current: () => boolean = () => true) {}
  private async exchange(body?: unknown, after?: number) {
    if (!this.current()) throw new Error('Your Hearth account changed. Reopen this workspace.');
    const generation=this.generation;
    const token = await this.token();
    if (!this.current() || generation!==this.generation) throw new Error('Your Hearth account changed. Reopen this workspace.');
    const controller=new AbortController();this.requests.add(controller);
    const timeout=setTimeout(()=>controller.abort(),30000);
    try{
    const response = await fetch(this.endpoint+(after===undefined?'':`?after=${after}`), { method: body ? 'POST' : 'GET', credentials: 'omit', cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, signal: controller.signal });
    if (!this.current()) throw new Error('Your Hearth account changed. Reopen this workspace.');
    const value = await response.json();
    if(!this.current() || generation!==this.generation)throw new Error('Your Hearth account changed. Reopen this workspace.');
    if (!response.ok) throw new Error(value.error ?? 'WORKSPACE_UNAVAILABLE');
    return value;
    }finally{clearTimeout(timeout);this.requests.delete(controller);}
  }
  async request(body?: WorkspaceRequest): Promise<WorkspaceSnapshot> {
    let value = await this.exchange(body,body?undefined:this.cached?.sequence);
    if(Array.isArray(value.events)){value=value.events.at(-1)?.snapshot??this.cached;if(!value)throw new Error('WORKSPACE_RESYNC_REQUIRED');}
    if (value.version !== 1 || !Array.isArray(value.projects)) throw new Error('WORKSPACE_UPGRADE_REQUIRED');
    this.cached=value;return value;
  }
  async exportFile(projectId: string, versionId: string, format: string): Promise<{ base64: string; filename: string }> {
    return this.exchange({ operation: 'export', projectId, versionId, format });
  }
  async actionReview(projectId:string,proposalId:string):Promise<import('./contracts.ts').WorkspaceProposal>{return this.exchange({operation:'action-review',projectId,proposalId});}
  async authorizeAction(confirmationId:string){return this.exchange({operation:'action-confirm',confirmationId});}
  async share(review: ArtifactDisclosureReview, confirmDigest: string): Promise<{ id: string }> { return this.exchange({ operation: 'share', review, confirmDigest }); }
  async sharedArtifacts(): Promise<Array<{ id: string; title: string; format: string; content: string; sharedBy: string }>> { return this.exchange({ operation: 'shared-artifacts' }); }
  async shareExperience(review:ExperienceArtifactReview,confirmDigest:string):Promise<ArtifactPublicationReceipt>{return this.exchange({operation:'share-experience',review,confirmDigest});}
  async withdrawExperience(id:string):Promise<ArtifactPublicationReceipt>{return this.exchange({operation:'withdraw-experience',id});}
  async experienceArtifacts(experienceId:string,after=''):Promise<PreparedExperienceArtifact[]>{return this.exchange({operation:'experience-artifacts',experienceId,after});}
  async external(review: ExternalWorkspaceReview, confirmDigest: string, googleToken: string): Promise<ExternalWorkspaceReceipt> { return this.exchange({ operation: 'external', review, confirmDigest, googleToken }); }
}
export function workspaceError(error: unknown): string {
  const message = error instanceof Error ? error.message : '';
  if (message === 'WORKSPACE_NOT_ACTIVATED') return 'Your workspace service has not been activated yet. Existing Hercules conversations and guided actions are still available.';
  if (message==='EXPERIENCE_DISCLOSURE_REQUIRED')return 'Review this exact intention context before sending it to an activated Hercules run. Your local writing is still here.';
  if (message==='EXPERIENCE_CONTEXT_CHANGED')return 'This intention changed. Review its current version; your existing work is preserved.';
  if (message === 'WORKSPACE_CHANGED' || message === 'ARTIFACT_CHANGED') return 'This work changed elsewhere. Your text is still here. Reload the current version before saving again.';
  if (/AUTH|FORBIDDEN/.test(message)) return 'Reconnect to your Hearth account to continue. Your saved work stays private.';
  if (message.startsWith('TEXT_REQUIRED_MAX')) return 'That text exceeds the supported limit. Attach it as a working file or split it into parts.';
  return 'Connection interrupted. Your text is still here. Retry to check the original save.';
}
