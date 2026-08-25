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
  ledgerNameForView,
  nameHouseholdLedgers,
  assembleHousehold,
  splitForSync,
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
  addRecurrence,
  updateRecurrence,
  postShift,
  postWorkShift,
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
  dismissDuePreview,
  duePreviewDismissed,
  dueRecurrencePreview,
  readClinkOn,
  runHealthCheck,
  seedDemoHousehold,
  shiftSettingsFingerprint,
  archiveWorkJob,
  upsertWorkJob,
  todayKey,
  TIMEZONE,
  formatZoneDateTime,
  formatZoneTime,
  detectDeviceTimeZone,
  COMMON_TIME_ZONES,
  formatZoneLabel,
  loadPhonePlacePrefs,
  savePhonePlacePrefs,
  locationLabel,
  shapeTransactionLocation,
  touchGoogleConfirmation,
  touchVisitSpark,
  undo,
  reversePostedMoney,
  recordConflict,
  resolveConflictChoice,
  unresolvedConflicts,
  markSynchronized,
  makeConflictBundle,
  suggestCategory,
  shouldPrefillCategory,
  suggestSplit,
  clockInShift,
  chooseOpenShiftTimeline,
  clockOutShift,
  startShiftBreak,
  endShiftBreak,
  abandonOpenShift,
  activeOpenShift,
  ceremonyFields,
  ceremonyCopy,
  collapseSavedOffice,
  formatPreviewHours,
  isLastCeremonyStep,
  previewHoursLabel,
  previewHoursQuarter,
  shiftFieldLabel,
  type ShiftGate,
  type Shift,
  type WorkJob,
  type CommitResult,
  type CommandOutcome,
  type Environment,
  type Household,
  type PersonalEnvelope,
  type LedgerView,
  type Split,
  type UndoToken,
  type Visibility,
  type Account,
  type VisitPostDraft,
  type TransactionLocation,
} from "./core/index.ts";
import {
  STORAGE_EXPLAINER,
  clearHousehold,
  downloadJson,
  listHouseholdReplicas,
  loadHousehold,
  loadPersonalReplica,
  saveHousehold,
  selectHouseholdReplica,
  type HouseholdReplicaSummary,
} from "./storage.ts";
import { clearSession, loadSession, saveSession, type Session } from "./session.ts";
import { joinSharedHousehold, reconcileHousehold, reconcileHouseholdSnapshots } from "./api.ts";
import { acceptHouseholdWrite, classifyCommandError, hostedTransportAllowed, newConfirmationId } from "./core/index.ts";
import { ingestHouseholdBooks, inspectBrowserBooks, restoreHouseholdBooks, type BooksStatus } from "./ledger/engine.ts";
import { pushSupabaseHousehold, readSupabaseConfig } from "./ledger/supabase.ts";
import {
  authenticatedSupabaseConfig,
  clearSupabaseSession,
  consumeSupabaseAuthRedirect,
  ensureSupabaseSession,
  loadSupabaseSession,
  startSupabaseGoogleSignIn,
  supabaseAuthEnabled,
} from "./auth/supabaseSession.ts";
import {
  continuityMemberId,
  discoverContinuityMemberships,
  flushContinuityOutbox,
  listContinuityOutbox,
  transportHouseholdWithOutbox,
  type ContinuityIdentity,
} from "./continuity.ts";
import { inviteFromLocation } from "./core/invite.ts";
import { PairingCard, WelcomeJoin } from "./Pairing.tsx";
import { BooksPage } from "./Books.tsx";
import { ConfirmSheet } from "./Confirm.tsx";
import type { RepeatingDraft } from "./RepeatingForm.tsx";
import { WorkJobsCard } from "./WorkJobs.tsx";
import { WorkShiftFlow } from "./WorkShiftFlow.tsx";
import { WorkShiftHistoryCard } from "./WorkShiftHistory.tsx";
import { WorkReportCard } from "./WorkReport.tsx";
import { ConflictResolution } from "./ConflictResolution.tsx";
import { DuePreviewSheet } from "./DuePreviewSheet.tsx";
import {
  renderCommandSurface,
  type CommandChromeResult,
} from "./commandSurface.tsx";
import { loadSyncAnchor, saveSyncAnchor } from "./syncAnchor.ts";
import {
  recentChangesEmptyCopy,
  recentChangesHeaderPill,
  recentChangesOlderLabel,
} from "./recentChangesCopy.ts";
import { useDialog } from "./useDialog.ts";
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
  loadGoogleSession,
} from "./google/index.ts";
import type { DiscoveredHousehold } from "./ledger/supabase.ts";
import type { PostWorkShiftInput } from "./core/index.ts";

type Tab = "home" | "plan" | "calendar" | "ledger" | "more";
type AddMode = "expense" | "income" | "shift" | "transfer";
type Guard =
  | { kind: "reset" }
  | { kind: "environment"; next: Environment }
  | { kind: "demo" }
  | { kind: "remove"; transactionId: string; summary: string }
  | { kind: "correctShift"; shift: Shift; transactionId: string }
  | { kind: "duePreview"; rows: ReturnType<typeof dueRecurrencePreview> }
  | { kind: "postRecurrence"; recurrenceId: string; summary: string }
  | { kind: "saveRepeating"; draft: RepeatingDraft; summary: string }
  | { kind: "saveWorkJob"; job: WorkJob; summary: string }
  | { kind: "postDueAll"; summary: string }
  | { kind: "postVisit"; draft: VisitPostDraft; summary: string }
  | { kind: "settleClaim"; claimId: string; summary: string }
  | { kind: "writeOffClaim"; claimId: string; summary: string }
  | { kind: "acceptVisitGoal"; appointmentId: string; summary: string }
  | { kind: "acceptPreset"; key: string; summary: string }
  | { kind: "addPreset"; summary: string };

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
  occurredAt: "" as string,
};

function emptyFormForZone(timeZone: string) {
  const now = new Date();
  return {
    ...emptyForm,
    date: todayKey(now, timeZone),
    occurredAt: "",
  };
}

