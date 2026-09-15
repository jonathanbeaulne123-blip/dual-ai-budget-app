import { describe, expect, it } from "vitest";
import { acceptHouseholdWrite, assembleHousehold, catalogHousehold, ensureHouseholdShape, financialAuditHash, householdForAiDisclosure, postEntry, splitForSync } from "../src/core/index.ts";
import { commandIdentityHash, commandMaterializationFacts, sha256Hex } from "../src/core/commandIdentity.ts";
import { closeChapter, openChapter, recordRitualHeld } from "../src/core/chapters.ts";
import {
  PATH_BASE_RECIPES,
  PATH_NAME_ID,
  PATH_WORLD_COMMAND_KINDS,
  agreePathProposal,
  declinePathProposal,
  effectivePathRecipes,
  guessCategorySignal,
  hasPathWorldData,
  herculesPathSuggestion,
  mergePathWorld,
  pathCategoryMappings,
  pathIslandName,
  pathWorldChangeAuthorized,
  pendingPathProposals,
  proposePathName,
  proposePathRecipe,
  setPathCategorySignal,
  shapePathWorld,
  type PathRecipeRow,
} from "../src/core/pathWorld.ts";
import { pathMonthCharacter, pathMonths, pathTripType } from "../src/core/pathSignals.ts";
import { growIsland, heightAt } from "../src/path/grow.ts";
import { walkPath, walkSeconds } from "../src/path/walk.ts";
import { COIN_POOL, firedRecently, landmarkStepChange, pathMonthAsOf } from "../src/path/landmarks.ts";
import type { Goal, GoalContribution, Household, Transaction } from "../src/core/types.ts";
import { capturedIntent } from "../src/ledgerSync/capture.ts";
import { commandFromCapture, parseCommand, type Scope } from "../src/ledgerSync/protocol.ts";
import { prepareCommand, type AuthorityState } from "../src/ledgerSync/authority.ts";
import { receiptToCommandRef } from "../src/ledger/continuityCommandLog.ts";
import { applyCommandEventLocally, extractMaterializationFacts, type ContinuityCommandEvent } from "../src/ledger/materializeSnapshotFromEvents.ts";

const ME = "MEM-002";
const PARTNER = "MEM-001";
const AT = "2026-09-12T14:00:00.000Z";
const LATER = "2026-09-12T15:00:00.000Z";

