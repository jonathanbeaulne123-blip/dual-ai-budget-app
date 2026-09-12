import { Agent } from 'agents';
import type { Scope } from '../../src/ledgerSync/protocol.ts';
import { workspaceId, workspaceText, type ArtifactFormat } from '../../src/workspace/contracts.ts';
export type SharedWorkspaceArtifact = { id: string; title: string; format: ArtifactFormat; content: string; sharedBy: string; sharedAt: string };
/** Different DO namespace and schema: no private context, source graph or conversation can be broadcast here. */
export class HerculesSharedWorkspace extends Agent {
  onStart() {
    this.sql`CREATE TABLE IF NOT EXISTS shared_workspace_owner (id TEXT PRIMARY KEY)`;
    this.sql`CREATE TABLE IF NOT EXISTS shared_workspace_artifacts (id TEXT PRIMARY KEY, data TEXT NOT NULL)`;
  }
  private check(scope: Scope) {
    if (scope.environment !== 'development' || !Number.isFinite(scope.expires) || scope.expires <= Date.now()) throw new Error('UNAUTHENTICATED');
    const key = `${scope.environment}/${scope.householdId}`;
    const row = this.sql<{ id: string }>`SELECT id FROM shared_workspace_owner`[0];
    if (row && row.id !== key) throw new Error('FORBIDDEN');
    if (!row) this.sql`INSERT INTO shared_workspace_owner VALUES (${key})`;
  }
  async disclose(scope: Scope, input: { id: string; title: string; format: ArtifactFormat; content: string }) {
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
    this.sql`INSERT INTO shared_workspace_artifacts VALUES (${copy.id},${JSON.stringify(copy)})`;
    return copy;
  }
  async listFor(scope: Scope) { this.check(scope); return this.sql<{ data: string }>`SELECT data FROM shared_workspace_artifacts`.map(row => JSON.parse(row.data) as SharedWorkspaceArtifact); }
}
