import { useEffect, useMemo, useRef, useState } from "react";
import {
  JOINT,
  NeedsConfirmationError,
  ValidationError,
  addFormDefaults,
  buildDashboard,
  calcShiftAmounts,
  catalogHousehold,
  centsDigitsFromDollars,
  createWriteQueue,
  creditCardView,
  defaultVisibilityForView,
  emitOfficeIntent,
  formatCad,
  describeDeviceLabel,
  localDeviceId,
  touchHouseholdDevice,
  householdForView,
  ledgerNameForView,
  ledgerRouteContract,
  kitchenPrimaryNav,
  showsLedgerPurposeBanner,
  projectLedgerExperience,
  restoreAcceptedSnapshot,
  setBudget,
  nameHouseholdLedgers,
  linkGoogleIdentity,
  assembleHousehold,
  splitForSync,
  householdWallet,
  jointSplit,
  memberNeedsGoogleStepUp,
  parseAmount,
  percentSplits,
  projectHouseholdFund,
  postDueRecurrences,
  postEntry,
  postOneRecurrence,
  addRecurrence,
  updateRecurrence,
  postShift,
  postWorkShift,
  refreshSevenShiftsSchedule,
  buildAutomatedWorkShiftInput,
  automationPayrollWeekStart,
  reconcileWorkWeekFromEvidence,
  addDays,
  workShiftIsReversed,
  findReceipt,
  postTransfer,
  postVisit,
  settleClaim,
  writeOffClaim,
  acceptVisitGoal,
  acceptPresetNotice,
  addPreset,
  archivePreset,
  dismissNotice,
  dismissDuePreview,
  duePreviewDismissed,
  dueRecurrencePreview,
  readClinkOn,
  requestCalendarPane,
  seedDemoHousehold,
  seedStressHousehold,
  eraseDevelopmentData,
  shiftSettingsFingerprint,
  archiveWorkJob,
  upsertWorkJob,
  todayKey,
  monthKeyFromDateKey,
  TIMEZONE,
  detectDeviceTimeZone,
  COMMON_TIME_ZONES,
  formatZoneLabel,
  loadPhonePlacePrefs,
  savePhonePlacePrefs,
  locationLabel,
  shapeTransactionLocation,
  touchGoogleConfirmation,
  touchVisitSpark,
  undoLedgerConfirm,
  assertLatestMemberLedgerUndo,
  appendRestorePoint,
  applyRestorePoint,
  canRestorePoint,
  listRestorePoints,
  restoreConfirmBody,
  reversePostedMoney,
  autoResolveSharedConflict,
  canAbsorbDisjointSharedMoney,
  absorbDisjointSharedMoney,
  unresolvedConflicts,
  markSynchronized,
  markPendingTransport,
  clockInShift,
  chooseOpenShiftTimeline,
  clockOutShift,
  startShiftBreak,
  endShiftBreak,
  abandonOpenShift,
  activeOpenShift,
  collapseSavedOffice,
  formatPreviewHours,
  previewHoursQuarter,
  type ShiftGate,
  type Shift,
  type WorkJob,
  type CommitResult,
  type CommandOutcome,
  type Environment,
  type Household,
  type PersonalEnvelope,
  type LedgerView,
  type MonthKey,
  type Split,
  type UndoToken,
  type Visibility,
  type Account,
  type CategoryActual,
  type VisitPostDraft,
  type TransactionLocation,
  type HerculesNumberSource,
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
import { wipeLocalDevelopmentCopies } from "./resetDevelopmentLocal.ts";
import { clearSession, loadSession, saveSession, type Session } from "./session.ts";
import { joinSharedHousehold, reconcileHousehold, reconcileHouseholdSnapshots } from "./api.ts";
import { acceptHouseholdWrite, classifyCommandError, newConfirmationId, isLedgerWrite } from "./core/index.ts";
import type { WriteAdapters } from "./core/commandRuntime.ts";
import { ingestHouseholdBooks, inspectBrowserBooks, restoreHouseholdBooks, type BooksStatus } from "./ledger/engine.ts";
import { readSupabaseConfig, pullHouseholdSnapshotById, pullPersonalSnapshotById, fetchContinuityMembershipRole, listActiveContinuityMemberships } from "./ledger/supabase.ts";
import { undoToastSecondaryCopy } from "./core/commandClassification.ts";
import { livePullIntervalMs, shouldRunLivePull } from "./continuityLivePull.ts";
import {
  createContinuityCoordinator,
  shouldIgnoreInboundSnapshot,
  type ContinuitySyncSource,
} from "./continuityCoordinator.ts";
import {
  createContinuityResumeGate,
  isUnhealthyRealtimeStatus,
  reconnectPollDelayMs,
} from "./continuityResume.ts";
import {
  attachContinuityRealtime,
  canAttachContinuityRealtime,
  shouldUsePollFallback,
  type ContinuityRealtimeStatus,
} from "./continuityRealtime.ts";
import { continuityRealtimeTransportEnabled } from "./continuityRealtimePolicy.ts";
import { continuityCommandLogEnabled } from "./ledger/continuityCommandLog.ts";
import {
  applyCommandEventLocally,
  type ContinuityCommandEvent,
} from "./ledger/materializeSnapshotFromEvents.ts";
import { clearUndoHistory, loadUndoHistory, saveUndoHistory } from "./undoHistory.ts";
import {
  authenticatedSupabaseConfig,
  clearSupabaseSession,
  consumeSupabaseAuthRedirect,
  ensureSupabaseSession,
  loadSupabaseSession,
  readHearthAuthConfig,
  startSupabaseGoogleSignIn,
  supabaseAuthEnabled,
} from "./auth/supabaseSession.ts";
import {
  clearContinuityOutboxConflictBlocks,
  clearContinuityOutboxForHousehold,
  continuityMemberId,
  discoverContinuityMemberships,
  flushContinuityOutbox,
  hydrateContinuityOutbox,
  hostedContinuityAllowed,
  humanizeContinuityError,
  listContinuityOutbox,
  productionContinuityEnabled,
  transportHouseholdWithOutbox,
  type ContinuityIdentity,
} from "./continuity.ts";

function makeBooksAdapters(input: {
  environment: import("./core/types.ts").Environment;
  memberId?: string;
  continuityIdentity?: ContinuityIdentity | null;
  transport?: WriteAdapters["transport"];
}): WriteAdapters {
  return {
    persist: (household) => saveHousehold(household, {
      operatingEnvironment: input.environment,
      memberId: input.memberId,
      continuityIdentity: input.continuityIdentity ?? undefined,
    }),
    ingest: async (household) => {
      try {
        const { status } = await ingestHouseholdBooks(household);
        return { ok: status.ok, error: status.error };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    verifyBooks: async (household) => {
      try {
        const inspection = await inspectBrowserBooks(household);
        return { ok: inspection.ok, error: inspection.ok ? undefined : inspection.message };
      } catch (caught) {
        return { ok: false, error: caught instanceof Error ? caught.message : String(caught) };
      }
    },
    restoreIngest: async (household) => {
      await restoreHouseholdBooks(household);
    },
    transport: input.transport,
  };
}
import { inviteFromLocation } from "./core/invite.ts";
import { authInviteFromLocation, authInviteTokenFromText, isAuthInviteToken, savePendingAuthInvite, loadPendingAuthInvite, clearPendingAuthInvite } from "./core/authInvite.ts";
import { PairingCard, WelcomeJoin } from "./Pairing.tsx";
import { WelcomeQrScanner } from "./WelcomeQrScanner.tsx";
import { inviteReasonMessage, redeemHouseholdInvite, bindGoogleMemberships, leaveOrDeleteHousehold, resetDevelopmentHouseholds } from "./ledger/householdInvites.ts";
import { BooksPage } from "./Books.tsx";
import { ConfirmSheet } from "./Confirm.tsx";
import type { RepeatingDraft } from "./RepeatingForm.tsx";
import type { WorkShiftDraft } from "./WorkShiftFlow.tsx";
import { WorkShiftPage } from "./WorkShiftPage.tsx";
import { resolveDuplicateRetry } from "./shiftDuplicateRetry.ts";
import { ShiftReportScanBar } from "./ShiftReportScan.tsx";
import { loadDocumentVisionProvider } from "./imports/documentScanProvider.ts";
import { scanShiftReportFile } from "./imports/shiftReportDraft.ts";
import { WorkShiftWithSevenShifts } from "./WorkShiftWithSevenShifts.tsx";
import { createShiftScanScope } from "./shiftScanScope.ts";
import {
  acknowledgeEvidenceAutomationJob,
  claimEvidenceAutomationJob,
  failEvidenceAutomationJob,
  listEvidenceBundles,
  readEvidenceStatus,
  validateEvidenceAutomationJob,
  type EvidenceScope,
} from "./imports/evidenceClient.ts";
import {
  runScopedWorkShift,
  workShiftScopeMatches,
  WORK_SHIFT_SCOPE_ERROR,
  type ScopedWorkShiftInput,
} from "./workShiftScope.ts";
import { DuePreviewSheet } from "./DuePreviewSheet.tsx";
import {
  renderCommandChrome,
  renderCommandSurface,
  type CommandChromeResult,
} from "./commandSurface.tsx";
import { COMMAND_SURFACE_FIXTURES } from "./claude/commandContract.ts";
import { CommandProgressStatus } from "./CommandProgressStatus.tsx";
import {
  buildCommandProgress,
  commandProgressPhaseAfterOutcome,
  type CommandProgressPhase,
} from "./commandProgress.ts";
import { clearSyncAnchor, saveSyncAnchor } from "./syncAnchor.ts";
import { SyncFreshnessStatus } from "./SyncFreshnessStatus.tsx";
import { KitchenNotice } from "./KitchenNotice.tsx";
import { SoftPresenceStatus } from "./SoftPresenceStatus.tsx";
import {
  buildSoftPresenceDisplay,
  canAdvertiseSoftPresence,
  deactivateLocalDevice,
  isSoftPresenceOptedOut,
  setSoftPresenceOptOut,
  SOFT_PRESENCE_TOUCH_THROTTLE_MS,
  type SoftPresenceLiveRow,
} from "./softPresence.ts";
import { attachSoftPresenceRealtime, softPresenceRealtimeEnabled } from "./softPresenceRealtime.ts";
import { buildSyncFreshness, sharedHouseholdFreshnessCopy, suppressesCommandSyncChrome } from "./syncFreshness.ts";
import {
  recentChangesEmptyCopy,
  recentChangesHeaderPill,
  recentChangesOlderLabel,
  restorePointsEmptyCopy,
  restorePointsHeaderPill,
} from "./recentChangesCopy.ts";
import { useDialog } from "./useDialog.ts";
import { CalendarPage } from "./Calendar.tsx";
import { Office } from "./Office.tsx";
import { LedgerPurposeBanner } from "./LedgerPurposeBanner.tsx";
import { HerculesPresence } from "./Hercules.tsx";
import { HerculesProApproval, HerculesProPermissionsCard, herculesProAuthorizationRequest } from "./HerculesPro.tsx";
import { AddSlideshow, type AddFormFields, type AddMode } from "./AddSlideshow.tsx";
import { AddCategoryForm } from "./AddCategoryForm.tsx";
import { defaultSubcategoryForMode } from "./addSlideshow.ts";
import { FabSpeedDial } from "./FabSpeedDial.tsx";
import { SitDownGuide } from "./SitDownGuide.tsx";
import { KittyBanks } from "./KittyBanks.tsx";
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

type Tab = "home" | "plan" | "calendar" | "shift" | "ledger" | "more";
type WelcomeGoogleIntent = "create" | "login";
type WelcomeIdentity = ContinuityIdentity & { displayName: string; grantedScopes: string[] };
const WELCOME_GOOGLE_INTENT_KEY = "hearth:welcome-google-intent:v1";

function rememberWelcomeGoogleIntent(intent: WelcomeGoogleIntent | null): void {
  try {
    if (intent) sessionStorage.setItem(WELCOME_GOOGLE_INTENT_KEY, intent);
    else sessionStorage.removeItem(WELCOME_GOOGLE_INTENT_KEY);
  } catch {
    // OAuth intent is convenience state; the visible entry choices remain available.
  }
}

function loadWelcomeGoogleIntent(): WelcomeGoogleIntent | null {
  try {
    const value = sessionStorage.getItem(WELCOME_GOOGLE_INTENT_KEY);
    return value === "create" || value === "login" ? value : null;
  } catch {
    return null;
  }
}
type Guard =
  | { kind: "environment"; next: Environment }
  | { kind: "stress-random" }
  | { kind: "stress-pretty" }
  | { kind: "erase-development" }
  | { kind: "clear-this-phone" }
  | { kind: "reset-development" }
  | { kind: "remove"; transactionId: string; summary: string }
  | { kind: "correctShift"; shift: Shift; transactionId: string }
  | { kind: "duePreview"; rows: ReturnType<typeof dueRecurrencePreview> }
  | { kind: "postRecurrence"; recurrenceId: string; summary: string }
  | { kind: "saveRepeating"; draft: RepeatingDraft; summary: string }
  | { kind: "saveWorkJob"; job: WorkJob; summary: string }
  | { kind: "postDueAll"; summary: string; recurrenceIds: string[] }
  | { kind: "postVisit"; draft: VisitPostDraft; summary: string }
  | { kind: "settleClaim"; claimId: string; summary: string }
  | { kind: "writeOffClaim"; claimId: string; summary: string }
  | { kind: "acceptVisitGoal"; appointmentId: string; summary: string }
  | { kind: "acceptPreset"; key: string; summary: string }
  | { kind: "addPreset"; summary: string }
  | { kind: "restorePoint"; pointId: string; summary: string }
  | { kind: "delete-household"; householdId: string; name: string; memberId: string; role: "owner" | "member" | null };

const emptyForm: AddFormFields = {
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
  customersServed: "40",
  staffingCount: "4",
  eventTag: "regular",
  visibility: "household" as Visibility,
  occurredAt: "" as string,
  useHouseholdFund: false,
  fundedAmount: "",
  fundDestinationAccountId: "ACC-VISA",
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
  const [herculesProRequest] = useState(() => herculesProAuthorizationRequest());
  const [household, setHousehold] = useState<Household | null>(null);
  const [booting, setBooting] = useState(true);
  const [tab, setTab] = useState<Tab>("home");
  const [adding, setAdding] = useState(false);
  const [addSlide, setAddSlide] = useState(0);
  const [fabOpen, setFabOpen] = useState(false);
  const workShiftInputRef = useRef<ScopedWorkShiftInput | null>(null);
  const shiftScanScopeRef = useRef(createShiftScanScope());
  const confirmPanelRef = useRef<HTMLDivElement | null>(null);
  const lastAmountLabelRef = useRef<string | null>(null);

  const closeAdd = () => {
    workShiftInputRef.current = null;
    shiftScanScopeRef.current.cancel();
    setWorkShiftDraft(null);
    setShiftScanBusy(false);
    setShiftScanError("");
    setShiftScanWarnings([]);
    setAdding(false);
    setAddSlide(0);
    setConfirm(null);
    setError("");
    setDraftLocation(undefined);
    setLocationBusy(false);
  };
  const addSheetRef = useDialog(adding, closeAdd);

  const [mode, setMode] = useState<AddMode>("expense");
  const [form, setForm] = useState(emptyForm);
  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
  const [herculesSourceFocus, setHerculesSourceFocus] = useState<HerculesNumberSource | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<NeedsConfirmationError | null>(null);
  const [toast, setToast] = useState<UndoToken | null>(null);
  const [history, setHistory] = useState<UndoToken[]>([]);
  const [isHouseholdOwner, setIsHouseholdOwner] = useState(false);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [saveRepeatingPostFirst, setSaveRepeatingPostFirst] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [splitPercents, setSplitPercents] = useState<Record<string, number>>({ "MEM-001": 50, "MEM-002": 50 });
  const [now] = useState(() => new Date());
  const [session, setSession] = useState<Session | null>(null);
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;
  const [replicas, setReplicas] = useState<HouseholdReplicaSummary[]>([]);
  const [personalReplica, setPersonalReplica] = useState<PersonalEnvelope | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [realtimeStatus, setRealtimeStatus] = useState<ContinuityRealtimeStatus | null>(null);
  const [lastReconcile, setLastReconcile] = useState<{
    at: string;
    source: ContinuitySyncSource;
    revision: number;
  } | null>(null);
  const [commandChrome, setCommandChrome] = useState<CommandChromeResult | null>(null);
  const [commandProgressPhase, setCommandProgressPhase] = useState<CommandProgressPhase>("idle");
  const [softPresenceLive, setSoftPresenceLive] = useState<SoftPresenceLiveRow[]>([]);
  const [softPresenceOptOut, setSoftPresenceOptOutState] = useState(() => isSoftPresenceOptedOut("development"));
  const softPresenceTouchAtRef = useRef(0);
  const [offline, setOffline] = useState(() => typeof navigator !== "undefined" && !navigator.onLine);
  const [discoveredLedgers, setDiscoveredLedgers] = useState<DiscoveredHousehold[]>([]);
  const [supabaseAuthReturned, setSupabaseAuthReturned] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [pendingAuthInvite, setPendingAuthInvite] = useState<string | null>(null);
  const [welcomeMode, setWelcomeMode] = useState<"home" | "join" | "qr" | "new">("home");
  const [welcomeIdentity, setWelcomeIdentity] = useState<WelcomeIdentity | null>(null);
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
  const evidenceAutomationRef = useRef(false);
  const workShiftDateRef = useRef(todayKey());
  const duePreviewOffered = useRef<string | null>(null);
  const [workShiftDraft, setWorkShiftDraft] = useState<WorkShiftDraft | null>(null);
  const [shiftScanBusy, setShiftScanBusy] = useState(false);
  const [shiftScanError, setShiftScanError] = useState("");
  const [shiftScanWarnings, setShiftScanWarnings] = useState<string[]>([]);

  async function applyShiftReportScan(file: File | undefined) {
    if (!file) return;
    const scan = shiftScanScopeRef.current.begin();
    setShiftScanBusy(true);
    setShiftScanError("");
    setShiftScanWarnings([]);
    try {
      const mapped = await scanShiftReportFile(file, fetch, scan.signal, loadDocumentVisionProvider());
      if (!scan.isCurrent()) return;
      if (!mapped.draft) {
        setShiftScanError(mapped.error || "That photo could not draft a shift.");
        setShiftScanWarnings(mapped.warnings);
        return;
      }
      setWorkShiftDraft(mapped.draft);
      setShiftScanWarnings(mapped.warnings);
    } catch (caught) {
      if (!scan.isCurrent()) return;
      setShiftScanError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (scan.isCurrent()) setShiftScanBusy(false);
    }
  }

  const addScopeKey = `${environment}:${household?.householdId ?? ""}:${session?.memberId ?? ""}`;
  const previousAddScopeRef = useRef(addScopeKey);

  useEffect(() => {
    if (previousAddScopeRef.current === addScopeKey) return;
    previousAddScopeRef.current = addScopeKey;
    closeAdd();
  }, [addScopeKey]);

  function rememberUndoHistory(next: UndoToken[]) {
    setHistory(next);
    const hid = householdRef.current?.householdId;
    const mid = session?.memberId;
    if (hid && mid) saveUndoHistory(environment, hid, mid, next);
  }

  async function retryShareNow() {
    const who = session?.memberId;
    const current = householdRef.current;
    if (!who || !current) {
      setTab("more");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
      const google = loadGoogleSession(environment, who);
      const identity: ContinuityIdentity | null = authSession
        ? { email: authSession.email, subject: authSession.googleSubject }
        : google?.identity
          ? { email: google.identity.email, subject: google.identity.subject }
          : null;
      if (!identity || (!identity.email && !identity.subject)) {
        setError("Sign in with Google before retrying share.");
        setTab("more");
        return;
      }
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      setSyncState("syncing");
      const flushed = await flushContinuityOutbox({
        environment,
        identity,
        config: cloudConfig,
        force: true,
        liveHousehold: current,
        expectedRevision: current.baseRevision ?? 0,
        confirmationId: `retry-share-${current.householdId}-${current.revision}`,
      });
      if (flushed.conflicts[0]) {
        setSyncState("error");
        setError(flushed.conflicts[0].message);
        return;
      }
      if (flushed.synchronized > 0) {
        const synced = markSynchronized(current);
        await saveHousehold(synced, { operatingEnvironment: environment, memberId: who });
        householdRef.current = synced;
        setHousehold(synced);
        setSyncState("synced");
        setCommandChrome(null);
        setError("");
        return;
      }
      const pendingItem = listContinuityOutbox(environment).find((item) => item.householdId === current.householdId);
      const pendingMessage = humanizeContinuityError(
        pendingItem?.lastError
        || (flushed.pending > 0
          ? "Saved on this phone. Sharing can retry from More."
          : "Nothing was waiting to share. Confirm Google sign-in, then post or Retry again."),
      );
      const pending = markPendingTransport(current, pendingMessage);
      await saveHousehold(pending, { operatingEnvironment: environment, memberId: who });
      householdRef.current = pending;
      setHousehold(pending);
      setSyncState(typeof navigator !== "undefined" && !navigator.onLine ? "syncing" : "error");
      setError(pendingMessage);
      setCommandChrome(renderCommandSurface(
        {
          kind: "pending-transport",
          ok: true,
          household: pending,
          previous: pending,
          postedIds: [],
          confirmationId: `retry-share-${pending.householdId}`,
          identityHash: null,
          revision: pending.revision,
          sharingMode: "pending-transport",
          errorClass: "pending-transport",
          userMessage: pendingMessage,
          retryable: true,
          recoveryAvailable: false,
          postedExactlyOnce: false,
          postedNothing: true,
        },
        {
          offline: typeof navigator !== "undefined" && !navigator.onLine,
          pendingCount: listContinuityOutbox(environment).filter((item) => item.householdId === pending.householdId).length,
          lastError: pendingMessage,
          ledgerName: pending.name,
          ledgerWrite: false,
        },
      ));
    } catch (caught) {
      setSyncState("error");
      setError(humanizeContinuityError(caught));
    } finally {
      setBusy(false);
    }
  }

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
    const stored = loadPendingAuthInvite();
    if (stored) {
      setPendingAuthInvite(stored.token);
      setInviteInput(stored.token);
      if (stored.environment !== environment) setEnvironment(stored.environment);
      setWelcomeMode("join");
    }
    const authInvite = authInviteFromLocation(window.location.href);
    if (authInvite) {
      const env = authInvite.environment ?? environment;
      setInviteInput(authInvite.token);
      setPendingAuthInvite(authInvite.token);
      savePendingAuthInvite({ token: authInvite.token, environment: env });
      if (authInvite.environment && authInvite.environment !== environment) {
        setEnvironment(authInvite.environment);
      }
      setWelcomeMode("join");
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      url.searchParams.delete("env");
      if (url.pathname === "/join") url.pathname = "/";
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
      window.history.replaceState({}, "", next);
      return;
    }
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
    sessionRef.current = loadedSession;
    setSession(loadedSession);
    void hydrateContinuityOutbox(environment);
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
            adapters: makeBooksAdapters({
              environment,
              memberId: loadedSession.memberId,
            }),
          });
          if (!live) return;
          current = accepted.household;
          if (!accepted.ok && accepted.userMessage) setError(accepted.userMessage);
        } catch {
          if (!live) return;
        }
      }
      setHousehold(current);
      if (current && loadedSession?.memberId) {
        setHistory(loadUndoHistory(environment, current.householdId, loadedSession.memberId, current));
      } else {
        setHistory([]);
      }
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
              inspection.issue === "incomplete-migration"
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
            // projection-mismatch / interrupted-transaction / invalid-stored-data: fail closed.
            // Do not silently re-ingest mismatched money JSON into PGlite.
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
    setSoftPresenceOptOutState(isSoftPresenceOptedOut(environment));
  }, [environment]);

  useEffect(() => {
    if (!household) return;
    touchVisitSpark(environment, todayKey());
    setClinkOn(readClinkOn(environment));
    const memberId = session?.memberId ?? null;
    const signedIn = Boolean(
      memberId && (
        loadGoogleSession(environment, memberId)
        || (supabaseAuthEnabled() && loadSupabaseSession(environment))
      ),
    );
    if (!canAdvertiseSoftPresence({ signedIn, memberId, environment, optedOut: softPresenceOptOut })) {
      return;
    }
    const now = Date.now();
    if (now - softPresenceTouchAtRef.current < SOFT_PRESENCE_TOUCH_THROTTLE_MS) return;
    const deviceId = localDeviceId();
    try {
      softPresenceTouchAtRef.current = now;
      const touched = touchHouseholdDevice(household, {
        deviceId,
        label: describeDeviceLabel(),
        memberId,
      });
      let next = touched.household;
      const who = memberId ?? undefined;
      void saveHousehold(next, { operatingEnvironment: environment, memberId: who }).then(() => {
        if (householdRef.current?.householdId === next.householdId) {
          householdRef.current = next;
          setHousehold(next);
        }
      });
      // Durable soft presence rides the next continuity flush when linked + signed in.
      if (next.linked && hostedContinuityAllowed(environment) && memberId) {
        const googleSession = loadGoogleSession(environment, memberId);
        const authSession = supabaseAuthEnabled() ? loadSupabaseSession(environment) : null;
        const identity: ContinuityIdentity | null = authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : googleSession?.identity
            ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
            : null;
        if (identity) {
          next = markPendingTransport({
            ...next,
            revision: (next.revision ?? 0) + 1,
          });
          void saveHousehold(next, { operatingEnvironment: environment, memberId: who }).then(() => {
            if (householdRef.current?.householdId === next.householdId) {
              householdRef.current = next;
              setHousehold(next);
            }
          });
          const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
          void transportHouseholdWithOutbox({
            household: next,
            identity,
            expectedRevision: next.baseRevision ?? (next.revision - 1),
            confirmationId: `presence-${next.householdId}-${deviceId}-${now}`,
            config: cloudConfig,
            flush: true,
          }).then(async (pushed) => {
            if (!pushed.ok) return;
            const synced = markSynchronized(next);
            await saveHousehold(synced, { operatingEnvironment: environment, memberId: who });
            if (householdRef.current?.householdId === synced.householdId) {
              householdRef.current = synced;
              setHousehold(synced);
            }
          }).catch(() => undefined);
        }
      }
    } catch {
      /* soft presence only */
    }
  }, [environment, household?.householdId, session?.memberId, softPresenceOptOut]);

  useEffect(() => {
    if (!household || !session?.memberId) {
      setSoftPresenceLive([]);
      return;
    }
    if (!softPresenceRealtimeEnabled(environment)) {
      setSoftPresenceLive([]);
      return;
    }
    const authSession = supabaseAuthEnabled() ? loadSupabaseSession(environment) : null;
    const authConfig = readHearthAuthConfig();
    if (!authSession || !authConfig) {
      setSoftPresenceLive([]);
      return;
    }
    const advertise = canAdvertiseSoftPresence({
      signedIn: true,
      memberId: session.memberId,
      environment,
      optedOut: softPresenceOptOut,
    });
    const detach = attachSoftPresenceRealtime({
      supabaseUrl: authConfig.supabaseUrl,
      publishableKey: authConfig.publishableKey,
      accessToken: authSession.accessToken,
      householdId: household.householdId,
      environment,
      track: advertise
        ? {
            memberId: session.memberId,
            deviceId: localDeviceId(),
            seenAt: new Date().toISOString(),
          }
        : null,
      onPresence: (rows) => setSoftPresenceLive(rows),
    });
    return () => {
      detach();
      setSoftPresenceLive([]);
    };
  }, [environment, household?.householdId, session?.memberId, softPresenceOptOut]);

  useEffect(() => {
    const memberId = session?.memberId;
    if (!memberId) return;
    const googleSession = loadGoogleSession(environment, memberId);
    const storedAuthSession = loadSupabaseSession(environment);
    if (!storedAuthSession && !googleSession?.identity.email && !googleSession?.identity.subject) return;
    let live = true;
    const coordinator = createContinuityCoordinator();
    const resumeGate = createContinuityResumeGate();
    let consecutiveUnhealthyPolls = 0;
    let nextPollAllowedAtMs = 0;

    const acceptReplayCandidate = async (candidate: Household, confirmationId: string, commandKind: string) => {
      const previous = householdRef.current;
      const googleSession = loadGoogleSession(environment, memberId);
      const authSession = supabaseAuthEnabled() ? loadSupabaseSession(environment) : null;
      const continuityIdentity: ContinuityIdentity | null = authSession
        ? { email: authSession.email, subject: authSession.googleSubject }
        : googleSession?.identity
          ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
          : null;
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate,
        confirmationId,
        commandKind,
        postedIds: [],
        adapters: makeBooksAdapters({
          environment,
          memberId,
          continuityIdentity,
        }),
      });
      if (!live) return accepted;
      householdRef.current = accepted.household;
      setHousehold(accepted.household);
      if (!accepted.ok && accepted.userMessage) setError(accepted.userMessage);
      return accepted;
    };

    const replayWork = async (source: ContinuitySyncSource) => {
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
            if (canAbsorbDisjointSharedMoney(current, conflict.remote)) {
              const absorbed = absorbDisjointSharedMoney(current, conflict.remote, memberId);
              const accepted = await acceptReplayCandidate(
                absorbed,
                `outbox-absorb-${current.householdId}-${conflict.remote.revision}`,
                "outbox-absorb",
              );
              if (!live) return;
              if (!accepted?.ok) {
                setSyncState("error");
                setError(accepted?.userMessage || conflict.message);
                return;
              }
              const ready = accepted.household;
              clearContinuityOutboxConflictBlocks({
                environment,
                identity,
                householdId: ready.householdId,
                expectedRevision: ready.baseRevision ?? absorbed.baseRevision,
              });
              const pushed = await transportHouseholdWithOutbox({
                household: ready,
                identity,
                expectedRevision: ready.baseRevision ?? absorbed.baseRevision,
                confirmationId: `absorb-${ready.householdId}-${ready.revision}`,
                config: cloudConfig,
                flush: true,
              });
              if (!live) return;
              if (pushed.ok) {
                const synced = markSynchronized(ready);
                await saveHousehold(synced, { operatingEnvironment: environment, memberId });
                householdRef.current = synced;
                setHousehold(synced);
                setSyncState("synced");
                return;
              }
              setSyncState("syncing");
              return;
            }
            const resolved = await autoResolveSharedConflict(current, conflict.remote, memberId, "local");
            const accepted = await acceptReplayCandidate(
              resolved,
              `outbox-resolve-${current.householdId}-${conflict.remote.revision}`,
              "outbox-resolve",
            );
            if (!live) return;
            if (!accepted?.ok) {
              setSyncState("error");
              setError(accepted?.userMessage || conflict.message);
              return;
            }
            const ready = accepted.household;
            clearContinuityOutboxConflictBlocks({
              environment,
              identity,
              householdId: ready.householdId,
              expectedRevision: ready.baseRevision ?? resolved.baseRevision,
            });
            const pushed = await transportHouseholdWithOutbox({
              household: ready,
              identity,
              expectedRevision: ready.baseRevision ?? resolved.baseRevision,
              confirmationId: `resolve-${ready.householdId}-${ready.revision}`,
              config: cloudConfig,
              flush: true,
            });
            if (!live) return;
            if (pushed.ok) {
              const synced = markSynchronized(ready);
              await saveHousehold(synced, { operatingEnvironment: environment, memberId });
              householdRef.current = synced;
              setHousehold(synced);
              setSyncState("synced");
              return;
            }
            setSyncState("syncing");
            return;
          }
          if (live) {
            setSyncState("syncing");
            setError(conflict.message);
          }
          return;
        }
        if (flushed.pending > 0) {
          // Healthy background queue is not an error — only surface offline/conflict as red.
          if (live) setSyncState(typeof navigator !== "undefined" && !navigator.onLine ? "syncing" : "synced");
          // Still try a live pull below so partner posts appear.
        }

        let current = householdRef.current;
        if (flushed.synchronized > 0 && current) {
          current = markSynchronized(current);
          await saveHousehold(current, { operatingEnvironment: environment, memberId });
          if (live) {
            householdRef.current = current;
            setHousehold(current);
          }
        }

        current = householdRef.current;
        let remoteHousehold = current
          ? await pullHouseholdSnapshotById(current.householdId, environment, cloudConfig, identity)
          : null;
        if (!remoteHousehold) {
          const memberships = await discoverContinuityMemberships(identity, environment, cloudConfig);
          if (!live) return;
          current = householdRef.current;
          remoteHousehold = current
            ? memberships.find((item) => item.household.householdId === current?.householdId)?.household ?? null
            : null;
        }
        if (!live) return;
        current = householdRef.current;
        if (current && memberId) {
          try {
            const remotePersonal = await pullPersonalSnapshotById(
              current.householdId,
              memberId,
              environment,
              cloudConfig,
            );
            if (remotePersonal && live) {
              setPersonalReplica((previous) => {
                const prevAt = previous?.lastCommittedAt ?? "";
                const nextAt = remotePersonal.lastCommittedAt ?? "";
                return nextAt >= prevAt ? remotePersonal : previous;
              });
            }
          } catch {
            /* personal pull is best-effort; shared pull continues */
          }
        }
        if (current && remoteHousehold) {
          const remoteRevision = remoteHousehold.revision ?? 0;
          const hasOpenConflict = unresolvedConflicts(current).length > 0;
          const staleSignal = shouldIgnoreInboundSnapshot({
            remoteRevision,
            localTipRevision: current.revision ?? 0,
            hasOpenConflict,
          });
          const duplicatePull = !staleSignal
            && remoteRevision > (current.baseRevision ?? 0)
            && coordinator.shouldDedupePull(current.householdId, remoteRevision);
          if (
            !staleSignal
            && !duplicatePull
            && remoteRevision > (current.baseRevision ?? 0)
          ) {
          coordinator.recordPull(current.householdId, remoteRevision);
          if (!coordinator.shouldSkipAccept(current.householdId, remoteRevision)) {
          const reconciled = await reconcileHouseholdSnapshots(current, remoteHousehold, memberId);
          const accepted = await acceptReplayCandidate(
            reconciled,
            `continuity-pull-${current.householdId}-${remoteHousehold.revision}`,
            "continuity-pull",
          );
          if (!live) return;
          if (!accepted?.ok) {
            setSyncState("error");
            setError(accepted?.userMessage || "Could not accept the shared household.");
            return;
          }
          coordinator.recordAccept(current.householdId, remoteRevision);
          if (live) {
            setLastReconcile({
              at: new Date().toISOString(),
              source,
              revision: remoteRevision,
            });
          }
          if (accepted.household.sharing?.mode === "pending-transport") {
            const tip = remoteHousehold.revision;
            const ready = accepted.household;
            const pushed = await transportHouseholdWithOutbox({
              household: ready,
              identity,
              expectedRevision: tip,
              confirmationId: `live-absorb-${ready.householdId}-${ready.revision}`,
              config: cloudConfig,
              flush: true,
            });
            if (!live) return;
            if (pushed.ok) {
              const synced = markSynchronized(ready);
              await saveHousehold(synced, { operatingEnvironment: environment, memberId });
              householdRef.current = synced;
              setHousehold(synced);
            } else if (pushed.errorClass === "conflict-detected" && pushed.remote) {
              const resolved = await autoResolveSharedConflict(ready, pushed.remote, memberId, "local");
              await acceptReplayCandidate(
                resolved,
                `live-absorb-resolve-${ready.householdId}-${pushed.remote.revision}`,
                "outbox-resolve",
              );
              setSyncState("syncing");
              return;
            } else {
              setSyncState("syncing");
              return;
            }
          }
          }
          }
        }
        if (live) {
          const open = householdRef.current ? unresolvedConflicts(householdRef.current) : [];
          const pending = householdRef.current?.sharing?.mode === "pending-transport";
          setSyncState(open.length > 0 ? "error" : pending ? "syncing" : "synced");
        }
      } catch (caught) {
        if (!live) return;
        setSyncState("error");
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    };

    const scheduleReplay = (source: ContinuitySyncSource) => {
      void coordinator.run(source, () => replayWork(source));
    };

    /** T3-S3: coalesce focus+visibility; online/manual/realtime stay immediate. */
    const requestResume = (source: ContinuitySyncSource) => {
      resumeGate.request({
        source,
        nowMs: Date.now(),
        schedule: (resolved) => {
          if (resolved === "focus" || resolved === "visibility" || resolved === "online") {
            resumeGate.markResumed(Date.now());
          }
          scheduleReplay(resolved);
        },
        defer: (fn, waitMs) => {
          const id = window.setTimeout(fn, waitMs);
          return { clear: () => window.clearTimeout(id) };
        },
      });
    };

    const onOnline = () => requestResume("online");
    const onFocus = () => requestResume("focus");
    const onVisibility = () => {
      if (document.visibilityState === "visible") requestResume("visibility");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    requestResume("manual");

    let detachRealtime: (() => void) | null = null;
    const realtimeStatusRef: { current: ContinuityRealtimeStatus | null } = { current: null };

    const setupRealtime = async () => {
      if (!continuityRealtimeTransportEnabled() || !supabaseAuthEnabled()) return;
      const authSession = await ensureSupabaseSession(environment);
      if (!live || !authSession) return;
      const currentHouseholdId = householdRef.current?.householdId;
      if (!currentHouseholdId) return;
      const identity: ContinuityIdentity = {
        email: authSession.email,
        subject: authSession.googleSubject,
      };
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const role = await fetchContinuityMembershipRole({
        householdId: currentHouseholdId,
        memberId,
        identity,
        environment,
        config: cloudConfig,
      });
      if (!live || !role) return;
      const authConfig = readHearthAuthConfig();
      if (!authConfig) return;
      if (!canAttachContinuityRealtime({
        authSessionPresent: true,
        membershipResolved: true,
        hostedAllowed: hostedContinuityAllowed(environment),
        hasHousehold: true,
        environment,
        commandLogEnabled: continuityCommandLogEnabled(),
      })) return;
      if (!live) return;

      const tryApplyCommandEvent = async (event: ContinuityCommandEvent): Promise<"applied" | "duplicate" | "ignored" | "fallback"> => {
        const current = householdRef.current;
        if (!current) return "ignored";
        const applied = await applyCommandEventLocally({ local: current, event, memberId });
        if (!applied.ok) {
          return applied.fallback ? "fallback" : "ignored";
        }
        if (applied.duplicate) return "duplicate";
        const accepted = await acceptReplayCandidate(
          applied.household,
          `continuity-cmd-${event.confirmation_id || event.idempotency_key}`,
          event.command_type,
        );
        if (!accepted?.ok) return "fallback";
        if (live) setSyncState("synced");
        return "applied";
      };

      detachRealtime = attachContinuityRealtime({
        supabaseUrl: authConfig.supabaseUrl,
        publishableKey: authConfig.publishableKey,
        accessToken: authSession.accessToken,
        householdId: currentHouseholdId,
        memberId,
        environment,
        commandLogEnabled: continuityCommandLogEnabled(),
        onCommandEvent: (event) => {
          if (!continuityCommandLogEnabled()) return;
          if (!shouldRunLivePull({
            documentVisible: document.visibilityState === "visible",
            online: typeof navigator === "undefined" ? true : navigator.onLine,
            hasSession: Boolean(memberId),
            hasHousehold: Boolean(householdRef.current),
          })) return;
          void (async () => {
            const outcome = await tryApplyCommandEvent(event);
            if (outcome === "fallback") scheduleReplay("realtime");
          })();
        },
        onSnapshotSignal: () => {
          if (!shouldRunLivePull({
            documentVisible: document.visibilityState === "visible",
            online: typeof navigator === "undefined" ? true : navigator.onLine,
            hasSession: Boolean(memberId),
            hasHousehold: Boolean(householdRef.current),
          })) return;
          scheduleReplay("realtime");
        },
        onStatusChange: (status) => {
          realtimeStatusRef.current = status;
          if (status === "SUBSCRIBED") {
            consecutiveUnhealthyPolls = 0;
            nextPollAllowedAtMs = 0;
          }
          if (live) setRealtimeStatus(status);
        },
      });
    };
    void setupRealtime();

    const realtimeOn = continuityRealtimeTransportEnabled();
    // Tick often enough to honor backoff without a fixed 4s heartbeat when unhealthy.
    // T3-S4: recompute member-scaled base each tick so roster changes refresh the envelope.
    const timer = window.setInterval(() => {
      if (!shouldRunLivePull({
        documentVisible: document.visibilityState === "visible",
        online: typeof navigator === "undefined" ? true : navigator.onLine,
        hasSession: Boolean(memberId),
        hasHousehold: Boolean(householdRef.current),
      })) return;
      if (!shouldUsePollFallback(realtimeStatusRef.current)) {
        consecutiveUnhealthyPolls = 0;
        return;
      }
      const now = Date.now();
      if (now < nextPollAllowedAtMs) return;
      const memberCount = householdRef.current?.members.filter((m) => m.active).length ?? 2;
      const baseIntervalMs = livePullIntervalMs(memberCount);
      const delay = reconnectPollDelayMs({
        baseIntervalMs,
        realtimeStatus: realtimeStatusRef.current,
        consecutiveUnhealthyPolls,
        realtimeEnabled: realtimeOn,
      });
      nextPollAllowedAtMs = now + delay;
      if (isUnhealthyRealtimeStatus(realtimeStatusRef.current, realtimeOn)) {
        consecutiveUnhealthyPolls += 1;
      } else {
        consecutiveUnhealthyPolls = 0;
      }
      scheduleReplay("poll");
    }, 1_000);
    return () => {
      live = false;
      resumeGate.dispose();
      detachRealtime?.();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [environment, session?.memberId, household?.householdId]);

  useEffect(() => {
    let live = true;
    const memberId = session?.memberId;
    if (!household || !memberId) {
      setPersonalReplica(null);
      return () => { live = false; };
    }
    void saveHousehold(household, { operatingEnvironment: environment, memberId }).then(async () => {
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

  useEffect(() => {
    let live = true;
    const memberId = session?.memberId;
    const householdId = household?.householdId;
    if (!memberId || !householdId) {
      setIsHouseholdOwner(false);
      return () => { live = false; };
    }
    void (async () => {
      try {
        const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
        const google = loadGoogleSession(environment, memberId);
        const identity = authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : google?.identity
            ? { email: google.identity.email, subject: google.identity.subject }
            : null;
        if (!identity) {
          if (live) setIsHouseholdOwner(false);
          return;
        }
        const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
        const role = await fetchContinuityMembershipRole({
          householdId,
          memberId,
          identity,
          environment,
          config: cloudConfig,
        });
        if (live) setIsHouseholdOwner(role === "owner");
      } catch {
        if (live) setIsHouseholdOwner(false);
      }
    })();
    return () => { live = false; };
  }, [environment, session?.memberId, household?.householdId]);

  // Q2 C: books civil dates stay America/Toronto; this phone may display another zone.
  const booksZone = TIMEZONE;
  const displayZone = placePrefs.displayTimeZone || detectDeviceTimeZone();
  const today = todayKey(now, booksZone);
  const googleEntryAvailable = googleConfigured() || supabaseAuthEnabled();
  const memberId = session?.memberId ?? household?.members.find((member) => member.active)?.id ?? "";
  const view: LedgerView = session?.view ?? "household";
  const personalSource = useMemo(() => (
    household && memberId && personalReplica?.memberId === memberId
      && personalReplica.lastCommittedAt === household.lastCommittedAt
      ? assembleHousehold(splitForSync(household, memberId).shared, personalReplica, { linked: household.linked })
      : household
  ), [household, memberId, personalReplica]);
  const visible = useMemo(
    () => (personalSource && memberId ? householdForView(personalSource, memberId, view) : personalSource),
    [personalSource, memberId, view],
  );
  const experience = useMemo(
    () => (household && memberId ? projectLedgerExperience(household, memberId, view, today) : null),
    [household, memberId, view, today],
  );
  const scopedHousehold = experience && experience.ok ? experience.scopedHousehold : visible;
  const dashboard = useMemo(
    () => (scopedHousehold ? buildDashboard(scopedHousehold, today, now, experience && experience.ok ? experience.integrityFindings.length : 0) : null),
    [scopedHousehold, today, now, experience],
  );
  const syncFreshnessDisplay = useMemo(() => {
    if (!household || !memberId) {
      return buildSyncFreshness({
        household: null,
        viewerMemberId: null,
        realtimeEnabled: continuityRealtimeTransportEnabled(),
        realtimeStatus,
        offline,
        pendingOutboxCount: 0,
        hasOpenConflict: false,
        lastReconcileAt: null,
        lastReconcileSource: null,
      });
    }
    const activeMembers = household.members.filter((member) => member.active).length;
    return buildSyncFreshness({
      household,
      viewerMemberId: memberId,
      realtimeEnabled: continuityRealtimeTransportEnabled(),
      realtimeStatus,
      offline,
      pendingOutboxCount: listContinuityOutbox(environment).filter((item) => item.householdId === household.householdId).length,
      hasOpenConflict: unresolvedConflicts(household).length > 0,
      lastReconcileAt: lastReconcile?.at ?? null,
      lastReconcileSource: lastReconcile?.source ?? null,
      pollIntervalMs: livePullIntervalMs(activeMembers),
    });
  }, [household, memberId, realtimeStatus, lastReconcile, environment, offline]);
  const syncFreshnessLine = useMemo(
    () => sharedHouseholdFreshnessCopy(syncFreshnessDisplay, syncState),
    [syncFreshnessDisplay, syncState],
  );
  const syncChromeSuppression = useMemo(
    () => suppressesCommandSyncChrome(
      syncFreshnessDisplay,
      commandChrome?.chip?.primary,
      commandChrome?.banner?.primary,
    ),
    [syncFreshnessDisplay, commandChrome?.chip?.primary, commandChrome?.banner?.primary],
  );
  const commandProgressDisplay = useMemo(
    () => buildCommandProgress({
      phase: commandProgressPhase,
      transportRequested: Boolean(household?.linked && hostedContinuityAllowed(environment)),
    }),
    [commandProgressPhase, household?.linked, environment],
  );
  const softPresenceDisplay = useMemo(
    () => buildSoftPresenceDisplay({
      household,
      viewerMemberId: session?.memberId ?? null,
      environment,
      optedOut: softPresenceOptOut,
      live: softPresenceLive,
    }),
    [household, session?.memberId, environment, softPresenceOptOut, softPresenceLive],
  );

  function applySoftPresenceOptOut(nextOptOut: boolean) {
    setSoftPresenceOptOut(environment, nextOptOut);
    setSoftPresenceOptOutState(nextOptOut);
    if (!household || !session?.memberId) return;
    const deviceId = localDeviceId();
    const memberId = session.memberId;
    let next = nextOptOut
      ? { ...household, devices: deactivateLocalDevice(household.devices ?? [], deviceId) }
      : touchHouseholdDevice(household, {
          deviceId,
          label: describeDeviceLabel(),
          memberId,
        }).household;
    void saveHousehold(next, { operatingEnvironment: environment, memberId }).then(() => {
      if (householdRef.current?.householdId === next.householdId) {
        householdRef.current = next;
        setHousehold(next);
      }
    });
    if (!next.linked || !hostedContinuityAllowed(environment)) return;
    const googleSession = loadGoogleSession(environment, memberId);
    const authSession = supabaseAuthEnabled() ? loadSupabaseSession(environment) : null;
    const identity: ContinuityIdentity | null = authSession
      ? { email: authSession.email, subject: authSession.googleSubject }
      : googleSession?.identity
        ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
        : null;
    if (!identity) return;
    next = markPendingTransport({
      ...next,
      revision: (next.revision ?? 0) + 1,
    });
    softPresenceTouchAtRef.current = Date.now();
    void saveHousehold(next, { operatingEnvironment: environment, memberId });
    const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
    void transportHouseholdWithOutbox({
      household: next,
      identity,
      expectedRevision: next.baseRevision ?? (next.revision - 1),
      confirmationId: `presence-opt-${next.householdId}-${deviceId}-${Date.now()}`,
      config: cloudConfig,
      flush: true,
    }).then(async (pushed) => {
      if (!pushed.ok) return;
      const synced = markSynchronized(next);
      await saveHousehold(synced, { operatingEnvironment: environment, memberId });
      if (householdRef.current?.householdId === synced.householdId) {
        householdRef.current = synced;
        setHousehold(synced);
      }
    }).catch(() => undefined);
  }

  useEffect(() => {
    if (commandProgressPhase !== "cloud-ack") return undefined;
    const timer = window.setTimeout(() => setCommandProgressPhase("idle"), 4000);
    return () => window.clearTimeout(timer);
  }, [commandProgressPhase]);

  useEffect(() => {
    setLastReconcile(null);
    setRealtimeStatus(null);
  }, [household?.householdId]);

  useEffect(() => {
    if (booting || !household || adding || guard) return;
    if (unresolvedConflicts(household).length > 0) return;

    const previewKey = `${environment}:${household.householdId}:${today}`;
    if (duePreviewOffered.current === previewKey) return;
    if (duePreviewDismissed(environment, household.householdId, today)) return;

    if (!experience || !experience.ok) return;
    const rows = dueRecurrencePreview(experience.scopedHousehold, today);
    if (!rows.length) return;
    duePreviewOffered.current = previewKey;
    setGuard({ kind: "duePreview", rows });
  }, [adding, booting, environment, experience, guard, household, today]);

  function rememberSession(next: Session) {
    const remembered = { ...next, householdId: next.householdId ?? householdRef.current?.householdId };
    const previous = sessionRef.current;
    if (previous?.memberId !== remembered.memberId || previous?.householdId !== remembered.householdId) closeAdd();
    sessionRef.current = remembered;
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
      const continuityIdentity = currentGoogle?.identity
        ? { email: currentGoogle.identity.email, subject: currentGoogle.identity.subject }
        : null;
      // Replica navigation is not a money command: ingest + hash verify without bumping revision.
      const { status } = await ingestHouseholdBooks(candidate);
      if (!status.ok) throw new Error(status.error || "Those books could not be opened on this device.");
      const inspection = await inspectBrowserBooks(candidate);
      if (!inspection.ok) throw new Error(inspection.message || "Those books do not match the accepted PGlite journal.");
      await saveHousehold(candidate, {
        operatingEnvironment: environment,
        memberId: nextMemberId,
        activate: true,
        continuityIdentity: continuityIdentity ?? undefined,
      });
      closeAdd();
      householdRef.current = candidate;
      setHousehold(candidate);
      rememberSession({ memberId: nextMemberId, view: session?.view ?? "household", householdId });
      setBooksStatus(status);
      setHistory(loadUndoHistory(environment, householdId, nextMemberId, candidate));
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
    const googleSession = loadGoogleSession(environment, found.memberId)
      ?? loadGoogleSession(environment, "__welcome__");
    const continuityIdentity = googleSession?.identity
      ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
      : null;
    const accepted = await acceptHouseholdWrite({
      previous,
      candidate,
      confirmationId: `discover-${found.household.householdId}-${found.household.revision}`,
      commandKind: "google-discovery",
      postedIds: [],
      adapters: makeBooksAdapters({
        environment,
        memberId: found.memberId,
        continuityIdentity,
      }),
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

  async function redeemAuthInviteToken(token: string): Promise<void> {
    if (!supabaseAuthEnabled()) {
      throw new Error("Auth invites need an Auth-enabled kitchen build.");
    }
    savePendingAuthInvite({ token, environment });
    setPendingAuthInvite(token);
    let authSession = await ensureSupabaseSession(environment);
    if (!authSession) {
      setInviteInput(token);
      setWelcomeMode("join");
      startSupabaseGoogleSignIn(environment);
      return;
    }
    const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
    const redeemed = await redeemHouseholdInvite({
      inviteToken: token,
      displayName: authSession.displayName,
      config: cloudConfig,
    });
    if (!redeemed.ok) {
      throw new Error(inviteReasonMessage(redeemed.reason));
    }
    if (redeemed.environment !== environment) {
      setEnvironment(redeemed.environment);
    }
    const identity = { email: authSession.email, subject: authSession.googleSubject };
    const found = await discoverContinuityMemberships(identity, redeemed.environment, cloudConfig);
    const match = found.find((row) => row.household.householdId === redeemed.householdId)
      ?? (redeemed.memberId
        ? found.find((row) => row.memberId === redeemed.memberId)
        : undefined);
    if (!match) {
      throw new Error("Invite accepted, but this device could not open the household yet. Try Continue with Google.");
    }
    setPendingAuthInvite(null);
    clearPendingAuthInvite();
    await openDiscoveredLedger(match);
  }

  async function continueWithGoogle(intent?: WelcomeGoogleIntent): Promise<void> {
    const welcomeIntent = intent ?? loadWelcomeGoogleIntent() ?? "login";
    setBusy(true);
    setError("");
    try {
      let identity: ContinuityIdentity;
      let identityDetails: WelcomeIdentity;
      let cloudConfig = readSupabaseConfig();
      if (supabaseAuthEnabled()) {
        let authSession = await ensureSupabaseSession(environment);
        if (!authSession) {
          const pending = pendingAuthInvite
            || loadPendingAuthInvite()?.token
            || (isAuthInviteToken(inviteInput.trim()) ? inviteInput.trim().toLowerCase() : "");
          if (pending) {
            savePendingAuthInvite({ token: pending, environment });
          }
          rememberWelcomeGoogleIntent(welcomeIntent);
          startSupabaseGoogleSignIn(environment);
          return;
        }
        cloudConfig = authenticatedSupabaseConfig(cloudConfig, authSession);
        identity = { email: authSession.email, subject: authSession.googleSubject };
        identityDetails = {
          ...identity,
          displayName: authSession.displayName,
          grantedScopes: ["openid", "email", "profile"],
        };
        const inviteToken = pendingAuthInvite
          || loadPendingAuthInvite()?.token
          || (isAuthInviteToken(inviteInput.trim()) ? inviteInput.trim().toLowerCase() : "");
        if (inviteToken) {
          await redeemAuthInviteToken(inviteToken);
          return;
        }
      } else {
        const googleSession = await connectGoogle({
          environment,
          memberId: "__welcome__",
          services: ["identity"],
          selectAccount: true,
        });
        identity = googleSession.identity;
        identityDetails = {
          ...identity,
          displayName: googleSession.identity.displayName,
          grantedScopes: googleSession.grantedScopes,
        };
      }
      if (welcomeIntent === "create") {
        rememberWelcomeGoogleIntent(null);
        setWelcomeIdentity(identityDetails);
        setWelcomeMode("new");
        return;
      }
      let found = await discoverContinuityMemberships(identity, environment, cloudConfig);
      if (!found.length && supabaseAuthEnabled() && cloudConfig?.accessToken) {
        const bound = await bindGoogleMemberships({ environment, config: cloudConfig });
        if (bound.ok && bound.bound > 0) {
          found = await discoverContinuityMemberships(identity, environment, cloudConfig);
        } else if (!bound.ok && bound.reason === "bind-rpc-missing") {
          throw new Error(
            "This kitchen needs migration 010 (bind Google memberships) pasted in the Supabase SQL Editor, then Continue with Google again.",
          );
        }
      }
      if (!found.length) {
        rememberWelcomeGoogleIntent(null);
        if (environment === "production") {
          if (supabaseAuthEnabled()) clearSupabaseSession(environment);
          else disconnectGoogle(environment, "__welcome__");
          throw new Error(
            productionContinuityEnabled()
              ? "That Google account is not a member of a Production household yet. An owner must invite you, or seed an owner membership before Continue with Google can open it."
              : "Production cloud continuity is off on this build. Development remains the usual working ledger until Jonathan enables Production continuity.",
          );
        }
        setWelcomeIdentity(identityDetails);
        setWelcomeMode("new");
        return;
      }
      const only = found[0];
      rememberWelcomeGoogleIntent(null);
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
    actorId?: string,
    options?: { forceFlush?: boolean; confirmationId?: string },
  ): Promise<CommandOutcome | null> {
    setBusy(true);
    const previous = householdRef.current;
    const explicitConfirmationId = options?.confirmationId;
    const confirmationId = explicitConfirmationId ?? confirmationRef.current ?? newConfirmationId();
    if (!explicitConfirmationId) confirmationRef.current = confirmationId;
    const ledgerWrite = isLedgerWrite(token);
    const memberId = actorId ?? session?.memberId;
    const shareCapable = Boolean(previous?.linked && hostedContinuityAllowed(environment) && memberId);
    if (shareCapable && ledgerWrite) {
      setCommandProgressPhase("confirming");
      setCommandChrome(renderCommandChrome(COMMAND_SURFACE_FIXTURES.saving, {
        amountLabel: lastAmountLabelRef.current,
        ledgerName: previous?.name ?? null,
        ledgerWrite,
      }));
    } else {
      setCommandProgressPhase("idle");
    }
    try {
      const googleSession = memberId ? loadGoogleSession(environment, memberId) : null;
      const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const continuityIdentity: ContinuityIdentity | null = authSession
        ? { email: authSession.email, subject: authSession.googleSubject }
        : googleSession?.identity
          ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
          : null;
      const automaticContinuity = Boolean(
        continuityIdentity &&
        memberId &&
        (
          (authSession && next.members.some((member) => member.id === memberId && member.active))
          || continuityMemberId(next, continuityIdentity) === memberId
        ),
      );
      const transportRequested = hostedContinuityAllowed(environment) && automaticContinuity;
      // Kitchen/UX: enqueue only, flush in background. Ledger: flush immediately (sync-on-write).
      // Stress Reload forces an immediate flush so Hercules Pro can read the new harbour shifts.
      const flushTransport = ledgerWrite || options?.forceFlush === true;
      const outcome = await acceptHouseholdWrite({
        previous,
        candidate: next,
        confirmationId,
        commandKind: token?.label ?? "commit",
        postedIds: token?.postedIds ?? [],
        transportRequested,
        adapters: makeBooksAdapters({
          environment,
          memberId,
          continuityIdentity,
          transport: transportRequested && automaticContinuity && continuityIdentity
            ? async (household, expectedRevision) => transportHouseholdWithOutbox({
                household,
                identity: continuityIdentity,
                expectedRevision,
                confirmationId,
                config: cloudConfig,
                flush: flushTransport,
              })
            : undefined,
        }),
      });
      if (!explicitConfirmationId && (outcome.postedExactlyOnce || (outcome.postedNothing && !outcome.retryable))) {
        confirmationRef.current = null;
      }
      // A rejected first-household write has no last valid Household to return.
      // Keep the welcome screen mounted instead of storing CommandOutcome's
      // minimal no-previous sentinel as if it were readable books.
      if (outcome.ok || previous) setHousehold(outcome.household);
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
        ledgerWrite,
      });
      setCommandChrome(chrome);
      setCommandProgressPhase(commandProgressPhaseAfterOutcome(outcome, transportRequested));
      if (outcome.kind === "synchronized") {
        saveSyncAnchor(environment, outcome.household);
        const who = memberId;
        if (who) {
          void appendRestorePoint(outcome.household, who).then(async (withPoint) => {
            if (withPoint === outcome.household) return;
            // Host the newest tip: bump revision and enqueue so partners see Restore points.
            const pending = markPendingTransport({
              ...withPoint,
              revision: withPoint.revision + 1,
            });
            await saveHousehold(pending, { operatingEnvironment: environment, memberId: who });
            if (householdRef.current?.householdId === pending.householdId) {
              householdRef.current = pending;
              setHousehold(pending);
            }
            if (continuityIdentity && cloudConfig) {
              void transportHouseholdWithOutbox({
                household: pending,
                identity: continuityIdentity,
                expectedRevision: pending.baseRevision ?? outcome.household.revision,
                confirmationId: `restore-tip-${pending.householdId}-${pending.revision}`,
                config: cloudConfig,
                flush: true,
              }).then(async (pushed) => {
                if (!pushed.ok) return;
                const synced = markSynchronized(pending);
                await saveHousehold(synced, { operatingEnvironment: environment, memberId: who });
                if (householdRef.current?.householdId === synced.householdId) {
                  householdRef.current = synced;
                  setHousehold(synced);
                }
              }).catch(() => undefined);
            }
          }).catch(() => undefined);
        }
      }
      if (
        automaticContinuity &&
        continuityIdentity &&
        (outcome.kind === "synchronized" || outcome.kind === "pending-transport" || !flushTransport)
      ) {
        void flushContinuityOutbox({ environment, identity: continuityIdentity, config: cloudConfig })
          .then(async (flushed) => {
            if (flushed.synchronized <= 0) return;
            const current = householdRef.current;
            if (!current || current.householdId !== outcome.household.householdId) return;
            let synced = markSynchronized(current);
            const who = memberId;
            if (who) {
              try {
                const withPoint = await appendRestorePoint(synced, who);
                if (withPoint !== synced) {
                  const pending = markPendingTransport({
                    ...withPoint,
                    revision: withPoint.revision + 1,
                  });
                  await saveHousehold(pending, { operatingEnvironment: environment, memberId: who });
                  householdRef.current = pending;
                  setHousehold(pending);
                  const tipPush = await transportHouseholdWithOutbox({
                    household: pending,
                    identity: continuityIdentity,
                    expectedRevision: pending.baseRevision ?? synced.revision,
                    confirmationId: `restore-tip-${pending.householdId}-${pending.revision}`,
                    config: cloudConfig,
                    flush: true,
                  });
                  if (tipPush.ok) {
                    synced = markSynchronized(pending);
                  } else {
                    setSyncState("syncing");
                    return;
                  }
                }
              } catch {
                /* restore tip is best-effort */
              }
            }
            saveSyncAnchor(environment, synced);
            await saveHousehold(synced, { operatingEnvironment: environment, memberId: who });
            setHousehold(synced);
            setSyncState("synced");
            setCommandProgressPhase("cloud-ack");
            setCommandChrome(renderCommandChrome(COMMAND_SURFACE_FIXTURES.synchronized, {
              amountLabel: lastAmountLabelRef.current,
              ledgerName: synced.name,
              ledgerWrite: true,
            }));
          })
          .catch(() => undefined);
      }
      if (
        outcome.ok &&
        token &&
        ledgerWrite &&
        chrome.toast?.showUndo !== false &&
        outcome.kind !== "conflict-needs-attention"
      ) {
        const stamped: UndoToken = {
          ...token,
          actorMemberId: token.actorMemberId ?? memberId,
        };
        setToast(stamped);
        rememberUndoHistory([...historyRef.current, stamped].slice(-20));
        window.setTimeout(() => setToast((item) => (item?.id === stamped.id ? null : item)), 8000);
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
      else if (outcome.kind === "conflict-needs-attention") setSyncState("syncing");
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
      if (shareCapable && ledgerWrite) setCommandProgressPhase("failed");
      if (caught instanceof NeedsConfirmationError) throw caught;
      setError(classifyCommandError(caught).userMessage);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function persist(next: Household, token?: UndoToken, actorId?: string, options?: { forceFlush?: boolean }) {
    return enqueueWrite(() => commitHousehold(next, token, actorId, options));
  }

  function persistLedgerWrite(next: Household, token?: UndoToken) {
    const accepted = householdRef.current;
    return persist(accepted ? restoreAcceptedSnapshot(accepted, next) : next, token);
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
      const who = session?.memberId;
      if (!current || !who) return;
      try {
        assertLatestMemberLedgerUndo(historyRef.current, who, token);
        const result = undoLedgerConfirm(current, token);
        lastAmountLabelRef.current = null;
        const outcome = await commitHousehold(result.household, {
          ...result.undo,
          actorMemberId: who,
        });
        if (!outcome || !outcome.postedExactlyOnce || outcome.kind === "conflict-needs-attention") return;
        rememberUndoHistory(historyRef.current.filter((item) => item.id !== token.id));
        setToast((item) => (item?.id === token.id ? null : item));
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  async function runRestorePoint(pointId: string) {
    const current = householdRef.current;
    const who = session?.memberId;
    if (!current || !who) return;
    const point = listRestorePoints(current).find((row) => row.id === pointId);
    const gate = canRestorePoint(current, point, { isOwner: isHouseholdOwner });
    if (!gate.ok) {
      setError(gate.message);
      return;
    }
    if (!point) return;
    try {
      const restored = applyRestorePoint(current, point, who, { isOwner: isHouseholdOwner });
      await commitHousehold(restored, {
        id: `restore-${point.id}`,
        label: `Restored ${point.label}`,
        snapshot: current,
        postedIds: [],
        actorMemberId: who,
      });
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
        workShiftInputRef.current = null;
        setConfirm(null);
        setAdding(false);
        const nextExperience = session?.memberId
          ? projectLedgerExperience(result.household, session.memberId, view, today)
          : null;
        setForm({
          ...emptyForm,
          date: today,
          visibility: defaultVisibilityForView(view),
          ...addFormDefaults(
            nextExperience && nextExperience.ok ? nextExperience.scopedHousehold : result.household,
            focusedAccountId,
          ),
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
          const plan = resolveDuplicateRetry({
            pendingWorkShift: workShiftInputRef.current?.input ?? null,
            confirmCode: caught.code,
            tab,
          });
          if (plan.setShiftMode) {
            setMode("shift");
            const memberId = session?.memberId;
            const punch = householdRef.current && memberId
              ? activeOpenShift(householdRef.current.kitchen, memberId)
              : null;
            setShiftGate(punch ? "signOut" : "finished");
          }
          setConfirm(caught);
          if (plan.openAdd) setAdding(true);
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

  function requestClearThisPhone() {
    setGuard({ kind: "clear-this-phone" });
  }

  function signOutWelcomeGoogle() {
    disconnectGoogle(environment, "__welcome__");
    clearSupabaseSession(environment);
    rememberWelcomeGoogleIntent(null);
    setWelcomeIdentity(null);
    setDiscoveredLedgers([]);
    setWelcomeMode("home");
    setError("");
  }

  async function removeHouseholdFromDevice(input: {
    householdId: string;
    memberId: string;
    role: "owner" | "member" | null;
    name: string;
  }): Promise<void> {
    setBusy(true);
    try {
      const authSession = await ensureSupabaseSession(environment);
      if (!authSession) {
        throw new Error("Continue with Google before deleting a household.");
      }
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const result = await leaveOrDeleteHousehold({
        environment,
        householdId: input.householdId,
        role: input.role,
        config: cloudConfig,
      });
      if (!result.ok) {
        throw new Error(inviteReasonMessage(result.reason));
      }
      clearSyncAnchor(environment, input.householdId);
      clearContinuityOutboxForHousehold(environment, input.householdId);
      disconnectGoogle(environment, input.memberId);
      if (session?.memberId && session.memberId !== input.memberId) {
        disconnectGoogle(environment, session.memberId);
      }
      if (session?.memberId) {
        clearUndoHistory(environment, input.householdId, session.memberId);
      }
      await clearHousehold(environment, input.householdId);
      setDiscoveredLedgers((current) => current.filter((item) => item.household.householdId !== input.householdId));
      if (household?.householdId === input.householdId) {
        closeAdd();
        householdRef.current = null;
        sessionRef.current = null;
        setHousehold(null);
        setSession(null);
        setHistory([]);
        setPersonalReplica(null);
        setWelcomeMode("home");
      }
      setGuard(null);
      setError("");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function startFromScratch(): Promise<void> {
    setBusy(true);
    try {
      if (environment !== "development") {
        throw new Error("Start from scratch is Development only. Production stays.");
      }
      const authSession = await ensureSupabaseSession(environment);
      if (!authSession) {
        throw new Error("Continue with Google before starting from scratch.");
      }
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const identity = { email: authSession.email, subject: authSession.googleSubject };
      const listed = await listActiveContinuityMemberships({
        identity,
        environment,
        config: cloudConfig,
      });
      const known = [...listed];
      const remember = async (householdId: string, memberId: string) => {
        if (known.some((row) => row.householdId === householdId)) return;
        const role = await fetchContinuityMembershipRole({
          householdId,
          memberId,
          identity,
          environment,
          config: cloudConfig,
        });
        known.push({ householdId, memberId, role });
      };
      for (const found of discoveredLedgers) {
        await remember(found.household.householdId, found.memberId);
      }
      if (household && session) {
        await remember(household.householdId, session.memberId);
      }
      const result = await resetDevelopmentHouseholds({
        environment,
        identity,
        known,
        config: cloudConfig,
      });
      if (!result.ok) {
        throw new Error(inviteReasonMessage(result.reason));
      }
      await wipeLocalDevelopmentCopies(environment);
      setHistory([]);
      setToast(null);
      setPersonalReplica(null);
      setReplicas([]);
      setDiscoveredLedgers([]);
      closeAdd();
      householdRef.current = null;
      sessionRef.current = null;
      setHousehold(null);
      setSession(null);
      setGuard(null);
      setError("");
      setWelcomeIdentity({
        email: authSession.email,
        subject: authSession.googleSubject,
        displayName: authSession.displayName,
        grantedScopes: ["openid", "email", "profile"],
      });
      setWelcomeMode("new");
    } catch (caught) {
      setGuard(null);
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  const householdResetGuards = (
    <>
      {guard?.kind === "delete-household" && (
        <ConfirmSheet
          title={guard.role === "owner" ? "Delete this Development household?" : "Leave this household?"}
          body={guard.role === "owner"
            ? `This permanently deletes ${guard.name} from the disposable Development cloud and removes its local copy from this phone.`
            : `This removes your membership from ${guard.name} and clears its local copy from this phone. The owner's cloud household stays.`}
          extra="Requires migration 015 in Supabase for cloud delete/leave. Production households cannot be deleted here."
          confirmLabel={guard.role === "owner" ? "Delete household" : "Leave household"}
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void removeHouseholdFromDevice(guard);
          }}
        />
      )}
      {guard?.kind === "reset-development" && (
        <ConfirmSheet
          title="Start from scratch?"
          body="This permanently deletes every disposable Development household you own from the cloud, leaves any you only joined, and clears this phone’s Development copies. Then you can create a new household."
          extra="Production is not touched. Partner phones keep their own copies until they refresh. Google stays signed in."
          confirmLabel="Delete all Development households"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void startFromScratch();
          }}
        />
      )}
    </>
  );

  // Keep every App hook above the boot/welcome/session early returns. The
  // automation runner itself is a hoisted function declaration below, so the
  // effect can live here without changing its behavior.
  useEffect(() => {
    if (!household || !session?.memberId || booting) return;
    const timer = window.setTimeout(() => { void processEvidenceAutomationJobs(); }, 750);
    const onWake = () => { if (document.visibilityState === "visible") void processEvidenceAutomationJobs(); };
    window.addEventListener("online", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("online", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [booting, environment, household?.householdId, household?.revision, session?.memberId]);

  if (booting) {
    return (
      <>
        <div className="welcome">
          <div className="welcome-card">
            <p className="kicker">On this device</p>
            <h1>Opening the ledger…</h1>
          </div>
        </div>
        <HerculesProApproval authorizationRequest={herculesProRequest} environment={environment} household={household} session={session} />
      </>
    );
  }

  if (!household) {
    const welcomeSignedIn = Boolean(
      welcomeIdentity
      || discoveredLedgers.length > 0
      || loadGoogleSession(environment, "__welcome__")
      || loadSupabaseSession(environment),
    );
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">CAD · Toronto books · two people</p>
          <img src="/hercules-mark.svg" alt="" />
          <h1>Hearth</h1>
          <p>
            Two phones. One journal. CAD. Toronto civil books. Each phone keeps its own clock. Hercules loafs while you post groceries.
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
              onRedeemAuthInvite={async (token) => {
                setPendingAuthInvite(token);
                await redeemAuthInviteToken(token);
              }}
              onBack={() => { setWelcomeMode("home"); setError(""); }}
            />
          ) : welcomeMode === "qr" ? (
            <WelcomeQrScanner
              busy={busy}
              error={error}
              onError={setError}
              onDetected={async (raw) => {
                const token = authInviteTokenFromText(raw);
                if (token) {
                  setInviteInput(token);
                  await redeemAuthInviteToken(token);
                  return;
                }
                setInviteInput(raw);
                setWelcomeMode("join");
              }}
              onBack={() => { setWelcomeMode("home"); setError(""); }}
            />
          ) : welcomeMode === "new" ? (
            <form onSubmit={async (event) => {
              event.preventDefault();
              let adoptedWelcomeSession = false;
              let adoptedMemberId = "";
              try {
                if (!welcomeIdentity) throw new Error("Sign in with Google before creating a household.");
                const memberId = newHouseholdDraft.personalMemberId;
                adoptedMemberId = memberId;
                const named = nameHouseholdLedgers(catalogHousehold(environment), newHouseholdDraft);
                const next = linkGoogleIdentity(named, {
                  memberId,
                  email: welcomeIdentity.email,
                  subject: welcomeIdentity.subject,
                  displayName: welcomeIdentity.displayName,
                  grantedScopes: welcomeIdentity.grantedScopes,
                }).household;
                adoptedWelcomeSession = Boolean(adoptGoogleSession(environment, "__welcome__", memberId));
                const outcome = await persist(next, undefined, memberId);
                if (!outcome?.ok) {
                  if (adoptedWelcomeSession) adoptGoogleSession(environment, memberId, "__welcome__");
                  return;
                }
                const nextSession = { memberId, view: "household" as const, householdId: next.householdId };
                closeAdd();
                sessionRef.current = nextSession;
                setSession(nextSession);
                saveSession(environment, nextSession);
                setWelcomeIdentity(null);
              } catch (caught) {
                if (adoptedWelcomeSession && adoptedMemberId) {
                  adoptGoogleSession(environment, adoptedMemberId, "__welcome__");
                }
                setError(caught instanceof Error ? caught.message : String(caught));
              }
            }}>
              <p className="kicker">Create household with Google</p>
              <p className="muted">Signed in as {welcomeIdentity?.email || "Google account"}. Name the household and its ledgers.</p>
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
              <KitchenNotice message={error} onDismiss={() => setError("")} />
              <button className="primary" type="submit" disabled={busy} style={{ width: "100%", marginTop: 12 }}>
                {busy ? "Creating…" : "Create household"}
              </button>
              <button className="ghost" type="button" style={{ width: "100%", marginTop: 8 }} onClick={() => { setWelcomeMode("home"); setError(""); }}>
                Back
              </button>
              {welcomeSignedIn && (
                <button className="ghost" type="button" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => signOutWelcomeGoogle()}>
                  Sign out of Google
                </button>
              )}
            </form>
          ) : (
            <>
              {discoveredLedgers.length === 0 ? <>
                <div className="welcome-entry-grid" aria-label="Ways to enter Hearth">
                <button className="welcome-entry" disabled={busy || !googleEntryAvailable} onClick={() => void continueWithGoogle("create")}>
                  <strong>Create household with Google</strong>
                  <span>Sign in, name a household, then enter its shared ledger.</span>
                </button>
                <button className="welcome-entry" disabled={busy || !googleEntryAvailable} onClick={() => void continueWithGoogle("login")}>
                  <strong>{busy ? "Finding your ledgers…" : "Login with Google"}</strong>
                  <span>See your households, choose one, and open its shared ledger.</span>
                </button>
                <button className="welcome-entry" disabled={busy} onClick={() => { setWelcomeMode("qr"); setError(""); }}>
                  <strong>Join with QR code</strong>
                  <span>On mobile, open the camera and scan a household invite.</span>
                </button>
                </div>
                {!googleEntryAvailable && (
                  <p className="muted">Google sign-in is not configured in this build. QR and received invite links remain available.</p>
                )}
                {environment === "development" && (
                  <>
                    <p className="kicker" id="start-from-scratch-home">Wipe leftover test households</p>
                    <button
                      className="danger"
                      type="button"
                      aria-describedby="start-from-scratch-home"
                      disabled={busy}
                      onClick={() => setGuard({ kind: "reset-development" })}
                    >
                      {busy ? "Starting over…" : "Start from scratch"}
                    </button>
                  </>
                )}
              </> : (
                <section className="welcome-household-list">
                  <p className="kicker">Your Google households</p>
                  <h2>Which household are you entering?</h2>
                  {discoveredLedgers.map((found) => {
                    const member = found.household.members.find((item) => item.id === found.memberId);
                    return (
                      <div key={found.household.householdId} className="welcome-household-row">
                        <button
                          className="primary"
                          disabled={busy}
                          onClick={() => void openDiscoveredLedger(found).catch((caught) => {
                            setError(caught instanceof Error ? caught.message : String(caught));
                          })}
                        >
                          {found.household.name} · {member?.name ?? "me"}
                        </button>
                        {environment === "development" && (
                          <button
                            className="danger ghost"
                            disabled={busy}
                            onClick={() => {
                              void (async () => {
                                setBusy(true);
                                try {
                                  const authSession = await ensureSupabaseSession(environment);
                                  if (!authSession) {
                                    throw new Error("Continue with Google before deleting a household.");
                                  }
                                  const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
                                  const identity = { email: authSession.email, subject: authSession.googleSubject };
                                  const role = await fetchContinuityMembershipRole({
                                    householdId: found.household.householdId,
                                    memberId: found.memberId,
                                    identity,
                                    environment,
                                    config: cloudConfig,
                                  });
                                  setGuard({
                                    kind: "delete-household",
                                    householdId: found.household.householdId,
                                    name: found.household.name,
                                    memberId: found.memberId,
                                    role,
                                  });
                                } catch (caught) {
                                  setError(caught instanceof Error ? caught.message : String(caught));
                                } finally {
                                  setBusy(false);
                                }
                              })();
                            }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    );
                  })}
                  {environment === "development" && (
                    <>
                      <p className="kicker" id="start-from-scratch-list">Wipe leftover test households</p>
                      <button
                        className="danger"
                        type="button"
                        aria-describedby="start-from-scratch-list"
                        disabled={busy}
                        onClick={() => setGuard({ kind: "reset-development" })}
                      >
                        {busy ? "Starting over…" : "Start from scratch"}
                      </button>
                    </>
                  )}
                  <button className="ghost" disabled={busy} onClick={() => setDiscoveredLedgers([])}>Back</button>
                  {welcomeSignedIn && (
                    <button className="ghost" disabled={busy} onClick={() => signOutWelcomeGoogle()}>
                      Sign out of Google
                    </button>
                  )}
                </section>
              )}
              <KitchenNotice message={error} onDismiss={() => setError("")} />
              {discoveredLedgers.length === 0 && (
                <button className="ghost welcome-demo" onClick={() => persist(seedDemoHousehold({ today, environment }))}>
                  Open the demo kitchen table
                </button>
              )}
              {welcomeSignedIn && welcomeMode === "home" && discoveredLedgers.length === 0 && (
                <button className="ghost" type="button" style={{ width: "100%", marginTop: 8 }} disabled={busy} onClick={() => signOutWelcomeGoogle()}>
                  Sign out of Google
                </button>
              )}
            </>
          )}
        </div>
        {householdResetGuards}
        <HerculesProApproval authorizationRequest={herculesProRequest} environment={environment} household={household} session={session} />
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
          <KitchenNotice message={error} onDismiss={() => setError("")} />
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
        <HerculesProApproval authorizationRequest={herculesProRequest} environment={environment} household={household} session={session} />
      </div>
    );
  }

  const ledger = household;
  const actorId = session.memberId;
  const displayHousehold = experience && experience.ok ? experience.scopedHousehold : household;
  const pickerAccounts = experience && experience.ok
    ? experience.scopedHousehold.accounts.filter((account) => account.active)
    : [];
  const healthFindings = experience && experience.ok ? experience.integrityFindings : [];
  const preserveCurrentPersonal = (next: Household) => {
    if (view !== "household") return next;
    const incoming = splitForSync(next, actorId);
    const current = splitForSync(household, actorId).personal;
    const accounts = new Map(current.accounts?.map((account) => [account.id, account]) ?? []);
    for (const account of incoming.personal.accounts ?? []) accounts.set(account.id, account);
    return assembleHousehold(incoming.shared, { ...current, accounts: [...accounts.values()] }, { linked: household.linked });
  };
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
    const defaults = addFormDefaults(displayHousehold, accountId);
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
    const defaults = addFormDefaults(displayHousehold, id);
    setFocusedAccountId(id);
    setMode(nextMode ?? defaults.suggestedMode);
    setAdding(true);
    setAddSlide(0);
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
    setForm(formForAccount(id, {
        subcategoryId: defaultSubcategoryForMode(nextMode ?? defaults.suggestedMode),
      }));
  };

  function switchAddMode(item: AddMode) {
    setMode(item);
    setAddSlide(0);
    setCategoryTouched(false);
    setCodingHint("");
    setForm((current) => ({ ...current, subcategoryId: defaultSubcategoryForMode(item) }));
    if (item === "shift") {
      const punch = activeOpenShift(ledger.kitchen, actorId);
      setShiftGate(punch ? "clocked" : "choose");
      setShiftStep(0);
    }
  }

  function leaveDesk() {
    emitOfficeIntent({ type: "collapse" });
    collapseSavedOffice(environment, localStorage);
  }

  function goTab(next: Tab) {
    leaveDesk();
    setTab(next);
    closeAdd();
  }

  function beginSignOut() {
    workShiftInputRef.current = null;
    workShiftDateRef.current = today;
    const punch = activeOpenShift(ledger.kitchen, actorId);
    if (punch?.status === "open") void runKitchen((current) => clockOutShift(current, { memberId: actorId }));
    setMode("shift");
    setAdding(true);
    setAddSlide(0);
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

  function clockOutStayOnShiftPage() {
    workShiftInputRef.current = null;
    workShiftDateRef.current = today;
    const punch = activeOpenShift(ledger.kitchen, actorId);
    if (punch?.status === "open") void runKitchen((current) => clockOutShift(current, { memberId: actorId }));
    setAdding(false);
  }

  function beginFinishedShift(initialDate = today) {
    workShiftInputRef.current = null;
    workShiftDateRef.current = initialDate;
    setMode("shift");
    setAdding(true);
    setAddSlide(0);
    setAddDetails(false);
    setError("");
    setConfirm(null);
    setShiftGate("finished");
    setShiftStep(0);
    setForm(formForAccount(null, { hours: "", sales: "0", cashTips: "0", ccTips: "0" }));
  }

  const openPayCard = (account: Account) => {
    const card = creditCardView(ledger, account, today);
    const remaining = Math.max(0, card.statementBalanceCents - card.paidSinceStatementCents);
    const amount = remaining > 0 ? remaining : card.minPaymentCents;
    setFocusedAccountId(account.id);
    setMode("transfer");
    setAdding(true);
    setAddSlide(0);
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
          customersServed: Number(form.customersServed || 0),
          staffingCount: Number(form.staffingCount || 1),
          eventTag: form.eventTag || "regular",
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
        funding: form.useHouseholdFund && current.householdFund && mode === "expense"
          ? {
              fundId: current.householdFund.id,
              fundedCents: parseAmount(form.fundedAmount || form.amount),
              destinationAccountId: form.fundDestinationAccountId || form.accountId,
            }
          : undefined,
      });
    });
  }

  function submitWorkShift(input: PostWorkShiftInput, confirmDuplicate = false) {
    const current = householdRef.current;
    const currentMemberId = sessionRef.current?.memberId;
    const pending = confirmDuplicate
      ? workShiftInputRef.current
      : current && currentMemberId
        ? {
            input,
            environment: current.environment,
            householdId: current.householdId,
            memberId: currentMemberId,
          }
        : null;
    if (!workShiftScopeMatches(current, currentMemberId, pending)) {
      workShiftInputRef.current = null;
      setConfirm(null);
      setError(WORK_SHIFT_SCOPE_ERROR);
      return;
    }
    workShiftInputRef.current = pending;
    void run((live) => {
      try {
        return runScopedWorkShift(
          live,
          sessionRef.current?.memberId,
          pending,
          confirmDuplicate,
          (safeInput) => postWorkShift(live, safeInput),
        );
      } catch (caught) {
        workShiftInputRef.current = null;
        throw caught;
      }
    });
  }

  async function processEvidenceAutomationJobs(): Promise<void> {
    if (evidenceAutomationRef.current || postingRef.current) return;
    const current = householdRef.current;
    const memberId = sessionRef.current?.memberId;
    if (!current || !memberId) return;
    evidenceAutomationRef.current = true;
    const scope: EvidenceScope = { environment: current.environment, householdId: current.householdId, memberId };
    try {
      const status = await readEvidenceStatus(fetch);
      if (!status.available || status.environments?.[scope.environment]?.available === false) return;
      for (let count = 0; count < 3; count += 1) {
        const job = await claimEvidenceAutomationJob(scope);
        if (!job) break;
        try {
          const live = householdRef.current;
          const liveMember = sessionRef.current?.memberId;
          if (!live || live.environment !== scope.environment || live.householdId !== scope.householdId || liveMember !== scope.memberId) {
            await failEvidenceAutomationJob(scope, job, "runner-scope-changed", false);
            break;
          }
          const existingReceipt = findReceipt(live, job.jobKey);
          if (existingReceipt) {
            await acknowledgeEvidenceAutomationJob(scope, job, {
              jobKey: job.jobKey,
              bundleRevision: job.bundle.revision,
              commandEventId: existingReceipt.confirmationId,
              confirmationId: existingReceipt.confirmationId,
              resultRevision: existingReceipt.revision,
              identityHash: existingReceipt.identityHash,
              auditHash: existingReceipt.auditHash,
              reversalIds: existingReceipt.postedIds.filter((id) => id.startsWith("REV")),
              replacementShiftIds: existingReceipt.postedIds.filter((id) => id.startsWith("SHIFT-")),
              acknowledgedAt: new Date().toISOString(),
            });
            continue;
          }
          const validation = await validateEvidenceAutomationJob(scope, job);
          if (validation.materialHash !== job.bundle.materialHash || validation.actionKind !== job.actionKind) {
            await failEvidenceAutomationJob(scope, job, "job-changed-before-post", false);
            continue;
          }
          let result: CommitResult;
          if (job.actionKind === "post") {
            result = postWorkShift(live, buildAutomatedWorkShiftInput(job.bundle, job.policy, memberId));
          } else if (job.actionKind === "reconcile_week") {
            const bundleRows = await listEvidenceBundles(scope);
            const dateObservation = job.bundle.observations.find((row) => row.field === "date")?.value;
            if (typeof dateObservation !== "string") throw new ValidationError("Reconciliation evidence has no Toronto date.");
            const weekStart = automationPayrollWeekStart(dateObservation as import("./core/index.ts").DateKey, job.policy.payrollWeekStarts);
            const weekEnd = addDays(weekStart, 6);
            const active = live.shifts.filter((shift) => shift.memberId === memberId && shift.jobId === job.policy.jobId
              && shift.date >= weekStart && shift.date <= weekEnd && shift.sevenShiftsEvidenceBundle && !workShiftIsReversed(live, shift));
            const latest = new Map<string, typeof job.bundle>();
            for (const row of [...bundleRows.map((item) => item.bundle), job.bundle]) {
              if (row.jobId !== job.policy.jobId || row.memberId !== memberId || row.state !== "eligible") continue;
              const prior = latest.get(row.canonicalShiftKey);
              if (!prior || prior.revision < row.revision) latest.set(row.canonicalShiftKey, row);
            }
            const replacements = active.map((shift) => {
              const source = latest.get(shift.sevenShiftsEvidenceBundle!.canonicalShiftKey);
              if (!source) throw new ValidationError("The complete affected payroll week is not available for deterministic reconciliation.");
              return buildAutomatedWorkShiftInput(source, job.policy, memberId);
            });
            result = reconcileWorkWeekFromEvidence(live, {
              memberId,
              jobId: job.policy.jobId,
              payrollWeekStarts: job.policy.payrollWeekStarts,
              replacements,
              createdBy: memberId,
            });
          } else {
            await failEvidenceAutomationJob(scope, job, "closed-period-variance-review-required", true);
            continue;
          }
          const outcome = await commitHousehold(result.household, result.undo, memberId, {
            forceFlush: true,
            confirmationId: job.jobKey,
          });
          if (!outcome?.postedExactlyOnce || !outcome.identityHash) {
            await failEvidenceAutomationJob(scope, job, outcome?.errorClass ?? "command-not-accepted", outcome?.retryable !== true);
            if (outcome?.retryable) break;
            continue;
          }
          await acknowledgeEvidenceAutomationJob(scope, job, {
            jobKey: job.jobKey,
            bundleRevision: job.bundle.revision,
            commandEventId: outcome.duplicateOfReceiptId ?? outcome.confirmationId,
            confirmationId: outcome.confirmationId,
            resultRevision: outcome.revision,
            identityHash: outcome.identityHash,
            auditHash: outcome.household.booksAcceptedHash ?? "",
            reversalIds: outcome.postedIds.filter((id) => id.startsWith("REV")),
            replacementShiftIds: outcome.postedIds.filter((id) => id.startsWith("SHIFT-")),
            acknowledgedAt: new Date().toISOString(),
          });
        } catch (caught) {
          const waitingForPriorReceipt = job.actionKind === "post" && caught instanceof ValidationError && /changed after posting/i.test(caught.message);
          const code = waitingForPriorReceipt
            ? "prior-receipt-not-yet-recovered"
            : caught instanceof NeedsConfirmationError
            ? "material-duplicate-requires-review"
            : caught instanceof ValidationError
              ? "validation-rejected"
              : "runner-failed";
          await failEvidenceAutomationJob(scope, job, code, code !== "runner-failed" && !waitingForPriorReceipt).catch(() => undefined);
          if (code === "runner-failed") break;
        }
      }
    } catch {
      // A disabled, offline, or unauthenticated Evidence Worker never affects manual Shift.
    } finally {
      evidenceAutomationRef.current = false;
    }
  }

  function addPostLabel(): string {
    if (mode === "shift") return "Post shift";
    const digits = centsDigitsFromDollars(form.amount);
    const money = digits ? formatCad(Number(digits)) : "";
    if (mode === "transfer") return money ? `Move ${money}` : "Move money";
    const note = form.note.trim().toLowerCase();
    if (note === "milk" || note === "groceries") return money ? `Post groceries ${money}` : "Post groceries";
    if (note === "coffee") return money ? `Post coffee ${money}` : "Post coffee";
    return money ? `Post ${money}` : "Post";
  }

  return (
    <div className="app" data-ledger-mode={view} data-ledger-tab={tab}>
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
        <button
          type="button"
          className={`pill ${environment === "production" ? "prod" : "dev"}`}
          aria-label={`${environment === "production" ? "Production" : "Development"} environment. Switch environment.`}
          disabled={busy}
          onClick={() => setGuard({
            kind: "environment",
            next: environment === "production" ? "development" : "production",
          })}
        >
          {environment === "production" ? "Production" : "Development"}
        </button>
      </header>
      <SyncFreshnessStatus
        display={syncFreshnessDisplay}
        busy={busy}
        onAction={() => {
          void retryShareNow();
        }}
      />
      {error && !adding ? (
        <KitchenNotice
          message={error}
          onGoMore={() => goTab("more")}
          onDismiss={() => setError("")}
        />
      ) : null}
      <SoftPresenceStatus display={softPresenceDisplay} />
      <CommandProgressStatus display={commandProgressDisplay} />
      {commandChrome?.chip && !syncChromeSuppression.hideChip && (
        <div
          className={`command-chip command-chip--${commandChrome.chip.tone}`}
          role="status"
        >
          <span>{commandChrome.chip.primary}</span>
          {commandChrome.chip.secondary && <span className="muted">{commandChrome.chip.secondary}</span>}
          {commandChrome.chip.actionLabel && (
            <button
              type="button"
              className="ghost command-chip__action"
              disabled={busy}
              onClick={() => {
                const label = commandChrome.chip?.actionLabel;
                if (label === "Retry now" || label === "Retry") void retryShareNow();
              }}
            >
              {commandChrome.chip.actionLabel}
            </button>
          )}
        </div>
      )}
      {commandChrome?.banner && !syncChromeSuppression.hideBanner && (
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
              disabled={busy}
              onClick={() => {
                const label = commandChrome.banner?.actionLabel;
                if (label === "Retry" || label === "Retry now") void retryShareNow();
                else if (label === "Review pending") setTab("more");
                else if (label === "Open recovery") setTab("more");
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
            aria-selected={view === item}
            onClick={() => {
              if (item === "household" && tab === "shift") goTab("home");
              rememberSession({ memberId: session.memberId, view: item, householdId: household.householdId });
            }}
          >
            {ledgerNameForView(household, session.memberId, item)}
          </button>
        ))}
      </div>
      {experience && experience.ok && showsLedgerPurposeBanner(tab) ? (
        <LedgerPurposeBanner tab={tab} view={view} label={experience.label} />
      ) : null}

      {tab === "home" && dashboard && (
        <>
        {view === "household" && household.householdFund && (() => {
          const fund = projectHouseholdFund(household, today);
          return (
            <section className="card household-fund-glance is-phone-only" aria-label="Hearth Household Fund">
              <header><h2>Household Fund</h2><button className="ghost" type="button" onClick={() => goTab("ledger")}>Open Fund</button></header>
              <div className="grid">
                <div className="stat"><span>Operating</span><strong>{formatCad(fund.operatingBalanceCents)}</strong></div>
                <div className="stat"><span>Transfer due</span><strong>{formatCad(fund.transferDueCents)}</strong></div>
                <div className="stat"><span>Upcoming</span><strong>{formatCad(fund.upcomingReserveCents)}</strong></div>
                <div className="stat"><span>{fund.topUpNeededCents ? "Top-up needed" : "Fund free-to-spend"}</span><strong className={fund.topUpNeededCents ? "negative" : ""}>{formatCad(fund.topUpNeededCents || fund.freeToSpendCents)}</strong></div>
              </div>
              <p className="muted">The money remains in Bianca’s savings. Hearth cannot move it. Reconciliation: {fund.lastReconciledAt ? (fund.reconciliationTied ? "tied" : "needs review") : "not yet recorded"}.</p>
            </section>
          );
        })()}
        <Office
          household={displayHousehold}
          booksHousehold={household}
          dashboard={dashboard}
          today={today}
          environment={environment}
          memberId={session.memberId}
          view={view}
          integrityFindingCount={experience && experience.ok ? experience.integrityFindings.length : 0}
          integrityFindings={experience && experience.ok ? experience.integrityFindings : []}
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
            setForm((current) => ({ ...current, note: "Groceries", subcategoryId: "SUB-FOOD-GROCERIES" }));
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
          onSitDown={(next, token) => persistLedgerWrite(preserveCurrentPersonal(next), token)}
          onGo={(next) => {
            if (next === "add") {
              openAddFor(null);
              return;
            }
            goTab(next);
          }}
        />
        </>
      )}

      {tab === "plan" && dashboard && (
        <>
          <div className="plan-wide">
          <div className="plan-wide-lead">
          <section className="hero">
            <div className="label">{view === "household" ? "Household plan vs actual" : "My plan vs actual"}</div>
            <div className="money">{formatCad(dashboard.month.netBudgetedCents)}</div>
            <div className="sub">Budgeted net for {dashboard.monthLabel}</div>
          </section>
          <SitDownGuide
            household={household}
            displayHousehold={displayHousehold}
            dashboard={dashboard}
            view={view}
            memberId={actorId}
            onApply={(next, token) => persist(next, token)}
          />
          <KittyBanks
            household={displayHousehold}
            booksHousehold={household}
            view={view}
            createdBy={memberId}
            busy={busy}
            surface="plan"
            onCommand={(fn) => { void runKitchen(fn); }}
            onAskStartJar={(appointmentId, summary) => setGuard({ kind: "acceptVisitGoal", appointmentId, summary })}
            onShowHome={() => goTab("home")}
          />
          </div>
          <PlanCategories
            household={household}
            rows={dashboard.month.categories}
            monthKey={monthKeyFromDateKey(today)}
            onSave={(next, token) => persist(next, token)}
          />
          </div>
        </>
      )}

      {tab === "calendar" && (
        <CalendarPage
          household={displayHousehold}
          view={view}
          today={today}
          environment={environment}
          memberId={session.memberId}
          busy={busy}
          onCommand={(fn) => { void run(fn); }}
          onAskPost={(recurrenceId, summary) => setGuard({ kind: "postRecurrence", recurrenceId, summary })}
          onAskPostDue={(recurrenceIds, summary) => setGuard({ kind: "postDueAll", summary, recurrenceIds })}
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

      {tab === "shift" && (
        <WorkShiftPage
          key={`${environment}:${household.householdId}:${session.memberId}`}
          household={experience && experience.ok ? experience.shiftHousehold : household}
          view={view}
          memberId={session.memberId}
          memberName={household.members.find((member) => member.id === session.memberId)?.name ?? "You"}
          today={today}
          environment={environment}
          busy={busy}
          onClockIn={() => { void runKitchen((current) => clockInShift(current, { memberId: actorId })); }}
          onAbandon={() => { void runKitchen((current) => abandonOpenShift(current, { memberId: actorId })); }}
          onStartBreak={(kind) => { void runKitchen((current) => startShiftBreak(current, { memberId: actorId, kind })); }}
          onEndBreak={() => { void runKitchen((current) => endShiftBreak(current, { memberId: actorId })); }}
          onChooseTimeline={(keepId) => { void runKitchen((current) => chooseOpenShiftTimeline(current, { memberId: actorId, keepId })); }}
          onClockOut={clockOutStayOnShiftPage}
          onConfirmShift={(input) => submitWorkShift(input)}
          duplicateConfirm={
            confirm
            && workShiftInputRef.current
            && !adding
            && workShiftInputRef.current.memberId === session.memberId
            && workShiftInputRef.current.input.memberId === session.memberId
              ? confirm
              : null
          }
          onConfirmAnyway={() => {
            const pending = workShiftInputRef.current;
            const plan = resolveDuplicateRetry({
              pendingWorkShift: pending?.input ?? null,
              confirmCode: confirm?.code ?? null,
              tab,
            });
            if (plan.kind === "work-shift" && pending && pending.memberId === session.memberId) {
              submitWorkShift(pending.input, true);
            }
          }}
          onDismissDuplicate={() => setConfirm(null)}
          onCorrect={(shift, transactionId) => setGuard({ kind: "correctShift", shift, transactionId })}
          onAskSaveJob={(job, summary) => setGuard({ kind: "saveWorkJob", job, summary })}
          onArchiveJob={(jobId) => { void run((current) => archiveWorkJob(current, jobId)); }}
          onOpenCalendar={() => goTab("calendar")}
          onSaveSevenShiftsSchedule={(schedules, confirmedPersonalFeed) => {
            void run((current) => refreshSevenShiftsSchedule(current, {
              memberId: session.memberId,
              createdBy: actorId,
              schedules,
              confirmedPersonalFeed,
            }));
          }}
        />
      )}

      {tab === "ledger" && (
        <BooksPage
          household={displayHousehold}
          booksHousehold={household}
          memberId={session.memberId}
          view={view}
          booksStatus={booksStatus}
          focusedAccountId={focusedAccountId}
          sourceFocus={herculesSourceFocus}
          onFocusAccount={setFocusedAccountId}
          onClearSource={() => setHerculesSourceFocus(null)}
          onChange={(next, token) => persistLedgerWrite(preserveCurrentPersonal(next), token)}
          onCommand={(command) => { void run(command); }}
          onPayAccount={openPayCard}
          onAddToAccount={(account) => openAddFor(account)}
          onGoMore={() => goTab("more")}
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
          {environment === "development" && (
            <section className="card">
              <header><h2>Start from scratch</h2></header>
              <p className="muted">
                Deletes leftover Development households this Google account owns, leaves any you only joined, and clears this phone’s Development copies. Production stays.
              </p>
              <button
                className="danger"
                type="button"
                style={{ width: "100%", marginTop: 8 }}
                disabled={busy}
                onClick={() => setGuard({ kind: "reset-development" })}
              >
                {busy ? "Starting over…" : "Start from scratch"}
              </button>
            </section>
          )}
          <section className="card">
            <header><h2>Account</h2></header>
            <p className="muted">
              You are {household.members.find((member) => member.id === session.memberId)?.name}.
              Sign out removes Google and Auth tokens from this phone only. The cloud household stays.
            </p>
            <button
              type="button"
              className="ghost"
              style={{ width: "100%", marginTop: 8 }}
              disabled={busy}
              onClick={requestClearThisPhone}
            >
              Sign out
            </button>
          </section>
          <section className="card">
            <header><h2>{view === "household" ? "Household table" : "My books"}</h2></header>
            <p className="muted">
              {view === "household"
                ? "Fund, cash, and cards you share. Net worth, trial, and statements stay in Audit, behind this door."
                : "Listed accounts in this folio are mine. The figure on My books is accepted-books position."}
            </p>
            <button className="primary" type="button" onClick={() => goTab("ledger")}>
              {view === "household" ? "Open the household table" : "Open my books"}
            </button>
          </section>
          <section className="card">
            <header><h2>{experience && experience.ok ? experience.integrityLabel : "Health"}</h2><span className={`pill ${healthFindings.length ? "warn" : "good"}`}>{healthFindings.length ? `${healthFindings.length} findings` : "Clean"}</span></header>
            <p className="muted">{view === "household" ? "This is the full-household books signal. It does not reveal Personal envelopes." : "Integrity still runs on the accepted household. Personal amounts stay in this folio."}</p>
            {!(experience && experience.ok) ? <p className="muted">Choose who is using this ledger before reading Health.</p> : healthFindings.length === 0 ? <p className="muted">Ledger, splits, transfers, shifts, flags, and the books agree.</p> : (
              <ul className="health">{healthFindings.map((finding) => <li key={finding.section + finding.message}><strong>{finding.section}.</strong> {finding.message}</li>)}</ul>
            )}
          </section>
          <section className="card">
            <header>
              <h2>Recent changes</h2>
              <span className="muted">{recentChangesHeaderPill({
                environment,
                historyCount: history.length,
                myLedgerCount: history.filter((item) => (
                  isLedgerWrite(item)
                  && (!item.actorMemberId || item.actorMemberId === session.memberId)
                )).length,
              })}</span>
            </header>
            {history.filter((item) => (
              isLedgerWrite(item)
              && (!item.actorMemberId || item.actorMemberId === session.memberId)
            )).length === 0 ? (
              <p className="muted">{recentChangesEmptyCopy(environment)}</p>
            ) : (
              [...history]
                .filter((item) => (
                  isLedgerWrite(item)
                  && (!item.actorMemberId || item.actorMemberId === session.memberId)
                ))
                .reverse()
                .map((item, index) => (
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
          <section className="card">
            <header>
              <h2>Restore points</h2>
              <span className="muted">{restorePointsHeaderPill(listRestorePoints(household).length)}</span>
            </header>
            {listRestorePoints(household).length === 0 ? (
              <p className="muted">{restorePointsEmptyCopy(isHouseholdOwner)}</p>
            ) : (
              listRestorePoints(household).map((point) => {
                const gate = canRestorePoint(household, point, { isOwner: isHouseholdOwner });
                return (
                  <div className="row" key={point.id}>
                    <span>
                      {point.label}
                      <span className="muted"> · rev {point.sourceRevision}</span>
                    </span>
                    {isHouseholdOwner ? (
                      <button
                        className="chip"
                        disabled={busy || !gate.ok}
                        title={gate.ok ? undefined : gate.message}
                        onClick={() => setGuard({
                          kind: "restorePoint",
                          pointId: point.id,
                          summary: restoreConfirmBody(point, household),
                        })}
                      >
                        Restore
                      </button>
                    ) : (
                      <span className="muted">owner only</span>
                    )}
                  </div>
                );
              })
            )}
            {!isHouseholdOwner && listRestorePoints(household).length > 0 ? (
              <p className="muted">Everyone can see restore points. Only an owner can Restore.</p>
            ) : null}
          </section>
          <PairingCard
            household={household}
            memberId={session.memberId}
            error={error}
            busy={busy}
            syncState={syncState}
            syncFreshnessLine={syncFreshnessLine}
            inviteInput={inviteInput}
            onInviteInput={setInviteInput}
            onHousehold={async (next) => { await persist(next); }}
            onError={setError}
            onBusy={setBusy}
            onSyncState={setSyncState}
            onBeforeSensitive={() => gateWithGoogle({ record: true })}
            softPresenceOptedOut={softPresenceOptOut}
            onSoftPresenceOptOut={applySoftPresenceOptOut}
          />
          <GoogleBridgeCard
            household={household}
            environment={environment}
            memberId={session.memberId}
            busy={busy}
            onCommand={(fn) => { void run(fn); }}
            onError={setError}
            onSignOut={requestClearThisPhone}
          />
          <HerculesProPermissionsCard
            environment={environment}
            household={household}
            session={session}
            onChanged={(permissions) => {
              const nextHousehold = { ...household, herculesProPermissions: permissions };
              setHousehold(nextHousehold);
              setPersonalReplica((current) => {
                const base = current?.memberId === session.memberId
                  ? current
                  : splitForSync(household, session.memberId).personal;
                return { ...base, herculesProPermissions: permissions };
              });
              void saveHousehold(nextHousehold, {
                operatingEnvironment: environment,
                memberId: session.memberId,
              }).catch((caught) => setError(caught instanceof Error ? caught.message : String(caught)));
            }}
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
            <p className="muted" style={{ marginTop: 12 }}>
              Sign out clears Google and Auth tokens on this phone only. The cloud household stays.
              Native Keychain storage is a later release note — web builds keep tokens in localStorage until then.
            </p>
            <button
              className="ghost"
              style={{ width: "100%", marginTop: 8 }}
              disabled={busy}
              onClick={() => setGuard({ kind: "clear-this-phone" })}
            >
              Sign out and clear this phone
            </button>
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
              Export follows the active ledger: Shared never includes Personal accounts, Personal rows, or private Fund reconciliation.
            </p>
            <button className="primary" onClick={() => {
              if (!experience || !experience.ok) {
                setError("Choose who is using this ledger before exporting.");
                return;
              }
              downloadJson(experience.exportHousehold);
            }}>
              {view === "personal" ? "Export this Personal folio" : "Export Shared snapshot"}
            </button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setGuard({ kind: "stress-random" })}>Reload random data</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => setGuard({ kind: "stress-pretty" })}>Display pretty numbers</button>
            <button className="ghost" style={{ width: "100%", marginTop: 8 }} onClick={() => {
              const due = experience && experience.ok
                ? experience.scopedHousehold.recurrences.filter((item) => item.active && item.nextDate <= today)
                : [];
              setGuard({
                kind: "postDueAll",
                recurrenceIds: due.map((item) => item.id),
                summary: due.length
                  ? `This posts ${due.length} due repeating ${due.length === 1 ? "item" : "items"} into the books.`
                  : "Nothing is due today. Open Calendar to see what is coming.",
              });
            }}>Post due recurring</button>
            {environment === "development" && (
              <button className="danger" style={{ width: "100%", marginTop: 8 }} onClick={() => setGuard({ kind: "erase-development" })}>
                Erase Development data
              </button>
            )}
            {environment === "development" && session && (
              <button
                className="danger"
                style={{ width: "100%", marginTop: 8 }}
                disabled={busy}
                onClick={() => {
                  void (async () => {
                    setBusy(true);
                    try {
                      const authSession = await ensureSupabaseSession(environment);
                      if (!authSession) {
                        throw new Error("Continue with Google before deleting a household.");
                      }
                      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
                      const identity = { email: authSession.email, subject: authSession.googleSubject };
                      const role = await fetchContinuityMembershipRole({
                        householdId: household.householdId,
                        memberId: session.memberId,
                        identity,
                        environment,
                        config: cloudConfig,
                      });
                      setGuard({
                        kind: "delete-household",
                        householdId: household.householdId,
                        name: household.name,
                        memberId: session.memberId,
                        role,
                      });
                    } catch (caught) {
                      setError(caught instanceof Error ? caught.message : String(caught));
                    } finally {
                      setBusy(false);
                    }
                  })();
                }}
              >
                Delete this Development household
              </button>
            )}
            {environment === "development" && (
              <p className="muted" style={{ marginTop: 8 }}>
                To wipe every leftover Development household, use <strong>Start from scratch</strong> at the top of this page.
              </p>
            )}
          </section>
          <AddCategoryForm household={household} onSave={(next, token) => persist(next, token)} />
        </>
      )}

      {adding && (
        <AddSlideshow
          sheetRef={addSheetRef}
          mode={mode}
          onSwitchMode={switchAddMode}
          form={form}
          setForm={setForm}
          household={household}
          booksHousehold={household}
          pickerAccounts={pickerAccounts}
          categories={categories}
          today={today}
          slideIndex={addSlide}
          onSlideIndex={setAddSlide}
          shiftGate={shiftGate}
          hasWorkJobs={household.workJobs.some((job) => job.active && job.memberId === actorId)}
          shiftJobsPanel={(
            <>
              <ShiftReportScanBar
                busy={busy}
                scanBusy={shiftScanBusy}
                error={shiftScanError}
                onFile={(file) => { void applyShiftReportScan(file); }}
              />
              <WorkShiftWithSevenShifts
                key={`${environment}:${household.householdId}:${actorId}`}
                household={displayHousehold}
                memberId={actorId}
                today={workShiftDateRef.current}
                punch={activeOpenShift(household.kitchen, actorId)}
                busy={busy || shiftScanBusy}
                initialDraft={workShiftDraft}
                scanWarnings={shiftScanWarnings}
                onClearDraft={() => {
                  setWorkShiftDraft(null);
                  setShiftScanWarnings([]);
                  setShiftScanError("");
                }}
                onConfirm={(input) => {
                  setWorkShiftDraft(null);
                  setShiftScanWarnings([]);
                  submitWorkShift(input);
                }}
              />
            </>
          )}
          shiftPreview={shiftPreview}
          shiftTick={shiftTick}
          onHoursDirty={() => setHoursDirty(true)}
          onClockIn={() => {
            void runKitchen((current) => clockInShift(current, { memberId: form.memberId }));
            setAdding(false);
          }}
          onAlreadyOff={() => beginFinishedShift()}
          onSignOut={beginSignOut}
          onNeverMind={() => {
            void runKitchen((current) => abandonOpenShift(current, { memberId: actorId }));
            setAdding(false);
          }}
          punchStartedAt={activeOpenShift(household.kitchen, actorId)?.startedAt}
          busy={busy}
          error={error}
          onDismissError={() => setError("")}
          onGoMore={() => { setAdding(false); goTab("more"); }}
          confirm={confirm}
          confirmPanelRef={confirmPanelRef}
          onConfirmAnyway={() => {
            const pending = workShiftInputRef.current;
            const plan = resolveDuplicateRetry({
              pendingWorkShift: pending?.input ?? null,
              confirmCode: confirm?.code ?? null,
              tab,
            });
            if (plan.kind === "work-shift" && pending) {
              submitWorkShift(pending.input, true);
            } else {
              submit({ confirmDuplicate: true });
            }
          }}
          postLabel={addPostLabel()}
          onPost={() => submit()}
          onClose={closeAdd}
          persistCategory={(next, token) => persist(next, token)}
          presetId={presetId}
          onPresetId={setPresetId}
          onSavePreset={() => {
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
          onForgetPreset={() => {
            const id = presetId;
            if (!id) return;
            setPresetId(null);
            void run((current) => archivePreset(current, id));
          }}
          categoryTouched={categoryTouched}
          onCategoryTouched={() => setCategoryTouched(true)}
          codingHint={codingHint}
          onCodingHint={setCodingHint}
          splitPercents={splitPercents}
          onMemberPercent={setMemberPercent}
          addDetails={addDetails}
          onAddDetails={setAddDetails}
          placePrefs={placePrefs}
          onPlacePrefs={setPlacePrefs}
          environment={environment}
          showLocationPrompt={showLocationPrompt}
          onShowLocationPrompt={setShowLocationPrompt}
          locationBusy={locationBusy}
          applyConfiguredStamps={applyConfiguredStamps}
          clearLocationStamp={clearLocationStamp}
          draftLocation={draftLocation}
          displayZone={displayZone}
          experienceLine={experience && experience.ok ? `${experience.label}. ${ledgerRouteContract("home", view).heading}.` : ""}
        />
      )}

      {guard?.kind === "erase-development" && (
        <ConfirmSheet
          title="Erase all Development activity?"
          body="This removes every Development transaction, shift, bill, import, appointment, claim, goal, budget, note, reconciliation, and command history from this household. It keeps the household identity, members, ledger names, Google connection, accounts, categories, jobs, and shift settings so testing can continue."
          extra={`This cannot be undone. If this household synchronizes, the empty Development activity can replace the shared Development cloud copy. Production is not touched. ${googleStepUpExtra}`}
          confirmLabel="Erase all Development activity"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                await gateWithGoogle({ record: false });
                setHistory([]);
                setToast(null);
                setGuard(null);
                await persist(eraseDevelopmentData(household));
                if (session?.memberId) {
                  clearUndoHistory(environment, household.householdId, session.memberId);
                }
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      {guard?.kind === "clear-this-phone" && (
        <ConfirmSheet
          title="Sign out and clear this phone?"
          body="This removes the Google and Auth session, Undo history, and local household copy from this phone. The cloud household and partner phones are not deleted. Use Start from scratch in Development to delete the cloud households this Google account owns."
          extra={googleStepUpExtra}
          confirmLabel="Sign out and clear this phone"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                const who = session?.memberId;
                const hid = household.householdId;
                if (who) {
                  clearUndoHistory(environment, hid, who);
                  disconnectGoogle(environment, who);
                }
                clearSupabaseSession(environment);
                clearSession(environment);
                clearPendingAuthInvite();
                clearSyncAnchor(environment, hid);
                clearContinuityOutboxForHousehold(environment, hid);
                await clearHousehold(environment, hid);
                closeAdd();
                householdRef.current = null;
                sessionRef.current = null;
                setHistory([]);
                setToast(null);
                setPersonalReplica(null);
                setHousehold(null);
                setSession(null);
                setDiscoveredLedgers([]);
                setGuard(null);
                setError("");
                setWelcomeMode("home");
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      {householdResetGuards}
      {guard?.kind === "environment" && (
        <ConfirmSheet
          title={`Switch to ${guard.next}?`}
          body={`${environment} stays as its own ledger pill. ${
            guard.next === "production"
              ? (
                productionContinuityEnabled()
                  ? "Production can use Google-matched cloud continuity on this build when membership exists."
                  : "Production stays on this phone until Production cloud continuity is enabled."
              )
              : "Development is the usual working ledger and may already sync to the disposable cloud."
          }`}
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
                closeAdd();
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
      {guard?.kind === "stress-random" && (
        <ConfirmSheet
          title="Reload randomized stress data?"
          body={`This replaces the ${environment} ledger activity with twelve months of fictional CAD covering weighted harbour shifts (weather, location, full tip/sales forms), wages, tips, expenses, bills, imported rows, transfers, appointments, claims, goals, budgets, presets, card balances, and money owed. In Development it keeps this household’s Google link and membership so Hercules Pro can still read the fixture after sync. Tip shifts are posted for the member signed in on this phone.`}
          extra={googleStepUpExtra}
          confirmLabel="Load random stress data"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                await gateWithGoogle({ record: false });
                setGuard(null);
                const seeded = seedStressHousehold({
                  today,
                  environment,
                  seed: Date.now() & 0xffffffff,
                  numberStyle: "realistic",
                  preserveFrom: environment === "development" ? household ?? undefined : undefined,
                  tipMemberId: session?.memberId,
                });
                await persist(seeded, undefined, session?.memberId, { forceFlush: true });
                const who = session?.memberId;
                if (who && hostedContinuityAllowed(environment)) {
                  const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
                  const googleSession = loadGoogleSession(environment, who);
                  const continuityIdentity: ContinuityIdentity | null = authSession
                    ? { email: authSession.email, subject: authSession.googleSubject }
                    : googleSession?.identity
                      ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
                      : null;
                  if (continuityIdentity) {
                    const flushed = await flushContinuityOutbox({
                      environment,
                      identity: continuityIdentity,
                      config: authenticatedSupabaseConfig(readSupabaseConfig(), authSession),
                    });
                    if (flushed.conflicts[0]) {
                      setError(flushed.conflicts[0].message);
                    } else if (flushed.pending > 0) {
                      setError(`Stress data is on this phone (${seeded.shifts.length} shifts) but ${flushed.pending} cloud push${flushed.pending === 1 ? " is" : "es are"} still pending. Open Pairing / Retry now before asking Hercules Pro.`);
                    }
                  }
                }
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : String(caught));
              } finally {
                setBusy(false);
              }
            })();
          }}
        />
      )}
      {guard?.kind === "stress-pretty" && (
        <ConfirmSheet
          title="Display a fresh pretty-number household?"
          body={`This replaces the ${environment} ledger activity with a twelve-month fictional household. Amounts are deliberately rounded into clean, presentation-friendly values while the same weather-weighted harbour shifts, location stamps, bills, imports, appointments, claims, goals, budgets, and owed balances remain testable. In Development it keeps this household’s Google link and membership for Hercules Pro. Tip shifts go to the member signed in on this phone.`}
          extra={googleStepUpExtra}
          confirmLabel="Load pretty numbers"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void (async () => {
              setBusy(true);
              try {
                await gateWithGoogle({ record: false });
                setGuard(null);
                const seeded = seedStressHousehold({
                  today,
                  environment,
                  seed: Date.now() & 0xffffffff,
                  numberStyle: "pretty",
                  preserveFrom: environment === "development" ? household ?? undefined : undefined,
                  tipMemberId: session?.memberId,
                });
                await persist(seeded, undefined, session?.memberId, { forceFlush: true });
                const who = session?.memberId;
                if (who && hostedContinuityAllowed(environment)) {
                  const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
                  const googleSession = loadGoogleSession(environment, who);
                  const continuityIdentity: ContinuityIdentity | null = authSession
                    ? { email: authSession.email, subject: authSession.googleSubject }
                    : googleSession?.identity
                      ? { email: googleSession.identity.email, subject: googleSession.identity.subject }
                      : null;
                  if (continuityIdentity) {
                    const flushed = await flushContinuityOutbox({
                      environment,
                      identity: continuityIdentity,
                      config: authenticatedSupabaseConfig(readSupabaseConfig(), authSession),
                    });
                    if (flushed.conflicts[0]) {
                      setError(flushed.conflicts[0].message);
                    } else if (flushed.pending > 0) {
                      setError(`Pretty numbers are on this phone (${seeded.shifts.length} shifts) but ${flushed.pending} cloud push${flushed.pending === 1 ? " is" : "es are"} still pending. Open Pairing / Retry now before asking Hercules Pro.`);
                    }
                  }
                }
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
          body={`${guard.summary} Both the original and the reversing entry stay. Prefer Undo from the toast or More → Recent when it is your latest Confirm.`}
          confirmLabel="Reverse"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const id = guard.transactionId;
            setGuard(null);
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
      {guard?.kind === "restorePoint" && (
        <ConfirmSheet
          title="Restore shared books?"
          body={guard.summary}
          confirmLabel="Restore"
          danger
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const pointId = guard.pointId;
            setGuard(null);
            void runRestorePoint(pointId);
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
              recurrenceIds: rows.map((row) => row.recurrenceId),
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
                 fundingDefault: draft.type === "expense" && draft.useHouseholdFund && current.householdFund
                   ? {
                       fundId: current.householdFund.id,
                       fundedCents: draft.fundAmount.trim() ? Math.round(Number(draft.fundAmount) * 100) : "full" as const,
                       destinationAccountId: draft.fundDestinationAccountId || draft.accountId,
                     }
                   : null,
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
            const ids = guard.recurrenceIds;
            setGuard(null);
            void run((current) => postDueRecurrences(current, today, ids));
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
          title="Start this goal?"
          body={`${guard.summary} Hercules proposed it. This write is yours.`}
          confirmLabel="Start this goal"
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
        {commandProgressDisplay.liveAnnouncement ?? commandChrome?.liveAnnouncement ?? ""}
      </p>

      {toast && commandChrome?.toast && (
        <div className="toast">
          <span>
            {commandChrome.toast.primary}
            {commandChrome.toast.secondary ? `. ${commandChrome.toast.secondary}` : ""}
            {commandChrome.toast.showUndo !== false
              ? ` ${undoToastSecondaryCopy()} Find it later under More → Recent on this phone.`
              : ""}
          </span>
          {commandChrome.toast.showUndo !== false && (
            <button
              className="ghost"
              style={{ color: "var(--paper)" }}
              type="button"
              onClick={() => void applyUndo(toast)}
            >
              Undo
            </button>
          )}
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
              { label: "Shift", run: () => goTab("shift") },
              { label: "Plan", run: () => goTab("plan") },
              { label: view === "household" ? "Household table" : "My books", run: () => goTab("ledger") },
              { label: "Health", run: () => goTab("more") },
              { label: "Google household bridge", run: () => goTab("more") },
              { label: "Ask Hercules", run: () => goTab("home") },
              { label: "Export", run: () => {
                if (!experience || !experience.ok) {
                  setError("Choose who is using this ledger before exporting.");
                  return;
                }
                downloadJson(experience.exportHousehold);
              } },
            ].map((item) => (
              <button key={item.label} onClick={() => { item.run(); setCommandOpen(false); }}>{item.label}</button>
            ))}
          </div>
        </div>
      )}

      <HerculesPresence
        household={experience && experience.ok ? experience.herculesHousehold : displayHousehold}
        today={today}
        tab={tab}
        adding={adding}
        visorPop={visorPop}
        spark={spark}
        memberId={session.memberId}
        view={view}
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
        onOpenSource={(source: HerculesNumberSource) => {
          setHerculesSourceFocus(source);
          rememberSession({ memberId: session.memberId, view: source.view, householdId: household.householdId });
          if (source.accountId) setFocusedAccountId(source.accountId);
          if (source.route === "calendar") requestCalendarPane("board", localStorage);
          goTab(source.route);
          if (source.surface && source.route === "home") {
            window.setTimeout(() => emitOfficeIntent({ type: "expand", id: source.surface! }), 0);
          }
        }}
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

      <HerculesProApproval
        authorizationRequest={herculesProRequest}
        environment={environment}
        household={household}
        session={session}
      />

      <nav className={`nav${fabOpen ? " is-fab-open" : ""}`} data-ledger-nav={view === "household" ? "shared" : "personal"} aria-label="Hearth">
        {kitchenPrimaryNav(view).includes("home") && (
        <button
          className={tab === "home" && !adding ? "active" : ""}
          aria-current={tab === "home" && !adding ? "page" : undefined}
          onClick={() => goTab("home")}
        >
          Home
        </button>
        )}
        {kitchenPrimaryNav(view).includes("calendar") && (
        <button
          className={tab === "calendar" ? "active" : ""}
          aria-current={tab === "calendar" ? "page" : undefined}
          aria-label="Calendar"
          onClick={() => goTab("calendar")}
        >
          Cal
        </button>
        )}
        {kitchenPrimaryNav(view).includes("shift") && (
        <button
          className={tab === "shift" ? "active" : ""}
          aria-current={tab === "shift" ? "page" : undefined}
          aria-label="Shifts"
          onClick={() => goTab("shift")}
        >
          Shift
        </button>
        )}
        <FabSpeedDial
          closed={adding}
          onOpenChange={setFabOpen}
          onPick={(nextMode) => openAddFor(null, nextMode)}
        />
        {kitchenPrimaryNav(view).includes("plan") && (
        <button
          className={tab === "plan" ? "active" : ""}
          aria-current={tab === "plan" ? "page" : undefined}
          onClick={() => goTab("plan")}
        >
          Plan
        </button>
        )}
        {kitchenPrimaryNav(view).includes("ledger") && (
        <button
          className={tab === "ledger" ? "active" : ""}
          aria-current={tab === "ledger" ? "page" : undefined}
          onClick={() => goTab("ledger")}
        >
          Books
        </button>
        )}
        {kitchenPrimaryNav(view).includes("more") && (
        <button
          className={tab === "more" ? "active" : ""}
          aria-current={tab === "more" ? "page" : undefined}
          onClick={() => goTab("more")}
        >
          More
        </button>
        )}
      </nav>
    </div>
  );
}

function PlanCategories({
  household,
  rows,
  monthKey,
  onSave,
}: {
  household: Household;
  rows: CategoryActual[];
  monthKey: MonthKey;
  onSave: (household: Household, undo?: UndoToken) => void;
}) {
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const visible = rows.filter((row) => row.budgetedCents || row.actualCents);
  function saveBudget(subcategoryId: string, amount: string) {
    try {
      const result = setBudget(household, { monthKey, subcategoryId, amount });
      onSave(result.household, result.undo);
      setEditId(null);
      setError("");
    } catch (caught) {
      setError(caught instanceof ValidationError ? caught.message : String(caught));
    }
  }
  return (
    <section className="card">
      <header><h2>Categories</h2></header>
      <p className="muted">Add or adjust this month’s plan here. Posted actuals stay. Zeroing a budget does not hide history.</p>
      <KitchenNotice message={error} />
      {visible.length === 0 ? <p className="muted">No budget plans or expense actuals this month yet.</p> : visible.map((row) => {
        const pct = row.budgetedCents ? Math.min(140, (row.actualCents / row.budgetedCents) * 100) : 0;
        return (
          <div key={row.subcategoryId} style={{ marginBottom: 10 }}>
            <div className="row">
              <span>{row.name}</span>
              {editId === row.subcategoryId ? (
                <span className="budget-edit">
                  <span className="muted">{formatCad(row.actualCents)} /</span>
                  <input
                    inputMode="decimal"
                    value={draft}
                    autoFocus
                    aria-label={`Budget for ${row.name} in ${monthKey}`}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") setEditId(null);
                      if (event.key === "Enter") saveBudget(row.subcategoryId, draft);
                    }}
                  />
                  <button type="button" className="chip" onClick={() => saveBudget(row.subcategoryId, draft)}>Save</button>
                  <button type="button" className="chip quiet" onClick={() => setEditId(null)}>Cancel</button>
                </span>
              ) : (
                <span className="chips">
                  <button
                    type="button"
                    className={`budget-edit-trigger ${row.budgetedCents && row.actualCents > row.budgetedCents ? "over" : ""}`}
                    aria-label={`Edit ${row.name} budget. Actual ${formatCad(row.actualCents)}, budget ${formatCad(row.budgetedCents)}`}
                    onClick={() => {
                      setEditId(row.subcategoryId);
                      setDraft(row.budgetedCents ? (row.budgetedCents / 100).toFixed(2) : "");
                      setError("");
                    }}
                  >
                    {formatCad(row.actualCents)} / {formatCad(row.budgetedCents)}
                  </button>
                  <button
                    type="button"
                    className="budget-remove"
                    disabled={!row.budgetedCents}
                    aria-label={`Remove ${row.name} plan`}
                    onClick={() => saveBudget(row.subcategoryId, "0")}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <div className="bar"><i className={pct > 100 ? "over" : ""} style={{ width: `${Math.min(pct, 100)}%` }} /></div>
          </div>
        );
      })}
      <AddCategoryForm household={household} onSave={onSave} embedded />
    </section>
  );
}
