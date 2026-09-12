import { sha256String } from '../core/synchronousHash.ts';
/** One proposal has one posting identity across reviews, devices and lost acknowledgements. */
export function workspaceConfirmationId(projectId: string, proposalId: string): string {
  const hex=sha256String(JSON.stringify(['hercules-workspace-action-v1',projectId,proposalId])).slice(0,32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-4${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
}
