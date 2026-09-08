import { useEffect, useMemo, useState } from "react";
import {
  TIMEZONE,
  copy,
  formatCad,
  memberEarningSchedule,
  onboardingCadenceProbe,
  onboardingCadenceSentence,
  postedSevenShiftsPunchDigests,
  shapeWorkJob,
  workPayScheduleIsValid,
  type Account,
  type Household,
  type WorkJob,
  type WorkPayCadence,
  type WorkPaySchedule,
  type WorkRatePeriod,
  type WorkRole,
  type WorkSalesRequirement,
  type WorkTipOutBasis,
  type WorkTipOutRule,
} from "./core/index.ts";
import { SevenShiftsConnectPanel } from "./SevenShiftsConnectPanel.tsx";
import { KitchenNotice } from "./KitchenNotice.tsx";

const JOB_COLORS = ["#a85a3d", "#2f6b4f", "#4d7182", "#a57935", "#745d86"];

function accountDefault(accounts: Account[], kind: "cash" | "deposit"): string {
  if (kind === "cash") return accounts.find((account) => account.active && account.kind === "other")?.id
    || accounts.find((account) => account.active && account.kind === "chequing")?.id
    || "";
  return accounts.find((account) => account.active && account.kind === "chequing")?.id || accountDefault(accounts, "cash");
}

function newRate(today: string, index = 0): WorkRatePeriod {
  return {
    id: `RATE-DRAFT-${today}-${index}`,
    effectiveDate: today,
    grossHourlyRateCents: 0,
    takeHomeMode: "direct",
    takeHomeHourlyRateCents: 0,
    deductions: [],
    createdAt: "",
    updatedAt: "",
  };
}

function newRole(today: string, index = 0): WorkRole {
  return {
    id: `ROLE-DRAFT-${index + 1}`,
    name: index ? `Role ${index + 1}` : "Server",
    tipped: true,
    active: true,
    rates: [newRate(today, index)],
    createdAt: "",
    updatedAt: "",
  };
}

function newTipOut(index: number): WorkTipOutRule {
  return {
    id: `TIPOUT-DRAFT-${index + 1}`,
    label: index === 0 ? "Bar" : "Tip-out",
    basis: "total-sales",
    value: index === 0 ? 1 : 0,
    roundingCents: index === 0 ? 500 : 100,
    roundingMode: index === 0 ? "up" : "nearest",
    timing: index === 0 ? "immediate" : "withheld",
    active: true,
    createdAt: "",
    updatedAt: "",
  };
}