describe("Our Path world — the shared collection (D-262)", () => {
  it("changes a recipe only when both members agree to the same revision, and never touches the books", async () => {
    const base = catalogHousehold();
    const before = await financialAuditHash(base);
    const spec = { name: "Big bloom", when: { signal: "joy" as const, min: 0.3 }, brush: "bloom" as const, on: true };
    const proposed = proposePathRecipe(base, { memberId: ME, baseId: "joy", spec, at: AT });
    expect(proposed.postedIds).toEqual([]);
    expect(proposed.undo.commandKind).toBe("updatePathWorld");
    const row = proposed.household.pathWorld!.find((r) => r.id === "PATH-RCP-joy") as PathRecipeRow;
    expect(row.pending).toEqual(spec);
    expect(row.agreedByMemberIds).toEqual([ME]);
    // One agreement is not enough: the island still grows from Hearth's recipe.
    expect(effectivePathRecipes(proposed.household).find((r) => r.id === "joy")!.when).toEqual({ signal: "joy", min: 0.55 });
    expect(pendingPathProposals(proposed.household)).toHaveLength(1);

    expect(() => agreePathProposal(proposed.household, { memberId: PARTNER, rowId: row.id, revision: 99 })).toThrow(/changed/);
    expect(() => agreePathProposal(proposed.household, { memberId: "MEM-NOBODY", rowId: row.id, revision: 1 })).toThrow(/active household member/);
    const agreed = agreePathProposal(proposed.household, { memberId: PARTNER, rowId: row.id, revision: row.pendingRevision, at: LATER });
    const promoted = agreed.household.pathWorld!.find((r) => r.id === row.id) as PathRecipeRow;
    expect(promoted.pending).toBeNull();
    expect(promoted.active).toEqual(spec);
    expect(effectivePathRecipes(agreed.household).find((r) => r.id === "joy")!.when).toEqual({ signal: "joy", min: 0.3 });
    expect(pendingPathProposals(agreed.household)).toHaveLength(0);
    expect(await financialAuditHash(agreed.household)).toBe(before);

    // A revision keeps the old agreement live until the new one is agreed; declining sets it aside.
    const revised = proposePathRecipe(agreed.household, { memberId: PARTNER, rowId: row.id, spec: { ...spec, on: false }, at: LATER });
    const pendingRow = revised.household.pathWorld!.find((r) => r.id === row.id) as PathRecipeRow;
    expect(pendingRow.pendingRevision).toBe(2);
    expect(effectivePathRecipes(revised.household).find((r) => r.id === "joy")!.on).toBe(true);
    const declined = declinePathProposal(revised.household, { memberId: ME, rowId: row.id, revision: 2 });
    expect(pendingPathProposals(declined.household)).toHaveLength(0);
    expect(effectivePathRecipes(declined.household).find((r) => r.id === "joy")!.name).toBe("Big bloom");
    expect(() => agreePathProposal(declined.household, { memberId: PARTNER, rowId: row.id, revision: 2 })).toThrow(/changed/);
  });

  it("names the island together, adds a Hercules recipe, and lets one member fix a category", () => {
    let h = catalogHousehold();
    h = proposePathName(h, { memberId: ME, name: "  Little   Harbour  ", at: AT }).household;
    expect(pathIslandName(h)).toBeNull();
    h = agreePathProposal(h, { memberId: PARTNER, rowId: PATH_NAME_ID, revision: 1, at: LATER }).household;
    expect(pathIslandName(h)).toBe("Little Harbour");
    expect(() => proposePathName(h, { memberId: ME, name: "Little Harbour" })).toThrow(/already/);

    const suggestion = herculesPathSuggestion({ signal: "pets" });
    expect(suggestion.brush).toBe("dogMeadow");
    h = proposePathRecipe(h, { memberId: ME, spec: suggestion, proposedBy: "hercules", at: AT }).household;
    const added = h.pathWorld!.find((r) => r.kind === "recipe" && !r.baseId) as PathRecipeRow;
    h = agreePathProposal(h, { memberId: PARTNER, rowId: added.id, revision: 1 }).household;
    expect(effectivePathRecipes(h).find((r) => r.id === added.id)).toMatchObject({ brush: "dogMeadow", by: "hercules" });

    expect(pathCategoryMappings(h).find((m) => m.category.id === "SUB-LIFE-FUN")).toMatchObject({ signal: "joy", source: "guess" });
    h = setPathCategorySignal(h, { memberId: ME, categoryId: "SUB-LIFE-FUN", signal: "celebration" }).household;
    expect(pathCategoryMappings(h).find((m) => m.category.id === "SUB-LIFE-FUN")).toMatchObject({ signal: "celebration", source: "fixed" });
    expect(() => setPathCategorySignal(h, { memberId: ME, categoryId: "CAT-LIFE", signal: "joy" })).toThrow(/not available/);
    // Essential housing is not a cottage; health is never scored.
    expect(pathCategoryMappings(h).find((m) => m.category.id === "SUB-HOUSING-GAS")!.signal).toBeNull();
    expect(pathCategoryMappings(h).find((m) => m.category.id === "SUB-HEALTH-THERAPY")!.signal).toBeNull();
    expect(guessCategorySignal("Flights")).toBe("travel");
    expect(guessCategorySignal("Dog food")).toBe("pets");
  });

  it("converges concurrent agreement from two phones and fails closed on unreadable rows", () => {
    const h = catalogHousehold();
    const spec = { name: "Ribbon", when: { tag: "milestone" }, brush: "giftTree" as const, on: true };
    const proposed = proposePathRecipe(h, { memberId: ME, baseId: "milestone", spec, at: AT }).household;
    const row = proposed.pathWorld![0] as PathRecipeRow;
    // Each phone sees only its own agreement until they sync.
    const phoneA = { ...row, agreedByMemberIds: [ME] };
    const phoneB = { ...row, agreedByMemberIds: [PARTNER], updatedAt: LATER };
    const merged = mergePathWorld([phoneA], [phoneB]);
    expect((merged[0] as PathRecipeRow).agreedByMemberIds).toEqual([PARTNER, ME].sort());
    expect(effectivePathRecipes({ ...h, pathWorld: merged }).find((r) => r.id === "milestone")!.brush).toBe("giftTree");
    // A promoted row outranks the still-pending copy; a higher revision outranks both.
    const promoted = { ...row, active: spec, pending: null, pendingBy: null, agreedByMemberIds: [] };
    expect(mergePathWorld([phoneB], [promoted])[0]).toMatchObject({ pending: null });
    const newer = { ...row, pendingRevision: 2, pending: { ...spec, name: "Other" }, updatedAt: "2026-01-01T00:00:00.000Z" };
    expect((mergePathWorld([promoted], [newer])[0] as PathRecipeRow).pendingRevision).toBe(2);

    expect(shapePathWorld([
      null,
      { version: 2, id: "X", kind: "recipe" },
      { version: 1, id: "PATH-RCP-bad", kind: "recipe", pending: { name: "x", when: { signal: "nope", min: 1 }, brush: "bloom" } },
      { version: 1, id: "PATH-NAME", kind: "name", active: "", pending: null },
      { version: 1, id: "PATH-CAT-A", kind: "category", categoryId: "B", signal: "joy", setByMemberId: ME },
      { version: 1, id: "PATH-RCP-unknown", kind: "recipe", baseId: "not-a-recipe", pending: null, active: null },
    ])).toEqual([]);
  });

  it("treats proposing the same thing as agreeing, and breaks exact ties the same way everywhere", () => {
    let h = proposePathName(catalogHousehold(), { memberId: ME, name: "Cove", at: AT }).household;
    h = proposePathName(h, { memberId: PARTNER, name: "Cove", at: LATER }).household;
    expect(pathIslandName(h)).toBe("Cove");
    const a = { version: 1 as const, id: "PATH-CAT-SUB-LIFE-FUN", kind: "category" as const, categoryId: "SUB-LIFE-FUN", signal: "joy" as const, setByMemberId: ME, updatedAt: AT };
    const b = { ...a, signal: "home" as const, setByMemberId: PARTNER };
    expect(mergePathWorld([a], [b])).toEqual(mergePathWorld([b], [a]));
    expect(() => setPathCategorySignal(catalogHousehold(), { memberId: ME, categoryId: "X".repeat(90), signal: "joy" })).toThrow(/not available/);
  });

  it("lives in the Shared envelope, survives shaping, and never reaches Hercules disclosure", () => {
    const h = proposePathName(catalogHousehold(), { memberId: ME, name: "Cove", at: AT }).household;
    const shaped = ensureHouseholdShape(h);
    expect(shaped.pathWorld).toHaveLength(1);
    const split = splitForSync(shaped, ME);
    expect(split.shared.pathWorld).toHaveLength(1);
    expect((split.personal as unknown as Record<string, unknown>).pathWorld).toBeUndefined();
    expect(householdForAiDisclosure(shaped, ME, { view: "household" }).pathWorld ?? []).toHaveLength(0);
  });

  it("binds island changes into command identity and replays them exactly", async () => {
    const base = catalogHousehold();
    const named = proposePathName(base, { memberId: ME, name: "Cove", at: AT });
    expect(await commandIdentityHash(base, named.household, [])).not.toBe(await commandIdentityHash(base, base, []));
    const accepted = await acceptHouseholdWrite({
      previous: base,
      candidate: named.household,
      confirmationId: "path-name",
      commandKind: "updatePathWorld",
      postedIds: [],
      actingMemberId: ME,
      adapters: { persist: async () => {}, ingest: async () => ({ ok: true }) },
    });
    expect(accepted.ok).toBe(true);
    const receipt = accepted.household.commandReceipts!.find((row) => row.confirmationId === "path-name")!;
    expect(receipt.materializationHash).toMatch(/^[a-f0-9]{64}$/);
    const ref = receiptToCommandRef({ household: accepted.household, receipt, baseRevision: base.revision });
    const event = (id: string): ContinuityCommandEvent => ({
      id,
      environment: accepted.household.environment,
      household_id: accepted.household.householdId,
      member_id: ME,
      idempotency_key: ref.confirmationId,
      confirmation_id: ref.confirmationId,
      identity_hash: ref.identityHash,
      base_revision: base.revision,
      result_revision: accepted.household.revision,
      ledger_scope: ref.ledgerScope,
      command_type: ref.commandType,
      payload_json: {
        ...ref.commandPayload,
        materializationFacts: extractMaterializationFacts(accepted.household, ref.commandPayload.postedIds, {
          acceptedAt: ref.commandPayload.acceptedAt,
          ledgerScope: ref.ledgerScope,
          memberId: ME,
          commandKind: ref.commandType,
        }),
      },
      created_at: ref.commandPayload.acceptedAt,
    });
    const direct = await applyCommandEventLocally({ local: base, event: event("evt-path"), memberId: ME });
    if (!direct.ok) throw new Error(direct.reason);
    expect(direct.household.pathWorld).toEqual(accepted.household.pathWorld);

    const missing = event("evt-path-missing");
    missing.payload_json.materializationFacts = {};
    expect(await applyCommandEventLocally({ local: base, event: missing, memberId: ME }))
      .toEqual({ ok: false, reason: "path-world-materialization-invalid", fallback: true });
    const stranger = structuredClone(event("evt-path-stranger"));
    (stranger.payload_json.materializationFacts!.pathWorld![0] as { pendingBy: string }).pendingBy = "MEM-STRANGER";
    expect(await applyCommandEventLocally({ local: base, event: stranger, memberId: ME }))
      .toEqual({ ok: false, reason: "path-world-materialization-invalid", fallback: true });
    // A member cannot agree on the partner's behalf, even with a matching hash.
    const forgedRows = structuredClone(accepted.household.pathWorld!);
    (forgedRows[0] as { agreedByMemberIds: string[] }).agreedByMemberIds = [ME, PARTNER];
    const forged = structuredClone(event("evt-path-forged"));
    forged.payload_json.materializationFacts!.pathWorld = forgedRows;
    forged.payload_json.materializationHash = await sha256Hex(commandMaterializationFacts({ pathWorld: shapePathWorld(forgedRows) }));
    expect(await applyCommandEventLocally({ local: base, event: forged, memberId: ME }))
      .toEqual({ ok: false, reason: "path-world-materialization-invalid", fallback: true });
    // ...but the partner's own agreement that completes the proposal replays.
    const agreed = agreePathProposal(accepted.household, { memberId: PARTNER, rowId: PATH_NAME_ID, revision: 1, at: LATER }).household;
    expect(pathWorldChangeAuthorized(accepted.household, agreed.pathWorld!, PARTNER)).toBe(true);
    expect(pathWorldChangeAuthorized(accepted.household, agreed.pathWorld!, ME)).toBe(false);

    const tampered = structuredClone(event("evt-path-tampered"));
    (tampered.payload_json.materializationFacts!.pathWorld![0] as { pending: string }).pending = "Tampered";
    expect(await applyCommandEventLocally({ local: base, event: tampered, memberId: ME }))
      .toEqual({ ok: false, reason: "materialization-hash-mismatch", fallback: true });
  });
});

