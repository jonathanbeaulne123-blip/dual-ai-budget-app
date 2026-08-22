import { useEffect, useMemo, useRef, useState } from "react";
import {
  JOINT,
  NeedsConfirmationError,
  ValidationError,
  addCategory,
  addFormDefaults,
  addGoal,
  applySitDown,
  auditOpinion,
  buildDashboard,
  calcShiftAmounts,
  catalogHousehold,
  contributeToGoal,
  createWriteQueue,
  creditCardView,
  defaultVisibilityForView,
  findActiveGoogleLinkByEmail,
  findActiveGoogleLinkBySubject,
  formatCad,
  formatDateLabel,
  householdForView,
  accountOptionLabel,
  jointSplit,
  memberNeedsGoogleStepUp,
  monthKeyFromDateKey,
  parseAmount,
  percentSplits,
  postDueRecurrences,
  postEntry,
  postOneRecurrence,
  postShift,
  postTransfer,
  readClinkOn,
  runHealthCheck,
  seedDemoHousehold,
  shiftSettingsFingerprint,
  sitDownPreview,
  todayKey,
  touchGoogleConfirmation,
  touchVisitSpark,
  undo,
  voidPostedMoney,
  type CommitResult,
  type Environment,
  type Household,
  type LedgerView,
  type Split,
  type UndoToken,
  type Visibility,
  type Account,
} from "./core/index.ts";
import { STORAGE_EXPLAINER, clearHousehold, downloadJson, loadHousehold, saveHousehold } from "./storage.ts";
import { clearSession, loadSession, saveSession, type Session } from "./session.ts";
import { joinSharedHousehold, pushSharedHousehold, reconcileHousehold } from "./api.ts";
import { inviteFromLocation } from "./core/invite.ts";
import { PairingCard, WelcomeJoin } from "./Pairing.tsx";
import { BooksPage } from "./Books.tsx";
import { ConfirmSheet } from "./Confirm.tsx";
import { CalendarPage } from "./Calendar.tsx";
import { DailyHearth } from "./DailyHearth.tsx";
import { HerculesPresence } from "./Hercules.tsx";
import { WalletStrip } from "./Accounts.tsx";
import { playClink } from "./clink.ts";
import { GoogleBridgeCard } from "./GoogleBridge.tsx";
import {
  adoptGoogleSession,
  confirmWithGoogleIfLinked,
  connectGoogle,
  disconnectGoogle,
  googleConfigured,
} from "./google/index.ts";
import { syncHouseholdBooks, type BooksStatus } from "./ledger/engine.ts";

