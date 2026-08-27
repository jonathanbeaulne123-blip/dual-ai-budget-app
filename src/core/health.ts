import { duplicateKey, refreshDuplicateFlags } from "./duplicate.ts";
import { booksFindings } from "./journal.ts";
import type { Household } from "./types.ts";

export type Finding = { section: string; message: string; id?: string };

export function runHealthCheck(household: Household): Finding[] {
  const findings: Finding[] = [];
  const flag = (section: string, message: string, id?: string) => findings.push({ section, message, id });

  if (household.timezone !== "America/Toronto") {
    flag("Timezone", `Household books timezone is ${household.timezone}; civil books must stay America/Toronto.`);
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
    if (account.kind === "credit") {
      const desk = account.credit;
      if (!desk) {
        flag("Accounts", `${account.name} is a credit card without terms.`, account.id);
      } else {
        if (desk.aprBps < 0 || desk.aprBps > 8000) flag("Accounts", `${account.name} APR is out of range.`, account.id);
        if (desk.statementDay < 1 || desk.statementDay > 28) flag("Accounts", `${account.name} statement day must be 1–28.`, account.id);
        if (desk.creditLimitCents < 0) flag("Accounts", `${account.name} credit limit cannot be negative.`, account.id);
      }
    }
    if (account.kind === "savings" && account.savings && (account.savings.apyBps < 0 || account.savings.apyBps > 3000)) {
      flag("Accounts", `${account.name} APY is out of range.`, account.id);
    }
    if (account.kind === "investment" && account.investment && account.investment.markedValueCents != null && account.investment.markedValueCents < 0) {
      flag("Accounts", `${account.name} marked value cannot be negative.`, account.id);
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
    if (tx.type === "opening") {
      if (tx.subcategoryId) flag("Transactions", `${tx.id} opening row must not carry a category.`, tx.id);
      if (tx.source !== "opening" && tx.source !== "reversal") {
        flag("Transactions", `${tx.id} opening row has the wrong source.`, tx.id);
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
    if (shift.jobId && shift.transactionIds?.length) {
      const rows = shift.transactionIds.map((id) => household.transactions.find((tx) => tx.id === id));
      if (rows.some((tx) => !tx)) {
        flag("Shifts", `${shift.id} is missing one or more component ledger rows.`, shift.id);
        continue;
      }
      const components = rows.filter((tx): tx is NonNullable<typeof tx> => Boolean(tx));
      const wagesCents = components
        .filter((tx) => tx.type === "income" && (tx.subcategoryId === "SUB-INCOME-WAGES" || tx.subcategoryId === "SUB-INCOME-PAID-BREAKS"))
        .reduce((sum, tx) => sum + tx.amountCents, 0);
      const tipIncomeCents = components.filter((tx) => tx.type === "income" && tx.subcategoryId === "SUB-INCOME-TIPS").reduce((sum, tx) => sum + tx.amountCents, 0);
      const tipOutCents = components.filter((tx) => tx.type === "expense" && tx.subcategoryId === "SUB-WORK-TIP-OUTS").reduce((sum, tx) => sum + tx.amountCents, 0);
      if (wagesCents !== shift.wagesCents) flag("Shifts", `${shift.id} component wages drifted.`, shift.id);
      if (tipIncomeCents - tipOutCents !== shift.netTipsCents + (shift.deferredTipOutCents ?? 0)) flag("Shifts", `${shift.id} component tips drifted.`, shift.id);
      if ((shift.deferredTipOutPaidCents ?? 0) > (shift.deferredTipOutCents ?? 0)) flag("Shifts", `${shift.id} deferred tip-out is overpaid.`, shift.id);
      if (components.some((tx) => tx.sourceId !== shift.id)) flag("Shifts", `${shift.id} source links drifted.`, shift.id);
      if (components.some((tx) => tx.date !== shift.date)) flag("Shifts", `${shift.id} dates drifted.`, shift.id);
      if (components.some((tx) => tx.createdBy !== shift.createdBy)) flag("Shifts", `${shift.id} creator drifted.`, shift.id);
      if (!activeMembers.has(shift.memberId)) flag("Shifts", `${shift.id} member is inactive.`, shift.id);
      if (shift.createdBy && !memberIds.has(shift.createdBy)) flag("Shifts", `${shift.id} was created by a missing member.`, shift.id);
      continue;
    }
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

  for (const preset of household.presets ?? []) {
    if (!accountIds.has(preset.accountId)) flag("Presets", `${preset.note || preset.id} points at a missing account.`, preset.id);
    if (!categoryIds.has(preset.subcategoryId)) flag("Presets", `${preset.note || preset.id} points at a missing category.`, preset.id);
    if (preset.amountCents < 0) flag("Presets", `${preset.note || preset.id} amount cannot be negative.`, preset.id);
    if (preset.amountCents > 0) {
      const splitTotal = preset.splits.reduce((sum, split) => sum + split.amountCents, 0);
      if (preset.splits.length && splitTotal !== preset.amountCents) {
        flag("Presets", `${preset.note || preset.id} ownership splits do not add up.`, preset.id);
      }
    }
  }

  for (const appointment of household.appointments ?? []) {
    if (!accountIds.has(appointment.accountId)) flag("Appointments", `${appointment.title} points at a missing account.`, appointment.id);
    if (!categoryIds.has(appointment.subcategoryId)) flag("Appointments", `${appointment.title} points at a missing category.`, appointment.id);
    if (appointment.memberId !== "joint" && appointment.memberId !== "companion" && !memberIds.has(appointment.memberId)) {
      flag("Appointments", `${appointment.title} points at a missing household member.`, appointment.id);
    }
    if (appointment.typicalRecoveryCents > appointment.typicalCostCents) {
      flag("Appointments", `${appointment.title} expected recovery exceeds the visit cost.`, appointment.id);
    }
  }

  for (const claim of household.claims ?? []) {
    if (!accountIds.has(claim.receivableAccountId)) flag("Claims", `${claim.label} points at a missing receivable account.`, claim.id);
    const receivable = household.accounts.find((account) => account.id === claim.receivableAccountId);
    if (receivable && receivable.kind !== "receivable") {
      flag("Claims", `${claim.label} is parked on ${receivable.name}, which is not an Owed-to-us account.`, claim.id);
    }
    if (!txIds.has(claim.expenseTransactionId)) flag("Claims", `${claim.label} is missing its visit expense.`, claim.id);
    if (claim.recoveryTransactionId && !txIds.has(claim.recoveryTransactionId)) {
      flag("Claims", `${claim.label} is missing its expected-recovery refund.`, claim.id);
    }
    if (claim.receivedCents + claim.writtenOffCents > claim.expectedCents) {
      flag("Claims", `${claim.label} received plus written off exceeds expected.`, claim.id);
    }
    if (claim.lines.length) {
      const sum = claim.lines.reduce((acc, line) => acc + line.amountCents, 0);
      const expense = household.transactions.find((tx) => tx.id === claim.expenseTransactionId);
      if (expense && sum !== expense.amountCents) {
        flag("Claims", `${claim.label} itemized lines do not match the posted visit.`, claim.id);
      }
    }
  }

  for (const finding of booksFindings(household)) {
    flag(finding.section, finding.message, finding.id);
  }

  const unresolved = (household.conflicts ?? []).filter((row) => !row.resolved);
  if (unresolved.length) {
    flag("Sync", "This phone and the shared copy both have new work. Nothing was overwritten.");
  }
  if (household.sharing?.mode === "pending-transport" || household.sharing?.pending) {
    flag("Sync", household.sharing.lastError || "Saved on this phone. Sharing can retry from More.");
  }
  if (household.sharing?.mode === "conflicted") {
    flag("Sync", household.sharing.lastError || "A shared write conflict is waiting. It will not disappear after refresh.");
  }
  if (household.sharing?.mode === "transport-error" || household.sharing?.mode === "disconnected") {
    flag("Sync", household.sharing.lastError || "The shared copy could not be reached. Local books are still here.");
  }
  if (household.linked !== true && household.sharing?.mode === "synchronized") {
    flag("Sync", "Sharing mode says synchronized, but this household is not linked.");
  }

  return findings;
}

export function healthIsClean(household: Household): boolean {
  return runHealthCheck(household).length === 0;
}
