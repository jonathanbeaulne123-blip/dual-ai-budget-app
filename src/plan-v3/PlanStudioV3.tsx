import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommitResult, Household } from "../core/index.ts";
import type { PlanStudioProps, PlanStudioSection } from "../PlanStudio.tsx";
import { CheckIn } from "./CheckIn.tsx";
import type { FlowHighlight } from "./FlowPanel.tsx";
import { RefillPanel } from "./FundProposals.tsx";
import { moneyWords, planStudioV3Model, type FundKey, type FundSnapshotSource } from "./model.ts";
import { FUND_WORDS, RestScreen, restAction } from "./RestScreen.tsx";
import { STEPS } from "./steps.ts";
import { ToolDrawer } from "./ToolDrawer.tsx";
import { SheetFrame, ToolSheet } from "./ToolSheet.tsx";
import type { ToolId } from "./tools.ts";
import "../plan-studio.css";
import "../queen/queen-home.css";
import "./plan-v3.css";

const LITE_KEY = "hearth.planV3.lite";
function readLite(): boolean {
  try { const raw = window.localStorage.getItem(LITE_KEY); if (raw === "1" || raw === "0") return raw === "1"; } catch { /* per-device only */ }
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

type Sheet =
  | { kind: "tool"; tool: ToolId; section?: PlanStudioSection }
  | { kind: "fund"; fund: FundKey | "everyday" };

/**
 * Plan Studio v3 (D-273): the plan at rest, the tool drawer and the one
 * check-in. Every number comes through `planStudioV3Model`; every write goes
 * through the same commands the current studio uses, and a refused write says so.
 */
export default function PlanStudioV3(props: PlanStudioProps & { snapshotSource?: FundSnapshotSource }) {
  const { household, view, memberId, today, busy, onCommand, snapshotSource } = props;
  const [mode, setMode] = useState<{ kind: "rest" } | { kind: "checkin"; step: number }>({ kind: "rest" });
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [highlight, setHighlight] = useState<FlowHighlight>(null);
  const [lite, setLite] = useState(readLite);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const restHeading = useRef<HTMLElement | null>(null);
  const model = useMemo(() => planStudioV3Model(household, { memberId, view, today, source: snapshotSource }), [household, memberId, view, today, snapshotSource]);

  const run = useCallback(async (command: (current: Household) => CommitResult) => {
    setSaving(true); setError("");
    try {
      const result = await onCommand(command) as { ok?: boolean; household?: Household; userMessage?: string } | null;
      if (!result || result.ok === false || !result.household) throw new Error(result?.userMessage || "This change was not saved. Your input is still here.");
      return result;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "This change was not saved. Your input is still here.");
      return null;
    } finally { setSaving(false); }
  }, [onCommand]);

  useEffect(() => { if (!notice) return; const timer = window.setTimeout(() => setNotice(""), 4000); return () => window.clearTimeout(timer); }, [notice]);
  // Coming back from the check-in puts focus on the month heading; the first paint leaves focus alone.
  const returned = useRef(false);
  useEffect(() => { if (mode.kind !== "rest") { returned.current = true; return; } if (returned.current) restHeading.current?.querySelector<HTMLElement>("#pv3-rest-heading")?.focus({ preventScroll: true }); }, [mode.kind]);

  const chooseLite = (next: boolean) => { setLite(next); try { window.localStorage.setItem(LITE_KEY, next ? "1" : "0"); } catch { /* per-device only */ } };
  const openTool = (tool: ToolId, section?: PlanStudioSection) => setSheet({ kind: "tool", tool, section });
  const startCheckIn = (step = 0) => { setSheet(null); setMode({ kind: "checkin", step }); };
  const action = restAction(model, { checkIn: startCheckIn, afford: () => openTool("tracing", "everyday") });
  const locked = busy || saving;
  const studio: PlanStudioProps = { ...props };
  const fundSheet = sheet?.kind === "fund" ? sheet.fund : null;
  const fundReading = fundSheet && fundSheet !== "everyday" ? model.snapshot[fundSheet] : null;

  return (
    <main className={`pv3 pv3--${view}`} data-lite={lite ? "true" : "false"} data-mode={mode.kind} aria-label={`${view === "household" ? "Household" : "Personal"} Plan Studio`}>
      <div className="pv3-bar">
        <div className="pv3-lite" role="group" aria-label="Detail">
          <button type="button" aria-pressed={!lite} onClick={() => chooseLite(false)}>Full</button>
          <button type="button" aria-pressed={lite} onClick={() => chooseLite(true)}>Lite</button>
        </div>
      </div>
      {error && <p className="pv3-error" role="alert">{error}<button type="button" onClick={() => setError("")}>Dismiss</button></p>}
      <div className="pv3-layout">
        <div className="pv3-main" ref={node => { restHeading.current = node; }}>
          {mode.kind === "rest"
            ? <RestScreen household={household} memberId={memberId} view={view} today={today} model={model} highlight={highlight} onHighlight={setHighlight}
                onFund={key => setSheet({ kind: "fund", fund: key })} action={action} divide={view === "household" ? { busy: locked, run } : undefined} />
            : <CheckIn household={household} memberId={memberId} view={view} today={today} model={model} busy={locked} run={run} initialStep={mode.step}
                onLook={look => openTool(look.tool, look.section)}
                onExit={message => { setMode({ kind: "rest" }); if (message) setNotice(message); }} />}
        </div>
        <ToolDrawer view={view} badge={model.badge} lifted={sheet?.kind === "tool" ? sheet.tool : null} onOpen={tool => openTool(tool)} />
      </div>
      {notice && <p className="pv3-toast" role="status">{notice}</p>}

      {sheet?.kind === "tool" && (
        <ToolSheet tool={sheet.tool} section={sheet.section} studio={studio} onClose={() => setSheet(null)}
          lead={sheet.tool === "chairs" && view === "household" && mode.kind === "rest" ? (
            <button type="button" className="pv3-btn" onClick={() => startCheckIn(model.session.state === "active" ? model.session.stage : 0)}>
              {model.session.state === "active" ? "Continue our check-in" : "Start our check-in together"}
              <small>{model.session.state === "active" ? `${STEPS[Math.min(model.session.stage, STEPS.length - 1)]!.title} · either of you can pick it up` : "Hello → Coming in → Prepare → Protect → Build → Everyday → Read it together → Sitdown"}</small>
            </button>
          ) : undefined} />
      )}
      {fundSheet && (
        <SheetFrame kind={`fund-${fundSheet}`} kicker={FUND_WORDS[fundSheet].who} title={fundSheet === "everyday" ? "Everyday · the Queen" : FUND_WORDS[fundSheet].name} onClose={() => setSheet(null)}>
          {fundSheet === "everyday" ? <>
            <p className="pv3-sum"><b className="pv3-amt">{model.snapshot.now.amountCents === null ? "—" : moneyWords(model.snapshot.now.amountCents)}</b> {model.snapshot.now.line ?? ""}</p>
            <p className="pv3-note">Now is money already here, less what is set aside. Spending the Fund pays lowers it.</p>
          </> : fundReading && <>
            <p className="pv3-sum"><b className="pv3-amt">{fundReading.amountCents === null ? "—" : moneyWords(fundReading.amountCents)}</b> {fundReading.line ?? ""}</p>
            {fundReading.rows.length ? fundReading.rows.map(row => (
              <div key={row.id} className="pv3-row"><div className="pv3-row__grow">{row.label}{row.detail && <small>{row.detail}</small>}</div>{row.amountCents !== null && <span className="pv3-amt">{moneyWords(row.amountCents)}</span>}</div>
            )) : <p className="pv3-muted">Nothing here yet.</p>}
            {fundSheet === "protect" && view === "household" && (model.snapshot.mode === 2
              ? <RefillPanel household={household} memberId={memberId} monthKey={model.monthKey} refills={model.snapshot.refills ?? []} busy={locked} run={run} />
              : <p className="pv3-note">The custodian proposes a refill; the partner confirms, as today.</p>)}
          </>}
          <p className="pv3-note">“Set aside” is a way of planning, not a bank move.</p>
          <button type="button" className="pv3-btn" onClick={() => startCheckIn(Math.max(0, STEPS.findIndex(step => step.id === (fundSheet === "everyday" ? "everyday" : fundSheet))))}>Change it in the check-in</button>
        </SheetFrame>
      )}
    </main>
  );
}
