import type { Environment, LedgerView, PersonalEnvelope } from "./types.ts";
import { HERCULES_CAPABILITY_IDS, type HerculesCapabilityId } from "./herculesCapabilities.ts";
import { COMPANION_EXPRESSIONS, COMPANION_GESTURES } from "./herculesCharacter.ts";

/** Pure, unactivated contracts. No Household mutation, transport, registry or model access. */
export const COMPANION_LIMITS = Object.freeze({
  preferences: 60, turnsPerView: 300, historyDays: 30, contextPairs: 6,
  contextCharacters: 8_000, modelPreferences: 12, textCharacters: 6_000,
  savedLooks: 50, galleryLooks: 100, resourceRecords: 1_000, suggestions: 100,
});
export type CompanionScope = { environment: Environment; householdId: string; memberId: string };
export type CompanionHouseholdScope = Omit<CompanionScope, "memberId">;
export const COMPANION_SLOTS = ["head", "eyewear", "neckwear", "body", "outerwear", "charm"] as const;
export type CompanionSlot = typeof COMPANION_SLOTS[number];
export type CosmeticSelection = { itemId: string; variantId: string };
export type LookV1 = {
  version: 1; id: string; name: string; catalogueVersion: number;
  selections: Partial<Record<CompanionSlot, CosmeticSelection>>;
};
export type CosmeticDefinitionV2 = {
  version: 2; id: string; slot: CompanionSlot; occupies: readonly CompanionSlot[];
  variants: readonly string[]; hiddenBodyRegions: readonly string[];
  modelAssetId: string; thumbnailAssetId: string;
  poseLayerAssetIds: Readonly<Record<string, string>>;
};
export type CosmeticManifestV2 = { catalogueVersion: number; items: readonly CosmeticDefinitionV2[] };
export type LookResourceV1 = { id: string; revision: number; value: LookV1 | null };
export type GalleryLookV1 = {
  version: 1; id: string; scope: CompanionHouseholdScope;
  creatorMemberId: string; revision: number; look: LookV1;
};

export const COMPANION_PREFERENCE_KEYS = [
  "answerLength", "explanationStyle", "humour", "favouriteColours", "favouriteOutfits", "preferredActivities",
] as const;
export type CompanionPreferenceKey = typeof COMPANION_PREFERENCE_KEYS[number];
export type CompanionPreferenceValue = string | string[];
export type CompanionPreference = {
  key: CompanionPreferenceKey; value: CompanionPreferenceValue | null;
  revision: number; updatedAt: string; source: "explicit-user";
};
export type CompanionSourceReference = {
  kind: "account" | "transaction" | "goal" | "shift" | "page"; id: string;
};
export type CompanionConversationTurn = {
  id: string; role: "user" | "hercules"; text: string; createdAt: string;
  sourceReferences: CompanionSourceReference[];
};
export type CompanionConversation = {
  view: LedgerView; generation: number; turns: CompanionConversationTurn[];
};
export type CompanionSuggestionState = {
  issueId: string; capabilityId: HerculesCapabilityId; view: LedgerView; revision: number;
  status: "snoozed" | "disabled" | "resume"; until: string | null; targetId: string | null;
};
export type CompanionProfileV1 = {
  version: 1; scope: CompanionScope;
  remembering: { enabled: boolean; revision: number };
  preferences: CompanionPreference[]; conversations: CompanionConversation[];
  wornLook: { revision: number; value: LookV1 | null };
  savedLooks: LookResourceV1[]; suggestions: CompanionSuggestionState[];
};
/** Do not add this field to production envelopes before the complete slice-2 round trip. */
export type CompanionPersonalEnvelopeV1 = PersonalEnvelope & { companionProfile?: CompanionProfileV1 };
export type CompanionChatRequestV2 = {
  version: 2; scope: CompanionScope; view: LedgerView; conversationGeneration: number;
  context: CompanionConversationTurn[]; preferences: CompanionPreference[];
  currentFactIds: string[]; availableActionIds: string[];
};
export type CompanionPresentationV2 = {
  version: 2; text: string;
  expression: typeof COMPANION_EXPRESSIONS[number]; gesture: typeof COMPANION_GESTURES[number];
  factIds: string[]; actionIds: string[];
};

