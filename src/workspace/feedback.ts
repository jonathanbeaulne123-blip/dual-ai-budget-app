import { canonical } from '../ledgerSync/patch.ts';

export const FEEDBACK_SHEET_ID = '1RHV0NvgkOJvcLe-NMCx6804ba6n-An7tpSNMgRgfmtw';
export const FEEDBACK_TAB_ID = 1277317515;
export const FEEDBACK_URL = `https://docs.google.com/spreadsheets/d/${FEEDBACK_SHEET_ID}/edit#gid=${FEEDBACK_TAB_ID}`;
// Verified against FeedBack Sheet on 2026-09-12. The connector checks these again before writing.
export const FEEDBACK_HEADERS = ['ID', 'Main Page', 'Function', 'Issue/Suggestion', 'Example', 'Owner', 'Suggested Fix', 'Urgency (1-10)', 'Status', 'Priority', 'Done', 'What was actually implemented', 'Solved - Jonathan (1-10)', 'Solved - Bianca (1-10)', 'Solved - AI Review (1-10)', 'What to do next', 'Source tab', 'Cleanup notes'] as const;
export const FEEDBACK_PAGES = ['All', 'Cal - Household', 'General UX', 'Hercules', 'Home - Household', 'Plan - Household', 'Add -', 'More'] as const;
export const FEEDBACK_OWNERS = ['Bianca Sbrocchi', 'Jonathan Beaulne', 'Person', 'Jonathan Bot', 'Bianca Bot'] as const;
export function feedbackOwner(name?: string): string {
  const normalized = name?.trim().toLowerCase();
  if (normalized === 'jonathan') return 'Jonathan Beaulne';
  if (normalized === 'bianca') return 'Bianca Sbrocchi';
  return FEEDBACK_OWNERS.find(owner => owner.toLowerCase() === normalized) ?? 'Person';
}
export type FeedbackContext = Partial<Record<'page' | 'scope' | 'theme' | 'scene' | 'viewport' | 'browser' | 'build' | 'environment' | 'observedAt' | 'online', string>>;
const contextPatterns: Record<keyof FeedbackContext, RegExp> = {
  page: /^[a-zA-Z][a-zA-Z0-9-]{0,39}$/, scope: /^(personal|household)$/,
  theme: /^(classic|taylor|newfoundland)$/, scene: /^[a-zA-Z0-9_-]{1,60}$/,
  viewport: /^\d{2,5} × \d{2,5}$/, browser: /^(Chrome|Safari|Firefox|Edge|Other)$/,
  build: /^[a-f0-9]{7,40}$|^local$/, environment: /^(development|production)$/,
  observedAt: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, online: /^(online|offline)$/,
};
/** Whitelist both keys and values. Never serialize App, URLs, error objects or a household. */
export function feedbackContext(value: unknown): FeedbackContext {
  const result: FeedbackContext = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return result;
  for (const [key, pattern] of Object.entries(contextPatterns)) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === 'string' && pattern.test(v)) result[key as keyof FeedbackContext] = v;
  }
  return result;
}
export function feedbackPage(context: FeedbackContext): string {
  if (context.page === 'hercules') return 'Hercules';
  if (context.page === 'more') return 'More';
  if (context.page === 'add') return 'Add -';
  if (context.scope === 'household') return ({ home: 'Home - Household', plan: 'Plan - Household', calendar: 'Cal - Household' } as Record<string, string>)[context.page ?? ''] ?? 'General UX';
  return 'General UX';
}
export type FeedbackDraft = {
  page: string; feature: string; issue: string; expected: string; steps: string;
  example: string; owner: string; suggestedFix: string; urgency: string; context: FeedbackContext;
};
export const FEEDBACK_FIELDS = {
  page: 'Main page', feature: 'Feature or control', issue: 'What happened?', expected: 'What should have happened?',
  steps: 'How can we reproduce it?', example: 'Example (optional)', owner: 'Reporter', suggestedFix: 'Suggested fix (optional)', urgency: 'Urgency (1–10)',
} as const;
const limits: Record<keyof typeof FEEDBACK_FIELDS, number> = { page: 80, feature: 300, issue: 4000, expected: 2000, steps: 4000, example: 3000, owner: 100, suggestedFix: 2000, urgency: 2 };
export function normalizeFeedback(value: unknown, context: FeedbackContext = {}): FeedbackDraft {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('INVALID_FEEDBACK');
  const raw = value as Record<string, unknown>;
  const result = { context: feedbackContext(raw.context ?? context) } as FeedbackDraft;
  for (const [key, max] of Object.entries(limits)) {
    const v = raw[key] ?? '';
    if (typeof v !== 'string' || v.length > max) throw new Error('FEEDBACK_FIELD_LIMIT');
    result[key as keyof typeof limits] = v.trim();
  }
  if (result.page && !(FEEDBACK_PAGES as readonly string[]).includes(result.page)) throw new Error('INVALID_FEEDBACK_PAGE');
  if (result.owner && !(FEEDBACK_OWNERS as readonly string[]).includes(result.owner)) throw new Error('INVALID_FEEDBACK_OWNER');
  if (result.urgency && !/^(10|[1-9])$/.test(result.urgency)) throw new Error('INVALID_FEEDBACK_URGENCY');
  return result;
}
export function missingFeedback(draft: FeedbackDraft): string[] {
  return (['page', 'feature', 'issue', 'expected', 'steps', 'owner', 'urgency'] as const).filter(key => !draft[key]).map(key => FEEDBACK_FIELDS[key]);
}
export function feedbackValues(draft: FeedbackDraft): Record<string, string> {
  const { context, ...fields } = normalizeFeedback(draft);
  return { ...fields, contextJson: JSON.stringify(context) };
}
export function feedbackFromValues(values: Record<string, string>): FeedbackDraft {
  return normalizeFeedback({ ...values, context: values.contextJson ? JSON.parse(values.contextJson) : {} });
}
export type FeedbackReview = { id: string; projectId: string; proposalId: string; proposalRevision: number; instructionRevision: number; draft: FeedbackDraft };
export type FeedbackReceipt = { id: string; digest: string; status: 'prepared' | 'submitting' | 'uncertain' | 'accepted'; reportId?: string; url?: string; error?: string; metadataRetired?: boolean };
export type FeedbackRecord = { review: FeedbackReview; receipt: FeedbackReceipt };
export function feedbackReviewDigest(review: FeedbackReview): string {
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(review.id) || !/^[a-zA-Z0-9_-]{1,100}$/.test(review.projectId) || !/^[a-zA-Z0-9_-]{1,100}$/.test(review.proposalId)) throw new Error('INVALID_FEEDBACK_ID');
  if (!Number.isSafeInteger(review.proposalRevision) || review.proposalRevision < 1 || !Number.isSafeInteger(review.instructionRevision) || review.instructionRevision < 0) throw new Error('INVALID_FEEDBACK_REVISION');
  const draft = normalizeFeedback(review.draft);
  if (missingFeedback(draft).length) throw new Error('FEEDBACK_DETAILS_REQUIRED');
  return canonical({ id: review.id, projectId: review.projectId, proposalId: review.proposalId, proposalRevision: review.proposalRevision, instructionRevision: review.instructionRevision, draft });
}
export function isBugReportIntent(text: string): boolean {
  return /\b(report|file|submit|log)\b.{0,35}\b(bug|issue|problem|feedback)\b/i.test(text);
}
export function feedbackError(code?: string): string {
  if (code === 'FEEDBACK_NOT_CONNECTED') return 'Your report is saved here. The Hearth Feedback connection still needs to be set up.';
  if (/CHANGED/.test(code ?? '')) return 'The report changed. Reopen its current draft before submitting.';
  if (code === 'FEEDBACK_DETAILS_REQUIRED') return 'Fill the remaining details, or tell Hercules what you know. “I’m not sure” is an answer too.';
  if (code === 'FEEDBACK_SCHEMA_CHANGED') return 'The feedback sheet’s columns or choices changed. Your report is saved while the connection is updated.';
  if (code === 'FEEDBACK_SUBMISSION_REJECTED') return 'Google rejected the request and nothing was added. Your draft is editable; check the connection before trying again.';
  if (code === 'FEEDBACK_RECEIPT_PENDING') return 'Another version of this report needs its receipt checked. Open the original report below.';
  if (code === 'FEEDBACK_RATE_LIMIT') return 'The report limit has been reached for today. Your draft is saved; try tomorrow.';
  return 'The connection could not be checked. Keep this report and check its original receipt.';
}

/** A late model response may not overwrite a review that acquired a receipt during I/O. */
export function publishFeedbackProposal(project: import('./contracts.ts').WorkspaceProject, next: import('./contracts.ts').WorkspaceProposal): boolean {
  const index = project.proposals.findIndex(p => p.id === next.id), current = project.proposals[index];
  if (current && (current.receiptId || current.status === 'accepted' || next.revision !== current.revision + 1)) return false;
  for (const prior of project.proposals) if (prior.target === 'feedback' && prior.status === 'draft') prior.status = 'stale';
  if (index >= 0) project.proposals[index] = next; else project.proposals.push(next);
  return true;
}
