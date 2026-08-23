import { bookBalanceAsOf } from "./statements.ts";
import { formatCad } from "./money.ts";
import { goalIsFull, goalStatus } from "./goals.ts";
import type { DateKey } from "./calendar.ts";
import type { Account, Goal, GoalContribution, GoalPurchase, Household } from "./types.ts";

export const GOALS_VAULT_SEED_ID = "ACC-GOALS";

export function goalsVaultAccount(household: Pick<Household, "accounts">): Account | null {
  const marked = household.accounts.find((account) => (
    account.active && account.kind === "savings" && account.savings?.purpose === "goals"
  ));
  if (marked) return marked;
  const seeded = household.accounts.find((account) => account.active && account.id === GOALS_VAULT_SEED_ID);
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

export function allocatedVaultCents(household: Pick<Household, "goals" | "goalContributions">): number {
  return openGoals(household).reduce((sum, goal) => sum + Math.max(0, goal.savedCents), 0);
}

export function unallocatedVaultCents(household: Household, asOf: DateKey): number {
  const vault = goalsVaultAccount(household);
  if (!vault) return 0;
  return Math.max(0, bookBalanceAsOf(household, vault.id, asOf) - allocatedVaultCents(household));
}

/** Cash this jar can spend without raiding other open pigs. */
export function vaultSpendableCents(household: Household, goalId: string, asOf: DateKey): number {
  const vault = goalsVaultAccount(household);
  if (!vault) return 0;
  const goal = household.goals.find((item) => item.id === goalId);
  if (!goal || goalStatus(goal) !== "open") return 0;
  const others = allocatedVaultCents({
    goals: household.goals.filter((item) => item.id !== goalId),
    goalContributions: household.goalContributions,
  });
  return Math.max(0, bookBalanceAsOf(household, vault.id, asOf) - others);
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
    if (!/^Sit-down/i.test(tx.note) && !/jar/i.test(tx.note) && !/Goals vault/i.test(tx.note)) continue;
    entries.push({
      id: tx.id,
      kind: "parking",
      goalId: null,
      label: tx.note.trim() || "Goals vault",
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
    label: `${names.get(row.goalId) || "Jar"} envelope`,
    amountCents: row.amountCents,
    date: row.date,
    transactionIds: [],
  }));
  const purchases: GoalLedgerEntry[] = (household.goalPurchases ?? []).map((row: GoalPurchase) => ({
    id: row.id,
    kind: "purchase",
    goalId: row.goalId,
    label: `Purchased ${names.get(row.goalId) || "jar"}`,
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
  if (!vault) return "Leftover parks in a Goals vault once sit-down Confirm moves it. Pigs are envelopes on that vault.";
  const balance = bookBalanceAsOf(household, vault.id, asOf);
  const allocated = allocatedVaultCents(household);
  const loose = Math.max(0, balance - allocated);
  return `${vault.name} holds ${formatCad(balance)}. ${formatCad(allocated)} in open pigs, ${formatCad(loose)} unallocated.`;
}

export function fullOpenGoals(household: Pick<Household, "goals">): Goal[] {
  return openGoals(household).filter(goalIsFull);
}
