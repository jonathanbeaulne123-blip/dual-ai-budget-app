import { captureCommand } from "../ledgerSync/capture.ts";
import { cloneHousehold } from "./household.ts";
import { nextId, nowIso } from "./ids.ts";
import {
  CATEGORY_DEFAULT_FUNDS,
  FUND_IDS,
  HOUSEHOLD_FUND_MARKER_ID,
  LEGACY_CARD_PAYMENT_ID,
  RETIRED_GROUP_IDS,
  SEED_CHILD_HOMES,
  UMBRELLAS,
  fundDivisionId,
  fundModelMode,
  fundOverrideId,
  householdFundMarker,
  isUmbrellaId,
  personalFundMarker,
  personalFundMarkerId,
  proposedDefaultFund,
  shapeFundModelRows,
  umbrellaById,
  umbrellaForName,
  umbrellaForRowId,
  v1FundForName,
  type FundDivisionRow,
  type FundId,
  type FundMarkerRow,
  type FundMigrationChange,
  type FundModelRow,
  type FundOverrideSourceKind,
  type FundRefillRow,
  type FundSplit,
  type UmbrellaId,
} from "./fundRules.ts";
import type { MonthKey } from "./calendar.ts";
import type { Category, CommitResult, Household, LedgerView } from "./types.ts";
import { ValidationError } from "./types.ts";
import { isVisibleInView } from "./visibility.ts";

/**
 * Money model commands (D-268…D-272). Every command here is non-money: no
 * journal line, no Fund event, no transfer. They write the `fundModelRows`
 * side collection and, for the migration, category rows and bank designs.
 * All of them travel as commandKind `updateFundModel`.
 */

const BILL_KINDS = new Set(["obligation", "true-expense", "bridge-commitment"]);
const BILL_DESIGN = /^(recurrence|potential|task|plan-line|appointment):/;

function requireActiveMember(h: Household, memberId: string): void {
  if (!h.members.some((member) => member.active && member.id === memberId)) throw new ValidationError("Only an active household member can do this.");
}
function requireV2(h: Household): FundMarkerRow {
  const marker = householdFundMarker(h);
  if (!marker) throw new ValidationError("Hearth hasn't sorted this household the new way yet.");
  return marker;
}
function withRows(next: Household, rows: FundModelRow[]): void {
  const ids = new Set(rows.map((row) => row.id));
  next.fundModelRows = shapeFundModelRows([...(next.fundModelRows ?? []).filter((row) => !ids.has(row.id)), ...rows]);
}
function commitFundModel(previous: Household, next: Household, label: string, at: string, postedIds: string[] = [], personal?: string): CommitResult {
  next.lastCommittedAt = at;
  return {
    household: next,
    warnings: [],
    postedIds,
    ...(personal ? { persistenceScope: "member-personal" as const, personalMemberId: personal } : {}),
    undo: { id: nextId("UNDO-FUND-", []), label, snapshot: previous, postedIds, commandKind: "updateFundModel" },
  };
}
const activeMemberIds = (h: Household) => h.members.filter((member) => member.active).map((member) => member.id).sort();
const categorySnapshot = (row: Category) => ({
  name: row.name, parentId: row.parentId, active: row.active,
  ...(row.umbrellaId ? { umbrellaId: row.umbrellaId } : {}),
  ...(row.defaultFund ? { defaultFund: row.defaultFund } : {}),
});

// ---------------------------------------------------------------------------
// The household step.

export type FundMigrationPlan = {
  categories: Category[];
  changes: FundMigrationChange[];
  needsHome: string[];
  /** Household designs whose category moves protect → prepare. */
  designs: Array<{ id: string; before: FundId | null; after: FundId }>;
  /** Shared untyped goals whose fund is frozen at its v1 answer (read-side; nothing is written to the goal). */
  frozenGoals: Array<{ id: string; fund: FundId }>;
};

/** Refuse if an accepted or proposed household plan still reads Protect as "bills". */
export function householdPlanGuard(h: Household): string | null {
  const blocked = (h.planVersions ?? []).some((version) => version.scope === "household" && version.state !== "superseded"
    && version.lines.some((line) => line.lens === "protect" && BILL_KINDS.has(line.kind)));
  return blocked ? "A household plan still keeps bills in Protect. Move those lines to Prepare in a new plan first; nothing was changed." : null;
}
export function personalPlanGuard(h: Household, memberId: string): string | null {
  const blocked = (h.planVersions ?? []).some((version) => version.scope === "personal" && version.ownerMemberId === memberId && version.state !== "superseded"
    && version.lines.some((line) => line.lens === "protect" && BILL_KINDS.has(line.kind)));
  return blocked ? "One of your own plans still keeps bills in Protect. Move those lines to Prepare in a new plan first; nothing was changed." : null;
}

