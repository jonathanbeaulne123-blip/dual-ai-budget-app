import { useMemo, useState } from "react";
import {
  applySitDown,
  adoptSitDownStandingOrders,
  executeSitDownMoves,
  formatCad,
  formatMonthLabel,
  leftoverProjection,
  monthKeyFromDateKey,
  openSitDownSession,
  plannedAllocation,
  proposeAllocation,
  recordSitDownDrive,
  saveSitDownSession,
  sitDownExportText,
  sitDownFacts,
  sitDownInfographicDeck,
  sitDownPreview,
  sitDownWorkbookCsv,
  todayKey,
  type AllocationSlice,
  type CommitResult,
  type DateKey,
  type Household,
  type LedgerView,
  type SitDownChart,
  type SitDownFact,
  type UndoToken,
} from "./core/index.ts";
import type { Dashboard } from "./core/insights.ts";
import { downloadText } from "./ledger/export.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import { PaperBars } from "./theme/PaperTheme.tsx";
import { googleConfigured, uploadSitDownWorkbook } from "./google/index.ts";
import { useAsyncScope } from "./asyncScope.ts";
import { Whisper } from "./theme/Whisper.tsx";

type SitDownRun = (fn: (current: Household) => CommitResult) => Promise<unknown> | unknown;

type SitDownBase = {
  household: Household;
  displayHousehold?: Household;
  dashboard: Dashboard;
  view?: LedgerView;
  memberId?: string;
  /** Today in the household's zone. Defaults to Toronto today. */
  today?: DateKey;
};

function useSitDownCharts({ household, displayHousehold, dashboard, view = "household", memberId, today }: SitDownBase & { today: DateKey }) {
  const leftover = useMemo(() => leftoverProjection(household, today), [household, today]);
  const charts = useMemo(
    () => sitDownInfographicDeck({
      view,
      household: displayHousehold ?? household,
      leftover: view === "household" ? leftover : null,
      memberId,
      dashboard,
      today,
    }),
    [view, displayHousehold, household, leftover, memberId, dashboard, today],
  );
  return { leftover, charts };
}

/**
 * The Campfire's Look back, from the month's own books: the charts, what went
 * well, and the figures a CPA and a kid can share. Reads only; nothing here
 * writes. (It was the first two acts of the monthly leftover guide.)
 */
export function SitDownLookBack(props: SitDownBase) {
  const today = props.today ?? todayKey();
  const monthKey = monthKeyFromDateKey(today);
  const { household, view = "household" } = props;
  const [openFact, setOpenFact] = useState<string | null>(null);
  const facts = useMemo(() => sitDownFacts(household, monthKey, today), [household, monthKey, today]);
  const { charts } = useSitDownCharts({ ...props, today });
  const positives = facts.filter((fact) => fact.act === 1);
  const information = facts.filter((fact) => fact.act === 2);
  if (view === "personal") {
    return (
      <section className="sit-guide" data-sit-view="personal" aria-label="The month in charts">
        <SitDownCharts charts={charts} />
        <p className="muted">Leftover assignment lives on Shared. Confirm still posts there. These charts are posted actuals on this folio.</p>
      </section>
    );
  }
  return (
    <section className="sit-guide sit-guide--look-back" aria-label="The month in charts">
      <SitDownCharts charts={charts} />
      <details className="sit-act1-well">
        <summary>What went well</summary>
        {positives.map((fact) => (
          <FactRow key={fact.id} household={household} fact={fact} open={openFact === fact.id} onToggle={() => setOpenFact(openFact === fact.id ? null : fact.id)} />
        ))}
      </details>
      {information.length > 0 && (
        <details className="sit-act2-books">
          <summary>The books, as they stand</summary>
          {information.map((fact) => (
            <FactRow key={fact.id} household={household} fact={fact} open={openFact === fact.id} onToggle={() => setOpenFact(openFact === fact.id ? null : fact.id)} />
          ))}
        </details>
      )}
    </section>
  );
}

