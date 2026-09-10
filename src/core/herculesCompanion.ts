import type { CommitResult, Household, LedgerView } from "./types.ts";
import { captureCommand } from "../ledgerSync/capture.ts";
import { canonical } from "../ledgerSync/patch.ts";
import {
  checkCompanionPrecondition, COMPANION_LIMITS, createCompanionProfile, decodeCompanionIntent,
  decodeCompanionProfile, type CompanionIntentV1, type CompanionPreferenceKey, type CompanionPreferenceValue,
} from "./herculesCompanionContracts.ts";

export function companionFor(household: Household, memberId: string) {
  const scope = { environment: household.environment, householdId: household.householdId, memberId };
  return household.companionProfile?.scope.memberId === memberId
    ? decodeCompanionProfile(household.companionProfile, scope) : createCompanionProfile(scope);
}

/** Only explicit, finite, low-sensitivity preferences. Never financial or free-form memories. */
export function explicitCompanionPreference(text: string): { key: CompanionPreferenceKey; value: CompanionPreferenceValue } | null {
  const value = text.trim().replace(/[.!]+$/, "").toLowerCase().replace(/^actually,?\s+/, "");
  if (/^(?:please )?(?:keep it short|keep (?:your )?answers (?:short|concise)|give me (?:short|concise) answers|i prefer (?:short|concise) answers)$/.test(value)) return { key: "answerLength", value: "concise" };
  if (/^(?:please )?(?:give me detailed answers|i prefer detailed answers)$/.test(value)) return { key: "answerLength", value: "detailed" };
  if (/^(?:please )?(?:explain things step by step|i prefer step.by.step explanations)$/.test(value)) return { key: "explanationStyle", value: "step-by-step" };
  if (/^(?:please )?(?:use plain language|i prefer plain explanations)$/.test(value)) return { key: "explanationStyle", value: "plain" };
  if (/^(?:please )?(?:use examples|i prefer explanations with examples)$/.test(value)) return { key: "explanationStyle", value: "examples" };
  if (/^(?:please )?(?:no jokes|turn off (?:the )?humou?r|i prefer no jokes)$/.test(value)) return { key: "humour", value: "off" };
  if (/^(?:please )?(?:be playful|i like playful humou?r)$/.test(value)) return { key: "humour", value: "playful" };
  const colour = value.match(/^my favou?rite colo(?:u)?r is (cream|white|black|brown|red|orange|yellow|green|blue|purple|pink|silver|brass|rose-gold)$/);
  return colour ? { key: "favouriteColours", value: [colour[1]!] } : null;
}

