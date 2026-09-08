import { useEffect, useRef, useState } from "react";
import { newConfirmationId } from "./core/commandIdentity.ts";
import { WorkShiftFlow, type WorkShiftFormState } from "./WorkShiftFlow.tsx";
import { clearAcceptedCountDraft, countDraftKey, countSourceIdentity, newCountDraft, readCountDraft, saveCountDraft, type CountSource, type CountDraft, type CountDraftStamp, type WorkShiftDraftCallbacks } from "./workCountDraft.ts";

type Props = Omit<Parameters<typeof WorkShiftFlow>[0], "onConfirm" | "restored" | "onDraftChange"> & {
  onConfirm: (input: Parameters<Parameters<typeof WorkShiftFlow>[0]["onConfirm"]>[0], attendance?: Parameters<Parameters<typeof WorkShiftFlow>[0]["onConfirm"]>[1], callbacks?: WorkShiftDraftCallbacks) => void;
  onAccepted?: () => void;
  readSubmissionStatus?: (id: string) => Promise<"accepted" | "pending" | "rejected" | "missing">;
};
const acceptedEvent = "hearth:count-draft-accepted";
const rejectedEvent = "hearth:count-draft-rejected";

/** One private, tab-local draft per ledger/member, shared by Add and the Shift room. */
export function RecoverableWorkShiftFlow(props: Props) {
  const key = countDraftKey({ environment: props.household.environment, householdId: props.household.householdId, memberId: props.memberId });
  const incoming: CountSource = { initialDraft: props.initialDraft ?? null, inboxDraft: props.inboxDraft ?? null, punch: props.punch, warnings: props.scanWarnings ?? [], envelopeVersion: props.initialDraft?.shiftEnvelopeId ? JSON.stringify(props.household.shiftEnvelopes?.find(row => row.id === props.initialDraft?.shiftEnvelopeId)) : undefined };
  const [entry, setEntry] = useState(() => readCountDraft(sessionStorage, key) ?? newCountDraft(incoming));
  const current = useRef(entry);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [retired, setRetired] = useState(() => {
    try { return !entry.form && Boolean(incoming.initialDraft || incoming.inboxDraft || incoming.punch) && JSON.parse(sessionStorage.getItem(`${key}:accepted`) ?? "null")?.sourceIdentity === countSourceIdentity(incoming); }
    catch { return false; }
  });
  const [reload, setReload] = useState(0);
  const [receiptNotice, setReceiptNotice] = useState("");
  const statusReader = useRef(props.readSubmissionStatus); statusReader.current = props.readSubmissionStatus;
  const [pending, setPending] = useState(Boolean(entry.submission));
  const [storageError, setStorageError] = useState("");
  const sourceChanged = incoming.inboxDraft ? JSON.stringify(incoming.inboxDraft) !== JSON.stringify(entry.source.inboxDraft)
    : incoming.initialDraft ? JSON.stringify(incoming.initialDraft) !== JSON.stringify(entry.source.initialDraft) || incoming.envelopeVersion !== entry.source.envelopeVersion
    : incoming.punch ? JSON.stringify(incoming.punch) !== JSON.stringify(entry.source.punch) : false;
  const source = entry.source;
  const envelopeId = source.initialDraft?.shiftEnvelopeId;
  const envelope = envelopeId ? props.household.shiftEnvelopes?.find(row => row.id === envelopeId) : null;
  const sourceUnavailable = Boolean(envelopeId && (!envelope || envelope.status !== "worked_ready" || JSON.stringify(envelope) !== source.envelopeVersion));
  const incomingEnvelope = incoming.initialDraft?.shiftEnvelopeId ? props.household.shiftEnvelopes?.find(row => row.id === incoming.initialDraft?.shiftEnvelopeId) : null;
  const incomingReady = !incoming.initialDraft?.shiftEnvelopeId || Boolean(incomingEnvelope
    && incomingEnvelope.status === "worked_ready"
    && incomingEnvelope.date === incoming.initialDraft.date && incomingEnvelope.jobId === incoming.initialDraft.jobId && incomingEnvelope.roleId === incoming.initialDraft.roleId
    && Math.round(Number(incoming.initialDraft.workedHours) * 60) === incomingEnvelope.workedMinutes
    && (!incomingEnvelope.actualStart || incomingEnvelope.actualStart === incoming.initialDraft.startedAt)
    && (!incomingEnvelope.actualEnd || incomingEnvelope.actualEnd === incoming.initialDraft.endedAt));
  const acknowledge = (stamp: CountDraftStamp) => {
    if (!clearAcceptedCountDraft(sessionStorage, stamp)) return;
    window.dispatchEvent(new CustomEvent(acceptedEvent, { detail: stamp }));
  };
  useEffect(() => {
    const receive = (event: Event) => {
      const stamp = (event as CustomEvent<CountDraftStamp>).detail;
      if (stamp.key !== key || stamp.id !== current.current.id) return;
      setRetired(true); setPending(false);
      if (!sourceChanged) { props.onClearDraft?.(); props.onAccepted?.(); }
    };
    const rejected = (event: Event) => {
      const stamp = (event as CustomEvent<CountDraftStamp>).detail;
      if (stamp.key !== key || stamp.id !== current.current.id || current.current.submission?.confirmationId !== stamp.confirmationId) return;
      const saved = readCountDraft(sessionStorage, key);
      if (!saved || saved.id !== stamp.id || saved.submission) return;
      current.current = saved; setPending(false); setReceiptNotice("");
    };
    window.addEventListener(acceptedEvent, receive); window.addEventListener(rejectedEvent, rejected);
    return () => { window.removeEventListener(acceptedEvent, receive); window.removeEventListener(rejectedEvent, rejected); };
  });
  const reject = (stamp: CountDraftStamp) => {
    const saved = readCountDraft(sessionStorage, key);
    if (!saved || saved.id !== stamp.id || saved.revision !== stamp.revision || saved.submission?.confirmationId !== stamp.confirmationId) return;
    sessionStorage.setItem(key, JSON.stringify({ ...saved, revision: saved.revision + 1, submission: undefined }));
    window.dispatchEvent(new CustomEvent(rejectedEvent, { detail: stamp }));
  };
  useEffect(() => {
    if (!pending || !statusReader.current) return;
    let active = true;
    const check = async () => {
      const row = current.current; if (!row.submission) return;
      const stamp = { key, id: row.id, revision: row.revision, confirmationId: row.submission.confirmationId };
      try {
        const status = await statusReader.current!(row.submission.confirmationId);
        if (!active) return;
        if (status === "accepted") acknowledge(stamp);
        else if (status === "rejected") reject(stamp);
      } catch { /* Unknown transport outcome retains the frozen command. */ }
    };
    void check(); window.addEventListener("online", check); window.addEventListener("focus", check);
    return () => { active = false; window.removeEventListener("online", check); window.removeEventListener("focus", check); };
  }, [entry.id, pending, props.household.revision]);

  const save = (form: WorkShiftFormState) => {
    if (retired || storageError) return;
    try { current.current = saveCountDraft(sessionStorage, key, current.current, form); }
    catch (error) { setStorageError(error instanceof Error ? error.message : "This browser could not save the draft. Keep this page open."); }
  };
  const replace = (nextSource: CountSource) => {
    const saved = readCountDraft(sessionStorage, key);
    const freshAfterReceipt = retired && !saved;
    if (!freshAfterReceipt && (!saved || saved.id !== current.current.id || saved.revision !== current.current.revision || saved.submission)) {
      setStorageError("This draft changed in another open form. Reopen it to continue."); return false;
    }
    const next = newCountDraft(nextSource);
    try { sessionStorage.setItem(key, JSON.stringify(next)); setStorageError(""); } catch { setStorageError("This browser could not save the draft. Keep this page open."); return false; }
    current.current = next; setRetired(false); setPending(false); setEntry(next); return true;
  };
  const submit = (row: CountDraft) => {
    if (!row.submission) return;
    const stamp = { key, id: row.id, revision: row.revision, confirmationId: row.submission.confirmationId };
    props.onConfirm(row.submission.input, row.submission.attendance, {
      scope: { environment: props.household.environment, householdId: props.household.householdId, memberId: props.memberId },
      onAccepted: () => acknowledge(stamp),
      onRejected: () => reject(stamp),
    });
  };
  const retry = async () => {
    const row = current.current; if (!row.submission) return;
    try {
      const status = await statusReader.current?.(row.submission.confirmationId);
      if (!mounted.current) return;
      const saved = readCountDraft(sessionStorage, key);
      if (!saved || saved.id !== row.id || saved.revision !== row.revision) return;
      const stamp = { key, id: row.id, revision: row.revision, confirmationId: row.submission.confirmationId };
      if (status === "accepted") acknowledge(stamp);
      else if (status === "rejected") reject(stamp);
      else if (status === "pending") setReceiptNotice("This exact shift is saved in the queue and will resume with the connection.");
      else submit(row);
    } catch { setReceiptNotice("The receipt could not be checked. Your submitted figures remain saved."); }
  };
  if (retired) return <div className="work-shift-draft-banner" role="status"><p>Shift accepted.</p><button type="button" className="chip" disabled={props.busy} onClick={() => { if (replace({ initialDraft: null, inboxDraft: null, punch: null, warnings: [] })) props.onClearDraft?.(); }}>Start another draft</button></div>;
  return <>
    {storageError ? <div role="alert"><p>{storageError}</p><button type="button" className="chip" onClick={() => { const saved = readCountDraft(sessionStorage, key); if (saved) { current.current = saved; setEntry(saved); setReload(value => value + 1); setStorageError(""); setPending(Boolean(saved.submission)); } }}>Reopen saved draft</button></div> : null}
    {pending ? <div className="work-shift-draft-banner" role="status"><p>Waiting for this shift’s receipt. Your submitted figures are saved.</p><button type="button" className="chip" disabled={props.busy} onClick={() => void retry()}>Retry Confirm</button>{receiptNotice ? <p>{receiptNotice}</p> : null}</div> : null}
    {!pending && (sourceChanged || sourceUnavailable) ? <div className="work-shift-draft-banner" role="status">
      <p>{sourceUnavailable ? "The captured shift changed. Your figures are retained; reopen its current review." : "The source changed. Your saved figures are retained; review the new source before posting."}</p>
      {sourceChanged && incomingReady ? <button type="button" className="chip" disabled={props.busy} onClick={() => replace(incoming)}>Use new source</button> : null}
      <button type="button" className="chip" disabled={props.busy} onClick={() => { if (replace({ initialDraft: null, inboxDraft: null, punch: props.punch, warnings: [] })) props.onClearDraft?.(); }}>Discard saved draft</button>
    </div> : null}
    <fieldset disabled={pending} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
    <WorkShiftFlow {...props} key={`${entry.id}:${reload}`} initialDraft={source.initialDraft} inboxDraft={source.inboxDraft} punch={source.punch} scanWarnings={source.warnings}
      restored={entry.form ?? undefined} onDraftChange={save}
      busy={props.busy || pending || sourceChanged || sourceUnavailable || Boolean(storageError)}
      onClearDraft={() => { if (replace({ initialDraft: null, inboxDraft: null, punch: props.punch, warnings: [] })) props.onClearDraft?.(); }}
      onConfirm={(input, attendance) => {
        if (pending || sourceChanged || sourceUnavailable || storageError) return;
        const saved = readCountDraft(sessionStorage, key);
        if (!saved || saved.id !== current.current.id || saved.revision !== current.current.revision) { setStorageError("This draft changed in another open form. Reopen it to continue."); return; }
        const confirmationId = newConfirmationId();
        const next = { ...saved, revision: saved.revision + 1, submission: { confirmationId, input: { ...input, confirmationId }, attendance } };
        try { sessionStorage.setItem(key, JSON.stringify(next)); }
        catch { setStorageError("This browser could not save the submitted draft. Confirm has not run."); return; }
        current.current = next; setPending(true); submit(next);
      }} />
    </fieldset>
  </>;
}
