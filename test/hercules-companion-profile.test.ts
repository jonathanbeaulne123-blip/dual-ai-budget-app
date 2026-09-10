import { describe, expect, it } from "vitest";
import {
  checkCompanionPrecondition, checkCompanionGalleryPrecondition, COMPANION_LIMITS, copyGalleryLook, createCompanionProfile,
  decodeCompanionIntent, decodeCompanionPresentation, decodeCompanionProfile, decodeGalleryLook,
  decodeLook, legacyCompanionPreview, projectGalleryLook, validateLookForWear,
  type CompanionOperation,
} from "../src/core/herculesCompanionContracts.ts";
import { HERCULES_CAPABILITIES, HERCULES_CAPABILITY_IDS, registeredCompanionCapabilities } from "../src/core/herculesCapabilities.ts";
import { HERCULES_CHARACTER_V1 } from "../src/core/herculesCharacter.ts";
import { catalogHousehold } from "../src/core/seed.ts";
import { COSMETICS } from "../src/core/companion.ts";
import { executeIntent, registeredCommands } from "../src/ledgerSync/registry.ts";
import {
  COMPANION_DIALOGUE_SCENARIOS, COMPANION_TEST_CATALOGUE as catalogue, COMPANION_TEST_SCOPE as owner,
  COMPANION_TEST_TIME as now, companionTestLook, companionTestProfile,
} from "./fixtures/hercules-companion.ts";

const intent = (operation: CompanionOperation) => ({ version: 1, id: "INTENT-fixture", scope: owner, operation });
const preferenceIntent = () => intent({ kind: "preference.set", key: "answerLength", value: "detailed", expectedRevision: 2, origin: { kind: "manual" } });