/**
 * Where leftover goes — the Campfire's Settle, as the old guide's third act.
 * Every write is the App's `run` with the existing command. "Confirm moves" is
 * the one button here that posts (transfers you already have, as before), and
 * its name carries the amount. The books close is not here: it is its own
 * step in Settle, once.
 */
export function SitDownLeftover(props: SitDownBase & { onCommand: SitDownRun; busy?: boolean; initialSlices?: AllocationSlice[]; onStatus?: (message: string) => void }) {
  const today = props.today ?? todayKey();
  const monthKey = monthKeyFromDateKey(today);
  const { household, memberId, onCommand, busy = false, onStatus } = props;
  const saved = openSitDownSession(household, monthKey);
  const [slices, setSlices] = useState<AllocationSlice[]>(saved?.slices?.length ? saved.slices : props.initialSlices ?? proposeAllocation(household, today));
  const [driveNote, setDriveNote] = useState("");
  const scopeKey = `${household.environment}:${household.householdId}:${memberId ?? ""}`;
  const asyncScope = useAsyncScope(scopeKey);
  const { leftover, charts } = useSitDownCharts({ ...props, today });
  const preview = useMemo(() => sitDownPreview(household, monthKey), [household, monthKey]);
  const plan = useMemo(() => plannedAllocation(leftover.leftoverCents, slices), [leftover.leftoverCents, slices]);
  const jobs = preview.rows.filter((row) => row.suggestedCents > 0 && !row.alreadyPlanned);
  const trims = preview.rows.filter((row) => row.trimSuggested);

  async function send(fn: (current: Household) => CommitResult, message: string) {
    try {
      const outcome = await onCommand(fn) as { ok?: boolean; userMessage?: string | null } | null | undefined;
      if (outcome && outcome.ok === false) { setDriveNote(outcome.userMessage || "Not saved. Your choices are still here."); return false; }
      onStatus?.(message);
      return true;
    } catch (caught) {
      setDriveNote(caught instanceof Error ? caught.message : String(caught));
      return false;
    }
  }

  function patchSlice(id: string, patch: Partial<AllocationSlice>) {
    setSlices((current) => current.map((slice) => (slice.id === id ? { ...slice, ...patch } : slice)));
  }

  return (
    <section className="sit-guide sit-guide--leftover" aria-label="Where leftover goes">
      <p className="sit-q">Where leftover goes.</p>
      <Whisper mode="line">One Confirm turns this into transfers you already have. Hercules never moves a dollar.</Whisper>
      <Whisper mode="aside" id="sitdown.leftover">Plan first. Goals park in Kitty Banks; card paydown is a transfer.</Whisper>
      <SitDownCharts charts={charts} />
      {!leftover.leftoverCents && (
        <p className="muted">Nothing to move. The arithmetic is the lesson, not invented CAD.</p>
      )}
      {slices.map((slice) => (
        <div className="sit-slice" key={slice.id}>
          <div className="row">
            <strong>{slice.label}</strong>
            <span>{formatCad(plan.lines.find((line) => line.id === slice.id)?.cents ?? 0)}</span>
          </div>
          <div className="chips">
            {(["weight", "percent", "fixed"] as const).map((mode) => (
              <button
                key={mode}
                className={`chip ${slice.mode === mode ? "selected" : ""}`}
                type="button"
                aria-pressed={slice.mode === mode}
                onClick={() => patchSlice(slice.id, { mode, value: mode === "fixed" ? leftover.leftoverCents : mode === "percent" ? 0 : 1 })}
              >
                {mode}
              </button>
            ))}
          </div>
          <label>
            {slice.mode === "fixed" ? "Cents off the top" : slice.mode === "percent" ? "Percent" : "Weight"}
            <input
              type="number"
              min={0}
              value={slice.value}
              onChange={(event) => patchSlice(slice.id, { value: Number(event.target.value) || 0 })}
            />
          </label>
        </div>
      ))}
      <p className={plan.ok ? "muted" : "danger"}>{plan.reason}</p>
      {plan.overAllocatedCents > 0 && (
        <KitchenNotice message={`Over-allocated by ${formatCad(plan.overAllocatedCents)}. Nothing moves until this fits leftover.`} />
      )}
      {trims.length > 0 && (
        <>
          <p className="muted">{trims.length} ran hot. Copy jobs meets them in the middle.</p>
          {trims.slice(0, 4).map((row) => (
            <div className="row" key={row.subcategoryId}>
              <span>{row.name}</span>
              <span className="muted">{formatCad(row.lastActualCents)} → {formatCad(row.suggestedCents)}</span>
            </div>
          ))}
        </>
      )}
      <div className="chips">
        <button
          className="chip"
          type="button"
          aria-disabled={busy || undefined}
          onClick={() => { if (!busy) void send((current) => saveSitDownSession(current, { monthKey, act: 3, slices, createdBy: memberId }), "Leftover plan saved for later"); }}
        >
          Pause
        </button>
        {jobs.length > 0 && (
          <button
            className="chip"
            type="button"
            aria-disabled={busy || undefined}
            onClick={() => { if (!busy) void send((current) => applySitDown(current, preview.sourceMonth, {}), "Last month's jobs copied into this month's plan"); }}
          >
            Copy jobs
          </button>
        )}
        <button
          className="primary"
          type="button"
          aria-disabled={busy || !plan.ok || plan.allocatedCents <= 0 || undefined}
          onClick={() => {
            if (busy || !plan.ok || plan.allocatedCents <= 0) { setDriveNote(plan.reason); return; }
            void send((current) => executeSitDownMoves(current, { monthKey, slices, createdBy: memberId }), `Moved ${formatCad(plan.allocatedCents)} of leftover`);
          }}
        >
          Confirm moves of {formatCad(plan.allocatedCents)}
        </button>
        <button
          className="ghost"
          type="button"
          aria-disabled={busy || !slices.length || undefined}
          onClick={() => {
            if (busy || !slices.length) return;
            void (async () => {
              try {
                let warnings: string[] = [];
                const outcome = await onCommand((current) => {
                  const result = adoptSitDownStandingOrders(current, { monthKey, slices, createdBy: memberId });
                  warnings = result.warnings;
                  return result;
                }) as { ok?: boolean; userMessage?: string | null } | null | undefined;
                if (outcome && outcome.ok === false) { setDriveNote(outcome.userMessage || "Standing orders were not saved."); return; }
                setDriveNote(warnings.length ? `Standing orders saved. ${warnings.join(" ")}` : "Standing orders saved for next month. Confirm still posts each transfer.");
                onStatus?.("Standing orders saved for next month");
              } catch (caught) {
                setDriveNote(caught instanceof Error ? caught.message : String(caught));
              }
            })();
          }}
        >
          Remember as standing orders
        </button>
      </div>
      <div className="chips">
        <button
          className="chip"
          type="button"
          onClick={() => downloadText(`hearth-sitdown-${monthKey}.txt`, sitDownExportText(household, monthKey, today, saved))}
        >
          Download workbook
        </button>
        <button
          className="chip"
          type="button"
          onClick={() => {
            void (async () => {
              const startedScope = asyncScope.capture();
              if (!googleConfigured() || !memberId) {
                setDriveNote("Google is not linked. Download still works.");
                return;
              }
              const csv = sitDownWorkbookCsv(household, monthKey, saved);
              const uploaded = await uploadSitDownWorkbook({
                environment: household.environment,
                memberId,
                householdId: household.householdId,
                enabledServices: household.google.enabledServices,
                name: `Hearth ${monthKey}`,
                csv,
              });
              if (!asyncScope.isCurrent(startedScope)) return;
              setDriveNote(uploaded.ok ? uploaded.detail : `Drive skipped. ${uploaded.detail}`);
              if (uploaded.ok && saved) void send((current) => recordSitDownDrive(current, saved.id, uploaded.fileId ?? null), "Drive copy remembered");
            })();
          }}
        >
          Save to Drive
        </button>
      </div>
      {driveNote && <p className="muted" role="status">{driveNote}</p>}
    </section>
  );
}

