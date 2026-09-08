import { useId, useMemo, useState } from "react";
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
import { KitchenNotice } from "../KitchenNotice.tsx";
import { useFurniture } from "./useFurniture.ts";
import type { DeskForm, DeskMode } from "./deskTypes.ts";

export function CalculatorGlance({ amount }: { amount: string }) {
  const digits = centsDigitsFromDollars(amount);
  return <span>{digits ? formatCad(Number(digits)) : "Pad"}</span>;
}

export function CalculatorBody({
  scopeKey,
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
  scopeKey: string;
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
        <button type="button" className={`chip ${form.note === "Groceries" ? "selected" : ""}`} onClick={onMilk}>Groceries</button>
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
          <PadChoices key={`${scopeKey}:${mode}:accounts`} label="Account" plural="accounts" limit={6}
            items={active} selected={form.accountId} disabled={busy}
            onChoose={(accountId) => setForm({ ...form, accountId })}/>
          <PadChoices key={`${scopeKey}:${mode}:categories`} label="Category" plural="categories" limit={8}
            items={categories.filter(category => category.active)} selected={form.subcategoryId} disabled={busy}
            onChoose={(subcategoryId) => setForm({ ...form, subcategoryId })}/>

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
      <KitchenNotice message={error} />
      <div ref={postRef}>
        <button type="button" className="desk-post" disabled={busy} onClick={onPost}>{postLabel}</button>
      </div>
      <button type="button" className="chip" style={{ marginTop: 8 }} onClick={onMore}>More</button>
      <p className="muted" style={{ marginTop: 6 }}>Shift on this pad never posts. Start shift lives on the clock.</p>
    </div>
  );
}

/** Discloses only eligible incoming choices; opening a list never edits the draft. */
function PadChoices({label,plural,limit,items,selected,disabled,onChoose}:{label:string;plural:string;limit:number;items:readonly {id:string;name:string}[];selected:string;disabled:boolean;onChoose:(id:string)=>void}) {
  const [open,setOpen]=useState(false),id=useId();
  const shown=open?items:items.filter((item,index)=>index<limit||item.id===selected);
  return <div className="calculator-choices">
    <span>{label}</span>
    {!items.some(item=>item.id===selected)&&<p className="muted">Choose {label==='Account'?'an account':'a category'}.</p>}
    <div id={id} className="chips">
      {shown.map(item=><button key={item.id} type="button" className={`chip ${item.id===selected?'selected':''}`}
        style={{minHeight:44,minWidth:44,maxWidth:'100%',whiteSpace:'normal',overflowWrap:'anywhere'}}
        aria-pressed={item.id===selected} disabled={disabled} onClick={()=>onChoose(item.id)}>{item.name}</button>)}
    </div>
    {items.length>limit&&<button type="button" className="chip" style={{minHeight:44}} aria-expanded={open} aria-controls={id}
      onClick={()=>setOpen(value=>!value)}>{open?'Fewer':'More'} {plural}</button>}
  </div>;
}
