import { actionById, actionFields, herculesWorkspaceActionCatalogue, parseActionAnswer, type ActionContext, type ActionValues } from '../core/herculesActions.ts';
import { householdForView } from '../core/visibility.ts';
import { quietSecrets, scrubQuietText } from '../core/herculesPrivacy.ts';

/** Workspace-only reads: these names never grant command or confirmation authority. */
export const WORKSPACE_ACTION_QUERY_NAMES = ['action_catalogue', 'action_options'] as const;
export function isWorkspaceActionQuery(name: string): boolean {
  return (WORKSPACE_ACTION_QUERY_NAMES as readonly string[]).includes(name);
}
const MAX_RESPONSE = 24_000;
function bounded(result: Record<string, unknown>): Record<string, unknown> {
  if (JSON.stringify(result).length > MAX_RESPONSE) throw new Error('ACTION_OPTIONS_LIMIT_SELECT_FIELD');
  return result;
}
function pageNumber(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > maximum) throw new Error('INVALID_ACTION_OPTIONS_PAGE');
  return value;
}

/** Call only inside the authenticated ledger boundary. No household or execution functions escape. */
export function executeWorkspaceActionQuery(name: string, args: Record<string, unknown>, context: ActionContext): Record<string, unknown> {
  if (!isWorkspaceActionQuery(name) || !['personal', 'household'].includes(context.view)) throw new Error('INVALID_ACTION_QUERY');
  if (!context.household.members.some(m => m.id === context.memberId && m.active)) throw new Error('ACTION_MEMBER_REQUIRED');
  // Private workspaces may prepare a Household Plan privately. Restore only
  // the requesting member's preparation drafts, never their private balances.
  const c = { ...context, household: { ...householdForView(context.household, context.memberId, context.view),
    planDrafts: (context.household.planDrafts ?? []).filter(d => d.ownerMemberId === context.memberId && d.scope === context.view),
  } };
  const secrets = quietSecrets(context.household);
  const protectedText = (value: string) => [...secrets.titles, ...secrets.practitioners, ...secrets.places]
    .some(s => s.trim().length >= 3 && value.toLowerCase().includes(s.trim().toLowerCase()));
  const label = (value: string) => scrubQuietText(value, secrets) || 'Private detail — review in Hearth';
  const output = (value: Record<string, unknown>) => bounded(JSON.parse(JSON.stringify(value, (key, item) =>
    typeof item === 'string' && ['title', 'label', 'example', 'question', 'consequence', 'instruction'].includes(key) ? label(item) : item)));

  if (name === 'action_catalogue') {
    if (Object.keys(args).some(k => !['offset', 'limit'].includes(k))) throw new Error('INVALID_ACTION_CATALOGUE_ARGUMENTS');
    const actions = herculesWorkspaceActionCatalogue(c), offset = pageNumber(args.offset, 0, 1_000_000), limit = pageNumber(args.limit, 20, 40);
    if (!limit) throw new Error('INVALID_ACTION_OPTIONS_PAGE');
    return output({ actions: actions.slice(offset, offset + limit), actionCount: actions.length, hasMore: offset + limit < actions.length,
      nextOffset: offset + limit < actions.length ? offset + limit : null, noActionExecuted: true });
  }
  if (Object.keys(args).some(k => !['actionId', 'values', 'fieldKey', 'offset', 'limit'].includes(k))) throw new Error('INVALID_ACTION_OPTIONS_ARGUMENTS');
  if (typeof args.actionId !== 'string') throw new Error('ACTION_ID_REQUIRED');
  const a = actionById(args.actionId, c);
  const raw = args.values ?? {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).length > 100
    || Object.entries(raw).some(([k, v]) => !/^[a-zA-Z0-9_-]{1,100}$/.test(k) || typeof v !== 'string' || v.length > 500)) throw new Error('INVALID_ACTION_VALUES');
  if (Object.values(raw).some(value => protectedText(String(value)))) throw new Error('ACTION_PRIVATE_DETAILS_USE_HEARTH');
  const supplied = raw as ActionValues, values: ActionValues = {}, accepted = new Set<string>();
  // Resolve dependent fields from validated choices only. A hidden job/account id
  // cannot select a second field set, and unknown keys never reach an adapter.
  for (let pass = 0; pass <= Object.keys(supplied).length; pass++) {
    const before = accepted.size;
    for (const f of actionFields(a, c, values)) {
      if (accepted.has(f.key) || !Object.hasOwn(supplied, f.key)) continue;
      if (!supplied[f.key]!.trim()) { accepted.add(f.key); continue; }
      // A choice may depend on another supplied field in this same pass.
      if (f.choices && !f.choices(c, values).length) continue;
      const parsed = parseActionAnswer(f, supplied[f.key]!, c, values);
      if (protectedText(parsed)) throw new Error('ACTION_PRIVATE_DETAILS_USE_HEARTH');
      values[f.key] = parsed;
      accepted.add(f.key);
    }
    if (accepted.size === before) break;
  }
  if (Object.keys(supplied).some(k => !accepted.has(k))) throw new Error('ACTION_VALUES_UNAVAILABLE_REFRESH_OPTIONS');
  const fields = actionFields(a, c, values);
  const selected = args.fieldKey === undefined ? fields : fields.filter(f => f.key === args.fieldKey);
  if (!selected.length) throw new Error('ACTION_FIELD_UNAVAILABLE');
  const offset = pageNumber(args.offset, 0, 1_000_000), limit = pageNumber(args.limit, 10, 50);
  if (!limit || offset > 0 && args.fieldKey === undefined) throw new Error('ACTION_FIELD_REQUIRED_FOR_PAGE');
  return output({ actionId: a.id, title: a.title, scope: c.view, consequence: a.consequence, values,
    missingFields: fields.filter(f => !f.optional && !values[f.key]?.trim()).map(f => f.key),
    fields: selected.map(f => {
      // Do not mint redacted identifiers that could select a different record.
      const choices = f.choices?.(c, values).filter(choice => !protectedText(choice.value));
      return { key: f.key, label: f.label, question: f.question, kind: f.kind ?? 'text', optional: f.optional === true,
        maxLength: Math.min(500, f.maxLength ?? 500), allowNegative: f.allowNegative === true,
        ...(choices ? { choices: choices.slice(offset, offset + limit), choiceCount: choices.length,
          hasMore: offset + limit < choices.length, nextOffset: offset + limit < choices.length ? offset + limit : null } : {}) };
    }), noActionExecuted: true,
    instruction: 'Use returned choice values exactly. Re-read options after changing a dependent field. Missing information stays unknown. These are current options, not a reviewed or executed action.' });
}
