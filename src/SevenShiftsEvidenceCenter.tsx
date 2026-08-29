import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseSevenShiftsCalendar,
  automationRequiredEvidenceFieldsForJob,
  type AutomationPolicy,
  type Household,
  type SevenShiftsScheduledShift,
  type WorkJob,
} from "./core/index.ts";
import {
  deleteEvidence,
  listEvidence,
  listEvidenceAutomationPolicies,
  listEvidenceBundles,
  putEvidenceAutomationPolicy,
  mintEvidenceCaptureCapability,
  readEvidenceDerived,
  readEvidenceRaw,
  readEvidenceStatus,
  readSevenShiftsCalendarEvidence,
  uploadEvidence,
  type EvidenceBundleSummary,
  type EvidenceCaptureSummary,
  type EvidenceDerivedDetail,
  type EvidenceScope,
} from "./imports/evidenceClient.ts";
import { importSevenShiftsFromGmail, type GmailSevenShiftsImportProgress } from "./google/gmailSevenShifts.ts";
import { coworkerRosterDraft, type CoworkerRosterImportDraft } from "./imports/coworkerRosterDraft.ts";

function captureKind(file: File): string {
  const name = file.name.toLowerCase();
  if (name.endsWith(".ics") || file.type === "text/calendar") return "selected-ics";
  if (name.endsWith(".csv") || file.type === "text/csv") return "selected-csv";
  if (name.endsWith(".json") || file.type === "application/json") return "selected-json";
  if (file.type === "application/pdf") return "pdf";
  if (file.type.startsWith("image/")) return "screenshot";
  return "ios-share";
}

function captureLabel(row: EvidenceCaptureSummary): string {
  return row.captureKind.replace(/-/g, " ");
}

function displayEvidenceValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (value === null || value === undefined || value === "") return "blank";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function defaultPolicy(scope: EvidenceScope, job: WorkJob): AutomationPolicy {
  return {
    version: 1,
    ...scope,
    jobId: job.id,
    enabled: false,
    requiredEvidenceFields: automationRequiredEvidenceFieldsForJob(job),
    stableWindowHours: 24,
    payrollWeekStarts: 0,
    correctionHorizonDays: 60,
    closedPeriodAction: "variance",
    updatedAt: new Date().toISOString(),
  };
}

