import { householdForView } from "./visibility.ts";
import type { Household, LedgerView } from "./types.ts";
import { COMPANION_LIMITS, createCompanionProfile, decodeCompanionProfile, decodeCompanionChatRequest, type CompanionConversationTurn } from "./herculesCompanionContracts.ts";

/** Rebuild from the active person's profile; historical figures never authorize a new answer. */
export function companionModelContext(household: Household, memberId: string, view: LedgerView, scrub: (text: string) => string, now = Date.now()) {
  const scope = { environment: household.environment, householdId: household.householdId, memberId };
  const profile = household.companionProfile?.scope.memberId === memberId ? decodeCompanionProfile(household.companionProfile, scope) : createCompanionProfile(scope);
  const partition = profile.conversations.find(row => row.view === view)!;
  const visible = householdForView(household, memberId, view);
  const visibleIds = {
    account: new Set(visible.accounts.map(row => row.id)), transaction: new Set(visible.transactions.map(row => row.id)),
    goal: new Set(visible.goals.map(row => row.id)), shift: new Set(visible.shifts.map(row => row.id)),
    page: new Set(["home", "plan", "calendar", "shift", "ledger", "more", "add"]),
    "plan-draft": new Set((visible.planDrafts ?? []).map(row => row.id)),
    "plan-version": new Set((visible.planVersions ?? []).map(row => row.id)),
    "plan-line": new Set((visible.planVersions ?? []).flatMap(row => row.lines.map(line => line.id))),
    "plan-scenario": new Set((visible.planScenarios ?? []).map(row => row.id)),
    "plan-assumption": new Set((visible.planVersions ?? []).flatMap(row => row.assumptions.map(assumption => assumption.id))),
    "plan-bridge": new Set((visible.planBridgeDecisions ?? []).map(row => row.id)),
    "plan-sitdown": new Set((visible.planHerculesSessions ?? []).flatMap(row => [row.id, row.sitDownSessionId])),
  };
  const recent = partition.turns.filter(row => Date.parse(row.createdAt) >= now - COMPANION_LIMITS.historyDays * 86_400_000);
  const pairs: CompanionConversationTurn[][] = [];
  for (let index = 0; index < recent.length - 1; index += 1) {
    const user = recent[index]!, reply = recent[index + 1]!;
    if (user.role !== "user" || reply.role !== "hercules") continue;
    if ([...user.sourceReferences, ...reply.sourceReferences].some(ref => !visibleIds[ref.kind].has(ref.id))) { index += 1; continue; }
    const pair = [user, reply].map(turn => ({ ...turn, text: redactCompanionText(scrub(turn.text)).replace(/(?:CAD\s*)?\$\d[\d,]*(?:\.\d+)?/g, "[earlier amount; refresh from books]"), sourceReferences: [] }));
    if (pair.every(row => row.text)) pairs.push(pair);
    index += 1;
  }
  const context: CompanionConversationTurn[] = [];
  let size = 0;
  for (const pair of pairs.slice(-COMPANION_LIMITS.contextPairs).reverse()) {
    const length = pair.reduce((sum, row) => sum + row.text.length, 0);
    if (size + length > COMPANION_LIMITS.contextCharacters) break;
    context.unshift(...pair); size += length;
  }
  return decodeCompanionChatRequest({ version: 2, scope, view, conversationGeneration: partition.generation, context,
    preferences: profile.preferences.filter(row => row.value !== null).slice(0, COMPANION_LIMITS.modelPreferences), currentFactIds: [], availableActionIds: [] });
}

/** Defence in depth for credentials accidentally included in a conversational draft. */
export function redactCompanionText(text: string): string {
  return text
    .replace(/\b(?:sk-[A-Za-z0-9_-]{12,}|AIza[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\b/g, "[credential removed]")
    .replace(/\b(?:password|passcode|api[-_ ]?key|access[-_ ]?token|refresh[-_ ]?token|secret)\s*[:=]\s*[^\s,;]+/gi, "[credential removed]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+/gi, "[credential removed]")
    .replace(/\b(?:\d[ -]?){13,19}\b/g, "[long number removed]");
}
