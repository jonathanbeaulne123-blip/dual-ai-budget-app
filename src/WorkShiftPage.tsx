import { useEffect, useMemo, useRef, useState } from "react";
import {
  activeOpenShift,
  formatCad,
  formatMonthLabel,
  monthKeyFromDateKey,
  readTorontoWeather,
  shiftClimateSeals,
  shiftFloorOracle,
  shiftLivePreview,
  shiftPostingStreak,
  shiftReportGlance,
  shiftSaucerBoard,
  type Environment,
  type Household,
  type PostWorkShiftInput,
  type Shift,
  type ShiftEnvelope,
  type ShiftOutcome,
  type WeatherGlass,
  type WorkJob,
  statusForEnvelopeAt,
  takeShiftEnvelopeIntent,
  historicalWeatherGlass,
  readHistoricalShiftWeather,
  pendingHistoricalWeather,
  workShiftTransactionIds,
} from "./core/index.ts";
import { loadDocumentVisionProvider } from "./imports/documentScanProvider.ts";
import { scanShiftReportFile } from "./imports/shiftReportDraft.ts";
import { ShiftReportScanBar } from "./ShiftReportScan.tsx";
import { PaperTile } from "./theme/PaperTheme.tsx";
import { TimesheetBody } from "./widgets/Timesheet.tsx";
import { WorkJobsCard } from "./WorkJobs.tsx";
import { WorkReportCard, downloadWorkReportCsv } from "./WorkReport.tsx";
import type { WorkShiftDraft } from "./WorkShiftFlow.tsx";
import { WorkShiftWithSevenShifts } from "./WorkShiftWithSevenShifts.tsx";
import { WorkShiftHistoryCard } from "./WorkShiftHistory.tsx";
import { SevenShiftsEvidenceCenter } from "./SevenShiftsEvidenceCenter.tsx";
import { createShiftScanScope } from "./shiftScanScope.ts";
import type { ApprovedPunchShiftDraft } from "./imports/evidenceShiftDraft.ts";
import { listEvidence, readEvidenceDerived } from "./imports/evidenceClient.ts";
import { evidenceEnvelopeProposals } from "./imports/evidenceEnvelopeDraft.ts";

type ShiftPane = "today" | "report" | "jobs" | "evidence";

const ENVELOPE_STATUS_LABEL: Record<ShiftEnvelope["status"], string> = {
  upcoming: "Upcoming",
  picked_up: "Picked up",
  traded_away: "Traded away",
  cut: "Cut",
  called_off: "Called off",
  awaiting_punch: "Awaiting 7shifts",
  worked_ready: "Worked — needs Confirm",
  needs_review: "Changed — needs review",
  confirmed: "Confirmed worked",
  corrected: "Corrected",
};

function LoafMark() {
  return (
    <svg className="shift-loaf" viewBox="0 0 28 28" aria-hidden="true">
      <ellipse cx="14" cy="20" rx="10" ry="5.5" fill="currentColor" opacity="0.12" />
      <path
        d="M7 17c0-5 3-9 7-9s7 4 7 9c0 3-2.4 5-7 5s-7-2-7-5z"
        fill="#f7f1e8"
        stroke="currentColor"
        strokeWidth="1.2"
      />
      <path d="M11 9.2c-.2-2.2 1.4-3.8 2.8-3.2.4 1.4-.4 2.8-1.6 3.4zM17 9.2c.2-2.2-1.4-3.8-2.8-3.2-.4 1.4.4 2.8 1.6 3.4z" fill="#f7f1e8" stroke="currentColor" strokeWidth="1.1" />
      <circle cx="12.2" cy="16.2" r="0.7" fill="currentColor" />
      <circle cx="15.8" cy="16.2" r="0.7" fill="currentColor" />
    </svg>
  );
}

