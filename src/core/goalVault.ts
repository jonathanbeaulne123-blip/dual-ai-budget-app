import { goalRemainingClaim } from "./goalEnvelopes.ts";
import { bookBalanceAsOf } from "./statements.ts";
import { parseVisibility } from "./visibility.ts";
import type { Transaction } from "./types.ts";
import { formatCad } from "./money.ts";
import { goalIsFull, goalStatus } from "./goals.ts";
import type { DateKey } from "./calendar.ts";
import type { Account, Goal, GoalContribution, GoalPurchase, Household } from "./types.ts";

export const GOALS_VAULT_SEED_ID = "ACC-GOALS";

export function goalsVaultAccount(household: Pick<Household, "accounts">): Account | null {
  const marked = household.accounts.find((account) => (
    account.active && account.scope !== "personal" && account.kind === "savings" && account.savings?.purpose === "goals"
  ));
  if (marked) return marked;
  const seeded = household.accounts.find((account) => account.active && account.scope !== "personal" && account.id === GOALS_VAULT_SEED_ID);
  return seeded?.kind === "savings" ? seeded : null;
}

export function openGoals(household: Pick<Household, "goals">): Goal[] {
  return household.goals.filter((goal) => {
    const status = goalStatus(goal);
    return status === "open" || status === "unfunded";
  });
}

export function retiredGoals(household: Pick<Household, "goals">): Goal[] {
  return household.goals.filter((goal) => goalStatus(goal) === "retired");
}

export function allocatedVaultCents(household: Pick<Household, "goals" | "goalContributions"> & Partial<Pick<Household,"transactions"|"goalPurchases"|"accounts">>, asOf: DateKey = "9999-12-31"): number {
  return openGoals(household).reduce((sum, goal) => sum + (household.goalPurchases?.some(row=>row.envelopeUse&&row.goalId===goal.id)&&household.accounts&&household.transactions?goalRemainingClaim(household as Household,goal,asOf):Math.max(0, goal.savedCents)), 0);
}

export function unallocatedVaultCents(household: Household, asOf: DateKey): number {
  const vault = goalsVaultAccount(household);
  if (!vault) return 0;
  return Math.max(0, bookBalanceAsOf(household, vault.id, asOf) - allocatedVaultCents(household, asOf));
}

export type GoalVaultCapacity =
  | { kind: "ready"; vaultId: string; cashCents: number; reservedCents: number; spendableCents: number }
  | { kind: "unavailable"; reason: string };

/** One vault account may hold Shared and private entries; neither partition can spend the other. */
export function goalVaultCapacity(household: Household, goalId: string, asOf: DateKey): GoalVaultCapacity {
  const refuse = (reason: string): GoalVaultCapacity => ({ kind: "unavailable", reason });
  const vault = goalsVaultAccount(household);
  const goal = household.goals.find(item => item.id === goalId);
  if (!vault || !goal || goalStatus(goal) !== "open") return refuse("Open and fund this goal before reviewing its spending cash.");
  if (!goal.shared && !household.members.some(member => member.active && member.id === goal.ownerMemberId)) return refuse("The private goal's owner needs review.");
  const belongs = (tx: Transaction) => goal.shared
    ? parseVisibility(tx.visibility) !== "personal"
    : parseVisibility(tx.visibility) === "personal" && tx.createdBy === goal.ownerMemberId;
  const byId = new Map(household.transactions.map(tx => [tx.id, tx]));
  if (byId.size !== household.transactions.length) return refuse("Goals cash has duplicate receipt identities. Review the books.");
  const links = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!links.has(a)) links.set(a, new Set());
    if (!links.has(b)) links.set(b, new Set());
    links.get(a)!.add(b); links.get(b)!.add(a);
  };
  for (const tx of household.transactions) {
    if (tx.transferPairId) link(tx.id, tx.transferPairId);
    if (tx.reversalOfId) link(tx.id, tx.reversalOfId);
  }
  const touchesVault = (tx: Transaction) => tx.accountId === vault.id || tx.transferFromAccountId === vault.id || tx.transferToAccountId === vault.id;
  const pending = household.transactions.filter(tx => belongs(tx) && touchesVault(tx)).map(tx => tx.id);
  const seen = new Set<string>();
  while (pending.length) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const tx = byId.get(id);
    if (!tx || !belongs(tx)) return refuse("Goals cash has missing or cross-scope receipt history. Review it before spending.");
    if (tx.type === "transfer") {
      const pair = tx.transferPairId ? byId.get(tx.transferPairId) : undefined;
      if (!pair || pair.type !== "transfer" || pair.transferPairId !== tx.id
        || pair.amountCents !== tx.amountCents || pair.date !== tx.date
        || pair.transferFromAccountId !== tx.transferFromAccountId || pair.transferToAccountId !== tx.transferToAccountId
        || Boolean(pair.isDuplicate) !== Boolean(tx.isDuplicate)) return refuse("Goals cash has an incomplete transfer pair. Review it before spending.");
    }
    const ancestors = new Set([tx.id]);
    let ancestor = tx;
    while (ancestor.reversalOfId) {
      const prior = byId.get(ancestor.reversalOfId);
      if (!prior || ancestors.has(prior.id)) return refuse("Goals cash has an incomplete correction chain. Review it before spending.");
      ancestors.add(prior.id); ancestor = prior;
    }
    pending.push(...(links.get(id) ?? []));
  }
  const claims = openGoals(household).filter(other => other.id !== goal.id && (
    goal.shared ? other.shared : !other.shared && other.ownerMemberId === goal.ownerMemberId
  ));
  try {
    const reservedCents = claims.reduce((sum, other) => sum + (household.goalPurchases?.some(row => row.goalId === other.id && row.envelopeUse) ? goalRemainingClaim(household, other, asOf) : Math.max(0, other.savedCents)), 0);
    const cashCents = bookBalanceAsOf({ ...household, transactions: household.transactions.filter(belongs) }, vault.id, asOf);
    if (![cashCents, reservedCents, cashCents - reservedCents].every(Number.isSafeInteger)) return refuse("Goals cash is outside the supported exact-cent range.");
    return { kind: "ready", vaultId: vault.id, cashCents, reservedCents, spendableCents: Math.max(0, cashCents - reservedCents) };
  } catch { return refuse("Goals cash could not be validated. Review the books before spending."); }
}

