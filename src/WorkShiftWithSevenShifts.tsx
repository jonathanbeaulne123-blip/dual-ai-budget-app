import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseSevenShiftsInbox,
  postedSevenShiftsPunchDigests,
  type Household,
  type ParsedSevenShiftsBatch,
  type PostWorkShiftInput,
  type SevenShiftsTimesheetDraft,
} from "./core/index.ts";
import { listSevenShiftsConnections, pullSevenShiftsPunches, type SevenShiftsScope } from "./imports/sevenShiftsClient.ts";
import { WorkShiftFlow } from "./WorkShiftFlow.tsx";

type WorkShiftWithSevenShiftsProps = {
  household: Household;
  memberId: string;
  today: string;
  punch: Parameters<typeof WorkShiftFlow>[0]["punch"];
  busy: boolean;
  onConfirm: (input: PostWorkShiftInput) => void;
  initialDraft?: Parameters<typeof WorkShiftFlow>[0]["initialDraft"];
  weatherGlassPrefill?: Parameters<typeof WorkShiftFlow>[0]["weatherGlassPrefill"];
  scanWarnings?: string[];
  onClearDraft?: () => void;
};

export function WorkShiftWithSevenShifts(props: WorkShiftWithSevenShiftsProps) {
  const scopeKey = `${props.household.environment}:${props.household.householdId}:${props.memberId}`;
  return <ScopedWorkShiftWithSevenShifts key={scopeKey} scopeKey={scopeKey} {...props} />;
}

function ScopedWorkShiftWithSevenShifts({
  household,
  memberId,
  today,
  punch,
  busy,
  onConfirm,
  initialDraft,
  weatherGlassPrefill,
  scanWarnings,
  onClearDraft,
  scopeKey,
}: WorkShiftWithSevenShiftsProps & { scopeKey: string }) {
  const [batch, setBatch] = useState<ParsedSevenShiftsBatch | null>(null);
  const [draft, setDraft] = useState<SevenShiftsTimesheetDraft | null>(null);
  const [notice, setNotice] = useState("");
  const controllerRef = useRef<AbortController | null>(null);
  const posted = useMemo(() => postedSevenShiftsPunchDigests(household), [household.shifts]);
  const jobs = (household.workJobs ?? []).filter((job) => job.active && job.memberId === memberId);
  const flowKey = draft
    ? `${scopeKey}:seven:${draft.punchDigest}`
    : initialDraft
      ? `${scopeKey}:camera:${JSON.stringify(initialDraft)}`
      : `${scopeKey}:blank`;

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (initialDraft) setDraft(null);
  }, [initialDraft]);

  if (household.environment !== "development") {
    return (
      <WorkShiftFlow
        key={flowKey}
        household={household}
        memberId={memberId}
        today={today}
        punch={punch}
        busy={busy}
        onConfirm={onConfirm}
        initialDraft={initialDraft}
        weatherGlassPrefill={weatherGlassPrefill}
        scanWarnings={scanWarnings}
        onClearDraft={onClearDraft}
      />
    );
  }

  async function fetchPunches() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setNotice("");
    try {
      if (household.environment !== "development") throw new Error("7shifts is Development-only.");
      const scope: SevenShiftsScope = { environment: household.environment, householdId: household.householdId, memberId };
      const connections = await listSevenShiftsConnections(scope, controller.signal);
      if (controller.signal.aborted) return;
      const connection = connections[0];
      if (!connection) throw new Error("Connect 7shifts on Jobs first.");
      const pulled = await pullSevenShiftsPunches(scope, connection.connectionId, controller.signal);
      if (controller.signal.aborted) return;
      const next = parseSevenShiftsInbox(pulled.payload, jobs, posted);
      setBatch(next);
      if (next.drafts.length) onClearDraft?.();
      setDraft(next.drafts[0] ?? null);
      const baseNotice = next.drafts.length
        ? "7shifts filled hours and role. Tips stay blank — enter cash and card on the next step, then Confirm."
        : next.warnings[0] || "No new 7shifts punches.";
      const warning = next.drafts.length ? next.warnings[0] : "";
      setNotice([baseNotice, warning].filter(Boolean).join(" "));
    } catch (caught) {
      if (controller.signal.aborted) return;
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <div className="seven-shifts-timesheet">
      <div className="seven-shifts-inbox">
        <div className="row">
          <strong>7shifts punches</strong>
          <button type="button" className="chip" disabled={busy} onClick={() => void fetchPunches()}>Fill from 7shifts</button>
        </div>
        {notice && <p className="muted" role="status">{notice}</p>}
        {batch?.drafts.map((item) => (
          <button
            key={item.punchDigest}
            type="button"
            className={`chip ${draft?.punchDigest === item.punchDigest ? "selected" : ""}`}
            onClick={() => {
              onClearDraft?.();
              setDraft(item);
            }}
          >
            {item.date} · {item.workedHours.toFixed(2)} h · {item.roleName}
          </button>
        ))}
      </div>
      <WorkShiftFlow
        key={flowKey}
        household={household}
        memberId={memberId}
        today={today}
        punch={punch}
        inboxDraft={draft}
        busy={busy}
        onConfirm={onConfirm}
        initialDraft={initialDraft}
        weatherGlassPrefill={weatherGlassPrefill}
        scanWarnings={scanWarnings}
        onClearDraft={onClearDraft}
      />
    </div>
  );
}
