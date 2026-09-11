import { HerculesPlanGuide } from './HerculesPlanGuide.tsx';
import { PLAN_GUIDE_ID, guideAnswer, guideBack, guideQuestion, guideReply, parseGuidePaydays } from './core/planGuide.ts';
import { cancelHerculesSubmission, nextHerculesTask } from './core/herculesExecution.ts';
import { NeedsConfirmationError } from "./core/types.ts";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { compoundHerculesActions, actionCorrection, actionFields, actionById, availableHerculesActions, findHerculesAction, initialActionValues, isFinalConfirm, missingActionField, parseActionAnswer, prepareAction, type ActionContext, type ActionReview } from './core/herculesActions.ts';
import { companionFor, commitCompanion } from './core/herculesCompanion.ts';
import { decodeCompanionWorkflow, type CompanionWorkflow } from './core/herculesCompanionContracts.ts';
import { readEntryLocal, writeEntryLocal, clearEntryLocal } from './entryDraft.ts';
import { submitHerculesReview, type HerculesCommandService } from './herculesCommandService.ts';
export type HerculesActionHandle = {
    send: (message: string) => boolean;
    state: () => import("./core/herculesCompanionContracts.ts").CompanionChatRequestV2["workflow"];
    fingerprint: () => string;
    propose: (proposal: {
        actionId: string;
        values: Record<string, string>;
    }, expectedFingerprint?: string) => void;
};
type Props = {
    onReady?: () => void;
    composerAvailable?: boolean;
    context: ActionContext;
    service: HerculesCommandService;
    identity: string;
    onReply: (question: string, reply: string) => void;
};
export const HerculesActionPanel = forwardRef<HerculesActionHandle, Props>(function HerculesActionPanel({ context: c, service, identity, onReply, onReady, composerAvailable = true }, ref) {
    useEffect(()=>{onReady?.();},[onReady]);
    const profile = companionFor(c.household, c.memberId), generation = profile.conversations.find(r => r.view === c.view)!.generation;
    const resourceId = `task-${c.view}`, key = JSON.stringify(['hercules-task-v1', identity, c.household.environment, c.household.householdId, c.memberId, c.view, generation]);
    const resource = profile.workflows?.find(r => r.id === resourceId);
    const [draft, setDraft] = useState<CompanionWorkflow | null>(() => { try {
        const local = readEntryLocal<{
            workflow: CompanionWorkflow;
            baseRevision: number; resolved?: string; releaseFloor?: number;
        }>(key);
        if (local?.resolved) return null;
        return local && (local.baseRevision === (resource?.revision ?? 0) || local.workflow?.submission) ? decodeCompanionWorkflow(local.workflow) : resource?.value ?? null;
    }
    catch {
        return resource?.value ?? null;
    } });
    const [guidePaused, setGuidePaused] = useState(false);
    const [duplicateWarning, setDuplicateWarning] = useState(''), [duplicateAck, setDuplicateAck] = useState(false);
    const [review, setReview] = useState<ActionReview | null>(null), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [library, setLibrary] = useState(false);
    const reviewHeadingRef = useRef<HTMLHeadingElement>(null);
    const actionCardRef = useRef<HTMLElement>(null);
    useEffect(() => { if (review) reviewHeadingRef.current?.focus(); }, [review]);
    const current = useRef({ c, service, onReply, key, generation });
    current.current = { c, service, onReply, key, generation };
    const resolvedIdentity = useRef<string | null>(readEntryLocal<{resolved?: string}>(key)?.resolved ?? null);
    // A receipt may arrive before its projection. Never adopt a pre-claim draft.
    const releaseFloor = useRef((() => {
        const saved = readEntryLocal<{workflow: CompanionWorkflow; baseRevision: number; releaseFloor?: number}>(key);
        return saved?.releaseFloor ?? (saved?.workflow?.submission ? saved.baseRevision + 1 : resource?.value?.submission ? resource.revision + 1 : 0);
    })());
    const queuedDraft = useRef<{
        value: CompanionWorkflow | null;
    } | undefined>(undefined);
    const alive = useRef(true), locked = useRef(false), revision = useRef(resource?.revision ?? 0), draftRef = useRef(draft);
    draftRef.current = draft;
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    useEffect(() => { if (resolvedIdentity.current && resource?.value?.submission?.id !== resolvedIdentity.current && (resource?.revision ?? 0) >= releaseFloor.current && !locked.current) {
        resolvedIdentity.current = null;
        revision.current = resource?.revision ?? 0;
        local(resource?.value ?? null);
        return;
    } if (resolvedIdentity.current) return;
    if ((resource?.revision ?? 0) > revision.current && !locked.current) {
        revision.current = resource!.revision;
        if (draftRef.current?.submission && draftRef.current.submission.id !== resource!.value?.submission?.id) {
            setNotice('This task changed on another device. Check the original action status before continuing.');
            return;
        }
        setDraft(resource!.value);
        setReview(null);
        setDuplicateAck(false);
        setDuplicateWarning('');
        if (resource!.value)
            writeEntryLocal(key, { workflow: resource!.value, baseRevision: resource!.revision });
        else
            clearEntryLocal(key);
    } }, [resource, key, busy]);
    const valid = () => alive.current && current.current.key === key;
    function local(next: CompanionWorkflow | null) { draftRef.current = next; setDraft(next); setReview(null); setDuplicateWarning(''); setDuplicateAck(false); if (next) {
        if (!writeEntryLocal(key, { workflow: next, baseRevision: revision.current }))
            setNotice('This draft is only available while this tab stays open.');
    }
    else
        clearEntryLocal(key); }
    async function save(next: CompanionWorkflow | null) {
        const id = crypto.randomUUID(), op = { kind: 'workflow.set' as const, workflowId: resourceId, value: next, expectedRevision: revision.current, view: c.view, generation };
        const outcome = await service.execute(h => commitCompanion(h, { version: 1, id, scope: { environment: c.household.environment, householdId: c.household.householdId, memberId: c.memberId }, operation: op }), { confirmationId: id });
        if (!valid())
            return false;
        if (outcome?.ok && outcome.postedExactlyOnce) {
            revision.current = outcome.household.companionProfile?.workflows?.find(r => r.id === resourceId)?.revision ?? revision.current + 1;
            if (next?.submission) releaseFloor.current = revision.current + 1;
            if (next)
                writeEntryLocal(key, { workflow: next, baseRevision: revision.current });
            return true;
        }
        setNotice('Your draft is here, but its private save has not been confirmed. Reopen it after connecting to an updated Hearth.');
        return false;
    }
    async function change(next: CompanionWorkflow | null) { if (locked.current) {
        if (!draftRef.current?.submission) {
            local(next);
            queuedDraft.current = { value: next };
        }
        return;
    } locked.current = true; setBusy(true); local(next); try {
        await save(next);
    }
    catch {
        if (valid())
            setNotice('The draft is still here. Its private save could not be checked.');
    }
    finally {
        locked.current = false;
        if (valid()) {
            setBusy(false);
            const queued = queuedDraft.current;
            queuedDraft.current = undefined;
            if (queued)
                void change(queued.value);
        }
    } }
    function start(id: string, message = '', queue: NonNullable<CompanionWorkflow['queue']> = [], values?: Record<string, string>) {
        if (draftRef.current?.submission) {
            setNotice('Check the pending action before starting another.');
            return;
        }
        const a = actionById(id, c), next: CompanionWorkflow = { version: 1, actionId: id, view: c.view, generation, values: values ?? initialActionValues(a, message, c), queue, updatedAt: new Date().toISOString(), submission: null };
        void change(next);
        setLibrary(false);
        setGuidePaused(false);
        onReply(message || a.example, id === PLAN_GUIDE_ID ? guideReply(c,next.values) : missingActionField(a, next.values, c)?.question || 'Your details are ready to review.');
    }
    function prepareAccountFirst() {
        const currentDraft=draftRef.current;
        if (!currentDraft || currentDraft.submission || locked.current || (currentDraft.queue?.length ?? 0) >= 12) return;
        const accountAction=actionById('add-account', c);
        void change({...currentDraft,actionId:accountAction.id,values:initialActionValues(accountAction,'',c),
            queue:[{actionId:currentDraft.actionId,values:currentDraft.values},...(currentDraft.queue ?? [])],updatedAt:new Date().toISOString()});
        onReply('Add an account first','Let’s add the account, then return to these details. Each change will have its own review.');
    }
    function receiptResolved(id: string) {
        resolvedIdentity.current = id;
        const saved = readEntryLocal<{workflow: CompanionWorkflow; baseRevision: number}>(key);
        if (saved) writeEntryLocal(key, {...saved, resolved: id, releaseFloor: releaseFloor.current});
        draftRef.current = null; setDraft(null); setReview(null);
    }
    async function confirm() {
        const d = draftRef.current;
        if (!d || !review || locked.current || d.submission)
            return;
        locked.current = true;
        setBusy(true);
        const id = crypto.randomUUID(), pending = { ...d, values: review.values, submission: { id, review: JSON.stringify(review) }, updatedAt: new Date().toISOString() };
        try {
            if (JSON.stringify(prepareAction(current.current.c, d.actionId, d.values, review.duplicateAcknowledged)) !== JSON.stringify(review))
                throw Error('These details changed. Review them again.');
            validateReviewWorkflow(pending);
            if (!writeEntryLocal(key, { workflow: pending, baseRevision: revision.current }))
                throw Error('Allow browser storage before confirming so this action can be recovered.');
            local(pending);
            // Claim the private draft by revision before executing; another device cannot confirm the same predecessor.
            if (!await save(pending))
                return;
            if (!valid())
                return;
            const result = await submitHerculesReview(service, { memberId: c.memberId, view: c.view, today: c.today }, review, id, valid);
            if (!valid())
                return;
            setNotice(result.message);
            onReply('Final Confirm', result.message);
            if (result.state === 'accepted') {
                receiptResolved(id);
            }
            else if (result.state === 'rejected') {
                setNotice(result.message + ' Cancel this pending request to start a new review.');
            }
        }
        catch (e) {
            if (valid())
                setNotice(e instanceof Error ? e.message : String(e));
        }
        finally {
            locked.current = false;
            if (valid())
                setBusy(false);
        }
    }
    async function recover() {
        const d = draftRef.current;
        if (!d?.submission || locked.current)
            return;
        locked.current = true;
        setBusy(true);
        try {
            const status = await service.readSubmission(d.submission.id);
            if (!valid())
                return;
            if (status === 'accepted') {
                setNotice('Saved. The original confirmation was found.');
                receiptResolved(d.submission.id);
            }
            else if (status === 'pending')
                setNotice('This action is still pending. I will keep its original confirmation.');
            else if (status === 'rejected') {
                setNotice('Nothing changed. Cancel this pending request before starting a new review.');
            }
            else {
                const canonicalClaim = companionFor(current.current.c.household, c.memberId).workflows?.find(r => r.id === resourceId)?.value;
                if (!canonicalClaim?.submission || canonicalClaim.submission.id !== d.submission.id || canonicalClaim.submission.review !== d.submission.review) {
                    setNotice('This device did not acquire that task. Reopen the current private draft before confirming.');
                    local(canonicalClaim ?? null);
                    return;
                }
                const old = JSON.parse(d.submission.review) as ActionReview;
                if (JSON.stringify(prepareAction(current.current.c, d.actionId, d.values, old.duplicateAcknowledged)) !== JSON.stringify(old)) {
                    setNotice('The original review has changed. Keep this pending record until its status is resolved.');
                    return;
                }
                const result = await submitHerculesReview(service, { memberId: c.memberId, view: c.view, today: c.today }, old, d.submission.id, valid);
                if (!valid())
                    return;
                setNotice(result.message);
                if (result.state === 'accepted')
                    receiptResolved(d.submission.id);
            }
        }
        catch {
            if (valid())
                setNotice('I could not check the receipt. The original confirmation is still retained.');
        }
        finally {
            locked.current = false;
            if (valid())
                setBusy(false);
        }
    }
    async function cancelPending() {
        const d = draftRef.current;
        if (!d?.submission || locked.current)
            return;
        locked.current = true;
        setBusy(true);
        try {
            const outcome = await service.execute(h => cancelHerculesSubmission(h, { memberId: c.memberId, view: c.view, submissionId: d.submission!.id }), { confirmationId: crypto.randomUUID() });
            if (!valid())
                return;
            if (outcome?.ok && outcome.postedExactlyOnce) {
                receiptResolved(d.submission.id);
                setNotice('Cancelled the pending request. Any earlier accepted change remains in the books.');
            }
            else
                setNotice('Cancellation could not be confirmed. Check the original action status.');
        }
        catch {
            if (valid())
                setNotice('Check the original receipt before trying again.');
        }
        finally {
            locked.current = false;
            if (valid())
                setBusy(false);
        }
    }
    function validateReviewWorkflow(workflow: CompanionWorkflow) {
        try { decodeCompanionWorkflow(workflow); }
        catch { throw Error('This review is too large to save safely. Your answers are still editable. Shorten your notes or use Plan tools to review a smaller change.'); }
    }
    function showReview() { if (!draft)
        return; try {
        const prepared = prepareAction(c, draft.actionId, draft.values, duplicateAck);
        validateReviewWorkflow({...draft, values:prepared.values, submission:{id:crypto.randomUUID(),review:JSON.stringify(prepared)}});
        setReview(prepared);
        setNotice('Check the details, then use Final Confirm.');
    }
    catch (e) {
        setReview(null);
        if (e instanceof NeedsConfirmationError && ['duplicate', 'sameShiftDay'].includes(e.code)) {
            setDuplicateWarning(e.message);
            setDuplicateAck(false);
        }
        else
            setNotice(e instanceof Error ? e.message : String(e));
    } }
    function guideRespond(message: string, explicitAnswer=false) {
        const d=draftRef.current;if(!d||d.actionId!==PLAN_GUIDE_ID)return false;
        if(locked.current||d.submission){setNotice('Let this private save finish before answering the next question.');return true;}
        const field=guideQuestion(c,d.values);
        if(!explicitAnswer&&/^(?:help (?:me|us) (?:create|make|build) (?:a |our |my )?plan|continue(?: planning)?|resume(?: planning)?)$/i.test(message.trim())) {setGuidePaused(false);onReply(message,guideReply(c,d.values));return true;}
        if(guidePaused)return false;
        if(!explicitAnswer&&/^(?:why|what|how|explain|can you explain|could you explain)\b/i.test(message.trim())){onReply(message,field?`${field.why} ${field.question}`:guideReply(c,d.values));return true;}
        if(!explicitAnswer&&/^(pause|pause planning|not now)$/i.test(message.trim())){setGuidePaused(true);requestAnimationFrame(()=>actionCardRef.current?.querySelector<HTMLElement>('.hercules-plan-guide button')?.focus());onReply(message,'We can stop here. Your answers stay in your private task; choose Continue planning when you are ready.');return true;}
        if(!explicitAnswer&&/^(back|go back)$/i.test(message.trim())){guideEdit();return true;}
        if(!explicitAnswer&&/^(skip|skip this|leave (?:this|it) open)$/i.test(message.trim())){guideSkip();return true;}
        if(!explicitAnswer&&/^(?:i (?:don.t|do not) know|not sure(?: yet)?)$/i.test(message.trim())&&field&&field.key!=='purpose'&&field.key!=='constraints'&&!field.key.endsWith('Step')){onReply(message,'That is okay. I will not invent an amount or treat missing money as zero. You can leave this part open for now, or ask why it matters.');return true;}
        if(!explicitAnswer&&/^(?:review|review changes|show review|change |set |make )/i.test(message.trim()))return false;
        if(!field)return false;
        try {
            let answer=message.trim();
            if(field.kind==='money')answer=answer.replace(/^(?:about |around )?\$?/, '').replace(/(?: CAD| dollars)$/i,'').replaceAll(',','');
            if(field.key.endsWith('Paydays')){if(/^decide later$/i.test(answer))answer='Decide later';else parseGuidePaydays(answer);}
            const values=guideAnswer(c,d.values,field.key,parseActionAnswer(field,answer,c,d.values));
            void change({...d,values,updatedAt:new Date().toISOString()});
            setNotice('');onReply(message,guideReply(c,values));
        } catch(error){setNotice(error instanceof Error?error.message:'Choose an answer or leave this part open.');}
        return true;
    }
    function guideEdit(key?:string){const d=draftRef.current;if(!d||locked.current||d.submission)return;const values=guideBack(c,d.values,key);void change({...d,values,updatedAt:new Date().toISOString()});setGuidePaused(false);onReply('Go back',guideReply(c,values));}
    function guideSkip(){const d=draftRef.current;if(!d||locked.current||d.submission)return;const field=guideQuestion(c,d.values),section=field?.key.match(/^(income|protect|prepare|build|everyday)/)?.[1];if(!section){setNotice('You can say “not sure yet” or pause here.');return;}const key=`${section}Source`;const values=guideAnswer(c,guideBack(c,d.values,key),key,'skip');void change({...d,values,updatedAt:new Date().toISOString()});onReply('Leave this part open',guideReply(c,values));}
    useImperativeHandle(ref, () => ({
        state() { if (!draft)
            return undefined; const a = availableHerculesActions(c).find(a => a.id === draft.actionId); if (!a)
            return undefined; return { actionId: a.id, inputs:actionFields(a,c,draft.values).map(f=>({key:f.key,label:f.label,kind:f.choices?'choice':f.kind??'text',required:!f.optional})), missingFields: actionFields(a, c, draft.values).filter(f => !f.optional && !draft.values[f.key]).map(f => f.label), stage: draft.submission ? 'pending' : review ? 'review' : 'collect' }; },
        fingerprint() { return JSON.stringify([key, draft]); },
        propose(proposal, expectedFingerprint) {
            if (expectedFingerprint !== undefined && expectedFingerprint !== JSON.stringify([key, draftRef.current])) {
                setNotice('I kept your newer edits. The earlier reply did not change them.');
                return;
            }
            if (locked.current || draft?.submission)
                return;
            if (draft && draft.actionId !== proposal.actionId) {
                setNotice('Your current task is still here. Finish or cancel it before starting another.');
                return;
            }
            try {
                const a = actionById(proposal.actionId, c);
                let values = { ...(draft?.values ?? initialActionValues(a, '', c)) };
                // Only known fields and resolvable choices enter a draft. Unresolved model guesses stay questions.
                for (const key of actionFields(a, c, { ...values, ...proposal.values }).map(field => field.key)) {
                    const raw = proposal.values[key];
                    if (raw === undefined) continue;
                    const f = actionFields(a, c, values).find(f => f.key === key);
                    if (!f)
                        continue;
                    try {
                        const answer = parseActionAnswer(f, raw, c, values);
                        values = a.id === PLAN_GUIDE_ID ? guideAnswer(c, values, key, answer) : {...values, [key]: answer};
                    }
                    catch { }
                }
                void change({ version: 1, actionId: a.id, view: c.view, generation, values, ...(draft?.queue ? { queue: draft.queue } : {}), updatedAt: new Date().toISOString(), submission: null });
                setGuidePaused(false);
                if(a.id===PLAN_GUIDE_ID) onReply('Help me create a plan',guideReply(c,values));
                setNotice(a.id===PLAN_GUIDE_ID ? '' : missingActionField(a, values, c)?.question || 'Your draft is ready to review. Nothing has been saved to the books.');
            }
            catch {
                setNotice('Choose an available task from Things we can do.');
            }
        },
        send(message) {
            if (resolvedIdentity.current) {
                setNotice('The receipt is confirmed. Waiting for the latest private task to arrive.');
                return true;
            }
            if (isFinalConfirm(message)) {
                if (review)
                    void confirm();
                else
                    setNotice('Review a prepared action before using Final Confirm.');
                return true;
            }
            if (/^(cancel|cancel that|never mind)$/i.test(message) && draft) {
                if (draft.submission)
                    setNotice('This action is pending. Check its status before changing it.');
                else
                    void change(nextHerculesTask(draft));
                return true;
            }
            const compound = !draft && compoundHerculesActions(message, c);
            if (compound) {
                const [first, ...queue] = compound;
                start(first!.actionId, message, queue, first!.values);
                return true;
            }
            const match = findHerculesAction(message, c);
            if (match && !draft) {
                start(match.id, message);
                return true;
            }
            if (guideRespond(message)) return true;
            if (!draft || /^(why|what|how|can you explain)\b/i.test(message))
                return false;
            if (draft.submission) {
                setNotice('Finish checking this action before changing its details.');
                return true;
            }
            const a = availableHerculesActions(c).find(a => a.id === draft.actionId);
            if (!a) {
                setNotice('This task is no longer available. You can cancel it and choose a current task.');
                return true;
            }
            try {
                const corrected = actionCorrection(a, c, draft.values, message);
                if (corrected) {
                    const changedKey=Object.keys(corrected).find(key=>corrected[key]!==draft.values[key]);
                    const values=a.id===PLAN_GUIDE_ID&&changedKey?guideAnswer(c,draft.values,changedKey,corrected[changedKey]!):corrected;
                    void change({ ...draft, values, updatedAt: new Date().toISOString() });
                    onReply(message, 'Updated. Review the changed details before Final Confirm.');
                    return true;
                }
            }
            catch (e) {
                setNotice(e instanceof Error ? e.message : String(e));
                return true;
            }
            if (/^(review|review changes|show review)$/i.test(message)) {
                showReview();
                return true;
            }
            const f = missingActionField(a, draft.values, c);
            if (!f)
                return false;
            try {
                const values = { ...draft.values, [f.key]: parseActionAnswer(f, message, c, draft.values) };
                void change({ ...draft, values, updatedAt: new Date().toISOString() });
                onReply(message, missingActionField(a, values, c)?.question || 'Everything is ready. Review the details below.');
            }
            catch (e) {
                setNotice(e instanceof Error ? e.message : String(e));
            }
            return true;
        }
    }));
    const a = draft ? availableHerculesActions(c).find(a => a.id === draft.actionId) : undefined;
    return <section className="hercules-actions" aria-label="Do something with Hercules">
  {resolvedIdentity.current && <p role="status">The action receipt is confirmed. Waiting for the latest task from your household.</p>}
  {!draft && !resolvedIdentity.current && <button type="button" onClick={() => setLibrary(!library)} aria-expanded={library}>Things we can do</button>}
  {library && !draft && <div className="hercules-action-library">{availableHerculesActions(c).map(a => <button type="button" key={a.id} onClick={() => start(a.id)}>{a.title}</button>)}</div>}
  {draft && <article ref={actionCardRef} className="hercules-action-card"><h3>{a?.title ?? 'Saved task'}</h3><p>{a?.id===PLAN_GUIDE_ID ? `Your private ${c.view==='household'?'Household':'Personal'} Plan draft · ${draft.values.monthKey||'month to choose'}` : c.view === 'household' ? 'Household books' : 'Your personal books'}</p>
   {!!draft.queue?.length && <section aria-label="Your checklist"><p>Each task needs its own review and Final Confirm.</p><ol><li>{a?.title ?? 'Current task'} — current</li>{draft.queue.map((item, index) => <li key={index}>{availableHerculesActions(c).find(a => a.id === item.actionId)?.title ?? 'Saved task'} — waiting</li>)}</ol></section>}
   {draft.submission ? <><p>This review is awaiting its receipt.</p><button type="button" disabled={busy} onClick={() => void recover()}>Check action status</button><button type="button" disabled={busy} onClick={() => void cancelPending()}>Cancel pending request</button></> : !a ? <><p>This task is no longer available in these books.</p><button type="button" disabled={busy} onClick={() => void change(nextHerculesTask(draft))}>Cancel task</button></> : <>
    {!review ? <>{actionFields(a,c,draft.values).some(f=>/accountId$/i.test(f.key)&&f.choices&&!f.choices(c,draft.values).length) && <div role="status"><p>There is no available account for this step. Add one, then return to this task.</p><button type="button" disabled={busy} onClick={prepareAccountFirst}>Add an account first</button></div>}{a.id===PLAN_GUIDE_ID ? guidePaused ? <section className="hercules-plan-guide"><p>Your private planning conversation is paused.</p><button type="button" onClick={()=>{setGuidePaused(false);onReply('Continue planning',guideReply(c,draft.values));}}>Continue planning</button></section> : <HerculesPlanGuide inlineAnswers={!composerAvailable} context={c} values={draft.values} busy={busy} onAnswer={text=>guideRespond(text,true)} onBack={guideEdit} onSkip={guideSkip} onPause={()=>guideRespond('pause')}/> : actionFields(a, c, draft.values).map(f => <label key={f.key}>{f.label}{f.optional ? ' (optional)' : ''}{f.choices ? <select value={draft.values[f.key] ?? ''} onChange={e => void change({ ...draft, values: { ...draft.values, [f.key]: e.target.value }, updatedAt: new Date().toISOString() })}><option value="">Choose…</option>{f.choices(c, draft.values).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select> : <input type={f.kind === 'date' ? 'date' : f.kind === 'datetime' ? 'datetime-local' : 'text'} inputMode={f.kind === 'money' || f.kind === 'number' ? 'decimal' : undefined} defaultValue={draft.values[f.key] ?? ''} key={`${draft.actionId}-${f.key}-${draft.values[f.key] ?? ''}`} onBlur={e => { if (e.target.value !== (draft.values[f.key] ?? ''))
                void change({ ...draft, values: { ...draft.values, [f.key]: e.target.value }, updatedAt: new Date().toISOString() }); }}/>}</label>)}<>{duplicateWarning && <div role="alert"><p>{duplicateWarning}</p><label><input type="checkbox" checked={duplicateAck} onChange={e => setDuplicateAck(e.target.checked)}/>This is another real entry, not the same one.</label></div>}</><button type="button" disabled={busy || !!missingActionField(a, draft.values, c)} onClick={showReview}>Review changes</button></> : <><h4 ref={reviewHeadingRef} tabIndex={-1}>Check your changes</h4><dl>{review.rows.map(row => <div key={row.label}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl><p>{review.consequence}</p><ul>{review.effects.map((e, i) => <li key={i}>{e.label}: {e.value}</li>)}</ul><button type="button" disabled={busy} onClick={() => void confirm()}>Final Confirm</button><button type="button" disabled={busy} onClick={() => { setReview(null); requestAnimationFrame(() => (a.id===PLAN_GUIDE_ID ? actionCardRef.current?.querySelector<HTMLElement>(".hercules-plan-recap summary") ?? actionCardRef.current?.querySelector<HTMLElement>(".hercules-plan-guide") : actionCardRef.current?.querySelector<HTMLElement>("input, select, textarea"))?.focus()); }}>Edit details</button></>}
    <button type="button" disabled={busy} onClick={() => void change(nextHerculesTask(draft))}>Cancel this task</button>
   </>}
  </article>}
  {notice && <p role="status">{notice}{draft?.actionId===PLAN_GUIDE_ID&&/save.*(?:not|could)|save has not/i.test(notice)&&<button disabled={busy} type="button" onClick={()=>void change(draft)}>Retry private save</button>}</p>}
 </section>;
});
