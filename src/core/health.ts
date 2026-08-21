import { duplicateKey, refreshDuplicateFlags } from "./duplicate.ts";
import { booksFindings } from "./journal.ts";
import type { Household } from "./types.ts";

export type Finding = { section: string; message: string; id?: string };

export function runHealthCheck(household: Household): Finding[] {
  const findings: Finding[] = [];
  const flag = (section: string, message: string, id?: string) => findings.push({ section, message, id });

  if (household.timezone !== "America/Toronto") {
    flag("Timezone", `Household timezone is ${household.timezone}; it must be America/Toronto.`);
  }
  if (household.currency !== "CAD") flag("Currency", `Household currency is ${household.currency}; CAD is required.`);

  const memberIds = new Set(household.members.map((member) => member.id));
  const activeMembers = new Set(household.members.filter((member) => member.active).map((member) => member.id));
  const accountIds = new Set(household.accounts.map((account) => account.id));
  const categoryIds = new Set(household.categories.map((category) => category.id));
  const txIds = new Set(household.transactions.map((tx) => tx.id));

  const seenMembers = new Set<string>();
  for (const member of household.members) {
    if (seenMembers.has(member.id)) flag("Members", `Duplicate member id ${member.id}.`, member.id);
    seenMembers.add(member.id);
  }

  const seenAccounts = new Set<string>();
  for (const account of household.accounts) {
    if (seenAccounts.has(account.id)) flag("Accounts", `Duplicate account id ${account.id}.`, account.id);
    seenAccounts.add(account.id);
    if (account.currency !== "CAD") flag("Accounts", `${account.name} is ${account.currency}, not CAD.`, account.id);
    if (account.ownerMemberId !== "joint" && !memberIds.has(account.ownerMemberId)) {
      flag("Accounts", `${account.name} points at a missing owner.`, account.id);
    }
  }
  if (!household.accounts.some((account) => account.active)) flag("Accounts", "No active account exists.");

  const seenCategories = new Set<string>();
  for (const category of household.categories) {
    if (seenCategories.has(category.id)) flag("Categories", `Duplicate category id ${category.id}.`, category.id);
    seenCategories.add(category.id);
    if (category.recordType === "category") {
      if (!category.parentId || !categoryIds.has(category.parentId)) {
        flag("Categories", `${category.name} has an orphaned parent.`, category.id);
      } else {
        const parent = household.categories.find((item) => item.id === category.parentId);
        if (parent?.recordType !== "group") flag("Categories", `${category.name} parent is not a group.`, category.id);
        if (parent && parent.transactionType !== category.transactionType) {
          flag("Categories", `${category.name} type does not match its group.`, category.id);
        }
      }
    }
  }

  const seenTx = new Set<string>();
  for (const tx of household.transactions) {
    if (seenTx.has(tx.id)) flag("Transactions", `Duplicate transaction id ${tx.id}.`, tx.id);
    seenTx.add(tx.id);
    if (!accountIds.has(tx.accountId)) flag("Transactions", `${tx.id} points at a missing account.`, tx.id);
    if (tx.currency !== "CAD") flag("Transactions", `${tx.id} is ${tx.currency}, not CAD.`, tx.id);
    const account = household.accounts.find((item) => item.id === tx.accountId);
    if (account && tx.currency !== account.currency) {
      flag("Transactions", `${tx.id} currency does not match ${account.name}.`, tx.id);
    }
    if (tx.type === "expense" || tx.type === "income" || tx.type === "refund") {
      if (!tx.subcategoryId || !categoryIds.has(tx.subcategoryId)) {
        flag("Transactions", `${tx.id} has a missing category.`, tx.id);
      }
    }
    const splitTotal = tx.splits.reduce((sum, split) => sum + split.amountCents, 0);
    if (splitTotal !== tx.amountCents) flag("Transactions", `${tx.id} ownership splits do not add up.`, tx.id);
    for (const split of tx.splits) {
      if (split.party !== "joint" && !memberIds.has(split.party)) {
        flag("Transactions", `${tx.id} split points at a missing member.`, tx.id);
      }
    }
    if (tx.type === "transfer") {
      if (!tx.transferPairId || !txIds.has(tx.transferPairId)) {
        flag("Transfers", `${tx.id} is missing its other account leg.`, tx.id);
      } else {
        const pair = household.transactions.find((item) => item.id === tx.transferPairId);
        if (!pair || pair.transferPairId !== tx.id) flag("Transfers", `${tx.id} is not paired symmetrically.`, tx.id);
        if (pair && pair.amountCents !== tx.amountCents) flag("Transfers", `${tx.id} pair amounts disagree.`, tx.id);
        if (pair && pair.accountId === tx.accountId) flag("Transfers", `${tx.id} moves money inside the same account.`, tx.id);
        const fromId = tx.transferFromAccountId || pair?.transferFromAccountId;
        const toId = tx.transferToAccountId || pair?.transferToAccountId;
        if (fromId && toId) {
          const legs = new Set([tx.accountId, pair?.accountId]);
          if (!legs.has(fromId) || !legs.has(toId) || fromId === toId) {
            flag("Transfers", `${tx.id} from/to accounts do not match the paired legs.`, tx.id);
          }
        }
      }
    }
    if (tx.refundOfId && !txIds.has(tx.refundOfId)) flag("Refunds", `${tx.id} points at a missing original expense.`, tx.id);
    const expectedKey = duplicateKey(tx);
    if (tx.duplicateKey !== expectedKey) flag("Duplicates", `${tx.id} fingerprint is stale.`, tx.id);
    if (tx.visibility !== "household" && tx.visibility !== "personal" && tx.visibility !== "both") {
      flag("Visibility", `${tx.id} is missing a shared/personal choice.`, tx.id);
    }
    if (!tx.createdBy || !memberIds.has(tx.createdBy)) {
      flag("Visibility", `${tx.id} was created by a missing member.`, tx.id);
    }
  }

  const expectedFlags = refreshDuplicateFlags(household.transactions);
  household.transactions.forEach((tx, index) => {
    if (tx.potentialDuplicate !== expectedFlags[index]?.potentialDuplicate) {
      flag("Duplicates", `${tx.id} potential-duplicate flag drifted.`, tx.id);
    }
  });

  for (const shift of household.shifts) {
    const wages = household.transactions.find((tx) => tx.id === shift.wagesTransactionId);
    const tips = household.transactions.find((tx) => tx.id === shift.tipsTransactionId);
    if (!wages || !tips) {
      flag("Shifts", `${shift.id} is missing its wages/tips ledger rows.`, shift.id);
      continue;
    }
    if (wages.amountCents !== shift.wagesCents) flag("Shifts", `${shift.id} wages amount drifted.`, shift.id);
    if (tips.amountCents !== shift.netTipsCents) flag("Shifts", `${shift.id} tips amount drifted.`, shift.id);
    if (wages.sourceId !== shift.id || tips.sourceId !== shift.id) flag("Shifts", `${shift.id} source links drifted.`, shift.id);
    if (wages.date !== shift.date || tips.date !== shift.date) flag("Shifts", `${shift.id} dates drifted.`, shift.id);
    if (wages.createdBy !== shift.createdBy || tips.createdBy !== shift.createdBy) flag("Shifts", `${shift.id} creator drifted.`, shift.id);
    if (wages.visibility !== shift.visibility || tips.visibility !== shift.visibility) flag("Shifts", `${shift.id} visibility drifted.`, shift.id);
    if (!activeMembers.has(shift.memberId)) flag("Shifts", `${shift.id} member is inactive.`, shift.id);
    if (shift.createdBy && !memberIds.has(shift.createdBy)) flag("Shifts", `${shift.id} was created by a missing member.`, shift.id);
  }

  for (const plan of household.budgetPlans) {
    if (!categoryIds.has(plan.subcategoryId)) flag("Budget", `${plan.id} points at a missing category.`, plan.id);
  }

  for (const recurrence of household.recurrences) {
    if (!accountIds.has(recurrence.accountId)) flag("Recurring", `${recurrence.id} points at a missing account.`, recurrence.id);
    if (!categoryIds.has(recurrence.subcategoryId)) flag("Recurring", `${recurrence.id} points at a missing category.`, recurrence.id);
  }

  for (const finding of booksFindings(household)) {
    flag(finding.section, finding.message, finding.id);
  }

  return findings;
}

export function healthIsClean(household: Household): boolean {
  return runHealthCheck(household).length === 0;
}
