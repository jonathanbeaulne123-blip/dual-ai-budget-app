import { useMemo, useState } from "react";
import {
  applySitDown,
  adoptSitDownStandingOrders,
  closeBooksMonth,
  executeSitDownMoves,
  formatCad,
  formatMonthLabel,
  leftoverProjection,
  parseWholeCents,
  monthKeyFromDateKey,
  openSitDownSession,
  plannedAllocation,
  proposeAllocation,
  recordSitDownDrive,
  saveSitDownSession,
  sitDownExportText,
  sitDownFacts,
  sitDownPreview,
  sitDownWorkbookCsv,
  shiftMonthKey,
  todayKey,
  type AllocationSlice,
  type Household,
  type SitDownFact,
  type UndoToken,
} from "./core/index.ts";
import { downloadText } from "./ledger/export.ts";
import { googleConfigured, uploadSitDownWorkbook } from "./google/index.ts";

export function SitDownGuide({
  household,
  onApply,
  hidden,
  memberId,
}: {
  household: Household;
  onApply: (household: Household, undo?: UndoToken) => void;
  hidden?: boolean;
  memberId?: string;
}) {
  const today = todayKey();
  const monthKey = monthKeyFromDateKey(today);
  const saved = openSitDownSession(household, monthKey);
  const [act, setAct] = useState<1 | 2 | 3>(saved?.act ?? 1);
  const [openFact, setOpenFact] = useState<string | null>(null);
  const [slices, setSlices] = useState<AllocationSlice[]>(saved?.slices?.length ? saved.slices : proposeAllocation(household, today));
  const [driveNote, setDriveNote] = useState("");
  const leftover = useMemo(() => leftoverProjection(household, today), [household, today]);
  const preview = useMemo(() => sitDownPreview(household, monthKey), [household, monthKey]);
  const facts = useMemo(() => sitDownFacts(household, monthKey, today), [household, monthKey, today]);
  const plan = useMemo(() => plannedAllocation(leftover.leftoverCents, slices), [leftover.leftoverCents, slices]);
  const jobs = preview.rows.filter((row) => row.suggestedCents > 0 && !row.alreadyPlanned);
  const [jobDollars, setJobDollars] = useState<Record<string, string>>({});
  const trims = preview.rows.filter((row) => row.trimSuggested);
  const closeKey = shiftMonthKey(monthKey, -1);
  const positives = facts.filter((fact) => fact.act === 1);
  const information = facts.filter((fact) => fact.act === 2);

  if (hidden) {
    return (
      <section className="card">
        <header><h2>Sit-down</h2></header>
        <p className="muted">Household view plans for both of you.</p>
      </section>
    );
  }

  function persistSession(nextAct: 1 | 2 | 3, nextSlices = slices) {
    const result = saveSitDownSession(household, {
      monthKey,
      act: nextAct,
      slices: nextSlices,
      createdBy: memberId,
    });
    onApply(result.household, result.undo);
  }

  function patchSlice(id: string, patch: Partial<AllocationSlice>) {
    setSlices((current) => current.map((slice) => (slice.id === id ? { ...slice, ...patch } : slice)));
  }

  return (
    <section className="card sit-guide">
      <header>
        <h2>Sit-down</h2>
        <span className="muted">Act {act} / 3 · {formatMonthLabel(monthKey)}</span>
      </header>
      {act === 1 && (
        <>
          <p className="sit-q">What went well.</p>
          <p className="muted">Not a grade. Hercules can read these out loud. He still never posts.</p>
          {positives.map((fact) => (
            <FactRow key={fact.id} household={household} fact={fact} open={openFact === fact.id} onToggle={() => setOpenFact(openFact === fact.id ? null : fact.id)} />
          ))}
          <div className="chips">
            <button
              className="primary"
              type="button"
              onClick={() => {
                persistSession(2);
                setAct(2);
              }}
            >
              Then the books
            </button>
          </div>
        </>
      )}
      {act === 2 && (
        <>
          <p className="sit-q">The same view a CPA and a kid can share.</p>
          <LeftoverMath leftover={leftover} />
          {information.map((fact) => (
            <FactRow key={fact.id} household={household} fact={fact} open={openFact === fact.id} onToggle={() => setOpenFact(openFact === fact.id ? null : fact.id)} />
          ))}
          <div className="chips">
            <button className="chip" type="button" onClick={() => setAct(1)}>Back</button>
            <button
              className="primary"
              type="button"
              onClick={() => {
                persistSession(3);
                setAct(3);
              }}
            >
              Assign leftover
            </button>
          </div>
        </>
      )}
      {act === 3 && (
        <>
          <p className="sit-q">Where leftover goes.</p>
          <p className="muted">
            Plan first. One Confirm turns it into transfers you already have — jars park in savings and track the pig; card paydown is a transfer. Hercules never moves a dollar.
          </p>
          <LeftoverMath leftover={leftover} />
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
            <p className="danger">Over-allocated by {formatCad(plan.overAllocatedCents)}. Nothing moves until this fits leftover.</p>
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
          {jobs.length > 0 && (
            <>
              <p className="muted">Set next month’s jobs. Copy jobs writes these amounts.</p>
              {jobs.map((row) => (
                <label className="row" key={row.subcategoryId}>
                  {row.name}
                  <input
                    inputMode="decimal"
                    aria-label={`${row.name} job`}
                    value={jobDollars[row.subcategoryId] ?? (row.suggestedCents / 100).toFixed(2)}
                    onChange={(event) => setJobDollars((current) => ({ ...current, [row.subcategoryId]: event.target.value }))}
                    style={{ width: "7rem", textAlign: "right" }}
                  />
                </label>
              ))}
            </>
          )}
          <div className="chips">
            <button className="chip" type="button" onClick={() => setAct(2)}>Back</button>
            <button
              className="chip"
              type="button"
              onClick={() => persistSession(3, slices)}
            >
              Pause
            </button>
            {jobs.length > 0 && (
              <button
                className="chip"
                type="button"
                onClick={() => {
                  try {
                    const amounts: Record<string, number> = {};
                    for (const row of jobs) {
                      const raw = jobDollars[row.subcategoryId] ?? (row.suggestedCents / 100).toFixed(2);
                      amounts[row.subcategoryId] = parseWholeCents(raw, `${row.name} job`, { allowZero: true });
                    }
                    const result = applySitDown(household, preview.sourceMonth, amounts);
                    onApply(result.household, result.undo);
                    setDriveNote("Jobs copied into next month’s plan.");
                  } catch (caught) {
                    setDriveNote(caught instanceof Error ? caught.message : String(caught));
                  }
                }}
              >
                Copy jobs
              </button>
            )}
            <button
              className="primary"
              type="button"
              disabled={!plan.ok || plan.allocatedCents <= 0}
              onClick={() => {
                const result = executeSitDownMoves(household, {
                  monthKey,
                  slices,
                  createdBy: memberId,
                });
                onApply(result.household, result.undo);
              }}
            >
              Confirm moves
            </button>
            <button
              className="ghost"
              type="button"
              disabled={!slices.length}
              onClick={() => {
                try {
                  const result = adoptSitDownStandingOrders(household, {
                    monthKey,
                    slices,
                    createdBy: memberId,
                  });
                  onApply(result.household, result.undo);
                  setDriveNote(
                    result.warnings.length
                      ? `Standing orders saved. ${result.warnings.join(" ")}`
                      : "Standing orders saved for next month. Confirm still posts each transfer.",
                  );
                } catch (caught) {
                  setDriveNote(caught instanceof Error ? caught.message : String(caught));
                }
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
                  if (!googleConfigured() || !memberId) {
                    setDriveNote("Google is not linked. Download still works.");
                    return;
                  }
                  const csv = sitDownWorkbookCsv(household, monthKey, saved);
                  const uploaded = await uploadSitDownWorkbook({
                    environment: household.environment,
                    memberId,
                    enabledServices: household.google.enabledServices,
                    name: `Hearth ${monthKey}`,
                    csv,
                  });
                  setDriveNote(uploaded.ok ? uploaded.detail : `Drive skipped. ${uploaded.detail}`);
                  if (uploaded.ok && saved) {
                    const remembered = recordSitDownDrive(household, saved.id, uploaded.fileId ?? null);
                    onApply(remembered.household, remembered.undo);
                  }
                })();
              }}
            >
              Save to Drive
            </button>
            <button
              className="chip"
              type="button"
              onClick={() => {
                const result = closeBooksMonth(household, { monthKey: closeKey, createdBy: memberId });
                onApply(result.household, result.undo);
              }}
            >
              Lock {closeKey}
            </button>
          </div>
          {driveNote && <p className="muted">{driveNote}</p>}
          <p className="muted">Lock closes last month. This month stays open so milk still posts.</p>
        </>
      )}
    </section>
  );
}

function LeftoverMath({ leftover }: { leftover: ReturnType<typeof leftoverProjection> }) {
  return (
    <div className="sit-math">
      <div className="row"><span>Cash-like</span><span>{formatCad(leftover.cashLikeCents)}</span></div>
      <div className="row"><span>− Bills next 30 days</span><span>{formatCad(leftover.billsNext30Cents)}</span></div>
      <div className="row"><span>− Card minimums</span><span>{formatCad(leftover.minPaymentsCents)}</span></div>
      <div className="row"><strong>Leftover</strong><strong>{formatCad(leftover.leftoverCents)}</strong></div>
      <p className="muted">If leftover is positive, Confirm parks jar cash in the Goals vault — not month net, not everyday HIS. Pigs are envelopes on that vault.</p>
      {leftover.shortfallCents > 0 && (
        <p className="muted">Shortfall {formatCad(leftover.shortfallCents)}. Do not invent CAD to fill it.</p>
      )}
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
    <button className={`sit-fact ${fact.tone}`} type="button" onClick={onToggle}>
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