export class CompanionContractError extends Error {
  constructor(readonly code: string) { super(code); this.name = "CompanionContractError"; }
}
function requireContract(condition: unknown, code: string): asserts condition {
  if (!condition) throw new CompanionContractError(code);
}
function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  requireContract(value && typeof value === "object" && !Array.isArray(value), "EXPECTED_OBJECT");
  const prototype = Object.getPrototypeOf(value);
  requireContract(prototype === Object.prototype || prototype === null, "INVALID_PROTOTYPE");
  for (const key of Reflect.ownKeys(value)) {
    requireContract(typeof key === "string" && keys.includes(key), "UNEXPECTED_FIELD");
    requireContract("value" in Object.getOwnPropertyDescriptor(value, key)!, "ACCESSOR_FIELD");
  }
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  requireContract(typeof value === "string" && value.trim().length > 0 && value.length <= max, "INVALID_TEXT");
  return value;
}
function id(value: unknown): string {
  requireContract(typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,127}$/.test(value), "INVALID_ID");
  return value;
}
function revision(value: unknown): number {
  requireContract(Number.isSafeInteger(value) && Number(value) >= 0, "INVALID_REVISION");
  return value as number;
}
function literal<T extends string>(value: unknown, allowed: readonly T[]): T {
  requireContract(typeof value === "string" && allowed.includes(value as T), "INVALID_ENUM");
  return value as T;
}
function timestamp(value: unknown): string {
  requireContract(typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value), "INVALID_TIMESTAMP");
  const parsed = new Date(value);
  requireContract(Number.isFinite(parsed.getTime()) && parsed.toISOString() === value, "INVALID_TIMESTAMP");
  return value;
}
function list<T>(value: unknown, max: number, parse: (row: unknown) => T): T[] {
  requireContract(Array.isArray(value) && value.length <= max, "INVALID_LIST");
  requireContract(Object.getPrototypeOf(value) === Array.prototype, "INVALID_PROTOTYPE");
  requireContract(Reflect.ownKeys(value).length === value.length + 1, "INVALID_LIST");
  return Array.from({ length: value.length }, (_, index) => {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    requireContract(descriptor && "value" in descriptor, "INVALID_LIST");
    return parse(descriptor.value);
  });
}
function unique<T>(rows: T[], key: (row: T) => string): T[] {
  requireContract(new Set(rows.map(key)).size === rows.length, "DUPLICATE_RESOURCE");
  return rows;
}
function scope(value: unknown): CompanionScope {
  const row = object(value, ["environment", "householdId", "memberId"]);
  return { environment: literal(row.environment, ["development", "production"]), householdId: id(row.householdId), memberId: id(row.memberId) };
}
function sameScope(actual: CompanionScope, expected: CompanionScope): void {
  const trusted = scope(expected);
  requireContract(actual.environment === trusted.environment && actual.householdId === trusted.householdId
    && actual.memberId === trusted.memberId, "COMPANION_SCOPE_MISMATCH");
}
function view(value: unknown): LedgerView { return literal(value, ["household", "personal"]); }

