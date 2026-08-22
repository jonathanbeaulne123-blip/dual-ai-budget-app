import { CadPad } from "../CadPad.tsx";
import {
  centsDigitsFromDollars,
  dollarsFromCentsDigits,
  formatCad,
  padToDollars,
  type Account,
  type Category,
} from "../core/index.ts";
import { useFurniture } from "./useFurniture.ts";
import type { DeskForm, DeskMode } from "./deskTypes.ts";

const SHIFT_PAD: { id: "sales" | "hours" | "cashTips" | "ccTips"; label: string; unit: "cad" | "hours" }[] = [
  { id: "sales", label: "Sales", unit: "cad" },
  { id: "hours", label: "Hours", unit: "hours" },
  { id: "cashTips", label: "Cash", unit: "cad" },
  { id: "ccTips", label: "CC", unit: "cad" },
];

export function CalculatorGlance({ amount }: { amount: string }) {
  const digits = centsDigitsFromDollars(amount);
  return <span>{digits ? formatCad(Number(digits)) : "Pad"}</span>;
}

export function CalculatorBody({
  form,
  setForm,
  mode,
  accounts,
  categories,
  members,
  shiftPreview,
  postLabel,
  error,
  busy,
  onPost,
  onMore,
  onMilk,
  onCoffee,
  onShift,
}: {
  form: DeskForm;
  setForm: (next: DeskForm) => void;
  mode: DeskMode;
  accounts: Account[];
  categories: Category[];
  members: { id: string; name: string; active: boolean }[];
  shiftPreview: { floorTipOutCents: number; barTipOutCents: number; ccTipOutCents: number; netTipsCents: number; wagesCents: number };
  postLabel: string;
  error: string;
  busy: boolean;
  onPost: () => void;
  onMore: () => void;
  onMilk: () => void;
  onCoffee: () => void;
  onShift: () => void;
}) {
  const postRef = useFurniture("calculator-post", "pad", false, false);
  const active = accounts.filter((account) => account.active);
  return (
    <div>
      <div className="chips">
        <button type="button" className={`chip ${form.note === "Milk" ? "selected" : ""}`} onClick={onMilk}>Milk</button>
        <button type="button" className={`chip ${form.note === "Coffee" ? "selected" : ""}`} onClick={onCoffee}>Coffee</button>
        <button type="button" className={`chip ${mode === "shift" ? "selected" : ""}`} onClick={onShift}>Shift</button>
      </div>
      {mode !== "shift" && mode !== "transfer" && (
        <>
          <CadPad
            digits={centsDigitsFromDollars(form.amount)}
            onDigits={(digits) => setForm({ ...form, amount: padToDollars(digits) })}
            label="Amount"
          />
          <label>Account</label>
          <div className="chips">
            {active.slice(0, 6).map((account) => (
              <button
                key={account.id}
                type="button"
                className={`chip ${form.accountId === account.id ? "selected" : ""}`}
                onClick={() => setForm({ ...form, accountId: account.id })}
              >
                {account.name}
              </button>
            ))}
          </div>
          <label>Category</label>
          <div className="chips">
            {categories.slice(0, 8).map((category) => (
              <button
                key={category.id}
                type="button"
                className={`chip ${form.subcategoryId === category.id ? "selected" : ""}`}
                onClick={() => setForm({ ...form, subcategoryId: category.id })}
              >
                {category.name}
              </button>
            ))}
          </div>
        </>
      )}
      {mode === "transfer" && (
        <>
          <CadPad
            digits={centsDigitsFromDollars(form.amount)}
            onDigits={(digits) => setForm({ ...form, amount: padToDollars(digits) })}
            label="Move"
          />
          <p className="muted">Transfer. Not spend.</p>
        </>
      )}
      {mode === "shift" && (
        <>
          <label>Who worked</label>
          <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}>
            {members.filter((member) => member.active).map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
          <CadPad
            digits={centsDigitsFromDollars(form.sales)}
            onDigits={(digits) => setForm({ ...form, sales: dollarsFromCentsDigits(digits) })}
            label="Sales"
          />
          <div className={`preview ${shiftPreview.netTipsCents < 0 ? "warn" : ""}`}>
            <div className="row"><span>Net tips</span><span>{formatCad(shiftPreview.netTipsCents)}</span></div>
            <div className="row"><span>Wages</span><span>{formatCad(shiftPreview.wagesCents)}</span></div>
          </div>
        </>
      )}
      {error && <p className="danger" style={{ marginTop: 8 }}>{error}</p>}
      <div ref={postRef}>
        <button type="button" className="desk-post" disabled={busy} onClick={onPost}>{postLabel}</button>
      </div>
      <button type="button" className="chip" style={{ marginTop: 8 }} onClick={onMore}>More</button>
      <p className="muted" style={{ marginTop: 6 }}>{SHIFT_PAD.map((field) => field.label).join(" · ")} live on More if you need them.</p>
    </div>
  );
}
