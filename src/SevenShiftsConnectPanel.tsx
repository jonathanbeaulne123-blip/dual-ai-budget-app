import {AuthJoinQr} from "./AuthJoinQr.tsx";
import {workHandoffUrl} from "./workHandoff.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseSevenShiftsInbox,
  type Environment,
  type WorkJob,
} from "./core/index.ts";
import {
  connectSevenShifts,
  listSevenShiftsConnections,
  probeSevenShifts,
  pullSevenShiftsPunches,
  readSevenShiftsStatus,
  revokeSevenShiftsConnection,
  type SevenShiftsConnectionSummary,
  type SevenShiftsProbeUser,
  type SevenShiftsScope,
} from "./imports/sevenShiftsClient.ts";
import { KitchenNotice } from "./KitchenNotice.tsx";
import type { ParsedSevenShiftsBatch } from "./core/importInbox/sevenshifts.ts";

type State = "idle" | "probing" | "connecting" | "ready" | "error";

type SevenShiftsConnectPanelProps = {
  environment: Environment;
  householdId: string;
  memberId: string;
  jobs: WorkJob[];
  postedPunchDigests?: Iterable<string>;
  disabled: boolean;
  onOpenTimesheet?:()=>void;
  ledgerName?:string;
  onPulled?: (batch: ParsedSevenShiftsBatch) => void;
};

export function SevenShiftsConnectPanel(props: SevenShiftsConnectPanelProps) {
  const scopeKey = `${props.environment}:${props.householdId}:${props.memberId}`;
  return <ScopedSevenShiftsConnectPanel key={scopeKey} {...props} />;
}

