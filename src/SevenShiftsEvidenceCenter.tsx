import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseSevenShiftsCalendar,
  type Household,
  type SevenShiftsScheduledShift,
} from "./core/index.ts";
import {
  deleteEvidence,
  listEvidence,
  listEvidenceBundles,
  mintEvidenceCaptureCapability,
  registerEvidenceCompanion,
  listEvidenceCompanions,
  revokeEvidenceCompanion,
  mapEvidenceOwnerJob,
  readEvidenceDerived,
  readEvidenceRaw,
  readEvidenceStatus,
  readSevenShiftsCalendarEvidence,
  uploadEvidence,
  type EvidenceBundleSummary,
  type EvidenceCaptureSummary,
  type EvidenceDerivedDetail,
  type EvidenceScope,
  type EvidenceCompanionRegistration,
} from "./imports/evidenceClient.ts";
import { importSevenShiftsFromGmail, type GmailSevenShiftsImportProgress } from "./google/gmailSevenShifts.ts";
import { coworkerRosterDraft, type CoworkerRosterImportDraft } from "./imports/coworkerRosterDraft.ts";
import { approvedPunchShiftDrafts, type ApprovedPunchShiftDraft } from "./imports/evidenceShiftDraft.ts";

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

function reviewedOwnerMappingSource(detail: EvidenceDerivedDetail | null, roleName: string): { evidenceId: string; canonicalShiftKey: string } | null {
  const expectedRole = roleName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA").replace(/[^a-z0-9]+/g, " ").trim();
  const matches = (detail?.derivatives ?? []).flatMap((row) => {
    const facts = row.facts && typeof row.facts === "object" ? (row.facts as { bundleFacts?: Record<string, unknown> }).bundleFacts : null;
    const valid = facts?.ownerAsserted === true
      && typeof facts.providerSubjectKey === "string" && /^s7subject_[a-f0-9]{64}$/.test(facts.providerSubjectKey)
      && typeof facts.providerLocationKey === "string" && /^s7location_[a-f0-9]{64}$/.test(facts.providerLocationKey)
      && typeof facts.providerRoleKey === "string" && /^s7role_[a-f0-9]{64}$/.test(facts.providerRoleKey);
    const observedRole = detail?.observations.find((observation) => observation.canonicalShiftKey === row.canonicalShiftKey && observation.field === "observedRole")?.value;
    const normalizedObservedRole = String(observedRole || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("en-CA").replace(/[^a-z0-9]+/g, " ").trim();
    return valid && normalizedObservedRole === expectedRole ? [{ row, signature: `${facts!.providerSubjectKey}:${facts!.providerLocationKey}:${facts!.providerRoleKey}` }] : [];
  });
  return matches.length && new Set(matches.map((match) => match.signature)).size === 1 && detail
    ? { evidenceId: detail.evidenceId, canonicalShiftKey: matches[0]!.row.canonicalShiftKey }
    : null;
}

export function SevenShiftsEvidenceCenter({
  household,
  memberId,
  memberName,
  today,
  busy: parentBusy,
  onSaveSchedule,
  onImportCoworkers,
  onUseShiftDraft,
}: {
  household: Household;
  memberId: string;
  memberName: string;
  today: string;
  busy: boolean;
  onSaveSchedule: (rows: SevenShiftsScheduledShift[], confirmedPersonalFeed?: boolean) => void;
  onImportCoworkers?: (input: CoworkerRosterImportDraft) => void;
  onUseShiftDraft?: (candidate: ApprovedPunchShiftDraft) => void;
}) {
  const scope = useMemo<EvidenceScope>(() => ({ environment: household.environment, householdId: household.householdId, memberId }), [household.environment, household.householdId, memberId]);
  const scopeKey = `${scope.environment}:${scope.householdId}:${scope.memberId}`;
  const controllerRef = useRef<AbortController | null>(null);
  const reviewRef = useRef<HTMLElement | null>(null);
  const [available, setAvailable] = useState(false);
  const [detail, setDetail] = useState("Evidence Mesh is checking this environment gate.");
  const [captures, setCaptures] = useState<EvidenceCaptureSummary[]>([]);
  const [bundles, setBundles] = useState<EvidenceBundleSummary[]>([]);
  const [selectedDerived, setSelectedDerived] = useState<EvidenceDerivedDetail | null>(null);
  const [calendarUrl, setCalendarUrl] = useState("");
  const [gmailProgress, setGmailProgress] = useState<GmailSevenShiftsImportProgress | null>(null);
  const [extensionId, setExtensionId] = useState("");
  const [pairingCode, setPairingCode] = useState("");
  const [companionToken, setCompanionToken] = useState("");
  const [companions, setCompanions] = useState<EvidenceCompanionRegistration[]>([]);
  const [ownerJobId, setOwnerJobId] = useState("");
  const [ownerRoleId, setOwnerRoleId] = useState("");
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
    setSelectedDerived(null);
    setCompanions([]);
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
        const [nextCaptures, nextBundles, nextCompanions] = await Promise.all([
          listEvidence(scope, controller.signal),
          listEvidenceBundles(scope, controller.signal),
          listEvidenceCompanions(scope, controller.signal).catch(() => []),
        ]);
        if (controller.signal.aborted) return;
        setCaptures(nextCaptures);
        setBundles(nextBundles);
        setCompanions(nextCompanions);
      } catch (caught) {
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : String(caught));
      }
    })();
    return () => controller.abort();
  }, [scopeKey]);

  async function refresh(signal?: AbortSignal) {
    const [nextCaptures, nextBundles, nextCompanions] = await Promise.all([
      listEvidence(scope, signal),
      listEvidenceBundles(scope, signal),
      listEvidenceCompanions(scope, signal).catch(() => []),
    ]);
    setCaptures(nextCaptures);
    setBundles(nextBundles);
    setCompanions(nextCompanions);
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

  async function registerCompanion() {
    const id = extensionId.trim().toLowerCase();
    if (!/^[a-p]{32}$/.test(id)) { setError("Enter the 32-letter extension id shown by Chrome or Edge."); return; }
    setBusy(true); setError(""); setCompanionToken("");
    try {
      const result = await registerEvidenceCompanion(scope, { origin: `chrome-extension://${id}`, label: `${memberName}'s 7shifts companion` });
      setCompanionToken(result.token);
      setCompanions((rows) => [...rows, result]);
      setNotice("Capture-only companion token created. Paste it into the extension now; Hearth will not show it again.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  async function revokeCompanion(registrationId: string) {
    setBusy(true); setError("");
    try {
      await revokeEvidenceCompanion(scope, registrationId);
      setCompanions((rows) => rows.filter((row) => row.registrationId !== registrationId));
      setNotice("That companion registration is revoked. Its token can no longer upload.");
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
  }

  async function saveOwnerMapping() {
    const job = memberJobs.find((row) => row.id === ownerJobId) ?? memberJobs[0];
    const role = job?.roles.find((row) => row.id === ownerRoleId && row.active) ?? job?.roles.find((row) => row.active);
    const source = reviewedOwnerMappingSource(selectedDerived, role?.name || "");
    if (!job || !role || !source) { setError("Review one of your captured 7shifts shifts first, then choose its exact Hearth job and role."); return; }
    setBusy(true); setError("");
    try {
      await mapEvidenceOwnerJob(scope, { jobId: job.id, roleId: role.id, ...source });
      setNotice(`Your employee-visible My Timesheets rows now map to ${job.name} · ${role.name}. Existing raw captures can be reviewed again after derivation reruns.`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : String(caught)); }
    finally { setBusy(false); }
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
  const selectedOwnerJob = memberJobs.find((job) => job.id === (ownerJobId || memberJobs[0]?.id));
  const selectedOwnerRole = selectedOwnerJob?.roles.find((role) => role.id === (ownerRoleId || selectedOwnerJob.roles.find((candidate) => candidate.active)?.id));
  const ownerMappingSource = reviewedOwnerMappingSource(selectedDerived, selectedOwnerRole?.name || "");
  const rosterRows = coworkerRosterDraft(selectedDerived);
  const punchDrafts = approvedPunchShiftDrafts(selectedDerived, memberJobs.map((job) => ({
    jobId: job.id,
    activeRoleIds: job.roles.filter((role) => role.active).map((role) => role.id),
  })));
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
          <h3>Pair selected or autonomous capture</h3>
          <input value={extensionId} disabled={disabled} autoComplete="off" spellCheck={false} placeholder="32-letter extension id" onChange={(event) => { setExtensionId(event.target.value); setPairingCode(""); }} />
          <button type="button" className="chip" disabled={disabled || !extensionId.trim()} onClick={() => { void pairExtension(); }}>Create five-minute code</button>
          {pairingCode ? <p><code>{pairingCode}</code></p> : null}
          <p className="muted">Paste the code into the companion. It authorizes one bounded upload for this exact member and then burns itself.</p>
          <button type="button" className="chip" disabled={disabled || !extensionId.trim()} onClick={() => { void registerCompanion(); }}>Create revocable autonomous token</button>
          {companionToken ? <p><code>{companionToken}</code></p> : null}
          <p className="muted">Capture-only. It cannot read evidence, books, household data, or commands. Automatic checks run only while Chrome is running. Development activation remains separately gated.</p>
          {companions.length ? <div className="stack-list" aria-label="Registered companions">{companions.map((row) => <div className="work-shift-history-row" key={row.registrationId}><div><strong>{row.label}</strong><p className="muted">Expires {new Date(row.expiresAt).toLocaleDateString()}</p></div><button type="button" className="chip danger" disabled={disabled} onClick={() => { void revokeCompanion(row.registrationId); }}>Revoke</button></div>)}</div> : null}
          {memberJobs.length ? <div className="work-form-grid">
            <label>My 7shifts job<select value={ownerJobId || memberJobs[0]?.id || ""} onChange={(event) => { setOwnerJobId(event.target.value); setOwnerRoleId(""); }}>{memberJobs.map((job) => <option value={job.id} key={job.id}>{job.name}</option>)}</select></label>
            <label>My usual role<select value={ownerRoleId || (memberJobs.find((job) => job.id === (ownerJobId || memberJobs[0]?.id))?.roles.find((role) => role.active)?.id ?? "")} onChange={(event) => setOwnerRoleId(event.target.value)}>{(memberJobs.find((job) => job.id === (ownerJobId || memberJobs[0]?.id))?.roles ?? []).filter((role) => role.active).map((role) => <option value={role.id} key={role.id}>{role.name}</option>)}</select></label>
            <button type="button" className="chip" disabled={disabled || !ownerMappingSource} onClick={() => { void saveOwnerMapping(); }}>Bind reviewed 7shifts role to this job</button>
            {!ownerMappingSource ? <p className="muted">Review one captured self schedule or timesheet row first. Hearth binds its stable employee, location, and role identifiers—not a display name.</p> : null}
          </div> : null}
        </article>
      </div>

      <hr />
      <p className="kicker">D-172 · visible authority</p>
      <h3>Autonomous collection, human Confirm</h3>
      <p className="muted">Background sources may create and update Shift mail. They cannot post wages, tips, sales, corrections, or journal rows. Open the envelope and use the ordinary four-step Confirm.</p>

      <hr />
      <header><h3>Encrypted captures</h3><span className="pill">{captures.length}</span></header>
      {selectedDerived ? <article ref={reviewRef} tabIndex={-1} className="preview" aria-label="Extracted evidence facts">
        <header><h3>Extracted facts</h3><button type="button" className="chip" onClick={() => { setSelectedDerived(null); setReplaceScheduleRange(false); }}>Close</button></header>
        <p className="muted">{selectedDerived.observations.length} recognized fact{selectedDerived.observations.length === 1 ? "" : "s"} · {selectedDerived.schemaDrift.length} unrecognized field{selectedDerived.schemaDrift.length === 1 ? "" : "s"} preserved · {selectedDerived.state.replace(/_/g, " ")}</p>
        {punchDrafts.length ? <div className="stack-list" aria-label="Approved punch Shift drafts">
          <p><strong>{punchDrafts.length} approved worked punch{punchDrafts.length === 1 ? "" : "es"}</strong></p>
          <p className="muted">Use one to prefill Shift review. Tips, sales, covers, and staffing stay blank; this action never posts.</p>
          {punchDrafts.map((candidate) => (
            <article className="work-shift-history-row" key={candidate.canonicalShiftKey}>
              <div><strong>{candidate.draft.date} · {Number(candidate.draft.workedHours).toFixed(2)} h</strong><p className="muted">{candidate.finality}{candidate.missingPaidBreak ? " · paid break missing" : ` · ${Number(candidate.draft.paidBreakHours).toFixed(2)} h paid break`}</p></div>
              <button type="button" className="primary" disabled={disabled || !onUseShiftDraft} onClick={() => onUseShiftDraft?.(candidate)}>Use as Shift draft</button>
            </article>
          ))}
        </div> : null}
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