/**
 * Pure: exactly what `migrateFundModel` will write, over household-visible
 * rows only. Every child is re-homed before any group is retired (R2-H3), so
 * nothing that posts today stops posting.
 */
export function planFundMigration(h: Household, at: string): FundMigrationPlan {
  const categories = h.categories.map((row) => ({ ...row }));
  const byId = new Map(categories.map((row) => [row.id, row]));
  const changes: FundMigrationChange[] = [];
  const before = new Map(h.categories.map((row) => [row.id, categorySnapshot(row)]));
  let sortBase = categories.reduce((max, row) => Math.max(max, row.sortOrder), 0);
  // 1. The 14 locked umbrella rows exist, carry their umbrella, and are active.
  for (const umbrella of UMBRELLAS) {
    const row = byId.get(umbrella.rowId);
    if (row) {
      if (row.recordType !== "group" || row.transactionType !== umbrella.transactionType) throw new ValidationError(`The ${umbrella.name} group can't be sorted automatically. Run Health Check.`);
      Object.assign(row, { name: umbrella.name, umbrellaId: umbrella.id, active: true, parentId: null, updatedAt: at });
    } else {
      sortBase += 1;
      const created: Category = {
        id: umbrella.rowId, parentId: null, recordType: "group", name: umbrella.name, transactionType: umbrella.transactionType,
        essential: umbrella.id === "utilities", incomeStability: null, active: true, sortOrder: umbrella.sortOrder, createdAt: at, updatedAt: at,
        umbrellaId: umbrella.id,
      };
      categories.push(created);
      byId.set(created.id, created);
    }
  }
  const umbrellaRowIds = new Set(UMBRELLAS.map((row) => row.rowId));
  const retiredIds = new Set<string>(RETIRED_GROUP_IDS);
  const needsHome: string[] = [];
  // 2. Every child gets a home and (expense) a default fund.
  for (const child of categories.filter((row) => row.recordType === "category")) {
    const parent = child.parentId ? byId.get(child.parentId) : undefined;
    const parentName = parent?.name ?? "";
    let umbrella: UmbrellaId | null;
    if (child.transactionType === "income") umbrella = "coming-in";
    else if (SEED_CHILD_HOMES[child.id]) umbrella = SEED_CHILD_HOMES[child.id]!.umbrella;
    else if (parent && umbrellaRowIds.has(parent.id) && !retiredIds.has(parent.id)) umbrella = umbrellaForRowId(parent.id)!.id;
    else umbrella = umbrellaForName(child.name) ?? umbrellaForName(parentName)
      ?? (parent?.id === "CAT-DEBT" ? "money" : null);
    if (umbrella && child.transactionType === "expense" && umbrella === "coming-in") umbrella = null;
    if (!umbrella) {
      // Stays under its own (still active) group and is listed as "Needs a home".
      needsHome.push(child.id);
      if (parent && retiredIds.has(parent.id)) retiredIds.delete(parent.id);
      if (child.transactionType === "expense" && !child.defaultFund) child.defaultFund = proposedDefaultFund(child.name, "personal") ?? "everyday";
      continue;
    }
    child.parentId = umbrellaById(umbrella).rowId;
    if (child.transactionType === "expense" && umbrella !== "moving-money") {
      const seeded = SEED_CHILD_HOMES[child.id]?.fund;
      const fund = child.defaultFund ?? seeded ?? proposedDefaultFund(child.name, umbrella) ?? "everyday";
      child.defaultFund = fund === "protect" ? "everyday" : fund;
    } else {
      delete child.defaultFund;
    }
  }
  // 3. Retire emptied non-umbrella groups (never delete). The legacy card child stays active under Moving money.
  const stillParent = new Set(categories.filter((row) => row.recordType === "category").map((row) => row.parentId));
  for (const group of categories.filter((row) => row.recordType === "group" && !umbrellaRowIds.has(row.id))) {
    if (!stillParent.has(group.id) && group.active) group.active = false;
  }
  for (const row of categories) {
    const was = before.get(row.id);
    const now = categorySnapshot(row);
    if (!was || JSON.stringify(was) !== JSON.stringify(now)) {
      if (was) row.updatedAt = at;
      changes.push({ type: "category", id: row.id, before: was ?? { name: "", parentId: null, active: false }, after: now });
    }
  }
  // 4. Household bill designs in Protect move to Prepare (Jonathan: all of them).
  const designs = (h.kittyNestDesigns ?? [])
    .filter((row) => row.visibility === "household" && row.category === "protect" && BILL_DESIGN.test(row.bankKey))
    .map((row) => ({ id: row.id, before: row.category, after: "prepare" as FundId }));
  for (const design of designs) changes.push({ type: "design", ...design });
  // 5. Shared goals without a saved type keep today's answer (Q-F), frozen by creation date.
  const frozenGoals = h.goals.filter((goal) => goal.shared && !goal.envelope).map((goal) => ({ id: goal.id, fund: v1Fund(goal.name) }));
  for (const goal of frozenGoals) changes.push({ type: "goal", id: goal.id, before: null, after: goal.fund });
  categories.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  return { categories, changes, needsHome: needsHome.sort(), designs, frozenGoals };
}
const v1Fund = (name: string): FundId => v1FundForName(name);

