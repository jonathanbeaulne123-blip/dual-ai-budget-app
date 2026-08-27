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
import type { ParsedSevenShiftsBatch } from "./core/importInbox/sevenshifts.ts";

type State = "idle" | "probing" | "connecting" | "ready" | "error";

export function SevenShiftsConnectPanel({
  environment,
  householdId,
  memberId,
  jobs,
  disabled,
  onPulled,
}: {
  environment: Environment;
  householdId: string;
  memberId: string;
  jobs: WorkJob[];
  disabled: boolean;
  onPulled?: (batch: ParsedSevenShiftsBatch) => void;
}) {
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
    if (environment !== "development") return;
    const controller = new AbortController();
    controllerRef.current = controller;
    void (async () => {
      try {
        const status = await readSevenShiftsStatus();
        if (controller.signal.aborted) return;
        if (!status.available) {
          setNotice(status.detail);
          return;
        }
        const existing = await listSevenShiftsConnections(scope, controller.signal);
        if (controller.signal.aborted) return;
        setConnections(existing);
        if (existing.length) {
          setState("ready");
          setNotice("7shifts is connected. Fetch punches into Timesheet; tips stay blank.");
        }
      } catch (caught) {
        if (!controller.signal.aborted) setNotice(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    return () => controller.abort();
  }, [environment, householdId, memberId]);

  async function probe() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("probing");
    setNotice("");
    try {
      const status = await readSevenShiftsStatus();
      if (!status.available) {
        setState("idle");
        setNotice(status.detail);
        return;
      }
      const next = await probeSevenShifts(scope, token, controller.signal);
      setCompanyName(next.companyName);
      setUsers(next.users);
      setUserDigest(next.users[0]?.userDigest ?? "");
      setState("idle");
      setNotice(`${next.companyName} · choose your 7shifts profile, then Connect. The token stays in this Worker, never the books.`);
    } catch (caught) {
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function connect() {
    const controller = new AbortController();
    controllerRef.current = controller;
    setState("connecting");
    try {
      await connectSevenShifts(scope, { accessToken: token, userDigest, jobId }, controller.signal);
      setToken("");
      const existing = await listSevenShiftsConnections(scope, controller.signal);
      setConnections(existing);
      setUsers([]);
      setState("ready");
      setNotice("7shifts is connected. Fetch punches into Timesheet; cash and card tips stay for you to enter.");
    } catch (caught) {
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function pull(connectionId: string) {
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const result = await pullSevenShiftsPunches(scope, connectionId, controller.signal);
      const batch = parseSevenShiftsInbox(result.payload, activeJobs);
      setCoworkers(batch.coworkers);
      setTab("coworkers");
      onPulled?.(batch);
      setNotice(batch.drafts.length
        ? `${batch.drafts.length} punch${batch.drafts.length === 1 ? "" : "es"} ready in Timesheet. Tips stay blank.`
        : batch.warnings[0] || "No new clocked punches to confirm.");
    } catch (caught) {
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  async function disconnect(connectionId: string) {
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      await revokeSevenShiftsConnection(scope, connectionId, controller.signal);
      setConnections((current) => current.filter((row) => row.connectionId !== connectionId));
      setCoworkers([]);
      setState(connections.length > 1 ? "ready" : "idle");
      setNotice("7shifts disconnected. The access token was wiped from Hearth.");
    } catch (caught) {
      setState("error");
      setNotice(caught instanceof Error ? caught.message : String(caught));
    }
  }

  if (environment !== "development") {
    return (
      <section className="card seven-shifts-panel">
        <header><h2>7shifts</h2></header>
        <p className="muted">7shifts is Development-only until Production hardening is approved.</p>
      </section>
    );
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
      {notice && <p className="muted seven-shifts-status" role={state === "error" ? "alert" : "status"}>{notice}</p>}

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