function blankJob(household: Household, memberId: string, today: string): WorkJob {
  const cash = accountDefault(household.accounts, "cash");
  const deposit = accountDefault(household.accounts, "deposit");
  return {
    id: "",
    memberId,
    name: "",
    color: JOB_COLORS[(household.workJobs ?? []).length % JOB_COLORS.length]!,
    active: true,
    timezone: TIMEZONE,
    locationName: "",
    gpsEnabled: false,
    locationLatitude: null,
    locationLongitude: null,
    roles: [newRole(today)],
    paidBreakRate: "role",
    paidBreakHourlyRateCents: 0,
    overtimeEnabled: true,
    overtimeWeeklyThresholdHours: 44,
    overtimeMultiplier: 1.5,
    tipOutRules: [newTipOut(0)],
    salesFields: ["Food", "Alcohol", "Other"].map((label) => ({
      id: `SALES-${label.toUpperCase()}`,
      label,
      requirement: "off" as const,
      createdAt: "",
      updatedAt: "",
    })),
    paySchedule: { cadence: "biweekly", anchorDate: today, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipSchedule: { cadence: "weekly", anchorDate: today, weekday: 5, monthDays: [15, 30], customDates: [], reminderTime: "09:00" },
    tipWeekStartsOn: 1,
    defaults: {
      wagesVisibility: "personal",
      cashTipsVisibility: "personal",
      cardTipsVisibility: "personal",
      tipOutVisibility: "personal",
      wagesDepositAccountId: deposit,
      cashTipsAccountId: cash,
      cardTipsDepositAccountId: cash,
    },
    wagesReceivableAccountId: "",
    cardTipsReceivableAccountId: "",
    note: "",
    createdAt: "",
    updatedAt: "",
  };
}

function dollars(cents: number): string { return cents ? (cents / 100).toFixed(2) : ""; }
function toCents(value: string): number { return Math.max(0, Math.round((Number(value) || 0) * 100)); }

function ScheduleFields({ label, value, onChange }: {
  label: string;
  value: WorkJob["paySchedule"];
  onChange: (next: WorkJob["paySchedule"]) => void;
}) {
  return (
    <div className="work-schedule-block">
      <strong>{label}</strong>
      <label>Cadence
        <select value={value.cadence} onChange={(event) => onChange({ ...value, cadence: event.target.value as WorkPayCadence })}>
          <option value="weekly">Weekly</option><option value="biweekly">Biweekly</option><option value="twice-monthly">Twice monthly</option><option value="custom">Custom dates</option><option value="irregular">No fixed rhythm</option>
        </select>
      </label>
      {(value.cadence === "weekly" || value.cadence === "biweekly") && (
        <label>Anchor payday<input type="date" value={value.anchorDate} onChange={(event) => onChange({ ...value, anchorDate: event.target.value })} /></label>
      )}
      {value.cadence === "twice-monthly" && (
        <div className="work-schedule-days">
          <label>First day<input type="number" min="1" max="31" value={value.monthDays[0] ?? 15} onChange={(event) => onChange({ ...value, monthDays: [Number(event.target.value) || 1, value.monthDays[1] ?? 30] })} /></label>
          <label>Second day<input type="number" min="1" max="31" value={value.monthDays[1] ?? 30} onChange={(event) => onChange({ ...value, monthDays: [value.monthDays[0] ?? 15, Number(event.target.value) || 1] })} /></label>
        </div>
      )}
      {value.cadence === "custom" && (
        <label>Next chosen date<input type="date" value={value.customDates[0] ?? ""} onChange={(event) => onChange({ ...value, customDates: event.target.value ? [event.target.value, ...value.customDates.slice(1)] : value.customDates.slice(1) })} /></label>
      )}
      {value.cadence !== "irregular" && <label>Calendar reminder time<input type="time" value={value.reminderTime} onChange={(event) => onChange({ ...value, reminderTime: event.target.value })} /></label>}
    </div>
  );
}

const CADENCE_CHOICES: ReadonlyArray<{ cadence: WorkPayCadence; label: string; hint: string }> = [
  { cadence: "weekly", label: "Every week", hint: "Same weekday" },
  { cadence: "biweekly", label: "Every other week", hint: "Same weekday, two weeks apart" },
  { cadence: "twice-monthly", label: "Twice a month", hint: "Two calendar dates" },
  { cadence: "custom", label: "Dates I choose", hint: "No repeating rule" },
  { cadence: "irregular", label: "No fixed rhythm", hint: "Paydays vary" },
];

function weekdayFor(date: string): number {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T12:00:00.000Z`).getUTCDay() : 0;
}

function startingCadence(household: Household, memberId: string, today: string): WorkPaySchedule {
  return memberEarningSchedule(household, memberId)
    ?? household.workJobs.find((job) => job.active && job.memberId === memberId)?.paySchedule
    ?? { ...blankJob(household, memberId, today).paySchedule, anchorDate: today, weekday: weekdayFor(today) };
}

export function EarningCadenceCard({ household, memberId, today, busy, onSave }: {
  household: Household;
  memberId: string;
  today: string;
  busy: boolean;
  onSave: (schedule: WorkPaySchedule) => void;
}) {
  const memberName = household.members.find((member) => member.id === memberId)?.name ?? "You";
  const [draft, setDraft] = useState<WorkPaySchedule>(() => structuredClone(startingCadence(household, memberId, today)));
  const probe = onboardingCadenceProbe(household, memberId);
  const valid = workPayScheduleIsValid(draft);

  function choose(cadence: WorkPayCadence) {
    setDraft((current) => ({
      ...current,
      cadence,
      anchorDate: current.anchorDate || today,
      weekday: weekdayFor(current.anchorDate || today),
      monthDays: current.monthDays.length ? current.monthDays : [15, 30],
      customDates: cadence === "custom" && current.customDates.length === 0 ? [today] : current.customDates,
    }));
  }

  return (
    <section className="card work-cadence-card" data-onboarding-cadence="true">
      <header>
        <div>
          <p className="work-cadence-kicker">Timing only</p>
          <h2>{copy("cadence.title")}</h2>
        </div>
        <span className="pill proj">No amount</span>
      </header>
      <p className="work-cadence-guide">{copy("cadence.guide")}</p>
      <fieldset className="work-cadence-choices">
        <legend>How are you usually paid?</legend>
        {CADENCE_CHOICES.map((choice) => (
          <button
            key={choice.cadence}
            type="button"
            className={`work-cadence-choice ${draft.cadence === choice.cadence ? "is-selected" : ""}`}
            aria-pressed={draft.cadence === choice.cadence}
            onClick={() => choose(choice.cadence)}
          >
            <strong>{choice.label}</strong>
            <span>{choice.hint}</span>
          </button>
        ))}
      </fieldset>
      {(draft.cadence === "weekly" || draft.cadence === "biweekly") && (
        <label className="work-cadence-detail">
          <span>One payday to anchor the rhythm</span>
          <input type="date" value={draft.anchorDate} onChange={(event) => setDraft({ ...draft, anchorDate: event.target.value, weekday: weekdayFor(event.target.value) })} />
        </label>
      )}
      {draft.cadence === "twice-monthly" && (
        <div className="work-cadence-detail work-cadence-day-pair">
          <label><span>First day</span><input type="number" min="1" max="31" value={draft.monthDays[0] ?? 15} onChange={(event) => setDraft({ ...draft, monthDays: [Number(event.target.value) || 1, draft.monthDays[1] ?? 30] })} /></label>
          <label><span>Second day</span><input type="number" min="1" max="31" value={draft.monthDays[1] ?? 30} onChange={(event) => setDraft({ ...draft, monthDays: [draft.monthDays[0] ?? 15, Number(event.target.value) || 1] })} /></label>
        </div>
      )}
      {draft.cadence === "custom" && (
        <label className="work-cadence-detail">
          <span>One payday to start with</span>
          <input type="date" value={draft.customDates[0] ?? ""} onChange={(event) => setDraft({ ...draft, customDates: event.target.value ? [event.target.value] : [] })} />
        </label>
      )}
      <div className="work-cadence-preview" role="status" aria-live="polite">
        <span className="work-cadence-preview-mark" aria-hidden="true">●</span>
        <span>{valid ? onboardingCadenceSentence(memberName, draft) : "Choose the timing detail above."}</span>
      </div>
      <p className="muted work-cadence-private">{copy("cadence.detail-later")}</p>
      {probe.complete ? <p className="work-cadence-saved" role="status">{copy("cadence.saved")}</p> : null}
      <button className="primary work-cadence-save" type="button" disabled={busy || !valid} onClick={() => onSave(draft)}>
        {copy("cadence.save")}
      </button>
    </section>
  );
}

export function WorkJobsCard({ household, memberId, today, busy, onAskSave, onArchive, onboardingCadenceOnly = false, onSaveCadence }: {
  household: Household;
  memberId: string;
  today: string;
  busy: boolean;
  onAskSave: (job: WorkJob, summary: string) => void;
  onArchive: (jobId: string) => void;
  onboardingCadenceOnly?: boolean;
  onSaveCadence?: (schedule: WorkPaySchedule) => void;
}) {
  const jobs = useMemo(() => (household.workJobs ?? []).filter((job) => job.memberId === memberId), [household.workJobs, memberId]);
  const [draft, setDraft] = useState<WorkJob | null>(null);
  const [error, setError] = useState("");
  const [pendingSave, setPendingSave] = useState<{ id: string; updatedAt: string; count: number } | null>(null);
  const cashAccounts = household.accounts.filter((account) => account.active && (account.kind === "chequing" || account.kind === "savings" || account.kind === "other"));

  useEffect(() => {
    if (!pendingSave) return;
    const saved = pendingSave.id ? jobs.find((job) => job.id === pendingSave.id) : null;
    if ((saved && saved.updatedAt !== pendingSave.updatedAt) || (!pendingSave.id && jobs.length > pendingSave.count)) {
      setDraft(null);
      setPendingSave(null);
      setError("");
    }
  }, [jobs, pendingSave]);

  function updateRole(roleId: string, change: (role: WorkRole) => WorkRole) {
    if (!draft) return;
    setDraft({ ...draft, roles: draft.roles.map((role) => role.id === roleId ? change(role) : role) });
  }

  function updateRate(roleId: string, rateId: string, change: (rate: WorkRatePeriod) => WorkRatePeriod) {
    updateRole(roleId, (role) => ({ ...role, rates: role.rates.map((rate) => rate.id === rateId ? change(rate) : rate) }));
  }

  if (onboardingCadenceOnly && onSaveCadence) {
    return <EarningCadenceCard household={household} memberId={memberId} today={today} busy={busy} onSave={onSaveCadence} />;
  }

  if (!draft) {
    return (
      <section className="card work-jobs-card">
        <header><h2>Jobs</h2><button className="chip" type="button" disabled={busy} onClick={() => setDraft(blankJob(household, memberId, today))}>Add job</button></header>
        <p className="muted">Employer rules power Timesheet, payday prompts, tip envelopes, owed balances, and reports. Saving a job does not post money.</p>
        {jobs.length === 0 ? <p>No jobs yet. Add the employer once; Timesheet remembers it.</p> : jobs.map((job) => {
          const role = job.roles.find((row) => row.active) ?? job.roles[0];
          const rate = role?.rates.at(-1);
          return (
            <div className="work-job-row" key={job.id} style={{ borderLeftColor: job.color }}>
              <div><strong>{job.name}</strong><div className="muted">{job.active ? `${job.roles.filter((row) => row.active).length} roles` : "Archived"}{rate ? ` · ${formatCad(rate.takeHomeHourlyRateCents || rate.grossHourlyRateCents)}/hr` : ""}</div></div>
              <button className="chip" type="button" onClick={() => setDraft(structuredClone(job))}>Edit</button>
            </div>
          );
        })}
        <SevenShiftsConnectPanel
          environment={household.environment}
          householdId={household.householdId}
          memberId={memberId}
          jobs={jobs}
          postedPunchDigests={postedSevenShiftsPunchDigests(household)}
          disabled={busy}
        />
      </section>
    );
  }

  return (
    <section className="card work-job-editor">
      <header><div><h2>{draft.id ? "Edit job" : "Add job"}</h2><span className="muted">{draft.name || "New employer"}</span></div><button className="ghost" type="button" onClick={() => { setDraft(null); setPendingSave(null); setError(""); }}>Close</button></header>
      <div className="work-job-editor-grid">
        <details open>
          <summary>Employer & roles</summary>
          <div className="work-form-grid">
            <label>Job name<input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Café Nola" /></label>
            <label>Colour<input type="color" value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} /></label>
          </div>
          {draft.roles.map((role, roleIndex) => (
            <div className="work-rule-block" key={role.id}>
              <div className="row"><strong>Role {roleIndex + 1}</strong>{draft.roles.length > 1 && <button className="ghost" type="button" onClick={() => setDraft({ ...draft, roles: draft.roles.filter((row) => row.id !== role.id) })}>Remove</button>}</div>
              <div className="work-form-grid">
                <label>Role name<input value={role.name} onChange={(event) => updateRole(role.id, (row) => ({ ...row, name: event.target.value }))} /></label>
                <label className="work-check"><input type="checkbox" checked={role.tipped} onChange={(event) => updateRole(role.id, (row) => ({ ...row, tipped: event.target.checked }))} /> Tipped role</label>
              </div>
              {role.rates.map((rate) => (
                <div className="work-rate-row" key={rate.id}>
                  <label>Effective<input type="date" value={rate.effectiveDate} onChange={(event) => updateRate(role.id, rate.id, (row) => ({ ...row, effectiveDate: event.target.value }))} /></label>
                  <label>Gross / hr<input inputMode="decimal" value={dollars(rate.grossHourlyRateCents)} onChange={(event) => updateRate(role.id, rate.id, (row) => ({ ...row, grossHourlyRateCents: toCents(event.target.value) }))} /></label>
                  <label>Take-home method<select value={rate.takeHomeMode} onChange={(event) => updateRate(role.id, rate.id, (row) => ({ ...row, takeHomeMode: event.target.value === "deductions" ? "deductions" : "direct" }))}><option value="direct">Enter take-home</option><option value="deductions">Calculate deductions</option></select></label>
                  {rate.takeHomeMode === "direct" ? (
                    <label>Take-home / hr<input inputMode="decimal" value={dollars(rate.takeHomeHourlyRateCents)} onChange={(event) => updateRate(role.id, rate.id, (row) => ({ ...row, takeHomeHourlyRateCents: toCents(event.target.value) }))} /></label>
                  ) : (
                    <label>Total deductions %<input inputMode="decimal" value={rate.deductions[0]?.percent ?? ""} onChange={(event) => updateRate(role.id, rate.id, (row) => ({ ...row, deductions: [{ id: "DEDUCTION-PAYROLL", label: "Payroll deductions", percent: Number(event.target.value) || 0 }] }))} /></label>
                  )}
                </div>
              ))}
              <button className="chip" type="button" onClick={() => updateRole(role.id, (row) => ({ ...row, rates: [...row.rates, newRate(today, row.rates.length)] }))}>Add wage change</button>
            </div>
          ))}
          <button className="chip" type="button" onClick={() => setDraft({ ...draft, roles: [...draft.roles, newRole(today, draft.roles.length)] })}>Add role</button>
        </details>

        <details>
          <summary>Breaks & overtime</summary>
          <div className="work-form-grid">
            <label>Paid breaks use<select value={draft.paidBreakRate} onChange={(event) => setDraft({ ...draft, paidBreakRate: event.target.value === "custom" ? "custom" : "role" })}><option value="role">Role wage rate</option><option value="custom">Special break rate</option></select></label>
            {draft.paidBreakRate === "custom" && <label>Paid break / hr<input inputMode="decimal" value={dollars(draft.paidBreakHourlyRateCents)} onChange={(event) => setDraft({ ...draft, paidBreakHourlyRateCents: toCents(event.target.value) })} /></label>}
            <label className="work-check"><input type="checkbox" checked={draft.overtimeEnabled} onChange={(event) => setDraft({ ...draft, overtimeEnabled: event.target.checked })} /> Calculate overtime</label>
            <label>Weekly threshold<input inputMode="decimal" value={draft.overtimeWeeklyThresholdHours} onChange={(event) => setDraft({ ...draft, overtimeWeeklyThresholdHours: Number(event.target.value) || 0 })} /></label>
            <label>Overtime multiplier<input inputMode="decimal" value={draft.overtimeMultiplier} onChange={(event) => setDraft({ ...draft, overtimeMultiplier: Number(event.target.value) || 1 })} /></label>
          </div>
        </details>

        <details>
          <summary>Tips & tip-outs</summary>
          {draft.tipOutRules.map((rule) => (
            <div className="work-rule-block" key={rule.id}>
              <div className="work-form-grid">
                <label>Name<input value={rule.label} onChange={(event) => setDraft({ ...draft, tipOutRules: draft.tipOutRules.map((row) => row.id === rule.id ? { ...row, label: event.target.value } : row) })} /></label>
                <label>Calculation<select value={rule.basis} onChange={(event) => setDraft({ ...draft, tipOutRules: draft.tipOutRules.map((row) => row.id === rule.id ? { ...row, basis: event.target.value as WorkTipOutBasis } : row) })}><option value="total-sales">% total sales</option><option value="card-tips">% card tips</option><option value="all-tips">% all tips</option><option value="fixed-shift">Fixed $ / shift</option><option value="fixed-hour">Fixed $ / hour</option><option value="manual">Manual / shift</option></select></label>
                <label>{rule.basis.startsWith("fixed") || rule.basis === "manual" ? "Amount in cents" : "Percent"}<input inputMode="decimal" value={rule.value} onChange={(event) => setDraft({ ...draft, tipOutRules: draft.tipOutRules.map((row) => row.id === rule.id ? { ...row, value: Number(event.target.value) || 0 } : row) })} /></label>
                <label>Paid<select value={rule.timing} onChange={(event) => setDraft({ ...draft, tipOutRules: draft.tipOutRules.map((row) => row.id === rule.id ? { ...row, timing: event.target.value === "immediate" || event.target.value === "deferred" ? event.target.value : "withheld" } : row) })}><option value="immediate">Immediately from Cash</option><option value="withheld">From tip envelope</option><option value="deferred">Deferred · remind daily</option></select></label>
                <label>Round to cents<input inputMode="numeric" value={rule.roundingCents} onChange={(event) => setDraft({ ...draft, tipOutRules: draft.tipOutRules.map((row) => row.id === rule.id ? { ...row, roundingCents: Math.max(0, Number(event.target.value) || 0) } : row) })} /></label>
                <label>Rounding<select value={rule.roundingMode} onChange={(event) => setDraft({ ...draft, tipOutRules: draft.tipOutRules.map((row) => row.id === rule.id ? { ...row, roundingMode: event.target.value as WorkTipOutRule["roundingMode"] } : row) })}><option value="nearest">Nearest</option><option value="up">Up</option><option value="down">Down</option></select></label>
              </div>
              <button className="ghost" type="button" onClick={() => setDraft({ ...draft, tipOutRules: draft.tipOutRules.filter((row) => row.id !== rule.id) })}>Remove rule</button>
            </div>
          ))}
          <button className="chip" type="button" onClick={() => setDraft({ ...draft, tipOutRules: [...draft.tipOutRules, newTipOut(draft.tipOutRules.length)] })}>Add tip-out rule</button>
        </details>

        <details>
          <summary>Sales tracking</summary>
          <p className="muted">Required is opt-in. Hidden categories never appear during shift confirmation.</p>
          {draft.salesFields.map((field) => (
            <div className="row" key={field.id}><strong>{field.label}</strong><select value={field.requirement} onChange={(event) => setDraft({ ...draft, salesFields: draft.salesFields.map((row) => row.id === field.id ? { ...row, requirement: event.target.value as WorkSalesRequirement } : row) })}><option value="off">Off</option><option value="optional">Optional</option><option value="required">Required</option></select></div>
          ))}
        </details>

        <details>
          <summary>Pay & tip schedules</summary>
          <div className="work-form-grid"><ScheduleFields label="Paycheck" value={draft.paySchedule} onChange={(paySchedule) => setDraft({ ...draft, paySchedule })} /><ScheduleFields label="Tip envelope" value={draft.tipSchedule} onChange={(tipSchedule) => setDraft({ ...draft, tipSchedule })} /></div>
        </details>

        <details>
          <summary>Location & remembered destinations</summary>
          <div className="work-form-grid">
            <label>Location (optional)<input value={draft.locationName} onChange={(event) => setDraft({ ...draft, locationName: event.target.value })} /></label>
            <label>Timezone<input value={draft.timezone} onChange={(event) => setDraft({ ...draft, timezone: event.target.value })} /></label>
            <label className="work-check"><input type="checkbox" checked={draft.gpsEnabled} onChange={(event) => setDraft({ ...draft, gpsEnabled: event.target.checked })} /> Use GPS when available</label>
            <div>
              <button type="button" className="chip" onClick={() => {
                if (!navigator.geolocation) {
                  setError("This browser cannot place the workplace pin.");
                  return;
                }
                navigator.geolocation.getCurrentPosition((position) => {
                  setDraft((current) => current ? ({
                    ...current,
                    gpsEnabled: true,
                    locationLatitude: Math.round(position.coords.latitude * 100) / 100,
                    locationLongitude: Math.round(position.coords.longitude * 100) / 100,
                  }) : current);
                  setError("");
                }, () => setError("Location permission was not granted. You can leave weather context off."), { enableHighAccuracy: false, maximumAge: 300_000, timeout: 8_000 });
              }}>Place workplace weather pin</button>
              <p className="muted">{draft.locationLatitude != null && draft.locationLongitude != null ? `Rounded pin ${draft.locationLatitude.toFixed(2)}, ${draft.locationLongitude.toFixed(2)}` : "One rounded workplace pin; Hearth never keeps a shift-by-shift GPS trail."}</p>
            </div>
            <label>Wages deposit<select value={draft.defaults.wagesDepositAccountId} onChange={(event) => setDraft({ ...draft, defaults: { ...draft.defaults, wagesDepositAccountId: event.target.value } })}>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label>Cash tips<select value={draft.defaults.cashTipsAccountId} onChange={(event) => setDraft({ ...draft, defaults: { ...draft.defaults, cashTipsAccountId: event.target.value } })}>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label>Card-tip payout<select value={draft.defaults.cardTipsDepositAccountId} onChange={(event) => setDraft({ ...draft, defaults: { ...draft.defaults, cardTipsDepositAccountId: event.target.value } })}>{cashAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
            <label>Notes<textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          </div>
        </details>
      </div>
      <KitchenNotice message={error} />
      <div className="work-job-actions">
        {draft.id && draft.active && <button className="danger" type="button" onClick={() => onArchive(draft.id)}>Archive job</button>}
        <button className="primary" type="button" disabled={busy} onClick={() => {
          try {
            const shaped = shapeWorkJob(draft);
            if (!shaped.name.trim()) throw new Error("Give this job a name.");
            if (!shaped.roles.some((role) => role.active && role.name.trim())) throw new Error("Add at least one role.");
            setError("");
            setPendingSave({ id: draft.id, updatedAt: draft.updatedAt, count: jobs.length });
            onAskSave(shaped, `${shaped.name} · ${shaped.roles.filter((role) => role.active).length} role${shaped.roles.filter((role) => role.active).length === 1 ? "" : "s"} · job settings only, no money posted.`);
          } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
        }}>Review job</button>
      </div>
    </section>
  );
}
