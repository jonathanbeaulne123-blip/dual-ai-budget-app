import { decodePreparedExperienceArtifact, artifactPublication, assertArtifactPublicationReceipt, type PreparedExperienceArtifact, type ArtifactPublicationReceipt } from '../../src/hearthside/workspacePublication.ts';
import { Agent } from 'agents';
import type { Scope } from '../../src/ledgerSync/protocol.ts';
import { workspaceId, workspaceText, type ArtifactFormat } from '../../src/workspace/contracts.ts';
import type { DurableObjectStorage } from '@cloudflare/workers-types';
import { SharedWorkspaceArchive, type SharedWorkspaceArchiveEnv } from './sharedArchive.ts';
import { SharedWorkspaceArchiveStorage } from './sharedArchiveStorage.ts';
export type SharedWorkspaceArtifact = { id: string; title: string; format: ArtifactFormat; content: string; sharedBy: string; sharedAt: string };
/** Different DO namespace and schema: no private context, source graph or conversation can be broadcast here. */
export class HerculesSharedWorkspace extends Agent<SharedWorkspaceArchiveEnv> {
  private archive!: SharedWorkspaceArchive;
  private copies!: SharedWorkspaceArchiveStorage;
  private archiveLane: Promise<void> = Promise.resolve();
  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS shared_experience_artifacts (id TEXT PRIMARY KEY,data TEXT NOT NULL)`;
    this.sql`CREATE INDEX IF NOT EXISTS shared_experience_lookup ON shared_experience_artifacts(json_extract(data,'$.experienceId'),json_extract(data,'$.state'),id)`;
    this.sql`CREATE TABLE IF NOT EXISTS shared_workspace_owner (id TEXT PRIMARY KEY)`;
    this.sql`CREATE TABLE IF NOT EXISTS shared_workspace_artifacts (id TEXT PRIMARY KEY, data TEXT NOT NULL)`;
    this.copies = new SharedWorkspaceArchiveStorage(this.ctx.storage as unknown as DurableObjectStorage);
    this.archive = new SharedWorkspaceArchive(this.copies, this.env.HERCULES_FILES);
  }
  private check(scope: Scope) {
    if (!scope.subject || !scope.memberId || scope.environment !== 'development' || !Number.isFinite(scope.expires) || scope.expires <= Date.now()) throw new Error('UNAUTHENTICATED');
    const key = `${scope.environment}/${scope.householdId}`;
    const row = this.sql<{ id: string }>`SELECT id FROM shared_workspace_owner`[0];
    if (row && row.id !== key) throw new Error('FORBIDDEN');
  }
  /** This lane has no household RPC callbacks. It may safely be awaited by an
   * authority writer. A success is never returned before the private archive. */
  private durable<T>(scope: Scope, action: () => T): Promise<T> {
    const result = this.archiveLane.catch(() => {}).then(async () => {
      this.check(scope); await this.archive.ready(scope); this.check(scope);
      const value = action(); await this.archive.flush(scope); this.check(scope); return value;
    });
    this.archiveLane = result.then(() => {}, () => {}); return result;
  }
  /** Trusted explicit RPC only. Not part of the browser Workspace command route. */
  async restoreSharedCopiesFromArchive(scope: Scope, maxEntries = 32) {
    const result = this.archiveLane.catch(() => {}).then(async () => {
      this.check(scope); const restored = await this.archive.restoreLatest(scope, maxEntries); this.check(scope); return restored;
    });
    this.archiveLane = result.then(() => {}, () => {}); return result;
  }
  async disclose(scope: Scope, input: { id: string; title: string; format: ArtifactFormat; content: string }) {
    return this.durable(scope, () => {
    this.check(scope);
    workspaceId(input.id); workspaceText(input.title, 180); workspaceText(input.content, 500000);
    if (!['markdown', 'html', 'csv', 'python', 'json'].includes(input.format)) throw new Error('INVALID_FORMAT');
    const existing = this.sql<{ data: string }>`SELECT data FROM shared_workspace_artifacts WHERE id=${input.id}`[0];
    if (existing) {
      const old = JSON.parse(existing.data) as SharedWorkspaceArtifact;
      if (old.sharedBy !== scope.memberId || old.title !== input.title || old.format !== input.format || old.content !== input.content) throw new Error('DISCLOSURE_ID_REUSED');
      return old;
    }
    const copy: SharedWorkspaceArtifact = { id: input.id, title: input.title, format: input.format, content: input.content, sharedBy: scope.memberId, sharedAt: new Date().toISOString() };
    this.copies.put('legacy', copy.id, copy);
    return copy;
    });
  }
  private readExperienceCopy(scope:Scope,id:string){
    this.check(scope);workspaceId(id);const row=this.sql<{data:string}>`SELECT data FROM shared_experience_artifacts WHERE id=${id}`[0];
    if(!row)return null;const copy=decodePreparedExperienceArtifact(JSON.parse(row.data));if(copy.sharedBy!==scope.memberId)throw new Error('ARTIFACT_SOURCE_FORBIDDEN');return copy;
  }
  async preparedExperienceFor(scope:Scope,id:string){return this.durable(scope,()=>this.readExperienceCopy(scope,id));}
  async prepareExperience(scope:Scope,input:PreparedExperienceArtifact){
    return this.durable(scope,()=>{
    this.check(scope);const copy=decodePreparedExperienceArtifact(input);if(copy.sharedBy!==scope.memberId||copy.state!=='prepared')throw new Error('ARTIFACT_SOURCE_FORBIDDEN');
    const existing=this.readExperienceCopy(scope,copy.id);this.check(scope);
    if(existing){if(existing.contentDigest!==copy.contentDigest)throw new Error('DISCLOSURE_ID_REUSED');return existing;}
    this.copies.put('experience',copy.id,copy);return copy;
    });
  }
  async activateExperience(scope:Scope,id:string,receipt:ArtifactPublicationReceipt){
    return this.durable(scope,()=>{
    this.check(scope);const copy=this.readExperienceCopy(scope,id);this.check(scope);if(!copy||copy.state==='withdrawn')throw new Error('ARTIFACT_WITHDRAWN');
    assertArtifactPublicationReceipt(receipt,artifactPublication(copy));
    this.copies.put('experience',id,{...copy,state:'active'});
    });
  }
  async revokeExperience(scope:Scope,id:string){
    return this.durable(scope,()=>{
    this.check(scope);const copy=this.readExperienceCopy(scope,id);this.check(scope);if(!copy)throw new Error('ARTIFACT_SOURCE_FORBIDDEN');
    const revoked={...copy,state:'withdrawn' as const};this.copies.put('experience',id,revoked);return revoked;
    });
  }
  async experienceCopyFor(scope:Scope,experienceId:string,id:string){return this.durable(scope,()=>{this.check(scope);workspaceId(id);const row=this.sql<{data:string}>`SELECT data FROM shared_experience_artifacts WHERE id=${id}`[0];if(!row)return null;const copy=decodePreparedExperienceArtifact(JSON.parse(row.data));return copy.experienceId===experienceId&&copy.state==='active'?copy:null;});}
  async experienceCopiesFor(scope:Scope,experienceId:string,after=''){
    return this.durable(scope,()=>{
    this.check(scope);if(after)workspaceId(after);
    return this.sql<{data:string}>`SELECT data FROM shared_experience_artifacts WHERE json_extract(data,'$.experienceId')=${experienceId} AND json_extract(data,'$.state')='active' AND id>${after} ORDER BY id LIMIT 4`.map(row=>decodePreparedExperienceArtifact(JSON.parse(row.data)));
    });
  }
  async listFor(scope: Scope) { return this.durable(scope,()=>{this.check(scope); return this.sql<{ data: string }>`SELECT data FROM shared_workspace_artifacts`.map(row => JSON.parse(row.data) as SharedWorkspaceArtifact);}); }
}