describe("Hercules slice 1 private profile contract", () => {
  it("round-trips populated JSON without aliasing or silently shaping away fields", () => {
    const source = companionTestProfile();
    const decoded = decodeCompanionProfile(JSON.parse(JSON.stringify(source)), owner);
    expect(decoded).toEqual(source);
    decoded.savedLooks[0]!.value!.selections.head!.itemId = "changed";
    expect(source.savedLooks[0]!.value!.selections.head!.itemId).toBe("fixture-hat");
  });
  it("defaults missing legacy state without importing shared history or equipping anything", () => {
    expect(decodeCompanionProfile(undefined, owner)).toEqual(createCompanionProfile(owner));
    expect(createCompanionProfile(owner).conversations.map(row => row.turns)).toEqual([[], []]);
    expect(createCompanionProfile(owner).wornLook.value).toBeNull();
    expect(() => decodeCompanionProfile(null, owner)).toThrow("EXPECTED_OBJECT");
  });
  it.each([
    { ...owner, memberId: "MEM-002" }, { ...owner, householdId: "HH-other" },
    { ...owner, environment: "production" as const },
  ])("rejects profiles and intents outside the authenticated tuple: %j", scope => {
    expect(() => decodeCompanionProfile(companionTestProfile(), scope)).toThrow("COMPANION_SCOPE_MISMATCH");
    expect(() => decodeCompanionIntent(preferenceIntent(), scope)).toThrow("COMPANION_SCOPE_MISMATCH");
  });
  it("refuses unsupported versions instead of replacing them with empty state", () => {
    expect(() => decodeCompanionProfile({ ...companionTestProfile(), version: 9 }, owner)).toThrow("UNSUPPORTED_PROFILE_VERSION");
    expect(() => decodeLook({ ...companionTestLook(), version: 9 })).toThrow("UNSUPPORTED_LOOK_VERSION");
  });
  it.each(["income", "health", "partnerPreference", "password"])("does not accept sensitive/freeform preference key %s", key => {
    const value = preferenceIntent();
    expect(() => decodeCompanionIntent({ ...value, operation: { ...value.operation, key } }, owner)).toThrow("INVALID_ENUM");
  });
  it("allows explicit bounded preferences but rejects freeform inference and arbitrary favourite values", () => {
    expect(decodeCompanionIntent(preferenceIntent(), owner).operation.kind).toBe("preference.set");
    const value = preferenceIntent();
    expect(() => decodeCompanionIntent({ ...value, operation: { ...value.operation, value: "seems anxious" } }, owner)).toThrow("INVALID_ENUM");
    expect(() => decodeCompanionIntent(intent({ kind: "preference.set", key: "preferredActivities", value: ["delete-books"], expectedRevision: 0, origin: { kind: "manual" } }), owner)).toThrow("INVALID_ENUM");
    const profile = companionTestProfile();
    (profile.preferences[0] as { source: string }).source = "inferred";
    expect(() => decodeCompanionProfile(profile, owner)).toThrow("INVALID_ENUM");
  });
  it("rejects duplicated resources, missing views, oversized text, invalid dates and sparse arrays", () => {
    const profile = companionTestProfile();
    expect(() => decodeCompanionProfile({ ...profile, preferences: [...profile.preferences, ...profile.preferences] }, owner)).toThrow("DUPLICATE_RESOURCE");
    expect(() => decodeCompanionProfile({ ...profile, conversations: [profile.conversations[0]] }, owner)).toThrow("MISSING_CONVERSATION_PARTITION");
    profile.conversations[0]!.turns[0]!.text = "x".repeat(COMPANION_LIMITS.textCharacters + 1);
    expect(() => decodeCompanionProfile(profile, owner)).toThrow("INVALID_TEXT");
    profile.conversations[0]!.turns[0]!.text = "hello";
    profile.conversations[0]!.turns[0]!.createdAt = "2026-02-30T04:00:00.000Z";
    expect(() => decodeCompanionProfile(profile, owner)).toThrow("INVALID_TIMESTAMP");
    expect(() => decodeCompanionProfile({ ...companionTestProfile(), preferences: Array(1) }, owner)).toThrow("INVALID_LIST");
  });
  it("enforces active look capacity while retaining deletion tombstones", () => {
    const profile = companionTestProfile();
    profile.savedLooks = Array.from({ length: 51 }, (_, i) => ({ id: `LOOK-${i}`, revision: 1, value: { ...companionTestLook(), id: `LOOK-${i}` } }));
    expect(() => decodeCompanionProfile(profile, owner)).toThrow("SAVED_LOOK_LIMIT");
    profile.savedLooks[0]!.value = null;
    expect(decodeCompanionProfile(profile, owner).savedLooks).toHaveLength(51);
  });
  it("rejects prototype, unknown execution fields and accessors without running getters", () => {
    expect(() => decodeCompanionProfile(JSON.parse('{"__proto__":{}}'), owner)).toThrow("UNEXPECTED_FIELD");
    expect(() => decodeCompanionProfile(Object.assign(Object.create({ injected: true }), companionTestProfile()), owner)).toThrow("INVALID_PROTOTYPE");
    let calls = 0;
    const source = companionTestProfile();
    Object.defineProperty(source, "preferences", { get() { calls++; return []; } });
    expect(() => decodeCompanionProfile(source, owner)).toThrow("ACCESSOR_FIELD");
    expect(calls).toBe(0);
  });
});