export function SevenShiftsEvidenceCenter({
  household,
  memberId,
  memberName,
  today,
  busy: parentBusy,
  onSaveSchedule,
  onImportCoworkers,
}: {
  household: Household;
  memberId: string;
  memberName: string;
  today: string;
  busy: boolean;
  onSaveSchedule: (rows: SevenShiftsScheduledShift[], confirmedPersonalFeed?: boolean) => void;
  onImportCoworkers?: (input: CoworkerRosterImportDraft) => void;
}) {
  const scope = useMemo<EvidenceScope>(() => ({ environment: household.environment, householdId: household.householdId, memberId }), [household.environment, household.householdId, memberId]);
  const scopeKey = `${scope.environment}:${scope.householdId}:${scope.memberId}`;
  const controllerRef = useRef<AbortController | null>(null);
  const reviewRef = useRef<HTMLElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [detail, setDetail] = useState("Evidence Mesh is checking this environment gate.");
  const [captures, setCaptures] = useState<EvidenceCaptureSummary[]>([]);
  const [bundles, setBundles] = useState<EvidenceBundleSummary[]>([]);
  const [policies, setPolicies] = useState<AutomationPolicy[]>([]);
  const [selectedDerived, setSelectedDerived] = useState<EvidenceDerivedDetail | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [gmailProgress, setGmailProgress] = useState<GmailSevenShiftsImportProgress | null>(null);
  const [extensionId, setExtensionId] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [rosterJobId, setRosterJobId] = useState("");
  const [replaceScheduleRange, setReplaceScheduleRange] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (selectedDerived) reviewRef.current?.focus();
  }, [selectedDerived?.evidenceId, selectedDerived?.revision]);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setAvailable(false);
    setCaptures([]);
    setBundles([]);
    setPolicies([]);
    setSelectedDerived(null);
    setReplaceScheduleRange(false);
    setError("");
    setNotice("");
    void (async () => {
      try {
        const status = await readEvidenceStatus(fetch);
        if (controller.signal.aborted) return;
        const environmentStatus = status.environments?.[scope.environment];
        const scopeAvailable = environmentStatus ? environmentStatus.available : status.available && scope.environment === "development";
        setAvailable(scopeAvailable);
        setDetail(scopeAvailable ? `Encrypted member evidence vault ready in ${scope.environment}.` : environmentStatus?.detail || status.detail || "Evidence Mesh is installed but disabled.");
        if (!scopeAvailable) return;
        const [nextCaptures, nextBundles, nextPolicies] = await Promise.all([
          listEvidence(scope, controller.signal),
          listEvidenceBundles(scope, controller.signal),
          listEvidenceAutomationPolicies(scope, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        setCaptures(nextCaptures);
        setBundles(nextBundles);
        setPolicies(nextPolicies);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    return () => controller.abort();
  }, [scopeKey]);

  async function refresh(signal?: AbortSignal) {
    const [nextCaptures, nextBundles, nextPolicies] = await Promise.all([
      listEvidence(scope, signal),
      listEvidenceBundles(scope, signal),
      listEvidenceAutomationPolicies(scope, signal),
    ]);
    setCaptures(nextCaptures);
    setBundles(nextBundles);
    setPolicies(nextPolicies);
  }

  async function chooseFile(file: File | null) {
    if (!file || !available) return;
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (captureKind(file) === "selected-ics") {
        const source = await file.text();
        if (controller.signal.aborted) return;
        const parsed = parseSevenShiftsCalendar({
          source,
          sourceName: "selected-7shifts-calendar.ics",
          memberId,
          memberName,
          jobs: (household.workJobs ?? []).filter((job) => job.active && job.memberId === memberId),
          delivery: "selected-file",
        });
        if (parsed.requiresSelfAssertion && !window.confirm("This calendar does not name you. Save it only if it is your private 7shifts Calendar Sync feed.")) {
          throw new Error("Calendar not saved because member ownership was not confirmed.");
        }
        onSaveSchedule(parsed.shifts, parsed.requiresSelfAssertion);
      }
      await uploadEvidence(scope, file, { captureKind: captureKind(file), contentType: file.type || "application/octet-stream" }, controller.signal);
      if (controller.signal.aborted) return;
      await refresh(controller.signal);
      setNotice(captureKind(file) === "selected-ics"
        ? "Calendar outlook saved and the selected source encrypted. It cannot post money."
        : "Evidence encrypted and queued. Unknown source fields remain in the private raw object.");
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function readCalendar() {
    const privateUrl = calendarUrl.trim();
    if (!privateUrl || !available) return;
    setCalendarUrl("");
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const source = await readSevenShiftsCalendarEvidence(scope, privateUrl, controller.signal);
      if (controller.signal.aborted) return;
      const parsed = parseSevenShiftsCalendar({
        source,
        sourceName: "7shifts-personal-calendar.ics",
        memberId,
        memberName,
        jobs: (household.workJobs ?? []).filter((job) => job.active && job.memberId === memberId),
        delivery: "calendar-sync",
      });
      if (parsed.requiresSelfAssertion && !window.confirm("This calendar does not name you. Save it only if it is your private 7shifts Calendar Sync feed.")) {
        throw new Error("Calendar not saved because member ownership was not confirmed.");
      }
      onSaveSchedule(parsed.shifts, parsed.requiresSelfAssertion);
      setNotice(`${parsed.shifts.length} published schedule shift${parsed.shifts.length === 1 ? "" : "s"} staged as outlook only. The private link was discarded.`);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function togglePolicy(jobId: string, enabled: boolean) {
    const job = (household.workJobs ?? []).find((row) => row.id === jobId && row.active && row.memberId === memberId);
    if (!job) {
      setError("Choose an active job before changing automation.");
      return;
    }
    const current = policies.find((row) => row.jobId === jobId) ?? defaultPolicy(scope, job);
    setBusy(true);
    setError("");
    try {
      const saved = await putEvidenceAutomationPolicy(scope, {
        ...current,
        enabled,
        requiredEvidenceFields: automationRequiredEvidenceFieldsForJob(job),
        updatedAt: new Date().toISOString(),
      });
      setPolicies((rows) => [...rows.filter((row) => row.jobId !== jobId), saved]);
      setNotice(enabled
        ? "Automation enabled for this exact job. Only eligible, unconflicted evidence can create a pending deterministic command."
        : "Automation disabled for this job. Existing posted books are unchanged.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function importGmail() {
    const controller = new AbortController();
    controllerRef.current?.abort();
    controllerRef.current = controller;
    setBusy(true);
    setError("");
    setNotice("");
    setGmailProgress({ discovered: 0, inspected: 0, imported: 0, duplicates: 0, rejected: 0 });
    try {
      const loginHint = household.google?.links?.find((row) => row.active && row.memberId === memberId)?.email;
      const result = await importSevenShiftsFromGmail({
        scope,
        loginHint,
        after: "2024/01/01",
        limit: 1_000,
        signal: controller.signal,
        onProgress: setGmailProgress,
      });
      if (controller.signal.aborted) return;
      await refresh(controller.signal);
      setNotice(`${result.imported} new 7shifts message${result.imported === 1 ? "" : "s"} encrypted; ${result.duplicates} already present; ${result.rejected} rejected. Email schedules remain outlook only.${result.truncated ? " The 1,000-message safety cap was reached." : ""}`);
    } catch (caught) {
      if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }

  async function pairExtension() {
    const id = extensionId.trim().toLowerCase();
    if (!/^[a-p]{32}$/.test(id)) { setError("Enter the 32-letter extension id shown by Chrome or Edge."); return; }
    setBusy(true);
    setError("");
    setPairingCode("");
    try {
      const result = await mintEvidenceCaptureCapability(scope, { channel: "extension", origin: `chrome-extension://${id}`, byteLimit: 10 * 1024 * 1024 });
      setPairingCode(result.capability);
      setNotice("One-use pairing code created. It expires in five minutes and is not retained by Hearth.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function exportRaw(row: EvidenceCaptureSummary) {
    setBusy(true);
    setError("");
    try {
      const blob = await readEvidenceRaw(scope, row.evidenceId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `hearth-evidence-${row.evidenceId}`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function reviewDerived(row: EvidenceCaptureSummary) {
    setBusy(true);
    setError("");
    setReplaceScheduleRange(false);
    try {
      setSelectedDerived(await readEvidenceDerived(scope, row.evidenceId));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: EvidenceCaptureSummary) {
    if (!window.confirm("Permanently destroy this evidence object's decryption key and raw bytes? Posted books remain.")) return;
    setBusy(true);
    setError("");
    try {
      await deleteEvidence(scope, row.evidenceId);
      setCaptures((rows) => rows.filter((item) => item.evidenceId !== row.evidenceId));
      setNotice("Evidence key destroyed and raw object deleted.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setBusy(false);
    }
  }

  const disabled = parentBusy || busy || !available;
  const memberJobs = (household.workJobs ?? []).filter((job) => job.active && job.memberId === memberId);
  const rosterRows = coworkerRosterDraft(selectedDerived);
  const rosterResponseCount = rosterRows.filter((row) => row.source === "seven-shifts-roster").length;
  const scheduleObservationCount = rosterRows.length - rosterResponseCount;
  const scheduleDates = rosterRows.flatMap((row) => row.scheduledWindows ?? []).map((row) => row.date).sort();
  const scheduleRange = scheduleDates.length
    ? { fromDate: scheduleDates[0]!, toDate: scheduleDates.at(-1)! }
    : null;
  const rosterJob = memberJobs.find((job) => job.id === rosterJobId) ?? memberJobs[0];

  return (
    <section className="card" aria-label="7shifts Evidence Center">
      <header>
        <div>
          <p className="kicker">D-158 · member evidence</p>
          <h2>7shifts Evidence Center</h2>
        </div>
        <span className={`pill ${available ? "" : "proj"}`}>{available ? `${household.environment === "production" ? "Production" : "Development"} ready` : "Disabled"}</span>
      </header>
      <p className="muted">{detail} Raw captures stay outside the household snapshot and books. Schedule rows remain outlook only.</p>
      <p className="muted">Scope: {memberName} · {household.environment} · {today}</p>
      {error ? <p className="error" role="alert">{error}</p> : null}
      {notice ? <p className="preview" role="status">{notice}</p> : null}

      <div className="stack-list">
        <article>
          <p className="kicker">Selected files and screens</p>
          <h3>Add authorized evidence</h3>
          <p className="muted">JSON, CSV, ICS, PDF, screenshots, and shared files up to 10 MB. Hearth encrypts the complete source before normalization.</p>
          <label className="chip">
            {busy ? "Working…" : "Choose evidence"}
            <input type="file" hidden disabled={disabled} accept=".json,.csv,.ics,.pdf,image/jpeg,image/png,image/webp,application/json,text/csv,text/calendar,application/pdf" onChange={(event) => { void chooseFile(event.target.files?.[0] ?? null); event.currentTarget.value = ""; }} />
          </label>
        </article>

        <article>
          <p className="kicker">Published schedule</p>
          <h3>Read my private Calendar Sync link</h3>
          <input type="url" value={calendarUrl} autoComplete="off" spellCheck={false} disabled={parentBusy || !available} placeholder="https://…7shifts.com/…" onChange={(event) => {
            controllerRef.current?.abort();
            setBusy(false);
            setCalendarUrl(event.target.value);
          }} />
          <button type="button" className="chip" disabled={disabled || !calendarUrl.trim()} onClick={() => { void readCalendar(); }}>Read once and discard link</button>
          <p className="muted">Changing member, household, environment, link, or page cancels the in-flight reader.</p>
        </article>
        <article>
          <p className="kicker">Direct Gmail · read-only</p>
          <h3>Import my 7shifts mail</h3>
          <p className="muted">Google shows the consent screen. Hearth searches only mail matching 7shifts, verifies the sender domain again, encrypts each raw message, and cannot send, delete, label, archive, or forward mail.</p>
          <button type="button" className="chip" disabled={disabled} onClick={() => { void importGmail(); }}>{busy && gmailProgress ? "Scrubbing 7shifts mail…" : "Connect Gmail and scrub"}</button>
          {gmailProgress ? <p className="muted">Found {gmailProgress.discovered} · checked {gmailProgress.inspected} · new {gmailProgress.imported} · already saved {gmailProgress.duplicates} · rejected {gmailProgress.rejected}</p> : null}
          <p className="muted">The scan starts at January 1, 2024 and stops at 1,000 messages. Run it again safely; encrypted-message digests prevent duplicates.</p>
        </article>
        <article>
          <p className="kicker">Chrome / Edge companion</p>
          <h3>Pair one selected capture</h3>
          <input value={extensionId} disabled={disabled} autoComplete="off" spellCheck={false} placeholder="32-letter extension id" onChange={(event) => { setExtensionId(event.target.value); setPairingCode(""); }} />
          <button type="button" className="chip" disabled={disabled || !extensionId.trim()} onClick={() => { void pairExtension(); }}>Create five-minute code</button>
          {pairingCode ? <p><code>{pairingCode}</code></p> : null}
          <p className="muted">Paste the code into the companion. It authorizes one bounded upload for this exact member and then burns itself.</p>
        </article>
      </div>

      <hr />
      <p className="kicker">D-159 · deterministic authority</p>
      <h3>Automation by job</h3>
      <p className="muted">Off by default. Approved structured evidence, stable punches, or independently cross-checked screens may create a pending command. Models, calendars, and email never do.</p>
      <div className="stack-list" aria-label="7shifts automation policies">
        {memberJobs.length ? memberJobs.map((job) => {
          const policy = policies.find((row) => row.jobId === job.id);
          return (
            <label className="check-row" key={job.id}>
              <input type="checkbox" checked={policy?.enabled === true} disabled={disabled} onChange={(event) => { void togglePolicy(job.id, event.target.checked); }} />
              <span><strong>{job.name}</strong><br /><span className="muted">24h provisional stability · payroll-week correction · closed periods use variance review</span></span>
            </label>
          );
        }) : <p className="muted">Create a member-owned Shift job before enabling automation.</p>}
      </div>

      <hr />
      <header><h3>Encrypted captures</h3><span className="pill">{captures.length}</span></header>
      {selectedDerived ? <article ref={reviewRef} tabIndex={-1} className="preview" aria-label="Extracted evidence facts">
        <header><h3>Extracted facts</h3><button type="button" className="chip" onClick={() => { setSelectedDerived(null); setReplaceScheduleRange(false); }}>Close</button></header>
        <p className="muted">{selectedDerived.observations.length} recognized fact{selectedDerived.observations.length === 1 ? "" : "s"} · {selectedDerived.schemaDrift.length} unrecognized field{selectedDerived.schemaDrift.length === 1 ? "" : "s"} preserved · {selectedDerived.state.replace(/_/g, " ")}</p>
        {rosterRows.length ? <div className="stack-list" aria-label="Coworker identity review">
          <p><strong>{rosterRows.length} coworker{rosterRows.length === 1 ? "" : "s"} found</strong></p>
          <p className="muted">{rosterResponseCount ? `${rosterResponseCount} from a roster response` : ""}{rosterResponseCount && scheduleObservationCount ? " · " : ""}{scheduleObservationCount ? `${scheduleObservationCount} observed on published schedules` : ""}. These become private coworker IDs, not household members. Roles are observations for this job and location.</p>
          <label>Job and location<select value={rosterJob?.id ?? ""} onChange={(event) => setRosterJobId(event.target.value)}>
            {memberJobs.map((job) => <option key={job.id} value={job.id}>{job.name} · {job.locationName}</option>)}
          </select></label>
          <div className="chips">{rosterRows.slice(0, 30).map((row, index) => <span className="chip" key={`${row.source}:${row.sourceIdentityKey ?? `${row.displayName}:${index}`}`}>{row.displayName}{row.roleLabel ? ` · ${row.roleLabel}` : ""}{row.source === "seven-shifts-schedule" ? ` · schedule${row.sourceIdentityKey ? "" : " · confirm identity"}` : ""}</span>)}</div>
          {rosterRows.length > 30 ? <p className="muted">And {rosterRows.length - 30} more.</p> : null}
          {scheduleRange ? <label className="check-row"><input type="checkbox" checked={replaceScheduleRange} onChange={(event) => setReplaceScheduleRange(event.target.checked)} /> This capture is the complete published schedule from {scheduleRange.fromDate} through {scheduleRange.toDate}. Remove saved shifts missing from this range.</label> : null}
          <button type="button" className="primary" disabled={disabled || !rosterJob || !onImportCoworkers} onClick={() => {
            if (!rosterJob || !onImportCoworkers) return;
            onImportCoworkers({
              jobId: rosterJob.id,
              locationName: rosterJob.locationName,
              rows: rosterRows,
              ...(replaceScheduleRange && scheduleRange ? { replaceScheduleRange: scheduleRange } : {}),
            });
            setNotice(`${rosterRows.length} coworker ${rosterRows.length === 1 ? "identity" : "identities"} sent to the private roster.`);
          }}>Add coworker identities to this job</button>
        </div> : null}
        {selectedDerived.observations.length ? <div className="stack-list">{selectedDerived.observations.map((item) => (
          <p key={item.observationId}><strong>{item.field.replace(/([A-Z])/g, " $1").toLowerCase()}</strong>: {displayEvidenceValue(item.value)} <span className="muted">· {item.finality} · {item.conflictState}</span></p>
        ))}</div> : <p className="muted">This source has no recognized shift facts yet. Its raw bytes are still retained.</p>}
        {selectedDerived.schemaDrift.length ? <details><summary>Preserved unrecognized fields</summary><div className="stack-list">{selectedDerived.schemaDrift.map((item) => (
          <p key={item.driftId}><strong>{item.fieldPath}</strong>: {displayEvidenceValue(item.value)}</p>
        ))}</div></details> : null}
      </article> : null}
      {captures.length ? <div className="stack-list">{captures.map((row) => (
        <article className="work-shift-history-row" key={row.evidenceId}>
          <div><strong>{captureLabel(row)}</strong><p className="muted">{row.state.replace(/_/g, " ")} · {Math.ceil(row.byteLength / 1024)} KB · revision {row.revision}</p></div>
          <div className="chips"><button type="button" className="chip" disabled={parentBusy || busy || !["ready_to_review", "bundled"].includes(row.state)} onClick={() => { void reviewDerived(row); }}>Review facts</button><button type="button" className="chip" disabled={parentBusy || busy} onClick={() => { void exportRaw(row); }}>Export raw</button><button type="button" className="chip danger" disabled={parentBusy || busy} onClick={() => { void remove(row); }}>Delete</button></div>
        </article>
      ))}</div> : <p className="muted">No encrypted evidence in this member scope.</p>}

      <header><h3>Normalized bundles</h3><span className="pill">{bundles.length}</span></header>
      {bundles.length ? <div className="stack-list">{bundles.map((row) => (
        <article className="work-shift-history-row" key={row.bundleId}>
          <div><strong>{row.bundle.startedAt.slice(0, 10)} · revision {row.bundle.revision}</strong><p className="muted">{row.state.replace(/_/g, " ")} · {row.bundle.evidence.length} source{row.bundle.evidence.length === 1 ? "" : "s"} · {row.bundle.observations.length} observations</p></div>
        </article>
      ))}</div> : <p className="muted">No normalized 7shifts bundles yet.</p>}
    </section>
  );
}
