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
  defaultVisibilityForView,
  formatCad,
  formatDateLabel,
  formatInviteCode,
  householdForView,
  jointSplit,
  monthKeyFromDateKey,
  parseAmount,
  percentSplits,
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
  type LedgerView,
  type Split,
  type UndoToken,
  type Visibility,
} from "./core/index.ts";
import { LedgerPage } from "./Ledger.tsx";
import { STORAGE_EXPLAINER, clearHousehold, downloadJson, loadHousehold, saveHousehold } from "./storage.ts";
import { clearSession, loadSession, saveSession, type Session } from "./session.ts";
import { createSharedHousehold, hostingHint, joinSharedHousehold, reconcileHousehold, pushSharedHousehold } from "./api.ts";

type Tab = "home" | "plan" | "ledger" | "more";
type AddMode = "expense" | "income" | "shift" | "transfer";

const emptyForm = {
  date: todayKey(),
  amount: "",
  accountId: "ACC-VISA",
  subcategoryId: "SUB-FOOD-GROCERIES",
  note: "",
  place: "",
  who: JOINT as string,
  fromAccountId: "ACC-CHEQUING",
  toAccountId: "ACC-VISA",
  memberId: "MEM-002",
  sales: "0",
  cashTips: "0",
  ccTips: "0",
  hours: "4",
  visibility: "household" as Visibility,
};

