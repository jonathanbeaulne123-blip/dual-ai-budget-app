import { useEffect, useRef, useState } from 'react';
import { readEntryLocal, writeEntryLocal, clearEntryLocal } from '../entryDraft.ts';
import { FEEDBACK_FIELDS, FEEDBACK_PAGES, FEEDBACK_OWNERS, FEEDBACK_URL, feedbackFromValues, feedbackReviewDigest, feedbackValues, feedbackError, missingFeedback, type FeedbackDraft, type FeedbackRecord, type FeedbackReview, type FeedbackReceipt } from './feedback.ts';
import type { WorkspaceProject, WorkspaceProposal } from './contracts.ts';

export function FeedbackReviewCard({ project, proposal, records, draftKey, connected, busy, onSave, onSubmit, onRefresh }: {
  project: WorkspaceProject; proposal: WorkspaceProposal; records: FeedbackRecord[]; draftKey: string; connected: boolean; busy: boolean;
  onSave: (values: Record<string, string>, revision: number, projectRevision: number) => Promise<boolean>;
  onSubmit: (review: FeedbackReview, digest: string) => Promise<FeedbackReceipt>;
  onRefresh: () => Promise<void>;
}) {
  type Local = { draft: FeedbackDraft; proposalRevision: number; projectRevision: number; review?: FeedbackReview };
  const saved = useRef(readEntryLocal<Local>(draftKey));
  const remoteReview = records.find(r => r.review.proposalId === proposal.id && r.receipt.status !== 'prepared')?.review;
  const [draft, setDraft] = useState(saved.current?.review?.draft ?? remoteReview?.draft ?? saved.current?.draft ?? feedbackFromValues(proposal.values));
  const [base, setBase] = useState({ proposal: saved.current?.proposalRevision ?? proposal.revision, project: saved.current?.projectRevision ?? project.revision });
  const [changed, setChanged] = useState(!!saved.current);
  const record = records.find(r => r.review.proposalId === proposal.id && r.receipt.status !== 'prepared');
  const [pending, setPending] = useState<FeedbackReview | null>(record?.receipt.status !== 'accepted' ? record?.review ?? saved.current?.review ?? null : null);
  const [receipt, setReceipt] = useState<FeedbackReceipt | null>(record?.receipt ?? (proposal.status === 'accepted' && proposal.receiptId ? { id: proposal.receiptId, digest: '', status: 'accepted', reportId: `H-${proposal.receiptId}` } : null));
  const [notice, setNotice] = useState(''), [working, setWorking] = useState(false);
  const alive = useRef(true), inFlight = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => {
    if (record) { setReceipt(record.receipt); if (record.receipt.status !== 'accepted') { setPending(record.review); setDraft(record.review.draft); } else { setPending(null); clearEntryLocal(draftKey); } }
  }, [record?.review.id, record?.receipt.status]);
  useEffect(() => {
    if (!changed && !pending) { setDraft(feedbackFromValues(proposal.values)); setBase({ proposal: proposal.revision, project: project.revision }); }
  }, [proposal.revision, project.revision, proposal.values, changed, pending]);
  useEffect(() => { if (changed || pending) writeEntryLocal(draftKey, { draft, proposalRevision: base.proposal, projectRevision: base.project, ...(pending ? { review: pending } : {}) }); }, [draft, changed, pending, draftKey, base]);
  const locked = !!pending || receipt?.status === 'accepted';
  const stale = proposal.status === 'stale' || (changed && base.proposal !== proposal.revision);
  const missing = missingFeedback(draft);
  function edit(key: keyof FeedbackDraft, value: FeedbackDraft[keyof FeedbackDraft]) { setDraft(d => ({ ...d, [key]: value })); setChanged(true); setNotice(''); }
  async function save() {
    if (inFlight.current) return;
    inFlight.current = true; setWorking(true);
    try { if (await onSave(feedbackValues(draft), proposal.revision, project.revision)) { clearEntryLocal(draftKey); if (alive.current) { setChanged(false); setNotice('Your edits are saved for Hercules.'); } } }
    catch { if (alive.current) setNotice('Check the fields before saving. Urgency must be a whole number from 1 to 10.'); }
    finally { inFlight.current = false; if (alive.current) setWorking(false); }
  }
  async function submit() {
    if (inFlight.current) return;
    const review = pending ?? { id: crypto.randomUUID(), projectId: project.id, proposalId: proposal.id, proposalRevision: proposal.revision, instructionRevision: project.instructionRevision, draft };
    let digest: string;
    try { digest = feedbackReviewDigest(review); } catch { setNotice(feedbackError('FEEDBACK_DETAILS_REQUIRED')); return; }
    if (!writeEntryLocal(draftKey, { draft, proposalRevision: base.proposal, projectRevision: base.project, review })) { setNotice('Allow private draft storage so this report can be recovered if the connection drops.'); return; }
    inFlight.current = true; setWorking(true); setPending(review);
    try {
      const result = await onSubmit(review, digest);
      if (!alive.current) return;
      setReceipt(result);
      if (result.status === 'accepted') { clearEntryLocal(draftKey); setPending(null); setChanged(false); setNotice('Your report is in Hearth Feedback. Thank you for helping me look after this place.'); }
      else if (result.status === 'prepared') { setPending(null); writeEntryLocal(draftKey, { draft, proposalRevision: base.proposal, projectRevision: base.project }); setNotice(feedbackError(result.error)); }
      else setNotice('The sheet has not confirmed the result yet. Check this original report before sending another.');
      await onRefresh();
    } catch (error) {
      if (alive.current) {
        const code = error instanceof Error ? error.message : '';
        if (/^FEEDBACK_(CHANGED|REVIEW_CHANGED|DETAILS_REQUIRED|RATE_LIMIT|RECEIPT_PENDING)$/.test(code)) { setPending(null); writeEntryLocal(draftKey, { draft, proposalRevision: base.proposal, projectRevision: base.project }); }
        setNotice(feedbackError(code));
        await onRefresh();
      }
    } finally { inFlight.current = false; if (alive.current) setWorking(false); }
  }
  return <article className="hw-feedback" aria-label="Bug report">
    <div className="hw-feedback-heading"><span aria-hidden="true">✎</span><div><p className="hw-eyebrow">A note for the Hearth workbench</p><h3>{receipt?.status === 'accepted' ? 'Report received' : 'Let’s put this right'}</h3></div></div>
    {receipt?.status === 'accepted' ? <p role="status">Saved to <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">Hearth Feedback</a>. Report {receipt.reportId}</p> : <>
      <p>Tell me what happened below. I’ll gather the details, and you can review the report here.</p>
      <details open={!!pending} className="hw-feedback-review"><summary>{pending ? 'Check the original report' : `Review report${missing.length ? ` · ${missing.length} details left` : ' · ready to send'}`}</summary>
        <p>The reviewed report goes to everyone with access to <a href={FEEDBACK_URL} target="_blank" rel="noreferrer">Hearth Feedback</a>. Include only details you want to share.</p>
        <div className="hw-feedback-fields">
          {(Object.entries(FEEDBACK_FIELDS) as Array<[keyof typeof FEEDBACK_FIELDS, string]>).map(([key, label]) => <label key={key}>{label}{key === 'page' || key === 'owner' ? <select disabled={locked || working} value={draft[key]} onChange={e => edit(key, e.target.value)}><option value="">Choose…</option>{(key === 'page' ? FEEDBACK_PAGES : FEEDBACK_OWNERS).map(v => <option key={v}>{v}</option>)}</select> : key === 'urgency' ? <input type="number" min="1" max="10" step="1" disabled={locked || working} value={draft.urgency} onChange={e => edit(key, e.target.value)} /> : key === 'feature' ? <input maxLength={300} disabled={locked || working} value={draft[key]} onChange={e => edit(key, e.target.value)}/> : <textarea rows={3} maxLength={key === 'issue' || key === 'steps' ? 4000 : key === 'example' ? 3000 : 2000} disabled={locked || working} value={draft[key]} onChange={e => edit(key, e.target.value)}/>}</label>)}
        </div>
        <fieldset className="hw-feedback-context"><legend>App context included</legend><p>Remove any detail before sending. Books, screenshots and conversation history are excluded.</p>{Object.entries(draft.context).map(([key, value]) => <label key={key}><input type="checkbox" checked disabled={locked || working} onChange={() => { const context = { ...draft.context }; delete context[key as keyof typeof context]; edit('context', context); }}/><span>{key}: {value}</span></label>)}</fieldset>
        {missing.length > 0 && <p>Still needed: {missing.join(', ')}. It’s okay to say you don’t know.</p>}
        {changed && !locked && <button disabled={busy || working} onClick={() => void save()}>{base.proposal !== proposal.revision ? 'Keep my edits over Hercules’s update' : 'Save report edits for Hercules'}</button>}
        {stale && !locked && <p>The conversation changed this draft. Save your edits or ask Hercules to update the report before submitting.</p>}
        {!connected && !pending && <p>The sheet connection needs setup. You can keep working on your report.</p>}
        <button disabled={busy || working || !pending && (!connected || !!missing.length || stale || changed)} onClick={() => void submit()}>{working ? 'Checking…' : pending ? 'Check original report receipt' : 'Submit this report'}</button>
        <small>New reports start as Not started. Priority and resolution scores remain for the people fixing the issue.</small>
      </details>
    </>}
    {notice && <p role="status">{notice}</p>}
  </article>;
}
