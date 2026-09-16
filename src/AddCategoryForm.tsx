import { useId, useState } from "react";
import { addCategory, ValidationError, type Household, type UndoToken } from "./core/index.ts";
import { fundModelMode, proposedDefaultFund, CATEGORY_DEFAULT_FUNDS, FUND_LABELS, type FundId, type UmbrellaId } from "./core/fundRules.ts";
import { umbrellaChoices } from "./core/fundModel.ts";
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
  const fieldId = useId();
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("CAT-LIFE");
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  // v2 money model (D-270): pick one of the 12 umbrellas and the fund its lines usually come from.
  const sorted = fundModelMode(household) === 2;
  const [umbrella, setUmbrella] = useState<UmbrellaId | null>(null);
  const [fund, setFund] = useState<FundId | null>(null);
  const groups = household.categories.filter((category) => (
    category.recordType === "group"
    && category.transactionType === transactionType
  ));
  const tiles = sorted ? umbrellaChoices(household) : [];
  const chosen = tiles.find((tile) => tile.id === umbrella) ?? null;
  const suggestedFund = chosen ? proposedDefaultFund(name, chosen.id) ?? "everyday" : null;
  const shownFund = fund ?? suggestedFund;
  const save = () => {
    try {
      if (sorted && transactionType === "expense" && !chosen) throw new ValidationError("Choose an umbrella for this category.");
      const result = addCategory(household, {
        name,
        type: transactionType,
        parentId: transactionType === "expense" ? (sorted ? chosen!.rowId : parentId) : undefined,
        monthlyBudget: "0",
        ...(sorted && transactionType === "expense" && shownFund ? { defaultFund: shownFund } : {}),
      });
      onSave(result.household, result.undo);
      setName("");
      setError("");
      setOpen(false);
      setUmbrella(null);
      setFund(null);
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  };
  const umbrellaPicker = (
    <>
      <p className="umbrella-picker__label" id={`${fieldId}-umbrella`}>Which umbrella?</p>
      <div className="umbrella-grid" role="group" aria-labelledby={`${fieldId}-umbrella`}>
        {tiles.map((tile) => (
          <button key={tile.id} type="button" className="umbrella-tile" aria-pressed={umbrella === tile.id} title={tile.rule}
            style={{ ["--umbrella-hue" as string]: tile.hue }} onClick={() => setUmbrella(tile.id)}>
            <span className="umbrella-tile__glyph" aria-hidden="true">{tile.glyph}</span>
            <span className="umbrella-tile__name">{tile.name}</span>
            <span className="umbrella-tile__count">{tile.childCount} {tile.childCount === 1 ? "category" : "categories"}</span>
          </button>
        ))}
      </div>
      {chosen && <p className="muted umbrella-picker__rule">{chosen.rule}</p>}
      <p className="umbrella-picker__label" id={`${fieldId}-fund`}>Usually paid from</p>
      <div className="fund-choice" role="group" aria-labelledby={`${fieldId}-fund`}>
        {CATEGORY_DEFAULT_FUNDS.map((option) => (
          <button key={option} type="button" className="fund-choice__option" data-fund={option} aria-pressed={shownFund === option} disabled={!chosen} onClick={() => setFund(option)}>
            <strong>{FUND_LABELS[option]}</strong>
            <small>{option === "prepare" ? "has to leave" : option === "build" ? "goals we want" : "day to day"}</small>
          </button>
        ))}
      </div>
      <p className="muted">A single line can still go to another fund, like a booked anniversary dinner going to Build. Nothing starts in Protect; it is our buffer.</p>
    </>
  );
  const body = (
    <>
      {embedded && !inline ? <h3>Add category</h3> : !inline ? <header><h2>Add category</h2></header> : null}
      <p className="muted">Same commit bar as money: one save creates the category{transactionType === "expense" ? " and can seed this month’s budget" : ""}.</p>
      <label htmlFor={`${fieldId}-name`}>Category name</label>
      <input id={`${fieldId}-name`} value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
      {transactionType === "expense" && sorted ? umbrellaPicker : transactionType === "expense" ? (
        <><label htmlFor={`${fieldId}-group`}>Group</label>
        <select id={`${fieldId}-group`} value={parentId} onChange={(event) => setParentId(event.target.value)}>
          {groups.map((group) => (
            <option key={group.id} value={group.id}>{group.name}</option>
          ))}
        </select></>
      ) : null}
      <KitchenNotice message={error} />
      <button
        className="primary"
        type="button"
        onClick={save}
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