describe("Nonfinancial intent and resource preconditions", () => {
  it.each(["postEntry", "postTransfer", "execute", "patch", "deleteHousehold"])("rejects executable/money kind %s", kind => {
    expect(() => decodeCompanionIntent({ ...preferenceIntent(), operation: { kind } }, owner)).toThrow("NONFINANCIAL_OPERATION_REQUIRED");
  });
  it.each(["postedIds", "amountCents", "author", "sql", "url", "patch", "createdBy"])("rejects injected field %s", field => {
    expect(() => decodeCompanionIntent({ ...preferenceIntent(), [field]: "injected" }, owner)).toThrow("UNEXPECTED_FIELD");
    expect(() => decodeCompanionIntent({ ...preferenceIntent(), operation: { ...preferenceIntent().operation, [field]: "injected" } }, owner)).toThrow("UNEXPECTED_FIELD");
  });
  it("checks only the affected resource and lets unrelated wardrobe/chat progress coexist", () => {
    const profile = companionTestProfile();
    profile.wornLook.revision = 45;
    profile.conversations[0]!.generation = 20;
    expect(checkCompanionPrecondition(profile, preferenceIntent(), owner)).toBe("ready");
    profile.preferences[0]!.revision = 3;
    profile.preferences[0]!.value = null;
    expect(() => checkCompanionPrecondition(profile, preferenceIntent(), owner)).toThrow("STALE_COMPANION_RESOURCE");
  });
  it("retains look tombstone revisions and rejects a stale restore", () => {
    const profile = companionTestProfile();
    profile.savedLooks[0] = { id: "LOOK-fixture", revision: 4, value: null };
    expect(() => checkCompanionPrecondition(profile, intent({ kind: "look.save", look: companionTestLook(), expectedRevision: 3 }), owner, catalogue)).toThrow("STALE_COMPANION_RESOURCE");
  });
  it("cancels automatic candidates after remembering changes or source conversations clear while retaining manual editing", () => {
    const profile = companionTestProfile();
    const candidate = intent({ kind: "preference.set", key: "answerLength", value: "detailed", expectedRevision: 2,
      origin: { kind: "conversation", view: "household", generation: 0, rememberingRevision: 0, sourceTurnId: "TURN-fixture" } });
    expect(checkCompanionPrecondition(profile, candidate, owner)).toBe("ready");
    profile.remembering = { enabled: false, revision: 1 };
    expect(() => checkCompanionPrecondition(profile, candidate, owner)).toThrow("REMEMBERING_CHANGED");
    expect(checkCompanionPrecondition(profile, preferenceIntent(), owner)).toBe("ready");
    profile.remembering = { enabled: true, revision: 2 };
    expect(() => checkCompanionPrecondition(profile, candidate, owner)).toThrow("REMEMBERING_CHANGED");
    profile.remembering = { enabled: true, revision: 0 };
    profile.conversations[0]!.generation = 1;
    expect(() => checkCompanionPrecondition(profile, candidate, owner)).toThrow("STALE_CONVERSATION");
    profile.conversations[0]!.generation = 0;
    profile.conversations[0]!.turns = [];
    expect(() => checkCompanionPrecondition(profile, candidate, owner)).toThrow("PREFERENCE_SOURCE_UNAVAILABLE");
    expect(() => checkCompanionPrecondition(profile, candidate, { ...owner, memberId: "MEM-002" })).toThrow("COMPANION_SCOPE_MISMATCH");
  });
  it("handles append retries by stable ID and refuses changed content or cleared conversation generations", () => {
    const profile = companionTestProfile();
    const appended = intent({ kind: "conversation.append", view: "household", generation: 0, turn: profile.conversations[0]!.turns[0]! });
    expect(checkCompanionPrecondition(profile, appended, owner)).toBe("duplicate");
    const changed = structuredClone(appended);
    if (changed.operation.kind === "conversation.append") changed.operation.turn.text = "changed";
    expect(() => checkCompanionPrecondition(profile, changed, owner)).toThrow("TURN_ID_COLLISION");
    profile.conversations[0]!.generation++;
    expect(() => checkCompanionPrecondition(profile, appended, owner)).toThrow("STALE_CONVERSATION");
  });
  it("keeps new intents unavailable to the production authority and never changes the household", () => {
    const household = catalogHousehold();
    const before = structuredClone(household);
    for (const kind of ["preference.set", "preference.forget", "remembering.set", "conversation.append", "conversation.clear", "look.wear", "look.save", "look.remove", "suggestion.set", "gallery.publish", "gallery.remove"]) {
      expect(registeredCommands).not.toContain(kind);
      expect(() => executeIntent(household, kind, [preferenceIntent()], "MEM-001", "fixture-command")).toThrow("dedicated authority");
    }
    expect(household).toEqual(before);
    expect(household.transactions).toEqual(before.transactions);
  });
});

