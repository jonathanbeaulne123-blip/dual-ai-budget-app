import { useState } from "react";
import { addCategory, ValidationError, type Household, type UndoToken } from "./core/index.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import { CollapsibleCard } from "./theme/PaperTheme.tsx";

export function AddCategoryForm({
  household,
  onSave,
  embedded,
  inline,
  transactionType = "expense",
}: {
  household: Household;
  onSave: (household: Household, undo?: UndoToken) => void;
  embedded?: boolean;
  inline?: boolean;
  transactionType?: "expense" | "income";
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("CAT-LIFE");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const groups = household.categories.filter((category) => (
    category.recordType === "group"
    && category.transactionType === transactionType
  ));
  const body = (
    <>
      {embedded && !inline ? <h3>Add category</h3> : !inline ? <header><h2>Add category</h2></header> : null}
      <p className="muted">Same commit bar as money: one save creates the category{transactionType === "expense" ? " and can seed this month’s budget" : ""}.</p>
      <input value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
      {transactionType === "expense" ? (
        <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select>
      ) : null}
      <KitchenNotice message={error} />
      <button
        className="primary"
        type="button"
        onClick={() => {
          try {
            const result = addCategory(household, {
              name,
              type: transactionType,
              parentId: transactionType === "expense" ? parentId : undefined,
              monthlyBudget: "0",
            });
            onSave(result.household, result.undo);
            setName("");
            setError("");
            setOpen(false);
          } catch (caught) {
            setError(caught instanceof ValidationError ? caught.message : String(caught));
          }
        }}
      >
        Save category
      </button>
    </>
  );
  if (inline) {
    return (
      <div className="add-category-inline">
        <button type="button" className="chip" data-add-category-toggle onClick={() => setOpen((current) => !current)}>
          {open ? "Hide new category" : "Add category"}
        </button>
        {open ? <div className="add-category-inline-form">{body}</div> : null}
      </div>
    );
  }
  if (embedded) {
    return (
      <CollapsibleCard title="Add category" hint="Same commit as money" defaultOpen={false} className="plan-add-category">
        {body}
      </CollapsibleCard>
    );
  }
  return (
    <section className="card">
      {body}
    </section>
  );
}
