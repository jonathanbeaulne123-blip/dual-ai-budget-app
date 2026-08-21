import { useEffect, useMemo, useState } from "react";
import {
  JOINT,
  NeedsConfirmationError,
  ValidationError,
  addCategory,
  addGoal,
  applySitDown,
  buildDashboard,
  calcShiftAmounts,
  catalogHousehold,
  contributeToGoal,
  equalSplits,
  formatCad,
  formatDateLabel,
  jointSplit,
  markDuplicate,
  monthKeyFromDateKey,
  parseAmount,
  postDueRecurrences,
  postEntry,
  postShift,
  postTransfer,
  runHealthCheck,
  seedDemoHousehold,
  shiftSettingsFingerprint,
  sitDownPreview,
  todayKey,
  undo,
  type CommitResult,
  type Environment,
  type Household,
  type Split,
  type UndoToken,
} from "./core/index.ts";
import { downloadJson, loadHousehold, saveHousehold } from "./storage.ts";

type Tab = "home" | "plan" | "review" | "more";
type AddMode = "expense" | "income" | "shift" | "transfer";

const emptyForm = {
  date: todayKey(),
  amount: "",
  accountId: "ACC-VISA",
  subcategoryId: "SUB-FOOD-GROCERIES",
  note: "",
  who: JOINT as string,
  fromAccountId: "ACC-CHEQUING",
  toAccountId: "ACC-VISA",
  memberId: "MEM-002",
  sales: "0",
  cashTips: "0",
  ccTips: "0",
  hours: "4",
};