/** Legacy numeric reading is conservative; the command preserves the explicit refusal reason. */
export function vaultSpendableCents(household: Household, goalId: string, asOf: DateKey): number {
  const reading = goalVaultCapacity(household, goalId, asOf);
  return reading.kind === "ready" ? reading.spendableCents : 0;
}

export type GoalLedgerKind = "contribution" | "purchase" | "parking";

export type GoalLedgerEntry = {
  id: string;
  kind: GoalLedgerKind;
  goalId: string | null;
  label: string;
  amountCents: number;
  date: DateKey;
  transactionIds: string[];
};

function parkingTransfers(household: Household, vaultId: string): GoalLedgerEntry[] {
  const entries: GoalLedgerEntry[] = [];
  for (const tx of household.transactions) {
    if (tx.type !== "transfer") continue;
    if (tx.accountId !== vaultId) continue;
    if (tx.transferToAccountId !== vaultId) continue;
    if (tx.reversalOfId) continue;
    if (!/^Sit-down/i.test(tx.note) && !/jar/i.test(tx.note) && !/Goals vault/i.test(tx.note) && !/Goals savings/i.test(tx.note) && !/Fund goal/i.test(tx.note)) continue;
    entries.push({
      id: tx.id,
      kind: "parking",
      goalId: null,
      label: tx.note.trim() || "Goals savings",
      amountCents: tx.amountCents,
      date: tx.date,
      transactionIds: [tx.id],
    });
  }
  return entries;
}

export function goalLedger(household: Household, goalId?: string): GoalLedgerEntry[] {
  const vault = goalsVaultAccount(household);
  const names = new Map(household.goals.map((goal) => [goal.id, goal.name]));
  const contribs: GoalLedgerEntry[] = (household.goalContributions ?? []).map((row: GoalContribution) => ({
    id: row.id,
    kind: "contribution",
    goalId: row.goalId,
    label: `${names.get(row.goalId) || "Goal"} envelope`,
    amountCents: row.amountCents,
    date: row.date,
    transactionIds: [],
  }));
  const purchases: GoalLedgerEntry[] = (household.goalPurchases ?? []).map((row: GoalPurchase) => ({
    id: row.id,
    kind: "purchase",
    goalId: row.goalId,
    label: `Purchased ${names.get(row.goalId) || "goal"}`,
    amountCents: -row.spentCents,
    date: row.date,
    transactionIds: [...row.transactionIds],
  }));
  const parking = vault ? parkingTransfers(household, vault.id) : [];
  return [...parking, ...contribs, ...purchases]
    .filter((row) => !goalId || row.goalId === goalId || (row.kind === "parking" && !goalId))
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}

export function vaultReceiptBlurb(household: Household, asOf: DateKey): string {
  const vault = goalsVaultAccount(household);
  if (!vault) return "Leftover parks in Goals savings once sit-down Confirm moves it. Each goal tracks its share of that account.";
  const balance = bookBalanceAsOf(household, vault.id, asOf);
  const allocated = allocatedVaultCents(household, asOf);
  const loose = Math.max(0, balance - allocated);
  return `${vault.name} holds ${formatCad(balance)}. ${formatCad(allocated)} in open goals, ${formatCad(loose)} unallocated.`;
}

export function fullOpenGoals(household: Pick<Household, "goals">): Goal[] {
  return openGoals(household).filter(goalIsFull);
}
