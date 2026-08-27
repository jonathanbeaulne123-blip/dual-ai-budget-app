import { useMemo, useState } from "react";
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

export function WorkShiftWithSevenShifts({
  household,
  memberId,
  today,
  punch,
  busy,
  onConfirm,
}: {
  household: Household;
  memberId: string;
  today: string;
  punch: Parameters<typeof WorkShiftFlow>[0]["punch"];
  busy: boolean;
  onConfirm: (input: PostWorkShiftInput) => void;
}) {
  const [batch, setBatch] = useState<ParsedSevenShiftsBatch | null>(null);
  const [draft, setDraft] = useState<SevenShiftsTimesheetDraft | null>(null);
  const [notice, setNotice] = useState("");
  const posted = useMemo(() => postedSevenShiftsPunchDigests(household.shifts), [household.shifts]);
  const jobs = (household.workJobs ?? []).filter((job) => job.active && job.memberId === memberId);

  async function fetchPunches() {
    setNotice("");
    try {
      if (household.environment !== "development") throw new Error("7shifts is Development-only.");
      const scope: SevenShiftsScope = { environment: household.environment, householdId: household.householdId, memberId };
      const connections = await listSevenShiftsConnections(scope);
      const connection = connections[0];
      if (!connection) throw new Error("Connect 7shifts on Jobs first.");
      const pulled = await pullSevenShiftsPunches(scope, connection.connectionId);
      const next = parseSevenShiftsInbox(pulled.payload, jobs, posted);
      setBatch(next);
      setDraft(next.drafts[0] ?? null);
      setNotice(next.drafts.length
        ? "7shifts filled hours and role. Tips stay blank — enter cash and card on the next step, then Confirm."
        : next.warnings[0] || "No new 7shifts punches.");
    } catch (caught) {
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
            onClick={() => setDraft(item)}
          >
            {item.date} · {item.workedHours.toFixed(2)} h · {item.roleName}
          </button>
        ))}
      </div>
      <WorkShiftFlow
        household={household}
        memberId={memberId}
        today={today}
        punch={punch}
        inboxDraft={draft}
        busy={busy}
        onConfirm={onConfirm}
      />
    </div>
  );
}