export function createCompanionProfile(expected: CompanionScope): CompanionProfileV1 {
  return {
    version: 1, scope: scope(expected), remembering: { enabled: true, revision: 0 }, preferences: [],
    conversations: ["household", "personal"].map(value => ({ view: view(value), generation: 0, turns: [] })),
    wornLook: { revision: 0, value: null }, savedLooks: [], suggestions: [],
  };
}
export function decodeLook(value: unknown): LookV1 {
  const row = object(value, ["version", "id", "name", "catalogueVersion", "selections"]);
  requireContract(row.version === 1, "UNSUPPORTED_LOOK_VERSION");
  const selections = object(row.selections, COMPANION_SLOTS);
  const result: LookV1 = { version: 1, id: id(row.id), name: text(row.name, 64), catalogueVersion: revision(row.catalogueVersion), selections: {} };
  requireContract(result.catalogueVersion > 0, "INVALID_CATALOGUE_VERSION");
  for (const slot of COMPANION_SLOTS) {
    if (!Object.hasOwn(selections, slot)) continue;
    const item = object(selections[slot], ["itemId", "variantId"]);
    result.selections[slot] = { itemId: id(item.itemId), variantId: id(item.variantId) };
  }
  return result;
}
/** Stored unknown IDs survive decoding; wearing requires this separate manifest check. */
export function validateLookForWear(value: unknown, catalogue: CosmeticManifestV2): LookV1 {
  const look = decodeLook(value);
  requireContract(look.catalogueVersion === catalogue.catalogueVersion, "UNSUPPORTED_WEAR_CATALOGUE");
  const used = new Set<CompanionSlot>();
  for (const slot of COMPANION_SLOTS) {
    const selection = look.selections[slot];
    if (!selection) continue;
    const matches = catalogue.items.filter(item => item.id === selection.itemId);
    requireContract(matches.length === 1, "UNAVAILABLE_COSMETIC");
    const item = matches[0]!;
    requireContract(item.version === 2 && item.slot === slot && item.occupies.includes(slot)
      && item.variants.includes(selection.variantId), "INCOMPATIBLE_COSMETIC");
    for (const occupied of item.occupies) {
      requireContract(COMPANION_SLOTS.includes(occupied) && !used.has(occupied), "OCCUPIED_COSMETIC_SLOT");
      used.add(occupied);
    }
  }
  return look;
}
function preferenceValue(key: CompanionPreferenceKey, value: unknown): CompanionPreferenceValue {
  switch (key) {
    case "answerLength": return literal(value, ["concise", "detailed"]);
    case "explanationStyle": return literal(value, ["plain", "step-by-step", "examples"]);
    case "humour": return literal(value, ["gentle", "playful", "off"]);
    case "favouriteColours": return unique(list(value, 12, row => literal(row, ["cream", "white", "black", "brown", "red", "orange", "yellow", "green", "blue", "purple", "pink", "silver", "brass", "rose-gold"])), row => row);
    case "favouriteOutfits": return unique(list(value, COMPANION_LIMITS.savedLooks, id), row => row);
    case "preferredActivities": return unique(list(value, HERCULES_CAPABILITY_IDS.length, row => literal(row, HERCULES_CAPABILITY_IDS)), row => row);
  }
}
function preference(value: unknown): CompanionPreference {
  const row = object(value, ["key", "value", "revision", "updatedAt", "source"]);
  const key = literal(row.key, COMPANION_PREFERENCE_KEYS);
  return { key, value: row.value === null ? null : preferenceValue(key, row.value), revision: revision(row.revision), updatedAt: timestamp(row.updatedAt), source: literal(row.source, ["explicit-user"]) };
}
function turn(value: unknown): CompanionConversationTurn {
  const row = object(value, ["id", "role", "text", "createdAt", "sourceReferences"]);
  return {
    id: id(row.id), role: literal(row.role, ["user", "hercules"]), text: text(row.text, COMPANION_LIMITS.textCharacters), createdAt: timestamp(row.createdAt),
    sourceReferences: list(row.sourceReferences, 20, value => {
      const source = object(value, ["kind", "id"]);
      return { kind: literal(source.kind, ["account", "transaction", "goal", "shift", "page"]), id: id(source.id) };
    }),
  };
}
function suggestion(value: unknown): CompanionSuggestionState {
  const row = object(value, ["issueId", "capabilityId", "view", "revision", "status", "until", "targetId"]);
  const status = literal(row.status, ["snoozed", "disabled", "resume"]);
  const until = row.until === null ? null : timestamp(row.until);
  const targetId = row.targetId === null ? null : id(row.targetId);
  requireContract(status === "snoozed" ? until !== null && targetId === null
    : status === "resume" ? targetId !== null && until === null : until === null && targetId === null, "INVALID_SUGGESTION_STATE");
  return { issueId: id(row.issueId), capabilityId: literal(row.capabilityId, HERCULES_CAPABILITY_IDS), view: view(row.view), revision: revision(row.revision), status, until, targetId };
}
export function decodeCompanionProfile(value: unknown, expected: CompanionScope): CompanionProfileV1 {
  if (value === undefined) return createCompanionProfile(expected);
  const row = object(value, ["version", "scope", "remembering", "preferences", "conversations", "wornLook", "savedLooks", "suggestions"]);
  requireContract(row.version === 1, "UNSUPPORTED_PROFILE_VERSION");
  const owner = scope(row.scope); sameScope(owner, expected);
  const remembering = object(row.remembering, ["enabled", "revision"]);
  requireContract(typeof remembering.enabled === "boolean", "INVALID_REMEMBERING");
  const worn = object(row.wornLook, ["revision", "value"]);
  const conversations = unique(list(row.conversations, 2, value => {
    const conversation = object(value, ["view", "generation", "turns"]);
    return { view: view(conversation.view), generation: revision(conversation.generation), turns: unique(list(conversation.turns, COMPANION_LIMITS.turnsPerView, turn), item => item.id) };
  }), item => item.view);
  requireContract(conversations.length === 2, "MISSING_CONVERSATION_PARTITION");
  const savedLooks = unique(list(row.savedLooks, COMPANION_LIMITS.resourceRecords, value => {
    const resource = object(value, ["id", "revision", "value"]);
    const look = resource.value === null ? null : decodeLook(resource.value);
    const resourceId = id(resource.id);
    requireContract(!look || look.id === resourceId, "LOOK_RESOURCE_MISMATCH");
    return { id: resourceId, revision: revision(resource.revision), value: look };
  }), item => item.id);
  requireContract(savedLooks.filter(item => item.value !== null).length <= COMPANION_LIMITS.savedLooks, "SAVED_LOOK_LIMIT");
  return {
    version: 1, scope: owner, remembering: { enabled: remembering.enabled, revision: revision(remembering.revision) },
    preferences: unique(list(row.preferences, COMPANION_LIMITS.preferences, preference), item => item.key), conversations,
    wornLook: { revision: revision(worn.revision), value: worn.value === null ? null : decodeLook(worn.value) }, savedLooks,
    suggestions: unique(list(row.suggestions, COMPANION_LIMITS.suggestions, suggestion), item => `${item.view}:${item.issueId}`),
  };
}