function FloorLampRings() {
  return (
    <svg className="shift-rings" viewBox="0 0 118 118" aria-hidden="true">
      <path d="M18 92 A 41 41 0 0 1 100 92" fill="none" stroke="#c45c26" strokeWidth="11" strokeLinecap="round" opacity="0.38" />
      <path d="M30 86 A 29 29 0 0 1 88 86" fill="none" stroke="#a8895c" strokeWidth="10" strokeLinecap="round" opacity="0.58" />
      <path d="M44 80 A 16 16 0 0 1 74 80" fill="none" stroke="#2c6a4e" strokeWidth="9" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export function WorkShiftPage({
  household,
  memberId,
  memberName,
  today,
  environment,
  busy,
  onClockIn,
  onAbandon,
  onStartBreak,
  onEndBreak,
  onChooseTimeline,
  onClockOut,
  onConfirmShift,
  duplicateConfirm = null,
  onConfirmAnyway,
  onDismissDuplicate,
  onCorrect,
  onAskSaveJob,
  onArchiveJob,
  onOpenCalendar,
  onSaveSevenShiftsSchedule = () => undefined,
  onImportCoworkers,
  onConfirmEnvelopeOutcome,
  onRefreshShiftEnvelopes,
}: {
  household: Household;
  memberId: string;
  memberName: string;
  today: string;
  environment: Environment;
  busy: boolean;
  onClockIn: () => void;
  onAbandon: () => void;
  onStartBreak: (kind: "paid" | "unpaid" | "custom") => void;
  onEndBreak: () => void;
  onChooseTimeline: (openShiftId: string) => void;
  onClockOut: () => void;
  onConfirmShift: (input: PostWorkShiftInput, attendanceReview?: import("./core/index.ts").ShiftAttendanceReviewDraft | null) => void;
  duplicateConfirm?: { message: string } | null;
  onConfirmAnyway?: () => void;
  onDismissDuplicate?: () => void;
  onCorrect: (shift: Shift, transactionId: string) => void;
  onAskSaveJob: (job: WorkJob, summary: string) => void;
  onArchiveJob: (jobId: string) => void;
  onOpenCalendar: () => void;
  onSaveSevenShiftsSchedule?: (rows: import("./core/index.ts").SevenShiftsScheduledShift[], confirmedPersonalFeed?: boolean) => void;
  onImportCoworkers?: (input: import("./imports/coworkerRosterDraft.ts").CoworkerRosterImportDraft) => void;
  onConfirmEnvelopeOutcome?: (envelopeId: string, outcome: Exclude<ShiftOutcome, "worked">) => void;
  onRefreshShiftEnvelopes?: (proposals: import("./core/index.ts").ShiftEnvelopeEvidenceProposal[]) => void;
}) {
  const [pane, setPane] = useState<ShiftPane>("today");
  const [sealCaption, setSealCaption] = useState<string | null>(null);
  const [period, setPeriod] = useState<"month" | "all">("month");
  const [breakdown, setBreakdown] = useState(false);
  const [weatherGlass, setWeatherGlass] = useState<WeatherGlass | undefined>(undefined);
  const [finishedReview, setFinishedReview] = useState(false);
  const [shiftsWhenReviewOpened, setShiftsWhenReviewOpened] = useState(0);
  const [workShiftDraft, setWorkShiftDraft] = useState<WorkShiftDraft | null>(null);
  const [shiftScanBusy, setShiftScanBusy] = useState(false);
  const [shiftScanError, setShiftScanError] = useState("");
  const [shiftScanWarnings, setShiftScanWarnings] = useState<string[]>([]);
  const [selectedEnvelopeId, setSelectedEnvelopeId] = useState<string | null>(null);
  const [mailRefreshBusy, setMailRefreshBusy] = useState(false);
  const [mailRefreshMessage, setMailRefreshMessage] = useState("");
  const shiftScanScopeRef = useRef(createShiftScanScope());
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const punch = useMemo(() => activeOpenShift(household.kitchen, memberId), [household.kitchen, memberId]);
  const reviewing = punch?.status === "confirming" || finishedReview;
  const envelopes = useMemo(() => (household.shiftEnvelopes ?? [])
    .filter((row) => row.memberId === memberId)
    .map((row) => ({ ...row, status: statusForEnvelopeAt(row) }))
    .sort((left, right) => left.scheduledStart.localeCompare(right.scheduledStart)), [household.shiftEnvelopes, memberId]);
  const selectedEnvelope = envelopes.find((row) => row.id === selectedEnvelopeId) ?? null;
  const pendingEnvelopeCount = envelopes.filter((row) => !["confirmed", "corrected"].includes(row.status)).length;

  useEffect(() => {
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    void readTorontoWeather({ environment, today, storage }).then((reading) => {
      setWeatherGlass(reading.glass);
    });
  }, [environment, today]);

  useEffect(() => () => shiftScanScopeRef.current.cancel(), []);

  useEffect(() => {
    const takeIntent = () => {
      const envelopeId = takeShiftEnvelopeIntent();
      if (!envelopeId || !envelopes.some((row) => row.id === envelopeId)) return;
      setSelectedEnvelopeId(envelopeId);
    };
    takeIntent();
    window.addEventListener("hearth:shift-envelope-intent", takeIntent);
    return () => window.removeEventListener("hearth:shift-envelope-intent", takeIntent);
  }, [envelopes]);

  async function refreshShiftMail() {
    if (!onRefreshShiftEnvelopes || mailRefreshBusy) return;
    setMailRefreshBusy(true);
    setMailRefreshMessage("");
    try {
      const scope = { environment, householdId: household.householdId, memberId };
      const captures = (await listEvidence(scope)).filter((row) => ["ready_to_review", "bundled"].includes(row.state)).slice(0, 100);
      const results = await Promise.allSettled(captures.map((row) => readEvidenceDerived(scope, row.evidenceId)));
      const proposals = evidenceEnvelopeProposals(results.flatMap((row) => row.status === "fulfilled" ? [row.value] : []), household.workJobs);
      const stamp = proposals.map((row) => `${row.kind}:${row.canonicalShiftKey}:${row.observedAt}`).sort().join("|");
      const stampKey = `hearth:shift-mail-refresh:${environment}:${household.householdId}:${memberId}`;
      if (proposals.length && sessionStorage.getItem(stampKey) !== stamp) {
        onRefreshShiftEnvelopes(proposals);
        sessionStorage.setItem(stampKey, stamp);
      }
      setMailRefreshMessage(proposals.length ? `${proposals.length} bounded 7shifts update${proposals.length === 1 ? "" : "s"} checked.` : "No new mapped 7shifts shifts yet.");
    } catch (caught) {
      setMailRefreshMessage(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setMailRefreshBusy(false);
    }
  }

  useEffect(() => {
    if (!onRefreshShiftEnvelopes) return;
    const wake = () => { void refreshShiftMail(); };
    wake();
    window.addEventListener("online", wake);
    window.addEventListener("focus", wake);
    const timer = window.setInterval(wake, 15 * 60_000);
    return () => { window.removeEventListener("online", wake); window.removeEventListener("focus", wake); window.clearInterval(timer); };
  // Refresh only when the authenticated member scope changes; ordinary household commits must not create a polling loop.
  }, [environment, household.householdId, memberId]);

  const preview = useMemo(
    () => shiftLivePreview(household, today, { memberId, weatherGlass }),
    [household, today, memberId, weatherGlass],
  );
  const climate = useMemo(
    () => shiftClimateSeals(household, today, {
      memberId,
      weatherGlass,
      onClock: Boolean(preview),
    }),
    [household, today, memberId, weatherGlass, preview],
  );
  const saucers = useMemo(() => shiftSaucerBoard(household, today, memberId), [household, today, memberId]);
  const oracle = useMemo(() => shiftFloorOracle(household, today, memberId), [household, today, memberId]);
  const report = useMemo(() => shiftReportGlance(household, today, memberId, period), [household, today, memberId, period]);

  useEffect(() => {
    if (reviewing) return;
    clearScanDraft();
  }, [reviewing]);

  useEffect(() => {
    if (!finishedReview) return;
    const count = household.shifts.filter((shift) => shift.memberId === memberId).length;
    if (count > shiftsWhenReviewOpened) {
      setFinishedReview(false);
      clearScanDraft();
    }
  }, [finishedReview, household.shifts, memberId, shiftsWhenReviewOpened]);

  async function applyScan(file: File | undefined) {
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

  function clearScanDraft() {
    shiftScanScopeRef.current.cancel();
    setWorkShiftDraft(null);
    setShiftScanBusy(false);
    setShiftScanWarnings([]);
    setShiftScanError("");
  }

  function openWorkedEnvelope(envelope: ShiftEnvelope) {
    if (!envelope.actualStart || !envelope.actualEnd || envelope.workedMinutes == null || !envelope.jobId || !envelope.roleId) return;
    shiftScanScopeRef.current.cancel();
    const job = household.workJobs.find((row) => row.id === envelope.jobId && row.memberId === memberId);
    const draft: WorkShiftDraft = {
      sourceKind: "shift-envelope",
      sourceLabel: "the autonomous 7shifts envelope",
      date: envelope.date,
      jobId: envelope.jobId,
      roleId: envelope.roleId,
      startedAt: envelope.actualStart,
      endedAt: envelope.actualEnd,
      workedHours: envelope.workedMinutes / 60,
      paidBreakHours: envelope.paidBreakMinutes == null ? undefined : envelope.paidBreakMinutes / 60,
      unpaidBreakHours: envelope.unpaidBreakMinutes == null ? undefined : envelope.unpaidBreakMinutes / 60,
      shiftEnvelopeId: envelope.id,
      shiftBibleDraft: {
        envelopeId: envelope.id,
        scheduledStart: envelope.scheduledStart,
        scheduledEnd: envelope.scheduledEnd,
        unpaidBreakMinutes: envelope.unpaidBreakMinutes,
        approvalState: envelope.approvalState,
        authority: envelope.authority,
        weather: pendingHistoricalWeather({
          latitude: job?.locationLatitude ?? null,
          longitude: job?.locationLongitude ?? null,
          startedAt: envelope.actualStart,
          endedAt: envelope.actualEnd,
        }),
        correctionOfBibleId: envelope.confirmedBibleId,
      },
    };
    setWorkShiftDraft(draft);
    setShiftScanWarnings([
      "7shifts supplied worked time. Tips, sales, restaurant covers, and floor headcount remain blank until explicitly scanned or entered.",
    ]);
    setShiftScanError("");
    setShiftsWhenReviewOpened(household.shifts.filter((shift) => shift.memberId === memberId).length);
    setFinishedReview(true);
    setSelectedEnvelopeId(envelope.id);
    void readHistoricalShiftWeather({
      latitude: job?.locationLatitude,
      longitude: job?.locationLongitude,
      startedAt: envelope.actualStart,
      endedAt: envelope.actualEnd,
    }).then((weather) => {
      setWorkShiftDraft((current) => current?.shiftEnvelopeId === envelope.id ? {
        ...current,
        weatherGlass: historicalWeatherGlass(weather) ?? current.weatherGlass,
        shiftBibleDraft: current.shiftBibleDraft ? {
          ...current.shiftBibleDraft,
          weather,
          authority: weather.state === "complete"
            ? [...(current.shiftBibleDraft.authority ?? []), { field: "weather", source: "weather", observedAt: weather.fetchedAt!, finality: "final", presence: "present" }]
            : current.shiftBibleDraft.authority,
        } : current.shiftBibleDraft,
      } : current);
    });
  }

  return (
    <div className="shift-page">
      <div className="tabs" role="tablist" aria-label="Shift panes">
        {(["today", "report", "jobs", "evidence"] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`shift-tab-${id}`}
            aria-controls={`shift-panel-${id}`}
            aria-selected={pane === id}
            tabIndex={pane === id ? 0 : -1}
            className={pane === id ? "active" : ""}
            onClick={() => setPane(id)}
            onKeyDown={(event) => {
              const order = ["today", "report", "jobs", "evidence"] as const;
              const index = order.indexOf(id);
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const next = order[(index + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length]!;
              setPane(next);
              window.requestAnimationFrame(() => document.getElementById(`shift-tab-${next}`)?.focus());
            }}
          >
            {id === "today" ? "Today" : id === "report" ? "Report" : id === "jobs" ? "Jobs" : "Evidence"}
          </button>
        ))}
      </div>

      {pane === "today" && (
        <div className="shift-panel shift-today-wide" role="tabpanel" id="shift-panel-today" aria-labelledby="shift-tab-today">
          <section className="card shift-envelope-mail" aria-label="Shift envelopes">
            <header>
              <h2><span aria-hidden="true">✉</span> Shift mail</h2>
              <div className="chips"><span className="pill">{pendingEnvelopeCount} pending</span><button type="button" className="chip" disabled={busy || mailRefreshBusy} onClick={() => { void refreshShiftMail(); }}>{mailRefreshBusy ? "Checking…" : "Check 7shifts mail"}</button></div>
            </header>
            {mailRefreshMessage ? <p className="muted" role="status">{mailRefreshMessage}</p> : null}
            <p className="muted">Schedules arrive early. Worked time waits for 7shifts. Only the open Confirm form can post money.</p>
            {envelopes.length ? (
              <div className="shift-envelope-list">
                {envelopes.slice(0, 12).map((envelope) => (
                  <button
                    type="button"
                    key={envelope.id}
                    className={`shift-envelope-row${selectedEnvelopeId === envelope.id ? " selected" : ""}`}
                    onClick={() => setSelectedEnvelopeId((current) => current === envelope.id ? null : envelope.id)}
                    aria-expanded={selectedEnvelopeId === envelope.id}
                  >
                    <span aria-hidden="true">{["confirmed", "corrected"].includes(envelope.status) ? "✓" : "✉"}</span>
                    <span><strong>{envelope.date}</strong><small>{envelope.roleLabel || household.workJobs.find((job) => job.id === envelope.jobId)?.roles.find((role) => role.id === envelope.roleId)?.name || "Shift"}</small></span>
                    <span>{ENVELOPE_STATUS_LABEL[envelope.status]}</span>
                  </button>
                ))}
              </div>
            ) : <p className="muted">No captured schedule yet. The manual clock and Shift form still work.</p>}
            {selectedEnvelope ? (
              <div className="shift-envelope-open" role="region" aria-label={`${selectedEnvelope.date} shift envelope`}>
                <strong>{ENVELOPE_STATUS_LABEL[selectedEnvelope.status]}</strong>
                <p>{new Date(selectedEnvelope.scheduledStart).toLocaleString([], { timeZone: selectedEnvelope.timezone, weekday: "short", hour: "numeric", minute: "2-digit" })}–{new Date(selectedEnvelope.scheduledEnd).toLocaleTimeString([], { timeZone: selectedEnvelope.timezone, hour: "numeric", minute: "2-digit" })}</p>
                {selectedEnvelope.conflicts.length ? <p className="error">This envelope has source conflicts and needs review.</p> : null}
                {selectedEnvelope.status === "worked_ready" ? (
                  <button type="button" className="primary" disabled={busy || !selectedEnvelope.actualEnd} onClick={() => openWorkedEnvelope(selectedEnvelope)}>Open Confirm form</button>
                ) : selectedEnvelope.status === "needs_review" ? (() => {
                  const original = household.shifts.find((shift) => shift.shiftBible?.id === selectedEnvelope.confirmedBibleId);
                  const transactionId = original ? workShiftTransactionIds(original)[0] : null;
                  return original && transactionId
                    ? <><p className="error">7shifts changed this confirmed shift. Correct creates an exact reversal, then reopens this envelope for one visible replacement Confirm.</p><button type="button" className="primary" disabled={busy} onClick={() => onCorrect(original, transactionId)}>Correct this Bible</button></>
                    : <p className="error">Worked evidence is not approved/final or its prior Bible is unavailable. Nothing can post from this envelope.</p>;
                })()
                : ["cut", "called_off", "traded_away"].includes(selectedEnvelope.status) && !selectedEnvelope.confirmedBibleId ? (
                  <button type="button" className="primary" disabled={busy} onClick={() => onConfirmEnvelopeOutcome?.(selectedEnvelope.id, selectedEnvelope.status as Exclude<ShiftOutcome, "worked">)}>Confirm {ENVELOPE_STATUS_LABEL[selectedEnvelope.status].toLowerCase()}</button>
                ) : selectedEnvelope.status === "awaiting_punch" ? (
                  <p className="muted">Scheduled time is outlook only. Hearth will offer Confirm after actual clock-out facts arrive.</p>
                ) : null}
              </div>
            ) : null}
          </section>
          <section className="card shift-punch">
            <TimesheetBody
              household={household}
              streak={streak}
              memberId={memberId}
              memberName={memberName}
              today={today}
              busy={busy}
              onClockIn={onClockIn}
              onAbandon={() => {
                setFinishedReview(false);
                clearScanDraft();
                onAbandon();
              }}
              onStartBreak={onStartBreak}
              onEndBreak={onEndBreak}
              onChooseTimeline={onChooseTimeline}
              onSignOut={onClockOut}
              onFinished={() => {
                clearScanDraft();
                setShiftsWhenReviewOpened(household.shifts.filter((shift) => shift.memberId === memberId).length);
                setFinishedReview(true);
              }}
              previewHours={preview?.hours ?? null}
              previewCaption={preview?.caption ?? null}
              inlineConfirm
              hideIdleActions={finishedReview && !punch}
            />
            {reviewing ? (
              <>
                {duplicateConfirm ? (
                  <div className="preview warn" role="alert">
                    <p>{duplicateConfirm.message}</p>
                    <div className="chips">
                      <button type="button" className="primary" disabled={busy} onClick={() => onConfirmAnyway?.()}>
                        Add anyway
                      </button>
                      <button type="button" className="chip" disabled={busy} onClick={() => onDismissDuplicate?.()}>
                        Not now
                      </button>
                    </div>
                  </div>
                ) : null}
                {finishedReview && !punch ? (
                  <button type="button" className="chip" disabled={busy} onClick={() => { setFinishedReview(false); clearScanDraft(); }}>
                    Back to clock
                  </button>
                ) : null}
                <ShiftReportScanBar
                  busy={busy}
                  scanBusy={shiftScanBusy}
                  error={shiftScanError}
                  onFile={(file) => { void applyScan(file); }}
                />
                <WorkShiftWithSevenShifts
                  household={household}
                  memberId={memberId}
                  today={today}
                  punch={punch}
                  busy={busy || shiftScanBusy}
                  initialDraft={workShiftDraft}
                  weatherGlassPrefill={weatherGlass}
                  scanWarnings={shiftScanWarnings}
                  onClearDraft={clearScanDraft}
                  onConfirm={(input, attendanceReview) => {
                    clearScanDraft();
                    onConfirmShift(input, attendanceReview);
                  }}
                />
              </>
            ) : null}
          </section>

          <section className="card shift-climate">
            <header>
              <h2>Tip climate</h2>
              <span className="pill proj">Projection</span>
            </header>
            <p className="muted">Next 7 dinners &amp; lunches. Tap a seal for the nights-like-this range.</p>
            <div className="shift-climate-seals">
              {climate.map((seal) => (
                <button
                  key={seal.date}
                  type="button"
                  className={`shift-climate-seal ${seal.tone}${seal.wet ? " wet" : ""}`}
                  aria-label={seal.caption}
                  aria-pressed={sealCaption === seal.caption}
                  onClick={() => setSealCaption(seal.caption)}
                >
                  <span className="d">{seal.weekdayShort}</span>
                  <span className="m">{seal.mealMark}</span>
                  <span className="s">{seal.sub}</span>
                </button>
              ))}
            </div>
            {sealCaption ? <p className="shift-preview-caption">{sealCaption}</p> : null}
          </section>

          <WorkShiftHistoryCard
            household={household}
            memberId={memberId}
            busy={busy}
            onCorrect={onCorrect}
            initialVisible={3}
            title="Last shifts"
            intro="Locked. Correct posts a reversal."
          />

          <section className="card shift-saucers">
            <header>
              <h2>Saucers</h2>
              <span className="pill">{saucers.pill}</span>
            </header>
            <p className="muted">Last 28 days. A filled saucer is a posted shift date. Gaps are days off — never a broken streak.</p>
            <div className="shift-saucer-sill" role="img" aria-label={`${saucers.streakCount} posted dates on the last 28 days`}>
              {saucers.days.map((day) => (
                <div key={day.date} className="shift-saucer-cell">
                  <span className={`shift-saucer${day.filled ? " filled" : ""}${day.latest ? " latest" : ""}`} />
                  {day.latest ? <LoafMark /> : null}
                </div>
              ))}
            </div>
          </section>

          <section className="card shift-lamp">
            <header>
              <h2>Floor lamp</h2>
              <span className="pill proj">Projection · 28d</span>
            </header>
            {oracle ? (
              <>
                <p className="muted">Tip Oracle from {oracle.sampleShifts} posted nights. Not income. Confirm still posts.</p>
                <div className="shift-lamp-body">
                  <FloorLampRings />
                  <div className="shift-lamp-legend">
                    <div className="shift-lamp-row"><span>Floor p10</span><strong>{formatCad(oracle.p10Cents)}</strong></div>
                    <div className="shift-lamp-row"><span>Typical p50</span><strong>{formatCad(oracle.p50Cents)}</strong></div>
                    <div className="shift-lamp-row"><span>Upside p90</span><strong>{formatCad(oracle.p90Cents)}</strong></div>
                  </div>
                </div>
                <div className="shift-emergency">
                  <span className="shift-saucer filled" />
                  <div>
                    <strong>Dry-streak reserve {formatCad(oracle.emergencyReserveCents)}</strong>
                    <p className="muted">Educational saucer. Not CRA. Tax milk is a later chip.</p>
                  </div>
                </div>
              </>
            ) : (
              <p className="muted">Not enough nights yet. Four posted tip shifts light the lamp. Confirm still posts.</p>
            )}
          </section>
        </div>
      )}

      {pane === "report" && (
        <div className="shift-panel" role="tabpanel" id="shift-panel-report" aria-labelledby="shift-tab-report">
          <p className="shift-kicker">This month · books</p>
          <section className="card">
            <div className="hearth-story-grid" aria-label={`${formatMonthLabel(monthKeyFromDateKey(today))} shift story`}>
              <PaperTile kind="Posted" name="Shifts" value={String(report.shifts)} />
              <PaperTile kind="Posted" name="Hours" value={`${report.hours.toFixed(2)} h`} />
              <PaperTile kind="Posted" name="Take-home" value={formatCad(report.takeHomeCents)} />
              <PaperTile kind="Advice" name="Protect floor" value={report.protectLabel} warn />
            </div>
          </section>

          <section className="card">
            <header>
              <h2>Still waiting</h2>
              <button type="button" className="chip" onClick={onOpenCalendar}>Open Calendar</button>
            </header>
            <p className="muted">Calendar Confirm moves received money. This list never posts.</p>
            {report.owed.length === 0 ? (
              <p className="muted">Nothing waiting. Paydays land on Calendar.</p>
            ) : (
              <div className="shift-owed">
                {report.owed.map((fact) => (
                  <div className="shift-owed-row" key={fact.id}>
                    <span>{fact.title}</span>
                    <strong>{formatCad(fact.amountCents)}</strong>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <header>
              <h2>Tax milk</h2>
              <span className="pill proj">Educational</span>
            </header>
            <p className="muted">25% set-aside from typical tips. Not CRA withholding. You still Confirm any transfer.</p>
            {report.taxMilk ? (
              <div className="shift-owed-row">
                <span>On {formatCad(report.taxMilk.tipCents)} typical</span>
                <strong>{formatCad(report.taxMilk.taxMilkCents)}</strong>
              </div>
            ) : (
              <p className="muted">Not enough nights yet for an educational set-aside.</p>
            )}
            <div className="chips">
              <button type="button" className={`chip ${period === "month" ? "selected" : ""}`} onClick={() => setPeriod("month")}>This month</button>
              <button type="button" className={`chip ${period === "all" ? "selected" : ""}`} onClick={() => setPeriod("all")}>All time</button>
              <button type="button" className="chip" disabled={!report.shifts} onClick={() => downloadWorkReportCsv(household, memberId)}>Export .csv</button>
              <button type="button" className={`chip ${breakdown ? "selected" : ""}`} onClick={() => setBreakdown((open) => !open)}>Full breakdown</button>
            </div>
          </section>
          {breakdown ? <WorkReportCard household={household} memberId={memberId} today={today} /> : null}
        </div>
      )}

      {pane === "jobs" && (
        <div className="shift-panel" role="tabpanel" id="shift-panel-jobs" aria-labelledby="shift-tab-jobs">
        <WorkJobsCard
          key={`${environment}:${household.householdId}:${memberId}`}
          household={household}
          memberId={memberId}
          today={today}
          busy={busy}
          onAskSave={onAskSaveJob}
          onArchive={onArchiveJob}
        />
        </div>
      )}

      {pane === "evidence" && (
        <div className="shift-panel" role="tabpanel" id="shift-panel-evidence" aria-labelledby="shift-tab-evidence">
          <SevenShiftsEvidenceCenter
            household={household}
            memberId={memberId}
            memberName={memberName}
            today={today}
            busy={busy}
            onSaveSchedule={onSaveSevenShiftsSchedule}
            onImportCoworkers={onImportCoworkers}
            onUseShiftDraft={(candidate: ApprovedPunchShiftDraft) => {
              shiftScanScopeRef.current.cancel();
              setWorkShiftDraft(candidate.draft);
              setShiftScanWarnings(candidate.missingPaidBreak ? ["7shifts did not state paid-break minutes. Enter 0 only when there was no paid break."] : []);
              setShiftScanError("");
              setShiftsWhenReviewOpened(household.shifts.filter((shift) => shift.memberId === memberId).length);
              setFinishedReview(true);
              setPane("today");
              window.requestAnimationFrame(() => document.getElementById("shift-tab-today")?.focus());
            }}
          />
        </div>
      )}
    </div>
  );
}
