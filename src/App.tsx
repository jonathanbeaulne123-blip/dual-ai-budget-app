import { useEffect, useMemo, useRef, useState } from "react";
import {
  JOINT,
  NeedsConfirmationError,
  ValidationError,
  addCategory,
  addFormDefaults,
  addGoal,
  buildDashboard,
  calcShiftAmounts,
  catalogHousehold,
  centsDigitsFromDollars,
  fundGoal,
  createWriteQueue,
  creditCardView,
  defaultVisibilityForView,
  describeGoalContributors,
  dollarsFromCentsDigits,
  emitOfficeIntent,
  findActiveGoogleLinkByEmail,
  findActiveGoogleLinkBySubject,
  formatCad,
  describeDeviceLabel,
  localDeviceId,
  touchHouseholdDevice,
  goalIsFull,
  goalStatus,
  openGoals,
  retiredGoals,
  vaultReceiptBlurb,
  householdForView,
  householdWallet,
  accountOptionLabel,
  jointSplit,
  memberNeedsGoogleStepUp,
  padToDollars,
  parseAmount,
  percentSplits,
  postDueRecurrences,
  postEntry,
  postOneRecurrence,
  postShift,
  postTransfer,
  postVisit,
  settleClaim,
  writeOffClaim,
  acceptVisitGoal,
  upcomingVisitProposals,
  acceptPresetNotice,
  addPreset,
  archivePreset,
  activePresets,
  dismissNotice,
  readClinkOn,
  runHealthCheck,
  seedDemoHousehold,
  shiftSettingsFingerprint,
  todayKey,
  touchGoogleConfirmation,
  touchVisitSpark,
  undo,
  reversePostedMoney,
  suggestCategory,
  shouldPrefillCategory,
  suggestSplit,
  clockInShift,
  abandonOpenShift,
  activeOpenShift,
  ceremonyFields,
  ceremonyCopy,
  collapseSavedOffice,
  dismissDuePreview,
  duePreviewDismissed,
  dueRecurrencePreview,
  formatPreviewHours,
  isLastCeremonyStep,
  previewHoursLabel,
  previewHoursQuarter,
  shiftFieldLabel,
  type ShiftGate,
  type CommitResult,
  type Environment,
  type Household,
  type LedgerView,
  type Split,
  type UndoToken,
  type Visibility,
  type Account,
  type VisitPostDraft,
} from "./core/index.ts";
import { STORAGE_EXPLAINER, clearHousehold, downloadJson, loadHousehold, saveHousehold } from "./storage.ts";
import { clearSession, loadSession, saveSession, type Session } from "./session.ts";
import { joinSharedHousehold, pushSharedHousehold, reconcileHousehold } from "./api.ts";
import { inviteFromLocation } from "./core/invite.ts";
import { PairingCard, WelcomeJoin } from "./Pairing.tsx";
import { BooksPage } from "./Books.tsx";
import { ConfirmSheet } from "./Confirm.tsx";
import { DuePreviewSheet } from "./DuePreviewSheet.tsx";
import { CalendarPage } from "./Calendar.tsx";
import { Office } from "./Office.tsx";
import { HerculesPresence } from "./Hercules.tsx";
import { CadPad } from "./CadPad.tsx";
import { PresetChip } from "./widgets/PresetChip.tsx";
import { SitDownGuide } from "./SitDownGuide.tsx";
import { PurchaseGoalSheet } from "./widgets/Jars.tsx";
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
  | { kind: "postDueAll"; summary: string }
  | { kind: "postVisit"; draft: VisitPostDraft; summary: string }
  | { kind: "settleClaim"; claimId: string; summary: string }
  | { kind: "writeOffClaim"; claimId: string; summary: string }
  | { kind: "acceptVisitGoal"; appointmentId: string; summary: string }
  | { kind: "acceptPreset"; key: string; summary: string }
  | { kind: "addPreset"; summary: string }
  | { kind: "duePreview"; rows: ReturnType<typeof dueRecurrencePreview> };

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
  hours: "",
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
  const [addDetails, setAddDetails] = useState(false);
  const [shiftGate, setShiftGate] = useState<ShiftGate>("choose");
  const [shiftStep, setShiftStep] = useState(0);
  const [shiftTick, setShiftTick] = useState(0);
  const [hoursDirty, setHoursDirty] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [codingHint, setCodingHint] = useState("");
  const enqueueWrite = useMemo(() => createWriteQueue(), []);
  const duePreviewOffered = useRef(false);
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
    const punch = household ? activeOpenShift(household.kitchen) : null;
    const watching = Boolean(punch) && (shiftGate === "clocked" || (shiftGate === "signOut" && shiftStep === 0));
    if (!watching) return;
    const id = window.setInterval(() => setShiftTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [household, shiftGate, shiftStep]);

  useEffect(() => {
    const punch = household ? activeOpenShift(household.kitchen) : null;
    if (!punch) return;
    if (hoursDirty) return;
    if (shiftGate !== "clocked" && !(shiftGate === "signOut" && shiftStep === 0)) return;
    const hours = formatPreviewHours(previewHoursQuarter(punch.startedAt));
    setForm((current) => (current.hours === hours ? current : { ...current, hours }));
  }, [household, shiftGate, shiftStep, shiftTick, hoursDirty]);

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
    const stampKey = `hearth.device.touched.${environment}.${household.householdId}`;
    const deviceId = localDeviceId();
    const already = typeof sessionStorage !== "undefined" ? sessionStorage.getItem(stampKey) : null;
    if (already === deviceId) return;
    try {
      const touched = touchHouseholdDevice(household, {
        deviceId,
        label: describeDeviceLabel(),
        memberId: session?.memberId ?? household.members.find((member) => member.active)?.id ?? null,
      });
      if (typeof sessionStorage !== "undefined") sessionStorage.setItem(stampKey, deviceId);
      void saveHousehold(touched.household).then(() => setHousehold(touched.household));
    } catch {
      /* soft presence only */
    }
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

  useEffect(() => {
    if (booting || !household || adding || guard || duePreviewOffered.current) return;
    if (duePreviewDismissed(environment, today)) return;
    const rows = dueRecurrencePreview(household, today);
    if (!rows.length) return;
    duePreviewOffered.current = true;
    setGuard({ kind: "duePreview", rows });
  }, [booting, household, adding, guard, environment, today]);

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
          let outgoing = next;
          try {
            outgoing = await reconcileHousehold(next, who);
          } catch {
            // Offline or unpublished: still try to publish this phone's copy.
          }
          stored = await pushSharedHousehold(outgoing, who);
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
          if (readClinkOn(environment)) {
            playClink();
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
              navigator.vibrate(10);
            }
          }
        }
        if (result.household.activity.at(-1)?.action === "Post Recurring") {
          setVisorPop(true);
          window.setTimeout(() => setVisorPop(false), 700);
        }
      } catch (caught) {
        if (caught instanceof NeedsConfirmationError) {
          setConfirm(caught);
          setAdding(true);
        } else setError(caught instanceof Error ? caught.message : String(caught));
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
          <img src="/hercules-mark.svg" alt="" />
          <h1>Hearth</h1>
          <p>
            Two phones. One journal. CAD. Toronto. Hercules loafs while you post milk.
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
          <p>Shared numbers. Personal stays yours.</p>
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
    leaveDesk();
    const id = account?.id ?? focusedAccountId;
    const defaults = addFormDefaults(ledger, id);
    setFocusedAccountId(id);
    setMode(nextMode ?? defaults.suggestedMode);
    setAdding(true);
    setAddDetails(false);
    setError("");
    setConfirm(null);
    setCategoryTouched(false);
    setCodingHint("");
    if ((nextMode ?? defaults.suggestedMode) === "shift") {
      const punch = activeOpenShift(ledger.kitchen);
      setShiftGate(punch ? "clocked" : "choose");
      setShiftStep(0);
      setForm(formForAccount(id, {
        hours: punch ? formatPreviewHours(previewHoursQuarter(punch.startedAt)) : "",
        sales: "0",
        cashTips: "0",
        ccTips: "0",
        memberId: punch?.memberId ?? actorId,
      }));
      setHoursDirty(false);
      return;
    }
    setForm(formForAccount(id));
  };

  function leaveDesk() {
    emitOfficeIntent({ type: "collapse" });
    collapseSavedOffice(environment, localStorage);
  }

  function goTab(next: Tab) {
    leaveDesk();
    setTab(next);
    setAdding(false);
  }

  function beginSignOut() {
    const punch = activeOpenShift(ledger.kitchen);
    setMode("shift");
    setAdding(true);
    setAddDetails(false);
    setError("");
    setConfirm(null);
    setShiftGate("signOut");
    setShiftStep(0);
    setHoursDirty(false);
    setForm(formForAccount(null, {
      hours: punch ? formatPreviewHours(previewHoursQuarter(punch.startedAt)) : "",
      sales: "0",
      cashTips: "0",
      ccTips: "0",
      memberId: punch?.memberId ?? actorId,
    }));
  }

  function beginFinishedShift() {
    setMode("shift");
    setAdding(true);
    setAddDetails(false);
    setError("");
    setConfirm(null);
    setShiftGate("finished");
    setShiftStep(0);
    setForm(formForAccount(null, { hours: "", sales: "0", cashTips: "0", ccTips: "0" }));
  }

  function shiftAdvance() {
    const fields = ceremonyFields(shiftGate);
    if (!isLastCeremonyStep(shiftGate, shiftStep)) {
      setShiftStep((step) => Math.min(step + 1, Math.max(0, fields.length - 1)));
      return;
    }
    submit();
  }

  const openPayCard = (account: Account) => {
    const card = creditCardView(ledger, account, today);
    const remaining = Math.max(0, card.statementBalanceCents - card.paidSinceStatementCents);
    const amount = remaining > 0 ? remaining : card.minPaymentCents;
    setFocusedAccountId(account.id);
    setMode("transfer");
    setAdding(true);
    setAddDetails(false);
    setError("");
    setConfirm(null);
    setForm(formForAccount(account.id, {
      amount: amount ? (amount / 100).toFixed(2) : "",
      note: `${account.name} payment`,
    }));
  };

  const openWallet = (accountId: string) => {
    setFocusedAccountId(accountId);
    goTab("ledger");
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

  function submit(flags: { confirmDuplicate?: boolean } = {}) {
    run((current) => {
      if (mode === "transfer") {
        return postTransfer(current, {
          date: form.date,
          amount: form.amount,
          fromAccountId: form.fromAccountId,
          toAccountId: form.toAccountId,
          note: form.note,
          confirmDuplicate: flags.confirmDuplicate,
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
        createdBy: actorId,
        visibility: form.visibility,
      });
    });
  }

  function addPostLabel(): string {
    if (mode === "shift") {
      if (shiftGate === "choose" || shiftGate === "clocked") return "Clock in";
      return isLastCeremonyStep(shiftGate, shiftStep) ? "Post shift" : "Next";
    }
    const digits = centsDigitsFromDollars(form.amount);
    const money = digits ? formatCad(Number(digits)) : "";
    if (mode === "transfer") return money ? `Move ${money}` : "Move money";
    const note = form.note.trim().toLowerCase();
    if (note === "milk") return money ? `Post milk ${money}` : "Post milk";
    if (note === "coffee") return money ? `Post coffee ${money}` : "Post coffee";
    return money ? `Post ${money}` : "Post";
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img src="/hercules-mark.svg" alt="" />
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
        <Office
          household={household}
          dashboard={dashboard}
          today={today}
          environment={environment}
          memberId={session.memberId}
          view={view}
          busy={busy}
          clinkOn={clinkOn}
          adding={adding}
          form={form}
          mode={mode}
          error={error}
          categories={categories}
          postLabel={addPostLabel()}
          onClinkOn={setClinkOn}
          onForm={setForm}
          onPost={() => submit()}
          onMore={() => {
            setAdding(true);
            setAddDetails(true);
          }}
          onMilk={() => {
            setMode("expense");
            setForm((current) => ({ ...current, note: "Milk", subcategoryId: "SUB-FOOD-GROCERIES" }));
            emitOfficeIntent({ type: "expand", id: "calculator" });
          }}
          onCoffee={() => {
            setMode("expense");
            setForm((current) => ({ ...current, note: "Coffee", subcategoryId: "SUB-FOOD-COFFEE" }));
            emitOfficeIntent({ type: "expand", id: "calculator" });
          }}
          onClockIn={() => { void runKitchen((current) => clockInShift(current, { memberId: actorId })); }}
          onAbandonShift={() => { void runKitchen((current) => abandonOpenShift(current)); }}
          onSignOut={beginSignOut}
          onFinishedShift={beginFinishedShift}
          onPayCard={openPayCard}
          onOpenAccount={openWallet}
          onBuyNote={(text) => {
            openAddFor(null, "expense");
            setForm((current) => ({
              ...current,
              note: text.slice(0, 80),
              subcategoryId: "SUB-FOOD-GROCERIES",
            }));
          }}
          onKitchen={(fn) => { void runKitchen(fn); }}
          onMarkPaid={(recurrenceId, summary) => setGuard({ kind: "postRecurrence", recurrenceId, summary })}
          onAskSettle={(claimId, summary) => setGuard({ kind: "settleClaim", claimId, summary })}
          onAskStartJar={(appointmentId, summary) => setGuard({ kind: "acceptVisitGoal", appointmentId, summary })}
          onSitDown={(next, token) => persist(next, token)}
          onGo={(next) => {
            if (next === "add") {
              openAddFor(null);
              return;
            }
            goTab(next);
          }}
        />
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
          <SitDownGuide household={household} memberId={actorId} onApply={(next, token) => persist(next, token)} hidden={view === "personal"} />
          <Goals
            household={household}
            createdBy={memberId}
            goals={visible?.goals ?? household.goals}
            onChange={(next, token) => persist(next, token)}
            onAskStartJar={(appointmentId, summary) => setGuard({ kind: "acceptVisitGoal", appointmentId, summary })}
          />
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
          onAskVisit={(draft, summary) => setGuard({ kind: "postVisit", draft, summary })}
          onAskSettle={(claimId, summary) => setGuard({ kind: "settleClaim", claimId, summary })}
          onAskWriteOff={(claimId, summary) => setGuard({ kind: "writeOffClaim", claimId, summary })}
          onAskStartJar={(appointmentId, summary) => setGuard({ kind: "acceptVisitGoal", appointmentId, summary })}
          onOpenPlan={() => goTab("plan")}
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
              ? `This posts reversing income for the whole shift (${dollars} wages and tips). The shift row stays.`
              : transaction.type === "transfer"
                ? `This posts a reversing transfer for ${dollars}. Both original legs stay.`
                : `This posts a reversing entry for ${dollars}${transaction.note ? ` (${transaction.note})` : ""}. The original row stays.`;
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
              Household vs personal is a filter, not a lock.
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
            <p className="muted">
              Commands write PGlite books (<code>{STORAGE_EXPLAINER.books}</code>) and keep a snapshot in IndexedDB.
              Personal rows are a filter. Export JSON for a copy.
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
                <button
                  key={item}
                  className={mode === item ? "active" : ""}
                  onClick={() => {
                    setMode(item);
                    if (item === "shift") {
                      const punch = activeOpenShift(household.kitchen);
                      setShiftGate(punch ? "clocked" : "choose");
                      setShiftStep(0);
                    }
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
            {mode !== "shift" && mode !== "transfer" && (
              <>
                <CadPad
                  digits={centsDigitsFromDollars(form.amount)}
                  onDigits={(digits) => setForm({ ...form, amount: padToDollars(digits) })}
                  label="Amount"
                />
                {mode === "expense" && (
                  <div className="chips">
                    {activePresets(household).map((preset) => (
                      <PresetChip
                        key={preset.id}
                        note={preset.note}
                        subcategoryId={preset.subcategoryId}
                        categories={household.categories}
                        selected={presetId === preset.id}
                        onClick={() => {
                          setPresetId(preset.id);
                          setForm({
                            ...form,
                            note: preset.note,
                            place: preset.place,
                            subcategoryId: preset.subcategoryId,
                            accountId: preset.accountId,
                            amount: preset.amountCents > 0 ? (preset.amountCents / 100).toFixed(2) : form.amount,
                            visibility: preset.visibility,
                          });
                        }}
                      />
                    ))}
                    <button
                      type="button"
                      className={`chip ${form.note === "Milk" && presetId == null ? "selected" : ""}`}
                      onClick={() => {
                        setPresetId(null);
                        setCategoryTouched(true);
                        setForm({ ...form, note: "Milk", subcategoryId: "SUB-FOOD-GROCERIES" });
                      }}
                    >
                      Milk
                    </button>
                    <button
                      type="button"
                      className={`chip ${form.note === "Coffee" && presetId == null ? "selected" : ""}`}
                      onClick={() => {
                        setPresetId(null);
                        setCategoryTouched(true);
                        setForm({ ...form, note: "Coffee", subcategoryId: "SUB-FOOD-COFFEE" });
                      }}
                    >
                      Coffee
                    </button>
                    <button
                      type="button"
                      className="chip"
                      onClick={() => {
                        if (!form.note.trim() && !form.subcategoryId) return;
                        let amountBit = "Amount stays on the pad";
                        try {
                          if (form.amount) amountBit = formatCad(parseAmount(form.amount));
                        } catch {
                          amountBit = "Amount stays on the pad";
                        }
                        setGuard({
                          kind: "addPreset",
                          summary: `Save ${form.note.trim() || "this line"} as a preset (${amountBit}). It does not post money.`,
                        });
                      }}
                    >
                      Save as preset
                    </button>
                    {presetId && (
                      <button
                        type="button"
                        className="chip"
                        onClick={() => {
                          const id = presetId;
                          setPresetId(null);
                          void run((current) => archivePreset(current, id));
                        }}
                      >
                        Forget preset
                      </button>
                    )}
                  </div>
                )}
                <label>Category</label>
                <div className="chips">
                  {categories.map((category) => (
                    <button key={category.id} className={`chip ${form.subcategoryId === category.id ? "selected" : ""}`} onClick={() => { setCategoryTouched(true); setForm({ ...form, subcategoryId: category.id }); }}>
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
                    <p className="muted">Shares fill to 100%.</p>
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
                <label>Note</label>
                <input
                  value={form.note}
                  onChange={(event) => {
                    const note = event.target.value;
                    const next = { ...form, note };
                    if (!categoryTouched && (mode === "expense" || mode === "income")) {
                      const guess = suggestCategory(household, note, form.place);
                      if (shouldPrefillCategory(guess) && guess) {
                        next.subcategoryId = guess.subcategoryId;
                        let hint = `Guessed ${guess.name}. Confirm still writes.`;
                        try {
                          if (form.amount) {
                            const split = suggestSplit(household, note, form.place, parseAmount(form.amount));
                            if (split && split.confidence >= 0.55) hint += ` Usually ${split.label}.`;
                          }
                        } catch {
                          // Pad empty until they type an amount.
                        }
                        setCodingHint(hint);
                      }
                    }
                    setForm(next);
                  }}
                  placeholder="Milk, rent…"
                />
                {codingHint && <p className="muted">{codingHint}</p>}
              </>
            )}
            {mode === "transfer" && (
              <>
                <CadPad
                  digits={centsDigitsFromDollars(form.amount)}
                  onDigits={(digits) => setForm({ ...form, amount: padToDollars(digits) })}
                  label="Move"
                />
                <label>From</label>
                <select value={form.fromAccountId} onChange={(event) => setForm({ ...form, fromAccountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
                </select>
                <label>To</label>
                <select value={form.toAccountId} onChange={(event) => setForm({ ...form, toAccountId: event.target.value })}>
                  {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
                </select>
                <p className="muted">Not income. Not spend.</p>
              </>
            )}
            {mode === "shift" && (
              <>
                {shiftGate === "choose" && (
                  <>
                    <p className="muted">{ceremonyCopy("choose").hint}</p>
                    <label>Who is working</label>
                    <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}>
                      {household.members.filter((m) => m.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                    </select>
                    <button
                      type="button"
                      className="primary post-big"
                      disabled={busy}
                      onClick={() => {
                        void runKitchen((current) => clockInShift(current, { memberId: form.memberId }));
                        setAdding(false);
                      }}
                    >
                      Clock in
                    </button>
                    <button type="button" className="chip" onClick={beginFinishedShift}>Already off? Post a finished shift</button>
                  </>
                )}
                {shiftGate === "clocked" && (() => {
                  const punch = activeOpenShift(household.kitchen);
                  return (
                    <>
                      <p>{ceremonyCopy("clocked").title}</p>
                      <p className="muted">{punch ? previewHoursLabel(punch.startedAt) : ceremonyCopy("clocked").hint}{shiftTick ? "" : ""}</p>
                      <button type="button" className="primary post-big" onClick={beginSignOut}>Sign out</button>
                      <button
                        type="button"
                        className="chip"
                        disabled={busy}
                        onClick={() => {
                          void runKitchen((current) => abandonOpenShift(current));
                          setAdding(false);
                        }}
                      >
                        Never mind
                      </button>
                    </>
                  );
                })()}
                {(shiftGate === "signOut" || shiftGate === "finished") && (() => {
                  const fields = ceremonyFields(shiftGate);
                  const field = fields[shiftStep] ?? "hours";
                  const copy = ceremonyCopy(shiftGate, field);
                  const punch = activeOpenShift(household.kitchen);
                  return (
                    <>
                      <p>{copy.title}</p>
                      <p className="muted">{copy.hint}</p>
                      {shiftGate === "signOut" && field === "hours" && punch && (
                        <p className="muted">Live preview: {previewHoursLabel(punch.startedAt)}</p>
                      )}
                      <label>Who worked</label>
                      <select value={form.memberId} onChange={(event) => setForm({ ...form, memberId: event.target.value })}>
                        {household.members.filter((m) => m.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                      </select>
                      <label>Account</label>
                      <select value={form.accountId} onChange={(event) => setForm({ ...form, accountId: event.target.value })}>
                        {household.accounts.filter((a) => a.active).map((account) => <option key={account.id} value={account.id}>{accountOptionLabel(account)}</option>)}
                      </select>
                      <CadPad
                        digits={centsDigitsFromDollars(form[field])}
                        onDigits={(digits) => {
                          if (field === "hours") setHoursDirty(true);
                          setForm({
                            ...form,
                            [field]: dollarsFromCentsDigits(digits),
                          });
                        }}
                        label={shiftFieldLabel(field)}
                        unit={field === "hours" ? "hours" : "cad"}
                      />
                      {field !== "hours" && (
                        <div className={`preview ${shiftPreview.netTipsCents < 0 ? "warn" : ""}`}>
                          <div className="row"><span>Net tips</span><span>{formatCad(shiftPreview.netTipsCents)}</span></div>
                          <div className="row"><span>Wages</span><span>{Number(form.hours) > 0 ? formatCad(shiftPreview.wagesCents) : "wait for hours"}</span></div>
                          <p className="muted">Same math that posts. Hours are a preview until Confirm.</p>
                        </div>
                      )}
                      {shiftStep > 0 && (
                        <button type="button" className="chip" onClick={() => setShiftStep((step) => Math.max(0, step - 1))}>Back</button>
                      )}
                    </>
                  );
                })()}
              </>
            )}
            <button type="button" className="chip" onClick={() => setAddDetails((open) => !open)}>
              {addDetails ? "Hide details" : "Date & place"}
            </button>
            {addDetails && (
              <>
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
                {mode !== "shift" && mode !== "transfer" && (
                  <>
                    <label>Place</label>
                    <input
                      value={form.place}
                      onChange={(event) => {
                        const place = event.target.value;
                        const next = { ...form, place };
                        if (!categoryTouched && (mode === "expense" || mode === "income")) {
                          const guess = suggestCategory(household, form.note, place);
                          if (shouldPrefillCategory(guess) && guess) {
                            next.subcategoryId = guess.subcategoryId;
                            setCodingHint(`Guessed ${guess.name}. Confirm still writes.`);
                          }
                        }
                        setForm(next);
                      }}
                      placeholder="No Frills…"
                    />
                  </>
                )}
                {mode === "transfer" && (
                  <>
                    <label>Note</label>
                    <input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} />
                  </>
                )}
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
                <button className="primary" onClick={() => submit({ confirmDuplicate: true })}>
                  Add anyway
                </button>
              </div>
            )}
            {!(mode === "shift" && (shiftGate === "choose" || shiftGate === "clocked")) && (
              <button
                className="primary post-big"
                disabled={busy}
                onClick={() => (mode === "shift" ? shiftAdvance() : submit())}
              >
                {addPostLabel()}
              </button>
            )}
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
          title="Reverse this row?"
          body={`${guard.summary} Both the original and the reversing entry stay. Undo from the toast or More → Recent changes.`}
          confirmLabel="Reverse"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.transactionId;
            const current = householdRef.current;
            setGuard(null);
            if (!current) return;
            try {
              const result = reversePostedMoney(current, id, { createdBy: actorId });
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
      {guard?.kind === "duePreview" && (
        <DuePreviewSheet
          rows={guard.rows}
          today={today}
          busy={busy}
          onDismiss={() => {
            dismissDuePreview(environment, today);
            setGuard(null);
          }}
          onMarkPaid={(recurrenceId, summary) => {
            dismissDuePreview(environment, today);
            setGuard({ kind: "postRecurrence", recurrenceId, summary });
          }}
          onPostAll={(summary) => {
            dismissDuePreview(environment, today);
            setGuard({ kind: "postDueAll", summary });
          }}
        />
      )}
      {guard?.kind === "postVisit" && (
        <ConfirmSheet
          title="Post this visit?"
          body={`${guard.summary} The full cost posts today. Expected insurance is money owed to us, not income.`}
          confirmLabel="Post visit"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const draft = guard.draft;
            setGuard(null);
            void run((current) => {
              const appointment = current.appointments.find((item) => item.id === draft.appointmentId);
              if (!appointment) throw new ValidationError("That visit is gone.");
              return postVisit(current, {
                date: draft.date,
                amount: draft.amount,
                appointmentId: draft.appointmentId,
                accountId: appointment.accountId,
                expectedRecovery: draft.expectedRecovery,
                lines: draft.lines
                  .filter((line) => String(line.amount ?? "").trim())
                  .map((line) => ({
                    code: line.code,
                    description: line.description || "Item",
                    amount: line.amount,
                  })),
                createdBy: session.memberId,
                confirmDuplicate: true,
              });
            });
          }}
        />
      )}
      {guard?.kind === "settleClaim" && (
        <ConfirmSheet
          title="Did the money land?"
          body={`${guard.summary}`}
          confirmLabel="Record the transfer"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.claimId;
            setGuard(null);
            void run((current) => {
              const chequing = current.accounts.find((account) => account.kind === "chequing" && account.active);
              if (!chequing) throw new ValidationError("Open a chequing account to receive the settlement.");
              return settleClaim(current, {
                claimId: id,
                toAccountId: chequing.id,
                date: today,
                createdBy: session.memberId,
                confirmDuplicate: true,
              });
            });
          }}
        />
      )}
      {guard?.kind === "writeOffClaim" && (
        <ConfirmSheet
          title="Write this claim off?"
          body={`${guard.summary} The remainder posts as expense against Owed-to-us. The category climbs back to true out-of-pocket. Never income.`}
          confirmLabel="Denied"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.claimId;
            setGuard(null);
            void run((current) => writeOffClaim(current, { claimId: id, denied: true, createdBy: session.memberId }));
          }}
        />
      )}
      {guard?.kind === "acceptVisitGoal" && (
        <ConfirmSheet
          title="Start this jar?"
          body={`${guard.summary} Hercules proposed it. This write is yours.`}
          confirmLabel="Start this jar"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.appointmentId;
            setGuard(null);
            void run((current) => acceptVisitGoal(current, id, session.memberId));
          }}
        />
      )}
      {guard?.kind === "acceptPreset" && (
        <ConfirmSheet
          title="Save as preset?"
          body={`${guard.summary} Hercules noticed it. This write is yours. It does not post money. Confirm still posts the coffee.`}
          confirmLabel="Save as preset"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const key = guard.key;
            setGuard(null);
            void run((current) => acceptPresetNotice(current, key));
          }}
        />
      )}
      {guard?.kind === "addPreset" && (
        <ConfirmSheet
          title="Save as preset?"
          body={`${guard.summary} Confirm still posts when you tap Post.`}
          confirmLabel="Save preset"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            setGuard(null);
            void run((current) => addPreset(current, {
              type: mode === "income" ? "income" : "expense",
              amount: form.amount,
              accountId: form.accountId,
              subcategoryId: form.subcategoryId,
              note: form.note,
              place: form.place,
              visibility: form.visibility,
              origin: "manual",
            }));
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
              { label: "Calendar", run: () => goTab("calendar") },
              { label: "Plan", run: () => goTab("plan") },
              { label: "Books", run: () => goTab("ledger") },
              { label: "Health", run: () => goTab("more") },
              { label: "Google household bridge", run: () => goTab("more") },
              { label: "Ask Hercules", run: () => goTab("home") },
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
          goTab(next);
        }}
        onOpenAdd={(note) => {
          openAddFor(null, "expense");
          setForm((current) => ({
            ...current,
            note: note ?? "",
            subcategoryId: "SUB-FOOD-GROCERIES",
          }));
        }}
        onPayCard={() => {
          const card = householdWallet(household, today).hottestCard;
          if (card) openPayCard(card.account);
        }}
        onLedger={(fn) => { void runKitchen(fn); }}
        onAcceptPreset={(key, summary) => setGuard({ kind: "acceptPreset", key, summary })}
        onDismissNotice={(key) => { void run((current) => dismissNotice(current, key)); }}
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
        <button className={tab === "home" && !adding ? "active" : ""} onClick={() => goTab("home")}>Home</button>
        <button className={tab === "calendar" ? "active" : ""} onClick={() => goTab("calendar")}>Calendar</button>
        <button className="fab" onClick={() => openAddFor(null)}>+</button>
        <button className={tab === "plan" ? "active" : ""} onClick={() => goTab("plan")}>Plan</button>
        <button className={tab === "ledger" ? "active" : ""} onClick={() => goTab("ledger")}>Books</button>
        <button className={tab === "more" ? "active" : ""} onClick={() => goTab("more")}>More</button>
      </nav>
    </div>
  );
}

function Goals({ household, createdBy, goals, onChange, onAskStartJar }: {
  household: Household;
  createdBy: string;
  goals: Household["goals"];
  onChange: (household: Household, undo?: UndoToken) => void;
  onAskStartJar: (appointmentId: string, summary: string) => void;
}) {
  const [name, setName] = useState("New goal");
  const [target, setTarget] = useState("500");
  const [amount, setAmount] = useState("25");
  const [buying, setBuying] = useState<string | null>(null);
  const proposals = upcomingVisitProposals(household, todayKey());
  const live = openGoals({ goals });
  const retired = retiredGoals({ goals });
  const today = todayKey();
  return (
    <section className="card">
      <header><h2>Goals in this view</h2></header>
      <p className="muted">{vaultReceiptBlurb(household, today)}</p>
      {proposals.map((proposal) => (
        <div className="row" key={proposal.appointmentId}>
          <div>
            <strong>{proposal.title}</strong>
            <div className="muted">{proposal.hercules}</div>
          </div>
          <button className="chip selected" onClick={() => onAskStartJar(proposal.appointmentId, `${proposal.hercules} This creates a shared jar. Hercules does not write it.`)}>Start this jar</button>
        </div>
      ))}
      {live.map((goal) => (
        <div className="row" key={goal.id}>
          <div>
            <strong>{goal.name}</strong>
            <div className="muted">{goal.shared ? "Shared" : "Personal filter only"} · {formatCad(goal.savedCents)} / {formatCad(goal.targetCents)}{describeGoalContributors(household, goal.id) ? ` · ${describeGoalContributors(household, goal.id)}` : ""}</div>
            {goalIsFull(goal) && buying === goal.id && (
              <PurchaseGoalSheet
                household={household}
                goalId={goal.id}
                busy={false}
                onCommand={(fn) => {
                  const result = fn(household);
                  onChange(result.household, result.undo);
                }}
                onClose={() => setBuying(null)}
              />
            )}
          </div>
          <div className="goal-add">
            <input
              inputMode="decimal"
              aria-label={`Contribution for ${goal.name}`}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            <button className="chip" onClick={() => {
              const fromAccountId = household.accounts.find((account) => account.active && account.kind === "chequing")?.id
                ?? household.accounts.find((account) => account.active)?.id;
              if (!fromAccountId) return;
              const result = fundGoal(household, {
                goalId: goal.id,
                amount,
                fromAccountId,
                createdBy,
              });
              onChange(result.household, result.undo);
            }}>{goalStatus(goal) === "unfunded" ? "Fund jar" : "+ add"}</button>
            {goalIsFull(goal) && (
              <button className="primary" onClick={() => setBuying(goal.id)}>Purchased?</button>
            )}
          </div>
        </div>
      ))}
      {retired.length > 0 && (
        <div className="retirement-home">
          <h3>Retirement home</h3>
          <p className="muted">Jars you bought. The contribution rows and the purchase expense stay on the books.</p>
          {retired.map((goal) => (
            <div className="row" key={goal.id}>
              <div>
                <strong>{goal.name}</strong>
                <div className="muted">Accomplished · saved {formatCad(goal.savedCents)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
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