/** Explicit sharing projection only; never spread a personal profile into a public record. */
export function projectGalleryLook(
  profileValue: unknown, actor: CompanionScope, savedLookId: string, galleryId: string,
  catalogue: CosmeticManifestV2,
): GalleryLookV1 {
  const profile = decodeCompanionProfile(profileValue, actor);
  const found = profile.savedLooks.find(row => row.id === savedLookId)?.value;
  requireContract(found, "LOOK_NOT_FOUND");
  const look = validateLookForWear(found, catalogue);
  const publicId = id(galleryId);
  return { version: 1, id: publicId, scope: { environment: profile.scope.environment, householdId: profile.scope.householdId }, creatorMemberId: profile.scope.memberId, revision: 0, look: { ...look, id: publicId } };
}
export function decodeGalleryLook(value: unknown, expected: CompanionHouseholdScope): GalleryLookV1 {
  const row = object(value, ["version", "id", "scope", "creatorMemberId", "revision", "look"]);
  requireContract(row.version === 1, "UNSUPPORTED_GALLERY_VERSION");
  const owner = object(row.scope, ["environment", "householdId"]);
  const householdScope = { environment: literal(owner.environment, ["development", "production"]), householdId: id(owner.householdId) };
  requireContract(householdScope.environment === expected.environment && householdScope.householdId === expected.householdId, "COMPANION_SCOPE_MISMATCH");
  const look = decodeLook(row.look); const galleryId = id(row.id);
  requireContract(look.id === galleryId, "LOOK_RESOURCE_MISMATCH");
  return { version: 1, id: galleryId, scope: householdScope, creatorMemberId: id(row.creatorMemberId), revision: revision(row.revision), look };
}
export function copyGalleryLook(value: unknown, target: CompanionScope, newLookId: string): LookV1 {
  const trusted = scope(target);
  const row = decodeGalleryLook(value, trusted);
  return { ...row.look, id: id(newLookId) };
}

