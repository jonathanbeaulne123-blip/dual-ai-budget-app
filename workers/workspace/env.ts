import type { HerculesWorkspace } from './service.ts';
import type { HerculesSharedWorkspace } from './shared.ts';
import type { DurableObjectId, Workflow, R2Bucket } from '@cloudflare/workers-types/index.ts';
import type { getAgentByName } from 'agents';
import type { getSandbox } from '@cloudflare/sandbox';
import type { HerculesSandbox } from './sandbox.ts';
import type { Scope } from '../../src/ledgerSync/protocol.ts';
import type { AuthEnv } from '../ledgerSyncAuth.ts';
export type WorkspaceEnv = AuthEnv & {
  // Use each SDK's binding type. Mixing imported and ambient Cloudflare RPC
  // namespaces creates incompatible stream/stub types under the Worker compiler.
  HERCULES_WORKSPACES: Parameters<typeof getAgentByName<WorkspaceEnv, HerculesWorkspace>>[0];
  HERCULES_SHARED_WORKSPACES: Parameters<typeof getAgentByName<{}, HerculesSharedWorkspace>>[0];
  HERCULES_RUNS: Workflow<{ workspace: string; projectId: string; runId: string; attempt: string; startAt?: string }>;
  HERCULES_FILES: R2Bucket;
  HERCULES_SANDBOX: Parameters<typeof getSandbox<HerculesSandbox>>[0];
  LEDGER_ROOMS: { idFromName(name: string): DurableObjectId; get(id: DurableObjectId): {
    resolveReceipt(scope: Scope, id: string): Promise<{version:number;receipt?:{id:string;actor:string;commandKind:string;postedIds:string[]}}>;
    workspaceQuery(scope: Scope, query: { name: string; args: Record<string, unknown>; view: 'personal' | 'household' }): Promise<Record<string, unknown>>;
  } };
  HERCULES_WORKSPACE_ENABLED?: string; HERCULES_WORKSPACE_EXECUTION?: string;
  HERCULES_WORKSPACE_MODEL?: string; HERCULES_WORKSPACE_DISCLOSURE?: string;
  HERCULES_WORKSPACE_DATA?: string; GEMINI_API_KEY?: string; BRAVE_SEARCH_API_KEY?: string;
  HERCULES_WORKSPACE_GOOGLE_WRITES?: string;
};
