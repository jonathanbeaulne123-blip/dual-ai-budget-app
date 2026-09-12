import { sha256String } from '../core/synchronousHash.ts';
import { canonical } from '../ledgerSync/patch.ts';
import { workspaceId, workspaceText } from './contracts.ts';
export type ExternalWorkspaceReview = { id: string; projectId: string; proposalId?: string; artifactVersionId?: string;
  action: 'document' | 'spreadsheet' | 'presentation' | 'calendar-event'; title: string; content: string; start?: string; end?: string };
export type ExternalWorkspaceReceipt = { id: string; digest: string; status: 'prepared' | 'submitting' | 'uncertain' | 'accepted'; error?: string; remoteId?: string; url?: string };
export function externalReviewDigest(review: ExternalWorkspaceReview) {
  workspaceId(review.id); workspaceId(review.projectId); workspaceText(review.title, 180); workspaceText(review.content, 500000);
  if (!['document','spreadsheet','presentation','calendar-event'].includes(review.action)) throw new Error('INVALID_EXTERNAL_ACTION');
  if (review.action === 'calendar-event' && (!review.start || !review.end || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(review.start) || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(review.end) || !Number.isFinite(Date.parse(review.start)) || !Number.isFinite(Date.parse(review.end)) || Date.parse(review.end) <= Date.parse(review.start))) throw new Error('VALID_EVENT_TIMES_REQUIRED');
  return sha256String(canonical(review));
}