export const commitCompanion = captureCommand("commitCompanion", (household: Household, raw: CompanionIntentV1): CommitResult => {
  const scope = { environment: household.environment, householdId: household.householdId, memberId: raw.scope?.memberId };
  if (!household.members.some(member => member.id === scope.memberId && member.active)) throw new Error("COMPANION_MEMBER_REQUIRED");
  const intent = decodeCompanionIntent(raw, scope);
  const op = intent.operation;
  if (!["preference.set", "preference.forget", "remembering.set", "conversation.append", "conversation.clear", "suggestion.set"].includes(op.kind)) throw new Error("COMPANION_FEATURE_NOT_AVAILABLE");
  const profile = companionFor(household, scope.memberId);
  const ready = checkCompanionPrecondition(profile, intent, scope);
  const now = new Date().toISOString();
  if (op.kind === "preference.set" && op.origin.kind === "conversation") {
    const origin = op.origin;
    const source = profile.conversations.find(row => row.view === origin.view)!.turns.find(row => row.id === origin.sourceTurnId)!;
    const candidate = explicitCompanionPreference(source.text);
    if (!candidate || candidate.key !== op.key || canonical(candidate.value) !== canonical(op.value)) throw new Error("EXPLICIT_PREFERENCE_REQUIRED");
  }
  if (ready !== "duplicate") {
    if (op.kind === "preference.set" || op.kind === "preference.forget") {
      profile.preferences = profile.preferences.filter(row => row.key !== op.key);
      profile.preferences.push({ key: op.key, value: op.kind === "preference.set" ? op.value : null, revision: op.expectedRevision + 1, updatedAt: now, source: "explicit-user" });
    } else if (op.kind === "suggestion.set") {
      const predecessor = profile.suggestions.find(row => row.issueId === op.state.issueId && row.view === op.state.view) ?? null;
      if (op.expectedState === undefined || canonical(predecessor) !== canonical(op.expectedState)) throw new Error("STALE_SUGGESTION_STATE");
      const tombstone = op.state.until === "1970-01-01T00:00:00.000Z" && (op.state.issueId === `capability:${op.state.capabilityId}` || op.state.issueId === `resume:${op.state.capabilityId}`);
      if (op.state.status === "snoozed" && !tombstone && Date.parse(op.state.until!) <= Date.parse(now)) throw new Error("SUGGESTION_EXPIRED");
      if (op.state.until && Date.parse(op.state.until) > Date.parse(now) + 86_400_000 + 300_000) throw new Error("SUGGESTION_SNOOZE_TOO_LONG");
      profile.suggestions = profile.suggestions.filter(row => row.view !== op.state.view || row.issueId !== op.state.issueId);
      profile.suggestions.push({ ...op.state, revision: op.expectedRevision + 1 });
    } else if (op.kind === "remembering.set") profile.remembering = { enabled: op.enabled, revision: op.expectedRevision + 1 };
    else if (op.kind === "conversation.clear") {
      const partition = profile.conversations.find(row => row.view === op.view)!;
      partition.generation += 1;
      partition.turns = [];
    } else if (op.kind === "conversation.append") {
      if (Date.parse(op.turn.createdAt) > Date.parse(now) + 300_000 || Date.parse(op.turn.createdAt) < Date.parse(now) - COMPANION_LIMITS.historyDays * 86_400_000) throw new Error("COMPANION_TURN_EXPIRED");
      profile.conversations.find(row => row.view === op.view)!.turns.push(op.turn);
    }
  }
  // Expired occurrence snoozes can be reclaimed: an old create carries an expired
  // deadline (rejected above), and an old update retains a nonzero CAS revision.
  profile.suggestions = profile.suggestions.filter(row => !(row.status === "snoozed" && row.issueId.startsWith(`${row.capabilityId}:`) && Date.parse(row.until!) <= Date.parse(now)));
  if (profile.suggestions.length > COMPANION_LIMITS.suggestions) throw new Error("COMPANION_SUGGESTION_LIMIT");
  for (const partition of profile.conversations) partition.turns = partition.turns
    .filter(turn => Date.parse(turn.createdAt) >= Date.parse(now) - COMPANION_LIMITS.historyDays * 86_400_000)
    .slice(-COMPANION_LIMITS.turnsPerView);
  const next = { ...household, companionProfile: decodeCompanionProfile(profile, scope) };
  return { household: next, warnings: [], postedIds: [], persistenceScope: "member-personal", personalMemberId: scope.memberId,
    undo: { id: intent.id, label: "Hercules private settings", snapshot: household, postedIds: [], commandKind: "hercules-companion-personal" } };
});

export function companionUpdateAllowed(before: Household, after: Household, memberId: string): boolean {
  try {
    if (!after.companionProfile) return false;
    decodeCompanionProfile(after.companionProfile, { environment: before.environment, householdId: before.householdId, memberId });
    const { companionProfile: _before, ...left } = before;
    const { companionProfile: _after, ...right } = after;
    return canonical(left) === canonical(right);
  } catch { return false; }
}

export function companionConversation(household: Household, memberId: string, view: LedgerView) {
  return companionFor(household, memberId).conversations.find(row => row.view === view)!;
}