/**
 * @deprecated The monthly guide is the Campfire's Look back and Settle now
 * (Tool Atlas K3, D3). This shim keeps the two legacy callers that App() and
 * the retired Office still mount (the flags-off Plan page and the Postcard)
 * working with their old `onApply` plumbing until the integrator removes them.
 * It no longer closes the books: that happens once, at the Campfire.
 */
export function SitDownGuide({ onApply, ...props }: SitDownBase & { onApply: (household: Household, undo?: UndoToken) => void }) {
  const legacyRun: SitDownRun = (fn) => {
    const result = fn(props.household);
    onApply(result.household, result.undo);
    return { ok: true, household: result.household };
  };
  return (
    <section className="card sit-guide">
      <header>
        <h2>Sitdown</h2>
        <span className="muted">{formatMonthLabel(monthKeyFromDateKey(props.today ?? todayKey()))}</span>
      </header>
      <SitDownLookBack {...props} />
      {(props.view ?? "household") === "household" && <SitDownLeftover {...props} onCommand={legacyRun} />}
    </section>
  );
}

function SitDownCharts({ charts }: { charts: SitDownChart[] }) {
  const [index, setIndex] = useState(0);
  const safeIndex = charts.length ? index % charts.length : 0;
  const chart = charts[safeIndex];
  if (!chart) return null;
  return (
    <div className="sit-math sit-charts" data-sit-chart={chart.id} aria-live="polite">
      <PaperBars rows={chart.rows} caption={chart.caption} empty={chart.empty} />
      {chart.lines.map((line) => (
        <div className="row" key={line.label}>
          {line.strong ? <strong>{line.label}</strong> : <span>{line.label}</span>}
          {line.strong ? <strong>{formatCad(line.cents)}</strong> : <span>{formatCad(line.cents)}</span>}
        </div>
      ))}
      <p className="muted">{chart.note}</p>
      {charts.length > 1 ? (
        <div className="sit-chart-nav" role="group" aria-label="Sitdown charts">
          <button
            type="button"
            className="chip"
            aria-label="Previous chart"
            onClick={() => setIndex((current) => (current + charts.length - 1) % charts.length)}
          >
            ‹
          </button>
          {charts.map((item, itemIndex) => (
            <button
              key={item.id}
              type="button"
              className={`sit-chart-dot ${itemIndex === safeIndex ? "is-on" : ""}`}
              aria-label={item.caption}
              aria-pressed={itemIndex === safeIndex}
              onClick={() => setIndex(itemIndex)}
            />
          ))}
          <button
            type="button"
            className="chip"
            aria-label="Next chart"
            onClick={() => setIndex((current) => (current + 1) % charts.length)}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

function FactRow({
  household,
  fact,
  open,
  onToggle,
}: {
  household: Household;
  fact: SitDownFact;
  open: boolean;
  onToggle: () => void;
}) {
  const rows = fact.transactionIds
    .map((id) => household.transactions.find((tx) => tx.id === id))
    .filter((tx): tx is Household["transactions"][number] => Boolean(tx));
  return (
    <button className={`sit-fact ${fact.tone}`} type="button" aria-expanded={open} onClick={onToggle}>
      <strong>{fact.title}</strong>
      <span className="muted">{fact.detail}</span>
      {open && rows.length > 0 && (
        <span className="sit-rows">
          {rows.slice(0, 12).map((tx) => (
            <span className="row" key={tx.id}>
              <span>{tx.date} · {tx.note || tx.place || tx.type}</span>
              <span>{formatCad(tx.amountCents)}</span>
            </span>
          ))}
        </span>
      )}
      {open && !rows.length && <span className="muted">This figure is a projection over posted rows, not a second ledger.</span>}
    </button>
  );
}