export type CompanionGalleryIntentV1 = {
  version: 1; id: string; scope: CompanionScope;
  operation:
    | { kind: "gallery.publish"; galleryId: string; sourceLookId: string; expectedLookRevision: number; expectedRevision: number }
    | { kind: "gallery.remove"; galleryId: string; expectedRevision: number };
};
export type GalleryResourceV1 = { id: string; creatorMemberId: string; revision: number; value: GalleryLookV1 | null };
export function decodeCompanionGalleryIntent(value: unknown, authenticatedScope: CompanionScope): CompanionGalleryIntentV1 {
  const row = object(value, ["version", "id", "scope", "operation"]);
  requireContract(row.version === 1, "UNSUPPORTED_INTENT_VERSION");
  const owner = scope(row.scope); sameScope(owner, authenticatedScope);
  const op = object(row.operation, ["kind", "galleryId", "sourceLookId", "expectedLookRevision", "expectedRevision"]);
  let operation: CompanionGalleryIntentV1["operation"];
  if (op.kind === "gallery.publish") {
    operation = { kind: op.kind, galleryId: id(op.galleryId), sourceLookId: id(op.sourceLookId), expectedLookRevision: revision(op.expectedLookRevision), expectedRevision: revision(op.expectedRevision) };
  } else {
    requireContract(op.kind === "gallery.remove", "GALLERY_OPERATION_REQUIRED");
    object(op, ["kind", "galleryId", "expectedRevision"]);
    operation = { kind: op.kind, galleryId: id(op.galleryId), expectedRevision: revision(op.expectedRevision) };
  }
  return { version: 1, id: id(row.id), scope: owner, operation };
}
/** Preflight for an explicit human Share/Remove action, never a public-payload mutation. */
export function checkCompanionGalleryPrecondition(profileValue: unknown, intentValue: unknown, actor: CompanionScope, galleryValue: unknown, catalogue: CosmeticManifestV2): "ready" {
  const profile = decodeCompanionProfile(profileValue, actor);
  const { operation: op } = decodeCompanionGalleryIntent(intentValue, actor);
  const resources = unique(list(galleryValue, COMPANION_LIMITS.resourceRecords, value => {
    const row = object(value, ["id", "creatorMemberId", "revision", "value"]);
    const resourceId = id(row.id); const creatorMemberId = id(row.creatorMemberId); const resourceRevision = revision(row.revision);
    const look = row.value === null ? null : decodeGalleryLook(row.value, actor);
    requireContract(!look || (look.id === resourceId && look.creatorMemberId === creatorMemberId && look.revision === resourceRevision), "GALLERY_RESOURCE_MISMATCH");
    return { id: resourceId, creatorMemberId, revision: resourceRevision, value: look };
  }), row => row.id);
  const existing = resources.find(row => row.id === op.galleryId);
  requireContract(!existing || existing.creatorMemberId === actor.memberId, "FOREIGN_GALLERY_RESOURCE");
  requireContract((existing?.revision ?? 0) === op.expectedRevision, "STALE_COMPANION_RESOURCE");
  if (op.kind === "gallery.remove") {
    requireContract(existing?.value, "GALLERY_LOOK_NOT_FOUND");
  } else {
    const source = profile.savedLooks.find(row => row.id === op.sourceLookId);
    requireContract(source?.value, "LOOK_NOT_FOUND");
    requireContract(source.revision === op.expectedLookRevision, "STALE_COMPANION_RESOURCE");
    validateLookForWear(source.value, catalogue);
    const active = resources.filter(row => row.value !== null).length;
    requireContract(active <= COMPANION_LIMITS.galleryLooks && (existing?.value || active < COMPANION_LIMITS.galleryLooks), "GALLERY_LOOK_LIMIT");
  }
  return "ready";
}

