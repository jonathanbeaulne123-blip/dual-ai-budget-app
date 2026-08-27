import { useEffect, useMemo, useState } from "react";
import { CadPad } from "./CadPad.tsx";
import {
  calculateWorkShift,
  centsDigitsFromDollars,
  dollarsFromCentsDigits,
  formatCad,
  previousWorkWeekHours,
  SHIFT_EVENT_TAGS,
  workedHoursFromOpenShift,
  workJobFingerprint,
  type Household,
  type OpenShift,
  type PostWorkShiftInput,
  type ShiftEventTag,
  type Visibility,
  type WeatherGlass,
} from "./core/index.ts";

type MoneyKey = `sales:${string}` | "sales" | "cashTips" | "cardTips";

const VISIBILITY: Array<{ id: Visibility; label: string }> = [
  { id: "personal", label: "Personal" },
  { id: "household", label: "Shared" },
  { id: "both", label: "Both" },
];

const EVENT_LABELS: Record<ShiftEventTag, string> = {
  regular: "Regular",
  holiday: "Holiday",
  sports: "Sports",
  festival: "Festival",
  private_party: "Private party",
  short_staffed: "Short-staffed",
  vacation_cover: "Vacation cover",
  illness_cover: "Illness cover",
  other: "Other",
};

export type WorkShiftDraft = {
  date?: string;
  workedHours?: string | number;
  paidBreakHours?: string | number;
  sales?: string | number;
  cashTips?: string | number;
  cardTips?: string | number;
  customersServed?: string | number;
  staffingCount?: string | number;
  eventTag?: ShiftEventTag;
  weatherGlass?: WeatherGlass;
  note?: string;
};

function dollars(digits: string): string {
  return dollarsFromCentsDigits(digits || "0");
}

function asDigitsFromDollars(value: string | number | undefined): string {
  if (value == null || value === "") return "";
  return centsDigitsFromDollars(String(value));
}