type Tab = "home" | "plan" | "calendar" | "ledger" | "more";
type AddMode = "expense" | "income" | "shift" | "transfer";
type Guard =
  | { kind: "reset" }
  | { kind: "environment"; next: Environment }
  | { kind: "demo" }
  | { kind: "remove"; transactionId: string; summary: string }
  | { kind: "postRecurrence"; recurrenceId: string; summary: string }
  | { kind: "postDueAll"; summary: string };

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
  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<NeedsConfirmationError | null>(null);
  const [toast, setToast] = useState<UndoToken | null>(null);
  const [history, setHistory] = useState<UndoToken[]>([]);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [commandOpen, setCommandOpen] = useState(false);
  const [splitPercents, setSplitPercents] = useState<Record<string, number>>({ "MEM-001": 50, "MEM-002": 50 });
  const [now] = useState(() => new Date());
  const [session, setSession] = useState<Session | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [inviteInput, setInviteInput] = useState("");
  const [welcomeMode, setWelcomeMode] = useState<"home" | "join">("home");
  const [booksStatus, setBooksStatus] = useState<BooksStatus | null>(null);
  const [spark, setSpark] = useState(false);
  const [visorPop, setVisorPop] = useState(false);
  const [clinkOn, setClinkOn] = useState(false);
  const enqueueWrite = useMemo(() => createWriteQueue(), []);
  const householdRef = useRef<Household | null>(household);
  householdRef.current = household;
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    const token = inviteFromLocation(window.location.href);
    if (!token) return;
    setInviteInput(token);
    setWelcomeMode("join");
    const url = new URL(window.location.href);
    url.searchParams.delete("join");
    const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
    window.history.replaceState({}, "", next);
  }, []);

  useEffect(() => {
    let live = true;
    setBooting(true);
    const loadedSession = loadSession(environment);
    setSession(loadedSession);
    loadHousehold(environment).then(async (loaded) => {
      if (!live) return;
      let current = loaded;
      if (loaded?.linked && loadedSession?.memberId) {
        try {
          const reconciled = await reconcileHousehold(loaded, loadedSession.memberId);
          if (!live) return;
          await saveHousehold(reconciled);
          current = reconciled;
        } catch {
          if (!live) return;
        }
      }
      setHousehold(current);
      if (current) {
        void syncHouseholdBooks(current)
          .then(({ status }) => { if (live) setBooksStatus(status); })
          .catch((caught) => {
            if (!live) return;
            setBooksStatus({
              ok: false,
              engine: "pglite",
              entryCount: 0,
              inBalance: false,
              equationHolds: false,
              error: caught instanceof Error ? caught.message : String(caught),
            });
          });
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

  useEffect(() => {
    if (!household) return;
    touchVisitSpark(environment, todayKey());
    setClinkOn(readClinkOn(environment));
  }, [environment, household?.householdId]);

  const today = todayKey(now);
  const memberId = session?.memberId ?? household?.members.find((member) => member.active)?.id ?? "";
  const view: LedgerView = session?.view ?? "household";
  const visible = household && memberId ? householdForView(household, memberId, view) : household;
  const findings = useMemo(() => (household ? runHealthCheck(household) : []), [household]);
  const dashboard = useMemo(
    () => (visible ? buildDashboard(visible, today, now, findings.length) : null),
    [visible, today, now, findings.length],
  );
  const opinion = useMemo(() => (household ? auditOpinion(household) : null), [household]);

  function rememberSession(next: Session) {
    setSession(next);
    saveSession(environment, next);
  }

  async function commitHousehold(next: Household, token?: UndoToken, actorId?: string) {
    setBusy(true);
    try {
      await saveHousehold(next);
      setHousehold(next);
      if (token) {
        setToast(token);
        setHistory((current) => [...current, token].slice(-20));
        window.setTimeout(() => setToast((item) => (item?.id === token.id ? null : item)), 8000);
      }
      const who = actorId || session?.memberId;
      let stored = next;
      if (next.linked && who) {
        setSyncState("syncing");
        try {
          stored = await pushSharedHousehold(next, who);
          await saveHousehold(stored);
          setHousehold(stored);
          setSyncState("synced");
        } catch (caught) {
          setSyncState("error");
          setError(caught instanceof Error ? caught.message : "Saved on this phone. Shared sync can retry from More.");
        }
      }
      try {
        setBooksStatus((await syncHouseholdBooks(stored)).status);
      } catch (caught) {
        setBooksStatus({
          ok: false,
          engine: "pglite",
          entryCount: 0,
          inBalance: false,
          equationHolds: false,
          error: caught instanceof Error ? caught.message : String(caught),
        });
      }
    } finally {
      setBusy(false);
    }
  }

  function persist(next: Household, token?: UndoToken, actorId?: string) {
    return enqueueWrite(() => commitHousehold(next, token, actorId));
  }

  async function gateWithGoogle(options?: { record?: boolean }) {
    const current = householdRef.current;
    const who = session?.memberId;
    if (!current || !who) return;
    const result = await confirmWithGoogleIfLinked({
      household: current,
      environment,
      memberId: who,
    });
    if (result.kind === "confirmed" && options?.record !== false) {
      const latest = householdRef.current ?? current;
      const touched = touchGoogleConfirmation(latest, who);
      await commitHousehold(touched.household, touched.undo);
    }
  }

  function applyUndo(token: UndoToken) {
    return enqueueWrite(async () => {
      const current = householdRef.current;
      if (!current) return;
      const latest = historyRef.current[historyRef.current.length - 1];
      if (latest && latest.id !== token.id) {
        setError("Undo the latest change first so the books stay in order.");
        return;
      }
      await commitHousehold(undo(current, token));
      setHistory((items) => items.filter((item) => item.id !== token.id));
      setToast((item) => (item?.id === token.id ? null : item));
    });
  }

  function run(fn: (current: Household) => CommitResult) {
    return enqueueWrite(async () => {
      const current = householdRef.current;
      if (!current) return;
      setError("");
      try {
        const result = fn(current);
        await commitHousehold(result.household, result.undo);
        setConfirm(null);
        setAdding(false);
        setForm({
          ...emptyForm,
          date: today,
          visibility: defaultVisibilityForView(view),
          ...addFormDefaults(result.household, focusedAccountId),
        });
        if (result.warnings.length) setError(result.warnings.join(" "));
        if (result.postedIds.some((id) => /^(TXN|SHF)/.test(id))) {
          setSpark(true);
          window.setTimeout(() => setSpark(false), 900);
          if (readClinkOn(environment)) playClink();
        }
        if (result.household.activity.at(-1)?.action === "Post Recurring") {
          setVisorPop(true);
          window.setTimeout(() => setVisorPop(false), 700);
        }
      } catch (caught) {
        if (caught instanceof NeedsConfirmationError) setConfirm(caught);
        else setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function runKitchen(fn: (current: Household) => CommitResult) {
    return enqueueWrite(async () => {
      const current = householdRef.current;
      if (!current) return;
      try {
        const result = fn(current);
        await commitHousehold(result.household, result.undo);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
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
            Every entry can be shared, personal, or both. The books are a double-entry
            PostgreSQL journal on this phone — not a blob of JSON pretending to be a database.
          </p>
          {welcomeMode === "join" ? (
            <WelcomeJoin
              error={error}
              busy={busy}
              environment={environment}
              inviteInput={inviteInput}
              onInviteInput={setInviteInput}
              onError={setError}
              onBusy={setBusy}
              onJoined={(next) => persist(next)}
              onBack={() => { setWelcomeMode("home"); setError(""); }}
            />
          ) : (
            <>
              <button className="primary" onClick={() => persist(seedDemoHousehold({ today, environment }))}>
                Open the demo kitchen table
              </button>
              <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => persist(catalogHousehold(environment))}>
                Start our household
              </button>
              <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setWelcomeMode("join")}>
                Join with a phrase or pass
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
          {googleConfigured() && (
            <button
              className="ghost"
              style={{ width: "100%", marginBottom: 8 }}
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  setError("");
                  try {
                    const session = await connectGoogle({
                      environment,
                      memberId: "__welcome__",
                      services: ["identity"],
                      selectAccount: true,
                    });
                    const link = findActiveGoogleLinkByEmail(household, session.identity.email)
                      || findActiveGoogleLinkBySubject(household, session.identity.subject);
                    if (!link) {
                      disconnectGoogle(environment, "__welcome__");
                      setError("That Google account is not linked to anyone here yet. Choose yourself, then connect in More → Google household bridge.");
                      return;
                    }
                    adoptGoogleSession(environment, "__welcome__", link.memberId);
                    rememberSession({ memberId: link.memberId, view: "household" });
                    if (household.linked) {
                      try {
                        const pulled = await joinSharedHousehold(household.inviteCode, link.memberId, household.environment);
                        await persist(pulled, undefined, link.memberId);
                      } catch {
                        // Catalog is enough to start; Sync now can retry.
                      }
                    }
                  } catch (caught) {
                    setError(caught instanceof Error ? caught.message : String(caught));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Continue with Google
            </button>
          )}
          {error && <p className="danger">{error}</p>}
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
                      const pulled = await joinSharedHousehold(household.inviteCode, member.id, household.environment);
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
  const googleStepUpExtra = googleConfigured() && memberNeedsGoogleStepUp(household, session.memberId)
    ? "Because your Google account is linked, Google will ask you to confirm it is you first."
    : undefined;
  const categories = ledger.categories.filter((category) => category.recordType === "category" && category.active && category.transactionType === (mode === "income" ? "income" : "expense"));
  const shiftPreview = calcShiftAmounts({
    salesCents: Math.round(Number(form.sales || 0) * 100) || 0,
    cashTipsCents: Math.round(Number(form.cashTips || 0) * 100) || 0,
    ccTipsCents: Math.round(Number(form.ccTips || 0) * 100) || 0,
    hours: Number(form.hours || 0) || 0,
  }, ledger.shiftSettings);

  const formForAccount = (accountId: string | null, extra: Partial<typeof emptyForm> = {}) => {
    const defaults = addFormDefaults(ledger, accountId);
    return {
      ...emptyForm,
      date: today,
      visibility: defaultVisibilityForView(view),
      memberId: actorId,
      accountId: defaults.accountId,
      fromAccountId: defaults.fromAccountId,
      toAccountId: defaults.toAccountId,
      ...extra,
    };
  };

  const openAddFor = (account: Account | null, nextMode?: AddMode) => {
    const id = account?.id ?? focusedAccountId;
    const defaults = addFormDefaults(ledger, id);
    setFocusedAccountId(id);
    setMode(nextMode ?? defaults.suggestedMode);
    setAdding(true);
    setError("");
    setConfirm(null);
    setForm(formForAccount(id));
  };

  const openPayCard = (account: Account) => {
    const card = creditCardView(ledger, account, today);
    const remaining = Math.max(0, card.statementBalanceCents - card.paidSinceStatementCents);
    const amount = remaining > 0 ? remaining : card.minPaymentCents;
    setFocusedAccountId(account.id);
    setMode("transfer");
    setAdding(true);
    setError("");
    setConfirm(null);
    setForm(formForAccount(account.id, {
      amount: amount ? (amount / 100).toFixed(2) : "",
      note: `${account.name} payment`,
    }));
  };

  const openWallet = (accountId: string) => {
    setFocusedAccountId(accountId);
    setTab("ledger");
    setAdding(false);
  };

  function splitsFor(amountCents: number, from: Household): Split[] {
    const members = from.members.filter((member) => member.active);
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

  function submit(flags: { confirmDuplicate?: boolean; confirmClosedMonth?: boolean } = {}) {
    run((current) => {
      if (mode === "transfer") {
        return postTransfer(current, {
          date: form.date,
          amount: form.amount,
          fromAccountId: form.fromAccountId,
          toAccountId: form.toAccountId,
          note: form.note,
          confirmDuplicate: flags.confirmDuplicate,
          confirmClosedMonth: flags.confirmClosedMonth,
          createdBy: actorId,
          visibility: form.visibility,
        });
      }
      if (mode === "shift") {
        return postShift(current, {
          date: form.date,
          memberId: form.memberId,
          accountId: form.accountId,
          sales: form.sales,
          cashTips: form.cashTips,
          ccTips: form.ccTips,
          hours: form.hours,
          settingsFingerprint: shiftSettingsFingerprint(current.shiftSettings),
          confirmDuplicate: flags.confirmDuplicate,
          confirmClosedMonth: flags.confirmClosedMonth,
          createdBy: actorId,
          visibility: form.visibility,
        });
      }
      return postEntry(current, {
        date: form.date,
        type: mode,
        amount: form.amount,
        accountId: form.accountId,
        subcategoryId: form.subcategoryId,
        note: form.note,
        place: form.place,
        splits: splitsFor(parseAmount(form.amount), current),
        confirmDuplicate: flags.confirmDuplicate,
        confirmClosedMonth: flags.confirmClosedMonth,
        createdBy: actorId,
        visibility: form.visibility,
      });
    });
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
        <button className={`pill ${environment === "development" ? "dev" : "prod"}`} onClick={() => setGuard({
          kind: "environment",
          next: environment === "development" ? "production" : "development",
        })}>
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
          <DailyHearth
            household={household}
            memberId={session.memberId}
            today={today}
            busy={busy}
            environment={environment}
            clinkOn={clinkOn}
            onClinkOn={setClinkOn}
            onCommand={(fn) => { void run(fn); }}
            onBuyNote={(text) => {
              setMode("expense");
              setAdding(true);
              setError("");
              setConfirm(null);
              setForm({
                ...formForAccount(focusedAccountId),
                date: today,
                note: text.slice(0, 80),
                subcategoryId: "SUB-FOOD-GROCERIES",
                visibility: defaultVisibilityForView(view),
                memberId: session.memberId,
              });
            }}
          />
          <section className="hero">
            <div className="label">{view === "personal" ? "Personal" : "Household"} · {dashboard.monthLabel}</div>
            <div className={`money ${dashboard.month.netActualCents < 0 ? "negative" : ""}`}>{formatCad(dashboard.month.netActualCents)}</div>
            <div className="sub">
              {formatCad(dashboard.month.incomeActualCents)} in · {formatCad(dashboard.month.expenseActualCents)} out
              {" · "}
              {dashboard.stale ? "numbers need a look" : "fresh"}
              {opinion ? ` · ${opinion.kind} opinion` : ""}
            </div>
          </section>
          <WalletStrip
            household={household}
            today={today}
            focusedId={focusedAccountId}
            onOpen={openWallet}
          />
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
          {dashboard.upcoming.length > 0 && (
            <section className="card" role="button" tabIndex={0} onClick={() => setTab("calendar")} onKeyDown={(event) => { if (event.key === "Enter") setTab("calendar"); }}>
              <header>
                <h2>Money dates</h2>
                <span className="muted">{dashboard.detectedBills ? `${dashboard.detectedBills} spotted` : "Calendar"}</span>
              </header>
              {dashboard.upcoming.slice(0, 4).map((item) => (
                <div className="row" key={item.id}>
                  <span>{formatDateLabel(item.date)} · {item.title}</span>
                  <span className={item.direction === "out" ? "" : "muted"}>{formatCad(item.amountCents)}</span>
                </div>
              ))}
              <p className="muted">Open Calendar for the month, Google overlays, and bill reminders. Link Google in More so both phones know who is who.</p>
            </section>
          )}
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

      {tab === "calendar" && (
        <CalendarPage
          household={household}
          today={today}
          environment={environment}
          memberId={session.memberId}
          busy={busy}
          onCommand={(fn) => { void run(fn); }}
          onAskPost={(recurrenceId, summary) => setGuard({ kind: "postRecurrence", recurrenceId, summary })}
          onAskPostDue={(_count, summary) => setGuard({ kind: "postDueAll", summary })}
          onOpenPlan={() => setTab("plan")}
        />
      )}

      {tab === "ledger" && (
        <BooksPage
          household={household}
          memberId={session.memberId}
          view={view}
          booksStatus={booksStatus}
          focusedAccountId={focusedAccountId}
          onFocusAccount={setFocusedAccountId}
          onChange={(next, token) => { void persist(next, token); }}
          onPayAccount={openPayCard}
          onAddToAccount={(account) => openAddFor(account)}
          onRemove={(transaction) => {
            const dollars = formatCad(transaction.amountCents);
            const summary = transaction.source === "shift"
              ? `This removes the whole shift (${dollars} wages and tips) from the books.`
              : transaction.type === "transfer"
                ? `This removes both sides of the ${dollars} transfer.`
                : `This removes ${dollars}${transaction.note ? ` (${transaction.note})` : ""} from the books.`;
            setGuard({ kind: "remove", transactionId: transaction.id, summary });
          }}
        />
      )}

      {tab === "more" && (
        <>
          <section className="card">
            <header><h2>Health</h2><span className={`pill ${findings.length ? "warn" : "good"}`}>{findings.length ? `${findings.length} findings` : "Clean"}</span></header>
            {findings.length === 0 ? <p className="muted">Ledger, splits, transfers, shifts, flags, and the books agree.</p> : (
              <ul className="health">{findings.map((finding) => <li key={finding.section + finding.message}><strong>{finding.section}.</strong> {finding.message}</li>)}</ul>
            )}
          </section>
          <section className="card">
            <header>
              <h2>Recent changes</h2>
              <span className="muted">{history.length ? `${history.length} on this phone` : "None"}</span>
            </header>
            {history.length === 0 ? (
              <p className="muted">Saves, removes, and reviews can be undone here. Only the latest change undoes, so the books stay in order.</p>
            ) : (
              [...history].reverse().map((item, index) => (
                <div className="row" key={item.id}>
                  <span>{item.label}</span>
                  {index === 0 ? (
                    <button className="chip" disabled={busy} onClick={() => void applyUndo(item)}>Undo</button>
                  ) : (
                    <span className="muted">later</span>
                  )}
                </div>
              ))
            )}
          </section>
          <PairingCard
            household={household}
            memberId={session.memberId}
            error={error}
            busy={busy}
            syncState={syncState}
            inviteInput={inviteInput}
            onInviteInput={setInviteInput}
            onHousehold={(next) => persist(next)}
            onError={setError}
            onBusy={setBusy}
            onSyncState={setSyncState}
            onBeforeSensitive={() => gateWithGoogle({ record: true })}
          />
          <GoogleBridgeCard
            household={household}
            environment={environment}
            memberId={session.memberId}
            busy={busy}
            onCommand={(fn) => { void run(fn); }}
            onError={setError}
          />
          <section className="card">
            <header><h2>This phone</h2></header>
            <p className="muted">
              You are {household.members.find((member) => member.id === session.memberId)?.name}.
              Household view shows shared and “both” rows. Personal view shows your personal and “both” rows.
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
          </section>
          <section className="card storage">
            <header><h2>Where the books live</h2></header>
            <p>
              Commands still validate a household snapshot. After each save, that snapshot is posted into a
              double-entry PostgreSQL journal in PGlite (<code>{STORAGE_EXPLAINER.books}</code>) — trial balance,
              general journal, and SQL views. The snapshot also stays in IndexedDB (<code>{STORAGE_EXPLAINER.database}</code>)
              with a {STORAGE_EXPLAINER.backup} fallback. Download SQL from Books to load the same schema on Neon or Supabase.
              Personal rows are a filter, not a lock.
            </p>
            <button className="primary" onClick={() => downloadJson(household)}>Export JSON snapshot</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setGuard({ kind: "demo" })}>Reload demo data</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => {
              const due = household.recurrences.filter((item) => item.active && item.nextDate <= today).length;
              setGuard({
                kind: "postDueAll",
                summary: due
                  ? `This posts ${due} due repeating ${due === 1 ? "item" : "items"} into the books.`
                  : "Nothing is due today. Open Calendar to see what is coming.",
              });
            }}>Post due recurring</button>
            <button className="danger" onClick={() => setGuard({ kind: "reset" })}>Reset this environment</button>
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
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
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
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
                </select>
                <label>To</label>
                <select value={form.toAccountId} onChange={(event) => setForm({ ...form, toAccountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
                </select>
                <p className="muted">A transfer is one balanced journal entry: debit the destination, credit the source. It never counts as income or expense.</p>
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
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
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
                <button className="primary" onClick={() => {
                  if (confirm.code === "closedMonth") submit({ confirmClosedMonth: true });
                  else submit({ confirmDuplicate: true, confirmClosedMonth: true });
                }}>
                  {confirm.code === "closedMonth" ? "Post into closed month" : "Add anyway"}
                </button>
              </div>
            )}
            <button className="primary" disabled={busy} onClick={() => submit()}>Save</button>
          </div>
        </div>
      )}

      {guard?.kind === "reset" && (
        <ConfirmSheet
          title="Reset this ledger?"
          body={`This deletes the ${environment} ledger on this phone only. Bianca’s phone and the cloud copy stay until someone publishes over them. This cannot be undone here.`}
          extra={googleStepUpExtra}
          confirmLabel="Reset this phone"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                await gateWithGoogle({ record: false });
                household.members.forEach((member) => disconnectGoogle(environment, member.id));
                disconnectGoogle(environment, "__welcome__");
                await clearHousehold(environment);
                clearSession(environment);
                setSession(null);
                setHousehold(null);
                setHistory([]);
                setToast(null);
                setGuard(null);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      {guard?.kind === "environment" && (
        <ConfirmSheet
          title={`Switch to ${guard.next}?`}
          body={`${environment} stays saved on this phone. ${guard.next === "production" ? "Production starts empty until you open or join a household there." : "Development is the usual working ledger."} This is not a cloud switch.`}
          extra={googleStepUpExtra}
          confirmLabel={`Open ${guard.next}`}
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const next = guard.next;
            void (async () => {
              setBusy(true);
              try {
                await gateWithGoogle({ record: false });
                setEnvironment(next);
                setHistory([]);
                setToast(null);
                setGuard(null);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      {guard?.kind === "demo" && (
        <ConfirmSheet
          title="Reload demo data?"
          body={`This replaces the ${environment} ledger on this phone with fictional CAD. If you then tap Sync to the cloud, that demo can overwrite the shared household.`}
          extra={googleStepUpExtra}
          confirmLabel="Load demo data"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                await gateWithGoogle({ record: false });
                setGuard(null);
                await persist(seedDemoHousehold({ today, environment }));
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      {guard?.kind === "remove" && (
        <ConfirmSheet
          title="Remove from the books?"
          body={`${guard.summary} You can undo from the toast or from More → Recent changes.`}
          confirmLabel="Remove"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.transactionId;
            const current = householdRef.current;
            setGuard(null);
            if (!current) return;
            try {
              const result = voidPostedMoney(current, id);
              void persist(result.household, result.undo);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
        />
      )}
      {guard?.kind === "postRecurrence" && (
        <ConfirmSheet
          title="Post this bill?"
          body={`${guard.summary} Calendar reminders are not a ledger write. This is. You can undo from the toast.`}
          confirmLabel="Post to the books"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.recurrenceId;
            setGuard(null);
            void run((current) => postOneRecurrence(current, id, today));
          }}
        />
      )}
      {guard?.kind === "postDueAll" && (
        <ConfirmSheet
          title="Post every due repeating item?"
          body={`${guard.summary} Nothing posts until you confirm.`}
          confirmLabel="Post due items"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            setGuard(null);
            void run((current) => postDueRecurrences(current, today));
          }}
        />
      )}

      {toast && (
        <div className="toast">
          <span>Saved. You can undo this, or find it later under More.</span>
          <button className="ghost" style={{ color: "var(--paper)" }} onClick={() => void applyUndo(toast)}>Undo</button>
        </div>
      )}

      {commandOpen && (
        <div className="cmdk" onClick={() => setCommandOpen(false)}>
          <div onClick={(event) => event.stopPropagation()}>
            <input autoFocus placeholder="Jump to add, plan, health…" onKeyDown={(event) => {
              if (event.key === "Enter") setCommandOpen(false);
            }} />
            {[
              { label: "Add expense", run: () => openAddFor(null, "expense") },
              { label: "Add shift", run: () => openAddFor(null, "shift") },
              { label: "Move money", run: () => openAddFor(null, "transfer") },
              { label: "Calendar", run: () => setTab("calendar") },
              { label: "Plan", run: () => setTab("plan") },
              { label: "Books", run: () => setTab("ledger") },
              { label: "Health", run: () => setTab("more") },
              { label: "Google household bridge", run: () => setTab("more") },
              { label: "Ask Hercules", run: () => setTab("home") },
              { label: "Export", run: () => downloadJson(household) },
            ].map((item) => (
              <button key={item.label} onClick={() => { item.run(); setCommandOpen(false); }}>{item.label}</button>
            ))}
          </div>
        </div>
      )}

      <HerculesPresence
        household={household}
        today={today}
        tab={tab}
        adding={adding}
        visorPop={visorPop}
        spark={spark}
        memberId={session.memberId}
        onGo={(next) => {
          if (next === "add") {
            openAddFor(null);
            return;
          }
          setTab(next);
          setAdding(false);
        }}
        onOpenAdd={(note) => {
          openAddFor(null, "expense");
          setForm((current) => ({
            ...current,
            note: note ?? "",
            subcategoryId: "SUB-FOOD-GROCERIES",
          }));
        }}
        onLedger={(fn) => { void runKitchen(fn); }}
        onDraft={(draft) => {
          const nextMode = draft.kind === "shift" || draft.kind === "transfer" || draft.kind === "income"
            ? draft.kind
            : "expense";
          openAddFor(null, nextMode);
          setForm((current) => ({
            ...current,
            note: draft.note || current.note,
            subcategoryId: draft.subcategoryId ?? current.subcategoryId,
          }));
        }}
      />

      <nav className="nav">
        <button className={tab === "home" && !adding ? "active" : ""} onClick={() => { setTab("home"); setAdding(false); }}>Home</button>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => { setTab("calendar"); setAdding(false); }}>Calendar</button>
        <button className="fab" onClick={() => openAddFor(null)}>+</button>
        <button className={tab === "plan" ? "active" : ""} onClick={() => { setTab("plan"); setAdding(false); }}>Plan</button>
        <button className={tab === "ledger" ? "active" : ""} onClick={() => { setTab("ledger"); setAdding(false); }}>Books</button>
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
  const rows = preview.rows.filter((row) => row.lastActualCents || row.lastBudgetedCents || row.suggestedCents);
  return (
    <section className="card">
      <header><h2>Sit-down</h2><span className="muted">Copy {preview.sourceMonth} into {preview.targetMonth}</span></header>
      <p className="muted">Overspent categories get a midpoint suggestion. Nothing is written until you apply. Close pack on Books locks last month with a second look.</p>
      {rows.slice(0, 14).map((row) => (
        <div className="row sitdown-row" key={row.subcategoryId}>
          <span>{row.name}{row.trimSuggested ? " · trim" : ""}</span>
          <span className="muted">{formatCad(row.lastActualCents)} last · {formatCad(row.suggestedCents)} next</span>
        </div>
      ))}
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
  const [amount, setAmount] = useState("25");
  return (
    <section className="card">
      <header><h2>Goals in this view</h2></header>
      {goals.map((goal) => (
        <div className="row" key={goal.id}>
          <div>
            <strong>{goal.name}</strong>
            <div className="muted">{goal.shared ? "Shared" : "Personal filter only"} · {formatCad(goal.savedCents)} / {formatCad(goal.targetCents)}</div>
          </div>
          <div className="goal-add">
            <input
              inputMode="decimal"
              aria-label={`Contribution for ${goal.name}`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <button className="chip" onClick={() => {
              const result = contributeToGoal(household, goal.id, amount);
              onChange(result.household, result.undo);
            }}>+ add</button>
          </div>
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