export function App() {
  const [environment, setEnvironment] = useState<Environment>("development");
  const [household, setHousehold] = useState<Household | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [adding, setAdding] = useState(false);
  const [mode, setMode] = useState<AddMode>("expense");
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<NeedsConfirmationError | null>(null);
  const [toast, setToast] = useState<UndoToken | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [splitPercents, setSplitPercents] = useState<Record<string, number>>({ "MEM-001": 50, "MEM-002": 50 });
  const [now] = useState(() => new Date());
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [inviteInput, setInviteInput] = useState("");
  const [welcomeMode, setWelcomeMode] = useState<"home" | "join">("home");

  useEffect(() => {
    let live = true;
    setBooting(true);
    const loadedSession = loadSession(environment);
    setSession(loadedSession);
    loadHousehold(environment).then(async (loaded) => {
      if (!live) return;
      if (loaded?.linked && loadedSession?.memberId) {
        try {
          const reconciled = await reconcileHousehold(loaded, loadedSession.memberId);
          if (!live) return;
          await saveHousehold(reconciled);
          setHousehold(reconciled);
        } catch {
          if (!live) return;
          setHousehold(loaded);
        }
      } else {
        setHousehold(loaded);
      }
      setBooting(false);
    });
    return () => { live = false; };
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
  const memberId = session?.memberId ?? household?.members.find((member) => member.active)?.id ?? "";
  const view: LedgerView = session?.view ?? "household";
  const visible = household && memberId ? householdForView(household, memberId, view) : household;
  const findings = useMemo(() => (household ? runHealthCheck(household) : []), [household]);
  const dashboard = useMemo(
    () => (visible ? buildDashboard(visible, today, now, findings.length) : null),
    [visible, today, now, findings.length],
  );

  function rememberSession(next: Session) {
    setSession(next);
    saveSession(environment, next);
  }

  async function persist(next: Household, token?: UndoToken, actorId?: string) {
    await saveHousehold(next);
    setHousehold(next);
    if (token) {
      setToast(token);
      window.setTimeout(() => setToast((current) => (current?.id === token.id ? null : current)), 8000);
    }
    const who = actorId || session?.memberId;
    if (next.linked && who) {
      setSyncState("syncing");
      try {
        const merged = await pushSharedHousehold(next, who);
        await saveHousehold(merged);
        setHousehold(merged);
        setSyncState("synced");
      } catch (caught) {
        setSyncState("error");
        setError(caught instanceof Error ? caught.message : "Saved on this phone. Shared sync can retry from More.");
      }
    }
  }

  async function run(fn: () => CommitResult) {
    if (!household || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = fn();
      await persist(result.household, result.undo);
      setConfirm(null);
      setAdding(false);
      setForm({ ...emptyForm, date: today, visibility: defaultVisibilityForView(view) });
      if (result.warnings.length) setError(result.warnings.join(" "));
    } catch (caught) {
      if (caught instanceof NeedsConfirmationError) setConfirm(caught);
      else setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  if (booting) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">On this device</p>
          <h1>Opening the ledger…</h1>
        </div>
      </div>
    );
  }

  if (!household) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">Toronto · CAD · two people</p>
          <img src="/icon.png" alt="" />
          <h1>Hearth</h1>
          <p>
            Jonathan and Bianca each get a household ledger and a personal ledger.
            Every entry can be shared, personal, or both. Shared rows live in one
            database you both open with a household code.
          </p>
          {welcomeMode === "join" ? (
            <>
              <label>Household code</label>
              <input
                value={inviteInput}
                onChange={(event) => setInviteInput(event.target.value)}
                placeholder="ABC-123"
                autoCapitalize="characters"
              />
              <p className="muted">{hostingHint()}</p>
              {error && <p className="danger">{error}</p>}
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const joined = await joinSharedHousehold(inviteInput);
                    await persist(joined);
                    setWelcomeMode("home");
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : String(caught));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Join household
              </button>
              <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => { setWelcomeMode("home"); setError(""); }}>
                Back
              </button>
            </>
          ) : (
            <>
              <button className="primary" onClick={() => persist(seedDemoHousehold({ today, environment }))}>
                Open the demo kitchen table
              </button>
              <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => persist(catalogHousehold(environment))}>
                Start our household
              </button>
              <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setWelcomeMode("join")}>
                Join with a code
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">Who is using this phone?</p>
          <h1>Choose yourself</h1>
          <p>Household numbers are shared. Personal rows stay on your ledger. Use your own phone if you want that split to hold.</p>
          {household.members.filter((member) => member.active).map((member) => (
            <button
              key={member.id}
              className="primary"
              style={{ marginTop: 8 }}
              onClick={() => {
                const next = { memberId: member.id, view: "household" as const };
                rememberSession(next);
                if (household.linked) {
                  void (async () => {
                    try {
                      const pulled = await joinSharedHousehold(household.inviteCode, member.id);
                      await persist(pulled, undefined, member.id);
                    } catch {
                      // Catalog is enough to start; Sync now can retry.
                    }
                  })();
                }
              }}
            >
              I am {member.name}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const ledger = household;
  const actorId = session.memberId;
  const categories = ledger.categories.filter((category) => category.recordType === "category" && category.active && category.transactionType === (mode === "income" ? "income" : "expense"));
  const shiftPreview = calcShiftAmounts({
    salesCents: Math.round(Number(form.sales || 0) * 100) || 0,
    cashTipsCents: Math.round(Number(form.cashTips || 0) * 100) || 0,
    ccTipsCents: Math.round(Number(form.ccTips || 0) * 100) || 0,
    hours: Number(form.hours || 0) || 0,
  }, ledger.shiftSettings);

  function splitsFor(amountCents: number): Split[] {
    const members = ledger.members.filter((member) => member.active);
    if (form.who === "split") {
      return percentSplits(members.map((member) => ({
        party: member.id,
        percent: Number(splitPercents[member.id] ?? 0),
      })), amountCents);
    }
    if (form.who === JOINT) return jointSplit(amountCents);
    return [{ party: form.who, amountCents }];
  }

  function setMemberPercent(memberId: string, percent: number) {
    const members = ledger.members.filter((member) => member.active);
    const clamped = Math.max(0, Math.min(100, percent));
    if (members.length === 2) {
      const other = members.find((member) => member.id !== memberId);
      if (!other) return;
      setSplitPercents({ [memberId]: clamped, [other.id]: Math.round((100 - clamped) * 100) / 100 });
      return;
    }
    setSplitPercents({ ...splitPercents, [memberId]: clamped });
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
        createdBy: actorId,
        visibility: form.visibility,
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
        createdBy: actorId,
        visibility: form.visibility,
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
      place: form.place,
      splits: splitsFor(parseAmount(form.amount)),
      confirmDuplicate,
      createdBy: actorId,
      visibility: form.visibility,
    }));
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/icon.png" alt="" />
          <div>
            <h1>Hearth</h1>
            <p>
              {household.members.find((member) => member.id === session.memberId)?.name}
              {" · "}
              {view === "personal" ? "personal" : "household"}
              {" · "}
              {today}
            </p>
          </div>
        </div>
        <button className={`pill ${environment === "development" ? "dev" : "prod"}`} onClick={() => setEnvironment(environment === "development" ? "production" : "development")}>
          {environment === "development" ? "Development" : "Production"}
        </button>
      </header>
      <div className="view-switch" role="tablist" aria-label="Ledger view">
        {(["household", "personal"] as LedgerView[]).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => rememberSession({ memberId: session.memberId, view: item })}
          >
            {item === "household" ? "Household" : "Personal"}
          </button>
        ))}
      </div>

      {tab === "home" && dashboard && (
        <>
          <section className="hero">
            <div className="label">{view === "personal" ? "Personal" : "Household"} · {dashboard.monthLabel}</div>
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
            <header><h2>Goals</h2><span className="muted">{view === "personal" ? "personal" : "shared sit on Home"}</span></header>
            {dashboard.goals.map((item) => (
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
          <SitDown household={household} onApply={(next, token) => persist(next, token)} hidden={view === "personal"} />
          <Goals household={household} goals={visible?.goals ?? household.goals} onChange={(next, token) => persist(next, token)} />
        </>
      )}

      {tab === "ledger" && (
        <LedgerPage household={household} memberId={session.memberId} view={view} onChange={(next, token) => { void persist(next, token); }} />
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
            <header>
              <h2>Household</h2>
              <span className={`pill ${household.linked ? "good" : ""}`}>{household.linked ? "Shared" : "This phone"}</span>
            </header>
            <p>
              You are {household.members.find((member) => member.id === session.memberId)?.name}.
              Household view shows shared and “both” rows. Personal view shows your personal and “both” rows.
              The other person’s personal rows stay in their personal database.
            </p>
            <label>This phone is</label>
            <div className="chips">
              {household.members.filter((member) => member.active).map((member) => (
                <button
                  key={member.id}
                  className={`chip ${session.memberId === member.id ? "selected" : ""}`}
                  onClick={() => rememberSession({ memberId: member.id, view })}
                >
                  {member.name}
                </button>
              ))}
            </div>
            <div className="invite-code">{formatInviteCode(household.inviteCode)}</div>
            <p className="muted">Give Bianca or Jonathan this code to join the same household. {hostingHint()}</p>
            {syncState === "syncing" && <p className="muted">Syncing the shared household…</p>}
            {syncState === "synced" && <p className="muted">Shared household is up to date.</p>}
            {syncState === "error" && <p className="danger">Last sync did not reach the shared database. Rows are still saved here.</p>}
            <button className="ghost" style={{ width: "100%" }} onClick={() => {
              void navigator.clipboard?.writeText(formatInviteCode(household.inviteCode));
            }}>Copy household code</button>
            {!household.linked && (
              <button className="primary" disabled={busy} onClick={() => {
                void (async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const created = await createSharedHousehold(household, session.memberId);
                    await persist(created);
                    setSyncState("synced");
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : String(caught));
                    setSyncState("error");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}>Create shared household</button>
            )}
            {household.linked && (
              <button className="primary" disabled={busy} onClick={() => {
                void (async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const merged = await reconcileHousehold(household, session.memberId);
                    const pushed = await pushSharedHousehold(merged, session.memberId);
                    await persist(pushed);
                    setSyncState("synced");
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : String(caught));
                    setSyncState("error");
                  } finally {
                    setBusy(false);
                  }
                })();
              }}>Sync now</button>
            )}
            <label>Join a different household</label>
            <input value={inviteInput} onChange={(event) => setInviteInput(event.target.value)} placeholder="ABC-123" autoCapitalize="characters" />
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => {
              void (async () => {
                setBusy(true);
                setError("");
                try {
                  const joined = await joinSharedHousehold(inviteInput, session.memberId);
                  await persist(joined);
                  setSyncState("synced");
                } catch (caught) {
                  setError(caught instanceof Error ? caught.message : String(caught));
                } finally {
                  setBusy(false);
                }
              })();
            }}>Join with this code</button>
          </section>
          <section className="card storage">
            <header><h2>Where the ledger lives</h2></header>
            <p>
              This phone keeps a full working copy in IndexedDB (<code>{STORAGE_EXPLAINER.database}</code>, store <code>{STORAGE_EXPLAINER.store}</code>)
              with a {STORAGE_EXPLAINER.backup} fallback. When the household is shared, household and “both”
              rows go to the shared database; your personal-only rows go to your personal database.
              Development and Production are two keys on this device. Export JSON is the file backup.
              Personal rows are a filter, not a lock — use two phones for a real split.
            </p>
            <button className="primary" onClick={() => downloadJson(household)}>Export JSON</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => persist(seedDemoHousehold({ today, environment }))}>Reload demo data</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => {
              try {
                const result = postDueRecurrences(household, today);
                void persist(result.household, result.undo);
              } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
            }}>Post due recurring</button>
            <button className="danger" onClick={() => {
              void clearHousehold(environment).then(() => {
                clearSession(environment);
                setSession(null);
                setHousehold(null);
              });
            }}>Reset this environment</button>
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
            <label>Save to</label>
            <div className="chips">
              {([
                { id: "household" as Visibility, name: "Shared" },
                { id: "personal" as Visibility, name: "Personal" },
                { id: "both" as Visibility, name: "Both" },
              ]).map((item) => (
                <button
                  key={item.id}
                  className={`chip ${form.visibility === item.id ? "selected" : ""}`}
                  onClick={() => setForm({ ...form, visibility: item.id })}
                >
                  {item.name}
                </button>
              ))}
            </div>
            <p className="muted">
              Shared is the household database. Personal stays on your ledger. Both writes one row that appears in each.
            </p>
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
                    { id: "split", name: "Split %" },
                  ].map((who) => (
                    <button key={who.id} className={`chip ${form.who === who.id ? "selected" : ""}`} onClick={() => setForm({ ...form, who: who.id })}>{who.name}</button>
                  ))}
                </div>
                {form.who === "split" && (
                  <div className="split-card">
                    <p className="muted">Bianca can set any split. The other person’s share fills in so the cents add to 100%.</p>
                    {household.members.filter((member) => member.active).map((member) => {
                      const percent = splitPercents[member.id] ?? 0;
                      let share = "";
                      try {
                        if (form.amount) share = formatCad(Math.round(parseAmount(form.amount) * percent / 100));
                      } catch {
                        share = "";
                      }
                      return (
                        <div className="row" key={member.id}>
                          <span>{member.name}</span>
                          <span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={1}
                              value={percent}
                              onChange={(event) => setMemberPercent(member.id, Number(event.target.value))}
                            /> %
                            <span className="muted"> {share}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <label>Account</label>
                <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
                </select>
                <label>Place / location</label>
                <input value={form.place} onChange={(event) => setForm({ ...form, place: event.target.value })} placeholder="No Frills, Union Station, home…" />
                <label>Note</label>
                <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Groceries, rent, coffee…" />
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
                {confirm.matches.map((tx) => (
                  <div className="row" key={tx.id}>
                    <span>{tx.date} · {tx.place || tx.note || tx.type}</span>
                    <span>{formatCad(tx.amountCents)}</span>
                  </div>
                ))}
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
              { label: "Ledger", run: () => setTab("ledger") },
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
        <button className="fab" onClick={() => {
          setAdding(true);
          setError("");
          setConfirm(null);
          setForm({ ...emptyForm, date: today, visibility: defaultVisibilityForView(view), memberId: session.memberId });
        }}>+</button>
        <button className={tab === "ledger" ? "active" : ""} onClick={() => { setTab("ledger"); setAdding(false); }}>Ledger</button>
        <button className={tab === "more" ? "active" : ""} onClick={() => { setTab("more"); setAdding(false); }}>More</button>
      </nav>
    </div>
  );
}

function SitDown({ household, onApply, hidden }: { household: Household; onApply: (household: Household, undo?: UndoToken) => void; hidden?: boolean }) {
  if (hidden) {
    return (
      <section className="card">
        <header><h2>Sit-down</h2></header>
        <p className="muted">Monthly budgets live on the household view so both of you plan from the same numbers.</p>
      </section>
    );
  }
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

function Goals({ household, goals, onChange }: { household: Household; goals: Household["goals"]; onChange: (household: Household, undo?: UndoToken) => void }) {
  const [name, setName] = useState("New goal");
  const [target, setTarget] = useState("500");
  return (
    <section className="card">
      <header><h2>Goals in this view</h2></header>
      {goals.map((goal) => (
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