export const migrateFundModel = captureCommand("migrateFundModel", function migrateFundModel(household: Household, input: { memberId: string; at?: string }): CommitResult {
  requireActiveMember(household, input.memberId);
  if (householdFundMarker(household)) throw new ValidationError("This household is already sorted the new way.");
  const guard = householdPlanGuard(household);
  if (guard) throw new ValidationError(guard);
  const at = input.at ?? nowIso();
  const plan = planFundMigration(household, at);
  const next = cloneHousehold(household);
  next.categories = plan.categories;
  const moved = new Map(plan.designs.map((row) => [row.id, row]));
  next.kittyNestDesigns = (next.kittyNestDesigns ?? []).map((row) => moved.has(row.id)
    ? { ...row, category: "prepare", revision: row.revision + 1, updatedAt: at > row.updatedAt ? at : row.updatedAt }
    : row);
  const marker: FundMarkerRow = {
    version: 2, kind: "marker", id: HOUSEHOLD_FUND_MARKER_ID, visibility: "household", setBy: input.memberId,
    migratedAt: at, changes: plan.changes, needsHome: plan.needsHome, updatedAt: at,
  };
  withRows(next, [marker]);
  const postedIds = [
    ...plan.changes.filter((row) => row.type === "category").map((row) => row.id),
    ...plan.designs.map((row) => row.id),
  ];
  return commitFundModel(household, next, "Hearth sorted our money the new way", at, [...new Set(postedIds)].sort());
});

// ---------------------------------------------------------------------------
// The personal step: each owner, on their own device, over their own rows only.

export const migrateMyFundModel = captureCommand("migrateMyFundModel", function migrateMyFundModel(household: Household, input: { memberId: string; at?: string }): CommitResult {
  requireActiveMember(household, input.memberId);
  requireV2(household);
  if (personalFundMarker(household, input.memberId)) throw new ValidationError("Your own money is already sorted the new way.");
  const guard = personalPlanGuard(household, input.memberId);
  if (guard) throw new ValidationError(guard);
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const changes: FundMigrationChange[] = [];
  next.kittyNestDesigns = (next.kittyNestDesigns ?? []).map((row) => {
    if (row.visibility !== "personal" || row.createdBy !== input.memberId || row.category !== "protect" || !BILL_DESIGN.test(row.bankKey)) return row;
    changes.push({ type: "design", id: row.id, before: "protect", after: "prepare" });
    return { ...row, category: "prepare", revision: row.revision + 1, updatedAt: at > row.updatedAt ? at : row.updatedAt };
  });
  next.planDrafts = (next.planDrafts ?? []).map((draft) => {
    if (draft.ownerMemberId !== input.memberId) return draft;
    let touched = false;
    const lines = draft.lines.map((line) => {
      if (line.lens !== "protect" || !BILL_KINDS.has(line.kind)) return line;
      touched = true;
      changes.push({ type: "plan-line", id: line.id, draftId: draft.id, before: "protect", after: "prepare" });
      return { ...line, lens: "prepare" as const };
    });
    return touched ? { ...draft, lines, updatedAt: at } : draft;
  });
  for (const goal of household.goals.filter((row) => !row.shared && row.ownerMemberId === input.memberId && !row.envelope)) {
    changes.push({ type: "goal", id: goal.id, before: null, after: v1Fund(goal.name) });
  }
  withRows(next, [{
    version: 2, kind: "marker", id: personalFundMarkerId(input.memberId), visibility: "personal", setBy: input.memberId,
    migratedAt: at, changes, needsHome: [], updatedAt: at,
  }]);
  return commitFundModel(household, next, "Sorted my own money the new way", at, [], input.memberId);
});

