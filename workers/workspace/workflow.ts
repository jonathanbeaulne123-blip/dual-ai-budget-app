/// <reference path="../ledger-platform.d.ts" />
import { WorkflowEntrypoint, type WorkflowEvent, type WorkflowStep } from 'cloudflare:workers';
import { getAgentByName } from 'agents';
import type { WorkspaceEnv } from './env.ts';
type Params = { workspace: string; projectId: string; runId: string; attempt: string; startAt?: string };
export class HerculesRunWorkflow extends WorkflowEntrypoint<WorkspaceEnv, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const params = event.payload;
    if (params.startAt) await step.sleepUntil('scheduled-follow-up', new Date(params.startAt));
    const agent = await getAgentByName(this.env.HERCULES_WORKSPACES, params.workspace);
    try { for (let index = 0; index < 256; index++) {
      const result = await step.do(`work-${index}`, { retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' }, timeout: '5 minutes' }, async () => {
        const value = await agent.advance(params.projectId, params.runId, `${params.attempt}-${index}`);
        return { continue: value.continue };
      });
      if (!result.continue) return { status: 'checkpointed', runId: params.runId };
    }
    } catch { await agent.pauseInterruptedRun(params.projectId,params.runId,params.attempt);return {status:'paused',runId:params.runId}; }
    return { status: 'budget-reached', runId: params.runId };
  }
}