export function App() {
  const [environment, setEnvironment] = useState<Environment>("development");
  const [household, setHousehold] = useState<Household | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [adding, setAdding] = useState(false);
  const confirmPanelRef = useRef<HTMLDivElement | null>(null);
  const lastAmountLabelRef = useRef<string | null>(null);

  const closeAdd = () => {
    setAdding(false);
    setConfirm(null);
    setError("");
    setDraftLocation(undefined);
    setLocationBusy(false);
  };
  const addSheetRef = useDialog(adding, closeAdd);

  const [mode, setMode] = useState<AddMode>("expense");
  const [form, setForm] = useState(emptyForm);
  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<NeedsConfirmationError | null>(null);
  const [toast, setToast] = useState<UndoToken | null>(null);
  const [history, setHistory] = useState<UndoToken[]>([]);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [saveRepeatingPostFirst, setSaveRepeatingPostFirst] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [splitPercents, setSplitPercents] = useState<Record<string, number>>({ "MEM-001": 50, "MEM-002": 50 });
  const [now] = useState(() => new Date());
  const [session, setSession] = useState<Session | null>(null);
  const [replicas, setReplicas] = useState<HouseholdReplicaSummary[]>([]);
  const [personalReplica, setPersonalReplica] = useState<PersonalEnvelope | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [commandChrome, setCommandChrome] = useState<CommandChromeResult | null>(null);
  const [showConflictSheet, setShowConflictSheet] = useState(false);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [discoveredLedgers, setDiscoveredLedgers] = useState<DiscoveredHousehold[]>([]);
  const [supabaseAuthReturned, setSupabaseAuthReturned] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [welcomeMode, setWelcomeMode] = useState<"home" | "join" | "new">("home");
  const [newHouseholdDraft, setNewHouseholdDraft] = useState({
    householdName: "Our Household",
    sharedLedgerName: "Household Ledger",
    personalLedgerName: "My Personal Ledger",
    personalMemberId: "MEM-001",
  });
  const [booksStatus, setBooksStatus] = useState<BooksStatus | null>(null);
  const [spark, setSpark] = useState(false);
  const [visorPop, setVisorPop] = useState(false);
  const [clinkOn, setClinkOn] = useState(false);
  const [addDetails, setAddDetails] = useState(false);
  const [shiftGate, setShiftGate] = useState<ShiftGate>("choose");
  const [shiftStep, setShiftStep] = useState(0);
  const [shiftTick, setShiftTick] = useState(0);
  const [hoursDirty, setHoursDirty] = useState(false);
  const [draftLocation, setDraftLocation] = useState<TransactionLocation | undefined>(undefined);
  const [locationBusy, setLocationBusy] = useState(false);
  const [placePrefs, setPlacePrefs] = useState(() => loadPhonePlacePrefs("development"));
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [presetId, setPresetId] = useState<string | null>(null);
  const [categoryTouched, setCategoryTouched] = useState(false);
  const [codingHint, setCodingHint] = useState("");
  const enqueueWrite = useMemo(() => createWriteQueue(), []);
  const householdRef = useRef<Household | null>(household);
  householdRef.current = household;
  const historyRef = useRef(history);
  historyRef.current = history;
  const confirmationRef = useRef<string | null>(null);
  const postingRef = useRef(false);
  const workShiftInputRef = useRef<PostWorkShiftInput | null>(null);
  const workShiftDateRef = useRef(todayKey());
  const duePreviewOffered = useRef<string | null>(null);

  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  useEffect(() => {
    if (!confirm) return;
    setToast(null);
    confirmPanelRef.current?.focus();
    confirmPanelRef.current?.scrollIntoView({ block: "center" });
  }, [confirm]);

  useEffect(() => {
    try {
      if (supabaseAuthEnabled() && consumeSupabaseAuthRedirect()) setSupabaseAuthReturned(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }, []);

  useEffect(() => {
    if (!supabaseAuthReturned) return;
    setSupabaseAuthReturned(false);
    void continueWithGoogle();
  }, [supabaseAuthReturned]);

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
    const punch = household && session ? activeOpenShift(household.kitchen, session.memberId) : null;
    const watching = Boolean(punch) && (shiftGate === "clocked" || (shiftGate === "signOut" && shiftStep === 0));
    if (!watching) return;
    const id = window.setInterval(() => setShiftTick((n) => n + 1), 1_000);
    return () => window.clearInterval(id);
  }, [household, session?.memberId, shiftGate, shiftStep]);

  useEffect(() => {
    const punch = household && session ? activeOpenShift(household.kitchen, session.memberId) : null;
    if (!punch) return;
    if (hoursDirty) return;
    if (shiftGate !== "clocked" && !(shiftGate === "signOut" && shiftStep === 0)) return;
    const hours = formatPreviewHours(previewHoursQuarter(punch.startedAt));
    setForm((current) => (current.hours === hours ? current : { ...current, hours }));
  }, [household, session?.memberId, shiftGate, shiftStep, shiftTick, hoursDirty]);

  useEffect(() => {
    let live = true;
    setBooting(true);
    const loadedSession = loadSession(environment);
    setSession(loadedSession);
    loadHousehold(environment, loadedSession?.householdId, loadedSession?.memberId).then(async (loaded) => {
      if (!live) return;
      let current = loaded;
      if (loaded?.linked && loadedSession?.memberId) {
        try {
          const reconciled = await reconcileHousehold(loaded, loadedSession.memberId);
          if (!live) return;
          const accepted = await acceptHouseholdWrite({
            previous: loaded,
            candidate: reconciled,
            confirmationId: `reconcile-${loaded.householdId}-${reconciled.revision}`,
            commandKind: "boot-reconcile",
            postedIds: [],
            adapters: {
              persist: (next) => saveHousehold(next, { memberId: loadedSession.memberId }),
              ingest: async (household) => {
                try {
                  const { status } = await ingestHouseholdBooks(household);
                  return { ok: status.ok, error: status.error };
                } catch (error) {
                  return { ok: false, error: error instanceof Error ? error.message : String(error) };
                }
              },
              restoreIngest: restoreHouseholdBooks,
            },
          });
          if (!live) return;
          current = accepted.household;
          if (!accepted.ok && accepted.userMessage) setError(accepted.userMessage);
        } catch {
          if (!live) return;
        }
      }
      setHousehold(current);
      void listHouseholdReplicas(environment).then((items) => { if (live) setReplicas(items); });
      if (current) {
        void inspectBrowserBooks(current)
          .then(async (inspection) => {
            if (!live) return;
            if (inspection.ok) {
              setBooksStatus({
                ok: true,
                engine: "pglite",
                entryCount: inspection.entryCount,
                inBalance: true,
                equationHolds: true,
              });
              return;
            }
            if (
              inspection.issue === "missing-schema" ||
              inspection.issue === "incomplete-migration" ||
              inspection.issue === "interrupted-transaction"
            ) {
              try {
                const { status } = await ingestHouseholdBooks(current);
                if (live) setBooksStatus(status);
              } catch (caught) {
                if (!live) return;
                setBooksStatus({
                  ok: false,
                  engine: "pglite",
                  entryCount: inspection.entryCount,
                  inBalance: false,
                  equationHolds: false,
                  error: caught instanceof Error ? caught.message : inspection.message,
                });
              }
              return;
            }
            setBooksStatus({
              ok: false,
              engine: "pglite",
              entryCount: inspection.entryCount,
              inBalance: false,
              equationHolds: false,
              error: inspection.message,
            });
          })
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
      void saveHousehold(touched.household, { memberId: session?.memberId }).then(() => setHousehold(touched.household));
    } catch {
      /* soft presence only */
    }
  }, [environment, household?.householdId]);

  useEffect(() => {
    const memberId = session?.memberId;
    if (!memberId) return;
    const googleSession = loadGoogleSession(environment, memberId);
    const storedAuthSession = loadSupabaseSession(environment);
    if (!storedAuthSession && !googleSession?.identity.email && !googleSession?.identity.subject) return;
    let live = true;
    let running = false;

    const acceptReplayCandidate = async (candidate: Household, confirmationId: string, commandKind: string) => {
      const previous = householdRef.current;
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate,
        confirmationId,
        commandKind,
        postedIds: [],
        adapters: {
          persist: (next) => saveHousehold(next, { memberId }),
          ingest: async (next) => {
            try {
              const { status } = await ingestHouseholdBooks(next);
              return { ok: status.ok, error: status.error };
            } catch (caught) {
              return { ok: false, error: caught instanceof Error ? caught.message : String(caught) };
            }
          },
          restoreIngest: restoreHouseholdBooks,
        },
      });
      if (!live) return accepted;
      householdRef.current = accepted.household;
      setHousehold(accepted.household);
      if (!accepted.ok && accepted.userMessage) setError(accepted.userMessage);
      return accepted;
    };

    const replay = async () => {
      if (running) return;
      running = true;
      if (live) setSyncState("syncing");
      try {
        const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
        const identity: ContinuityIdentity = authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : {
              email: googleSession?.identity.email ?? "",
              subject: googleSession?.identity.subject ?? "",
            };
        const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
        const flushed = await flushContinuityOutbox({ environment, identity, config: cloudConfig });
        if (!live) return;
        const conflict = flushed.conflicts[0];
        if (conflict) {
          const current = householdRef.current;
          if (current && current.householdId === conflict.item.householdId) {
            const conflicted = await recordConflict(current, conflict.remote, false);
            await acceptReplayCandidate(
              conflicted,
              `outbox-conflict-${current.householdId}-${conflict.remote.revision}`,
              "outbox-conflict",
            );
          }
          if (live) {
            setSyncState("error");
            setError(conflict.message);
          }
          return;
        }
        if (flushed.pending > 0) {
          setSyncState("error");
          return;
        }

        let current = householdRef.current;
        if (flushed.synchronized > 0 && current) {
          current = markSynchronized(current);
          await saveHousehold(current, { memberId });
          if (live) {
            householdRef.current = current;
            setHousehold(current);
          }
        }

        const memberships = await discoverContinuityMemberships(identity, environment, cloudConfig);
        if (!live) return;
        current = householdRef.current;
        const remote = current
          ? memberships.find((item) => item.household.householdId === current?.householdId)
          : undefined;
        if (current && remote && remote.household.revision > (current.baseRevision ?? 0)) {
          const reconciled = await reconcileHouseholdSnapshots(current, remote.household, memberId);
          await acceptReplayCandidate(
            reconciled,
            `continuity-pull-${current.householdId}-${remote.household.revision}`,
            "continuity-pull",
          );
        }
        if (live) setSyncState("synced");
      } catch (caught) {
        if (!live) return;
        setSyncState("error");
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        running = false;
      }
    };

    const onOnline = () => void replay();
    const onFocus = () => void replay();
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    void replay();
    return () => {
      live = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
    };
  }, [environment, session?.memberId, household?.householdId]);

  useEffect(() => {
    let live = true;
    const memberId = session?.memberId;
    if (!household || !memberId) {
      setPersonalReplica(null);
      return () => { live = false; };
    }
    void saveHousehold(household, { memberId }).then(async () => {
      const [personal, items] = await Promise.all([
        loadPersonalReplica(environment, household.householdId, memberId),
        listHouseholdReplicas(environment),
      ]);
      if (!live) return;
      setPersonalReplica(personal);
      setReplicas(items);
    }).catch((caught) => {
      if (live) setError(caught instanceof Error ? caught.message : String(caught));
    });
    return () => { live = false; };
  }, [environment, household?.householdId, household?.revision, session?.memberId]);

  useEffect(() => {
    setPlacePrefs(loadPhonePlacePrefs(environment));
  }, [environment]);

  // Q2 C: books civil dates stay America/Toronto; this phone may display another zone.
  const booksZone = TIMEZONE;
  const displayZone = placePrefs.displayTimeZone || detectDeviceTimeZone();
  const today = todayKey(now, booksZone);
  const memberId = session?.memberId ?? household?.members.find((member) => member.active)?.id ?? "";
  const view: LedgerView = session?.view ?? "household";
  const personalSource = household && memberId && personalReplica?.memberId === memberId
    && personalReplica.lastCommittedAt === household.lastCommittedAt
    ? assembleHousehold(splitForSync(household, memberId).shared, personalReplica, { linked: household.linked })
    : household;
  const visible = personalSource && memberId ? householdForView(personalSource, memberId, view) : personalSource;
  const findings = useMemo(() => (household ? runHealthCheck(household) : []), [household]);
  const dashboard = useMemo(
    () => (visible ? buildDashboard(visible, today, now, findings.length) : null),
    [visible, today, now, findings.length],
  );

  useEffect(() => {
    if (booting || !household || adding || guard || showConflictSheet) return;
    if (unresolvedConflicts(household).length > 0) return;

    const previewKey = `${environment}:${household.householdId}:${today}`;
    if (duePreviewOffered.current === previewKey) return;
    if (duePreviewDismissed(environment, household.householdId, today)) return;

    const rows = dueRecurrencePreview(household, today);
    if (!rows.length) return;
    duePreviewOffered.current = previewKey;
    setGuard({ kind: "duePreview", rows });
  }, [adding, booting, environment, guard, household, showConflictSheet, today]);

  function rememberSession(next: Session) {
    const remembered = { ...next, householdId: next.householdId ?? householdRef.current?.householdId };
    setSession(remembered);
    saveSession(environment, remembered);
  }

  async function switchLedger(householdId: string): Promise<void> {
    if (!householdId || householdId === householdRef.current?.householdId) return;
    setBusy(true);
    setError("");
    try {
      const candidate = await selectHouseholdReplica(environment, householdId, session?.memberId);
      const currentGoogle = session?.memberId ? loadGoogleSession(environment, session.memberId) : null;
      const googleMember = currentGoogle?.identity
        ? continuityMemberId(candidate, currentGoogle.identity)
        : null;
      const nextMemberId = googleMember
        ?? (candidate.members.some((member) => member.id === session?.memberId && member.active) ? session?.memberId : undefined)
        ?? candidate.members.find((member) => member.active)?.id;
      if (!nextMemberId) throw new Error("That ledger has no active household member.");
      const { status } = await ingestHouseholdBooks(candidate);
      if (!status.ok) throw new Error(status.error || "Those books could not be opened on this device.");
      await saveHousehold(candidate, { memberId: nextMemberId, activate: true });
      householdRef.current = candidate;
      setHousehold(candidate);
      rememberSession({ memberId: nextMemberId, view: session?.view ?? "household", householdId });
      setBooksStatus(status);
      setHistory([]);
      setToast(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function openDiscoveredLedger(found: DiscoveredHousehold): Promise<void> {
    const previous = householdRef.current;
    const candidate = previous?.householdId === found.household.householdId
      ? await reconcileHouseholdSnapshots(previous, found.household, found.memberId)
      : found.household;
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate,
      confirmationId: `discover-${found.household.householdId}-${found.household.revision}`,
      commandKind: "google-discovery",
      postedIds: [],
      adapters: {
        persist: (next) => saveHousehold(next, { memberId: found.memberId }),
        ingest: async (candidate) => {
          try {
            const { status } = await ingestHouseholdBooks(candidate);
            return { ok: status.ok, error: status.error };
          } catch (caught) {
            return { ok: false, error: caught instanceof Error ? caught.message : String(caught) };
          }
        },
        restoreIngest: restoreHouseholdBooks,
      },
    });
    if (!accepted.ok) throw new Error(accepted.userMessage || "Those cloud books could not be accepted on this device.");
    const adopted = adoptGoogleSession(environment, "__welcome__", found.memberId);
    if (!adopted && !loadSupabaseSession(environment)) {
      throw new Error("Google signed in, but this device could not keep the session.");
    }
    setHousehold(accepted.household);
    rememberSession({ memberId: found.memberId, view: "household", householdId: accepted.household.householdId });
    setDiscoveredLedgers([]);
    setSyncState("synced");
    setBooksStatus({
      ok: true,
      engine: "pglite+supabase",
      entryCount: accepted.household.transactions.length,
      inBalance: true,
      equationHolds: true,
    });
  }

  async function continueWithGoogle(): Promise<void> {
    setBusy(true);
    setError("");
    try {
      let identity: ContinuityIdentity;
      let cloudConfig = readSupabaseConfig();
      if (supabaseAuthEnabled()) {
        let authSession = await ensureSupabaseSession(environment);
        if (!authSession) {
          startSupabaseGoogleSignIn(environment);
          return;
        }
        cloudConfig = authenticatedSupabaseConfig(cloudConfig, authSession);
        identity = { email: authSession.email, subject: authSession.googleSubject };
      } else {
        const googleSession = await connectGoogle({
          environment,
          memberId: "__welcome__",
          services: ["identity"],
          selectAccount: true,
        });
        identity = googleSession.identity;
      }
      const found = await discoverContinuityMemberships(identity, environment, cloudConfig);
      if (!found.length) {
        if (supabaseAuthEnabled()) clearSupabaseSession(environment);
        else disconnectGoogle(environment, "__welcome__");
        throw new Error(
          environment === "production"
            ? "Production account discovery waits for the late-September security cutover."
            : "That Google account is not linked to a Development ledger yet. Open an existing household, choose yourself, and link Google once.",
        );
      }
      const only = found[0];
      if (found.length === 1 && only) await openDiscoveredLedger(only);
      else setDiscoveredLedgers(found);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function commitHousehold(
    next: Household,
    token?: UndoToken,
    _actorId?: string,
  ): Promise<CommandOutcome | null> {
    setBusy(true);
    const previous = householdRef.current;
    const confirmationId = confirmationRef.current ?? newConfirmationId();
    confirmationRef.current = confirmationId;
    try {
      const googleSession = session?.memberId ? loadGoogleSession(environment, session.memberId) : null;
      const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const continuityIdentity: ContinuityIdentity | null = authSession
        ? { email: authSession.email, subject: authSession.googleSubject }
        : googleSession?.identity
          ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
          : null;
      const automaticContinuity = Boolean(
        continuityIdentity &&
        session?.memberId &&
        (
          (authSession && next.members.some((member) => member.id === session.memberId && member.active))
          || continuityMemberId(next, continuityIdentity) === session.memberId
        ),
      );
      const transportRequested = environment === "development" && (automaticContinuity || hostedTransportAllowed(next));
      const outcome = await acceptHouseholdWrite({
        previous,
        candidate: next,
        confirmationId,
        commandKind: token?.label ?? "commit",
        postedIds: token?.postedIds ?? [],
        transportRequested,
        adapters: {
          persist: (household) => saveHousehold(household, { memberId: session?.memberId }),
          ingest: async (household) => {
            try {
              const { status } = await ingestHouseholdBooks(household);
              return { ok: status.ok, error: status.error };
            } catch (error) {
              return { ok: false, error: error instanceof Error ? error.message : String(error) };
            }
          },
          restoreIngest: async (household) => {
            await restoreHouseholdBooks(household);
          },
          transport: transportRequested && automaticContinuity && continuityIdentity
            ? async (household, expectedRevision) => transportHouseholdWithOutbox({
                household,
                identity: continuityIdentity,
                expectedRevision,
                confirmationId,
                config: cloudConfig,
              })
            : transportRequested && hostedTransportAllowed(next)
              ? async (household, expectedRevision) => {
                const pushed = await pushSupabaseHousehold(household, cloudConfig, { expectedRevision });
                if (pushed.skipped) return { ok: true };
                if (pushed.conflict && pushed.remote) {
                  return {
                    ok: false,
                    errorClass: "conflict-detected" as const,
                    remote: pushed.remote,
                    message: pushed.error || "Another phone posted a newer household snapshot. Nothing was overwritten.",
                  };
                }
                if (!pushed.schema) {
                  return {
                    ok: false,
                    errorClass: "pending-transport" as const,
                    message: pushed.error || "Saved on this phone. Sharing can retry from More.",
                  };
                }
                return { ok: true, remoteRevision: household.revision };
              }
              : undefined,
        },
      });
      if (outcome.postedExactlyOnce || (outcome.postedNothing && !outcome.retryable)) {
        confirmationRef.current = null;
      }
      setHousehold(outcome.household);
      const pendingCount = listContinuityOutbox(environment).filter((item) => item.householdId === outcome.household.householdId).length;
      const autoMerged = outcome.kind === "accepted-local"
        && (outcome.household.conflicts ?? []).some((row) => row.autoMerged && row.resolved);
      const chrome = renderCommandSurface(outcome, {
        offline,
        pendingCount,
        lastError: outcome.household.sharing?.lastError ?? null,
        amountLabel: lastAmountLabelRef.current,
        ledgerName: outcome.household.name,
        autoMerged,
      });
      setCommandChrome(chrome);
      if (outcome.kind === "synchronized") {
        saveSyncAnchor(environment, outcome.household);
        if (automaticContinuity && continuityIdentity) {
          void flushContinuityOutbox({ environment, identity: continuityIdentity, config: cloudConfig }).catch(() => undefined);
        }
      }
      if (outcome.kind === "conflict-needs-attention" || unresolvedConflicts(outcome.household).length > 0) {
        setShowConflictSheet(true);
      }
      if (outcome.ok && token && chrome.toast?.showUndo !== false && outcome.kind !== "conflict-needs-attention") {
        setToast(token);
        setHistory((current) => [...current, token].slice(-20));
        window.setTimeout(() => setToast((item) => (item?.id === token.id ? null : item)), 8000);
      } else if (!outcome.ok || outcome.kind === "conflict-needs-attention") {
        setToast(null);
      }
      if (!outcome.ok && outcome.userMessage) {
        setError(outcome.userMessage);
      } else if (outcome.ok && outcome.kind !== "conflict-needs-attention") {
        setError("");
      }
      if (outcome.kind === "synchronized") setSyncState("synced");
      else if (outcome.kind === "pending-transport") setSyncState("syncing");
      else if (outcome.kind === "conflict-needs-attention") setSyncState("error");
      else if (outcome.ok) setSyncState("idle");
      if (outcome.ok) {
        setBooksStatus({
          ok: true,
          engine: outcome.kind === "synchronized" ? "pglite+supabase" : "pglite",
          entryCount: outcome.household.transactions.length,
          inBalance: true,
          equationHolds: true,
          error: outcome.kind === "pending-transport" ? outcome.userMessage ?? undefined : undefined,
        });
      } else {
        setBooksStatus({
          ok: false,
          engine: "pglite",
          entryCount: previous?.transactions.length ?? 0,
          inBalance: outcome.errorClass !== "unbalanced-journal",
          equationHolds: outcome.errorClass !== "unbalanced-journal",
          error: outcome.userMessage ?? undefined,
        });
      }
      return outcome;
    } catch (caught) {
      if (caught instanceof NeedsConfirmationError) throw caught;
      setError(classifyCommandError(caught).userMessage);
      return null;
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
      if (environment === "development") {
        const anchor = loadSyncAnchor(environment, current.householdId);
        if (anchor) {
          lastAmountLabelRef.current = null;
          const outcome = await commitHousehold(anchor, token);
          if (!outcome || !outcome.postedExactlyOnce || outcome.kind === "conflict-needs-attention") return;
          setHistory((items) => items.filter((item) => item.id !== token.id));
          setToast(null);
          return;
        }
      }
      const latest = historyRef.current[historyRef.current.length - 1];
      if (latest && latest.id !== token.id) {
        setError("Undo the latest change first so the books stay in order.");
        return;
      }
      const outcome = await commitHousehold(undo(current, token));
      if (!outcome || !outcome.postedExactlyOnce || outcome.kind === "conflict-needs-attention") return;
      setHistory((items) => items.filter((item) => item.id !== token.id));
      setToast((item) => (item?.id === token.id ? null : item));
    });
  }

  async function revertToLastSync(label: string) {
    const current = householdRef.current;
    if (!current || environment !== "development") return;
    const anchor = loadSyncAnchor(environment, current.householdId);
    if (!anchor) {
      setError("No cloud-acknowledged copy yet. Post and sync first, or use Ledger when a sync exists.");
      return;
    }
    lastAmountLabelRef.current = null;
    await commitHousehold(anchor, { id: label, label, snapshot: anchor, postedIds: [] });
  }

  async function resolveConflictSide(side: "local" | "remote") {
    const current = householdRef.current;
    if (!current) return;
    const open = unresolvedConflicts(current)[0];
    if (!open) {
      setShowConflictSheet(false);
      return;
    }
    try {
      const next = resolveConflictChoice(current, open.id, side);
      await commitHousehold(next);
      setShowConflictSheet(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    }
  }

  function run(fn: (current: Household) => CommitResult) {
    if (postingRef.current) return Promise.resolve();
    postingRef.current = true;
    return enqueueWrite(async () => {
      const current = householdRef.current;
      if (!current) {
        postingRef.current = false;
        return;
      }
      setError("");
      try {
        const result = fn(current);
        if (result.postedIds.length && form.amount) {
          try {
            lastAmountLabelRef.current = formatCad(parseAmount(form.amount));
          } catch {
            lastAmountLabelRef.current = null;
          }
        }
        const outcome = await commitHousehold(result.household, result.undo);
        const accepted =
          outcome?.postedExactlyOnce === true &&
          (outcome.kind === "accepted-local" || outcome.kind === "pending-transport" || outcome.kind === "synchronized");
        if (!accepted) return;
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
      } finally {
        postingRef.current = false;
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
          <p className="kicker">CAD · Toronto books · two people</p>
          <img src="/hercules-mark.svg" alt="" />
          <h1>Hearth</h1>
          <p>
            Two phones. One journal. CAD. Toronto civil books. Each phone keeps its own clock. Hercules loafs while you post milk.
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
              onJoined={async (next) => { await persist(next); }}
              onBack={() => { setWelcomeMode("home"); setError(""); }}
            />
          ) : welcomeMode === "new" ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              try {
                const next = nameHouseholdLedgers(catalogHousehold(environment), newHouseholdDraft);
                void persist(next);
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              }
            }}>
              <label htmlFor="new-household-name">Household name</label>
              <input
                id="new-household-name"
                maxLength={80}
                value={newHouseholdDraft.householdName}
                onChange={(event) => setNewHouseholdDraft((current) => ({ ...current, householdName: event.target.value }))}
                placeholder="The Beaulne Household"
                autoFocus
              />
              <label htmlFor="new-shared-ledger-name">Shared ledger name</label>
              <input
                id="new-shared-ledger-name"
                maxLength={80}
                value={newHouseholdDraft.sharedLedgerName}
                onChange={(event) => setNewHouseholdDraft((current) => ({ ...current, sharedLedgerName: event.target.value }))}
                placeholder="Home Books"
              />
              <label htmlFor="new-personal-member">This Personal ledger belongs to</label>
              <select
                id="new-personal-member"
                value={newHouseholdDraft.personalMemberId}
                onChange={(event) => setNewHouseholdDraft((current) => ({ ...current, personalMemberId: event.target.value }))}
              >
                {catalogHousehold(environment).members.filter((member) => member.active).map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
              <label htmlFor="new-personal-ledger-name">Personal ledger name</label>
              <input
                id="new-personal-ledger-name"
                maxLength={80}
                value={newHouseholdDraft.personalLedgerName}
                onChange={(event) => setNewHouseholdDraft((current) => ({ ...current, personalLedgerName: event.target.value }))}
                placeholder="My Books"
              />
              {error && <p className="danger">{error}</p>}
              <button className="primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 12 }}>
                {busy ? "Creating…" : "Create household"}
              </button>
              <button className="ghost" type="button" style={{ width: "100%", marginTop: 8 }} onClick={() => { setWelcomeMode("home"); setError(""); }}>
                Back
              </button>
            </form>
          ) : (
            <>
              {googleConfigured() && (
                <button
                  className="primary"
                  style={{ width: "100%", marginBottom: 8 }}
                  disabled={busy}
                  onClick={() => void continueWithGoogle()}
                >
                  {busy ? "Finding your ledgers…" : "Continue with Google"}
                </button>
              )}
              {discoveredLedgers.map((found) => {
                const member = found.household.members.find((item) => item.id === found.memberId);
                return (
                  <button
                    key={found.household.householdId}
                    className="ghost"
                    style={{ width: "100%", marginBottom: 8 }}
                    disabled={busy}
                    onClick={() => void openDiscoveredLedger(found).catch((caught) => {
                      setError(caught instanceof Error ? caught.message : String(caught));
                    })}
                  >
                    Open {found.household.name} as {member?.name ?? "me"}
                  </button>
                );
              })}
              {error && <p className="danger">{error}</p>}
              <button className="primary" onClick={() => persist(seedDemoHousehold({ today, environment }))}>
                Open the demo kitchen table
              </button>
              <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => { setWelcomeMode("new"); setError(""); }}>
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
              onClick={() => void continueWithGoogle()}
            >
              Continue with Google
            </button>
          )}
          {discoveredLedgers.map((found) => {
            const member = found.household.members.find((item) => item.id === found.memberId);
            return (
              <button
                key={found.household.householdId}
                className="ghost"
                style={{ width: "100%", marginBottom: 8 }}
                disabled={busy}
                onClick={() => void openDiscoveredLedger(found).catch((caught) => {
                  setError(caught instanceof Error ? caught.message : String(caught));
                })}
              >
                Open {found.household.name} as {member?.name ?? "me"}
              </button>
            );
          })}
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
  const guidedWorkShift = mode === "shift"
    && (shiftGate === "signOut" || shiftGate === "finished")
    && ledger.workJobs.some((job) => job.active && job.memberId === actorId);

  const formForAccount = (accountId: string | null, extra: Partial<typeof emptyForm> = {}) => {
    const defaults = addFormDefaults(ledger, accountId);
    return {
      ...emptyFormForZone(booksZone),
      date: today,
      visibility: defaultVisibilityForView(view),
      memberId: actorId,
      accountId: defaults.accountId,
      fromAccountId: defaults.fromAccountId,
      toAccountId: defaults.toAccountId,
      ...extra,
    };
  };

  const clearLocationStamp = () => {
    setDraftLocation(undefined);
    setForm((current) => ({ ...current, occurredAt: "" }));
  };

  const stampCurrentTime = () => {
    const capturedAt = new Date();
    setForm((current) => ({
      ...current,
      date: todayKey(capturedAt, booksZone),
      occurredAt: capturedAt.toISOString(),
    }));
  };

  const stampCurrentCoords = () => {
    if (!placePrefs.locationAllowed) {
      setError("Turn on location services in More → Clock & place first.");
      return;
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("This phone cannot share location.");
      return;
    }
    setLocationBusy(true);
    setError("");
    const capturedAt = new Date();
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const stamp = shapeTransactionLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: capturedAt.toISOString(),
        });
        setDraftLocation(stamp);
        setForm((current) => ({
          ...current,
          place: current.place.trim()
            ? current.place
            : stamp
              ? locationLabel(stamp)
              : current.place,
        }));
        setLocationBusy(false);
      },
      (geoError) => {
        setLocationBusy(false);
        setError(geoError.message || "Could not read location.");
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  const applyConfiguredStamps = () => {
    if (placePrefs.stampTime) stampCurrentTime();
    if (placePrefs.stampCoords) stampCurrentCoords();
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
    setDraftLocation(undefined);
    setCategoryTouched(false);
    setCodingHint("");
    const prefs = loadPhonePlacePrefs(environment);
    if (!prefs.locationAllowed && !prefs.addPromptSeen) {
      setShowLocationPrompt(true);
      setPlacePrefs(savePhonePlacePrefs(environment, { addPromptSeen: true }));
    } else {
      setShowLocationPrompt(false);
    }
    if ((nextMode ?? defaults.suggestedMode) === "shift") {
      const punch = activeOpenShift(ledger.kitchen, actorId);
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
    workShiftInputRef.current = null;
    workShiftDateRef.current = today;
    const punch = activeOpenShift(ledger.kitchen, actorId);
    if (punch?.status === "open") void runKitchen((current) => clockOutShift(current, { memberId: actorId }));
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

  function beginFinishedShift(initialDate = today) {
    workShiftInputRef.current = null;
    workShiftDateRef.current = initialDate;
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
        occurredAt: form.occurredAt || undefined,
        location: draftLocation,
        splits: splitsFor(parseAmount(form.amount), current),
        confirmDuplicate: flags.confirmDuplicate,
        createdBy: actorId,
        visibility: form.visibility,
      });
    });
  }

  function submitWorkShift(input: PostWorkShiftInput, confirmDuplicate = false) {
    workShiftInputRef.current = input;
    run((current) => postWorkShift(current, { ...input, confirmDuplicate }));
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
        <span className="pill dev" aria-label="Development environment">Development</span>
      </header>
      {commandChrome?.chip && (
        <div
          className={`command-chip command-chip--${commandChrome.chip.tone}`}
          role="status"
        >
          <span>{commandChrome.chip.primary}</span>
          {commandChrome.chip.secondary && <span className="muted">{commandChrome.chip.secondary}</span>}
        </div>
      )}
      {commandChrome?.banner && (
        <div
          className={`command-banner command-banner--${commandChrome.banner.tone}`}
          role={commandChrome.banner.blocking ? "alert" : "status"}
        >
          <div>
            <strong>{commandChrome.banner.primary}</strong>
            {commandChrome.banner.secondary && <p className="muted">{commandChrome.banner.secondary}</p>}
          </div>
          {commandChrome.banner.actionLabel && (
            <button
              type="button"
              className="ghost command-banner__action"
              onClick={() => {
                if (commandChrome.banner?.actionLabel === "Review conflict") setShowConflictSheet(true);
                else if (commandChrome.banner?.actionLabel === "Review pending") setTab("more");
                else if (commandChrome.banner?.actionLabel === "Open recovery") setTab("more");
              }}
            >
              {commandChrome.banner.actionLabel}
            </button>
          )}
        </div>
      )}
      {replicas.length > 1 && (
        <label className="ledger-switcher">
          <span>Open ledger</span>
          <select
            aria-label="Open another ledger"
            value={household.householdId}
            disabled={busy}
            onChange={(event) => void switchLedger(event.target.value)}
          >
            {replicas.map((replica) => (
              <option key={replica.householdId} value={replica.householdId}>
                {replica.name} · revision {replica.revision}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="view-switch" role="tablist" aria-label="Ledger view">
        {(["household", "personal"] as LedgerView[]).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => rememberSession({ memberId: session.memberId, view: item, householdId: household.householdId })}
          >
            {ledgerNameForView(household, session.memberId, item)}
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
          onAbandonShift={() => { void runKitchen((current) => abandonOpenShift(current, { memberId: actorId })); }}
          onStartBreak={(kind) => { void runKitchen((current) => startShiftBreak(current, { memberId: actorId, kind })); }}
          onEndBreak={() => { void runKitchen((current) => endShiftBreak(current, { memberId: actorId })); }}
          onChooseShiftTimeline={(keepId) => { void runKitchen((current) => chooseOpenShiftTimeline(current, { memberId: actorId, keepId })); }}
          onSignOut={beginSignOut}
          onFinishedShift={beginFinishedShift}
          onPayCard={openPayCard}
          onOpenAccount={openWallet}
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
          onAskSaveRepeating={(draft, summary) => {
            setSaveRepeatingPostFirst(false);
            setGuard({ kind: "saveRepeating", draft, summary });
          }}
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
              <span className="muted">{recentChangesHeaderPill({
                environment,
                historyCount: history.length,
                hasSyncAnchor: Boolean(household && loadSyncAnchor(environment, household.householdId)),
              })}</span>
            </header>
            {history.length === 0 ? (
              <p className="muted">{recentChangesEmptyCopy(environment)}</p>
            ) : (
              [...history].reverse().map((item, index) => (
                <div className="row" key={item.id}>
                  <span>{item.label}</span>
                  {index === 0 ? (
                    <button className="chip" disabled={busy} onClick={() => void applyUndo(item)}>Undo</button>
                  ) : (
                    <span className="muted">{recentChangesOlderLabel(environment)}</span>
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
            onHousehold={async (next) => { await persist(next); }}
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
          <WorkJobsCard
            household={household}
            memberId={session.memberId}
            today={today}
            busy={busy}
            onAskSave={(job, summary) => setGuard({ kind: "saveWorkJob", job, summary })}
            onArchive={(jobId) => { void run((current) => archiveWorkJob(current, jobId)); }}
          />
          <WorkShiftHistoryCard
            household={household}
            memberId={session.memberId}
            busy={busy}
            onCorrect={(shift, transactionId) => setGuard({ kind: "correctShift", shift, transactionId })}
          />
          <WorkReportCard household={household} memberId={session.memberId} today={today} />
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
          <section className="card">
            <header><h2>Clock &amp; place</h2></header>
            <p className="muted">
              Books civil dates stay America/Toronto. This phone may show another clock zone. Location is optional and off until you enable it here.
            </p>
            <label htmlFor="phone-display-timezone">This phone’s clock</label>
            <select
              id="phone-display-timezone"
              value={displayZone}
              disabled={busy}
              onChange={(event) => {
                setPlacePrefs(savePhonePlacePrefs(environment, { displayTimeZone: event.target.value }));
              }}
            >
              {[displayZone, ...COMMON_TIME_ZONES].filter((item, index, all) => all.indexOf(item) === index).map((item) => (
                <option key={item} value={item}>{formatZoneLabel(item)}</option>
              ))}
            </select>
            <button
              type="button"
              className="ghost"
              style={{ width: "100%", marginTop: 8 }}
              disabled={busy}
              onClick={() => {
                setPlacePrefs(savePhonePlacePrefs(environment, { displayTimeZone: detectDeviceTimeZone() }));
              }}
            >
              Use this phone’s zone ({detectDeviceTimeZone()})
            </button>
            <label style={{ marginTop: 12 }}>
              <input
                type="checkbox"
                checked={placePrefs.locationAllowed}
                onChange={(event) => {
                  setPlacePrefs(savePhonePlacePrefs(environment, { locationAllowed: event.target.checked }));
                }}
              />
              {" "}Allow location services on this phone
            </label>
            <label style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={placePrefs.stampTime}
                disabled={!placePrefs.locationAllowed}
                onChange={(event) => {
                  setPlacePrefs(savePhonePlacePrefs(environment, { stampTime: event.target.checked }));
                }}
              />
              {" "}Default Add stamp: wall time
            </label>
            <label style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={placePrefs.stampCoords}
                disabled={!placePrefs.locationAllowed}
                onChange={(event) => {
                  setPlacePrefs(savePhonePlacePrefs(environment, { stampCoords: event.target.checked }));
                }}
              />
              {" "}Default Add stamp: coordinates
            </label>
            <label style={{ marginTop: 8 }}>
              <input
                type="checkbox"
                checked={placePrefs.shareCoordsWithModel}
                disabled={!placePrefs.locationAllowed}
                onChange={(event) => {
                  setPlacePrefs(savePhonePlacePrefs(environment, { shareCoordsWithModel: event.target.checked }));
                }}
              />
              {" "}Share coordinates with Hercules’ model
            </label>
            <p className="muted" style={{ marginTop: 8 }}>
              Hosted open Development still treats published snapshots as disclosed until Auth. Model sharing is off unless you check it.
            </p>
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
        <div
          className="sheet"
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-sheet-title"
          ref={addSheetRef}
        >
          <div className="sheet-inner">
            <div className="topbar">
              <h1 id="add-sheet-title">Add</h1>
              <button className="ghost" type="button" data-autofocus onClick={closeAdd}>Close</button>
            </div>
            <div className="tabs">
              {(["expense", "income", "shift", "transfer"] as AddMode[]).map((item) => (
                <button
                  key={item}
                  className={mode === item ? "active" : ""}
                  onClick={() => {
                    setMode(item);
                    if (item === "shift") {
                      const punch = activeOpenShift(household.kitchen, actorId);
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
                    <button type="button" className="chip" onClick={() => beginFinishedShift()}>Already off? Post a finished shift</button>
                  </>
                )}
                {shiftGate === "clocked" && (() => {
                  const punch = activeOpenShift(household.kitchen, actorId);
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
                          void runKitchen((current) => abandonOpenShift(current, { memberId: actorId }));
                          setAdding(false);
                        }}
                      >
                        Never mind
                      </button>
                    </>
                  );
                })()}
                {(shiftGate === "signOut" || shiftGate === "finished") && household.workJobs.some((job) => job.active && job.memberId === actorId) && (
                  <WorkShiftFlow
                    household={household}
                    memberId={actorId}
                    today={workShiftDateRef.current}
                    punch={activeOpenShift(household.kitchen, actorId)}
                    busy={busy}
                    onConfirm={(input) => submitWorkShift(input)}
                  />
                )}
                {(shiftGate === "signOut" || shiftGate === "finished") && !household.workJobs.some((job) => job.active && job.memberId === actorId) && (() => {
                  const fields = ceremonyFields(shiftGate);
                  const field = fields[shiftStep] ?? "hours";
                  const copy = ceremonyCopy(shiftGate, field);
                  const punch = activeOpenShift(household.kitchen, actorId);
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
            {!guidedWorkShift && <button type="button" className="chip" onClick={() => setAddDetails((open) => !open)}>
              {addDetails ? "Hide details" : "Date & place"}
            </button>}
            {!guidedWorkShift && addDetails && (
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
                    {showLocationPrompt && !placePrefs.locationAllowed && (
                      <div className="preview" style={{ marginTop: 8 }} role="dialog" aria-label="Location services">
                        <p>Allow location on this phone so Add can stamp real time and place?</p>
                        <div className="chips">
                          <button
                            type="button"
                            className="chip selected"
                            onClick={() => {
                              setPlacePrefs(savePhonePlacePrefs(environment, { locationAllowed: true, addPromptSeen: true }));
                              setShowLocationPrompt(false);
                            }}
                          >
                            Allow
                          </button>
                          <button
                            type="button"
                            className="chip"
                            onClick={() => {
                              setPlacePrefs(savePhonePlacePrefs(environment, { addPromptSeen: true }));
                              setShowLocationPrompt(false);
                            }}
                          >
                            Not now
                          </button>
                        </div>
                      </div>
                    )}
                    <div className="chips" style={{ marginTop: 8 }}>
                      <button
                        type="button"
                        className={`chip ${placePrefs.stampTime ? "selected" : ""}`}
                        disabled={busy || !placePrefs.locationAllowed}
                        onClick={() => setPlacePrefs(savePhonePlacePrefs(environment, { stampTime: !placePrefs.stampTime }))}
                      >
                        Stamp time
                      </button>
                      <button
                        type="button"
                        className={`chip ${placePrefs.stampCoords ? "selected" : ""}`}
                        disabled={busy || !placePrefs.locationAllowed}
                        onClick={() => setPlacePrefs(savePhonePlacePrefs(environment, { stampCoords: !placePrefs.stampCoords }))}
                      >
                        Stamp place
                      </button>
                      <button
                        type="button"
                        className="chip"
                        disabled={busy || locationBusy || !placePrefs.locationAllowed || (!placePrefs.stampTime && !placePrefs.stampCoords)}
                        onClick={applyConfiguredStamps}
                      >
                        {locationBusy ? "Locating…" : "Use now"}
                      </button>
                      {(draftLocation || form.occurredAt) && (
                        <button type="button" className="chip" disabled={busy || locationBusy} onClick={clearLocationStamp}>
                          Clear stamp
                        </button>
                      )}
                    </div>
                    {(form.occurredAt || draftLocation) && (
                      <p className="muted" style={{ marginTop: 8 }}>
                        {form.occurredAt ? formatZoneDateTime(form.occurredAt, displayZone) : formatZoneTime(new Date(), displayZone)}
                        {draftLocation ? ` · ${locationLabel(draftLocation)}` : ""}
                        {" · Confirm still posts"}
                      </p>
                    )}
                    {!placePrefs.locationAllowed && !showLocationPrompt && (
                      <p className="muted" style={{ marginTop: 8 }}>
                        Location is off. Enable it in More → Clock &amp; place.
                      </p>
                    )}
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
              <div className="preview warn" role="alert" tabIndex={-1} ref={confirmPanelRef}>
                <p>{confirm.message}</p>
                {confirm.matches.map((tx) => (
                  <div className="row" key={tx.id}>
                    <span>{tx.date} · {tx.place || tx.note || tx.type}</span>
                    <span>{formatCad(tx.amountCents)}</span>
                  </div>
                ))}
                <button className="primary" onClick={() => {
                  if (mode === "shift" && workShiftInputRef.current) submitWorkShift(workShiftInputRef.current, true);
                  else submit({ confirmDuplicate: true });
                }}>
                  Add anyway
                </button>
              </div>
            )}
            {!(mode === "shift" && (shiftGate === "choose" || shiftGate === "clocked" || ((shiftGate === "signOut" || shiftGate === "finished") && household.workJobs.some((job) => job.active && job.memberId === actorId)))) && (
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
                await clearHousehold(environment, household.householdId);
                clearSession(environment);
                setSession(null);
                const remaining = await listHouseholdReplicas(environment);
                setReplicas(remaining);
                setHousehold(remaining[0] ? await loadHousehold(environment, remaining[0].householdId) : null);
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
          title={environment === "development" ? "Revert to last sync?" : "Reverse this row?"}
          body={environment === "development"
            ? `${guard.summary} This restores the last cloud-acknowledged copy on this phone. Changes since that sync go away — not a second journal row.`
            : `${guard.summary} Both the original and the reversing entry stay. Undo from the toast or More → Recent changes.`}
          confirmLabel={environment === "development" ? "Revert to last sync" : "Reverse"}
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.transactionId;
            setGuard(null);
            if (environment === "development") {
              void revertToLastSync(`revert-${id}`);
              return;
            }
            const current = householdRef.current;
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
      {guard?.kind === "correctShift" && (
        <ConfirmSheet
          title="Replace this shift?"
          body={`Hearth will reverse the ${guard.shift.date} shift in the books, then open a fresh shift form with that date. The old evidence stays balanced underneath and Shifts worked will label it replaced.`}
          confirmLabel="Reverse & add correction"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const { shift, transactionId } = guard;
            setGuard(null);
            void run((current) => reversePostedMoney(current, transactionId, { createdBy: actorId }))
              .then(() => beginFinishedShift(shift.date));
          }}
        />
      )}
      {guard?.kind === "duePreview" && (
        <DuePreviewSheet
          rows={guard.rows}
          onDismiss={() => {
            dismissDuePreview(environment, household.householdId, today);
            setGuard(null);
          }}
          onReview={(row) => {
            dismissDuePreview(environment, household.householdId, today);
            setGuard({ kind: "postRecurrence", recurrenceId: row.recurrenceId, summary: row.summary });
          }}
          onReviewAll={(rows) => {
            dismissDuePreview(environment, household.householdId, today);
            setGuard({
              kind: "postDueAll",
              summary: `This posts ${rows.length} due repeating ${rows.length === 1 ? "item" : "items"} into the books.`,
            });
          }}
        />
      )}
      {guard?.kind === "postRecurrence" && (
        <ConfirmSheet
          title="Post this repeating item?"
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
      {guard?.kind === "saveRepeating" && (
        <ConfirmSheet
          title={guard.draft.id ? "Save repeating changes?" : "Save repeating item?"}
          body={guard.summary}
          extra="Unchecked = reminder only. Checked = also post this occurrence into the books, then advance the next date."
          confirmLabel={saveRepeatingPostFirst ? "Save and post" : "Save reminder"}
          busy={busy}
          option={{
            id: "post-first",
            label: `Also post ${guard.draft.amount ? `$${guard.draft.amount}` : "this amount"} on ${guard.draft.nextDate} now`,
            checked: saveRepeatingPostFirst,
            onChange: setSaveRepeatingPostFirst,
          }}
          onCancel={() => {
            setGuard(null);
            setSaveRepeatingPostFirst(false);
          }}
          onConfirm={() => {
            const draft = guard.draft;
            const postFirst = saveRepeatingPostFirst;
            setGuard(null);
            setSaveRepeatingPostFirst(false);
            void run((current) => {
              const input = {
                cadence: draft.cadence,
                nextDate: draft.nextDate,
                type: draft.type,
                amount: draft.amount,
                accountId: draft.accountId,
                transferToAccountId: draft.type === "transfer" ? draft.transferToAccountId : null,
                goalId: draft.type === "transfer" && draft.goalId ? draft.goalId : null,
                subcategoryId: draft.type === "transfer" ? undefined : draft.subcategoryId,
                note: draft.note.trim(),
                kind: draft.kind,
              };
              const saved = draft.id
                ? updateRecurrence(current, { id: draft.id, ...input })
                : addRecurrence(current, { ...input, origin: "manual" as const });
              if (!postFirst) return saved;
              const recurrenceId = draft.id ?? saved.postedIds[0];
              if (!recurrenceId) return saved;
              return postOneRecurrence(saved.household, recurrenceId, today, { allowNotDue: true });
            });
          }}
        />
      )}
      {guard?.kind === "saveWorkJob" && (
        <ConfirmSheet
          title="Save this job setup?"
          body={guard.summary}
          extra="This creates or updates employer rules and owed-to-you accounts. It does not post wages, tips, sales, or a shift. Existing confirmed shifts stay unchanged."
          confirmLabel="Save job"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const job = guard.job;
            setGuard(null);
            void run((current) => upsertWorkJob(current, { job }));
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

      <p className="sr-only" role="status" aria-live="polite">
        {commandChrome?.liveAnnouncement ?? ""}
      </p>

      {toast && commandChrome?.toast && (
        <div className="toast">
          <span>
            {commandChrome.toast.primary}
            {commandChrome.toast.secondary ? `. ${commandChrome.toast.secondary}` : ""}
            {commandChrome.toast.showUndo !== false ? " You can undo to last sync, or find it later under More." : ""}
          </span>
          {commandChrome.toast.showUndo !== false && (
            <button
              className="ghost"
              style={{ color: "var(--paper)" }}
              type="button"
              onClick={() => void applyUndo(toast)}
            >
              {environment === "development" ? "Undo to last sync" : "Undo"}
            </button>
          )}
        </div>
      )}

      {showConflictSheet && unresolvedConflicts(household).length > 0 && (
        <ConflictResolution
          household={household}
          busy={busy}
          onChoose={(side) => void resolveConflictSide(side)}
          onExport={() => {
            try {
              const bundle = makeConflictBundle(household);
              const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `hearth-conflict-${household.householdId}.json`;
              link.click();
              URL.revokeObjectURL(url);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : String(caught));
            }
          }}
          onDismiss={() => setShowConflictSheet(false)}
        />
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

      <nav className="nav" aria-label="Hearth">
        <button
          className={tab === "home" && !adding ? "active" : ""}
          aria-current={tab === "home" && !adding ? "page" : undefined}
          onClick={() => goTab("home")}
        >
          Home
        </button>
        <button
          className={tab === "calendar" ? "active" : ""}
          aria-current={tab === "calendar" ? "page" : undefined}
          onClick={() => goTab("calendar")}
        >
          Calendar
        </button>
        <button className="fab" type="button" aria-label="Add money" onClick={() => openAddFor(null)}>+</button>
        <button
          className={tab === "plan" ? "active" : ""}
          aria-current={tab === "plan" ? "page" : undefined}
          onClick={() => goTab("plan")}
        >
          Plan
        </button>
        <button
          className={tab === "ledger" ? "active" : ""}
          aria-current={tab === "ledger" ? "page" : undefined}
          onClick={() => goTab("ledger")}
        >
          Books
        </button>
        <button
          className={tab === "more" ? "active" : ""}
          aria-current={tab === "more" ? "page" : undefined}
          onClick={() => goTab("more")}
        >
          More
        </button>
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
