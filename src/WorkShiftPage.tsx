import { useEffect, useMemo, useState } from "react";
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
  type WeatherGlass,
  type WorkJob,
} from "./core/index.ts";
import { scanShiftReportFile } from "./imports/shiftReportDraft.ts";
import { ShiftReportScanBar } from "./ShiftReportScan.tsx";
import { PaperTile } from "./theme/PaperTheme.tsx";
import { TimesheetBody } from "./widgets/Timesheet.tsx";
import { WorkJobsCard } from "./WorkJobs.tsx";
import { WorkReportCard, downloadWorkReportCsv } from "./WorkReport.tsx";
import { WorkShiftFlow, type WorkShiftDraft } from "./WorkShiftFlow.tsx";
import { WorkShiftHistoryCard } from "./WorkShiftHistory.tsx";

type ShiftPane = "today" | "report" | "jobs";

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
  onConfirmShift: (input: PostWorkShiftInput) => void;
  duplicateConfirm?: { message: string } | null;
  onConfirmAnyway?: () => void;
  onDismissDuplicate?: () => void;
  onCorrect: (shift: Shift, transactionId: string) => void;
  onAskSaveJob: (job: WorkJob, summary: string) => void;
  onArchiveJob: (jobId: string) => void;
  onOpenCalendar: () => void;
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
  const streak = useMemo(() => shiftPostingStreak(household, today), [household, today]);
  const punch = useMemo(() => activeOpenShift(household.kitchen, memberId), [household.kitchen, memberId]);
  const reviewing = punch?.status === "confirming" || finishedReview;

  useEffect(() => {
    const storage = typeof localStorage === "undefined" ? undefined : localStorage;
    void readTorontoWeather({ environment, today, storage }).then((reading) => {
      setWeatherGlass(reading.glass);
    });
  }, [environment, today]);

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
    setWorkShiftDraft(null);
    setShiftScanError("");
    setShiftScanWarnings([]);
  }, [reviewing]);

  useEffect(() => {
    if (!finishedReview) return;
    const count = household.shifts.filter((shift) => shift.memberId === memberId).length;
    if (count > shiftsWhenReviewOpened) {
      setFinishedReview(false);
      setWorkShiftDraft(null);
      setShiftScanError("");
      setShiftScanWarnings([]);
    }
  }, [finishedReview, household.shifts, memberId, shiftsWhenReviewOpened]);

  async function applyScan(file: File | undefined) {
    if (!file) return;
    setShiftScanBusy(true);
    setShiftScanError("");
    setShiftScanWarnings([]);
    try {
      const mapped = await scanShiftReportFile(file);
      if (!mapped.draft) {
        setShiftScanError(mapped.error || "That photo could not draft a shift.");
        setShiftScanWarnings(mapped.warnings);
        return;
      }
      setWorkShiftDraft(mapped.draft);
      setShiftScanWarnings(mapped.warnings);
    } catch (caught) {
      setShiftScanError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setShiftScanBusy(false);
    }
  }

  function clearScanDraft() {
    setWorkShiftDraft(null);
    setShiftScanWarnings([]);
    setShiftScanError("");
  }

  return (
    <div className="shift-page">
      <div className="tabs" role="tablist" aria-label="Shift panes">
        {(["today", "report", "jobs"] as const).map((id) => (
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
              const order = ["today", "report", "jobs"] as const;
              const index = order.indexOf(id);
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              event.preventDefault();
              const next = order[(index + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length]!;
              setPane(next);
              window.requestAnimationFrame(() => document.getElementById(`shift-tab-${next}`)?.focus());
            }}
          >
            {id === "today" ? "Today" : id === "report" ? "Report" : "Jobs"}
          </button>
        ))}
      </div>

      {pane === "today" && (
        <div className="shift-panel" role="tabpanel" id="shift-panel-today" aria-labelledby="shift-tab-today">
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
                <WorkShiftFlow
                  key={workShiftDraft ? `draft-${JSON.stringify(workShiftDraft)}` : "blank"}
                  household={household}
                  memberId={memberId}
                  today={today}
                  punch={punch}
                  busy={busy || shiftScanBusy}
                  initialDraft={workShiftDraft}
                  weatherGlassPrefill={weatherGlass}
                  scanWarnings={shiftScanWarnings}
                  onClearDraft={clearScanDraft}
                  onConfirm={(input) => {
                    clearScanDraft();
                    onConfirmShift(input);
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
          household={household}
          memberId={memberId}
          today={today}
          busy={busy}
          onAskSave={onAskSaveJob}
          onArchive={onArchiveJob}
        />
        </div>
      )}
    </div>
  );
}
