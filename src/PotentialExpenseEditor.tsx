import { useMemo, useState } from "react";
import { useDialog } from "./useDialog.ts";
import type { Household, PotentialExpensePlan, Visibility } from "./core/index.ts";

export type PotentialExpenseEditorValue = {
  date: string;
  title: string;
  amount: string;
  accountId: string;
  subcategoryId: string;
  visibility: Visibility;
};

function dollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function PotentialExpenseEditor({ household, memberId, view, date, plan, busy, onCancel, onSave }: {
  household: Household;
  memberId: string;
  view: "household" | "personal";
  date: string;
  plan?: PotentialExpensePlan;
  busy: boolean;
  onCancel: () => void;
  onSave: (value: PotentialExpenseEditorValue) => void;
}) {
  const initialVisibility: Visibility = plan?.visibility ?? (view === "personal" ? "personal" : "household");
  const [form, setForm] = useState<PotentialExpenseEditorValue>(() => ({
    date: plan?.date ?? date,
    title: plan?.title ?? "",
    amount: plan ? dollars(plan.expectedAmountCents) : "",
    accountId: plan?.accountId ?? "",
    subcategoryId: plan?.subcategoryId ?? "",
    visibility: initialVisibility,
  }));
  const dialogRef = useDialog(true, busy ? undefined : onCancel);
  const accounts = useMemo(() => household.accounts.filter((account) => (
    account.active
    && account.currency === "CAD"
    && account.kind !== "receivable"
    && (form.visibility === "personal" ? account.scope !== "personal" || account.ownerMemberId === memberId : account.scope !== "personal")
  )), [household.accounts, form.visibility, memberId]);
  const categories = useMemo(() => household.categories.filter((category) => (
    category.active && category.recordType === "category" && category.transactionType === "expense"
  )), [household.categories]);
  const accountId = accounts.some((row) => row.id === form.accountId) ? form.accountId : accounts[0]?.id ?? "";
  const subcategoryId = categories.some((row) => row.id === form.subcategoryId) ? form.subcategoryId : categories[0]?.id ?? "";
  const ready = Boolean(form.date && form.title.trim() && Number(form.amount) > 0 && accountId && subcategoryId);

  function chooseVisibility(visibility: Visibility) {
    const nextAccounts = household.accounts.filter((account) => account.active && account.currency === "CAD" && account.kind !== "receivable"
      && (visibility === "personal" ? account.scope !== "personal" || account.ownerMemberId === memberId : account.scope !== "personal"));
    setForm((current) => ({ ...current, visibility, accountId: nextAccounts.some((row) => row.id === current.accountId) ? current.accountId : nextAccounts[0]?.id ?? "" }));
  }

  return <div className="sheet potential-expense-sheet" role="dialog" aria-modal="true" aria-labelledby="potential-expense-title" ref={dialogRef}>
    <div className="sheet-inner">
      <div className="topbar">
        <div>
          <h1 id="potential-expense-title">{plan ? "Edit potential expense" : "Add potential expense"}</h1>
          <p className="muted">Planned—not posted. Calendar and Hercules can ask again when the date arrives.</p>
        </div>
        <button type="button" className="ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      <label htmlFor="potential-title">What might you spend on?</label>
      <input id="potential-title" data-autofocus maxLength={120} value={form.title} onChange={(event) => setForm({ ...form, title: event.currentTarget.value })} placeholder="Wedding travel and gift" />
      <label htmlFor="potential-amount">Expected amount (CAD)</label>
      <input id="potential-amount" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.currentTarget.value })} placeholder="600.00" />
      <label htmlFor="potential-date">Date</label>
      <input id="potential-date" type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.currentTarget.value })} />
      <label htmlFor="potential-account">Posting account</label>
      <select id="potential-account" value={accountId} onChange={(event) => setForm({ ...form, accountId: event.currentTarget.value })}>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
      </select>
      {!accounts.length ? <p role="alert">Add an eligible CAD account before saving this plan.</p> : null}
      <label htmlFor="potential-category">Expense category</label>
      <select id="potential-category" value={subcategoryId} onChange={(event) => setForm({ ...form, subcategoryId: event.currentTarget.value })}>
        {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
      </select>
      {!categories.length ? <p role="alert">Add an expense category before saving this plan.</p> : null}
      <fieldset disabled={Boolean(plan)}>
        <legend>Save to</legend>
        <div className="chips">
          {(["household", "personal", "both"] as Visibility[]).map((visibility) => (
            <button key={visibility} type="button" className={`chip ${form.visibility === visibility ? "selected" : ""}`} aria-pressed={form.visibility === visibility} onClick={() => chooseVisibility(visibility)}>{visibility === "household" ? "Shared" : visibility === "personal" ? "Personal" : "Both"}</button>
          ))}
        </div>
        {plan ? <p className="muted">Visibility stays fixed to protect its original privacy envelope.</p> : null}
      </fieldset>
      <p className="muted">Ownership defaults to {form.visibility === "personal" ? "you" : "Joint"}. Review in Add can change the split before posting.</p>
      <button type="button" className="primary" disabled={busy || !ready} onClick={() => onSave({ ...form, accountId, subcategoryId })}>
        {plan ? "Save changes" : "Save plan"}
      </button>
    </div>
  </div>;
}