describe("Wardrobe and explicit sharing contracts", () => {
  it("allows hats with glasses, rejects wrong slots/variants and occupied-slot collisions", () => {
    expect(validateLookForWear(companionTestLook(), catalogue)).toEqual(companionTestLook());
    const look = companionTestLook();
    look.selections.outerwear = { itemId: "fixture-hood", variantId: "cream" };
    expect(() => validateLookForWear(look, catalogue)).toThrow("OCCUPIED_COSMETIC_SLOT");
    delete look.selections.outerwear;
    look.selections.head!.variantId = "url:evil";
    expect(() => validateLookForWear(look, catalogue)).toThrow("INCOMPATIBLE_COSMETIC");
    look.selections.head = { itemId: "fixture-glasses", variantId: "brass" };
    expect(() => validateLookForWear(look, catalogue)).toThrow("INCOMPATIBLE_COSMETIC");
  });
  it("preserves unknown stored cosmetics but does not permit equipping them", () => {
    const look = companionTestLook(); look.selections.head!.itemId = "future-hat";
    expect(decodeLook(JSON.parse(JSON.stringify(look)))).toEqual(look);
    expect(() => validateLookForWear(look, catalogue)).toThrow("UNAVAILABLE_COSMETIC");
    const futureLook = { ...companionTestLook(), catalogueVersion: 999 };
    expect(decodeLook(futureLook)).toEqual(futureLook);
    expect(() => validateLookForWear(futureLook, catalogue)).toThrow("UNSUPPORTED_WEAR_CATALOGUE");
  });
  it("projects only the explicitly shared look and independently copies it for another member", () => {
    const profile = companionTestProfile();
    const shared = projectGalleryLook(profile, owner, "LOOK-fixture", "GALLERY-fixture", catalogue);
    const serialized = JSON.stringify(shared);
    for (const token of ["PRIVATE-CONVERSATION", "PERSONAL-LEDGER", "PRIVATE-OUTFIT", "ACC-private", "SHIFT-private", "preferences", "conversations", "LOOK-fixture"]) expect(serialized).not.toContain(token);
    expect(shared.creatorMemberId).toBe(owner.memberId);
    expect(decodeGalleryLook(JSON.parse(serialized), owner)).toEqual(shared);
    const copy = copyGalleryLook(shared, { ...owner, memberId: "MEM-002" }, "LOOK-copy");
    copy.selections.head!.itemId = "changed";
    expect(shared.look.selections.head!.itemId).toBe("fixture-hat");
    expect(profile.savedLooks[0]!.value!.selections.head!.itemId).toBe("fixture-hat");
  });
  it("rejects foreign publication, cross-household copying and hidden gallery metadata", () => {
    const profile = companionTestProfile();
    expect(() => projectGalleryLook(profile, { ...owner, memberId: "MEM-002" }, "LOOK-fixture", "GALLERY-fixture", catalogue)).toThrow("COMPANION_SCOPE_MISMATCH");
    const shared = projectGalleryLook(profile, owner, "LOOK-fixture", "GALLERY-fixture", catalogue);
    expect(() => copyGalleryLook(shared, { ...owner, householdId: "HH-other" }, "LOOK-copy")).toThrow("COMPANION_SCOPE_MISMATCH");
    expect(() => decodeGalleryLook({ ...shared, memories: profile.preferences }, owner)).toThrow("UNEXPECTED_FIELD");
  });
  it("checks the source revision and creator ownership for explicit gallery intents", () => {
    const profile = companionTestProfile();
    const published = projectGalleryLook(profile, owner, "LOOK-fixture", "GALLERY-fixture", catalogue);
    const gallery = [{ id: published.id, creatorMemberId: owner.memberId, revision: 0, value: published }];
    const publish = { version: 1, id: "SHARE-fixture", scope: owner, operation: { kind: "gallery.publish", galleryId: published.id, sourceLookId: "LOOK-fixture", expectedLookRevision: 3, expectedRevision: 0 } };
    expect(checkCompanionGalleryPrecondition(profile, publish, owner, [], catalogue)).toBe("ready");
    const remove = { ...publish, operation: { kind: "gallery.remove", galleryId: published.id, expectedRevision: 0 } };
    expect(checkCompanionGalleryPrecondition(profile, remove, owner, gallery, catalogue)).toBe("ready");
    const partner = { ...owner, memberId: "MEM-002" };
    expect(() => checkCompanionGalleryPrecondition(createCompanionProfile(partner), { ...remove, scope: partner }, partner, gallery, catalogue)).toThrow("FOREIGN_GALLERY_RESOURCE");
    profile.savedLooks[0]!.revision++;
    expect(() => checkCompanionGalleryPrecondition(profile, publish, owner, [], catalogue)).toThrow("STALE_COMPANION_RESOURCE");
    expect(() => checkCompanionGalleryPrecondition(profile, { ...remove, operation: { ...remove.operation, creatorMemberId: partner.memberId } }, owner, gallery, catalogue)).toThrow("UNEXPECTED_FIELD");
  });
  it("maps every current legacy cosmetic without silently losing unknown IDs or conflicting charms", () => {
    for (const item of COSMETICS) {
      const source = { hat: null, chain: null, collar: null, house: null, [item.slot]: item.id };
      expect(legacyCompanionPreview(source).unknown).toEqual([]);
    }
    const source = { hat: "specs", chain: "gold", collar: "fish", house: "future-house" };
    const preview = legacyCompanionPreview(source);
    expect(preview.look.selections.eyewear?.itemId).toBe("specs");
    expect(preview.look.selections.charm).toBeUndefined();
    expect(preview.conflicts).toEqual([{ slot: "charm", itemIds: ["gold", "fish"] }]);
    expect(preview.unknown).toEqual([{ slot: "house", itemId: "future-house" }]);
    expect(preview.source).toEqual(source);
    preview.source.hat = null; expect(source.hat).toBe("specs");
    expect(preview.legacyHistory).toEqual({ kind: "previously-shared-read-only-archive", importIntoProfile: false, includeInModelContext: false });
  });
  it.each(["future/hat", "future hat", "toString", "帽子", "<unknown accessory>"])("preserves opaque legacy source %s only as unavailable metadata", old => {
    const preview = legacyCompanionPreview({ hat: old, chain: null, collar: null, house: null });
    expect(preview.source.hat).toBe(old);
    expect(preview.unknown).toEqual([{ slot: "hat", itemId: old }]);
    expect(preview.look.selections).toEqual({});
  });
});