function ScopedSevenShiftsConnectPanel({
  environment,
  householdId,
  memberId,
  jobs,
  postedPunchDigests = [],
  disabled,
  onPulled,
  onOpenTimesheet,ledgerName,
}: SevenShiftsConnectPanelProps) {
  const [phone,setPhone]=useState(()=>window.innerWidth<720);
  const [manual,setManual]=useState(()=>window.innerWidth>=720);
  useEffect(()=>{let wasPhone=window.innerWidth<720;const resize=()=>{const next=window.innerWidth<720;if(next!==wasPhone){wasPhone=next;setPhone(next);setManual(!next);}};window.addEventListener("resize",resize);return()=>window.removeEventListener("resize",resize);},[]);
  const handoff=workHandoffUrl(window.location.href);
  const scope: SevenShiftsScope = { environment, householdId, memberId };
  const [state, setState] = useState<State>("idle");
  const [notice, setNotice] = useState("");
  const [token, setToken] = useState("");
  const [jobId, setJobId] = useState(jobs[0]?.id ?? "");
  const [users, setUsers] = useState<SevenShiftsProbeUser[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [userDigest, setUserDigest] = useState("");
  const [connections, setConnections] = useState<SevenShiftsConnectionSummary[]>([]);
  const [tab, setTab] = useState<"connect" | "coworkers">("connect");
  const [coworkers, setCoworkers] = useState<ParsedSevenShiftsBatch["coworkers"]>([]);
  const controllerRef = useRef<AbortController | null>(null);
  const activeJobs = useMemo(() => jobs.filter((job) => job.active), [jobs]);

  useEffect(() => () => controllerRef.current?.abort(), []);
  useEffect(() => {
    if (!activeJobs.some((job) => job.id === jobId)) setJobId(activeJobs[0]?.id ?? "");
  }, [activeJobs, jobId]);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    void (async () => {
      try {
        const status = await readSevenShiftsStatus();
        if (controller.signal.aborted) return;
        if (!status.available || status.environments?.[environment]?.available === false) {
          setState("error");
          setNotice(status.environments?.[environment]?.detail || status.detail);
          return;
        }
        const existing = await listSevenShiftsConnections(scope, controller.signal);
        if (controller.signal.aborted) return;
        if(controller.signal.aborted)return;
      setConnections(existing);
        if (existing.length) {
          setState("ready");
          setNotice("7shifts is connected. Fetch punches into Timesheet; tips stay blank.");
        }
      } catch (caught) {
        if (!controller.signal.aborted) {
          setState("error");
          setNotice(caught instanceof Error ? caught.message : String(caught));
        }
      }
    })();
    return () => controller.abort();
  }, [environment, householdId, memberId]);

  async function refreshConnections(){controllerRef.current?.abort();const controller=new AbortController();controllerRef.current=controller;try{const existing=await listSevenShiftsConnections(scope,controller.signal);if(controller.signal.aborted)return;setConnections(existing);setNotice(existing.length?'Connections refreshed. Open Timesheet to review punches.':'No connection for this person in this ledger yet.');}catch(error){if(!controller.signal.aborted)setNotice(error instanceof Error?error.message:String(error));}}

  async function probe() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("probing");
    setNotice("");
    try {
      const status = await readSevenShiftsStatus();
      if(controller.signal.aborted)return;
      if (!status.available || status.environments?.[environment]?.available === false) {
        setState("error");
        setNotice(status.environments?.[environment]?.detail || status.detail);
        return;
      }
      const next = await probeSevenShifts(scope, token, controller.signal);
      if(controller.signal.aborted)return;
      setCompanyName(next.companyName);
      setUsers(next.users);
      setUserDigest(next.users[0]?.userDigest ?? "");
      setState("idle");
      setNotice(`${next.companyName} · choose your 7shifts profile, then Connect. The token stays in this Worker, never the books.`);
    } catch (caught) {
      if(controller.signal.aborted)return;
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function connect() {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("connecting");
    try {
      await connectSevenShifts(scope, { accessToken: token, userDigest, jobId }, controller.signal);
      if(controller.signal.aborted)return;
      setToken("");
      const existing = await listSevenShiftsConnections(scope, controller.signal);
      if(controller.signal.aborted)return;
      setConnections(existing);
      setUsers([]);
      setState("ready");
      setNotice("7shifts is connected. Fetch punches into Timesheet; cash and card tips stay for you to enter.");
    } catch (caught) {
      if(controller.signal.aborted)return;
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function pull(connectionId: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await pullSevenShiftsPunches(scope, connectionId, controller.signal);
      if(controller.signal.aborted)return;
      const batch = parseSevenShiftsInbox(result.payload, activeJobs, postedPunchDigests);
      setCoworkers(batch.coworkers);
      setTab("coworkers");
      onPulled?.(batch);
      const baseNotice = batch.drafts.length
        ? `${batch.drafts.length} clocked punch${batch.drafts.length === 1 ? "" : "es"} pulled. Open Timesheet and tap Fill from 7shifts. Tips stay blank.`
        : batch.warnings[0] || "No new clocked punches to confirm.";
      const warning = batch.drafts.length ? batch.warnings[0] : "";
      setNotice([baseNotice, warning].filter(Boolean).join(" "));
    } catch (caught) {
      if(controller.signal.aborted)return;
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function disconnect(connectionId: string) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await revokeSevenShiftsConnection(scope, connectionId, controller.signal);
      if(controller.signal.aborted)return;
      setConnections((current) => current.filter((row) => row.connectionId !== connectionId));
      setCoworkers([]);
      setState(connections.length > 1 ? "ready" : "idle");
      setNotice("7shifts disconnected. The access token was wiped from Hearth.");
    } catch (caught) {
      if(controller.signal.aborted)return;
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  return (
    <section className="card seven-shifts-panel">
      <header>
        <h2>7shifts</h2>
        <div className="chips">
          <button type="button" className={`chip ${tab === "connect" ? "selected" : ""}`} onClick={() => setTab("connect")}>Connect</button>
          <button type="button" className={`chip ${tab === "coworkers" ? "selected" : ""}`} onClick={() => setTab("coworkers")}>Co-workers</button>
        </div>
      </header>
      <p className="muted">Punches fill Timesheet hours and role. Tips are not in 7shifts — leave them blank, then Confirm. Co-workers are the restaurant roster, not household members.</p>
      {state === "error"
        ? <KitchenNotice message={notice} onDismiss={() => setNotice("")} />
        : notice ? <p className="muted seven-shifts-status" role="status">{notice}</p> : null}

      <div className="work-handoff"><p className="muted">Set up 7shifts on the desk. On your phone, sign in as the same person and open {ledgerName||'the same ledger'} in {environment==='development'?'Development':'Production'}, then refresh connections.</p><div className="chips"><button type="button" className="chip" disabled={disabled} onClick={()=>void refreshConnections()}>Refresh connections</button>{onOpenTimesheet&&<button type="button" className="chip" disabled={disabled} onClick={onOpenTimesheet}>Open Timesheet</button>}</div>{!phone&&(handoff?<details><summary>Open Hearth on your phone</summary><AuthJoinQr joinUrl={handoff} label="QR code to open Hearth Shift"/><p className="muted">This opens Hearth. It does not share access or the 7shifts token.</p><a href={handoff}>Open Shift</a></details>:<p className="muted">Phone QR is available on the hosted app; this local address stays on this computer.</p>)}</div>
      {tab === "connect" && (
        <>
          {connections.map((connection) => (
            <div className="work-job-row" key={connection.connectionId}>
              <div>
                <strong>{connection.companyName}</strong>
                <div className="muted">{activeJobs.find((job) => job.id === connection.jobId)?.name || "Job"} · connected</div>
              </div>
              <div className="chips">
                <button type="button" className="chip" disabled={disabled} onClick={() => void pull(connection.connectionId)}>Fetch punches</button>
                <button type="button" className="ghost" disabled={disabled} onClick={() => void disconnect(connection.connectionId)}>Disconnect</button>
              </div>
            </div>
          ))}
          <details open={manual} onToggle={event=>setManual(event.currentTarget.open)} className="seven-shifts-manual"><summary>Set up with an access token on this device</summary>
          {activeJobs.length === 0 ? (
            <p>Add a job first, then paste a 7shifts access token.</p>
          ) : (
            <div className="work-form-grid">
              <label>Hearth job
                <select value={jobId} onChange={(event) => setJobId(event.target.value)}>
                  {activeJobs.map((job) => <option key={job.id} value={job.id}>{job.name}</option>)}
                </select>
              </label>
              <label>Access token
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={token}
                  onChange={(event) => setToken(event.target.value)}
                  placeholder="Company Settings → Developer Tools"
                />
              </label>
              {users.length > 0 && (
                <label>Your 7shifts profile
                  <select value={userDigest} onChange={(event) => setUserDigest(event.target.value)}>
                    {users.map((user) => <option key={user.userDigest} value={user.userDigest}>{companyName} · {user.displayName}</option>)}
                  </select>
                </label>
              )}
            </div>
          )}
          <div className="work-job-actions">
            {users.length === 0 ? (
              <button type="button" className="chip" disabled={disabled || !token || !jobId} onClick={() => void probe()}>Look up company</button>
            ) : (
              <button type="button" className="primary" disabled={disabled || !userDigest || !jobId} onClick={() => void connect()}>Connect 7shifts</button>
            )}
          </div>
          </details>
        </>
      )}

      {tab === "coworkers" && (
        coworkers.length === 0
          ? <p className="muted">Fetch punches to see who was scheduled or clocked that day. Names stay on this phone until you fetch again.</p>
          : coworkers.map((person, index) => (
            <div className="row" key={`${person.displayName}-${person.date}-${index}`}>
              <strong>{person.displayName}</strong>
              <span className="muted">{person.roleName} · {person.date} · {person.status === "punched" ? "clocked" : "scheduled"}</span>
            </div>
          ))
      )}
    </section>
  );
}