export function WorkShiftFlow({
  household,
  memberId,
  today,
  punch,
  busy,
  onConfirm,
  initialDraft,
  weatherGlassPrefill,
}: {
  household: Household;
  memberId: string;
  today: string;
  punch: OpenShift | null;
  busy: boolean;
  onConfirm: (input: PostWorkShiftInput) => void;
  /** OCR / scan draft — never posts alone; Confirm remains the money boundary. */
  initialDraft?: WorkShiftDraft | null;
  weatherGlassPrefill?: WeatherGlass | null;
}) {
  const jobs = useMemo(() => (household.workJobs ?? []).filter((job) => job.active && job.memberId === memberId), [household.workJobs, memberId]);
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(initialDraft?.date || today);
  const [jobId, setJobId] = useState(() => jobs[0]?.id ?? "");
  const job = jobs.find((row) => row.id === jobId) ?? jobs[0];
  const [roleId, setRoleId] = useState(() => job?.roles.find((role) => role.active)?.id ?? "");
  const role = job?.roles.find((row) => row.id === roleId && row.active) ?? job?.roles.find((row) => row.active);
  const punchHours = punch ? workedHoursFromOpenShift(punch) : null;
  const [hoursDigits, setHoursDigits] = useState(() => asDigitsFromDollars(initialDraft?.workedHours ?? punchHours?.workedHours ?? 0) || centsDigitsFromDollars("0"));
  const [paidBreakDigits, setPaidBreakDigits] = useState(() => asDigitsFromDollars(initialDraft?.paidBreakHours ?? punchHours?.paidBreakHours ?? 0) || centsDigitsFromDollars("0"));
  const [hoursTouched, setHoursTouched] = useState(Boolean(initialDraft?.workedHours != null));
  const [money, setMoney] = useState<Record<string, string>>({
    sales: asDigitsFromDollars(initialDraft?.sales),
    cashTips: asDigitsFromDollars(initialDraft?.cashTips),
    cardTips: asDigitsFromDollars(initialDraft?.cardTips),
  });
  const [activeMoney, setActiveMoney] = useState<MoneyKey>("sales");
  const lastSameJob = useMemo(() => {
    if (!job) return null;
    return household.shifts
      .filter((shift) => shift.memberId === memberId && shift.jobId === job.id && !shift.correctedByShiftId)
      .slice()
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))[0] ?? null;
  }, [household.shifts, job?.id, memberId]);
  const [customersServed, setCustomersServed] = useState(() => String(initialDraft?.customersServed ?? ""));
  const [staffingCount, setStaffingCount] = useState(() => String(initialDraft?.staffingCount ?? lastSameJob?.staffingCount ?? 1));
  const [eventTag, setEventTag] = useState<ShiftEventTag>(() => initialDraft?.eventTag ?? "regular");
  const [weatherGlass, setWeatherGlass] = useState<WeatherGlass | "">(() => initialDraft?.weatherGlass ?? weatherGlassPrefill ?? "");
  const [cashAccountId, setCashAccountId] = useState(() => job?.defaults.cashTipsAccountId ?? "");
  const [wagesDepositAccountId, setWagesDepositAccountId] = useState(() => job?.defaults.wagesDepositAccountId ?? "");
  const [cardDepositAccountId, setCardDepositAccountId] = useState(() => job?.defaults.cardTipsDepositAccountId ?? "");
  const [wagesVisibility, setWagesVisibility] = useState<Visibility>(() => job?.defaults.wagesVisibility ?? "personal");
  const [cashVisibility, setCashVisibility] = useState<Visibility>(() => job?.defaults.cashTipsVisibility ?? "personal");
  const [cardVisibility, setCardVisibility] = useState<Visibility>(() => job?.defaults.cardTipsVisibility ?? "personal");
  const [tipOutVisibility, setTipOutVisibility] = useState<Visibility>(() => job?.defaults.tipOutVisibility ?? "personal");
  const [note, setNote] = useState(initialDraft?.note ?? "");
  const [stepError, setStepError] = useState("");

  useEffect(() => {
    if (hoursTouched || !punch) return;
    const preview = workedHoursFromOpenShift(punch);
    setHoursDigits(centsDigitsFromDollars(String(preview.workedHours)));
    setPaidBreakDigits(centsDigitsFromDollars(String(preview.paidBreakHours)));
  }, [punch, hoursTouched]);

  useEffect(() => {
    if (!job) return;
    const nextRole = job.roles.find((candidate) => candidate.active);
    if (!job.roles.some((candidate) => candidate.id === roleId && candidate.active)) setRoleId(nextRole?.id ?? "");
    setCashAccountId(job.defaults.cashTipsAccountId);
    setWagesDepositAccountId(job.defaults.wagesDepositAccountId);
    setCardDepositAccountId(job.defaults.cardTipsDepositAccountId);
    setWagesVisibility(job.defaults.wagesVisibility);
    setCashVisibility(job.defaults.cashTipsVisibility);
    setCardVisibility(job.defaults.cardTipsVisibility);
    setTipOutVisibility(job.defaults.tipOutVisibility);
    if (initialDraft?.staffingCount == null && lastSameJob?.staffingCount != null) {
      setStaffingCount(String(lastSameJob.staffingCount));
    }
  }, [job?.id]);

  const salesFields = job?.salesFields.filter((field) => field.requirement !== "off") ?? [];
  const salesCents = salesFields.length
    ? salesFields.reduce((sum, field) => sum + Number(money[`sales:${field.id}`] || 0), 0)
    : Number(money.sales || 0);
  const calculation = useMemo(() => {
    if (!job || !role) return null;
    try {
      return calculateWorkShift(job, role.id, {
        date,
        workedHours: Number(dollars(hoursDigits)),
        paidBreakHours: Number(dollars(paidBreakDigits)),
        previousWeekHours: previousWorkWeekHours(household, job.id, memberId, date),
        salesCents,
        cashTipsCents: Number(money.cashTips || 0),
        cardTipsCents: Number(money.cardTips || 0),
      });
    } catch {
      return null;
    }
  }, [household.shifts, job, role, date, memberId, hoursDigits, paidBreakDigits, salesCents, money.cashTips, money.cardTips]);
  const accounts = household.accounts.filter((account) => account.active && (account.kind === "chequing" || account.kind === "savings" || account.kind === "other"));

  if (!job || !role) {
    return (
      <div className="work-shift-empty">
        <h2>Add a job first</h2>
        <p className="muted">A job supplies the wage, break, tip-out, sales, and payday rules. Open More → Jobs, then come back to Timesheet.</p>
      </div>
    );
  }

  const moneyChoices: Array<{ id: MoneyKey; label: string }> = salesFields.length
    ? salesFields.map((field) => ({ id: `sales:${field.id}` as MoneyKey, label: field.label }))
    : [{ id: "sales", label: "Sales" }];
  if (role.tipped) moneyChoices.push({ id: "cashTips", label: "Cash tips" }, { id: "cardTips", label: "Card tips" });
  const selectedMoney = money[activeMoney] ?? "";
  const canContinue = Number(dollars(hoursDigits)) + Number(dollars(paidBreakDigits)) > 0;

  const validateSalesStep = (): string | null => {
    if (!role.tipped) return null;
    if (salesFields.length && !(salesCents > 0)) return "Enter sales before confirming a tipped shift.";
    const covers = Number(customersServed);
    if (!Number.isInteger(covers) || covers < 0 || covers > 5000) return "Enter customers served (0–5000).";
    const staff = Number(staffingCount);
    if (!Number.isInteger(staff) || staff < 1 || staff > 200) return "Enter people on floor (1–200). Headcount only — never names.";
    return null;
  };

  const confirm = () => {
    const error = validateSalesStep();
    if (error) {
      setStepError(error);
      setStep(1);
      return;
    }
    setStepError("");
    onConfirm({
      date,
      memberId,
      jobId: job.id,
      roleId: role.id,
      workedHours: dollars(hoursDigits),
      paidBreakHours: dollars(paidBreakDigits),
      sales: dollars(money.sales ?? ""),
      salesByField: Object.fromEntries(salesFields.map((field) => [field.id, dollars(money[`sales:${field.id}`] ?? "")])),
      cashTips: dollars(money.cashTips ?? ""),
      cardTips: dollars(money.cardTips ?? ""),
      customersServed: role.tipped ? Number(customersServed) : undefined,
      staffingCount: role.tipped ? Number(staffingCount) : undefined,
      eventTag: role.tipped ? eventTag : undefined,
      weatherGlass: weatherGlass || undefined,
      cashTipsAccountId: cashAccountId,
      wagesDepositAccountId,
      cardTipsDepositAccountId: cardDepositAccountId,
      wagesVisibility,
      cashTipsVisibility: cashVisibility,
      cardTipsVisibility: cardVisibility,
      tipOutVisibility,
      startedAt: punch?.startedAt ?? null,
      endedAt: punch?.endedAt ?? null,
      note,
      settingsFingerprint: workJobFingerprint(job, role.id, date),
      createdBy: memberId,
    });
  };

  return (
    <section className="work-shift-flow" aria-label="Confirm work shift">
      <div className="work-shift-progress" aria-label={`Step ${step + 1} of 4`}>
        {["Job & time", "Sales & tips", "Destinations", "Review"].map((label, index) => (
          <button key={label} type="button" className={step === index ? "active" : step > index ? "done" : ""} onClick={() => index < step && setStep(index)}>
            <span>{index + 1}</span>{label}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div className="work-shift-step">
          <p className="kicker">{punch ? "Timesheet review" : "Already off"}</p>
          <h2>{punch ? "Check the clock" : "Which shift did you work?"}</h2>
          <div className="work-shift-grid two">
            <label>Shift date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
            <label>Job<select value={job.id} onChange={(event) => setJobId(event.target.value)}>{jobs.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
            <label>Role<select value={role.id} onChange={(event) => setRoleId(event.target.value)}>{job.roles.filter((row) => row.active).map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
          </div>
          {punch && <p className="muted">Clocked {new Date(punch.startedAt).toLocaleTimeString([], { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" })}{punch.endedAt ? `–${new Date(punch.endedAt).toLocaleTimeString([], { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" })}` : ""}. Edit the totals below before Confirm if the clock was wrong.</p>}
          <div className="work-shift-pad-grid">
            <CadPad digits={hoursDigits} onDigits={(digits) => { setHoursTouched(true); setHoursDigits(digits); }} label="Actual working hours" unit="hours" />
            <CadPad digits={paidBreakDigits} onDigits={(digits) => { setHoursTouched(true); setPaidBreakDigits(digits); }} label="Paid-break hours" unit="hours" />
          </div>
          <p className="muted">Unpaid breaks are excluded. Paid breaks stay visible as their own income category.</p>
        </div>
      )}

      {step === 1 && (
        <div className="work-shift-step">
          <p className="kicker">{job.name} · {role.name}</p>
          <h2>Sales and tips</h2>
          <div className="chips work-shift-metrics">
            {moneyChoices.map((choice) => <button key={choice.id} type="button" className={`chip ${activeMoney === choice.id ? "selected" : ""}`} onClick={() => setActiveMoney(choice.id)}>{choice.label} · {formatCad(Number(money[choice.id] || 0))}</button>)}
          </div>
          <CadPad digits={selectedMoney} onDigits={(digits) => setMoney((current) => ({ ...current, [activeMoney]: digits }))} label={moneyChoices.find((choice) => choice.id === activeMoney)?.label ?? "Amount"} />
          {role.tipped && (
            <div className="work-shift-grid two" style={{ marginTop: "1rem" }}>
              <label>
                Customers served
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={5000}
                  value={customersServed}
                  onChange={(event) => setCustomersServed(event.target.value)}
                  required
                />
              </label>
              <label>
                People on floor
                <input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={200}
                  value={staffingCount}
                  onChange={(event) => setStaffingCount(event.target.value)}
                  required
                />
              </label>
              <label>
                Event tag
                <select value={eventTag} onChange={(event) => setEventTag(event.target.value as ShiftEventTag)}>
                  {SHIFT_EVENT_TAGS.map((tag) => <option key={tag} value={tag}>{EVENT_LABELS[tag]}</option>)}
                </select>
              </label>
              <label>
                Weather glass
                <select value={weatherGlass} onChange={(event) => setWeatherGlass(event.target.value as WeatherGlass | "")}>
                  <option value="">Not stamped</option>
                  <option value="clear">Clear</option>
                  <option value="rain">Rain</option>
                  <option value="snow">Snow</option>
                  <option value="night">Night</option>
                  <option value="humid">Humid</option>
                </select>
              </label>
            </div>
          )}
          {role.tipped && <p className="muted">People on floor is headcount only — never coworker names. Covers and staffing feed tip projections; Confirm still posts the money.</p>}
          {job.tipOutRules.some((rule) => rule.active) && <p className="muted">Configured tip-outs recalculate as these figures change. Cash tips remain gross income; any immediate bar payment is a separate work expense.</p>}
          {stepError && <p className="error" role="alert">{stepError}</p>}
        </div>
      )}

      {step === 2 && (
        <div className="work-shift-step">
          <p className="kicker">Where each part belongs</p>
          <h2>Check destinations</h2>
          <div className="work-destinations">
            <Destination label="Wages on payday" value={wagesDepositAccountId} onValue={setWagesDepositAccountId} visibility={wagesVisibility} onVisibility={setWagesVisibility} accounts={accounts} owed={`${job.name} · Wages owed`} />
            {role.tipped && <Destination label="Cash tips today" value={cashAccountId} onValue={setCashAccountId} visibility={cashVisibility} onVisibility={setCashVisibility} accounts={accounts} />}
            {role.tipped && <Destination label="Card tips on payout day" value={cardDepositAccountId} onValue={setCardDepositAccountId} visibility={cardVisibility} onVisibility={setCardVisibility} accounts={accounts} owed={`${job.name} · Card tips owed`} />}
          </div>
          <label>Shift note<textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Anything worth remembering…" /></label>
          {role.tipped && <label>Tip-out visibility<div className="chips">{VISIBILITY.map((item) => <button key={item.id} type="button" className={`chip ${tipOutVisibility === item.id ? "selected" : ""}`} onClick={() => setTipOutVisibility(item.id)}>{item.label}</button>)}</div></label>}
        </div>
      )}

      {step === 3 && (
        <div className="work-shift-step">
          <p className="kicker">Confirm is the money boundary</p>
          <h2>{job.name} · {role.name}</h2>
          <div className="work-shift-review">
            <div><span>Working hours</span><strong>{dollars(hoursDigits)} h</strong></div>
            <div><span>Paid break</span><strong>{dollars(paidBreakDigits)} h</strong></div>
            <div><span>Gross wages</span><strong>{calculation ? formatCad(calculation.grossWagesCents) : "—"}</strong></div>
            <div><span>Expected take-home wages</span><strong>{calculation ? formatCad(calculation.takeHomeWagesCents) : "—"}</strong></div>
            <div><span>Tips before tip-outs</span><strong>{calculation ? formatCad(calculation.tipsBeforeTipOutCents) : "—"}</strong></div>
            <div><span>Tips after tip-outs</span><strong>{calculation ? formatCad(calculation.netTipsCents) : "—"}</strong></div>
            {role.tipped && <div><span>Customers served</span><strong>{customersServed || "—"}</strong></div>}
            {role.tipped && <div><span>People on floor</span><strong>{staffingCount || "—"}</strong></div>}
            {role.tipped && <div><span>Event</span><strong>{EVENT_LABELS[eventTag]}</strong></div>}
          </div>
          {calculation?.tipOuts.map((row) => <p className="muted" key={row.ruleId}>{row.label}: {formatCad(row.amountCents)} · {row.timing === "immediate" ? "paid from cash now" : row.timing === "deferred" ? "remind daily until paid" : "held from tip envelope"}</p>)}
          <p className="muted">Confirm posts earned wages to Wages owed, card tips to Card tips owed, and same-day cash tips to {household.accounts.find((account) => account.id === cashAccountId)?.name ?? "the chosen account"}. Payday prompts move owed money later.</p>
        </div>
      )}

      <div className="work-shift-footer">
        {step > 0 && <button type="button" className="chip" disabled={busy} onClick={() => setStep((current) => current - 1)}>Back</button>}
        {step < 3 ? (
          <button
            type="button"
            className="primary"
            disabled={busy || (step === 0 && !canContinue)}
            onClick={() => {
              if (step === 1) {
                const error = validateSalesStep();
                if (error) {
                  setStepError(error);
                  return;
                }
                setStepError("");
              }
              setStep((current) => current + 1);
            }}
          >
            Next
          </button>
        ) : <button type="button" className="primary post-big" disabled={busy || !calculation} onClick={confirm}>Confirm shift</button>}
      </div>
    </section>
  );
}

function Destination({ label, value, onValue, visibility, onVisibility, accounts, owed }: {
  label: string;
  value: string;
  onValue: (value: string) => void;
  visibility: Visibility;
  onVisibility: (value: Visibility) => void;
  accounts: Household["accounts"];
  owed?: string;
}) {
  return (
    <div className="work-destination">
      <label>{label}<select value={value} onChange={(event) => onValue(event.target.value)}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
      {owed && <p className="muted">Earned first in {owed}; this is the planned landing account.</p>}
      <div className="chips">{VISIBILITY.map((item) => <button key={item.id} type="button" className={`chip ${visibility === item.id ? "selected" : ""}`} onClick={() => onVisibility(item.id)}>{item.label}</button>)}</div>
    </div>
  );
}