describe("Capability and character evaluation foundations", () => {
  it("declares twelve unique outcomes with known read tools and no available handler by default", async () => {
    const { HERCULES_READ_TOOL_NAMES } = await import("../src/core/herculesTools.ts");
    expect(HERCULES_CAPABILITIES.map(row => row.id)).toEqual([...HERCULES_CAPABILITY_IDS]);
    expect(new Set(HERCULES_CAPABILITIES.map(row => row.action)).size).toBe(12);
    for (const row of HERCULES_CAPABILITIES) for (const tool of row.readTools) expect(HERCULES_READ_TOOL_NAMES).toContain(tool);
    expect(registeredCompanionCapabilities(new Set(), "household")).toEqual([]);
    expect(registeredCompanionCapabilities(new Set(["open-current-plan", "explain-current-page"]), "personal").map(row => row.id)).toEqual(["explain-page"]);
  });
  it("provides 24 synthetic scenarios covering all capabilities and multi-turn, privacy and recovery behaviours", () => {
    expect(COMPANION_DIALOGUE_SCENARIOS).toHaveLength(24);
    expect(new Set(COMPANION_DIALOGUE_SCENARIOS.map(row => row.id)).size).toBe(24);
    expect(new Set(COMPANION_DIALOGUE_SCENARIOS.map(row => row.capability))).toEqual(new Set(HERCULES_CAPABILITY_IDS));
    expect(COMPANION_DIALOGUE_SCENARIOS.some(row => row.turns.length === 3)).toBe(true);
    for (const row of COMPANION_DIALOGUE_SCENARIOS) { expect(row.must.length).toBeGreaterThan(0); expect(row.mustNot.length).toBeGreaterThan(0); }
    expect(HERCULES_CHARACTER_V1.samples.stressed).toContain("one step at a time");
  });
  it("accepts only current presentation references and bounded allowlisted gestures", () => {
    const response = { version: 2, text: "Let's look at this together.\nHere is the source.", expression: "calm", gesture: "head-tilt", factIds: ["FACT-current"], actionIds: ["open-account-source"] };
    const facts = new Set(["FACT-current"]); const actions = new Set(["open-account-source"]);
    expect(decodeCompanionPresentation(response, facts, actions)).toEqual(response);
    expect(() => decodeCompanionPresentation(response, new Set(), actions)).toThrow("UNAVAILABLE_REFERENCE");
    expect(() => decodeCompanionPresentation({ ...response, gesture: "execute-money" }, facts, actions)).toThrow("INVALID_ENUM");
    expect(() => decodeCompanionPresentation({ ...response, providerKey: "secret" }, facts, actions)).toThrow("UNEXPECTED_FIELD");
  });
  it("keeps source timestamps as retention metadata without pruning on a read", () => {
    const profile = companionTestProfile();
    profile.conversations[0]!.turns[0]!.createdAt = "2025-01-01T00:00:00.000Z";
    expect(decodeCompanionProfile(profile, owner).conversations[0]!.turns[0]!.createdAt).toBe("2025-01-01T00:00:00.000Z");
    expect(COMPANION_LIMITS.historyDays).toBe(30);
    expect(profile.preferences[0]!.updatedAt).toBe(now);
  });
});