function tx(id: string, date: string, type: "expense" | "income", cents: number, subcategoryId: string, visibility: "household" | "personal" = "household"): Transaction {
  return {
    id, date, type, amountCents: cents, currency: "CAD", accountId: "ACC-CHEQUING", categoryId: null, subcategoryId,
    note: "", place: "", splits: [], source: "manual", duplicateKey: id, potentialDuplicate: false, isDuplicate: false,
    reviewed: true, createdBy: ME, visibility, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z`,
  } as Transaction;
}

describe("Our Path world — the months it grows from", () => {
  function fixture(): Household {
    let h = catalogHousehold();
    h = openChapter(h, { memberId: ME, foundationId: "make-rent-boring", at: "2026-06-03T12:00:00.000Z" }).household;
    const ritual = h.rituals![0]!;
    for (const day of ["2026-07-02", "2026-07-09", "2026-07-16", "2026-07-23"]) h = recordRitualHeld(h, { memberId: ME, ritualId: ritual.id, onDate: day, at: `${day}T12:00:00.000Z` }).household;
    h = closeChapter(h, { memberId: ME, chapterId: h.chapters![0]!.id, outcome: "life-changed", at: "2026-08-20T12:00:00.000Z" } as never).household;
    const goal = { id: "GOAL-TRIP", name: "Halifax", targetCents: 100_000, savedCents: 0, deadline: null, arrivalDate: null, shared: true, ownerMemberId: ME, subcategoryId: null, status: "open", funded: true, retiredAt: null, purchaseId: null, createdAt: "2026-06-01T12:00:00.000Z", updatedAt: "2026-06-01T12:00:00.000Z" } as unknown as Goal;
    const contribution = (id: string, date: string, cents: number): GoalContribution => ({ id, goalId: goal.id, memberId: ME, amountCents: cents, date, transferId: null, createdAt: `${date}T12:00:00.000Z`, updatedAt: `${date}T12:00:00.000Z` });
    h = {
      ...h,
      goals: [goal],
      goalContributions: [contribution("GC-1", "2026-06-10", 30_000), contribution("GC-2", "2026-07-10", 30_000)],
      transactions: [
        tx("T-1", "2026-06-01", "income", 400_000, "SUB-INCOME-WAGES"),
        tx("T-2", "2026-06-02", "expense", 150_000, "SUB-HOUSING-RENT"),
        tx("T-3", "2026-06-15", "expense", 40_000, "SUB-LIFE-FUN"),
        tx("T-4", "2026-07-01", "income", 200_000, "SUB-INCOME-WAGES"),
        tx("T-5", "2026-07-02", "expense", 180_000, "SUB-HOUSING-RENT"),
        tx("T-6", "2026-08-12", "expense", 90_000, "SUB-TRAVEL-FLIGHTS"),
        tx("T-7", "2026-08-13", "expense", 999_999, "SUB-LIFE-FUN", "personal"),
      ],
      categories: [...h.categories, { id: "SUB-TRAVEL-FLIGHTS", parentId: "CAT-LIFE", recordType: "category", name: "Flights", transactionType: "expense", essential: false, active: true, sortOrder: 99, createdAt: AT, updatedAt: AT } as Household["categories"][number]],
      nativeEvents: [{ version: 1, id: "EV-1", revision: 1, createdBy: ME, visibility: "household", title: "Ski weekend at Tremblant", start: "2026-08-14", end: "2026-08-16", allDay: true, timezone: "America/Toronto", fold: "earlier", repeat: "none", until: null, location: "", notes: "", exceptions: {}, createdAt: AT, updatedAt: AT } as never],
    };
    return h;
  }

  it("scores each shared month with its evidence and ignores Personal spending", () => {
    const months = pathMonths(fixture(), "2026-09-15");
    expect(months.map((m) => m.key)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09"]);
    const [june, july, august, september] = months as [typeof months[0], typeof months[0], typeof months[0], typeof months[0]];
    expect(june.tags).toContain("first-campfire");
    expect(june.scores.firsts).toBeGreaterThan(0.5);
    expect(june.scores.joy).toBeGreaterThan(0.5);
    expect(june.scores.saved).toBeGreaterThanOrEqual(0.4);
    expect(pathMonthCharacter(june)).toBe("bloom");
    expect(july.tags).toContain("milestone");
    expect(july.why.milestone).toMatch(/Halifax reached halfway/);
    expect(july.scores.rhythm).toBe(0.8);
    expect(july.scores.essentials).toBeGreaterThanOrEqual(0.7);
    expect(august.tags).toContain("life-changed");
    expect(pathMonthCharacter(august)).toBe("storm");
    expect(august.trip).toEqual({ name: "Ski weekend at Tremblant", type: "mountain" });
    // Personal-only fun never shows on the shared island.
    expect(august.scores.joy).toBe(0);
    // The month in progress is never judged.
    expect(september.tags).not.toContain("paused");
    expect(pathTripType("Beach week")).toBe("sea");
    expect(pathTripType("Weekend in Montréal")).toBe("city");
  });

  it("does not keep suggesting a category the couple muted", () => {
    const h = fixture();
    const withFun = { ...h, transactions: [...h.transactions, tx("T-9", "2026-08-20", "expense", 5000, "SUB-TRAVEL-FLIGHTS")] };
    const unmappedBefore = pathMonths({ ...withFun, pathWorld: [] }, "2026-09-15").flatMap((m) => m.unmappedCategories.map((c) => c.id));
    const muted = setPathCategorySignal(withFun, { memberId: ME, categoryId: "SUB-LIFE-FUN", signal: "none" }).household;
    const months = pathMonths(muted, "2026-09-15");
    expect(months.flatMap((m) => m.unmappedCategories.map((c) => c.id))).not.toContain("SUB-LIFE-FUN");
    expect(months.flatMap((m) => m.tags)).not.toContain("category:SUB-LIFE-FUN");
    expect(unmappedBefore).not.toContain("SUB-LIFE-FUN");
  });

  it("keeps the newest month on land for a full three years", () => {
    const h = { ...catalogHousehold(), transactions: [tx("T-OLD", "2019-01-05", "expense", 100, "SUB-LIFE-FUN")] };
    const months = pathMonths(h, "2026-09-15");
    for (const cur of [0, 12, 24, 35]) {
      const island = growIsland(months, effectivePathRecipes(h), cur);
      const p = island.spot(cur);
      expect(heightAt(island, p.x, p.z)).toBeGreaterThan(0.3);
    }
  });

  it("names every base recipe once and caps history at three years", () => {
    expect(new Set(PATH_BASE_RECIPES.map((r) => r.id)).size).toBe(PATH_BASE_RECIPES.length);
    const h = { ...catalogHousehold(), transactions: [tx("T-OLD", "2019-01-05", "expense", 100, "SUB-LIFE-FUN")] };
    const months = pathMonths(h, "2026-09-15");
    expect(months).toHaveLength(36);
    expect(months.at(-1)!.key).toBe("2026-09");
  });
});

describe("pathWorld capability guard", () => {
  const scope: Scope = { environment: "development", householdId: catalogHousehold().householdId, memberId: PARTNER, subject: "test-one" } as Scope;

  it("knows when a household holds island rows", () => {
    const base = catalogHousehold();
    expect(hasPathWorldData(base)).toBe(false);
    expect(hasPathWorldData({ pathWorld: [{ bogus: true }] as never })).toBe(false);
    const named = proposePathName(base, { memberId: ME, name: "Fictional Isle", at: AT }).household;
    expect(hasPathWorldData(named)).toBe(true);
    expect(PATH_WORLD_COMMAND_KINDS).toEqual(expect.arrayContaining(["proposePathRecipe", "proposePathName", "agreePathProposal", "declinePathProposal", "setPathCategorySignal"]));
  });

  it("carries the island capability and refuses an old client once the island exists or is being changed", async () => {
    const h = catalogHousehold();
    const one = splitForSync(h, PARTNER), two = splitForSync(h, ME);
    const state: AuthorityState = { sequence: h.revision, shared: one.shared, personal: new Map([[PARTNER, one.personal], [ME, two.personal]]) };
    const naming = await commandFromCapture(capturedIntent(proposePathName(h, { memberId: PARTNER, name: "Fictional Isle", at: AT }).household)!, scope, crypto.randomUUID());
    expect(naming.pathWorldVersion).toBe(1);
    expect(() => parseCommand({ ...naming, pathWorldVersion: 2 })).toThrow();

    // An old client proposing a change is refused even before any row exists.
    const oldNaming = { ...naming };
    delete (oldNaming as { pathWorldVersion?: 1 }).pathWorldVersion;
    expect(hasPathWorldData(assembleHousehold(state.shared, state.personal.get(PARTNER)!))).toBe(false);
    await expect(prepareCommand(state, oldNaming, scope, () => {})).rejects.toThrow(/CLIENT_RELOAD_REQUIRED: Reload Hearth to preserve your island/);

    // A money-only command from an old client goes through while the island holds no rows.
    const plain = { ...(await commandFromCapture(capturedIntent(postEntry(h, { date: "2026-09-12", type: "expense", amount: 5, accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: PARTNER, note: "Fictional tea", confirmDuplicate: true }).household)!, scope, crypto.randomUUID())) };
    delete (plain as { pathWorldVersion?: 1 }).pathWorldVersion;
    await expect(prepareCommand(state, plain, scope, () => {})).resolves.toBeTruthy();

    const accepted = await prepareCommand(state, naming, scope, () => {});
    expect(hasPathWorldData({ pathWorld: accepted.shared.pathWorld })).toBe(true);
    const next: AuthorityState = { sequence: accepted.receipt.sequence, shared: accepted.shared, personal: new Map([...state.personal, [PARTNER, accepted.personal]]) };

    // A money-only command from an old client is refused once the island holds rows.
    const old = { ...(await commandFromCapture(capturedIntent(postEntry(assembleHousehold(accepted.shared, accepted.personal), { date: "2026-09-12", type: "expense", amount: 5, accountId: "ACC-CHEQUING", subcategoryId: "SUB-FOOD-GROCERIES", createdBy: PARTNER, note: "Fictional coffee", confirmDuplicate: true }).household)!, scope, crypto.randomUUID())), observedSequence: accepted.receipt.sequence };
    delete (old as { pathWorldVersion?: 1 }).pathWorldVersion;
    await expect(prepareCommand(next, old, scope, () => {})).rejects.toThrow(/CLIENT_RELOAD_REQUIRED: Reload Hearth to preserve your island/);
    await expect(prepareCommand(next, { ...old, pathWorldVersion: 1 }, scope, () => {})).resolves.toBeTruthy();
  });
});

describe("Our Path journey — the road the two of us walk", () => {
  const h = { ...catalogHousehold(), transactions: [tx("T-OLD", "2025-09-05", "expense", 100, "SUB-LIFE-FUN")] };
  const months = pathMonths(h, "2026-09-15");
  const island = growIsland(months, effectivePathRecipes(h), months.length - 1);

  it("starts and ends on the month spots, reads the ground, and is the same every time", () => {
    expect(months.length).toBeGreaterThanOrEqual(6);
    const from = 1, to = months.length - 1;
    const pts = walkPath(island, from, to, 24);
    expect(pts).toHaveLength(25);
    expect(pts[0]).toMatchObject({ x: island.spot(from).x, z: island.spot(from).z });
    expect(pts.at(-1)).toMatchObject({ x: island.spot(to).x, z: island.spot(to).z });
    for (const p of pts) expect(p.y).toBe(heightAt(island, p.x, p.z));
    expect(walkPath(island, from, to, 24)).toEqual(pts);
    // It follows the spiral road rather than cutting across: halfway is the spot halfway between the months.
    const mid = island.spot(from + (to - from) / 2);
    expect(pts[12]!.x).toBeCloseTo(mid.x, 9);
    expect(pts[12]!.z).toBeCloseTo(mid.z, 9);
  });

  it("walks back along the same road when scrubbed backwards", () => {
    const to = months.length - 1;
    const forward = walkPath(island, 0, to, 12);
    expect(walkPath(island, to, 0, 12)).toEqual([...forward].reverse());
    expect(walkPath(island, 1, 1, 0)).toHaveLength(2);
  });

  it("takes about 0.8 s per month and never drags on", () => {
    expect(walkSeconds(3, 4)).toBeCloseTo(0.8);
    expect(walkSeconds(4, 3)).toBeCloseTo(0.8);
    expect(walkSeconds(0, 2)).toBeCloseTo(1.6);
    expect(walkSeconds(0, 30)).toBe(3.2);
    expect(walkSeconds(2, 2)).toBe(0);
  });
});

describe("Our Path landmarks: month-end readings, kiln warmth, and coin counts", () => {
  it("reads a past month as of its last day and the current month as of today", () => {
    expect(pathMonthAsOf("2026-08", "2026-09-15")).toBe("2026-08-31");
    expect(pathMonthAsOf("2026-02", "2026-09-15")).toBe("2026-02-28");
    expect(pathMonthAsOf("2024-02", "2026-09-15")).toBe("2024-02-29");
    expect(pathMonthAsOf("2025-12", "2026-09-15")).toBe("2025-12-31");
    expect(pathMonthAsOf("2026-09", "2026-09-15")).toBe("2026-09-15");
    expect(pathMonthAsOf("2026-10", "2026-09-15")).toBe("2026-09-15");
  });
  it("keeps the kiln warm for thirty days after a firing, never before it", () => {
    expect(firedRecently(null, "2026-09-15")).toBe(false);
    expect(firedRecently("2026-09-15T02:00:00.000Z", "2026-09-15")).toBe(true);
    expect(firedRecently("2026-08-16T12:00:00.000Z", "2026-09-15")).toBe(true);
    expect(firedRecently("2026-08-15T12:00:00.000Z", "2026-09-15")).toBe(false);
    expect(firedRecently("2026-07-01T12:00:00.000Z", "2026-09-15")).toBe(false);
    expect(firedRecently("2026-09-20T12:00:00.000Z", "2026-09-15")).toBe(false);
  });
  it("sends coins only when a known bank's step changes, capped by the pool", () => {
    expect(landmarkStepChange(undefined, 4)).toBeNull();
    expect(landmarkStepChange(4, 4)).toBeNull();
    expect(landmarkStepChange(2, 5)).toEqual({ dir: "up", n: 3 });
    expect(landmarkStepChange(7, 3)).toEqual({ dir: "down", n: 4 });
    expect(landmarkStepChange(0, 10)).toEqual({ dir: "up", n: 10 });
    expect(COIN_POOL).toBe(12);
  });
});