export function App() {
  const [environment, setEnvironment] = useState<Environment>("development");
  const [household, setHousehold] = useState<Household | null>(() => loadHousehold("development"));
  const [tab, setTab] = useState<Tab>("home");
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<AddMode>("expense");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<NeedsConfirmationError | null>(null);
  const [toast, setToast] = useState<UndoToken | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [now] = useState(() => new Date());

  useEffect(() => {
    const loaded = loadHousehold(environment);
    setHousehold(loaded);
  }, [environment]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
      if (event.key === "Escape") setCommandOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const today = todayKey(now);
  const findings = useMemo(() => (household ? runHealthCheck(household) : []), [household]);
  const dashboard = useMemo(
    () => (household ? buildDashboard(household, today, now, findings.length) : null),
    [household, today, now, findings.length],
  );

  function persist(next: Household, token?: UndoToken) {
    saveHousehold(next);
    setHousehold(next);
    if (token) {
      setToast(token);
      window.setTimeout(() => setToast((current) => (current?.id === token.id ? null : current)), 8000);
    }
  }

  function run(fn: () => CommitResult) {
    if (!household || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = fn();
      persist(result.household, result.undo);
      setConfirm(null);
      setAdding(false);
      setForm({ ...emptyForm, date: today });
      if (result.warnings.length) setError(result.warnings.join(" "));
    } catch (caught) {
      if (caught instanceof NeedsConfirmationError) setConfirm(caught);
      else setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (!household) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">Toronto · CAD · two people</p>
          <img src="/icon.png" alt="" />
          <h1>Hearth</h1>
          <p>
            A household ledger that treats every add as a recoverable commit.
            Transfers are not spend. Splits always add up. The numbers on Home
            are the same functions the tests run.
          </p>
          <button className="primary" onClick={() => persist(seedDemoHousehold({ today, environment }))}>
            Open the demo kitchen table
          </button>
          <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => persist(catalogHousehold(environment))}>
            Start empty
          </button>
        </div>
      </div>
    );
  }

  const ledger = household;
  const categories = ledger.categories.filter((category) => category.recordType === "category" && category.active && category.transactionType === (mode === "income" ? "income" : "expense"));
  const shiftPreview = calcShiftAmounts({
    salesCents: Math.round(Number(form.sales || 0) * 100) || 0,
    cashTipsCents: Math.round(Number(form.cashTips || 0) * 100) || 0,
    ccTipsCents: Math.round(Number(form.ccTips || 0) * 100) || 0,
    hours: Number(form.hours || 0) || 0,
  }, ledger.shiftSettings);

  function splitsFor(amountCents: number): Split[] {
    if (form.who === "split") return equalSplits(["MEM-001", "MEM-002"], amountCents);
    if (form.who === JOINT) return jointSplit(amountCents);
    return [{ party: form.who, amountCents }];
  }

  function submit(confirmDuplicate = false) {
    if (mode === "transfer") {
      run(() => postTransfer(ledger, {
        date: form.date,
        amount: form.amount,
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        note: form.note,
        confirmDuplicate,
      }));
      return;
    }
    if (mode === "shift") {
      run(() => postShift(ledger, {
        date: form.date,
        memberId: form.memberId,
        accountId: form.accountId,
        sales: form.sales,
        cashTips: form.cashTips,
        ccTips: form.ccTips,
        hours: form.hours,
        settingsFingerprint: shiftSettingsFingerprint(ledger.shiftSettings),
        confirmDuplicate,
      }));
      return;
    }
    run(() => postEntry(ledger, {
      date: form.date,
      type: mode,
      amount: form.amount,
      accountId: form.accountId,
      subcategoryId: form.subcategoryId,
      note: form.note,
      splits: splitsFor(parseAmount(form.amount)),
      confirmDuplicate,
    }));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icon.png" alt="" />
          <div>
            <h1>Hearth</h1>
            <p>{household.name} · {today}</p>
          </div>
        </div>
        <button className={`pill ${environment === "development" ? "dev" : "prod"}`} onClick={() => setEnvironment(environment === "development" ? "production" : "development")}>
          {environment === "development" ? "Development" : "Production"}
        </button>
      </header>

      {tab === "home" && dashboard && (
        <>
          <section className="hero">
            <div className="label">{dashboard.monthLabel}</div>
            <div className={`money ${dashboard.month.netActualCents < 0 ? "negative" : ""}`}>{formatCad(dashboard.month.netActualCents)}</div>
            <div className="sub">
              {formatCad(dashboard.month.incomeActualCents)} in · {formatCad(dashboard.month.expenseActualCents)} out
              {" · "}
              {dashboard.stale ? "numbers need a look" : "fresh"}
            </div>
          </section>
          <div className="pulse">
            {dashboard.pulses.map((pulse) => (
              <article key={pulse.sentence} className={pulse.tone}>{pulse.sentence}</article>
            ))}
          </div>
          <div className="grid">
            <div className="stat"><span>This week</span><strong>{formatCad(dashboard.week.expenseCents)}</strong></div>
            <div className="stat"><span>vs last week</span><strong>{formatCad(dashboard.week.expenseCents - dashboard.week.lastWeekExpenseCents)}</strong></div>
            <div className="stat"><span>Safety gap</span><strong>{formatCad(dashboard.month.householdCoverageGapCents)}</strong></div>
            <div className="stat"><span>Tips / hour</span><strong>{formatCad(dashboard.tipWeather.tipsPerHourCents)}</strong></div>
          </div>
          <section className="card">
            <header>
              <h2>This week</h2>
              <span className="muted">{formatDateLabel(dashboard.week.start)} – {formatDateLabel(dashboard.week.end)}</span>
            </header>
            {dashboard.week.movers.map((mover) => (
              <div className="row" key={mover.name}>
                <span>{mover.name}{mover.hot ? " · hot" : ""}</span>
                <span className="right">{formatCad(mover.actualCents)}</span>
              </div>
            ))}
            {dashboard.week.byParty.map((party) => (
              <div className="row" key={party.party}>
                <span className="muted">{party.name}</span>
                <span className="muted">{formatCad(party.amountCents)}</span>
              </div>
            ))}
          </section>
          <section className="card">
            <header><h2>Goals</h2><span className="muted">shared sit on Home</span></header>
            {dashboard.goals.filter((item) => item.goal.shared).map((item) => (
              <div key={item.goal.id}>
                <div className="row"><span>{item.goal.name}</span><span>{Math.round(item.progress * 100)}%</span></div>
                <div className="bar"><i style={{ width: `${item.progress * 100}%` }} /></div>
              </div>
            ))}
          </section>
        </>
      )}

      {tab === "plan" && dashboard && (
        <>
          <section className="hero">
            <div className="label">Plan vs actual</div>
            <div className="money">{formatCad(dashboard.month.netBudgetedCents)}</div>
            <div className="sub">Budgeted net for {dashboard.monthLabel}</div>
          </section>
          <section className="card">
            <header><h2>Categories</h2></header>
            {dashboard.month.categories.filter((row) => row.budgetedCents || row.actualCents).map((row) => {
              const pct = row.budgetedCents ? Math.min(140, (row.actualCents / row.budgetedCents) * 100) : 0;
              return (
                <div key={row.subcategoryId} style={{ marginBottom: 10 }}>
                  <div className="row">
                    <span>{row.name}</span>
                    <span>{formatCad(row.actualCents)} / {formatCad(row.budgetedCents)}</span>
                  </div>
                  <div className="bar"><i className={pct > 100 ? "over" : ""} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
                </div>
              );
            })}
          </section>
          <SitDown household={household} onApply={(next, token) => persist(next, token)} />
          <Goals household={household} onChange={(next, token) => persist(next, token)} />
        </>
      )}

      {tab === "review" && (
        <section className="card">
          <header>
            <h2>Needs a look</h2>
            <span className="muted">{household.transactions.filter((tx) => tx.potentialDuplicate && !tx.isDuplicate).length} possible duplicates</span>
          </header>
          {household.transactions.filter((tx) => tx.potentialDuplicate).slice().reverse().map((tx) => (
            <div className="row" key={tx.id}>
              <div>
                <strong>{tx.note || tx.type}</strong>
                <div className="muted">{tx.date} · {formatCad(tx.amountCents)}</div>
              </div>
              <button className="chip" onClick={() => {
                const result = markDuplicate(household, tx.id, !tx.isDuplicate);
                persist(result.household, result.undo);
              }}>
                {tx.isDuplicate ? "Include" : "Exclude"}
              </button>
            </div>
          ))}
          <button className="primary" onClick={() => {
            try {
              const result = postDueRecurrences(household, today);
              persist(result.household, result.undo);
            } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
          }}>Post due recurring</button>
        </section>
      )}

      {tab === "more" && (
        <>
          <section className="card">
            <header><h2>Health</h2><span className={`pill ${findings.length ? "warn" : "good"}`}>{findings.length ? `${findings.length} findings` : "Clean"}</span></header>
            {findings.length === 0 ? <p className="muted">Ledger, splits, transfers, shifts, and flags agree.</p> : (
              <ul className="health">{findings.map((finding) => <li key={finding.section + finding.message}><strong>{finding.section}.</strong> {finding.message}</li>)}</ul>
            )}
          </section>
          <section className="card">
            <header><h2>Household</h2></header>
            <p className="muted">{household.members.filter((m) => m.active).map((m) => m.name).join(" · ")}</p>
            <p className="muted">{household.accounts.filter((a) => a.active).map((a) => a.name).join(" · ")}</p>
            <p className="muted">{household.transactions.length} transactions · {household.shifts.length} shifts</p>
            <button className="primary" onClick={() => downloadJson(household)}>Export JSON</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => persist(seedDemoHousehold({ today, environment }))}>Reload demo data</button>
            <button className="danger" onClick={() => { localStorage.removeItem(`hearth:v1:${environment}`); setHousehold(null); }}>Reset this environment</button>
          </section>
          <AddCategoryForm household={household} onSave={(next, token) => persist(next, token)} />
        </>
      )}

      {adding && (
        <div className="sheet">
          <div className="sheet-inner">
            <div className="topbar">
              <h1>Add</h1>
              <button className="ghost" onClick={() => { setAdding(false); setConfirm(null); setError(""); }}>Close</button>
            </div>
            <div className="tabs">
              {(["expense", "income", "shift", "transfer"] as AddMode[]).map((item) => (
                <button key={item} className={mode === item ? "active" : ""} onClick={() => setMode(item)}>{item}</button>
              ))}
            </div>
            <label>Date</label>
            <input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} />
            {mode !== "shift" && mode !== "transfer" && (
              <>
                <label>Amount</label>
                <input className="amount" inputMode="decimal" placeholder="$0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                <label>Category</label>
                <div className="chips">
                  {categories.map((category) => (
                    <button key={category.id} className={`chip ${form.subcategoryId === category.id ? "selected" : ""}`} onClick={() => setForm({ ...form, subcategoryId: category.id })}>
                      {category.name}
                    </button>
                  ))}
                </div>
                <label>Who</label>
                <div className="chips">
                  {[
                    { id: JOINT, name: "Joint" },
                    ...household.members.filter((m) => m.active).map((m) => ({ id: m.id, name: m.name })),
                    { id: "split", name: "50 / 50" },
                  ].map((who) => (
                    <button key={who.id} className={`chip ${form.who === who.id ? "selected" : ""}`} onClick={() => setForm({ ...form, who: who.id })}>{who.name}</button>
                  ))}
                </div>
                <label>Account</label>
                <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <label>Note</label>
                <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="No Frills, rent, coffee…" />
              </>
            )}
            {mode === "transfer" && (
              <>
                <label>Amount</label>
                <input className="amount" inputMode="decimal" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} />
                <label>From</label>
                <select value={form.fromAccountId} onChange={(event) => setForm({ ...form, fromAccountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <label>To</label>
                <select value={form.toAccountId} onChange={(event) => setForm({ ...form, toAccountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <p className="muted">A transfer is two paired ledger rows. It never counts as income or expense.</p>
              </>
            )}
            {mode === "shift" && (
              <>
                <label>Who worked</label>
                <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}>
                  {household.members.filter((m) => m.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                </select>
                <label>Account</label>
                <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <label>Sales</label>
                <input inputMode="decimal" value={form.sales} onChange={(event) => setForm({ ...form, sales: event.target.value })} />
                <label>Hours</label>
                <input inputMode="decimal" value={form.hours} onChange={(event) => setForm({ ...form, hours: event.target.value })} />
                <label>Cash tips</label>
                <input inputMode="decimal" value={form.cashTips} onChange={(event) => setForm({ ...form, cashTips: event.target.value })} />
                <label>Credit-card tips</label>
                <input inputMode="decimal" value={form.ccTips} onChange={(event) => setForm({ ...form, ccTips: event.target.value })} />
                <div className={`preview ${shiftPreview.netTipsCents < 0 ? "warn" : ""}`}>
                  <div className="row"><span>Floor tip-out</span><span>{formatCad(shiftPreview.floorTipOutCents)}</span></div>
                  <div className="row"><span>Bar tip-out</span><span>{formatCad(shiftPreview.barTipOutCents)}</span></div>
                  <div className="row"><span>CC tip-out</span><span>{formatCad(shiftPreview.ccTipOutCents)}</span></div>
                  <div className="row"><strong>Net tips</strong><strong>{formatCad(shiftPreview.netTipsCents)}</strong></div>
                  <div className="row"><strong>Wages</strong><strong>{formatCad(shiftPreview.wagesCents)}</strong></div>
                  <p className="muted">This preview is the same function that posts the two income rows.</p>
                </div>
              </>
            )}
            {error && <p className="danger" style={{ marginTop: 12 }}>{error}</p>}
            {confirm && (
              <div className="preview warn">
                <p>{confirm.message}</p>
                <button className="primary" onClick={() => submit(true)}>Add anyway</button>
              </div>
            )}
            <button className="primary" disabled={busy} onClick={() => submit(false)}>Save</button>
          </div>
        </div>
      )}

      {toast && (
        <div className="toast">
          <span>Saved. You can undo this.</span>
          <button className="ghost" style={{ color: "var(--paper)" }} onClick={() => {
            persist(undo(household, toast));
            setToast(null);
          }}>Undo</button>
        </div>
      )}

      {commandOpen && (
        <div className="cmdk" onClick={() => setCommandOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <input autoFocus placeholder="Jump to add, plan, health…" onKeyDown={(event) => {
              if (event.key === "Enter") setCommandOpen(false);
            }} />
            {[
              { label: "Add expense", run: () => { setMode("expense"); setAdding(true); } },
              { label: "Add shift", run: () => { setMode("shift"); setAdding(true); } },
              { label: "Move money", run: () => { setMode("transfer"); setAdding(true); } },
              { label: "Plan", run: () => setTab("plan") },
              { label: "Health", run: () => setTab("more") },
              { label: "Export", run: () => downloadJson(household) },
            ].map((item) => (
              <button key={item.label} onClick={() => { item.run(); setCommandOpen(false); }}>{item.label}</button>
            ))}
          </div>
        </div>
      )}

      <nav className="nav">
        <button className={tab === "home" && !adding ? "active" : ""} onClick={() => { setTab("home"); setAdding(false); }}>Home</button>
        <button className={tab === "plan" ? "active" : ""} onClick={() => { setTab("plan"); setAdding(false); }}>Plan</button>
        <button className="fab" onClick={() => { setAdding(true); setError(""); setConfirm(null); }}>+</button>
        <button className={tab === "review" ? "active" : ""} onClick={() => { setTab("review"); setAdding(false); }}>Review</button>
        <button className={tab === "more" ? "active" : ""} onClick={() => { setTab("more"); setAdding(false); }}>More</button>
      </nav>
    </div>
  );
}

function SitDown({ household, onApply }: { household: Household; onApply: (household: Household, undo?: UndoToken) => void }) {
  const monthKey = monthKeyFromDateKey(todayKey());
  const preview = sitDownPreview(household, monthKey);
  return (
    <section className="card">
      <header><h2>Sit-down</h2><span className="muted">Copy {preview.sourceMonth} into {preview.targetMonth}</span></header>
      <p className="muted">Overspent categories get a midpoint suggestion. Nothing is written until you apply.</p>
      <button className="primary" onClick={() => {
        const result = applySitDown(household, preview.sourceMonth, {});
        onApply(result.household, result.undo);
      }}>Apply next month’s plan</button>
    </section>
  );
}

function Goals({ household, onChange }: { household: Household; onChange: (household: Household, undo?: UndoToken) => void }) {
  const [name, setName] = useState("New goal");
  const [target, setTarget] = useState("500");
  return (
    <section className="card">
      <header><h2>All goals</h2></header>
      {household.goals.map((goal) => (
        <div className="row" key={goal.id}>
          <div>
            <strong>{goal.name}</strong>
            <div className="muted">{goal.shared ? "Shared" : "Personal filter only"} · {formatCad(goal.savedCents)} / {formatCad(goal.targetCents)}</div>
          </div>
          <button className="chip" onClick={() => {
            const result = contributeToGoal(household, goal.id, "50");
            onChange(result.household, result.undo);
          }}>+ $50</button>
        </div>
      ))}
      <label>New goal</label>
      <input value={name} onChange={(event) => setName(event.target.value)} />
      <input value={target} onChange={(event) => setTarget(event.target.value)} />
      <button className="primary" onClick={() => {
        const result = addGoal(household, { name, target, shared: true });
        onChange(result.household, result.undo);
      }}>Add shared goal</button>
    </section>
  );
}

function AddCategoryForm({ household, onSave }: { household: Household; onSave: (household: Household, undo?: UndoToken) => void }) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState("CAT-LIFE");
  const [error, setError] = useState("");
  return (
    <section className="card">
      <header><h2>Add category</h2></header>
      <p className="muted">Same commit bar as money: one save creates the category and can seed this month’s budget.</p>
      <input value={name} placeholder="Name" onChange={(event) => setName(event.target.value)} />
      <select value={parentId} onChange={(event) => setParentId(event.target.value)}>
        {household.categories.filter((c) => c.recordType === "group" && c.transactionType === "expense").map((group) => (
          <option key={group.id} value={group.id}>{group.name}</option>
        ))}
      </select>
      {error && <p className="muted">{error}</p>}
      <button className="primary" onClick={() => {
        try {
          const result = addCategory(household, { name, type: "expense", parentId, monthlyBudget: "0" });
          onSave(result.household, result.undo);
          setName("");
          setError("");
        } catch (caught) {
          setError(caught instanceof ValidationError ? caught.message : String(caught));
        }
      }}>Save category</button>
    </section>
  );
}