// ---------------------------------------------------------------------------
// Line overrides.

function sourceVisible(h: Household, memberId: string, view: LedgerView, kind: FundOverrideSourceKind, id: string): boolean {
  if (kind === "transaction") { const row = h.transactions.find((tx) => tx.id === id); return Boolean(row && isVisibleInView(row, memberId, view)); }
  if (kind === "potential") { const row = (h.potentialExpenses ?? []).find((tx) => tx.id === id); return Boolean(row && isVisibleInView(row, memberId, view)); }
  if (kind === "task") { const row = (h.tasks ?? []).find((task) => task.id === id); return Boolean(row && !row.deleted && row.visibility === view && (view === "household" || row.createdBy === memberId)); }
  const row = h.recurrences.find((item) => item.id === id);
  if (!row) return false;
  const account = h.accounts.find((item) => item.id === row.accountId);
  return view === "household" ? account?.scope !== "personal" : account?.scope === "personal" && account.ownerMemberId === memberId;
}

export const setFundOverride = captureCommand("setFundOverride", function setFundOverride(household: Household, input: {
  memberId: string; view: LedgerView; sourceKind: FundOverrideSourceKind; sourceId: string; fund: FundId | null; at?: string;
}): CommitResult {
  requireActiveMember(household, input.memberId);
  requireV2(household);
  if (!["transaction", "recurrence", "potential", "task"].includes(input.sourceKind)) throw new ValidationError("That line can't take a fund.");
  if (input.fund !== null && !FUND_IDS.includes(input.fund)) throw new ValidationError("Choose Prepare, Protect, Build or Everyday.");
  if (!sourceVisible(household, input.memberId, input.view, input.sourceKind, input.sourceId)) throw new ValidationError("That line isn't available here.");
  const at = input.at ?? nowIso();
  const id = fundOverrideId(input.view, input.memberId, input.sourceKind, input.sourceId);
  const next = cloneHousehold(household);
  if (input.fund === null) {
    next.fundModelRows = shapeFundModelRows((next.fundModelRows ?? []).filter((row) => row.id !== id));
  } else {
    withRows(next, [{ version: 2, kind: "override", id, sourceKind: input.sourceKind, sourceId: input.sourceId, fund: input.fund, visibility: input.view, setBy: input.memberId, updatedAt: at }]);
  }
  return commitFundModel(household, next, input.fund ? `Filed a line under ${input.fund}` : "Put a line back on its usual fund", at, [], input.view === "personal" ? input.memberId : undefined);
});

// ---------------------------------------------------------------------------
// Category homes: children move between umbrellas; umbrellas never change.