export type PreferenceMutationOrigin =
  | { kind: "manual" }
  | { kind: "conversation"; view: LedgerView; generation: number; rememberingRevision: number; sourceTurnId: string };
export type CompanionOperation =
  | { kind: "preference.set"; key: CompanionPreferenceKey; value: CompanionPreferenceValue; expectedRevision: number; origin: PreferenceMutationOrigin }
  | { kind: "preference.forget"; key: CompanionPreferenceKey; expectedRevision: number }
  | { kind: "remembering.set"; enabled: boolean; expectedRevision: number }
  | { kind: "conversation.append"; view: LedgerView; generation: number; turn: CompanionConversationTurn }
  | { kind: "conversation.clear"; view: LedgerView; expectedGeneration: number }
  | { kind: "look.wear"; look: LookV1; expectedRevision: number }
  | { kind: "look.save"; look: LookV1; expectedRevision: number }
  | { kind: "look.remove"; lookId: string; expectedRevision: number }
  | { kind: "suggestion.set"; state: CompanionSuggestionState; expectedRevision: number };
export type CompanionIntentV1 = { version: 1; id: string; scope: CompanionScope; operation: CompanionOperation };
export function decodeCompanionIntent(value: unknown, authenticatedScope: CompanionScope, catalogue?: CosmeticManifestV2): CompanionIntentV1 {
  const row = object(value, ["version", "id", "scope", "operation"]);
  requireContract(row.version === 1, "UNSUPPORTED_INTENT_VERSION");
  const owner = scope(row.scope); sameScope(owner, authenticatedScope);
  const op = object(row.operation, ["kind", "key", "value", "expectedRevision", "origin", "enabled", "view", "generation", "turn", "expectedGeneration", "look", "lookId", "state"]);
  let operation: CompanionOperation;
  switch (op.kind) {
    case "preference.set": {
      object(op, ["kind", "key", "value", "expectedRevision", "origin"]);
      const key = literal(op.key, COMPANION_PREFERENCE_KEYS);
      const provenance = object(op.origin, ["kind", "view", "generation", "rememberingRevision", "sourceTurnId"]);
      let origin: PreferenceMutationOrigin;
      if (provenance.kind === "manual") {
        object(provenance, ["kind"]); origin = { kind: "manual" };
      } else {
        requireContract(provenance.kind === "conversation", "INVALID_PREFERENCE_ORIGIN");
        origin = { kind: "conversation", view: view(provenance.view), generation: revision(provenance.generation), rememberingRevision: revision(provenance.rememberingRevision), sourceTurnId: id(provenance.sourceTurnId) };
      }
      operation = { kind: op.kind, key, value: preferenceValue(key, op.value), expectedRevision: revision(op.expectedRevision), origin }; break;
    }
    case "preference.forget":
      object(op, ["kind", "key", "expectedRevision"]);
      operation = { kind: op.kind, key: literal(op.key, COMPANION_PREFERENCE_KEYS), expectedRevision: revision(op.expectedRevision) }; break;
    case "remembering.set":
      object(op, ["kind", "enabled", "expectedRevision"]);
      requireContract(typeof op.enabled === "boolean", "INVALID_REMEMBERING");
      operation = { kind: op.kind, enabled: op.enabled, expectedRevision: revision(op.expectedRevision) }; break;
    case "conversation.append":
      object(op, ["kind", "view", "generation", "turn"]);
      operation = { kind: op.kind, view: view(op.view), generation: revision(op.generation), turn: turn(op.turn) }; break;
    case "conversation.clear":
      object(op, ["kind", "view", "expectedGeneration"]);
      operation = { kind: op.kind, view: view(op.view), expectedGeneration: revision(op.expectedGeneration) }; break;
    case "look.wear": case "look.save":
      object(op, ["kind", "look", "expectedRevision"]);
      requireContract(catalogue, "CATALOGUE_REQUIRED");
      operation = { kind: op.kind, look: validateLookForWear(op.look, catalogue), expectedRevision: revision(op.expectedRevision) }; break;
    case "look.remove":
      object(op, ["kind", "lookId", "expectedRevision"]);
      operation = { kind: op.kind, lookId: id(op.lookId), expectedRevision: revision(op.expectedRevision) }; break;
    case "suggestion.set":
      object(op, ["kind", "state", "expectedRevision"]);
      operation = { kind: op.kind, state: suggestion(op.state), expectedRevision: revision(op.expectedRevision) }; break;
    default: throw new CompanionContractError("NONFINANCIAL_OPERATION_REQUIRED");
  }
  return { version: 1, id: id(row.id), scope: owner, operation };
}
/** Pure preflight, not an execution or Saved receipt. The authority must recheck on activation. */
export function checkCompanionPrecondition(profileValue: unknown, intentValue: unknown, actor: CompanionScope, catalogue?: CosmeticManifestV2): "ready" | "duplicate" {
  const profile = decodeCompanionProfile(profileValue, actor);
  const { operation: op } = decodeCompanionIntent(intentValue, actor, catalogue);
  if (op.kind === "preference.set" && op.origin.kind === "conversation") {
    const origin = op.origin;
    requireContract(profile.remembering.enabled && profile.remembering.revision === origin.rememberingRevision, "REMEMBERING_CHANGED");
    const partition = profile.conversations.find(row => row.view === origin.view)!;
    requireContract(partition.generation === origin.generation, "STALE_CONVERSATION");
    requireContract(partition.turns.some(row => row.id === origin.sourceTurnId && row.role === "user"), "PREFERENCE_SOURCE_UNAVAILABLE");
  }
  let current: number; let expected: number;
  switch (op.kind) {
    case "preference.set": case "preference.forget":
      current = profile.preferences.find(row => row.key === op.key)?.revision ?? 0; expected = op.expectedRevision; break;
    case "remembering.set": current = profile.remembering.revision; expected = op.expectedRevision; break;
    case "look.wear": current = profile.wornLook.revision; expected = op.expectedRevision; break;
    case "look.save": case "look.remove": {
      const resourceId = op.kind === "look.save" ? op.look.id : op.lookId;
      current = profile.savedLooks.find(row => row.id === resourceId)?.revision ?? 0; expected = op.expectedRevision; break;
    }
    case "suggestion.set":
      current = profile.suggestions.find(row => row.view === op.state.view && row.issueId === op.state.issueId)?.revision ?? 0;
      expected = op.expectedRevision; requireContract(op.state.revision === expected, "RESOURCE_REVISION_MISMATCH"); break;
    case "conversation.clear":
      current = profile.conversations.find(row => row.view === op.view)!.generation; expected = op.expectedGeneration; break;
    case "conversation.append": {
      const partition = profile.conversations.find(row => row.view === op.view)!;
      requireContract(partition.generation === op.generation, "STALE_CONVERSATION");
      const old = partition.turns.find(row => row.id === op.turn.id);
      if (old) {
        requireContract(JSON.stringify(old) === JSON.stringify(op.turn), "TURN_ID_COLLISION");
        return "duplicate";
      }
      return "ready";
    }
  }
  requireContract(current === expected, "STALE_COMPANION_RESOURCE");
  return "ready";
}

