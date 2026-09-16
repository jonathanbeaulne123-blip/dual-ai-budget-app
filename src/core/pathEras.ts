import { captureCommand } from "../ledgerSync/capture.ts";
import { monthKeyFromDateKey, shiftMonthKey, type DateKey } from "./calendar.ts";
import { cloneHousehold } from "./household.ts";
import { projectHouseholdFundOperatingBalanceBefore } from "./householdFund.ts";
import { nextId, nowIso } from "./ids.ts";
import { kittyBankBackingStep } from "./kittyBanks.ts";
import {
  agreedValue,
  assertEraProposalFits,
  commitPathWorld,
  promoteIfAgreed,
  requireMember,
  shapeEraPlan,
  shapeEraSpec,
  shapePathWorld,
  withRow,
  type PathEraPlan,
  type PathEraRow,
  type PathEraSpec,
} from "./pathWorld.ts";
import { bookBalanceAsOf } from "./statements.ts";
import type { CommitResult, Household } from "./types.ts";
import { ValidationError } from "./types.ts";

/**
 * The Journey of Life read-model and commands (D-268).
 *
 * One journey per household; the journey is the ordered list of agreed eras.
 * The first agreed era that has not been crossed is the *current* era (its
 * island is the one that grows); earlier eras are *past*; later eras are
 * *future*. An era that only one of us has suggested so far is *sketched*.
 *
 * Finish rules are read here, from accepted books, and only ever produce
 * lanterns (lit or not) and plain words — never an amount.
 */

export type PathEraState = "past" | "current" | "future" | "sketched";
export type PathEraLantern = { label: string; lit: boolean };
export type PathEraProgress = {
  met: boolean;
  lanterns: PathEraLantern[];
  /** Plain words: what the finish line needs, and what is still missing. */
  why: string[];
};
export type PathEraPlanView = PathEraPlan & {
  /** Only in the pending suggestion (drawn in pencil). */
  sketched: boolean;
  /** 0–10 for a bank plan (the studio's growth step), else null. */
  step: number | null;
  bought: boolean;
};
export type PathEraView = {
  id: string;
  row: PathEraRow;
  /** The agreed era, or the suggestion when nothing is agreed yet. */
  spec: PathEraSpec;
  /** A suggestion waiting on at least one of us, if any. */
  pending: PathEraSpec | null;
  pendingBy: string | null;
  state: PathEraState;
  /** YYYY-MM months the era has lived through (past: from → the month before crossing; current: from → now). */
  months: string[];
  progress: PathEraProgress;
  plans: PathEraPlanView[];
};