export const setCategoryHome = captureCommand("setCategoryHome", function setCategoryHome(household: Household, input: {
  memberId: string; categoryId: string; umbrellaId?: UmbrellaId; defaultFund?: FundId; name?: string; at?: string;
}): CommitResult {
  requireActiveMember(household, input.memberId);
  const marker = requireV2(household);
  const child = household.categories.find((row) => row.id === input.categoryId);
  if (!child) throw new ValidationError("That category is not available.");
  if (child.recordType === "group") throw new ValidationError("Umbrellas are fixed. Their names and places can't change.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const row = next.categories.find((item) => item.id === child.id)!;
  const beforeParent = row.parentId;
  if (input.umbrellaId !== undefined) {
    if (!isUmbrellaId(input.umbrellaId)) throw new ValidationError("Choose one of the umbrellas.");
    const umbrella = umbrellaById(input.umbrellaId);
    if (umbrella.transactionType !== row.transactionType || (row.transactionType === "expense" && !umbrella.spending && row.id !== LEGACY_CARD_PAYMENT_ID)) throw new ValidationError("That umbrella doesn't hold this kind of line.");
    const parent = next.categories.find((item) => item.id === umbrella.rowId && item.active);
    if (!parent) throw new ValidationError("That umbrella is missing. Run Health Check.");
    row.parentId = parent.id;
  }
  if (input.defaultFund !== undefined) {
    if (row.transactionType !== "expense" || !CATEGORY_DEFAULT_FUNDS.includes(input.defaultFund)) throw new ValidationError("Choose Prepare, Build or Everyday. Nothing starts in Protect.");
    row.defaultFund = input.defaultFund;
  }
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name || name.length > 80) throw new ValidationError("Give the category a name.");
    row.name = name;
  }
  row.updatedAt = at;
  const posted = [row.id];
  // A holding group that just lost its last child retires (never deleted).
  if (beforeParent && beforeParent !== row.parentId && !umbrellaForRowId(beforeParent)) {
    const old = next.categories.find((item) => item.id === beforeParent);
    if (old && old.active && !next.categories.some((item) => item.parentId === old.id && item.recordType === "category")) {
      old.active = false; old.updatedAt = at; posted.push(old.id);
    }
  }
  if (marker.needsHome.includes(row.id) && row.parentId && umbrellaForRowId(row.parentId)) {
    withRows(next, [{ ...marker, needsHome: marker.needsHome.filter((id) => id !== row.id), updatedAt: at }]);
  }
  return commitFundModel(household, next, `Moved ${row.name}`, at, posted);
});

// ---------------------------------------------------------------------------
// Proposals: contribution division (both confirm) and Protect refill (custodian proposes, partner confirms).

function promote<T extends FundDivisionRow | FundRefillRow>(h: Household, row: T): T {
  if (row.state !== "proposed") return row;
  const members = activeMemberIds(h);
  return members.every((id) => row.agreedBy.includes(id)) ? { ...row, state: "confirmed" } : row;
}
const splitTotal = (split: FundSplit) => FUND_IDS.reduce((sum, fund) => sum + split[fund], 0);

export const proposeFundDivision = captureCommand("proposeFundDivision", function proposeFundDivision(household: Household, input: {
  memberId: string; contributionEventId: string; split: FundSplit; at?: string;
}): CommitResult {
  requireActiveMember(household, input.memberId);
  requireV2(household);
  const event = (household.fundEvents ?? []).find((row) => row.id === input.contributionEventId && row.kind === "contribution-confirmed");
  if (!event) throw new ValidationError("Only a confirmed contribution can be divided.");
  const reversed = (household.fundEvents ?? []).some((row) => row.kind === "reversal" && row.relatedEventId === event.id);
  if (reversed) throw new ValidationError("That contribution was reversed.");
  const split = Object.fromEntries(FUND_IDS.map((fund) => [fund, input.split?.[fund] ?? 0])) as FundSplit;
  if (!FUND_IDS.every((fund) => Number.isSafeInteger(split[fund]) && split[fund] >= 0) || splitTotal(split) !== event.amountCents) {
    throw new ValidationError("The split has to add up to the contribution, to the cent.");
  }
  const at = input.at ?? nowIso();
  const id = fundDivisionId(event.id);
  const existing = (household.fundModelRows ?? []).find((row): row is FundDivisionRow => row.id === id && row.kind === "division");
  if (existing?.state === "confirmed") throw new ValidationError("This contribution is already divided.");
  if (existing?.state === "proposed" && JSON.stringify(existing.split) === JSON.stringify(split)) {
    return agreeFundDivision(household, { memberId: input.memberId, id, revision: existing.revision, ...(input.at ? { at: input.at } : {}) });
  }
  const next = cloneHousehold(household);
  const row: FundDivisionRow = promote<FundDivisionRow>(next, {
    version: 2, kind: "division", id, visibility: "household", contributionEventId: event.id, amountCents: event.amountCents, split,
    proposedBy: input.memberId, revision: (existing?.revision ?? 0) + 1, agreedBy: [input.memberId], state: "proposed", updatedAt: at,
  } satisfies FundDivisionRow);
  withRows(next, [row]);
  return commitFundModel(household, next, row.state === "confirmed" ? "Divided a contribution" : "Suggested how to divide a contribution", at);
});

