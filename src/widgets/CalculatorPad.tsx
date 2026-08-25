import { useMemo, useState } from "react";
import { CadPad } from "../CadPad.tsx";
import {
  calcShiftAmounts,
  centsDigitsFromDollars,
  formatCad,
  formatPreviewHours,
  padToDollars,
  previewHoursQuarter,
  activeOpenShift,
  type Account,
  type Category,
  type Household,
  type ShiftSettings,
} from "../core/index.ts";
import { useFurniture } from "./useFurniture.ts";
import type { DeskForm, DeskMode } from "./deskTypes.ts";

export function CalculatorGlance({ amount }: { amount: string }) {
  const digits = centsDigitsFromDollars(amount);
  return <span>{digits ? formatCad(Number(digits)) : "Pad"}</span>;
}

export function CalculatorBody({
  form,
  setForm,
  mode,
  household,
  accounts,
  categories,
  postLabel,
  error,
  busy,
  onPost,
  onMore,
  onMilk,
  onCoffee,
}: {
  form: DeskForm;
  setForm: (next: DeskForm) => void;
  mode: DeskMode;
  household: Household;
  accounts: Account[];
  categories: Category[];
  postLabel: string;
  error: string;
  busy: boolean;
  onPost: () => void;
  onMore: () => void;
  onMilk: () => void;
  onCoffee: () => void;
}) {
  const postRef = useFurniture("calculator-post", "pad", false, false);
  const active = accounts.filter((account) => account.active);
  const punch = activeOpenShift(household.kitchen, form.memberId);
  const [shiftOpen, setShiftOpen] = useState(false);
  const [tips, setTips] = useState(() => ({
    sales: "0",
    hours: punch ? formatPreviewHours(previewHoursQuarter(punch.startedAt)) : "0",
    cashTips: "0",
    ccTips: "0",
  }));
  const preview = useMemo(() => {
    const hours = Number(tips.hours) || 0;
    const salesCents = Math.round((Number(tips.sales) || 0) * 100);
    const cashTipsCents = Math.round((Number(tips.cashTips) || 0) * 100);
    const ccTipsCents = Math.round((Number(tips.ccTips) || 0) * 100);
    return calcShiftAmounts(
      { salesCents, cashTipsCents, ccTipsCents, hours },
      household.shiftSettings as ShiftSettings,
    );
  }, [tips, household.shiftSettings]);

  return (
    <div>
      <div className="chips">
        <button type="button" className={`chip ${form.note === "Milk" ? "selected" : ""}`} onClick={onMilk}>Milk</button>
        <button type="button" className={`chip ${form.note === "Coffee" ? "selected" : ""}`} onClick={onCoffee}>Coffee</button>
        <button type="button" className={`chip ${shiftOpen ? "selected" : ""}`} onClick={() => setShiftOpen((open) => !open)}>
          Shift
        </button>
      </div>
      {shiftOpen && (
        <div className="preview shift-preview">
          <p>Tip math mid-shift. Preview only. Never posts from this pad.</p>
          <label>Hours</label>
          <input
            inputMode="decimal"
            value={tips.hours}
            onChange={(event) => setTips({ ...tips, hours: event.target.value })}
          />
          <label>Sales</label>
          <input
            inputMode="decimal"
            value={tips.sales}
            onChange={(event) => setTips({ ...tips, sales: event.target.value })}
          />
          <label>Cash tips</label>
          <input
            inputMode="decimal"
            value={tips.cashTips}
            onChange={(event) => setTips({ ...tips, cashTips: event.target.value })}
          />
          <label>Credit-card tips</label>
          <input
            inputMode="decimal"
            value={tips.ccTips}
            onChange={(event) => setTips({ ...tips, ccTips: event.target.value })}
          />
          <div className="row"><span>Net tips</span><span>{formatCad(preview.netTipsCents)}</span></div>
          <div className="row"><span>Wages</span><span>{Number(tips.hours) > 0 ? formatCad(preview.wagesCents) : "need hours"}</span></div>
          <p className="muted">Same calcShiftAmounts as Confirm. Sign-out on the clock still writes.</p>
        </div>
      )}
      {mode !== "transfer" && (
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
      {error && <p className="danger" style={{ marginTop: 8 }}>{error}</p>}
      <div ref={postRef}>
        <button type="button" className="desk-post" disabled={busy} onClick={onPost}>{postLabel}</button>
      </div>
      <button type="button" className="chip" style={{ marginTop: 8 }} onClick={onMore}>More</button>
      <p className="muted" style={{ marginTop: 6 }}>Shift on this pad never posts. Start shift lives on the clock.</p>
    </div>
  );
}
