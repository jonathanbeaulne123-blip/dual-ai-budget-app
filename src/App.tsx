import { useEffect, useMemo, useRef, useState } from "react";
import {
  JOINT,
  NeedsConfirmationError,
  ValidationError,
  addFormDefaults,
  buildDashboard,
  previewShiftAmounts,
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
  householdNeedsCharterFounding,
  offerHouseholdOnboarding,
  acceptedHouseholdOnboarding,
  copy,
  nextChapterFor,
  showsLedgerPurposeBanner,
  projectLedgerExperience,
  restoreAcceptedSnapshot,
  setBudget,
  nameHouseholdLedgers,
  linkGoogleIdentity,
  assembleHousehold,
  splitForSync,
  personalReplicaForMember,
  fundRailPreferenceUpdateAllowed,
  memberPersonalPreferenceUpdateAllowed,
  setHerculesProPermissions,
  financialAuditHash,
  householdWallet,
  jointSplit,
  memberNeedsGoogleStepUp,
  parseAmount,
  percentSplits,
  projectHouseholdFund,
  postDueRecurrences,
  postEntry,
  postOneRecurrence,
  resolveSwipeCardAccount,
  swipeBelongsOnSharedHome,
  swipeUndoScopeMatches,
  SWIPE_COPY,
  SWIPE_UNDO_MS,
  addRecurrence,
  updateRecurrence,
  postShift,
  postWorkShiftWithAttendanceReview,
  confirmShiftEnvelopeOutcome,
  appendShiftBibleWeather,
  readHistoricalShiftWeather,
  refreshSevenShiftsSchedule,
  refreshShiftEnvelopesFromEvidence,
  importCoworkerRoster,
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
  requestShiftEnvelope,
  requestCalendarPane,
  seedDemoHousehold,
  generateDemoSuite,
  verifyDemoSuite,
  freshDemoSeed,
  preserveDemoShowcaseContinuity,
  eraseDevelopmentData,
  shiftSettingsFingerprint,
  archiveWorkJob,
  upsertWorkJob,
  recordEarningCadence,
  todayKey,
  monthKeyFromDateKey,
  TIMEZONE,
  detectDeviceTimeZone,
  COMMON_TIME_ZONES,
  formatZoneLabel,
  formatZoneDateTime,
  loadPhonePlacePrefs,
  savePhonePlacePrefs,
  locationLabel,
  shapeTransactionLocation,
  touchGoogleConfirmation,
  touchVisitSpark,
  undoLedgerConfirm,
  fundedMoneyUndoTarget,
  assertLatestMemberLedgerUndo,
  appendRestorePoint,
  applyRestorePoint,
  canRestorePoint,
  listRestorePoints,
  restoreConfirmBody,
  reversePostedMoney,
  beginShiftBibleCorrection,
  autoResolveSharedConflict,
  canAbsorbDisjointSharedMoney,
  absorbDisjointSharedMoney,
  resolveStoredConflictsLastEntryWins,
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
  type WorkPaySchedule,
  type CommitResult,
  type CommandOutcome,
  type Environment,
  type Household,
  type PersonalEnvelope,
  type LedgerView,
  type MonthKey,
  type MonthRehearsalTaskId,
  type Split,
  type SwipeUndoStrip,
  type UndoToken,
  type Visibility,
  type Account,
  type CategoryActual,
  type VisitPostDraft,
  type TransactionLocation,
  type HerculesNumberSource,
  type DemoRunReport,
  type OnboardingModeState,
} from "./core/index.ts";
import {
  STORAGE_EXPLAINER,
  clearHousehold,
  deactivateHouseholdSelection,
  downloadJson,
  listHouseholdReplicas,
  loadHousehold,
  loadPersonalReplica,
  peekHousehold,
  saveHousehold,
  selectHouseholdReplica,
  type HouseholdReplicaSummary,
} from "./storage.ts";
import { wipeLocalDevelopmentCopies } from "./resetDevelopmentLocal.ts";
import { clearSession, loadSession, saveSession, type Session } from "./session.ts";
import { joinSharedHousehold, pullSharedHousehold, reconcileHouseholdSnapshots } from "./api.ts";
import { acceptHouseholdWrite, classifyCommandError, newConfirmationId, isLedgerWrite } from "./core/index.ts";
import type { WriteAdapters } from "./core/commandRuntime.ts";
import { clearStagedHouseholdBooks, ingestHouseholdBooks, inspectBrowserBooks, prewarmStagedHouseholdBooks, repairAcceptedHouseholdBooks, replaceAcceptedHouseholdBooks, restoreHouseholdBooks, validateHouseholdBooksStaged, type BooksStatus } from "./ledger/engine.ts";
import { readSupabaseConfig, pullConsistentMemberReplicaById, pullHouseholdSnapshotById, fetchContinuityMembershipRole, listActiveContinuityMemberships, fetchContinuityCommandEvents } from "./ledger/supabase.ts";
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
  createContinuityRealtimeRecoveryGate,
  createContinuityRealtimeRecoveryScheduler,
  recoverRealtimeSnapshot,
  shouldRecoverPollCommandsFirst,
} from "./continuityRealtimeRecovery.ts";
import {
  createContinuityRealtimeReconnectGate,
  shouldDeferResumeForRealtimeReconnect,
} from "./continuityRealtimeReconnect.ts";
import {
  canAttachContinuityRealtime,
  continuityRealtimeSelfHealEnabled,
  shouldUsePollFallback,
  softPresenceRealtimeEnabled,
  type ContinuityRealtimeStatus,
} from "./continuityRealtimePolicy.ts";
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
  SUPABASE_SESSION_CHANGED_EVENT,
  supabaseSessionKey,
  supabaseAuthEnabled,
  supabaseSessionMatchesGoogleIdentity,
} from "./auth/supabaseSession.ts";
import { createAccountFlowGate } from "./auth/accountFlow.ts";
import {
  cancelContinuityConflictGeneration,
  clearContinuityOutboxConflictBlocks,
  clearContinuityOutboxForHousehold,
  clearContinuityOutboxForHouseholdDurably,
  continuityMemberId,
  discoverContinuityMemberships,
  flushContinuityOutbox,
  hydrateContinuityOutbox,
  hostedContinuityAllowed,
  humanizeContinuityError,
  listContinuityOutbox,
  productionContinuityEnabled,
  transportHouseholdWithOutbox,
  acknowledgeContinuityOutboxFromRemote,
  type ContinuityIdentity,
} from "./continuity.ts";
import { afterNextPaint } from "./nextPaint.ts";
import { requireDemoSuiteContinuityIdentity } from "./demoSuiteIdentity.ts";
import {
  canRepairProjectionFromAcknowledgedCache,
  canRepairProjectionWithBoundOutbox,
  CLOUD_LEDGER_OFFLINE_MESSAGE,
  CLOUD_LEDGER_REFRESH_MESSAGE,
  onlineRequiredReplicaKey,
  cloudLedgerOnlineRequiredEnabled,
  cloudLedgerWriteGate,
  pairedCloudRevisionGate,
  replicaAdoptionScopeMatches,
  revisionDedupeMaySkipPairedAdoption,
} from "./onlineRequiredSync.ts";
import {
  copySyncPilotDiagnostic,
  recordSyncPilotTrace,
  startSyncPilotLatencyRun,
  syncPilotDiagnosticsEnabled,
  type SyncPilotTracePhase,
  type SyncPilotTransport,
} from "./syncPilotDiagnostics.ts";
import { copySyncClockCalibration } from "./syncClock.ts";

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
    ingest: async (household, artifact) => {
      try {
        const { status } = await ingestHouseholdBooks(household, {
          compiled: artifact?.compiled,
          previous: artifact?.previous,
          auditHash: artifact?.auditHash,
        });
        return { ok: status.ok, error: status.error };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    validateCandidate: async (household, artifact) => {
      try {
        const status = await validateHouseholdBooksStaged(household, {
          compiled: artifact?.compiled,
          previous: artifact?.previous,
          auditHash: artifact?.auditHash,
          incremental: true,
        });
        return { ok: status.ok, error: status.error };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    clearCandidate: async (household) => {
      await clearStagedHouseholdBooks(household.environment, household.householdId);
    },
    repairIngest: async (household, artifact) => {
      try {
        const status = await replaceAcceptedHouseholdBooks(household, {
          compiled: artifact?.compiled,
          auditHash: artifact?.auditHash,
        });
        return { ok: status.ok, error: status.error };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : String(error) };
      }
    },
    verifyBooks: async (household, artifact) => {
      try {
        const inspection = await inspectBrowserBooks(household, {
          compiled: artifact?.compiled,
          expectedAuditHash: artifact?.auditHash,
        });
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
import {
  bindGoogleMemberships,
  inviteReasonMessage,
  isFullHouseInviteReason,
  leaveHousehold,
  leaveOrDeleteHousehold,
  redeemHouseholdInvite,
  registerCurrentHouseholdDevice,
  resetDevelopmentHouseholds,
} from "./ledger/householdInvites.ts";
import { ConfirmSheet } from "./Confirm.tsx";
import type { RepeatingDraft } from "./RepeatingForm.tsx";
import type { WorkShiftDraft } from "./WorkShiftFlow.tsx";
import { resolveDuplicateRetry } from "./shiftDuplicateRetry.ts";
import {
  HouseholdEntryCard,
  discoveredHouseholdForTarget,
  discoveredHouseholdCardModels,
  replicaHouseholdCardModels,
  type HouseholdEntryTarget,
  type InviteFlowState,
} from "./HouseholdEntryCard.tsx";
import { createShiftScanScope } from "./shiftScanScope.ts";
import { sealShiftBibleEvidence } from "./imports/evidenceClient.ts";
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
import { buildSyncFreshness, sharedHouseholdFreshnessCopy, suppressesCommandSyncChrome } from "./syncFreshness.ts";
import {
  beginContinuityAuthReconnect,
  continuityAuthReconnectRequired,
} from "./continuityAuthReconnect.ts";
import {
  recentChangesEmptyCopy,
  recentChangesHeaderPill,
  recentChangesOlderLabel,
  restorePointsEmptyCopy,
  restorePointsHeaderPill,
} from "./recentChangesCopy.ts";
import { useDialog } from "./useDialog.ts";
import { LedgerPurposeBanner } from "./LedgerPurposeBanner.tsx";
import { HerculesPresence } from "./Hercules.tsx";
import { HerculesProApproval, HerculesProPermissionsCard, herculesProAuthorizationRequest } from "./HerculesPro.tsx";
import { AddSlideshow, type AddFormFields, type AddMode } from "./AddSlideshow.tsx";
import { AddCategoryForm } from "./AddCategoryForm.tsx";
import { defaultSubcategoryForMode } from "./addSlideshow.ts";
import { FabSpeedDial } from "./FabSpeedDial.tsx";
import { SitDownGuide } from "./SitDownGuide.tsx";
import { KittyBanks } from "./KittyBanks.tsx";
import { MonthRehearsalPanel } from "./MonthRehearsalPanel.tsx";
import { Swipe } from "./Swipe.tsx";
import { Till, TILL_COPY, TILL_DESK_HASH, TILL_HOME_HASH } from "./Till.tsx";
import "./swipe.css";
import { CharterFounding } from "./CharterFounding.tsx";
import { Charter } from "./Charter.tsx";
import { OnboardingChat } from "./OnboardingChat.tsx";
import { OnboardingCategories } from "./OnboardingCategories.tsx";
import { OnboardingEstimates } from "./OnboardingEstimates.tsx";
import { playClink } from "./clink.ts";
import { GoogleBridgeCard } from "./GoogleBridge.tsx";
import {
  adoptGoogleSession,
  clearGoogleSessions,
  confirmWithGoogleIfLinked,
  connectGoogle,
  continuityIdentityFromGoogle,
  disconnectGoogle,
  googleConfigured,
  loadGoogleSession,
} from "./google/index.ts";
import type { DiscoveredHousehold } from "./ledger/supabase.ts";
import type { PostWorkShiftInput, ShiftAttendanceReviewDraft } from "./core/index.ts";
import {
  DeferredBooksPage,
  DeferredCalendarPage,
  DeferredOffice,
  DeferredPairingCard,
  DeferredShiftReportScanBar,
  DeferredSurface,
  DeferredWelcomeJoin,
  DeferredWelcomeQrScanner,
  DeferredWorkShiftPage,
  DeferredWorkShiftWithSevenShifts,
  loadBooksSurface,
  loadCalendarSurface,
  loadOfficeSurface,
  loadWorkShiftSurface,
} from "./deferredSurfaces.tsx";
import {
  acceptedSnapshotRebuildCheck,
  booksWriteGate,
  knownMetadataUpdateAllowed,
  readinessMatches,
  readinessForHousehold,
  type BooksReadiness,
  type BooksWriteGate,
} from "./startup/booksReadiness.ts";

type Tab = "home" | "plan" | "calendar" | "shift" | "ledger" | "more" | "till";

function presenceTab(tab: Tab): Exclude<Tab, "till"> {
  return tab === "till" ? "home" : tab;
}
type WelcomeGoogleIntent = "create" | "login";
type WelcomeIdentity = ContinuityIdentity & { displayName: string; grantedScopes: string[] };
type CommitHouseholdOptions = {
  forceFlush?: boolean;
  confirmationId?: string;
  onRejected?: (message: string) => void;
  suppressUndo?: boolean;
};
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
  | { kind: "demo-suite"; seed: number }
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
  const [initialStartup] = useState(() => {
    const environment: Environment = "development";
    const session = loadSession(environment);
    return {
      environment,
      session,
      household: peekHousehold(environment, session?.householdId),
    };
  });
  const [environment, setEnvironment] = useState<Environment>(initialStartup.environment);
  const environmentRef = useRef<Environment>(environment);
  environmentRef.current = environment;
  const replicaScopeGenerationRef = useRef(0);
  const changeEnvironment = (next: Environment) => {
    if (environmentRef.current === next) return;
    replicaScopeGenerationRef.current += 1;
    environmentRef.current = next;
    setEnvironment(next);
  };
  const [supabaseSessionPresent, setSupabaseSessionPresent] = useState(() => (
    Boolean(loadSupabaseSession(initialStartup.environment))
  ));
  const [herculesProRequest] = useState(() => herculesProAuthorizationRequest());
  const [household, setHousehold] = useState<Household | null>(initialStartup.household);
  const [booting, setBooting] = useState(!initialStartup.household);
  const [pendingDemo, setPendingDemo] = useState<Household | null>(null);
  const [pendingDemoMemberId, setPendingDemoMemberId] = useState<string | null>(null);
  const pendingDemoAcceptanceRef = useRef<Promise<CommandOutcome | null> | null>(null);
  const pendingDemoFramesRef = useRef<number[]>([]);
  const [tab, setTab] = useState<Tab>("home");
  const [charterFoundingOpen, setCharterFoundingOpen] = useState(false);
  const [onboardingInviteDismissedState, setOnboardingInviteDismissedState] = useState<OnboardingModeState | null>(null);
  const [charterPageOpen, setCharterPageOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [swipeOpen, setSwipeOpen] = useState(false);
  const [swipeError, setSwipeError] = useState("");
  const [swipeStrip, setSwipeStrip] = useState<SwipeUndoStrip | null>(null);
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
  useEffect(() => {
    if (!swipeStrip) return;
    const timer = window.setTimeout(() => setSwipeStrip(null), SWIPE_UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [swipeStrip]);
  useEffect(() => {
    if (tab !== "till") {
      setSwipeOpen(false);
      setSwipeStrip(null);
    }
  }, [tab]);
  useEffect(() => {
    const applyHash = () => {
      const hash = window.location.hash.replace(/^#/, "");
      if (hash === "till") setTab("till");
      else if (hash === "home") setTab((current) => (current === "till" ? "home" : current));
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);
  const [mode, setMode] = useState<AddMode>("expense");
  const [form, setForm] = useState(emptyForm);
  const [focusedAccountId, setFocusedAccountId] = useState<string | null>(null);
  const [booksPaneRequest, setBooksPaneRequest] = useState<"fund" | "fund-register" | "wallet" | "opening" | "register" | null>(null);
  const [herculesSourceFocus, setHerculesSourceFocus] = useState<HerculesNumberSource | null>(null);
  const [busyState, setBusy] = useState(false);
  const clearThisPhoneInFlightRef = useRef(false);
  const accountFlowGateRef = useRef(createAccountFlowGate());
  const [error, setError] = useState("");
  const [confirm, setConfirm] = useState<NeedsConfirmationError | null>(null);
  const [toast, setToast] = useState<UndoToken | null>(null);
  const [history, setHistory] = useState<UndoToken[]>([]);
  const [isHouseholdOwner, setIsHouseholdOwner] = useState(false);
  const [guard, setGuard] = useState<Guard | null>(null);
  const [demoSeed, setDemoSeed] = useState("");
  const [demoReport, setDemoReport] = useState<DemoRunReport | null>(null);
  const [saveRepeatingPostFirst, setSaveRepeatingPostFirst] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [splitPercents, setSplitPercents] = useState<Record<string, number>>({ "MEM-001": 50, "MEM-002": 50 });
  const [now, setNow] = useState(() => new Date());
  const [session, setSession] = useState<Session | null>(initialStartup.session);
  const sessionRef = useRef<Session | null>(session);
  sessionRef.current = session;
  useEffect(() => {
    setSwipeOpen(false);
    setSwipeError("");
    setSwipeStrip(null);
  }, [environment, household?.householdId, session?.memberId, session?.view]);
  const [replicas, setReplicas] = useState<HouseholdReplicaSummary[]>([]);
  const [personalReplica, setPersonalReplica] = useState<PersonalEnvelope | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "error">("idle");
  const [, setCloudReplicaReadyKeyState] = useState<string | null>(null);
  const cloudReplicaReadyKeyRef = useRef<string | null>(null);
  const setCloudReplicaReadyKey = (key: string | null) => {
    cloudReplicaReadyKeyRef.current = key;
    setCloudReplicaReadyKeyState(key);
  };
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
  const [fullHouseInvite, setFullHouseInvite] = useState<{ email: string } | null>(null);
  const [inviteFlowState, setInviteFlowState] = useState<InviteFlowState>("idle");
  const [highlightedHouseholdId, setHighlightedHouseholdId] = useState<string | null>(null);
  const [welcomeMode, setWelcomeMode] = useState<"home" | "join" | "qr" | "new">("home");
  const [welcomeIdentity, setWelcomeIdentity] = useState<WelcomeIdentity | null>(null);
  const [newHouseholdDraft, setNewHouseholdDraft] = useState({
    householdName: "Our Household",
    sharedLedgerName: "Household Ledger",
    personalLedgerName: "My Personal Ledger",
    personalMemberId: "MEM-001",
  });
  const [booksStatus, setBooksStatus] = useState<BooksStatus | null>(null);
  const [validationAttempt, setValidationAttempt] = useState(0);
  const [resetBusy, setResetBusy] = useState(false);
  const startupGenerationRef = useRef(0);
  const [booksReadiness, setBooksReadiness] = useState<BooksReadiness>(() => (
    initialStartup.household
      ? readinessForHousehold("validating", 0, initialStartup.household)
      : { phase: "loading-cache", generation: 0 }
  ));
  const activeBooksGate: BooksWriteGate = booksWriteGate(booksReadiness, household);
  const busy = busyState || Boolean(household && !activeBooksGate.ready);
  const booksReadinessRef = useRef(booksReadiness);
  booksReadinessRef.current = booksReadiness;
  const booksGateRef = useRef(activeBooksGate);
  booksGateRef.current = activeBooksGate;
  const [spark, setSpark] = useState(false);
  const [visorPop, setVisorPop] = useState(false);
  const [clinkOn, setClinkOn] = useState(false);
  const [addDetails, setAddDetails] = useState(false);
  const [shiftGate, setShiftGate] = useState<ShiftGate>("choose");
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
  const openingHouseholdRef = useRef<string | null>(null);

  function adoptAcceptedHousehold(next: Household, statusOverride?: BooksStatus): void {
    householdRef.current = next;
    setHousehold(next);
    const status = statusOverride ?? booksReadinessRef.current.status;
    const ready = readinessForHousehold(
      "ready",
      startupGenerationRef.current,
      next,
      status ? { status: { ...status, entryCount: next.transactions.length } } : {},
    );
    booksReadinessRef.current = ready;
    booksGateRef.current = booksWriteGate(ready, next);
    setBooksReadiness(ready);
  }

  /**
   * Carry a proven financial receipt across transport/presence/permission
   * metadata only. These callers must not change transactions, shifts, Fund
   * financial facts, or any other material included by financialAuditHash.
   */
  function adoptKnownMetadataHousehold(
    next: Household,
    expectedCurrentRevision = next.revision,
  ): boolean {
    const current = booksReadinessRef.current;
    const live = householdRef.current;
    if (
      current.phase !== "ready"
      || current.environment !== next.environment
      || current.householdId !== next.householdId
      || !live
      || !knownMetadataUpdateAllowed(live, next, expectedCurrentRevision)
    ) {
      return false;
    }
    adoptAcceptedHousehold(next, current.status);
    return true;
  }

  function householdOutboxFingerprint(targetEnvironment: Environment, householdId: string): string {
    return JSON.stringify(
      listContinuityOutbox(targetEnvironment)
        .filter((item) => item.householdId === householdId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
    );
  }

  async function installCanonicalCloudReplica(input: {
    shared: Household;
    personal: PersonalEnvelope;
    memberId: string;
    identity: ContinuityIdentity;
  }, expectedOutboxFingerprint?: string): Promise<Household> {
    const expectedScope = {
      generation: replicaScopeGenerationRef.current,
      environment: input.shared.environment,
      householdId: input.shared.householdId,
      memberId: input.memberId,
    };
    const scopeIsCurrent = () => (
      replicaAdoptionScopeMatches(expectedScope, {
        generation: replicaScopeGenerationRef.current,
        environment: environmentRef.current,
        householdId: householdRef.current?.householdId ?? null,
        memberId: sessionRef.current?.memberId ?? null,
      })
      && (
        expectedOutboxFingerprint === undefined
        || householdOutboxFingerprint(input.shared.environment, input.shared.householdId) === expectedOutboxFingerprint
      )
    );
    const restoreCurrentProjection = async () => {
      const current = householdRef.current;
      const currentMemberId = sessionRef.current?.memberId;
      if (!current || current.environment !== environmentRef.current) return;
      await restoreHouseholdBooks(current);
      await saveHousehold(current, {
        operatingEnvironment: current.environment,
        memberId: currentMemberId,
        activate: true,
      });
    };
    if (!scopeIsCurrent()) throw new Error("The active ledger changed before cloud adoption began.");
    const remoteShared = splitForSync(input.shared, input.memberId).shared;
    const canonical = markSynchronized(assembleHousehold(remoteShared, input.personal, { linked: true }));
    canonical.booksAcceptedHash = await financialAuditHash(canonical);
    const staged = await validateHouseholdBooksStaged(canonical, {
      auditHash: canonical.booksAcceptedHash,
      incremental: false,
    });
    if (!staged.ok) throw new Error(staged.error || "The latest cloud books did not pass local validation.");
    if (!scopeIsCurrent()) throw new Error("The active ledger changed during cloud validation.");
    const status = await replaceAcceptedHouseholdBooks(canonical, {
      auditHash: canonical.booksAcceptedHash,
    });
    if (!scopeIsCurrent()) {
      await restoreCurrentProjection();
      throw new Error("The active ledger changed during cloud repair.");
    }
    await saveHousehold(canonical, {
      operatingEnvironment: canonical.environment,
      memberId: input.memberId,
      continuityIdentity: input.identity,
    });
    if (!scopeIsCurrent()) {
      await restoreCurrentProjection();
      throw new Error("The active ledger changed while saving cloud books.");
    }
    adoptAcceptedHousehold(canonical, status);
    setBooksStatus(status);
    return canonical;
  }

  async function adoptCanonicalCloudReplica(input: {
    shared: Household;
    personal: PersonalEnvelope;
    memberId: string;
    identity: ContinuityIdentity;
  }): Promise<Household> {
    const expectedHousehold = householdRef.current;
    const expectedScopeGeneration = replicaScopeGenerationRef.current;
    const expectedOutboxFingerprint = householdOutboxFingerprint(input.shared.environment, input.shared.householdId);
    return enqueueWrite(() => {
      if (
        replicaScopeGenerationRef.current !== expectedScopeGeneration
        || householdRef.current !== expectedHousehold
      ) {
        throw new Error("The active books changed before the cloud copy could be installed.");
      }
      return installCanonicalCloudReplica(input, expectedOutboxFingerprint);
    });
  }

  async function persistKnownMetadataHousehold(
    update: (current: Household) => Household | null,
  ): Promise<Household | null> {
    return enqueueWrite(async () => {
      const current = householdRef.current;
      if (!current || !booksGateRef.current.ready) return null;
      const next = update(current);
      if (!next) return null;
      if (!knownMetadataUpdateAllowed(current, next, current.revision)) return null;
      await saveHousehold(next, {
        operatingEnvironment: next.environment,
        memberId: session?.memberId,
      });
      return adoptKnownMetadataHousehold(next, current.revision) ? next : null;
    });
  }

  function assertMemberPersonalUpdate(current: Household, result: CommitResult): void {
    const who = session?.memberId;
    if (
      result.persistenceScope !== "member-personal"
      || !who
      || result.personalMemberId !== who
    ) {
      throw new ValidationError("Only you can change your own Personal settings.");
    }
    if (result.household === current) return;
    const commandKind = result.undo.commandKind;
    if (commandKind === "fund-rail-personal") {
      if (fundRailPreferenceUpdateAllowed(current, result.household, who)) return;
      throw new ValidationError("Only you can arrange your own board.");
    }
    if (commandKind === "onboarding-progress-personal") {
      const currentMember = current.members.find((member) => member.id === who && member.active);
      const nextMember = result.household.members.find((member) => member.id === who && member.active);
      if (
        current.environment === result.household.environment
        && current.householdId === result.household.householdId
        && current.revision === result.household.revision
        && currentMember
        && nextMember
      ) {
        const normalized = structuredClone(result.household);
        normalized.members = normalized.members.map((member) => member.id === who
          ? { ...member, onboardingProgress: currentMember.onboardingProgress }
          : member);
        if (JSON.stringify(normalized) === JSON.stringify(current)) return;
      }
      throw new ValidationError("Only you can record your own progress.");
    }
    if (
      commandKind === "landing-surface-personal"
      || commandKind === "glance-account-personal"
      || commandKind === "hercules-permissions-personal"
    ) {
      if (memberPersonalPreferenceUpdateAllowed(current, result.household, who, commandKind)) return;
      throw new ValidationError("Only you can change your own Personal settings.");
    }
    throw new ValidationError("That Personal change does not have a cloud-authority rule.");
  }

  useEffect(() => {
    if (!household || !session?.memberId || !activeBooksGate.ready) return;
    const scope = { environment: household.environment, householdId: household.householdId, memberId: session.memberId };
    const envelopes = new Map((household.shiftEnvelopes ?? []).map((row) => [row.id, row]));
    const bibles = [
      ...household.shifts.flatMap((row) => row.memberId === session.memberId && row.shiftBible ? [row.shiftBible] : []),
      ...(household.shiftBibles ?? []).filter((row) => row.memberId === session.memberId),
    ];
    for (const bible of bibles) {
      const envelope = envelopes.get(bible.envelopeId);
      if (!envelope || !/^s7shift_[a-f0-9]{64}$/.test(envelope.canonicalShiftKey)) continue;
      const storageKey = `hearth:evidence-sealed:${scope.environment}:${scope.householdId}:${scope.memberId}:${bible.id}:${bible.revision}`;
      if (sessionStorage.getItem(storageKey) === "1") continue;
      void sealShiftBibleEvidence(scope, { bibleId: bible.id, canonicalShiftKey: envelope.canonicalShiftKey, confirmedAt: bible.confirmedAt })
        .then(() => {
          sessionStorage.setItem(storageKey, "1");
        })
        .catch(() => undefined);
    }
  }, [household?.environment, household?.householdId, household?.shifts, household?.shiftBibles, household?.shiftEnvelopes, session?.memberId, activeBooksGate.ready]);

  useEffect(() => {
    if (!household || !session?.memberId || !activeBooksGate.ready) return;
    const pending = household.shifts.flatMap((shift) => shift.memberId === session.memberId && shift.shiftBible?.outcome === "worked"
      && shift.shiftBible.weather?.state === "pending" && shift.shiftBible.actualStart && shift.shiftBible.actualEnd ? [{ shift, bible: shift.shiftBible }] : []);
    for (const { shift, bible } of pending) {
      const job = household.workJobs.find((row) => row.id === shift.jobId && row.memberId === session.memberId);
      if (job?.locationLatitude == null || job.locationLongitude == null) continue;
      const key = `hearth:weather-backfill:${household.environment}:${household.householdId}:${bible.id}:${bible.revision}`;
      if (sessionStorage.getItem(key) === "running") continue;
      sessionStorage.setItem(key, "running");
      void readHistoricalShiftWeather({ latitude: job.locationLatitude, longitude: job.locationLongitude, startedAt: bible.actualStart!, endedAt: bible.actualEnd! })
        .then((weather) => {
          if (weather.state !== "complete") { sessionStorage.removeItem(key); return; }
          return run((current) => appendShiftBibleWeather(current, { memberId: session.memberId, bibleId: bible.id, weather, createdBy: session.memberId }));
        })
        .catch(() => sessionStorage.removeItem(key));
    }
  }, [household?.environment, household?.householdId, household?.shifts, household?.workJobs, session?.memberId, activeBooksGate.ready]);
  const historyRef = useRef(history);
  historyRef.current = history;
  const confirmationRef = useRef<string | null>(null);
  const postingRef = useRef(false);
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
      const [{ scanShiftReportFile }, { loadDocumentVisionProvider }] = await Promise.all([
        import("./imports/shiftReportDraft.ts"),
        import("./imports/documentScanProvider.ts"),
      ]);
      if (!scan.isCurrent()) return;
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
    if (cloudLedgerOnlineRequiredEnabled(environment)) setCloudReplicaReadyKey(null);
    try {
      const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
      const google = loadGoogleSession(environment, who, current.householdId);
      if (supabaseAuthEnabled() && !authSession) {
        setError("Your secure session needs Google sign-in before Hearth can retry sharing.");
        setTab("more");
        return;
      }
        const identity: ContinuityIdentity | null = authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : continuityIdentityFromGoogle(google);
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
        requireAuthenticatedSession: supabaseAuthEnabled(),
        authenticatedIdentity: authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : null,
        force: true,
        liveHousehold: current,
        expectedRevision: current.baseRevision ?? 0,
        confirmationId: `retry-share-${current.householdId}-${current.revision}`,
      });
      const retryConflict = flushed.conflicts[0];
      if (retryConflict) {
        if (cloudLedgerOnlineRequiredEnabled(environment)) {
          setCloudReplicaReadyKey(null);
          const remoteReplica = await pullConsistentMemberReplicaById({
            householdId: current.householdId,
            memberId: who,
            environment,
            config: cloudConfig,
            identity,
            initialShared: retryConflict.remote,
          });
          if (!remoteReplica) {
            setSyncState("error");
            setError("Another device saved first. Hearth is waiting for a complete Shared and Personal cloud copy before cancelling this retry.");
            return;
          }
          const canonical = await adoptCanonicalCloudReplica({
            shared: remoteReplica.shared,
            personal: remoteReplica.personal,
            memberId: who,
            identity,
          });
          const cancelled = await cancelContinuityConflictGeneration(retryConflict.item);
          if (!cancelled) {
            setSyncState("error");
            setError("The latest cloud books are safe, but this phone could not cancel the exact conflicted retry. Cloud-backed changes remain blocked.");
            return;
          }
          setCloudReplicaReadyKey(onlineRequiredReplicaKey({
            environment,
            householdId: canonical.householdId,
            memberId: who,
            revision: canonical.revision,
          }));
          setSyncState("synced");
          setCommandChrome(null);
          setError("Another device saved first. Hearth opened the latest complete books; review them and Confirm your change again.");
          return;
        }
        const resolved = await autoResolveSharedConflict(current, retryConflict.remote, who, "local");
        const accepted = await acceptHouseholdWrite({
          previous: current,
          candidate: resolved,
          confirmationId: `retry-reconcile-${current.householdId}-${retryConflict.remote.revision}`,
          commandKind: "outbox-resolve",
          postedIds: [],
          adapters: makeBooksAdapters({ environment, memberId: who, continuityIdentity: identity }),
        });
        if (!accepted.ok) {
          setSyncState("error");
          setError(accepted.userMessage || retryConflict.message);
          return;
        }
        adoptAcceptedHousehold(accepted.household);
        clearContinuityOutboxConflictBlocks({
          environment,
          identity,
          householdId: accepted.household.householdId,
          expectedRevision: retryConflict.remote.revision,
        });
        const retried = await transportHouseholdWithOutbox({
          household: accepted.household,
          identity,
          expectedRevision: retryConflict.remote.revision,
          confirmationId: `retry-share-${accepted.household.householdId}-${accepted.household.revision}`,
          config: cloudConfig,
          flush: true,
        });
        if (retried.ok) {
          const synced = markSynchronized(accepted.household);
          await saveHousehold(synced, { operatingEnvironment: environment, memberId: who });
          adoptKnownMetadataHousehold(synced);
          setSyncState("synced");
          setCommandChrome(null);
          setError("");
        } else {
          setSyncState("syncing");
          setError("");
        }
        return;
      }
      if (flushed.synchronized > 0) {
        if (cloudLedgerOnlineRequiredEnabled(environment)) {
          const remoteReplica = await pullConsistentMemberReplicaById({
            householdId: current.householdId,
            memberId: who,
            environment,
            config: cloudConfig,
            identity,
          });
          if (!remoteReplica) {
            setSyncState("error");
            setError("Hearth delivered the retry but is still waiting for its complete Shared and Personal cloud copy. Cloud-backed changes remain blocked.");
            return;
          }
          const canonical = await adoptCanonicalCloudReplica({
            shared: remoteReplica.shared,
            personal: remoteReplica.personal,
            memberId: who,
            identity,
          });
          setCloudReplicaReadyKey(onlineRequiredReplicaKey({
            environment,
            householdId: canonical.householdId,
            memberId: who,
            revision: canonical.revision,
          }));
          setSyncState("synced");
          setCommandChrome(null);
          setError("");
          return;
        }
        const synced = markSynchronized(current);
        await saveHousehold(synced, { operatingEnvironment: environment, memberId: who });
        adoptKnownMetadataHousehold(synced);
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
      adoptKnownMetadataHousehold(pending);
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

  async function restoreBooksFromCloudCopy() {
    const current = householdRef.current;
    const memberId = sessionRef.current?.memberId;
    if (!current || !memberId) return;
    if (!cloudLedgerOnlineRequiredEnabled(environment)) {
      setValidationAttempt((attempt) => attempt + 1);
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setError("Connect to the internet before restoring these books from the cloud.");
      return;
    }
    if (listContinuityOutbox(environment).some((item) => item.householdId === current.householdId)) {
      setError("Hearth must settle the existing Confirm before it can replace this local projection.");
      return;
    }
    if (unresolvedConflicts(current).length > 0) {
      setError("Review the preserved books conflict before restoring this local projection.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const authSession = await ensureSupabaseSession(environment);
      if (!authSession) throw new Error("Continue with Google before restoring the cloud-backed books.");
      const identity: ContinuityIdentity = {
        email: authSession.email,
        subject: authSession.googleSubject,
      };
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const remoteReplica = await pullConsistentMemberReplicaById({
        householdId: current.householdId,
        memberId,
        environment,
        config: cloudConfig,
        identity,
      });
      if (!remoteReplica) {
        throw new Error("The signed-in member's complete Shared and Personal cloud copy could not be found. Nothing local was replaced.");
      }

      const remoteShared = splitForSync(remoteReplica.shared, memberId).shared;
      const restored = markSynchronized(assembleHousehold(remoteShared, remoteReplica.personal, { linked: true }));
      restored.booksAcceptedHash = await financialAuditHash(restored);
      const staged = await validateHouseholdBooksStaged(restored, {
        auditHash: restored.booksAcceptedHash,
        incremental: false,
      });
      if (!staged.ok) throw new Error(staged.error || "The shared books did not pass local validation.");
      const status = await repairAcceptedHouseholdBooks(restored, {
        auditHash: restored.booksAcceptedHash,
      });
      await saveHousehold(restored, {
        operatingEnvironment: environment,
        memberId,
        continuityIdentity: identity,
      });
      householdRef.current = restored;
      setHousehold(restored);
      setBooksStatus(status);
      const ready = readinessForHousehold("ready", startupGenerationRef.current, restored, { status });
      booksReadinessRef.current = ready;
      booksGateRef.current = booksWriteGate(ready, restored);
      setBooksReadiness(ready);
      setSyncState("synced");
      setCommandChrome(null);
      setError("");
    } catch (caught) {
      setSyncState("error");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  function reconnectContinuityAuth() {
    setError("");
    try {
      beginContinuityAuthReconnect(environment, window.location.href);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
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
    const refreshPresence = () => setSupabaseSessionPresent(Boolean(loadSupabaseSession(environment)));
    const onSessionChanged = (event: Event) => {
      const changedEnvironment = (event as CustomEvent<{ environment?: Environment }>).detail?.environment;
      if (!changedEnvironment || changedEnvironment === environment) refreshPresence();
    };
    const onStorage = (event: StorageEvent) => {
      const clearedLocalStorage = event.key === null && event.storageArea === window.localStorage;
      if (event.key === supabaseSessionKey(environment) || clearedLocalStorage) refreshPresence();
    };
    refreshPresence();
    window.addEventListener(SUPABASE_SESSION_CHANGED_EVENT, onSessionChanged);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SUPABASE_SESSION_CHANGED_EVENT, onSessionChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [environment]);

  useEffect(() => {
    const refreshClock = () => setNow(new Date());
    const interval = window.setInterval(refreshClock, 30_000);
    document.addEventListener("visibilitychange", refreshClock);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshClock);
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
    if (!supabaseAuthEnabled() || !hostedContinuityAllowed(environment) || !household || !session) return;
    let cancelled = false;
    void (async () => {
      const authSession = await ensureSupabaseSession(environment);
      if (!authSession || cancelled) return;
      const identity = { email: authSession.email, subject: authSession.googleSubject };
      if (continuityMemberId(household, identity) !== session.memberId) {
        setSyncState("error");
        setError("Google sign-in does not match the selected household member.");
        return;
      }
      const config = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const registered = await registerCurrentHouseholdDevice({
        environment,
        deviceId: localDeviceId(),
        deviceLabel: describeDeviceLabel(),
        config,
      });
      if (cancelled || registered.ok) return;
      setSyncState("error");
      setError(inviteReasonMessage(registered.reason));
      if (registered.reason === "device-revoked" || registered.reason === "session-not-live") {
        clearContinuityOutboxForHousehold(environment, household.householdId);
        void clearStagedHouseholdBooks(environment, household.householdId);
        clearSupabaseSession(environment);
      }
    })().catch((caught) => {
      if (!cancelled) {
        setSyncState("error");
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
    return () => { cancelled = true; };
  }, [environment, household?.householdId, session?.memberId]);

  useEffect(() => {
    const stored = loadPendingAuthInvite();
    if (stored) {
      setPendingAuthInvite(stored.token);
      setInviteInput(stored.token);
      setInviteFlowState("awaiting-google");
      if (stored.environment !== environment) changeEnvironment(stored.environment);
      setWelcomeMode("join");
    }
    const authInvite = authInviteFromLocation(window.location.href);
    if (authInvite) {
      const env = authInvite.environment ?? environment;
      setInviteInput(authInvite.token);
      setPendingAuthInvite(authInvite.token);
      setInviteFlowState("awaiting-google");
      savePendingAuthInvite({ token: authInvite.token, environment: env });
      if (authInvite.environment && authInvite.environment !== environment) {
        changeEnvironment(authInvite.environment);
      }
      setWelcomeMode("join");
      const url = new URL(window.location.href);
      url.searchParams.delete("invite");
      url.searchParams.delete("env");
      if (url.pathname === "/join") url.pathname = "/";
      const next = url.pathname + (url.searchParams.toString() ? `?${url.searchParams}` : "") + url.hash;
      window.history.replaceState({}, "", next);
      if (supabaseAuthEnabled() && hostedContinuityAllowed(env)) {
        try {
          startQrInviteGoogleSignIn(authInvite.token, env);
        } catch (caught) {
          setInviteFlowState("error");
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      }
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
    let live = true;
    const generation = startupGenerationRef.current + 1;
    startupGenerationRef.current = generation;
    const loadedSession = loadSession(environment);
    sessionRef.current = loadedSession;
    setSession(loadedSession);
    setBooksStatus(null);
    setGuard(null);
    const fastStored = peekHousehold(environment, loadedSession?.householdId);
    const fastCandidate = fastStored && loadedSession?.memberId
      ? resolveStoredConflictsLastEntryWins(fastStored, loadedSession.memberId)
      : fastStored;
    setCloudReplicaReadyKey(null);
    if (fastCandidate) {
      householdRef.current = fastCandidate;
      setHousehold(fastCandidate);
      const validating = readinessForHousehold("validating", generation, fastCandidate);
      booksReadinessRef.current = validating;
      booksGateRef.current = booksWriteGate(validating, fastCandidate);
      setBooksReadiness(validating);
      setHistory(loadedSession?.memberId
        ? loadUndoHistory(environment, fastCandidate.householdId, loadedSession.memberId, fastCandidate)
        : []);
      setBooting(false);
      performance.mark?.("hearth:cached-shell-ready");
    } else {
      householdRef.current = null;
      setHousehold(null);
      const loading: BooksReadiness = { phase: "loading-cache", generation };
      booksReadinessRef.current = loading;
      booksGateRef.current = booksWriteGate(loading, null);
      setBooksReadiness(loading);
      setHistory([]);
      setBooting(true);
    }
    void hydrateContinuityOutbox(environment);
    void listHouseholdReplicas(environment).then((items) => {
      if (live && startupGenerationRef.current === generation) setReplicas(items);
    });

    const scheduledFrames: number[] = [];
    const scheduledTimers: number[] = [];
    const stillCurrent = (candidate: Household) => (
      live
      && startupGenerationRef.current === generation
      && candidate.environment === environment
      && householdRef.current?.householdId === candidate.householdId
      && householdRef.current?.revision === candidate.revision
    );
    const publishReadiness = (next: BooksReadiness, candidate: Household | null) => {
      if (!live || startupGenerationRef.current !== generation) return;
      booksReadinessRef.current = next;
      booksGateRef.current = booksWriteGate(next, candidate);
      setBooksReadiness(next);
    };
    const publishReady = (candidate: Household, status: BooksStatus) => {
      if (!stillCurrent(candidate)) return false;
      setBooksStatus(status);
      publishReadiness(readinessForHousehold("ready", generation, candidate, { status }), candidate);
      return true;
    };
    const publishBlocked = (
      candidate: Household,
      message: string,
      entryCount: number,
      issue?: import("./ledger/engine.ts").BooksRecoveryIssue,
    ) => {
      if (!stillCurrent(candidate)) return;
      const status: BooksStatus = {
        ok: false,
        engine: "pglite",
        entryCount,
        inBalance: false,
        equationHolds: false,
        error: message,
      };
      setBooksStatus(status);
      publishReadiness(readinessForHousehold("blocked", generation, candidate, { status, issue, message }), candidate);
    };

    const reconcileAfterValidation = (candidate: Household) => {
      if (!candidate.linked || !loadedSession?.memberId || !stillCurrent(candidate)) return;
      if (
        cloudLedgerOnlineRequiredEnabled(candidate.environment)
        && listContinuityOutbox(candidate.environment).some((item) => item.householdId === candidate.householdId)
      ) return;
      performance.mark?.("hearth:startup-reconcile-start");
      const pullStartupHousehold = async (): Promise<{
        remote: Household;
        personal: PersonalEnvelope | null;
        identity: ContinuityIdentity | null;
      }> => {
        if (!cloudLedgerOnlineRequiredEnabled(candidate.environment)) {
          return {
            remote: await pullSharedHousehold(candidate.inviteCode, loadedSession.memberId, candidate.environment),
            personal: null,
            identity: null,
          };
        }
        if (!supabaseAuthEnabled()) {
          throw new Error("Google sign-in is required before Hearth can refresh shared books.");
        }
        const authSession = await ensureSupabaseSession(candidate.environment);
        if (!authSession) throw new Error("Google sign-in is required before Hearth can refresh shared books.");
        const identity = { email: authSession.email, subject: authSession.googleSubject };
        if (continuityMemberId(candidate, identity) !== loadedSession.memberId) {
          throw new Error("Google sign-in does not match the selected household member.");
        }
        const replica = await pullConsistentMemberReplicaById({
          householdId: candidate.householdId,
          memberId: loadedSession.memberId,
          environment: candidate.environment,
          config: authenticatedSupabaseConfig(readSupabaseConfig(), authSession),
          identity,
        });
        if (!replica) throw new Error(CLOUD_LEDGER_REFRESH_MESSAGE);
        return { remote: replica.shared, personal: replica.personal, identity };
      };
      void pullStartupHousehold()
        .then(({ remote, personal, identity }) => enqueueWrite(async () => {
          if (!live || startupGenerationRef.current !== generation) return;
          const current = householdRef.current;
          if (
            !current
            || current.environment !== candidate.environment
            || current.householdId !== candidate.householdId
            || current.revision !== candidate.revision
          ) return;
          const accepted = personal && identity
            ? {
                ok: true as const,
                household: await installCanonicalCloudReplica({
                  shared: remote,
                  personal,
                  memberId: loadedSession.memberId,
                  identity,
                }),
              }
            : await acceptHouseholdWrite({
                previous: current,
                candidate: await reconcileHouseholdSnapshots(current, remote, loadedSession.memberId),
                confirmationId: `reconcile-${current.householdId}-${remote.revision}`,
                commandKind: "boot-reconcile",
                postedIds: [],
                adapters: makeBooksAdapters({ environment, memberId: loadedSession.memberId }),
              });
          if (!live || startupGenerationRef.current !== generation) return;
          if (!accepted.ok) {
            if ("userMessage" in accepted && accepted.userMessage) setError(accepted.userMessage);
            return;
          }
          householdRef.current = accepted.household;
          setHousehold(accepted.household);
          const status: BooksStatus = {
            ok: true,
            engine: "pglite+supabase",
            entryCount: accepted.household.transactions.length,
            inBalance: true,
            equationHolds: true,
          };
          setBooksStatus(status);
          publishReadiness(readinessForHousehold("ready", generation, accepted.household, { status }), accepted.household);
          if (personal) {
            setCloudReplicaReadyKey(onlineRequiredReplicaKey({
              environment: accepted.household.environment,
              householdId: accepted.household.householdId,
              memberId: loadedSession.memberId,
              revision: accepted.household.revision,
            }));
          }
          performance.mark?.("hearth:startup-reconcile-end");
        }))
        .catch(() => {
          if (cloudLedgerOnlineRequiredEnabled(candidate.environment)) setCloudReplicaReadyKey(null);
          if (
            live
            && startupGenerationRef.current === generation
            && householdRef.current?.householdId === candidate.householdId
          ) setSyncState("error");
        });
    };

    const validate = async (candidate: Household) => {
      if (!stillCurrent(candidate)) return;
      performance.mark?.("hearth:books-validation-start");
      try {
        let inspection = await inspectBrowserBooks(candidate);
        if (!stillCurrent(candidate)) return;
        const launchOnlineRequired = cloudLedgerOnlineRequiredEnabled(candidate.environment)
          && candidate.linked === true;
        if (
          (inspection.issue === "projection-mismatch" || inspection.issue === "incomplete-migration")
          && launchOnlineRequired
        ) {
          await hydrateContinuityOutbox(candidate.environment);
          if (!stillCurrent(candidate)) return;
          const householdOutbox = listContinuityOutbox(candidate.environment)
            .filter((item) => item.householdId === candidate.householdId);
          const hasOpenConflict = unresolvedConflicts(candidate).length > 0;
          const repairGate = householdOutbox.length > 0
            ? canRepairProjectionWithBoundOutbox({ snapshot: candidate, items: householdOutbox, hasOpenConflict })
            : inspection.issue === "incomplete-migration"
              ? canRepairProjectionFromAcknowledgedCache({
                  snapshot: candidate,
                  pendingOutboxCount: 0,
                  hasOpenConflict,
                })
              : { allowed: false, reason: "A projection mismatch requires an authenticated cloud refresh." };
          if (repairGate.allowed) {
            const trusted = await acceptedSnapshotRebuildCheck(candidate);
            if (!stillCurrent(candidate)) return;
            if (!trusted.ok) {
              publishBlocked(candidate, trusted.message, inspection.entryCount, inspection.issue);
              return;
            }
            await ingestHouseholdBooks(candidate, { auditHash: trusted.auditHash, incremental: false });
            if (!stillCurrent(candidate)) return;
            inspection = await inspectBrowserBooks(candidate, { expectedAuditHash: trusted.auditHash });
          }
        }
        const schemaRebuild = inspection.issue === "missing-schema"
          || (inspection.issue === "incomplete-migration" && !launchOnlineRequired);
        const receiptGatedRebuild = inspection.issue === "interrupted-transaction"
          || (inspection.issue === "incomplete-migration" && !launchOnlineRequired);
        let rebuildAuditHash: string | undefined;
        if (receiptGatedRebuild) {
          const trusted = await acceptedSnapshotRebuildCheck(candidate);
          if (!stillCurrent(candidate)) return;
          if (!trusted.ok) {
            publishBlocked(candidate, trusted.message, inspection.entryCount, inspection.issue);
            return;
          }
          rebuildAuditHash = trusted.auditHash;
        }
        if (schemaRebuild || rebuildAuditHash) {
          await ingestHouseholdBooks(candidate, rebuildAuditHash
            ? { auditHash: rebuildAuditHash, incremental: false }
            : undefined);
          if (!stillCurrent(candidate)) return;
          inspection = await inspectBrowserBooks(candidate, rebuildAuditHash
            ? { expectedAuditHash: rebuildAuditHash }
            : undefined);
        }
        if (!inspection.ok) {
          publishBlocked(candidate, inspection.message, inspection.entryCount, inspection.issue);
          return;
        }
        const status: BooksStatus = {
          ok: true,
          engine: "pglite",
          entryCount: inspection.entryCount,
          inBalance: true,
          equationHolds: true,
        };
        if (publishReady(candidate, status)) {
          performance.mark?.("hearth:books-validation-end");
          reconcileAfterValidation(candidate);
        }
      } catch (caught) {
        publishBlocked(candidate, caught instanceof Error ? caught.message : String(caught), 0);
      }
    };

    const scheduleValidation = (candidate: Household) => {
      const start = () => {
        const timer = window.setTimeout(() => { void validate(candidate); }, 0);
        scheduledTimers.push(timer);
      };
      if (typeof window.requestAnimationFrame !== "function") {
        start();
        return;
      }
      const first = window.requestAnimationFrame(() => {
        const second = window.requestAnimationFrame(start);
        scheduledFrames.push(second);
      });
      scheduledFrames.push(first);
    };

    void loadHousehold(environment, loadedSession?.householdId, loadedSession?.memberId).then(async (loaded) => {
      if (!live || startupGenerationRef.current !== generation) return;
      if (!loaded) {
        householdRef.current = null;
        setHousehold(null);
        setHistory([]);
        setBooting(false);
        return;
      }
      const ready = loadedSession?.memberId
        ? resolveStoredConflictsLastEntryWins(loaded, loadedSession.memberId)
        : loaded;
      if (ready !== loaded) {
        await saveHousehold(ready, { operatingEnvironment: environment, memberId: loadedSession?.memberId });
      }
      householdRef.current = ready;
      setHousehold(ready);
      setHistory(loadedSession?.memberId
        ? loadUndoHistory(environment, ready.householdId, loadedSession.memberId, ready)
        : []);
      const validating = readinessForHousehold("validating", generation, ready);
      publishReadiness(validating, ready);
      setBooting(false);
      performance.mark?.("hearth:cached-shell-committed");
      scheduleValidation(ready);
    }).catch((caught) => {
      if (!live || startupGenerationRef.current !== generation) return;
      setBooting(false);
      setError(caught instanceof Error ? caught.message : String(caught));
    });

    return () => {
      live = false;
      for (const frame of scheduledFrames) window.cancelAnimationFrame(frame);
      for (const timer of scheduledTimers) window.clearTimeout(timer);
    };
  }, [environment, validationAttempt]);

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
    if (!household || !activeBooksGate.ready) return;
    touchVisitSpark(environment, todayKey());
    setClinkOn(readClinkOn(environment));
    const memberId = session?.memberId ?? null;
    const signedIn = Boolean(
      memberId && (
        loadGoogleSession(environment, memberId, household.householdId)
        || (supabaseAuthEnabled() && loadSupabaseSession(environment))
      ),
    );
    if (!canAdvertiseSoftPresence({ signedIn, memberId, environment, optedOut: softPresenceOptOut })) {
      return;
    }
    const now = Date.now();
    if (now - softPresenceTouchAtRef.current < SOFT_PRESENCE_TOUCH_THROTTLE_MS) return;
    try {
      softPresenceTouchAtRef.current = now;
      void persistKnownMetadataHousehold((current) => touchHouseholdDevice(current, {
        deviceId: localDeviceId(),
        label: describeDeviceLabel(),
        memberId,
      }).household);
      // Realtime advertises the live device immediately. Durable device metadata
      // rides the next ordinary continuity write instead of creating its own
      // revision, PGlite acceptance, and network flush during startup.
    } catch {
      /* soft presence only */
    }
  }, [environment, household?.householdId, session?.memberId, softPresenceOptOut, activeBooksGate.ready]);

  useEffect(() => {
    if (!household || !session?.memberId || !activeBooksGate.ready) {
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
    let live = true;
    let detach: (() => void) | null = null;
    void import("./softPresenceRealtime.ts").then(({ attachSoftPresenceRealtime }) => {
      if (!live) return;
      detach = attachSoftPresenceRealtime({
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
    }).catch(() => {
      if (live) setSoftPresenceLive([]);
    });
    return () => {
      live = false;
      detach?.();
      setSoftPresenceLive([]);
    };
  }, [environment, household?.householdId, session?.memberId, softPresenceOptOut, activeBooksGate.ready]);

  useEffect(() => {
    if (!household || !activeBooksGate.ready || !cloudLedgerOnlineRequiredEnabled(environment)) return;
    if (listContinuityOutbox(environment).some((item) => item.householdId === household.householdId)) return;
    void prewarmStagedHouseholdBooks(household).catch(() => undefined);
  }, [environment, household, activeBooksGate.ready]);

  useEffect(() => {
    const memberId = session?.memberId;
    if (!memberId || !household || !activeBooksGate.ready) return;
    const googleSession = loadGoogleSession(environment, memberId, household.householdId);
    const storedAuthSession = loadSupabaseSession(environment);
    if (!storedAuthSession && !continuityIdentityFromGoogle(googleSession)) return;
    let live = true;
    const coordinator = createContinuityCoordinator();
    const resumeGate = createContinuityResumeGate();
    let consecutiveUnhealthyPolls = 0;
    let nextPollAllowedAtMs = 0;

    const acceptReplayCandidate = async (candidate: Household, confirmationId: string, commandKind: string) => {
      const previous = householdRef.current;
      const googleSession = loadGoogleSession(environment, memberId, previous?.householdId);
      const authSession = supabaseAuthEnabled() ? loadSupabaseSession(environment) : null;
      const continuityIdentity: ContinuityIdentity | null = authSession
        ? { email: authSession.email, subject: authSession.googleSubject }
        : continuityIdentityFromGoogle(googleSession);
      const reconciledCandidate = resolveStoredConflictsLastEntryWins(candidate, memberId);
      const accepted = await acceptHouseholdWrite({
        previous,
        candidate: reconciledCandidate,
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
      adoptAcceptedHousehold(accepted.household);
      if (unresolvedConflicts(accepted.household).length > 0) {
        setSyncState("syncing");
      }
      if (!accepted.ok && accepted.userMessage) setError(accepted.userMessage);
      return accepted;
    };

    const replayWork = async (source: ContinuitySyncSource) => {
      if (live) setSyncState("syncing");
      if (cloudLedgerOnlineRequiredEnabled(environment)) setCloudReplicaReadyKey(null);
      try {
        const authSession = supabaseAuthEnabled() ? await ensureSupabaseSession(environment) : null;
        const expectedIdentity: ContinuityIdentity | null = storedAuthSession
          ? { email: storedAuthSession.email, subject: storedAuthSession.googleSubject }
          : continuityIdentityFromGoogle(googleSession);
        if (
          supabaseAuthEnabled()
          && (!authSession || !expectedIdentity || !supabaseSessionMatchesGoogleIdentity(authSession, expectedIdentity))
        ) {
          traceSyncPilot("auth-blocked", { transport: "outbox" });
          if (live) setSyncState("idle");
          return;
        }
        const identity: ContinuityIdentity | null = authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : continuityIdentityFromGoogle(googleSession);
        if (!identity || (!identity.email && !identity.subject)) {
          if (live) setSyncState("idle");
          return;
        }
        const identityHousehold = householdRef.current;
        if (identityHousehold && continuityMemberId(identityHousehold, identity) !== memberId) {
          if (live) {
            setSyncState("error");
            setError("Google sign-in does not match the selected household member.");
          }
          return;
        }
        const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
        const currentForReplay = householdRef.current;
        const hasQueuedHousehold = currentForReplay
          ? listContinuityOutbox(environment).some((item) => item.householdId === currentForReplay.householdId)
          : false;
        const shouldSeedPending = Boolean(
          currentForReplay
          && currentForReplay.sharing?.mode === "pending-transport"
          && !hasQueuedHousehold,
        );
        const flushed = await flushContinuityOutbox({
          environment,
          identity,
          config: cloudConfig,
          requireAuthenticatedSession: supabaseAuthEnabled(),
          authenticatedIdentity: authSession
            ? { email: authSession.email, subject: authSession.googleSubject }
            : null,
          force: shouldSeedPending,
          liveHousehold: shouldSeedPending && currentForReplay ? currentForReplay : undefined,
          expectedRevision: shouldSeedPending ? currentForReplay?.baseRevision : undefined,
          confirmationId: shouldSeedPending && currentForReplay
            ? `auto-reconcile-${currentForReplay.householdId}-${currentForReplay.revision}`
            : undefined,
        });
        if (!live) return;
        const conflict = flushed.conflicts[0];
        if (conflict) {
          const current = householdRef.current;
          if (current && current.householdId === conflict.item.householdId) {
            if (cloudLedgerOnlineRequiredEnabled(environment)) {
              setCloudReplicaReadyKey(null);
              const remoteReplica = await pullConsistentMemberReplicaById({
                householdId: current.householdId,
                memberId,
                environment,
                config: cloudConfig,
                identity,
                initialShared: conflict.remote,
              });
              if (!remoteReplica) {
                setSyncState("error");
                setError("Another device saved first. Hearth is waiting for a complete Shared and Personal cloud copy before cancelling this retry.");
                return;
              }
              const canonical = await adoptCanonicalCloudReplica({
                shared: remoteReplica.shared,
                personal: remoteReplica.personal,
                memberId,
                identity,
              });
              if (!live) return;
              const cancelled = await cancelContinuityConflictGeneration(conflict.item);
              if (!live) return;
              if (!cancelled) {
                setSyncState("error");
                setError("The latest cloud books are safe, but this phone could not cancel the exact conflicted retry. Cloud-backed changes remain blocked.");
                return;
              }
              setCloudReplicaReadyKey(onlineRequiredReplicaKey({
                environment,
                householdId: canonical.householdId,
                memberId,
                revision: canonical.revision,
              }));
              setSyncState("synced");
              setError("Another device saved first. Hearth opened the latest complete books; review them and Confirm your change again.");
              return;
            }
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
                adoptKnownMetadataHousehold(synced);
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
            if (unresolvedConflicts(ready).length > 0) {
              setSyncState("syncing");
              setError("Saved here. Hearth is reconciling the latest entry in the background.");
              return;
            }
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
              adoptKnownMetadataHousehold(synced);
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
          if (live) setSyncState(
            cloudLedgerOnlineRequiredEnabled(environment)
              ? "syncing"
              : typeof navigator !== "undefined" && !navigator.onLine ? "syncing" : "synced",
          );
          if (cloudLedgerOnlineRequiredEnabled(environment)) return;
          // Still try a live pull below so partner posts appear.
        }

        let current = householdRef.current;
        if (
          flushed.synchronized > 0
          && current
          && !cloudLedgerOnlineRequiredEnabled(environment)
        ) {
          current = markSynchronized(current);
          await saveHousehold(current, { operatingEnvironment: environment, memberId });
          traceSyncPilot("cloud-ack", {
            household: current,
            revision: current.revision,
            pendingCount: flushed.pending,
            transport: "outbox",
          });
          if (live) {
            adoptKnownMetadataHousehold(current);
          }
        }

        current = householdRef.current;
        if (
          current
          && cloudLedgerOnlineRequiredEnabled(environment)
          && listContinuityOutbox(environment).some((item) => item.householdId === current?.householdId)
        ) {
          setSyncState("syncing");
          return;
        }
        const pairRequired = Boolean(current && cloudLedgerOnlineRequiredEnabled(environment));
        const remoteReplica = current && pairRequired
          ? await pullConsistentMemberReplicaById({
              householdId: current.householdId,
              memberId,
              environment,
              config: cloudConfig,
              identity,
            })
          : null;
        if (pairRequired && !remoteReplica) {
          throw new Error(CLOUD_LEDGER_REFRESH_MESSAGE);
        }
        let remoteHousehold = remoteReplica?.shared ?? null;
        if (!pairRequired && current) {
          remoteHousehold = await pullHouseholdSnapshotById(current.householdId, environment, cloudConfig, identity);
        }
        if (!remoteHousehold && !pairRequired) {
          const memberships = await discoverContinuityMemberships(identity, environment, cloudConfig);
          if (!live) return;
          current = householdRef.current;
          remoteHousehold = current
            ? memberships.find((item) => item.household.householdId === current?.householdId)?.household ?? null
            : null;
        }
        if (!live) return;
        current = householdRef.current;
        if (remoteHousehold) {
          await acknowledgeContinuityOutboxFromRemote(remoteHousehold);
          if (!live) return;
        }
        if (current && remoteHousehold) {
          const remoteRevision = remoteHousehold.revision ?? 0;
          const hasOpenConflict = unresolvedConflicts(current).length > 0;
          const pairedRevision = pairRequired
            ? pairedCloudRevisionGate({
                remoteRevision,
                localRevision: current.revision ?? 0,
                localBaseRevision: current.baseRevision ?? current.revision ?? 0,
              })
            : null;
          const staleSignal = pairRequired
            // A complete but lagging Shared/Personal read can briefly follow a
            // successful command acknowledgement. It may block the next write
            // while catch-up continues, but it must never replace a newer
            // cloud-acknowledged local generation. Equal revisions still need
            // content comparison so newer Personal facts are not deduped away.
            ? pairedRevision?.mayAdopt === false
            : shouldIgnoreInboundSnapshot({
                remoteRevision,
                localTipRevision: current.revision ?? 0,
                hasOpenConflict,
              });
          const currentReplica = remoteReplica ? splitForSync(current, memberId) : null;
          const remoteSharedReplica = remoteReplica ? splitForSync(remoteReplica.shared, memberId).shared : null;
          const pairedFactsDiffer = Boolean(
            currentReplica
            && remoteSharedReplica
            && remoteReplica
            && (
              JSON.stringify(currentReplica.shared) !== JSON.stringify(remoteSharedReplica)
              || JSON.stringify(currentReplica.personal) !== JSON.stringify(remoteReplica.personal)
            )
          );
          const duplicatePull = revisionDedupeMaySkipPairedAdoption(
            pairedFactsDiffer,
            !staleSignal
              && remoteRevision > (current.baseRevision ?? 0)
              && coordinator.shouldDedupePull(current.householdId, remoteRevision),
          );
          const shouldAdoptRemote = pairRequired
            ? pairedFactsDiffer || current.revision !== remoteRevision || current.baseRevision !== remoteRevision
            : remoteRevision > (current.baseRevision ?? 0);
          if (!staleSignal && !duplicatePull && shouldAdoptRemote) {
          coordinator.recordPull(current.householdId, remoteRevision);
          if (!revisionDedupeMaySkipPairedAdoption(
            pairedFactsDiffer,
            coordinator.shouldSkipAccept(current.householdId, remoteRevision),
          )) {
          if (remoteReplica) setCloudReplicaReadyKey(null);
          const accepted = remoteReplica
            ? {
                ok: true as const,
                household: await adoptCanonicalCloudReplica({
                  shared: remoteReplica.shared,
                  personal: remoteReplica.personal,
                  memberId,
                  identity,
                }),
              }
            : await acceptReplayCandidate(
                await reconcileHouseholdSnapshots(current, remoteHousehold, memberId),
                `continuity-pull-${current.householdId}-${remoteHousehold.revision}`,
                "continuity-pull",
              );
          if (!live) return;
          if (!accepted?.ok) {
            setSyncState("error");
            setError(accepted?.userMessage || "Could not accept the shared household.");
            return;
          }
          traceSyncPilot(unresolvedConflicts(accepted.household).length > 0 ? "conflict" : "snapshot-applied", {
            household: accepted.household,
            revision: remoteRevision,
            transport: source === "poll" ? "poll" : "snapshot-realtime",
          });
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
              adoptKnownMetadataHousehold(synced);
            } else if (pushed.errorClass === "conflict-detected" && pushed.remote) {
              if (cloudLedgerOnlineRequiredEnabled(environment)) {
                setCloudReplicaReadyKey(null);
                const conflictItem = listContinuityOutbox(environment)
                  .find((item) => item.householdId === ready.householdId);
                const stable = await pullConsistentMemberReplicaById({
                  householdId: ready.householdId,
                  memberId,
                  environment,
                  config: cloudConfig,
                  identity,
                  initialShared: pushed.remote,
                });
                if (!live) return;
                if (!conflictItem || !stable) {
                  setSyncState("error");
                  setError("Another device saved first. Hearth is waiting to safely replace this retry with the complete cloud books.");
                  return;
                }
                const canonical = await adoptCanonicalCloudReplica({
                  shared: stable.shared,
                  personal: stable.personal,
                  memberId,
                  identity,
                });
                if (!live) return;
                if (!await cancelContinuityConflictGeneration(conflictItem)) {
                  setSyncState("error");
                  setError("The latest cloud books are safe, but this phone could not cancel the exact conflicted retry. Cloud-backed changes remain blocked.");
                  return;
                }
                setCloudReplicaReadyKey(onlineRequiredReplicaKey({
                  environment,
                  householdId: canonical.householdId,
                  memberId,
                  revision: canonical.revision,
                }));
                setSyncState("synced");
                setError("Another device saved first. Hearth opened the latest complete books; review them and Confirm your change again.");
                return;
              }
              const resolved = await autoResolveSharedConflict(ready, pushed.remote, memberId, "local");
              const acceptedConflict = await acceptReplayCandidate(
                resolved,
                `live-absorb-resolve-${ready.householdId}-${pushed.remote.revision}`,
                "outbox-resolve",
              );
              if (acceptedConflict && unresolvedConflicts(acceptedConflict.household).length > 0) {
                setSyncState("syncing");
              } else {
                setSyncState("syncing");
              }
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
          const readyHousehold = householdRef.current;
          const readyRevisionGate = remoteReplica && readyHousehold
            ? pairedCloudRevisionGate({
                remoteRevision: remoteReplica.revision,
                localRevision: readyHousehold.revision,
                localBaseRevision: readyHousehold.baseRevision ?? readyHousehold.revision,
              })
            : null;
          const completePairReady = Boolean(
            remoteReplica
            && readyHousehold
            && open.length === 0
            && !pending
            && readyRevisionGate?.readinessRevision === remoteReplica.revision
            && !listContinuityOutbox(environment).some((item) => item.householdId === readyHousehold.householdId)
          );
          if (completePairReady && readyHousehold) {
            setCloudReplicaReadyKey(onlineRequiredReplicaKey({
              environment: readyHousehold.environment,
              householdId: readyHousehold.householdId,
              memberId,
              revision: readyHousehold.revision,
            }));
          }
          if (pairRequired && !completePairReady) {
            setCloudReplicaReadyKey(null);
            setSyncState("syncing");
            return;
          }
          setSyncState(open.length > 0 ? "error" : pending ? "syncing" : "synced");
        }
      } catch (caught) {
        if (!live) return;
        setSyncState("error");
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    };

    const tryApplyCommandEvent = async (event: ContinuityCommandEvent): Promise<"applied" | "duplicate" | "ignored" | "fallback"> => {
      const current = householdRef.current;
      if (!current) return "ignored";
      const receiverStartedAt = performance.now();
      traceSyncPilot("realtime-received", {
        household: current,
        confirmationId: event.confirmation_id,
        revision: event.result_revision,
        transport: "command-realtime",
        ledgerScope: event.ledger_scope,
      });
      const applied = await applyCommandEventLocally({ local: current, event, memberId });
      if (!applied.ok) {
        if (applied.fallback) {
          traceSyncPilot("poll-fallback", {
            household: current,
            confirmationId: event.confirmation_id,
            revision: event.result_revision,
            transport: "poll",
            fallbackReason: applied.reason,
          });
        }
        return applied.fallback ? "fallback" : "ignored";
      }
      if (applied.duplicate) {
        traceSyncPilot("duplicate", {
          household: current,
          confirmationId: event.confirmation_id,
          revision: event.result_revision,
          transport: "command-realtime",
        });
        return "duplicate";
      }
      if (cloudLedgerOnlineRequiredEnabled(environment)) setCloudReplicaReadyKey(null);
      const accepted = await acceptReplayCandidate(
        markSynchronized(
          applied.household,
          event.payload_json.acceptedAt || event.created_at,
        ),
        `continuity-cmd-${event.confirmation_id || event.idempotency_key}`,
        event.command_type,
      );
      if (!accepted?.ok) return "fallback";
      coordinator.recordAccept(accepted.household.householdId, event.result_revision);
      const paintWitness = await afterNextPaint({ evidence: true });
      const paintedAfterMs = performance.now() - receiverStartedAt;
      if (unresolvedConflicts(accepted.household).length > 0) {
        traceSyncPilot("conflict", {
          household: accepted.household,
          confirmationId: event.confirmation_id,
          revision: event.result_revision,
          transport: "command-realtime",
          ledgerScope: event.ledger_scope,
          painted: paintWitness.painted,
          paintStatus: paintWitness.status,
          sourceAcceptedAt: event.payload_json.acceptedAt,
          cloudAcceptedAt: event.created_at,
          receiverApplyMs: paintedAfterMs,
        });
        if (live) setSyncState("syncing");
        return "applied";
      }
      traceSyncPilot("remote-accepted", {
        household: accepted.household,
        confirmationId: event.confirmation_id,
        revision: event.result_revision,
        transport: "command-realtime",
        ledgerScope: event.ledger_scope,
        painted: paintWitness.painted,
        paintStatus: paintWitness.status,
        sourceAcceptedAt: event.payload_json.acceptedAt,
        cloudAcceptedAt: event.created_at,
        receiverApplyMs: paintedAfterMs,
      });
      if (live && cloudLedgerOnlineRequiredEnabled(environment)) {
        setSyncState("syncing");
        window.setTimeout(() => {
          if (live) scheduleReplay("realtime");
        }, 0);
      } else if (live) {
        setSyncState("synced");
      }
      return "applied";
    };

    const scheduleReplay = (source: ContinuitySyncSource) => {
      void coordinator.run(source, () => replayWork(source));
    };

    const realtimeRecoveryScheduler = createContinuityRealtimeRecoveryScheduler({
      run: (source, work) => coordinator.run(source, work),
      recover: async (targetRevision, source) => {
        await recoverRealtimeSnapshot({
          targetRevision,
          getLocalState: () => {
            const current = householdRef.current;
            return current
              ? {
                  revision: current.revision ?? 0,
                  hasOpenConflict: unresolvedConflicts(current).length > 0,
                }
              : null;
          },
          fetchCommandEvents: async (afterRevision) => {
            const authSession = await ensureSupabaseSession(environment);
            const current = householdRef.current;
            if (!authSession || !current) throw new Error("Realtime command catch-up needs an active session.");
            return fetchContinuityCommandEvents(
              current.householdId,
              environment,
              authenticatedSupabaseConfig(readSupabaseConfig(), authSession),
              { afterRevision, memberId },
            );
          },
          applyCommandEvent: tryApplyCommandEvent,
          recoverSnapshot: () => replayWork(source),
        });
      },
      onError: (caught) => {
        if (!live) return;
        setSyncState("error");
        setError(caught instanceof Error ? caught.message : String(caught));
      },
    });

    const scheduleRealtimeRecovery = (
      targetRevision: number | null,
      source: "realtime" | "poll" = "realtime",
    ) => {
      realtimeRecoveryScheduler.request(targetRevision, source);
    };

    const realtimeRecoveryGate = createContinuityRealtimeRecoveryGate({
      getLocalState: () => {
        const current = householdRef.current;
        return current
          ? {
              revision: current.revision ?? 0,
              hasOpenConflict: unresolvedConflicts(current).length > 0,
            }
          : null;
      },
      scheduleRecovery: scheduleRealtimeRecovery,
      defer: (fn, waitMs) => {
        const id = window.setTimeout(fn, waitMs);
        return { clear: () => window.clearTimeout(id) };
      },
    });

    let detachRealtime: (() => void) | null = null;
    let realtimeGeneration = 0;
    const realtimeOn = continuityRealtimeSelfHealEnabled({
      environment,
      transportEnabled: continuityRealtimeTransportEnabled(),
      authEnabled: supabaseAuthEnabled(),
      hostedAllowed: hostedContinuityAllowed(environment),
    });
    const realtimeStatusRef: { current: ContinuityRealtimeStatus | null } = { current: null };
    const deferPollForRealtimeReconnect = () => {
      const memberCount = householdRef.current?.members.filter((row) => row.active).length ?? 2;
      nextPollAllowedAtMs = Math.max(
        nextPollAllowedAtMs,
        Date.now() + livePullIntervalMs(memberCount),
      );
    };

    const setupRealtime = async (): Promise<boolean> => {
      const generation = ++realtimeGeneration;
      detachRealtime?.();
      detachRealtime = null;
      if (!continuityRealtimeTransportEnabled() || !supabaseAuthEnabled()) return false;
      const authSession = await ensureSupabaseSession(environment);
      if (!live || generation !== realtimeGeneration || !authSession) return false;
      const currentHouseholdId = householdRef.current?.householdId;
      if (!currentHouseholdId) return false;
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
      if (!live || generation !== realtimeGeneration || !role) return false;
      const authConfig = readHearthAuthConfig();
      if (!authConfig) return false;
      if (!canAttachContinuityRealtime({
        authSessionPresent: true,
        membershipResolved: true,
        hostedAllowed: hostedContinuityAllowed(environment),
        hasHousehold: true,
        environment,
        commandLogEnabled: continuityCommandLogEnabled(),
      })) return false;
      if (!live || generation !== realtimeGeneration) return false;

      const { attachContinuityRealtime } = await import("./continuityRealtime.ts");
      if (!live || generation !== realtimeGeneration) return false;
      const detach = attachContinuityRealtime({
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
          realtimeRecoveryGate.beginCommand();
          void coordinator.run("realtime", () => tryApplyCommandEvent(event)).then(
            (outcome) => {
              realtimeRecoveryGate.finishCommand(
                outcome === "applied" || outcome === "duplicate" ? "covered" : "recover",
              );
            },
            () => realtimeRecoveryGate.finishCommand("recover"),
          );
        },
        onSnapshotSignal: (signal) => {
          if (!shouldRunLivePull({
            documentVisible: document.visibilityState === "visible",
            online: typeof navigator === "undefined" ? true : navigator.onLine,
            hasSession: Boolean(memberId),
            hasHousehold: Boolean(householdRef.current),
          })) return;
          traceSyncPilot("snapshot-signal", {
            revision: signal.revision ?? undefined,
            transport: "snapshot-realtime",
          });
          realtimeRecoveryGate.noteSnapshot(signal);
        },
        onStatusChange: (status) => {
          if (!live || generation !== realtimeGeneration) return;
          realtimeStatusRef.current = status;
          if (status === "SUBSCRIBED") {
            consecutiveUnhealthyPolls = 0;
            nextPollAllowedAtMs = 0;
            traceSyncPilot("realtime-subscribed", { transport: "command-realtime" });
          } else if (status === "CLOSED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            traceSyncPilot("realtime-disconnected", { transport: "command-realtime" });
          }
          setRealtimeStatus(status);
          realtimeReconnectGate.noteStatus(status);
        },
        onHeartbeatStatus: (status) => {
          if (!live || generation !== realtimeGeneration) return;
          if (status === "error" || status === "timeout" || status === "disconnected") {
            realtimeStatusRef.current = "CHANNEL_ERROR";
            setRealtimeStatus("CHANNEL_ERROR");
            traceSyncPilot("realtime-disconnected", { transport: "command-realtime" });
          }
          realtimeReconnectGate.noteHeartbeat(status);
        },
      });
      if (!live || generation !== realtimeGeneration) {
        detach();
        return false;
      }
      detachRealtime = detach;
      return true;
    };

    const realtimeReconnectGate = createContinuityRealtimeReconnectGate({
      reconnect: async () => {
        if (!live) return;
        traceSyncPilot("realtime-reconnect", { transport: "command-realtime" });
        realtimeStatusRef.current = "JOINING";
        setRealtimeStatus("JOINING");
        const attached = await setupRealtime();
        if (!attached && live) {
          realtimeStatusRef.current = null;
          setRealtimeStatus(null);
        }
        return attached;
      },
      onSubscribed: (afterReconnect) => {
        if (!live || !afterReconnect) return;
        scheduleRealtimeRecovery(null);
      },
      onReconnectScheduled: deferPollForRealtimeReconnect,
      defer: (fn, waitMs) => {
        const id = window.setTimeout(fn, waitMs);
        return { clear: () => window.clearTimeout(id) };
      },
    });

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

    const onOnline = () => {
      const healingRealtime = shouldDeferResumeForRealtimeReconnect({
        realtimeEnabled: realtimeOn,
        status: realtimeStatusRef.current,
      });
      if (healingRealtime) realtimeReconnectGate.requestReconnect("online");
      else requestResume("online");
    };
    const onFocus = () => {
      const healingRealtime = shouldDeferResumeForRealtimeReconnect({
        realtimeEnabled: realtimeOn,
        status: realtimeStatusRef.current,
      });
      if (healingRealtime) realtimeReconnectGate.requestReconnect("focus");
      else requestResume("focus");
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      const healingRealtime = shouldDeferResumeForRealtimeReconnect({
        realtimeEnabled: realtimeOn,
        status: realtimeStatusRef.current,
      });
      if (healingRealtime) realtimeReconnectGate.requestReconnect("visibility");
      else requestResume("visibility");
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    requestResume("manual");

    if (realtimeOn) {
      const initialRealtimeGeneration = realtimeGeneration + 1;
      void setupRealtime().then((attached) => {
        if (!live || realtimeGeneration !== initialRealtimeGeneration || attached) return;
        realtimeStatusRef.current = null;
        setRealtimeStatus(null);
      }).catch(() => {
        if (!live || realtimeGeneration !== initialRealtimeGeneration) return;
        realtimeStatusRef.current = "CHANNEL_ERROR";
        setRealtimeStatus("CHANNEL_ERROR");
        realtimeReconnectGate.noteStatus("CHANNEL_ERROR");
      });
    }
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
      traceSyncPilot("poll-fallback", { transport: "poll" });
      if (shouldRecoverPollCommandsFirst({
        realtimeEnabled: realtimeOn,
        status: realtimeStatusRef.current,
      })) {
        scheduleRealtimeRecovery(null, "poll");
      } else {
        scheduleReplay("poll");
      }
    }, 1_000);
    return () => {
      live = false;
      realtimeGeneration += 1;
      resumeGate.dispose();
      realtimeRecoveryGate.dispose();
      realtimeRecoveryScheduler.dispose();
      realtimeReconnectGate.dispose();
      detachRealtime?.();
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearInterval(timer);
    };
  }, [environment, session?.memberId, household?.householdId, activeBooksGate.ready]);

  useEffect(() => {
    let live = true;
    const memberId = session?.memberId;
    if (!household || !memberId || !activeBooksGate.ready) {
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
  }, [environment, household?.householdId, household?.revision, session?.memberId, activeBooksGate.ready]);

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
        const google = loadGoogleSession(environment, memberId, householdId);
        const identity = authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : continuityIdentityFromGoogle(google);
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
  useEffect(() => {
    if (tab === "till" && view !== "household") setTab("home");
  }, [tab, view]);
  // Onboarding slice 10: the D-129 auto-start this superseded ("automatic
  // start after Home renders") used to drop an empty household straight
  // into Charter founding — no invitation, no explanation, no partner. The
  // predicate stays exactly as it was; only its consumer changes. An empty
  // household is now offered the household onboarding track instead
  // (HEARTH_ONBOARDING_BUILD_MANUAL.md Appendix B.2). offerHouseholdOnboarding
  // is a safe no-op once the record exists and is no longer "inactive" (see
  // its own implementation in core/commands.ts), but the explicit prior-state
  // guard below keeps this effect from re-committing an identical write on
  // every household reference change once the household has already been
  // offered — the effect fires many times over a session; the commit must
  // fire at most once.
  useEffect(() => {
    if (!household || view !== "household") return;
    if (!householdNeedsCharterFounding(household)) return;
    const priorOnboarding = acceptedHouseholdOnboarding(household);
    if (priorOnboarding && priorOnboarding.state !== "inactive") return;
    void run((current) => offerHouseholdOnboarding(current, { memberId }));
  }, [household, view]);
  const charterFoundingVisible = Boolean(household && session && view === "household" && charterFoundingOpen);
  const charterPageVisible = Boolean(household && session && view === "household" && charterPageOpen && household.charter);
  const charterTakeoverVisible = charterFoundingVisible || charterPageVisible;
  // The invitation (plate 9) and the handshake (plate 10) — a card on Home,
  // never a takeover: deliberately NOT part of charterTakeoverVisible, so
  // app-shell is never made inert and Home keeps rendering underneath it.
  // "Not now" is session-only (component state, not a household write) —
  // per HEARTH_UX_PACKET.md §13.7 it does not return this session, but a
  // fresh session sees it again if the household is still offered. Keyed by
  // OnboardingModeState rather than a plain boolean so dismissing the
  // "offered" screen never suppresses a later, genuinely new
  // "handshake-pending" screen (the partner proposing on their own device).
  const onboardingInviteRecord = household ? acceptedHouseholdOnboarding(household) : null;
  const onboardingInviteVisible = Boolean(
    household
    && session
    && view === "household"
    && onboardingInviteRecord
    && (onboardingInviteRecord.state === "offered" || onboardingInviteRecord.state === "handshake-pending")
    && onboardingInviteDismissedState !== onboardingInviteRecord.state,
  );
  const onboardingStandingFactOnly = Boolean(
    household
    && memberId
    && nextChapterFor(household, memberId, today)?.id === "ch-07-recurrences",
  );
  const onboardingCadenceOnly = Boolean(
    household
    && memberId
    && nextChapterFor(household, memberId, today)?.id === "ch-08-cadence",
  );
  const onboardingCategoriesOnly = Boolean(
    household
    && memberId
    && view === "household"
    && nextChapterFor(household, memberId, today)?.id === "ch-09-categories",
  );
  const onboardingEstimatesOnly = Boolean(
    household
    && memberId
    && view === "household"
    && nextChapterFor(household, memberId, today)?.id === "ch-10-estimates",
  );
  const personalSource = useMemo(() => {
    return household && memberId && personalReplica?.memberId === memberId
      && personalReplica.lastCommittedAt === household.lastCommittedAt
      ? assembleHousehold(splitForSync(household, memberId).shared, personalReplica, { linked: household.linked })
      : household;
  }, [household, memberId, personalReplica]);
  const visible = useMemo(
    () => (personalSource && memberId ? householdForView(personalSource, memberId, view) : personalSource),
    [personalSource, memberId, view],
  );
  const experience = useMemo(
    () => (personalSource && memberId ? projectLedgerExperience(personalSource, memberId, view, today) : null),
    [personalSource, memberId, view, today],
  );
  const scopedHousehold = experience && experience.ok ? experience.scopedHousehold : visible;
  const dashboard = useMemo(
    () => (scopedHousehold ? buildDashboard(scopedHousehold, today, now, experience && experience.ok ? experience.integrityFindings.length : 0) : null),
    [scopedHousehold, today, now, experience],
  );
  const syncFreshnessDisplay = useMemo(() => {
    const continuityActive = Boolean(
      household
      && household.sharing?.mode !== "local"
      && household.sharing?.mode !== "invite-draft"
    );
    const authRequired = continuityAuthReconnectRequired({
      environment,
      authEnabled: supabaseAuthEnabled(),
      hostedAllowed: hostedContinuityAllowed(environment),
      continuityActive,
      hasHousehold: Boolean(household),
      hasMember: Boolean(memberId),
      authSessionPresent: supabaseSessionPresent,
    });
    if (!household || !memberId) {
      return buildSyncFreshness({
        household: null,
        viewerMemberId: null,
        realtimeEnabled: continuityRealtimeTransportEnabled(),
        realtimeStatus,
        authRequired,
        offline,
        pendingOutboxCount: 0,
        hasOpenConflict: false,
        booksBlocked: booksReadiness.phase === "blocked" && readinessMatches(booksReadiness, household),
        syncState,
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
      authRequired,
      offline,
      pendingOutboxCount: listContinuityOutbox(environment).filter((item) => item.householdId === household.householdId).length,
      hasOpenConflict: unresolvedConflicts(household).length > 0,
      booksBlocked: booksReadiness.phase === "blocked" && readinessMatches(booksReadiness, household),
      syncState,
      lastReconcileAt: lastReconcile?.at ?? null,
      lastReconcileSource: lastReconcile?.source ?? null,
      pollIntervalMs: livePullIntervalMs(activeMembers),
    });
  }, [household, memberId, realtimeStatus, lastReconcile, environment, offline, supabaseSessionPresent, booksReadiness, syncState]);
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
    if (!booksGateRef.current.ready) {
      setError(booksGateRef.current.reason || "The local journal is still validating.");
      return;
    }
    const memberId = session.memberId;
    softPresenceTouchAtRef.current = Date.now();
    void persistKnownMetadataHousehold((current) => nextOptOut
      ? { ...current, devices: deactivateLocalDevice(current.devices ?? [], localDeviceId()) }
      : touchHouseholdDevice(current, {
          deviceId: localDeviceId(),
          label: describeDeviceLabel(),
          memberId,
        }).household);
  }

  useEffect(() => {
    if (commandProgressPhase !== "cloud-ack") return undefined;
    const timer = window.setTimeout(() => setCommandProgressPhase("idle"), 4000);
    return () => window.clearTimeout(timer);
  }, [commandProgressPhase]);

  useEffect(() => {
    if (onboardingStandingFactOnly && guard?.kind === "duePreview") setGuard(null);
  }, [guard, onboardingStandingFactOnly]);

  useEffect(() => {
    setLastReconcile(null);
    setRealtimeStatus(null);
  }, [household?.householdId]);

  useEffect(() => {
    if (booting || !household || !activeBooksGate.ready || adding || guard) return;
    if (onboardingStandingFactOnly) return;
    if (unresolvedConflicts(household).length > 0) return;

    const previewKey = `${environment}:${household.householdId}:${today}`;
    if (duePreviewOffered.current === previewKey) return;
    if (duePreviewDismissed(environment, household.householdId, today)) return;

    if (!experience || !experience.ok) return;
    const rows = dueRecurrencePreview(experience.scopedHousehold, today);
    if (!rows.length) return;
    duePreviewOffered.current = previewKey;
    setGuard({ kind: "duePreview", rows });
  }, [adding, booting, environment, experience, guard, household, onboardingStandingFactOnly, today, activeBooksGate.ready]);

  function rememberSession(next: Session) {
    const remembered = { ...next, householdId: next.householdId ?? householdRef.current?.householdId };
    const previous = sessionRef.current;
    if (
      previous?.memberId !== remembered.memberId
      || previous?.householdId !== remembered.householdId
      || previous?.view !== remembered.view
    ) {
      if (
        previous?.memberId !== remembered.memberId
        || previous?.householdId !== remembered.householdId
      ) replicaScopeGenerationRef.current += 1;
      closeAdd();
      setSwipeOpen(false);
      setSwipeError("");
      setSwipeStrip(null);
    }
    sessionRef.current = remembered;
    setSession(remembered);
    saveSession(environment, remembered);
  }

  async function switchLedger(householdId: string): Promise<void> {
    if (!householdId || householdId === householdRef.current?.householdId) return;
    if (openingHouseholdRef.current) return;
    replicaScopeGenerationRef.current += 1;
    openingHouseholdRef.current = householdId;
    setSwipeOpen(false);
    setSwipeError("");
    setSwipeStrip(null);
    setBusy(true);
    setError("");
    try {
      await enqueueWrite(async () => {
      const candidate = await selectHouseholdReplica(environment, householdId, session?.memberId);
      const currentGoogle = session?.memberId
        ? loadGoogleSession(environment, session.memberId, householdRef.current?.householdId)
        : null;
      const continuityIdentity = continuityIdentityFromGoogle(currentGoogle);
      const googleMember = continuityIdentity ? continuityMemberId(candidate, continuityIdentity) : null;
      const nextMemberId = googleMember
        ?? (candidate.members.some((member) => member.id === session?.memberId && member.active) ? session?.memberId : undefined)
        ?? candidate.members.find((member) => member.active)?.id;
      if (!nextMemberId) throw new Error("That ledger has no active household member.");
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
      adoptAcceptedHousehold(candidate, status);
      rememberSession({ memberId: nextMemberId, view: session?.view ?? "household", householdId });
      setBooksStatus(status);
      setHistory(loadUndoHistory(environment, householdId, nextMemberId, candidate));
      setToast(null);
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (openingHouseholdRef.current === householdId) openingHouseholdRef.current = null;
      setBusy(false);
    }
  }

  async function createOrReplayDemoSuite(seed: number): Promise<void> {
    if (environment !== "development") throw new Error("Demo Suite is Development-only.");
    const memberId = session?.memberId;
    const current = householdRef.current;
    if (!memberId || !current) throw new Error("Choose who is using this ledger before opening Demo Suite.");
    await gateWithGoogle({ record: false });
    const authRequired = supabaseAuthEnabled();
    const authSession = authRequired ? await ensureSupabaseSession(environment) : null;
    const googleSession = loadGoogleSession(environment, memberId, current.householdId);
    const currentLink = current.google.links.find((row) => row.memberId === memberId && row.active);
    const identity = requireDemoSuiteContinuityIdentity({
      household: current,
      memberId,
      authRequired,
      authIdentity: authSession
        ? { email: authSession.email, subject: authSession.googleSubject }
        : null,
      fallbackIdentity: continuityIdentityFromGoogle(googleSession)
        ?? (currentLink ? { email: currentLink.email, subject: currentLink.subject } : null),
    });

    const generated = await generateDemoSuite({
      today,
      seed,
      profile: "investor",
      numberStyle: "realistic",
      buildSha: import.meta.env.VITE_GIT_SHA || "local-development",
    });
    let candidate = generated.household;
    let accepted: Household;
    if (current.syntheticFixture?.kind === "hearth-demo-suite") {
      candidate = preserveDemoShowcaseContinuity(current, candidate);
      const outcome = await persist(candidate, undefined, memberId, { forceFlush: true });
      if (!outcome?.ok) throw new Error(outcome?.userMessage || "Demo Suite could not replace its synthetic household.");
      accepted = outcome.household;
    } else {
      candidate = linkGoogleIdentity(candidate, {
        memberId,
        email: identity.email,
        subject: identity.subject,
        displayName: authSession?.displayName ?? (googleSession ? googleSession.identity.displayName : currentLink?.displayName) ?? "",
        grantedScopes: googleSession?.grantedScopes ?? currentLink?.grantedScopes ?? ["openid", "email", "profile"],
      }).household;
      const confirmationId = `demo-suite-${candidate.householdId}-${seed}`;
      const outcome = await persist(candidate, {
        id: confirmationId,
        label: "Create Demo Suite",
        snapshot: current,
        postedIds: [],
        actorMemberId: memberId,
        commandKind: "create-demo-suite",
      }, memberId, {
        confirmationId,
        forceFlush: true,
        suppressUndo: true,
      });
      if (!outcome?.ok || outcome.kind !== "synchronized") {
        throw new Error(outcome?.userMessage || "Demo Suite could not create its dedicated cloud household.");
      }
      accepted = outcome.household;
      closeAdd();
      const status: BooksStatus = {
        ok: true,
        engine: outcome.kind === "synchronized" ? "pglite+supabase" : "pglite",
        entryCount: accepted.transactions.length,
        inBalance: true,
        equationHolds: true,
      };
      adoptAcceptedHousehold(accepted, status);
      rememberSession({ memberId, view: "household", householdId: accepted.householdId });
      setBooksStatus(status);
      setReplicas(await listHouseholdReplicas(environment));
    }
    setDemoSeed(String(seed));
    setDemoReport(await verifyDemoSuite(accepted, generated.manifest));
    setHistory([]);
    setToast(null);
  }

  async function openDiscoveredLedger(
    target: HouseholdEntryTarget,
    source: DiscoveredHousehold[] = discoveredLedgers,
    shouldContinue?: () => boolean,
  ): Promise<void> {
    const accountFlow = shouldContinue ?? accountFlowGateRef.current.begin().isCurrent;
    if (!accountFlow()) return;
    if (openingHouseholdRef.current) return;
    const found = discoveredHouseholdForTarget(source, target);
    if (!found) throw new Error("That household card is out of date. Refresh your Google households and try again.");
    replicaScopeGenerationRef.current += 1;
    const openingKey = `${found.household.householdId}:${found.memberId}`;
    openingHouseholdRef.current = openingKey;
    setBusy(true);
    setError("");
    try {
      await enqueueWrite(async () => {
      const previous = householdRef.current;
      const candidate = previous?.householdId === found.household.householdId
        ? await reconcileHouseholdSnapshots(previous, found.household, found.memberId)
        : found.household;
      if (!accountFlow()) return;
      const googleSession = loadGoogleSession(environment, found.memberId, candidate.householdId)
        ?? loadGoogleSession(environment, "__welcome__");
      const continuityIdentity = continuityIdentityFromGoogle(googleSession);
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
      if (!accountFlow()) return;
      if (accepted.household.householdId !== target.householdId) {
        throw new Error("The accepted books did not match the household card you selected.");
      }
      const adopted = adoptGoogleSession(environment, "__welcome__", found.memberId, accepted.household.householdId);
      if (!adopted && !loadSupabaseSession(environment)) {
        throw new Error("Google signed in, but this device could not keep the session.");
      }
      adoptAcceptedHousehold(accepted.household, {
        ok: true,
        engine: "pglite+supabase",
        entryCount: accepted.household.transactions.length,
        inBalance: true,
        equationHolds: true,
      });
      rememberSession({ memberId: found.memberId, view: "household", householdId: accepted.household.householdId });
      const replicas = await listHouseholdReplicas(environment);
      if (!accountFlow()) return;
      setReplicas(replicas);
      setDiscoveredLedgers([]);
      setSyncState("synced");
      setBooksStatus({
        ok: true,
        engine: "pglite+supabase",
        entryCount: accepted.household.transactions.length,
        inBalance: true,
        equationHolds: true,
      });
      });
    } finally {
      if (openingHouseholdRef.current === openingKey) openingHouseholdRef.current = null;
      if (accountFlow()) setBusy(false);
    }
  }

  function startQrInviteGoogleSignIn(token: string, inviteEnvironment: Environment = environment): void {
    cancelAccountFlow();
    savePendingAuthInvite({ token, environment: inviteEnvironment });
    setInviteInput(token);
    setPendingAuthInvite(token);
    setInviteFlowState("awaiting-google");
    setWelcomeMode("join");
    rememberWelcomeGoogleIntent("login");
    if (inviteEnvironment !== environment) changeEnvironment(inviteEnvironment);
    clearGoogleSessions(inviteEnvironment);
    clearSupabaseSession(inviteEnvironment);
    startSupabaseGoogleSignIn(
      inviteEnvironment,
      window.location.href,
      readHearthAuthConfig(),
      (url) => window.location.assign(url),
      { selectAccount: true },
    );
  }

  async function redeemAuthInviteToken(token: string, shouldContinue: () => boolean = () => true): Promise<void> {
    if (!shouldContinue()) return;
    savePendingAuthInvite({ token, environment });
    setPendingAuthInvite(token);
    setInviteInput(token);
    setWelcomeMode("join");
    try {
      if (!supabaseAuthEnabled()) {
        throw new Error("Auth invites need an Auth-enabled kitchen build.");
      }
      if (!hostedContinuityAllowed(environment)) {
        throw new Error(inviteReasonMessage("continuity-disabled"));
      }
      const authSession = await ensureSupabaseSession(environment);
      if (!shouldContinue()) return;
      if (!authSession) {
        setInviteFlowState("awaiting-google");
        rememberWelcomeGoogleIntent("login");
        startSupabaseGoogleSignIn(environment);
        return;
      }
      setInviteFlowState("redeeming");
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const redeemed = await redeemHouseholdInvite({
        environment,
        inviteToken: token,
        displayName: authSession.displayName,
        config: cloudConfig,
      });
      if (!shouldContinue()) return;
      if (!redeemed.ok) {
        if (isFullHouseInviteReason(redeemed.reason)) {
          setInviteFlowState("idle");
          setError("");
          setFullHouseInvite({ email: authSession.email });
          return;
        }
        throw new Error(inviteReasonMessage(redeemed.reason));
      }
      if (redeemed.environment !== environment) {
        throw new Error(`This invitation belongs to ${redeemed.environment}. Switch to that environment and try again.`);
      }
      setInviteFlowState("refreshing");
      const registered = await registerCurrentHouseholdDevice({
        environment,
        deviceId: localDeviceId(),
        deviceLabel: describeDeviceLabel(),
        config: cloudConfig,
      });
      if (!shouldContinue()) return;
      if (!registered.ok) throw new Error(inviteReasonMessage(registered.reason));
      const identity = { email: authSession.email, subject: authSession.googleSubject };
      const found = await discoverContinuityMemberships(identity, environment, cloudConfig);
      if (!shouldContinue()) return;
      const match = discoveredHouseholdForTarget(found, {
        householdId: redeemed.householdId,
        memberId: redeemed.memberId ?? null,
      });
      if (!match) {
        throw new Error("Invitation accepted, but the household list did not refresh. Try the invitation again; redemption is safe to repeat.");
      }
      setWelcomeIdentity({
        ...identity,
        displayName: authSession.displayName,
        grantedScopes: ["openid", "email", "profile"],
      });
      setDiscoveredLedgers(found);
      await openDiscoveredLedger({
        householdId: match.household.householdId,
        memberId: match.memberId,
      }, found, shouldContinue);
      if (!shouldContinue()) return;
      setHighlightedHouseholdId(null);
      setPendingAuthInvite(null);
      clearPendingAuthInvite();
      rememberWelcomeGoogleIntent(null);
      setInviteFlowState("idle");
      setWelcomeMode("home");
      setError("");
    } catch (caught) {
      if (!shouldContinue()) return;
      setInviteFlowState("error");
      throw caught;
    }
  }

  async function continueWithGoogle(intent?: WelcomeGoogleIntent): Promise<void> {
    const accountFlow = accountFlowGateRef.current.begin();
    const shouldContinue = accountFlow.isCurrent;
    const welcomeIntent = intent ?? loadWelcomeGoogleIntent() ?? "login";
    setBusy(true);
    setError("");
    try {
      let identity: ContinuityIdentity;
      let identityDetails: WelcomeIdentity;
      let cloudConfig = readSupabaseConfig();
      if (supabaseAuthEnabled()) {
        let authSession = await ensureSupabaseSession(environment);
        if (!shouldContinue()) return;
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
        if (!hostedContinuityAllowed(environment)) {
          throw new Error(inviteReasonMessage("continuity-disabled"));
        }
        cloudConfig = authenticatedSupabaseConfig(cloudConfig, authSession);
        const registered = await registerCurrentHouseholdDevice({
          environment,
          deviceId: localDeviceId(),
          deviceLabel: describeDeviceLabel(),
          config: cloudConfig,
        });
        if (!shouldContinue()) return;
        if (!registered.ok) throw new Error(inviteReasonMessage(registered.reason));
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
          await redeemAuthInviteToken(inviteToken, shouldContinue);
          return;
        }
      } else {
        const googleSession = await connectGoogle({
          environment,
          memberId: "__welcome__",
          services: ["identity"],
          selectAccount: true,
        });
        if (!shouldContinue()) return;
        identity = googleSession.identity;
        identityDetails = {
          ...identity,
          displayName: googleSession.identity.displayName,
          grantedScopes: googleSession.grantedScopes,
        };
      }
      let found = await discoverContinuityMemberships(identity, environment, cloudConfig);
      if (!shouldContinue()) return;
      if (!found.length && supabaseAuthEnabled() && cloudConfig?.accessToken) {
        const bound = await bindGoogleMemberships({ environment, config: cloudConfig });
        if (!shouldContinue()) return;
        if (bound.ok && bound.bound > 0) {
          const registered = await registerCurrentHouseholdDevice({
            environment,
            deviceId: localDeviceId(),
            deviceLabel: describeDeviceLabel(),
            config: cloudConfig,
          });
          if (!shouldContinue()) return;
          if (!registered.ok) throw new Error(inviteReasonMessage(registered.reason));
          found = await discoverContinuityMemberships(identity, environment, cloudConfig);
          if (!shouldContinue()) return;
        } else if (!bound.ok && bound.reason === "bind-rpc-missing") {
          throw new Error(
            "This kitchen needs migration 010 (bind Google memberships) pasted in the Supabase SQL Editor, then Continue with Google again.",
          );
        }
      }
      if (!found.length) {
        if (!shouldContinue()) return;
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
        setDiscoveredLedgers([]);
        setWelcomeMode(welcomeIntent === "create" ? "new" : "home");
        return;
      }
      if (!shouldContinue()) return;
      rememberWelcomeGoogleIntent(null);
      setWelcomeIdentity(identityDetails);
      setHighlightedHouseholdId(null);
      setInviteFlowState("idle");
      setWelcomeMode(welcomeIntent === "create" ? "new" : "home");
      setDiscoveredLedgers(found);
    } catch (caught) {
      if (!shouldContinue()) return;
      if (pendingAuthInvite || loadPendingAuthInvite()) setInviteFlowState("error");
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (shouldContinue()) setBusy(false);
    }
  }

  async function commitHousehold(
    next: Household,
    token?: UndoToken,
    actorId?: string,
    options?: CommitHouseholdOptions,
  ): Promise<CommandOutcome | null> {
    const previous = householdRef.current;
    if (previous && !booksGateRef.current.ready) {
      const message = booksGateRef.current.reason || "The local journal must finish validating before anything can change.";
      if (options?.onRejected) options.onRejected(message);
      else setError(message);
      return null;
    }
    setBusy(true);
    const explicitConfirmationId = options?.confirmationId;
    const confirmationId = explicitConfirmationId ?? confirmationRef.current ?? newConfirmationId();
    if (!explicitConfirmationId) confirmationRef.current = confirmationId;
    const ledgerWrite = isLedgerWrite(token);
    const memberId = actorId ?? session?.memberId;
    const shareCapable = Boolean((previous?.linked || next.linked) && hostedContinuityAllowed(environment) && memberId);
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
    if (ledgerWrite) await afterNextPaint();
    try {
      const googleSession = memberId ? loadGoogleSession(environment, memberId, next.householdId) : null;
      const authRequired = supabaseAuthEnabled();
      const cachedAuthSession = authRequired ? loadSupabaseSession(environment) : null;
      const cachedContinuityIdentity: ContinuityIdentity | null = cachedAuthSession
        ? { email: cachedAuthSession.email, subject: cachedAuthSession.googleSubject }
        : continuityIdentityFromGoogle(googleSession);
      const cloudBackedHousehold = Boolean(
        previous?.linked
        || next.linked
        || (memberId && cachedContinuityIdentity && continuityMemberId(next, cachedContinuityIdentity) === memberId),
      );
      const onlineRequired = cloudLedgerOnlineRequiredEnabled(environment) && cloudBackedHousehold;
      const deviceOnline = !offline && (typeof navigator === "undefined" || navigator.onLine);
      if (onlineRequired && !deviceOnline) {
        throw new ValidationError(CLOUD_LEDGER_OFFLINE_MESSAGE);
      }
      const authSession = (options?.forceFlush === true || onlineRequired) && authRequired
        ? await ensureSupabaseSession(environment)
        : cachedAuthSession;
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      const continuityIdentity: ContinuityIdentity | null = authRequired
        ? authSession
          ? { email: authSession.email, subject: authSession.googleSubject }
          : null
        : continuityIdentityFromGoogle(googleSession);
      const automaticContinuity = Boolean(
        continuityIdentity &&
        memberId &&
        continuityMemberId(next, continuityIdentity) === memberId,
      );
      const transportRequested = hostedContinuityAllowed(environment) && automaticContinuity;
      const onlineGate = cloudLedgerWriteGate({
        environment,
        cloudBackedHousehold,
        online: deviceOnline,
        authEnabled: authRequired,
        authSessionPresent: Boolean(authSession),
        membershipMatches: automaticContinuity,
        completeReplicaReady: !previous?.linked || Boolean(
          memberId
          && cloudReplicaReadyKeyRef.current === onlineRequiredReplicaKey({
            environment,
            householdId: previous.householdId,
            memberId,
            revision: previous.revision,
          }),
        ),
        pendingOutboxCount: listContinuityOutbox(environment)
          .filter((item) => item.householdId === (previous?.householdId ?? next.householdId)).length,
        hasUnacknowledgedSnapshot: previous?.sharing?.mode === "pending-transport",
      });
      if (!onlineGate.allowed) throw new ValidationError(onlineGate.reason ?? "The cloud-backed books are not ready to save.");
      if (onlineGate.required) setCloudReplicaReadyKey(null);
      // In launch mode the command compiler validates accounting facts first;
      // cloud acknowledgement is the commit boundary, then active PGlite advances.
      const flushTransport = options?.forceFlush === true || onlineGate.required;
      const outcome = await acceptHouseholdWrite({
        previous,
        candidate: next,
        confirmationId,
        commandKind: token?.commandKind ?? token?.label ?? "commit",
        postedIds: token?.postedIds ?? [],
        actingMemberId: memberId,
        transportRequested,
        requireSynchronized: onlineGate.required,
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
                reconcileAmbiguous: onlineGate.required,
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
      if (outcome.ok) {
        traceSyncPilot("local-accepted", {
          household: outcome.household,
          confirmationId,
          revision: outcome.revision,
          pendingCount,
          transport: "local",
        });
      }
      if (pendingCount > 0) {
        traceSyncPilot("outbox-enqueued", {
          household: outcome.household,
          confirmationId,
          revision: outcome.revision,
          pendingCount,
          transport: "outbox",
        });
      }
      if (outcome.kind === "synchronized") {
        traceSyncPilot("cloud-ack", {
          household: outcome.household,
          confirmationId,
          revision: outcome.revision,
          pendingCount,
          transport: "outbox",
        });
      }
      if (outcome.kind === "conflict-needs-attention" || unresolvedConflicts(outcome.household).length > 0) {
        traceSyncPilot("conflict", {
          household: outcome.household,
          confirmationId,
          revision: outcome.revision,
          pendingCount,
          transport: "outbox",
        });
        setSyncState("syncing");
      }
      if (outcome.kind === "synchronized") {
        saveSyncAnchor(environment, outcome.household);
        const who = memberId;
        if (who && !onlineGate.required) {
          void appendRestorePoint(outcome.household, who).then(async (withPoint) => {
            if (withPoint === outcome.household) return;
            // Commit only if the synchronized source is still current. A user
            // post that wins this race must never be replaced by an old tip.
            const pending = await persistKnownMetadataHousehold((current) => (
              current.householdId === outcome.household.householdId
              && current.revision === outcome.household.revision
                ? markPendingTransport({ ...withPoint, revision: withPoint.revision + 1 })
                : null
            ));
            if (!pending) return;
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
                await persistKnownMetadataHousehold((current) => (
                  current.householdId === pending.householdId && current.revision === pending.revision
                    ? markSynchronized(current)
                    : null
                ));
              }).catch(() => undefined);
            }
          }).catch(() => undefined);
        }
      }
      if (
        !onlineGate.required &&
        automaticContinuity &&
        continuityIdentity &&
        (outcome.kind === "synchronized" || outcome.kind === "pending-transport" || !flushTransport)
      ) {
        void (async () => {
          const authRequired = supabaseAuthEnabled();
          const refreshed = authRequired
            ? await ensureSupabaseSession(environment)
            : null;
          if (
            authRequired
            && (!refreshed || !supabaseSessionMatchesGoogleIdentity(refreshed, continuityIdentity))
          ) {
            return null;
          }
          const refreshedConfig = authenticatedSupabaseConfig(readSupabaseConfig(), refreshed);
          const refreshedIdentity: ContinuityIdentity = refreshed
            ? { email: refreshed.email, subject: refreshed.googleSubject }
            : continuityIdentity;
          const flushed = await flushContinuityOutbox({
            environment,
            identity: refreshedIdentity,
            config: refreshedConfig,
            requireAuthenticatedSession: authRequired,
            authenticatedIdentity: refreshedIdentity,
          });
          return { flushed, refreshedConfig };
        })()
          .then(async (result) => {
            if (!result) return;
            const { flushed, refreshedConfig } = result;
            if (flushed.synchronized <= 0) return;
            const current = householdRef.current;
            if (!current || current.householdId !== outcome.household.householdId) return;
            let synced = markSynchronized(current);
            const who = memberId;
            if (who) {
              try {
                const withPoint = await appendRestorePoint(synced, who);
                if (withPoint !== synced) {
                  const pending = await persistKnownMetadataHousehold((current) => (
                    current.householdId === synced.householdId && current.revision === synced.revision
                      ? markPendingTransport({ ...withPoint, revision: withPoint.revision + 1 })
                      : null
                  ));
                  if (!pending) return;
                  const tipPush = await transportHouseholdWithOutbox({
                    household: pending,
                    identity: continuityIdentity,
                    expectedRevision: pending.baseRevision ?? synced.revision,
                    confirmationId: `restore-tip-${pending.householdId}-${pending.revision}`,
                    config: refreshedConfig,
                    flush: true,
                  });
                  if (tipPush.ok) {
                    const acceptedSync = await persistKnownMetadataHousehold((current) => (
                      current.householdId === pending.householdId && current.revision === pending.revision
                        ? markSynchronized(current)
                        : null
                    ));
                    if (!acceptedSync) return;
                    synced = acceptedSync;
                  } else {
                    setSyncState("syncing");
                    return;
                  }
                }
              } catch {
                /* restore tip is best-effort */
              }
            }
            const finalized = await persistKnownMetadataHousehold((current) => (
              current.householdId === synced.householdId && current.revision === synced.revision
                ? markSynchronized(current)
                : null
            ));
            if (!finalized) return;
            synced = finalized;
            saveSyncAnchor(environment, synced);
            setSyncState("synced");
            traceSyncPilot("cloud-ack", {
              household: synced,
              confirmationId,
              revision: synced.revision,
              pendingCount: 0,
              transport: "outbox",
            });
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
        !options?.suppressUndo &&
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
        if (options?.onRejected) options.onRejected(outcome.userMessage);
        else setError(outcome.userMessage);
      } else if (outcome.ok && outcome.recoveryAvailable && outcome.userMessage) {
        setError(outcome.userMessage);
      } else if (outcome.ok && outcome.kind !== "conflict-needs-attention") {
        setError("");
      }
      if (outcome.kind === "synchronized") {
        setSyncState("synced");
        if (onlineGate.required && memberId) {
          setCloudReplicaReadyKey(onlineRequiredReplicaKey({
            environment: outcome.household.environment,
            householdId: outcome.household.householdId,
            memberId,
            revision: outcome.household.revision,
          }));
        }
      } else if (
        onlineGate.required
        && !outcome.ok
        && outcome.errorClass === "conflict-detected"
        && outcome.sharingMode === "synchronized"
        && memberId
      ) {
        const status: BooksStatus = {
          ok: true,
          engine: "pglite+supabase",
          entryCount: outcome.household.transactions.length,
          inBalance: true,
          equationHolds: true,
        };
        adoptAcceptedHousehold(outcome.household, status);
        setBooksStatus(status);
        setCloudReplicaReadyKey(onlineRequiredReplicaKey({
          environment: outcome.household.environment,
          householdId: outcome.household.householdId,
          memberId,
          revision: outcome.household.revision,
        }));
        setSyncState("synced");
      } else if (outcome.kind === "pending-transport") setSyncState("syncing");
      else if (outcome.kind === "conflict-needs-attention") {
        setCloudReplicaReadyKey(null);
        setSyncState("error");
      }
      else if (outcome.ok) setSyncState("idle");
      if (outcome.ok && !(outcome.recoveryAvailable && outcome.errorClass === "books-unavailable")) {
        const status: BooksStatus = {
          ok: true,
          engine: outcome.kind === "synchronized" ? "pglite+supabase" : "pglite",
          entryCount: outcome.household.transactions.length,
          inBalance: true,
          equationHolds: true,
          error: outcome.kind === "pending-transport" ? outcome.userMessage ?? undefined : undefined,
        };
        setBooksStatus(status);
        const ready = readinessForHousehold("ready", startupGenerationRef.current, outcome.household, { status });
        booksReadinessRef.current = ready;
        booksGateRef.current = booksWriteGate(ready, outcome.household);
        setBooksReadiness(ready);
      } else if (outcome.ok) {
        const status: BooksStatus = {
          ok: false,
          engine: "pglite",
          entryCount: previous?.transactions.length ?? 0,
          inBalance: false,
          equationHolds: false,
          error: outcome.userMessage ?? undefined,
        };
        setBooksStatus(status);
        const blocked = readinessForHousehold("blocked", startupGenerationRef.current, outcome.household, {
          status,
          issue: "interrupted-transaction",
          message: outcome.userMessage ?? "The shared write is safe in cloud, but this device must rebuild its local books.",
        });
        booksReadinessRef.current = blocked;
        booksGateRef.current = booksWriteGate(blocked, outcome.household);
        setBooksReadiness(blocked);
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
      const message = classifyCommandError(caught).userMessage;
      if (options?.onRejected) options.onRejected(message);
      else setError(message);
      return null;
    } finally {
      setBusy(false);
    }
  }

  function persist(next: Household, token?: UndoToken, actorId?: string, options?: CommitHouseholdOptions) {
    const expectedScopeGeneration = replicaScopeGenerationRef.current;
    const expectedHousehold = householdRef.current;
    return enqueueWrite(() => {
      if (
        replicaScopeGenerationRef.current !== expectedScopeGeneration
        || householdRef.current !== expectedHousehold
      ) {
        const message = "The active books changed before this save began. Review the latest books, then Confirm again.";
        if (options?.onRejected) options.onRejected(message);
        else setError(message);
        return Promise.resolve(null);
      }
      return commitHousehold(next, token, actorId, options);
    });
  }

  function scheduleDemoAcceptance(): Promise<CommandOutcome | null> {
    if (pendingDemoAcceptanceRef.current) return pendingDemoAcceptanceRef.current;
    const task = new Promise<CommandOutcome | null>((resolve) => {
      const firstFrame = window.requestAnimationFrame(() => {
        const secondFrame = window.requestAnimationFrame(() => {
          pendingDemoFramesRef.current = [];
          const next = seedDemoHousehold({ today, environment });
          void persist(next).then(resolve);
        });
        pendingDemoFramesRef.current = [secondFrame];
      });
      pendingDemoFramesRef.current = [firstFrame];
    });
    pendingDemoAcceptanceRef.current = task;
    void task.then((outcome) => {
      if (!outcome?.ok) {
        pendingDemoAcceptanceRef.current = null;
        setPendingDemoMemberId(null);
        return;
      }
      setPendingDemo(null);
    });
    return task;
  }

  function openDemoTable(): void {
    if (pendingDemoAcceptanceRef.current) return;
    if (environment !== "development") {
      setError("The demo kitchen is Development-only.");
      return;
    }
    setError("");
    setPendingDemo(catalogHousehold(environment));
    setPendingDemoMemberId(null);
    void scheduleDemoAcceptance();
  }

  async function enterPendingDemo(memberId: string): Promise<void> {
    const candidate = pendingDemo;
    if (!candidate || pendingDemoMemberId) return;
    setPendingDemoMemberId(memberId);
    const outcome = await scheduleDemoAcceptance();
    if (!outcome?.ok) return;
    householdRef.current = outcome.household;
    const nextSession = { memberId, view: "household" as const, householdId: outcome.household.householdId };
    rememberSession(nextSession);
  }

  useEffect(() => () => {
    for (const frame of pendingDemoFramesRef.current) window.cancelAnimationFrame(frame);
    pendingDemoFramesRef.current = [];
  }, []);

  function persistLedgerWrite(next: Household, token?: UndoToken, confirmationId?: string) {
    const accepted = householdRef.current;
    return persist(
      accepted ? restoreAcceptedSnapshot(accepted, next) : next,
      token,
      undefined,
      confirmationId ? { confirmationId } : undefined,
    );
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

  function applyUndo(token: UndoToken, swipeScope?: SwipeUndoStrip) {
    return enqueueWrite(async () => {
      const current = householdRef.current;
      const who = session?.memberId;
      if (!current || !who) return;
      try {
        if (swipeScope && openingHouseholdRef.current) {
          setSwipeStrip(null);
          throw new ValidationError("That Swipe Undo closed while another ledger was opening. Nothing changed.");
        }
        if (swipeScope && !swipeUndoScopeMatches(swipeScope, environment, current.householdId, who)) {
          setSwipeStrip(null);
          throw new ValidationError("That Swipe Undo belongs to another ledger. Nothing changed.");
        }
        assertLatestMemberLedgerUndo(historyRef.current, who, token);
        const fundedTransactionId = fundedMoneyUndoTarget(current, token);
        const result = fundedTransactionId
          ? reversePostedMoney(current, fundedTransactionId, { createdBy: who })
          : undoLedgerConfirm(current, token);
        lastAmountLabelRef.current = null;
        const outcome = await commitHousehold(result.household, {
          ...result.undo,
          actorMemberId: who,
        }, who, { suppressUndo: Boolean(fundedTransactionId) });
        if (!outcome || !outcome.postedExactlyOnce || outcome.kind === "conflict-needs-attention") return;
        rememberUndoHistory(historyRef.current.filter((item) => item.id !== token.id));
        setToast((item) => (item?.id === token.id ? null : item));
        setSwipeStrip((item) => (item?.token.id === token.id ? null : item));
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

  function run(fn: (current: Household) => CommitResult, options?: {
    closeAdd?: boolean;
    onAccepted?: (result: CommitResult) => void;
    onConfirm?: (error: NeedsConfirmationError) => boolean;
    onError?: (message: string) => void;
  }) {
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
        const memberPersonal = result.persistenceScope === "member-personal";
        if (memberPersonal) {
          assertMemberPersonalUpdate(current, result);
          if (result.household === current) {
            options?.onAccepted?.(result);
            return;
          }
        }
        if (result.postedIds.length && form.amount) {
          try {
            lastAmountLabelRef.current = formatCad(parseAmount(form.amount));
          } catch {
            lastAmountLabelRef.current = null;
          }
        }
        const outcome = await commitHousehold(
          result.household,
          result.undo,
          memberPersonal ? result.personalMemberId : undefined,
          options?.onError ? { onRejected: options.onError } : undefined,
        );
        const accepted =
          outcome?.postedExactlyOnce === true &&
          (outcome.kind === "accepted-local" || outcome.kind === "pending-transport" || outcome.kind === "synchronized");
        if (!accepted) return;
        if (memberPersonal && result.personalMemberId) {
          setPersonalReplica(personalReplicaForMember(outcome.household, result.personalMemberId));
        }
        if (options?.closeAdd === false) {
          options?.onAccepted?.(result);
          if (result.warnings.length) setError(result.warnings.join(" "));
          return;
        }
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
          if (options?.onConfirm?.(caught)) return;
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
        } else {
          const message = caught instanceof Error ? caught.message : String(caught);
          if (options?.onError) options.onError(message);
          else setError(message);
        }
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
        const memberPersonal = result.persistenceScope === "member-personal";
        if (memberPersonal) {
          assertMemberPersonalUpdate(current, result);
          if (result.household === current) return;
        }
        const outcome = await commitHousehold(
          result.household,
          result.undo,
          memberPersonal ? result.personalMemberId : undefined,
        );
        if (outcome?.ok && memberPersonal && result.personalMemberId) {
          setPersonalReplica(personalReplicaForMember(outcome.household, result.personalMemberId));
        }
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      }
    });
  }

  function requestClearThisPhone() {
    setGuard({ kind: "clear-this-phone" });
  }

  function cancelAccountFlow() {
    accountFlowGateRef.current.cancel();
    openingHouseholdRef.current = null;
  }

  async function clearThisPhoneNow() {
    if (clearThisPhoneInFlightRef.current) return;
    replicaScopeGenerationRef.current += 1;
    setCloudReplicaReadyKey(null);
    const current = householdRef.current;
    if (!current) {
      signOutWelcomeGoogle();
      setGuard(null);
      return;
    }
    clearThisPhoneInFlightRef.current = true;
    cancelAccountFlow();
    const who = sessionRef.current?.memberId;
    const hid = current.householdId;
    clearGoogleSessions(environment);
    clearSupabaseSession(environment);
    clearSession(environment);
    clearPendingAuthInvite();
    setBusy(true);
    try {
      await enqueueWrite(async () => {
        if (who) clearUndoHistory(environment, hid, who);
        clearSyncAnchor(environment, hid);
        await clearContinuityOutboxForHouseholdDurably(environment, hid);
        await clearStagedHouseholdBooks(environment, hid);
        await clearHousehold(environment, hid, { activateRemaining: false });
        householdRef.current = null;
        sessionRef.current = null;
      });
    } catch {
      setError("Signed out. This phone could not finish removing its offline copy; sign in again before using the books.");
    } finally {
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
      setWelcomeMode("home");
      setBusy(false);
      clearThisPhoneInFlightRef.current = false;
    }
  }

  async function copyPilotSyncDiagnostic(): Promise<string> {
    const current = householdRef.current;
    const who = sessionRef.current?.memberId;
    if (!current || !who || !syncPilotDiagnosticsEnabled(environment)) {
      throw new Error("Sync diagnostics are available only in the Development pilot build.");
    }
    const bundle = await copySyncPilotDiagnostic({
      environment,
      householdId: current.householdId,
      memberId: who,
      deviceId: localDeviceId(),
      revision: current.revision,
      pendingCount: listContinuityOutbox(environment).filter((item) => item.householdId === current.householdId).length,
      syncState,
      realtimeStatus,
      offline,
      freshnessMode: syncFreshnessDisplay.transportMode,
    });
    if (!bundle) throw new Error("This build did not enable the Development sync diagnostic.");
    const p95 = bundle.latency.p95Ms == null ? "no Shared painted samples yet" : `end-to-end p95 ${bundle.latency.p95Ms} ms`;
    return `Copied privacy-safe sync diagnostic · ${bundle.latency.sampleCount}/${bundle.measurement.candidateEventCount} valid Shared painted samples · ${bundle.measurement.unpaintedEventCount} unpainted · ${p95} · ${bundle.latency.invalidClockSampleCount} invalid clock samples · cross-device clock-skew witness required.`;
  }

  async function startPilotSyncDiagnostic(): Promise<string> {
    const run = await startSyncPilotLatencyRun(environment);
    if (!run) throw new Error("This build did not enable the Development sync diagnostic.");
    return `Started clean latency run ${run.runHash}. Use this phone as the receiver, keep it visible, and collect exactly 100 Shared writes.`;
  }

  async function copyPilotClockCalibration(): Promise<string> {
    const current = householdRef.current;
    const who = sessionRef.current?.memberId;
    if (!current || !who || !syncPilotDiagnosticsEnabled(environment)) {
      throw new Error("Proof clock calibration is available only in the Development pilot build.");
    }
    const calibration = await copySyncClockCalibration({
      environment,
      householdId: current.householdId,
      memberId: who,
      deviceId: localDeviceId(),
    });
    return `Copied authenticated proof clock · offset ${calibration.offsetMs} ms · uncertainty ${calibration.uncertaintyMs} ms.`;
  }

  function traceSyncPilot(
    phase: SyncPilotTracePhase,
    details?: {
      household?: Household | null;
      confirmationId?: string | null;
      revision?: number | null;
      pendingCount?: number | null;
      transport?: SyncPilotTransport | null;
      ledgerScope?: "shared" | "personal" | null;
      painted?: boolean | null;
      paintStatus?: "painted" | "hidden-fallback" | "visible-timeout" | "unavailable" | null;
      sourceAcceptedAt?: string | null;
      cloudAcceptedAt?: string | null;
      receiverApplyMs?: number | null;
      fallbackReason?: string | null;
    },
  ): void {
    const current = details?.household ?? householdRef.current;
    const who = sessionRef.current?.memberId;
    if (!current || !who || !syncPilotDiagnosticsEnabled(environment)) return;
    void recordSyncPilotTrace({
      environment,
      phase,
      householdId: current.householdId,
      memberId: who,
      deviceId: localDeviceId(),
      confirmationId: details?.confirmationId,
      revision: details?.revision ?? current.revision,
      pendingCount: details?.pendingCount,
      transport: details?.transport,
      ledgerScope: details?.ledgerScope,
      painted: details?.painted,
      paintStatus: details?.paintStatus,
      sourceAcceptedAt: details?.sourceAcceptedAt,
      cloudAcceptedAt: details?.cloudAcceptedAt,
      receiverApplyMs: details?.receiverApplyMs,
      fallbackReason: details?.fallbackReason,
    }).catch(() => undefined);
  }

  function signOutWelcomeGoogle() {
    cancelAccountFlow();
    clearGoogleSessions(environment);
    clearSupabaseSession(environment);
    rememberWelcomeGoogleIntent(null);
    setWelcomeIdentity(null);
    setDiscoveredLedgers([]);
    setHighlightedHouseholdId(null);
    setInviteFlowState("idle");
    setPendingAuthInvite(null);
    setInviteInput("");
    clearPendingAuthInvite();
    setWelcomeMode("home");
    setError("");
  }

  function dismissWelcomeJoin() {
    setPendingAuthInvite(null);
    setInviteInput("");
    clearPendingAuthInvite();
    setInviteFlowState("idle");
    setWelcomeMode("home");
    setError("");
  }

  function tryInviteWithAnotherGoogleAccount() {
    const token = pendingAuthInvite ?? loadPendingAuthInvite()?.token ?? authInviteTokenFromText(inviteInput);
    cancelAccountFlow();
    clearGoogleSessions(environment);
    clearSupabaseSession(environment);
    rememberWelcomeGoogleIntent("login");
    setWelcomeIdentity(null);
    setDiscoveredLedgers([]);
    setHighlightedHouseholdId(null);
    setError("");
    setInviteFlowState("awaiting-google");
    setWelcomeMode("join");
    if (token) savePendingAuthInvite({ token, environment });
    startSupabaseGoogleSignIn(
      environment,
      window.location.href,
      readHearthAuthConfig(),
      (url) => window.location.assign(url),
      { selectAccount: true },
    );
  }

  async function returnToGoogleEntryAfterFullHouse(): Promise<void> {
    setBusy(true);
    try {
      cancelAccountFlow();
      clearGoogleSessions(environment);
      clearSupabaseSession(environment);
      clearSession(environment);
      clearPendingAuthInvite();
      rememberWelcomeGoogleIntent(null);
      startupGenerationRef.current += 1;
      await deactivateHouseholdSelection(environment);
      closeAdd();
      householdRef.current = null;
      sessionRef.current = null;
      setHousehold(null);
      setSession(null);
      setHistory([]);
      setPersonalReplica(null);
      setWelcomeIdentity(null);
      setDiscoveredLedgers([]);
      setHighlightedHouseholdId(null);
      setPendingAuthInvite(null);
      setInviteInput("");
      setInviteFlowState("idle");
      setWelcomeMode("home");
      setError("");
      setBooting(false);
      window.history.replaceState({}, "", "/");
      setFullHouseInvite(null);
      window.location.replace("/");
    } finally {
      setBusy(false);
    }
  }

  async function promptDeleteDiscoveredHousehold(found: DiscoveredHousehold): Promise<void> {
    setBusy(true);
    setError("");
    try {
      const authSession = await ensureSupabaseSession(environment);
      if (!authSession) throw new Error("Continue with Google before deleting a household.");
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
  }

  async function removeHouseholdFromDevice(input: {
    householdId: string;
    memberId: string;
    role: "owner" | "member" | null;
    name: string;
    mode?: "leave";
  }): Promise<void> {
    replicaScopeGenerationRef.current += 1;
    setCloudReplicaReadyKey(null);
    setBusy(true);
    try {
      const authSession = await ensureSupabaseSession(environment);
      if (!authSession) {
        throw new Error("Continue with Google before deleting a household.");
      }
      const cloudConfig = authenticatedSupabaseConfig(readSupabaseConfig(), authSession);
      await enqueueWrite(async () => {
        const result = input.mode === "leave"
          ? await leaveHousehold({ environment, householdId: input.householdId, config: cloudConfig })
          : await leaveOrDeleteHousehold({
            environment,
            householdId: input.householdId,
            role: input.role,
            config: cloudConfig,
          });
        if (!result.ok) {
          throw new Error(inviteReasonMessage(result.reason));
        }
        clearSyncAnchor(environment, input.householdId);
        await clearContinuityOutboxForHouseholdDurably(environment, input.householdId);
        await clearStagedHouseholdBooks(environment, input.householdId);
        await clearHousehold(environment, input.householdId);
        if (householdRef.current?.householdId === input.householdId) {
          householdRef.current = null;
          sessionRef.current = null;
        }
      });
      disconnectGoogle(environment, input.memberId, input.householdId);
      if (session?.memberId && session.memberId !== input.memberId) {
        disconnectGoogle(environment, session.memberId, input.householdId);
      }
      if (session?.memberId) {
        clearUndoHistory(environment, input.householdId, session.memberId);
      }
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
    replicaScopeGenerationRef.current += 1;
    setCloudReplicaReadyKey(null);
    setResetBusy(true);
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
      await enqueueWrite(async () => {
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
        householdRef.current = null;
        sessionRef.current = null;
      });
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
      setResetBusy(false);
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
          busy={resetBusy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            void startFromScratch();
          }}
        />
      )}
    </>
  );

  // D-172 supersedes D-159 for this intake path: background evidence can fill
  // an envelope, but only the visible Shift form can call the money command.
  useEffect(() => {
    void booting;
    void household;
    void session;
  }, [booting, environment, household?.householdId, household?.revision, session?.memberId]);

  if (fullHouseInvite) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">Household access</p>
          <img src="/hercules-mark.svg" alt="" />
          <h1>This house is full</h1>
          <p>Both available seats already have Google accounts assigned to this household.</p>
          <p className="muted">You signed in as {fullHouseInvite.email}. Nothing was changed in the household or in this phone’s saved ledger.</p>
          <button
            className="primary"
            type="button"
            autoFocus
            disabled={busy}
            onClick={() => void returnToGoogleEntryAfterFullHouse()}
          >
            {busy ? "Returning…" : "Back to Google sign-in"}
          </button>
        </div>
      </div>
    );
  }

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

  if (!household && pendingDemo) {
    return (
      <div className="welcome">
        <div className="welcome-card">
          <p className="kicker">Demo kitchen</p>
          <h1>Choose yourself</h1>
          <p>Hearth is here. The books are opening safely behind this table.</p>
          <KitchenNotice message={error} onDismiss={() => setError("")} />
          {pendingDemo.members.filter((member) => member.active).map((member) => (
            <button
              key={member.id}
              className="primary"
              style={{ marginTop: 8 }}
              disabled={pendingDemoMemberId !== null}
              onClick={() => void enterPendingDemo(member.id)}
            >
              {pendingDemoMemberId === member.id ? `Opening for ${member.name}…` : `I am ${member.name}`}
            </button>
          ))}
          <p className="muted" role="status" aria-live="polite">
            {pendingDemoMemberId ? "Validating the local journal before entering…" : "You can choose now; money actions stay locked until validation finishes."}
          </p>
        </div>
        <HerculesProApproval authorizationRequest={herculesProRequest} environment={environment} household={null} session={null} />
      </div>
    );
  }

  if (!household) {
    const welcomeSignedIn = Boolean(
      welcomeIdentity
      || discoveredLedgers.length > 0
      || loadGoogleSession(environment, "__welcome__")
      || loadSupabaseSession(environment),
    );
    const householdCards = discoveredHouseholdCardModels(discoveredLedgers, now, displayZone);
    const foundById = new Map(discoveredLedgers.map((found) => [found.household.householdId, found]));
    return (
      <div className="welcome">
        <div className="welcome-card" data-welcome-mode={welcomeMode}>
          <p className="kicker">CAD · Toronto books · two people</p>
          <img src="/hercules-mark.svg" alt="" />
          <h1>Hearth</h1>
          <p>Come home to the right books on every device. Google confirms who you are; Hearth confirms which households belong to you.</p>
          {welcomeMode === "join" ? (
            <DeferredSurface label="Join Hearth">
            <DeferredWelcomeJoin
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
              inviteFlowState={inviteFlowState}
              onScanQr={() => { setWelcomeMode("qr"); setError(""); }}
              onUseAnotherGoogle={tryInviteWithAnotherGoogleAccount}
              onBack={dismissWelcomeJoin}
            />
            </DeferredSurface>
          ) : welcomeMode === "qr" ? (
            <DeferredSurface label="QR scanner">
            <DeferredWelcomeQrScanner
              busy={busy}
              error={error}
              onError={setError}
              onDetected={async (raw) => {
                const token = authInviteTokenFromText(raw);
                if (token) {
                  startQrInviteGoogleSignIn(token);
                  return;
                }
                setInviteInput(raw);
                setWelcomeMode("join");
              }}
              onBack={() => { setWelcomeMode("home"); setError(""); }}
            />
            </DeferredSurface>
          ) : welcomeMode === "new" ? (
            <form onSubmit={async (event) => {
              event.preventDefault();
              let adoptedWelcomeSession = false;
              let adoptedMemberId = "";
              let adoptedHouseholdId = "";
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
                adoptedHouseholdId = next.householdId;
                adoptedWelcomeSession = Boolean(adoptGoogleSession(environment, "__welcome__", memberId, next.householdId));
                const outcome = await persist(next, undefined, memberId);
                if (!outcome?.ok) {
                  if (adoptedWelcomeSession) {
                    adoptGoogleSession(environment, memberId, "__welcome__", undefined, next.householdId);
                  }
                  return;
                }
                const nextSession = { memberId, view: "household" as const, householdId: next.householdId };
                closeAdd();
                sessionRef.current = nextSession;
                setSession(nextSession);
                saveSession(environment, nextSession);
                setWelcomeIdentity(null);
              } catch (caught) {
                if (adoptedWelcomeSession && adoptedMemberId && adoptedHouseholdId) {
                  adoptGoogleSession(environment, adoptedMemberId, "__welcome__", undefined, adoptedHouseholdId);
                }
                setError(caught instanceof Error ? caught.message : String(caught));
              }
            }}>
              <p className="kicker">New household</p>
              <h2>Create a household</h2>
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
                Back to households
              </button>
              {welcomeSignedIn && (
                <button className="ghost" type="button" style={{ width: "100%", marginTop: 8 }} onClick={() => signOutWelcomeGoogle()}>
                  Sign out of Google
                </button>
              )}
            </form>
          ) : (
            <>
              {!welcomeSignedIn ? (
                <section className="welcome-google-first" aria-labelledby="welcome-google-title">
                  <h2 id="welcome-google-title">Your household books, wherever you are</h2>
                  <button className="primary welcome-google-first__button" disabled={busy || !googleEntryAvailable} onClick={() => void continueWithGoogle("login")}>
                    {busy ? "Finding your households…" : "Continue with Google"}
                  </button>
                  <p className="muted">One private account door. No phone has to stay online as the host.</p>
                {!googleEntryAvailable && (
                    <p className="muted" role="status">Google sign-in is not configured in this build. Advanced recovery remains available.</p>
                )}
                  <button className="ghost welcome-google-first__recovery" type="button" disabled={busy} onClick={() => { setWelcomeMode("join"); setError(""); }}>
                    I have an invitation or recovery code
                  </button>
                </section>
              ) : (
                <section className="welcome-household-list">
                  <p className="kicker">Your Google households</p>
                  <h2>Choose your household</h2>
                  <p className="muted">Signed in as {welcomeIdentity?.email || loadSupabaseSession(environment)?.email || "Google account"}.</p>
                  {householdCards.length === 0 && (
                    <div className="welcome-household-empty" role="status">
                      <strong>No households yet</strong>
                      <span>Create one here, or accept an invitation from another household.</span>
                    </div>
                  )}
                  <div className="welcome-household-grid">
                    {householdCards.map((model) => {
                      const found = foundById.get(model.householdId);
                      if (!found) return null;
                      return (
                        <HouseholdEntryCard
                          key={model.householdId}
                          model={model}
                          busy={busy}
                          highlighted={model.householdId === highlightedHouseholdId}
                          onOpen={(target) => void openDiscoveredLedger(target).catch((caught) => {
                            setError(caught instanceof Error ? caught.message : String(caught));
                          })}
                          actions={environment === "development" ? (
                            <details className="household-entry-card__menu">
                              <summary>Household options</summary>
                              <button className="danger ghost" type="button" disabled={busy} onClick={() => void promptDeleteDiscoveredHousehold(found)}>
                                Delete Development household
                              </button>
                            </details>
                          ) : undefined}
                        />
                      );
                    })}
                  </div>
                  {inviteFlowState === "ready" && <p className="welcome-invite-ready" role="status">Invitation accepted. Choose the highlighted household when you are ready.</p>}
                  <div className="welcome-signed-actions" aria-label="Household actions">
                    <button className="primary" type="button" disabled={busy} onClick={() => { setWelcomeMode("new"); setError(""); }}>
                      Create household
                    </button>
                    <button className="ghost" type="button" disabled={busy} onClick={() => { setWelcomeMode("join"); setError(""); setInviteFlowState(pendingAuthInvite ? "awaiting-google" : "idle"); }}>
                      Join household
                    </button>
                  </div>
                  {environment === "development" && (
                    <details className="welcome-danger-zone">
                      <summary>Development reset tools</summary>
                      <p className="muted" id="start-from-scratch-list">This removes disposable Development households. It is not an opening action.</p>
                      <button className="danger" type="button" aria-describedby="start-from-scratch-list" disabled={busyState} onClick={() => setGuard({ kind: "reset-development" })}>
                        {resetBusy ? "Starting over…" : "Start from scratch"}
                      </button>
                    </details>
                  )}
                  <button className="ghost welcome-sign-out" type="button" onClick={() => signOutWelcomeGoogle()}>
                    Sign out of Google
                  </button>
                </section>
              )}
              <KitchenNotice message={error} onDismiss={() => setError("")} />
              {!welcomeSignedIn && environment === "development" && (
                <button className="ghost welcome-demo" onClick={openDemoTable}>
                  Open the demo kitchen table
                </button>
              )}
              {!welcomeSignedIn && environment === "development" && (
                <details className="welcome-danger-zone">
                  <summary>Development reset tools</summary>
                  <p className="muted" id="start-from-scratch-home">Remove leftover disposable test households only.</p>
                  <button className="danger" type="button" aria-describedby="start-from-scratch-home" disabled={busyState} onClick={() => setGuard({ kind: "reset-development" })}>
                    {resetBusy ? "Starting over…" : "Start from scratch"}
                  </button>
                </details>
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
    const signedOutHouseholdCards = discoveredHouseholdCardModels(discoveredLedgers, now, displayZone);
    const signedOutFoundById = new Map(discoveredLedgers.map((found) => [found.household.householdId, found]));
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
          <div className="welcome-household-grid">
            {signedOutHouseholdCards.map((model) => {
              const found = signedOutFoundById.get(model.householdId);
              if (!found) return null;
              return (
                <HouseholdEntryCard
                  key={model.householdId}
                  model={model}
                  busy={busy}
                  highlighted={model.householdId === highlightedHouseholdId}
                  onOpen={(target) => void openDiscoveredLedger(target).catch((caught) => {
                    setError(caught instanceof Error ? caught.message : String(caught));
                  })}
                />
              );
            })}
          </div>
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
  const shiftPreview = previewShiftAmounts({
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

  const showSwipeAction = view === "household"
    && swipeBelongsOnSharedHome(actorId, household.householdFund?.custodianMemberId);

  const openSwipeIntoAdd = (amount: string, extra?: { subcategoryId?: string; confirm?: NeedsConfirmationError }) => {
    const scopedBooks = experience && experience.ok ? experience.scopedHousehold : household;
    const card = resolveSwipeCardAccount(scopedBooks, actorId);
    const accountId = card.kind === "ready" ? card.accountId : focusedAccountId;
    setSwipeOpen(false);
    setSwipeError("");
    setMode("expense");
    setAdding(true);
    setAddSlide(0);
    setError("");
    setForm(formForAccount(accountId, {
      amount,
      subcategoryId: extra?.subcategoryId ?? defaultSubcategoryForMode("expense"),
      useHouseholdFund: Boolean(household.householdFund),
      fundedAmount: amount,
      fundDestinationAccountId: card.kind === "ready" ? card.accountId : "",
      visibility: "household",
      note: "",
      place: "",
    }));
    if (extra?.confirm) setConfirm(extra.confirm);
    else setConfirm(null);
  };

  const submitSwipePurchase = (amount: string, subcategoryId: string) => {
    setSwipeError("");
    const scopedBooks = experience && experience.ok ? experience.scopedHousehold : household;
    const card = resolveSwipeCardAccount(scopedBooks, actorId);
    if (card.kind !== "ready") {
      openSwipeIntoAdd(amount, { subcategoryId });
      return;
    }
    const fund = household.householdFund;
    lastAmountLabelRef.current = formatCad(parseAmount(amount));
    void run((current) => postEntry(current, {
      date: today,
      type: "expense",
      amount,
      accountId: card.accountId,
      subcategoryId,
      createdBy: actorId,
      visibility: "household",
      splits: jointSplit(parseAmount(amount)),
      funding: fund
        ? { fundId: fund.id, fundedCents: parseAmount(amount), destinationAccountId: card.accountId }
        : undefined,
    }), {
      closeAdd: false,
      onAccepted: (result) => {
        setSwipeError("");
        setSwipeOpen(false);
        if (result.undo) setSwipeStrip({
          token: result.undo,
          environment,
          householdId: result.household.householdId,
          memberId: actorId,
        });
      },
      onConfirm: (error) => {
        openSwipeIntoAdd(amount, { subcategoryId, confirm: error });
        return true;
      },
      onError: (message) => {
        setError("");
        setSwipeError(message);
      },
    });
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
    }
  }

  function leaveDesk() {
    emitOfficeIntent({ type: "collapse" });
    collapseSavedOffice(environment, localStorage);
  }

  function preloadTab(next: Tab) {
    const load = next === "home"
      ? loadOfficeSurface
      : next === "calendar"
        ? loadCalendarSurface
        : next === "shift"
          ? loadWorkShiftSurface
          : next === "ledger"
            ? loadBooksSurface
            : null;
    if (load) void load().catch(() => undefined);
  }

  function goTab(next: Tab) {
    preloadTab(next);
    leaveDesk();
    setTab(next);
    closeAdd();
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (next === "till") url.hash = TILL_HOME_HASH.slice(1);
    else if (url.hash === TILL_HOME_HASH || url.hash === TILL_DESK_HASH) {
      url.hash = next === "home" ? TILL_DESK_HASH.slice(1) : "";
    }
    const rendered = `${url.pathname}${url.search}${url.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (rendered !== current) window.history.replaceState({}, "", rendered);
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

  const openMonthRehearsalTask = (taskId: MonthRehearsalTaskId) => {
    if (taskId === "income") {
      openAddFor(null, "income");
      return;
    }
    if (taskId === "groceries") {
      openAddFor(null, "expense");
      setForm((current) => ({ ...current, note: "Groceries", subcategoryId: "SUB-FOOD-GROCERIES" }));
      return;
    }
    if (taskId === "bills") {
      openAddFor(null, "expense");
      setForm((current) => ({ ...current, note: "Bill", subcategoryId: "SUB-HOUSING-RENT" }));
      return;
    }
    if (taskId === "shared-fund-purchase") {
      openAddFor(null, "expense");
      setForm((current) => ({ ...current, note: "Shared purchase", useHouseholdFund: true }));
      return;
    }
    if (taskId === "card-payment") {
      const card = household.accounts.find((account) => account.active && account.kind === "credit");
      if (card) openPayCard(card);
      else goTab("ledger");
      return;
    }
    // Fund, refund, reconciliation, review, and close already have guarded
    // routes in Books. The rehearsal points there but never confirms for them.
    goTab("ledger");
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

  function submitWorkShift(input: PostWorkShiftInput, confirmDuplicate = false, attendanceReview?: ShiftAttendanceReviewDraft | null) {
    const current = householdRef.current;
    const currentMemberId = sessionRef.current?.memberId;
    const shiftConfirmationId = confirmationRef.current ?? newConfirmationId();
    if (!confirmationRef.current) confirmationRef.current = shiftConfirmationId;
    const pending = confirmDuplicate
      ? workShiftInputRef.current
      : current && currentMemberId
        ? {
            input: { ...input, confirmationId: shiftConfirmationId },
            environment: current.environment,
            householdId: current.householdId,
            memberId: currentMemberId,
            attendanceReview,
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
          (safeInput, safeAttendanceReview) => postWorkShiftWithAttendanceReview(live, safeInput, safeAttendanceReview),
        );
      } catch (caught) {
        workShiftInputRef.current = null;
        throw caught;
      }
    });
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
    <div className="app" data-ledger-mode={view} data-ledger-tab={tab} data-books-readiness={booksReadiness.phase}>
      {charterFoundingVisible && household && session ? (
        <CharterFounding
          household={household}
          memberId={session.memberId}
          today={today}
          busy={busy}
          onCommit={(fn) => { void run(fn); }}
          onDismiss={() => setCharterFoundingOpen(false)}
        />
      ) : null}
      {onboardingInviteVisible && household && session ? (
        <OnboardingChat
          household={household}
          memberId={session.memberId}
          today={today}
          busy={busy}
          now={now.toISOString()}
          onCommit={(fn) => { void run(fn); }}
          onDismiss={() => setOnboardingInviteDismissedState(onboardingInviteRecord?.state ?? null)}
        />
      ) : null}
      {charterPageVisible && household && session ? (
        <Charter
          household={household}
          memberId={session.memberId}
          busy={busy}
          onCommit={(fn) => { void run(fn); }}
          onDismiss={() => setCharterPageOpen(false)}
        />
      ) : null}
      <div className="app-shell" inert={charterTakeoverVisible || undefined}>
      <header className="topbar">
        <div className="brand">
          <img src="/hercules-mark.svg" alt="" />
          <div>
            <h1>Hearth</h1>
            <p className="brand__identity" aria-label="Current member, household, and device time">
              <span>{household.members.find((member) => member.id === session.memberId)?.name ?? "Member"}</span>
              {" · "}
              <span>{household.name}</span>
              {" · "}
              <time dateTime={now.toISOString()}>{formatZoneDateTime(now, displayZone)}</time>
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
          if (syncFreshnessDisplay.actionKind === "reconnect-auth") reconnectContinuityAuth();
          else void retryShareNow();
        }}
      />
      {!activeBooksGate.ready && (
        <div
          className={`command-banner command-banner--${booksReadiness.phase === "blocked" ? "danger" : "warning"}`}
          role={booksReadiness.phase === "blocked" ? "alert" : "status"}
          aria-live="polite"
          data-books-validation-status
        >
          <div>
            <strong>{booksReadiness.phase === "blocked" ? "Books need attention" : "Validating the local journal…"}</strong>
            <p className="muted">{activeBooksGate.reason}</p>
          </div>
          {booksReadiness.phase === "blocked" && (
            <div className="command-banner__actions">
              {cloudLedgerOnlineRequiredEnabled(environment)
                && !listContinuityOutbox(environment).some((item) => item.householdId === household.householdId)
                && unresolvedConflicts(household).length === 0 && (
                <button
                  type="button"
                  className="ghost command-banner__action"
                  disabled={busyState}
                  onClick={() => { void restoreBooksFromCloudCopy(); }}
                >
                  {busyState ? "Restoring…" : "Restore from cloud copy"}
                </button>
              )}
              <button
                type="button"
                className="ghost command-banner__action"
                onClick={() => setValidationAttempt((attempt) => attempt + 1)}
              >
                Retry validation
              </button>
            </div>
          )}
        </div>
      )}
      {error && !adding && !swipeOpen ? (
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
        <details className="ledger-switcher">
          <summary>Switch household</summary>
          <p className="muted">Households available on this device. Google membership remains the authority for hosted access.</p>
          <div className="ledger-switcher__grid">
            {replicaHouseholdCardModels(replicas, now, displayZone).map((model) => (
              <HouseholdEntryCard
                key={model.householdId}
                model={model}
                busy={busy}
                current={model.householdId === household.householdId}
                onOpen={(target) => void switchLedger(target.householdId)}
              />
            ))}
          </div>
        </details>
      )}
      <div className="view-switch" role="tablist" aria-label="Ledger view">
        {(["household", "personal"] as LedgerView[]).map((item) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            aria-selected={view === item}
            onClick={() => {
              if (item === "household" && tab === "shift") goTab("home");
              if (item !== "household" && tab === "till") goTab("home");
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

      {tab === "till" && view === "household" && experience && experience.ok ? (
        <Till
          household={experience.scopedHousehold}
          memberId={actorId}
          today={today}
          busy={busy}
          showSwipe={showSwipeAction}
          offlinePending={offline && (household.sharing?.mode === "pending-transport" || Boolean(swipeStrip))}
          homeHref={TILL_DESK_HASH}
          strip={swipeStrip && swipeUndoScopeMatches(swipeStrip, environment, household.householdId, actorId) ? (
            <div className="swipe-strip" role="status">
              <span>{SWIPE_COPY.success}</span>
              <button
                type="button"
                className="swipe-strip-undo"
                disabled={busy}
                onClick={() => void applyUndo(swipeStrip.token, swipeStrip)}
              >
                {SWIPE_COPY.undo}
              </button>
            </div>
          ) : null}
          onOpenSwipe={() => { setAdding(false); setError(""); setSwipeError(""); setSwipeOpen(true); }}
          onSeeEverything={() => goTab("home")}
          onCommand={(command) => { void run(command); }}
        />
      ) : null}

      {tab === "home" && dashboard && (
        <>
        {view === "household" ? (
          <p className="till-home-door">
            <a
              href={TILL_HOME_HASH}
              data-till-home-door="true"
              onClick={(event) => {
                event.preventDefault();
                goTab("till");
              }}
            >
              {TILL_COPY.homeDoor}
            </a>
          </p>
        ) : null}
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
        {view === "household" ? (
          <MonthRehearsalPanel
            household={household}
            memberId={session.memberId}
            today={today}
            surface="home"
            onApply={(next, token, confirmationId) => persistLedgerWrite(preserveCurrentPersonal(next), token, confirmationId)}
            onOpenTask={openMonthRehearsalTask}
          />
        ) : null}
        <DeferredSurface label="Office">
        <DeferredOffice
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
          adding={adding || swipeOpen}
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
          onOpenRegister={() => {
            setBooksPaneRequest("fund-register");
            goTab("ledger");
          }}
          onGo={(next) => {
            if (next === "add") {
              openAddFor(null);
              return;
            }
            goTab(next);
          }}
        />
        </DeferredSurface>
        </>
      )}

      {tab === "plan" && dashboard && (
        <>
          {onboardingCategoriesOnly ? (
            <div className="plan-wide onboarding-plan-focus">
              <OnboardingCategories
                household={household}
                memberId={memberId}
                busy={busy}
                onCommit={(fn) => { void runKitchen(fn); }}
              />
            </div>
          ) : onboardingEstimatesOnly ? (
            <div className="plan-wide onboarding-plan-focus">
              <OnboardingEstimates
                household={household}
                memberId={memberId}
                busy={busy}
                onCommit={(fn) => { void runKitchen(fn); }}
              />
            </div>
          ) : (
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
          )}
        </>
      )}

      {tab === "calendar" && (
        <DeferredSurface label="Calendar">
        <DeferredCalendarPage
          household={displayHousehold}
          view={view}
          today={today}
          environment={environment}
          memberId={session.memberId}
          busy={busy}
          onboardingStandingFactOnly={onboardingStandingFactOnly}
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
          onOpenShiftEnvelope={(envelopeId) => {
            requestShiftEnvelope(envelopeId);
            goTab("shift");
          }}
        />
        </DeferredSurface>
      )}

      {tab === "shift" && (
        <DeferredSurface label="Shift room">
        <DeferredWorkShiftPage
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
          onConfirmShift={(input, attendanceReview) => submitWorkShift(input, false, attendanceReview)}
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
          onImportCoworkers={(input) => {
            void run((current) => importCoworkerRoster(current, {
              ownerMemberId: session.memberId,
              ...input,
            }));
          }}
          onConfirmEnvelopeOutcome={(envelopeId, outcome) => {
            const confirmationId = newConfirmationId();
            confirmationRef.current = confirmationId;
            void run((current) => confirmShiftEnvelopeOutcome(current, {
              memberId: session.memberId,
              envelopeId,
              outcome,
              confirmationId,
              createdBy: actorId,
            }));
          }}
          onRefreshShiftEnvelopes={(proposals) => {
            void run((current) => refreshShiftEnvelopesFromEvidence(current, {
              memberId: session.memberId,
              createdBy: actorId,
              proposals,
            }));
          }}
          onboardingCadenceOnly={onboardingCadenceOnly}
          onRecordEarningCadence={(paySchedule: WorkPaySchedule) => {
            void run((current) => recordEarningCadence(current, {
              memberId: session.memberId,
              createdBy: actorId,
              paySchedule,
              detailAction: "skip",
            }));
          }}
        />
        </DeferredSurface>
      )}

      {tab === "ledger" && (
        <DeferredSurface label="Books">
        <DeferredBooksPage
          household={displayHousehold}
          booksHousehold={household}
          memberId={session.memberId}
          view={view}
          booksStatus={booksStatus}
          focusedAccountId={focusedAccountId}
          sourceFocus={herculesSourceFocus}
          onFocusAccount={setFocusedAccountId}
          onClearSource={() => setHerculesSourceFocus(null)}
          onChange={(next, token, confirmationId) => persistLedgerWrite(preserveCurrentPersonal(next), token, confirmationId)}
          onCommand={(command) => { void run(command); }}
          onPayAccount={openPayCard}
          onAddToAccount={(account) => openAddFor(account)}
          onGoMore={() => goTab("more")}
          requestedPane={booksPaneRequest}
          onConsumeRequestedPane={() => setBooksPaneRequest(null)}
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
        </DeferredSurface>
      )}

      {tab === "more" && (
        <>
          {view === "household" ? (
            <section className="card">
              <header><h2>the charter</h2></header>
              <p className="muted">
                {household.charter
                  ? "The household agreement."
                  : "Found the household agreement in a few questions. Skip anything you do not want to decide yet."}
              </p>
              <button
                className="primary"
                type="button"
                aria-label={household.charter ? "Open the charter" : "Found the charter"}
                onClick={() => {
                  if (household.charter) setCharterPageOpen(true);
                  else setCharterFoundingOpen(true);
                }}
              >
                the charter
              </button>
            </section>
          ) : null}
          {view === "household" ? (
            <MonthRehearsalPanel
              household={household}
              memberId={session.memberId}
              today={today}
              surface="manage"
              onApply={(next, token, confirmationId) => persistLedgerWrite(preserveCurrentPersonal(next), token, confirmationId)}
              onOpenTask={openMonthRehearsalTask}
            />
          ) : null}
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
                disabled={busyState}
                onClick={() => setGuard({ kind: "reset-development" })}
              >
                {resetBusy ? "Starting over…" : "Start from scratch"}
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
          <DeferredSurface label="Pairing">
          <DeferredPairingCard
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
            onCopySyncDiagnostic={syncPilotDiagnosticsEnabled(environment) ? copyPilotSyncDiagnostic : undefined}
            onStartSyncDiagnostic={syncPilotDiagnosticsEnabled(environment) ? startPilotSyncDiagnostic : undefined}
            onCopySyncClockCalibration={syncPilotDiagnosticsEnabled(environment) ? copyPilotClockCalibration : undefined}
            onLeaveHousehold={async () => {
              await removeHouseholdFromDevice({
                householdId: household.householdId,
                memberId: session.memberId,
                role: isHouseholdOwner ? "owner" : "member",
                name: household.name,
                mode: "leave",
              });
            }}
            onCurrentDeviceRevoked={() => {
              traceSyncPilot("auth-blocked", { household, transport: "outbox" });
              clearContinuityOutboxForHousehold(environment, household.householdId);
              void clearStagedHouseholdBooks(environment, household.householdId);
              clearSupabaseSession(environment);
              setSyncState("error");
            }}
          />
          </DeferredSurface>
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
            disabled={!activeBooksGate.ready}
            onChangeRequested={async (permissions) => {
              const expectedScopeGeneration = replicaScopeGenerationRef.current;
              const outcome = await enqueueWrite(async () => {
                if (replicaScopeGenerationRef.current !== expectedScopeGeneration) return null;
                if (!booksGateRef.current.ready) {
                  throw new Error(booksGateRef.current.reason || "The local journal is still validating.");
                }
                const current = householdRef.current;
                if (!current) throw new Error("Open your household before changing Hercules Pro permissions.");
                const result = setHerculesProPermissions(current, {
                  memberId: session.memberId,
                  createdBy: session.memberId,
                  personalWrite: permissions.personalWrite,
                  householdWrite: permissions.householdWrite,
                });
                assertMemberPersonalUpdate(current, result);
                if (result.household === current) return { unchanged: current.herculesProPermissions } as const;
                return commitHousehold(result.household, result.undo, result.personalMemberId, { forceFlush: true });
              });
              if (outcome && "unchanged" in outcome) {
                return outcome.unchanged ?? { ...permissions, updatedAt: null };
              }
              if (!outcome?.ok || outcome.kind !== "synchronized") {
                throw new Error(outcome?.userMessage || "Hercules Pro permissions were not accepted by the cloud.");
              }
              const accepted = personalReplicaForMember(outcome.household, session.memberId);
              setPersonalReplica(accepted);
              return accepted.herculesProPermissions ?? { ...permissions, updatedAt: null };
            }}
          />
          <section className="card">
            <header><h2>This phone</h2></header>
            <p className="muted">
              You are {household.members.find((member) => member.id === session.memberId)?.name}.
              {supabaseAuthEnabled()
                ? " Google Auth locks this phone to that member; household and personal views remain presentation scopes."
                : " Household vs personal is a filter, not a lock."}
            </p>
            {supabaseAuthEnabled() ? (
              <p className="muted">
                To use a different member identity, sign out and Continue with that person&apos;s Google account.
              </p>
            ) : (
              <>
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
              </>
            )}
            <p className="muted" style={{ marginTop: 12 }}>
              Sign out clears Google and Auth tokens on this phone only. The cloud household stays.
              Native Keychain storage is a later release note — web builds keep tokens in localStorage until then.
            </p>
            <button
              className="ghost"
              style={{ width: "100%", marginTop: 8 }}
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
            {environment === "development" && (
              <div className="paper-panel" style={{ marginTop: 12, padding: 12 }} data-testid="demo-suite-panel">
                <p className="kicker">Synthetic Demo Suite</p>
                <p className="muted" style={{ marginTop: 4 }}>
                  A dedicated, visibly fictional household for Hercules Pro. Every run has a replay seed; schedule mail stays proposal-only until Confirm.
                </p>
                {household.syntheticFixture?.kind === "hearth-demo-suite" ? (
                  <p style={{ margin: "8px 0 0" }}><strong>Seed {household.syntheticFixture.seed}</strong> · generator {household.syntheticFixture.version}</p>
                ) : (
                  <p className="muted" style={{ margin: "8px 0 0" }}>Your current books will stay here. Demo Suite creates another household.</p>
                )}
                <label htmlFor="demo-suite-seed" style={{ marginTop: 10 }}>Replay seed</label>
                <input
                  id="demo-suite-seed"
                  inputMode="numeric"
                  value={demoSeed}
                  placeholder="Fresh seed"
                  onChange={(event) => setDemoSeed(event.target.value.replace(/\D/g, "").slice(0, 10))}
                />
                <div className="button-row demo-suite-actions" style={{ marginTop: 8 }}>
                  <button className="primary" disabled={busy} onClick={() => setGuard({ kind: "demo-suite", seed: freshDemoSeed() })}>Fresh showcase</button>
                  <button className="ghost" disabled={busy || !demoSeed} onClick={() => setGuard({ kind: "demo-suite", seed: Number(demoSeed) >>> 0 })}>Replay seed</button>
                  {household.syntheticFixture?.kind === "hearth-demo-suite" && (
                    <button className="ghost" disabled={busy} onClick={() => {
                      void (async () => {
                        setBusy(true);
                        try {
                          setDemoReport(await verifyDemoSuite(household));
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : String(caught));
                        } finally {
                          setBusy(false);
                        }
                      })();
                    }}>Verify now</button>
                  )}
                </div>
                {demoReport && (
                  <div className="muted" style={{ marginTop: 10 }} data-testid="demo-suite-report" role="status" aria-live="polite">
                    <strong>{demoReport.verifiedRevision !== household.revision ? "Not verified after books changed" : demoReport.status === "ready" ? "Ready" : "Not ready"}</strong> · {demoReport.checks.filter((row) => row.status === "pass").length}/{demoReport.checks.length} gates · {demoReport.tools.filter((row) => row.status !== "unavailable").length}/{demoReport.tools.length} Hercules calculations
                    <br />Attestation <code>{demoReport.attestationSha256.slice(0, 16)}…</code> · seed {demoReport.seed}
                    {demoReport.verifiedRevision !== household.revision && (
                      <ul className="demo-suite-failures">
                        <li><strong>Books changed:</strong> use Verify now to compare every generated fact with the seed again.</li>
                      </ul>
                    )}
                    {demoReport.checks.some((row) => row.status === "fail") && (
                      <ul className="demo-suite-failures">
                        {demoReport.checks.filter((row) => row.status === "fail").map((row) => (
                          <li key={row.id}><strong>{row.label}:</strong> {row.detail}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
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

      {swipeOpen && experience && experience.ok ? (
        <Swipe
          household={experience.scopedHousehold}
          memberId={actorId}
          today={today}
          busy={busy}
          error={swipeError}
          onClose={() => { setSwipeError(""); setSwipeOpen(false); }}
          onPostCategory={({ amount, subcategoryId }) => submitSwipePurchase(amount, subcategoryId)}
          onMore={(amount) => openSwipeIntoAdd(amount)}
        />
      ) : null}

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
              <DeferredSurface label="Tip sheet camera">
              <DeferredShiftReportScanBar
                busy={busy}
                scanBusy={shiftScanBusy}
                error={shiftScanError}
                onFile={(file) => { void applyShiftReportScan(file); }}
              />
              </DeferredSurface>
              <DeferredSurface label="Timesheet">
              <DeferredWorkShiftWithSevenShifts
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
              </DeferredSurface>
            </>
          )}
          shiftPreview={shiftPreview}
          onHoursDirty={() => setHoursDirty(true)}
          hoursDirty={hoursDirty}
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
          onCancel={() => setGuard(null)}
          onConfirm={clearThisPhoneNow}
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
                changeEnvironment(next);
                setHistory([]);
                setToast(null);
                setSwipeOpen(false);
                setSwipeError("");
                setSwipeStrip(null);
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
      {environment === "development" && guard?.kind === "demo-suite" && (
        <ConfirmSheet
          title={household.syntheticFixture?.kind === "hearth-demo-suite" ? "Replace this synthetic showcase?" : "Create a dedicated synthetic showcase?"}
          body={`Seed ${guard.seed} creates twelve months of fictional CAD, shifts, schedules, Evidence envelopes, bills, appointments, claims, goals, Fund plans, reconciliations, and audit coverage. Your ordinary Development household is not replaced. On an existing synthetic showcase, only that showcase is regenerated. Schedule and Evidence rows do not post money.`}
          extra={googleStepUpExtra}
          confirmLabel="Generate & verify"
          busy={busy}
          onCancel={() => setGuard(null)}
          onConfirm={() => {
            const seed = guard.seed;
            void (async () => {
              setBusy(true);
              try {
                setGuard(null);
                await createOrReplayDemoSuite(seed);
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
            void run((current) => shift.shiftBible
              ? beginShiftBibleCorrection(current, transactionId, { createdBy: actorId })
              : reversePostedMoney(current, transactionId, { createdBy: actorId }))
              .then(() => {
                if (shift.shiftBible) {
                  requestShiftEnvelope(shift.shiftBible.envelopeId);
                  window.dispatchEvent(new Event("hearth:shift-envelope-intent"));
                } else beginFinishedShift(shift.date);
              });
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
          title={onboardingStandingFactOnly
            ? guard.draft.id ? "Save standing-fact changes?" : "Save this standing fact?"
            : guard.draft.id ? "Save repeating changes?" : "Save repeating item?"}
          body={guard.summary}
          extra={onboardingStandingFactOnly
            ? copy("recurrences.form-explain")
            : "Unchecked = reminder only. Checked = also post this occurrence into the books, then advance the next date."}
          confirmLabel={onboardingStandingFactOnly
            ? copy("recurrences.save")
            : saveRepeatingPostFirst ? "Save and post" : "Save reminder"}
          busy={busy}
          option={onboardingStandingFactOnly ? undefined : {
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
            const postFirst = onboardingStandingFactOnly ? false : saveRepeatingPostFirst;
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
              ...(view === "household" ? [{ label: "Till", run: () => goTab("till") }] : []),
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

      {!charterTakeoverVisible ? (
      <HerculesPresence
        household={experience && experience.ok ? experience.herculesHousehold : displayHousehold}
        today={today}
        tab={presenceTab(tab)}
        adding={adding || swipeOpen}
        visorPop={visorPop}
        spark={spark}
        activityBlocked={Boolean(adding || swipeOpen || confirm || guard || commandOpen)}
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
        onOpenCharter={() => {
          if (household.charter) setCharterPageOpen(true);
          else setCharterFoundingOpen(true);
        }}
        onOpenAccounts={() => {
          rememberSession({ memberId: session.memberId, view: "personal", householdId: household.householdId });
          setFocusedAccountId(null);
          setBooksPaneRequest("wallet");
          goTab("ledger");
        }}
        onOpenOpeningBalances={(mode) => {
          rememberSession({ memberId: session.memberId, view: "household", householdId: household.householdId });
          setFocusedAccountId(null);
          setBooksPaneRequest(mode === "entry" ? "opening" : "register");
          goTab("ledger");
        }}
        onOpenHouseholdFund={() => {
          rememberSession({ memberId: session.memberId, view: "household", householdId: household.householdId });
          setFocusedAccountId(null);
          setBooksPaneRequest("fund");
          goTab("ledger");
        }}
        onOpenRecurrences={() => {
          rememberSession({ memberId: session.memberId, view: "household", householdId: household.householdId });
          requestCalendarPane("bills", localStorage);
          goTab("calendar");
        }}
        onOpenEarningCadence={() => {
          rememberSession({ memberId: session.memberId, view: "household", householdId: household.householdId });
          goTab("shift");
        }}
        onOpenCategories={() => {
          rememberSession({ memberId: session.memberId, view: "household", householdId: household.householdId });
          goTab("plan");
        }}
        onOpenEstimates={() => {
          rememberSession({ memberId: session.memberId, view: "household", householdId: household.householdId });
          goTab("plan");
        }}
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
      ) : null}

      <HerculesProApproval
        authorizationRequest={herculesProRequest}
        environment={environment}
        household={household}
        session={session}
      />

      {!charterTakeoverVisible ? (
      <nav className={`nav${fabOpen ? " is-fab-open" : ""}`} data-ledger-nav={view === "household" ? "shared" : "personal"} aria-label="Hearth">
        {kitchenPrimaryNav(view).includes("home") && (
        <button
          className={tab === "home" && !adding ? "active" : ""}
          aria-current={tab === "home" && !adding ? "page" : undefined}
          onPointerEnter={() => preloadTab("home")}
          onFocus={() => preloadTab("home")}
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
          onPointerEnter={() => preloadTab("calendar")}
          onFocus={() => preloadTab("calendar")}
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
          onPointerEnter={() => preloadTab("shift")}
          onFocus={() => preloadTab("shift")}
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
          onPointerEnter={() => preloadTab("ledger")}
          onFocus={() => preloadTab("ledger")}
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
      ) : null}
      </div>
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
