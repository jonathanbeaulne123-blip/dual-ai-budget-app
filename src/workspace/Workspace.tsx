import { FeedbackReviewCard } from './FeedbackReview.tsx';
import { feedbackContext, feedbackOwner, type FeedbackContext } from './feedback.ts';
import { useEffect, useRef, useState } from 'react';
import { WorkspaceClient, workspaceError, type WorkspaceRequest } from './client.ts';
import { latestArtifacts, WORKSPACE_INPUT_LIMIT, type ArtifactVersion, type WorkspaceCommand, type WorkspaceProject, type WorkspaceProposal, type WorkspaceSnapshot, type ProjectLink } from './contracts.ts';
import { readEntryLocal, writeEntryLocal, clearEntryLocal } from '../entryDraft.ts';
import { useAppearance } from '../theme/ThemeProvider.tsx';
import { disclosureDigest, type ArtifactDisclosureReview } from './disclosure.ts';
import { externalReviewDigest, type ExternalWorkspaceReview } from './external.ts';
import './workspace.css';

export type WorkspaceProps = {
  reportRequest?: { id: string; context: FeedbackContext; text?: string } | null; onReportOpened?: () => void; getReportContext?: () => FeedbackContext; reporterName?: string;
  identity: string; environment: string; householdId: string; memberId: string; view: 'personal' | 'household';
  mode: 'room' | 'compact' | 'hidden'; getAccessToken: () => Promise<string>; isCurrent: () => boolean;
  onExpand: () => void; onClose: () => void; onLegacy: () => void;
  onReview: (proposal: WorkspaceProposal) => void;
  onSnapshot?: (snapshot: WorkspaceSnapshot) => void;
  openProjectId?: string | null; onProjectOpened?:()=>void;
  recordOptions?: ProjectLink[];
  getGoogleAccessToken?: () => Promise<string>;
};
const starters = [
  ['A date with Bianca', 'Help me plan a date with Bianca. Let’s explore ideas, timing and costs before committing money.'],
  ['Make something useful', 'Help me turn an idea into a useful document. Ask what I want to make and who it is for.'],
  ['Learn something', 'Help me learn something new. Start by asking what I want to understand and how much help I want.'],
  ['Think through a decision', 'Help me compare my options, research evidence and work through a decision.'],
];
export function HerculesWorkspaceRoom(props: WorkspaceProps) {
  const { scene } = useAppearance();
  const theme = scene.theme;
  const scopeKey = `hercules-workspace:${props.identity}:${props.environment}:${props.householdId}:${props.memberId}`;
  const current = useRef(props); current.current = props;
  const alive = useRef(true);
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot | null>(null);
  const snapshotRef = useRef(snapshot); snapshotRef.current = snapshot;
  const [selected, setSelected] = useState<string | null>(() => readEntryLocal<{ projectId?: string }>(scopeKey)?.projectId ?? null);
  const selectedRef=useRef(selected);selectedRef.current=selected;
  const [composer, setComposer] = useState(() => readEntryLocal<{text:string}>(scopeKey+':composer:'+selected)?.text ?? readEntryLocal<{ composer?: string }>(scopeKey)?.composer ?? '');
  const [notice, setNotice] = useState(''), [saving, setSaving] = useState(false), [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<WorkspaceRequest | null>(() => readEntryLocal<{ pending?: WorkspaceRequest }>(scopeKey)?.pending ?? null);
  const [surface, setSurface] = useState<'conversation' | 'work' | 'context'>('conversation');
  const [shareReview,setShareReview]=useState<ArtifactDisclosureReview|null>(()=>readEntryLocal<ArtifactDisclosureReview>(scopeKey+':share'));
  const [externalReview,setExternalReview]=useState<ExternalWorkspaceReview|null>(()=>readEntryLocal<ExternalWorkspaceReview>(scopeKey+':external'));
  const [sharePending,setSharePending]=useState(()=>!!readEntryLocal(scopeKey+':share-pending'));
  const [externalPending,setExternalPending]=useState(()=>!!readEntryLocal(scopeKey+':external-pending')),[disclosureNotice,setDisclosureNotice]=useState('');
  const [shared,setShared]=useState<Array<{id:string;title:string;content:string}>>([]);
  const [artifactId, setArtifactId] = useState<string | null>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const clientRef = useRef<WorkspaceClient | null>(null);
  const refreshFlight = useRef<Promise<void> | null>(null);
  if (!clientRef.current) clientRef.current = new WorkspaceClient(`/hercules/workspace/${props.environment}/${props.householdId}`, () => current.current.getAccessToken(), () => alive.current && current.current.isCurrent());
  const project = snapshot?.projects.find(p => p.id === selected) ?? null;
  const run = project?.runs.at(-1);
  const artifact = project && (latestArtifacts(project).find(a => a.artifactId === artifactId) ?? latestArtifacts(project).at(-1));
  function adopt(value: WorkspaceSnapshot) {
    if (!alive.current || !current.current.isCurrent()) return;
    if (value.sequence >= (snapshotRef.current?.sequence ?? 0)) { snapshotRef.current = value; setSnapshot(value); current.current.onSnapshot?.(value); }
  }
  function refresh(): Promise<void> {
    if (refreshFlight.current) return refreshFlight.current;
    const flight = (async () => {
      try { adopt(await clientRef.current!.request()); if (alive.current && !readEntryLocal<{ pending?: WorkspaceRequest }>(scopeKey)?.pending) setNotice(''); }
      catch (error) { if (alive.current) setNotice(workspaceError(error)); }
      finally { if (alive.current) setLoading(false); }
    })();
    refreshFlight.current = flight;
    void flight.finally(() => { if (refreshFlight.current === flight) refreshFlight.current = null; });
    return flight;
  }
  useEffect(() => {
    alive.current = true; void refresh();
    const interval = window.setInterval(() => { if (snapshotRef.current && !document.hidden && current.current.mode !== 'hidden') void refresh(); }, 5000);
    const reconnect = () => void refresh(); window.addEventListener('online', reconnect); window.addEventListener('focus', reconnect);
    return () => { alive.current = false; clearInterval(interval); window.removeEventListener('online', reconnect); window.removeEventListener('focus', reconnect); };
  }, []);
  useEffect(() => { writeEntryLocal(scopeKey+':composer:'+selected,{text:composer}); writeEntryLocal(scopeKey, { projectId: selected, composer, pending }); }, [scopeKey, selected, composer, pending]);
  function chooseProject(id:string) { writeEntryLocal(scopeKey+':composer:'+selected,{text:composer});setSelected(id);setComposer(readEntryLocal<{text:string}>(scopeKey+':composer:'+id)?.text ?? '');setArtifactId(null); }
  useEffect(() => { if (props.openProjectId) {chooseProject(props.openProjectId);props.onProjectOpened?.();} }, [props.openProjectId]);
  useEffect(() => {
    if (props.mode === 'hidden') return;
    const previous = document.activeElement as HTMLElement | null;
    composerRef.current?.focus();
    return () => { if (previous?.isConnected) previous.focus(); };
  }, [props.mode]);
  async function submit(request: WorkspaceRequest) {
    if (saving) return false;
    setSaving(true); setPending(request);
    // Persist exact request identity before any transport; ambiguity never creates a new write.
    writeEntryLocal(scopeKey, { projectId: selected, composer, pending: request });
    try {
      adopt(await clientRef.current!.request(request));
      if (!alive.current) return false;
      setPending(null); setNotice(''); return true;
    } catch (error) {
      if (alive.current) {
        setNotice(workspaceError(error));
        if (error instanceof Error && /CHANGED|EXISTS|REUSED|^INVALID_|_LIMIT$|^TEXT_REQUIRED|TOO_LARGE/.test(error.message)) { setPending(null); await refresh(); setNotice(workspaceError(error)); }
      }
      return false;
    } finally { if (alive.current) setSaving(false); }
  }
  async function command(cmd: WorkspaceCommand, p = project) {
    if (!p || pending) return false;
    return submit({ commandId: crypto.randomUUID(), projectId: p.id, expectedRevision: p.revision, command: cmd });
  }
  const reportOpening = useRef<string | null>(null);
  async function newReport(request: { id: string; context: FeedbackContext; text: string } = { id: crypto.randomUUID(), context: props.getReportContext?.() ?? {}, text: '' }) {
    if (pending || saving || !snapshot) return;
    const owner = feedbackOwner(props.reporterName);
    reportOpening.current = request.id;
    props.onReportOpened?.();
    setSelected(request.id); setSurface('conversation'); setComposer(request.text ?? '');
    const ok = await submit({ commandId: request.id, projectId: request.id, expectedRevision: 0, command: { type: 'create', id: request.id, title: 'A bug to put right', feedback: { context: feedbackContext(request.context), owner } } });
    if (ok) composerRef.current?.focus();
  }
  useEffect(() => {
    if (props.reportRequest && snapshot && !saving && !pending && reportOpening.current !== props.reportRequest.id) void newReport({ ...props.reportRequest, text: props.reportRequest.text ?? '' });
  }, [props.reportRequest, snapshot, saving, pending]);
  async function newProject(title = 'A new intention', message?: string) {
    if (pending || saving) return;
    const id = crypto.randomUUID();
    const ok = await submit({ commandId: crypto.randomUUID(), projectId: id, expectedRevision: 0, command: { type: 'create', id, title } });
    if (ok) { setSelected(id); setSurface('conversation'); setComposer(message ?? ''); composerRef.current?.focus(); }
  }
  useEffect(()=>{if(shareReview)writeEntryLocal(scopeKey+':share',shareReview);else clearEntryLocal(scopeKey+':share');},[shareReview,scopeKey]);
  useEffect(()=>{if(externalReview)writeEntryLocal(scopeKey+':external',externalReview);else clearEntryLocal(scopeKey+':external');},[externalReview,scopeKey]);
  useEffect(()=>{if(!externalReview){const pending=snapshot?.externalReviews?.find(r=>r.receipt.status!=='accepted');if(pending){setExternalReview(pending.review);setExternalPending(true);writeEntryLocal(scopeKey+':external-pending',true);}}},[snapshot]);
  async function reviewExternal(proposal: WorkspaceProposal) {
    if (!project) return;
    if (externalPending) { setDisclosureNotice('Check the pending Google receipt before starting another change.'); return; }
    if (proposal.target === 'hearth') {setSaving(true);try{const reviewed=await clientRef.current!.actionReview(project.id,proposal.id);if(reviewed.status==='accepted')setNotice('This action is already saved. Its original receipt was found.');else props.onReview(reviewed);await refresh();}catch(error){setNotice(workspaceError(error));}finally{setSaving(false);}return;}
    const artifact=project.artifacts.find(a=>a.id===proposal.artifactVersionId);
    setExternalPending(false);setDisclosureNotice('');
    setExternalReview({id:crypto.randomUUID(),projectId:project.id,proposalId:proposal.id,artifactVersionId:artifact?.id,
      action:proposal.actionId as ExternalWorkspaceReview['action'],title:proposal.values.title ?? artifact?.title ?? 'Hercules work',content:proposal.values.content ?? artifact?.content ?? proposal.values.description ?? '',start:proposal.values.start,end:proposal.values.end});
  }
  async function confirmExternal() {
    if(!externalReview||saving)return;
    let digest:string;try{digest=externalReviewDigest(externalReview);}catch(error){setDisclosureNotice(error instanceof Error?error.message:'Review the dates and content first.');return;}
    setSaving(true);let dispatched=false;
    if(!writeEntryLocal(scopeKey+':external',externalReview)||!writeEntryLocal(scopeKey+':external-pending',true)){setSaving(false);setDisclosureNotice('Allow private draft storage before confirming so the receipt can be recovered.');return;}
    setExternalPending(true);
    try {
      const token=await props.getGoogleAccessToken?.();if(!token)throw new Error('Connect your Google services in Hearth first.');
      dispatched=true;const result=await clientRef.current!.external(externalReview,digest,token);
      setDisclosureNotice(result.status==='accepted'?`Saved in Google. Receipt: ${result.remoteId}`:result.status==='prepared'?'Nothing was submitted. Reconnect your Google account and retry this exact review.':'The result is uncertain. Keep this exact review and check its receipt before trying another change.');
      if(result.status==='prepared'){setExternalPending(false);clearEntryLocal(scopeKey+':external-pending');}
      if(result.status==='accepted'){setExternalReview(null);setExternalPending(false);clearEntryLocal(scopeKey+':external-pending');void refresh();}
    }catch(error){if(!dispatched || error instanceof Error && /^(ARTIFACT_CHANGED|PROPOSAL_CHANGED|GOOGLE_WRITES_NOT_ACTIVATED)$/.test(error.message)){setExternalPending(false);clearEntryLocal(scopeKey+':external-pending');}
      if(error instanceof Error && error.message==='PROPOSAL_SUBMISSION_EXISTS'){setExternalReview(null);void refresh();}setDisclosureNotice(error instanceof Error ? error.message : 'The result could not be checked. Keep this review.');}
    finally{if(alive.current)setSaving(false);}
  }
  async function attach(file: File) {
    if (file.size > 4 * 1024 * 1024) { setNotice('Choose a file smaller than 4 MB.'); return; }
    const buffer = new Uint8Array(await file.arrayBuffer()); let binary = '';
    for (const byte of buffer) binary += String.fromCharCode(byte);
    if (await command({ type: 'attach', id: crypto.randomUUID(), filename: file.name, base64: btoa(binary) })) setSurface('work');
  }
  async function exportFile(version: ArtifactVersion, format: string) {
    if (!project) return;
    setSaving(true);
    try {
      const result = await clientRef.current!.exportFile(project.id, version.id, format);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))], { type: 'application/octet-stream' }));
      const link = document.createElement('a'); link.href = url; link.download = result.filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { setNotice('This export could not be rendered. Your working version is saved; download its original format or retry.'); }
    finally { if (alive.current) setSaving(false); }
  }
  async function send() {
    if (!composer.trim() || !project || pending) return;
    const text = composer, projectId=project.id;
    if (await command({ type: 'message', id: crypto.randomUUID(), text, appContext: feedbackContext(props.getReportContext?.()) })) {
      if(selectedRef.current===projectId)setComposer(current => current === text ? '' : current);
      else if(readEntryLocal<{text:string}>(scopeKey+':composer:'+projectId)?.text===text)writeEntryLocal(scopeKey+':composer:'+projectId,{text:''});
    }
  }
  if (props.mode === 'hidden') return null;
  return <section className={`hercules-workspace hw--${props.mode} hw--${theme}`} data-workspace-scope={props.view} aria-label="Hercules workspace" onKeyDown={event => { if (event.key === 'Escape' && props.mode === 'compact') props.onClose(); }}>
    <header className="hw-header"><div className="hw-monogram" aria-hidden="true">H<span>✦</span></div><div><p className="hw-eyebrow">Hercules · your private study</p><h1>{props.mode === 'compact' ? 'Here with you' : 'Bring an intention. Make something of it.'}</h1><p>Life, work, learning, and the plans that connect them.</p></div><div className="hw-window-controls"><button disabled={!snapshot || saving || !!pending} onClick={() => void newReport()}>Report a bug</button>{props.mode === 'compact' && <button onClick={props.onExpand}>Open room ↗</button>}<button onClick={props.onClose} aria-label="Close Hercules workspace">Close</button></div></header>
    {(notice || pending) && <div className="hw-notice" role="alert"><p>{notice || "The last save needs checking before another change."}</p><button disabled={saving} onClick={() => pending ? void submit(pending) : void refresh()}>{pending ? 'Check original save' : 'Reconnect'}</button><button onClick={props.onLegacy}>Existing conversations & guided actions</button></div>}
    {loading && <p role="status">Opening your private projects…</p>}
    {disclosureNotice && <p className="hw-notice" role="status">{disclosureNotice}</p>}
    {shareReview && <section className="hw-review" aria-label="Review household disclosure"><h2>Share this exact copy with the household</h2><p>Review the entire text. Sources, private conversation and version history are excluded.</p><label>Title<input disabled={sharePending} value={shareReview.title} onChange={e=>setShareReview({...shareReview,title:e.target.value,id:crypto.randomUUID()})}/></label><textarea disabled={sharePending} aria-label="Content to share" value={shareReview.content} onChange={e=>setShareReview({...shareReview,content:e.target.value,id:crypto.randomUUID()})}/><button disabled={saving} onClick={async()=>{let digest:string;try{digest=disclosureDigest(shareReview);}catch{setDisclosureNotice('A title and reviewed content are required before sharing.');return;}if(!writeEntryLocal(scopeKey+':share',shareReview)||!writeEntryLocal(scopeKey+':share-pending',true)){setDisclosureNotice('Allow private draft storage before sharing so its receipt can be recovered.');return;}setSharePending(true);setSaving(true);try{const receipt=await clientRef.current!.share(shareReview,digest);setDisclosureNotice('Shared this reviewed copy. Receipt: '+receipt.id);setShareReview(null);setSharePending(false);clearEntryLocal(scopeKey+':share-pending');}catch{setDisclosureNotice('The shared copy could not be checked. Keep this review and retry the same disclosure.');}finally{setSaving(false);}}}>{sharePending?'Check original shared copy':'Share this reviewed copy'}</button>{!sharePending&&<button onClick={()=>setShareReview(null)}>Close review</button>}</section>}
    {externalReview && <section className="hw-review" aria-label="Review Google change"><h2>Review this Google change</h2><p>{externalReview.action} in your connected Google account. This has a separate confirmation and receipt.</p><label>Title<input disabled={externalPending} value={externalReview.title} onChange={e=>setExternalReview({...externalReview,id:crypto.randomUUID(),title:e.target.value})}/></label><textarea aria-label="Content for Google" disabled={externalPending} value={externalReview.content} onChange={e=>setExternalReview({...externalReview,id:crypto.randomUUID(),content:e.target.value})}/>{externalReview.action==='calendar-event' && <><label>Start (date, time and offset)<input disabled={externalPending} value={externalReview.start ?? ''} onChange={e=>setExternalReview({...externalReview,id:crypto.randomUUID(),start:e.target.value})}/></label><label>End (date, time and offset)<input disabled={externalPending} value={externalReview.end ?? ''} onChange={e=>setExternalReview({...externalReview,id:crypto.randomUUID(),end:e.target.value})}/></label></>}<button disabled={saving} onClick={()=>void confirmExternal()}>{externalPending?'Check original Google receipt':'Confirm this Google change'}</button>{!externalPending && <button onClick={()=>setExternalReview(null)}>Cancel review</button>}</section>}
    <div className="hw-layout">
      <aside className="hw-projects" aria-label="Your projects"><div className="hw-projects-heading"><h2>On the worktable</h2><button disabled={!snapshot || saving || !!pending} onClick={() => void newProject()}>New project</button></div>
        <nav aria-label="Projects">{[...(snapshot?.projects ?? [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(p => <button key={p.id} aria-current={selected === p.id ? 'page' : undefined} onClick={() => { chooseProject(p.id); }}><strong>{p.title}</strong><small>{p.runs.at(-1)?.progress ?? 'An open possibility'}</small></button>)}</nav>
        {!snapshot?.projects.length && <p>Your ideas can grow here, over one conversation or several months.</p>}
        <details className="hw-privacy"><summary>What Hercules can use</summary><p>This conversation is yours. An activated run can use your Personal books and authorized Household information as distinct sources. Another member’s Personal books are excluded.</p><p>Your instructions, selected files, project context and requested tool results are sent to Gemini when execution is activated. Sharing is a separate reviewed copy.</p></details>
        <details className="hw-shared-shelf"><summary>Shared with the household</summary><button onClick={()=>void clientRef.current!.sharedArtifacts().then(setShared).catch(()=>setNotice('Shared work could not be loaded.'))}>Refresh shared copies</button>{shared.map(a=><details key={a.id}><summary>{a.title}</summary><pre>{a.content}</pre></details>)}</details>
        <button className="hw-legacy" onClick={props.onLegacy}>Guided actions & earlier conversations</button>
      </aside>
      <main className="hw-main">
      {!project ? <div className="hw-welcome"><div className="hw-desk-art" aria-hidden="true"><span className="hw-book">a little room<br/>for possibility</span><span className="hw-pencil"/><span className="hw-cup">✦</span></div><h2>What shall we work on?</h2><p>A small date. A big decision. Something you want to understand or create.</p><div className="hw-starters">{starters.map(([title, prompt]) => <button key={title} disabled={!snapshot || saving || !!pending} onClick={() => void newProject(title, prompt)}><strong>{title}</strong><span>Begin together →</span></button>)}</div></div> : <>
        <div className="hw-project-title"><div><p className="hw-eyebrow">Private life project</p><h2>{project.title}</h2></div><span className="hw-save-state">{saving ? 'Saving…' : pending ? 'Save needs checking' : 'Saved in your workspace'}</span></div>
        <nav className="hw-surface-tabs" aria-label="Project areas">{(['conversation', 'work', 'context'] as const).map(s => <button key={s} aria-current={surface === s ? 'page' : undefined} onClick={() => setSurface(s)}>{s === 'work' ? `Working area${project.artifacts.length ? ` · ${latestArtifacts(project).length}` : ''}` : s === 'context' ? 'Project context' : 'Conversation'}</button>)}</nav>
        <div className={`hw-project-body hw-show-${surface}`}>
          <section className="hw-conversation" aria-label="Conversation"><div className="hw-messages" role="log" aria-live="polite" aria-relevant="additions">{project.messages.length ? project.messages.map(m => <article key={m.id} className={`hw-message hw-message--${m.role}`}><strong>{m.role === 'user' ? 'You' : 'Hercules'}</strong><div>{m.text}</div></article>) : <p className="hw-first-message">Tell me what you have in mind. We can research, make a first draft, or work out where to begin.</p>}</div>
            {run && <div className="hw-run"><p role="status">{run.progress}</p><div>{['queued', 'running'].includes(run.status) && <button disabled={saving || !!pending} onClick={() => void command({ type: 'control', runId: run.id, action: 'pause' })}>Pause</button>}{['paused', 'failed'].includes(run.status) && <button disabled={saving || !!pending} onClick={() => void command({ type: 'control', runId: run.id, action: 'resume' })}>Resume</button>}{!['complete', 'cancelled', 'superseded'].includes(run.status) && <button disabled={saving || !!pending} onClick={() => void command({ type: 'control', runId: run.id, action: 'cancel' })}>Cancel task</button>}</div><details><summary>Work details</summary><p>{run.usage.modelCalls} Flash calls · {run.usage.toolCalls} tools · {run.usage.inputTokens + run.usage.outputTokens} tokens</p>{run.checkpoints.map((c, i) => <p key={i}>{c.tool.replaceAll('_', ' ')} · {c.status}</p>)}</details></div>}
            {project.proposedResearchQueries.length > 0 && <PublicResearchReview key={project.id+JSON.stringify(project.proposedResearchQueries)} project={project} busy={saving || !!pending} onApprove={async queries => { if(await command({type:'research-queries',queries})) setComposer('Continue the project using the public research queries I approved.'); }} />}
            {project.proposals.filter(p => p.target === 'feedback' && (p.status === 'accepted' || p.receiptId || p.id === project.proposals.filter(v => v.target === 'feedback').at(-1)?.id)).map(proposal => <FeedbackReviewCard key={proposal.id} project={project} proposal={proposal} records={snapshot?.feedbackRecords ?? []} draftKey={`${scopeKey}:feedback:${project.id}:${proposal.id}`} connected={snapshot?.feedbackConnected === true} busy={saving || !!pending} onSave={(values, proposalRevision, projectRevision) => command({type:'edit-feedback', proposalId:proposal.id, proposalRevision, values}, {...project, revision:projectRevision})} onSubmit={(review,digest) => clientRef.current!.feedback(review,digest)} onRefresh={refresh} />)}
            {project.proposals.filter(p => p.target !== 'feedback').map(proposal => <article key={proposal.id} className="hw-proposal"><strong>{proposal.actionId.replaceAll('-', ' ')}</strong><p>{proposal.scope === 'personal' ? 'Personal' : 'Household'} · {proposal.target === 'google' ? 'External change' : 'Hearth change'} · {proposal.status}</p><dl>{Object.entries(proposal.values).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value}</dd></div>)}</dl><button disabled={(proposal.status==='accepted'||proposal.status==='stale'&&!proposal.receiptId) || saving || !!pending} onClick={() => reviewExternal(proposal)}>{proposal.receiptId?'Check review and receipt':'Review this change'}</button><small>Each action keeps its own confirmation and receipt.</small></article>)}
          </section>
          <section className="hw-work" aria-label="Working area"><div className="hw-artifact-tabs">{latestArtifacts(project).map(a => <button key={a.artifactId} aria-current={artifact?.artifactId === a.artifactId ? 'page' : undefined} onClick={() => setArtifactId(a.artifactId)}>{a.title}</button>)}</div>{artifact ? <ArtifactEditor key={`${project.id}:${artifact.artifactId}`} artifact={artifact} versions={project.artifacts.filter(a => a.artifactId === artifact.artifactId)} busy={saving || !!pending} onSave={(content, parentId) => command({ type: 'edit-artifact', artifactId: artifact.artifactId, parentId, content, id: crypto.randomUUID() })} draftKey={`${scopeKey}:artifact:${project.id}:${artifact.artifactId}`} onShare={() => {if(sharePending){setDisclosureNotice('Check the original shared copy before starting another.');return;}setDisclosureNotice('');setShareReview({id:crypto.randomUUID(),projectId:project.id,artifactVersionId:artifact.id,title:artifact.title,format:artifact.format,content:artifact.content});}} onExport={format => void exportFile(artifact, format)} onAsk={text => { setComposer(text); setSurface('conversation'); composerRef.current?.focus(); }} /> : <div className="hw-empty-artifact"><h3>Room to make something</h3><p>Your itinerary, lesson, comparison or document will take shape here. Ask Hercules to create a first version.</p><button onClick={() => {setComposer('Create a useful first draft for this project.');setSurface('conversation');}}>Make a first draft</button></div>}</section>
          <section className="hw-context" aria-label="Project context"><ProjectContext key={project.id} draftKey={`${scopeKey}:context:${project.id}`} project={project} busy={saving || !!pending} onSave={(cmd, revision) => command(cmd, { ...project, revision })} />
            <details><summary>Schedule a follow-up</summary><form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);const at=new Date(String(data.get('at'))).toISOString();void command({type:'follow-up',at,instruction:String(data.get('instruction'))});}}><p>Opt in to one follow-up. If permission expires, the task pauses until you reconnect.</p><label>When<input name="at" type="datetime-local" required/></label><label>What should Hercules do?<textarea name="instruction" required/></label><button disabled={saving||!!pending}>Schedule this follow-up</button></form></details>
            <h3>Sources</h3>{project.evidence.map(e => <article className="hw-source" key={e.id}><strong>{e.title}</strong><p>{e.origin} · {e.scope} · {new Date(e.observedAt).toLocaleDateString()}</p>{/^https:\/\//.test(e.source) ? <a href={e.source} target="_blank" rel="noreferrer">Open source ↗</a> : <span>{e.source} · version {e.sourceVersion}</span>}</article>)}
            <h3>Connected Hearth records</h3><label>Link an existing record<select defaultValue="" disabled={saving || !!pending} onChange={event => { const link = props.recordOptions?.find(l => l.id === event.target.value); if(link) void command({type:'link',link}); event.target.value=''; }}><option value="">Choose a Plan line, bank, event or task</option>{props.recordOptions?.map(link => <option key={link.id} value={link.id}>{link.scope} · {link.month ?? link.kind} · {link.label}</option>)}</select></label>{project.links.length ? project.links.map(link => <p key={link.id}>{link.label} · {link.scope} · {link.month ?? link.kind}</p>) : <p>Projects can connect to monthly Plans, Kitty Banks and Calendar when you decide to commit.</p>}
          </section>
        </div>
        <form className="hw-composer" onSubmit={event => {event.preventDefault(); void send();}}><label htmlFor="hw-message">Talk to Hercules</label><textarea id="hw-message" ref={composerRef} value={composer} maxLength={WORKSPACE_INPUT_LIMIT} onChange={e => setComposer(e.target.value)} placeholder="Ask, change direction, or tell me what matters…" rows={3}/><div><label className="hw-attach">Attach a file<input type="file" accept=".txt,.md,.csv,.json,.html,.py,.pdf,.docx,.xlsx,.pptx" disabled={saving || !!pending} onChange={event => { const file=event.target.files?.[0]; if(file) void attach(file); event.target.value=''; }}/></label><span>{composer.length.toLocaleString()} / {WORKSPACE_INPUT_LIMIT.toLocaleString()}</span><button disabled={saving || !!pending || !composer.trim()} type="submit">{run?.status === 'running' ? 'Send a correction or question' : 'Send'}</button></div></form>
      </>}
      </main>
    </div>
  </section>;
}

function ArtifactEditor({ artifact, versions, busy, onSave, onAsk, onExport, onShare, draftKey }: { artifact: ArtifactVersion; versions: ArtifactVersion[]; busy: boolean; onSave: (content: string, parentId: string) => Promise<boolean>; onAsk: (text: string) => void; onExport: (format: string) => void; onShare: () => void; draftKey: string }) {
  const savedDraft=useRef(readEntryLocal<{content:string;base:string;savedContent:string}>(draftKey));
  const [savedContent, setSavedContent] = useState(savedDraft.current?.savedContent ?? artifact.content);
  const [text, setText] = useState(savedDraft.current?.content ?? artifact.content), [base, setBase] = useState(savedDraft.current?.base ?? artifact.id), [editing, setEditing] = useState(false), [selected, setSelected] = useState(''), [history, setHistory] = useState('');
  const dirty = text !== savedContent;
  useEffect(() => { if (!dirty) { setText(artifact.content); setSavedContent(artifact.content); setBase(artifact.id); } }, [artifact.id, dirty]);
  useEffect(()=>{if(dirty)writeEntryLocal(draftKey,{content:text,base,savedContent});else clearEntryLocal(draftKey);},[text,base,dirty,draftKey,savedContent]);
  const shown = history ? versions.find(a => a.id === history)! : artifact;
  function download() { const blob = new Blob([text], { type: 'text/plain;charset=utf-8' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${artifact.title.replace(/[^a-zA-Z0-9 _-]/g, '') || 'Hercules work'}.${artifact.format === 'markdown' ? 'md' : artifact.format === 'python' ? 'py' : artifact.format}`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  return <article className="hw-artifact"><header><h3>{artifact.title}</h3><p>{artifact.validation.details}</p><div className="hw-artifact-actions"><button onClick={() => setEditing(v => !v)}>{editing ? 'Preview' : 'Edit'}</button><button onClick={download}>Download source</button><button disabled={dirty} onClick={onShare}>Review sharing</button><label>Export<select disabled={busy || dirty} defaultValue="" onChange={e => {if(e.target.value) onExport(e.target.value);e.target.value='';}}><option value="">Choose format</option><option value="docx">Word document</option>{artifact.format === 'csv' && <option value="xlsx">Excel workbook</option>}<option value="pptx">PowerPoint</option><option value="pdf">PDF</option></select></label><label>Version<select value={history} onChange={e => setHistory(e.target.value)}><option value="">Current</option>{versions.map((v, i) => <option key={v.id} value={v.id}>Version {i + 1} · {v.author}</option>)}</select></label></div></header>
    {history && <div className="hw-version-banner"><p>Earlier version. Your current work is preserved.</p><button onClick={() => { setText(shown.content); setHistory(''); setEditing(true); }}>Use this as a new draft</button></div>}
    {editing ? <textarea aria-label={`Edit ${artifact.title}`} className="hw-artifact-editor" value={text} onChange={e => setText(e.target.value)} onSelect={e => { const t = e.currentTarget; setSelected(t.value.slice(t.selectionStart, t.selectionEnd)); }} /> : artifact.format === 'html' ? <iframe title={artifact.title} sandbox="allow-scripts" referrerPolicy="no-referrer" srcDoc={`<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'; form-action 'none'; frame-src 'none'">${shown.content}`} /> : <pre className="hw-artifact-preview" onMouseUp={() => setSelected(window.getSelection()?.toString() ?? '')}>{shown.content}</pre>}
    {artifact.id !== base && dirty && <p role="alert">A newer version is available. Your edits are preserved below; compare before saving.<button onClick={() => setBase(artifact.id)}>Use current version as the base for my edits</button></p>}
    {dirty && <button disabled={busy || artifact.id !== base} onClick={async () => { if (await onSave(text, base)) { setSavedContent(text); setEditing(false); } }}>Save edited version</button>}
    {selected && <div className="hw-selection"><span>Selected: {selected.slice(0, 100)}</span><button onClick={() => onAsk(`In “${artifact.title}”, explain this selection:\n${selected}`)}>Explain this</button><button onClick={() => onAsk(`In “${artifact.title}”, try another version of this selection, keeping unrelated work:\n${selected}`)}>Try another version</button></div>}
  </article>;
}

function ProjectContext({ project, busy, onSave, draftKey }: { draftKey:string; project: WorkspaceProject; busy: boolean; onSave: (command: WorkspaceCommand, revision: number) => Promise<boolean> }) {
  const prior=useRef(readEntryLocal<WorkspaceProject>(draftKey));
  const [draft, setDraft] = useState(prior.current ?? project), [changed, setChanged] = useState(!!prior.current);
  useEffect(()=>{if(changed)writeEntryLocal(draftKey,draft);else clearEntryLocal(draftKey);},[draft,changed,draftKey]);
  useEffect(() => { if (!changed) setDraft(project); }, [project, changed]);
  function field(key: 'title' | 'goal' | 'completionCriteria', value: string) { setDraft(p => ({ ...p, [key]: value })); setChanged(true); }
  return <form onSubmit={async e => { e.preventDefault(); if (await onSave({ type: 'context', title: draft.title, goal: draft.goal, completionCriteria: draft.completionCriteria, decisions: draft.decisions, constraints: draft.constraints, questions: draft.questions, preferences: draft.preferences }, draft.revision)) setChanged(false); }}><h3>What we are working toward</h3>
    <label>Project name<input value={draft.title} onChange={e => field('title', e.target.value)} maxLength={180}/></label><label>Purpose<textarea value={draft.goal} onChange={e => field('goal', e.target.value)}/></label><label>What would make this done?<textarea value={draft.completionCriteria} onChange={e => field('completionCriteria', e.target.value)}/></label>
    {(['constraints', 'decisions', 'questions'] as const).map(key => <label key={key}>{key === 'constraints' ? 'What matters' : key === 'decisions' ? 'Decisions so far' : 'Open questions'}<textarea value={draft[key].join('\n')} onChange={e => { const value = e.target.value; setDraft(p => ({ ...p, [key]: value.split('\n').filter(Boolean) })); setChanged(true); }}/></label>)}
    <label>When learning, help me with<select value={draft.preferences.assistance} onChange={e => { const assistance = e.target.value as WorkspaceProject['preferences']['assistance']; setDraft(p => ({ ...p, preferences: { ...p.preferences, assistance } })); setChanged(true); }}><option value="hints">Hints</option><option value="worked-examples">Worked examples</option><option value="complete">Complete help</option></select></label>
    <label>How much detail?<select value={draft.preferences.detail} onChange={e=>{const detail=e.target.value as WorkspaceProject['preferences']['detail'];setDraft(p=>({...p,preferences:{...p.preferences,detail}}));setChanged(true);}}><option value="concise">Concise</option><option value="thorough">Thorough</option></select></label>
    <button disabled={!changed || busy}>Save project context</button>{changed && draft.revision !== project.revision && <p role="alert">Project context changed while you were editing. Review the current decisions before replacing them.<button type="button" onClick={()=>{setDraft(project);setChanged(false);}}>Reload current context</button></p>}{project.tasks.length > 0 && <><h3>Next steps</h3>{project.tasks.map(t => <p key={t.id}>{t.done ? '✓' : '○'} {t.title}</p>)}</>}
  </form>;
}


function PublicResearchReview({project,busy,onApprove}:{project:WorkspaceProject;busy:boolean;onApprove:(queries:string[])=>Promise<void>}) {
  const [queries,setQueries]=useState(project.proposedResearchQueries.join('\n'));
  return <section className="hw-proposal"><h3>Public research terms</h3><p>These exact queries will be sent to web search. Edit out anything you want to keep private.</p><textarea aria-label="Public search queries" value={queries} onChange={e=>setQueries(e.target.value)}/><button disabled={busy} onClick={()=>void onApprove([...project.publicResearchQueries,...queries.split('\n').filter(Boolean)])}>Approve these public queries</button></section>;
}