export type LegacyEquipment = { hat: string | null; chain: string | null; collar: string | null; house: string | null };
const LEGACY_SLOT_MAP: Readonly<Record<string, CompanionSlot | "keepsake" | "natural-mane">> = {
  toque: "head", visor: "head", chef: "head", specs: "eyewear", ruff: "natural-mane",
  copper: "charm", gold: "charm", bell: "neckwear", yarn: "neckwear",
  fish: "charm", clip: "charm", tooth: "charm", ink: "charm",
  cottage: "keepsake", townhouse: "keepsake", patio: "keepsake",
};
export type LegacyCompanionPreview = {
  kind: "unsaved-legacy-preview"; source: LegacyEquipment; look: LookV1; keepsakes: string[];
  unknown: { slot: keyof LegacyEquipment; itemId: string }[];
  conflicts: { slot: CompanionSlot; itemIds: string[] }[];
  legacyHistory: { kind: "previously-shared-read-only-archive"; importIntoProfile: false; includeInModelContext: false };
};
export function legacyCompanionPreview(value: unknown): LegacyCompanionPreview {
  const row = object(value, ["hat", "chain", "collar", "house"]);
  // Match the old kitchen's opaque trimmed string contract. Unknown strings stay
  // in preview/archive metadata and are never promoted to wearable selectors.
  const source = Object.fromEntries(["hat", "chain", "collar", "house"].map(key => {
    const old = row[key];
    return [key, typeof old === "string" && old.trim() ? old.trim() : null];
  })) as LegacyEquipment;
  const result: LegacyCompanionPreview = {
    kind: "unsaved-legacy-preview", source, look: { version: 1, id: "legacy-preview", name: "Your current look", catalogueVersion: 1, selections: {} },
    keepsakes: [], unknown: [], conflicts: [],
    legacyHistory: { kind: "previously-shared-read-only-archive", importIntoProfile: false, includeInModelContext: false },
  };
  const pending = new Map<CompanionSlot, string[]>();
  for (const legacySlot of ["hat", "chain", "collar", "house"] as const) {
    const itemId = source[legacySlot]; if (itemId === null) continue;
    const target = Object.hasOwn(LEGACY_SLOT_MAP, itemId) ? LEGACY_SLOT_MAP[itemId] : undefined;
    if (!target) { result.unknown.push({ slot: legacySlot, itemId }); continue; }
    if (target === "natural-mane") continue;
    if (target === "keepsake") { result.keepsakes.push(itemId); continue; }
    pending.set(target, [...(pending.get(target) ?? []), itemId]);
  }
  for (const [slot, itemIds] of pending) {
    if (itemIds.length > 1) result.conflicts.push({ slot, itemIds });
    else result.look.selections[slot] = { itemId: itemIds[0]!, variantId: "legacy-original" };
  }
  return result;
}

/** Structural presentation validation only; existing numeric/source guards remain mandatory. */
export function decodeCompanionPresentation(value: unknown, allowedFactIds: ReadonlySet<string>, allowedActionIds: ReadonlySet<string>): CompanionPresentationV2 {
  const row = object(value, ["version", "text", "expression", "gesture", "factIds", "actionIds"]);
  requireContract(row.version === 2, "UNSUPPORTED_PRESENTATION_VERSION");
  const factIds = unique(list(row.factIds, 20, id), item => item);
  const actionIds = unique(list(row.actionIds, 12, id), item => item);
  requireContract(factIds.every(item => allowedFactIds.has(item)) && actionIds.every(item => allowedActionIds.has(item)), "UNAVAILABLE_REFERENCE");
  return { version: 2, text: text(row.text, COMPANION_LIMITS.textCharacters), expression: literal(row.expression, COMPANION_EXPRESSIONS), gesture: literal(row.gesture, COMPANION_GESTURES), factIds, actionIds };
}