function respond<T extends FundDivisionRow | FundRefillRow>(household: Household, input: { memberId: string; id: string; revision: number; at?: string }, kind: T["kind"], answer: "agree" | "decline" | "withdraw"): CommitResult {
  requireActiveMember(household, input.memberId);
  requireV2(household);
  const row = (household.fundModelRows ?? []).find((item): item is T => item.id === input.id && item.kind === kind) as T | undefined;
  if (!row || row.state !== "proposed" || row.revision !== input.revision) throw new ValidationError("That suggestion changed. Review its latest version.");
  if (answer === "withdraw" && row.proposedBy !== input.memberId) throw new ValidationError("Only the person who suggested it can take it back.");
  if (answer !== "withdraw" && row.proposedBy === input.memberId) throw new ValidationError("Your partner confirms this one.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const updated = answer === "agree"
    ? promote(next, { ...row, agreedBy: [...new Set([...row.agreedBy, input.memberId])].sort(), updatedAt: at })
    : { ...row, state: answer === "decline" ? "declined" as const : "withdrawn" as const, updatedAt: at };
  withRows(next, [updated]);
  const what = kind === "division" ? "the split" : "the Protect refill";
  return commitFundModel(household, next, answer === "agree" ? (updated.state === "confirmed" ? `We both agreed ${what}` : `Agreed ${what}`) : answer === "decline" ? `Set ${what} aside` : `Took back ${what}`, at);
}
export const agreeFundDivision = captureCommand("agreeFundDivision", (household: Household, input: { memberId: string; id: string; revision: number; at?: string }) => respond<FundDivisionRow>(household, input, "division", "agree"));
export const declineFundDivision = captureCommand("declineFundDivision", (household: Household, input: { memberId: string; id: string; revision: number; at?: string }) => respond<FundDivisionRow>(household, input, "division", "decline"));

export const proposeProtectRefill = captureCommand("proposeProtectRefill", function proposeProtectRefill(household: Household, input: {
  memberId: string; monthKey: MonthKey; toFund: "build" | "everyday"; amountCents: number; note?: string; at?: string;
}): CommitResult {
  requireActiveMember(household, input.memberId);
  requireV2(household);
  if (household.householdFund?.custodianMemberId !== input.memberId) throw new ValidationError("The Fund's custodian suggests a Protect refill; the partner confirms it.");
  if (!["build", "everyday"].includes(input.toFund)) throw new ValidationError("Prepare already fills before Protect. Choose Build or Everyday.");
  if (!Number.isSafeInteger(input.amountCents) || input.amountCents < 1) throw new ValidationError("Enter an amount.");
  if (!/^\d{4}-\d{2}$/.test(input.monthKey)) throw new ValidationError("Choose a month.");
  const at = input.at ?? nowIso();
  const next = cloneHousehold(household);
  const row: FundRefillRow = promote<FundRefillRow>(next, {
    version: 2, kind: "refill", id: nextId("FUND-REFILL-", (household.fundModelRows ?? []).map((item) => item.id)), visibility: "household",
    monthKey: input.monthKey, toFund: input.toFund, amountCents: input.amountCents, note: (input.note ?? "").trim().slice(0, 200),
    proposedBy: input.memberId, revision: 1, agreedBy: [input.memberId], state: "proposed", updatedAt: at,
  } satisfies FundRefillRow);
  withRows(next, [row]);
  return commitFundModel(household, next, "Suggested a Protect refill", at);
});
export const agreeProtectRefill = captureCommand("agreeProtectRefill", (household: Household, input: { memberId: string; id: string; revision: number; at?: string }) => respond<FundRefillRow>(household, input, "refill", "agree"));
export const declineProtectRefill = captureCommand("declineProtectRefill", (household: Household, input: { memberId: string; id: string; revision: number; at?: string }) => respond<FundRefillRow>(household, input, "refill", "decline"));
export const withdrawFundProposal = captureCommand("withdrawFundProposal", (household: Household, input: { memberId: string; id: string; revision: number; kind: "division" | "refill"; at?: string }) => (
  input.kind === "division" ? respond<FundDivisionRow>(household, input, "division", "withdraw") : respond<FundRefillRow>(household, input, "refill", "withdraw")
));

/** True when the household is on v2 and this member hasn't sorted their own rows yet. */
export function needsMyFundMigration(h: Household, memberId: string): boolean {
  return fundModelMode(h) === 2 && !personalFundMarker(h, memberId);
}
