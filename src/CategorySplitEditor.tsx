import type { Dispatch, SetStateAction } from "react";
import type { AddFormFields } from "./addSlideshow.ts";
import type { Category } from "./core/types.ts";
import { formatCad } from "./core/money.ts";
import { parseAmount } from "./core/catalog.ts";
import { categorySplitAmounts } from "./core/categorySplit.ts";
import { SplitCut } from "./SplitCut.tsx";

export function readCategorySplit(form: AddFormFields, categories: Category[]) {
  try {
    const first = categories.find(c => c.id === form.subcategoryId && c.active && c.transactionType === "expense");
    const second = categories.find(c => c.id === form.secondSubcategoryId && c.active && c.transactionType === "expense");
    if (!first || !second) throw new Error("Choose two expense categories.");
    const percent = Number(form.categoryFirstPercent ?? "50");
    if (!(form.categoryFirstPercent ?? "50").trim()) throw new Error("Choose a split percentage.");
    const total = parseAmount(form.amount);
    const amounts = categorySplitAmounts(first.id, { secondSubcategoryId: second.id, firstPercent: percent }, total);
    return { first, second, percent, total, amounts, error: "" };
  } catch (error) { return { error: error instanceof Error ? error.message : "Review the category amounts." }; }
}

export function CategorySplitEditor({ form, setForm, categories, onTouched, onPreviewChange }: {
  form: AddFormFields; setForm: Dispatch<SetStateAction<AddFormFields>>; categories: Category[];
  onTouched: () => void; onPreviewChange: (active: boolean) => void;
}) {
  const reading = readCategorySplit(form, categories);
  return <div className="category-split-editor split-card is-cut">
    <div className="category-split-choices">
      {([['subcategoryId', 'First category'], ['secondSubcategoryId', 'Second category']] as const).map(([field, label]) =>
        <label key={field}>{label}<select aria-label={label} value={form[field] ?? ""} onChange={event => {
          onTouched(); setForm(current => ({ ...current, [field]: event.target.value }));
        }}><option value="">Choose a category</option>{categories.filter(c => c.active && c.transactionType === 'expense').map(c =>
          <option key={c.id} value={c.id} disabled={c.id === (field === 'subcategoryId' ? form.secondSubcategoryId : form.subcategoryId)}>{c.name}</option>)}</select></label>)}
    </div>
    {reading.first && reading.second && reading.amounts ? <SplitCut key={`${reading.first.id}:${reading.second.id}`} members={[reading.first, reading.second]}
      percents={{ [reading.first.id]: reading.percent!, [reading.second.id]: Math.round((100 - reading.percent!) * 100) / 100 }}
      amountCents={reading.total!} onChange={(_id, percent) => setForm(current => ({ ...current, categoryFirstPercent: String(percent) }))}
      onPreviewChange={onPreviewChange} /> : <p role="status">{reading.error}</p>}
    <p className="cut-remainder">Two category entries, one expense total. Confirm saves both together.</p>
  </div>;
}

export function CategorySplitReview({ form, categories }: { form: AddFormFields; categories: Category[] }) {
  const reading = readCategorySplit(form, categories);
  if (!reading.amounts) return <p role="alert">{reading.error}</p>;
  return <div aria-label="Category amounts">{[reading.first!, reading.second!].map((category, index) =>
    <div className="row" key={category.id}><span>{category.name}</span><span>{formatCad(reading.amounts![index]!)}</span></div>)}
    <p className="muted">Saved together as category entries. A $0.00 portion creates no entry.</p></div>;
}
