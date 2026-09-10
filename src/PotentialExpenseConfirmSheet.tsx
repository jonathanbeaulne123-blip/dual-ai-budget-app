import { useState } from "react";
import { CadPad } from "./CadPad.tsx";
import { ConfirmSheet } from "./Confirm.tsx";
import { dollarsFromCentsDigits } from "./core/cadPad.ts";
import { formatCad, resizePotentialExpenseSplits, type Household, type PotentialExpensePlan } from "./core/index.ts";

export function PotentialExpenseConfirmSheet({ plan, household, busy, onCancel, onConfirm }: {
  plan: PotentialExpensePlan;
  household: Household;
  busy: boolean;
  onCancel: () => void;
  onConfirm: (actualAmount: string) => void;
}) {
  const [actualDigits, setActualDigits] = useState(String(plan.expectedAmountCents));
  const actualCents = Number(actualDigits || "0");
  const account = household.accounts.find((item) => item.id === plan.accountId)?.name ?? "Account";
  const category = household.categories.find((item) => item.id === plan.subcategoryId)?.name ?? "Category";
  const expectedSplit = plan.splits.map((item) => `${household.members.find((member) => member.id === item.party)?.name ?? item.party} ${formatCad(item.amountCents)}`).join(", ");
  const actualSplit = resizePotentialExpenseSplits(plan.splits, plan.expectedAmountCents, actualCents)
    .map((item) => `${household.members.find((member) => member.id === item.party)?.name ?? item.party} ${formatCad(item.amountCents)}`).join(", ");
  const visibility = plan.visibility === "household" ? "Shared" : plan.visibility === "personal" ? "Personal" : "Both";
  const body = `${plan.title} · planned for ${plan.date} · expected ${formatCad(plan.expectedAmountCents)} · ${account} · ${category} · ${expectedSplit} · ${visibility}`;

  return <ConfirmSheet
    className="potential-expense-confirm"
    title="Post this planned expense?"
    body={body}
    extra="Adjust the amount to what you actually spent. The plan stays untouched until Final Confirm posts it to the books."
    content={<><CadPad digits={actualDigits} onDigits={setActualDigits} label="Actual amount spent" /><p className="muted potential-expense-actual-split">Actual ownership: {actualSplit}</p></>}
    confirmLabel={`Final Confirm ${formatCad(actualCents)}`}
    confirmDisabled={!Number.isInteger(actualCents) || actualCents <= 0}
    busy={busy}
    onCancel={onCancel}
    onConfirm={() => onConfirm(dollarsFromCentsDigits(actualDigits))}
  />;
}