function monthsFrom(first: string, last: string): string[] {
  const out: string[] = [];
  let key = first;
  while (key <= last && out.length < 1200) { out.push(key); key = shiftMonthKey(key, 1); }
  return out;
}
const monthEnd = (month: string): DateKey => `${shiftMonthKey(month, 1)}-01` as DateKey;
const dayBefore = (month: string): DateKey => {
  const next = monthEnd(month);
  const d = new Date(`${next}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10) as DateKey;
};
const monthLabel = (month: string) => {
  const d = new Date(`${month}-15T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? month : d.toLocaleDateString("en-CA", { month: "short", year: "numeric", timeZone: "UTC" });
};

/**
 * "Without going broke" for a month (recommendation in the plan; a money-meaning call for Jonathan):
 * the Household Fund did not end the month below zero, and no shared chequing or savings account did.
 */
export function pathMonthBroke(household: Household, month: string): string | null {
  const end = dayBefore(month);
  if (household.householdFund) {
    try {
      if (projectHouseholdFundOperatingBalanceBefore(household, monthEnd(month), household.householdFund.id) < 0) return "The Fund ended the month below zero";
    } catch { /* no reading is not a failure */ }
  }
  for (const account of household.accounts) {
    if (!account.active || account.scope === "personal" || (account.kind !== "chequing" && account.kind !== "savings")) continue;
    try {
      if (bookBalanceAsOf(household, account.id, end) < 0) return `${account.name} ended the month below zero`;
    } catch { /* ignore unreadable accounts */ }
  }
  return null;
}

export function pathEraProgress(household: Household, spec: PathEraSpec, today: DateKey): PathEraProgress {
  const finish = spec.finish;
  if (finish.kind === "agree") {
    return { met: true, lanterns: [{ label: "When we both say so", lit: true }], why: ["This era is finished when you both agree to cross."] };
  }
  if (finish.kind === "banks") {
    const lanterns = finish.goalIds.map((goalId) => {
      const goal = household.goals.find((row) => row.id === goalId && row.shared);
      if (!goal) return { label: "A Kitty Bank that is no longer shared", lit: false };
      const bought = Boolean(goal.purchaseId);
      const full = bought || kittyBankBackingStep(household, goal, today) >= 10;
      return { label: `${goal.name}${bought ? " · bought" : full ? " · full" : ""}`, lit: full };
    });
    const missing = lanterns.filter((row) => !row.lit).length;
    return { met: missing === 0, lanterns, why: [missing ? `${missing} of ${lanterns.length} Kitty Banks still filling` : "Every Kitty Bank on the finish line is full or bought."] };
  }
  const nowMonth = monthKeyFromDateKey(today);
  const through = spec.crossedOn ? shiftMonthKey(spec.crossedOn, -1) : nowMonth;
  const months = monthsFrom(spec.from, through).filter((month) => month < nowMonth || spec.crossedOn !== null);
  const lanterns: PathEraLantern[] = [];
  const why: string[] = [];
  let broke = false;
  for (let i = 0; i < finish.months; i += 1) {
    const month = months[i];
    if (!month) { lanterns.push({ label: `Month ${i + 1} · still ahead`, lit: false }); continue; }
    const reason = pathMonthBroke(household, month);
    if (reason) { broke = true; why.push(`${monthLabel(month)}: ${reason}`); }
    lanterns.push({ label: `${monthLabel(month)}${reason ? " · below zero" : ""}`, lit: !reason });
  }
  const lit = lanterns.filter((row) => row.lit).length;
  const met = lit === finish.months && !broke;
  why.unshift(met ? `${finish.months} months through without going broke.` : `${lit} of ${finish.months} months through without going broke.`);
  return { met, lanterns, why };
}

export function pathEras(household: Household, today: DateKey): PathEraView[] {
  const rows = shapePathWorld(household.pathWorld).filter((row): row is PathEraRow => row.kind === "era");
  const nowMonth = monthKeyFromDateKey(today);
  const agreed = rows
    .flatMap((row) => { const spec = agreedValue(row, household); return spec && !spec.retired ? [{ row, spec }] : []; })
    .sort((a, b) => a.spec.order - b.spec.order || a.row.id.localeCompare(b.row.id));
  const currentIndex = agreed.findIndex((era) => !era.spec.crossedOn);
  const sketched = rows
    .filter((row) => !agreedValue(row, household) && row.pending && !row.pending.retired)
    .map((row) => ({ row, spec: row.pending! }))
    .sort((a, b) => a.spec.order - b.spec.order || a.row.id.localeCompare(b.row.id));
  const view = (row: PathEraRow, spec: PathEraSpec, state: PathEraState, startedOn: string | null = null): PathEraView => {
    const pending = row.pending && agreedValue(row, household) !== row.pending ? row.pending : null;
    // An era begins the month the bridge into it was crossed, when that is known.
    const from = startedOn ?? spec.from;
    const last = state === "past" && spec.crossedOn ? shiftMonthKey(spec.crossedOn, -1) : nowMonth;
    const months = state === "past" || state === "current" ? monthsFrom(from, last < from ? from : last) : [];
    spec = from === spec.from ? spec : { ...spec, from };
    const planOf = (plan: PathEraPlan, isSketch: boolean): PathEraPlanView => {
      const goal = plan.goalId ? household.goals.find((g) => g.id === plan.goalId && g.shared) : undefined;
      return { ...plan, sketched: isSketch, step: goal ? kittyBankBackingStep(household, goal, today) : null, bought: Boolean(goal?.purchaseId) };
    };
    const plans = spec.plans.map((plan) => planOf(plan, state === "sketched"));
    if (pending && state !== "sketched") for (const plan of pending.plans) if (!spec.plans.some((p) => p.id === plan.id)) plans.push(planOf(plan, true));
    return {
      id: row.id, row, spec, pending, pendingBy: pending ? row.pendingBy : null, state, months,
      progress: state === "future" || state === "sketched" ? { met: false, lanterns: pathEraProgress(household, spec, today).lanterns.map((l) => ({ ...l, lit: spec.finish.kind === "agree" ? false : l.lit })), why: [] } : pathEraProgress(household, spec, today),
      plans,
    };
  };
  return [
    ...agreed.map((era, index) => view(era.row, era.spec, currentIndex < 0 || index < currentIndex ? "past" : index === currentIndex ? "current" : "future", index > 0 && (currentIndex < 0 || index <= currentIndex) ? agreed[index - 1]!.spec.crossedOn : null)),
    ...sketched.map((era) => view(era.row, era.spec, "sketched")),
  ];
}

export function currentPathEra(household: Household, today: DateKey): PathEraView | null {
  return pathEras(household, today).find((era) => era.state === "current") ?? null;
}

// ---------------------------------------------------------------------------
// Commands — non-money, member-validated, every change needs both of us.

function eraRow(household: Household, rowId: string): PathEraRow | null {
  return shapePathWorld(household.pathWorld).find((row): row is PathEraRow => row.kind === "era" && row.id === rowId) ?? null;
}

function proposeSpec(household: Household, input: { memberId: string; rowId: string | null; spec: PathEraSpec; at: string; label: string }): CommitResult {
  const next = cloneHousehold(household);
  const existing = input.rowId ? eraRow(next, input.rowId) : null;
  if (input.rowId && !existing) throw new ValidationError("That era changed. Review its latest version.");
  const rows = shapePathWorld(next.pathWorld);
  if (!existing && rows.filter((row) => row.kind === "era").length >= 24) throw new ValidationError("The journey already holds as many eras as it can.");
  const id = existing?.id ?? nextId("PATH-ERA-", rows.map((row) => row.id));
  assertEraProposalFits(household, id, input.spec);
  const agreed = existing ? agreedValue(existing, household) : null;
  if (agreed && JSON.stringify(agreed) === JSON.stringify(input.spec)) throw new ValidationError("That is already how this era reads.");
  const row: PathEraRow = promoteIfAgreed(next, {
    version: 1,
    id,
    kind: "era",
    active: agreed,
    pending: input.spec,
    pendingBy: input.memberId,
    pendingRevision: (existing?.pendingRevision ?? 0) + 1,
    agreedByMemberIds: [input.memberId],
    updatedAt: input.at,
  }, input.at);
  withRow(next, row);
  return commitPathWorld(household, next, row.pending ? `${input.label} · waiting for both of you` : input.label, input.at);
}

export type ProposePathEraInput = {
  memberId: string;
  /** Existing era to revise; omitted for a new era. */
  rowId?: string | null;
  spec: Omit<PathEraSpec, "crossedOn" | "retired"> & { retired?: boolean };
  at?: string;
};
/** Suggest a new era or a change to one. Crossing is its own command. */
export const proposePathEra = captureCommand("proposePathEra", function proposePathEra(household: Household, input: ProposePathEraInput): CommitResult {
  requireMember(household, input.memberId);
  const existing = input.rowId ? eraRow(household, input.rowId) : null;
  const prior = existing ? agreedValue(existing, household) ?? existing.pending : null;
  const spec = shapeEraSpec({ ...input.spec, crossedOn: prior?.crossedOn ?? null, retired: input.spec.retired === true });
  if (!spec) throw new ValidationError("An era needs a name, a start month, a home and a finish line rule.");
  const pending = existing?.pending;
  if (existing && pending && JSON.stringify(pending) === JSON.stringify(spec) && !existing.agreedByMemberIds.includes(input.memberId)) {
    // Proposing exactly what is waiting is agreeing to it.
    return agreeExisting(household, existing, input.memberId, input.at ?? nowIso());
  }
  return proposeSpec(household, { memberId: input.memberId, rowId: existing?.id ?? null, spec, at: input.at ?? nowIso(), label: spec.retired ? `Take “${spec.name}” off the journey` : existing ? `Changed the era “${spec.name}”` : `Suggested the era “${spec.name}”` });
});

function agreeExisting(household: Household, row: PathEraRow, memberId: string, at: string): CommitResult {
  assertEraProposalFits(household, row.id, row.pending!);
  const next = cloneHousehold(household);
  const agreed = promoteIfAgreed(next, { ...row, agreedByMemberIds: [...new Set([...row.agreedByMemberIds, memberId])].sort(), updatedAt: at }, at);
  withRow(next, agreed);
  return commitPathWorld(household, next, agreed.pending ? `Agreed to the era “${row.pending!.name}”` : `We both agreed: the era “${row.pending!.name}”`, at);
}

/** Add, change or remove one plan on an era (as a suggestion on the era's agreed version). */
export const proposePathEraPlan = captureCommand("proposePathEraPlan", function proposePathEraPlan(household: Household, input: { memberId: string; rowId: string; plan: PathEraPlan | { id: string; remove: true }; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const row = eraRow(household, input.rowId);
  const base = row ? agreedValue(row, household) : null;
  if (!row || !base) throw new ValidationError("Agree on the era first, then plan inside it.");
  if (row.pending && agreedValue(row, household) !== row.pending) throw new ValidationError("There's a suggestion waiting on this era. Agree to it or set it aside first.");
  let plans: PathEraPlan[];
  let label: string;
  if ("remove" in input.plan) {
    const removeId = input.plan.id;
    if (!base.plans.some((p) => p.id === removeId)) throw new ValidationError("That plan is no longer on this era.");
    plans = base.plans.filter((p) => p.id !== removeId);
    label = `Take a plan off “${base.name}”`;
  } else {
    const plan = shapeEraPlan(input.plan);
    if (!plan) throw new ValidationError("A plan needs a few words (and a shared Kitty Bank if it is a bank).");
    if (plan.goalId && !household.goals.some((g) => g.id === plan.goalId && g.shared)) throw new ValidationError("Only a shared Kitty Bank can stand on the journey.");
    const replaced = base.plans.some((p) => p.id === plan.id);
    if (!replaced && base.plans.length >= 24) throw new ValidationError("This era already holds as many plans as it can.");
    plans = replaced ? base.plans.map((p) => (p.id === plan.id ? plan : p)) : [...base.plans, plan];
    label = `${replaced ? "Changed" : "Planned"} “${plan.label}” in “${base.name}”`;
  }
  const spec = shapeEraSpec({ ...base, plans });
  if (!spec) throw new ValidationError("The era can't hold that plan.");
  return proposeSpec(household, { memberId: input.memberId, rowId: row.id, spec, at: input.at ?? nowIso(), label });
});

/** Suggest crossing the bridge out of the current era. Only offered once its finish line is met. */
export const crossPathEra = captureCommand("crossPathEra", function crossPathEra(household: Household, input: { memberId: string; rowId: string; today: DateKey; at?: string }): CommitResult {
  requireMember(household, input.memberId);
  const current = currentPathEra(household, input.today);
  if (!current || current.id !== input.rowId) throw new ValidationError("Only the era you are in can be crossed.");
  if (!current.progress.met) throw new ValidationError(`Not yet: ${current.progress.why[0] ?? "the finish line isn't met."}`);
  if (current.pending) throw new ValidationError("There's a suggestion waiting on this era. Agree to it or set it aside first.");
  const agreed = agreedValue(current.row, household)!;
  const crossedOn = monthKeyFromDateKey(input.today);
  const spec = shapeEraSpec({ ...agreed, crossedOn: crossedOn <= current.spec.from ? shiftMonthKey(current.spec.from, 1) : crossedOn });
  if (!spec) throw new ValidationError("This era can't be crossed yet.");
  return proposeSpec(household, { memberId: input.memberId, rowId: current.id, spec, at: input.at ?? nowIso(), label: `Cross the bridge out of “${spec.name}”` });
});

export const PATH_ERA_PLAN_ID_PREFIX = "PLAN-";
export function newPathEraPlanId(spec: Pick<PathEraSpec, "plans"> | null): string {
  return nextId(PATH_ERA_PLAN_ID_PREFIX, (spec?.plans ?? []).map((p) => p.id));
}
